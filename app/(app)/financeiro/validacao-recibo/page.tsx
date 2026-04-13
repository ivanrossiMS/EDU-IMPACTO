'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ShieldCheck, Search, Filter, X, Download, RefreshCw,
  CheckCircle, AlertTriangle, Ban, History, Eye, Copy,
  ExternalLink, QrCode, RotateCcw, Clock, FileText,
  ChevronRight, ChevronLeft, Zap, BarChart2, TrendingDown,
  XCircle, ClipboardList, ArrowRight, Shield, Info
} from 'lucide-react'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { useData } from '@/lib/dataContext'

// ─── Tipos ────────────────────────────────────────────────────────
interface Receipt {
  id: string
  receipt_number: string
  receipt_version: number
  receipt_status: 'valido' | 'cancelado' | 'estornado' | 'substituido' | 'invalido' | 'inconsistente'
  validation_token: string
  validation_hash: string
  public_validation_url: string
  baixa_id: string
  event_id: string
  aluno_id: string
  aluno_nome: string
  aluno_turma: string
  responsavel_nome: string
  payer_name: string
  payer_document: string
  unidade_nome: string
  event_description: string
  paid_amount: number
  original_amount: number
  discount_amount: number
  interest_amount: number
  penalty_amount: number
  payment_method: string
  payment_date: string | null
  issue_date: string
  notes: string
  is_active: boolean
  canceled_at: string | null
  cancellation_reason: string
  reversed_at: string | null
  replaced_by_receipt_id: string | null
  replaces_receipt_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface ValidationLog {
  id: string
  receipt_id: string
  baixa_id: string
  validation_token: string
  validation_type: string
  validation_origin: string
  result_status: string
  result_message: string
  ip_address: string
  user_agent: string
  validated_by_user_id: string
  created_at: string
}

// ─── Configuração de Status ───────────────────────────────────────
const STATUS_CFG = {
  valido:        { label: 'Válido',        color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '✅', dot: '#10b981' },
  cancelado:     { label: 'Cancelado',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '❌', dot: '#ef4444' },
  estornado:     { label: 'Estornado',     color: '#f97316', bg: 'rgba(249,115,22,0.12)',  icon: '↩️', dot: '#f97316' },
  substituido:   { label: 'Substituído',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: '🔄', dot: '#3b82f6' },
  invalido:      { label: 'Inválido',      color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: '⚠️', dot: '#6b7280' },
  inconsistente: { label: 'Inconsistente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '⚡', dot: '#f59e0b' },
}

// ─── Formatadores ─────────────────────────────────────────────────
const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const fmtDateTime = (d: string | null) => {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const hashShort = (h: string) => h ? `${h.slice(0, 8)}...${h.slice(-6)}` : '—'

// ─── Componente Principal ─────────────────────────────────────────
export default function ValidacaoReciboPage() {
  const { currentUser } = useData() as any

  const [activeTab, setActiveTab] = useState<'recibos' | 'validar' | 'auditoria' | 'inconsistencias'>('recibos')

  // ── Filtros da aba Recibos ──
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(25)

  // ── Validação manual ──
  const [validateInput, setValidateInput] = useState('')
  const [validateType, setValidateType] = useState<'token' | 'receipt_number' | 'baixa_id'>('token')
  const [validating, setValidating] = useState(false)
  const [validateResult, setValidateResult] = useState<any>(null)

  // ── Modal de detalhes ──
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [receiptDetail, setReceiptDetail] = useState<{ data: Receipt; logs: ValidationLog[] } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // ── Modal de cancelamento ──
  const [cancelModal, setCancelModal] = useState<{ receipt: Receipt; reason: string } | null>(null)
  const [canceling, setCanceling] = useState(false)

  // ── Copiado ──
  const [copied, setCopied] = useState<string | null>(null)

  // ── Backfill (sincronização histórica) ──
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<{ created: number; skipped: number; errors: number; message: string } | null>(null)

  const handleBackfill = async () => {
    setBackfilling(true)
    setBackfillResult(null)
    try {
      const res = await fetch('/api/recibos/backfill', { method: 'POST' })
      const json = await res.json()
      setBackfillResult(json)
      refetch()
    } catch (e: any) {
      setBackfillResult({ created: 0, skipped: 0, errors: 1, message: `Erro: ${e.message}`, total_pagos: 0, total_candidatos: 0 } as any)
    } finally {
      setBackfilling(false)
    }
  }

  // ── Debug Diagnóstico ──
  const [debugResult, setDebugResult] = useState<any>(null)
  const [debugging, setDebugging] = useState(false)

  const handleDebug = async () => {
    setDebugging(true)
    setDebugResult(null)
    try {
      const res = await fetch('/api/recibos/debug')
      const json = await res.json()
      setDebugResult(json)
    } catch (e: any) {
      setDebugResult({ error: e.message })
    } finally {
      setDebugging(false)
    }
  }

  // Debounce para a busca
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setSearch(searchRaw), 400)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchRaw])

