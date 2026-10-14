"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/hooks/useInventory";
import { useCategories } from "@/hooks/useCategories";
import { useDeleteRequests } from "@/hooks/useDeleteRequests";
import { Plus, Trash2, Package, Printer, ShieldAlert, PackageMinus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBatchApprovals } from "@/hooks/useBatchApprovals";
import type { InventoryItem } from "@/types";

export default function EstoquePage() {
  const { role, user } = useAuth();
  const { items, loading, addItem, deleteItem, dispatchItem } = useInventory();
  const { categories, addCategory } = useCategories("estoque");
  const { batches, updateBatchStatus } = useBatchApprovals();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [dispatchItemData, setDispatchItemData] = useState<any>(null);
  const [dispatchQty, setDispatchQty] = useState(1);
  const [dispatchReason, setDispatchReason] = useState("venda");

  const { createRequest } = useDeleteRequests();

  const [formData, setFormData] = useState({
    name: "",
    quantity: 0,
    baseCost: 0,
    additionalExpenses: 0,
    salePrice: 0,
    category: "",
  });

  const canEdit = role === "tesoureiro" || role === "coordenador";
  const canDelete = role === "tesoureiro";

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      alert("Por favor selecione uma categoria.");
      return;
    }

    const timestamp = Date.now();
    await addItem({
      name: formData.name,
      quantity: Number(formData.quantity),
      baseCost: Number(formData.baseCost),
      additionalExpenses: Number(formData.additionalExpenses),
      salePrice: Number(formData.salePrice),
      category: formData.category,
      entryDate: timestamp,
      createdByEmail: user?.email || "unknown@system",
      createdAtIso: new Date(timestamp).toISOString(),
      timestamp: timestamp,
      metadata: { source: "web_app", version: "1.0" }
    });
    setIsOpen(false);
    setFormData({ name: "", quantity: 0, baseCost: 0, additionalExpenses: 0, salePrice: 0, category: "" });
  };

  const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "NEW_CATEGORY") {
      const newCat = prompt("Digite o nome da nova categoria:");
      if (newCat && newCat.trim() !== "") {
        await addCategory(newCat);
        setFormData({ ...formData, category: newCat.trim() });
      } else {
        setFormData({ ...formData, category: "" });
      }
    } else {
      setFormData({ ...formData, category: val });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchItemData || dispatchQty <= 0) return;

    try {
      // Retira do estoque
      const wasSale = dispatchReason === "venda";
      const originalItem = await dispatchItem(dispatchItemData.id, dispatchQty);
      
      setIsDispatchOpen(false);
      setDispatchItemData(null);
      setDispatchQty(1);
      setDispatchReason("venda");
      alert(wasSale
        ? `Saída registrada. A Tesouraria deve conciliar e lançar a receita bruta de ${formatCurrency(originalItem.salePrice * dispatchQty)} no Caixa.`
        : "Saída registrada com sucesso!");
    } catch (error: any) {
      alert("Erro ao registrar saída: " + error.message);
    }
  };

  const handleInventoryDelete = async (item: InventoryItem) => {
    if (role === "tesoureiro") {
      if (confirm("Excluir definitivamente este lote?")) await deleteItem(item.id);
      return;
    }
    const reason = prompt("Justificativa para solicitar exclusão deste item:");
    if (!reason?.trim()) return;
    await createRequest({
      collection: "estoque",
      itemId: item.id,
      itemNameOrDesc: `Estoque: ${item.name} (${item.quantity}un) - Motivo: ${reason.trim()}`,
      requestedByEmail: user?.email || "unknown",
    });
    alert("Pedido de exclusão enviado para a Tesouraria.");
  };

  const getFontSize = (value: number) => {
    const strLen = formatCurrency(value).length;
    if (strLen > 14) return "text-lg";
    if (strLen > 11) return "text-xl";
    return "text-2xl";
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-6">Carregando controle de estoque...</div>;

  const totalCost = items.reduce((acc, curr) => acc + (curr.realCostUnit * curr.quantity), 0);
  const expectedRevenue = items.reduce((acc, curr) => acc + (curr.salePrice * curr.quantity), 0);
  const potentialProfit = expectedRevenue - totalCost;

  return (
    <>
      <div className="space-y-6 no-print">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle de Estoque</h1>
            <p className="text-gray-500 dark:text-zinc-400 mt-1">Gerencie produtos e calcule lucro real dinamicamente.</p>
          </div>
          
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {role === "tesoureiro" && (
               <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-900 dark:bg-[#2a2c30] hover:bg-gray-800 dark:hover:bg-[#4c4e51] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                 <Printer className="w-4 h-4" /> Imprimir Inventário
               </button>
            )}

            {canEdit && (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                  <Plus className="w-4 h-4" /> Adicionar Lote
                </DialogTrigger>
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[500px] bg-white dark:bg-[#1e2023] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white font-medium">Novo Lote de Produtos</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAdd} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Nome do Produto</Label>
                      <Input id="name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Moletom DADM G" className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white focus-visible:ring-[#4c4e51]" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Categoria</Label>
                      <select 
                        id="category" 
                        required 
                        value={formData.category} 
                        onChange={handleCategoryChange} 
                        className="w-full h-10 px-3 bg-gray-50 dark:bg-[#121315] border border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white rounded-md text-sm outline-none focus:border-[#4c4e51]"
                      >
                        <option value="" disabled>Selecione uma categoria...</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="NEW_CATEGORY" className="font-bold text-indigo-400">+ Adicionar Categoria...</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Quantidade</Label>
                        <Input id="quantity" type="number" min="1" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white focus-visible:ring-[#4c4e51]" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="salePrice" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Preço de Venda (Unidade)</Label>
                        <Input id="salePrice" type="number" step="0.01" min="0" required value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: Number(e.target.value)})} className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white focus-visible:ring-[#4c4e51]" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="baseCost" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Custo Unitário (R$)</Label>
                        <Input id="baseCost" type="number" step="0.01" min="0" required value={formData.baseCost} onChange={e => setFormData({...formData, baseCost: Number(e.target.value)})} className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white focus-visible:ring-[#4c4e51]" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="additionalExpenses" className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Despesas Extras Lote (Frete)</Label>
                        <Input id="additionalExpenses" type="number" step="0.01" min="0" required value={formData.additionalExpenses} onChange={e => setFormData({...formData, additionalExpenses: Number(e.target.value)})} className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white focus-visible:ring-[#4c4e51]" />
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-[#121315] border border-gray-200 dark:border-[#2a2c30] p-4 rounded-lg mt-4 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-[#4c4e51] uppercase tracking-wider">Projeção do Lote</p>
                        <p className="text-xs text-gray-500 dark:text-[#8a8a8a] mt-1">
                          Custo Real Un: {formatCurrency(Number(formData.baseCost) + (Number(formData.additionalExpenses) / (Number(formData.quantity) || 1)))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-[#4c4e51] uppercase tracking-wider">Lucro Líquido</p>
                        <p className="text-sm font-bold text-emerald-400">
                          {formatCurrency((Number(formData.salePrice) - (Number(formData.baseCost) + (Number(formData.additionalExpenses) / (Number(formData.quantity) || 1)))) * Number(formData.quantity))}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button type="submit" className="bg-white text-[#1e2023] px-6 py-2 rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors">
                        Registrar Lote
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16 pt-8 border-t border-gray-200 dark:border-[#1e2023]">
          <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-[#4c4e51] tracking-[0.2em] uppercase">Total em Estoque (Custo)</h3>
            <div>
              <p className="text-[22px] font-normal text-gray-900 dark:text-white">{formatCurrency(totalCost)}</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-[#4c4e51] tracking-[0.2em] uppercase">Valor Final de Venda</h3>
            <div>
              <p className="text-[22px] font-normal text-gray-900 dark:text-white">{formatCurrency(expectedRevenue)}</p>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-[#4c4e51] tracking-[0.2em] uppercase">Potencial de Lucro</h3>
            <div>
              <p className="text-[22px] font-normal text-gray-500 dark:text-[#8a8a8a]">{formatCurrency(potentialProfit)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3 md:hidden" aria-label="Itens do estoque">
          {items.length === 0 ? <p className="rounded-xl border border-gray-200 p-5 text-sm text-gray-600 dark:border-zinc-700 dark:text-gray-300">Nenhum item no estoque.</p> : items.map((item) => (
            <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-[#1e2023]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="break-words font-medium text-gray-900 dark:text-white">{item.name}</h3><p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{item.category} · {new Date(item.entryDate).toLocaleDateString("pt-BR")}</p></div>
                <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-sm font-semibold text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">{item.quantity} un.</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-200 pt-3 text-sm dark:border-zinc-700">
                <div><dt className="text-gray-600 dark:text-gray-300">Custo unitário</dt><dd className="font-medium tabular-nums">{formatCurrency(item.realCostUnit)}</dd></div>
                <div><dt className="text-gray-600 dark:text-gray-300">Preço de venda</dt><dd className="font-medium tabular-nums">{formatCurrency(item.salePrice)}</dd></div>
              </dl>
              {(role === "tesoureiro" || role === "coordenador") && <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setDispatchItemData(item); setDispatchQty(1); setIsDispatchOpen(true); }} className="min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-indigo-600">Registrar saída</button>
                <button type="button" onClick={() => void handleInventoryDelete(item)} className="min-h-11 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 focus-visible:outline-2 focus-visible:outline-red-700 dark:border-red-800 dark:text-red-300">{role === "tesoureiro" ? "Excluir lote" : "Solicitar exclusão"}</button>
              </div>}
            </article>
          ))}
        </div>
        <div className="hidden bg-transparent border-t border-gray-200 dark:border-[#1e2023] pt-8 mt-8 overflow-x-auto w-full md:block">
          <Table className="w-full min-w-[900px]">
            <TableHeader className="border-b border-gray-200 dark:border-[#1e2023]">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase">Data / ISO</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase">Produto</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase text-center">Qtd.</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase text-right">Custo Real (Un)</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase text-right">Preço Venda</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase text-right">Lucro Unitário</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase text-right">Lucro Líquido</TableHead>
                <TableHead className="text-gray-400 dark:text-[#4c4e51] font-bold tracking-widest text-[10px] uppercase text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="border-none hover:bg-transparent">
                  <TableCell colSpan={8} className="text-center py-10 text-gray-400 dark:text-[#4c4e51]">
                    Nenhum item no estoque.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="border-b border-gray-200 dark:border-[#1e2023] hover:bg-gray-50 dark:hover:bg-[#2a2c30] transition-colors">
                    <TableCell className="text-xs text-gray-400 dark:text-[#4c4e51]">
                      {new Date(item.entryDate).toLocaleDateString('pt-BR')}
                      <div className="text-[9px] opacity-50">{item.createdAtIso?.split('T')[0]}</div>
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {item.name}
                      <div className="text-[10px] text-gray-400 dark:text-[#4c4e51] uppercase tracking-wider">{item.category}</div>
                    </TableCell>
                    <TableCell className="text-center text-gray-900 dark:text-white">{item.quantity}</TableCell>
                    <TableCell className="text-right text-gray-500 dark:text-[#8a8a8a] font-medium">
                      {formatCurrency(item.realCostUnit)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(item.salePrice)}
                    </TableCell>
                    <TableCell className="text-right text-gray-500 dark:text-[#8a8a8a] font-medium">
                      {formatCurrency(item.salePrice - item.realCostUnit)}
                    </TableCell>
                    <TableCell className="text-right text-gray-900 dark:text-white font-medium">
                      {formatCurrency(item.expectedProfit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(role === "tesoureiro" || role === "coordenador") && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setDispatchItemData(item);
                              setDispatchQty(1);
                              setIsDispatchOpen(true);
                            }}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-indigo-700 transition-colors hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-indigo-300"
                            title="Dar Baixa (Saída)"
                            aria-label={`Registrar saída de ${item.name}`}
                          >
                            <PackageMinus className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => void handleInventoryDelete(item)}
                            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${role === 'tesoureiro' ? 'text-gray-600 dark:text-gray-300 hover:text-red-600' : 'text-gray-600 dark:text-gray-300 hover:text-amber-600'}`}
                            title={role === 'tesoureiro' ? "Excluir Lote" : "Solicitar Exclusão"}
                            aria-label={role === 'tesoureiro' ? `Excluir lote ${item.name}` : `Solicitar exclusão do lote ${item.name}`}
                          >
                            {role === 'tesoureiro' ? <Trash2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isDispatchOpen} onOpenChange={setIsDispatchOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white dark:bg-[#1e2023] border-gray-200 dark:border-[#2a2c30]">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white font-medium">Dar Baixa no Estoque</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDispatch} className="space-y-4 mt-4">
            <p className="text-sm text-gray-500 dark:text-[#8a8a8a]">
              Retirar itens do lote <strong className="text-gray-900 dark:text-white">{dispatchItemData?.name}</strong>. Estoque atual: {dispatchItemData?.quantity}
            </p>
            
            <div className="space-y-2">
              <Label className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Quantidade a Retirar</Label>
              <Input 
                type="number" 
                min="1" 
                max={dispatchItemData?.quantity || 1} 
                required 
                value={dispatchQty} 
                onChange={e => setDispatchQty(Number(e.target.value))} 
                className="bg-gray-50 dark:bg-[#121315] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white focus-visible:ring-[#4c4e51]" 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-400 dark:text-[#4c4e51] font-bold text-[10px] uppercase tracking-wider">Motivo da Saída</Label>
              <select 
                required 
                value={dispatchReason} 
                onChange={e => setDispatchReason(e.target.value)} 
                className="w-full h-10 px-3 bg-gray-50 dark:bg-[#121315] border border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white rounded-md text-sm outline-none focus:border-[#4c4e51]"
              >
                <option value="venda">Venda (Gera Receita no Caixa)</option>
                <option value="descarte">Descarte / Perda</option>
                <option value="uso_interno">Uso Interno</option>
              </select>
            </div>

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-sm font-bold text-xs uppercase tracking-widest mt-4 transition-colors">
              Confirmar Saída
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {role === "tesoureiro" && batches.filter(b => b.status === "pendente").length > 0 && (
        <div className="bg-white dark:bg-[#1e2023] border border-amber-500/50 p-6 rounded-lg mt-8 no-print animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-gray-900 dark:text-white font-medium mb-4 flex items-center gap-2 text-amber-500"><ShieldAlert className="w-4 h-4" /> Lotes de Suprimentos Pendentes de Aprovação</h2>
          <div className="space-y-4">
            {batches.filter(b => b.status === "pendente").map(batch => (
              <div key={batch.id} className="border border-gray-200 dark:border-[#2a2c30] rounded-md p-4 bg-gray-50 dark:bg-[#121315]">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs text-gray-500 font-medium">Lote #{batch.id.substring(1, 6)}</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">Enviado por: {batch.requestedByEmail}</p>
                    <p className="text-xs text-gray-500">{new Date(batch.timestamp).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        try {
                          for (const item of batch.items) {
                            await addItem(item);
                          }
                          await updateBatchStatus(batch.id, "aprovado");
                          alert("Lote aprovado e itens adicionados ao estoque!");
                        } catch (e: any) {
                          alert("Erro ao aprovar lote: " + e.message);
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs rounded font-medium"
                    >
                      Aprovar e Estocar
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm("Recusar este lote? Ele não entrará no estoque.")) {
                          await updateBatchStatus(batch.id, "recusado");
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs rounded font-medium"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase text-gray-500 bg-white dark:bg-[#1e2023]">
                      <tr>
                        <th className="px-3 py-2">Produto</th>
                        <th className="px-3 py-2">Qtd</th>
                        <th className="px-3 py-2">Custo Un.</th>
                        <th className="px-3 py-2">Desp. Extra</th>
                        <th className="px-3 py-2">Preço Venda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.items.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-200 dark:border-[#2a2c30]">
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{item.name}</td>
                          <td className="px-3 py-2 text-gray-500">{item.quantity}</td>
                          <td className="px-3 py-2 text-gray-500">{formatCurrency(item.baseCost)}</td>
                          <td className="px-3 py-2 text-gray-500">{formatCurrency(item.additionalExpenses)}</td>
                          <td className="px-3 py-2 text-gray-500">{formatCurrency(item.salePrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ÁREA DE IMPRESSÃO (INVENTÁRIO PDF) */}
      <div className="hidden print-only print:block text-black p-8 font-sans">
        <style dangerouslySetInnerHTML={{ __html: "@page { size: landscape; margin: 10mm; }" }} />
        <div className="border-b-2 border-black pb-4 mb-8">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-black">Relatório de Inventário</h1>
          <p className="text-gray-600 mt-2 text-sm">Diretório Acadêmico DADM</p>
          <p className="text-gray-600 text-sm">Posição atual do estoque gerada por: {user?.email} em {new Date().toLocaleString('pt-BR')}</p>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="border border-gray-300 p-4 rounded bg-gray-50 overflow-hidden">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 truncate">Custo Imobilizado</h3>
            <p className={`${getFontSize(totalCost)} font-bold text-black truncate`}>{formatCurrency(totalCost)}</p>
          </div>
          <div className="border border-gray-300 p-4 rounded bg-gray-50 overflow-hidden">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 truncate">Valor de Venda</h3>
            <p className={`${getFontSize(expectedRevenue)} font-bold text-green-700 truncate`}>{formatCurrency(expectedRevenue)}</p>
          </div>
          <div className="border border-gray-300 p-4 rounded bg-gray-50 overflow-hidden">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 truncate">Lucro Potencial</h3>
            <p className={`${getFontSize(potentialProfit)} font-bold text-blue-700 truncate`}>{formatCurrency(potentialProfit)}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold uppercase tracking-widest mb-4">Itens em Estoque</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left font-bold">Data (ISO)</th>
              <th className="border p-2 text-left font-bold">Produto</th>
              <th className="border p-2 text-left font-bold">Cat.</th>
              <th className="border p-2 text-center font-bold">Qtd.</th>
              <th className="border p-2 text-right font-bold">Custo Un.</th>
              <th className="border p-2 text-right font-bold">Venda Un.</th>
              <th className="border p-2 text-right font-bold">Lucro Total</th>
              <th className="border p-2 text-left font-bold text-xs">Autor / UUID</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td className="border p-2 text-xs">{item.createdAtIso}</td>
                <td className="border p-2 font-medium">{item.name}</td>
                <td className="border p-2">{item.category}</td>
                <td className="border p-2 text-center">{item.quantity}</td>
                <td className="border p-2 text-right">{formatCurrency(item.realCostUnit)}</td>
                <td className="border p-2 text-right">{formatCurrency(item.salePrice)}</td>
                <td className="border p-2 text-right text-green-700 font-medium">{formatCurrency(item.expectedProfit)}</td>
                <td className="border p-2 text-[10px] font-mono">
                  {item.createdByEmail?.split('@')[0] || "Sistema"}<br/>
                  <span className="text-gray-400">{item.id}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}






