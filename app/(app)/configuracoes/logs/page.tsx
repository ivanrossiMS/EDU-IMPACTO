'use client'

import { useState, useMemo } from 'react'
import { useData, SystemLog } from '@/lib/dataContext'
import { getInitials } from '@/lib/utils'
import {
  ShieldAlert, ShieldCheck, Download, Search, RefreshCw, X, Filter,
  Calendar, Server, Activity, Laptop, Smartphone, Globe, Code,
  ArrowRight, ArrowDownUp, Info
} from 'lucide-react'

// Map Actions to colors and icons
const ACTION_CFG: Record<string, { color: string; bg: string; text: string }> = {
  'Cadastro': { color: '#10b981', bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  'Edição': { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  'Exclusão': { color: '#f43f5e', bg: 'rgba(244,63,94,0.15)', text: '#f43f5e' },
  'Tentativa sem sucesso': { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  'Sincronização ERP': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
}

const getActionColor = (acao: string) => ACTION_CFG[acao] || { color: '#64748b', bg: 'rgba(100,116,139,0.15)', text: '#64748b' }

export default function SystemLogsPage() {
  const { systemLogs } = useData()

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('Todos')
  const [filtroAcao, setFiltroAcao] = useState('Todas')
  const [filtroPeriodo, setFiltroPeriodo] = useState('7dias')
  
  // Detalhe
  const [viewLog, setViewLog] = useState<SystemLog | null>(null)

  // Status Extras
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Exportar Logs
  const handleExport = () => {
    if (filteredLogs.length === 0) return
    
    // Header
    const headers = ['Data/Hora', 'Usuario', 'Perfil', 'Modulo', 'Acao', 'Status', 'Registro ID', 'Nome Relacionado', 'Descricao', 'Origem', 'IP']
    
    // Rows
    const rows = filteredLogs.map(l => [
      formatDate(l.dataHora),
      `"${l.usuarioNome}"`,
      `"${l.perfil}"`,
      `"${l.modulo}"`,
      `"${l.acao}"`,
      `"${l.status}"`,
      `"${l.registroId || ''}"`,
      `"${l.nomeRelacionado || ''}"`,
      `"${l.descricao.replace(/"/g, '""')}"`,
      `"${l.origem}"`,
      `"${l.ip || ''}"`
    ].join(','))
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `auditoria_logs_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Atualizar Lista
  const handleRefresh = () => {
    setIsRefreshing(true)
    // Small timeout to show rotation
    setTimeout(() => {
      setSearch('')
      setFiltroModulo('Todos')
      setFiltroAcao('Todas')
      setFiltroPeriodo('todos')
      setIsRefreshing(false)
    }, 600)
  }

  // Options automáticos baseados nos logs reais
  const modulesAvailable = useMemo(() => Array.from(new Set(systemLogs.map(l => l.modulo))).sort(), [systemLogs])
  const actionsAvailable = useMemo(() => Array.from(new Set(systemLogs.map(l => l.acao))).sort(), [systemLogs])

  // Lógica de Filtro
  const filteredLogs = useMemo(() => {
    let rs = systemLogs

    // Periodo
    const now = new Date()
    if (filtroPeriodo === 'hoje') rs = rs.filter(l => new Date(l.dataHora) >= new Date(now.setHours(0,0,0,0)))
    if (filtroPeriodo === '7dias') rs = rs.filter(l => new Date(l.dataHora) >= new Date(now.setDate(now.getDate() - 7)))
    if (filtroPeriodo === '30dias') rs = rs.filter(l => new Date(l.dataHora) >= new Date(now.setDate(now.getDate() - 30)))

    // Outros
    if (filtroModulo !== 'Todos') rs = rs.filter(l => l.modulo === filtroModulo)
    if (filtroAcao !== 'Todas') rs = rs.filter(l => l.acao === filtroAcao)
    
    // Search literal
    if (search.trim()) {
      const qs = search.toLowerCase()
      rs = rs.filter(l => 
        l.usuarioNome.toLowerCase().includes(qs) || 
        l.descricao.toLowerCase().includes(qs) || 
        (l.registroId || '').toLowerCase().includes(qs) ||
        (l.nomeRelacionado || '').toLowerCase().includes(qs)
      )
    }

    return rs.sort((a,b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
  }, [systemLogs, search, filtroModulo, filtroAcao, filtroPeriodo])

  // KPIs
  const totalLogs = filteredLogs.length
  const totalEdicoes = filteredLogs.filter(l => l.acao.toLowerCase().includes('edição') || l.acao.toLowerCase().includes('edit')).length
  const totalExclusoes = filteredLogs.filter(l => l.acao.toLowerCase().includes('exclusão') || l.acao.toLowerCase().includes('delete')).length
  const totalFalhas = filteredLogs.filter(l => l.status === 'falha' || l.status === 'bloqueada').length

  const formatDate = (ds: string) => {
    const d = new Date(ds)
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const renderJsonDiff = (antes: any, depois: any) => {
    const keys = Array.from(new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]))
    return (
      <div style={{ background: '#0f172a', borderRadius: 8, padding: 16, marginTop: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b', textAlign: 'left' }}>
              <th style={{ padding: '0 8px 8px', width: '30%' }}>Campo</th>
              <th style={{ padding: '0 8px 8px', width: '35%', color: '#f87171' }}>Antes</th>
              <th style={{ padding: '0 8px 8px', width: '35%', color: '#34d399' }}>Depois</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k, i) => {
              const a = antes?.[k]
              const d = depois?.[k]
              const changed = JSON.stringify(a) !== JSON.stringify(d)
              return (
                <tr key={k} style={{ borderBottom: i === keys.length -1 ? 'none' : '1px solid #1e293b' }}>
                  <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace' }}>{k}</td>
                  <td style={{ padding: '8px', color: '#f87171', textDecoration: changed ? 'line-through' : 'none', opacity: a === undefined ? 0.4 : 1 }}>{a !== undefined ? String(a) : '—'}</td>
                  <td style={{ padding: '8px', color: '#34d399', fontWeight: changed ? 700 : 400, opacity: d === undefined ? 0.4 : 1 }}>{d !== undefined ? String(d) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: 24, alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ padding: 8, background: '#1e293b', borderRadius: 10, color: '#f8fafc' }}>
              <ShieldCheck size={24} />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>Controle de Logs</h1>
          </div>
          <p className="page-subtitle">Acompanhe tudo o que foi realizado no sistema, com histórico completo de ações, usuários e alterações em tempo real.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={filteredLogs.length === 0}>
            <Download size={14} /> Exportar Logs
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleRefresh}>
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> 
            {isRefreshing ? 'Atualizando...' : 'Atualizar Lista'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderTop: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13, fontWeight: 600, marginBottom: 8 }}><Activity size={16} /> Total de Logs (Filtro)</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', fontFamily: 'Outfit' }}>{totalLogs}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13, fontWeight: 600, marginBottom: 8 }}><ArrowDownUp size={16} /> Total de Edições</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', fontFamily: 'Outfit' }}>{totalEdicoes}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #f43f5e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13, fontWeight: 600, marginBottom: 8 }}><Trash2 size={16} /> Exclusões Críticas</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', fontFamily: 'Outfit' }}>{totalExclusoes}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #f59e0b', background: totalFalhas > 0 ? '#fffbeb' : '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: totalFalhas > 0 ? '#d97706' : '#64748b', fontSize: 13, fontWeight: 600, marginBottom: 8 }}><ShieldAlert size={16} /> Falhas de Segurança</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: totalFalhas > 0 ? '#d97706' : '#1e293b', fontFamily: 'Outfit' }}>{totalFalhas}</div>
        </div>
      </div>

      {/* FILTROS AVANÇADOS */}
      <div className="card shadow-sm" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#334155', fontWeight: 600, fontSize: 13 }}>
          <Filter size={16} /> Filtros de Auditoria
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) auto auto auto', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              className="form-input" 
              style={{ width: '100%', paddingLeft: 36, background: '#f8fafc' }} 
              placeholder="Buscar por usuário, registro, aluno, detalhes..." 
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="form-input" style={{ background: '#f8fafc', minWidth: 160 }} value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}>
            <option value="hoje">Hoje</option>
            <option value="7dias">Últimos 7 dias</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="todos">Todo o período</option>
          </select>
          <select className="form-input" style={{ background: '#f8fafc', minWidth: 160 }} value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)}>
            <option value="Todos">Todos os Módulos</option>
            {modulesAvailable.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="form-input" style={{ background: '#f8fafc', minWidth: 160 }} value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)}>
            <option value="Todas">Todas as Ações</option>
            {actionsAvailable.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* TABELA DE LOGS */}
      <div className="card shadow-sm">
        {filteredLogs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 16px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <ShieldCheck size={32} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Nenhum log encontrado</h3>
            <p style={{ color: '#64748b', fontSize: 14 }}>Seus filtros atuais não retornaram nenhum evento de sistema.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Contexto</th>
                  <th>Descrição / Afetado</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Auditoria</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(l => {
                  const corAcao = getActionColor(l.acao)
                  return (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{new Date(l.dataHora).toLocaleDateString('pt-BR')}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(l.dataHora).toLocaleTimeString('pt-BR')}</div>
                      </td>
                      <td>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                            {l.usuarioNome === 'Sistema' ? 'SYS' : getInitials(l.usuarioNome)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{l.usuarioNome}</div>
                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{l.perfil}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{l.modulo}</div>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: corAcao.bg, color: corAcao.color, fontWeight: 700, display: 'inline-block', marginTop: 4 }}>
                          {l.acao}
                        </span>
                      </td>
                      <td>
                         <div style={{ fontSize: 13, color: '#334155', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.descricao}</div>
                         {(l.registroId || l.nomeRelacionado) && (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {l.registroId && <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#475569' }}>{l.registroId}</code>}
                              {l.nomeRelacionado && <strong>{l.nomeRelacionado}</strong>}
                            </div>
                         )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                         {l.status === 'sucesso' ? (
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 11, fontWeight: 700 }}><CheckCircle size={12} /> OK</span>
                         ) : l.status === 'falha' ? (
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#f43f5e', fontSize: 11, fontWeight: 700 }}><XCircle size={12} /> Falha</span>
                         ) : (
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontSize: 11, fontWeight: 700 }}><ShieldAlert size={12} /> Bloqueio</span>
                         )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewLog(l)} title="Ver Detalhes">
                           <Info size={14} color="#60a5fa" />
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

      {/* MODAL DETALHE DE LOG */}
      {viewLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 700, border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            {/* Header Modal */}
            <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 <div style={{ width: 40, height: 40, borderRadius: 10, background: getActionColor(viewLog.acao).bg, color: getActionColor(viewLog.acao).color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {viewLog.status === 'falha' ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                 </div>
                 <div>
                   <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Detalhes do Evento</h2>
                   <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>ID Interno: {viewLog.id}</p>
                 </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setViewLog(null)}><X size={18} /></button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Contexto Superior */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Data e Hora</label>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                    <Calendar size={14} style={{ display: 'inline', marginRight: 6, opacity: 0.5 }} />
                    {formatDate(viewLog.dataHora)}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Usuário / Permissão</label>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                     {viewLog.usuarioNome} <span className="badge badge-neutral" style={{ marginLeft: 6 }}>{viewLog.perfil}</span>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Módulo e Ação</label>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                     {viewLog.modulo} <ArrowRight size={12} style={{ display: 'inline', margin: '0 4px', opacity: 0.5 }} /> <span style={{ color: getActionColor(viewLog.acao).color }}>{viewLog.acao}</span>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Metadados Técnicos</label>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    <Globe size={12} style={{ display: 'inline', marginRight: 4 }} /> IP: {viewLog.ip || 'Desconhecido'}  •  
                    {viewLog.origem === 'app' ? <Smartphone size={12} style={{ display: 'inline', margin: '0 4px 0 8px' }} /> : viewLog.origem === 'api' ? <Code size={12} style={{ display: 'inline', margin: '0 4px 0 8px' }} /> : <Laptop size={12} style={{ display: 'inline', margin: '0 4px 0 8px' }} />}
                     Origem: {viewLog.origem.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Registro Afetado */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                 <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Descrição e Impacto</label>
                 <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.5 }}>
                   {viewLog.descricao}
                 </div>
                 {(viewLog.registroId || viewLog.nomeRelacionado) && (
                   <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 16 }}>
                     {viewLog.registroId && (
                       <div>
                         <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 6 }}>ID Ref:</span>
                         <code style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: 4, color: '#475569', fontSize: 12 }}>{viewLog.registroId}</code>
                       </div>
                     )}
                     {viewLog.nomeRelacionado && (
                       <div>
                         <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 6 }}>Entidade Relacionada:</span>
                         <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{viewLog.nomeRelacionado}</span>
                       </div>
                     )}
                   </div>
                 )}
              </div>

              {/* Viewer de Antes/Depois SE houver diffs de JSON */}
              {(viewLog.detalhesAntes || viewLog.detalhesDepois) && (
                <div>
                   <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                     <Server size={14} /> Auditoria Estrutural (Antes vs Depois)
                   </label>
                   {renderJsonDiff(viewLog.detalhesAntes, viewLog.detalhesDepois)}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Icons faltantes via export const ou declarados em linha no lucide
import { CheckCircle, XCircle, Trash2 } from 'lucide-react'
