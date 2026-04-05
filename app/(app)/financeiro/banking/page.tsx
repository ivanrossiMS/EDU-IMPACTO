'use client'

import { useState, useMemo } from 'react'
import { newId } from '@/lib/dataContext'
import { useQuery } from '@tanstack/react-query'
import { Plus, X, Trash2, Search, Filter, ArrowUpRight, ArrowDownLeft, Smartphone, TrendingUp, TrendingDown } from 'lucide-react'

interface Transacao {
  id: string; tipo: 'entrada'|'saida'; descricao: string
  valor: number; metodo: 'PIX'|'TED'|'Debito'|'Credito'|'DOC'; data: string
  categoria: string; status: 'confirmado'|'pendente'
}

const CATEGORIAS_ENT = ['Mensalidade','Matricula','Taxa','Evento','Outros']
const CATEGORIAS_SAI = ['Folha','Fornecedor','Utilidade','Contrato','Imposto','Outros']
const METODOS = ['PIX','TED','Debito','Credito','DOC']

const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
function fmt(d: string) { if (!d) return '-'; const [y, m, dia] = d.split('-'); return `${dia}/${m}/${y}` }
function getToday() { return new Date().toISOString().slice(0, 10) }

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const METODO_COLORS: Record<string, string> = {
  PIX: '#10b981', TED: '#3b82f6', Debito: '#8b5cf6', Credito: '#ec4899', DOC: '#f59e0b',
}

