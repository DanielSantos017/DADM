import { NextResponse } from "next/server";
import { adminDatabase, requireBoard } from "@/lib/firebase-admin";
import { allocateNetReceipt, calculateNetReceipt } from "@/lib/compliance";
import type { GovernanceRequest } from "@/lib/governance";

export const runtime = "nodejs";

type ReserveAccount = {
  reserveBalanceCents: number;
  allocations?: Record<string, { transactionId: string; grossReceiptCents: number; feesCents: number; reversalsCents: number; netReceiptCents: number; reserveCents: number; operatingCents: number; bankReference: string; at: number; by: string }>;
  releases?: Record<string, { requestId: string; transactionId: string; amountCents: number; bankReference: string; at: number; by: string }>;
};

function validId(value: unknown) {
  return typeof value === "string" && /^[-A-Za-z0-9_]{8,120}$/.test(value);
}

export async function GET(request: Request) {
  try {
    const actor = await requireBoard(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    const account = ((await adminDatabase().ref("reserve_account").get()).val() || { reserveBalanceCents: 0 }) as ReserveAccount;
    return NextResponse.json({ account }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao consultar a reserva:", error);
    return NextResponse.json({ error: "Não foi possível consultar a reserva." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireBoard(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    if (actor.role !== "tesoureiro") return NextResponse.json({ error: "Operação exclusiva do tesoureiro." }, { status: 403 });
    const input = await request.json();
    const action = input?.action;
    const transactionId = input?.transactionId;
    const bankReference = typeof input?.bankReference === "string" ? input.bankReference.trim() : "";
    if (!validId(transactionId) || bankReference.length < 3 || bankReference.length > 120 || input?.reconciled !== true) {
      return NextResponse.json({ error: "Informe lançamento e referência bancária válidos." }, { status: 400 });
    }
    const database = adminDatabase();
    const transaction = (await database.ref(`transactions/${transactionId}`).get()).val();
    if (!transaction) return NextResponse.json({ error: "Lançamento do Caixa não encontrado." }, { status: 400 });
    const transactionCents = Math.round(Number(transaction.amount) * 100);
    if (!Number.isSafeInteger(transactionCents) || transactionCents <= 0) {
      return NextResponse.json({ error: "Valor do lançamento inválido." }, { status: 400 });
    }
    const accountRef = database.ref("reserve_account");
    const now = Date.now();

    if (action === "allocate") {
      if (transaction.type !== "income" || transaction.isProject || transaction.reversesTransactionId) {
        return NextResponse.json({ error: "Use uma entrada bruta individual do Caixa." }, { status: 400 });
      }
      const feesCents = Number(input?.feesCents);
      const reversalsCents = Number(input?.reversalsCents);
      const netReceiptCents = calculateNetReceipt(transactionCents, feesCents, reversalsCents);
      const allocation = allocateNetReceipt(netReceiptCents);
      const result = await accountRef.transaction((current: ReserveAccount | null) => {
        const account = current || { reserveBalanceCents: 0 };
        if (account.allocations?.[transactionId]) return;
        return {
          ...account,
          reserveBalanceCents: account.reserveBalanceCents + allocation.reserveCents,
          allocations: {
            ...account.allocations,
            [transactionId]: { transactionId, grossReceiptCents: transactionCents, feesCents, reversalsCents, ...allocation, bankReference, at: now, by: actor.email },
          },
        };
      }, undefined, false);
      if (!result.committed) return NextResponse.json({ error: "Esta entrada já foi alocada à reserva." }, { status: 409 });
      return NextResponse.json({ reserveBalanceCents: result.snapshot.val()?.reserveBalanceCents }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "release") {
      const requestId = input?.requestId;
      if (!validId(requestId) || transaction.type !== "expense") {
        return NextResponse.json({ error: "Informe decisão aprovada e despesa do Caixa." }, { status: 400 });
      }
      const approval = (await database.ref(`governance_requests/${requestId}`).get()).val() as GovernanceRequest | null;
      if (!approval || approval.kind !== "reserve_release" || approval.status !== "approved"
        || !Number.isSafeInteger(approval.amountCents) || approval.amountCents !== transactionCents) {
        return NextResponse.json({ error: "A decisão dos dois órgãos não cobre essa despesa." }, { status: 409 });
      }
      const result = await accountRef.transaction((current: ReserveAccount | null) => {
        if (!current || current.releases?.[requestId] || current.reserveBalanceCents < approval.amountCents) return;
        if (Object.values(current.releases || {}).some((release) => release.transactionId === transactionId)) return;
        return {
          ...current,
          reserveBalanceCents: current.reserveBalanceCents - approval.amountCents,
          releases: {
            ...current.releases,
            [requestId]: { requestId, transactionId, amountCents: approval.amountCents, bankReference, at: now, by: actor.email },
          },
        };
      }, undefined, false);
      if (!result.committed) return NextResponse.json({ error: "Reserva insuficiente ou liberação já registrada." }, { status: 409 });
      return NextResponse.json({ reserveBalanceCents: result.snapshot.val()?.reserveBalanceCents }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && /entrada líquida|Receita bruta/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Erro ao movimentar a reserva:", error);
    return NextResponse.json({ error: "Não foi possível registrar a reserva." }, { status: 503 });
  }
}
