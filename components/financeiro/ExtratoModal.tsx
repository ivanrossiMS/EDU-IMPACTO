'use client'
import { useState, useMemo, useRef } from 'react'
import {
  X, FileText, Download, Printer, Mail, Share2, Receipt,
  Calendar, Filter, ChevronDown, ChevronUp, CheckSquare,
  Square, Tag, Layers, TrendingUp, TrendingDown,
  DollarSign, AlertCircle, Clock, CheckCircle, XCircle,
  BarChart2, FileSpreadsheet, Send, Shield
} from 'lucide-react'

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
}

interface ExtratoModalProps {
  aberto: boolean
  onFechar: () => void
  aluno: { nome: string; rga?: string; codigo?: string; cpf?: string }
  parcelas: Parcela[]
  todosResp: { nome: string; respFinanceiro?: boolean; email?: string }[]
  mat: { anoLetivo?: string; turmaId?: string; escola?: string }
  turmas: { id: string; nome: string; curso?: string; unidade?: string }[]
  cfgEventos: { id: string; descricao: string; codigo?: string }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

const STATUS_CFG = {
  pago:      { label: 'Pago',      color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '✅' },
  pendente:  { label: 'Pendente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⏳' },
  vencido:   { label: 'Vencido',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '🔴' },
  cancelado: { label: 'Cancelado', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '⛔' },
  cobranca:  { label: 'Cobrança',  color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: '📄' },
  isento:    { label: 'Isento',    color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: '🎓' },
}

type TipoDoc = 'debitos' | 'creditos' | 'ir'
type AgrupamentoKey = 'vencimento' | 'competencia' | 'evento' | 'status'
type PeriodoPreset = 'mes' | 'ano' | 'ano_anterior' | 'custom'

// ─── Componentes internos ─────────────────────────────────────────────────────

function SectionBox({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid hsl(var(--border-subtle))',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 14px',
        background: 'hsl(var(--bg-elevated))',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid hsl(var(--border-subtle))',
      }}>
        <span style={{ color: '#818cf8', display: 'flex' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>{title}</span>
      </div>
      <div style={{ padding: '12px 14px', background: 'hsl(var(--bg-base))' }}>
        {children}
      </div>
    </div>
  )
}

function Chip({
  label, active, onClick, color = '#818cf8'
}: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 100,
        border: active ? `1.5px solid ${color}` : '1.5px solid hsl(var(--border-subtle))',
        background: active ? `${color}18` : 'transparent',
        color: active ? color : 'hsl(var(--text-muted))',
        fontSize: 11, fontWeight: active ? 700 : 500,
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExtratoModal({
  aberto, onFechar, aluno, parcelas, todosResp, mat, turmas, cfgEventos
}: ExtratoModalProps) {
  const hoje = new Date().toISOString().slice(0, 10)
  const anoAtual = new Date().getFullYear()

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>('creditos')
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('ano')
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`)
  const [dataFim, setDataFim] = useState(`${anoAtual}-12-31`)
  const [anoExercicio, setAnoExercicio] = useState(String(anoAtual))
  const [statusSel, setStatusSel] = useState<string[]>(['pago', 'pendente', 'vencido', 'cancelado', 'cobranca', 'isento'])
  const [eventosSel, setEventosSel] = useState<string[]>([])  // vazio = todos
  const [agrupamento, setAgrupamento] = useState<AgrupamentoKey>('vencimento')
  const [activeTab, setActiveTab] = useState<'filtros' | 'preview'>('filtros')
  const printRef = useRef<HTMLDivElement>(null)

  // Dados derivados
  const turmaAtual = turmas.find(t => t.id === mat.turmaId)
  const respFinanceiro = todosResp.find(r => r.respFinanceiro)
  const eventosUnicos = useMemo(() =>
    [...new Set(parcelas.map(p => p.evento || p.competencia || 'Mensalidade').filter(Boolean))],
    [parcelas]
  )

  // ── Lógica de período preset ───────────────────────────────────────────────
  const aplicarPreset = (preset: PeriodoPreset) => {
    setPeriodoPreset(preset)
    const y = anoAtual
    if (preset === 'mes') {
      const m = new Date().toISOString().slice(0, 7)
      setDataInicio(`${m}-01`)
      const lastDay = new Date(y, new Date().getMonth() + 1, 0).getDate()
      setDataFim(`${m}-${lastDay}`)
    } else if (preset === 'ano') {
      setDataInicio(`${y}-01-01`)
      setDataFim(`${y}-12-31`)
    } else if (preset === 'ano_anterior') {
      setDataInicio(`${y - 1}-01-01`)
      setDataFim(`${y - 1}-12-31`)
      setAnoExercicio(String(y - 1))
    }
  }

  // ── Filtro principal ───────────────────────────────────────────────────────
  const parcelasFiltradas = useMemo(() => {
    return parcelas.filter(p => {
      // Tipo de documento
      if (tipoDoc === 'creditos' || tipoDoc === 'ir') {
        if (p.status !== 'pago') return false
      } else if (tipoDoc === 'debitos') {
        if (p.status === 'pago' || p.status === 'cancelado') return false
      }

      // Período (usa vencimento ou dtPagto dependendo do tipo)
      const dataRef = tipoDoc === 'creditos' || tipoDoc === 'ir'
        ? parseDate(p.dtPagto || p.vencimento)
        : parseDate(p.vencimento)

      if (dataRef) {
        const di = parseDate(dataInicio)
        const df = parseDate(dataFim)
        if (di && dataRef < di) return false
        if (df && dataRef > df) return false
      }

      // IR: filtrar por ano
      if (tipoDoc === 'ir') {
        const ano = parseDate(p.dtPagto || p.vencimento)?.getFullYear()
        if (String(ano) !== anoExercicio) return false
      }

      // Status
      if (statusSel.length > 0 && !statusSel.includes(p.status)) return false

      // Eventos
      const ev = p.evento || p.competencia || 'Mensalidade'
      if (eventosSel.length > 0 && !eventosSel.includes(ev)) return false

      return true
    })
  }, [parcelas, tipoDoc, dataInicio, dataFim, anoExercicio, statusSel, eventosSel])

  // ── Agrupamento ────────────────────────────────────────────────────────────
  const parcelasAgrupadas = useMemo(() => {
    const groups: Record<string, Parcela[]> = {}
    parcelasFiltradas.forEach(p => {
      let key = ''
      if (agrupamento === 'vencimento') key = p.vencimento?.slice(3, 10) || 'Sem data'
      else if (agrupamento === 'competencia') key = p.competencia || 'Sem competência'
      else if (agrupamento === 'evento') key = p.evento || p.competencia || 'Mensalidade'
      else if (agrupamento === 'status') key = p.status
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [parcelasFiltradas, agrupamento])

  // ── Totais ─────────────────────────────────────────────────────────────────
  const totalValorOriginal = parcelasFiltradas.reduce((s, p) => s + p.valor, 0)
  const totalDesconto = parcelasFiltradas.reduce((s, p) => s + (p.desconto || 0), 0)
  const totalJuros = parcelasFiltradas.reduce((s, p) => s + (p.juros || 0), 0)
  const totalMulta = parcelasFiltradas.reduce((s, p) => s + (p.multa || 0), 0)
  const totalPago = parcelasFiltradas.filter(p => p.status === 'pago').reduce((s, p) => s + p.valorFinal, 0)
  const totalAberto = parcelasFiltradas.filter(p => p.status !== 'pago' && p.status !== 'cancelado').reduce((s, p) => s + p.valorFinal, 0)

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  const toggleStatus = (s: string) =>
    setStatusSel(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const toggleEvento = (ev: string) =>
    setEventosSel(prev => prev.includes(ev) ? prev.filter(x => x !== ev) : [...prev, ev])

  const todosEventosSel = eventosSel.length === 0 || eventosSel.length === eventosUnicos.length

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    const emissao = new Date().toLocaleString('pt-BR')
    const tipoLabel = tipoDoc === 'creditos' ? 'Extrato de Créditos / Pagamentos'
      : tipoDoc === 'debitos' ? 'Extrato de Débitos'
      : `Declaração para Imposto de Renda — Exercício ${anoExercicio}`

    win.document.write(`<!DOCTYPE html><html><head>
      <title>${tipoLabel} — ${aluno.nome}</title>
      <meta charset="utf-8">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1e293b;padding:20px}
        .header{text-align:center;padding:16px 0 12px;border-bottom:2.5px solid #1e293b;margin-bottom:16px}
        .header h1{font-size:17px;font-weight:900;color:#1e293b;letter-spacing:-0.02em}
        .header p{font-size:11px;color:#475569;margin-top:3px}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;padding:10px 0;border-bottom:1px solid #e2e8f0;margin-bottom:12px}
        .info-item{display:flex;gap:5px;font-size:10px}
        .info-item strong{color:#1e293b;min-width:100px}
        .info-item span{color:#475569}
        table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px}
        th{background:#1e293b;color:white;padding:6px 8px;text-align:left;font-weight:700;font-size:9px;letter-spacing:0.04em;text-transform:uppercase}
        td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
        tr:nth-child(even)td{background:#f8fafc}
        .status-pago{color:#059669;font-weight:700}
        .status-pendente{color:#d97706;font-weight:700}
        .status-vencido{color:#dc2626;font-weight:700}
        .status-cancelado{color:#94a3b8}
        .text-right{text-align:right;font-family:monospace}
        .totals{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:12px}
        .totals-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .total-item{text-align:center}
        .total-item div:first-child{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600}
        .total-item div:last-child{font-size:13px;font-weight:900;font-family:monospace;margin-top:2px}
        .footer{font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:16px}
        .ir-notice{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px;margin-top:10px;font-size:10px;color:#1d4ed8}
        .group-header{background:#f8fafc;font-weight:700;font-size:10px;color:#475569;padding:5px 8px;border-bottom:1px solid #e2e8f0}
        @media print{body{padding:8px}@page{margin:12mm 10mm}}
      </style>
    </head><body>
      <div class="header">
        <h1>${tipoLabel}</h1>
        <p>${mat.escola || 'Instituição de Ensino'} ${turmaAtual?.unidade ? '— ' + turmaAtual.unidade : ''}</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><strong>Aluno:</strong><span>${aluno.nome}</span></div>
        <div class="info-item"><strong>RGA:</strong><span>${aluno.rga || aluno.codigo || '—'}</span></div>
        <div class="info-item"><strong>CPF:</strong><span>${aluno.cpf || '—'}</span></div>
        <div class="info-item"><strong>Curso/Turma:</strong><span>${turmaAtual?.nome || '—'}</span></div>
        <div class="info-item"><strong>Resp. Financeiro:</strong><span>${respFinanceiro?.nome || '—'}</span></div>
        <div class="info-item"><strong>Período:</strong><span>${fmtData(dataInicio)} a ${fmtData(dataFim)}</span></div>
        <div class="info-item"><strong>Emissão:</strong><span>${emissao}</span></div>
        ${tipoDoc === 'ir' ? `<div class="info-item"><strong>Exercício IR:</strong><span>${anoExercicio}</span></div>` : ''}
      </div>
      ${content}
      <div class="totals">
        <div class="totals-grid">
          <div class="total-item">
            <div>Valor Original</div>
            <div style="color:#1e293b">R$ ${fmtMoeda(totalValorOriginal)}</div>
          </div>
          <div class="total-item">
            <div>Descontos</div>
            <div style="color:#059669">- R$ ${fmtMoeda(totalDesconto)}</div>
          </div>
          <div class="total-item">
            <div>${tipoDoc === 'debitos' ? 'Total em Aberto' : 'Total Pago'}</div>
            <div style="color:${tipoDoc === 'debitos' ? '#dc2626' : '#059669'}">R$ ${fmtMoeda(tipoDoc === 'debitos' ? totalAberto : totalPago)}</div>
          </div>
        </div>
      </div>
      ${tipoDoc === 'ir' ? `<div class="ir-notice">
        <strong>DECLARAÇÃO PARA IMPOSTO DE RENDA — EXERCÍCIO ${anoExercicio}</strong><br>
        Declaramos que o responsável financeiro <strong>${respFinanceiro?.nome || '—'}</strong> efetuou pagamentos de despesas com educação 
        referentes ao aluno <strong>${aluno.nome}</strong>, no valor total de <strong>R$ ${fmtMoeda(totalPago)}</strong>, 
        no período de 01/01/${anoExercicio} a 31/12/${anoExercicio}. Este documento é válido para fins de declaração do IRPF, 
        conforme Lei nº 9.250/95 e RIR/2018.
      </div>` : ''}
      <div class="footer">
        Documento gerado em ${emissao} • ${mat.escola || 'Sistema de Gestão Escolar'} • Uso interno e declaratório
      </div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  if (!aberto) return null

  const TIPO_OPTIONS: { key: TipoDoc; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
    { key: 'creditos', label: 'Extrato de Créditos', icon: <TrendingUp size={15} />, desc: 'Pagamentos realizados, descontos e créditos', color: '#10b981' },
    { key: 'debitos',  label: 'Extrato de Débitos',  icon: <TrendingDown size={15} />, desc: 'Valores em aberto, vencidos e pendentes', color: '#f87171' },
    { key: 'ir',       label: 'Declaração IR',       icon: <Shield size={15} />, desc: `Consolidado fiscal — exercício ${anoExercicio}`, color: '#818cf8' },
  ]

  const STATUS_OPTS = ['pago', 'pendente', 'vencido', 'cancelado', 'cobranca', 'isento'] as const

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
      zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '16px', overflowY: 'auto', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'hsl(var(--bg-base))',
        borderRadius: 20, width: '100%', maxWidth: 980,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 120px rgba(0,0,0,0.7)',
        border: '1px solid hsl(var(--border-subtle))',
        marginBottom: 24, overflow: 'hidden',
      }}>

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg,rgba(129,140,248,0.08),rgba(16,185,129,0.04))',
          borderBottom: '1px solid hsl(var(--border-subtle))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(129,140,248,0.15)',
              border: '2px solid rgba(129,140,248,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Receipt size={22} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: '-0.02em' }}>
                Central Financeira do Aluno
              </div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                {aluno.nome} &nbsp;·&nbsp; {turmaAtual?.nome || 'Sem turma'} &nbsp;·&nbsp; {mat.anoLetivo || new Date().getFullYear()}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', background: 'hsl(var(--bg-overlay))', borderRadius: 8, padding: 3, gap: 2 }}>
              {([['filtros', '⚙️ Filtros'], ['preview', '📋 Visualizar']] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700,
                    background: activeTab === tab ? 'hsl(var(--bg-base))' : 'transparent',
                    color: activeTab === tab ? 'hsl(var(--text-base))' : 'hsl(var(--text-muted))',
                    boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                    transition: 'all 0.15s',
                  }}>{label}</button>
              ))}
            </div>
            <button onClick={onFechar} className="btn btn-ghost btn-icon" style={{ flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* ── SIDEBAR : FILTROS ───────────────────────────────────────────── */}
          {activeTab === 'filtros' && (
            <div style={{
              flex: 1, padding: '20px', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 14,
              background: 'hsl(var(--bg-base))',
            }}>

              {/* BOX 1 — Tipo de Documento */}
              <SectionBox title="Tipo de Documento" icon={<FileText size={12} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {TIPO_OPTIONS.map(opt => (
                    <button key={opt.key} onClick={() => setTipoDoc(opt.key)}
                      style={{
                        padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: tipoDoc === opt.key ? `${opt.color}14` : 'hsl(var(--bg-overlay))',
                        outline: tipoDoc === opt.key ? `2px solid ${opt.color}` : '1.5px solid hsl(var(--border-subtle))',
                        outlineOffset: tipoDoc === opt.key ? 0 : -1,
                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                        transition: 'all 0.15s',
                      }}>
                      <span style={{ color: opt.color }}>{opt.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: tipoDoc === opt.key ? opt.color : 'hsl(var(--text-base))' }}>{opt.label}</div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 1 }}>{opt.desc}</div>
                      </div>
                      {tipoDoc === opt.key && (
                        <span style={{ marginLeft: 'auto', color: opt.color, fontSize: 12 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </SectionBox>

              {/* BOX 2 — Período */}
              <SectionBox title="Período" icon={<Calendar size={12} />}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {([['mes', 'Mês atual'], ['ano', 'Ano atual'], ['ano_anterior', 'Ano anterior'], ['custom', 'Personalizado']] as const).map(([preset, label]) => (
                    <Chip key={preset} label={label} active={periodoPreset === preset}
                      onClick={() => aplicarPreset(preset)} />
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'block', marginBottom: 4 }}>Data Inicial</label>
                    <input type="date" className="form-input" value={dataInicio}
                      onChange={e => { setDataInicio(e.target.value); setPeriodoPreset('custom') }}
                      style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'block', marginBottom: 4 }}>Data Final</label>
                    <input type="date" className="form-input" value={dataFim}
                      onChange={e => { setDataFim(e.target.value); setPeriodoPreset('custom') }}
                      style={{ fontSize: 12 }} />
                  </div>
                </div>
              </SectionBox>

              {/* BOX 3 — Ano / Exercício (só visível para IR) */}
              {tipoDoc === 'ir' && (
                <SectionBox title="Exercício (Ano Fiscal)" icon={<Shield size={12} />}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    {[anoAtual, anoAtual - 1, anoAtual - 2].map(y => (
                      <Chip key={y} label={String(y)} color="#818cf8"
                        active={anoExercicio === String(y)}
                        onClick={() => { setAnoExercicio(String(y)); aplicarPreset('custom'); setDataInicio(`${y}-01-01`); setDataFim(`${y}-12-31`) }} />
                    ))}
                  </div>
                  <input type="number" className="form-input" value={anoExercicio}
                    onChange={e => setAnoExercicio(e.target.value)}
                    style={{ fontSize: 12, width: 100 }} placeholder="Ano" />
                  <div style={{ marginTop: 8, fontSize: 10, color: '#818cf8', padding: '6px 10px', background: 'rgba(129,140,248,0.08)', borderRadius: 6 }}>
                    ℹ️ Serão consolidados apenas pagamentos quitados no exercício {anoExercicio} para fins do IRPF.
                  </div>
                </SectionBox>
              )}

              {/* BOX 4 — Eventos Financeiros */}
              <SectionBox title="Eventos Financeiros" icon={<Tag size={12} />}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Chip label="Todos" active={todosEventosSel} color="#10b981"
                    onClick={() => setEventosSel([])} />
                  {eventosUnicos.map(ev => (
                    <Chip key={ev} label={ev} active={eventosSel.includes(ev)}
                      onClick={() => toggleEvento(ev)} />
                  ))}
                </div>
              </SectionBox>

              {/* BOX 5 — Situação Financeira */}
              <SectionBox title="Situação Financeira" icon={<Filter size={12} />}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Chip label="Todos" active={statusSel.length === STATUS_OPTS.length} color="#60a5fa"
                    onClick={() => setStatusSel([...STATUS_OPTS])} />
                  {STATUS_OPTS.map(s => {
                    const cfg = STATUS_CFG[s]
                    return (
                      <Chip key={s} label={`${cfg.icon} ${cfg.label}`} active={statusSel.includes(s)}
                        color={cfg.color} onClick={() => toggleStatus(s)} />
                    )
                  })}
                </div>
              </SectionBox>

              {/* BOX 6 — Agrupamento */}
              <SectionBox title="Agrupamento" icon={<Layers size={12} />}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    ['vencimento',  '📅 Vencimento'],
                    ['competencia', '🗓️ Competência'],
                    ['evento',      '🏷️ Evento'],
                    ['status',      '🚦 Situação'],
                  ] as const).map(([key, label]) => (
                    <Chip key={key} label={label} active={agrupamento === key}
                      color="#f59e0b" onClick={() => setAgrupamento(key)} />
                  ))}
                </div>
              </SectionBox>

              {/* Botão — ir para preview */}
              <button
                className="btn btn-primary"
                style={{ fontWeight: 800, padding: '12px', borderRadius: 12, marginTop: 4 }}
                onClick={() => setActiveTab('preview')}>
                📋 Visualizar Extrato ({parcelasFiltradas.length} lançamento{parcelasFiltradas.length !== 1 ? 's' : ''})
              </button>
            </div>
          )}

          {/* ── PREVIEW / EXTRATO ───────────────────────────────────────────── */}
          {activeTab === 'preview' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Filtros rápidos inline */}
              <div style={{
                padding: '10px 20px', borderBottom: '1px solid hsl(var(--border-subtle))',
                display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                background: 'hsl(var(--bg-elevated))', flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>TIPO:</span>
                {TIPO_OPTIONS.map(opt => (
                  <Chip key={opt.key} label={opt.label} active={tipoDoc === opt.key}
                    color={opt.color} onClick={() => setTipoDoc(opt.key)} />
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                  {fmtData(dataInicio)} → {fmtData(dataFim)}
                </span>
              </div>

              {/* Área printável */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                {/* Cards de totais */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Qtd. Lançamentos', value: String(parcelasFiltradas.length), color: '#60a5fa', icon: '📋' },
                    { label: 'Valor Original', value: `R$ ${fmtMoeda(totalValorOriginal)}`, color: '#94a3b8', icon: '💰' },
                    { label: tipoDoc === 'debitos' ? 'Total em Aberto' : 'Total Pago', value: `R$ ${fmtMoeda(tipoDoc === 'debitos' ? totalAberto : totalPago)}`, color: tipoDoc === 'debitos' ? '#f87171' : '#10b981', icon: tipoDoc === 'debitos' ? '⏳' : '✅' },
                    { label: 'Total Descontos', value: `- R$ ${fmtMoeda(totalDesconto)}`, color: '#f59e0b', icon: '🏷️' },
                  ].map(k => (
                    <div key={k.label} style={{
                      padding: '12px 14px', borderRadius: 12,
                      border: '1px solid hsl(var(--border-subtle))',
                      background: 'hsl(var(--bg-elevated))',
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>{k.icon}</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: 3 }}>{k.label}</div>
                      <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 13, color: k.color }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Declaração IR — destaque */}
                {tipoDoc === 'ir' && (
                  <div style={{
                    padding: 16, borderRadius: 12,
                    background: 'rgba(129,140,248,0.08)',
                    border: '1.5px solid rgba(129,140,248,0.3)',
                    marginBottom: 16, fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 800, color: '#818cf8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Shield size={14} /> DECLARAÇÃO PARA IMPOSTO DE RENDA — EXERCÍCIO {anoExercicio}
                    </div>
                    <div style={{ color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
                      Declaramos que o responsável financeiro <strong style={{ color: 'hsl(var(--text-base))' }}>{respFinanceiro?.nome || '—'}</strong> efetuou pagamentos 
                      de despesas com educação referentes ao aluno <strong style={{ color: 'hsl(var(--text-base))' }}>{aluno.nome}</strong>, 
                      no valor total de <strong style={{ color: '#10b981', fontSize: 13 }}>R$ {fmtMoeda(totalPago)}</strong>, 
                      no exercício {anoExercicio}. Documento válido para declaração do IRPF.
                    </div>
                    {respFinanceiro?.email && (
                      <div style={{ marginTop: 6, fontSize: 10, color: '#818cf8' }}>
                        📧 Email do responsável: {respFinanceiro.email}
                      </div>
                    )}
                  </div>
                )}

                {/* Área de conteúdo imprimível */}
                <div ref={printRef}>
                  {parcelasFiltradas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'hsl(var(--text-muted))' }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Nenhum lançamento encontrado</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Ajuste os filtros e tente novamente.</div>
                    </div>
                  ) : (
                    parcelasAgrupadas.map(([grupo, items]) => (
                      <div key={grupo} style={{ marginBottom: 20 }}>
                        {/* Cabeçalho do grupo */}
                        <div style={{
                          padding: '7px 12px', background: 'hsl(var(--bg-elevated))',
                          borderRadius: '8px 8px 0 0',
                          border: '1px solid hsl(var(--border-subtle))',
                          borderBottom: 'none',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <span style={{ fontWeight: 800, fontSize: 11, color: '#818cf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {grupo}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 12, color: '#10b981' }}>
                            R$ {fmtMoeda(items.reduce((s, p) => s + p.valorFinal, 0))}
                          </span>
                        </div>

                        {/* Tabela do grupo */}
                        <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead>
                              <tr style={{ background: 'hsl(var(--bg-overlay))' }}>
                                {['Parc.', 'Evento', 'Competência', 'Vencimento', 'Pagamento', 'Forma', 'V. Original', 'Desconto', 'Juros/Multa', 'V. Final', 'Situação'].map(h => (
                                  <th key={h} style={{
                                    padding: '6px 10px', textAlign: h.includes('V.') || h === 'Desconto' || h.includes('Juros') ? 'right' : 'left',
                                    fontSize: 9, fontWeight: 800, color: 'hsl(var(--text-muted))',
                                    letterSpacing: '0.04em', textTransform: 'uppercase',
                                    borderBottom: '1px solid hsl(var(--border-subtle))',
                                    whiteSpace: 'nowrap',
                                  }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((p, idx) => {
                                const sc = STATUS_CFG[p.status] || STATUS_CFG.pendente
                                const isAtrasado = p.status === 'pendente' && (() => {
                                  const d = parseDate(p.vencimento)
                                  return d ? d < new Date() : false
                                })()
                                return (
                                  <tr key={`${grupo}-${p.num}-${idx}`}
                                    style={{
                                      background: idx % 2 === 0 ? 'transparent' : 'hsl(var(--bg-overlay))',
                                      borderLeft: `3px solid ${sc.color}`,
                                    }}>
                                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, color: '#60a5fa' }}>
                                      {String(p.num).padStart(2, '0')}
                                    </td>
                                    <td style={{ padding: '7px 10px', fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {p.evento || 'Mensalidade'}
                                    </td>
                                    <td style={{ padding: '7px 10px', fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                                      {p.competencia || '—'}
                                    </td>
                                    <td style={{ padding: '7px 10px', fontSize: 10, whiteSpace: 'nowrap', color: isAtrasado ? '#f87171' : 'inherit', fontWeight: isAtrasado ? 700 : 400 }}>
                                      {fmtData(p.vencimento)}
                                      {isAtrasado && <div style={{ fontSize: 9, color: '#f87171' }}>VENCIDA</div>}
                                    </td>
                                    <td style={{ padding: '7px 10px', fontSize: 10, whiteSpace: 'nowrap', color: '#10b981' }}>
                                      {p.dtPagto ? fmtData(p.dtPagto) : '—'}
                                    </td>
                                    <td style={{ padding: '7px 10px', fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                                      {p.formaPagto || '—'}
                                    </td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>
                                      R$ {fmtMoeda(p.valor)}
                                    </td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: '#10b981' }}>
                                      {p.desconto > 0 ? `- R$ ${fmtMoeda(p.desconto)}` : '—'}
                                    </td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: '#f59e0b' }}>
                                      {(p.juros || 0) + (p.multa || 0) > 0
                                        ? `+ R$ ${fmtMoeda((p.juros || 0) + (p.multa || 0))}`
                                        : '—'}
                                    </td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 12, color: sc.color }}>
                                      R$ {fmtMoeda(p.valorFinal)}
                                    </td>
                                    <td style={{ padding: '7px 10px' }}>
                                      <span style={{
                                        fontSize: 9, padding: '2px 7px', borderRadius: 100,
                                        background: sc.bg, color: sc.color, fontWeight: 700,
                                        whiteSpace: 'nowrap', border: `1px solid ${sc.color}30`,
                                      }}>
                                        {sc.icon} {sc.label}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            {/* Sub-total do grupo */}
                            <tfoot>
                              <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                                <td colSpan={6} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>
                                  Subtotal — {items.length} lançamento{items.length !== 1 ? 's' : ''}
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 11 }}>
                                  R$ {fmtMoeda(items.reduce((s, p) => s + p.valor, 0))}
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 11, color: '#10b981' }}>
                                  - R$ {fmtMoeda(items.reduce((s, p) => s + (p.desconto || 0), 0))}
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 11, color: '#f59e0b' }}>
                                  {items.reduce((s, p) => s + (p.juros || 0) + (p.multa || 0), 0) > 0
                                    ? `+ R$ ${fmtMoeda(items.reduce((s, p) => s + (p.juros || 0) + (p.multa || 0), 0))}`
                                    : '—'}
                                </td>
                                <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 12, color: '#818cf8' }}>
                                  R$ {fmtMoeda(items.reduce((s, p) => s + p.valorFinal, 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Rodapé consolidado */}
                {parcelasFiltradas.length > 0 && (
                  <div style={{
                    marginTop: 8, padding: '14px 20px',
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 12,
                    display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12,
                  }}>
                    {[
                      { label: 'Total Lançamentos', value: `R$ ${fmtMoeda(totalValorOriginal)}`, color: '#60a5fa' },
                      { label: 'Total Descontos', value: `- R$ ${fmtMoeda(totalDesconto)}`, color: '#10b981' },
                      { label: 'Juros / Multa', value: `+ R$ ${fmtMoeda(totalJuros + totalMulta)}`, color: '#f59e0b' },
                      { label: 'Total Pago', value: `R$ ${fmtMoeda(totalPago)}`, color: '#10b981' },
                      { label: 'Saldo em Aberto', value: `R$ ${fmtMoeda(totalAberto)}`, color: totalAberto > 0 ? '#f87171' : '#94a3b8' },
                    ].map(k => (
                      <div key={k.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
                        <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 13, color: k.color }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER / AÇÕES ────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'hsl(var(--bg-elevated))', flexShrink: 0, flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Ações principais */}
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <Printer size={13} />Imprimir
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <Download size={13} />Exportar PDF
            </button>
            <button className="btn btn-secondary btn-sm"
              title="Funcionalidade em breve"
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: 0.6, cursor: 'not-allowed' }}>
              <Mail size={13} />Enviar E-mail
            </button>
            <button className="btn btn-secondary btn-sm"
              title="Funcionalidade em breve"
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: 0.6, cursor: 'not-allowed' }}>
              <Send size={13} />WhatsApp
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
              {parcelasFiltradas.length} lançamento{parcelasFiltradas.length !== 1 ? 's' : ''}&nbsp;&nbsp;·&nbsp;&nbsp;
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <button onClick={onFechar} className="btn btn-secondary" style={{ fontSize: 12 }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
