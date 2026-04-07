'use client'
import { useState, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { type CensoPendencia, type CensoPendenciaTipo, type CensoPendenciaStatus } from '@/lib/dataContext'
import { AlertTriangle, XCircle, Info, CheckCircle2, Filter, MessageSquare, ExternalLink, Eye, Pencil, CheckCheck, X } from 'lucide-react'

const TIPO_CFG: Record<CensoPendenciaTipo, { label:string; color:string; bg:string; icon:any }> = {
  critica:     { label:'Crítica',     color:'#ef4444', bg:'rgba(239,68,68,0.08)',   icon: XCircle },
  alta:        { label:'Alta',        color:'#f59e0b', bg:'rgba(245,158,11,0.08)',  icon: AlertTriangle },
  media:       { label:'Média',       color:'#0ea5e9', bg:'rgba(14,165,233,0.08)',  icon: AlertTriangle },
  baixa:       { label:'Baixa',       color:'#94a3b8', bg:'rgba(148,163,184,0.08)',  icon: Info },
  informativa: { label:'Informativa', color:'#94a3b8', bg:'rgba(148,163,184,0.08)', icon: Info },
}

const STATUS_CFG: Record<CensoPendenciaStatus, { label:string; color:string }> = {
  aberta:         { label:'Aberta',           color:'#ef4444' },
  em_tratamento:  { label:'Em tratamento',    color:'#f59e0b' },
  corrigida:      { label:'Corrigida',        color:'#10b981' },
  ignorada:       { label:'Ignorada',         color:'#94a3b8' },
  reaberta:       { label:'Reaberta',         color:'#8b5cf6' },
}

function IgnoreModal({ pendencia, onClose, onSave }: { pendencia: CensoPendencia; onClose:()=>void; onSave:(justificativa:string)=>void }) {
  const [justif, setJustif] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, backdropFilter:'blur(4px)' }}>
      <div style={{ background:'hsl(var(--bg-surface))', borderRadius:16, padding:0, width:500, overflow:'hidden', border:'1px solid hsl(var(--border-subtle))' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-overlay))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:800 }}>Ignorar Pendência com Justificativa</div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:'12px 14px', fontSize:12 }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>{pendencia.registroNome} · {pendencia.campo}</div>
            <div style={{ color:'hsl(var(--text-muted))' }}>{pendencia.descricao}</div>
          </div>
          <div>
            <label className="form-label">Justificativa obrigatória</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Descreva o motivo pelo qual esta pendência pode ser ignorada..."
              value={justif}
              onChange={e => setJustif(e.target.value)}
              style={{ resize:'vertical' }}
            />
          </div>
        </div>
        <div style={{ padding:'14px 20px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={justif.trim().length < 10} onClick={() => onSave(justif)}>
            Confirmar Ignorar
          </button>
        </div>
      </div>
    </div>
  )
}

