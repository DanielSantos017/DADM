import { NextResponse } from "next/server";
import { adminDatabase, requireBoard } from "@/lib/firebase-admin";
import type { GovernanceRequest } from "@/lib/governance";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
type Action = "approve" | "reject" | "cancel" | "paid";
type Reimbursement = {
  source?: string;
  status?: string;
  amount?: number;
  description?: string;
  paymentLockAt?: number;
  paymentLockBy?: string;
  expenseAt?: string;
  authorizationProtocol?: string;
  [key: string]: unknown;
};

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireBoard(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });

    const { id } = await context.params;
    if (!/^[-A-Za-z0-9_]{8,120}$/.test(id)) {
      return NextResponse.json({ error: "Protocolo inválido." }, { status: 400 });
    }

    const body = await request.json();
    const action = body?.action as Action;
    if (!["approve", "reject", "cancel", "paid"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }
    if (action === "paid" && actor.role !== "tesoureiro") {
      return NextResponse.json({ error: "Somente a tesouraria pode registrar pagamentos." }, { status: 403 });
    }

    const database = adminDatabase();
    const recordRef = database.ref(`reimbursements/${id}`);
    const now = Date.now();

    if (action !== "paid") {
      let approvalBasis: string | null = null;
      let usageRef: ReturnType<typeof database.ref> | null = null;
      if (action === "approve") {
        const current = (await recordRef.get()).val() as Reimbursement | null;
        if (!current || current.source !== "public" || current.status !== "pendente") {
          return NextResponse.json({ error: "O pedido não está pendente." }, { status: 409 });
        }
        const amountCents = Math.round(Number(current.amount) * 100);
        if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
          return NextResponse.json({ error: "Valor do pedido inválido." }, { status: 400 });
        }
        const expenseAt = current.expenseAt ? Date.parse(current.expenseAt) : Number.NaN;
        if (current.authorizationProtocol && Number.isFinite(expenseAt)) {
          const authorization = (await database.ref(`governance_requests/${current.authorizationProtocol}`).get()).val() as GovernanceRequest | null;
          if (authorization?.kind === "spending_authorization" && authorization.status === "approved"
            && typeof authorization.decidedAt === "number" && authorization.decidedAt < expenseAt
            && authorization.amountCents >= amountCents) {
            approvalBasis = current.authorizationProtocol;
          }
        }
        if (!approvalBasis) {
          const exceptionId = `exception_${id}`;
          const exception = (await database.ref(`governance_requests/${exceptionId}`).get()).val() as GovernanceRequest | null;
          if (exception?.kind === "reimbursement_exception" && exception.reimbursementId === id
            && exception.status === "approved" && exception.amountCents >= amountCents) {
            approvalBasis = exceptionId;
          }
        }
        if (!approvalBasis) {
          return NextResponse.json({ error: "Falta autorização prévia válida ou exceção aprovada para este reembolso." }, { status: 409 });
        }
        if (!approvalBasis.startsWith("exception_")) {
          usageRef = database.ref(`authorization_usage/${approvalBasis}`);
          const claimed = await usageRef.transaction((current) => current === null
            ? { kind: "reimbursement", targetId: id, at: now, byUid: actor.uid } : undefined, undefined, false);
          if (!claimed.committed) {
            return NextResponse.json({ error: "Esta autorização já foi usada em outro gasto ou reembolso." }, { status: 409 });
          }
        }
      }
      const nextStatus = action === "approve" ? "aprovado" : action === "reject" ? "recusado" : "cancelado";
      let committed = false;
      try {
        const result = await recordRef.transaction((current: Reimbursement | null) => {
          if (!current || current.source !== "public" || current.status !== "pendente") return;
          return { ...current, status: nextStatus, decidedAt: now, decidedBy: actor.email, ...(approvalBasis ? { approvalBasis } : {}) };
        }, undefined, false);
        committed = result.committed;
      } finally {
        if (!committed && usageRef) await usageRef.transaction((current) => current?.targetId === id ? null : undefined, undefined, false).catch(() => undefined);
      }
      if (!committed) return NextResponse.json({ error: "O pedido não está mais pendente." }, { status: 409 });
      return NextResponse.json({ status: nextStatus }, { headers: { "Cache-Control": "no-store" } });
    }

    const paymentReference = typeof body?.paymentReference === "string" ? body.paymentReference.trim() : "";
    if (paymentReference.length < 3 || paymentReference.length > 120) {
      return NextResponse.json({ error: "Informe a referência do pagamento Pix." }, { status: 400 });
    }

    const transactionId = `reimbursement_${id}`;
    const transactionRef = database.ref(`transactions/${transactionId}`);
    if ((await transactionRef.get()).exists()) {
      return NextResponse.json({ error: "Este pedido já tem lançamento no caixa." }, { status: 409 });
    }

    const claim = await recordRef.transaction((current: Reimbursement | null) => {
      if (!current || current.source !== "public") return;
      if (current.status !== "aprovado" && !(current.status === "registrando_pagamento" && now - (current.paymentLockAt || 0) > 5 * 60_000)) return;
      return { ...current, status: "registrando_pagamento", paymentLockAt: now, paymentLockBy: actor.uid };
    }, undefined, false);
    if (!claim.committed) return NextResponse.json({ error: "O pedido não está aprovado ou está sendo pago." }, { status: 409 });

    const reimbursement = claim.snapshot.val() as Reimbursement;
    if (!Number.isFinite(reimbursement.amount) || (reimbursement.amount || 0) <= 0) {
      await recordRef.update({ status: "aprovado", paymentLockAt: null, paymentLockBy: null });
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }

    try {
      await database.ref().update({
        [`reimbursements/${id}/status`]: "pago",
        [`reimbursements/${id}/paidAt`]: now,
        [`reimbursements/${id}/paidBy`]: actor.email,
        [`reimbursements/${id}/paymentLockAt`]: null,
        [`reimbursements/${id}/paymentLockBy`]: null,
        [`reimbursement_private/${id}/paymentReference`]: paymentReference,
        [`transactions/${transactionId}`]: {
          id: transactionId,
          description: `Reembolso: ${reimbursement.description || "Sem descrição"}`,
          amount: reimbursement.amount,
          type: "expense",
          date: now,
          category: "Reembolsos",
          createdByEmail: actor.email,
          timestamp: now,
          createdAtIso: new Date(now).toISOString(),
          reimbursementId: id,
        },
      });
      return NextResponse.json({ status: "pago" }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await recordRef.transaction((current: Reimbursement | null) => {
        if (current?.status !== "registrando_pagamento" || current.paymentLockBy !== actor.uid) return;
        return { ...current, status: "aprovado", paymentLockAt: null, paymentLockBy: null };
      }, undefined, false).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("Erro ao processar reembolso:", error);
    return NextResponse.json({ error: "Não foi possível atualizar o reembolso." }, { status: 503 });
  }
}
