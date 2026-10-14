"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Allocation = { transactionId: string; grossReceiptCents?: number; feesCents?: number; reversalsCents?: number; netReceiptCents: number; reserveCents: number; operatingCents: number; bankReference: string; at: number; by: string };
type Release = { requestId: string; transactionId: string; amountCents: number; bankReference: string; at: number; by: string };
type ReserveAccount = { reserveBalanceCents: number; allocations?: Record<string, Allocation>; releases?: Record<string, Release> };

export default function ReservaPage() {
  const { user, role } = useAuth();
  const [account, setAccount] = useState<ReserveAccount>({ reserveBalanceCents: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<"allocate" | "release">("allocate");
  const [transactionId, setTransactionId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [feesAmount, setFeesAmount] = useState("0");
  const [reversalsAmount, setReversalsAmount] = useState("0");
  const [bankReference, setBankReference] = useState("");
  const [reconciled, setReconciled] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch("/api/reserva", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível consultar a reserva.");
    setAccount(result.account);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void Promise.resolve().then(refresh).catch((error) => setMessage(error instanceof Error ? error.message : "Falha na consulta.")).finally(() => setLoading(false));
  }, [refresh, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setMessage("");
    try {
      let feesCents: number | undefined;
      let reversalsCents: number | undefined;
      if (action === "allocate") {
        if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(feesAmount) || !/^\d{1,9}(?:[.,]\d{1,2})?$/.test(reversalsAmount)) throw new Error("Informe taxas e estornos em reais.");
        feesCents = Math.round(Number(feesAmount.replace(",", ".")) * 100);
        reversalsCents = Math.round(Number(reversalsAmount.replace(",", ".")) * 100);
      }
      const token = await user.getIdToken();
      const response = await fetch("/api/reserva", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, transactionId, requestId, feesCents, reversalsCents, bankReference, reconciled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a operação.");
      setMessage(action === "allocate" ? "Entrada alocada à reserva. Nenhuma transferência bancária foi feita." : "Uso da reserva vinculado à despesa aprovada.");
      setTransactionId("");
      setRequestId("");
      setFeesAmount("0");
      setReversalsAmount("0");
      setBankReference("");
      setReconciled(false);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no registro.");
    } finally {
      setBusy(false);
    }
  }

  const currency = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const allocations = Object.values(account.allocations || {}).sort((a, b) => b.at - a.at);
  const releases = Object.values(account.releases || {}).sort((a, b) => b.at - a.at);
  const totalAllocated = allocations.reduce((sum, item) => sum + item.reserveCents, 0);
  const inputClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white";

  return (
    <div className="space-y-6 pb-12">
      <header><h1 className="text-2xl font-semibold">Fundo de Reserva</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Alocação contábil de 20% de cada entrada líquida confirmada pela Tesouraria.</p></header>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Este saldo é um controle interno, não uma conta bancária separada. Confira o extrato antes de registrar. O APP não executa split payment nem transfere dinheiro automaticamente.</p>
      {message && <p role="status" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">{message}</p>}
      {loading ? <p role="status">Carregando reserva...</p> : <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-[#1e2023]"><p className="text-sm text-gray-600 dark:text-gray-300">Reserva acumulada das entradas registradas</p><p className="mt-2 text-2xl font-semibold tabular-nums">{currency(totalAllocated)}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-[#1e2023]"><p className="text-sm text-gray-600 dark:text-gray-300">Saldo interno ainda reservado</p><p className="mt-2 text-2xl font-semibold tabular-nums">{currency(account.reserveBalanceCents || 0)}</p></div>
      </div>}

      {role === "tesoureiro" && <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-[#1e2023]">
        <h2 className="text-lg font-semibold">Registrar conciliação</h2>
        <label className="block text-sm font-medium">Operação<select value={action} onChange={(event) => setAction(event.target.value as "allocate" | "release")} className={inputClass}><option value="allocate">Alocar 20% de entrada líquida</option><option value="release">Vincular uso aprovado da reserva</option></select></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">ID do lançamento no Caixa<input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} required className={inputClass} /></label>
          {action === "allocate" ? <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm font-medium">Taxas (R$)<input value={feesAmount} onChange={(event) => setFeesAmount(event.target.value)} inputMode="decimal" required className={inputClass} /></label>
            <label className="block text-sm font-medium">Estornos/devoluções (R$)<input value={reversalsAmount} onChange={(event) => setReversalsAmount(event.target.value)} inputMode="decimal" required className={inputClass} /></label>
          </div>
            : <label className="block text-sm font-medium">Protocolo da aprovação dos dois órgãos<input value={requestId} onChange={(event) => setRequestId(event.target.value)} required className={inputClass} /></label>}
        </div>
        <label className="block text-sm font-medium">Referência no extrato bancário<input value={bankReference} onChange={(event) => setBankReference(event.target.value)} minLength={3} maxLength={120} required className={inputClass} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reconciled} onChange={(event) => setReconciled(event.target.checked)} required className="mt-1" /><span>Conferi o lançamento e a referência com o extrato bancário.</span></label>
        <button disabled={busy || !reconciled} className="min-h-11 rounded-lg bg-indigo-700 px-5 text-sm font-medium text-white disabled:opacity-50">{busy ? "Registrando..." : "Registrar no controle da reserva"}</button>
      </form>}

      <section className="space-y-3"><h2 className="text-lg font-semibold">Alocações</h2>{allocations.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-300">Ainda não há entradas conciliadas neste controle.</p> : allocations.map((item) => <article key={item.transactionId} className="rounded-xl border border-gray-200 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-[#1e2023]"><div className="flex flex-wrap justify-between gap-2"><strong className="tabular-nums">{currency(item.reserveCents)} para reserva</strong><span>{new Date(item.at).toLocaleString("pt-BR")}</span></div><p className="mt-1 break-all">Caixa: {item.transactionId} · Entrada bruta: {currency(item.grossReceiptCents ?? item.netReceiptCents)} · Taxas: {currency(item.feesCents ?? 0)} · Estornos: {currency(item.reversalsCents ?? 0)} · Líquida: {currency(item.netReceiptCents)}</p><p className="mt-1 break-all text-gray-600 dark:text-gray-300">Extrato: {item.bankReference}</p></article>)}</section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Usos aprovados</h2>{releases.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-300">Nenhum uso registrado.</p> : releases.map((item) => <article key={item.requestId} className="rounded-xl border border-gray-200 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-[#1e2023]"><div className="flex flex-wrap justify-between gap-2"><strong className="tabular-nums">{currency(item.amountCents)} utilizados</strong><span>{new Date(item.at).toLocaleString("pt-BR")}</span></div><p className="mt-1 break-all">Decisão: {item.requestId} · Caixa: {item.transactionId}</p><p className="mt-1 break-all text-gray-600 dark:text-gray-300">Extrato: {item.bankReference}</p></article>)}</section>
    </div>
  );
}