  // Reset paginação ao filtrar
  useEffect(() => { setCurrentPage(1) }, [search, statusFilter, dateFrom, dateTo])

  // ─── Queries ─────────────────────────────────────────────────────
  const queryParams = useMemo(() => ({
    page: currentPage,
    limit: pageSize,
    ...(search ? { search } : {}),
    ...(statusFilter !== 'todos' ? { status: statusFilter } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  }), [currentPage, pageSize, search, statusFilter, dateFrom, dateTo])

  const { data: apiData, isLoading, refetch, error: apiError } = useApiQuery<{
    data: Receipt[]; total: number; totalPages: number
  }>(['recibos', JSON.stringify(queryParams)], '/api/recibos', queryParams)

  const { data: logsData, isLoading: loadingLogs } = useApiQuery<{
    data: ValidationLog[]; total: number
  }>(['recibos-logs', activeTab], '/api/recibos/logs', { limit: 100 })

  const { data: inconsistenciasData } = useApiQuery<{
    data: Receipt[]
  }>(['recibos-inconsistencias'], '/api/recibos', { status: 'inconsistente', limit: 100 })

  const receipts: Receipt[] = apiData?.data || []
  const total = apiData?.total || 0
  const totalPages = apiData?.totalPages || 1
  const logs: ValidationLog[] = logsData?.data || []
  const inconsistencias: Receipt[] = inconsistenciasData?.data || []

  // ─── KPIs ─────────────────────────────────────────────────────────
  const { data: kpiValidos } = useApiQuery(['kpi-validos'], '/api/recibos', { status: 'valido', limit: 1 })
  const { data: kpiCancelados } = useApiQuery(['kpi-cancelados'], '/api/recibos', { status: 'cancelado', limit: 1 })
  const { data: kpiEstornados } = useApiQuery(['kpi-estornados'], '/api/recibos', { status: 'estornado', limit: 1 })
  const { data: kpiTodos } = useApiQuery(['kpi-todos'], '/api/recibos', { limit: 1 })

  const today = new Date().toISOString().slice(0, 10)
  const { data: kpiHoje } = useApiQuery(['kpi-hoje'], '/api/recibos', { date_from: today, date_to: today, limit: 1 })

  const kpis = [
    { label: 'Total de Recibos', value: (kpiTodos as any)?.total || 0, color: '#3b82f6', icon: '📋', sub: 'todos os registros' },
    { label: 'Válidos', value: (kpiValidos as any)?.total || 0, color: '#10b981', icon: '✅', sub: 'ativos e autênticos' },
    { label: 'Cancelados', value: (kpiCancelados as any)?.total || 0, color: '#ef4444', icon: '❌', sub: 'encerrados' },
    { label: 'Estornados', value: (kpiEstornados as any)?.total || 0, color: '#f97316', icon: '↩️', sub: 'pagamento revertido' },
    { label: 'Emitidos Hoje', value: (kpiHoje as any)?.total || 0, color: '#8b5cf6', icon: '📅', sub: 'no dia de hoje' },
    { label: 'Inconsistências', value: inconsistencias.length, color: '#f59e0b', icon: '⚡', sub: 'requerem atenção' },
  ]

  // ─── Abertura do detalhe ──────────────────────────────────────────
  const openDetail = async (receipt: Receipt) => {
    setSelectedReceipt(receipt)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/recibos/${receipt.id}`)
      const json = await res.json()
      setReceiptDetail(json)
    } catch (_) {
      setReceiptDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeDetail = () => {
    setSelectedReceipt(null)
    setReceiptDetail(null)
  }

  // ─── Copiar link ──────────────────────────────────────────────────
  const copyLink = (url: string, key: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  // ─── Validação manual ─────────────────────────────────────────────
  const handleValidate = async () => {
    if (!validateInput.trim()) return
    setValidating(true)
    setValidateResult(null)
    try {
      let url = ''
      if (validateType === 'token') {
        url = `/api/recibos/validar/${validateInput.trim()}`
      } else if (validateType === 'receipt_number') {
        const res = await fetch(`/api/recibos?receipt_number=${encodeURIComponent(validateInput.trim())}&limit=1`)
        const json = await res.json()
        const rec = json?.data?.[0]
        if (!rec) { setValidateResult({ status: 'nao_encontrado', message: 'Recibo não encontrado.' }); setValidating(false); return }
        url = `/api/recibos/validar/${rec.validation_token}`
      } else {
        const res = await fetch(`/api/recibos?baixa_id=${encodeURIComponent(validateInput.trim())}&limit=10`)
        const json = await res.json()
        setValidateResult({ status: 'lista', receipts: json?.data || [], message: `${json?.total || 0} recibo(s) encontrado(s) para esta baixa.` })
        setValidating(false)
        return
      }
      const res = await fetch(url)
      const json = await res.json()
      setValidateResult(json)
    } catch {
      setValidateResult({ status: 'erro', message: 'Erro ao validar. Tente novamente.' })
    } finally {
      setValidating(false)
    }
  }

  // ─── Cancelar recibo ──────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelModal || !cancelModal.reason.trim()) return
    setCanceling(true)
    try {
      await fetch(`/api/recibos/${cancelModal.receipt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancelar',
          reason: cancelModal.reason,
          user_name: (currentUser as any)?.nome || 'Sistema',
        }),
      })
      refetch()
      setCancelModal(null)
      if (selectedReceipt?.id === cancelModal.receipt.id) closeDetail()
    } catch (_) {}
    finally { setCanceling(false) }
  }

  // ─── QR Code via Google Charts ────────────────────────────────────
  const qrUrl = (url: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1e293b`

  // ─── Limpar filtros ───────────────────────────────────────────────
  const clearFilters = () => {
    setSearchRaw(''); setSearch(''); setStatusFilter('todos'); setDateFrom(''); setDateTo('')
  }
  const activeFilters = [statusFilter !== 'todos', dateFrom, dateTo].filter(Boolean).length

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} color="#3b82f6" />
            Validação de Recibo
          </h1>
          <p className="page-subtitle">
            Consulte, valide e audite recibos emitidos pelo ERP com autenticação digital.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => refetch()}>
            <RefreshCw size={13} />Atualizar
          </button>
          <button
            className="btn btn-sm"
            style={{ background: backfilling ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', fontSize: 12 }}
            onClick={handleBackfill}
            disabled={backfilling}
            title="Importa todos os pagamentos existentes que ainda não possuem recibo digital"
          >
            {backfilling
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Sincronizando...</>
              : <><Zap size={13} />Sincronizar Histórico</>
            }
          </button>
          <button className="btn btn-secondary btn-sm">
            <Download size={13} />Exportar
          </button>
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11 }}
            onClick={handleDebug}
            disabled={debugging}
            title="Diagnóstico: verifica banco de dados e titulos pagos"
          >
            {debugging ? '...' : '🔍 Diagnóstico'}
          </button>
        </div>
      </div>

      {/* Resultado do backfill */}
      {backfillResult && (
        <div style={{
          marginBottom: 16,
          padding: '12px 18px',
          borderRadius: 12,
          background: backfillResult.errors > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
          border: `1px solid ${backfillResult.errors > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 13,
        }}>
          <span style={{ fontSize: 20 }}>{backfillResult.errors > 0 ? '⚠️' : '✅'}</span>
          <div>
            <strong style={{ color: backfillResult.errors > 0 ? '#f59e0b' : '#10b981' }}>{backfillResult.message}</strong>
            <span style={{ marginLeft: 12, color: 'hsl(var(--text-muted))' }}>
              {backfillResult.created} criados · {backfillResult.skipped} já existentes
              {backfillResult.errors > 0 && <> · <span style={{ color: '#f87171' }}>{backfillResult.errors} erros</span></>}
            </span>
          </div>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', fontSize: 16 }} onClick={() => setBackfillResult(null)}>&#x2715;</button>
        </div>
      )}

      {/* Painel de diagnóstico */}
      {debugResult && (
        <div style={{
          marginBottom: 16, padding: '16px 20px', borderRadius: 12,
          background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 13, color: '#a78bfa' }}>🔍 Diagnóstico do Banco de Dados</strong>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }} onClick={() => setDebugResult(null)}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, fontFamily: 'monospace' }}>
              <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 4, fontFamily: 'sans-serif' }}>financial_receipts</div>
              <div>Existe: <strong style={{ color: debugResult.financial_receipts?.exists ? '#10b981' : '#ef4444' }}>
                {debugResult.financial_receipts?.exists ? 'SIM ✅' : 'NÃO ❌ — Execute a migration!'}
              </strong></div>
              {debugResult.financial_receipts?.error && <div style={{ color: '#f87171', marginTop: 4, wordBreak: 'break-all' }}>Erro: {debugResult.financial_receipts.error}</div>}
              <div>Registros: <strong>{debugResult.financial_receipts?.count ?? 0}</strong></div>
            </div>
            <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, fontFamily: 'monospace' }}>
              <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: 4, fontFamily: 'sans-serif' }}>titulos</div>
              <div>Total: <strong>{debugResult.titulos_total ?? '—'}</strong></div>
              <div>Com status=pago: <strong style={{ color: '#10b981' }}>{debugResult.titulos_pagos?.count ?? 0}</strong></div>
              {debugResult.titulos_pagos?.error && <div style={{ color: '#f87171', wordBreak: 'break-all' }}>Erro: {debugResult.titulos_pagos.error}</div>}
              <div style={{ marginTop: 6 }}>
                Status no DB: <strong style={{ color: '#f59e0b' }}>
                  {(debugResult.status_valores_existentes || []).join(', ') || '—'}
                </strong>
              </div>
            </div>
          </div>
          {debugResult.titulos_pagos?.sample?.[0] && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', marginBottom: 6, fontFamily: 'sans-serif' }}>Amostra de título pago:</div>
              <pre style={{ margin: 0, fontSize: 11, color: '#cbd5e1', overflow: 'auto', maxHeight: 120 }}>{JSON.stringify(debugResult.titulos_pagos.sample[0], null, 2)}</pre>
            </div>
          )}
          {debugResult.financial_receipts?.exists && debugResult.titulos_pagos?.count === 0 && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, color: '#f59e0b', fontFamily: 'sans-serif' }}>
              ⚠️ Nenhum título com status=&apos;pago&apos;. Status existentes: [{(debugResult.status_valores_existentes || []).join(', ')}].
              Verifique se as baixas foram registradas.
            </div>
          )}
        </div>
      )}

      {/* Erro de API — tabela provavelmente não migrada */}
      {apiError && (
        <div style={{
          marginBottom: 16,
          padding: '16px 20px',
          borderRadius: 12,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
        }}>
          <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 800, color: '#ef4444', fontSize: 14, marginBottom: 6 }}>
              Tabela não encontrada — Migração SQL necessária
            </div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
              A tabela <code style={{ background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 4, color: '#f87171' }}>financial_receipts</code> ainda não existe no banco de dados.
              Execute o arquivo <strong>recibos-migration.sql</strong> no{' '}
              <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>Supabase → SQL Editor</a> e clique em <strong>Run</strong>.
              Depois, clique em <strong>Sincronizar Histórico</strong> para importar os pagamentos já realizados.
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#f87171', fontFamily: 'monospace' }}>
              Erro técnico: {(apiError as any)?.message}
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} className="kpi-card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{k.icon}</span>
              <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', lineHeight: 1.2 }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif', lineHeight: 1 }}>
              {k.value.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="tab-list" style={{ marginBottom: 16 }}>
        {[
          { key: 'recibos',          label: 'Recibos Emitidos',  icon: '📋' },
          { key: 'validar',          label: 'Validar Recibo',    icon: '🔍' },
          { key: 'auditoria',        label: 'Auditoria',         icon: '🛡️' },
          { key: 'inconsistencias',  label: 'Inconsistências',   icon: '⚡', badge: inconsistencias.length },
        ].map(t => (
          <button
            key={t.key}
            className={`tab-trigger ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key as any)}
          >
            {t.icon} {t.label}
            {t.badge ? (
              <span style={{ marginLeft: 6, background: '#f59e0b', color: '#000', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ABA 1: RECIBOS EMITIDOS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'recibos' && (
        <>
          {/* Barra de busca e filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input
                className="form-input"
                style={{ paddingLeft: 36 }}
                placeholder="Buscar por aluno, responsável, nº recibo, ID da baixa..."
                value={searchRaw}
                onChange={e => { setSearchRaw(e.target.value) }}
              />
              {searchRaw && (
                <button onClick={() => setSearchRaw('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              className="form-input"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>

            <button
              className={`btn btn-sm ${showFilters || activeFilters > 0 ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowFilters(p => !p)}
            >
              <Filter size={13} />Filtros
              {activeFilters > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, marginLeft: 2 }}>
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

          {/* Filtros avançados */}
          {showFilters && (
            <div className="card" style={{ padding: '14px 18px', marginBottom: 12, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>Data de pagamento — de</label>
                <input type="date" className="form-input" style={{ width: 150 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>até</label>
                <input type="date" className="form-input" style={{ width: 150 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          )}

          {/* Tabela */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Nº Recibo</th>
                  <th>Data Emissão</th>
                  <th>Aluno / Responsável</th>
                  <th>Evento Financeiro</th>
                  <th>Forma Pag.</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th>ID Baixa</th>
                  <th>Hash</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>
                      <RefreshCw size={20} style={{ opacity: 0.3, margin: '0 auto 10px', display: 'block', animation: 'spin 1s linear infinite' }} />
                      Carregando recibos...
                    </td>
                  </tr>
                ) : receipts.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: 60, color: 'hsl(var(--text-muted))' }}>
                      <ShieldCheck size={36} style={{ opacity: 0.1, margin: '0 auto 12px', display: 'block' }} />
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Nenhum recibo encontrado</div>
                      <div style={{ fontSize: 12 }}>Os recibos são gerados automaticamente após cada baixa de pagamento.</div>
                    </td>
                  </tr>
                ) : receipts.map(r => {
                  const sc = STATUS_CFG[r.receipt_status] || STATUS_CFG.invalido
                  return (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                          {sc.icon} {sc.label}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 5, color: '#60a5fa', fontWeight: 700 }}>
                          {r.receipt_number}
                        </code>
                        {r.receipt_version > 1 && (
                          <span style={{ marginLeft: 4, fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>v{r.receipt_version}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <div>{fmtDate(r.issue_date)}</div>
                        {r.payment_date && <div style={{ fontSize: 10, color: '#10b981', marginTop: 2 }}>Pago {fmtDate(r.payment_date)}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.aluno_nome || '—'}</div>
                        {r.responsavel_nome && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{r.responsavel_nome}</div>}
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.event_description || '—'}
                      </td>
                      <td>
                        {r.payment_method ? (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(99,102,241,0.1)', color: '#a78bfa', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {r.payment_method}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#10b981', fontFamily: 'Outfit,sans-serif' }}>
                        {fmtCur(r.paid_amount)}
                      </td>
                      <td>
                        <code style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                          {r.baixa_id?.slice(0, 10)}...
                        </code>
                      </td>
                      <td>
                        <code style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }} title={r.validation_hash}>
                          {hashShort(r.validation_hash)}
                        </code>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title="Ver detalhes"
                            onClick={() => openDetail(r)}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title="Copiar link de validação"
                            onClick={() => copyLink(r.public_validation_url, r.id)}
                          >
                            {copied === r.id ? <CheckCircle size={13} color="#10b981" /> : <Copy size={13} />}
                          </button>
                          <a
                            href={r.public_validation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm btn-icon"
                            title="Abrir validação pública"
                          >
                            <ExternalLink size={13} />
                          </a>
                          {r.receipt_status === 'valido' && (
                            <button
                              className="btn btn-ghost btn-sm btn-icon"
                              title="Cancelar recibo"
                              style={{ color: '#f87171' }}
                              onClick={() => setCancelModal({ receipt: r, reason: '' })}
                            >
                              <Ban size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Footer da tabela */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              <span>{total.toLocaleString('pt-BR')} recibos encontrados</span>
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-secondary btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft size={13} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Página {currentPage} de {totalPages}</span>
                  <button className="btn btn-secondary btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ABA 2: VALIDAR RECIBO
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'validar' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Campo de validação */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} color="#3b82f6" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Validar Recibo</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Busca real no banco de dados</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Buscar por</label>
              <div className="tab-list" style={{ marginBottom: 12 }}>
                {[
                  { k: 'token', label: 'Token / QR Code' },
                  { k: 'receipt_number', label: 'Nº do Recibo' },
                  { k: 'baixa_id', label: 'ID da Baixa' },
                ].map(t => (
                  <button
                    key={t.k}
                    className={`tab-trigger ${validateType === t.k ? 'active' : ''}`}
                    style={{ fontSize: 12 }}
                    onClick={() => { setValidateType(t.k as any); setValidateResult(null) }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder={
                    validateType === 'token' ? 'Cole o token UUID do QR Code...' :
                    validateType === 'receipt_number' ? 'Ex: REC-2026-00001' :
                    'ID completo da baixa...'
                  }
                  value={validateInput}
                  onChange={e => setValidateInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleValidate()}
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleValidate}
              disabled={validating || !validateInput.trim()}
            >
              {validating ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />Validando...</> : <><ShieldCheck size={14} />Validar Recibo</>}
            </button>

            {/* Resultado da validação */}
            {validateResult && (
              <div style={{ marginTop: 20 }}>
                {validateResult.status === 'lista' ? (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                      {validateResult.message}
                    </div>
                    {validateResult.receipts.map((r: Receipt) => {
                      const sc = STATUS_CFG[r.receipt_status] || STATUS_CFG.invalido
                      return (
                        <div key={r.id} style={{ padding: '12px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, marginBottom: 8, border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }} onClick={() => openDetail(r)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <code style={{ fontSize: 12, color: '#60a5fa', fontWeight: 700 }}>{r.receipt_number}</code>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 700 }}>{sc.icon} {sc.label}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{r.aluno_nome} · {fmtCur(r.paid_amount)}</div>
                        </div>
                      )
                    })}
                  </div>
                ) : (() => {
                  const sc = (STATUS_CFG as any)[validateResult.status] || { label: validateResult.status, color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: '?', dot: '#6b7280' }
                  return (
                    <div style={{ padding: '24px', borderRadius: 14, background: sc.bg, border: `1px solid ${sc.color}30`, textAlign: 'center' }}>
                      <div style={{ fontSize: 40, marginBottom: 10 }}>{sc.icon}</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: sc.color, marginBottom: 8 }}>{sc.label}</div>
                      <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>{validateResult.message}</div>
                      {validateResult.receipt && (
                        <div style={{ marginTop: 16, textAlign: 'left', fontSize: 13 }}>
                          <div><strong>Aluno:</strong> {validateResult.receipt.aluno_nome}</div>
                          <div><strong>Valor:</strong> {fmtCur(validateResult.receipt.paid_amount)}</div>
                          <div><strong>Data:</strong> {fmtDate(validateResult.receipt.payment_date)}</div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Instruções */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <QrCode size={16} color="#3b82f6" />
                Como validar pelo QR Code
              </div>
              {[
                'Escaneie o QR Code impresso no recibo.',
                'Você será redirecionado para a página pública de validação.',
                'O sistema verifica token, hash e status em tempo real.',
                'O resultado aparece imediatamente na tela.',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} color="#10b981" />
                Verificações realizadas
              </div>
              {[
                { icon: '🔑', label: 'Token único no banco' },
                { icon: '🔒', label: 'Hash SHA-256 de integridade' },
                { icon: '📋', label: 'Status ativo do recibo' },
                { icon: '💰', label: 'Confirmação da baixa vinculada' },
                { icon: '📝', label: 'Registro de log de auditoria' },
              ].map(c => (
                <div key={c.label} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>{c.icon}</span>
                  <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ABA 3: AUDITORIA
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'auditoria' && (
        <div className="table-container">
          <div style={{ padding: '14px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={16} color="#3b82f6" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Log de Validações</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'hsl(var(--text-muted))' }}>{logs.length} registros</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Origem</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Mensagem</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>Carregando logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>Nenhum log de validação registrado ainda.</td></tr>
              ) : logs.map(log => {
                const statusColor = log.result_status === 'valido' ? '#10b981' : log.result_status === 'nao_encontrado' ? '#6b7280' : '#ef4444'
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateTime(log.created_at)}</td>
                    <td>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: log.validation_origin === 'publica' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)', color: log.validation_origin === 'publica' ? '#60a5fa' : '#10b981', fontWeight: 700 }}>
                        {log.validation_origin === 'publica' ? '🌐 Pública' : '🔒 Interna'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{log.validation_type}</td>
                    <td>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${statusColor}15`, color: statusColor, fontWeight: 700 }}>
                        {log.result_status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.result_message}>
                      {log.result_message}
                    </td>
                    <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ABA 4: INCONSISTÊNCIAS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'inconsistencias' && (
        <div>
          {inconsistencias.length === 0 ? (
            <div className="card" style={{ padding: 60, textAlign: 'center' }}>
              <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 16px', opacity: 0.6, display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#10b981' }}>Nenhuma Inconsistência Detectada</div>
              <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Todos os recibos estão consistentes com as baixas vinculadas.</div>
            </div>
          ) : (
            <div className="table-container">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'rgba(245,158,11,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} color="#f59e0b" />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>{inconsistencias.length} Inconsistência(s) detectada(s)</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Nº Recibo</th>
                    <th>Aluno</th>
                    <th>Valor</th>
                    <th>Data Emissão</th>
                    <th>ID Baixa</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {inconsistencias.map(r => {
                    const sc2 = STATUS_CFG[r.receipt_status as keyof typeof STATUS_CFG] || STATUS_CFG.invalido
                    return (
                    <tr key={r.id}>
                      <td><code style={{ fontSize: 11, color: '#f59e0b' }}>{r.receipt_number}</code></td>
                      <td style={{ fontWeight: 600 }}>{r.aluno_nome || '—'}</td>
                      <td style={{ fontWeight: 700, color: '#f59e0b' }}>{fmtCur(r.paid_amount)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.issue_date)}</td>
                      <td><code style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{r.baixa_id}</code></td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => openDetail(r)}>
                          <Eye size={13} />Ver detalhes
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL DE DETALHES
      ══════════════════════════════════════════════════════════════ */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 800, maxHeight: '92vh', overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' }}>

            {/* Header do modal */}
            <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(16,185,129,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Detalhes do Recibo</div>
                  <code style={{ fontSize: 12, color: '#60a5fa', fontWeight: 700 }}>{selectedReceipt.receipt_number}</code>
                </div>
                <div style={{ marginLeft: 16 }}>
                  {(() => {
                    const sc = STATUS_CFG[selectedReceipt.receipt_status] || STATUS_CFG.invalido
                    return (
                      <span style={{ padding: '4px 12px', borderRadius: 20, background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 700 }}>
                        {sc.icon} {sc.label}
                      </span>
                    )
                  })()}
                </div>
              </div>
              <button onClick={closeDetail} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>

            {/* Corpo do modal */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'hsl(var(--text-muted))' }}>
                  <RefreshCw size={24} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block', animation: 'spin 1s linear infinite' }} />
                  Carregando detalhes...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Seção: Dados financeiros */}
                  <Section title="💰 Dados Financeiros">
                    <Grid2>
                      <Field label="Valor Pago" value={fmtCur(selectedReceipt.paid_amount)} highlight />
                      <Field label="Forma de Pagamento" value={selectedReceipt.payment_method || '—'} />
                      <Field label="Data do Pagamento" value={fmtDate(selectedReceipt.payment_date)} />
                      <Field label="Data de Emissão" value={fmtDateTime(selectedReceipt.issue_date)} />
                      {selectedReceipt.original_amount > 0 && <Field label="Valor Original" value={fmtCur(selectedReceipt.original_amount)} />}
                      {selectedReceipt.discount_amount > 0 && <Field label="Desconto" value={fmtCur(selectedReceipt.discount_amount)} />}
                      {selectedReceipt.interest_amount > 0 && <Field label="Juros" value={fmtCur(selectedReceipt.interest_amount)} />}
                      {selectedReceipt.penalty_amount > 0 && <Field label="Multa" value={fmtCur(selectedReceipt.penalty_amount)} />}
                      <Field label="Evento Financeiro" value={selectedReceipt.event_description || '—'} />
                      <Field label="ID da Baixa" value={selectedReceipt.baixa_id} mono />
                    </Grid2>
                  </Section>

                  {/* Seção: Aluno e Responsável */}
                  <Section title="👤 Dados do Aluno e Responsável">
                    <Grid2>
                      <Field label="Aluno" value={selectedReceipt.aluno_nome || '—'} />
                      <Field label="Turma" value={selectedReceipt.aluno_turma || '—'} />
                      <Field label="Responsável/Pagador" value={selectedReceipt.responsavel_nome || selectedReceipt.payer_name || '—'} />
                      <Field label="CPF/CNPJ (mascarado)" value={selectedReceipt.payer_document || '—'} />
                      <Field label="Unidade" value={selectedReceipt.unidade_nome || '—'} />
                    </Grid2>
                  </Section>

                  {/* Seção: Validação Digital */}
                  <Section title="🔒 Validação Digital">
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <Grid2>
                          <Field label="Número do Recibo" value={selectedReceipt.receipt_number} mono />
                          <Field label="Versão" value={`v${selectedReceipt.receipt_version}`} />
                          <Field label="Hash SHA-256" value={hashShort(selectedReceipt.validation_hash)} mono />
                          <Field label="Token (resumido)" value={hashShort(selectedReceipt.validation_token)} mono />
                        </Grid2>
                        <div style={{ marginTop: 12 }}>
                          <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'block', marginBottom: 6 }}>Link Público de Validação</label>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input readOnly value={selectedReceipt.public_validation_url} className="form-input" style={{ fontSize: 11, flex: 1 }} />
                            <button className="btn btn-secondary btn-sm" onClick={() => copyLink(selectedReceipt.public_validation_url, 'modal')}>
                              {copied === 'modal' ? <CheckCircle size={13} color="#10b981" /> : <Copy size={13} />}
                            </button>
                            <a href={selectedReceipt.public_validation_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm btn-icon">
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* QR Code */}
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'block', marginBottom: 8 }}>QR Code de Validação</label>
                        <div style={{ padding: 8, background: '#fff', borderRadius: 10, display: 'inline-block', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                          <img
                            src={qrUrl(selectedReceipt.public_validation_url)}
                            alt="QR Code de validação"
                            width={140}
                            height={140}
                            style={{ display: 'block', borderRadius: 6 }}
                          />
                        </div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 6 }}>Escaneie para validar</div>
                      </div>
                    </div>
                  </Section>

                  {/* Seção: Auditoria */}
                  <Section title="🛡️ Auditoria">
                    <Grid2>
                      <Field label="Emitido por" value={selectedReceipt.created_by || '—'} />
                      <Field label="Data de Criação" value={fmtDateTime(selectedReceipt.created_at)} />
                      <Field label="Última Atualização" value={fmtDateTime(selectedReceipt.updated_at)} />
                      {selectedReceipt.canceled_at && <Field label="Cancelado em" value={fmtDateTime(selectedReceipt.canceled_at)} />}
                      {selectedReceipt.cancellation_reason && <Field label="Motivo do Cancelamento" value={selectedReceipt.cancellation_reason} />}
                      {selectedReceipt.reversed_at && <Field label="Estornado em" value={fmtDateTime(selectedReceipt.reversed_at)} />}
                    </Grid2>
                  </Section>

                  {/* Logs de validação deste recibo */}
                  {receiptDetail?.logs && receiptDetail.logs.length > 0 && (
                    <Section title={`📋 Logs de Validação (${receiptDetail.logs.length})`}>
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {receiptDetail.logs.map(log => (
                          <div key={log.id} style={{ padding: '10px 12px', background: 'hsl(var(--bg-overlay))', borderRadius: 8, marginBottom: 6, display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                            <span style={{ color: log.result_status === 'valido' ? '#10b981' : '#ef4444', fontWeight: 700, flexShrink: 0 }}>
                              {log.result_status === 'valido' ? '✅' : '❌'} {log.result_status}
                            </span>
                            <span style={{ color: 'hsl(var(--text-muted))' }}>{fmtDateTime(log.created_at)}</span>
                            <span style={{ padding: '1px 6px', borderRadius: 5, background: log.validation_origin === 'publica' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)', color: log.validation_origin === 'publica' ? '#60a5fa' : '#10b981', fontWeight: 600 }}>
                              {log.validation_origin === 'publica' ? '🌐' : '🔒'} {log.validation_origin}
                            </span>
                            <span style={{ color: 'hsl(var(--text-muted))', flex: 1 }}>{log.ip_address}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              )}
            </div>

            {/* Footer do modal */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              {selectedReceipt.receipt_status === 'valido' && (
                <button
                  className="btn btn-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                  onClick={() => setCancelModal({ receipt: selectedReceipt, reason: '' })}
                >
                  <Ban size={13} />Cancelar Recibo
                </button>
              )}
              <a href={selectedReceipt.public_validation_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                <ExternalLink size={13} />Página Pública
              </a>
              <button className="btn btn-ghost btn-sm" onClick={closeDetail}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL DE CANCELAMENTO
      ══════════════════════════════════════════════════════════════ */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 16, width: '100%', maxWidth: 500, border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ban size={18} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Cancelar Recibo</div>
                <code style={{ fontSize: 11, color: '#60a5fa' }}>{cancelModal.receipt.receipt_number}</code>
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.06)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16, fontSize: 13, color: '#f87171' }}>
                ⚠️ Esta ação é irreversível. O recibo ficará marcado como <strong>Cancelado</strong> e a página pública de validação refletirá o novo status imediatamente.
              </div>
              <label className="form-label">Motivo do Cancelamento *</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Descreva o motivo do cancelamento..."
                value={cancelModal.reason}
                onChange={e => setCancelModal(p => p ? { ...p, reason: e.target.value } : null)}
              />
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setCancelModal(null)} disabled={canceling}>Cancelar</button>
              <button
                className="btn btn-sm"
                style={{ background: '#ef4444', color: '#fff' }}
                onClick={handleCancel}
                disabled={canceling || !cancelModal.reason.trim()}
              >
                {canceling ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Cancelando...</> : <><Ban size={13} />Confirmar Cancelamento</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid hsl(var(--border-subtle))', background: 'rgba(59,130,246,0.04)' }}>
        {title}
      </div>
      <div style={{ padding: 18 }}>
        {children}
      </div>
    </div>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
      {children}
    </div>
  )
}

function Field({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{
        fontSize: highlight ? 18 : 13,
        fontWeight: highlight ? 900 : 600,
        color: highlight ? '#10b981' : 'hsl(var(--text-primary))',
        fontFamily: mono ? 'monospace' : (highlight ? 'Outfit,sans-serif' : 'inherit'),
        wordBreak: 'break-all',
      }}>
        {value}
      </div>
    </div>
  )
}
