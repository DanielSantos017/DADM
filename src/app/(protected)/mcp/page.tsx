"use client";
import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useMCP } from "@/hooks/useMCP";
import { Map, Truck, Building2, Plus, ArrowRight, Trash2, CheckCircle2, ChevronRight, X, Save, FileText, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function MCPPage() {
  const { role } = useAuth();
  const { suppliers, addSupplier, deleteSupplier } = useSuppliers();
  const { 
    batches, createBatch, deleteBatch, updateBatchStatus, 
    addSupplierToBatch, removeSupplierFromBatch,
    addItemToBatch, removeItemFromBatch, saveQuote
  } = useMCP();

  const [activeTab, setActiveTab] = useState<'cotacoes'|'fornecedores'>('cotacoes');
  
  // Modals
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");

  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({ name: '', document: '', phone: '', minOrder: '', street: '', number: '', neighborhood: '', city: '', zip: '' });

  // Inside Batch State
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName) return;
    await createBatch(newBatchName);
    setNewBatchName("");
    setIsNewBatchModalOpen(false);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    await addSupplier({
      name: newSupplierData.name,
      document: newSupplierData.document,
      phone: newSupplierData.phone,
      minOrder: newSupplierData.minOrder,
      address: {
        street: newSupplierData.street,
        number: newSupplierData.number,
        neighborhood: newSupplierData.neighborhood,
        city: newSupplierData.city,
        zip: newSupplierData.zip
      }
    });
    setIsNewSupplierModalOpen(false);
    setNewSupplierData({ name: '', document: '', phone: '', minOrder: '', street: '', number: '', neighborhood: '', city: '', zip: '' });
  };

  // BATCH VIEW
  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  // States for Batch Editor
  const [selectedSupplierToAdd, setSelectedSupplierToAdd] = useState("");
  const [newItemData, setNewItemData] = useState({ name: '', description: '', quantity: 1 });
  
  // Matrix calculations
  const calculateWinners = () => {
    if (!selectedBatch) return { winners: {}, realCosts: {}, supplierTotalsBase: {} };
    const winners: Record<string, { supplierId: string, unitCost: number }> = {};
    const realCosts: Record<string, Record<string, number>> = {};
    const supplierTotalsBase: Record<string, number> = {};

    // 1. Calculate base totals for freight distribution
    Object.values(selectedBatch.items).forEach(item => {
      Object.entries(item.quotes || {}).forEach(([suppId, quote]) => {
        supplierTotalsBase[suppId] = (supplierTotalsBase[suppId] || 0) + (quote.basePrice * item.quantity);
      });
    });

    // 2. Calculate real costs
    Object.entries(selectedBatch.items).forEach(([itemId, item]) => {
      let lowestCost = Infinity;
      let winnerId = "";
      realCosts[itemId] = {};

      Object.entries(item.quotes || {}).forEach(([suppId, quote]) => {
        if (!quote.basePrice) return;
        const itemBaseTotal = quote.basePrice * item.quantity;
        
        const otherCostsVal = quote.otherCostsType === '%' ? itemBaseTotal * (Number(quote.otherCosts || 0) / 100) : Number(quote.otherCosts || 0) * item.quantity;
        
        const itemTotalWithTaxes = itemBaseTotal + otherCostsVal;
        
        const suppBaseTotal = supplierTotalsBase[suppId] || 1;
        const freightRatio = itemBaseTotal / suppBaseTotal;
        const freightTotal = selectedBatch.supplierMeta[suppId]?.totalFreight || 0;
        const allocatedFreight = freightTotal * freightRatio;
        
        const realTotalCost = itemTotalWithTaxes + allocatedFreight;
        const realUnitCost = realTotalCost / item.quantity;

        realCosts[itemId][suppId] = realUnitCost;

        if (realUnitCost < lowestCost) {
          lowestCost = realUnitCost;
          winnerId = suppId;
        }
      });

      if (winnerId) {
        winners[itemId] = { supplierId: winnerId, unitCost: lowestCost };
      }
    });

    return { winners, realCosts, supplierTotalsBase };
  };

  const { winners, realCosts } = useMemo(() => calculateWinners(), [selectedBatch]);

  if (role !== 'tesoureiro' && role !== 'coordenador' && role !== 'adm_area') {
    return <div className="p-8 text-center text-red-500 font-bold">Acesso negado. Apenas coordenadores e tesouraria.</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Map className="w-6 h-6" /> Mapa Cotação de Preços (MCP)
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">Comparativo matriz de fornecedores e cálculo de custo real.</p>
        </div>
      </div>

      {!selectedBatchId ? (
        <>
          {/* TABS */}
          <div className="flex gap-4 border-b border-gray-200 dark:border-[#2a2c30] print:hidden">
            <button 
              onClick={() => setActiveTab('cotacoes')}
              className={`pb-2 font-bold transition-colors ${activeTab === 'cotacoes' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Lotes de Cotação
            </button>
            <button 
              onClick={() => setActiveTab('fornecedores')}
              className={`pb-2 font-bold transition-colors ${activeTab === 'fornecedores' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Base de Fornecedores
            </button>
          </div>

          {activeTab === 'cotacoes' && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={() => setIsNewBatchModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Novo Lote MCP
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {batches.map(batch => (
                  <div key={batch.id} onClick={() => setSelectedBatchId(batch.id)} className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-1 pr-2">{batch.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${batch.status === 'Finalizado' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {batch.status}
                        </span>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if(confirm("Tem certeza que deseja excluir este lote inteiro?")) deleteBatch(batch.id); 
                          }} 
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Criado em {new Date(batch.createdAt).toLocaleDateString()}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 dark:border-[#2a2c30] pt-3">
                      <span>{Object.keys(batch.items || {}).length} Itens</span>
                      <span>{Object.keys(batch.supplierMeta || {}).length} Fornecedores</span>
                    </div>
                  </div>
                ))}
                {batches.length === 0 && <div className="col-span-full py-10 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-xl">Nenhum lote de cotação aberto.</div>}
              </div>
            </div>
          )}

          {activeTab === 'fornecedores' && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={() => setIsNewSupplierModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Cadastrar Fornecedor
                </button>
              </div>
              <div className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-[#151618] border-b border-gray-200 dark:border-[#2a2c30] text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="p-4 font-bold">Fornecedor</th>
                      <th className="p-4 font-bold">CNPJ/CPF</th>
                      <th className="p-4 font-bold">Telefone</th>
                      <th className="p-4 font-bold">Pedido Mín.</th>
                      <th className="p-4 text-center font-bold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#2a2c30]">
                    {suppliers.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-[#2a2c30]/50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-500"/> {s.name}</p>
                          <p className="text-xs text-gray-400 mt-1">{s.address.city} - {s.address.neighborhood}</p>
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">{s.document || '-'}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">{s.phone || '-'}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">{s.minOrder || '-'}</td>
                        <td className="p-4 text-center">
                          <button onClick={() => {if(confirm("Excluir?")) deleteSupplier(s.id)}} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))}
                    {suppliers.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">Nenhum fornecedor cadastrado.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : selectedBatch && (
        <div className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-xl overflow-hidden shadow-sm print:shadow-none print:border-none">
          {/* TOPO DO BATCH */}
          <div className="p-6 border-b border-gray-200 dark:border-[#2a2c30] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 dark:bg-[#151618] print:bg-white">
            <div className="flex items-center gap-4 print:hidden w-full md:w-auto">
              <button onClick={() => setSelectedBatchId(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedBatch.name}</h2>
                <span className="text-xs text-gray-500">Gestão do Mapa de Cotação</span>
              </div>
            </div>
            
            {/* View para Impressão PDF */}
            <div className="hidden print:block text-center w-full">
              <h1 className="text-2xl font-bold text-black uppercase">MAPA DE COTAÇÃO - RESULTADO</h1>
              <h2 className="text-lg text-gray-600">{selectedBatch.name}</h2>
              <p className="text-xs text-gray-500 mt-2">Documento gerado pelo sistema para auxiliar na tomada de decisão de compras.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 print:hidden w-full md:w-auto">
              <button onClick={() => window.print()} className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                <Printer className="w-4 h-4" /> Exportar PDF Vencedores
              </button>
              {selectedBatch.status === 'Aberto' && (
                <button onClick={() => updateBatchStatus(selectedBatch.id, 'Finalizado')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Finalizar Cotação
                </button>
              )}
              <button onClick={() => { if(confirm("Deseja realmente excluir este lote inteiro?")) { deleteBatch(selectedBatch.id); setSelectedBatchId(null); } }} className="bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            </div>
          </div>

          <div className="p-6">
            
            {/* PDF WINNERS VIEW (Only visible in Print) */}
            <div className="hidden print:block space-y-6">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border border-gray-300 p-2">Item</th>
                    <th className="border border-gray-300 p-2">Qtd</th>
                    <th className="border border-gray-300 p-2">Fornecedor Vencedor</th>
                    <th className="border border-gray-300 p-2 text-right">Custo Unitário Real</th>
                    <th className="border border-gray-300 p-2 text-right">Custo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selectedBatch.items || {}).map(([itemId, item]) => {
                    const winner = winners[itemId];
                    if (!winner) return null;
                    const suppName = suppliers.find(s => s.id === winner.supplierId)?.name || 'Desconhecido';
                    const totalCusto = winner.unitCost * item.quantity;
                    return (
                      <tr key={itemId}>
                        <td className="border border-gray-300 p-2 font-bold">{item.name} <br/><span className="text-xs font-normal text-gray-500">{item.description}</span></td>
                        <td className="border border-gray-300 p-2">{item.quantity}</td>
                        <td className="border border-gray-300 p-2 text-emerald-700 font-bold">{suppName}</td>
                        <td className="border border-gray-300 p-2 text-right">{formatCurrency(winner.unitCost)}</td>
                        <td className="border border-gray-300 p-2 text-right font-bold">{formatCurrency(totalCusto)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-xs text-gray-500 mt-10 text-center">
                <p>O custo real unitário exibido acima já contempla o Preço Base + ICMS/IPI/PIS/COFINS e o Rateio Proporcional do Frete do fornecedor.</p>
              </div>
            </div>

            {/* SCREEN VIEW (Hidden in Print) */}
            <div className="print:hidden space-y-8">
              
              {/* ADICIONAR FORNECEDORES NA COTAÇÃO */}
              <div className="bg-gray-50 dark:bg-[#151618] p-4 rounded-xl border border-gray-200 dark:border-[#2a2c30]">
                <h3 className="text-sm font-bold uppercase mb-4 text-gray-600 dark:text-gray-400">1. Fornecedores Participantes</h3>
                <div className="flex gap-2 mb-4">
                  <select value={selectedSupplierToAdd} onChange={e => setSelectedSupplierToAdd(e.target.value)} className="p-2 border border-gray-300 dark:border-[#2a2c30] rounded-lg bg-white dark:bg-[#1e2023] flex-1">
                    <option value="">Selecione um fornecedor da base...</option>
                    {suppliers.filter(s => !selectedBatch.supplierMeta[s.id]).map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Min: {s.minOrder || '-'})</option>
                    ))}
                  </select>
                  <button onClick={() => { if(selectedSupplierToAdd) addSupplierToBatch(selectedBatch.id, selectedSupplierToAdd, 0, '') }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm">Vincular</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(selectedBatch.supplierMeta || {}).map(([suppId, meta]) => {
                    const supp = suppliers.find(s => s.id === suppId);
                    if(!supp) return null;
                    return (
                      <div key={suppId} className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] p-3 rounded-lg flex flex-col gap-2 relative">
                        <button onClick={() => removeSupplierFromBatch(selectedBatch.id, suppId)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                        <h4 className="font-bold text-gray-900 dark:text-white pr-6">{supp.name}</h4>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Frete R$</span>
                            <input type="number" value={meta.totalFreight || 0} onChange={e => addSupplierToBatch(selectedBatch.id, suppId, Number(e.target.value), meta.deliveryTime)} className="w-20 p-1 text-right border border-gray-300 dark:border-[#2a2c30] rounded bg-gray-50 dark:bg-[#151618]" />
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Prazo</span>
                            <input type="text" placeholder="Ex: 5 dias" value={meta.deliveryTime || ''} onChange={e => addSupplierToBatch(selectedBatch.id, suppId, meta.totalFreight, e.target.value)} className="w-20 p-1 text-right border border-gray-300 dark:border-[#2a2c30] rounded bg-gray-50 dark:bg-[#151618]" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ADICIONAR ITENS */}
              <div className="bg-gray-50 dark:bg-[#151618] p-4 rounded-xl border border-gray-200 dark:border-[#2a2c30]">
                <h3 className="text-sm font-bold uppercase mb-4 text-gray-600 dark:text-gray-400">2. Itens da Cotação</h3>
                <div className="flex flex-col md:flex-row gap-2 mb-4">
                  <input placeholder="Nome do Item (Ex: Cerveja)" value={newItemData.name} onChange={e => setNewItemData({...newItemData, name: e.target.value})} className="p-2 border border-gray-300 dark:border-[#2a2c30] rounded-lg bg-white dark:bg-[#1e2023] flex-1" />
                  <input placeholder="Descrição/Marca" value={newItemData.description} onChange={e => setNewItemData({...newItemData, description: e.target.value})} className="p-2 border border-gray-300 dark:border-[#2a2c30] rounded-lg bg-white dark:bg-[#1e2023] flex-1" />
                  <input type="number" placeholder="Qtd" value={newItemData.quantity || ''} onChange={e => setNewItemData({...newItemData, quantity: Number(e.target.value)})} className="p-2 border border-gray-300 dark:border-[#2a2c30] rounded-lg bg-white dark:bg-[#1e2023] w-24" />
                  <button onClick={() => { if(newItemData.name) { addItemToBatch(selectedBatch.id, newItemData); setNewItemData({name:'', description:'', quantity:1}); } }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm">Adicionar</button>
                </div>

                {/* MATRIZ */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300">
                        <th className="p-3 border border-gray-300 dark:border-[#2a2c30] w-[250px] min-w-[250px]">Item</th>
                        {Object.keys(selectedBatch.supplierMeta || {}).map(suppId => {
                          const supp = suppliers.find(s => s.id === suppId);
                          return <th key={suppId} className="p-3 border border-gray-300 dark:border-[#2a2c30] text-center min-w-[200px]">{supp?.name}</th>
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedBatch.items || {}).map(([itemId, item]) => (
                        <tr key={itemId} className="bg-white dark:bg-[#1e2023]">
                          <td className="p-3 border border-gray-300 dark:border-[#2a2c30] align-top">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                                <p className="text-[10px] text-gray-500">{item.description}</p>
                                <p className="text-xs font-bold text-indigo-500 mt-1">Qtd: {item.quantity}</p>
                              </div>
                              <button onClick={() => removeItemFromBatch(selectedBatch.id, itemId)} className="text-red-400"><Trash2 className="w-3 h-3"/></button>
                            </div>
                          </td>
                          
                          {Object.keys(selectedBatch.supplierMeta || {}).map(suppId => {
                            const quote = (item.quotes || {})[suppId] || { basePrice: 0, minQuantity: 0, otherCosts: 0, otherCostsType: '%' };
                            const isWinner = winners[itemId]?.supplierId === suppId;
                            const handleUpdate = (field: string, val: string | number) => {
                              saveQuote(selectedBatch.id, itemId, suppId, { ...quote, [field]: val });
                            };

                            return (
                              <td key={suppId} className={`p-2 border border-gray-300 dark:border-[#2a2c30] align-top ${isWinner ? 'bg-emerald-50 dark:bg-emerald-900/10 shadow-[inset_0_0_0_2px_#10b981]' : ''}`}>
                                {isWinner && <div className="text-[10px] text-emerald-600 font-bold uppercase text-center mb-1 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3"/> Vencedor</div>}
                                <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
                                  <div className="flex flex-col">
                                    <span className="text-gray-500">Base Unit. (R$)</span>
                                    <input type="number" step="0.01" value={quote.basePrice || ''} onChange={e => handleUpdate('basePrice', Number(e.target.value))} className="p-1 border border-gray-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-gray-500">Qtd Mínima</span>
                                    <input type="number" value={quote.minQuantity || ''} onChange={e => handleUpdate('minQuantity', Number(e.target.value))} className="p-1 border border-gray-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800" />
                                  </div>
                                  <div className="flex flex-col col-span-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-500">Outros Custos</span>
                                      <button onClick={() => handleUpdate('otherCostsType', quote.otherCostsType === '%' ? 'R$' : '%')} className="text-indigo-500 font-bold hover:bg-gray-100 rounded px-1">{quote.otherCostsType || '%'}</button>
                                    </div>
                                    <input type="number" step="0.01" value={quote.otherCosts || ''} onChange={e => handleUpdate('otherCosts', Number(e.target.value))} className="p-1 border border-gray-200 dark:border-zinc-700 rounded bg-transparent" />
                                  </div>
                                </div>
                                <div className="mt-2 text-center pt-2 border-t border-gray-200 dark:border-zinc-700">
                                  <span className="text-[10px] text-gray-500">Custo Real Un:</span><br/>
                                  <span className={`font-bold ${isWinner ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {quote.basePrice > 0 ? (realCosts[itemId]?.[suppId] !== undefined ? formatCurrency(realCosts[itemId][suppId]) : 'Calculando...') : '-'}
                                  </span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO LOTE */}
      <Dialog open={isNewBatchModalOpen} onOpenChange={setIsNewBatchModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#1e2023] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white">
          <DialogHeader><DialogTitle>Criar Novo Lote MCP</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateBatch} className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Nome do Lote</label>
              <input required value={newBatchName} onChange={e => setNewBatchName(e.target.value)} className="w-full mt-1 p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg" placeholder="Ex: Bebidas Festa Junina" />
            </div>
            <DialogFooter><button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg">Criar Lote</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL NOVO FORNECEDOR */}
      <Dialog open={isNewSupplierModalOpen} onOpenChange={setIsNewSupplierModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#1e2023] border-gray-200 dark:border-[#2a2c30] text-gray-900 dark:text-white">
          <DialogHeader><DialogTitle>Cadastrar Fornecedor</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateSupplier} className="space-y-3 mt-4">
            <input required placeholder="Nome Fantasia/Razão Social" value={newSupplierData.name} onChange={e => setNewSupplierData({...newSupplierData, name: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
            <div className="flex gap-2">
              <input placeholder="CNPJ/CPF" value={newSupplierData.document} onChange={e => setNewSupplierData({...newSupplierData, document: e.target.value})} className="w-1/2 p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
              <input placeholder="Telefone" value={newSupplierData.phone} onChange={e => setNewSupplierData({...newSupplierData, phone: e.target.value})} className="w-1/2 p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-500 whitespace-nowrap">Pedido Mínimo:</span>
              <input type="text" required placeholder="Ex: 50 un/item ou R$ 500" value={newSupplierData.minOrder || ''} onChange={e => setNewSupplierData({...newSupplierData, minOrder: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
            </div>
            <div className="border-t border-gray-200 dark:border-zinc-800 pt-3 space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase">Endereço</h4>
              <div className="flex gap-2">
                <input placeholder="Rua/Av" value={newSupplierData.street} onChange={e => setNewSupplierData({...newSupplierData, street: e.target.value})} className="w-2/3 p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
                <input placeholder="Nº" value={newSupplierData.number} onChange={e => setNewSupplierData({...newSupplierData, number: e.target.value})} className="w-1/3 p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
              </div>
              <div className="flex gap-2">
                <input placeholder="Bairro" value={newSupplierData.neighborhood} onChange={e => setNewSupplierData({...newSupplierData, neighborhood: e.target.value})} className="w-1/2 p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
                <input placeholder="Cidade" value={newSupplierData.city} onChange={e => setNewSupplierData({...newSupplierData, city: e.target.value})} className="w-1/2 p-2 bg-gray-50 dark:bg-[#121315] border border-gray-300 dark:border-[#2a2c30] rounded-lg text-sm" />
              </div>
            </div>
            <DialogFooter className="pt-2"><button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg">Salvar Fornecedor</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
