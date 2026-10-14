import { NextResponse } from "next/server";
import { adminDatabase, requireBoard } from "@/lib/firebase-admin";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireBoard(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    if (actor.role !== "tesoureiro") return NextResponse.json({ error: "Somente o tesoureiro pode reabrir projetos fechados." }, { status: 403 });
    const { id } = await context.params;
    if (!/^[-A-Za-z0-9_]{8,120}$/.test(id)) return NextResponse.json({ error: "Projeto inválido." }, { status: 400 });
    if (Number(request.headers.get("content-length") || 0) > 2048) return NextResponse.json({ error: "Justificativa muito longa." }, { status: 413 });
    const body = await request.json();
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10 || reason.length > 500) return NextResponse.json({ error: "Informe justificativa de 10 a 500 caracteres." }, { status: 400 });

    const database = adminDatabase();
    const projectRef = database.ref(`projects/${id}`);
    const project = (await projectRef.get()).val() as { name?: string; status?: string } | null;
    if (!project || project.status !== "Processado") return NextResponse.json({ error: "Somente projetos fechados podem ser reabertos." }, { status: 409 });

    // Um fechamento legado podia ter lançado o saldo líquido no Caixa. Ao reabrir,
    // a projeção considera apenas a variação que ainda não está no saldo fechado.
    const transactions = Object.entries((await database.ref("transactions").get()).val() || {}) as [string, Record<string, unknown>][];
    const settlements = transactions.filter(([, item]) => item.projectId === id
      || (item.isProject === true && item.description === `Projeto/Evento: ${project.name}`));
    if (settlements.length > 1) return NextResponse.json({ error: "Há mais de um lançamento de fechamento associado. Faça conciliação manual antes de reabrir." }, { status: 409 });
    const settlement = settlements[0]?.[1];
    const amountCents = settlement ? Math.round(Number(settlement.amount) * 100) : 0;
    if (settlement && (!Number.isSafeInteger(amountCents) || amountCents < 0 || !["income", "expense"].includes(String(settlement.type)))) {
      return NextResponse.json({ error: "Lançamento de fechamento inválido. Faça conciliação manual." }, { status: 409 });
    }
    const baselineCents = settlement?.type === "expense" ? -amountCents : amountCents;
    const historyRef = database.ref(`project_reopen_history/${id}`);
    const historyId = historyRef.push().key;
    if (!historyId) throw new Error("Não foi possível gerar registro de auditoria.");
    const now = Date.now();
    const result = await projectRef.transaction((current) => {
      if (!current || current.status !== "Processado" || current.name !== project.name) return;
      return {
        ...current,
        status: "Aberto",
        projectionBaselineCents: baselineCents,
        lastReopenedAt: now,
        lastReopenedBy: actor.email,
        lastReopenReason: reason,
      };
    }, undefined, false);
    if (!result.committed) return NextResponse.json({ error: "Projeto alterado por outra pessoa. Atualize a tela." }, { status: 409 });
    await historyRef.child(historyId).set({ at: now, byUid: actor.uid, byEmail: actor.email, reason, projectionBaselineCents: baselineCents, settlementTransactionId: settlements[0]?.[0] || null })
      .catch((error) => console.error("Projeto reaberto com auditoria resumida, mas sem histórico adicional:", error));
    return NextResponse.json({ status: "Aberto", projectionBaselineCents: baselineCents }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao reabrir projeto:", error);
    return NextResponse.json({ error: "Não foi possível reabrir o projeto." }, { status: 503 });
  }
}
