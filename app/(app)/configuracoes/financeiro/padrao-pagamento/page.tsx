'use client'

import { formatDate } from '@/lib/utils'
import { useData, ConfigPadraoPagamento, ParcelaPadrao, newId, ConfigEvento } from '@/lib/dataContext'
import { useConfigDb } from '@/lib/useConfigDb'
import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Check, Zap, ChevronDown, ChevronRight, DollarSign, Search, Filter, Tag, X, CalendarDays } from 'lucide-react'

const SEGMENTOS = ['EI', 'EF1', 'EF2', 'EM', 'EJA']
const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i)

const BLANK_FORM = {
  codigo: '',
  nome: '',
  totalParcelas: 12,
  anuidade: 12000,
  ano: new Date().getFullYear(),
  diaVencimento: 10,
  segmento: '',
  situacao: 'ativo' as 'ativo' | 'inativo',
  descontoTipo: 'reais' as 'reais' | 'percentual',
  descontoValor: 0,
  eventoId: '',
  eventoDescricao: '',
}

function gerarParcelas(
  anuidade: number, totalParcelas: number, ano: number, diaVencimento: number,
  descontoTipo: 'reais' | 'percentual' = 'reais', descontoValor = 0,
  eventoId = '', eventoDescricao = ''
): ParcelaPadrao[] {
  const valorBase = anuidade / totalParcelas
  return Array.from({ length: totalParcelas }, (_, i) => {
    const mes = i + 1
    const yr = mes > 12 ? ano + 1 : ano
    const m = mes > 12 ? mes - 12 : mes
    const mm = String(m).padStart(2, '0')
    const dia = String(Math.min(diaVencimento, 28)).padStart(2, '0')
    const desconto = descontoTipo === 'percentual'
      ? +((valorBase * descontoValor) / 100).toFixed(2)
      : +descontoValor.toFixed(2)
    const parcela: ParcelaPadrao = {
      numero: i + 1,
      vencimento: `${yr}-${mm}-${dia}`,
      valor: +valorBase.toFixed(2),
      desconto,
    }
    if (eventoId) { parcela.eventoId = eventoId; parcela.eventoDescricao = eventoDescricao }
    return parcela
  })
}

