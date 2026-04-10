'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import {
  X, FileText, Download, Printer, Mail, Share2, Receipt,
  Calendar, Filter, ChevronDown, ChevronUp, CheckSquare,
  Square, Tag, Layers, TrendingUp, TrendingDown,
  DollarSign, AlertCircle, Clock, CheckCircle, XCircle,
  BarChart2, FileSpreadsheet, Send, Shield, Zap, Search, ChevronRight, Check
} from 'lucide-react'
import { useData } from '@/lib/dataContext'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Parcela {
  num: number
  competencia: string
  vencimento: string
  valor: number
  desconto: number
  valorFinal: number
  status: 'pendente' | 'pago' | 'cobranca' | 'isento' | 'vencido' | 'cancelado'
  obs: string
  editando: boolean
  evento?: string
  eventoId?: string
  juros?: number
  multa?: number
  dtPagto?: string
  formaPagto?: string
  comprovante?: string
  obsFin?: string
  codigo?: string
  codBaixa?: string
  dataExclusao?: string
  motivoExclusao?: string
  numParcela?: number
  totalParcelas?: number
  // ID composto padronizado: ex '00051-3'
  parcelaId?: string
}

interface ExtratoModalProps {
  aberto: boolean
  onFechar: () => void
  aluno: { nome: string; rga?: string; codigo?: string; cpf?: string }
  parcelas: Parcela[]
  todosResp: { nome: string; respFinanceiro?: boolean; email?: string; cpf?: string; endereco?: any; numero?: string; cidade?: string; estado?: string; celular?: string; telefone?: string }[]
  mat: { anoLetivo?: string; turmaId?: string; escola?: string }
  turmas: { id: string; nome: string; curso?: string; unidade?: string }[]
  cfgEventos: { id: string; descricao: string; codigo?: string }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtData = (d: string | undefined) => {
  if (!d) return '—'
  if (d.includes('/')) return d
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

const parseDate = (d: string | undefined): Date | null => {
  if (!d) return null
  if (d.includes('/')) {
    const [dia, m, y] = d.split('/')
    return new Date(`${y}-${m}-${dia}T12:00`)
  }
  return new Date(d + 'T12:00')
}

// Status moderno do Premium Layout
const STATUS_CFG = {
  pago:      { label: 'Pago',      color: '#059669', bg: '#d1fae5', icon: '🟢' },
  pendente:  { label: 'Pendente',  color: '#92400e', bg: '#fef3c7', icon: '🟡' },
  vencido:   { label: 'Vencido',   color: '#dc2626', bg: '#fee2e2', icon: '🔴' },
  cancelado: { label: 'Cancelado', color: '#475569', bg: '#f1f5f9', icon: '⚫' },
  cobranca:  { label: 'Cobrança',  color: '#9a3412', bg: '#ffedd5', icon: '🟠' },
  isento:    { label: 'Isento',    color: '#3730a3', bg: '#e0e7ff', icon: '🔵' },
}

type TipoDoc = 'debitos' | 'creditos' | 'ir'
type AgrupamentoKey = 'vencimento' | 'competencia' | 'evento' | 'status'
type PeriodoPreset = 'mes' | 'ano' | 'ano_anterior' | 'custom'

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function SmartDropdown({ label, icon, valueText, isOpen, onToggle, onClose, children }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={onToggle}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          padding: '8px 12px', background: isOpen ? 'hsl(var(--bg-elevated))' : 'transparent',
          border: '1px solid', borderColor: isOpen ? 'hsl(var(--border-subtle))' : 'transparent',
          borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
          minWidth: 140, boxShadow: isOpen ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
        }}
        onMouseEnter={e => !isOpen && (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
        onMouseLeave={e => !isOpen && (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <span style={{ color: '#818cf8' }}>{icon}</span> {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-base))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
            {valueText}
          </span>
          <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 12, boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
            zIndex: 50, minWidth: 260, padding: 12, overflow: 'hidden',
            animation: 'fadeInDown 0.15s ease-out'
          }}>
            {children}
          </div>
        </>
      )}
    </div>
  )
}

