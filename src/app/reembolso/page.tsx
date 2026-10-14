"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import Script from "next/script";
import { CheckCircle2, FileUp, ShieldCheck } from "lucide-react";

export default function ReembolsoPublicoPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const turnstile = useRef<{
    render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void }) => string;
    reset: (id: string) => void;
  } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [protocol, setProtocol] = useState("");

  const renderTurnstile = useCallback(() => {
    const api = (window as typeof window & { turnstile?: typeof turnstile.current }).turnstile;
    if (!siteKey || !widgetRef.current || !api || widgetId.current) return;
    turnstile.current = api;
    widgetId.current = api.render(widgetRef.current, {
      sitekey: siteKey,
      callback: setTurnstileToken,
      "expired-callback": () => setTurnstileToken(""),
    });
  }, [siteKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      if (!turnstileToken) throw new Error("Conclua a verificação de segurança.");
      const form = new FormData(event.currentTarget);
      const localExpenseAt = String(form.get("expenseAt") || "");
      const parsedExpenseAt = new Date(localExpenseAt);
      if (!localExpenseAt || Number.isNaN(parsedExpenseAt.getTime())) throw new Error("Informe a data e hora do gasto.");
      form.set("expenseAt", parsedExpenseAt.toISOString());
      form.set("turnstileToken", turnstileToken);
      const response = await fetch("/api/reembolsos/publico", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar a solicitação.");
      setProtocol(result.protocol);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a solicitação.");
      if (widgetId.current) turnstile.current?.reset(widgetId.current);
      setTurnstileToken("");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15";
  const labelClass = "block text-sm font-medium text-gray-800";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-gray-900 dark:bg-[#121315] dark:text-white">
      {siteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={renderTurnstile} />}
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700"><ShieldCheck /></div>
          <h1 className="text-3xl font-semibold">Solicitar reembolso</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Envie os dados e o comprovante. A tesouraria vai analisar a solicitação.</p>
        </div>

        {protocol ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-900 dark:bg-[#1e2023]">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
            <h2 className="text-xl font-semibold">Solicitação recebida</h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Guarde o protocolo abaixo. O envio não significa aprovação nem pagamento.</p>
            <p className="mt-5 break-all rounded-lg bg-slate-100 p-3 font-mono text-sm text-gray-900 dark:bg-zinc-800 dark:text-white">{protocol}</p>
            <button className="mt-6 text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300" onClick={() => window.location.reload()}>Enviar outra solicitação</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-[#1e2023] md:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>Nome completo<input className={inputClass} name="name" autoComplete="name" required minLength={3} maxLength={120} /></label>
              <label className={labelClass}>E-mail para contato<input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
              <label className={labelClass}>Valor do reembolso (R$)<input className={inputClass} name="amount" type="number" inputMode="decimal" min="0.01" max="9999999.99" step="0.01" required /></label>
              <label className={labelClass}>Chave Pix<input className={inputClass} name="pixKey" required maxLength={120} autoComplete="off" /></label>
            </div>
            <label className={labelClass}>Nome do titular da chave Pix<input className={inputClass} name="pixHolderName" required minLength={3} maxLength={120} /></label>
            <label className={labelClass}>Justificativa do gasto<textarea className={inputClass} name="justification" rows={4} required minLength={10} maxLength={2000} placeholder="Descreva o que foi comprado e por que o gasto foi necessário." /></label>
            <label className={labelClass}>Data e hora do gasto<input className={inputClass} name="expenseAt" type="datetime-local" required /></label>
            <label className={labelClass}>Protocolo da autorização prévia (se houver)<input className={inputClass} name="authorizationProtocol" maxLength={120} autoComplete="off" /></label>
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Sem autorização prévia válida, o pedido só poderá ser aprovado após decisão excepcional do órgão competente. Enviar comprovante não garante reembolso.</p>
            <label className={labelClass}>
              <span className="flex items-center gap-2"><FileUp className="h-4 w-4" /> Comprovante (PDF, PNG ou JPG; até 5 MB)</span>
              <input className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1 file:text-indigo-700`} name="receipt" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required />
            </label>
            <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            {siteKey ? <div ref={widgetRef} /> : <p role="alert" className="text-sm text-red-700">Formulário temporariamente indisponível.</p>}
            <p className="text-xs text-gray-500 dark:text-gray-300">Nome, contato, chave Pix e comprovante serão usados para analisar e efetuar o reembolso. Confirme os dados antes de enviar.</p>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            <button type="submit" disabled={busy || !siteKey || !turnstileToken} className="w-full rounded-lg bg-indigo-700 px-5 py-3 font-medium text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60">{busy ? "Enviando..." : "Enviar solicitação"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
