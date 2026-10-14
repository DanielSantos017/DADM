"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { evaluateQuoteEvidence, type Body, type GovernanceRequest, type RequestKind } from "@/lib/governance";

const kindLabels: Record<RequestKind, string> = {
  project_budget: "Plano orçamentário do projeto",
  spending_authorization: "Autorização prévia de gasto",
  unplanned_expense: "Gasto não previsto no orçamento",
  reimbursement_exception: "Exceção para reembolso sem autorização prévia",
  reserve_release: "Uso do Fundo de Reserva",
};
const statusLabels = { pending: "Aguardando decisão", approved: "Aprovado", rejected: "Recusado" };
type ProjectOption = { id: string; name: string };

export default function GovernancaPage() {
  const { user, role } = useAuth();
  const [requests, setRequests] = useState<GovernanceRequest[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [myBodies, setMyBodies] = useState<Body[]>([]);
  const [exceptionBodies, setExceptionBodies] = useState<Body[]>([]);
  const [policyConfigured, setPolicyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<RequestKind>("project_budget");
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reimbursementId, setReimbursementId] = useState("");
  const [quoteRequestId, setQuoteRequestId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch("/api/governanca", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar solicitações.");
    setRequests(result.requests || []);
    setProjects(result.projects || []);
    setMyBodies(result.myBodies || []);
    setExceptionBodies(result.exceptionBodies || []);
    setPolicyConfigured(result.policyConfigured === true);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void Promise.resolve().then(refresh).catch((error) => setMessage(error instanceof Error ? error.message : "Falha na consulta.")).finally(() => setLoading(false));
  }, [refresh, user]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(amount)) throw new Error("Informe um valor em reais válido.");
      const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
      const token = await user.getIdToken();
      const response = await fetch("/api/governanca", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind, purpose, amountCents, projectId, reimbursementId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a solicitação.");
      setMessage(`Solicitação registrada. Protocolo: ${result.protocol}. Isso ainda não autoriza gasto ou pagamento.`);
      setPurpose("");
      setAmount("");
      setProjectId("");
      setReimbursementId("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no envio.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(record: GovernanceRequest, decision: "approve" | "reject" | "veto", body?: Body) {
    if (!user || !record.id || busy) return;
    const reason = decision === "approve" ? "" : prompt("Justifique a decisão (mínimo de 10 caracteres):")?.trim() || "";
    if (decision !== "approve" && reason.length < 10) return;
    setBusy(true);
    setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/governanca/${encodeURIComponent(record.id)}/voto`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, body, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a decisão.");
      setMessage("Decisão registrada. Nenhum pagamento foi realizado.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao registrar decisão.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadQuote(event: FormEvent<HTMLFormElement>, recordId: string) {
    event.preventDefault();
    if (!user || !quoteFile || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(quoteAmount)) throw new Error("Informe o custo total da cotação.");
      const form = new FormData();
      form.set("supplierName", supplierName);
      form.set("totalCents", String(Math.round(Number(quoteAmount.replace(",", ".")) * 100)));
      form.set("file", quoteFile);
      const token = await user.getIdToken();
      const response = await fetch(`/api/governanca/${encodeURIComponent(recordId)}/cotacoes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao anexar cotação.");
      setQuoteRequestId(null);
      setSupplierName("");
      setQuoteAmount("");
      setQuoteFile(null);
      setMessage("Cotação documentada registrada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao anexar cotação.");
    } finally { setBusy(false); }
  }

  async function downloadQuote(recordId: string, quoteId: string) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/governanca/${encodeURIComponent(recordId)}/cotacoes/${encodeURIComponent(quoteId)}/arquivo`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (!response.ok) throw new Error("Não foi possível baixar a cotação.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `cotacao-${quoteId}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no download.");
    }
  }

  const canCreate = role !== "usuario";
  const currency = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const quotesReady = (record: GovernanceRequest) => {
    if (record.kind !== "spending_authorization" && record.kind !== "unplanned_expense") return true;
    try { return evaluateQuoteEvidence(record.quotes).winner.totalCents <= record.amountCents; } catch { return false; }
  };
  const inputClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white";

  return (
    <div className="space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Solicitações e decisões</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Registre planos e autorizações antes do gasto. Aprovação aqui não executa transferência, Pix ou lançamento no caixa.</p>
      </header>
      {!policyConfigured && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">A composição e o quórum dos órgãos ainda não foram configurados. Votos colegiados não podem concluir aprovações.</p>}
      {message && <p role="status" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">{message}</p>}

      {canCreate && <form onSubmit={createRequest} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-[#1e2023]">
        <h2 className="text-lg font-semibold">Nova solicitação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Tipo
            <select value={kind} onChange={(event) => setKind(event.target.value as RequestKind)} className={inputClass}>
              {Object.entries(kindLabels).filter(([value]) => (value !== "reserve_release" || role === "tesoureiro") && (value !== "reimbursement_exception" || role === "tesoureiro" || role === "coordenador")).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Valor previsto (R$)
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required className={inputClass} />
          </label>
        </div>
        {(kind === "project_budget" || kind === "spending_authorization" || kind === "unplanned_expense") && <label className="block text-sm font-medium">Projeto {kind === "project_budget" ? "(obrigatório)" : "(se aplicável)"}
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required={kind === "project_budget"} className={inputClass}>
            <option value="">{kind === "project_budget" ? "Selecione um projeto" : "Sem projeto específico"}</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>}
        {kind === "reimbursement_exception" && <label className="block text-sm font-medium">Protocolo do reembolso público
          <input value={reimbursementId} onChange={(event) => setReimbursementId(event.target.value)} required className={inputClass} />
        </label>}
        <label className="block text-sm font-medium">Necessidade e justificativa
          <textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} minLength={10} maxLength={2000} rows={3} required className={inputClass} />
        </label>
        <button disabled={busy} className="min-h-11 rounded-lg bg-indigo-700 px-5 text-sm font-medium text-white disabled:opacity-50">{busy ? "Registrando..." : "Registrar solicitação"}</button>
      </form>}

      <section aria-labelledby="requests-heading" className="space-y-3">
        <h2 id="requests-heading" className="text-lg font-semibold">Pedidos registrados</h2>
        {loading ? <p role="status">Carregando...</p> : requests.length === 0 ? <p className="rounded-xl border border-gray-200 p-5 text-sm dark:border-zinc-700">Nenhuma solicitação encontrada.</p> : requests.map((record) => (
          <article key={record.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-[#1e2023]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold">{kindLabels[record.kind]}</h3><p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{record.id} · {new Date(record.createdAt).toLocaleString("pt-BR")}</p></div>
              <div className="text-right"><p className="font-semibold tabular-nums">{currency(record.amountCents)}</p><p className="text-sm">{statusLabels[record.status]}</p></div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{record.purpose}</p>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">Solicitado por {record.createdByEmail}</p>
            {(record.kind === "spending_authorization" || record.kind === "unplanned_expense") && <div className="mt-4 rounded-lg border border-gray-200 p-3 text-sm dark:border-zinc-700">
              <h4 className="font-medium">Cotações documentadas ({Object.keys(record.quotes || {}).length}/3 mínimas)</h4>
              {Object.entries(record.quotes || {}).map(([quoteId, quote]) => <div key={quoteId} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-2 dark:border-zinc-700">
                <span>{quote.supplierName} · {currency(quote.totalCents)}</span>
                <button type="button" onClick={() => void downloadQuote(record.id || "", quoteId)} className="min-h-11 text-indigo-700 underline dark:text-indigo-300">Baixar proposta</button>
              </div>)}
              {(() => { try { const { winner } = evaluateQuoteEvidence(record.quotes); return <p className="mt-2 text-emerald-700 dark:text-emerald-300">Menor custo total: {winner.supplierName} · {currency(winner.totalCents)}</p>; } catch { return <p className="mt-2 text-amber-800 dark:text-amber-300">A aprovação do gasto exige três fornecedores distintos com propostas anexadas.</p>; } })()}
              {record.status === "pending" && (record.createdByUid === user?.uid || role === "tesoureiro" || role === "coordenador") && <>
                <button type="button" onClick={() => setQuoteRequestId(quoteRequestId === record.id ? null : record.id || null)} className="mt-3 min-h-11 rounded-lg border border-indigo-400 px-3 text-sm font-medium text-indigo-700 dark:text-indigo-300">Anexar cotação</button>
                {quoteRequestId === record.id && <form onSubmit={(event) => void uploadQuote(event, record.id || "")} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">Fornecedor<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} minLength={3} maxLength={120} required className={inputClass} /></label>
                  <label className="text-sm">Custo total, com taxas e frete (R$)<input value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} inputMode="decimal" required className={inputClass} /></label>
                  <label className="text-sm sm:col-span-2">Proposta PDF, PNG ou JPG (até 5 MB)<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setQuoteFile(event.target.files?.[0] || null)} required className={inputClass} /></label>
                  <button disabled={busy} className="min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-medium text-white disabled:opacity-50">Enviar proposta</button>
                </form>}
              </>}
            </div>}
            {record.status === "pending" && <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-zinc-700">
              {record.kind === "unplanned_expense" && role === "tesoureiro" && <>
                <button disabled={busy || !quotesReady(record)} onClick={() => void decide(record, "approve")} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm text-white disabled:opacity-50">Autorizar expressamente</button>
                <button disabled={busy} onClick={() => void decide(record, "reject")} className="min-h-11 rounded-lg border border-red-400 px-3 text-sm text-red-700 disabled:opacity-50 dark:text-red-300">Recusar</button>
              </>}
              {record.kind !== "unplanned_expense" && myBodies.filter((body) => record.kind === "reserve_release" || (record.kind === "reimbursement_exception" ? exceptionBodies.includes(body) : body === "treasury")).map((body) => <div key={body} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300">{body === "treasury" ? "Tesouraria" : "Conselho"}</span>
                <button disabled={busy || !quotesReady(record) || !!record.votes?.[body]?.[user?.uid || ""]} onClick={() => void decide(record, "approve", body)} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm text-white disabled:opacity-50">Aprovar</button>
                <button disabled={busy || !!record.votes?.[body]?.[user?.uid || ""]} onClick={() => void decide(record, "reject", body)} className="min-h-11 rounded-lg border border-red-400 px-3 text-sm text-red-700 disabled:opacity-50 dark:text-red-300">Recusar</button>
              </div>)}
              {role === "tesoureiro" && record.kind !== "unplanned_expense" && <button disabled={busy} onClick={() => void decide(record, "veto")} className="min-h-11 rounded-lg border border-red-400 px-3 text-sm text-red-700 disabled:opacity-50 dark:text-red-300">Vetar com justificativa</button>}
            </div>}
          </article>
        ))}
      </section>
    </div>
  );
}
