import { NextResponse } from "next/server";
import { adminDatabase, requireBoard } from "@/lib/firebase-admin";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireBoard(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    if (actor.role !== "tesoureiro") return NextResponse.json({ error: "Estorno exclusivo da Tesouraria." }, { status: 403 });
    const { id } = await context.params;
    if (!/^[-A-Za-z0-9_]{8,120}$/.test(id)) return NextResponse.json({ error: "Lançamento inválido." }, { status: 400 });
    const body = await request.json();
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10 || reason.length > 500) return NextResponse.json({ error: "Justifique o estorno em 10 a 500 caracteres." }, { status: 400 });
    const database = adminDatabase();
    const original = (await database.ref(`transactions/${id}`).get()).val();
    const amountCents = Math.round(Number(original?.amount) * 100);
    if (!original || !["income", "expense"].includes(original.type) || !Number.isSafeInteger(amountCents) || amountCents <= 0
      || original.reversesTransactionId || original.isProject || original.reimbursementId) {
      return NextResponse.json({ error: "Lançamento não elegível para estorno automático." }, { status: 409 });
    }
    const reserve = (await database.ref("reserve_account").get()).val();
    if (reserve?.allocations?.[id] || Object.values(reserve?.releases || {}).some((value) =>
      value && typeof value === "object" && "transactionId" in value && value.transactionId === id)) {
      return NextResponse.json({ error: "Lançamento vinculado à reserva exige conciliação específica antes do estorno." }, { status: 409 });
    }
    const reversalId = `reversal_${id}`;
    const now = Date.now();
    const result = await database.ref(`transactions/${reversalId}`).transaction((current) => current === null ? {
      id: reversalId,
      description: `Estorno: ${String(original.description || id).slice(0, 400)}`,
      amount: amountCents / 100,
      type: original.type === "income" ? "expense" : "income",
      category: "Estornos",
      date: now, timestamp: now, createdAtIso: new Date(now).toISOString(), createdByEmail: actor.email,
      createdByUid: actor.uid, reversesTransactionId: id, reversalReason: reason,
      metadata: { source: "server_reversal", version: "2.0" },
    } : undefined, undefined, false);
    if (!result.committed) return NextResponse.json({ error: "Este lançamento já foi estornado." }, { status: 409 });
    return NextResponse.json({ id: reversalId }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao estornar lançamento:", error);
    return NextResponse.json({ error: "Não foi possível registrar o estorno." }, { status: 503 });
  }
}
