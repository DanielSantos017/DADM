"use client";
import { useState } from "react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { useRoles, UserProfile } from "@/hooks/useRoles";
import { useDeleteRequests, DeleteRequest } from "@/hooks/useDeleteRequests";
import { useCategories } from "@/hooks/useCategories";
import { ShieldAlert, Trash2, Check, X, Shield, Settings, Users, Tags } from "lucide-react";

export default function ConfiguracoesPage() {
  const { role } = useAuth();
  const { users, loading: loadingUsers, changeUserRole, deleteUserRecord } = useRoles();
  const { requests, loading: loadingReqs, approveRequest, removeRequest } = useDeleteRequests();
  const { categories: cxCategories, loading: loadingCxCat, deleteCategory: deleteCxCat, addCategory: addCxCat } = useCategories("caixa");
  const { categories: estCategories, loading: loadingEstCat, deleteCategory: deleteEstCat, addCategory: addEstCat } = useCategories("estoque");

  const [activeTab, setActiveTab] = useState<"usuarios" | "auditoria" | "categorias">("usuarios");

  if (role !== "tesoureiro") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acesso Negado</h1>
        <p className="text-gray-500 dark:text-[#8a8a8a]">Apenas o Tesoureiro Mestre possui acesso ao painel de configurações.</p>
      </div>
    );
  }

  const pendingUsers = users.filter(u => u.role === "pendente");
  const activeUsers = users.filter(u => u.role !== "pendente");

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Settings className="w-6 h-6" /> Configurações Gerais
        </h1>
        <p className="text-gray-500 dark:text-[#8a8a8a] mt-1">Gerencie usuários, permissões, auditoria e categorias do sistema.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-4 border-b border-gray-200 dark:border-[#2a2c30]">
        <button 
          onClick={() => setActiveTab("usuarios")}
          className={`pb-3 text-sm font-bold tracking-widest uppercase transition-colors border-b-2 ${activeTab === "usuarios" ? "border-gray-900 text-gray-900 dark:border-white dark:text-white" : "border-transparent text-gray-400 dark:text-[#4c4e51] hover:text-gray-500 dark:hover:text-[#8a8a8a]"}`}
        >
          <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Usuários</div>
        </button>
        <button 
          onClick={() => setActiveTab("auditoria")}
          className={`pb-3 text-sm font-bold tracking-widest uppercase transition-colors border-b-2 ${activeTab === "auditoria" ? "border-gray-900 text-gray-900 dark:border-white dark:text-white" : "border-transparent text-gray-400 dark:text-[#4c4e51] hover:text-gray-500 dark:hover:text-[#8a8a8a]"}`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> 
            Auditoria / Exclusões
            {requests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{requests.length}</span>}
          </div>
        </button>
        <button 
          onClick={() => setActiveTab("categorias")}
          className={`pb-3 text-sm font-bold tracking-widest uppercase transition-colors border-b-2 ${activeTab === "categorias" ? "border-gray-900 text-gray-900 dark:border-white dark:text-white" : "border-transparent text-gray-400 dark:text-[#4c4e51] hover:text-gray-500 dark:hover:text-[#8a8a8a]"}`}
        >
          <div className="flex items-center gap-2"><Tags className="w-4 h-4" /> Categorias</div>
        </button>
      </div>

      {/* Tab Content: Usuários */}
      {activeTab === "usuarios" && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Pendentes */}
          <div className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-[#2a2c30]/50 p-4 border-b border-gray-200 dark:border-[#2a2c30] flex justify-between items-center">
              <div>
                <h3 className="text-gray-900 dark:text-white font-medium">Fila de Aprovação ({pendingUsers.length})</h3>
                <p className="text-[11px] text-gray-500 dark:text-[#8a8a8a]">Usuários que tentaram acessar o sistema e aguardam liberação.</p>
              </div>
            </div>
            <div className="p-0 overflow-x-auto w-full">
              {pendingUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-400 dark:text-[#4c4e51] text-sm">Nenhuma solicitação pendente.</div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] uppercase text-gray-500 dark:text-[#8a8a8a] bg-gray-50 dark:bg-[#121315]">
                    <tr>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map(user => (
                      <tr key={user.id} className="border-b border-gray-200 dark:border-[#2a2c30]">
                        <td className="px-6 py-4 text-gray-900 dark:text-white">{user.email}</td>
                        <td className="px-6 py-4 flex gap-2 justify-end">
                          <button onClick={() => changeUserRole(user.id, user.email, "usuario")} className="flex items-center gap-1 bg-green-600/20 text-green-500 hover:bg-green-600/40 px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
                            <Check className="w-3 h-3" /> Aprovar Acesso
                          </button>
                          <button onClick={() => deleteUserRecord(user.id)} className="flex items-center gap-1 bg-red-600/20 text-red-500 hover:bg-red-600/40 px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
                            <X className="w-3 h-3" /> Recusar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Ativos */}
          <div className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-[#2a2c30]/50 p-4 border-b border-gray-200 dark:border-[#2a2c30]">
              <h3 className="text-gray-900 dark:text-white font-medium">Usuários Ativos ({activeUsers.length})</h3>
              <p className="text-[11px] text-gray-500 dark:text-[#8a8a8a]">Gerencie o nível de acesso da equipe.</p>
            </div>
            <div className="p-0 overflow-x-auto w-full">
              <table className="w-full text-sm text-left min-w-[600px]">
                <thead className="text-[10px] uppercase text-gray-500 dark:text-[#8a8a8a] bg-gray-50 dark:bg-[#121315]">
                  <tr>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Cargo Atual</th>
                    <th className="px-6 py-3 text-right">Alterar Para / Remover</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map(user => (
                    <tr key={user.id} className="border-b border-gray-200 dark:border-[#2a2c30]">
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          user.role === 'tesoureiro' ? 'bg-amber-500/20 text-amber-500' :
                          user.role === 'coordenador' ? 'bg-indigo-500/20 text-indigo-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex gap-3 justify-end items-center">
                        <select 
                          value={user.role || ""} 
                          onChange={(e) => changeUserRole(user.id, user.email, e.target.value as UserRole)}
                          className="bg-gray-50 dark:bg-[#121315] border border-[#4c4e51] text-gray-900 dark:text-white text-xs rounded px-2 py-1 outline-none focus:border-indigo-500"
                        >
                          <option value="usuario">Usuário Comum</option>
                          <option value="usuario_area">Usuário de Projetos</option>
                          <option value="adm_area">Adm de Projetos</option>
                          <option value="coordenador">Coordenador</option>
                          <option value="tesoureiro">Tesoureiro</option>
                        </select>
                        <button onClick={() => { if(confirm("Revogar acesso deste usuário?")) deleteUserRecord(user.id); }} className="text-gray-400 dark:text-[#4c4e51] hover:text-red-500 transition-colors" title="Revogar Acesso">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Auditoria */}
      {activeTab === "auditoria" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-[#2a2c30]/50 p-4 border-b border-gray-200 dark:border-[#2a2c30] flex justify-between items-center">
              <div>
                <h3 className="text-gray-900 dark:text-white font-medium">Pedidos de Exclusão</h3>
                <p className="text-[11px] text-gray-500 dark:text-[#8a8a8a]">Coordenadores não podem excluir dados diretamente. Eles enviam para esta fila.</p>
              </div>
            </div>
            <div className="p-0 overflow-x-auto w-full">
              {requests.length === 0 ? (
                <div className="p-12 text-center text-gray-400 dark:text-[#4c4e51] text-sm flex flex-col items-center">
                  <Shield className="w-12 h-12 mb-4 opacity-20" />
                  Nenhuma exclusão aguardando aprovação. O sistema está seguro.
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] uppercase text-gray-500 dark:text-[#8a8a8a] bg-gray-50 dark:bg-[#121315]">
                    <tr>
                      <th className="px-6 py-3">Origem</th>
                      <th className="px-6 py-3">Item / Descrição</th>
                      <th className="px-6 py-3">Solicitante</th>
                      <th className="px-6 py-3 text-right">Julgamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(req => (
                      <tr key={req.id} className="border-b border-gray-200 dark:border-[#2a2c30]">
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${req.collection === 'caixa' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>
                            {req.collection}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                          {req.itemNameOrDesc}
                          <div className="text-[9px] text-gray-400 dark:text-[#4c4e51] font-mono mt-1">{req.itemId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-900 dark:text-white text-xs">{req.requestedByEmail}</span>
                          <div className="text-[10px] text-gray-400 dark:text-[#4c4e51] mt-0.5">{new Date(req.timestamp).toLocaleString('pt-BR')}</div>
                        </td>
                        <td className="px-6 py-4 flex gap-2 justify-end">
                          {req.collection === "caixa" ? <span className="max-w-48 text-xs text-amber-700 dark:text-amber-300">Caixa imutável: avaliar estorno auditável. A exclusão está bloqueada.</span> :
                            <button onClick={() => { if(confirm("Confirmar a exclusão definitiva deste item do banco de dados?")) void approveRequest(req); }} className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
                              <Trash2 className="w-3 h-3" /> Excluir Item
                            </button>}
                          <button onClick={() => removeRequest(req.id)} className="flex items-center gap-1 bg-gray-200 dark:bg-[#2a2c30] hover:bg-gray-300 dark:hover:bg-[#4c4e51] text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
                            Manter Item
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Categorias */}
      {activeTab === "categorias" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Caixa */}
          <div className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-[#2a2c30]/50 p-4 border-b border-gray-200 dark:border-[#2a2c30]">
              <h3 className="text-gray-900 dark:text-white font-medium text-emerald-400">Categorias de Caixa</h3>
            </div>
            <div className="p-4 space-y-2">
              {cxCategories.map(cat => (
                <div key={cat} className="flex justify-between items-center bg-gray-50 dark:bg-[#121315] border border-gray-200 dark:border-[#2a2c30] px-3 py-2 rounded">
                  <span className="text-sm text-gray-900 dark:text-white">{cat}</span>
                  <button onClick={() => { if(confirm(`Excluir categoria '${cat}'?`)) deleteCxCat(cat); }} className="text-gray-400 dark:text-[#4c4e51] hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="pt-2">
                <button onClick={() => { const val = prompt("Nova Categoria:"); if(val) addCxCat(val); }} className="text-xs font-bold uppercase text-emerald-500 hover:text-emerald-400">
                  + Adicionar Nova
                </button>
              </div>
            </div>
          </div>

          {/* Estoque */}
          <div className="bg-white dark:bg-[#1e2023] border border-gray-200 dark:border-[#2a2c30] rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-[#2a2c30]/50 p-4 border-b border-gray-200 dark:border-[#2a2c30]">
              <h3 className="text-gray-900 dark:text-white font-medium text-blue-400">Categorias de Estoque</h3>
            </div>
            <div className="p-4 space-y-2">
              {estCategories.map(cat => (
                <div key={cat} className="flex justify-between items-center bg-gray-50 dark:bg-[#121315] border border-gray-200 dark:border-[#2a2c30] px-3 py-2 rounded">
                  <span className="text-sm text-gray-900 dark:text-white">{cat}</span>
                  <button onClick={() => { if(confirm(`Excluir categoria '${cat}'?`)) deleteEstCat(cat); }} className="text-gray-400 dark:text-[#4c4e51] hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="pt-2">
                <button onClick={() => { const val = prompt("Nova Categoria:"); if(val) addEstCat(val); }} className="text-xs font-bold uppercase text-blue-500 hover:text-blue-400">
                  + Adicionar Nova
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



