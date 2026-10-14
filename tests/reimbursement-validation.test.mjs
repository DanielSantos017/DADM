import assert from "node:assert/strict";
import { test } from "node:test";
import { receiptContentType, validatePublicReimbursement } from "../src/lib/reimbursement-validation.ts";

function validForm() {
  const form = new FormData();
  form.set("name", "Maria Oliveira");
  form.set("email", "maria@example.com");
  form.set("pixKey", "maria@example.com");
  form.set("pixHolderName", "Maria Oliveira");
  form.set("justification", "Compra de materiais para o evento.");
  form.set("amount", "123,45");
  form.set("expenseAt", "2026-07-01T12:00:00.000Z");
  return form;
}

test("aceita dados completos e normaliza valor em reais", () => {
  const data = validatePublicReimbursement(validForm());
  assert.equal(data.amount, 123.45);
  assert.equal(data.email, "maria@example.com");
  assert.equal(data.expenseAt, "2026-07-01T12:00:00.000Z");
});

test("recusa gasto futuro e protocolo malformado", () => {
  const form = validForm();
  form.set("expenseAt", "2999-01-01T12:00:00.000Z");
  assert.throws(() => validatePublicReimbursement(form), /data e hora/);
  form.set("expenseAt", "2026-07-01T12:00:00.000Z");
  form.set("authorizationProtocol", "../../roles");
  assert.throws(() => validatePublicReimbursement(form), /Protocolo/);
});

test("recusa valor nulo e justificativa curta", () => {
  const form = validForm();
  form.set("amount", "0");
  assert.throws(() => validatePublicReimbursement(form), /maior que zero/);
  form.set("amount", "10.00");
  form.set("justification", "curta");
  assert.throws(() => validatePublicReimbursement(form), /justificativa/);
});

test("identifica o tipo real do comprovante pelos bytes", () => {
  assert.equal(receiptContentType(Buffer.from("%PDF-1.7\n")).type, "application/pdf");
  assert.equal(receiptContentType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])).type, "image/png");
  assert.throws(() => receiptContentType(Buffer.from("arquivo falso")), /PDF, PNG ou JPG/);
});
