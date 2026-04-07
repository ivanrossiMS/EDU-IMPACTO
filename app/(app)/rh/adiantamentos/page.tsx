'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useData } from '@/lib/dataContext'
import { Plus, Banknote, Search, Filter, CheckCircle2, AlertCircle, Clock, MoreVertical, ArrowRight, Pencil, Trash2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/CrudModal'

// Util function to format money
function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function AdiantamentosPage() {
  const { adiantamentos, setAdiantamentos } = useData()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [confirmId, setConfirmId] = useState<string|null>(null)

  // Derived state cards
  const totalConcedidoAtivo = adiantamentos.filter(a => a.status === 'em_andamento' || a.status === 'aprovado' || a.status === 'pendente').reduce((acc, curr) => acc + curr.valorTotal, 0)
  const totalLiquidado = adiantamentos.filter(a => a.status === 'quitado').reduce((acc, curr) => acc + curr.valorTotal, 0)
  const ativosCount = adiantamentos.filter(a => a.status === 'em_andamento' || a.status === 'aprovado' || a.status === 'pendente').length
  
  // Parcela vencida check:
  const hasVencida = adiantamentos.filter(a => a.parcelas.some(p => p.status === 'vencida')).length

  const filtered = adiantamentos.filter(a => {
    const s = searchTerm.toLowerCase()
    const matchSearch = a.funcionarioNome.toLowerCase().includes(s) || a.matricula.includes(s)
    const matchStatus = statusFilter === 'todos' ? true : a.status === statusFilter
    
    // Filtro de datas pela data de liberaçao (se houver) ou data de criacão do adiantamento
    const refDate = a.dataLiberacao ? a.dataLiberacao.split('T')[0] : a.createdAt.split('T')[0]
    const matchDataInicio = !dataInicio || refDate >= dataInicio
    const matchDataFim = !dataFim || refDate <= dataFim
    
    return matchSearch && matchStatus && matchDataInicio && matchDataFim
  })

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

  const handleDelete = (id: string) => {
    setAdiantamentos(adiantamentos.filter(a => a.id !== id))
    setConfirmId(null)
  }

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <div>
          <nav className="flex items-center space-x-2 text-sm text-slate-500 mb-2">
            <Link href="/" className="hover:text-blue-600 transition-colors">Dashboard</Link>
            <span>/</span>
            <span>Recursos Humanos</span>
            <span>/</span>
            <span className="text-slate-900 font-medium tracking-tight">Adiantamentos</span>
          </nav>
          <h1 className="page-title">Adiantamentos Salariais</h1>
          <p className="page-subtitle">Gestão, concessão e controle de abatimento de empréstimos e adiantamentos.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/rh/adiantamentos/novo" className="btn btn-primary shadow-sm" style={{ fontWeight: 600 }}>
            <Plus size={14} /> Novo Adiantamento
          </Link>
        </div>
      </div>

      {/* DASHBOARD CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="kpi-card group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Banknote size={64} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Ativos Concedidos</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif' }}>
            {formatMoney(totalConcedidoAtivo)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', marginTop: 4 }}>{ativosCount} Em Andamento</div>
        </div>
        
        <div className="kpi-card group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <CheckCircle2 size={64} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Histórico Quitado</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif' }}>
            {formatMoney(totalLiquidado)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#10b981', marginTop: 4 }}>Liquidação Completa</div>
        </div>

        <div className="kpi-card group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <AlertCircle size={64} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
             <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Avisos</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif' }}>
            0
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Tudo em Ordem</div>
        </div>
        
        <div className="kpi-card group" style={{ borderLeft: '4px solid #f87171' }}>
          <div className="absolute top-0 right-0 p-4 text-rose-500 opacity-5 group-hover:opacity-10 transition-opacity">
            <AlertCircle size={64} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
             <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#f87171', textTransform: 'uppercase' }}>Atrasos</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>
            {hasVencida}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginTop: 4 }}>Atenção Requerida</div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              style={{ paddingLeft: 34, height: 36 }}
              placeholder="Buscar por funcionário ou matrícula..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>Ref. de</span>
            <input type="date" className="form-input" style={{ width: 140, height: 36 }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>até</span>
            <input type="date" className="form-input" style={{ width: 140, height: 36 }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <select
            className="form-input"
            style={{ width: 160, height: 36 }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="aprovado">Aprovado</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="quitado">Quitado</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Valor Total</th>
              <th>Liberação</th>
              <th>Status</th>
              <th className="hidden md:table-cell">Progresso Quitação</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                    <div style={{ width: 48, height: 48, background: 'hsl(var(--bg-elevated))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Banknote size={24} style={{ opacity: 0.5 }} />
                    </div>
                    <p style={{ fontSize: 13 }}>Nenhum adiantamento encontrado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(item => {
                const badge = getBadgeSpecs(item.status)
                const pagas = item.parcelas.filter(p => ['paga', 'descontada'].includes(p.status)).length
                const total = item.parcelas.length
                const perc = total === 0 ? 0 : Math.round((pagas / total) * 100)
                
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="avatar" style={{ gap: 0, width: 34, height: 34, fontSize: 12 }}>
                          {item.funcionarioNome.substring(0,2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{item.funcionarioNome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                            Cód. {item.matricula} • {item.cargo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                      {formatMoney(item.valorTotal)}
                    </td>
                    <td style={{ color: 'hsl(var(--text-secondary))' }}>
                      {item.dataLiberacao ? new Date(item.dataLiberacao).toLocaleDateString('pt-BR') : '--'}
                    </td>
                    <td>
                      <span className={`badge ${badge.color}`}>
                         {badge.text}
                      </span>
                    </td>
                    <td className="hidden md:table-cell">
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 140 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
                          <span style={{ color: 'hsl(var(--text-muted))' }}>{pagas} de {total}</span>
                          <span style={{ color: perc === 100 ? '#10b981' : '#3b82f6' }}>{perc}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${perc}%`, background: perc === 100 ? '#10b981' : undefined }}></div>
                        </div>
                       </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex justify-end gap-1">
                        <Link 
                          href={`/rh/adiantamentos/editar/${item.id}`}
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </Link>
                        <button 
                          onClick={() => setConfirmId(item.id)}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: '#f87171' }}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                        <Link 
                          href={`/rh/adiantamentos/${item.id}`}
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Ver Detalhes"
                        >
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && handleDelete(confirmId)}
        title="Excluir Adiantamento"
        message="Atenção: Excluir permanentemente este adiantamento apagará todas as suas parcelas vinculadas e não poderá ser desfeita."
      />
    </div>
  )
}
