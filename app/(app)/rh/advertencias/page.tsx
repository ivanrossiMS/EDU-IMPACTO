'use client'

import { useData, Advertencia, newId } from '@/lib/dataContext'
import { getInitials } from '@/lib/utils'
import { useState, useMemo } from 'react'
import {
  Plus, X, CheckCircle, AlertTriangle, Shield, FileText, User,
  Calendar, Clock, Search, Edit2, Trash2, ChevronDown, Bell, BellOff,
  Briefcase, Users, TrendingUp, AlertOctagon, Lock
} from 'lucide-react'

type TipoAdv = Advertencia['tipo']
type StatusAdv = Advertencia['status']

const TIPO_CONFIG: Record<TipoAdv, { label: string; color: string; bg: string; border: string; icon: string; severity: number }> = {
  verbal:         { label: 'Verbal',           color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)',  icon: '🗣️',  severity: 1 },
  escrita:        { label: 'Escrita',           color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   icon: '📄',  severity: 2 },
  suspensao:      { label: 'Suspensão',         color: '#dc2626', bg: 'rgba(220,38,38,0.1)',    border: 'rgba(220,38,38,0.4)',   icon: '⛔',  severity: 3 },
  demissao_causa: { label: 'Justa Causa',       color: '#7f1d1d', bg: 'rgba(127,29,29,0.15)',   border: 'rgba(127,29,29,0.5)',   icon: '🚫',  severity: 4 },
}

const STATUS_CONFIG: Record<StatusAdv, { label: string; color: string; badge: string }> = {
  rascunho:  { label: 'Rascunho',         color: '#6b7280', badge: 'badge-neutral' },
  emitida:   { label: 'Emitida',          color: '#f59e0b', badge: 'badge-warning' },
  ciente:    { label: 'Ciente Assinado',  color: '#10b981', badge: 'badge-success' },
  encerrada: { label: 'Encerrada',        color: '#3b82f6', badge: 'badge-primary' },
}

const MOTIVOS_SUGESTAO = [
  'Atraso recorrente ao trabalho', 'Falta injustificada', 'Desrespeito a superior ou colega',
  'Descumprimento de normas internas', 'Negligência no exercício das funções', 'Uso indevido de equipamentos',
  'Divulgação de informações confidenciais', 'Comportamento inadequado com alunos', 'Descumprimento do regimento escolar',
]

const BLANK: Omit<Advertencia, 'id' | 'createdAt'> = {
  funcionarioId: '', funcionarioNome: '', cargo: '', departamento: '',
  tipo: 'verbal', motivo: '', descricao: '',
  data: new Date().toISOString().slice(0, 10),
  medidaAplicada: '', testemunhas: '', responsavelRH: '',
  ciente: false, dataCiencia: null, status: 'emitida',
}

