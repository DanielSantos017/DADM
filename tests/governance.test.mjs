import assert from "node:assert/strict";
import test from "node:test";
import { decisionFromVotes, evaluateQuoteEvidence, requiredBodies, validateGovernancePolicy, validateGovernanceRequest } from "../src/lib/governance.ts";

const policy = validateGovernancePolicy({
  version: "1",
  treasury: { memberUids: ["t1", "t2", "t3"], quorum: 2 },
  council: { memberUids: ["c1", "c2"], quorum: 2 },
  reimbursementExceptionBodies: ["treasury", "council"],
});

test("solicitação exige valor positivo e necessidade descrita", () => {
  assert.equal(validateGovernanceRequest({ kind: "project_budget", purpose: "Compra de materiais", amountCents: 15_000 }).amountCents, 15_000);
  assert.throws(() => validateGovernanceRequest({ kind: "project_budget", purpose: "curta", amountCents: 15_000 }));
  assert.throws(() => validateGovernanceRequest({ kind: "project_budget", purpose: "Compra de materiais", amountCents: -1 }));
});

test("não presume quórum ou membros dos órgãos", () => {
  assert.throws(() => validateGovernancePolicy(null));
  assert.throws(() => validateGovernancePolicy({ ...policy, treasury: { memberUids: ["t1"], quorum: 2 } }));
  assert.throws(() => validateGovernancePolicy({ ...policy, council: { memberUids: ["t1", "c1"], quorum: 2 } }));
});

test("uso da reserva requer quórum dos dois órgãos", () => {
  assert.deepEqual(requiredBodies("reserve_release", policy), ["treasury", "council"]);
  const request = { kind: "reserve_release", votes: { treasury: { t1: { decision: "approve" }, t2: { decision: "approve" } } } };
  assert.equal(decisionFromVotes(request, policy), "pending");
  request.votes.council = { c1: { decision: "approve" }, c2: { decision: "approve" } };
  assert.equal(decisionFromVotes(request, policy), "approved");
});

test("votos de pessoas fora do órgão não contam", () => {
  const request = { kind: "project_budget", votes: { treasury: { outsider: { decision: "approve" }, t1: { decision: "approve" } } } };
  assert.equal(decisionFromVotes(request, policy), "pending");
});

test("três propostas documentadas de fornecedores distintos identificam o menor custo", () => {
  const quote = (supplierName, totalCents) => ({ supplierName, totalCents, documentPath: "governance/private.pdf", mimeType: "application/pdf", uploadedAt: 1, uploadedByUid: "user" });
  const quotes = { one: quote("Fornecedor A", 11000), two: quote("Fornecedor B", 9500), three: quote("Fornecedor C", 10000) };
  assert.equal(evaluateQuoteEvidence(quotes).winnerId, "two");
  assert.throws(() => evaluateQuoteEvidence({ one: quotes.one, two: quotes.two }), /três/);
  assert.throws(() => evaluateQuoteEvidence({ ...quotes, three: quote("Fornecedor A", 10000) }), /distintos/);
});
