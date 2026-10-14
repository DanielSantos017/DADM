export type ProjectProjectionInput = {
  status: "Aberto" | "Pendente_Aprovacao" | "Processado";
  entries?: Record<string, { type: "income" | "expense"; amount: number }>;
  projectionBaselineCents?: number;
};

export function projectTotalsCents(project: ProjectProjectionInput) {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const entry of Object.values(project.entries || {})) {
    const cents = Math.round(Number(entry.amount) * 100);
    if (!Number.isSafeInteger(cents) || cents < 0) continue;
    if (entry.type === "income") incomeCents += cents;
    if (entry.type === "expense") expenseCents += cents;
  }
  const netCents = incomeCents - expenseCents;
  const active = project.status !== "Processado";
  const baselineCents = Number.isSafeInteger(project.projectionBaselineCents) ? project.projectionBaselineCents! : 0;
  return { incomeCents, expenseCents, netCents, contributionCents: active ? netCents - baselineCents : 0 };
}

export function cashBalanceCents(transactions: readonly { type: "income" | "expense"; amount: number }[]) {
  return transactions.reduce((sum, item) => {
    const cents = Math.round(Number(item.amount) * 100);
    if (!Number.isSafeInteger(cents) || cents < 0) return sum;
    return sum + (item.type === "income" ? cents : -cents);
  }, 0);
}
