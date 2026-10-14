"use client";
import { useState, useMemo } from "react";
import { useProcessedOrders } from "@/hooks/useProcessedOrders";
import { useAuth } from "@/contexts/AuthContext";
import { Receipt, TrendingUp, DollarSign, Package, Users, ChevronDown, ChevronUp, Trash2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function HistoricoPedidosPage() {
  const { role } = useAuth();
  const { orders, loading, deleteProcessedOrder } = useProcessedOrders();
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [expandedBuyers, setExpandedBuyers] = useState<Record<string, string[]>>({}); // Record<batchId, nomeComprador[]>

  const formatCurrency = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const toggleBatch = (id: string) => {
    setExpandedBatchId(prev => prev === id ? null : id);
  };

  const toggleBuyer = (batchId: string, nome: string) => {
    setExpandedBuyers(prev => {
      const current = prev[batchId] || [];
      if (current.includes(nome)) {
        return { ...prev, [batchId]: current.filter(n => n !== nome) };
      } else {
        return { ...prev, [batchId]: [...current, nome] };
      }
    });
  };

  // Process data for the AreaChart
  const chartData = useMemo(() => {
    // Reverse so the oldest is on the left and newest on the right for evolution
    const sorted = [...orders].reverse();
    return sorted.map(o => ({
      name: o.batchName.substring(0, 15) + (o.batchName.length > 15 ? '...' : ''),
      Faturamento: o.revenue,
      Custo: o.totalCost + o.totalExpenses,
      Lucro: o.profit,
      date: new Date(o.timestamp).toLocaleDateString('pt-BR')
    }));
  }, [orders]);

  const totalHistorico = useMemo(() => {
    return orders.reduce((acc, curr) => {
      acc.revenue += curr.revenue;
      acc.cost += curr.totalCost + curr.totalExpenses;
      acc.profit += curr.profit;
      return acc;
    }, { revenue: 0, cost: 0, profit: 0 });
  }, [orders]);

  if (loading) {
    return <div className="p-6">Carregando histórico...</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-6 h-6" /> Pedidos Processados
        </h1>
        <p className="text-gray-500 dark:text-zinc-400 mt-1">Acompanhe a evolução de faturamento e lucro ao longo de todos os lotes de pedidos.</p>
      </div>

      {orders.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 dark:border-[#2a2c30] rounded-xl p-12 text-center bg-gray-50 dark:bg-[#151618]">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhum lote processado</h3>
          <p className="text-sm text-gray-500 mt-2">Vá na aba "Pedidos", faça o upload de uma planilha do Cheers e processe o primeiro lote para visualizar os gráficos de evolução aqui.</p>
        </div>
      ) : (
        <>
          {/* HEADER SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#1e2023] p-4 rounded-xl border border-gray-200 dark:border-[#2a2c30] shadow-sm flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">Faturamento Histórico Total</span>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalHistorico.revenue)}</div>
            </div>
            <div className="bg-white dark:bg-[#1e2023] p-4 rounded-xl border border-gray-200 dark:border-[#2a2c30] shadow-sm flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-1">Custo + Despesa Total</span>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalHistorico.cost)}</div>
            </div>
            <div className="bg-white dark:bg-[#1e2023] p-4 rounded-xl border border-gray-200 dark:border-[#2a2c30] shadow-sm flex flex-col justify-center border-l-4 border-l-blue-500">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">Lucro Histórico Total</span>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalHistorico.profit)}</div>
            </div>
          </div>

          {/* ÁREA DE GRÁFICO (EVOLUÇÃO DOS LOTES) */}
          <div className="bg-white dark:bg-[#1e2023] p-6 rounded-xl border border-gray-200 dark:border-[#2a2c30] shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> Evolução por Lote (Cascata Contínua)
            </h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2c30" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8a8a8a' }} />
                  <YAxis tickFormatter={(val) => `R$ ${val}`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8a8a8a' }} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e2023', borderColor: '#2a2c30', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#8a8a8a', marginBottom: '4px' }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="Faturamento" stroke="#10b981" fillOpacity={1} fill="url(#colorFaturamento)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Custo" stroke="#f43f5e" fillOpacity={1} fill="url(#colorCusto)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Lucro" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLucro)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* LISTA DE LOTES PROCESSADOS */}
          <div className="space-y-4 mt-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-[#2a2c30] pb-2">Registros de Lotes Processados</h2>
            
            {orders.map((batch) => {
              const isBatchExpanded = expandedBatchId === batch.id;

              return (
                <div key={batch.id} className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-xl overflow-hidden shadow-sm transition-all duration-300">
                  {/* BATCH HEADER */}
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2c30]/50"
                    onClick={() => toggleBatch(batch.id)}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900 dark:text-white text-lg">{batch.batchName}</span>
                        <span className="text-xs bg-gray-100 dark:bg-zinc-800 text-gray-500 px-2 py-1 rounded border border-gray-200 dark:border-zinc-700">
                          Processado em {new Date(batch.timestamp).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 mt-1">Resp: {batch.createdByEmail}</span>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden md:flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-emerald-500">Faturamento</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(batch.revenue)}</span>
                      </div>
                      <div className="hidden md:flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-blue-500">Lucro</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(batch.profit)}</span>
                      </div>
                      <div className="text-gray-400 flex items-center gap-4">
                        {role === "tesoureiro" && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if(confirm("Excluir histórico deste lote definitivamente?")) {
                                deleteProcessedOrder(batch.id);
                              }
                            }}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-500 rounded-lg transition-colors"
                            title="Deletar Histórico"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {isBatchExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* BATCH CONTENT */}
                  {isBatchExpanded && (
                    <div className="p-4 border-t border-gray-100 dark:border-[#2a2c30]/50 bg-gray-50/50 dark:bg-[#151618]">
                      
                      {/* Botão Enviar ao Caixa */}
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Detalhes Financeiros</h3>
                        {(role === 'tesoureiro' || role === 'coordenador') && (
                          batch.sentToCaixa ? (
                            <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold">
                              <CheckCircle2 className="w-4 h-4" /> Lote Enviado ao Caixa
                            </span>
                          ) : (
                            <Link href="/caixa" className="flex items-center gap-1 bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-bold">
                              Conciliar entradas e saídas brutas no Caixa
                            </Link>
                          )
                        )}
                      </div>

                      {/* Sub-Header / Metrics do Lote */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white dark:bg-[#1e2023] p-3 rounded-lg border border-gray-200 dark:border-[#2a2c30]">
                          <span className="text-[10px] font-bold uppercase text-emerald-500">Faturamento Real</span>
                          <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(batch.revenue)}</p>
                        </div>
                        <div className="bg-white dark:bg-[#1e2023] p-3 rounded-lg border border-gray-200 dark:border-[#2a2c30]">
                          <span className="text-[10px] font-bold uppercase text-rose-500">Custo Produtos</span>
                          <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(batch.totalCost)}</p>
                        </div>
                        <div className="bg-white dark:bg-[#1e2023] p-3 rounded-lg border border-gray-200 dark:border-[#2a2c30]">
                          <span className="text-[10px] font-bold uppercase text-amber-500">Despesas / Frete</span>
                          <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(batch.totalExpenses)}</p>
                        </div>
                        <div className="bg-white dark:bg-[#1e2023] p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/10">
                          <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Lucro Final</span>
                          <p className="font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(batch.profit)}</p>
                        </div>
                      </div>

                      {/* Itens Demanda */}
                      <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Resumo de Produtos Vendidos</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
                        {batch.items?.map((item, idx) => (
                          <div key={idx} className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] p-2 rounded text-xs flex justify-between items-center">
                            <span className="font-medium text-gray-700 dark:text-gray-300 truncate mr-2" title={item.name}>{item.name}</span>
                            <span className="bg-gray-100 dark:bg-zinc-800 px-2 rounded font-bold">{item.value}x</span>
                          </div>
                        ))}
                      </div>

                      {/* Lista de Compradores (Acordeão) */}
                      <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Compradores Originais da Planilha</h3>
                      <div className="space-y-2">
                        {batch.buyers && Object.entries(batch.buyers).map(([nome, compras]) => {
                          const isBuyerExpanded = (expandedBuyers[batch.id] || []).includes(nome);
                          const valorTotal = formatCurrency(compras[0]['Valor Total do Pedido']);
                          const pedidosIds = Array.from(new Set(compras.map((p: any) => p['# Pedido']))).join(', ');

                          return (
                            <div key={nome} className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-lg overflow-hidden">
                              <div 
                                className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2c30]/50"
                                onClick={() => toggleBuyer(batch.id, nome)}
                              >
                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                                  <span className="font-medium text-sm text-gray-900 dark:text-white">{nome}</span>
                                  <span className="text-xs text-gray-500">Pedido: {pedidosIds}</span>
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{valorTotal}</span>
                                </div>
                                <div className="text-gray-400">
                                  {isBuyerExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>

                              {isBuyerExpanded && (
                                <div className="p-3 border-t border-gray-100 dark:border-[#2a2c30]/50 bg-gray-50 dark:bg-[#151618]">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 text-xs">
                                    <div>
                                      <p><strong className="text-gray-600 dark:text-gray-400">CPF:</strong> {compras[0]['CPF']}</p>
                                      <p><strong className="text-gray-600 dark:text-gray-400">E-mail:</strong> {compras[0]['Email']}</p>
                                      <p><strong className="text-gray-600 dark:text-gray-400">Telefone:</strong> {compras[0]['Telefone']}</p>
                                    </div>
                                    <div>
                                      <p><strong className="text-gray-600 dark:text-gray-400">Vendedor:</strong> {compras[0]['Vendedor']}</p>
                                      <p><strong className="text-gray-600 dark:text-gray-400">Pagamento:</strong> {compras[0]['Tipo de Pagamento']}</p>
                                      <p><strong className="text-gray-600 dark:text-gray-400">Pendente:</strong> {formatCurrency(compras[0]['Valor pendente do Pedido'])}</p>
                                    </div>
                                  </div>

                                  <table className="w-full text-xs text-left border border-gray-200 dark:border-[#2a2c30]">
                                    <thead className="bg-gray-100 dark:bg-[#2a2c30]">
                                      <tr>
                                        <th className="p-2">Produto</th>
                                        <th className="p-2">Modelo</th>
                                        <th className="p-2 text-right">Valor</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {compras.map((p: any, idx: number) => (
                                        <tr key={idx} className="border-t border-gray-200 dark:border-[#2a2c30]">
                                          <td className="p-2 text-gray-900 dark:text-white">{p['Produto']}</td>
                                          <td className="p-2 text-gray-500">{p['Modelo']}</td>
                                          <td className="p-2 text-right font-medium text-gray-600 dark:text-gray-300">{formatCurrency(p['Valor produto'])}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
