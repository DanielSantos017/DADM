"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useProjects";
import { Package2, Plus, ArrowRight, DollarSign, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertCircle, PlayCircle, FolderOpen, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function ProjetosPage() {
  const { role, user } = useAuth();
  const { projects, loading, createProject, deleteProject, updateProjectStatus, addProjectEntry, deleteProjectEntry } = useProjects();
  
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newEntryDesc, setNewEntryDesc] = useState("");
  const [newEntryAmount, setNewEntryAmount] = useState("");
  const [newEntryType, setNewEntryType] = useState<"income" | "expense">("expense");
  const [reopenBusy, setReopenBusy] = useState(false);
  const [reopenMessage, setReopenMessage] = useState("");

  const canCreateAndProcess = role === 'adm_area' || role === 'tesoureiro' || role === 'coordenador';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName || !user?.email) return;
    await createProject(newProjectName, newProjectDesc, user.email);
    setIsNewProjectModalOpen(false);
    setNewProjectName("");
    setNewProjectDesc("");
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newEntryDesc || !newEntryAmount || !user?.email) return;
    
    await addProjectEntry(selectedProjectId, {
      description: newEntryDesc,
      amount: Number(newEntryAmount),
      type: newEntryType,
      createdAt: Date.now(),
      createdByEmail: user.email
    });

    setNewEntryDesc("");
    setNewEntryAmount("");
    setNewEntryType("expense");
  };

  const handleProcessProject = async (projectId: string) => {
    if (!confirm("Enviar este projeto para o Caixa? Ele ficará 'Pendente de Aprovação' e será bloqueado para novos lançamentos.")) return;
    await updateProjectStatus(projectId, "Pendente_Aprovacao");
    setSelectedProjectId(null); // Fecha o modal
  };

  const handleReopenProject = async (projectId: string) => {
    if (role !== "tesoureiro" || !user) return;
    const reason = prompt("Justificativa da reabertura (mínimo 10 caracteres):");
    if (!reason) return;
    setReopenBusy(true);
    setReopenMessage("");
    try {
      const response = await fetch(`/api/projetos/${encodeURIComponent(projectId)}/reabrir`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível reabrir o projeto.");
      setReopenMessage("Projeto reaberto. A projeção do painel descontará valores já registrados no Caixa.");
    } catch (error) {
      setReopenMessage(error instanceof Error ? error.message : "Falha na reabertura.");
    } finally {
      setReopenBusy(false);
    }
  };

  if (loading) return <div className="p-6">Carregando projetos...</div>;

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const calculateTotals = (entries: any) => {
    let income = 0;
    let expense = 0;
    Object.values(entries).forEach((e: any) => {
      if (e.type === 'income') income += e.amount;
      if (e.type === 'expense') expense += e.amount;
    });
    return { income, expense, profit: income - expense };
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6" /> Projetos & Eventos
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">Gerencie receitas e despesas agrupadas por evento/projeto.</p>
        </div>

        {canCreateAndProcess && (
          <button 
            onClick={() => setIsNewProjectModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-lg"
          >
            <Plus className="w-4 h-4" /> Novo Projeto
          </button>
        )}
      </div>
      {reopenMessage && <p role="status" className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">{reopenMessage}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => {
          const { income, expense, profit } = calculateTotals(project.entries);
          const entriesCount = Object.keys(project.entries).length;

          return (
            <div 
              key={project.id} 
              className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col"
              onClick={() => setSelectedProjectId(project.id)}
            >
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-1">{project.name}</h3>
                  {project.status === "Aberto" && <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs px-2 py-1 rounded font-bold uppercase">Aberto</span>}
                  {project.status === "Pendente_Aprovacao" && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs px-2 py-1 rounded font-bold uppercase">Pendente</span>}
                  {project.status === "Processado" && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs px-2 py-1 rounded font-bold uppercase">Fechado</span>}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mb-4">{project.description}</p>
                
                <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 dark:border-[#2a2c30] pt-3 mt-auto">
                  <span className="flex items-center gap-1"><Package2 className="w-3 h-3" /> {entriesCount} lançamentos</span>
                  <span className={`font-bold ${profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrency(profit)}</span>
                </div>
              </div>
            </div>
          );
        })}
        {projects.length === 0 && (
          <div className="col-span-full py-10 text-center text-gray-500 border-2 border-dashed border-gray-300 dark:border-[#2a2c30] rounded-xl">
            Nenhum projeto cadastrado.
          </div>
        )}
      </div>

      {/* MODAL NOVO PROJETO */}
      <Dialog open={isNewProjectModalOpen} onOpenChange={setIsNewProjectModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#1e2023] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>Criar Novo Projeto/Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Nome do Projeto</label>
              <input required value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className="w-full mt-1 p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg" placeholder="Ex: Calourada 2026" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Descrição (Opcional)</label>
              <textarea value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} className="w-full mt-1 p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg" rows={3} placeholder="Detalhes do evento..." />
            </div>
            <DialogFooter>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors">Criar Projeto</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALHES DO PROJETO */}
      <Dialog open={!!selectedProjectId} onOpenChange={(open) => !open && setSelectedProjectId(null)}>
        <DialogContent className="sm:max-w-[650px] bg-white dark:bg-[#1e2023] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white max-h-[90vh] overflow-y-auto">
          {selectedProject && (() => {
            const { income, expense, profit } = calculateTotals(selectedProject.entries);
            const entriesList = Object.entries(selectedProject.entries).map(([id, val]) => ({ ...(val as any), id })).sort((a: any, b: any) => b.createdAt - a.createdAt);

            return (
              <>
                <DialogHeader className="border-b border-gray-200 dark:border-[#2a2c30] pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <DialogTitle className="text-xl">{selectedProject.name}</DialogTitle>
                      <p className="text-sm text-gray-500 mt-1">{selectedProject.description}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      {canCreateAndProcess && selectedProject.status === "Aberto" && (
                        <button 
                          onClick={() => handleProcessProject(selectedProject.id)}
                          className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                          <PlayCircle className="w-4 h-4" /> Processar e Fechar
                        </button>
                      )}
                      {role === "tesoureiro" && selectedProject.status === "Processado" && <button
                        type="button" disabled={reopenBusy} onClick={() => void handleReopenProject(selectedProject.id)}
                        className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-900 disabled:opacity-50 dark:bg-amber-900/30 dark:text-amber-200"
                      >{reopenBusy ? "Reabrindo..." : "Reabrir projeto"}</button>}
                      {(role === 'tesoureiro' || role === 'coordenador') && selectedProject.status !== "Processado" && !selectedProject.lastReopenedAt && (
                        <button 
                          onClick={async () => {
                            if (confirm("Tem certeza que deseja excluir ESTE PROJETO INTEIRO e todos os seus lançamentos? Esta ação não pode ser desfeita.")) {
                              await deleteProject(selectedProject.id);
                              setSelectedProjectId(null);
                            }
                          }}
                          className="bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Excluir
                        </button>
                      )}
                    </div>
                  </div>
                </DialogHeader>
                {selectedProject.lastReopenedAt && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Reaberto por {selectedProject.lastReopenedBy} em {new Date(selectedProject.lastReopenedAt).toLocaleString("pt-BR")}. Motivo: {selectedProject.lastReopenReason}</p>}

                <div className="grid grid-cols-3 gap-4 my-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-500">Ganhos</span>
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(income)}</div>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-900/10 p-3 rounded-lg border border-rose-100 dark:border-rose-900/30 text-center">
                    <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-500">Custos</span>
                    <div className="text-lg font-bold text-rose-700 dark:text-rose-400">{formatCurrency(expense)}</div>
                  </div>
                  <div className={`p-3 rounded-lg border text-center ${profit >= 0 ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'}`}>
                    <span className={`text-[10px] font-bold uppercase ${profit >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>Saldo Líquido</span>
                    <div className={`text-lg font-bold ${profit >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>{formatCurrency(profit)}</div>
                  </div>
                </div>

                {selectedProject.status === "Aberto" && (
                  <form onSubmit={handleAddEntry} className="bg-gray-50 dark:bg-[#151618] border border-gray-200 dark:border-[#2a2c30] p-4 rounded-xl mb-6 space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Adicionar Lançamento</h4>
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex-1">
                        <input required value={newEntryDesc} onChange={e => setNewEntryDesc(e.target.value)} placeholder="Descrição do gasto ou ganho..." className="w-full p-2 bg-white dark:bg-[#1e2023] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
                      </div>
                      <div className="w-full md:w-32">
                        <input required type="number" step="0.01" value={newEntryAmount} onChange={e => setNewEntryAmount(e.target.value)} placeholder="R$ 0,00" className="w-full p-2 bg-white dark:bg-[#1e2023] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
                      </div>
                      <div className="w-full md:w-32">
                        <select value={newEntryType} onChange={e => setNewEntryType(e.target.value as "income" | "expense")} className="w-full p-2 bg-white dark:bg-[#1e2023] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm font-medium">
                          <option value="expense">Gasto (-)</option>
                          <option value="income">Ganho (+)</option>
                        </select>
                      </div>
                      <button type="submit" className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg font-medium text-sm transition-colors hover:bg-gray-800 dark:hover:bg-gray-200 whitespace-nowrap">
                        Adicionar
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Extrato do Projeto</h4>
                  {entriesList.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhum lançamento efetuado.</p>
                  ) : (
                    entriesList.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${entry.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                            {entry.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{entry.description}</p>
                            <p className="text-[10px] text-gray-400">{new Date(entry.createdAt).toLocaleDateString('pt-BR')} • {entry.createdByEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-bold ${entry.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </span>
                          {selectedProject.status === "Aberto" && (role === 'adm_area' || role === 'tesoureiro' || role === 'coordenador') && (
                            <button onClick={() => deleteProjectEntry(selectedProject.id, entry.id)} className="text-red-400 hover:text-red-600 transition-colors p-1" title="Excluir lançamento">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