export function PendenciasTab() {
  const { censoPendencias, setCensoPendencias, censoConfig, logCensoAction } = useData()
  const [search, setSearch]         = useState('')
  const [filterTipo, setFilterTipo] = useState<CensoPendenciaTipo | ''>('')
  const [filterStatus, setFilterStatus] = useState<CensoPendenciaStatus | ''>('')
  const [filterCategoria, setFilterCategoria] = useState<'aluno'|'turma'|'escola'|'profissional'|''>('')
  const [ignoreModal, setIgnoreModal] = useState<CensoPendencia | null>(null)
  const [detail, setDetail]         = useState<CensoPendencia | null>(null)
  const [page, setPage]             = useState(1)
  const PAGE_SIZE = 25

  const filtered = useMemo(() => {
    let res = censoPendencias
    if (search) res = res.filter(p => p.registroNome?.toLowerCase().includes(search.toLowerCase()) || p.descricao?.toLowerCase().includes(search.toLowerCase()) || p.campo?.toLowerCase().includes(search.toLowerCase()))
    if (filterTipo) res = res.filter(p => p.tipo === filterTipo)
    if (filterStatus) res = res.filter(p => p.status === filterStatus)
    if (filterCategoria) res = res.filter(p => p.categoria === filterCategoria)
    return res.sort((a,b) => {
      const order: Record<CensoPendenciaTipo,number> = { critica:0, alta:1, media:2, baixa:3, informativa:4 }
      return (order[a.tipo]||4) - (order[b.tipo]||4)
    })
  }, [censoPendencias, search, filterTipo, filterStatus, filterCategoria])

  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleStatus = (id: string, newStatus: CensoPendenciaStatus, justif?: string) => {
    setCensoPendencias(prev => prev.map(p => p.id === id ? {
      ...p, status: newStatus,
      resolvidoEm: newStatus === 'corrigida' ? new Date().toISOString() : p.resolvidoEm,
      justificativaIgnore: justif || p.justificativaIgnore,
    } : p))
    logCensoAction('Pendências', `Status alterado → ${newStatus}`, { registroId:id, anoCensitario:censoConfig.anoCensitario })
  }

  const aberta    = censoPendencias.filter(p => p.status==='aberta'||p.status==='em_tratamento')
  const criticas  = aberta.filter(p => p.tipo==='critica').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* HEADER */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Central de Pendências</h2>
          <p style={{ fontSize:13, color:'hsl(var(--text-muted))', margin:'4px 0 0' }}>
            {aberta.length} aberta(s) · {criticas > 0 ? <span style={{ color:'#ef4444', fontWeight:700 }}>{criticas} crítica(s) bloqueiam a geração</span> : 'nenhuma crítica'}
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {(['critica','alta','media'] as const).map(t => {
            const cfg = TIPO_CFG[t]
            const count = aberta.filter(p => p.tipo===t).length
            return (
              <div key={t} style={{ background:'hsl(var(--bg-surface))', border:`1px solid ${cfg.color}30`, borderRadius:10, padding:'8px 14px', minWidth:70, textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:900, color:cfg.color, fontFamily:'Outfit' }}>{count}</div>
                <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{cfg.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Filter size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }}/>
          <input className="form-input" placeholder="Buscar pendência..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ paddingLeft:36 }}/>
        </div>
        <select className="form-input" value={filterTipo} onChange={e => { setFilterTipo(e.target.value as any); setPage(1) }}>
          <option value="">Todas as Severidades</option>
          {Object.entries(TIPO_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="form-input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value as any); setPage(1) }}>
          <option value="">Todos os Status</option>
          {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="form-input" value={filterCategoria} onChange={e => { setFilterCategoria(e.target.value as any); setPage(1) }}>
          <option value="">Todas as Categorias</option>
          <option value="aluno">Aluno</option>
          <option value="turma">Turma</option>
          <option value="escola">Escola</option>
          <option value="profissional">Profissional</option>
        </select>
      </div>

      {/* TABELA */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'hsl(var(--bg-overlay))' }}>
              {['Severidade','Registro','Campo','Descrição','Status','Ações'].map(h => (
                <th key={h} style={{ padding:'10px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:48, color:'hsl(var(--text-muted))' }}>
                <CheckCircle2 size={36} style={{ opacity:0.15, display:'block', margin:'0 auto 8px' }}/>
                {censoPendencias.length === 0 ? 'Nenhuma pendência — execute o Validador primeiro.' : 'Nenhuma pendência com estes filtros.'}
              </td></tr>
            ) : paginated.map(p => {
              const cfg = TIPO_CFG[p.tipo]
              const stCfg = STATUS_CFG[p.status]
              const Icon = cfg.icon
              const isOpen = p.status === 'aberta' || p.status === 'em_tratamento'
              return (
                <tr key={p.id} style={{ borderTop:'1px solid hsl(var(--border-subtle))', background: p.tipo==='critica'&&isOpen ? 'rgba(239,68,68,0.02)':undefined }}>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:6, background:cfg.bg, color:cfg.color }}>
                      <Icon size={11}/> {cfg.label}
                    </span>
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:3 }}>{p.categoria} · N{p.nivel}</div>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600, maxWidth:160 }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.registroNome}</div>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:12 }}><code style={{ fontSize:11, background:'hsl(var(--bg-overlay))', padding:'1px 5px', borderRadius:4 }}>{p.campo}</code></td>
                  <td style={{ padding:'10px 14px', fontSize:12, maxWidth:280, color:'hsl(var(--text-secondary))' }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.descricao}</div>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:stCfg.color }}>{stCfg.label}</span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Ver detalhes" onClick={() => setDetail(p)}><Eye size={13}/></button>
                      {isOpen && (
                        <>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Marcar como corrigida" onClick={() => handleStatus(p.id,'corrigida')} style={{ color:'#10b981' }}><CheckCheck size={13}/></button>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Ignorar com justificativa" onClick={() => setIgnoreModal(p)} style={{ color:'#94a3b8' }}><X size={13}/></button>
                        </>
                      )}
                      {!isOpen && (
                        <button className="btn btn-ghost btn-icon btn-sm" title="Reabrir" onClick={() => handleStatus(p.id,'reaberta')} style={{ color:'#8b5cf6' }}><AlertTriangle size={13}/></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop:'1px solid hsl(var(--border-subtle))' }}>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} de {filtered.length}</span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}>←</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>→</button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL IGNORE */}
      {ignoreModal && (
        <IgnoreModal
          pendencia={ignoreModal}
          onClose={() => setIgnoreModal(null)}
          onSave={justif => { handleStatus(ignoreModal.id,'ignorada',justif); setIgnoreModal(null) }}
        />
      )}

      {/* DRAWER DETAIL */}
      {detail && (
        <div style={{ position:'fixed', inset:0, zIndex:9998 }} onClick={() => setDetail(null)}>
          <div style={{ position:'fixed', right:0, top:0, bottom:0, width:420, background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:'16px 0 0 16px', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'-10px 0 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-overlay))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:800 }}>Detalhes da Pendência</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDetail(null)}><X size={16}/></button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                {(() => { const cfg = TIPO_CFG[detail.tipo]; const Icon = cfg.icon; return (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:8, background:cfg.bg, color:cfg.color }}>
                    <Icon size={13}/> {cfg.label}
                  </span>
                )})()}
              </div>
              {(
                [
                  ['Registro', detail.registroNome],
                  ['Categoria', detail.categoria],
                  ['Nível', `N${detail.nivel} — ${detail.nivel===1?'Obrigatoriedade':detail.nivel===2?'Consistência':'Regra de Negócio'}`],
                  ['Campo', detail.campo],
                  ['Valor Atual', detail.valorAtual || '(vazio)'],
                  ['Valor Esperado', detail.valorEsperado],
                  ['Status', STATUS_CFG[detail.status].label],
                  ['Criado em', new Date(detail.criadoEm).toLocaleString('pt-BR')],
                  detail.resolvidoEm ? ['Resolvido em', new Date(detail.resolvidoEm).toLocaleString('pt-BR')] : null,
                ] as (string[] | null)[]
              ).filter((item): item is string[] => item !== null).map(([label, val]) => (
                <div key={label as string} style={{ borderBottom:'1px solid hsl(var(--border-subtle))', paddingBottom:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', marginBottom:3 }}>{label as string}</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{val as string}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', marginBottom:6 }}>Descrição</div>
                <div style={{ fontSize:13 }}>{detail.descricao}</div>
              </div>
              <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:10, padding:'10px 14px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#818cf8', marginBottom:4 }}>💡 Sugestão de correção</div>
                <div style={{ fontSize:12 }}>{detail.sugestao}</div>
              </div>
              {detail.justificativaIgnore && (
                <div style={{ background:'rgba(148,163,184,0.08)', border:'1px solid rgba(148,163,184,0.15)', borderRadius:10, padding:'10px 14px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', marginBottom:4 }}>Justificativa do Ignore</div>
                  <div style={{ fontSize:12 }}>{detail.justificativaIgnore}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
