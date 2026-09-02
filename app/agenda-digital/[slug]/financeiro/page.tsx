'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  CalendarDays,
  Receipt,
  Search,
  ArrowUpRight,
  Sparkles,
  DollarSign,
  FileCheck2,
  Percent,
  CalendarCheck,
  CreditCard,
  CircleAlert,
  GraduationCap,
  AlertCircle,
  User,
  Users,
  FileText
} from 'lucide-react'

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { PixBottomSheet } from '../../components/PixBottomSheet'
import { DeclaracaoIrpfModal } from '../../components/DeclaracaoIrpfModal'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ParcelaStatus = 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELED' | 'AGGLUTINATED' | 'RENEGOTIATED'

interface Desconto {
  valor: string
  descricao: string
}

interface Parcela {
  id: string
  descricao: string
  tipo: string
  status: ParcelaStatus
  vencimento: string
  dataPagamento: string | null
  competencia: string
  anoReferencia: string
  valorBase: number
  valorEfetivo: number
  valorPago: number
  valorFormatado: string
  valorPagoFormatado: string
  valorBaseFormatado: string
  descontos: Desconto[]
  aluno: string
  alunoId: string
  responsavel: string
  multa: number
  juros: number
  multaFormatado: string
  jurosFormatado: string
  receivables: any[] | null
  contractId: string
}

interface Summary {
  totalEmAberto: number
  totalEmAbertoFormatado: string
  totalVencido?: number
  totalVencidoFormatado?: string
  totalPago: number
  totalPagoFormatado: string
  quantidadeEmAberto: number
  quantidadeVencidas: number
  quantidadePagas: number
  proximoVencimento: {
    valor: string
    data: string
    descricao: string
    aluno?: string
    id?: string
    receivables?: any[] | null
  } | null
  isAdimplente: boolean
}

interface IsaacData {
  parcelas: Parcela[]
  summary: Summary
  guardianId: string
  ano: string
}

type TabKey = 'emAberto' | 'pagas' | 'todas'
type AnoFilter = '2024' | '2025' | '2026'

// ─── Helpers de Formatação e Estilo ──────────────────────────────────────────

const STATUS_THEMES: Record<
  ParcelaStatus,
  {
    label: string
    badgeBg: string
    badgeText: string
    badgeBorder: string
    dotColor: string
    icon: React.ReactNode
  }
> = {
  OPEN: {
    label: 'Em Aberto',
    badgeBg: '#f0f9ff',
    badgeText: '#0284c7',
    badgeBorder: '#bae6fd',
    dotColor: '#0284c7',
    icon: <Clock size={11} strokeWidth={2.5} />,
  },
  OVERDUE: {
    label: 'Vencida',
    badgeBg: '#fef2f2',
    badgeText: '#dc2626',
    badgeBorder: '#fecaca',
    dotColor: '#dc2626',
    icon: <AlertTriangle size={11} strokeWidth={2.5} />,
  },
  PAID: {
    label: 'Quitada',
    badgeBg: '#ecfdf5',
    badgeText: '#059669',
    badgeBorder: '#a7f3d0',
    dotColor: '#10b981',
    icon: <CheckCircle2 size={11} strokeWidth={2.5} />,
  },
  CANCELED: {
    label: 'Cancelada',
    badgeBg: '#f8fafc',
    badgeText: '#64748b',
    badgeBorder: '#e2e8f0',
    dotColor: '#94a3b8',
    icon: <XCircle size={11} strokeWidth={2.5} />,
  },
  AGGLUTINATED: {
    label: 'Aglutinada',
    badgeBg: '#f5f3ff',
    badgeText: '#7c3aed',
    badgeBorder: '#ddd6fe',
    dotColor: '#8b5cf6',
    icon: <Receipt size={11} strokeWidth={2.5} />,
  },
  RENEGOTIATED: {
    label: 'Renegociada',
    badgeBg: '#fffbeb',
    badgeText: '#d97706',
    badgeBorder: '#fde68a',
    dotColor: '#f59e0b',
    icon: <Percent size={11} strokeWidth={2.5} />,
  },
}

