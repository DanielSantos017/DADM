import { NextResponse } from "next/server";
import { adminDatabase, adminStorage, requireBoard } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    if (!(await requireBoard(request))) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    const { id } = await context.params;
    if (!/^[-A-Za-z0-9_]{8,120}$/.test(id)) {
      return NextResponse.json({ error: "Protocolo inválido." }, { status: 400 });
    }

    const snapshot = await adminDatabase().ref(`reimbursement_private/${id}/receiptPath`).get();
    const path = snapshot.val();
    if (typeof path !== "string" || !path.startsWith(`reimbursements/${id}/`)) {
      return NextResponse.json({ error: "Comprovante não encontrado." }, { status: 404 });
    }

    const [buffer] = await adminStorage().bucket().file(path).download();
    const contentType = path.endsWith(".pdf") ? "application/pdf" : path.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="comprovante-${id}.${path.split(".").pop()}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Erro ao abrir comprovante:", error);
    return NextResponse.json({ error: "Não foi possível abrir o comprovante." }, { status: 503 });
  }
}
