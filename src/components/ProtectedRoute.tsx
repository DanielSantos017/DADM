"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, UserRole } from "@/contexts/AuthContext";

const boardRoles: UserRole[] = ["tesoureiro", "coordenador"];
const projectRoles: UserRole[] = [...boardRoles, "adm_area", "usuario_area"];
const routeRoles: Record<string, UserRole[]> = {
  "/dashboard": boardRoles,
  "/caixa": boardRoles,
  "/estoque": boardRoles,
  "/pedidos": boardRoles,
  "/historico-pedidos": boardRoles,
  "/members": boardRoles,
  "/configuracoes": ["tesoureiro"],
  "/mcp": [...boardRoles, "adm_area"],
  "/projetos": projectRoles,
  "/reembolsos": boardRoles,
  "/governanca": [...projectRoles, "usuario"],
  "/reserva": boardRoles,
};

function fallbackPath(role: UserRole) {
  if (role === "usuario") return "/reembolso";
  if (role === "usuario_area" || role === "adm_area") return "/projetos";
  return "/dashboard";
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const permittedRoles = allowedRoles ?? routeRoles[pathname];
  const accessDenied = !!user && (!role || !permittedRoles?.includes(role));

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== "/login") {
        router.push("/login");
      } else if (accessDenied) {
        router.push(fallbackPath(role));
      }
    }
  }, [user, role, loading, router, pathname, accessDenied]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-900 dark:text-white bg-gray-50 dark:bg-[#121315]">Carregando sistema...</div>;
  }

  if (!user && pathname !== "/login") {
    return null; 
  }

  if (accessDenied) {
    return null; 
  }

  return <>{children}</>;
}



