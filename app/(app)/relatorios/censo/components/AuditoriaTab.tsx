'use client'
import { useState, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { ClipboardList, Filter, Download } from 'lucide-react'

const ACAO_COLOR: Record<string, string> = {
  'Validação':         '#6366f1',
  'Geração de Arquivo':'#10b981',
  'Download de Arquivo':'#0ea5e9',
  'Situação do Aluno': '#f59e0b',
  'Pendências':        '#ef4444',
  'Operação de Envio': '#8b5cf6',
  'Configuração':      '#94a3b8',
}

export function AuditoriaTab() {
  const { censoAuditLogs } = useData()
  const [search, setSearch]   = useState('')
  const [filterAcao, setFilterAcao] = useState('')
  const [page, setPage]       = useState(1)
  const PAGE_SIZE = 30

  const acoes = [...new Set(censoAuditLogs.map(l => l.modulo))]

  const filtered = useMemo(() => {
    let res = censoAuditLogs
    if (search) res = res.filter(l => l.acao?.toLowerCase().includes(search.toLowerCase()) || l.usuario?.toLowerCase().includes(search.toLowerCase()) || l.registroNome?.toLowerCase().includes(search.toLowerCase()))
    if (filterAcao) res = res.filter(l => l.modulo === filterAcao)
    return res
  }, [censoAuditLogs, search, filterAcao])

  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleExport = () => {
    const header = 'Data/Hora,Usuário,Perfil,Módulo,Ação,Registro,Justificativa\n'
    const rows = filtered.map(l =>
      `"${new Date(l.dataHora).toLocaleString('pt-BR')}","${l.usuario}","${l.perfil}","${l.modulo}","${l.acao}","${l.registroNome||''}","${l.justificativa||''}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `censo-audit-${Date.now()}.csv`; a.click()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Auditoria / Logs do Censo</h2>
          <p style={{ fontSize:13, color:'hsl(var(--text-muted))', margin:'4px 0 0' }}>
            {censoAuditLogs.length} ação(ções) registrada(s) — Rastreabilidade total do módulo
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport} style={{ gap:6 }} disabled={filtered.length===0}>
          <Download size={14}/> Exportar CSV
        </button>
      </div>

      {/* FILTROS */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:220 }}>
          <Filter size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }}/>
          <input className="form-input" placeholder="Buscar por usuário, ação ou registro..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ paddingLeft:36 }}/>
        </div>
        <select className="form-input" value={filterAcao} onChange={e => { setFilterAcao(e.target.value); setPage(1) }}>
          <option value="">Todos os Módulos</option>
          {acoes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* TABELA */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'hsl(var(--bg-overlay))' }}>
              {['Data/Hora','Usuário','Módulo','Ação','Registro','Detalhe'].map(h => (
                <th key={h} style={{ padding:'10px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:48, color:'hsl(var(--text-muted))' }}>
                <ClipboardList size={36} style={{ opacity:0.15, display:'block', margin:'0 auto 8px' }}/>
                {censoAuditLogs.length === 0 ? 'Nenhuma ação registrada ainda. Use o módulo para começar a gerar logs.' : 'Nenhum log com estes filtros.'}
              </td></tr>
            ) : paginated.map(l => {
              const color = ACAO_COLOR[l.modulo] || '#94a3b8'
              return (
                <tr key={l.id} style={{ borderTop:'1px solid hsl(var(--border-subtle))' }}>
                  <td style={{ padding:'10px 14px', fontSize:11, color:'hsl(var(--text-muted))', whiteSpace:'nowrap', fontFamily:'monospace' }}>
                    {new Date(l.dataHora).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:12 }}>
                    <div style={{ fontWeight:600 }}>{l.usuario}</div>
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{l.perfil}</div>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:6, background:`${color}15`, color }}>
                      {l.modulo}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600 }}>{l.acao}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'hsl(var(--text-muted))' }}>{l.registroNome || '—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:11, color:'hsl(var(--text-secondary))' }}>
                    {l.justificativa && (
                      <span style={{ background:'hsl(var(--bg-overlay))', padding:'2px 6px', borderRadius:4 }}>
                        {l.justificativa.slice(0, 40)}{l.justificativa.length > 40 ? '...' : ''}
                      </span>
                    )}
                    {l.valorAnterior && <div style={{ fontSize:10, marginTop:2 }}>Antes: {l.valorAnterior} → {l.valorNovo}</div>}
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
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}>← Anterior</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Próxima →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
