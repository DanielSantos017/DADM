import { NextResponse } from "next/server";
import { adminDatabase, adminStorage, requireActiveUser } from "@/lib/firebase-admin";
import { validateGovernancePolicy, type GovernanceRequest } from "@/lib/governance";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; quoteId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActiveUser(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    const { id, quoteId } = await context.params;
    if (!/^[-A-Za-z0-9_]{8,120}$/.test(id) || !/^[-A-Za-z0-9_]{8,120}$/.test(quoteId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const database = adminDatabase();
    const record = (await database.ref(`governance_requests/${id}`).get()).val() as GovernanceRequest | null;
    const quote = record?.quotes?.[quoteId];
    if (!record || !quote || !quote.documentPath.startsWith(`governance/${id}/quotes/${quoteId}.`)) {
      return NextResponse.json({ error: "Cotação não encontrada." }, { status: 404 });
    }
    let allowed = record.createdByUid === actor.uid || actor.role === "tesoureiro" || actor.role === "coordenador";
    if (!allowed) {
      try {
        const policy = validateGovernancePolicy((await database.ref("governance_policy").get()).val());
        allowed = policy.treasury.memberUids.includes(actor.uid) || policy.council.memberUids.includes(actor.uid);
      } catch { /* Sem política, acesso apenas ao autor e diretoria. */ }
    }
    if (!allowed) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const [buffer] = await adminStorage().bucket().file(quote.documentPath).download();
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": quote.mimeType || "application/octet-stream", "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="cotacao-${quoteId}"` },
    });
  } catch (error) {
    console.error("Erro ao consultar cotação:", error);
    return NextResponse.json({ error: "Não foi possível baixar a cotação." }, { status: 503 });
  }
}
