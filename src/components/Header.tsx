"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function Header() {
  const { user, role } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const displayName = user?.displayName || user?.email?.split('@')[0] || "Usuário";

  return (
    <header className="h-auto md:h-32 bg-transparent flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-10 z-10 w-full pt-6 pb-8 md:pb-0 gap-6 md:gap-0 shrink-0 print:hidden">
      <div className="flex flex-col w-full md:w-auto mt-4 md:mt-0">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase mb-1">Equipe Financeira</span>
        <h2 className="text-[22px] md:text-[26px] font-medium text-gray-900 dark:text-white tracking-wide break-words">
          Bem-vindo, {displayName}.
        </h2>
      </div>
      
      <div className="flex flex-row items-center justify-between w-full md:w-auto md:gap-8">
        {(role === 'tesoureiro' || role === 'coordenador') && <HeaderBalance />}
        
        <button 
          onClick={toggleTheme} 
          className="p-3 rounded-full bg-gray-200 dark:bg-[#1e1f22] text-gray-600 dark:text-[#8a8a8a] hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-[#2a2c30] transition-colors ml-auto md:ml-0"
          title="Alternar Tema Claro/Escuro"
          aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}

function HeaderBalance() {
  const { transactions, loading } = useTransactions();
  const totalIncome = transactions.filter(t => t.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
  const balance = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalIncome - totalExpense);

  return (
    <div className="flex flex-col items-start text-left md:items-end md:text-right">
      <span className="mb-1 text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Saldo registrado</span>
      <p className="text-xl font-medium text-gray-900 dark:text-white md:text-2xl" aria-live="polite">{loading ? "Carregando saldo…" : balance}</p>
    </div>
  );
}



