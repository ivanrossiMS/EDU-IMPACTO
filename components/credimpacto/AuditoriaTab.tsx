'use client'

import React, { useState, useEffect } from 'react'
import { ShieldAlert, Search, RefreshCw, Eye, History, Clock, User, Globe } from 'lucide-react'
import { CredImpactoAuditLog } from '@/types/credimpacto'
import { toast } from 'sonner'

export function AuditoriaTab() {
  const [logs, setLogs] = useState<CredImpactoAuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLog, setSelectedLog] = useState<CredImpactoAuditLog | null>(null)

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/credimpacto/auditoria')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar auditoria')
      setLogs(data)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao buscar logs de auditoria')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const filteredLogs = logs.filter((log) => {
    const q = searchTerm.toLowerCase().trim()
    return (
      !q ||
      log.acao.toLowerCase().includes(q) ||
      log.autorNome.toLowerCase().includes(q) ||
      log.entidadeId.toLowerCase().includes(q) ||
      (log.justificativa && log.justificativa.toLowerCase().includes(q))
    )
  })

  const getAcaoBadge = (acao: string) => {
    switch (acao) {
      case 'CRIACAO':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40'
      case 'APROVACAO':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
      case 'RECUSA':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
      case 'CONTRAPROPOSTA':
        return 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40'
      case 'ASSINATURA':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/40'
      case 'LIBERACAO':
        return 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/40'
      case 'CONCILIACAO_FOLHA':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
      case 'ESTORNO_BAIXA':
        return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
      case 'QUITACAO_ANTECIPADA':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
      case 'RESCISAO_CLT':
        return 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40'
      case 'CANCELAMENTO':
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar por ação, responsável, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Atualizar Logs</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Ação</th>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4">Entidade / ID</th>
                <th className="py-3 px-4">Justificativa / Detalhe</th>
                <th className="py-3 px-4 text-center">IP</th>
                <th className="py-3 px-4 text-right">Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${getAcaoBadge(log.acao)}`}>
                        {log.acao}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-900 dark:text-white font-semibold">
                      {log.autorNome}
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-normal">
                        {log.autorPerfil || 'Usuário'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans uppercase block">{log.entidadeTipo}</span>
                      <span className="truncate max-w-[120px] inline-block font-medium">{log.entidadeId}</span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {log.justificativa || '-'}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500 dark:text-slate-400 text-[10px]">
                      {log.ipAddress || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Inspecionar Payload de Auditoria"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE INSPEÇÃO DO LOG */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History size={18} className="text-cyan-600 dark:text-cyan-400" />
                Registro de Auditoria Imutável
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 text-xs font-mono space-y-1.5 border border-slate-200/80 dark:border-slate-700/60">
              <div><strong className="text-slate-500 dark:text-slate-400 font-sans">Ação:</strong> <span className="text-cyan-700 dark:text-cyan-300 font-bold">{selectedLog.acao}</span></div>
              <div><strong className="text-slate-500 dark:text-slate-400 font-sans">Autor:</strong> <span className="text-slate-900 dark:text-white">{selectedLog.autorNome}</span> (ID: {selectedLog.autorId})</div>
              <div><strong className="text-slate-500 dark:text-slate-400 font-sans">Data/Hora:</strong> <span className="text-slate-700 dark:text-slate-300">{new Date(selectedLog.createdAt).toISOString()}</span></div>
              <div><strong className="text-slate-500 dark:text-slate-400 font-sans">IP / Agente:</strong> <span className="text-slate-700 dark:text-slate-300">{selectedLog.ipAddress} • {selectedLog.userAgent}</span></div>
              {selectedLog.justificativa && (
                <div><strong className="text-slate-500 dark:text-slate-400 font-sans">Justificativa:</strong> <span className="text-slate-900 dark:text-white font-medium">{selectedLog.justificativa}</span></div>
              )}
            </div>

            {selectedLog.dadosNovos && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Dados Registrados (Snapshot JSON):
                </label>
                <pre className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] text-emerald-700 dark:text-emerald-400 font-mono overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.dadosNovos, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