const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function PadraoPagamentoPage() {
  const { data: cfgPadroesPagamento, setData: setCfgPadroesPagamento } = useConfigDb<ConfigPadraoPagamento>('cfgPadroesPagamento')
  const { data: cfgEventos } = useConfigDb<ConfigEvento>('cfgEventos')

  // Form state
  const [form, setForm] = useState(BLANK_FORM)
  const [parcelas, setParcelas] = useState<ParcelaPadrao[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [gerou, setGerou] = useState(false)

  // Filtros da listagem
  const [filtroAno, setFiltroAno] = useState<number | 'todos'>('todos')
  const [filtroSegmento, setFiltroSegmento] = useState('todos')
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Modal seletor de evento
  const [showEventoPicker, setShowEventoPicker] = useState(false)
  const [eventoSearch, setEventoSearch] = useState('')
  const eventosFiltrados = useMemo(() => {
    const q = eventoSearch.toLowerCase()
    return cfgEventos.filter(e =>
      e.situacao === 'ativo' &&
      (e.descricao.toLowerCase().includes(q) || e.codigo.toLowerCase().includes(q))
    )
  }, [cfgEventos, eventoSearch])

  // Preview do código: gerado a partir do nome + sequência
  const gerarCodPP = (): string => {
    const existentes = cfgPadroesPagamento.map(p => (p as any).codigo).filter(Boolean)
    let i = cfgPadroesPagamento.length + 1
    let cod = `PP${String(i).padStart(3, '0')}`
    while (existentes.includes(cod)) { i++; cod = `PP${String(i).padStart(3, '0')}` }
    return cod
  }
  const codigoPreview = editId ? form.codigo : gerarCodPP()

  // Filtro aplicado na lista
  const filtered = useMemo(() => cfgPadroesPagamento.filter(pp => {
    const matchAno = filtroAno === 'todos' || pp.ano === filtroAno
    const matchSeg = filtroSegmento === 'todos' || (pp as any).segmento === filtroSegmento
    const matchSit = filtroSituacao === 'todos' || pp.situacao === filtroSituacao
    const matchSearch = search.trim().length < 3 || (!search || pp.nome.toLowerCase().includes(search.toLowerCase()) || pp.codigo?.includes(search.toUpperCase()))
    return matchAno && matchSeg && matchSit && matchSearch
  }), [cfgPadroesPagamento, filtroAno, filtroSegmento, filtroSituacao, search])

  const openNew = () => {
    setEditId(null)
    setForm({ ...BLANK_FORM })
    setParcelas([])
    setGerou(false)
    setShowForm(true)
  }

  const openEdit = (pp: ConfigPadraoPagamento) => {
    setEditId(pp.id)
    setForm({
      codigo: (pp as any).codigo ?? '',
      nome: pp.nome,
      totalParcelas: pp.totalParcelas,
      anuidade: pp.anuidade,
      ano: pp.ano,
      diaVencimento: pp.diaVencimento,
      segmento: (pp as any).segmento ?? '',
      situacao: pp.situacao,
      descontoTipo: (pp as any).descontoTipo ?? 'reais' as 'reais' | 'percentual',
      descontoValor: (pp as any).descontoValor ?? 0,
      eventoId: (pp as any).eventoId ?? '',
      eventoDescricao: (pp as any).eventoDescricao ?? '',
    })
    setParcelas([...pp.parcelas])
    setGerou(pp.parcelas.length > 0)
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este padrão de pagamento?')) return
    setCfgPadroesPagamento(prev => prev.filter(p => p.id !== id))
  }

  const handleGerar = () => {
    if (!form.totalParcelas || !form.anuidade) return
    const novas = gerarParcelas(
      form.anuidade, form.totalParcelas, form.ano, form.diaVencimento,
      form.descontoTipo, form.descontoValor,
      form.eventoId, form.eventoDescricao,
    )
    setParcelas(novas)
    setGerou(true)
  }

  // Edita valor bruto ou desconto de uma parcela com recalculo bidirecional
  const editParcela = (i: number, field: 'vencimento' | 'valor' | 'desconto' | 'descontoPct', val: string | number) => {
    setParcelas(prev => prev.map((p, idx) => {
      if (idx !== i) return p
      if (field === 'vencimento') return { ...p, vencimento: String(val) }
      if (field === 'valor') return { ...p, valor: +Number(val).toFixed(2) }
      if (field === 'desconto') return { ...p, desconto: +Number(val).toFixed(2) }
      if (field === 'descontoPct') {
        const pct = +Number(val)
        return { ...p, desconto: +((p.valor * pct) / 100).toFixed(2) }
      }
      return p
    }))
  }

  const handleSave = () => {
    if (!form.nome.trim()) return
    const codigo = editId ? form.codigo : gerarCodPP()
    const parcelasParaSalvar = parcelas.length > 0
      ? parcelas.map(p => ({
          ...p,
          eventoId: p.eventoId ?? form.eventoId,
          eventoDescricao: p.eventoDescricao ?? form.eventoDescricao,
        }))
      : gerarParcelas(
          form.anuidade, form.totalParcelas, form.ano, form.diaVencimento,
          form.descontoTipo, form.descontoValor,
          form.eventoId, form.eventoDescricao,
        )
    const payload = { ...form, codigo, parcelas: parcelasParaSalvar }
    if (editId) {
      setCfgPadroesPagamento(prev => prev.map(p => p.id === editId ? { ...p, ...payload } : p))
    } else {
      const novo: ConfigPadraoPagamento = { ...payload, id: newId('PP'), createdAt: new Date().toISOString() }
      setCfgPadroesPagamento(prev => [...prev, novo])
    }
    setShowForm(false)
    setGerou(false)
    setParcelas([])
  }

  const totalDesconto = parcelas.reduce((s, p) => s + p.desconto, 0)
  const totalLiquido = parcelas.reduce((s, p) => s + p.valor - p.desconto, 0)

  return (
    <>
      {/* Modal seletor de evento — overlay global */}
      {showEventoPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '60px 20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 18, width: '100%', maxWidth: 560, border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--bg-elevated))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarDays size={16} color="#818cf8" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Selecionar Evento Financeiro</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Vincule as parcelas a um evento já cadastrado</div>
                </div>
              </div>
              <button onClick={() => setShowEventoPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                <input autoFocus className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar por descrição ou código..." value={eventoSearch} onChange={e => setEventoSearch(e.target.value)} />
              </div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 12px' }}>
              {eventosFiltrados.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                  <CalendarDays size={36} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                  <div>Nenhum evento ativo encontrado</div>
                  {eventoSearch && <div style={{ fontSize: 11, marginTop: 4 }}>Tente outro termo de busca</div>}
                </div>
              ) : eventosFiltrados.map(ev => (
                <button key={ev.id} type="button"
                  onClick={() => { setForm(p => ({ ...p, eventoId: ev.id, eventoDescricao: ev.descricao })); setShowEventoPicker(false) }}
                  style={{ width: '100%', padding: '12px 14px', marginBottom: 4, border: `1px solid ${form.eventoId === ev.id ? 'rgba(99,102,241,0.4)' : 'hsl(var(--border-subtle))'}`, borderRadius: 10, background: form.eventoId === ev.id ? 'rgba(99,102,241,0.08)' : 'hsl(var(--bg-elevated))', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', transition: 'all 0.12s' }}
                  onMouseEnter={e => { if (form.eventoId !== ev.id) { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.background = 'rgba(99,102,241,0.04)' } }}
                  onMouseLeave={e => { if (form.eventoId !== ev.id) { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = '' } }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: ev.tipo === 'receita' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>{ev.tipo === 'receita' ? '↑' : '↓'}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{ev.descricao}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <code style={{ fontSize: 10, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', padding: '1px 6px', borderRadius: 4 }}>{ev.codigo}</code>
                      <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, fontWeight: 600, background: ev.tipo === 'receita' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: ev.tipo === 'receita' ? '#10b981' : '#ef4444' }}>{ev.tipo === 'receita' ? 'Receita' : 'Despesa'}</span>
                    </div>
                  </div>
                  {form.eventoId === ev.id && <Check size={16} color="#818cf8" />}
                </button>
              ))}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-elevated))' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForm(p => ({ ...p, eventoId: '', eventoDescricao: '' })); setShowEventoPicker(false) }}><X size={12} />Limpar seleção</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEventoPicker(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
      <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Padrão de Pagamentos</h1>
          <p className="page-subtitle">Templates de parcelamento de anuidade com geração automática de parcelas</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Padrão</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: cfgPadroesPagamento.length, color: '#3b82f6' },
          { label: 'Ativos', value: cfgPadroesPagamento.filter(p => p.situacao === 'ativo').length, color: '#10b981' },
          { label: 'Ano Atual', value: cfgPadroesPagamento.filter(p => p.ano === new Date().getFullYear()).length, color: '#8b5cf6' },
          { label: 'Filtrados', value: filtered.length, color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros da listagem */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 30 }} placeholder="Buscar padrão ou código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 130 }} value={String(filtroAno)}
          onChange={e => setFiltroAno(e.target.value === 'todos' ? 'todos' : +e.target.value)}>
          <option value="todos">📅 Todos os anos</option>
          {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="form-input" style={{ width: 140 }} value={filtroSegmento} onChange={e => setFiltroSegmento(e.target.value)}>
          <option value="todos">🎓 Segmento</option>
          {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-input" style={{ width: 130 }} value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value as 'todos' | 'ativo' | 'inativo')}>
          <option value="todos">Situação</option>
          <option value="ativo">✓ Ativo</option>
          <option value="inativo">✗ Inativo</option>
        </select>
        {(filtroAno !== 'todos' || filtroSegmento !== 'todos' || filtroSituacao !== 'todos' || search) && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f87171' }}
            onClick={() => { setFiltroAno('todos'); setFiltroSegmento('todos'); setFiltroSituacao('todos'); setSearch('') }}>
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ padding: '24px', marginBottom: 20, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18, color: '#60a5fa' }}>
            {editId ? '✏️ Editar Padrão de Pagamento' : '➕ Novo Padrão de Pagamento'}
          </div>

          {/* Linha 1: código AUTO + nome + segmento + evento */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 2fr 130px', gap: 12, marginBottom: 12 }}>
            {/* Código auto-gerado */}
            <div>
              <label className="form-label">Código</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-elevated))' }}>
                <span style={{ padding: '0 8px', fontSize: 10, color: 'hsl(var(--text-muted))', borderRight: '1px solid hsl(var(--border-subtle))', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>AUTO</span>
                <span style={{ padding: '0 10px', fontWeight: 900, fontSize: 13, fontFamily: 'monospace', color: '#60a5fa', letterSpacing: '0.03em' }}>{codigoPreview}</span>
              </div>
              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>Sequencial automático</div>
            </div>
            <div>
              <label className="form-label">Nome do Padrão *</label>
              <input className="form-input" value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Mensalidade 2026 — EF1 12x" />
            </div>
            <div>
              <label className="form-label">Segmento</label>
              <select className="form-input" value={form.segmento} onChange={e => setForm(p => ({ ...p, segmento: e.target.value }))}>
                <option value="">Todos</option>
                {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Evento vinculado */}
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Evento Financeiro Vinculado
              <span style={{ fontSize: 10, fontWeight: 400, color: 'hsl(var(--text-muted))', marginLeft: 6 }}>(opcional — vincula as parcelas a um evento do sistema)</span>
            </label>
            {form.eventoId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10 }}>
                <CalendarDays size={14} color="#818cf8" />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>{form.eventoDescricao}</span>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginLeft: 8 }}>#{cfgEventos.find(e => e.id === form.eventoId)?.codigo}</span>
                  <span style={{ fontSize: 11, marginLeft: 10, padding: '1px 8px', borderRadius: 20, background: cfgEventos.find(e => e.id === form.eventoId)?.tipo === 'receita' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: cfgEventos.find(e => e.id === form.eventoId)?.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                    {cfgEventos.find(e => e.id === form.eventoId)?.tipo === 'receita' ? '↑ Receita' : '↓ Despesa'}
                  </span>
                </div>
                <button type="button" onClick={() => setForm(p => ({ ...p, eventoId: '', eventoDescricao: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => { setEventoSearch(''); setShowEventoPicker(true) }}
                style={{ width: '100%', padding: '10px 14px', border: '1px dashed hsl(var(--border-default))', borderRadius: 10, background: 'hsl(var(--bg-elevated))', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-muted))', fontSize: 13, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#818cf8' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = '' }}
              >
                <CalendarDays size={15} />
                Selecionar evento financeiro...
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 10px', background: 'rgba(99,102,241,0.1)', borderRadius: 20, color: '#818cf8' }}>
                  {cfgEventos.filter(e => e.situacao === 'ativo').length} disponíveis
                </span>
              </button>
            )}
          </div>

          {/* Linha 2: anuidade, parcelas, desconto global, ano, dia vcto, situacao */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 180px 90px 90px 100px', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="form-label">Anuidade Total (R$) *</label>
              <input className="form-input" type="number" min={0} step={100} value={form.anuidade}
                onChange={e => setForm(p => ({ ...p, anuidade: +e.target.value }))}
                style={{ fontWeight: 800, color: '#34d399' }} />
            </div>
            <div>
              <label className="form-label">Parcelas</label>
              <input className="form-input" type="number" min={1} max={24} value={form.totalParcelas}
                onChange={e => setForm(p => ({ ...p, totalParcelas: +e.target.value }))} />
            </div>
            {/* Desconto global aplicado ao gerar */}
            <div>
              <label className="form-label">Desconto Global</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {/* Toggle R$/% */}
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', flexShrink: 0 }}>
                  <button type="button" onClick={() => setForm(p => ({ ...p, descontoTipo: 'reais' }))}
                    style={{ padding: '0 10px', height: 38, fontSize: 12, fontWeight: 700, background: form.descontoTipo === 'reais' ? '#60a5fa' : 'transparent', color: form.descontoTipo === 'reais' ? '#fff' : 'hsl(var(--text-muted))', border: 'none', cursor: 'pointer' }}>R$</button>
                  <button type="button" onClick={() => setForm(p => ({ ...p, descontoTipo: 'percentual' }))}
                    style={{ padding: '0 10px', height: 38, fontSize: 12, fontWeight: 700, background: form.descontoTipo === 'percentual' ? '#f59e0b' : 'transparent', color: form.descontoTipo === 'percentual' ? '#fff' : 'hsl(var(--text-muted))', border: 'none', cursor: 'pointer' }}>%</button>
                </div>
                <input className="form-input" type="number" step={0.01} min={0}
                  max={form.descontoTipo === 'percentual' ? 100 : undefined}
                  value={form.descontoValor}
                  onChange={e => setForm(p => ({ ...p, descontoValor: +e.target.value }))}
                  style={{ fontWeight: 800, color: '#f59e0b', flex: 1 }}
                  placeholder={form.descontoTipo === 'percentual' ? '0%' : '0,00'} />
              </div>
              {form.descontoValor > 0 && (
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>
                  {form.descontoTipo === 'percentual'
                    ? `≈ ${fmtCurrency((form.anuidade / form.totalParcelas * form.descontoValor) / 100)}/parcela`
                    : `${fmtCurrency(form.descontoValor)}/parcela aplicado`}
                </div>
              )}
            </div>
            <div>
              <label className="form-label">Ano Letivo</label>
              <select className="form-input" value={form.ano} onChange={e => setForm(p => ({ ...p, ano: +e.target.value }))}>
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Dia Vcto</label>
              <input className="form-input" type="number" min={1} max={28} value={form.diaVencimento}
                onChange={e => setForm(p => ({ ...p, diaVencimento: +e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
          </div>

          {/* Preview / Gerar */}
          <div style={{ padding: '14px 18px', background: 'rgba(59,130,246,0.07)', borderRadius: 10, marginBottom: 14, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Parcela: </span><span style={{ fontSize: 18, fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit, sans-serif' }}>{fmtCurrency(form.anuidade / (form.totalParcelas || 1))}</span></div>
            <div><span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Anuidade: </span><span style={{ fontSize: 16, fontWeight: 800, color: '#34d399' }}>{fmtCurrency(form.anuidade)}</span></div>
            <div><span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Parcelas: </span><span style={{ fontSize: 16, fontWeight: 800 }}>{form.totalParcelas}x</span></div>
            {form.segmento && <div><span style={{ fontSize: 12, color: '#f59e0b' }}>🎓 {form.segmento}</span></div>}
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={handleGerar}>
              <Zap size={13} />{gerou ? 'Regerar Parcelas' : 'Gerar Parcelas'}
            </button>
          </div>

          {/* Parcelas geradas */}
          {gerou && parcelas.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'hsl(var(--text-secondary))' }}>
                {parcelas.length} parcelas geradas — edite individualmente conforme necessário
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
                {parcelas.map((p, i) => {
                  const liq = +(p.valor - p.desconto).toFixed(2)
                  const pct = p.valor > 0 ? +((p.desconto / p.valor) * 100).toFixed(1) : 0
                  const inputStyle = (color?: string): React.CSSProperties => ({
                    width: '100%', fontSize: 11, padding: '3px 6px',
                    background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 4, color: color ?? 'hsl(var(--text-primary))',
                  })
                  return (
                    <div key={i} style={{ padding: '10px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, border: `1px solid ${p.eventoId ? 'rgba(99,102,241,0.3)' : p.desconto > 0 ? 'rgba(245,158,11,0.3)' : 'hsl(var(--border-subtle))'}` }}>
                      {/* Header parcela */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#60a5fa', flexShrink: 0 }}>{p.numero}</div>
                        {/* Valor líquido em destaque */}
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>Líquido: </span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: liq < p.valor ? '#34d399' : '#60a5fa', fontFamily: 'Outfit, sans-serif' }}>{fmtCurrency(liq)}</span>
                          {p.desconto > 0 && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6 }}>({pct}% desc.)</span>}
                        </div>
                      </div>
                      {/* Badge evento */}
                      {p.eventoDescricao && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CalendarDays size={9} />{p.eventoDescricao}
                          </span>
                        </div>
                      )}
                      {/* Campos */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div>
                          <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>Vencimento</div>
                          <input type="date" value={p.vencimento} onChange={e => editParcela(i, 'vencimento', e.target.value)}
                            style={inputStyle()} />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>Valor Bruto (R$)</div>
                          <input type="number" step={0.01} value={p.valor} onChange={e => editParcela(i, 'valor', e.target.value)}
                            style={inputStyle('#34d399')} />
                        </div>
                        {/* Desconto R$ */}
                        <div>
                          <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>Desconto (R$)</div>
                          <input type="number" step={0.01} min={0} max={p.valor}
                            value={p.desconto}
                            onChange={e => editParcela(i, 'desconto', e.target.value)}
                            style={inputStyle(p.desconto > 0 ? '#f59e0b' : undefined)} />
                        </div>
                        {/* Desconto % — calcula R$ automaticamente */}
                        <div>
                          <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>Desconto (%)</div>
                          <input type="number" step={0.1} min={0} max={100}
                            value={p.valor > 0 ? pct : 0}
                            onChange={e => editParcela(i, 'descontoPct', e.target.value)}
                            style={inputStyle(p.desconto > 0 ? '#f59e0b' : undefined)} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 12, padding: '14px 18px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, display: 'flex', gap: 28, flexWrap: 'wrap', border: '1px solid hsl(var(--border-subtle))', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Total Bruto</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#34d399', fontFamily: 'Outfit, sans-serif' }}>{fmtCurrency(parcelas.reduce((s, p) => s + p.valor, 0))}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Total Descontos</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>- {fmtCurrency(totalDesconto)}</div>
                </div>
                <div style={{ borderLeft: '2px solid hsl(var(--border-subtle))', paddingLeft: 20 }}>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Total Líquido</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit, sans-serif' }}>{fmtCurrency(totalLiquido)}</div>
                </div>
                {totalDesconto > 0 && (
                  <div style={{ marginLeft: 'auto', padding: '6px 14px', background: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)' }}>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Desconto médio</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>
                      {((totalDesconto / parcelas.reduce((s, p) => s + p.valor, 0)) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setGerou(false); setParcelas([]) }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!form.nome.trim()}>
              <Check size={14} />{editId ? 'Salvar Alterações' : 'Salvar Padrão'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {cfgPadroesPagamento.length === 0 && !showForm ? (
        <div className="card" style={{ padding: '56px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <DollarSign size={48} style={{ margin: '0 auto 16px', opacity: 0.15 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum padrão de pagamento</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Crie templates de parcelamento de anuidade para reutilizá-los nas cobranças.</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Criar primeiro padrão</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(pp => (
            <div key={pp.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <button onClick={() => setExpandedId(expandedId === pp.id ? null : pp.id)}
                    className="btn btn-ghost btn-icon btn-sm" style={{ flexShrink: 0 }}>
                    {expandedId === pp.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <code style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', background: 'hsl(var(--bg-overlay))', padding: '2px 7px', borderRadius: 4 }}>{(pp as any).codigo || '—'}</code>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{pp.nome}</span>
                      {(pp as any).segmento && <span className="badge badge-primary" style={{ fontSize: 10 }}>{(pp as any).segmento}</span>}
                      {(pp as any).eventoDescricao && (
                        <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CalendarDays size={9} />{(pp as any).eventoDescricao}
                        </span>
                      )}
                      {(pp as any).turma && <span className="badge badge-neutral" style={{ fontSize: 10 }}>🏫 {(pp as any).turma}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 3 }}>
                      {pp.ano} · {pp.totalParcelas}x de {fmtCurrency(pp.anuidade / pp.totalParcelas)} · Dia {pp.diaVencimento} · {pp.parcelas.length} parcelas
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: '#34d399', fontFamily: 'Outfit, sans-serif' }}>{fmtCurrency(pp.anuidade)}</span>
                  <span className={`badge ${pp.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{pp.situacao === 'ativo' ? '✓ Ativo' : '✗ Inativo'}</span>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(pp)} title="Editar"><Edit2 size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(pp.id)} title="Excluir"><Trash2 size={13} /></button>
                </div>
              </div>
              {expandedId === pp.id && pp.parcelas.length > 0 && (
                <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', padding: '14px 20px', background: 'hsl(var(--bg-elevated))' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {pp.parcelas.map(p => (
                      <div key={p.numero} style={{ padding: '8px 12px', background: 'hsl(var(--bg-base))', borderRadius: 8, border: `1px solid ${p.eventoId ? 'rgba(99,102,241,0.25)' : 'hsl(var(--border-subtle))'}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>Parcela {p.numero}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#34d399' }}>{fmtCurrency(p.valor)}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{p.vencimento.split('-').reverse().join('/')}</div>
                        {p.desconto > 0 && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>↓ desc. {fmtCurrency(p.desconto)}</div>}
                        {p.eventoDescricao && (
                          <div style={{ marginTop: 4 }}>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <CalendarDays size={8} />{p.eventoDescricao}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && cfgPadroesPagamento.length > 0 && (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum padrão com os filtros selecionados
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}
