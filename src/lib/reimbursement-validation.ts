export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

export type PublicReimbursement = {
  name: string;
  email: string;
  pixKey: string;
  pixHolderName: string;
  justification: string;
  amount: number;
  expenseAt: string;
  authorizationProtocol: string;
};

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function validatePublicReimbursement(form: FormData): PublicReimbursement {
  const name = field(form, "name");
  const email = field(form, "email").toLowerCase();
  const pixKey = field(form, "pixKey");
  const pixHolderName = field(form, "pixHolderName");
  const justification = field(form, "justification");
  const rawAmount = field(form, "amount");
  const expenseAt = field(form, "expenseAt");
  const authorizationProtocol = field(form, "authorizationProtocol");

  if (name.length < 3 || name.length > 120) throw new Error("Informe seu nome completo.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
  if (pixKey.length < 3 || pixKey.length > 120) throw new Error("Informe uma chave Pix válida.");
  if (pixHolderName.length < 3 || pixHolderName.length > 120) throw new Error("Informe o nome do titular da chave Pix.");
  if (justification.length < 10 || justification.length > 2000) throw new Error("A justificativa deve ter entre 10 e 2000 caracteres.");
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(rawAmount)) throw new Error("Informe um valor válido em reais.");

  const amount = Math.round(Number(rawAmount.replace(",", ".")) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("O valor precisa ser maior que zero.");
  const expenseTimestamp = Date.parse(expenseAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expenseAt)
    || !Number.isFinite(expenseTimestamp) || new Date(expenseTimestamp).toISOString() !== expenseAt
    || expenseTimestamp > Date.now()) {
    throw new Error("Informe a data e hora reais do gasto.");
  }
  if (authorizationProtocol && !/^[-A-Za-z0-9_]{8,120}$/.test(authorizationProtocol)) {
    throw new Error("Protocolo de autorização inválido.");
  }

  return { name, email, pixKey, pixHolderName, justification, amount, expenseAt, authorizationProtocol };
}

export function receiptContentType(buffer: Buffer) {
  if (buffer.subarray(0, 5).toString() === "%PDF-") return { type: "application/pdf", extension: "pdf" };
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { type: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { type: "image/jpeg", extension: "jpg" };
  }
  throw new Error("Envie um comprovante PDF, PNG ou JPG.");
}
