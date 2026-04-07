'use client'
import { useState, useMemo, useCallback } from 'react'
import { useData } from '@/lib/dataContext'
import { type CensoAlunoData, INEP_SITUACOES_CENSO } from '@/lib/dataContext'
import { CheckCircle2, AlertTriangle, Save, Lock, Users, Search, TrendingDown, BarChart3, RefreshCw } from 'lucide-react'

const SIT_COLORS: Record<string, string> = {
  '1':'#10b981','2':'#10b981','6':'#10b981',  // Aprovado/Cursando
  '3':'#f59e0b','7':'#f59e0b',                // Reprovado
  '4':'#0ea5e9',                              // Transferido
  '5':'#ef4444',                              // Abandono
  '8':'hsl(var(--text-muted))',               // Ainda matriculado
  '9':'#8b5cf6',                              // Cursando EJA
}

export function SituacaoAlunoTab() {
  const {
    alunos, transferencias, frequencias, censoConfig,
    censoAlunosData, setCensoAlunosData, logCensoAction, mantenedores
  } = useData()

  const [search, setSearch]           = useState('')
  const [filterTurma, setFilterTurma] = useState('')
  const [filterSit, setFilterSit]     = useState('')
  const [editSet, setEditSet]         = useState<Record<string, string>>({})
  const [saved, setSaved]             = useState<Set<string>>(new Set())
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [bulkSit, setBulkSit]         = useState('')
  const [page, setPage]               = useState(1)
  const PAGE_SIZE = 30

  const todasUnidades = mantenedores.flatMap(m => m.unidades)
  const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')
  const escola = todasUnidades.find(u => u.id === unidadeAtivaId) || (todasUnidades[0] as any)

  const isUnidade = (regUnid: string) => {
    if (!unidadeAtivaId) return true
    if (regUnid === unidadeAtivaId) return true
    if (escola && (regUnid === escola.nomeFantasia || regUnid === escola.razaoSocial)) return true
    return false
  }

  const censoMap = useMemo(() => new Map(censoAlunosData.map(ca => [ca.alunoId, ca])), [censoAlunosData])

  const alunosValidos = useMemo(() => alunos.filter(a => isUnidade(a.unidade)).filter(a => a.nome?.trim()), [alunos, unidadeAtivaId, escola])
  const uniqueTurmas  = [...new Set(alunosValidos.map(a => a.turma).filter(Boolean))]

  // Calcula frequência por aluno usando a estrutura correta de RegistroFrequencia
  const freqMap = useMemo(() => {
    const map = new Map<string, number>()
    alunosValidos.forEach(a => {
      let total = 0, presenca = 0
      frequencias.forEach(fr => {
        fr.registros?.forEach(reg => {
          if (reg.alunoId === a.id) {
            total++
            if (reg.status === 'P') presenca++
          }
        })
      })
      if (total > 0) map.set(a.id, Math.round((presenca / total) * 100))
    })
    return map
  }, [alunosValidos, frequencias])

  const getSitCenso = (a: any): string => {
    if (editSet[a.id] !== undefined) return editSet[a.id]
    return censoMap.get(a.id)?.situacaoCenso || ''
  }

  const filtered = useMemo(() => {
    let res = alunosValidos
    if (search)     res = res.filter(a => a.nome.toLowerCase().includes(search.toLowerCase()))
    if (filterTurma) res = res.filter(a => a.turma === filterTurma)
    if (filterSit === 'pendente') res = res.filter(a => !getSitCenso(a))
    else if (filterSit) res = res.filter(a => getSitCenso(a) === filterSit)
    return res
  }, [alunosValidos, search, filterTurma, filterSit, editSet, censoMap])

  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  // Estatísticas
  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    alunosValidos.forEach(a => {
      const s = getSitCenso(a) || 'pendente'
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [alunosValidos, editSet, censoMap])

  const comSituacao = alunosValidos.filter(a => getSitCenso(a)).length
  const pendentes   = alunosValidos.length - comSituacao
  const hasDirty    = Object.keys(editSet).length > 0

  // Inconsistências automáticas
  const inconsistencias = useMemo(() => {
    const warns: { alunoId:string; nome:string; tipo:string }[] = []
    alunosValidos.forEach(a => {
      const sit = getSitCenso(a)
      // Transferido sem registro
      if (sit === '4') {
        const hasT = transferencias.some(tr => (tr as any).alunoId === a.id || (tr as any).alunoNome?.toLowerCase().includes(a.nome?.toLowerCase()))
        if (!hasT) warns.push({ alunoId:a.id, nome:a.nome, tipo:'Transferido sem registro de transferência no ERP' })
      }
      // Baixa frequência → deveria ser Rep. por Falta
      const freq = freqMap.get(a.id)
      if (freq !== undefined && freq < 75 && sit && sit !== '7' && sit !== '4' && sit !== '5') {
        warns.push({ alunoId:a.id, nome:a.nome, tipo:`Frequência ${freq}% (<75%) — pode ser Reprovado por Falta (código 7)` })
      }
    })
    return warns
  }, [alunosValidos, editSet, censoMap, transferencias, freqMap])

  const handleChange = (id: string, val: string) =>
    setEditSet(prev => ({ ...prev, [id]: val }))

  const saveAnluno = useCallback((a: any) => {
    const novaSit = editSet[a.id]
    if (novaSit === undefined) return
    setCensoAlunosData(prev => {
      const idx = prev.findIndex(ca => ca.alunoId === a.id)
      const updated = { ...(idx >= 0 ? prev[idx] : { alunoId:a.id } as any), situacaoCenso: novaSit, updatedAt: new Date().toISOString() } as CensoAlunoData
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
      return [...prev, updated]
    })
    logCensoAction('Situação do Aluno', 'Etapa 2 — Situação definida', {
      registroId:a.id, registroNome:a.nome,
      valorAnterior: censoMap.get(a.id)?.situacaoCenso || '', valorNovo:novaSit,
      anoCensitario:censoConfig.anoCensitario, etapa:'2-situacao',
    })
    setSaved(prev => new Set([...prev, a.id]))
    setEditSet(prev => { const n = {...prev}; delete n[a.id]; return n })
    setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(a.id); return n }), 2500)
  }, [editSet, censoMap, censoConfig])

  const saveAll = useCallback(() => {
    const idsToSave = Object.keys(editSet)
    setCensoAlunosData(prev => {
      const next = [...prev]
      idsToSave.forEach(id => {
        const idx = next.findIndex(ca => ca.alunoId === id)
        const updated = { ...(idx >= 0 ? next[idx] : { alunoId:id } as any), situacaoCenso: editSet[id], updatedAt: new Date().toISOString() } as CensoAlunoData
        idx >= 0 ? (next[idx] = updated) : next.push(updated)
      })
      return next
    })
    logCensoAction('Situação do Aluno', `Salvamento em lote — ${idsToSave.length} alunos`, { anoCensitario:censoConfig.anoCensitario, etapa:'2-situacao' })
    setEditSet({})
  }, [editSet, censoConfig])

  const applyBulk = useCallback(() => {
    if (!bulkSit || selected.size === 0) return
    const updates: Record<string, string> = {}
    selected.forEach(id => { updates[id] = bulkSit })
    setEditSet(prev => ({ ...prev, ...updates }))
    setSelected(new Set())
  }, [bulkSit, selected])

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleAll = () => {
    if (selected.size === paginated.length) setSelected(new Set())
    else setSelected(new Set(paginated.map(a => a.id)))
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Situação do Aluno — Etapa 2</h2>
        <p style={{ fontSize:13, color:'hsl(var(--text-muted))', margin:'4px 0 0' }}>
          Defina a situação final de cada aluno · Censo {censoConfig.anoCensitario} · {censoConfig.etapaAtiva === '2-situacao' ? 'Etapa 2 ativa' : 'Etapa 1 ativa'}
        </p>
      </div>

      {/* ESTATÍSTICAS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
        <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid rgba(16,185,129,0.3)', borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:900, color:'#10b981', fontFamily:'Outfit' }}>{comSituacao}</div>
          <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Com situação</div>
        </div>
        <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:900, color:'#f59e0b', fontFamily:'Outfit' }}>{pendentes}</div>
          <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Pendentes</div>
        </div>
        {Object.entries(stats).filter(([k]) => k !== 'pendente').slice(0, 4).map(([cod, cnt]) => {
          const sit = INEP_SITUACOES_CENSO.find(s => s.codigo === cod)
          return !sit ? null : (
            <div key={cod} style={{ background:'hsl(var(--bg-surface))', border:`1px solid ${SIT_COLORS[cod]||'hsl(var(--border-subtle))'}30`, borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:900, color:SIT_COLORS[cod]||'hsl(var(--text-primary))', fontFamily:'Outfit' }}>{cnt}</div>
              <div style={{ fontSize:10, color:'hsl(var(--text-muted))', lineHeight:1.3 }}>{sit.nome}</div>
            </div>
          )
        })}
      </div>

      {/* INCONSISTÊNCIAS */}
      {inconsistencias.length > 0 && (
        <div style={{ background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:12, padding:'14px 18px' }}>
          <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:8, display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
            <AlertTriangle size={14}/> {inconsistencias.length} inconsistência(s) detectadas automaticamente
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {inconsistencias.slice(0,5).map((w, i) => (
              <div key={i} style={{ fontSize:11, color:'hsl(var(--text-secondary))' }}>
                • <strong>{w.nome}</strong>: {w.tipo}
              </div>
            ))}
            {inconsistencias.length > 5 && <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>+ {inconsistencias.length-5} outras...</div>}
          </div>
        </div>
      )}

      {/* AVISO ETAPA */}
      <div style={{ background:'rgba(14,165,233,0.05)', border:'1px solid rgba(14,165,233,0.15)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'hsl(var(--text-secondary))' }}>
        <Lock size={12} style={{ display:'inline', marginRight:5, verticalAlign:'middle', color:'#38bdf8' }}/>
        Etapa 2 Situação Final: use os códigos INEP oficiais. A situação exportada será o campo R30 do arquivo Educacenso.
      </div>

      {/* FILTROS + AÇÃO EM LOTE */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:'1 1 200px' }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }}/>
          <input className="form-input" placeholder="Buscar aluno..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ paddingLeft:32 }}/>
        </div>
        <select className="form-input" style={{ flex:'0 0 160px' }} value={filterTurma} onChange={e => { setFilterTurma(e.target.value); setPage(1) }}>
          <option value="">Todas as Turmas</option>
          {uniqueTurmas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-input" style={{ flex:'0 0 180px' }} value={filterSit} onChange={e => { setFilterSit(e.target.value); setPage(1) }}>
          <option value="">Todas as Situações</option>
          <option value="pendente">⏳ Pendentes</option>
          {INEP_SITUACOES_CENSO.map(s => <option key={s.codigo} value={s.codigo}>{s.codigo} — {s.nome}</option>)}
        </select>
        {hasDirty && (
          <button onClick={saveAll} className="btn btn-primary" style={{ gap:6, whiteSpace:'nowrap' }}>
            <Save size={14}/> Salvar Todos ({Object.keys(editSet).length})
          </button>
        )}
      </div>

      {/* BULK ACTION */}
      {selected.size > 0 && (
        <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, padding:'12px 16px', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <Users size={14} color="#818cf8"/>
          <span style={{ fontSize:12, fontWeight:700, color:'#a5b4fc' }}>{selected.size} selecionado(s)</span>
          <select className="form-input" style={{ flex:'0 0 200px', fontSize:12 }} value={bulkSit} onChange={e => setBulkSit(e.target.value)}>
            <option value="">Aplicar situação em lote...</option>
            {INEP_SITUACOES_CENSO.map(s => <option key={s.codigo} value={s.codigo}>{s.codigo} — {s.nome}</option>)}
          </select>
          <button onClick={applyBulk} className="btn btn-primary btn-sm" disabled={!bulkSit} style={{ gap:6 }}>
            <RefreshCw size={12}/> Aplicar
          </button>
          <button onClick={() => setSelected(new Set())} className="btn btn-ghost btn-sm">Limpar seleção</button>
        </div>
      )}

      {/* TABELA */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'hsl(var(--bg-overlay))' }}>
                <th style={{ padding:'10px 12px', width:36 }}>
                  <input type="checkbox" onChange={toggleAll} checked={selected.size === paginated.length && paginated.length > 0} style={{ accentColor:'#6366f1' }}/>
                </th>
                {['Aluno','Turma','Série','Frequência','Status ERP','Situação Censo (Etapa 2)','Ação'].map(h => (
                  <th key={h} style={{ padding:'10px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:48, color:'hsl(var(--text-muted))' }}>Nenhum aluno encontrado.</td></tr>
              ) : paginated.map(a => {
                const sitAtual  = getSitCenso(a)
                const isDirty   = editSet[a.id] !== undefined
                const wasSaved  = saved.has(a.id)
                const isSel     = selected.has(a.id)
                const sitInfo   = INEP_SITUACOES_CENSO.find(s => s.codigo === sitAtual)
                const freqPct   = freqMap.get(a.id)
                const baixaFreq = freqPct !== undefined && freqPct < 75

                return (
                  <tr key={a.id} style={{
                    borderTop:'1px solid hsl(var(--border-subtle))',
                    background: isSel ? 'rgba(99,102,241,0.04)' : wasSaved ? 'rgba(16,185,129,0.02)' : isDirty ? 'rgba(99,102,241,0.02)' : '',
                    transition:'background 0.1s',
                  }}>
                    <td style={{ padding:'9px 12px' }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleSelect(a.id)} style={{ accentColor:'#6366f1' }}/>
                    </td>
                    <td style={{ padding:'9px 12px' }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{a.nome}</div>
                      {baixaFreq && <div style={{ fontSize:10, color:'#f59e0b', marginTop:1 }}>⚠ Freq. baixa</div>}
                    </td>
                    <td style={{ padding:'9px 12px', fontSize:12 }}>{a.turma||'—'}</td>
                    <td style={{ padding:'9px 12px', fontSize:12 }}>{a.serie||'—'}</td>
                    <td style={{ padding:'9px 12px' }}>
                      {freqPct !== undefined ? (
                        <div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:2 }}>
                            {baixaFreq ? <TrendingDown size={11} color="#ef4444"/> : <CheckCircle2 size={11} color="#10b981"/>}
                            <span style={{ fontSize:11, fontWeight:700, color:baixaFreq?'#ef4444':'#10b981' }}>{freqPct}%</span>
                          </div>
                          <div style={{ height:3, background:'hsl(var(--bg-overlay))', borderRadius:2, width:60, overflow:'hidden' }}>
                            <div style={{ width:`${freqPct}%`, height:'100%', background:baixaFreq?'#ef4444':'#10b981', borderRadius:2 }}/>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{ fontSize:11, padding:'2px 7px', borderRadius:5, background:'hsl(var(--bg-overlay))', color:'hsl(var(--text-muted))' }}>
                        {a.status||'—'}
                      </span>
                    </td>
                    <td style={{ padding:'9px 12px', minWidth:230 }}>
                      <select
                        className="form-input"
                        style={{ fontSize:12, padding:'6px 10px', border: isDirty ? '1.5px solid #6366f1' : undefined }}
                        value={sitAtual}
                        onChange={e => handleChange(a.id, e.target.value)}
                      >
                        <option value="">— Selecionar —</option>
                        {INEP_SITUACOES_CENSO.map(s => (
                          <option key={s.codigo} value={s.codigo}>{s.codigo} — {s.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding:'9px 12px' }}>
                      {wasSaved ? (
                        <span style={{ fontSize:11, color:'#10b981', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}><CheckCircle2 size={13}/> Salvo</span>
                      ) : isDirty ? (
                        <button onClick={() => saveAnluno(a)} className="btn btn-primary btn-sm" style={{ fontSize:11, gap:5 }}>
                          <Save size={11}/> Salvar
                        </button>
                      ) : (
                        <span style={{ fontSize:11, fontWeight:600, color:sitAtual ? SIT_COLORS[sitAtual]||'#10b981' : 'hsl(var(--text-muted))' }}>
                          {sitAtual ? `✓ ${sitInfo?.nome || sitAtual}` : '⏳ Pendente'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-surface))' }}>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} de {filtered.length}</span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>← Anterior</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>Próxima →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
