import { NextResponse } from "next/server";
import { adminDatabase, adminStorage, requireBoard } from "@/lib/firebase-admin";
import { MAX_RECEIPT_SIZE, receiptContentType } from "@/lib/reimbursement-validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function validId(id: string) {
  return /^[-A-Za-z0-9_]{8,120}$/.test(id);
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireBoard(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    const { id } = await context.params;
    if (!validId(id)) return NextResponse.json({ error: "Lançamento inválido." }, { status: 400 });
    if (Number(request.headers.get("content-length") || 0) > MAX_RECEIPT_SIZE + 100_000) {
      return NextResponse.json({ error: "Arquivo acima de 5 MB." }, { status: 413 });
    }
    const transactionRef = adminDatabase().ref(`transactions/${id}`);
    const transaction = (await transactionRef.get()).val();
    if (!transaction) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    if (transaction.document) return NextResponse.json({ error: "Este lançamento já tem documento anexado." }, { status: 409 });
    const form = await request.formData();
    const file = form.get("document");
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_RECEIPT_SIZE) {
      return NextResponse.json({ error: "Selecione PDF, PNG ou JPG de até 5 MB." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const { type, extension } = receiptContentType(buffer);
    const path = `transactions/${id}/document.${extension}`;
    const name = file.name.slice(0, 180) || `documento.${extension}`;
    await adminStorage().bucket().file(path).save(buffer, { resumable: false, contentType: type, metadata: { cacheControl: "private, no-store" } });
    const document = { path, name, mimeType: type, uploadedAt: Date.now(), uploadedByUid: actor.uid };
    const result = await transactionRef.transaction((current) => current && !current.document ? { ...current, document } : undefined, undefined, false);
    if (!result.committed) return NextResponse.json({ error: "Documento já anexado ou lançamento removido." }, { status: 409 });
    return NextResponse.json({ document }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && /comprovante/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Erro ao anexar documento do Caixa:", error);
    return NextResponse.json({ error: "Não foi possível anexar o documento." }, { status: 503 });
  }
}

export async function GET(request: Request, context: Context) {
  try {
    if (!(await requireBoard(request))) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    const { id } = await context.params;
    if (!validId(id)) return NextResponse.json({ error: "Lançamento inválido." }, { status: 400 });
    const document = (await adminDatabase().ref(`transactions/${id}/document`).get()).val();
    if (!document || typeof document.path !== "string" || !/^transactions\/[-A-Za-z0-9_]{8,120}\/document\.(pdf|png|jpg)$/.test(document.path)
      || !document.path.startsWith(`transactions/${id}/`)) {
      return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    }
    const [buffer] = await adminStorage().bucket().file(document.path).download();
    const contentType = document.path.endsWith(".pdf") ? "application/pdf" : document.path.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="documento-${id}.${document.path.split(".").pop()}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Erro ao abrir documento do Caixa:", error);
    return NextResponse.json({ error: "Não foi possível abrir o documento." }, { status: 503 });
  }
}
