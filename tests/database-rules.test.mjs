import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { get, ref, set } from "firebase/database";

let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-dadm-rules",
    database: { rules: await readFile(new URL("../database.rules.json", import.meta.url), "utf8") },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.database();
    await set(ref(database, "roles/treasurer"), { email: "treasurer@example.com", role: "tesoureiro" });
    await set(ref(database, "roles/member"), { email: "member@example.com", role: "usuario" });
    await set(ref(database, "reimbursements/abc12345"), { status: "pendente", source: "public" });
    await set(ref(database, "reimbursements/legacy123"), { status: "pendente", amount: 10 });
    await set(ref(database, "reimbursement_private/abc12345"), { pixKey: "private-key" });
  });
});

after(async () => {
  await environment?.cleanup();
});

test("visitante não lê nem escreve pedidos ou chaves Pix", async () => {
  const database = environment.unauthenticatedContext().database();
  await assertFails(get(ref(database, "reimbursements")));
  await assertFails(set(ref(database, "reimbursements/new12345"), { status: "pendente" }));
  await assertFails(get(ref(database, "reimbursement_private/abc12345")));
});

test("usuário comum lê apenas seu perfil e não vê caixa ou pedidos", async () => {
  const database = environment.authenticatedContext("member", { email: "member@example.com" }).database();
  const profile = await assertSucceeds(get(ref(database, "roles/member")));
  assert.equal(profile.val().role, "usuario");
  await assertFails(get(ref(database, "transactions")));
  await assertFails(get(ref(database, "reimbursements")));
});

test("tesouraria lê pedidos, mas não acessa dados privados pelo SDK do navegador", async () => {
  const database = environment.authenticatedContext("treasurer", { email: "treasurer@example.com" }).database();
  await assertSucceeds(get(ref(database, "reimbursements")));
  await assertFails(get(ref(database, "reimbursement_private/abc12345")));
  await assertFails(set(ref(database, "reimbursements/abc12345/status"), "pago"));
  await assertFails(set(ref(database, "reimbursements/legacy123/status"), "aprovado"));
  await assertFails(set(ref(database, "reimbursements/legacy123"), null));
  await assertFails(set(ref(database, "transactions/unsafe123"), { type: "expense", amount: 100 }));
});

test("usuário novo só pode criar um perfil pendente para si", async () => {
  const database = environment.authenticatedContext("new-user", { email: "new@example.com" }).database();
  await assertSucceeds(set(ref(database, "roles/new-user"), { email: "new@example.com", role: "pendente" }));
  await assertFails(set(ref(database, "roles/new-user"), { email: "new@example.com", role: "tesoureiro" }));
});

test("solicitações e política de governança só passam pelas rotas do servidor", async () => {
  const database = environment.authenticatedContext("treasurer", { email: "treasurer@example.com" }).database();
  await assertFails(get(ref(database, "governance_requests")));
  await assertFails(set(ref(database, "governance_requests/test12345"), { status: "approved" }));
  await assertFails(set(ref(database, "governance_policy"), { treasury: { quorum: 1 } }));
  await assertFails(set(ref(database, "reserve_account/reserveBalanceCents"), 999999));
  await assertFails(set(ref(database, "authorization_usage/test12345"), { targetId: "unsafe" }));
});