export default function BankingPage() {
  const { data: titulos = [], isLoading } = useQuery<any[]>({
    queryKey: ['titulos'],
    queryFn: async () => {
      const res = await fetch('/api/financeiro/titulos')
      return res.json()
    }
  })

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    descricao: '',
    valor: '',
    metodo: 'PIX' as Transacao['metodo'],
    data: getToday(),
    categoria: 'Mensalidade',
    status: 'confirmado' as 'confirmado' | 'pendente',
  })

  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos'|'entrada'|'saida'>('todos')
  const [filtroMetodo, setFiltroMetodo] = useState('Todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos'|'confirmado'|'pendente'>('todos')
  const [filtroMes, setFiltroMes] = useState('Todos')
  const [showFilters, setShowFilters] = useState(false)

  const pixRecebidos = titulos.filter(t => t.metodo === 'PIX' && t.status === 'pago')
  const totalPixRecebido = pixRecebidos.reduce((s, t) => s + t.valor, 0)

  const filtered = useMemo(() => transacoes.filter(t => {
    const matchTipo = filtroTipo === 'todos' || t.tipo === filtroTipo
    const matchMetodo = filtroMetodo === 'Todos' || t.metodo === filtroMetodo
    const matchStatus = filtroStatus === 'todos' || t.status === filtroStatus
    const matchMes = filtroMes === 'Todos' || t.data.slice(5, 7) === String(MESES.indexOf(filtroMes) + 1).padStart(2, '0')
    const q = search.toLowerCase()
  const searchActive = search.trim().length >= 3
    const matchSearch = !searchActive || (search.trim().length < 3 || (!search || t.descricao.toLowerCase().includes(q) || t.categoria.toLowerCase().includes(q)))
    return matchTipo && matchMetodo && matchStatus && matchMes && matchSearch
  }), [transacoes, filtroTipo, filtroMetodo, filtroStatus, filtroMes, search])

  const totalEntradas = transacoes.filter(t => t.tipo === 'entrada' && t.status === 'confirmado').reduce((s, t) => s + t.valor, 0)
  const totalSaidas = transacoes.filter(t => t.tipo === 'saida' && t.status === 'confirmado').reduce((s, t) => s + t.valor, 0)
  const saldo = totalEntradas - totalSaidas
  const totalPendente = transacoes.filter(t => t.status === 'pendente').reduce((s, t) => s + t.valor, 0)

  const activeFilters = [filtroTipo !== 'todos', filtroMetodo !== 'Todos', filtroStatus !== 'todos', filtroMes !== 'Todos'].filter(Boolean).length
  const clearFilters = () => { setFiltroTipo('todos'); setFiltroMetodo('Todos'); setFiltroStatus('todos'); setFiltroMes('Todos'); setSearch('') }

  function handleSave() {
    if (!form.descricao || !form.valor) return
    setTransacoes(prev => [{
      id: newId('BNK'),
      tipo: form.tipo,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      metodo: form.metodo,
      data: form.data,
      categoria: form.categoria || 'Outros',
      status: form.status,
    }, ...prev])
    setShowModal(false)
    setForm({ tipo: 'entrada', descricao: '', valor: '', metodo: 'PIX', data: getToday(), categoria: 'Mensalidade', status: 'confirmado' })
  }

  const textMuted = 'hsl(var(--text-muted))'
  const bgElevated = 'hsl(var(--bg-elevated))'
  const borderSubtle = '1px solid hsl(var(--border-subtle))'

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#06b6d4,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(6,182,212,0.3)' }}>
            <Smartphone size={20} color="#fff" />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Banking &amp; Pix</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>Movimentacoes bancarias e transacoes instantaneas</p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={13} />Nova Transacao</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Saldo Atual', value: fmtCur(saldo), color: saldo >= 0 ? '#10b981' : '#ef4444', icon: '💰' },
          { label: 'Entradas Conf.', value: fmtCur(totalEntradas), color: '#10b981', icon: '↑' },
          { label: 'Saidas Conf.', value: fmtCur(totalSaidas), color: '#ef4444', icon: '↓' },
          { label: 'Pendentes', value: fmtCur(totalPendente), color: '#f59e0b', icon: '⌛' },
          { label: 'PIX (Mensalidades)', value: fmtCur(totalPixRecebido), color: '#06b6d4', icon: '⚡' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tab-list">
          {(['todos', 'entrada', 'saida'] as const).map(v => (
            <button key={v} className={`tab-trigger ${filtroTipo === v ? 'active' : ''}`} onClick={() => setFiltroTipo(v)}>
              {v === 'todos' ? 'Todos' : v === 'entrada' ? 'Entradas' : 'Saidas'}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: textMuted }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar transacao ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(p => !p)}>
          <Filter size={13} />Filtros
          {activeFilters > 0 && (
            <span style={{ background: '#ef4444', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
              {activeFilters}
            </span>
          )}
        </button>
        {(activeFilters > 0 || search) && (
          <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={clearFilters}>
            <X size={12} />Limpar
          </button>
        )}
      </div>

      {showFilters && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, padding: '14px', background: bgElevated, borderRadius: 10, flexWrap: 'wrap', border: borderSubtle }}>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Metodo</label>
            <select className="form-input" style={{ minWidth: 110, fontSize: 12 }} value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}>
              <option value="Todos">Todos</option>
              {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Status</label>
            <select className="form-input" style={{ minWidth: 130, fontSize: 12 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as 'todos' | 'confirmado' | 'pendente')}>
              <option value="todos">Todos</option>
              <option value="confirmado">Confirmado</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Mes</label>
            <select className="form-input" style={{ minWidth: 110, fontSize: 12 }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
              <option value="Todos">Todos</option>
              {MESES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}

      {transacoes.length === 0 ? (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <Smartphone size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Nenhuma transacao registrada</h3>
          <p style={{ color: textMuted, marginTop: 8, fontSize: 14 }}>Registre movimentacoes bancarias e transacoes Pix.</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: 16 }}>+ Nova Transacao</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Descricao</th><th>Categoria</th><th>Metodo</th><th>Tipo</th><th>Status</th>
                <th style={{ textAlign: 'right' }}>Valor</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td style={{ fontSize: 12, color: textMuted, whiteSpace: 'nowrap' }}>{fmt(t.data)}</td>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{t.descricao}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                      {t.categoria}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: `${METODO_COLORS[t.metodo] || '#6b7280'}18`, color: METODO_COLORS[t.metodo] || '#6b7280', fontWeight: 700 }}>
                      {t.metodo}
                    </span>
                  </td>
                  <td>
                    {t.tipo === 'entrada'
                      ? <span style={{ color: '#10b981', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><ArrowUpRight size={12} />Entrada</span>
                      : <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><ArrowDownLeft size={12} />Saida</span>
                    }
                  </td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: t.status === 'confirmado' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: t.status === 'confirmado' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                      {t.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: t.tipo === 'entrada' ? '#10b981' : '#ef4444', fontSize: 14 }}>{fmtCur(t.valor)}</td>
                  <td>
                    <button onClick={() => setTransacoes(prev => prev.filter(x => x.id !== t.id))} className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: textMuted, fontSize: 13 }}>Nenhuma transacao com esses filtros</div>
          )}
          <div style={{ padding: '10px 16px', borderTop: borderSubtle, fontSize: 12, color: textMuted, display: 'flex', justifyContent: 'space-between' }}>
            <span>{filtered.length} de {transacoes.length} transacoes</span>
            <span>
              <span style={{ color: '#10b981', fontWeight: 700, marginRight: 16 }}>
                {fmtCur(filtered.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0))}
              </span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>
                {fmtCur(filtered.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0))}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)', padding: 24 }}>
          <div style={{ background: bgElevated, border: '1px solid rgba(6,182,212,0.3)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <span style={{ fontWeight: 800, fontSize: 17 }}>Nova Transacao</span>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['entrada', 'saida'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, tipo: t, categoria: t === 'entrada' ? 'Mensalidade' : 'Fornecedor' }))}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 700,
                      border: `1px solid ${form.tipo === t ? (t === 'entrada' ? '#10b981' : '#ef4444') : 'hsl(var(--border-default))'}`,
                      background: form.tipo === t ? (t === 'entrada' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'transparent',
                      color: form.tipo === t ? (t === 'entrada' ? '#10b981' : '#ef4444') : textMuted,
                    }}
                  >
                    {t === 'entrada' ? 'Entrada' : 'Saida'}
                  </button>
                ))}
              </div>

              <input
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descricao *"
                className="form-input"
              />
              <input
                type="number"
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="Valor (R$) *"
                className="form-input"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value as Transacao['metodo'] }))} className="form-input">
                  {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="form-input">
                  {(form.tipo === 'entrada' ? CATEGORIAS_ENT : CATEGORIAS_SAI).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="form-input" />
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'confirmado' | 'pendente' }))} className="form-input">
                  <option value="confirmado">Confirmado</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={handleSave} disabled={!form.descricao || !form.valor} className="btn btn-primary" style={{ flex: 2 }}>
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
