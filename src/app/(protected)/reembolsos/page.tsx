"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useReimbursements, type ReimbursementRequest } from "@/hooks/useReimbursements";
import { ReimbursementPrivateDetails } from "@/components/ReimbursementPrivateDetails";

type Action = "approve" | "reject" | "cancel" | "paid";

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  pago: "Pago",
  recusado: "Recusado",
  cancelado: "Cancelado",
  registrando_pagamento: "Registrando pagamento",
};

export default function ReembolsosPage() {
  const { user, role } = useAuth();
  const { reimbursements, loading } = useReimbursements();
  const [filter, setFilter] = useState<"ativos" | "todos">("ativos");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState("");

  const visible = reimbursements.filter((item) => {
    if (filter === "ativos" && !["pendente", "em_analise", "aprovado", "registrando_pagamento"].includes(item.status)) return false;
    const query = search.toLocaleLowerCase("pt-BR");
    return !query || [item.id, item.requestedByName, item.requestedByEmail, item.description]
      .some((value) => value?.toLocaleLowerCase("pt-BR").includes(query));
  });

  async function publicAction(item: ReimbursementRequest, action: Action, reference?: string) {
    if (!user) return;
    setBusyId(item.id);
    setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/reembolsos/${encodeURIComponent(item.id)}/acao`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, paymentReference: reference }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o pedido.");
      setMessage(action === "paid" ? "Pagamento registrado no caixa." : "Pedido atualizado.");
      setPaymentId(null);
      setPaymentReference("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o pedido.");
    } finally {
      setBusyId(null);
    }
  }

  const currency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Reembolsos</h1>
          <p className="mt-1 text-sm text-gray-500">Analise os pedidos e registre o pagamento somente depois de fazer o Pix.</p>
        </div>
        <Link href="/reembolso" className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800">Abrir formulário público</Link>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-[#1e2023]">
        <input aria-label="Buscar reembolso" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, protocolo ou descrição" className="min-w-[240px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-zinc-600" />
        <select aria-label="Filtrar reembolsos" value={filter} onChange={(event) => setFilter(event.target.value as "ativos" | "todos")} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-zinc-600">
          <option value="ativos">Aguardando ação</option>
          <option value="todos">Todos os pedidos</option>
        </select>
      </div>

      {message && <p role="status" className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">{message}</p>}
      {loading ? <p className="text-sm text-gray-500">Carregando pedidos...</p> : visible.length === 0 ? <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-zinc-700 dark:bg-[#1e2023]">Nenhum pedido encontrado.</p> : (
        <div className="space-y-4">
          {visible.map((item) => (
            <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-[#1e2023]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.requestedByName || item.requestedByEmail || "Solicitante"}</p>
                  <p className="mt-1 text-xs text-gray-500">Protocolo: {item.id} · {new Date(item.timestamp).toLocaleString("pt-BR")}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{currency(item.amount)}</p>
                  <p className="text-xs text-gray-500">{statusLabels[item.status] || item.status}</p>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{item.description}</p>
              {item.source === "public" && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-gray-700 dark:bg-zinc-800 dark:text-gray-200">
                <p>Gasto declarado: {item.expenseAt ? new Date(item.expenseAt).toLocaleString("pt-BR") : "data não informada"}</p>
                <p>Autorização prévia: {item.authorizationProtocol || "não informada; exige exceção aprovada"}</p>
                {item.approvalBasis && <p>Base da aprovação: {item.approvalBasis}</p>}
                {item.status === "pendente" && <Link href="/governanca" className="mt-1 inline-block font-medium text-indigo-700 underline dark:text-indigo-300">Consultar ou solicitar decisão excepcional</Link>}
              </div>}
              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-zinc-700">
                {item.source === "public" ? <ReimbursementPrivateDetails id={item.id} /> : item.receiptLink ? <a href={item.receiptLink} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Abrir comprovante antigo</a> : null}
              </div>

              {item.source !== "public" && item.status === "pendente" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Pedido legado preservado para auditoria. O fluxo antigo de aprovação foi bloqueado porque não comprova autorização prévia. Oriente o solicitante a abrir um novo pedido pelo formulário público, informando este protocolo na justificativa.</p>}

              {item.source === "public" && item.status === "pendente" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button disabled={busyId === item.id} onClick={() => publicAction(item, "approve")} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Aprovar</button>
                  <button disabled={busyId === item.id} onClick={() => publicAction(item, "reject")} className="rounded-md bg-red-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Recusar</button>
                  <button disabled={busyId === item.id} onClick={() => publicAction(item, "cancel")} className="rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 disabled:opacity-50">Cancelar pedido</button>
                </div>
              )}

              {item.source === "public" && item.status === "aprovado" && role === "tesoureiro" && (
                <div className="mt-4 space-y-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/20">
                  {paymentId === item.id ? (
                    <>
                      <label className="block text-xs font-medium text-gray-800 dark:text-gray-200">Referência do Pix realizado
                        <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} maxLength={120} placeholder="ID, data ou referência no extrato" className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
                      </label>
                      <div className="flex gap-2">
                        <button disabled={busyId === item.id || paymentReference.trim().length < 3} onClick={() => publicAction(item, "paid", paymentReference)} className="rounded-md bg-indigo-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Confirmar pagamento e lançar no caixa</button>
                        <button onClick={() => setPaymentId(null)} className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">Voltar</button>
                      </div>
                    </>
                  ) : <button onClick={() => setPaymentId(item.id)} className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Registrar Pix já realizado</button>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
