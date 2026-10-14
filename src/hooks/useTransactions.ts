import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "@/lib/firebase";
import { Transaction } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export function useTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const transactionsRef = ref(database, 'transactions');
    const unsubscribe = onValue(transactionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedData = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        })) as Transaction[];
        parsedData.sort((a, b) => b.date - a.date);
        setTransactions(parsedData);
      } else {
        setTransactions([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firebase fetch error:", error);
      setLoading(false);
    });

    // Timeout de fallback caso a conexão congele
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const addTransaction = async (transaction: Partial<Transaction> & Pick<Transaction, "description" | "amount" | "type" | "category"> & { authorizationId?: string }) => {
    try {
      if (!user) throw new Error("Faça login novamente.");
      const response = await fetch("/api/caixa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify(transaction),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar o lançamento.");
      return result.id as string;
    } catch (error) {
      console.error("Firebase write error:", error);
      throw error;
    }
  };

  return { transactions, loading, addTransaction };
}
