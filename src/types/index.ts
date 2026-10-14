export type UserRole = "tesoureiro" | "coordenador" | "usuario";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  date: number; // timestamp visual
  category: string;
  createdByEmail: string;
  createdAtIso: string;
  timestamp: number;
  metadata?: any;
  isProject?: boolean;
  projectEntries?: any[];
  document?: { path: string; name: string; mimeType: string; uploadedAt: number; uploadedByUid: string };
  reimbursementId?: string;
  reversesTransactionId?: string;
  authorizationId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  entryDate: number; // timestamp visual
  baseCost: number; // Custo Unitário
  additionalExpenses: number; // Frete, taxas
  realCostUnit: number; // Calculado
  salePrice: number; // Valor de venda unitário
  expectedProfit: number; // Calculado
  category: string;
  createdByEmail: string;
  createdAtIso: string;
  timestamp: number;
  metadata?: any;
}

export type ReimbursementStatus = "pendente" | "em_analise" | "aprovado" | "pago" | "recusado";

export interface ReimbursementMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface Reimbursement {
  id: string;
  requesterId: string;
  amount: number;
  date: number; // timestamp
  category: string;
  justification: string;
  receiptUrl: string;
  status: ReimbursementStatus;
  history: ReimbursementMessage[];
}
