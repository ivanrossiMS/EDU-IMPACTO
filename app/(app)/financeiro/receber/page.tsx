'use client'
import { useState, useMemo } from 'react'
import { useData, Titulo, newId } from '@/lib/dataContext'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Search, Filter, X, Download, CheckCircle, Pencil, Trash2,
  AlertTriangle, Clock, TrendingUp, DollarSign, BarChart2,
  Check, FileText, Tag, Layers, RotateCcw
} from 'lucide-react'

// ─── Constantes ────────────────────────────────────────────────────
const METODOS_FALLBACK = ['PIX', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Débito Automático', 'Dinheiro', 'Cheque', 'Transferência', 'Bolsa Integral']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (d: string | null) => {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}
const fmtCur = formatCurrency
const diasAtraso = (venc: string) =>
  Math.max(0, Math.ceil((Date.now() - new Date(venc).getTime()) / 86400000))

// Gera código como TIT-XXXXX
const genCod = (lista: (Titulo & { codigo?: string })[]) => {
  const set = new Set(lista.map(t => (t as any).codigo).filter(Boolean))
  let cod: string
  do { cod = `TIT-${Math.floor(Math.random() * 90000) + 10000}` } while (set.has(cod))
  return cod
}

// Aging buckets (dias de atraso)
const AGING = [
  { label: 'Corrente',   min: 0,   max: 0,   color: '#10b981' },
  { label: '1-30 dias',  min: 1,   max: 30,  color: '#f59e0b' },
  { label: '31-60 dias', min: 31,  max: 60,  color: '#f97316' },
  { label: '61-90 dias', min: 61,  max: 90,  color: '#ef4444' },
  { label: '+90 dias',   min: 91,  max: 9999,color: '#7f1d1d' },
]

const STATUS_CFG = {
  pago:     { label: 'Pago',     color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '✅' },
  pendente: { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⏰' },
  atrasado: { label: 'Atrasado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '⚠' },
}

const BLANK: Omit<Titulo, 'id'> & { codigo: string; origemLanca?: string } = {
  codigo: '', aluno: '', responsavel: '', descricao: '',
  valor: 0, vencimento: today(), pagamento: null,
  status: 'pendente', metodo: null, parcela: '1/1',
  origemLanca: 'manual_receber'
}

export default function ContasReceberPage() {
  const { titulos, setTitulos, alunos, cfgEventos, cfgMetodosPagamento, caixasAbertos, setCaixasAbertos, setMovimentacoesManuais, logSystemAction } = useData()
  const METODOS = cfgMetodosPagamento.filter(m => m.situacao === 'ativo').map(m => m.nome)
  const metodosSelect = METODOS.length > 0 ? METODOS : METODOS_FALLBACK

  // Apenas títulos marcados estritamente como lançamentos manuais nesta tela
  const titulosReceber = titulos.filter(t => (t as any).origemLanca === 'manual_receber')

  // Eventos de receita ativos do sistema (sem fallback hardcoded)
  const eventosReceita = cfgEventos.filter(e => e.tipo === 'receita' && e.situacao === 'ativo')
  // Todos eventos ativos (receita + despesa) para o filtro geral
  const todosEventosAtivos = cfgEventos.filter(e => e.situacao === 'ativo')

  // ── Filtros ──
  const [tabStatus, setTabStatus] = useState<'todos' | 'pendente' | 'atrasado' | 'pago'>('todos')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filtroMetodo, setFiltroMetodo] = useState('todos')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [filtroAno, setFiltroAno] = useState('todos')
  const [dataVencDe, setDataVencDe] = useState('')
  const [dataVencAte, setDataVencAte] = useState('')
  const [filtroAging, setFiltroAging] = useState('todos')
  const [filtroEvento, setFiltroEvento] = useState('todos')

  // ── Modal ──
  const [modal, setModal] = useState<'new' | 'edit' | 'baixa' | 'view' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK })
  const [baixaForm, setBaixaForm] = useState({ metodo: 'PIX', dataPagamento: today(), valorPago: 0, obs: '', caixaId: '' })

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))
  const anos = useMemo(() => [...new Set(titulosReceber.map(t => t.vencimento?.slice(0, 4)).filter(Boolean))].sort().reverse(), [titulosReceber])

  // ── Typeahead: Aluno ──
  const [alunoSearch, setAlunoSearch] = useState('')
  const [showAlunoDrop, setShowAlunoDrop] = useState(false)
  const alunosFiltrados = useMemo(() => {
    const q = alunoSearch.toLowerCase()
    return alunos.filter(a => a.nome.toLowerCase().includes(q) || (a.responsavel || '').toLowerCase().includes(q)).slice(0, 10)
  }, [alunos, alunoSearch])

  // ── Typeahead: Evento ──
  const [eventoSearch, setEventoSearch] = useState('')
  const [showEventoDrop, setShowEventoDrop] = useState(false)
  const eventosFiltrados = useMemo(() => {
    const q = eventoSearch.toLowerCase()
    return cfgEventos.filter(e => e.situacao === 'ativo' && e.descricao.toLowerCase().includes(q)).slice(0, 8)
  }, [cfgEventos, eventoSearch])

  // ── Modal de seleção de Evento ──
  const [showEventoModal, setShowEventoModal] = useState(false)
  const [eventoModalSearch, setEventoModalSearch] = useState('')
  const eventosFiltradosModal = useMemo(() => {
    const q = eventoModalSearch.toLowerCase()
    return cfgEventos.filter(e => e.situacao === 'ativo' && (e.descricao.toLowerCase().includes(q) || e.tipo.includes(q)))
  }, [cfgEventos, eventoModalSearch])

  // ── Gerador de Parcelas ──
  const [gerarParcelas, setGerarParcelas] = useState(false)
  const [numParcelas, setNumParcelas] = useState(3)
  const [dataInicioParcelas, setDataInicioParcelas] = useState('')
  const [modoParcelas, setModoParcelas] = useState<'corridos'|'mesmo_dia'>('corridos')
  const [previewParcelas, setPreviewParcelas] = useState<{ num: number; venc: string; valor: number }[]>([])

  const calcParcelas = () => {
    if (!form.valor || !dataInicioParcelas) return
    const base = new Date(dataInicioParcelas + 'T12:00')
    const vp = +(form.valor / numParcelas).toFixed(2)
    const ps = Array.from({ length: numParcelas }, (_, i) => {
      const d = new Date(base)
      if (modoParcelas === 'corridos') d.setDate(d.getDate() + 30 * i)
      else d.setMonth(d.getMonth() + i)
      return { num: i + 1, venc: d.toISOString().slice(0, 10), valor: vp }
    })
    const diff = +(form.valor - ps.reduce((s, p) => s + p.valor, 0)).toFixed(2)
    if (ps.length) ps[ps.length - 1].valor = +(ps[ps.length - 1].valor + diff).toFixed(2)
    setPreviewParcelas(ps)
  }

  // ── Dados filtrados ──
  const filtered = useMemo(() => titulosReceber.filter(t => {
    const q = search.toLowerCase()
    if (search && !t.aluno.toLowerCase().includes(q) && !t.descricao.toLowerCase().includes(q) && !t.responsavel.toLowerCase().includes(q) && !(t as any).codigo?.toLowerCase().includes(q)) return false
    if (tabStatus !== 'todos' && t.status !== tabStatus) return false
    if (filtroMetodo !== 'todos' && t.metodo !== filtroMetodo) return false
    if (filtroMes !== 'todos' && t.vencimento?.slice(5, 7) !== filtroMes) return false
    if (filtroAno !== 'todos' && !t.vencimento?.startsWith(filtroAno)) return false
    if (dataVencDe && t.vencimento < dataVencDe) return false
    if (dataVencAte && t.vencimento > dataVencAte) return false
    if (filtroEvento !== 'todos' && !t.descricao.toLowerCase().includes(filtroEvento.toLowerCase())) return false
    if (filtroAging !== 'todos' && t.status !== 'atrasado') {
      if (filtroAging !== 'corrente') return false
    }
    if (filtroAging !== 'todos' && filtroAging !== 'corrente' && t.status === 'atrasado') {
      const d = diasAtraso(t.vencimento)
      const bucket = AGING.find(b => d >= b.min && d <= b.max)
      if (!bucket || bucket.label !== filtroAging) return false
    }
    return true
  }), [titulosReceber, search, tabStatus, filtroMetodo, filtroMes, filtroAno, dataVencDe, dataVencAte, filtroAging])

  // ── KPIs ──
  const totalPago = titulosReceber.filter(t => t.status === 'pago').reduce((s, t) => s + t.valor, 0)
  const totalAtrasado = titulosReceber.filter(t => t.status === 'atrasado').reduce((s, t) => s + t.valor, 0)
  const totalPendente = titulosReceber.filter(t => t.status === 'pendente').reduce((s, t) => s + t.valor, 0)
  const totalCarteira = totalPago + totalAtrasado + totalPendente
  const taxaRecebimento = totalCarteira > 0 ? ((totalPago / totalCarteira) * 100) : 0
  const totalFiltrado = filtered.reduce((s, t) => s + t.valor, 0)

  // Aging de inadimplência
  const agingData = AGING.slice(1).map(b => ({
    ...b,
    valor: titulosReceber.filter(t => t.status === 'atrasado' && diasAtraso(t.vencimento) >= b.min && diasAtraso(t.vencimento) <= b.max).reduce((s, t) => s + t.valor, 0),
    qtd: titulosReceber.filter(t => t.status === 'atrasado' && diasAtraso(t.vencimento) >= b.min && diasAtraso(t.vencimento) <= b.max).length,
  }))

  // Previsão de recebimento por mês (próximos 3 meses)
  const previsao = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const ano = d.getFullYear()
      const key = `${ano}-${mes}`
      const valor = titulosReceber.filter(t => t.status !== 'pago' && t.vencimento?.startsWith(key)).reduce((s, t) => s + t.valor, 0)
      return { label: `${MESES_SHORT[d.getMonth()]}/${ano}`, valor }
    })
  }, [titulosReceber])

  // ── Handlers ──
  const openNew = () => {
    setForm({ ...BLANK, codigo: genCod(titulos as any) })
    setAlunoSearch(''); setEventoSearch(''); setShowAlunoDrop(false); setShowEventoDrop(false)
    setShowEventoModal(false); setEventoModalSearch('')
    setGerarParcelas(false); setNumParcelas(3); setDataInicioParcelas(''); setPreviewParcelas([])
    setEditingId(null); setModal('new')
  }
  const openEdit = (t: Titulo) => {
    setForm({ codigo: (t as any).codigo || genCod(titulos as any), ...t } as any)
    setAlunoSearch(t.aluno || ''); setEventoSearch('')
    setGerarParcelas(false); setPreviewParcelas([])
    setEditingId(t.id); setModal('edit')
  }
  const openBaixa = (t: Titulo) => {
    setEditingId(t.id)
    const cxDef = caixasAbertos.filter(c => !c.fechado).sort((a, b) => b.dataAbertura.localeCompare(a.dataAbertura))[0]?.id ?? ''
    setBaixaForm({ metodo: t.metodo ?? 'PIX', dataPagamento: today(), valorPago: t.valor, obs: '', caixaId: cxDef })
    setModal('baixa')
  }

  const handleSave = () => {
    if (!form.aluno.trim() || !form.vencimento) return
    if (gerarParcelas && previewParcelas.length > 0) {
      // Gera múltiplos títulos
      const novos = previewParcelas.map((p, i) => ({
        ...form,
        id: newId('TIT'),
        codigo: `${form.codigo}-P${String(i+1).padStart(2,'0')}`,
        descricao: `${form.descricao} (${i+1}/${previewParcelas.length})`,
        parcela: `${i+1}/${previewParcelas.length}`,
        valor: p.valor,
        vencimento: p.venc,
        origemLanca: 'manual_receber'
      } as Titulo))
      setTitulos(prev => [...novos, ...prev])
      logSystemAction('Financeiro (Receber)', 'Cadastro em Lote', `Lançamento de ${previewParcelas.length} parcelas para ${form.aluno}`, { registroId: form.codigo, nomeRelacionado: form.aluno })
    } else if (modal === 'new') {
      const generatedId = newId('TIT')
      setTitulos(prev => [{ ...form, id: generatedId } as Titulo, ...prev])
      logSystemAction('Financeiro (Receber)', 'Cadastro', `Novo título gerado no valor de R$ ${form.valor}`, { registroId: form.codigo, nomeRelacionado: form.aluno, detalhesDepois: form })
    } else if (editingId) {
      const tituloAnterior = titulos.find(t => t.id === editingId)
      setTitulos(prev => prev.map(t => t.id === editingId ? { ...form, id: editingId } as Titulo : t))
      // Sincronizar descrição/valor na movimentação automática vinculada (se existir)
      setMovimentacoesManuais((prev: any) => prev.map((m: any) =>
        m.referenciaId === editingId
          ? { ...m, descricao: `Contas a Receber — ${form.descricao}${form.aluno ? ` · ${form.aluno}` : ''}`, valor: form.valor, editadoEm: new Date().toISOString() }
          : m
      ))
      logSystemAction('Financeiro (Receber)', 'Edição', `Título atualizado no valor de R$ ${form.valor}`, { registroId: form.codigo, nomeRelacionado: form.aluno, detalhesAntes: tituloAnterior, detalhesDepois: form })
    }
    setModal(null); setEditingId(null)
  }

  const handleBaixa = () => {
    if (!editingId) return
    const titulo = titulos.find(t => t.id === editingId)
    setTitulos(prev => prev.map(t => t.id === editingId ? {
      ...t, status: 'pago' as const, pagamento: baixaForm.dataPagamento,
      metodo: baixaForm.metodo, valor: baixaForm.valorPago || t.valor,
      obs: baixaForm.obs,
    } : t))
    // Espelhar como Movimentação Manual no caixa selecionado
    if (baixaForm.caixaId && titulo) {
      const now = new Date().toISOString()
      const refId = 'CR-' + titulo.id.slice(-8)
      setMovimentacoesManuais((prev: any) => [...prev, {
        id: refId, caixaId: baixaForm.caixaId, tipo: 'receita',
        fornecedorId: '', fornecedorNome: titulo.responsavel || titulo.aluno || '',
        descricao: `Contas a Receber — ${titulo.descricao}${titulo.aluno ? ` · ${titulo.aluno}` : ''}`,
        dataLancamento: baixaForm.dataPagamento, dataMovimento: baixaForm.dataPagamento,
        valor: baixaForm.valorPago || titulo.valor,
        planoContasId: '', planoContasDesc: '',
        tipoDocumento: 'REC', numeroDocumento: (titulo as any).codigo || '',
        dataEmissao: titulo.vencimento || baixaForm.dataPagamento,
        compensadoBanco: false, observacoes: baixaForm.obs || '',
        criadoEm: now, editadoEm: now,
        origem: 'baixa_receber', referenciaId: editingId || ''
      }])
    }
    logSystemAction('Financeiro (Receber)', 'Baixa de Pagamento', `Título liquidado via ${baixaForm.metodo}`, { registroId: (titulo as any)?.codigo, nomeRelacionado: titulo?.aluno })
    setModal(null); setEditingId(null)
  }

  const handleDelete = () => {
    if (confirmId) {
      const tituloAnterior = titulos.find(t => t.id === confirmId)
      setTitulos(prev => prev.filter(t => t.id !== confirmId))
      // Remover movimentação automática vinculada (se houver baixa registrada)
      setMovimentacoesManuais((prev: any) => prev.filter((m: any) => m.referenciaId !== confirmId))
      logSystemAction('Financeiro (Receber)', 'Exclusão', `Título removido do sistema permanentemente`, { registroId: (tituloAnterior as any)?.codigo, nomeRelacionado: tituloAnterior?.aluno, detalhesAntes: tituloAnterior })
    }
    setConfirmId(null)
  }

  const clearFilters = () => {
    setSearch(''); setFiltroMetodo('todos'); setFiltroMes('todos')
    setFiltroAno('todos'); setDataVencDe(''); setDataVencAte('')
    setFiltroAging('todos'); setFiltroEvento('todos')
  }

  const activeFilters = [filtroMetodo !== 'todos', filtroMes !== 'todos', filtroAno !== 'todos', dataVencDe, dataVencAte, filtroAging !== 'todos', filtroEvento !== 'todos'].filter(Boolean).length

  const selectedTitulo = titulos.find(t => t.id === editingId)

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Contas a Receber</h1>
          <p className="page-subtitle">
            Taxa de recebimento: <strong style={{ color: '#10b981' }}>{taxaRecebimento.toFixed(1)}%</strong>
            {' '}• Carteira total: <strong style={{ color: '#3b82f6' }}>{fmtCur(totalCarteira)}</strong>
            {totalAtrasado > 0 && <span style={{ marginLeft: 12, color: '#ef4444', fontWeight: 700 }}>⚠ {fmtCur(totalAtrasado)} em atraso</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Título</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Recebido', value: fmtCur(totalPago), sub: `${titulos.filter(t => t.status === 'pago').length} títulos`, color: '#10b981', icon: '✅' },
          { label: 'A Vencer', value: fmtCur(totalPendente), sub: `${titulos.filter(t => t.status === 'pendente').length} títulos`, color: '#f59e0b', icon: '⏰' },
          { label: 'Em Atraso', value: fmtCur(totalAtrasado), sub: `${titulos.filter(t => t.status === 'atrasado').length} vencidos`, color: '#ef4444', icon: '⚠️' },
          { label: 'Carteira Total', value: fmtCur(totalCarteira), sub: `${titulos.length} títulos`, color: '#3b82f6', icon: '💰' },
          { label: 'Selecionados', value: fmtCur(totalFiltrado), sub: `${filtered.length} de ${titulos.length}`, color: '#8b5cf6', icon: '🔍' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{k.icon}</span>
              <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', lineHeight: 1.2 }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Gauge de recebimento + Aging + Previsão */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 12, marginBottom: 16 }}>

        {/* Taxa de recebimento */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📊 Performance de Recebimento
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span>Meta: 95%</span>
            <span style={{ fontWeight: 800, color: taxaRecebimento >= 95 ? '#10b981' : taxaRecebimento >= 80 ? '#f59e0b' : '#ef4444' }}>{taxaRecebimento.toFixed(1)}%</span>
          </div>
          <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${taxaRecebimento}%`, borderRadius: 6, background: taxaRecebimento >= 95 ? 'linear-gradient(90deg,#10b981,#34d399)' : taxaRecebimento >= 80 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#f87171)', transition: 'width 0.5s' }} />
          </div>
          {[
            { label: 'Pago', valor: totalPago, color: '#10b981' },
            { label: 'Pendente', valor: totalPendente, color: '#f59e0b' },
            { label: 'Atrasado', valor: totalAtrasado, color: '#ef4444' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: 'inline-block' }} />
                {r.label}
              </span>
              <span style={{ fontWeight: 700, color: r.color }}>{fmtCur(r.valor)}</span>
            </div>
          ))}
        </div>

        {/* Aging de inadimplência */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚠ Aging de Inadimplência
          </div>
          {totalAtrasado === 0 ? (
            <div style={{ textAlign: 'center', color: '#10b981', fontSize: 13, fontWeight: 700, padding: '16px 0' }}>✅ Sem títulos em atraso</div>
          ) : agingData.map(b => (
            <div key={b.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: b.color, fontWeight: 600 }}>{b.label}</span>
                <span style={{ fontWeight: 700 }}>{b.qtd > 0 ? `${b.qtd} • ${fmtCur(b.valor)}` : '—'}</span>
              </div>
              <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalAtrasado > 0 ? (b.valor / totalAtrasado * 100) : 0}%`, background: b.color, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Previsão de caixa */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📅 Previsão de Recebimento
          </div>
          {previsao.map(p => (
            <div key={p.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ fontWeight: 600 }}>{p.label}</span>
                <span style={{ fontWeight: 800, color: '#3b82f6' }}>{fmtCur(p.valor)}</span>
              </div>
              <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${previsao[0].valor > 0 ? (p.valor / Math.max(...previsao.map(x => x.valor), 1) * 100) : 0}%`, background: 'linear-gradient(90deg,#3b82f6,#60a5fa)', borderRadius: 4 }} />
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 8, marginTop: 4, fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between' }}>
            <span>Total previsto 3 meses</span>
            <strong style={{ color: '#3b82f6' }}>{fmtCur(previsao.reduce((s, p) => s + p.valor, 0))}</strong>
          </div>
        </div>
      </div>

      {/* Filtros principais */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tab-list">
          {(['todos', 'pendente', 'atrasado', 'pago'] as const).map(s => (
            <button key={s} className={`tab-trigger ${tabStatus === s ? 'active' : ''}`} onClick={() => setTabStatus(s)} style={{ textTransform: 'capitalize' }}>
              {s === 'todos' ? 'Todos' : STATUS_CFG[s].label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar aluno, código, responsável..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className={`btn btn-sm ${showFilters || activeFilters > 0 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(p => !p)}>
          <Filter size={13} />Filtros {activeFilters > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, marginLeft: 2 }}>{activeFilters}</span>}
        </button>
        {(activeFilters > 0 || search) && (
          <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={clearFilters}><X size={12} />Limpar</button>
        )}
      </div>

      {/* Painel de filtros avançados */}
      {showFilters && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 12, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Vencimento de</label>
            <input type="date" className="form-input" style={{ width: 140 }} value={dataVencDe} onChange={e => setDataVencDe(e.target.value)} />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Vencimento até</label>
            <input type="date" className="form-input" style={{ width: 140 }} value={dataVencAte} onChange={e => setDataVencAte(e.target.value)} />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Mês de Vencimento</label>
            <select className="form-input" style={{ width: 130 }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
              <option value="todos">Todos</option>
              {MESES_FULL.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Ano</label>
            <select className="form-input" style={{ width: 100 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
              <option value="todos">Todos</option>
              {anos.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Método de Pag.</label>
            <select className="form-input" style={{ width: 160 }} value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}>
              <option value="todos">Todos</option>
              {metodosSelect.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag size={10} />Evento Financeiro
            </label>
            <select className="form-input" style={{ width: 200 }} value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)}>
              <option value="todos">Todos os eventos</option>
              {todosEventosAtivos.length > 0
                ? todosEventosAtivos.map(e => (
                    <option key={e.id} value={e.descricao}>
                      {e.codigo} — {e.descricao} ({e.tipo === 'receita' ? 'R' : 'D'})
                    </option>
                  ))
                : <option disabled value="">Nenhum evento cadastrado no sistema</option>
              }
            </select>
          </div>
        </div>
      )}

      {/* Tabela */}
      {titulos.length === 0 ? (
        <div className="card" style={{ padding: '72px 24px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <DollarSign size={52} style={{ opacity: 0.1, margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhum título lançado</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Registre mensalidades, taxas e outros créditos para controle financeiro completo.</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Lançar Primeiro Título</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Aluno / Responsável</th>
                <th>Descrição</th>
                <th>Vencimento</th>
                <th style={{ textAlign: 'center' }}>Parcela</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Método</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const atr = t.status === 'atrasado' ? diasAtraso(t.vencimento) : 0
                const sc = STATUS_CFG[t.status]
                return (
                  <tr key={t.id}>
                    <td>
                      <code style={{ fontSize: 10, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: '#60a5fa', fontWeight: 700 }}>
                        {(t as any).codigo || '—'}
                      </code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{t.aluno}</div>
                      {t.responsavel && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{t.responsavel}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div>{t.descricao}</div>
                      {(t as any).eventoDescricao && (
                        <div style={{ marginTop: 3 }}>
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            📅 {(t as any).eventoDescricao}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{fmt(t.vencimento)}</div>
                      {atr > 0 && (
                        <div style={{ fontSize: 10, fontWeight: 800, color: atr > 90 ? '#7f1d1d' : atr > 60 ? '#ef4444' : atr > 30 ? '#f97316' : '#f59e0b', marginTop: 1 }}>
                          {atr}d atraso
                        </div>
                      )}
                      {t.status === 'pago' && t.pagamento && (
                        <div style={{ fontSize: 10, color: '#10b981', marginTop: 1 }}>Pago {fmt(t.pagamento)}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{(() => {
                      const parc = t.parcela || '1/1'
                      const [cur, tot] = parc.split('/').map(Number)
                      const isSingle = tot === 1
                      const isFirst = cur === 1 && tot > 1
                      const isLast = cur === tot && tot > 1
                      const bg = isSingle ? 'rgba(99,102,241,0.1)' : isFirst ? 'rgba(16,185,129,0.1)' : isLast ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.08)'
                      const color = isSingle ? '#818cf8' : isFirst ? '#10b981' : isLast ? '#f59e0b' : '#60a5fa'
                      const label = isSingle ? 'Única' : isFirst ? 'Inicial' : isLast ? 'Final' : 'Recorr.'
                      return (
                        <span title={`Parcela ${parc} — ${label}`} style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:1,padding:'3px 10px',borderRadius:20,background:bg,border:`1px solid ${color}22`}}>
                          <span style={{fontFamily:'monospace',fontWeight:900,fontSize:13,color,lineHeight:1}}>{parc}</span>
                          <span style={{fontSize:8,fontWeight:700,color,letterSpacing:'0.04em',textTransform:'uppercase',opacity:0.8}}>{label}</span>
                        </span>
                      )
                    })()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: sc.color, fontFamily: 'Outfit,sans-serif' }}>
                      {fmtCur(t.valor)}
                    </td>
                    <td>
                      {t.metodo ? (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(99,102,241,0.1)', color: '#a78bfa', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.metodo}</span>
                      ) : <span style={{ color: 'hsl(var(--text-muted))', fontSize: 11 }}>—</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: sc.bg, color: sc.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {t.status !== 'pago' && (
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 10, padding: '3px 8px', gap: 3 }} onClick={() => openBaixa(t)} title="Registrar baixa">
                            <Check size={10} />Baixar
                          </button>
                        )}
                        {t.status === 'pago' && (
                          <button
                            title="Reverter Baixa"
                            className="btn btn-sm"
                            style={{ fontSize: 10, padding: '3px 8px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              // Reverter o título para pendente
                              setTitulos(prev => prev.map(x => x.id === t.id
                                ? { ...x, status: 'pendente' as const, pagamento: null as any, metodo: null as any, obs: undefined }
                                : x
                              ))
                              // Remover movimentação automática vinculada
                              setMovimentacoesManuais((prev: any) => prev.filter((m: any) => m.referenciaId !== t.id))
                            }}>
                            <RotateCcw size={10} />Reverter
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(t)} title="Editar">
                          <Pencil size={12} />
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#f87171' }} onClick={() => setConfirmId(t.id)} title="Excluir">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && titulos.length > 0 && (
            <div style={{ padding: '30px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum resultado — <button className="btn btn-ghost btn-sm" onClick={clearFilters}>limpar filtros</button>
            </div>
          )}
          <div style={{ padding: '10px 16px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            <span>{filtered.length} de {titulos.length} títulos</span>
            <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))' }}>Subtotal: {fmtCur(totalFiltrado)}</span>
          </div>
        </div>
      )}

      {/* ─── Modal de Seleção de Evento ─── */}
      {showEventoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(16,185,129,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Tag size={16} color="#60a5fa" /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Selecionar Evento</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{cfgEventos.filter(e => e.situacao === 'ativo').length} eventos ativos cadastrados</div>
                </div>
              </div>
              <button onClick={() => setShowEventoModal(false)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            {/* Busca interna */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Filtrar eventos..." value={eventoModalSearch} onChange={e => setEventoModalSearch(e.target.value)} autoFocus />
              </div>
            </div>
            {/* Lista */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {eventosFiltradosModal.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                  {cfgEventos.length === 0 ? 'Nenhum evento cadastrado. Acesse Configurações → Eventos.' : 'Nenhum evento encontrado.'}
                </div>
              ) : (
                eventosFiltradosModal.map(e => (
                  <div key={e.id}
                    onClick={() => {
                      setForm(p => ({ ...p, eventoId: e.id, eventoNome: e.descricao, eventoTipo: e.tipo, descricao: form.descricao || e.descricao }))
                      setShowEventoModal(false)
                    }}
                    style={{ padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 14, transition: 'background 0.1s' }}
                    onMouseEnter={el => (el.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
                    onMouseLeave={el => (el.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: e.tipo === 'receita' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: e.tipo === 'receita' ? '#10b981' : '#f59e0b' }}>{e.tipo === 'receita' ? 'R' : 'D'}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{e.descricao}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{e.tipo === 'receita' ? 'Receita' : 'Despesa'} · {e.situacao}</div>
                    </div>
                    <Check size={14} style={{ opacity: (form as any).eventoId === e.id ? 1 : 0, color: '#3b82f6' }} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Novo / Editar ─── */}
      {(modal === 'new' || modal === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(16,185,129,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{modal === 'new' ? 'Novo Título' : 'Editar Título'}</div>
                  {form.codigo && <code style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>{form.codigo}</code>}
                </div>
              </div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>
            {/* Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Aluno ── Typeahead */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ position: 'relative' }}>
                  <label className="form-label">Aluno *</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                    <input
                      className="form-input"
                      style={{ paddingLeft: 30 }}
                      value={alunoSearch}
                      onChange={e => {
                        setAlunoSearch(e.target.value); set('aluno', e.target.value)
                        setShowAlunoDrop(true)
                        if (!e.target.value) set('responsavel', '')
                      }}
                      onFocus={() => setShowAlunoDrop(true)}
                      onBlur={() => setTimeout(() => setShowAlunoDrop(false), 150)}
                      placeholder="Buscar aluno por nome..."
                    />
                    {alunoSearch && <button type="button" onClick={() => { setAlunoSearch(''); set('aluno', ''); set('responsavel', '') }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}><X size={12} /></button>}
                  </div>
                  {showAlunoDrop && alunosFiltrados.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: 4 }}>
                      {alunosFiltrados.map(a => (
                        <div key={a.id}
                          onMouseDown={() => {
                            setAlunoSearch(a.nome); set('aluno', a.nome)
                            if (a.responsavel) set('responsavel', a.responsavel)
                            setShowAlunoDrop(false)
                          }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{a.nome}</div>
                          {a.responsavel && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Resp: {a.responsavel}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {showAlunoDrop && alunosFiltrados.length === 0 && alunoSearch.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Aluno não encontrado — o nome ficará registrado como digitado</div>
                  )}
                </div>
                <div>
                  <label className="form-label">Responsável Financeiro</label>
                  <input className="form-input" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Auto-preenchido ao selecionar aluno" />
                </div>
              </div>

              {/* Evento (campo separado com modal) + Descrição */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Linha: botão selecionar evento */}
                <div>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag size={11} />Evento
                    {(form as any).eventoId && <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700 }}>✓ Vinculado</span>}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, padding: '9px 14px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, fontSize: 13, color: (form as any).eventoId ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(form as any).eventoNome ? (
                        <><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: (form as any).eventoTipo === 'receita' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: (form as any).eventoTipo === 'receita' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{(form as any).eventoTipo === 'receita' ? 'R' : 'D'}</span><span style={{ fontWeight: 600 }}>{(form as any).eventoNome}</span></>
                      ) : <span>Nenhum evento selecionado</span>}
                    </div>
                    <button type="button" className="btn btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                      onClick={() => { setEventoModalSearch(''); setShowEventoModal(true) }}>
                      <Search size={12} />Selecionar Evento
                    </button>
                    {(form as any).eventoId && (
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => setForm(p => ({ ...p, eventoId: '', eventoNome: '', eventoTipo: '' }))}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {/* Campo descrição livre */}
                <div>
                  <label className="form-label">Descrição *
                    <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 400, marginLeft: 6 }}>(complemento ao evento)</span>
                  </label>
                  <input className="form-input" value={form.descricao} onChange={e => set('descricao', e.target.value)}
                    placeholder="Ex: Mensalidade Março/2026, Matéria extra..." />
                </div>
              </div>

              {/* Valor + Vencimento + Método */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Valor (R$) *</label>
                  <input type="number" className="form-input" style={{ fontWeight: 800, color: '#34d399' }} value={form.valor || ''} onChange={e => { set('valor', +e.target.value); setPreviewParcelas([]) }} min={0} step={10} />
                </div>
                <div>
                  <label className="form-label">Vencimento *</label>
                  <input type="date" className="form-input" value={form.vencimento} onChange={e => { set('vencimento', e.target.value); setPreviewParcelas([]) }} />
                </div>
                <div>
                  <label className="form-label">Método de Pagamento</label>
                  <select className="form-input" value={form.metodo ?? ''} onChange={e => set('metodo', e.target.value || null)}>
                    <option value="">— Nenhum —</option>
                    {METODOS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Status + Data Pagamento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="atrasado">Atrasado</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Data de Pagamento</label>
                  <input type="date" className="form-input" value={form.pagamento ?? ''} onChange={e => set('pagamento', e.target.value || null)} />
                </div>
              </div>

              {/* ─── Gerador de Parcelas ─── */}
              {modal === 'new' && (
                <div style={{ borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => { setGerarParcelas(g => !g); setPreviewParcelas([]) }}
                      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: gerarParcelas ? '#3b82f6' : 'hsl(var(--border-default))', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: gerarParcelas ? 21 : 3, transition: 'left 0.2s' }} />
                    </button>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Gerar Parcelas</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Divide o valor em múltiplos títulos automaticamente</div>
                    </div>
                  </div>
                  {gerarParcelas && (
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
                        <div>
                          <label className="form-label">Qtd. de Parcelas</label>
                          <input type="number" className="form-input" min={2} max={60} value={numParcelas}
                            onChange={e => { setNumParcelas(+e.target.value); setPreviewParcelas([]) }} />
                        </div>
                        <div>
                          <label className="form-label">1ª data de vencimento</label>
                          <input type="date" className="form-input" value={dataInicioParcelas}
                            onChange={e => { setDataInicioParcelas(e.target.value); setPreviewParcelas([]) }} />
                        </div>
                        <div>
                          <label className="form-label">Modo</label>
                          <select className="form-input" value={modoParcelas} onChange={e => { setModoParcelas(e.target.value as any); setPreviewParcelas([]) }}>
                            <option value="corridos">30 dias corridos</option>
                            <option value="mesmo_dia">Mesmo dia do mês</option>
                          </select>
                        </div>
                        <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={calcParcelas}
                          disabled={!form.valor || !dataInicioParcelas}>
                          <Layers size={12} />Preview
                        </button>
                      </div>
                      {previewParcelas.length > 0 && (
                        <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, overflow: 'hidden', maxHeight: 180, overflowY: 'auto' }}>
                          <table style={{ width: '100%', fontSize: 12 }}>
                            <thead><tr style={{ background: 'hsl(var(--bg-elevated))' }}><th style={{ padding: '7px 12px', textAlign: 'left' }}>Parcela</th><th style={{ padding: '7px 12px', textAlign: 'left' }}>Vencimento</th><th style={{ padding: '7px 12px', textAlign: 'right' }}>Valor</th></tr></thead>
                            <tbody>
                              {previewParcelas.map(p => (
                                <tr key={p.num}>
                                  <td style={{ padding: '6px 12px' }}>{p.num}/{previewParcelas.length}</td>
                                  <td style={{ padding: '6px 12px' }}>{new Date(p.venc + 'T12:00').toLocaleDateString('pt-BR')}</td>
                                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>{fmtCur(p.valor)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot><tr style={{ borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))' }}>
                              <td colSpan={2} style={{ padding: '7px 12px', fontWeight: 800 }}>Total</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 900, color: '#34d399' }}>{fmtCur(previewParcelas.reduce((s, p) => s + p.valor, 0))}</td>
                            </tr></tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'hsl(var(--bg-elevated))', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                {gerarParcelas && previewParcelas.length > 0 && (
                  <span style={{ color: '#3b82f6', fontWeight: 700 }}>📅 {previewParcelas.length} parcelas serão criadas</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!form.aluno || !form.vencimento || (gerarParcelas && previewParcelas.length === 0)}>
                  <Check size={14} />{gerarParcelas && previewParcelas.length > 0 ? `Criar ${previewParcelas.length} Parcelas` : modal === 'new' ? 'Registrar Título' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Baixa Premium ─── */}
      {modal === 'baixa' && selectedTitulo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 520, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}>
            <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(6,182,212,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Registrar Baixa</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{selectedTitulo.aluno} — {selectedTitulo.descricao}</div>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Info do título */}
              <div style={{ padding: '12px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Valor original</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#34d399', fontFamily: 'Outfit,sans-serif' }}>{fmtCur(selectedTitulo.valor)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Vencimento</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(selectedTitulo.vencimento)}</div>
                  {selectedTitulo.status === 'atrasado' && (
                    <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 800 }}>{diasAtraso(selectedTitulo.vencimento)}d em atraso</div>
                  )}
                </div>
              </div>

              {/* Caixa — obrigatório */}
              {(() => {
                const cxAtivos = caixasAbertos.filter(c => !c.fechado)
                return (
                  <div style={{ padding: '10px 14px', background: !baixaForm.caixaId ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.06)', border: `1px solid ${!baixaForm.caixaId ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.25)'}`, borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 18 }}>🏦</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 3, letterSpacing: .5 }}>CAIXA *</div>
                      {cxAtivos.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>⚠ Nenhum caixa aberto. Acesse Administrativo → Abertura de Caixa.</div>
                      ) : (
                        <select className="form-input" style={{ fontSize: 12, fontWeight: 700 }} value={baixaForm.caixaId}
                          onChange={e => setBaixaForm(p => ({ ...p, caixaId: e.target.value }))}>
                          <option value="">— Selecionar caixa —</option>
                          {cxAtivos.map(c => (
                            <option key={c.id} value={c.id}>{c.nomeCaixa || 'Caixa'} · {new Date(c.dataAbertura + 'T12:00').toLocaleDateString('pt-BR')} ({c.operador})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )
              })()}

              <div>
                <label className="form-label">Método de Pagamento</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {metodosSelect.map(m => (
                    <button key={m} onClick={() => setBaixaForm(p => ({ ...p, metodo: m }))}
                      style={{ padding: '8px 6px', borderRadius: 8, border: `2px solid ${baixaForm.metodo === m ? '#10b981' : 'hsl(var(--border-subtle))'}`, background: baixaForm.metodo === m ? 'rgba(16,185,129,0.1)' : 'transparent', color: baixaForm.metodo === m ? '#10b981' : 'hsl(var(--text-muted))', fontWeight: 600, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Data de Pagamento</label>
                  <input type="date" className="form-input" value={baixaForm.dataPagamento} onChange={e => setBaixaForm(p => ({ ...p, dataPagamento: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Valor Recebido (R$)</label>
                  <input type="number" className="form-input" style={{ fontWeight: 800, color: '#10b981' }} value={baixaForm.valorPago} onChange={e => setBaixaForm(p => ({ ...p, valorPago: +e.target.value }))} min={0} step={0.01} />
                </div>
              </div>

              <div>
                <label className="form-label">Observação</label>
                <input className="form-input" value={baixaForm.obs} onChange={e => setBaixaForm(p => ({ ...p, obs: e.target.value }))} placeholder="Comprovante, referência, anotações..." />
              </div>

              {baixaForm.valorPago > 0 && baixaForm.valorPago !== selectedTitulo.valor && (
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: '#f59e0b' }}>
                  ⚠ Valor difere do original: <strong>{fmtCur(selectedTitulo.valor - baixaForm.valorPago)}</strong> de diferença
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-success" onClick={handleBaixa} disabled={!baixaForm.caixaId || !baixaForm.dataPagamento}>
                <CheckCircle size={14} />Confirmar Baixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm Delete ─── */}
      {confirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 14, width: 360, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
            <div style={{ padding: '14px 24px', background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid hsl(var(--border-subtle))', fontWeight: 700, color: '#f87171', display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <AlertTriangle size={15} />Excluir Título
            </div>
            <div style={{ padding: '18px 24px', fontSize: 13, color: 'hsl(var(--text-muted))' }}>Este título será excluído permanentemente.</div>
            <div style={{ padding: '12px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={13} />Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
