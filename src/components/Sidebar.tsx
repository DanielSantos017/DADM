"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck, Database, FolderOpen, LayoutDashboard, Landmark,
  LogOut, Map, Menu, Package2, Receipt, Settings, ShoppingCart,
  Ticket, Users, type LucideIcon,
} from "lucide-react";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type NavigationItem = { label: string; href: string; icon: LucideIcon };
type NavigationGroup = { label: string; items: NavigationItem[] };

function groupsForRole(role: UserRole): NavigationGroup[] {
  if (role === "usuario") {
    return [{ label: "Solicitações", items: [
      { label: "Decisões e pedidos", href: "/governanca", icon: ClipboardCheck },
      { label: "Solicitar reembolso", href: "/reembolso", icon: Ticket },
    ] }];
  }
  if (role === "usuario_area" || role === "adm_area") {
    return [{ label: "Área", items: [
      { label: "Projetos", href: "/projetos", icon: FolderOpen },
      { label: "Decisões e pedidos", href: "/governanca", icon: ClipboardCheck },
      { label: "Solicitar reembolso", href: "/reembolso", icon: Ticket },
      ...(role === "adm_area" ? [{ label: "Cotações", href: "/mcp", icon: Map }] : []),
    ] }];
  }
  if (role !== "tesoureiro" && role !== "coordenador") return [];
  return [
    { label: "Visão geral", items: [{ label: "Painel", href: "/dashboard", icon: LayoutDashboard }] },
    { label: "Financeiro", items: [
      { label: "Caixa", href: "/caixa", icon: Database },
      { label: "Fundo de Reserva", href: "/reserva", icon: Landmark },
      { label: "Decisões e pedidos", href: "/governanca", icon: ClipboardCheck },
      { label: "Reembolsos", href: "/reembolsos", icon: Ticket },
      { label: "Projetos", href: "/projetos", icon: FolderOpen },
      { label: "Cotações", href: "/mcp", icon: Map },
    ] },
    { label: "Produtos", items: [
      { label: "Estoque", href: "/estoque", icon: Package2 },
      { label: "Pedidos", href: "/pedidos", icon: ShoppingCart },
      { label: "Histórico de pedidos", href: "/historico-pedidos", icon: Receipt },
    ] },
    { label: "Administração", items: [
      { label: "Membros", href: "/members", icon: Users },
      ...(role === "tesoureiro" ? [{ label: "Colegiado", href: "/colegiado", icon: Users }] : []),
      ...(role === "tesoureiro" ? [{ label: "Configurações", href: "/configuracoes", icon: Settings }] : []),
    ] },
  ];
}

export function Sidebar() {
  const pathname = usePathname();
  const { role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const groups = groupsForRole(role);
  const allItems = groups.flatMap((group) => group.items);
  const primaryPaths = role === "tesoureiro" || role === "coordenador"
    ? ["/dashboard", "/caixa", "/reembolsos"]
    : role === "usuario" ? ["/governanca", "/reembolso"] : ["/projetos", "/governanca"];
  const primaryItems = allItems.filter((item) => primaryPaths.includes(item.href));
  const currentIsInMore = allItems.some((item) => item.href === pathname && !primaryPaths.includes(item.href));

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      setMenuOpen(false);
    } catch {
      setLogoutError("Não foi possível sair. Tente novamente.");
    }
  }

  function NavLink({ item, mobile = false }: { item: NavigationItem; mobile?: boolean }) {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
        className={mobile
          ? `flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600 ${active ? "text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-300"}`
          : `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${active ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200" : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-800"}`}
      >
        <Icon aria-hidden="true" className={mobile ? "h-5 w-5" : "h-4 w-4"} />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-gray-200 bg-white p-4 text-gray-900 dark:border-zinc-800 dark:bg-[#151618] dark:text-white md:flex print:hidden">
        <div className="mb-6 px-3 pt-2 text-sm font-semibold tracking-wide">DADM <span className="font-normal text-gray-500">· Tesouraria</span></div>
        <nav aria-label="Navegação principal" className="flex-1 space-y-5 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.label}</p>
              <div className="space-y-1">{group.items.map((item) => <NavLink key={item.href} item={item} />)}</div>
            </div>
          ))}
        </nav>
        {logoutError && <p role="alert" className="px-3 text-sm text-red-700 dark:text-red-300">{logoutError}</p>}
        <button type="button" onClick={handleLogout} className="mt-3 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700 dark:text-red-300 dark:hover:bg-red-950/30">
          <LogOut aria-hidden="true" className="h-4 w-4" /> Sair da conta
        </button>
      </aside>

      <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-stretch justify-around border-t border-gray-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] shadow-lg dark:border-zinc-700 dark:bg-[#151618] md:hidden print:hidden">
        {primaryItems.map((item) => <NavLink key={item.href} item={item} mobile />)}
        <button type="button" aria-label="Abrir mais opções" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${currentIsInMore ? "text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-300"}`}>
          <Menu aria-hidden="true" className="h-5 w-5" /><span>Mais</span>
        </button>
      </nav>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto bg-white text-gray-900 dark:bg-[#1e2023] dark:text-white md:hidden">
          <DialogHeader><DialogTitle>Menu do DADM</DialogTitle></DialogHeader>
          <nav aria-label="Todas as páginas" className="space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.label}</p>
                <div className="space-y-1">{group.items.map((item) => <NavLink key={item.href} item={item} />)}</div>
              </div>
            ))}
          </nav>
          {logoutError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{logoutError}</p>}
          <button type="button" onClick={handleLogout} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700 dark:text-red-300 dark:hover:bg-red-950/30">
            <LogOut aria-hidden="true" className="h-4 w-4" /> Sair da conta
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
