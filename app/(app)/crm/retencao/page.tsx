'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useState, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import {
  TrendingDown, Users, AlertTriangle, Activity, Shield,
  Phone, MessageSquare, Search, Filter, X, ChevronDown,
  ChevronUp, CheckCircle, Clock, Plus, Pencil, Check,
  BarChart2, Heart, BookOpen, DollarSign, Calendar
} from 'lucide-react'
import { getInitials } from '@/lib/utils'

const RISCO_CFG = {
  alto:  { cor: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Risco Alto',  emoji: '🔴', prio: 0 },
  medio: { cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Risco Médio', emoji: '🟡', prio: 1 },
  baixo: { cor: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Risco Baixo', emoji: '🟢', prio: 2 },
} as const

type Risco = keyof typeof RISCO_CFG

type AcaoPreventiva = {
  aluno: string; tipo: string; descricao: string; data: string; status: 'pendente' | 'realizada'
}

const ACOES_TIPOS = ['Ligação para responsável', 'Reunião pedagógica', 'Proposta de renegociação', 'Acompanhamento psicológico', 'Visita domiciliar', 'Mensagem WhatsApp', 'E-mail', 'Desconto especial', 'Outro']

function BarraRisco({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div style={{ height: 6, background: 'hsl(var(--bg-overlay))', borderRadius: 3 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 3, transition: 'width 0.6s' }} />
    </div>
  )
}

function getResp(a: any): { fin: string; ped: string } {
  if (a.responsavelFinanceiro || a.responsavelPedagogico)
    return { fin: a.responsavelFinanceiro || '', ped: a.responsavelPedagogico || '' }
  const arr1: any[] = a._responsaveis || []
  if (arr1.length > 0) {
    const fin1 = arr1.find((r: any) => r.respFinanceiro)
    const ped1 = arr1.find((r: any) => r.respPedagogico)
    if (fin1 || ped1) return { fin: fin1?.nome || '', ped: ped1?.nome || '' }
  }
  const arr2: any[] = a.responsaveis || []
  if (arr2.length > 0) {
    const fin2 = arr2.find((r: any) => r.respFinanceiro)
    const ped2 = arr2.find((r: any) => r.respPedagogico)
    if (fin2 || ped2) return { fin: fin2?.nome || '', ped: ped2?.nome || '' }
  }
  return { fin: '', ped: '' }
}

function ScoreEvasao({ freq, media, risco }: { freq: number; media: number; risco: string }) {
  const score = Math.round(((100 - freq) * 0.5 + Math.max(0, 10 - media) * 5) / 10 * 10)
  const val = Math.min(score, 100)
  const cor = risco === 'alto' ? '#ef4444' : risco === 'medio' ? '#f59e0b' : '#10b981'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: `conic-gradient(${cor} ${val * 3.6}deg, hsl(var(--bg-overlay)) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: cor }}>{val}</span>
        </div>
      </div>
      <div style={{ fontSize: 10, color: cor, fontWeight: 700 }}>Risco</div>
    </div>
  )
}

export default function RetencaoPage() {
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [filtroRisco, setFiltroRisco] = useState<Risco | ''>('')
  const [filtroTurma, setFiltroTurma] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [tab, setTab] = useState<'alunos' | 'acoes' | 'indicadores'>('alunos')
  const [acoes, setAcoes] = useState<AcaoPreventiva[]>([])
  const [showAcaoModal, setShowAcaoModal] = useState(false)
  const [acaoForm, setAcaoForm] = useState<AcaoPreventiva>({ aluno: '', tipo: ACOES_TIPOS[0], descricao: '', data: new Date().toISOString().slice(0, 10), status: 'pendente' })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Métricas
  const risco   = alunos.filter(a => a.risco_evasao === 'alto')
  const medio   = alunos.filter(a => a.risco_evasao === 'medio')
  const baixo   = alunos.filter(a => a.risco_evasao === 'baixo')
  const semRisco = alunos.filter(a => !a.risco_evasao)

  // Impacto financeiro estimado (média R$800/mês por aluno)
  const impactoFinanceiro = (risco.length + medio.length * 0.4) * 800 * 12
  const taxaRetencao = alunos.length > 0 ? Math.round(((alunos.length - risco.length) / alunos.length) * 100) : 100

  // Turmas únicas
  const turmas = useMemo(() => [...new Set(alunos.map(a => a.turma).filter(Boolean))].sort(), [alunos])

  // Filtros
  const alunosFiltrados = useMemo(() => {
    return alunos.filter(a => {
      if (filtroRisco && a.risco_evasao !== filtroRisco) return false
      if (filtroTurma && a.turma !== filtroTurma) return false
      if (search && !a.nome.toLowerCase().includes(search.toLowerCase()) && !a.turma?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    }).sort((a, b) => {
      const pa = RISCO_CFG[a.risco_evasao as Risco]?.prio ?? 3
      const pb = RISCO_CFG[b.risco_evasao as Risco]?.prio ?? 3
      return pa - pb
    })
  }, [alunos, filtroRisco, filtroTurma, search])

  const hasFilter = !!(filtroRisco || filtroTurma || search)

  const saveAcao = () => {
    if (!acaoForm.aluno || !acaoForm.tipo) return
    setAcoes(prev => [...prev, { ...acaoForm }])
    setShowAcaoModal(false)
  }

  const toggleAcaoStatus = (i: number) => {
    setAcoes(prev => prev.map((a, j) => j === i ? { ...a, status: a.status === 'pendente' ? 'realizada' : 'pendente' } : a))
  }

  const openAcaoModal = (nomeAluno?: string) => {
    setAcaoForm({ aluno: nomeAluno || '', tipo: ACOES_TIPOS[0], descricao: '', data: new Date().toISOString().slice(0, 10), status: 'pendente' })
    setShowAcaoModal(true)
  }

  // Distribuição por motivo de risco (simulado a partir de freq e media)
  const motivosRisco = useMemo(() => [
    { label: 'Frequência crítica (<75%)', value: alunos.filter(a => (a.frequencia ?? 100) < 75).length, cor: '#ef4444' },
    { label: 'Baixo rendimento (<5.0)',   value: alunos.filter(a => (a.media ?? 10) < 5).length,        cor: '#f59e0b' },
    { label: 'Pendências financeiras',    value: Math.round(risco.length * 0.4),                        cor: '#8b5cf6' },
    { label: 'Sem atividade recente',     value: Math.round(medio.length * 0.3),                        cor: '#6366f1' },
  ], [alunos, risco, medio])

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ background: 'linear-gradient(135deg,#ef4444,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Retenção & Evasão Escolar
          </h1>
          <p className="page-subtitle">
            Monitoramento inteligente de risco • {alunos.length} alunos • Taxa de retenção: {taxaRetencao}%
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(p => !p)}><Filter size={12} />Filtros</button>
          <button className="btn btn-primary btn-sm" onClick={() => openAcaoModal()}><Plus size={13} />Ação Preventiva</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <div className="kpi-card" style={{ borderTop: '3px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={18} color="#ef4444" /></div>
            <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 20, fontWeight: 700 }}>URGENTE</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#ef4444', fontFamily: 'Outfit,sans-serif' }}>{risco.length}</div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Risco Alto</div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Ação imediata necessária</div>
        </div>

        <div className="kpi-card" style={{ borderTop: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={18} color="#f59e0b" /></div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b', fontFamily: 'Outfit,sans-serif' }}>{medio.length}</div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Risco Médio</div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Monitorar ativamente</div>
        </div>

        <div className="kpi-card" style={{ borderTop: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} color="#10b981" /></div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', fontFamily: 'Outfit,sans-serif' }}>{taxaRetencao}%</div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Taxa de Retenção</div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{baixo.length} alunos estáveis</div>
        </div>

        <div className="kpi-card" style={{ borderTop: '3px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={18} color="#8b5cf6" /></div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#8b5cf6', fontFamily: 'Outfit,sans-serif' }}>
            {impactoFinanceiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Impacto Potencial</div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Receita em risco/ano</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-list" style={{ marginBottom: 20, width: 'fit-content' }}>
        <button className={`tab-trigger ${tab === 'alunos' ? 'active' : ''}`} onClick={() => setTab('alunos')}><Users size={12} />Alunos em Risco</button>
        <button className={`tab-trigger ${tab === 'acoes' ? 'active' : ''}`} onClick={() => setTab('acoes')}><Shield size={12} />Ações Preventivas <span style={{ marginLeft: 4, fontSize: 10, background: acoes.length > 0 ? '#6366f1' : 'hsl(var(--bg-overlay))', color: acoes.length > 0 ? '#fff' : 'hsl(var(--text-muted))', borderRadius: '50%', padding: '0 5px' }}>{acoes.length}</span></button>
        <button className={`tab-trigger ${tab === 'indicadores' ? 'active' : ''}`} onClick={() => setTab('indicadores')}><BarChart2 size={12} />Indicadores</button>
      </div>

      {/* ── Filtros ── */}
      {showFilters && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 16, border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label className="form-label">Buscar aluno</label>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input className="form-input" style={{ paddingLeft: 28 }} placeholder="Nome ou turma..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">Nível de Risco</label>
              <select className="form-input" value={filtroRisco} onChange={e => setFiltroRisco(e.target.value as Risco | '')}>
                <option value="">Todos</option>
                <option value="alto">🔴 Risco Alto</option>
                <option value="medio">🟡 Risco Médio</option>
                <option value="baixo">🟢 Risco Baixo</option>
              </select>
            </div>
            <div>
              <label className="form-label">Turma</label>
              <select className="form-input" value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
                <option value="">Todas as turmas</option>
                {turmas.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {hasFilter && <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroRisco(''); setFiltroTurma(''); setSearch('') }}><X size={12} />Limpar</button>}
          </div>
          {hasFilter && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 10 }}>{alunosFiltrados.length} aluno(s) encontrado(s)</div>}
        </div>
      )}

      {/* ── Tab ALUNOS ── */}
      {tab === 'alunos' && (
        alunos.length === 0 ? (
          <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Nenhum aluno cadastrado</div>
            <div style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>Cadastre alunos em <strong>Acadêmico → Alunos</strong> para ativar o monitoramento de risco de evasão.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alunosFiltrados.map(a => {
              const cfg = RISCO_CFG[a.risco_evasao as Risco] || RISCO_CFG.baixo
              const isExpanded = expandedId === a.id
              const acoesAluno = acoes.filter(ac => ac.aluno === a.nome)
              return (
                <div key={a.id} className="card" style={{ overflow: 'hidden', borderLeft: `4px solid ${cfg.cor}` }}>
                  {/* Linha principal */}
                  <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                    {/* Avatar */}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cfg.cor}18`, color: cfg.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{getInitials(a.nome)}</div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.cor, fontWeight: 700 }}>{cfg.emoji} {cfg.label}</span>
                        {acoesAluno.length > 0 && <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: 4 }}>{acoesAluno.length} ação(ões)</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        <span>📚 {a.turma || '—'}</span>
                        <span>📊 Freq: <strong style={{ color: (a.frequencia ?? 100) < 75 ? '#ef4444' : 'inherit' }}>{a.frequencia ?? '—'}%</strong></span>
                        <span>📝 Média: <strong style={{ color: (a.media ?? 10) < 5 ? '#ef4444' : (a.media ?? 10) < 7 ? '#f59e0b' : '#10b981' }}>{a.media ?? '—'}</strong></span>
                      </div>
                    </div>

                    {/* Score ring */}
                    <ScoreEvasao freq={a.frequencia ?? 100} media={a.media ?? 10} risco={a.risco_evasao ?? 'baixo'} />

                    {/* Frequência barra */}
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>Frequência</div>
                      <BarraRisco pct={a.frequencia ?? 100} cor={(a.frequencia ?? 100) < 75 ? '#ef4444' : '#10b981'} />
                    </div>

                    {/* Expand */}
                    {isExpanded ? <ChevronUp size={16} color="hsl(var(--text-muted))" /> : <ChevronDown size={16} color="hsl(var(--text-muted))" />}
                  </div>

                  {/* Expanded: detalhes e ações */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', padding: '16px 20px', background: 'hsl(var(--bg-elevated))' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Indicadores */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-muted))' }}>INDICADORES DE RISCO</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                              { label: 'Frequência', value: `${a.frequencia ?? '—'}%`, alerta: (a.frequencia ?? 100) < 75, icon: <Activity size={12} /> },
                              { label: 'Média geral', value: String(a.media ?? '—'), alerta: (a.media ?? 10) < 5, icon: <BookOpen size={12} /> },
                            ].map(item => (
                              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'hsl(var(--bg-base))', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--text-muted))' }}>{item.icon}{item.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: item.alerta ? '#ef4444' : '#10b981' }}>{item.value}</div>
                              </div>
                            ))}
                            {/* Responsáveis separados */}
                            {(() => { const { fin, ped } = getResp(a); return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 10px', background: 'hsl(var(--bg-base))', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--text-muted))' }}><Users size={12} />Responsáveis</div>
                                {(fin || ped) ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {fin && <div style={{ fontSize: 11, fontWeight: 700, display: 'flex', gap: 4 }}><span style={{ color: '#f59e0b', fontSize: 9, background: 'rgba(245,158,11,0.1)', padding: '1px 4px', borderRadius: 3 }}>FIN</span>{fin}</div>}
                                    {ped && <div style={{ fontSize: 11, fontWeight: 700, display: 'flex', gap: 4 }}><span style={{ color: '#6366f1', fontSize: 9, background: 'rgba(99,102,241,0.1)', padding: '1px 4px', borderRadius: 3 }}>PED</span>{ped}</div>}
                                  </div>
                                ) : <div style={{ fontSize: 11, fontWeight: 700 }}>{a.responsavel || '—'}</div>}
                              </div>
                            ) })()
                            }
                          </div>
                        </div>

                        {/* Ações preventivas do aluno */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>AÇÕES PREVENTIVAS</div>
                            <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => openAcaoModal(a.nome)}>
                              <Plus size={10} />Registrar
                            </button>
                          </div>
                          {acoesAluno.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', padding: '12px 0' }}>Nenhuma ação registrada para este aluno.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {acoesAluno.map((ac, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'hsl(var(--bg-base))', borderRadius: 8 }}>
                                  <button onClick={() => toggleAcaoStatus(acoes.indexOf(ac))} style={{ color: ac.status === 'realizada' ? '#10b981' : 'hsl(var(--text-muted))', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                                    {ac.status === 'realizada' ? <CheckCircle size={14} /> : <Clock size={14} />}
                                  </button>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, textDecoration: ac.status === 'realizada' ? 'line-through' : 'none', opacity: ac.status === 'realizada' ? 0.5 : 1 }}>{ac.tipo}</div>
                                    {ac.descricao && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{ac.descricao}</div>}
                                  </div>
                                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', flexShrink: 0 }}>{new Date(ac.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ações rápidas */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                        <button className="btn btn-sm" style={{ background: 'rgba(37,211,102,0.1)', color: '#25d366', border: '1px solid rgba(37,211,102,0.2)', fontSize: 11 }}>
                          <MessageSquare size={11} />WhatsApp Responsável
                        </button>
                        <button className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', fontSize: 11 }}>
                          <Phone size={11} />Ligar
                        </button>
                        <button className="btn btn-sm" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)', fontSize: 11 }}>
                          <Heart size={11} />Renegociar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {alunosFiltrados.length === 0 && hasFilter && (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                <TrendingDown size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                <div style={{ fontWeight: 700 }}>Nenhum aluno encontrado com esses filtros</div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => { setFiltroRisco(''); setFiltroTurma(''); setSearch('') }}>Limpar filtros</button>
              </div>
            )}
            {risco.length + medio.length === 0 && !hasFilter && (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#10b981' }}>Excelente! Nenhum aluno em risco alto ou médio.</div>
                <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 6 }}>Continue monitorando a frequência e rendimento de todos os alunos.</div>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Tab AÇÕES PREVENTIVAS ── */}
      {tab === 'acoes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>{acoes.filter(a => a.status === 'pendente').length} ação(ões) pendente(s) • {acoes.filter(a => a.status === 'realizada').length} realizada(s)</div>
            <button className="btn btn-primary btn-sm" onClick={() => openAcaoModal()}><Plus size={13} />Nova Ação</button>
          </div>
          {acoes.length === 0 ? (
            <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Nenhuma ação preventiva registrada</div>
              <div style={{ fontSize: 14, color: 'hsl(var(--text-muted))', marginBottom: 24 }}>Registre ações de retenção para acompanhar o contato com os responsáveis dos alunos em risco.</div>
              <button className="btn btn-primary" onClick={() => openAcaoModal()}><Plus size={14} />Registrar Primeira Ação</button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Aluno</th><th>Tipo de Ação</th><th>Descrição</th><th>Data</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {acoes.map((ac, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{ac.aluno}</td>
                      <td style={{ fontSize: 12 }}>{ac.tipo}</td>
                      <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{ac.descricao || '—'}</td>
                      <td style={{ fontSize: 12 }}>{new Date(ac.data + 'T12:00').toLocaleDateString('pt-BR')}</td>
                      <td>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: ac.status === 'realizada' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: ac.status === 'realizada' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                          {ac.status === 'realizada' ? '✓ Realizada' : '⏳ Pendente'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => toggleAcaoStatus(i)} title={ac.status === 'pendente' ? 'Marcar realizada' : 'Marcar pendente'}>
                          {ac.status === 'pendente' ? <Check size={12} color="#10b981" /> : <Clock size={12} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab INDICADORES ── */}
      {tab === 'indicadores' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Distribuição risco */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Distribuição por Nível de Risco</div>
            {[
              { ...RISCO_CFG.alto, count: risco.length },
              { ...RISCO_CFG.medio, count: medio.length },
              { ...RISCO_CFG.baixo, count: baixo.length },
              { cor: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Não avaliado', emoji: '⬜', count: semRisco.length, prio: 3 },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.emoji} {r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: r.cor }}>{r.count} ({alunos.length > 0 ? Math.round((r.count / alunos.length) * 100) : 0}%)</span>
                </div>
                <BarraRisco pct={alunos.length > 0 ? (r.count / alunos.length) * 100 : 0} cor={r.cor} />
              </div>
            ))}
          </div>

          {/* Motivos de risco */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Principais Motivos de Risco</div>
            {motivosRisco.map(m => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{m.label}</div>
                  <BarraRisco pct={alunos.length > 0 ? (m.value / alunos.length) * 100 : 0} cor={m.cor} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: m.cor, width: 24, textAlign: 'right', flexShrink: 0 }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Taxa de retenção histórica (simulada) */}
          <div className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Metas de Retenção</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {[
                { label: 'Meta de Retenção', meta: 95, atual: taxaRetencao, cor: '#10b981' },
                { label: 'Ações Preventivas', meta: acoes.length > 0 ? acoes.length : 10, atual: acoes.filter(a => a.status === 'realizada').length, cor: '#6366f1' },
                { label: 'Alunos Recuperados', meta: risco.length + medio.length || 5, atual: acoes.filter(a => a.status === 'realizada').length, cor: '#3b82f6' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: m.cor, fontFamily: 'Outfit,sans-serif' }}>{m.atual}<span style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>/{m.meta}</span></div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{m.label}</div>
                  <BarraRisco pct={m.meta > 0 ? Math.min((m.atual / m.meta) * 100, 100) : 0} cor={m.cor} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ação Preventiva ── */}
      {showAcaoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 18, width: '100%', maxWidth: 520, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,rgba(239,68,68,0.06), rgba(245,158,11,0.03))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} color="#ef4444" /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Ação Preventiva</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Registrar intervenção de retenção</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAcaoModal(false)}><X size={16} /></button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Aluno *</label>
                <select className="form-input" value={acaoForm.aluno} onChange={e => setAcaoForm(p => ({ ...p, aluno: e.target.value }))}>
                  <option value="">Selecionar aluno...</option>
                  {[...risco, ...medio, ...baixo].map(a => <option key={a.id} value={a.nome}>{a.nome} — {a.turma}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Tipo de Ação</label>
                <select className="form-input" value={acaoForm.tipo} onChange={e => setAcaoForm(p => ({ ...p, tipo: e.target.value }))}>
                  {ACOES_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label className="form-label">Data</label><input type="date" className="form-input" value={acaoForm.data} onChange={e => setAcaoForm(p => ({ ...p, data: e.target.value }))} /></div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={acaoForm.status} onChange={e => setAcaoForm(p => ({ ...p, status: e.target.value as 'pendente' | 'realizada' }))}>
                    <option value="pendente">⏳ Pendente</option>
                    <option value="realizada">✓ Realizada</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Descrição / Observações</label>
                <textarea className="form-input" rows={3} value={acaoForm.descricao} onChange={e => setAcaoForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes da ação, resultado esperado..." style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-ghost" onClick={() => setShowAcaoModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveAcao} disabled={!acaoForm.aluno}>
                <Check size={14} />Registrar Ação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