function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-')
    if (year && month && day) {
      return `${day}/${month}/${year}`
    }
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getCompetenceLabel(competenceStr: string): string {
  if (!competenceStr) return ''
  try {
    const parts = competenceStr.split('-')
    if (parts.length >= 2) {
      const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
      const monthIndex = parseInt(parts[1], 10) - 1
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${monthNames[monthIndex]} ${parts[0]}`
      }
    }
    return competenceStr
  } catch {
    return competenceStr
  }
}

function checkIsOverdue(parcela: Parcela): boolean {
  if (parcela.status === 'PAID' || parcela.status === 'CANCELED') return false
  if (parcela.status === 'OVERDUE') return true
  if (parcela.status === 'OPEN' && parcela.vencimento) {
    const due = new Date(parcela.vencimento + 'T23:59:59')
    return due < new Date()
  }
  return false
}

// ─── Skeleton Loader Responsivo ──────────────────────────────────────────────

function FinancialSkeletonLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'pulse 1.5s infinite ease-in-out' }}>
      <div style={{ height: 140, background: '#ffffff', borderRadius: 24, border: '1.5px solid #edf2f7', padding: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ height: 80, background: '#ffffff', borderRadius: 20, border: '1.5px solid #edf2f7' }} />
        <div style={{ height: 80, background: '#ffffff', borderRadius: 20, border: '1.5px solid #edf2f7' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 110, background: '#ffffff', borderRadius: 20, border: '1.5px solid #edf2f7' }} />
        ))}
      </div>
    </div>
  )
}

// ─── Card de Parcela com Badge do Aluno Bem Visível ──────────────────────────

function MobileInvoiceCard({
  parcela,
  onOpenPix,
}: {
  parcela: Parcela
  onOpenPix: (p: Parcela) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isVencida = checkIsOverdue(parcela)
  const effectiveTheme = isVencida ? STATUS_THEMES.OVERDUE : (STATUS_THEMES[parcela.status] || STATUS_THEMES.OPEN)
  const canPay = (parcela.status === 'OPEN' || isVencida) && parcela.valorEfetivo > 0

  const competenceFormatted = getCompetenceLabel(parcela.competencia)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      style={{
        background: '#ffffff',
        borderRadius: 22,
        border: `1.5px solid ${isVencida ? '#fecaca' : isExpanded ? '#cbd5e1' : '#edf2f7'}`,
        boxShadow: isExpanded
          ? '0 10px 25px -4px rgba(0, 0, 0, 0.06)'
          : '0 2px 8px -2px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Cabeçalho do Card */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '16px 18px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Linha 1: Badges de Competência, Status e Valor */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* Tag Mês */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: parcela.status === 'PAID' ? '#059669' : isVencida ? '#dc2626' : '#0284c7',
                background: parcela.status === 'PAID' ? '#ecfdf5' : isVencida ? '#fef2f2' : '#f0f9ff',
                border: `1px solid ${parcela.status === 'PAID' ? '#a7f3d0' : isVencida ? '#fecaca' : '#bae6fd'}`,
                padding: '3px 9px',
                borderRadius: 8,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              {competenceFormatted || parcela.anoReferencia}
            </span>

            {/* Status Badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 9px',
                borderRadius: 100,
                background: effectiveTheme.badgeBg,
                border: `1px solid ${effectiveTheme.badgeBorder}`,
                color: effectiveTheme.badgeText,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {effectiveTheme.icon}
              {isVencida ? 'Vencida' : effectiveTheme.label}
            </span>
          </div>

          {/* Valor da Fatura */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: parcela.status === 'PAID' ? '#059669' : isVencida ? '#dc2626' : '#0f172a',
              letterSpacing: '-0.02em',
              textAlign: 'right',
            }}
          >
            {parcela.status === 'PAID' ? parcela.valorPagoFormatado : parcela.valorFormatado}
          </div>
        </div>

        {/* Linha 2: BADGE DO ALUNO BEM VISÍVEL */}
        {parcela.aluno && (
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 11px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                border: '1px solid #c7d2fe',
                color: '#3730a3',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: -0.1,
                boxShadow: '0 1px 3px rgba(79, 70, 229, 0.08)',
              }}
            >
              <GraduationCap size={14} color="#4f46e5" strokeWidth={2.5} />
              <span>{parcela.aluno}</span>
            </div>
          </div>
        )}

        {/* Linha 3: Descrição e Vencimento */}
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
            }}
          >
            {parcela.descricao}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 4,
              fontSize: 11.5,
              color: '#64748b',
              fontWeight: 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <CalendarDays size={12} color="#94a3b8" />
              {parcela.status === 'PAID' ? (
                <span>
                  Liquidada em <strong style={{ color: '#059669' }}>{formatDateDisplay(parcela.dataPagamento)}</strong>
                </span>
              ) : (
                <span>
                  Vence em <strong style={{ color: isVencida ? '#dc2626' : '#1e293b' }}>{formatDateDisplay(parcela.vencimento)}</strong>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4f46e5', fontWeight: 700, fontSize: 11.5 }}>
              <span>{isExpanded ? 'Ocultar' : 'Detalhes'}</span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>
        </div>
      </div>

      {/* Botão Pagar com Pix Rápido Direto no Card se Em Aberto */}
      {canPay && (
        <div style={{ padding: '0 16px 16px' }}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation()
              onOpenPix(parcela)
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 3px 10px rgba(2, 132, 199, 0.25)',
              letterSpacing: '-0.01em',
            }}
          >
            <Smartphone size={15} />
            Pagar ({parcela.valorFormatado})
          </motion.button>
        </div>
      )}

      {/* Detalhes Expandidos (Acordeão) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '14px 18px 18px',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Valor Base</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginTop: 1 }}>{parcela.valorBaseFormatado}</div>
                </div>

                {parcela.descontos?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>Desconto</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginTop: 1 }}>
                      −{parcela.descontos[0]?.valor}
                    </div>
                  </div>
                )}

                {parcela.multa > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 800, textTransform: 'uppercase' }}>Multa</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginTop: 1 }}>+{parcela.multaFormatado}</div>
                  </div>
                )}

                {parcela.juros > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 800, textTransform: 'uppercase' }}>Juros</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginTop: 1 }}>+{parcela.jurosFormatado}</div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Aluno(a)</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#3730a3', marginTop: 1 }}>{parcela.aluno || '—'}</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Identificador</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', marginTop: 1 }}>{parcela.id.slice(0, 10)}...</div>
                </div>
              </div>

              {/* Botão Boleto se houver */}
              {parcela.receivables?.[0]?.bank_slip_url && (
                <a
                  href={parcela.receivables[0].bank_slip_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={14} color="#64748b" />
                  Abrir Boleto Bancário em PDF
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Componente Principal ────────────────────────────────────────────────────

export default function ADFinanceiroPage() {
  const { adConfig } = useAgendaDigital()
  const { aluno: currentStudent } = useSelectedStudent()

  const [data, setData] = useState<IsaacData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [activeTab, setActiveTab] = useState<TabKey>('emAberto')
  const [selectedAno, setSelectedAno] = useState<AnoFilter>('2026')
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('todos')
  const [irpfModalOpen, setIrpfModalOpen] = useState(false)

  const [pixModal, setPixModal] = useState<{
    isOpen: boolean
    parcela: Parcela | null
    pixCode: string | null
    boletoUrl: string | null
    checkoutUrl: string | null
    isLoading: boolean
    error: string | null
  }>({
    isOpen: false,
    parcela: null,
    pixCode: null,
    boletoUrl: null,
    checkoutUrl: null,
    isLoading: false,
    error: null,
  })

  // ── Fetch Dados ────────────────────────────────────────────────────────────
  const fetchFinanceiro = useCallback(async (ano: AnoFilter) => {
    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const res = await fetch(`/api/isaac/parcelas?ano=${ano}`)
      const json = await res.json()

      if (res.status === 404 && json.notFound) {
        setNotFound(true)
        setData(null)
        return
      }

      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível carregar as informações financeiras.')
      }

      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFinanceiro(selectedAno)
  }, [fetchFinanceiro, selectedAno])

  // Lista única de alunos para filtro rápido quando houver mais de 1 filho
  const uniqueStudents = useMemo(() => {
    if (!data?.parcelas) return []
    const names = Array.from(new Set(data.parcelas.map((p) => p.aluno).filter(Boolean)))
    return names
  }, [data])

  // Lista estruturada de alunos para a Declaração de IRPF
  const alunosOptions = useMemo(() => {
    const map = new Map<string, { id?: string; nome: string; turma?: string }>()

    // 1. Inclui o aluno ativo na sessão se disponível
    if (currentStudent?.nome) {
      map.set(currentStudent.nome, {
        id: currentStudent.id ? String(currentStudent.id) : undefined,
        nome: currentStudent.nome,
        turma: currentStudent.turma_nome || currentStudent.turma || '',
      })
    }

    // 2. Inclui os alunos retornados pelas faturas do Isaac
    if (data?.parcelas) {
      for (const p of data.parcelas) {
        if (!p.aluno) continue
        if (!map.has(p.aluno)) {
          map.set(p.aluno, {
            id: p.alunoId,
            nome: p.aluno,
            turma: p.descricao?.split('-')?.[1]?.trim() || '',
          })
        }
      }
    }

    return Array.from(map.values())
  }, [data, currentStudent])

  // ── Filtro de Faturas ──────────────────────────────────────────────────────
  const filteredList = useMemo(() => {
    if (!data?.parcelas) return []

    let items = data.parcelas

    // Filtro por Tab
    if (activeTab === 'emAberto') {
      items = items.filter((p) => p.status === 'OPEN' || p.status === 'OVERDUE' || checkIsOverdue(p))
    } else if (activeTab === 'pagas') {
      items = items.filter((p) => p.status === 'PAID')
    } else {
      items = items.filter((p) => p.status !== 'CANCELED' || p.valorPago > 0)
    }

    // Filtro por Aluno Específico
    if (selectedStudentFilter !== 'todos') {
      items = items.filter((p) => p.aluno === selectedStudentFilter)
    }

    // Deduplicação defensiva por ID
    const seen = new Set<string>()
    return items.filter((p) => {
      if (!p.id || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }, [data, activeTab, selectedStudentFilter])

  // ── Abertura do Modal Pix ──────────────────────────────────────────────────
  const handleTriggerPix = useCallback((parcela: Parcela) => {
    const receivable = parcela.receivables?.[0]
    setPixModal({
      isOpen: true,
      parcela,
      pixCode: receivable?.pix_qr_code || null,
      boletoUrl: receivable?.bank_slip_url || null,
      checkoutUrl: receivable?.checkout_url || null,
      isLoading: false,
      error: receivable?.pix_qr_code || receivable?.checkout_url
        ? null
        : 'Código Pix em processamento ou não disponível para esta modalidade. Você também pode acessar o portal isaac ou consultar a secretaria da escola.',
    })
  }, [])

  // Próxima fatura para destaque
  const proximaFaturaObj = useMemo(() => {
    if (!data?.parcelas) return null
    return (
      data.parcelas
        .filter((p) => (p.status === 'OPEN' || checkIsOverdue(p)) && p.valorEfetivo > 0)
        .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())[0] || null
    )
  }, [data])

  // ── Permissão ──────────────────────────────────────────────────────────────
  if (adConfig?.permissoes?.visualizarFinanceiro === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard
          title="Acesso Financeiro Restrito"
          description="A visualização do painel financeiro está temporariamente suspensa para a sua conta pela instituição."
          icon={<CircleAlert size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  const ANOS: AnoFilter[] = ['2024', '2025', '2026']

  return (
    <div
      style={{
        maxWidth: 780,
        margin: '0 auto',
        padding: '10px 14px 120px',
        fontFamily: 'Outfit, Inter, system-ui, sans-serif',
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── HEADER CARD UNIFICADO & ULTRA MODERNO ─────────────────────────────── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 22,
          border: '1.5px solid #edf2f7',
          padding: '16px 18px',
          marginBottom: 16,
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Linha Superior: Título + Sincronização + Seletor de Ano + Refresh */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Lado Esquerdo: Ícone + Título + Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 14px rgba(79, 70, 229, 0.22)',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <Wallet size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                  }}
                >
                  Financeiro
                </h1>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#4f46e5',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    padding: '2px 8px',
                    borderRadius: 6,
                    letterSpacing: 0.2,
                  }}
                >
                  isaac
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                Gestão de faturas e mensalidades escolares
              </p>
            </div>
          </div>

          {/* Lado Direito: Declaração IRPF + Seletor de Ano + Botão Atualizar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Botão Declaração IRPF */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setIrpfModalOpen(true)}
              title="Gerar Declaração Anual de IRPF / Quitação de Débitos"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 11,
                border: '1.5px solid #c7d2fe',
                background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                color: '#4338ca',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.12)',
                transition: 'all 0.2s',
              }}
            >
              <FileText size={14} color="#4f46e5" />
              <span>Declaração IRPF</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  background: '#4f46e5',
                  color: '#ffffff',
                  padding: '1px 5px',
                  borderRadius: 4,
                  letterSpacing: 0.3,
                }}
              >
                PDF
              </span>
            </motion.button>

            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: 3,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
              }}
            >
              {ANOS.map((ano) => (
                <button
                  key={ano}
                  onClick={() => setSelectedAno(ano)}
                  style={{
                    padding: '6px 13px',
                    borderRadius: 9,
                    border: 'none',
                    background: selectedAno === ano ? '#ffffff' : 'transparent',
                    color: selectedAno === ano ? '#4f46e5' : '#64748b',
                    fontWeight: 800,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    boxShadow: selectedAno === ano ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {ano}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchFinanceiro(selectedAno)}
              disabled={loading}
              title="Atualizar dados em tempo real"
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                transition: 'all 0.2s',
              }}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Linha Inferior Integrada: Status de Saúde Financeira */}
        {!loading && data && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 13px',
              borderRadius: 12,
              background: data.summary.isAdimplente ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${data.summary.isAdimplente ? '#bbf7d0' : '#fecaca'}`,
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: data.summary.isAdimplente ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                {data.summary.isAdimplente ? (
                  <CheckCircle2 size={12} strokeWidth={3} />
                ) : (
                  <AlertTriangle size={12} strokeWidth={3} />
                )}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: data.summary.isAdimplente ? '#15803d' : '#b91c1c',
                }}
              >
                {data.summary.isAdimplente
                  ? `Situação Regularizada em ${selectedAno}`
                  : `Atenção: ${data.summary.quantidadeVencidas} fatura(s) vencida(s) no exercício`}
              </span>
            </div>

            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: data.summary.isAdimplente ? '#15803d' : '#b91c1c',
                background: '#ffffff',
                padding: '2px 8px',
                borderRadius: 100,
                border: `1px solid ${data.summary.isAdimplente ? '#bbf7d0' : '#fecaca'}`,
              }}
            >
              {data.summary.isAdimplente ? '✓ Contas em Dia' : '! Pendências'}
            </span>
          </div>
        )}
      </div>

      {/* ── Loading Skeleton ─────────────────────────────────────────────────── */}
      {loading && <FinancialSkeletonLoader />}

      {/* ── Error Screen ─────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #fecaca',
            borderRadius: 20,
            padding: '24px 18px',
            textAlign: 'center',
            boxShadow: '0 6px 16px rgba(220, 38, 38, 0.05)',
          }}
        >
          <AlertCircle size={28} color="#dc2626" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            Erro ao Carregar Faturas
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16, lineHeight: 1.4 }}>
            {error}
          </div>
          <button
            onClick={() => fetchFinanceiro(selectedAno)}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={13} /> Tentar Novamente
          </button>
        </div>
      )}

      {/* ── Not Found ────────────────────────────────────────────────────────── */}
      {!loading && notFound && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '45vh', padding: 16 }}>
          <EmptyStateCard
            title="Vínculo Financeiro Não Encontrado"
            description="Não encontramos o responsável financeiro vinculado à sua conta. Solicite a atualização na secretaria da escola."
            icon={<Wallet size={40} style={{ color: '#4f46e5', opacity: 0.7 }} />}
          />
        </div>
      )}

      {/* ── Conteúdo Carregado ───────────────────────────────────────────────── */}
      {!loading && !error && !notFound && data && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>

          {/* ── CARD DE DÉBITO TOTAL EM ATRASO (Renderizado APENAS quando houver pendências) ── */}
          {Boolean((data.summary.quantidadeVencidas ?? 0) > 0 || (data.summary.totalVencido ?? 0) > 0) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: 'linear-gradient(145deg, #1e1b4b 0%, #450a0a 100%)',
                borderRadius: 22,
                padding: '18px',
                marginBottom: 14,
                boxShadow: '0 10px 28px -4px rgba(220, 38, 38, 0.25)',
                color: '#ffffff',
                position: 'relative',
                overflow: 'hidden',
                border: '1.5px solid rgba(248, 113, 113, 0.3)',
              }}
            >
              {/* Efeito Glow Vermelho */}
              <div
                style={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(239, 68, 68, 0.35) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#ef4444',
                      boxShadow: '0 0 8px #ef4444',
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: '#fca5a5', letterSpacing: 0.6 }}>
                    Débito Total em Atraso
                  </span>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    padding: '3px 9px',
                    borderRadius: 8,
                  }}
                >
                  {data.summary.quantidadeVencidas} Fatura(s) Vencida(s)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.03em' }}>
                  {data.summary.totalVencidoFormatado || `R$ ${((data.summary.totalVencido || 0) / 100).toFixed(2).replace('.', ',')}`}
                </div>
                <div style={{ fontSize: 11.5, color: '#fca5a5', fontWeight: 700 }}>
                  Exercício {selectedAno}
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#fecaca', fontWeight: 500, marginBottom: 14, lineHeight: 1.4 }}>
                Existem parcelas com vencimento expirado. Regularize suas pendências para evitar encargos adicionais.
              </div>

              {/* Botão de Ação Rápida -> Redireciona diretamente para o Portal Isaac */}
              <a
                href="https://meu.olaisaac.io/auth"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={16} />
                Regularizar Débito
              </a>
            </motion.div>
          )}

          {/* ── Sub-Métricas: Em Aberto e Total Liquidado (2 Colunas Compactas) ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {/* Em Aberto */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 18,
                border: '1.5px solid #edf2f7',
                padding: '12px 14px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.4 }}>
                  Em Aberto
                </span>
                <Clock size={13} color="#d97706" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                {data.summary.totalEmAbertoFormatado}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                {data.summary.quantidadeEmAberto} pendente(s)
              </div>
            </div>

            {/* Total Liquidado */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 18,
                border: '1.5px solid #edf2f7',
                padding: '12px 14px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.4 }}>
                  Total Pago
                </span>
                <FileCheck2 size={13} color="#059669" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#059669', letterSpacing: '-0.02em' }}>
                {data.summary.totalPagoFormatado}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                {data.summary.quantidadePagas} quitada(s)
              </div>
            </div>
          </div>

          {/* ── Toolbar: Tabs de Status + Seletor de Alunos Moderno ────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {/* Tabs de Status: Em Aberto / Pagas / Todas */}
            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: 3,
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                gap: 2,
              }}
            >
              {[
                { key: 'emAberto' as TabKey, label: 'Em Aberto', count: data.summary.quantidadeEmAberto },
                { key: 'pagas' as TabKey, label: 'Pagas', count: data.summary.quantidadePagas },
                {
                  key: 'todas' as TabKey,
                  label: 'Todas',
                  count: data.parcelas.filter((p) => p.status !== 'CANCELED' || p.valorPago > 0).length,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    padding: '7px 4px',
                    borderRadius: 11,
                    border: 'none',
                    background: activeTab === tab.key ? '#ffffff' : 'transparent',
                    color: activeTab === tab.key ? '#0f172a' : '#64748b',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      background: activeTab === tab.key ? '#e0e7ff' : '#e2e8f0',
                      color: activeTab === tab.key ? '#4f46e5' : '#64748b',
                      padding: '1px 5px',
                      borderRadius: 100,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* ── SELETOR DE ALUNOS ULTRA MODERNO (Exibido quando houver mais de 1 aluno) ── */}
            {uniqueStudents.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  overflowX: 'auto',
                  padding: '4px 2px',
                  scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {/* Botão: Todos os Filhos */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedStudentFilter('todos')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 14,
                    border: selectedStudentFilter === 'todos' ? '1.5px solid #4f46e5' : '1.5px solid #e2e8f0',
                    background: selectedStudentFilter === 'todos' ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' : '#ffffff',
                    color: selectedStudentFilter === 'todos' ? '#ffffff' : '#334155',
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    boxShadow: selectedStudentFilter === 'todos' ? '0 4px 12px rgba(79, 70, 229, 0.25)' : '0 1px 3px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s',
                  }}
                >
                  <Users size={14} color={selectedStudentFilter === 'todos' ? '#ffffff' : '#64748b'} />
                  <span>Todos os Alunos</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      background: selectedStudentFilter === 'todos' ? 'rgba(255, 255, 255, 0.25)' : '#f1f5f9',
                      color: selectedStudentFilter === 'todos' ? '#ffffff' : '#64748b',
                      padding: '1px 6px',
                      borderRadius: 100,
                    }}
                  >
                    {data.parcelas.filter((p) => p.status !== 'CANCELED' || p.valorPago > 0).length}
                  </span>
                </motion.button>

                {/* Botões Individuais de cada Aluno */}
                {uniqueStudents.map((stName) => {
                  const isSelected = selectedStudentFilter === stName
                  const studentInvoiceCount = data.parcelas.filter(
                    (p) => p.aluno === stName && (p.status !== 'CANCELED' || p.valorPago > 0)
                  ).length
                  const initials = stName
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()

                  return (
                    <motion.button
                      key={stName}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedStudentFilter(stName)}
                      style={{
                        padding: '6px 14px 6px 8px',
                        borderRadius: 14,
                        border: isSelected ? '1.5px solid #4f46e5' : '1.5px solid #e2e8f0',
                        background: isSelected ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#334155',
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.25)' : '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* Avatar com Iniciais */}
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          background: isSelected ? 'rgba(255, 255, 255, 0.25)' : '#e0e7ff',
                          color: isSelected ? '#ffffff' : '#4f46e5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 900,
                        }}
                      >
                        {initials}
                      </span>
                      <span>{stName}</span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          background: isSelected ? 'rgba(255, 255, 255, 0.25)' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#64748b',
                          padding: '1px 6px',
                          borderRadius: 100,
                        }}
                      >
                        {studentInvoiceCount}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Lista de Faturas (Cards com Badge do Aluno) ──────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AnimatePresence mode="popLayout">
              {filteredList.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    background: '#ffffff',
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: 20,
                    padding: '36px 18px',
                    textAlign: 'center',
                  }}
                >
                  <Receipt size={32} color="#94a3b8" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                    Nenhuma fatura encontrada
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {selectedStudentFilter !== 'todos'
                      ? `Nenhuma fatura encontrada para ${selectedStudentFilter}.`
                      : activeTab === 'emAberto'
                      ? `Não existem faturas pendentes para ${selectedAno}.`
                      : `Nenhum registro para esta seleção em ${selectedAno}.`}
                  </div>
                </motion.div>
              ) : (
                filteredList.map((parcela) => (
                  <MobileInvoiceCard
                    key={parcela.id}
                    parcela={parcela}
                    onOpenPix={handleTriggerPix}
                  />
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Rodapé de Confiança */}
          <div
            style={{
              marginTop: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px 14px',
              fontSize: 11.5,
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={14} color="#10b981" />
            <span>Dados financeiros integrados com a plataforma isaac.</span>
          </div>
        </motion.div>
      )}

      {/* ── Modal de Pagamento Pix ───────────────────────────────────────────── */}
      {pixModal.parcela && (
        <PixBottomSheet
          isOpen={pixModal.isOpen}
          onClose={() => setPixModal((prev) => ({ ...prev, isOpen: false }))}
          pixCode={pixModal.pixCode}
          boletoUrl={pixModal.boletoUrl}
          checkoutUrl={pixModal.checkoutUrl}
          valor={
            pixModal.parcela.status === 'PAID'
               ? pixModal.parcela.valorPagoFormatado
              : pixModal.parcela.valorFormatado
          }
          descricao={pixModal.parcela.descricao}
          vencimento={pixModal.parcela.vencimento}
          aluno={pixModal.parcela.aluno}
          isLoading={pixModal.isLoading}
          error={pixModal.error}
        />
      )}

      {/* ── Modal de Declaração de IRPF ─────────────────────────────────────── */}
      <DeclaracaoIrpfModal
        isOpen={irpfModalOpen}
        onClose={() => setIrpfModalOpen(false)}
        alunos={alunosOptions}
        currentAno={selectedAno}
        responsavelId={data?.guardianId}
      />
    </div>
  )
}
