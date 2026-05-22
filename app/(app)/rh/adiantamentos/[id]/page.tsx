'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { newId } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { ArrowLeft, User, CheckCircle2, AlertCircle, Clock, Banknote, Calendar, ChevronRight, TrendingDown, Wallet, Shield, FileText, BarChart3 } from 'lucide-react'

// Util function to format money
function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function AdiantamentoDetalhe() {
  const params = useParams()
  const idStr = params.id as string
  const [adiantamentos = [], setAdiantamentos] = useSupabaseArray<any>('rh/adiantamentos', [])
  const [funcionarios = []] = useSupabaseArray<any>('rh/funcionarios')
  
  const item = adiantamentos.find(a => a.id === idStr)
  const func = funcionarios.find(f => f.id === item?.funcionarioId)
  
  const { paid, remaining, progress, pagasCount, totalCount } = useMemo(() => {
    if (!item) return { paid: 0, remaining: 0, progress: 0, pagasCount: 0, totalCount: 0 }
    const _totalCount = item.parcelas.length
    const _pagas = item.parcelas.filter((p: any) => ['paga', 'descontada'].includes(p.status))
    const _paid = _pagas.reduce((acc: number, curr: any) => acc + curr.valor, 0)
    const _remaining = item.valorTotal - _paid
    const _progress = _totalCount === 0 ? 0 : Math.round((_pagas.length / _totalCount) * 100)
    return { paid: _paid, remaining: _remaining, progress: _progress, pagasCount: _pagas.length, totalCount: _totalCount }
  }, [item])

  if (!item) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>Adiantamento não encontrado.</div>
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
    const newParcelas = item.parcelas.map((p: any) => {
      if (p.id === parcelaId) {
        return { ...p, status: action, dataPagamento: new Date().toISOString().split('T')[0] }
      }
      return p
    })
    
    // Check if fully paid
    const allPaid = newParcelas.every((p: any) => ['paga', 'descontada'].includes(p.status))
    const newStatus = allPaid ? 'quitado' : (item.status === 'aprovado' || item.status === 'pendente') ? 'em_andamento' : item.status

    const updated = { 
      ...item, 
      parcelas: newParcelas, 
      status: newStatus as any,
      logs: addLog(item.logs, `Parcela ${newParcelas.find((x: any) => x.id === parcelaId)?.numero} marcada as ${action}`) 
    }
    
    setAdiantamentos(adiantamentos.map(a => a.id === item.id ? updated : a))
  }

  const getBadgeSpecs = (status: string) => {
    switch (status) {
      case 'quitado': return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', text: 'Quitado' }
      case 'em_andamento': return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', text: 'Em Andamento' }
      case 'pendente': return { bg: '#fffbeb', color: '#b45309', border: '#fde68a', text: 'Pendente' }
      case 'aprovado': return { bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc', text: 'Aprovado' }
      case 'vencido': return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', text: 'Vencido' }
      case 'cancelado': return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', text: 'Cancelado' }
      default: return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', text: status }
    }
  }

  const badge = getBadgeSpecs(item.status)

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    padding: '24px',
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '32px 20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', color: '#0f172a' }}>
      
      {/* HEADER */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/rh/adiantamentos" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Link href="/rh/adiantamentos" style={{ color: '#64748b', textDecoration: 'none' }}>Gestão de Adiantamentos</Link>
              <span>/</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.id}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Detalhamento do Contrato</h1>
               <span style={{ padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, border: `1px solid ${badge.border}`, background: badge.bg, color: badge.color, textTransform: 'capitalize' }}>{badge.text}</span>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
           {item.status === 'pendente' && (
             <button onClick={handleAprovar} style={{ height: '40px', padding: '0 16px', background: '#059669', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <CheckCircle2 size={16} /> Aprovar Contrato
             </button>
           )}
           {item.status === 'aprovado' && (
             <button onClick={handleLiberarValor} style={{ height: '40px', padding: '0 16px', background: '#2563eb', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Banknote size={16} /> Marcar como Transferido
             </button>
           )}
           <Link href={`/rh/adiantamentos/editar/${item.id}`} style={{ height: '38px', padding: '0 16px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 700, fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
             Editar
           </Link>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Solicitado</span>
          <p style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{formatMoney(item.valorTotal)}</p>
        </div>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Amortizado</span>
          <p style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#059669' }}>{formatMoney(paid)}</p>
        </div>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo Devedor</span>
          <p style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{formatMoney(remaining)}</p>
        </div>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progresso</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <p style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#2563eb' }}>{progress}%</p>
            <div style={{ flex: 1, background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, background: '#2563eb', height: '100%' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* COLUNA ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* BENEFICIÁRIO */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 700, fontSize: '14px', color: '#475569', textTransform: 'uppercase' }}>
              <User size={16} />
              <span>Beneficiário</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
               <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#dbeafe', color: '#1e40af', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  {item.funcionarioNome.substring(0,2).toUpperCase()}
               </div>
               <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, margin: 0, fontSize: '15px' }}>{item.funcionarioNome}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>{item.cargo} • {item.setor}</p>
               </div>
               {func && (
                 <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Salário Base</p>
                    <p style={{ fontWeight: 700, margin: 0, fontSize: '15px' }}>{formatMoney(func.salario)}</p>
                 </div>
               )}
            </div>
          </div>

          {/* CRONOGRAMA */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 700, fontSize: '14px', color: '#475569', textTransform: 'uppercase' }}>
              <Calendar size={16} />
              <span>Cronograma de Liquidação</span>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>
                    <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>Nº</th>
                    <th style={{ padding: '12px' }}>Vencimento</th>
                    <th style={{ padding: '12px' }}>Valor</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {item.parcelas.map((p: any) => {
                     const isPaid = p.status === 'paga' || p.status === 'descontada'
                     return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                           <span style={{ width: '28px', height: '28px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                             {p.numero}
                           </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 500 }}>
                           {new Date(p.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700 }}>
                           {formatMoney(p.valor)}
                        </td>
                        <td style={{ padding: '12px' }}>
                           {isPaid ? (
                             <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', background: '#ecfdf5', color: '#047857', fontSize: '11px', fontWeight: 700 }}>
                                <CheckCircle2 size={12} /> {p.status.toUpperCase()}
                             </span>
                           ) : (
                             <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700 }}>
                                <Clock size={12} /> {p.status.toUpperCase()}
                             </span>
                           )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                           {!isPaid ? (
                             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                 {p.formaQuitacao === 'desconto_folha' || p.formaQuitacao === 'misto' ? (
                                   <button onClick={() => handleParcelaAction(p.id, 'descontada')} style={{ height: '28px', padding: '0(10px)', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '11px', borderRadius: '4px', border: '1px solid #bfdbfe', cursor: 'pointer' }}>
                                     Descontar
                                   </button>
                                 ) : null}
                                 <button onClick={() => handleParcelaAction(p.id, 'paga')} style={{ height: '28px', padding: '0 10px', background: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '11px', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                                   Baixar
                                 </button>
                             </div>
                           ) : (
                             <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                               <CheckCircle2 size={12} /> Liquidada
                             </span>
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

        {/* COLUNA DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* DADOS */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 700, fontSize: '14px', color: '#475569', textTransform: 'uppercase' }}>
              <FileText size={16} />
              <span>Dados do Contrato</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Tipo:</span>
                <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{item.tipoLancamento.replace('_', ' ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Competência:</span>
                <span style={{ fontWeight: 700 }}>{item.competenciaRef}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Estratégia:</span>
                <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{item.formaQuitacao.replace('_', ' ')}</span>
              </div>
              {item.motivo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: '#64748b' }}>Motivo:</span>
                  <span style={{ background: '#f8fafc', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px' }}>{item.motivo}</span>
                </div>
              )}
            </div>
          </div>

          {/* TIMELINE */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 700, fontSize: '14px', color: '#475569', textTransform: 'uppercase' }}>
              <Clock size={16} />
              <span>Timeline</span>
            </div>
            <div style={{ position: 'relative', borderLeft: '2px solid #f1f5f9', marginLeft: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[...item.logs].reverse().map((log, index) => (
                 <div key={log.id} style={{ position: 'relative', paddingLeft: '20px' }}>
                   <span style={{ position: 'absolute', left: '-5px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', border: '2px solid #fff' }}></span>
                   <p style={{ fontWeight: 700, fontSize: '13px', margin: 0 }}>{log.acao}</p>
                   <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                     <span>{new Date(log.dataHora).toLocaleString('pt-BR')}</span>
                     <span style={{ margin: '0 4px' }}>•</span>
                     <span>{log.usuario}</span>
                   </div>
                 </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
