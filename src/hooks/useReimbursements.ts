import { useState, useEffect } from "react";
import { ref, onValue, push, set, update, remove, get } from "firebase/database";
import { database } from "@/lib/firebase";

export interface ReimbursementRequest {
  id: string;
  description: string;
  amount: number;
  category: string;
  receiptLink?: string;
  status: "pendente" | "em_analise" | "aprovado" | "pago" | "recusado" | "cancelado";
  requestedByEmail?: string;
  requestedByName?: string;
  source?: "public";
  expenseAt?: string;
  authorizationProtocol?: string;
  approvalBasis?: string;
  timestamp: number;
}

export function useReimbursements() {
  const [reimbursements, setReimbursements] = useState<ReimbursementRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rRef = ref(database, 'reimbursements');
    const unsubscribe = onValue(rRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as ReimbursementRequest[];
        parsed.sort((a, b) => b.timestamp - a.timestamp);
        setReimbursements(parsed);
      } else {
        setReimbursements([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createRequest = async (req: Omit<ReimbursementRequest, "id" | "status" | "timestamp">) => {
    const rRef = ref(database, 'reimbursements');
    const newRef = push(rRef);
    await set(newRef, {
      ...req,
      status: "pendente",
      timestamp: Date.now()
    });
  };

  const updateStatus = async (id: string, newStatus: "aprovado" | "recusado") => {
    const rRef = ref(database, `reimbursements/${id}`);
    await update(rRef, { status: newStatus });
  };

  const approveRequest = async (id: string, approvedByEmail: string) => {
    const requestSnapshot = await get(ref(database, `reimbursements/${id}`));
    const request = requestSnapshot.val() as ReimbursementRequest | null;
    if (!request || request.status !== "pendente") {
      throw new Error("Este reembolso não está mais pendente.");
    }
    if (!Number.isFinite(request.amount) || request.amount <= 0) {
      throw new Error("O valor do reembolso é inválido.");
    }

    // A chave estável evita criar dois débitos quando a aprovação é repetida.
    const transactionId = `reimbursement_${id}`;
    if ((await get(ref(database, `transactions/${transactionId}`))).exists()) {
      throw new Error("Este reembolso já possui lançamento no caixa.");
    }

    const now = Date.now();
    await update(ref(database), {
      [`reimbursements/${id}/status`]: "aprovado",
      [`transactions/${transactionId}`]: {
        id: transactionId,
        description: `Reembolso: ${request.description}`,
        amount: request.amount,
        type: "expense",
        date: now,
        category: "Reembolsos",
        createdByEmail: approvedByEmail,
        timestamp: now,
        createdAtIso: new Date(now).toISOString(),
        reimbursementId: id,
      },
    });
  };

  const deleteRequest = async (id: string) => {
    const rRef = ref(database, `reimbursements/${id}`);
    await remove(rRef);
  };

  return { reimbursements, loading, createRequest, updateStatus, approveRequest, deleteRequest };
}
