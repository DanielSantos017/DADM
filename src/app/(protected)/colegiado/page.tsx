"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type User = { uid: string; email: string; role: string };
type Roster = { users: User[]; memberUids: string[]; quorum: number; councilConfigured: boolean; configured: boolean };

export default function ColegiadoPage() {
  const { user, role } = useAuth();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!user || role !== "tesoureiro") return;
    const response = await fetch("/api/colegiado", { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar o colegiado.");
    setRoster(data);
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== "tesoureiro") return;
    void Promise.resolve().then(refresh).catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar.")).finally(() => setLoading(false));
  }, [refresh, user, role]);

  async function change(uid: string, action: "add" | "remove") {
    if (!user || busyUid) return;
    if (!confirm(action === "add" ? "Nomear este usuário para o Colegiado da Tesouraria?" : "Remover este usuário do Colegiado da Tesouraria?")) return;
    setBusyUid(uid);
    setMessage("");
    try {
      const response = await fetch("/api/colegiado", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ uid, action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o cargo.");
      await refresh();
      setMessage(action === "add" ? "Membro nomeado. Verifique quórum e política antes de votar." : "Membro removido. Verifique se a política ainda tem quórum válido.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar cargo.");
    } finally {
      setBusyUid("");
    }
  }

  if (role !== "tesoureiro") return <p className="p-6">Acesso exclusivo do tesoureiro.</p>;
  const members = new Set(roster?.memberUids || []);
  const active = (value: string) => ["tesoureiro", "coordenador", "usuario", "usuario_area", "adm_area"].includes(value);
  return <div className="space-y-5 pb-12">
    <div><h1 className="text-2xl font-semibold">Colegiado da Tesouraria</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Nomeie ou remova membros entre os usuários já cadastrados. Este cargo é adicional ao perfil normal do usuário.</p></div>
    <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{roster?.configured
      ? `Política de votação configurada. Quórum da Tesouraria: ${roster.quorum}. Alterar membros invalida votos pendentes da versão anterior.`
      : "A composição pode ser preparada aqui, mas a votação colegiada continua bloqueada até configurar quóruns e Conselho Administrativo. Nenhum quórum é presumido."}</p>
    {message && <p role="status" className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">{message}</p>}
    {loading ? <p>Carregando usuários...</p> : !roster ? <p>Não foi possível carregar a lista.</p> : <div className="space-y-3">
      <p className="text-sm font-medium">{members.size} membro(s) nomeado(s)</p>
      {roster.users.map((candidate) => <article key={candidate.uid} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-[#1e2023]">
        <div className="min-w-0"><p className="break-all font-medium">{candidate.email || candidate.uid}</p><p className="text-xs text-gray-600 dark:text-gray-300">Perfil: {candidate.role} · {members.has(candidate.uid) ? "Membro do colegiado" : "Sem cargo no colegiado"}</p></div>
        {active(candidate.role) ? <button type="button" disabled={!!busyUid} onClick={() => void change(candidate.uid, members.has(candidate.uid) ? "remove" : "add")}
          className={`min-h-11 rounded-lg px-4 text-sm font-medium disabled:opacity-50 ${members.has(candidate.uid) ? "border border-red-300 text-red-700 dark:text-red-300" : "bg-indigo-700 text-white"}`}>{busyUid === candidate.uid ? "Salvando..." : members.has(candidate.uid) ? "Remover cargo" : "Nomear membro"}</button>
          : <span className="text-xs text-gray-500">Ative o acesso do usuário antes de nomear</span>}
      </article>)}
    </div>}
  </div>;
}
