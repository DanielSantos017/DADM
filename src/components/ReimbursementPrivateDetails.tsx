"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type PrivateDetails = { email: string; pixKey: string; pixHolderName: string };

export function ReimbursementPrivateDetails({ id }: { id: string }) {
  const { user } = useAuth();
  const [details, setDetails] = useState<PrivateDetails | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function authHeader() {
    if (!user) throw new Error("Faça login novamente.");
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }

  async function showDetails() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/reembolsos/${encodeURIComponent(id)}/privado`, { headers: await authHeader(), cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível consultar os dados de pagamento.");
      setDetails(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao consultar os dados.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadReceipt() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/reembolsos/${encodeURIComponent(id)}/comprovante`, { headers: await authHeader(), cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível baixar o comprovante.");
      const blob = await response.blob();
      const extension = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `comprovante-${id}.${extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao baixar o comprovante.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={showDetails} className="text-indigo-600 hover:underline disabled:opacity-50">Ver dados Pix</button>
        <button type="button" disabled={busy} onClick={downloadReceipt} className="text-blue-600 hover:underline disabled:opacity-50">Baixar comprovante</button>
      </div>
      {details && (
        <div className="space-y-1 rounded-md bg-gray-100 p-2 text-gray-800 dark:bg-zinc-800 dark:text-gray-100">
          <p>Contato: {details.email}</p>
          <p>Titular: {details.pixHolderName}</p>
          <p className="break-all">Pix: {details.pixKey}</p>
        </div>
      )}
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </div>
  );
}
