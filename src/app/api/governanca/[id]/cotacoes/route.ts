import { NextResponse } from "next/server";
import { adminDatabase, adminStorage, requireActiveUser } from "@/lib/firebase-admin";
import { MAX_RECEIPT_SIZE, receiptContentType } from "@/lib/reimbursement-validation";
import type { GovernanceRequest } from "@/lib/governance";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActiveUser(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    const { id } = await context.params;
    if (!/^[-A-Za-z0-9_]{8,120}$/.test(id)) return NextResponse.json({ error: "Protocolo inválido." }, { status: 400 });
    if (Number(request.headers.get("content-length") || 0) > 7 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande." }, { status: 413 });
    }
    const database = adminDatabase();
    const ref = database.ref(`governance_requests/${id}`);
    const record = (await ref.get()).val() as GovernanceRequest | null;
    if (!record || (record.kind !== "spending_authorization" && record.kind !== "unplanned_expense")) {
      return NextResponse.json({ error: "Solicitação de gasto não encontrada." }, { status: 404 });
    }
    if (record.createdByUid !== actor.uid && actor.role !== "tesoureiro" && actor.role !== "coordenador") {
      return NextResponse.json({ error: "Você não pode anexar a este pedido." }, { status: 403 });
    }
    if (record.status !== "pending" || (record.votes && Object.values(record.votes).some((votes) => Object.keys(votes || {}).length > 0))) {
      return NextResponse.json({ error: "As cotações não podem mudar após o início da decisão." }, { status: 409 });
    }
    const form = await request.formData();
    const supplierName = String(form.get("supplierName") || "").trim();
    const totalCents = Number(form.get("totalCents"));
    const file = form.get("file");
    if (supplierName.length < 3 || supplierName.length > 120 || !Number.isSafeInteger(totalCents) || totalCents <= 0
      || !(file instanceof File) || file.size === 0 || file.size > MAX_RECEIPT_SIZE) {
      return NextResponse.json({ error: "Informe fornecedor, custo total e arquivo de até 5 MB." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const { type, extension } = receiptContentType(buffer);
    const quoteId = database.ref(`governance_requests/${id}/quotes`).push().key;
    if (!quoteId) throw new Error("Não foi possível gerar identificador da cotação.");
    const documentPath = `governance/${id}/quotes/${quoteId}.${extension}`;
    const storedFile = adminStorage().bucket().file(documentPath);
    await storedFile.save(buffer, { resumable: false, contentType: type, metadata: { cacheControl: "private, no-store" } });
    try {
      const result = await ref.transaction((current: GovernanceRequest | null) => {
        if (!current || current.status !== "pending" || (current.votes && Object.values(current.votes).some((votes) => Object.keys(votes || {}).length > 0))) return;
        if (Object.values(current.quotes || {}).some((quote) => quote.supplierName.trim().toLocaleLowerCase("pt-BR") === supplierName.toLocaleLowerCase("pt-BR"))) return;
        return {
          ...current,
          quotes: {
            ...current.quotes,
            [quoteId]: { supplierName, totalCents, documentPath, mimeType: type, uploadedAt: Date.now(), uploadedByUid: actor.uid },
          },
        };
      }, undefined, false);
      if (!result.committed) {
        await storedFile.delete().catch(() => undefined);
        return NextResponse.json({ error: "Decisão iniciada ou fornecedor já cotado." }, { status: 409 });
      }
      return NextResponse.json({ quoteId }, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await storedFile.delete().catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && /comprovante/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Erro ao anexar cotação:", error);
    return NextResponse.json({ error: "Não foi possível anexar a cotação." }, { status: 503 });
  }
}
