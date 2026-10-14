import assert from "node:assert/strict";
import test from "node:test";
import { allocateNetReceipt, calculateNetReceipt, fiscalReceiptDeadline } from "../src/lib/compliance.ts";

test("receita líquida subtrai taxas e estornos sem apagar o bruto", () => {
  assert.equal(calculateNetReceipt(100_00, 3_00, 7_00), 90_00);
  assert.equal(allocateNetReceipt(calculateNetReceipt(100_00, 3_00, 7_00)).reserveCents, 18_00);
  assert.throws(() => calculateNetReceipt(100_00, -1, 0));
  assert.throws(() => calculateNetReceipt(100_00, 50_00, 50_00));
});

test("reserva exatamente 20% em centavos, sem criar receita adicional", () => {
  assert.deepEqual(allocateNetReceipt(100_00), {
    netReceiptCents: 100_00,
    reserveCents: 20_00,
    operatingCents: 80_00,
  });
  const odd = allocateNetReceipt(100_01);
  assert.equal(odd.reserveCents + odd.operatingCents, odd.netReceiptCents);
});

test("recusa valores inválidos e negativos na alocação", () => {
  for (const value of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => allocateNetReceipt(value));
  }
});

test("prazo de cinco dias úteis exclui fim de semana e feriados informados", () => {
  assert.equal(fiscalReceiptDeadline("2026-10-09"), "2026-10-16");
  assert.equal(fiscalReceiptDeadline("2026-10-09", ["2026-10-12"]), "2026-10-19");
});

test("recusa data inválida", () => {
  assert.throws(() => fiscalReceiptDeadline("2026-02-30"));
});
