import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

type ExportItem = {
  timestamp?: number;
  description?: string;
  category?: string;
  type?: string;
  amount?: number;
  createdByEmail?: string;
  name?: string;
  document?: string;
  phone?: string;
  minOrder?: string;
  address?: { city?: string; neighborhood?: string };
  requestedByEmail?: string;
  status?: string;
  role?: string;
  approvedBy?: string;
};

type ExportCollection = Record<string, ExportItem> | null | undefined;

export async function POST(request: Request) {
  const apiSecret = process.env.EXPORT_SECRET;
  const databaseSecret = process.env.FIREBASE_DB_SECRET;
  if (!apiSecret || !databaseSecret) {
    return NextResponse.json({ error: "Export is not configured" }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const tokenHash = createHash("sha256").update(token).digest();
  const secretHash = createHash("sha256").update(apiSecret).digest();
  if (!timingSafeEqual(tokenHash, secretHash)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: "Database URL not configured" }, { status: 500 });
  }

  const url = `${dbUrl.replace(/\/$/, "")}/.json?auth=${encodeURIComponent(databaseSecret)}`;

  try {
    // Busca todo o banco de dados via REST API do Firebase autenticado
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "Firebase request failed" }, { status: 502 });
    }
    const data = await response.json();

    if (!data) {
      return NextResponse.json({ message: "No data found" });
    }
    
    if (data.error) {
      return NextResponse.json({ error: "Firebase Error", details: data }, { status: 403 });
    }

    // Formata cada coleção para Array de Arrays (Padrão Google Sheets)
    const formatCaixa = (obj: ExportCollection) => {
      if (!obj) return [];
      const headers = ["ID", "Data", "Descrição", "Categoria", "Tipo", "Valor", "Autor"];
      const rows = Object.keys(obj).map(key => {
        const item = obj[key];
        return [
          key,
          item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '',
          item.description || '',
          item.category || '',
          item.type === 'income' ? 'ENTRADA' : 'SAÍDA',
          item.amount || 0,
          item.createdByEmail || ''
        ];
      });
      return [headers, ...rows];
    };

    const formatFornecedores = (obj: ExportCollection) => {
      if (!obj) return [];
      const headers = ["ID", "Nome Fantasia", "Documento", "Telefone", "Pedido Mínimo", "Cidade", "Bairro"];
      const rows = Object.keys(obj).map(key => {
        const item = obj[key];
        return [
          key,
          item.name || '',
          item.document || '',
          item.phone || '',
          item.minOrder || '',
          item.address?.city || '',
          item.address?.neighborhood || ''
        ];
      });
      return [headers, ...rows];
    };

    const formatReembolsos = (obj: ExportCollection) => {
      if (!obj) return [];
      const headers = ["ID", "Data Solicitação", "Descrição", "Categoria", "Valor", "Solicitante", "Status"];
      const rows = Object.keys(obj).map(key => {
        const item = obj[key];
        return [
          key,
          item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '',
          item.description || '',
          item.category || '',
          item.amount || 0,
          item.requestedByEmail || '',
          item.status || ''
        ];
      });
      return [headers, ...rows];
    };

    const formatUsuarios = (obj: ExportCollection) => {
      if (!obj) return [];
      const headers = ["UID", "Cargo", "Aprovado Por"];
      const rows = Object.keys(obj).map(key => {
        const item = obj[key];
        return [
          key,
          item.role || '',
          item.approvedBy || ''
        ];
      });
      return [headers, ...rows];
    };

    const payload = {
      caixa: formatCaixa(data.transactions),
      fornecedores: formatFornecedores(data.suppliers),
      reembolsos: formatReembolsos(data.reimbursements),
      usuarios: formatUsuarios(data.roles),
      // Lotes e Projetos podem ser complexos, mandaremos simplificado
      lotes_mcp: [["ID"], ...(data.mcp_batches ? Object.keys(data.mcp_batches).map(k => [k]) : [])],
      projetos: [["ID"], ...(data.projects ? Object.keys(data.projects).map(k => [k]) : [])],
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
