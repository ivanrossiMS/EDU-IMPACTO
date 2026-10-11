'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDate } from '@/lib/utils'
import { useData, ConfigPadraoPagamento, ParcelaPadrao, newId, ConfigEvento, Turma } from '@/lib/dataContext'
import { useConfigDb } from '@/lib/useConfigDb'
import { useState, useMemo, useEffect } from 'react'
import {
  Plus, Edit2, Trash2, Check, Zap, ChevronDown, ChevronRight,
  DollarSign, Search, Filter, Tag, X, CalendarDays, School,
  CheckSquare, Square, Layers, BookOpen, AlertCircle, Sparkles
} from 'lucide-react'

const SEGMENTOS = ['EI', 'EF1', 'EF2', 'EM', 'EJA']
const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i)

const BLANK_FORM = {
  codigo: '',
  nome: '',
  totalParcelas: 12,
  anuidade: 12000,
  ano: '' as number | '',
  diaVencimento: 10,
  segmento: '',
  situacao: 'ativo' as 'ativo' | 'inativo',
  descontoTipo: 'reais' as 'reais' | 'percentual',
  descontoValor: 0,
  eventoId: '',
  eventoDescricao: '',
  turmaIds: [] as string[],
}

function gerarParcelas(
  anuidade: number, totalParcelas: number, ano: number, diaVencimento: number,
  descontoTipo: 'reais' | 'percentual' = 'reais', descontoValor = 0,
  eventoId = '', eventoDescricao = ''
): ParcelaPadrao[] {
  const safeParcelas = totalParcelas > 0 ? totalParcelas : 1
  const valorBase = anuidade / safeParcelas
  const anoBase = ano || new Date().getFullYear()
  return Array.from({ length: safeParcelas }, (_, i) => {
    const mes = i + 1
    const yr = mes > 12 ? anoBase + 1 : anoBase
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

const fmtCurrency = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function matchTurmaSegmento(turma: Turma, seg: string): boolean {
  if (!seg) return true
  const raw = (((turma as any).dados?.segmento || (turma as any).segmento || turma.serie || '') as string).toLowerCase()
  const s = seg.toLowerCase()
  if (s === 'ei') return raw.includes('infantil') || raw.includes('ei') || raw.includes('creche') || raw.includes('maternal') || raw.includes('pré')
  if (s === 'ef1') return raw.includes('fundamental i') || raw.includes('fundamental 1') || raw.includes('ef1') || raw.includes('1º ano') || raw.includes('2º ano') || raw.includes('3º ano') || raw.includes('4º ano') || raw.includes('5º ano')
  if (s === 'ef2') return raw.includes('fundamental ii') || raw.includes('fundamental 2') || raw.includes('ef2') || raw.includes('6º ano') || raw.includes('7º ano') || raw.includes('8º ano') || raw.includes('9º ano')
  if (s === 'em') return raw.includes('médio') || raw.includes('medio') || raw.includes('em') || raw.includes('1ª série') || raw.includes('2ª série') || raw.includes('3ª série')
  if (s === 'eja') return raw.includes('eja')
  return raw.includes(s)
}

export default function PadraoPagamentoPage() {
  const { data: cfgPadroesPagamento, setData: setCfgPadroesPagamento } = useConfigDb<ConfigPadraoPagamento>('cfgPadroesPagamento')
  const { data: cfgEventos } = useConfigDb<ConfigEvento>('cfgEventos')
  const { turmas: contextTurmas, setTurmas } = useData()

  // Fallback para turmas via API
  const [apiTurmas, setApiTurmas] = useState<Turma[]>([])
  useEffect(() => {
    fetch('/api/turmas?all=true')
      .then(r => r.json())
      .then(res => {
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          setApiTurmas(res.data)
        }
      })
      .catch(() => {})
  }, [])

  const turmasList: Turma[] = useMemo(() => {
    if (contextTurmas && contextTurmas.length > 0) return contextTurmas
    return apiTurmas
  }, [contextTurmas, apiTurmas])

  // Form state
  const [form, setForm] = useState(BLANK_FORM)
  const [parcelas, setParcelas] = useState<ParcelaPadrao[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [gerou, setGerou] = useState(false)

  // Turmas filter inside modal
  const [modalTurmaSearch, setModalTurmaSearch] = useState('')
  const [modalTurmaTab, setModalTurmaTab] = useState<'todas' | 'segmento' | 'selecionadas'>('todas')

  // Filtros da listagem principal
  const [filtroAno, setFiltroAno] = useState<number | 'todos'>('todos')
  const [filtroSegmento, setFiltroSegmento] = useState('todos')
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [filtroTurma, setFiltroTurma] = useState<string>('todos')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Modal seletor de evento
  const [showEventoPicker, setShowEventoPicker] = useState(false)
  const [eventoSearch, setEventoSearch] = useState('')
  const eventosFiltrados = useMemo(() => {
    const q = eventoSearch.toLowerCase()
    return (cfgEventos || []).filter(e =>
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

  // Filtro aplicado na listagem
  const filtered = useMemo(() => cfgPadroesPagamento.filter(pp => {
    const matchAno = filtroAno === 'todos' || pp.ano === filtroAno
    const matchSeg = filtroSegmento === 'todos' || (pp as any).segmento === filtroSegmento
    const matchSit = filtroSituacao === 'todos' || pp.situacao === filtroSituacao
    const matchSearch = search.trim().length < 2 || (
      !search ||
      pp.nome.toLowerCase().includes(search.toLowerCase()) ||
      pp.codigo?.toLowerCase().includes(search.toLowerCase())
    )
    const matchTurma = filtroTurma === 'todos' || (
      (pp.turmaIds && pp.turmaIds.includes(filtroTurma)) ||
      ((pp as any).turma && turmasList.find(t => t.id === filtroTurma)?.nome === (pp as any).turma)
    )
    return matchAno && matchSeg && matchSit && matchSearch && matchTurma
  }), [cfgPadroesPagamento, filtroAno, filtroSegmento, filtroSituacao, filtroTurma, search, turmasList])

  const openNew = () => {
    setEditId(null)
    setForm({
      ...BLANK_FORM,
      codigo: gerarCodPP(),
      ano: '' as any, // Começa vazio para obrigar a seleção do ano letivo
      turmaIds: [],
    })
    setParcelas([])
    setGerou(false)
    setModalTurmaSearch('')
    setModalTurmaTab('todas')
    setShowModal(true)
  }

  const openEdit = (pp: ConfigPadraoPagamento) => {
    setEditId(pp.id)
    
    // Recupera turmas vinculadas (ou mapeia do campo legado 'turma')
    let ids: string[] = []
    if (Array.isArray(pp.turmaIds) && pp.turmaIds.length > 0) {
      ids = pp.turmaIds
    } else if ((pp as any).turma) {
      const match = turmasList.find(t => t.nome === (pp as any).turma || t.codigo === (pp as any).turma)
      if (match) ids = [match.id]
    }

    setForm({
      codigo: (pp as any).codigo ?? '',
      nome: pp.nome,
      totalParcelas: pp.totalParcelas,
      anuidade: pp.anuidade,
      ano: pp.ano || new Date().getFullYear(),
      diaVencimento: pp.diaVencimento,
      segmento: (pp as any).segmento ?? '',
      situacao: pp.situacao,
      descontoTipo: (pp as any).descontoTipo ?? 'reais',
      descontoValor: (pp as any).descontoValor ?? 0,
      eventoId: (pp as any).eventoId ?? '',
      eventoDescricao: (pp as any).eventoDescricao ?? '',
      turmaIds: ids,
    })
    setParcelas([...(pp.parcelas || [])])
    setGerou((pp.parcelas || []).length > 0)
    setModalTurmaSearch('')
    setModalTurmaTab('todas')
    setShowModal(true)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este padrão de pagamento?')) return
    setCfgPadroesPagamento(prev => prev.filter(p => p.id !== id))
    if (setTurmas) {
      setTurmas(prev => prev.map(t => ({
        ...t,
        padraoPagamentoIds: (t.padraoPagamentoIds || []).filter(pid => pid !== id)
      })))
    }
  }

  const handleGerar = () => {
    if (!form.anuidade || !form.totalParcelas) return
    const anoCalc = Number(form.ano) || new Date().getFullYear()
    const novas = gerarParcelas(
      form.anuidade, form.totalParcelas, anoCalc, form.diaVencimento,
      form.descontoTipo, form.descontoValor,
      form.eventoId, form.eventoDescricao,
    )
    setParcelas(novas)
    setGerou(true)
  }

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

  // Manipulação de mudança de Ano Letivo
  const handleAnoChange = (newAno: number | '') => {
    setForm(prev => {
      // Filtra as turmas já selecionadas para manter apenas as que pertencem ao novo ano selecionado
      const validTurmaIds = newAno
        ? prev.turmaIds.filter(id => {
            const t = turmasList.find(item => item.id === id)
            return t && Number(t.ano) === Number(newAno)
          })
        : []
      return {
        ...prev,
        ano: newAno,
        turmaIds: validTurmaIds
      }
    })
  }

  // Toggle de seleção de turma
  const toggleTurma = (id: string) => {
    setForm(p => ({
      ...p,
      turmaIds: p.turmaIds.includes(id)
        ? p.turmaIds.filter(tId => tId !== id)
        : [...p.turmaIds, id]
    }))
  }

  const selectAllTurmasVisiveis = (ids: string[]) => {
    setForm(p => ({
      ...p,
      turmaIds: Array.from(new Set([...p.turmaIds, ...ids]))
    }))
  }

  const deselectAllTurmasVisiveis = (ids: string[]) => {
    setForm(p => ({
      ...p,
      turmaIds: p.turmaIds.filter(id => !ids.includes(id))
    }))
  }

  // Turmas filtradas para exibição no modal — OBRIGATORIAMENTE DO ANO SELECIONADO
  const turmasDoAno = useMemo(() => {
    if (!form.ano) return []
    return turmasList.filter(t => Number(t.ano) === Number(form.ano))
  }, [turmasList, form.ano])

  const turmasDoSegmento = useMemo(() => {
    if (!form.ano || !form.segmento) return []
    return turmasDoAno.filter(t => matchTurmaSegmento(t, form.segmento))
  }, [turmasDoAno, form.segmento, form.ano])

  const turmasNoModal = useMemo(() => {
    if (!form.ano) return []
    return turmasDoAno.filter(t => {
      if (modalTurmaTab === 'segmento' && form.segmento) {
        if (!matchTurmaSegmento(t, form.segmento)) return false
      }
      if (modalTurmaTab === 'selecionadas' && !form.turmaIds.includes(t.id)) {
        return false
      }
      if (modalTurmaSearch.trim()) {
        const q = modalTurmaSearch.toLowerCase()
        const matchNome = (t.nome || '').toLowerCase().includes(q)
        const matchSerie = (t.serie || '').toLowerCase().includes(q)
        const matchTurno = (t.turno || '').toLowerCase().includes(q)
        const matchCod = (t.codigo || '').toLowerCase().includes(q)
        if (!matchNome && !matchSerie && !matchTurno && !matchCod) return false
      }
      return true
    })
  }, [turmasDoAno, modalTurmaTab, modalTurmaSearch, form.segmento, form.turmaIds, form.ano])

  const handleSave = () => {
    if (!form.ano) {
      alert('Por favor, selecione o Ano Letivo do padrão de pagamento.')
      return
    }
    if (!form.nome.trim()) {
      alert('Por favor, informe o nome do padrão de pagamento.')
      return
    }

    const codigo = editId ? form.codigo : gerarCodPP()
    const anoFinal = Number(form.ano)
    const parcelasParaSalvar = parcelas.length > 0
      ? parcelas.map(p => ({
          ...p,
          eventoId: p.eventoId ?? form.eventoId,
          eventoDescricao: p.eventoDescricao ?? form.eventoDescricao,
        }))
      : gerarParcelas(
          form.anuidade, form.totalParcelas, anoFinal, form.diaVencimento,
          form.descontoTipo, form.descontoValor,
          form.eventoId, form.eventoDescricao,
        )

    const selectedTurmasObjects = turmasList.filter(t => form.turmaIds.includes(t.id))
    const selectedTurmasNames = selectedTurmasObjects.map(t => t.nome)
    const targetId = editId || newId('PP')

    const payload: ConfigPadraoPagamento = {
      id: targetId,
      codigo,
      nome: form.nome.trim(),
      totalParcelas: form.totalParcelas,
      anuidade: form.anuidade,
      ano: anoFinal,
      diaVencimento: form.diaVencimento,
      segmento: form.segmento,
      situacao: form.situacao,
      descontoTipo: form.descontoTipo,
      descontoValor: form.descontoValor,
      eventoId: form.eventoId,
      eventoDescricao: form.eventoDescricao,
      turmaIds: form.turmaIds,
      turmas: selectedTurmasNames,
      parcelas: parcelasParaSalvar,
      createdAt: editId ? (cfgPadroesPagamento.find(p => p.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    }

    if (editId) {
      setCfgPadroesPagamento(prev => prev.map(p => p.id === editId ? payload : p))
    } else {
      setCfgPadroesPagamento(prev => [...prev, payload])
    }

    // Sincronização com turmas
    if (setTurmas && turmasList.length > 0) {
      setTurmas(prev => prev.map(t => {
        const isSelected = form.turmaIds.includes(t.id)
        const currentPads = t.padraoPagamentoIds || []
        if (isSelected && !currentPads.includes(targetId)) {
          return { ...t, padraoPagamentoIds: [...currentPads, targetId] }
        }
        if (!isSelected && currentPads.includes(targetId)) {
          return { ...t, padraoPagamentoIds: currentPads.filter(id => id !== targetId) }
        }
        return t
      }))
    }

    setShowModal(false)
    setGerou(false)
    setParcelas([])
  }

  const totalDesconto = parcelas.reduce((s, p) => s + p.desconto, 0)
  const totalLiquido = parcelas.reduce((s, p) => s + p.valor - p.desconto, 0)

  // Atalho teclado ESC para fechar modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEventoPicker) {
          setShowEventoPicker(false)
        } else if (showModal) {
          setShowModal(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showModal, showEventoPicker])

  return (
    <>
      {/* ── MODAL SELETOR DE EVENTO FINANCEIRO ── */}
      <AnimatePresence>
        {showEventoPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              padding: '20px',
              backdropFilter: 'blur(5px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                background: 'hsl(var(--bg-surface))',
                borderRadius: 18,
                width: '100%',
                maxWidth: 560,
                border: '1px solid hsl(var(--border-default))',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--bg-elevated))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarDays size={18} color="#818cf8" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Selecionar Evento Financeiro</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Vincule as parcelas a um evento já cadastrado</div>
                  </div>
                </div>
                <button type="button" onClick={() => setShowEventoPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '14px 20px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input
                    autoFocus
                    className="form-input"
                    style={{ paddingLeft: 34 }}
                    placeholder="Buscar por descrição ou código..."
                    value={eventoSearch}
                    onChange={e => setEventoSearch(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 12px' }}>
                {eventosFiltrados.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                    <CalendarDays size={36} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                    <div>Nenhum evento ativo encontrado</div>
                    {eventoSearch && <div style={{ fontSize: 11, marginTop: 4 }}>Tente outro termo de busca</div>}
                  </div>
                ) : eventosFiltrados.map(ev => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => {
                      setForm(p => ({ ...p, eventoId: ev.id, eventoDescricao: ev.descricao }))
                      setShowEventoPicker(false)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      marginBottom: 6,
                      border: `1px solid ${form.eventoId === ev.id ? 'rgba(99,102,241,0.5)' : 'hsl(var(--border-subtle))'}`,
                      borderRadius: 10,
                      background: form.eventoId === ev.id ? 'rgba(99,102,241,0.1)' : 'hsl(var(--bg-elevated))',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                      transition: 'all 0.12s',
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: ev.tipo === 'receita' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: ev.tipo === 'receita' ? '#10b981' : '#ef4444' }}>{ev.tipo === 'receita' ? '↑' : '↓'}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{ev.descricao}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <code style={{ fontSize: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', padding: '1px 6px', borderRadius: 4 }}>{ev.codigo}</code>
                        <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, fontWeight: 600, background: ev.tipo === 'receita' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: ev.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                          {ev.tipo === 'receita' ? 'Receita' : 'Despesa'}
                        </span>
                      </div>
                    </div>
                    {form.eventoId === ev.id && <Check size={16} color="#818cf8" />}
                  </button>
                ))}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-elevated))' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForm(p => ({ ...p, eventoId: '', eventoDescricao: '' })); setShowEventoPicker(false) }}>
                  <X size={12} />Limpar seleção
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEventoPicker(false)}>
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL PRINCIPAL: ADICIONAR / EDITAR PADRÃO DE PAGAMENTO ── */}
      <AnimatePresence>
        {showModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(5px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !showEventoPicker) {
                setShowModal(false)
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              style={{
                background: 'hsl(var(--bg-surface))',
                borderRadius: 20,
                width: '100%',
                maxWidth: 960,
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid hsl(var(--border-default))',
                boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.75)',
                overflow: 'hidden',
              }}
            >
              {/* Header do Modal */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'hsl(var(--bg-elevated))',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: editId ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: editId ? '#60a5fa' : '#34d399',
                    }}
                  >
                    {editId ? <Edit2 size={20} /> : <Plus size={20} />}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                      {editId ? 'Editar Padrão de Pagamento' : 'Novo Padrão de Pagamento'}
                    </h2>
                    <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0, marginTop: 2 }}>
                      {editId ? `Atualize as configurações e turmas do template ${form.codigo}` : 'Defina o ano letivo, configure os valores e vincule às turmas'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-ghost btn-icon btn-sm"
                  style={{ borderRadius: 8 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Corpo do Modal com Scroll */}
              <div
                style={{
                  padding: '22px 24px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                {/* 1. DADOS GERAIS & ANO LETIVO */}
                <div style={{ padding: '18px 20px', borderRadius: 14, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#60a5fa', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag size={14} /> Informações Básicas & Ano Letivo
                  </div>

                  {/* Linha 1: Ano Letivo, Código, Nome do Padrão, Situação */}
                  <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr 130px', gap: 12, marginBottom: 12 }}>
                    {/* Ano Letivo */}
                    <div>
                      <label className="form-label" style={{ fontWeight: 800, color: form.ano ? '#60a5fa' : '#f59e0b', whiteSpace: 'nowrap' }}>
                        Ano Letivo *
                      </label>
                      <select
                        className="form-input"
                        value={form.ano || ''}
                        onChange={e => handleAnoChange(e.target.value ? Number(e.target.value) : '')}
                        style={{
                          fontWeight: 800,
                          borderColor: !form.ano ? '#f59e0b' : '#3b82f6',
                          background: !form.ano ? 'rgba(245,158,11,0.08)' : 'hsl(var(--bg-base))',
                          color: !form.ano ? '#f59e0b' : 'inherit',
                        }}
                      >
                        <option value="">Selecione...</option>
                        {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>

                    {/* Código */}
                    <div>
                      <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Código</label>
                      <div style={{ display: 'flex', alignItems: 'center', height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-base))' }}>
                        <span style={{ padding: '0 6px', fontSize: 10, color: 'hsl(var(--text-muted))', borderRight: '1px solid hsl(var(--border-subtle))', height: '100%', display: 'flex', alignItems: 'center' }}>AUTO</span>
                        <span style={{ padding: '0 8px', fontWeight: 900, fontSize: 12, fontFamily: 'monospace', color: '#60a5fa' }}>{codigoPreview}</span>
                      </div>
                    </div>

                    {/* Nome do Padrão */}
                    <div>
                      <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Nome do Padrão *</label>
                      <input
                        className="form-input"
                        value={form.nome}
                        onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                        placeholder="Ex: Mensalidade 2026 — Ensino Fundamental I (12x)"
                      />
                    </div>

                    {/* Situação */}
                    <div>
                      <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Situação</label>
                      <select
                        className="form-input"
                        value={form.situacao}
                        onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}
                      >
                        <option value="ativo">✓ Ativo</option>
                        <option value="inativo">✗ Inativo</option>
                      </select>
                    </div>
                  </div>

                  {/* Linha 2: Segmento e Evento Financeiro */}
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Segmento</label>
                      <select
                        className="form-input"
                        value={form.segmento}
                        onChange={e => setForm(p => ({ ...p, segmento: e.target.value }))}
                      >
                        <option value="">Todos os Segmentos</option>
                        {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap' }}>
                        <span>Evento Financeiro Vinculado</span>
                        <span style={{ fontSize: 10, fontWeight: 400, color: 'hsl(var(--text-muted))' }}>(Opcional)</span>
                      </label>

                      {form.eventoId ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, height: 38 }}>
                          <CalendarDays size={15} color="#818cf8" />
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>{form.eventoDescricao}</span>
                            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginLeft: 8 }}>
                              #{cfgEventos?.find(e => e.id === form.eventoId)?.codigo || ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setForm(p => ({ ...p, eventoId: '', eventoDescricao: '' }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 2, display: 'flex' }}
                            title="Remover evento"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEventoSearch(''); setShowEventoPicker(true) }}
                          style={{
                            width: '100%',
                            height: 38,
                            padding: '0 12px',
                            border: '1px dashed hsl(var(--border-default))',
                            borderRadius: 8,
                            background: 'hsl(var(--bg-base))',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            color: 'hsl(var(--text-muted))',
                            fontSize: 12,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#818cf8' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = '' }}
                        >
                          <CalendarDays size={14} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Selecionar evento financeiro...</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 8px', background: 'rgba(99,102,241,0.1)', borderRadius: 20, color: '#818cf8', fontWeight: 600, flexShrink: 0 }}>
                            {cfgEventos?.filter(e => e.situacao === 'ativo').length || 0} disp.
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. VALORES, PARCELAMENTO & DATAS */}
                <div style={{ padding: '18px 20px', borderRadius: 14, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#34d399', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DollarSign size={14} /> Valores & Condições de Parcelamento
                  </div>

                  {/* 4 colunas bem distribuídas e sem sobreposição */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 100px 120px 1.4fr', gap: 14, marginBottom: 14 }}>
                    {/* Anuidade Total */}
                    <div>
                      <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Anuidade Total (R$) *</label>
                      <input
                        className="form-input"
                        type="number"
                        min={0}
                        step={100}
                        value={form.anuidade || ''}
                        onChange={e => setForm(p => ({ ...p, anuidade: +e.target.value }))}
                        style={{ fontWeight: 800, color: '#34d399', fontSize: 14 }}
                      />
                    </div>

                    {/* Parcelas */}
                    <div>
                      <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Parcelas *</label>
                      <input
                        className="form-input"
                        type="number"
                        min={1}
                        max={36}
                        value={form.totalParcelas || ''}
                        onChange={e => setForm(p => ({ ...p, totalParcelas: +e.target.value }))}
                        style={{ fontWeight: 700 }}
                      />
                    </div>

                    {/* Dia Vencimento */}
                    <div>
                      <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Dia Vcto *</label>
                      <input
                        className="form-input"
                        type="number"
                        min={1}
                        max={28}
                        value={form.diaVencimento || ''}
                        onChange={e => setForm(p => ({ ...p, diaVencimento: +e.target.value }))}
                        style={{ fontWeight: 700 }}
                      />
                    </div>

                    {/* Desconto Global */}
                    <div>
                      <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Desconto Global (Opcional)</label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', flexShrink: 0, height: 38 }}>
                          <button
                            type="button"
                            onClick={() => setForm(p => ({ ...p, descontoTipo: 'reais' }))}
                            style={{
                              padding: '0 10px',
                              fontSize: 11,
                              fontWeight: 800,
                              background: form.descontoTipo === 'reais' ? '#60a5fa' : 'transparent',
                              color: form.descontoTipo === 'reais' ? '#fff' : 'hsl(var(--text-muted))',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            R$
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm(p => ({ ...p, descontoTipo: 'percentual' }))}
                            style={{
                              padding: '0 10px',
                              fontSize: 11,
                              fontWeight: 800,
                              background: form.descontoTipo === 'percentual' ? '#f59e0b' : 'transparent',
                              color: form.descontoTipo === 'percentual' ? '#fff' : 'hsl(var(--text-muted))',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            %
                          </button>
                        </div>
                        <input
                          className="form-input"
                          type="number"
                          step={0.01}
                          min={0}
                          max={form.descontoTipo === 'percentual' ? 100 : undefined}
                          value={form.descontoValor || ''}
                          onChange={e => setForm(p => ({ ...p, descontoValor: +e.target.value }))}
                          style={{ fontWeight: 800, color: '#f59e0b', flex: 1, minWidth: 70 }}
                          placeholder={form.descontoTipo === 'percentual' ? '0%' : '0,00'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Barra rápida de simulação */}
                  <div
                    style={{
                      padding: '12px 18px',
                      background: 'rgba(59,130,246,0.06)',
                      borderRadius: 10,
                      border: '1px solid rgba(59,130,246,0.15)',
                      display: 'flex',
                      gap: 20,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Valor Mensal: </span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit, sans-serif' }}>
                        {fmtCurrency(form.anuidade / (form.totalParcelas || 1))}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Anuidade: </span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#34d399' }}>{fmtCurrency(form.anuidade)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Parcelas: </span>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{form.totalParcelas}x</span>
                    </div>
                    {form.descontoValor > 0 && (
                      <div>
                        <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Desconto/mês: </span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>
                          {form.descontoTipo === 'percentual'
                            ? `${form.descontoValor}% (${fmtCurrency((form.anuidade / (form.totalParcelas || 1) * form.descontoValor) / 100)})`
                            : fmtCurrency(form.descontoValor)}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                      onClick={handleGerar}
                    >
                      <Zap size={14} />
                      {gerou ? 'Regerar Parcelas' : 'Gerar Parcelas'}
                    </button>
                  </div>
                </div>

                {/* 3. VÍNCULO COM AS TURMAS — CONDICIONADO AO ANO LETIVO */}
                <div
                  style={{
                    padding: '18px 20px',
                    borderRadius: 14,
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <School size={16} color="#60a5fa" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>
                          Vínculo com as Turmas {form.ano ? `(Ano Letivo ${form.ano})` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                          {form.ano
                            ? `Selecione as turmas de ${form.ano} que utilizarão este padrão como base na matrícula`
                            : 'Selecione o ano letivo no topo para visualizar as turmas correspondentes'}
                        </div>
                      </div>
                    </div>

                    {form.ano && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 12px',
                          borderRadius: 20,
                          background: form.turmaIds.length > 0 ? 'rgba(59,130,246,0.15)' : 'hsl(var(--bg-base))',
                          color: form.turmaIds.length > 0 ? '#60a5fa' : 'hsl(var(--text-muted))',
                          border: `1px solid ${form.turmaIds.length > 0 ? 'rgba(59,130,246,0.3)' : 'hsl(var(--border-subtle))'}`,
                        }}
                      >
                        {form.turmaIds.length} turma(s) selecionada(s) de {turmasDoAno.length}
                      </span>
                    )}
                  </div>

                  {!form.ano ? (
                    /* Estado de Bloqueio Amigável: Exige primeiro a seleção do Ano Letivo */
                    <div
                      style={{
                        padding: '36px 20px',
                        textAlign: 'center',
                        background: 'hsl(var(--bg-base))',
                        borderRadius: 12,
                        border: '1px dashed hsl(var(--border-default))',
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background: 'rgba(99,102,241,0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 12px',
                        }}
                      >
                        <CalendarDays size={24} color="#818cf8" />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                        Primeiro, selecione o Ano Letivo
                      </div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', maxWidth: 440, margin: '0 auto 16px', lineHeight: 1.5 }}>
                        Para carregar as turmas certas e evitar vínculos cruzados entre anos diferentes, escolha o <strong>Ano Letivo</strong> acima.
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {ANOS.map(a => (
                          <button
                            key={a}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12, fontWeight: 700 }}
                            onClick={() => handleAnoChange(a)}
                          >
                            Definir Ano {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Turmas do Ano Letivo Carregadas */
                    <>
                      {/* Chips das turmas selecionadas */}
                      {form.turmaIds.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginBottom: 12,
                            maxHeight: 80,
                            overflowY: 'auto',
                            padding: '8px',
                            background: 'hsl(var(--bg-base))',
                            borderRadius: 8,
                            border: '1px solid hsl(var(--border-subtle))',
                          }}
                        >
                          {form.turmaIds.map(tId => {
                            const t = turmasList.find(item => item.id === tId)
                            return (
                              <span
                                key={tId}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: 'rgba(59,130,246,0.15)',
                                  color: '#60a5fa',
                                  border: '1px solid rgba(59,130,246,0.25)',
                                }}
                              >
                                <span>{t?.nome || tId}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleTurma(tId)}
                                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                  title="Remover turma"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* Toolbar de filtro das turmas */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                          <input
                            className="form-input"
                            style={{ paddingLeft: 30, height: 34, fontSize: 12 }}
                            placeholder={`Buscar turma de ${form.ano} por nome, série, turno...`}
                            value={modalTurmaSearch}
                            onChange={e => setModalTurmaSearch(e.target.value)}
                          />
                        </div>

                        {/* Tabs rápidas */}
                        <div style={{ display: 'flex', gap: 4, background: 'hsl(var(--bg-base))', padding: 3, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                          <button
                            type="button"
                            onClick={() => setModalTurmaTab('todas')}
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 6,
                              border: 'none',
                              cursor: 'pointer',
                              background: modalTurmaTab === 'todas' ? 'hsl(var(--bg-elevated))' : 'transparent',
                              color: modalTurmaTab === 'todas' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))',
                            }}
                          >
                            Todas do Ano ({turmasDoAno.length})
                          </button>

                          {form.segmento && (
                            <button
                              type="button"
                              onClick={() => setModalTurmaTab('segmento')}
                              style={{
                                padding: '4px 10px',
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 6,
                                border: 'none',
                                cursor: 'pointer',
                                background: modalTurmaTab === 'segmento' ? 'hsl(var(--bg-elevated))' : 'transparent',
                                color: modalTurmaTab === 'segmento' ? '#f59e0b' : 'hsl(var(--text-muted))',
                              }}
                            >
                              {form.segmento} ({turmasDoSegmento.length})
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setModalTurmaTab('selecionadas')}
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 6,
                              border: 'none',
                              cursor: 'pointer',
                              background: modalTurmaTab === 'selecionadas' ? 'hsl(var(--bg-elevated))' : 'transparent',
                              color: modalTurmaTab === 'selecionadas' ? '#34d399' : 'hsl(var(--text-muted))',
                            }}
                          >
                            Selecionadas ({form.turmaIds.length})
                          </button>
                        </div>

                        {/* Ações em lote */}
                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => selectAllTurmasVisiveis(turmasNoModal.map(t => t.id))}
                            title="Marcar todas as turmas visíveis nesta lista"
                          >
                            <CheckSquare size={12} /> Marcar visíveis ({turmasNoModal.length})
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '4px 8px', color: '#f87171' }}
                            onClick={() => deselectAllTurmasVisiveis(turmasNoModal.map(t => t.id))}
                            title="Desmarcar todas as turmas visíveis"
                          >
                            <Square size={12} /> Desmarcar
                          </button>
                        </div>
                      </div>

                      {/* Grade de Turmas com Checkboxes */}
                      <div
                        style={{
                          maxHeight: 220,
                          overflowY: 'auto',
                          padding: '6px',
                          background: 'hsl(var(--bg-base))',
                          borderRadius: 10,
                          border: '1px solid hsl(var(--border-subtle))',
                        }}
                      >
                        {turmasNoModal.length === 0 ? (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 12 }}>
                            {turmasDoAno.length === 0
                              ? `Nenhuma turma cadastrada no sistema para o ano letivo ${form.ano}.`
                              : 'Nenhuma turma encontrada para os filtros pesquisados.'}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                            {turmasNoModal.map(t => {
                              const isSelected = form.turmaIds.includes(t.id)
                              return (
                                <div
                                  key={t.id}
                                  onClick={() => toggleTurma(t.id)}
                                  style={{
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    background: isSelected ? 'rgba(59,130,246,0.1)' : 'hsl(var(--bg-elevated))',
                                    border: `1px solid ${isSelected ? 'rgba(59,130,246,0.45)' : 'hsl(var(--border-subtle))'}`,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    transition: 'all 0.12s',
                                  }}
                                >
                                  <div style={{ color: isSelected ? '#3b82f6' : 'hsl(var(--text-muted))', display: 'flex', flexShrink: 0 }}>
                                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                  </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#60a5fa' : 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {t.nome}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                      {t.serie && <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{t.serie}</span>}
                                      {t.turno && <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>· {t.turno}</span>}
                                      {t.ano && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-muted))' }}>{t.ano}</span>}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={12} color="#f59e0b" />
                        <span>Dica: Caso nenhuma turma seja selecionada, este padrão poderá ser escolhido como modelo geral nas matrículas do ano {form.ano}.</span>
                      </div>
                    </>
                  )}
                </div>

                {/* 4. PARCELAS GERADAS */}
                {gerou && parcelas.length > 0 && (
                  <div style={{ padding: '18px 20px', borderRadius: 14, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#60a5fa' }}>
                        Cronograma de Parcelas ({parcelas.length} parcelas)
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        Edite vencimentos e valores individualmente se necessário
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                      {parcelas.map((p, i) => {
                        const liq = +(p.valor - p.desconto).toFixed(2)
                        const pct = p.valor > 0 ? +((p.desconto / p.valor) * 100).toFixed(1) : 0
                        const inputStyle = (color?: string): React.CSSProperties => ({
                          width: '100%', fontSize: 11, padding: '3px 6px',
                          background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                          borderRadius: 4, color: color ?? 'hsl(var(--text-primary))',
                        })
                        return (
                          <div
                            key={i}
                            style={{
                              padding: '10px 12px',
                              background: 'hsl(var(--bg-base))',
                              borderRadius: 8,
                              border: `1px solid ${p.eventoId ? 'rgba(99,102,241,0.3)' : p.desconto > 0 ? 'rgba(245,158,11,0.3)' : 'hsl(var(--border-subtle))'}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#60a5fa', flexShrink: 0 }}>
                                {p.numero}
                              </div>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>Líquido: </span>
                                <span style={{ fontSize: 13, fontWeight: 900, color: liq < p.valor ? '#34d399' : '#60a5fa', fontFamily: 'Outfit, sans-serif' }}>
                                  {fmtCurrency(liq)}
                                </span>
                                {p.desconto > 0 && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6 }}>({pct}%)</span>}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                              <div>
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>Vencimento</div>
                                <input type="date" value={p.vencimento} onChange={e => editParcela(i, 'vencimento', e.target.value)} style={inputStyle()} />
                              </div>
                              <div>
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>Valor Bruto (R$)</div>
                                <input type="number" step={0.01} value={p.valor} onChange={e => editParcela(i, 'valor', e.target.value)} style={inputStyle('#34d399')} />
                              </div>
                              <div>
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>Desconto (R$)</div>
                                <input type="number" step={0.01} min={0} max={p.valor} value={p.desconto} onChange={e => editParcela(i, 'desconto', e.target.value)} style={inputStyle(p.desconto > 0 ? '#f59e0b' : undefined)} />
                              </div>
                              <div>
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>Desconto (%)</div>
                                <input type="number" step={0.1} min={0} max={100} value={p.valor > 0 ? pct : 0} onChange={e => editParcela(i, 'descontoPct', e.target.value)} style={inputStyle(p.desconto > 0 ? '#f59e0b' : undefined)} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Totais do Parcelamento */}
                    <div style={{ marginTop: 12, padding: '12px 16px', background: 'hsl(var(--bg-base))', borderRadius: 10, display: 'flex', gap: 24, flexWrap: 'wrap', border: '1px solid hsl(var(--border-subtle))', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Total Bruto</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#34d399', fontFamily: 'Outfit, sans-serif' }}>
                          {fmtCurrency(parcelas.reduce((s, p) => s + p.valor, 0))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Total Descontos</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>
                          - {fmtCurrency(totalDesconto)}
                        </div>
                      </div>
                      <div style={{ borderLeft: '2px solid hsl(var(--border-subtle))', paddingLeft: 18 }}>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Total Líquido</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit, sans-serif' }}>
                          {fmtCurrency(totalLiquido)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé do Modal com Ações */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'hsl(var(--bg-elevated))',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  <span style={{ fontWeight: 700, color: form.turmaIds.length > 0 ? '#60a5fa' : 'inherit' }}>
                    {form.turmaIds.length} turma(s)
                  </span> vinculada(s)
                  {parcelas.length > 0 && <span> · {parcelas.length} parcelas</span>}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSave}
                    disabled={!form.nome.trim() || !form.ano}
                  >
                    <Check size={14} />
                    {editId ? 'Salvar Alterações' : 'Salvar Padrão'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── TELA PRINCIPAL (LISTAGEM) ── */}
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Padrão de Pagamentos</h1>
            <p className="page-subtitle">Templates de parcelamento de anuidade com vínculo automático às turmas e alunos</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <Plus size={13} />Novo Padrão
          </button>
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
            <input
              className="form-input"
              style={{ paddingLeft: 30 }}
              placeholder="Buscar padrão ou código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-input"
            style={{ width: 140 }}
            value={String(filtroAno)}
            onChange={e => setFiltroAno(e.target.value === 'todos' ? 'todos' : +e.target.value)}
          >
            <option value="todos">📅 Todos os anos</option>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <select
            className="form-input"
            style={{ width: 130 }}
            value={filtroSegmento}
            onChange={e => setFiltroSegmento(e.target.value)}
          >
            <option value="todos">🎓 Segmento</option>
            {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            className="form-input"
            style={{ width: 170 }}
            value={filtroTurma}
            onChange={e => setFiltroTurma(e.target.value)}
          >
            <option value="todos">🏫 Turmas (Todas)</option>
            {turmasList.map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>

          <select
            className="form-input"
            style={{ width: 120 }}
            value={filtroSituacao}
            onChange={e => setFiltroSituacao(e.target.value as 'todos' | 'ativo' | 'inativo')}
          >
            <option value="todos">Situação</option>
            <option value="ativo">✓ Ativo</option>
            <option value="inativo">✗ Inativo</option>
          </select>

          {(filtroAno !== 'todos' || filtroSegmento !== 'todos' || filtroTurma !== 'todos' || filtroSituacao !== 'todos' || search) && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, color: '#f87171' }}
              onClick={() => { setFiltroAno('todos'); setFiltroSegmento('todos'); setFiltroTurma('todos'); setFiltroSituacao('todos'); setSearch('') }}
            >
              ✕ Limpar filtros
            </button>
          )}
        </div>

        {/* Lista de Padrões de Pagamento */}
        {cfgPadroesPagamento.length === 0 ? (
          <div className="card" style={{ padding: '56px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <DollarSign size={48} style={{ margin: '0 auto 16px', opacity: 0.15 }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum padrão de pagamento</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Crie templates de parcelamento de anuidade para vincular às turmas e cobranças.</div>
            <button className="btn btn-primary" onClick={openNew}>
              <Plus size={14} />Criar primeiro padrão
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(pp => {
              // Resolução de turmas para exibição
              const linkedTurmas = turmasList.filter(t => (pp.turmaIds || []).includes(t.id))
              const turmaCount = (pp.turmaIds || []).length

              return (
                <div key={pp.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 260 }}>
                      <button
                        onClick={() => setExpandedId(expandedId === pp.id ? null : pp.id)}
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ flexShrink: 0 }}
                        title="Ver parcelas e turmas"
                      >
                        {expandedId === pp.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <code style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', background: 'hsl(var(--bg-overlay))', padding: '2px 7px', borderRadius: 4 }}>
                            {pp.codigo || '—'}
                          </code>

                          <span style={{ fontSize: 15, fontWeight: 800 }}>{pp.nome}</span>

                          {pp.segmento && (
                            <span className="badge badge-primary" style={{ fontSize: 10 }}>{pp.segmento}</span>
                          )}

                          {pp.eventoDescricao && (
                            <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CalendarDays size={9} />{pp.eventoDescricao}
                            </span>
                          )}

                          {/* Badge de Turmas Vinculadas */}
                          {turmaCount > 0 ? (
                            <span
                              style={{
                                fontSize: 10,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(59,130,246,0.12)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59,130,246,0.25)',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title={linkedTurmas.map(t => t.nome).join(', ')}
                            >
                              <School size={10} />
                              {turmaCount === 1 ? linkedTurmas[0]?.nome || '1 turma' : `${turmaCount} turmas`}
                            </span>
                          ) : (pp as any).turma ? (
                            <span className="badge badge-neutral" style={{ fontSize: 10 }}>🏫 {(pp as any).turma}</span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                              (Geral · Todas as turmas)
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 3 }}>
                          {pp.ano} · {pp.totalParcelas}x de {fmtCurrency(pp.anuidade / (pp.totalParcelas || 1))} · Dia {pp.diaVencimento} · {pp.parcelas?.length || 0} parcelas
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: 900, color: '#34d399', fontFamily: 'Outfit, sans-serif' }}>
                        {fmtCurrency(pp.anuidade)}
                      </span>
                      <span className={`badge ${pp.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>
                        {pp.situacao === 'ativo' ? '✓ Ativo' : '✗ Inativo'}
                      </span>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(pp)} title="Editar padrão">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(pp.id)} title="Excluir padrão">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {expandedId === pp.id && (
                    <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', padding: '16px 20px', background: 'hsl(var(--bg-elevated))' }}>
                      {/* Seção das Turmas Vinculadas no detalhe */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#60a5fa', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <School size={13} />
                          Turmas Vinculadas ({turmaCount}):
                        </div>

                        {turmaCount > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {linkedTurmas.map(t => (
                              <span
                                key={t.id}
                                style={{
                                  fontSize: 11,
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  background: 'hsl(var(--bg-base))',
                                  border: '1px solid hsl(var(--border-subtle))',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <span style={{ fontWeight: 700 }}>{t.nome}</span>
                                {t.serie && <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>({t.serie}{t.turno ? ` · ${t.turno}` : ''})</span>}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                            Este padrão não possui turmas fixas vinculadas. Ele pode ser selecionado manualmente para qualquer aluno do ano {pp.ano}.
                          </div>
                        )}
                      </div>

                      {/* Grade de Parcelas */}
                      {pp.parcelas && pp.parcelas.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#34d399', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <DollarSign size={13} />
                            Parcelas ({pp.parcelas.length}):
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                            {pp.parcelas.map(p => (
                              <div
                                key={p.numero}
                                style={{
                                  padding: '8px 12px',
                                  background: 'hsl(var(--bg-base))',
                                  borderRadius: 8,
                                  border: `1px solid ${p.eventoId ? 'rgba(99,102,241,0.25)' : 'hsl(var(--border-subtle))'}`,
                                }}
                              >
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
                  )}
                </div>
              )
            })}

            {filtered.length === 0 && cfgPadroesPagamento.length > 0 && (
              <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                Nenhum padrão encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
