'use client'

import React, { useState, useMemo } from 'react'
import { X, Search, FileDown, TrendingUp, TrendingDown, Clock, ArrowRight } from 'lucide-react'
import { DemonstracaoRawRow } from '@/lib/financialReports'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  rows: DemonstracaoRawRow[]
}

const parseDateDisplay = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'
const parseMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function DemonstracaoDrillDownModal({ isOpen, onClose, title, subtitle, rows }: ModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = useMemo(() => {
    let list = rows
    if (searchTerm) {
      const qs = searchTerm.toLowerCase()
      list = list.filter(r => 
        r.descricao.toLowerCase().includes(qs) || 
        r.alunoResponsavel.toLowerCase().includes(qs) || 
        (r.documento && r.documento.toLowerCase().includes(qs))
      )
    }
    // Sort by type then date
    return list.sort((a,b) => b.dataCompetencia.localeCompare(a.dataCompetencia))
  }, [rows, searchTerm])

  const totalGeral = filtered.reduce((acc, row) => acc + (row.status === 'cancelado' ? 0 : (row.valorPago || row.valorEsperado)), 0)

  // Export CSV
  const exportCSV = () => {
    const header = ['Origem','Tipo','Descrição','Data Comp.','Data Venc.','Data Pgto','Status','Aluno/Fornecedor','Documento','Valor Esperado','Valor Pago']
    const csv = [
      header.join(';'),
      ...filtered.map(r => [
        r.origem, r.tipo, r.descricao, parseDateDisplay(r.dataCompetencia),
        parseDateDisplay(r.dataVencimento), parseDateDisplay(r.dataPagamento),
        r.status, r.alunoResponsavel, r.documento || '',
        r.valorEsperado.toFixed(2).replace('.',','), r.valorPago.toFixed(2).replace('.',',')
      ].map(x => `"${x}"`).join(';'))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `detalhamento_financeiro_${new Date().getTime()}.csv`
    link.click()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white/90 dark:bg-[#111] border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-full animate-in slide-in-from-bottom-4 duration-300"
        style={{ width: '100%', maxWidth: 1200, maxHeight: '90vh' }}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/5 dark:border-white/5 flex items-start justify-between bg-white dark:bg-[#1a1a1a]">
          <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
              {title}
            </h2>
            <p className="text-sm text-black/50 dark:text-white/50 mt-1">{subtitle}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <X size={20} className="text-black/50 dark:text-white/50" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
            <input 
              type="text"
              placeholder="Buscar descrição ou responsável..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-black/50 dark:text-white/50">Total listado:</span>
              <span className="ml-2 font-bold px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                {parseMoney(totalGeral)}
              </span>
            </div>
            <button 
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-sm font-medium rounded-lg transition-colors"
            >
              <FileDown size={16} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto bg-white/50 dark:bg-black/20 p-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-black/40 dark:text-white/40">
              <Search size={48} className="mb-4 opacity-50" />
              <p>Nenhum lançamento encontrado para os filtros.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#141414] overflow-x-auto shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 font-semibold border-b border-black/10 dark:border-white/10">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Descrição</th>
                    <th className="px-4 py-3 whitespace-nowrap">Responsável</th>
                    <th className="px-4 py-3 whitespace-nowrap">Competência</th>
                    <th className="px-4 py-3 whitespace-nowrap">Venc./Pagto</th>
                    <th className="px-4 py-3 whitespace-nowrap text-right">Valor Padrão</th>
                    <th className="px-4 py-3 whitespace-nowrap text-right">Valor Real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {filtered.map(row => (
                    <tr key={row.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-3">
                        <div className={`inline-flex flex-col gap-1`}>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                            row.status === 'pago' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                            row.status === 'pendente' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                            row.status === 'atrasado' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                            'bg-black/10 text-black/60 border-black/10 dark:bg-white/10 dark:text-white/60 dark:border-white/10'
                          }`}>
                            {row.status.toUpperCase()}
                          </span>
                          <span className="text-[10px] uppercase text-black/40 dark:text-white/40 tracking-wider">
                            {row.origem.replace('_',' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            row.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {row.tipo === 'receita' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          </div>
                          <div>
                            <div className="font-medium">{row.descricao}</div>
                            {row.documento && (
                              <div className="text-xs text-black/50 dark:text-white/50 mt-0.5">DOC: {row.documento}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-black/70 dark:text-white/70">
                        {row.alunoResponsavel || '-'}
                      </td>
                      <td className="px-4 py-3 text-black/60 dark:text-white/60">
                        <div className="flex flex-col">
                          <span>{parseDateDisplay(row.dataCompetencia)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-black/60 dark:text-white/60">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-xs"><Clock size={12}/> V: {parseDateDisplay(row.dataVencimento)}</span>
                          {row.dataPagamento && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><ArrowRight size={12}/> P: {parseDateDisplay(row.dataPagamento)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-black/60 dark:text-white/60 line-through decoration-black/20 dark:decoration-white/20 text-xs">
                        {row.status === 'cancelado' ? '-' : parseMoney(row.valorEsperado)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        row.status === 'cancelado' ? 'text-black/30 dark:text-white/30' : 
                        row.tipo === 'receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {parseMoney(row.status === 'cancelado' ? 0 : (row.valorPago || row.valorEsperado))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-white dark:bg-[#1a1a1a] border-t border-black/5 dark:border-white/5 flex items-center justify-between">
          <div className="text-sm text-black/50 dark:text-white/50">
            Mostrando <span className="font-medium text-black dark:text-white">{filtered.length}</span> lançamentos de <span className="font-medium">{rows.length}</span>
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
          >
            Fechar Detalhamento
          </button>
        </div>

      </div>
    </div>
  )
}
