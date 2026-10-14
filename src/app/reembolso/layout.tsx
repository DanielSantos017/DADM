import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solicitar reembolso | DADM",
  description: "Envie uma solicitação de reembolso ao DADM sem criar uma conta.",
};

export default function ReembolsoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
