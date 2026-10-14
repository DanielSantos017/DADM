import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDatabase, requireActiveUser } from "@/lib/firebase-admin";
import { decisionFromVotes, evaluateQuoteEvidence, requiredBodies, validateGovernancePolicy, type Body, type GovernanceRequest, type GovernancePolicy } from "@/lib/governance";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActiveUser(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    const { id } = await context.params;
    if (!/^[-A-Za-z0-9_]{8,120}$/.test(id)) return NextResponse.json({ error: "Protocolo inválido." }, { status: 400 });
    const input = await request.json();
    const decision = input?.decision;
    const body = input?.body as Body;
    const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
    if (!["approve", "reject", "veto"].includes(decision) || (decision !== "approve" && reason.length < 10)) {
      return NextResponse.json({ error: "Decisão ou justificativa inválida." }, { status: 400 });
    }
    const database = adminDatabase();
    const policySnapshot = await database.ref("governance_policy").get();
    let policy: GovernancePolicy | null = null;
    try { policy = validateGovernancePolicy(policySnapshot.val()); } catch { /* Sem política colegiada, só autorização expressa do tesoureiro. */ }
    const ref = database.ref(`governance_requests/${id}`);
    const existing = (await ref.get()).val() as GovernanceRequest | null;
    if (!existing) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
    if (existing.status !== "pending") return NextResponse.json({ error: "Esta solicitação já foi decidida." }, { status: 409 });
    if (decision === "approve" && (existing.kind === "spending_authorization" || existing.kind === "unplanned_expense")) {
      try {
        const { winner } = evaluateQuoteEvidence(existing.quotes);
        if (winner.totalCents > existing.amountCents) throw new Error("O menor orçamento excede o valor solicitado.");
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Cotações insuficientes." }, { status: 409 });
      }
    }

    if (existing.kind === "unplanned_expense" || decision === "veto") {
      if (actor.role !== "tesoureiro") return NextResponse.json({ error: "Decisão exclusiva do tesoureiro." }, { status: 403 });
    } else {
      if (!policy) return NextResponse.json({ error: "Política colegiada ainda não configurada." }, { status: 503 });
      if (!requiredBodies(existing.kind, policy).includes(body) || !policy[body].memberUids.includes(actor.uid)) {
        return NextResponse.json({ error: "Você não integra o órgão responsável por esta decisão." }, { status: 403 });
      }
    }
    const now = Date.now();
    const activePolicy = policy;
    const policyHash = activePolicy ? createHash("sha256").update(JSON.stringify(activePolicy)).digest("hex") : null;
    const result = await ref.transaction((current: GovernanceRequest | null) => {
      if (!current || current.status !== "pending") return;
      if (current.kind !== existing.kind) return;
      if (decision === "approve" && (current.kind === "spending_authorization" || current.kind === "unplanned_expense")) {
        try {
          const { winner } = evaluateQuoteEvidence(current.quotes);
          if (winner.totalCents > current.amountCents) return;
        } catch { return; }
      }
      if (current.kind === "unplanned_expense") {
        if (current.decidedAt) return;
        return {
          ...current,
          status: decision === "approve" ? "approved" : "rejected",
          decidedAt: now,
          decisionPolicyVersion: "express_treasurer",
          votes: { treasury: { [actor.uid]: { decision: decision === "approve" ? "approve" : "reject", at: now, reason, email: actor.email } } },
        };
      }
      if (decision === "veto") {
        return { ...current, status: "rejected", decidedAt: now, veto: { byUid: actor.uid, email: actor.email, at: now, reason } };
      }
      if (!activePolicy || !policyHash || (current.decisionPolicyVersion && current.decisionPolicyVersion !== activePolicy.version)
        || (current.decisionPolicyHash && current.decisionPolicyHash !== policyHash)
        || current.votes?.[body]?.[actor.uid]) return;
      const next: GovernanceRequest = {
        ...current,
        decisionPolicyVersion: activePolicy.version,
        decisionPolicyHash: policyHash,
        votes: {
          ...current.votes,
          [body]: {
            ...current.votes?.[body],
            [actor.uid]: { decision, at: now, reason, email: actor.email },
          },
        },
      };
      next.status = decisionFromVotes(next, activePolicy);
      if (next.status !== "pending") next.decidedAt = now;
      return next;
    }, undefined, false);
    if (!result.committed) return NextResponse.json({ error: "Voto duplicado, política alterada ou solicitação já decidida." }, { status: 409 });
    return NextResponse.json({ status: result.snapshot.val()?.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao registrar decisão colegiada:", error);
    return NextResponse.json({ error: "Não foi possível registrar a decisão." }, { status: 503 });
  }
}
