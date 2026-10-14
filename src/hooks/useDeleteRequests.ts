import { useState, useEffect } from "react";
import { ref, onValue, push, set, remove } from "firebase/database";
import { database } from "@/lib/firebase";

export interface DeleteRequest {
  id: string;
  collection: "caixa" | "estoque";
  itemId: string;
  itemNameOrDesc: string; // para facilitar a visualização do que está sendo excluído
  requestedByEmail: string;
  timestamp: number;
}

export function useDeleteRequests() {
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const reqRef = ref(database, 'delete_requests');
    const unsubscribe = onValue(reqRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as DeleteRequest[];
        parsed.sort((a, b) => b.timestamp - a.timestamp);
        setRequests(parsed);
      } else {
        setRequests([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createRequest = async (request: Omit<DeleteRequest, "id" | "timestamp">) => {
    const reqRef = ref(database, 'delete_requests');
    const newReqRef = push(reqRef);
    await set(newReqRef, {
      ...request,
      timestamp: Date.now()
    });
  };

  const removeRequest = async (id: string) => {
    const reqRef = ref(database, `delete_requests/${id}`);
    await remove(reqRef);
  };

  const approveRequest = async (request: DeleteRequest) => {
    if (request.collection === "caixa") {
      throw new Error("Lançamentos do Caixa não podem ser excluídos. Registre um estorno auditável após conciliação.");
    }
    // 1. Remove da coleção original
    const itemRef = ref(database, `inventory/${request.itemId}`);
    await remove(itemRef);
    // 2. Remove o request
    await removeRequest(request.id);
  };

  return { requests, loading, createRequest, removeRequest, approveRequest };
}
