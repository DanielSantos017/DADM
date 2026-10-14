"use client";
import { useState } from "react";
import Link from "next/link";
import { useTransactions } from "@/hooks/useTransactions";
import { useInventory } from "@/hooks/useInventory";
import { useProjects } from "@/hooks/useProjects";
import { useReimbursements } from "@/hooks/useReimbursements";

export default function DashboardPage() {
  const [openedAt] = useState(() => Date.now());
  const { transactions, loading: txLoading } = useTransactions();
  const { items, loading: invLoading } = useInventory();
  const { projects, loading: projectsLoading } = useProjects();
  const { reimbursements, loading: reimbursementsLoading } = useReimbursements();

  if (txLoading || invLoading || projectsLoading || reimbursementsLoading) return <div role="status" className="p-6">Carregando painel de controle...</div>;

  const currentYear = new Date().getFullYear();
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  // Agrupar transações do ano atual por mês
  const monthlyTotals = Array(12).fill(0).map((_, i) => ({ month: monthNames[i], income: 0, expense: 0 }));
  
  transactions.forEach(tx => {
    const d = new Date(tx.timestamp);
    if (d.getFullYear() === currentYear) {
      const monthIndex = d.getMonth();
      if (tx.type === 'income') monthlyTotals[monthIndex].income += tx.amount;
      if (tx.type === 'expense') monthlyTotals[monthIndex].expense += tx.amount;
    }
  });

  // Normalizar para alturas de barra (0 a 100%)
  const maxMonthlyVal = Math.max(1, ...monthlyTotals.map(m => Math.max(m.income, m.expense)));
  const annualData = monthlyTotals.map(m => ({
    month: m.month,
    incomePct: (m.income / maxMonthlyVal) * 100,
    expensePct: (m.expense / maxMonthlyVal) * 100,
    incomeRaw: m.income,
    expenseRaw: m.expense
  }));

  // Estatísticas de 30 Dias
  const thirtyDaysAgo = openedAt - (30 * 24 * 60 * 60 * 1000);
  
  const recentIncome = transactions
    .filter(t => t.type === 'income' && t.timestamp >= thirtyDaysAgo)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const recentExpense = transactions
    .filter(t => t.type === 'expense' && t.timestamp >= thirtyDaysAgo)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalInventoryCost = items.reduce((acc, curr) => acc + (curr.realCostUnit * curr.quantity), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const pendingProjects = projects.filter((project) => project.status === "Pendente_Aprovacao").length;
  const pendingReimbursements = reimbursements.filter((item) => item.status === "pendente" || item.status === "em_analise").length;
  const readyForPayment = reimbursements.filter((item) => item.source === "public" && item.status === "aprovado").length;

  return (
    <div className="space-y-8 pb-12">
      <section aria-labelledby="pending-heading">
        <h1 id="pending-heading" className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">Pendências da Tesouraria</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Projetos aguardando análise", count: pendingProjects, href: "/caixa" },
            { label: "Reembolsos para analisar", count: pendingReimbursements, href: "/reembolsos" },
            { label: "Reembolsos aprovados para pagar", count: readyForPayment, href: "/reembolsos" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="flex min-h-28 flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:border-zinc-700 dark:bg-[#1e2023] dark:text-white">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-3xl font-semibold tabular-nums">{item.count}</span>
            </Link>
          ))}
        </div>
      </section>
      {/* First Row of Charts */}
      <div className="space-y-6 bg-white dark:bg-[#151618] p-4 sm:p-8 rounded-xl border border-gray-200 dark:border-[#1e1f22] shadow-sm relative overflow-hidden">
        {/* Subtle background grid pattern removed as requested */}
        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Balanço anual {currentYear}: entradas e gastos</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">Entradas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff4444]"></span>
              <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">Gastos</span>
            </div>
          </div>
        </div>
        
        {/* Dynamic Grouped Bar Chart */}
        <div className="hidden h-56 w-full items-end justify-between border-b border-gray-200 dark:border-[#2a2c30] pb-2 relative z-10 mt-6 sm:flex">
          {annualData.map((data, i) => (
            <div key={i} tabIndex={0} aria-label={`${data.month}: entradas ${formatCurrency(data.incomeRaw)}, gastos ${formatCurrency(data.expenseRaw)}`} className="flex gap-1 h-full items-end group relative w-full justify-center focus-visible:outline-2 focus-visible:outline-indigo-600">
              {/* Income Bar (Green) */}
              <div className="w-2 bg-[#4c4e51] group-hover:bg-green-500 transition-all duration-300 rounded-t-sm relative" style={{ height: `${data.incomePct}%`, minHeight: data.incomePct > 0 ? '4px' : '0' }}>
                 <div aria-hidden="true" className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 bg-green-700 text-white text-xs px-2 py-1 rounded shadow-lg font-bold pointer-events-none transition-opacity z-20 whitespace-nowrap">
                  {formatCurrency(data.incomeRaw)}
                </div>
              </div>
              
              {/* Expense Bar (Red) */}
              <div className="w-2 bg-[#4c4e51] group-hover:bg-[#ff4444] transition-all duration-300 rounded-t-sm relative" style={{ height: `${data.expensePct}%`, minHeight: data.expensePct > 0 ? '4px' : '0' }}>
                 <div aria-hidden="true" className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 bg-red-700 text-white text-xs px-2 py-1 rounded shadow-lg font-bold pointer-events-none transition-opacity z-20 whitespace-nowrap">
                  {formatCurrency(data.expenseRaw)}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="hidden justify-between text-xs text-gray-600 dark:text-gray-300 font-medium uppercase relative z-10 pt-2 sm:flex">
          {annualData.map((d, i) => (
            <span key={i} className="w-full text-center">{d.month}</span>
          ))}
        </div>
        <details className="rounded-lg border border-gray-200 p-3 text-sm dark:border-zinc-700">
          <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-indigo-600">Ver valores de cada mês</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr><th scope="col" className="p-2">Mês</th><th scope="col" className="p-2">Entradas</th><th scope="col" className="p-2">Gastos</th></tr></thead>
              <tbody>{annualData.map((month) => <tr key={month.month} className="border-t border-gray-200 dark:border-zinc-700"><th scope="row" className="p-2 font-medium">{month.month}</th><td className="p-2 tabular-nums">{formatCurrency(month.incomeRaw)}</td><td className="p-2 tabular-nums">{formatCurrency(month.expenseRaw)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </div>

      {/* Second Row of Line Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { 
            title: "RECEITA BRUTA (ÚLTIMOS 30 DIAS)", 
            val: formatCurrency(recentIncome), 
            date: "Atualizado em tempo real", 
          },
          { 
            title: "ESTOQUE - VALOR ATUAL", 
            val: formatCurrency(totalInventoryCost), 
            date: "Atualizado em tempo real", 
          },
          { 
            title: "GASTOS (ÚLTIMOS 30 DIAS)", 
            val: formatCurrency(recentExpense), 
            date: "Atualizado em tempo real", 
          }
        ].map((chart, idx) => (
          <div key={idx} className="space-y-6 bg-white dark:bg-[#151618] p-8 rounded-xl border border-gray-200 dark:border-[#1e1f22] hover:border-gray-200 dark:border-[#2a2c30] transition-colors group">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{chart.title}</h3>
            
            <div>
              <p className="text-[24px] font-medium text-gray-900 dark:text-white tracking-tight">{chart.val}</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{chart.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



