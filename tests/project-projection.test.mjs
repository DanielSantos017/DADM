import assert from "node:assert/strict";
import test from "node:test";
import { cashBalanceCents, projectTotalsCents } from "../src/lib/project-projection.ts";

test("projetos ativos entram na projeção, fechados não", () => {
  const entries = { a: { type: "income", amount: 100 }, b: { type: "expense", amount: 30 } };
  assert.equal(projectTotalsCents({ status: "Aberto", entries }).contributionCents, 7000);
  assert.equal(projectTotalsCents({ status: "Pendente_Aprovacao", entries }).contributionCents, 7000);
  assert.equal(projectTotalsCents({ status: "Processado", entries }).contributionCents, 0);
});

test("reabertura desconta valor já incorporado ao Caixa, mostrando só a variação", () => {
  const project = { status: "Aberto", projectionBaselineCents: 7000, entries: {
    a: { type: "income", amount: 100 }, b: { type: "expense", amount: 40 },
  } };
  assert.equal(projectTotalsCents(project).contributionCents, -1000);
  assert.equal(cashBalanceCents([{ type: "income", amount: 70 }]) + projectTotalsCents(project).contributionCents, 6000);
});
