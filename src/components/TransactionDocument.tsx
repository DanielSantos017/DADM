"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Transaction } from "@/types";

export function TransactionDocument({ transaction }: { transaction: Transaction }) {
  const { user } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("document", file);
      const token = await user.getIdToken();
      const response = await fetch(`/api/caixa/${encodeURIComponent(transaction.id)}/documento`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha no envio.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no envio.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function open() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/caixa/${encodeURIComponent(transaction.id)}/documento`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (!response.ok) throw new Error("Não foi possível abrir o documento.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = transaction.document?.name || `documento-${transaction.id}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao abrir documento.");
    } finally {
      setBusy(false);
    }
  }

  return <span className="inline-flex flex-col items-start gap-1" onClick={(event) => event.stopPropagation()}>
    {transaction.document
      ? <button type="button" disabled={busy} onClick={() => void open()} className="min-h-10 text-xs font-medium text-indigo-700 underline disabled:opacity-50 dark:text-indigo-300">Ver documento</button>
      : <>
        <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="sr-only" aria-label={`Anexar documento ao lançamento ${transaction.description}`} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="min-h-10 text-xs font-medium text-indigo-700 underline disabled:opacity-50 dark:text-indigo-300">{busy ? "Enviando..." : "Anexar documento (opcional)"}</button>
      </>}
    {error && <span role="alert" className="max-w-48 text-xs text-red-700">{error}</span>}
  </span>;
}
