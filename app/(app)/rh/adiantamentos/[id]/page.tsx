'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useData, newId } from '@/lib/dataContext'
import { ArrowLeft, User, CheckCircle2, AlertCircle, Clock, Banknote, Calendar, ChevronRight } from 'lucide-react'

// Util function to format money
function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function AdiantamentoDetalhe() {
  const params = useParams()
  const idStr = params.id as string
  const { adiantamentos = [], setAdiantamentos } = useData()
  
  const item = adiantamentos.find(a => a.id === idStr)
  
  const { paid, remaining, progress, pagasCount, totalCount } = useMemo(() => {
    if (!item) return { paid: 0, remaining: 0, progress: 0, pagasCount: 0, totalCount: 0 }
    const _totalCount = item.parcelas.length
    const _pagas = item.parcelas.filter(p => ['paga', 'descontada'].includes(p.status))
    const _paid = _pagas.reduce((acc, curr) => acc + curr.valor, 0)
    const _remaining = item.valorTotal - _paid
    const _progress = _totalCount === 0 ? 0 : Math.round((_pagas.length / _totalCount) * 100)
    return { paid: _paid, remaining: _remaining, progress: _progress, pagasCount: _pagas.length, totalCount: _totalCount }
  }, [item])

  if (!item) {
    return (
      <div className="p-6 text-center text-slate-500">Adiantamento não encontrado.</div>
    )
  }

  // --- ACTIONS ---

  const addLog = (prev: any[], acao: string, obs?: string) => {
    return [...prev, {
      id: newId('L'),
      dataHora: new Date().toISOString(),
      acao,
      usuario: 'Admin Logado',
      observacao: obs
    }]
  }

  const handleAprovar = () => {
    const updated = { ...item, status: 'aprovado' as const, logs: addLog(item.logs, 'Aprovado pelo Gestor') }
    setAdiantamentos(adiantamentos.map(a => a.id === item.id ? updated : a))
  }

  const handleLiberarValor = () => {
    const updated = { 
      ...item, 
      status: 'em_andamento' as const, 
      dataLiberacao: new Date().toISOString().split('T')[0],
      logs: addLog(item.logs, 'Valor Liberado (Transferido)') 
    }
    setAdiantamentos(adiantamentos.map(a => a.id === item.id ? updated : a))
  }

  const handleParcelaAction = (parcelaId: string, action: 'paga' | 'descontada') => {
    const newParcelas = item.parcelas.map(p => {
      if (p.id === parcelaId) {
        return { ...p, status: action, dataPagamento: new Date().toISOString().split('T')[0] }
      }
      return p
    })
    
    // Check if fully paid
    const allPaid = newParcelas.every(p => ['paga', 'descontada'].includes(p.status))
    const newStatus = allPaid ? 'quitado' : (item.status === 'aprovado' || item.status === 'pendente') ? 'em_andamento' : item.status

    const updated = { 
      ...item, 
      parcelas: newParcelas, 
      status: newStatus as any,
      logs: addLog(item.logs, `Parcela ${newParcelas.find(x => x.id === parcelaId)?.numero} marcada como ${action}`) 
    }
    
    setAdiantamentos(adiantamentos.map(a => a.id === item.id ? updated : a))
  }

  // Retorna a cor por status
  const getBadgeSpecs = (status: string) => {
    switch (status) {
      case 'quitado': return { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'Quitado' }
      case 'em_andamento': return { color: 'bg-blue-100 text-blue-800 border-blue-200', text: 'Em Andamento' }
      case 'pendente': return { color: 'bg-amber-100 text-amber-800 border-amber-200', text: 'Pendente' }
      case 'aprovado': return { color: 'bg-cyan-100 text-cyan-800 border-cyan-200', text: 'Aprovado' }
      case 'vencido': return { color: 'bg-rose-100 text-rose-800 border-rose-200', text: 'Vencido' }
      case 'cancelado': return { color: 'bg-slate-100 text-slate-800 border-slate-200', text: 'Cancelado' }
      default: return { color: 'bg-slate-100 text-slate-800 border-slate-200', text: status }
    }
  }

  const badge = getBadgeSpecs(item.status)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', paddingBottom: 60 }}>
      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: 24, alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/rh/adiantamentos" className="btn btn-ghost btn-icon" style={{ background: 'hsl(var(--bg-elevated))', flexShrink: 0 }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <nav className="flex items-center space-x-2 text-sm text-slate-500 mb-1">
              <Link href="/rh/adiantamentos" className="hover:text-blue-600">Adiantamentos</Link>
              <span>/</span>
              <span className="text-slate-900 font-medium tracking-tight">{item.id}</span>
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
               <h1 className="page-title" style={{ fontSize: 24, margin: 0, lineHeight: 1 }}>Detalhes do Contrato</h1>
               <span className={`px-2 py-0.5 rounded-full text-xs font-bold border capitalize shadow-sm ${badge.color}`}>{badge.text}</span>
            </div>
          </div>
        </div>
        
        {/* ACTIONS RIGHT */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
           {item.status === 'pendente' && (
             <button onClick={handleAprovar} className="btn bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border-0 font-semibold gap-2 items-center flex">
               <CheckCircle2 size={16} /> Aprovar
             </button>
           )}
           {item.status === 'aprovado' && (
             <button onClick={handleLiberarValor} className="btn bg-blue-600 hover:bg-blue-700 text-white shadow-sm border-0 font-semibold gap-2 items-center flex">
               <Banknote size={16} /> Marcar como Transferido
             </button>
           )}
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }}>
        {/* COLUNA ESQUERDA - DETALHES (Span 2) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* CARD 360 */}
            <div className="card shadow-sm overflow-hidden" style={{ borderRadius: 16 }}>
               {/* Head Profile */}
               <div style={{ padding: 24, position: 'relative' }}>
                 <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-transparent"></div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative', zIndex: 10 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', border: '4px solid #fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', background: '#dbeafe', color: '#1e40af', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {item.funcionarioNome.substring(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0, lineHeight: 1.2 }}>{item.funcionarioNome}</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', fontSize: 13, color: '#64748b', gap: '8px 12px', marginTop: 8, fontWeight: 500 }}>
                         <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={14}/> Cód. {item.matricula}</span>
                         <span style={{ color: '#cbd5e1' }}>•</span>
                         <span>{item.cargo} ({item.setor})</span>
                         <span style={{ color: '#cbd5e1' }}>•</span>
                         <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>{item.unidade}</span>
                      </div>
                    </div>
                 </div>
               </div>

               {/* Financial Metodics */}
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <div style={{ padding: 16, borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Solicitado</span>
                     <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{formatMoney(item.valorTotal)}</span>
                  </div>
                  <div style={{ padding: 16, borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amortizado</span>
                     <span style={{ fontSize: 18, fontWeight: 800, color: '#059669', marginTop: 4 }}>{formatMoney(paid)}</span>
                  </div>
                  <div style={{ padding: 16, borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo Devedor</span>
                     <span style={{ fontSize: 18, fontWeight: 800, color: '#e11d48', marginTop: 4 }}>{formatMoney(remaining)}</span>
                  </div>
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estratégia</span>
                     <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginTop: 4, textTransform: 'capitalize', background: '#fff', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: 6, alignSelf: 'flex-start' }}>
                       {item.formaQuitacao.replace('_', ' ')}
                     </span>
                  </div>
               </div>

               {/* Progression Bar */}
               <div style={{ padding: 24, borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                     <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Progresso de Quitação ({pagasCount}/{totalCount})</span>
                     <span style={{ fontSize: 18, fontWeight: 800, color: '#2563eb' }}>{progress}%</span>
                  </div>
                  <div style={{ width: '100%', background: '#f1f5f9', height: 12, borderRadius: 999, overflow: 'hidden', boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)' }}>
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${progress === 100 ? 'from-emerald-400 to-emerald-500' : 'from-blue-400 to-blue-600'}`} 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
               </div>
            </div>

            {/* TABELA DE PARCELAS */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
               <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <Calendar size={18} className="text-blue-600" /> Cronograma de Parcelas
                 </h3>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                        <th className="p-4 font-semibold whitespace-nowrap w-24 text-center">Nº</th>
                        <th className="p-4 font-semibold whitespace-nowrap">Vencimento</th>
                        <th className="p-4 font-semibold whitespace-nowrap">Valor</th>
                        <th className="p-4 font-semibold whitespace-nowrap">Status</th>
                        <th className="p-4 font-semibold whitespace-nowrap text-right">Ação Rápida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {item.parcelas.map(p => {
                         const isPaid = p.status === 'paga' || p.status === 'descontada'
                         return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-center">
                               <span className="w-8 h-8 rounded bg-slate-100 text-slate-600 font-bold inline-flex items-center justify-center">
                                 {p.numero}/{item.quantidadeParcelas}
                               </span>
                            </td>
                            <td className="p-4 font-medium text-slate-700">
                               {new Date(p.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-4 font-bold text-slate-800">
                               {formatMoney(p.valor)}
                            </td>
                            <td className="p-4">
                               {isPaid ? (
                                 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                    <CheckCircle2 size={12} /> {p.status.toUpperCase()}
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                    <Clock size={12} /> {p.status.toUpperCase()}
                                 </span>
                               )}
                            </td>
                            <td className="p-4 text-right">
                               {!isPaid ? (
                                 <div className="flex justify-end gap-2">
                                     {p.formaQuitacao === 'desconto_folha' || p.formaQuitacao === 'misto' ? (
                                       <button onClick={() => handleParcelaAction(p.id, 'descontada')} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg transition-colors">
                                         Descontar (Folha)
                                       </button>
                                     ) : null}
                                     <button onClick={() => handleParcelaAction(p.id, 'paga')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors">
                                       Baixar (Caixa)
                                     </button>
                                 </div>
                               ) : (
                                 <span className="text-xs font-medium text-emerald-600">Liquidada em {new Date(p.dataPagamento! + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span>
                               )}
                            </td>
                          </tr>
                         )
                      })}
                    </tbody>
                 </table>
               </div>
            </div>

        </div>

            {/* COLUNA DIREITA - TIMELINE E INFO (Span 1) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* INFO EXTRA */}
            <div className="card shadow-sm" style={{ padding: 20, borderRadius: 16 }}>
                <h3 style={{ fontWeight: 800, color: '#1e293b', fontSize: 13, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dados Adicionais</h3>
                
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs font-semibold mb-0.5">Tipo do Lançamento</p>
                    <p className="font-medium text-slate-800 capitalize">{item.tipoLancamento.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-semibold mb-0.5">Competência Ref.</p>
                    <p className="font-medium text-slate-800">{item.competenciaRef}</p>
                  </div>
                  {item.motivo && (
                    <div>
                      <p className="text-slate-500 text-xs font-semibold mb-0.5">Motivo (Justificativa)</p>
                      <p className="font-medium text-slate-800">{item.motivo}</p>
                    </div>
                  )}
                  {item.aprovador && (
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-slate-500 text-xs font-semibold mb-0.5 uppercase">Audit Trail</p>
                      <p className="font-medium text-slate-600 text-xs">Aprovado por: {item.aprovador}</p>
                      <p className="font-medium text-slate-600 text-xs">Data: {new Date(item.dataAprovacao!).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                </div>
            </div>

            {/* TIMELINE DE AUDITORIA */}
            <div className="card shadow-sm" style={{ padding: 20, borderRadius: 16 }}>
                <h3 style={{ fontWeight: 800, color: '#1e293b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                  <Clock size={16} style={{ color: '#94a3b8' }} /> Timeline de Eventos
                </h3>

                <div style={{ position: 'relative', borderLeft: '2px solid #f1f5f9', marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {[...item.logs].reverse().map((log, index) => (
                     <div key={log.id} style={{ position: 'relative', paddingLeft: 24 }}>
                       <span style={{ position: 'absolute', left: -5, top: 4, width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 0 4px #fff' }}></span>
                       <p className="font-semibold text-slate-800 text-sm leading-tight">{log.acao}</p>
                       <div className="flex gap-2 items-center text-xs text-slate-500 mt-1 font-medium">
                         <span>{new Date(log.dataHora).toLocaleString('pt-BR')}</span>
                         <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                         <span>{log.usuario}</span>
                       </div>
                       {log.observacao && (
                         <div className="mt-2 bg-slate-50 border border-slate-100 p-2 rounded text-xs text-slate-600">
                            {log.observacao}
                         </div>
                       )}
                     </div>
                  ))}
                </div>
            </div>
            
        </div>

      </div>
    </div>
  )
}
