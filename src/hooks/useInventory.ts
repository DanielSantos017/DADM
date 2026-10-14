import { useState, useEffect } from "react";
import { ref, onValue, push, set, remove, update, runTransaction } from "firebase/database";
import { database } from "@/lib/firebase";
import { InventoryItem } from "@/types";

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const inventoryRef = ref(database, 'inventory');
    const unsubscribe = onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedData = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        })) as InventoryItem[];
        setItems(parsedData);
      } else {
        setItems([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firebase fetch error:", error);
      setLoading(false);
    });

    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const addItem = async (item: Omit<InventoryItem, 'id' | 'realCostUnit' | 'expectedProfit'>) => {
    try {
      const realCostUnit = item.baseCost + (item.additionalExpenses / item.quantity);
      const expectedProfit = (item.salePrice - realCostUnit) * item.quantity;
      
      const inventoryRef = ref(database, 'inventory');
      const newItemRef = push(inventoryRef);
      const uniqueId = newItemRef.key;
      
      await set(newItemRef, {
        ...item,
        id: uniqueId,
        realCostUnit,
        expectedProfit
      });
    } catch (error: unknown) {
      console.error("Firebase write error:", error);
      alert("Não foi possível salvar o item. Verifique seu acesso ou tente novamente.");
      throw error;
    }
  };

  const updateItem = async (id: string, itemData: Partial<Omit<InventoryItem, 'id' | 'realCostUnit' | 'expectedProfit'>>) => {
    const itemRef = ref(database, `inventory/${id}`);
    
    const currentItem = items.find(i => i.id === id);
    if (!currentItem) return;

    const merged = { ...currentItem, ...itemData };
    const realCostUnit = merged.baseCost + (merged.additionalExpenses / merged.quantity);
    const expectedProfit = (merged.salePrice - realCostUnit) * merged.quantity;

    const finalItem = {
      ...itemData,
      realCostUnit,
      expectedProfit
    };

    await update(itemRef, finalItem);
  };

  const deleteItem = async (id: string) => {
    try {
      const itemRef = ref(database, `inventory/${id}`);
      await remove(itemRef);
    } catch {
      alert("Erro de Permissão ao excluir. Verifique as regras do Firebase.");
      throw new Error("Não foi possível excluir o item.");
    }
  };

  const dispatchItem = async (id: string, quantityToDeduct: number) => {
    if (!Number.isSafeInteger(quantityToDeduct) || quantityToDeduct <= 0) {
      throw new Error("Informe uma quantidade inteira positiva.");
    }
    const itemRef = ref(database, `inventory/${id}`);
    const state: { originalItem?: InventoryItem } = {};
    const result = await runTransaction(itemRef, (current: InventoryItem | null) => {
      if (!current || !Number.isSafeInteger(current.quantity) || quantityToDeduct > current.quantity) return;
      state.originalItem = { ...current, id };
      const remaining = current.quantity - quantityToDeduct;
      const additionalExpenses = current.additionalExpenses * (remaining / current.quantity);
      const realCostUnit = current.baseCost + (remaining ? additionalExpenses / remaining : 0);
      return {
        ...current,
        quantity: remaining,
        additionalExpenses,
        realCostUnit,
        expectedProfit: (current.salePrice - realCostUnit) * remaining,
      };
    });
    if (!result.committed || !state.originalItem) throw new Error("Item inexistente ou quantidade indisponível no estoque atual.");
    return state.originalItem;
  };

  return { items, loading, addItem, updateItem, deleteItem, dispatchItem };
}