function CheckItem({ label, checked, onClick }: any) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s', background: checked ? 'rgba(99,102,241,0.05)' : 'transparent' }} onMouseEnter={e => !checked && (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')} onMouseLeave={e => !checked && (e.currentTarget.style.background = 'transparent')}>
      <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid', borderColor: checked ? '#6366f1' : 'hsl(var(--border-strong))', background: checked ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <Check size={12} color="#fff" strokeWidth={3} />}
      </div>
      <span style={{ fontSize: 12, fontWeight: checked ? 600 : 500, color: checked ? '#6366f1' : 'hsl(var(--text-base))' }}>{label}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExtratoModal({ aberto, onFechar, aluno, parcelas, todosResp, mat, turmas, cfgEventos }: ExtratoModalProps) {
  const hoje = new Date().toISOString().slice(0, 10)
  const anoAtual = new Date().getFullYear()
  const { mantenedores } = useData()

  // ── States ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'setup' | 'result'>('setup')
  
  // Filtros
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>('debitos')
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('ano')
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`)
  const [dataFim, setDataFim] = useState(`${anoAtual}-12-31`)
  const [anoExercicio, setAnoExercicio] = useState(String(anoAtual))
  const [statusSel, setStatusSel] = useState<string[]>(['pendente', 'vencido'])
  const [eventosSel, setEventosSel] = useState<string[]>([])
  const [agrupamento, setAgrupamento] = useState<AgrupamentoKey>('vencimento')

  // UI States
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [buscaEvento, setBuscaEvento] = useState('')
  const [showAvancados, setShowAvancados] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (aberto) {
      try {
        const saved = localStorage.getItem('@impacto-edu/extrato-filtros')
        if (saved) {
          const s = JSON.parse(saved)
          if (s.tipoDoc) setTipoDoc(s.tipoDoc)
          if (s.periodoPreset) setPeriodoPreset(s.periodoPreset)
          if (s.dataInicio) setDataInicio(s.dataInicio)
          if (s.dataFim) setDataFim(s.dataFim)
          if (s.statusSel) setStatusSel(s.statusSel)
          if (s.eventosSel) setEventosSel(s.eventosSel)
          if (s.agrupamento) setAgrupamento(s.agrupamento)
        }
      } catch (e) {}
    } else {
      setViewMode('setup')
    }
  }, [aberto])

  const saveFilters = () => {
    try { localStorage.setItem('@impacto-edu/extrato-filtros', JSON.stringify({ tipoDoc, periodoPreset, dataInicio, dataFim, statusSel, eventosSel, agrupamento })) } catch(e) {}
  }

  const turmaAtual = turmas.find(t => t.id === mat.turmaId)
  const respFinanceiro = todosResp.find(r => r.respFinanceiro)
  const eventosUnicos = useMemo(() => [...new Set(parcelas.map(p => p.evento || p.competencia || 'Mensalidade').filter(Boolean))], [parcelas])

  const logoUrl = useMemo(() => {
    if (!mantenedores || mantenedores.length === 0) return null
    if (turmaAtual?.unidade) {
      for (const m of mantenedores) {
        if (m.unidades?.some(u => u.nomeFantasia === turmaAtual.unidade || u.id === turmaAtual.unidade)) return m.logo
      }
    }
    return mantenedores[0].logo
  }, [mantenedores, turmaAtual])

  const aplicarPreset = (preset: PeriodoPreset) => {
    setPeriodoPreset(preset)
    const y = anoAtual
    if (preset === 'mes') {
      const m = new Date().toISOString().slice(0, 7)
      setDataInicio(`${m}-01`)
      setDataFim(`${m}-${new Date(y, new Date().getMonth() + 1, 0).getDate()}`)
    } else if (preset === 'ano') {
      setDataInicio(`${y}-01-01`)
      setDataFim(`${y}-12-31`)
    } else if (preset === 'ano_anterior') {
      setDataInicio(`${y - 1}-01-01`)
      setDataFim(`${y - 1}-12-31`)
      setAnoExercicio(String(y - 1))
    }
  }

  const handleBotaoInteligente = () => {
    const pendentes = parcelas.filter(p => ['pendente', 'vencido'].includes(p.status))
    if (pendentes.length > 0) {
      setTipoDoc('debitos'); setStatusSel(['pendente', 'vencido']); setAgrupamento('vencimento'); setPeriodoPreset('ano'); setDataInicio(`${anoAtual}-01-01`); setDataFim(`${anoAtual}-12-31`)
    } else {
      setTipoDoc('creditos'); setStatusSel(['pago']); setAgrupamento('competencia'); setPeriodoPreset('ano'); setDataInicio(`${anoAtual}-01-01`); setDataFim(`${anoAtual}-12-31`)
    }
    setEventosSel([])
  }

  const parcelasFiltradas = useMemo(() => {
    return parcelas.filter(p => {
      // Ignorar eventos que foram formalmente excluídos da vida do aluno
      if (p.dataExclusao || p.status === 'excluido') return false

      // Para IR, trava de segurança governamental: NUNCA exibir não pagos
      if (tipoDoc === 'ir' && p.status !== 'pago') return false

      const dataRef = tipoDoc === 'creditos' || tipoDoc === 'ir' ? parseDate(p.dtPagto || p.vencimento) : parseDate(p.vencimento)
      if (dataRef) {
        const di = parseDate(dataInicio); const df = parseDate(dataFim)
        if (di && dataRef < di) return false
        if (df && dataRef > df) return false
      }

      if (tipoDoc === 'ir') {
        const ano = parseDate(p.dtPagto || p.vencimento)?.getFullYear()
        if (String(ano) !== anoExercicio) return false
      }

      // O dropdown "Situação" do usuário dita a regra principal:
      if (statusSel.length > 0 && !statusSel.includes(p.status)) return false
      const ev = p.evento || p.competencia || 'Mensalidade'
      if (eventosSel.length > 0 && !eventosSel.includes(ev)) return false
      return true
    })
  }, [parcelas, tipoDoc, dataInicio, dataFim, anoExercicio, statusSel, eventosSel])

  const totalValorOriginal = parcelasFiltradas.reduce((s, p) => s + p.valor, 0)
  const totalDesconto = parcelasFiltradas.reduce((s, p) => s + (p.desconto || 0), 0)
  const totalEncargosTotais = parcelasFiltradas.reduce((s, p) => s + (p.juros || 0) + (p.multa || 0), 0)
  const totalPagosCalc = parcelasFiltradas.filter(p => p.status === 'pago').reduce((s, p) => s + p.valorFinal, 0)
  const totalAbertosCalc = parcelasFiltradas.filter(p => p.status !== 'pago' && p.status !== 'cancelado').reduce((s, p) => s + p.valorFinal, 0)

  const parcelasAgrupadas = useMemo(() => {
    if (viewMode !== 'result') return []
    const groups: Record<string, Parcela[]> = {}
    parcelasFiltradas.forEach(p => {
      let key = ''
      if (agrupamento === 'vencimento') key = p.vencimento?.slice(3, 10) || 'Diversos'
      else if (agrupamento === 'competencia') key = p.competencia || 'Sem competência'
      else if (agrupamento === 'evento') key = p.evento || p.competencia || 'Mensalidade'
      else if (agrupamento === 'status') key = STATUS_CFG[p.status as keyof typeof STATUS_CFG]?.label || p.status
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [parcelasFiltradas, agrupamento, viewMode])

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    
    // Injeta o HTML que envelopa a div printRef, garantindo que os estilos inline React apareçam
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Documento Financeiro — ${aluno.nome}</title>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
        @media print {
          @page { margin: 10mm; }
          .print-wrapper { padding: 0 !important; box-shadow: none !important; min-height: 0 !important; width: 100% !important; max-width: none !important; }
        }
      </style>
    </head><body>
      <div class="print-wrapper" style="width: 100%; max-width: 900px; margin: 0 auto; padding: 20px;">
         ${content}
      </div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 800)
  }

  if (!aberto) return null

  const TIPO_OPTIONS = [
    { key: 'creditos', label: 'Extrato de Pagamentos', icon: <TrendingUp size={24} strokeWidth={1.5} />, desc: 'Recibos e pagamentos quitados', color: '#10b981' },
    { key: 'debitos',  label: 'Extrato de Cobranças',  icon: <TrendingDown size={24} strokeWidth={1.5} />, desc: 'Débitos pendentes e vencidos', color: '#f43f5e' },
    { key: 'ir',       label: 'Declaração IRPF',       icon: <Shield size={24} strokeWidth={1.5} />, desc: `Consolidado para Receita/IR`, color: '#6366f1' },
  ] as const

  const STATUS_OPTS = ['pago', 'pendente', 'vencido', 'cancelado', 'cobranca', 'isento'] as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out' }}>
      <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 24, width: '100%', maxWidth: 1000, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.5)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>

        {/* ── HEADER PREMIUM WIZARD ────────────────────────────────────────────── */}
        {viewMode === 'setup' && (
          <div style={{ padding: '20px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg, hsl(var(--bg-overlay)) 0%, hsl(var(--bg-base)) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}><Receipt size={22} strokeWidth={1.5} /></div>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'hsl(var(--text-base))', margin: 0 }}>Extrato e Relatórios Financeiros</h2>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>{aluno.nome}</span> • {turmaAtual?.nome || 'Sem turma'}
                </div>
              </div>
            </div>
            <button onClick={onFechar} style={{ width: 36, height: 36, borderRadius: '50%', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-muted))', transition: 'all 0.2s' }}><X size={18} /></button>
          </div>
        )}

        {/* ── MODO SETUP WIZARD ────────────────────────────────────────── */}
        {viewMode === 'setup' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
              
              {/* Passo 1 - Tipo */}
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-base))' }}>1. O que você deseja gerar?</h3>
                    <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Selecione o tipo principal de relatório para o aluno.</p>
                  </div>
                  <button onClick={handleBotaoInteligente} title="Sugerir melhor filtro com base no saldo devedor" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 100, background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
                    <Zap size={13} fill="currentColor" /> Sugerir Melhor Filtro
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {TIPO_OPTIONS.map(opt => (
                    <div key={opt.key} onClick={() => {
                        setTipoDoc(opt.key)
                        if (opt.key === 'ir') { setStatusSel(['pago']); setAgrupamento('competencia') }
                        else if (opt.key === 'debitos') setStatusSel(['pendente', 'vencido'])
                        else setStatusSel(['pago'])
                      }}
                      style={{ position: 'relative', cursor: 'pointer', padding: '24px', borderRadius: 20, background: '#fff', border: '2px solid', borderColor: tipoDoc === opt.key ? opt.color : 'transparent', boxShadow: '0 4px 15px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', transform: tipoDoc === opt.key ? 'translateY(-2px)' : 'none' }}>
                      <div style={{ color: opt.color, marginBottom: 12 }}>{opt.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-base))' }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4, lineHeight: 1.4 }}>{opt.desc}</div>
                      {tipoDoc === opt.key && <div style={{ position: 'absolute', top: 16, right: 16, width: 22, height: 22, borderRadius: '50%', background: opt.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} strokeWidth={3} /></div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Passo 2 - Filtros Inline */}
              <div style={{ marginBottom: 40 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-base))', marginBottom: 16 }}>2. Refinar a busca</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: 12, borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)' }}>
                  
                  <SmartDropdown label="Período" icon={<Calendar size={13}/>} valueText={periodoPreset === 'ano' ? 'Ano Atual' : periodoPreset === 'custom' ? 'Personalizado' : periodoPreset === 'ano_anterior' ? 'Ano Anterior' : 'Mês Atual'} isOpen={openDropdown === 'periodo'} onToggle={() => setOpenDropdown(p => p==='periodo'?null:'periodo')} onClose={() => setOpenDropdown(null)}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <CheckItem label="Ano Atual" checked={periodoPreset === 'ano'} onClick={() => aplicarPreset('ano')} />
                      <CheckItem label="Ano Anterior" checked={periodoPreset === 'ano_anterior'} onClick={() => aplicarPreset('ano_anterior')} />
                      <CheckItem label="Mês Atual" checked={periodoPreset === 'mes'} onClick={() => aplicarPreset('mes')} />
                    </div>
                    <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 12, display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>DATA INICIAL</label><input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPeriodoPreset('custom') }} style={{ width: '100%', padding: '6px 8px', fontSize: 12, marginTop: 4 }} /></div>
                      <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>DATA FINAL</label><input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPeriodoPreset('custom') }} style={{ width: '100%', padding: '6px 8px', fontSize: 12, marginTop: 4 }} /></div>
                    </div>
                  </SmartDropdown>
                  <div style={{ width: 1, height: 24, background: 'hsl(var(--border-subtle))' }} />

                  <SmartDropdown label="Eventos" icon={<Tag size={13}/>} valueText={eventosSel.length === 0 ? 'Todos' : `${eventosSel.length} selecionado(s)`} isOpen={openDropdown === 'eventos'} onToggle={() => setOpenDropdown(p => p==='eventos'?null:'eventos')} onClose={() => setOpenDropdown(null)}>
                    <div style={{ padding: '0 4px', marginBottom: 8, position: 'relative' }}>
                      <Search size={12} color="hsl(var(--text-muted))" style={{ position:'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input type="text" placeholder="Buscar evento..." value={buscaEvento} onChange={e => setBuscaEvento(e.target.value)} style={{ width: '100%', padding: '8px 10px 8px 30px', fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))', outline: 'none' }} />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <CheckItem label="Todos os Eventos" checked={eventosSel.length === 0} onClick={() => setEventosSel([])} />
                      <div style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />
                      {eventosUnicos.filter(e => e.toLowerCase().includes(buscaEvento.toLowerCase())).map(ev => (
                        <CheckItem key={ev} label={ev} checked={eventosSel.includes(ev)} onClick={() => setEventosSel(p => p.includes(ev) ? p.filter(x=>x!==ev) : [...p, ev])} />
                      ))}
                    </div>
                  </SmartDropdown>
                  <div style={{ width: 1, height: 24, background: 'hsl(var(--border-subtle))' }} />

                  <SmartDropdown label="Situação" icon={<Filter size={13}/>} valueText={statusSel.length === STATUS_OPTS.length ? 'Todas' : `${statusSel.length} selecionada(s)`} isOpen={openDropdown === 'status'} onToggle={() => setOpenDropdown(p => p==='status'?null:'status')} onClose={() => setOpenDropdown(null)}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <CheckItem label="Todos" checked={statusSel.length === STATUS_OPTS.length} onClick={() => setStatusSel([...STATUS_OPTS])} />
                      {STATUS_OPTS.map(s => <CheckItem key={s} label={STATUS_CFG[s].label} checked={statusSel.includes(s)} onClick={() => setStatusSel(p => p.includes(s) ? p.filter(x=>x!==s) : [...p, s])} />)}
                    </div>
                  </SmartDropdown>
                  <div style={{ width: 1, height: 24, background: 'hsl(var(--border-subtle))' }} />

                  <SmartDropdown label="Agrupar por" icon={<Layers size={13}/>} valueText={agrupamento.charAt(0).toUpperCase() + agrupamento.slice(1)} isOpen={openDropdown === 'grupo'} onToggle={() => setOpenDropdown(p => p==='grupo'?null:'grupo')} onClose={() => setOpenDropdown(null)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {['vencimento', 'competencia', 'evento', 'status'].map(k => (
                        <CheckItem key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} checked={agrupamento === k} onClick={() => { setAgrupamento(k as any); setOpenDropdown(null) }} />
                      ))}
                    </div>
                  </SmartDropdown>

                </div>
              </div>

              {/* Filtros Avançados Opcionais */}
              {(tipoDoc === 'ir' || showAvancados) && (
                <div style={{ padding: 20, background: '#fff', borderRadius: 16, border: '1px dashed hsl(var(--border-subtle))', animation: 'fadeIn 0.2s', marginBottom: 40 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-base))', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14} color="#818cf8"/> Configurações Fiscais</h4>
                  {tipoDoc === 'ir' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 120 }}><label style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>EXERCÍCIO (ANO)</label><input type="number" value={anoExercicio} onChange={e => setAnoExercicio(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: 14, fontWeight: 700 }} /></div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-overlay))', padding: '10px 14px', borderRadius: 8, flex: 1 }}>ℹ️ A declaração do IRPF considerará estritamente os rendimentos quitados entre 01/01/{anoExercicio} e 31/12/{anoExercicio}.</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', padding: '10px 0' }}>Sem filtros avançados para este tipo de extrato.</div>
                  )}
                </div>
              )}

            </div>

            {/* Footer Bottom / Preview Realtime */}
            <div style={{ background: '#fff', padding: '24px 40px', borderTop: '1px solid hsl(var(--border-strong))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 -10px 40px rgba(0,0,0,0.03)' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  <Zap size={10} style={{ display: 'inline', marginRight: 4, top:-1, position:'relative' }} fill="currentColor" /> Preview em tempo real
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-base))', letterSpacing: '-0.03em' }}>{parcelasFiltradas.length} <span style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>lançamentos</span></div>
                  <div style={{ width: 1, height: 20, background: 'hsl(var(--border-subtle))' }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>
                    Total {tipoDoc === 'debitos' ? 'Aberto' : 'Pago'}: <strong style={{color: tipoDoc === 'debitos' ? '#dc2626' : '#059669', fontSize: 20, marginLeft: 6}}>R$ {fmtMoeda(tipoDoc === 'debitos' ? totalAbertosCalc : totalPagosCalc)}</strong>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { saveFilters(); setViewMode('result'); }}
                disabled={parcelasFiltradas.length === 0}
                style={{ background: parcelasFiltradas.length > 0 ? '#0f172a' : 'hsl(var(--bg-elevated))', color: parcelasFiltradas.length > 0 ? '#fff' : 'hsl(var(--text-muted))', border: '1px solid', borderColor: parcelasFiltradas.length > 0 ? 'transparent' : 'hsl(var(--border-strong))', padding: '16px 40px', borderRadius: 14, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, cursor: parcelasFiltradas.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: parcelasFiltradas.length > 0 ? '0 10px 25px rgba(15,23,42,0.3)' : 'none' }}>
                GERAR DOCUMENTO OFICIAL <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── MODO RESULTADO (O DOCUMENTO ULTRA PREMIUM) ──────────────────────── */}
        {viewMode === 'result' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#e2e8f0', minHeight: 0 }}>
            
            {/* Toolbar do Documento */}
            <div style={{ padding: '12px 32px', background: '#fff', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
               <button onClick={() => setViewMode('setup')} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:'#64748b', background:'transparent', border:'none', cursor:'pointer' }}>
                  <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }}/> Voltar aos filtros
               </button>
               <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10, fontWeight: 800, fontSize: 13, background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}>
                  <Printer size={16} /> Imprimir / PDF
               </button>
            </div>

            {/* O "Papel" do Documento */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
               <div ref={printRef} className="print-wrapper" style={{ background: '#fff', width: '100%', maxWidth: 900, minHeight: '1050px', padding: '60px', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>

                  {/* HEADER OFICIAL */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 50, height: 50, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontWeight: 800, fontSize: 10, textAlign: 'center', overflow: 'hidden' }}>
                        {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} /> : <>LOGO<br/>ESCOLA</>}
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>COLÉGIO IMPACTO</div>
                        <div style={{ fontWeight: 600, fontSize: 11, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2 }}>Central Financeira do Aluno</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                        {tipoDoc === 'creditos' ? 'Extrato de Créditos / Pagamentos' : tipoDoc === 'debitos' ? 'Extrato de Débitos / Cobranças' : `Declaração para IRPF (${anoExercicio})`}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Período: {fmtData(dataInicio)} → {fmtData(dataFim)}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  </div>

                  {/* BLOCO ALUNO (CARD PREMIUM) */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}><div style={{ color: '#64748b', fontWeight: 700, width: 85, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em' }}>ALUNO</div><div style={{ color: '#0f172a', fontWeight: 600 }}>{aluno.nome}</div></div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}><div style={{ color: '#64748b', fontWeight: 700, width: 85, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em' }}>CPF</div><div style={{ color: '#0f172a', fontWeight: 600 }}>{aluno.cpf || '—'}</div></div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}><div style={{ color: '#64748b', fontWeight: 700, width: 85, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em' }}>RESPONSÁVEL</div>
                        <div style={{ color: '#0f172a', fontWeight: 600 }}>
                          <div>{respFinanceiro?.nome || '—'}</div>
                           {respFinanceiro?.cpf && <div style={{ fontSize: 9, color: '#64748b', marginTop: 2, fontWeight: 500 }}>CPF: {respFinanceiro.cpf}</div>}
                           {respFinanceiro?.endereco && (
                              <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, fontWeight: 500 }}>
                                 {typeof respFinanceiro.endereco === 'string' ? respFinanceiro.endereco : respFinanceiro.endereco.logradouro}
                                 {respFinanceiro.numero ? `, ${respFinanceiro.numero}` : (typeof respFinanceiro.endereco !== 'string' && respFinanceiro.endereco.numero) ? `, ${respFinanceiro.endereco.numero}` : ''}
                                 {(typeof respFinanceiro.endereco !== 'string' && respFinanceiro.endereco.bairro) ? ` - ${respFinanceiro.endereco.bairro}` : ''}
                                 {respFinanceiro.cidade ? ` - ${respFinanceiro.cidade}/${respFinanceiro.estado||''}` : (typeof respFinanceiro.endereco !== 'string' && respFinanceiro.endereco.cidade) ? ` - ${respFinanceiro.endereco.cidade}/${respFinanceiro.endereco.estado||''}` : ''}
                                 {(typeof respFinanceiro.endereco !== 'string' && respFinanceiro.endereco.cep) ? ` - CEP: ${respFinanceiro.endereco.cep}` : ''}
                              </div>
                           )}
                           {(respFinanceiro?.celular || respFinanceiro?.telefone) && (
                              <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, fontWeight: 500 }}>
                                 {respFinanceiro.celular ? `Celular: ${respFinanceiro.celular}` : `Telefone: ${respFinanceiro.telefone}`}
                              </div>
                           )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}><div style={{ color: '#64748b', fontWeight: 700, width: 85, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em' }}>RGA / CÓD.</div><div style={{ color: '#0f172a', fontWeight: 600 }}>{aluno.rga || aluno.codigo || '—'}</div></div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}><div style={{ color: '#64748b', fontWeight: 700, width: 85, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em' }}>TURMA</div><div style={{ color: '#0f172a', fontWeight: 600 }}>{turmaAtual?.nome || '—'}</div></div>
                      {tipoDoc === 'ir' && <div style={{ display: 'flex', gap: 8, fontSize: 11 }}><div style={{ color: '#64748b', fontWeight: 700, width: 85, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em' }}>NATUREZA</div><div style={{ color: '#0f172a', fontWeight: 600 }}>Declaração de Quitação Fiscal ({anoExercicio})</div></div>}
                    </div>
                  </div>

                  {/* AVISO IR */}
                  {tipoDoc === 'ir' && (
                    <div style={{ padding: 16, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 24, fontSize: 11, color: '#1d4ed8', lineHeight: 1.5 }}>
                      Declaramos para os devidos fins que o responsável financeiro <strong>{respFinanceiro?.nome || '—'}</strong>{respFinanceiro?.cpf ? <>, inscrito no CPF sob o nº <strong>{respFinanceiro.cpf}</strong>,</> : ','} efetuou os pagamentos de despesas com educação listados abaixo referentes ao aluno <strong>{aluno.nome}</strong>, totalizando <strong>R$ {fmtMoeda(totalPagosCalc)}</strong> no ano-calendário de {anoExercicio}, servindo este documento como comprovante para declaração do Imposto de Renda.
                    </div>
                  )}

                  {/* SEÇÃO MENSAL / GRUPOS */}
                  {parcelasAgrupadas.map(([grupo, items]) => (
                    <div key={grupo} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 24, overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', pageBreakInside: 'avoid' }}>
                      
                      <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div style={{ fontWeight: 800, fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{grupo}</div>
                         <div style={{ fontWeight: 900, fontSize: 14, color: '#0f172a' }}>R$ {fmtMoeda(items.reduce((s, p) => s + p.valorFinal, 0))}</div>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Evento / Competência</th>
                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Datas</th>
                            <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Situação</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Detalhes</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Total Final</th>
                          </tr>
                        </thead>
                        <tbody>
                           {items.map((p, idx) => {
                             const sc = STATUS_CFG[p.status as keyof typeof STATUS_CFG] || STATUS_CFG.pendente
                             const jm = (p.juros || 0) + (p.multa || 0)
                             return (
                               <tr key={p.num}>
                                 <td style={{ padding: '12px 16px', fontSize: 11, color: '#334155', borderBottom: idx===items.length-1?'none':'1px solid #f1f5f9', verticalAlign: 'top' }}>
                                   <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.evento || 'Mensalidade'}</div>
                                   <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Comp: {p.competencia || '—'}  •  Parc {String(p.numParcela || p.num || '1').padStart(2,'0')}</div>
                                 </td>
                                 <td style={{ padding: '12px 16px', fontSize: 11, color: '#334155', borderBottom: idx===items.length-1?'none':'1px solid #f1f5f9', verticalAlign: 'top' }}>
                                   <div><span style={{ color: '#94a3b8', fontSize: 9 }}>VENC:</span> {fmtData(p.vencimento)}</div>
                                   {p.dtPagto && <div style={{ marginTop: 2 }}><span style={{ color: '#94a3b8', fontSize: 9 }}>PAGO:</span> {fmtData(p.dtPagto)}</div>}
                                 </td>
                                 <td style={{ padding: '12px 16px', fontSize: 11, color: '#334155', borderBottom: idx===items.length-1?'none':'1px solid #f1f5f9', verticalAlign: 'top', textAlign: 'center' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, background: sc.bg, color: sc.color }}>
                                       {sc.icon} {sc.label}
                                    </span>
                                 </td>
                                 <td style={{ padding: '12px 16px', fontSize: 11, color: '#334155', borderBottom: idx===items.length-1?'none':'1px solid #f1f5f9', verticalAlign: 'top', textAlign: 'right' }}>
                                    <div style={{ color: '#64748b' }}>Orig: R$ {fmtMoeda(p.valor)}</div>
                                    {p.desconto > 0 && <div style={{ color: '#059669', marginTop: 2 }}>Desc: -R$ {fmtMoeda(p.desconto)}</div>}
                                    {jm > 0 && <div style={{ color: '#dc2626', marginTop: 2 }}>Enc: +R$ {fmtMoeda(jm)}</div>}
                                 </td>
                                 <td style={{ padding: '12px 16px', fontSize: 11, color: '#334155', borderBottom: idx===items.length-1?'none':'1px solid #f1f5f9', verticalAlign: 'top', textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>R$ {fmtMoeda(p.valorFinal)}</div>
                                 </td>
                               </tr>
                             )
                           })}
                        </tbody>
                      </table>
                    </div>
                  ))}

                  {/* RESUMO MEGA FINAL */}
                  <div style={{ border: '2px solid #0f172a', borderRadius: 16, padding: 24, marginTop: 40, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16, background: '#fff', pageBreakInside: 'avoid' }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px dashed #cbd5e1', paddingBottom: 12, marginBottom: 4 }}>💰 Resumo Financeiro</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: '#475569' }}>
                      <span>Valor Total Original:</span>
                      <span>R$ {fmtMoeda(totalValorOriginal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: '#059669' }}>
                      <span>Total em Descontos e Créditos:</span>
                      <span>- R$ {fmtMoeda(totalDesconto)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: '#dc2626' }}>
                      <span>Total em Encargos (Juros/Multa):</span>
                      <span>+ R$ {fmtMoeda(totalEncargosTotais)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 12, paddingTop: 16, borderTop: '1px solid #0f172a' }}>
                      <span>{tipoDoc === 'debitos' ? 'TOTAL PENDENTE/VENCIDO:' : 'TOTAL PAGO/QUITADO:'}</span>
                      <span>R$ {fmtMoeda(tipoDoc === 'debitos' ? totalAbertosCalc : totalPagosCalc)}</span>
                    </div>
                  </div>

                  {/* RODAPÉ JURÍDICO Premium */}
                  <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
                    <div>
                      <strong style={{ color: '#64748b' }}>Documento oficial emitido pelo Colégio Impacto.</strong><br/>
                      Este extrato possui validade informativa e espelha os lançamentos do sistema na data de sua emissão.
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      contato.financeiro@colegioimpacto.com.br<br/>
                      (XX) XXXXX-XXXX
                    </div>
                  </div>

               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
