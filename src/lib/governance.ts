export const requestKinds = [
  "project_budget",
  "spending_authorization",
  "unplanned_expense",
  "reimbursement_exception",
  "reserve_release",
] as const;

export type RequestKind = typeof requestKinds[number];
export type Body = "treasury" | "council";
export type Vote = { decision: "approve" | "reject"; at: number; reason: string; email: string };
export type Votes = Partial<Record<Body, Record<string, Vote>>>;
export type GovernancePolicy = {
  version: string;
  treasury: { memberUids: string[]; quorum: number };
  council: { memberUids: string[]; quorum: number };
  reimbursementExceptionBodies: Body[];
};

export type GovernanceRequest = {
  id?: string;
  kind: RequestKind;
  purpose: string;
  amountCents: number;
  projectId?: string;
  reimbursementId?: string;
  createdAt: number;
  createdByUid: string;
  createdByEmail: string;
  status: "pending" | "approved" | "rejected";
  votes?: Votes;
  quotes?: Record<string, QuoteEvidence>;
  decidedAt?: number;
  decisionPolicyVersion?: string;
  decisionPolicyHash?: string;
  veto?: { byUid: string; email: string; at: number; reason: string };
};

export type QuoteEvidence = {
  supplierName: string;
  totalCents: number;
  documentPath: string;
  mimeType: string;
  uploadedAt: number;
  uploadedByUid: string;
};

export function evaluateQuoteEvidence(quotes: Record<string, QuoteEvidence> | undefined) {
  const entries = Object.entries(quotes || {});
  if (entries.length < 3) throw new Error("São necessárias três cotações documentadas.");
  const suppliers = new Set<string>();
  for (const [, quote] of entries) {
    const supplier = quote.supplierName?.trim().toLocaleLowerCase("pt-BR");
    if (!supplier || !Number.isSafeInteger(quote.totalCents) || quote.totalCents <= 0 || !quote.documentPath) {
      throw new Error("Há cotação incompleta.");
    }
    suppliers.add(supplier);
  }
  if (suppliers.size < 3) throw new Error("As cotações devem vir de três fornecedores distintos.");
  const [winnerId, winner] = entries.sort((a, b) => a[1].totalCents - b[1].totalCents || a[0].localeCompare(b[0]))[0];
  return { winnerId, winner, count: entries.length };
}

export function validateGovernanceRequest(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Solicitação inválida.");
  const data = input as Record<string, unknown>;
  if (!requestKinds.includes(data.kind as RequestKind)) throw new Error("Tipo de solicitação inválido.");
  const purpose = typeof data.purpose === "string" ? data.purpose.trim() : "";
  const amountCents = Number(data.amountCents);
  const projectId = typeof data.projectId === "string" ? data.projectId.trim() : "";
  const reimbursementId = typeof data.reimbursementId === "string" ? data.reimbursementId.trim() : "";
  if (purpose.length < 10 || purpose.length > 2000) throw new Error("Descreva a necessidade em 10 a 2000 caracteres.");
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 1_000_000_000) {
    throw new Error("Informe um valor positivo em centavos.");
  }
  if (projectId && !/^[-A-Za-z0-9_]{8,120}$/.test(projectId)) throw new Error("Projeto inválido.");
  if (data.kind === "reimbursement_exception" && !/^[-A-Za-z0-9_]{8,120}$/.test(reimbursementId)) {
    throw new Error("Informe o protocolo do reembolso para a exceção.");
  }
  return { kind: data.kind as RequestKind, purpose, amountCents, ...(projectId ? { projectId } : {}), ...(reimbursementId ? { reimbursementId } : {}) };
}

export function validateGovernancePolicy(input: unknown): GovernancePolicy {
  if (!input || typeof input !== "object") throw new Error("Política de aprovação não configurada.");
  const policy = input as GovernancePolicy;
  if (typeof policy.version !== "string" || !policy.version.trim()) throw new Error("Versão da política inválida.");
  for (const body of ["treasury", "council"] as const) {
    const rule = policy[body];
    if (!rule || !Array.isArray(rule.memberUids) || rule.memberUids.length === 0
      || new Set(rule.memberUids).size !== rule.memberUids.length
      || !Number.isSafeInteger(rule.quorum) || rule.quorum < 1 || rule.quorum > rule.memberUids.length) {
      throw new Error(`Composição ou quórum de ${body} inválido.`);
    }
  }
  if (policy.treasury.memberUids.some((uid) => policy.council.memberUids.includes(uid))) {
    throw new Error("O mesmo usuário não pode satisfazer os dois órgãos.");
  }
  if (!Array.isArray(policy.reimbursementExceptionBodies)
    || policy.reimbursementExceptionBodies.length === 0
    || policy.reimbursementExceptionBodies.some((body) => body !== "treasury" && body !== "council")
    || new Set(policy.reimbursementExceptionBodies).size !== policy.reimbursementExceptionBodies.length) {
    throw new Error("Órgãos da exceção de reembolso não configurados.");
  }
  return policy;
}

export function requiredBodies(kind: RequestKind, policy: GovernancePolicy): Body[] {
  if (kind === "unplanned_expense") return [];
  if (kind === "reserve_release") return ["treasury", "council"];
  if (kind === "reimbursement_exception") return policy.reimbursementExceptionBodies;
  return ["treasury"];
}

export function decisionFromVotes(request: GovernanceRequest, policy: GovernancePolicy) {
  if (request.veto) return "rejected" as const;
  if (request.kind === "unplanned_expense") return "pending" as const;
  const bodies = requiredBodies(request.kind, policy);
  const rejected = bodies.some((body) => Object.entries(request.votes?.[body] || {})
    .filter(([uid, vote]) => policy[body].memberUids.includes(uid) && vote.decision === "reject").length >= policy[body].quorum);
  if (rejected) return "rejected" as const;
  const approved = bodies.every((body) => Object.entries(request.votes?.[body] || {})
    .filter(([uid, vote]) => policy[body].memberUids.includes(uid) && vote.decision === "approve").length >= policy[body].quorum);
  return approved ? "approved" as const : "pending" as const;
}