export default function AdvertenciasPage() {
  const { advertencias, setAdvertencias, funcionarios } = useData()

  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoAdv>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusAdv>('todos')
  const [viewId, setViewId] = useState<string | null>(null)
  const [funcSearch, setFuncSearch] = useState('')
  const [showFuncDrop, setShowFuncDrop] = useState(false)
  const sf = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))

  const funcsFiltrados = useMemo(() =>
    funcionarios.filter(f =>
      (f.nome || '').toLowerCase().includes(funcSearch.toLowerCase()) ||
      (f.cargo || '').toLowerCase().includes(funcSearch.toLowerCase())
    ).slice(0, 8),
    [funcionarios, funcSearch]
  )

  const openNew = () => {
    setEditId(null); setForm(BLANK); setFuncSearch(''); setShowModal(true)
  }
  const openEdit = (a: Advertencia) => {
    setEditId(a.id)
    setForm({
      funcionarioId: a.funcionarioId, funcionarioNome: a.funcionarioNome,
      cargo: a.cargo, departamento: a.departamento, tipo: a.tipo,
      motivo: a.motivo, descricao: a.descricao, data: a.data,
      medidaAplicada: a.medidaAplicada, testemunhas: a.testemunhas,
      responsavelRH: a.responsavelRH, ciente: a.ciente,
      dataCiencia: a.dataCiencia, status: a.status,
    })
    setFuncSearch(a.funcionarioNome)
    setShowModal(true)
  }
  const handleSave = () => {
    if (!form.funcionarioNome.trim() || !form.motivo.trim()) return
    if (editId) {
      setAdvertencias(prev => prev.map(a => a.id === editId ? { ...a, ...form } : a))
    } else {
      const nova: Advertencia = { ...form, id: newId('ADV'), createdAt: new Date().toISOString() }
      setAdvertencias(prev => [nova, ...prev])
    }
    setShowModal(false)
  }
  const handleDelete = (id: string) => setAdvertencias(prev => prev.filter(a => a.id !== id))
  const marcarCiente = (id: string) => setAdvertencias(prev => prev.map(a =>
    a.id === id ? { ...a, ciente: true, dataCiencia: new Date().toISOString().slice(0, 10), status: 'ciente' } : a
  ))
  const encerrar = (id: string) => setAdvertencias(prev => prev.map(a =>
    a.id === id ? { ...a, status: 'encerrada' } : a
  ))

  // Métricas
  const mesAtual = new Date().toISOString().slice(0, 7)
  const doMes = advertencias.filter(a => a.data.startsWith(mesAtual))
  const pendCiencia = advertencias.filter(a => !a.ciente && a.status === 'emitida')
  const graves = advertencias.filter(a => a.tipo === 'suspensao' || a.tipo === 'demissao_causa')
  const reincidentes = (() => {
    const map: Record<string, number> = {}
    advertencias.forEach(a => { map[a.funcionarioId] = (map[a.funcionarioId] || 0) + 1 })
    return Object.values(map).filter(c => c >= 2).length
  })()

  // Filtros
  const filtered = useMemo(() => {
    let list = advertencias
    if (filtroTipo !== 'todos') list = list.filter(a => a.tipo === filtroTipo)
    if (filtroStatus !== 'todos') list = list.filter(a => a.status === filtroStatus)
    if (busca) {
      const q = busca.toLowerCase()
      list = list.filter(a =>
        a.funcionarioNome.toLowerCase().includes(q) ||
        a.motivo.toLowerCase().includes(q) ||
        a.departamento.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [advertencias, filtroTipo, filtroStatus, busca])

  const viewAdv = viewId ? advertencias.find(a => a.id === viewId) : null

  // ── VIEW DETAIL MODAL ──────────────────────────────────────────────────────
  if (viewAdv) {
    const tcfg = TIPO_CONFIG[viewAdv.tipo]
    const scfg = STATUS_CONFIG[viewAdv.status]
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 0, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
          {/* Header da advertência */}
          <div style={{ padding: '24px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', background: tcfg.bg, borderRadius: '16px 16px 0 0', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: tcfg.color }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ fontSize: 36 }}>{tcfg.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: tcfg.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Advertência {tcfg.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{viewAdv.funcionarioNome}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{viewAdv.cargo} • {viewAdv.departamento}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${scfg.badge}`} style={{ fontSize: 11 }}>{scfg.label}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setViewId(null)}><X size={16} /></button>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Motivo e data */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Motivo</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: tcfg.color }}>{viewAdv.motivo}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Data</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{viewAdv.data}</div>
              </div>
            </div>

            {/* Descrição */}
            {viewAdv.descricao && (
              <div style={{ padding: '14px 18px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, borderLeft: `3px solid ${tcfg.color}` }}>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700, marginBottom: 6 }}>DESCRIÇÃO DETALHADA</div>
                <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>{viewAdv.descricao}</div>
              </div>
            )}

            {/* Grid de info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {viewAdv.medidaAplicada && (
                <div style={{ padding: '12px', background: 'hsl(var(--bg-elevated))', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Medida Aplicada</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{viewAdv.medidaAplicada}</div>
                </div>
              )}
              {viewAdv.testemunhas && (
                <div style={{ padding: '12px', background: 'hsl(var(--bg-elevated))', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Testemunhas</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{viewAdv.testemunhas}</div>
                </div>
              )}
              {viewAdv.responsavelRH && (
                <div style={{ padding: '12px', background: 'hsl(var(--bg-elevated))', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Responsável RH</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{viewAdv.responsavelRH}</div>
                </div>
              )}
              <div style={{ padding: '12px', background: viewAdv.ciente ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', borderRadius: 10, border: `1px solid ${viewAdv.ciente ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Ciência do Funcionário</div>
                {viewAdv.ciente
                  ? <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>✓ Assinou em {viewAdv.dataCiencia}</div>
                  : <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>⚠ Aguardando assinatura</div>
                }
              </div>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              {!viewAdv.ciente && viewAdv.status === 'emitida' && (
                <button className="btn btn-primary btn-sm" onClick={() => { marcarCiente(viewAdv.id); setViewId(null) }}>
                  <CheckCircle size={13} />Registrar Ciência
                </button>
              )}
              {viewAdv.status !== 'encerrada' && viewAdv.ciente && (
                <button className="btn btn-secondary btn-sm" onClick={() => { encerrar(viewAdv.id); setViewId(null) }}>
                  <Lock size={13} />Encerrar
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => { openEdit(viewAdv); setViewId(null) }}>
                <Edit2 size={13} />Editar
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewId(null)}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Advertências de Funcionários</h1>
          <p className="page-subtitle">Registro e controle disciplinar de colaboradores • {advertencias.length} registro(s)</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Nova Advertência</button>
      </div>

      {/* Alerta urgente */}
      {pendCiencia.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 14, marginBottom: 20, borderLeft: '4px solid #f59e0b' }}>
          <AlertTriangle size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#f59e0b' }}>{pendCiencia.length} advertência{pendCiencia.length > 1 ? 's' : ''} aguardando ciência do funcionário</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>As advertências emitidas precisam ser assinadas/confirmadas pelo colaborador.</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.3)', flexShrink: 0 }}>PENDENTE</span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total', value: advertencias.length, color: '#3b82f6', icon: '📋', sub: 'todas as advertências' },
          { label: 'Este mês', value: doMes.length, color: '#8b5cf6', icon: '📅', sub: 'no período atual' },
          { label: 'Aguard. ciência', value: pendCiencia.length, color: '#f59e0b', icon: '⚠️', sub: 'precisam assinatura' },
          { label: 'Graves', value: graves.length, color: '#dc2626', icon: '⛔', sub: 'suspensão + justa causa' },
          { label: 'Reincidentes', value: reincidentes, color: '#ef4444', icon: '🔁', sub: '2 ou mais ocorrências' },
        ].map(c => (
          <div key={c.label} style={{ padding: '18px', background: 'hsl(var(--bg-elevated))', borderRadius: 14, border: `1px solid ${c.color}20`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: c.color, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 6 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Distribuição por tipo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
        {(Object.entries(TIPO_CONFIG) as [TipoAdv, typeof TIPO_CONFIG[TipoAdv]][]).map(([tipo, cfg]) => {
          const count = advertencias.filter(a => a.tipo === tipo).length
          const pct = advertencias.length > 0 ? (count / advertencias.length) * 100 : 0
          return (
            <button key={tipo} onClick={() => setFiltroTipo(filtroTipo === tipo ? 'todos' : tipo)}
              style={{ padding: '14px 16px', background: filtroTipo === tipo ? cfg.bg : 'hsl(var(--bg-elevated))', border: `1px solid ${filtroTipo === tipo ? cfg.border : 'hsl(var(--border-subtle))'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{cfg.icon}</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: cfg.color, fontFamily: 'Outfit, sans-serif' }}>{count}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: filtroTipo === tipo ? cfg.color : 'hsl(var(--text-secondary))' }}>{cfg.label}</div>
              <div style={{ height: 4, borderRadius: 2, background: 'hsl(var(--bg-overlay))', marginTop: 8 }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: cfg.color, transition: 'width 0.8s' }} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
          <input className="form-input" style={{ paddingLeft: 34, fontSize: 12 }} placeholder="Buscar funcionário, motivo ou departamento..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}>
          <option value="todos">Todos os status</option>
          {(Object.entries(STATUS_CONFIG) as [StatusAdv, typeof STATUS_CONFIG[StatusAdv]][]).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {(busca || filtroTipo !== 'todos' || filtroStatus !== 'todos') && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f87171' }} onClick={() => { setBusca(''); setFiltroTipo('todos'); setFiltroStatus('todos') }}>✕ Limpar</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'hsl(var(--text-muted))' }}>{filtered.length}/{advertencias.length} registro(s)</span>
      </div>

      {/* Timeline de advertências */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '52px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Shield size={48} style={{ margin: '0 auto 16px', opacity: 0.15 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {advertencias.length === 0 ? 'Nenhuma advertência registrada' : 'Nenhuma advertência com esses filtros'}
          </div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>
            {advertencias.length === 0 ? 'Registre advertências para manter o histórico disciplinar dos colaboradores.' : 'Tente ajustar os filtros acima.'}
          </div>
          {advertencias.length === 0 && (
            <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Registrar primeiro caso</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(adv => {
            const tcfg = TIPO_CONFIG[adv.tipo]
            const scfg = STATUS_CONFIG[adv.status]
            const isUrgente = !adv.ciente && adv.status === 'emitida' && (adv.tipo === 'suspensao' || adv.tipo === 'demissao_causa')
            return (
              <div key={adv.id}
                style={{ display: 'flex', gap: 16, padding: '18px 20px', background: tcfg.bg, border: `1px solid ${tcfg.border}`, borderLeft: `5px solid ${tcfg.color}`, borderRadius: 14, transition: 'all 0.2s', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                onClick={() => setViewId(adv.id)}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 6px 24px ${tcfg.color}20`)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                {isUrgente && <div style={{ position: 'absolute', top: 0, right: 0, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: '0 0 0 8px' }}>URGENTE</div>}

                {/* Avatar */}
                <div className="avatar" style={{ width: 46, height: 46, fontSize: 14, background: `${tcfg.color}22`, color: tcfg.color, flexShrink: 0 }}>
                  {getInitials(adv.funcionarioNome)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{adv.funcionarioNome}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${tcfg.color}18`, color: tcfg.color, fontWeight: 700, border: `1px solid ${tcfg.border}` }}>{tcfg.icon} {tcfg.label}</span>
                    <span className={`badge ${scfg.badge}`} style={{ fontSize: 10 }}>{scfg.label}</span>
                  </div>
                  {adv.cargo && <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>{adv.cargo}{adv.departamento && ` • ${adv.departamento}`}</div>}
                  <div style={{ fontSize: 13, fontWeight: 600, color: tcfg.color, marginBottom: 4 }}>{adv.motivo}</div>
                  {adv.descricao && <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{adv.descricao}</div>}
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 8 }}>
                    <span><Calendar size={9} style={{ display: 'inline', marginRight: 4 }} />{adv.data}</span>
                    {adv.responsavelRH && <span><User size={9} style={{ display: 'inline', marginRight: 4 }} />{adv.responsavelRH}</span>}
                    {adv.ciente
                      ? <span style={{ color: '#10b981', fontWeight: 700 }}><CheckCircle size={9} style={{ display: 'inline', marginRight: 4 }} />Ciente em {adv.dataCiencia}</span>
                      : <span style={{ color: '#f59e0b', fontWeight: 700 }}><AlertTriangle size={9} style={{ display: 'inline', marginRight: 4 }} />Aguardando ciência</span>
                    }
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {!adv.ciente && adv.status === 'emitida' && (
                    <button className="btn btn-primary btn-sm" style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => marcarCiente(adv.id)}>
                      <CheckCircle size={11} />Registrar Ciência
                    </button>
                  )}
                  {adv.status !== 'encerrada' && adv.ciente && (
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => encerrar(adv.id)}>
                      <Lock size={11} />Encerrar
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(adv)}><Edit2 size={12} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} title="Excluir" onClick={() => handleDelete(adv.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── MODAL DE CRIAÇÃO/EDIÇÃO ─────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17 }}>{editId ? 'Editar Advertência' : 'Nova Advertência'}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Preencha cuidadosamente todos os campos para validade jurídica.</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Funcionário */}
              <div>
                <label className="form-label">Funcionário *</label>
                <div style={{ position: 'relative' }}>
                  <User size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input
                    className="form-input" style={{ paddingLeft: 32 }}
                    placeholder="Buscar funcionário..."
                    value={funcSearch}
                    onChange={e => { setFuncSearch(e.target.value); sf('funcionarioNome', e.target.value); sf('funcionarioId', ''); setShowFuncDrop(true) }}
                    onFocus={() => setShowFuncDrop(true)}
                  />
                  {showFuncDrop && funcsFiltrados.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden', marginTop: 4 }}>
                      {funcsFiltrados.map(f => (
                        <button key={f.id} type="button"
                          onMouseDown={() => {
                            setFuncSearch(f.nome)
                            setForm(p => ({ ...p, funcionarioId: f.id, funcionarioNome: f.nome, cargo: f.cargo || '', departamento: (f as any).departamento || '' }))
                            setShowFuncDrop(false)
                          }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-hover))')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div className="avatar" style={{ width: 30, height: 30, fontSize: 10, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', flexShrink: 0 }}>{getInitials(f.nome)}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{f.nome}</div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.cargo}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {funcionarios.length === 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>⚠ Cadastre funcionários em RH → Funcionários para busca automática.</div>}
              </div>

              {/* Cargo + Departamento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Cargo</label>
                  <input className="form-input" value={form.cargo} onChange={e => sf('cargo', e.target.value)} placeholder="Ex: Professor, Secretária" />
                </div>
                <div>
                  <label className="form-label">Departamento</label>
                  <input className="form-input" value={form.departamento} onChange={e => sf('departamento', e.target.value)} placeholder="Ex: Pedagógico, Financeiro" />
                </div>
              </div>

              {/* Tipo + Data */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
                <div>
                  <label className="form-label">Tipo de Advertência *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {(Object.entries(TIPO_CONFIG) as [TipoAdv, typeof TIPO_CONFIG[TipoAdv]][]).map(([tipo, cfg]) => (
                      <button key={tipo} type="button" onClick={() => sf('tipo', tipo)}
                        style={{ padding: '8px 6px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center', border: `1px solid ${form.tipo === tipo ? cfg.color : 'hsl(var(--border-subtle))'}`, background: form.tipo === tipo ? cfg.bg : 'transparent', color: form.tipo === tipo ? cfg.color : 'hsl(var(--text-muted))', transition: 'all 0.2s' }}>
                        <div style={{ fontSize: 18, marginBottom: 3 }}>{cfg.icon}</div>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">Data</label>
                  <input type="date" className="form-input" value={form.data} onChange={e => sf('data', e.target.value)} />
                  <div style={{ marginTop: 8 }}>
                    <label className="form-label">Status</label>
                    <select className="form-input" value={form.status} onChange={e => sf('status', e.target.value)}>
                      {(Object.entries(STATUS_CONFIG) as [StatusAdv, typeof STATUS_CONFIG[StatusAdv]][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="form-label">Motivo *</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {MOTIVOS_SUGESTAO.map(m => (
                    <button key={m} type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => sf('motivo', m)}>{m}</button>
                  ))}
                </div>
                <input className="form-input" value={form.motivo} onChange={e => sf('motivo', e.target.value)} placeholder="Descreva o motivo da advertência..." />
              </div>

              {/* Descrição */}
              <div>
                <label className="form-label">Descrição Detalhada</label>
                <textarea className="form-input" rows={4} value={form.descricao} onChange={e => sf('descricao', e.target.value)}
                  placeholder="Detalhe os fatos, horários, contexto e consequências observadas. Esta descrição terá valor legal..." style={{ resize: 'vertical', fontSize: 13 }} />
              </div>

              {/* Medida + Testemunhas + RH */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Medida Aplicada</label>
                  <input className="form-input" value={form.medidaAplicada} onChange={e => sf('medidaAplicada', e.target.value)} placeholder="Ex: Suspensão 3 dias" />
                </div>
                <div>
                  <label className="form-label">Testemunhas</label>
                  <input className="form-input" value={form.testemunhas} onChange={e => sf('testemunhas', e.target.value)} placeholder="Nomes das testemunhas" />
                </div>
                <div>
                  <label className="form-label">Responsável RH</label>
                  <input className="form-input" value={form.responsavelRH} onChange={e => sf('responsavelRH', e.target.value)} placeholder="Nome do responsável" />
                </div>
              </div>

              {/* Ciência */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', background: form.ciente ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', borderRadius: 10, border: `1px solid ${form.ciente ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.2)'}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Funcionário está ciente e assinou?</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Marque se o colaborador recebeu e assinou o documento.</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => { sf('ciente', true); sf('dataCiencia', new Date().toISOString().slice(0, 10)) }} className={`btn btn-sm ${form.ciente ? 'btn-primary' : 'btn-secondary'}`}><CheckCircle size={12} />Sim</button>
                  <button type="button" onClick={() => { sf('ciente', false); sf('dataCiencia', null) }} className={`btn btn-sm ${!form.ciente ? 'btn-primary' : 'btn-secondary'}`}><X size={12} />Não</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.funcionarioNome.trim() || !form.motivo.trim()}>
                <CheckCircle size={13} />{editId ? 'Salvar Alterações' : 'Registrar Advertência'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
