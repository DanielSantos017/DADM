import { NextResponse } from "next/server";
import { adminDatabase, requireBoard } from "@/lib/firebase-admin";
import type { GovernanceRequest } from "@/lib/governance";

export const runtime = "nodejs";

const validId = (value: unknown): value is string => typeof value === "string" && /^[-A-Za-z0-9_]{8,120}$/.test(value);

export async function POST(request: Request) {
  try {
    const actor = await requireBoard(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    if (Number(request.headers.get("content-length") || 0) > 16_384) return NextResponse.json({ error: "Dados acima do limite." }, { status: 413 });
    const input = await request.json();
    const description = typeof input?.description === "string" ? input.description.trim() : "";
    const category = typeof input?.category === "string" ? input.category.trim() : "";
    const type = input?.type;
    const amountCents = Math.round(Number(input?.amount) * 100);
    if (description.length < 5 || description.length > 500 || category.length < 1 || category.length > 120
      || !["income", "expense"].includes(type) || !Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 1_000_000_000) {
      return NextResponse.json({ error: "Informe tipo, descrição, categoria e valor válidos." }, { status: 400 });
    }
    if (actor.role !== "tesoureiro" && type === "income") {
      return NextResponse.json({ error: "Registro de receita exclusivo da Tesouraria." }, { status: 403 });
    }
    const database = adminDatabase();
    let authorizationId: string | undefined;
    if (type === "expense") {
      authorizationId = input?.authorizationId;
      if (!validId(authorizationId)) return NextResponse.json({ error: "Informe o protocolo de autorização do gasto." }, { status: 400 });
      const approval = (await database.ref(`governance_requests/${authorizationId}`).get()).val() as GovernanceRequest | null;
      if (!approval || approval.status !== "approved" || !["spending_authorization", "unplanned_expense"].includes(approval.kind)
        || approval.amountCents < amountCents || approval.projectId || !approval.decidedAt) {
        return NextResponse.json({ error: "Autorização aprovada, individual e suficiente não encontrada." }, { status: 409 });
      }
    }
    const id = authorizationId ? `expense_${authorizationId}` : database.ref("transactions").push().key;
    if (!id) throw new Error("Não foi possível gerar o identificador.");
    const now = Date.now();
    const usageRef = authorizationId ? database.ref(`authorization_usage/${authorizationId}`) : null;
    if (usageRef) {
      const claimed = await usageRef.transaction((current) => current === null ? { kind: "cash_expense", targetId: id, at: now, byUid: actor.uid } : undefined, undefined, false);
      if (!claimed.committed) return NextResponse.json({ error: "Esta autorização já está vinculada a outro gasto ou reembolso." }, { status: 409 });
    }
    const transaction = {
      id, description, category, amount: amountCents / 100, type, date: now, timestamp: now,
      createdAtIso: new Date(now).toISOString(), createdByEmail: actor.email, createdByUid: actor.uid,
      ...(authorizationId ? { authorizationId } : {}),
      metadata: { source: "server_api", version: "2.0" },
    };
    let result;
    try {
      result = await database.ref(`transactions/${id}`).transaction((current) => current === null ? transaction : undefined, undefined, false);
    } catch (error) {
      if (usageRef) await usageRef.transaction((current) => current?.targetId === id ? null : undefined, undefined, false).catch(() => undefined);
      throw error;
    }
    if (!result.committed) {
      if (usageRef) await usageRef.transaction((current) => current?.targetId === id ? null : undefined, undefined, false).catch(() => undefined);
      return NextResponse.json({ error: "Esta autorização já foi usada no Caixa." }, { status: 409 });
    }
    return NextResponse.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao lançar no Caixa:", error);
    return NextResponse.json({ error: "Não foi possível registrar o lançamento." }, { status: 503 });
  }
}
