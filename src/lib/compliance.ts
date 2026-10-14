export type ReserveAllocation = {
  netReceiptCents: number;
  reserveCents: number;
  operatingCents: number;
};

/** Receita líquida = recebido bruto − taxas do recebimento − estornos/devoluções. */
export function calculateNetReceipt(grossCents: number, feesCents: number, reversalsCents: number): number {
  if (![grossCents, feesCents, reversalsCents].every(Number.isSafeInteger)
    || grossCents <= 0 || feesCents < 0 || reversalsCents < 0
    || feesCents + reversalsCents >= grossCents) {
    throw new Error("Receita bruta, taxas ou estornos inválidos.");
  }
  return grossCents - feesCents - reversalsCents;
}

/** Divide uma entrada líquida já apurada; não cria nova receita nem movimenta o banco. */
export function allocateNetReceipt(netReceiptCents: number): ReserveAllocation {
  if (!Number.isSafeInteger(netReceiptCents) || netReceiptCents <= 0) {
    throw new Error("A entrada líquida deve ser um valor positivo em centavos.");
  }
  const reserveCents = Math.round(netReceiptCents * 0.2);
  return {
    netReceiptCents,
    reserveCents,
    operatingCents: netReceiptCents - reserveCents,
  };
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use data no formato AAAA-MM-DD.");
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Data inválida.");
  }
  return date;
}

/** Conta a partir do dia útil seguinte ao gasto; feriados devem ser fornecidos pela organização. */
export function fiscalReceiptDeadline(spendingDate: string, holidays: readonly string[] = []): string {
  const date = parseDateOnly(spendingDate);
  const holidaySet = new Set(holidays.map((holiday) => parseDateOnly(holiday).toISOString().slice(0, 10)));
  let remaining = 5;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    const dateOnly = date.toISOString().slice(0, 10);
    if (weekday !== 0 && weekday !== 6 && !holidaySet.has(dateOnly)) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}
