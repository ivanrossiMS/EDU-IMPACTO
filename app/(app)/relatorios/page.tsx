'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3, Search, Plus, Star, TrendingDown, Users,
  DollarSign, GraduationCap, Shield, Layers, ChevronRight,
  CreditCard, Clock, Sparkles, RefreshCw
} from 'lucide-react'
import { REPORT_DEFINITIONS, getReportsByCategory, type ReportCategory } from '@/lib/reports/reportDefinitions'

// ─── KPI Card ───────────────────────────────────────────

function KPICard({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; onClick?: () => void
}) {
  return (
    <button onClick={onClick} className="kpi-card" style={{ textAlign: 'left', cursor: 'pointer', width: '100%', border: 'none', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}18`, color, flexShrink: 0,
        }}>{icon}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{sub}</div>}
    </button>
  )
}

// ─── Report Grid Card ────────────────────────────────────

function ReportCard({ icon, name, description, slug }: {
  icon: string; name: string; description: string; slug: string
}) {
  const router = useRouter()
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={() => router.push(`/relatorios/${slug}`)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'hsl(var(--bg-elevated))' : 'hsl(var(--bg-surface))',
        border: `1px solid ${hover ? 'hsl(var(--brand-primary) / 50%)' : 'hsl(var(--border-subtle))'}`,
        borderRadius: 14, padding: '16px 18px', textAlign: 'left', cursor: 'pointer', width: '100%',
        transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: hover ? '0 4px 16px rgba(59,130,246,0.1)' : 'none',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0, width: 36, textAlign: 'center' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{description}</div>
      </div>
      <ChevronRight size={14} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }} />
    </button>
  )
}

// ─── Tab Button ──────────────────────────────────────────

function TabBtn({ label, active, icon, count, onClick }: {
  label: string; active: boolean; icon: React.ReactNode; count: number; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
      background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
      border: active ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
      color: active ? '#3b82f6' : 'hsl(var(--text-muted))',
      fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
      transition: 'all 0.18s', whiteSpace: 'nowrap', fontFamily: 'inherit',
    }}>
      {icon}
      {label}
      <span style={{
        fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 5,
        background: active ? 'rgba(59,130,246,0.15)' : 'hsl(var(--bg-elevated))',
        color: active ? '#3b82f6' : 'hsl(var(--text-muted))',
        border: `1px solid ${active ? 'rgba(59,130,246,0.2)' : 'hsl(var(--border-subtle))'}`,
      }}>{count}</span>
    </button>
  )
}

// ─── Section Header ──────────────────────────────────────

function SectionHeader({ color, label, icon }: { color: string; label: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 }}>
      <div style={{ width: 3, height: 18, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon} {label}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function CentralRelatoriosPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ReportCategory | 'todos'>('todos')
  const [search, setSearch] = useState('')
  const [kpis, setKpis] = useState<any>(null)
  const [kpisLoading, setKpisLoading] = useState(true)
  const [savedReports, setSavedReports] = useState<any[]>([])
  const [showSaved, setShowSaved] = useState(false)

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Load KPIs
  useEffect(() => {
    setKpisLoading(true)
    const q = (source: string, filters = {}) => fetch('/api/relatorios/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, filters, page: 1, pageSize: 1 }),
    }).then(r => r.json()).catch(() => ({ total: 0, aggregates: {} }))

    Promise.all([
      q('financeiro_inadimplentes'),
      q('financeiro_descontos'),
      q('financeiro_previsao'),
      q('alunos', { statusMatricula: 'Ativo' }),
      q('financeiro_recebimentos'),
      q('turmas'),
    ]).then(([inad, desc, prev, alunos, receb, turmas]) => {
      setKpis({ inadimplentes: inad, descontos: desc, previsao: prev, alunos, recebimentos: receb, turmas })
      setKpisLoading(false)
    })
  }, [])

  useEffect(() => {
    fetch('/api/relatorios/saved').then(r => r.json()).then(d => { if (Array.isArray(d)) setSavedReports(d) }).catch(() => {})
  }, [])

  const filteredReports = useMemo(() => {
    let reports = activeTab === 'todos' ? REPORT_DEFINITIONS : getReportsByCategory(activeTab)
    if (search) {
      const s = search.toLowerCase()
      reports = reports.filter(r => r.name.toLowerCase().includes(s) || r.description.toLowerCase().includes(s))
    }
    return reports
  }, [activeTab, search])

  const tabCounts = useMemo(() => ({
    todos: REPORT_DEFINITIONS.length,
    financeiro: getReportsByCategory('financeiro').length,
    pedagogico: getReportsByCategory('pedagogico').length,
  }), [])

  const reportsByCategory = useMemo(() => {
    if (activeTab !== 'todos' || search) return null
    return {
      financeiro: getReportsByCategory('financeiro'),
      pedagogico: getReportsByCategory('pedagogico'),
    }
  }, [activeTab, search])

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 0 60px' }}>

      {/* ─── HEADER ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13,
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
          }}>
            <BarChart3 size={20} color="#fff" />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: 20 }}>Central de Relatórios</h1>
            <p className="page-subtitle">Relatórios financeiros, pedagógicos e administrativos</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/relatorios/personalizado')} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
            <Plus size={13} /> Personalizado
          </button>
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="btn btn-secondary btn-sm"
            style={{ gap: 6 }}
          >
            <Star size={13} style={{ color: savedReports.length > 0 ? '#f59e0b' : undefined }} />
            Salvos
            {savedReports.length > 0 && (
              <span className="badge badge-warning" style={{ fontSize: 10, padding: '0 5px' }}>{savedReports.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ─── KPI CARDS ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 24 }}>
        {kpisLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16 }} />
          ))
        ) : (
          <>
            <KPICard icon={<TrendingDown size={15} />} label="Inadimplentes" value={String(kpis?.inadimplentes?.total || 0)} sub={`R$ ${fmt(kpis?.inadimplentes?.aggregates?.saldo || 0)} em aberto`} color="#ef4444" onClick={() => router.push('/relatorios/inadimplentes')} />
            <KPICard icon={<CreditCard size={15} />} label="Descontos" value={String(kpis?.descontos?.total || 0)} sub={`R$ ${fmt(kpis?.descontos?.aggregates?.desconto || 0)} concedidos`} color="#f59e0b" onClick={() => router.push('/relatorios/descontos-concedidos')} />
            <KPICard icon={<Clock size={15} />} label="Previsão" value={String(kpis?.previsao?.total || 0)} sub={`R$ ${fmt(kpis?.previsao?.aggregates?.valor || 0)} à receber`} color="#8b5cf6" onClick={() => router.push('/relatorios/previsao-recebimentos')} />
            <KPICard icon={<Users size={14} />} label="Alunos Ativos" value={String(kpis?.alunos?.total || 0)} sub="matrículas ativas" color="#3b82f6" onClick={() => router.push('/relatorios/relacao-alunos')} />
            <KPICard icon={<DollarSign size={15} />} label="Recebimentos" value={String(kpis?.recebimentos?.total || 0)} sub={`R$ ${fmt(kpis?.recebimentos?.aggregates?.valorPago || 0)} recebidos`} color="#10b981" onClick={() => router.push('/relatorios/recebimentos-data')} />
            <KPICard icon={<Layers size={14} />} label="Turmas" value={String(kpis?.turmas?.total || 0)} sub="no sistema" color="#06b6d4" onClick={() => router.push('/relatorios/mapa-turmas')} />
          </>
        )}
      </div>

      {/* ─── SAVED REPORTS ──────────────────────────────────── */}
      {showSaved && savedReports.length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Star size={13} color="#f59e0b" /> Relatórios Salvos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {savedReports.map((sr: any) => (
              <button key={sr.id} onClick={() => router.push(`/relatorios/${sr.subtipo || 'relacao-alunos'}`)} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', gap: 6, flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{sr.nome}</div>
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{sr.tipo_relatorio}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── SEARCH + TABS ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 1 280px' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar relatório..."
            className="form-input"
            style={{ paddingLeft: 32, paddingTop: 8, paddingBottom: 8, fontSize: 12 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
          <TabBtn label="Todos" active={activeTab === 'todos'} icon={<Sparkles size={12} />} count={tabCounts.todos} onClick={() => setActiveTab('todos')} />
          <TabBtn label="Financeiro" active={activeTab === 'financeiro'} icon={<DollarSign size={12} />} count={tabCounts.financeiro} onClick={() => setActiveTab('financeiro')} />
          <TabBtn label="Pedagógico" active={activeTab === 'pedagogico'} icon={<GraduationCap size={12} />} count={tabCounts.pedagogico} onClick={() => setActiveTab('pedagogico')} />
        </div>
      </div>

      {/* ─── REPORT GRID — Com seções por categoria ─────────── */}
      {filteredReports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'hsl(var(--text-muted))' }}>
          <Search size={38} style={{ opacity: 0.25, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Nenhum relatório encontrado</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Tente outro termo ou mude a categoria</div>
        </div>
      ) : reportsByCategory ? (
        <>
          <SectionHeader color="#ef4444" label="Financeiro" icon={<DollarSign size={11} />} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10, marginBottom: 8 }}>
            {reportsByCategory.financeiro.map(r => <ReportCard key={r.slug} icon={r.icon} name={r.name} description={r.description} slug={r.slug} />)}
          </div>

          <SectionHeader color="#3b82f6" label="Pedagógico" icon={<GraduationCap size={11} />} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10, marginBottom: 8 }}>
            {reportsByCategory.pedagogico.map(r => <ReportCard key={r.slug} icon={r.icon} name={r.name} description={r.description} slug={r.slug} />)}
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10 }}>
          {filteredReports.map(r => <ReportCard key={r.slug} icon={r.icon} name={r.name} description={r.description} slug={r.slug} />)}
        </div>
      )}
    </div>
  )
}
