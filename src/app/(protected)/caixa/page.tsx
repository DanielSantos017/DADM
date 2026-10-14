"use client";
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useProjects } from "@/hooks/useProjects";
import { useCategories } from "@/hooks/useCategories";
import { useDeleteRequests } from "@/hooks/useDeleteRequests";
import { TransactionDocument } from "@/components/TransactionDocument";
import Link from "next/link";
import { Plus, Printer, ShieldAlert, ChevronDown, ChevronUp, FolderOpen, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CaixaPage() {
  const { role, user } = useAuth();
  const { transactions, loading, addTransaction } = useTransactions();
  const { categories, addCategory } = useCategories("caixa");
  const { createRequest } = useDeleteRequests();
  const { projects, updateProjectStatus } = useProjects();

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  
  const pendingProjects = projects.filter(p => p.status === "Pendente_Aprovacao");
  const [isOpen, setIsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  
  const [formData, setFormData] = useState({
    description: "",
    amount: 0,
    type: "income",
    category: "",
    authorizationId: "",
  });

  const canEdit = role === "tesoureiro" || role === "coordenador";
  const handleRejectProject = async (projectId: string) => {
    await updateProjectStatus(projectId, "Aberto");
  };

  const handleTransactionDelete = async (tx: { id: string; description: string; amount: number }) => {
    const reason = prompt("Justificativa para solicitar correção ou estorno deste lançamento (o histórico será preservado):");
    if (!reason?.trim()) return;
    await createRequest({
      collection: "caixa",
      itemId: tx.id,
      itemNameOrDesc: `Caixa: ${tx.description} (${formatCurrency(tx.amount)}) - Motivo: ${reason.trim()}`,
      requestedByEmail: user?.email || "unknown",
    });
    alert("Solicitação de correção registrada. O lançamento original permanece no histórico.");
  };

  const handleReversal = async (tx: { id: string; description: string }) => {
    if (!user || role !== "tesoureiro") return;
    const reason = prompt(`Justificativa do estorno de "${tx.description}" (mínimo 10 caracteres):`);
    if (!reason) return;
    try {
      const response = await fetch(`/api/caixa/${encodeURIComponent(tx.id)}/estorno`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível estornar.");
      alert(`Estorno registrado: ${result.id}. O lançamento original foi preservado.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Falha ao estornar.");
    }
  };

  const toggleProjectExpand = (txId: string) => {
    setExpandedProjects(prev => ({ ...prev, [txId]: !prev[txId] }));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      alert("Por favor selecione uma categoria.");
      return;
    }

    try {
      await addTransaction({
        description: formData.description,
        amount: Number(formData.amount),
        type: formData.type as "income" | "expense",
        category: formData.category,
        ...(formData.type === "expense" ? { authorizationId: formData.authorizationId.trim() } : {}),
      });
      setIsOpen(false);
      setFormData({ description: "", amount: 0, type: "income", category: "", authorizationId: "" });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível lançar no Caixa.");
    }
  };

  const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "NEW_CATEGORY") {
      const newCat = prompt("Digite o nome da nova categoria:");
      if (newCat && newCat.trim() !== "") {
        await addCategory(newCat);
        setFormData({ ...formData, category: newCat.trim() });
      } else {
        setFormData({ ...formData, category: "" });
      }
    } else {
      setFormData({ ...formData, category: val });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getFontSize = (value: number) => {
    const strLen = formatCurrency(value).length;
    if (strLen > 14) return "text-lg";
    if (strLen > 11) return "text-xl";
    return "text-2xl";
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
  };

  const handlePrint = () => {
    setIsReportOpen(false);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  if (loading) return <div className="p-6">Carregando fluxo de caixa...</div>;

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  // Filtros DRE
  const reportTransactions = transactions.filter(t => {
    if (!reportStartDate || !reportEndDate) return true;
    const tDate = new Date(t.timestamp);
    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);
    end.setHours(23, 59, 59, 999);
    return tDate >= start && tDate <= end;
  });

  const dreIncome = reportTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const dreExpense = reportTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const dreBalance = dreIncome - dreExpense;

  return (
    <>
      {/* AREA VISUAL DO SISTEMA (ESCONDIDA NA IMPRESSÃO) */}
      <div className="space-y-6 no-print">

        {/* FILA DE APROVAÇÃO DE PROJETOS */}
        {role === "tesoureiro" && pendingProjects.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-6 mb-8">
            <h2 className="text-amber-800 dark:text-amber-500 font-bold flex items-center gap-2 mb-4">
              <FolderOpen className="w-5 h-5" /> Projetos Pendentes de Aprovação no Caixa
            </h2>
            <div className="space-y-3">
              {pendingProjects.map(project => {
                let income = 0;
                let expense = 0;
                Object.values(project.entries).forEach((e: any) => {
                  if (e.type === 'income') income += e.amount;
                  if (e.type === 'expense') expense += e.amount;
                });
                const profit = income - expense;

                return (
                  <div key={project.id} className="bg-white dark:bg-[#1e2023] p-4 rounded-lg border border-amber-100 dark:border-amber-900/30 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{project.name}</h3>
                      <p className="text-xs text-gray-500">{project.description || "Sem descrição"}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs font-bold">
                        <span className="text-emerald-500">Ganhos: {formatCurrency(income)}</span>
                        <span className="text-rose-500">Gastos: {formatCurrency(expense)}</span>
                        <span className={profit >= 0 ? "text-blue-500" : "text-red-500"}>Saldo: {formatCurrency(profit)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/governanca" className="bg-amber-100 text-amber-800 px-3 py-2 rounded-lg text-sm font-bold">Conferir orçamento e autorizações</Link>
                      <button onClick={() => handleRejectProject(project.id)} className="bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1"><XCircle className="w-4 h-4"/> Rejeitar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle de Caixa</h1>
            <p className="text-gray-500 dark:text-zinc-400 mt-1">Gerencie entradas e saídas financeiras do diretório.</p>
          </div>
          
          <div className="flex flex-wrap gap-2 md:gap-4 w-full md:w-auto mt-2 md:mt-0">
            {role === "tesoureiro" && (
              <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogTrigger className="flex items-center gap-2 bg-gray-900 dark:bg-[#2a2c30] hover:bg-gray-800 dark:hover:bg-[#4c4e51] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                  <Printer className="w-4 h-4" /> Relatório DRE
                </DialogTrigger>
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[425px] bg-white dark:bg-[#1e2023] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white font-medium">Gerar Relatório (DRE)</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Data Inicial</Label>
                      <Input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Data Final</Label>
                      <Input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white" />
                    </div>
                    <button onClick={handlePrint} className="w-full bg-white text-black py-2 rounded-sm font-bold text-xs uppercase tracking-widest mt-4">
                      Gerar PDF
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {canEdit && (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                  <Plus className="w-4 h-4" /> Novo Lançamento
                </DialogTrigger>
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[425px] bg-white dark:bg-[#1e2023] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white font-medium">Lançamento Manual</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAdd} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Tipo de Lançamento</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="type" value="income" checked={formData.type === 'income'} onChange={e => setFormData({...formData, type: e.target.value})} className="text-gray-400 dark:text-[#4c4e51] focus:ring-[#4c4e51] bg-gray-50 dark:bg-[#121315] border-[#4c4e51]" />
                          <span className="text-sm font-medium">Receita (Entrada)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="type" value="expense" checked={formData.type === 'expense'} onChange={e => setFormData({...formData, type: e.target.value})} className="text-gray-400 dark:text-[#4c4e51] focus:ring-[#4c4e51] bg-gray-50 dark:bg-[#121315] border-[#4c4e51]" />
                          <span className="text-sm font-medium">Despesa (Saída)</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Descrição</Label>
                      <Input id="description" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ex: Mensalidades Setembro" className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white focus-visible:ring-[#4c4e51]" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Categoria</Label>
                      <select 
                        id="category" 
                        required 
                        value={formData.category} 
                        onChange={handleCategoryChange} 
                        className="w-full h-10 px-3 bg-gray-50 dark:bg-[#121315] border border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white rounded-md text-sm outline-none focus:border-[#4c4e51]"
                      >
                        <option value="" disabled>Selecione uma categoria...</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="NEW_CATEGORY" className="font-bold text-indigo-400">+ Adicionar Categoria...</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Valor (R$)</Label>
                      <Input id="amount" type="number" step="0.01" min="0.01" required value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white focus-visible:ring-[#4c4e51]" />
                    </div>
                    {formData.type === "expense" && <div className="space-y-2">
                      <Label htmlFor="authorizationId" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Protocolo da autorização aprovada</Label>
                      <Input id="authorizationId" required value={formData.authorizationId} onChange={e => setFormData({...formData, authorizationId: e.target.value})} placeholder="Consulte em Governança" className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white" />
                      <Link href="/governanca" className="text-xs text-indigo-700 underline dark:text-indigo-300">Abrir Governança</Link>
                    </div>}

                    <div className="pt-4 flex justify-end">
                      <button type="submit" className="bg-white text-[#1e2023] px-6 py-2 rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors">
                        Lançar no Caixa
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16 pt-8 border-t border-gray-200 dark:border-[#1e2023]">
          <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-[#4c4e51] tracking-[0.2em] uppercase">Saldo Atual</h3>
            <div>
              <p className="text-[22px] font-normal text-gray-900 dark:text-white">{formatCurrency(balance)}</p>
              <p className="text-[10px] text-gray-400 dark:text-[#4c4e51] mt-1 tracking-wider">Consolidado no banco</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-[#4c4e51] tracking-[0.2em] uppercase">Total Receitas</h3>
            <div>
              <p className="text-[22px] font-normal text-gray-900 dark:text-white">{formatCurrency(totalIncome)}</p>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-[#4c4e51] tracking-[0.2em] uppercase">Total Despesas</h3>
            <div>
              <p className="text-[22px] font-normal text-gray-500 dark:text-[#8a8a8a]">{formatCurrency(totalExpense)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3 md:hidden" aria-label="Lançamentos do caixa">
          {transactions.length === 0 ? <p className="rounded-xl border border-gray-200 p-5 text-sm text-gray-600 dark:border-zinc-700 dark:text-gray-300">Nenhum lançamento registrado.</p> : transactions.map((tx) => (
            <article key={tx.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-[#1e2023]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-medium text-gray-900 dark:text-white">{tx.description}</h3>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{formatDate(tx.timestamp)} · {tx.category}</p>
                </div>
                <p className={`shrink-0 font-semibold tabular-nums ${tx.type === "income" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}</p>
              </div>
              <p className="mt-3 break-all text-xs text-gray-600 dark:text-gray-300">Registrado por {tx.createdByEmail}</p>
              <div className="mt-2"><TransactionDocument transaction={tx} /></div>
              {tx.isProject && tx.projectEntries && <details className="mt-3 border-t border-gray-200 pt-3 text-sm dark:border-zinc-700"><summary className="cursor-pointer font-medium">Ver lançamentos do projeto</summary><ul className="mt-2 space-y-2">{tx.projectEntries.map((entry: { description: string; amount: number; type: string }, index: number) => <li key={index} className="flex justify-between gap-3"><span>{entry.description}</span><span className="shrink-0 tabular-nums">{entry.type === "income" ? "+" : "−"}{formatCurrency(entry.amount)}</span></li>)}</ul></details>}
              {(role === "tesoureiro" || role === "coordenador") && <button type="button" onClick={() => void handleTransactionDelete(tx)} className="mt-3 min-h-11 rounded-lg border border-amber-300 px-3 text-sm font-medium text-amber-700 focus-visible:outline-2 focus-visible:outline-amber-700 dark:border-amber-800 dark:text-amber-300">Solicitar correção</button>}
              {role === "tesoureiro" && !tx.isProject && !tx.reimbursementId && !tx.reversesTransactionId && <button type="button" onClick={() => void handleReversal(tx)} className="ml-2 mt-3 min-h-11 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 dark:border-red-800 dark:text-red-300">Estornar</button>}
            </article>
          ))}
        </div>
        <div className="hidden bg-transparent border-t border-gray-200 dark:border-[#1e2023] pt-8 mt-8 overflow-x-auto w-full md:block">
          <Table className="w-full min-w-[800px]">
            <TableHeader className="border-b border-gray-200 dark:border-[#1e2023]">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase">Data / ISO</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase">Descrição</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase">Categoria</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase">Auditoria (Autor)</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase text-right">Valor</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow className="border-none hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center py-10 text-gray-400 dark:text-[#4c4e51]">
                    Nenhum lançamento registrado.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <React.Fragment key={tx.id}>
                    <TableRow className="border-b border-gray-200 dark:border-[#1e2023] hover:bg-gray-50 dark:hover:bg-[#2a2c30] transition-colors cursor-pointer" onClick={() => tx.isProject && toggleProjectExpand(tx.id)}>
                      <TableCell className="text-xs text-gray-400 dark:text-[#4c4e51]">
                        {formatDate(tx.timestamp)}
                        <div className="text-[9px] opacity-50">{tx.createdAtIso?.split('T')[0]}</div>
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {tx.isProject && <FolderOpen className="w-4 h-4 text-blue-500" />}
                        {tx.description}
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-bold text-gray-500 dark:text-[#8a8a8a] tracking-wider uppercase border border-gray-200 dark:border-[#2a2c30] bg-white dark:bg-[#151618] px-2 py-1 rounded">
                          {tx.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] text-gray-400 dark:text-[#4c4e51] tracking-wider">
                        {tx.createdByEmail}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 items-center">
                          <TransactionDocument transaction={tx} />
                          {tx.isProject && (
                            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                              {expandedProjects[tx.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                          {(role === "tesoureiro" || role === "coordenador") && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleTransactionDelete(tx);
                              }}
                              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${role === 'tesoureiro' ? 'text-gray-600 dark:text-gray-300 hover:text-red-600' : 'text-gray-600 dark:text-gray-300 hover:text-amber-600'}`}
                              title="Solicitar correção ou estorno"
                              aria-label={`Solicitar correção do lançamento ${tx.description}`}
                            >
                              <ShieldAlert className="w-5 h-5" />
                            </button>
                          )}
                          {role === "tesoureiro" && !tx.isProject && !tx.reimbursementId && !tx.reversesTransactionId && <button type="button" onClick={(event) => { event.stopPropagation(); void handleReversal(tx); }} className="min-h-11 text-xs font-medium text-red-700 underline dark:text-red-300">Estornar</button>}
                        </div>
                      </TableCell>
                    </TableRow>
                    {tx.isProject && expandedProjects[tx.id] && tx.projectEntries && (
                      <TableRow className="bg-gray-50/50 dark:bg-[#1a1b1e] border-b border-gray-200 dark:border-[#1e2023]">
                        <TableCell colSpan={6} className="p-0">
                          <div className="pl-12 pr-4 py-3 space-y-1">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Detalhamento do Evento</h4>
                            {tx.projectEntries.map((entry: any) => (
                              <div key={entry.id || Math.random()} className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-[#2a2c30] last:border-0 py-1">
                                <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${entry.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  {entry.description}
                                </span>
                                <span className={`font-medium ${entry.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ÁREA DE IMPRESSÃO (DRE PDF) */}
      <div className="hidden print-only print:block text-black p-8 font-sans">
        <style dangerouslySetInnerHTML={{ __html: "@page { size: landscape; margin: 10mm; }" }} />
        <div className="border-b-2 border-black pb-4 mb-8">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-black">Relatório DRE Consolidado</h1>
          <p className="text-gray-600 mt-2 text-sm">Diretório Acadêmico DADM</p>
          <p className="text-gray-600 text-sm">Gerado por: {user?.email} em {new Date().toLocaleString('pt-BR')}</p>
          <p className="text-gray-600 text-sm mt-2">
            Período: {reportStartDate ? new Date(reportStartDate).toLocaleDateString('pt-BR') : 'Início dos tempos'} 
            {' até '} 
            {reportEndDate ? new Date(reportEndDate).toLocaleDateString('pt-BR') : 'Hoje'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="border border-gray-300 p-4 rounded bg-gray-50 overflow-hidden">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 truncate">Total Entradas</h3>
            <p className={`${getFontSize(dreIncome)} font-bold text-green-700 truncate`}>{formatCurrency(dreIncome)}</p>
          </div>
          <div className="border border-gray-300 p-4 rounded bg-gray-50 overflow-hidden">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 truncate">Total Saídas</h3>
            <p className={`${getFontSize(dreExpense)} font-bold text-red-700 truncate`}>{formatCurrency(dreExpense)}</p>
          </div>
          <div className="border border-gray-300 p-4 rounded bg-gray-50 overflow-hidden">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 truncate">Resultado Líquido</h3>
            <p className={`${getFontSize(dreBalance)} font-bold truncate ${dreBalance >= 0 ? 'text-black' : 'text-red-700'}`}>
              {formatCurrency(dreBalance)}
            </p>
          </div>
        </div>

        <h2 className="text-lg font-bold uppercase tracking-widest mb-4">Auditoria de Transações</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left font-bold">Data (ISO)</th>
              <th className="border p-2 text-left font-bold">Descrição</th>
              <th className="border p-2 text-left font-bold">Categoria</th>
              <th className="border p-2 text-left font-bold">Tipo</th>
              <th className="border p-2 text-right font-bold">Valor</th>
              <th className="border p-2 text-left font-bold">Autor</th>
              <th className="border p-2 text-left font-bold text-xs">UUID</th>
            </tr>
          </thead>
          <tbody>
            {reportTransactions.map(tx => (
              <React.Fragment key={tx.id}>
                <tr className="bg-white">
                  <td className="border p-2">{new Date(tx.timestamp).toLocaleString('pt-BR')}</td>
                  <td className="border p-2">
                    <div className="flex items-center gap-1 font-bold">
                      {tx.description} {tx.isProject ? " (Evento Consolidado)" : ""}
                    </div>
                  </td>
                  <td className="border p-2">{tx.category}</td>
                  <td className="border p-2">{tx.type === 'income' ? 'ENTRADA' : 'SAÍDA'}</td>
                  <td className="border p-2 text-right font-bold">{formatCurrency(tx.amount)}</td>
                  <td className="border p-2">{tx.createdByEmail?.split('@')[0] || "Sistema"}</td>
                  <td className="border p-2 text-[8px] text-gray-400 font-mono">{tx.id}</td>
                </tr>
                {tx.isProject && tx.projectEntries && tx.projectEntries.map((entry: any) => (
                  <tr key={entry.id || Math.random()} className="bg-gray-100/80 italic text-gray-700">
                    <td className="border p-2 pl-6 text-gray-500">{new Date(entry.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="border p-2 pl-6">↳ {entry.description}</td>
                    <td className="border p-2 text-gray-500">Sub-item</td>
                    <td className="border p-2 text-gray-500">{entry.type === 'income' ? 'GANHO' : 'CUSTO'}</td>
                    <td className="border p-2 text-right text-gray-500">{formatCurrency(entry.amount)}</td>
                    <td className="border p-2 text-gray-500">{entry.createdByEmail?.split('@')[0]}</td>
                    <td className="border p-2"></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        
        <div className="mt-12 text-center text-gray-400 text-xs uppercase tracking-widest">
          Documento gerado pelo Sistema Financeiro DADM
        </div>
      </div>
    </>
  );
}





