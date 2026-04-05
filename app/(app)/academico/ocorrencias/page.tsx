'use client'

import { useData, Ocorrencia, newId } from '@/lib/dataContext'
import { getInitials } from '@/lib/utils'
import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Plus, AlertTriangle, CheckCircle, Calendar, User, MessageSquare,
  Trash2, Search, ArrowLeft, Pencil, X,
  BookOpen, Users, Printer, FileText
} from 'lucide-react'

type GravOcorrencia = 'leve' | 'media' | 'grave'

const GRAV_CONFIG: Record<GravOcorrencia, { color: string; bg: string; label: string; border: string }> = {
  leve:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  label: '🟡 Leve',   border: 'rgba(245,158,11,0.3)' },
  media: { color: '#ef4444', bg: 'rgba(239,68,68,0.06)',   label: '🔴 Média',  border: 'rgba(239,68,68,0.3)' },
  grave: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)',    label: '⛔ Grave',  border: 'rgba(220,38,38,0.4)' },
}

const TIPOS_FALLBACK = ['Indisciplina','Atraso recorrente','Bullying','Briga','Uso de celular','Desrespeito ao professor','Dano ao patrimônio','Outro']

const BLANK: Omit<Ocorrencia,'id'|'createdAt'> = {
  alunoId:'', alunoNome:'', turma:'', tipo:'',
  descricao:'', gravidade:'leve', data:'', responsavel:'', ciencia_responsavel: false,
}

const SEG_COLORS: Record<string,string> = { EI:'#10b981', EF1:'#3b82f6', EF2:'#8b5cf6', EM:'#f59e0b', EJA:'#ec4899' }

// ── Search dropdown de aluno ──────────────────────────────────────────────────
function AlunoSearch({ value, onChange, alunosDaTurma, todosAlunos }: {
  value: string; onChange: (id: string, nome: string, turma: string) => void
  alunosDaTurma: { id: string; nome: string; turma: string }[]
  todosAlunos: { id: string; nome: string; turma: string }[]
}) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Filtra primeiro na turma; se não achar, busca em todos
  const filteredTurma = q.trim().length > 0
    ? alunosDaTurma.filter(a => a.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : alunosDaTurma.slice(0, 8)
  const filteredGlobal = q.trim().length > 0 && filteredTurma.length === 0
    ? todosAlunos.filter(a => a.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : []
  const showGlobal = filteredTurma.length === 0 && filteredGlobal.length > 0
  const items = showGlobal ? filteredGlobal : filteredTurma

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><Search size={12} style={{ color:'hsl(var(--text-muted))' }} /></div>
      <input className="form-input" style={{ paddingLeft:30 }} placeholder="Buscar aluno da turma..."
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} />
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300, background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-default))', borderRadius:10, boxShadow:'0 8px 30px rgba(0,0,0,0.3)', overflow:'hidden', marginTop:4 }}>
          {showGlobal && (
            <div style={{ padding:'5px 12px 3px', fontSize:10, color:'#f59e0b', fontWeight:700, background:'rgba(245,158,11,0.06)', borderBottom:'1px solid hsl(var(--border-subtle))' }}>
              ⚠ Nenhum aluno nesta turma — exibindo resultados globais
            </div>
          )}
          {items.length === 0
            ? <div style={{ padding:'12px', fontSize:12, color:'hsl(var(--text-muted))', textAlign:'center' }}>
                {q.trim().length === 0 ? 'Digite para buscar alunos...' : 'Nenhum aluno encontrado'}
              </div>
            : items.map(a => (
              <button key={a.id} type="button" onMouseDown={() => { onChange(a.id, a.nome, a.turma); setQ(a.nome); setOpen(false) }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}
                onMouseEnter={e => (e.currentTarget.style.background='hsl(var(--bg-hover))')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                <div style={{ width:26, height:26, borderRadius:7, background:'rgba(59,130,246,0.15)', color:'#60a5fa', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800 }}>{getInitials(a.nome)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nome}</div>
                  {a.turma && <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{a.turma}</div>}
                </div>
              </button>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Modal de edição/criação ──────────────────────────────────────────────────
function OcorrenciaModal({ form, setForm, onSave, onClose, alunosDaTurma, todosAlunos, tiposOcorrencia }: {
  form: Omit<Ocorrencia,'id'|'createdAt'>
  setForm: React.Dispatch<React.SetStateAction<Omit<Ocorrencia,'id'|'createdAt'>>>
  onSave: () => void; onClose: () => void
  alunosDaTurma: { id: string; nome: string; turma: string }[]
  todosAlunos: { id: string; nome: string; turma: string }[]
  tiposOcorrencia: { label: string; gravidade: 'leve' | 'media' | 'grave' }[]
}) {
  const s = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="card" style={{ width:'100%', maxWidth:560, padding:28, boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontWeight:800, fontSize:16 }}>{form.alunoId ? 'Editar Ocorrência' : 'Nova Ocorrência'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Aluno *</label>
            <AlunoSearch
              value={form.alunoNome}
              onChange={(id, nome, turma) => setForm(p => ({ ...p, alunoId:id, alunoNome:nome, turma: turma||p.turma }))}
              alunosDaTurma={alunosDaTurma}
              todosAlunos={todosAlunos}
            />
          </div>
          <div>
            <label className="form-label">Tipo</label>
            <select className="form-input" value={form.tipo} onChange={e => s('tipo', e.target.value)}>
              {tiposOcorrencia.length > 0 ? (
                tiposOcorrencia.map(t => <option key={t.label} value={t.label}>{t.label}</option>)
              ) : (
                TIPOS_FALLBACK.map(t => <option key={t}>{t}</option>)
              )}
            </select>
            {tiposOcorrencia.length === 0 && (
              <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 3 }}>⚠ Configure tipos em Config. Pedagógico → Tipos de Ocorrências</div>
            )}
          </div>
          <div>
            <label className="form-label">Gravidade</label>
            <div style={{ display:'flex', gap:8 }}>
              {(['leve','media','grave'] as GravOcorrencia[]).map(g => (
                <button key={g} type="button" onClick={() => s('gravidade', g)}
                  style={{ flex:1, padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:`1px solid ${form.gravidade===g ? GRAV_CONFIG[g].color : 'hsl(var(--border-subtle))'}`, background: form.gravidade===g ? GRAV_CONFIG[g].bg : 'transparent', color: form.gravidade===g ? GRAV_CONFIG[g].color : 'hsl(var(--text-muted))' }}>
                  {GRAV_CONFIG[g].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={form.data} onChange={e => s('data', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Responsável</label>
            <input className="form-input" value={form.responsavel} onChange={e => s('responsavel', e.target.value)} placeholder="Professor ou coordenador" />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Descrição *</label>
            <textarea className="form-input" rows={3} value={form.descricao} onChange={e => s('descricao', e.target.value)} placeholder="Descreva detalhadamente o ocorrido..." />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={onSave} disabled={!form.alunoNome.trim() || !form.descricao.trim()}>
            <CheckCircle size={13} />Salvar Ocorrência
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OcorrenciasPage() {
  const { ocorrencias, setOcorrencias, turmas, alunos, cfgTiposOcorrencia } = useData()

  // Tipos de ocorrência dinâmicos (usa os configurados ou fallback)
  const tiposAtivos = cfgTiposOcorrencia
    .filter(t => t.situacao === 'ativo')
    .map(t => ({ label: t.descricao, gravidade: t.gravidade }))

  // ── Navegação turma ──
  const [turmaSel, setTurmaSel] = useState<string | null>(null)

  // ── Modo home: turma | aluno ──
  const [modoHome, setModoHome] = useState<'turma'|'aluno'>('turma')
  const [buscaAlunoHome, setBuscaAlunoHome] = useState('')
  const [alunoSel, setAlunoSel] = useState<{id:string;nome:string;turma:string}|null>(null)

  // ── Filtros da home ──
  const [filtroAno, setFiltroAno] = useState('todos')
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [filtroBuscaHome, setFiltroBuscaHome] = useState('')
  const anosDisponiveis = useMemo(() => [...new Set(turmas.map(t => t.ano))].sort().reverse(), [turmas])
  const segmentosDisponiveis = useMemo(() => [...new Set(turmas.map(t => t.serie))].sort(), [turmas])

  // ── Filtros dentro da turma ──
  const [filtroGrav, setFiltroGrav] = useState<GravOcorrencia | 'todas'>('todas')
  const [busca, setBusca] = useState('')

  // ── Modal ──
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Ocorrencia,'id'|'createdAt'>>(BLANK)

  const alunosDaTurmaAtual = useMemo(() => {
    if (!turmaSel) return alunos.map(a => ({ id: a.id, nome: a.nome, turma: a.turma || '' }))
    return alunos
      .filter(a =>
        a.turma === turmaSel ||
        (a as any).turmaId === turmas.find(t => t.nome === turmaSel)?.id
      )
      .map(a => ({ id: a.id, nome: a.nome, turma: a.turma || '' }))
  }, [alunos, turmaSel, turmas])
  const todosAlunosMapped = useMemo(() => alunos.map(a => ({ id: a.id, nome: a.nome, turma: a.turma || '' })), [alunos])
  const ocDaTurma = turmaSel ? ocorrencias.filter(o => o.turma === turmaSel) : []
  const filtered = ocDaTurma.filter(o => {
    const mg = filtroGrav === 'todas' || o.gravidade === filtroGrav
    const mb = !busca || o.alunoNome.toLowerCase().includes(busca.toLowerCase()) || o.tipo.toLowerCase().includes(busca.toLowerCase())
    return mg && mb
  })

  const openNew = () => {
    setEditingId(null)
    const primeiroTipo = tiposAtivos[0]?.label || TIPOS_FALLBACK[0]
    setForm({ ...BLANK, turma: turmaSel ?? '', tipo: primeiroTipo })
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return
    setEditingId(id)
    setForm({ alunoId: oc.alunoId, alunoNome: oc.alunoNome, turma: oc.turma, tipo: oc.tipo, descricao: oc.descricao, gravidade: oc.gravidade as GravOcorrencia, data: oc.data, responsavel: oc.responsavel, ciencia_responsavel: oc.ciencia_responsavel })
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!form.alunoNome.trim() || !form.descricao.trim()) return
    if (editingId) {
      setOcorrencias(prev => prev.map(o => o.id === editingId ? { ...o, ...form } : o))
    } else {
      const nova: Ocorrencia = { ...form, turma: turmaSel ?? '', id: newId('OC'), data: form.data || new Date().toISOString().slice(0,10), createdAt: new Date().toISOString() }
      setOcorrencias(prev => [nova, ...prev])
    }
    setModalOpen(false)
  }

  const marcarCiencia = (id: string) => setOcorrencias(prev => prev.map(o => o.id === id ? { ...o, ciencia_responsavel:true } : o))
  const handleDelete = (id: string) => setOcorrencias(prev => prev.filter(o => o.id !== id))

  // ── HOME: dashboard pedagógico ────────────────────────────────────────────
  if (!turmaSel) {
    const totalOC = ocorrencias.length
    const pendentes = ocorrencias.filter(o => !o.ciencia_responsavel).length
    const graves = ocorrencias.filter(o => o.gravidade === 'grave').length
    const gravesPendentes = ocorrencias.filter(o => o.gravidade === 'grave' && !o.ciencia_responsavel).length
    const turmasFiltradas = turmas.filter(t =>
      (filtroAno === 'todos' || String(t.ano) === filtroAno) &&
      (filtroSeg === 'todos' || t.serie === filtroSeg) &&
      (!filtroBuscaHome || t.nome.toLowerCase().includes(filtroBuscaHome.toLowerCase()))
    )

    // Alunos mais reincidentes
    const reincidentes = (() => {
      const map: Record<string, { nome: string; turma: string; count: number; graves: number }> = {}
      ocorrencias.forEach(o => {
        if (!map[o.alunoId]) map[o.alunoId] = { nome: o.alunoNome, turma: o.turma, count: 0, graves: 0 }
        map[o.alunoId].count++
        if (o.gravidade === 'grave') map[o.alunoId].graves++
      })
      return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5)
    })()

    // Distribuição por tipo
    const tiposCount = (() => {
      const map: Record<string, number> = {}
      ocorrencias.forEach(o => { map[o.tipo] = (map[o.tipo] ?? 0) + 1 })
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
    })()
    const maxTipo = tiposCount[0]?.[1] ?? 1

    // Últimas 5 ocorrências
    const ultimasOC = [...ocorrencias].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

    // Distribuição por gravidade
    const leves = ocorrencias.filter(o => o.gravidade === 'leve').length
    const medias = ocorrencias.filter(o => o.gravidade === 'media').length

    // ── MODO ALUNO ────────────────────────────────────────────────────────
    if (modoHome === 'aluno') {
      const todosMapped = alunos.map(a => ({ id:a.id, nome:a.nome, turma:a.turma||'' }))
      const filteredAlunos = buscaAlunoHome.trim().length > 0
        ? todosMapped.filter(a => a.nome.toLowerCase().includes(buscaAlunoHome.toLowerCase())).slice(0,12)
        : []

      const ocDoAluno = alunoSel ? ocorrencias.filter(o => o.alunoId === alunoSel.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)) : []

      const printRelatorio = () => {
        if (!alunoSel) return
        const win = window.open('', '_blank')
        if (!win) return
        win.document.write(`<html><head><title>Relatório de Ocorrências — ${alunoSel.nome}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#1a1a2e}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0;font-weight:bold}.grave{color:#dc2626}.media{color:#ef4444}.leve{color:#f59e0b}</style></head><body>`)
        win.document.write(`<h1>Relatório de Ocorrências Disciplinares</h1>`)
        win.document.write(`<p><strong>Aluno:</strong> ${alunoSel.nome} | <strong>Turma:</strong> ${alunoSel.turma} | <strong>Total:</strong> ${ocDoAluno.length}</p>`)
        win.document.write(`<table><thead><tr><th>Data</th><th>Tipo</th><th>Gravidade</th><th>Descrição</th><th>Responsável</th><th>Ciência</th></tr></thead><tbody>`)
        ocDoAluno.forEach(o => {
          win.document.write(`<tr><td>${o.data}</td><td>${o.tipo}</td><td class="${o.gravidade}">${o.gravidade.toUpperCase()}</td><td>${o.descricao}</td><td>${o.responsavel}</td><td>${o.ciencia_responsavel?'Sim':'Não'}</td></tr>`)
        })
        win.document.write(`</tbody></table></body></html>`)
        win.document.close()
        win.print()
      }

      return (
        <div>
          <div className="page-header">
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => { setModoHome('turma'); setAlunoSel(null); setBuscaAlunoHome('') }}><ArrowLeft size={18} /></button>
              <div>
                <h1 className="page-title">Ocorrências por Aluno</h1>
                <p className="page-subtitle">Histórico individual de ocorrências disciplinares</p>
              </div>
            </div>
            {alunoSel && (
              <button className="btn btn-secondary btn-sm" onClick={printRelatorio}><Printer size={13} />Imprimir Relatório</button>
            )}
          </div>

          {/* Busca aluno */}
          <div className="card" style={{ padding:'20px', marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>🔍 Buscar Aluno</div>
            <div style={{ position:'relative' }}>
              <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
              <input className="form-input" style={{ paddingLeft:34 }} placeholder="Digite o nome do aluno..."
                value={buscaAlunoHome} onChange={e => { setBuscaAlunoHome(e.target.value); setAlunoSel(null) }} autoFocus />
            </div>
            {filteredAlunos.length > 0 && !alunoSel && (
              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                {filteredAlunos.map(a => (
                  <button key={a.id} type="button"
                    onClick={() => setAlunoSel(a)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'transparent', border:'1px solid hsl(var(--border-subtle))', borderRadius:10, cursor:'pointer', textAlign:'left' }}
                    onMouseEnter={e => e.currentTarget.style.background='hsl(var(--bg-overlay))'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ width:32,height:32,borderRadius:9,background:'rgba(99,102,241,0.12)',color:'#6366f1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800 }}>{getInitials(a.nome)}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{a.nome}</div>
                      <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{a.turma || 'Sem turma'} • {ocorrencias.filter(o=>o.alunoId===a.id).length} ocorrência(s)</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Histórico do aluno */}
          {alunoSel && (
            <div>
              <div className="card" style={{ padding:'20px', marginBottom:16, borderLeft:'4px solid #6366f1' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:44,height:44,borderRadius:12,background:'rgba(99,102,241,0.12)',color:'#6366f1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800 }}>{getInitials(alunoSel.nome)}</div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:16 }}>{alunoSel.nome}</div>
                    <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{alunoSel.turma} • {ocDoAluno.length} ocorrência(s) no histórico</div>
                  </div>
                  <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                    {(['leve','media','grave'] as const).map(g => (
                      <div key={g} style={{ padding:'6px 12px', borderRadius:20, background:GRAV_CONFIG[g].bg, border:`1px solid ${GRAV_CONFIG[g].border}`, fontSize:11, fontWeight:700, color:GRAV_CONFIG[g].color }}>
                        {GRAV_CONFIG[g].label}: {ocDoAluno.filter(o=>o.gravidade===g).length}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {ocDoAluno.length === 0 ? (
                <div className="card" style={{ padding:'30px', textAlign:'center', color:'#10b981', fontWeight:600 }}>✓ Nenhuma ocorrência registrada para este aluno.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {ocDoAluno.map(oc => {
                    const cfg = GRAV_CONFIG[oc.gravidade as GravOcorrencia] ?? GRAV_CONFIG.leve
                    return (
                      <div key={oc.id} style={{ display:'flex', gap:14, padding:'16px 18px', background:cfg.bg, border:`1px solid ${cfg.border}`, borderLeft:`4px solid ${cfg.color}`, borderRadius:12 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                            <span className="badge badge-neutral">{oc.tipo}</span>
                            <span style={{ fontSize:10, padding:'1px 7px', borderRadius:100, background:`${cfg.color}18`, color:cfg.color, fontWeight:700 }}>{cfg.label}</span>
                            {oc.turma && <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>Turma: {oc.turma}</span>}
                          </div>
                          <p style={{ fontSize:13, color:'hsl(var(--text-secondary))', lineHeight:1.5, marginBottom:6 }}>{oc.descricao}</p>
                          <div style={{ display:'flex', gap:16, fontSize:11, color:'hsl(var(--text-muted))' }}>
                            {oc.data && <span><Calendar size={9} style={{ display:'inline', marginRight:4 }} />{oc.data}</span>}
                            {oc.responsavel && <span><User size={9} style={{ display:'inline', marginRight:4 }} />{oc.responsavel}</span>}
                          </div>
                        </div>
                        {oc.ciencia_responsavel
                          ? <span className="badge badge-success" style={{ alignSelf:'flex-start' }}><CheckCircle size={9} />Ciência confirmada</span>
                          : <span className="badge badge-warning" style={{ alignSelf:'flex-start' }}><AlertTriangle size={9} />Aguardando</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Ocorrências Disciplinares</h1>
            <p className="page-subtitle">Painel de monitoramento disciplinar • {totalOC} ocorrências registradas</p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <div className="tab-list">
              {(['turma','aluno'] as const).map(m => (
                <button key={m} className={`tab-trigger ${modoHome===m?'active':''}`} onClick={() => setModoHome(m)}>
                  {m==='turma' ? <><Users size={13} />Por Turma</> : <><Search size={13} />Por Aluno</>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Alerta urgente: graves pendentes ── */}
        {gravesPendentes > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.35)', borderRadius:14, marginBottom:20, borderLeft:'4px solid #dc2626' }}>
            <div style={{ fontSize:28 }}>⛔</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#ef4444' }}>{gravesPendentes} ocorrência{gravesPendentes > 1 ? 's' : ''} grave{gravesPendentes > 1 ? 's' : ''} aguardando ciência do responsável</div>
              <div style={{ fontSize:12, color:'hsl(var(--text-secondary))', marginTop:2 }}>Ação imediata necessária — clique na turma correspondente para resolver</div>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', padding:'4px 12px', borderRadius:20, border:'1px solid rgba(239,68,68,0.3)' }}>URGENTE</div>
          </div>
        )}

        {/* ── KPIs globais ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:22 }}>
          {[
            { label:'Total', value:totalOC, color:'#3b82f6', icon:'📋', sub:'todas as turmas' },
            { label:'Graves', value:graves, color:'#dc2626', icon:'⛔', sub:`${gravesPendentes} pendentes` },
            { label:'Médias', value:medias, color:'#ef4444', icon:'🔴', sub:'gravidade média' },
            { label:'Leves', value:leves, color:'#f59e0b', icon:'🟡', sub:'gravidade leve' },
            { label:'Resolvidas', value:ocorrencias.filter(o => o.ciencia_responsavel).length, color:'#10b981', icon:'✅', sub:'ciência confirmada' },
          ].map(c => (
            <div key={c.label} style={{ padding:'18px', background:'hsl(var(--bg-elevated))', borderRadius:14, border:`1px solid ${c.color}20`, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:c.color }} />
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{c.icon}</span>
                <span style={{ fontSize:11, color:'hsl(var(--text-muted))', fontWeight:600 }}>{c.label}</span>
              </div>
              <div style={{ fontSize:30, fontWeight:900, color:c.color, fontFamily:'Outfit,sans-serif', lineHeight:1 }}>{c.value}</div>
              <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:6 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Segundo nível: tipos + reincidentes ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:22 }}>

          {/* Tipos mais frequentes */}
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontWeight:800, fontSize:13, marginBottom:16 }}>📊 Tipos Mais Frequentes</div>
            {tiposCount.length === 0 ? (
              <div style={{ fontSize:12, color:'hsl(var(--text-muted))', textAlign:'center', padding:'20px 0' }}>Sem dados</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {tiposCount.map(([tipo, count]) => {
                  const pct = (count / maxTipo) * 100
                  return (
                    <div key={tipo}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11, fontWeight:600, color:'hsl(var(--text-secondary))' }}>{tipo}</span>
                        <span style={{ fontSize:11, fontWeight:800, color:'#f59e0b' }}>{count}</span>
                      </div>
                      <div style={{ height:6, borderRadius:3, background:'hsl(var(--bg-overlay))' }}>
                        <div style={{ width:`${pct}%`, height:'100%', borderRadius:3, background:'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Alunos reincidentes */}
          <div className="card" style={{ padding:'20px', borderLeft:'3px solid #ef4444' }}>
            <div style={{ fontWeight:800, fontSize:13, marginBottom:16 }}>⚠️ Alunos Reincidentes</div>
            {reincidentes.length === 0 ? (
              <div style={{ fontSize:12, color:'#10b981', textAlign:'center', padding:'20px 0', fontWeight:600 }}>✓ Nenhum reincidente</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {reincidentes.map((r, i) => (
                  <div key={r.nome} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background: i === 0 ? 'rgba(239,68,68,0.06)' : 'transparent', borderRadius:8, border: i === 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent' }}>
                    <div style={{ width:24, height:24, borderRadius:7, background:'rgba(239,68,68,0.12)', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>
                      {i + 1}º
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.nome}</div>
                      <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{r.turma}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:14, fontWeight:900, color: r.count >= 3 ? '#ef4444' : '#f59e0b', fontFamily:'Outfit,sans-serif' }}>{r.count}</div>
                      {r.graves > 0 && <div style={{ fontSize:9, color:'#dc2626', fontWeight:700 }}>{r.graves} grave{r.graves > 1 ? 's' : ''}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Últimas ocorrências */}
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontWeight:800, fontSize:13, marginBottom:16 }}>🕐 Registro Recente</div>
            {ultimasOC.length === 0 ? (
              <div style={{ fontSize:12, color:'hsl(var(--text-muted))', textAlign:'center', padding:'20px 0' }}>Sem registros</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {ultimasOC.map(oc => {
                  const cfg = GRAV_CONFIG[oc.gravidade as GravOcorrencia] ?? GRAV_CONFIG.leve
                  return (
                    <div key={oc.id} style={{ display:'flex', gap:10, alignItems:'flex-start', paddingBottom:10, borderBottom:'1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:cfg.color, marginTop:5, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{oc.alunoNome}</div>
                        <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:1 }}>{oc.tipo} • {oc.turma}</div>
                      </div>
                      <div style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:cfg.bg, color:cfg.color, fontWeight:700, flexShrink:0, border:`1px solid ${cfg.border}` }}>
                        {oc.gravidade}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Filtros ── */}
        <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap', padding:'14px 18px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))' }}>
          <div style={{ position:'relative', flex:1, minWidth:160 }}>
            <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
            <input className="form-input" style={{ paddingLeft:30, fontSize:12 }} placeholder="Buscar turma..." value={filtroBuscaHome} onChange={e => setFiltroBuscaHome(e.target.value)} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))', fontWeight:600 }}>Ano letivo:</span>
            <select className="form-input" style={{ width:'auto', minWidth:100, fontSize:12 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
              <option value="todos">Todos</option>
              {anosDisponiveis.map(a => <option key={a} value={String(a)}>{a}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))', fontWeight:600 }}>Segmento:</span>
            <div style={{ display:'flex', gap:5 }}>
              {(['todos',...segmentosDisponiveis] as string[]).map(s => (
                <button key={s} onClick={() => setFiltroSeg(s)}
                  style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
                    background: filtroSeg===s ? `${SEG_COLORS[s] ?? '#3b82f6'}15` : 'transparent',
                    border: `1px solid ${filtroSeg===s ? (SEG_COLORS[s] ?? '#3b82f6') : 'hsl(var(--border-subtle))'}`,
                    color: filtroSeg===s ? (SEG_COLORS[s] ?? '#3b82f6') : 'hsl(var(--text-muted))' }}>
                  {s === 'todos' ? 'Todos' : s}
                </button>
              ))}
            </div>
          </div>
          {(filtroAno !== 'todos' || filtroSeg !== 'todos' || filtroBuscaHome) && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => { setFiltroAno('todos'); setFiltroSeg('todos'); setFiltroBuscaHome('') }}>✕ Limpar</button>
          )}
          <span style={{ marginLeft:'auto', fontSize:12, color:'hsl(var(--text-muted))' }}>{turmasFiltradas.length}/{turmas.length} turma(s)</span>
        </div>

        {/* ── Grid de turmas ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ fontWeight:800, fontSize:15 }}>📌 Selecione a Turma para Gerenciar Ocorrências</div>
        </div>

        {turmasFiltradas.length === 0 ? (
          <div className="card" style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <BookOpen size={40} style={{ margin:'0 auto 12px', opacity:0.15 }} />
            <div style={{ fontSize:14, fontWeight:600 }}>{turmas.length === 0 ? 'Nenhuma turma cadastrada' : 'Nenhuma turma com esses filtros'}</div>
            {turmas.length === 0 && <div style={{ fontSize:13, marginTop:6 }}>Cadastre turmas em Acadêmico → Turmas para iniciar.</div>}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16 }}>
            {turmasFiltradas.map(turma => {
              const color = SEG_COLORS[turma.serie] ?? '#3b82f6'
              const ocTurma = ocorrencias.filter(o => o.turma === turma.nome)
              const pendTurma = ocTurma.filter(o => !o.ciencia_responsavel).length
              const gravesTurma = ocTurma.filter(o => o.gravidade === 'grave').length
              const gravesPend = ocTurma.filter(o => o.gravidade === 'grave' && !o.ciencia_responsavel).length
              const alunosTurma = alunos.filter(a => a.turma === turma.nome).length
              const alertLevel = gravesPend > 0 ? '#dc2626' : pendTurma > 0 ? '#f59e0b' : color
              return (
                <button key={turma.id} onClick={() => { setTurmaSel(turma.nome); setFiltroGrav('todas'); setBusca('') }}
                  style={{ textAlign:'left', background:'hsl(var(--bg-elevated))', border:`1px solid ${alertLevel}30`, borderLeft:`4px solid ${alertLevel}`, borderRadius:14, padding:'20px', cursor:'pointer', transition:'all 0.2s', display:'block', width:'100%' }}
                  onMouseEnter={e => { e.currentTarget.style.background='hsl(var(--bg-overlay))'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 8px 24px ${alertLevel}20` }}
                  onMouseLeave={e => { e.currentTarget.style.background='hsl(var(--bg-elevated))'; e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:900, color, fontFamily:'Outfit,sans-serif' }}>{turma.nome}</div>
                      <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:3 }}>{turma.serie} • {turma.turno} • {turma.ano} • {alunosTurma} alunos</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:28, fontWeight:900, color: ocTurma.length > 0 ? alertLevel : color, fontFamily:'Outfit,sans-serif' }}>{ocTurma.length}</div>
                      <div style={{ fontSize:9, color:'hsl(var(--text-muted))' }}>ocorrências</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {gravesPend > 0 && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(220,38,38,0.15)', color:'#dc2626', fontWeight:700, border:'1px solid rgba(220,38,38,0.3)' }}>⛔ {gravesPend} grave{gravesPend > 1 ? 's' : ''} pendente{gravesPend > 1 ? 's' : ''}</span>}
                    {gravesTurma > 0 && gravesPend === 0 && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(239,68,68,0.1)', color:'#ef4444', fontWeight:700 }}>⛔ {gravesTurma} graves</span>}
                    {pendTurma > 0 && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(245,158,11,0.1)', color:'#f59e0b', fontWeight:700 }}>⚠ {pendTurma} pendentes</span>}
                    {ocTurma.length === 0 && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#10b981', fontWeight:700 }}>✓ Sem ocorrências</span>}
                    {ocTurma.length > 0 && pendTurma === 0 && gravesTurma === 0 && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#10b981', fontWeight:700 }}>✓ Todas resolvidas</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Vista interna: ocorrências da turma ──────────────────────────────────
  const turmaObj = turmas.find(t => t.nome === turmaSel)
  const color = SEG_COLORS[turmaObj?.serie ?? ''] ?? '#3b82f6'

  const printRelatorioTurma = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Ocorrências — ${turmaSel}</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h1{font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0}.grave{color:#dc2626}.media{color:#ef4444}.leve{color:#f59e0b}</style></head><body>`)
    win.document.write(`<h1>Ocorrências — ${turmaSel}</h1><p>Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>`)
    win.document.write(`<table><thead><tr><th>Aluno</th><th>Data</th><th>Tipo</th><th>Gravidade</th><th>Descrição</th><th>Responsável</th><th>Ciência</th></tr></thead><tbody>`)
    filtered.forEach(o => {
      win.document.write(`<tr><td>${o.alunoNome}</td><td>${o.data}</td><td>${o.tipo}</td><td class="${o.gravidade}">${o.gravidade.toUpperCase()}</td><td>${o.descricao}</td><td>${o.responsavel}</td><td>${o.ciencia_responsavel?'Sim':'Não'}</td></tr>`)
    })
    win.document.write(`</tbody></table></body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setTurmaSel(null)}><ArrowLeft size={18} /></button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 className="page-title" style={{ marginBottom:0 }}>Ocorrências — {turmaSel}</h1>
              <span style={{ padding:'2px 10px', borderRadius:20, background:`${color}15`, color, fontSize:11, fontWeight:700 }}>{turmaObj?.serie}</span>
            </div>
            <p className="page-subtitle">{ocDaTurma.length} ocorrência(s) • {alunosDaTurmaAtual.length} alunos</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary btn-sm" onClick={printRelatorioTurma}><Printer size={13} />Relatório da Turma</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Nova Ocorrência</button>
        </div>
      </div>

      {/* KPIs da turma */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total', value: ocDaTurma.length, color:'#3b82f6' },
          { label:'Graves', value: ocDaTurma.filter(o=>o.gravidade==='grave').length, color:'#dc2626' },
          { label:'Aguardando ciência', value: ocDaTurma.filter(o=>!o.ciencia_responsavel).length, color:'#f59e0b' },
          { label:'Resolvidas', value: ocDaTurma.filter(o=>o.ciencia_responsavel).length, color:'#10b981' },
        ].map(c => (
          <div key={c.label} className="kpi-card" style={{ borderTop:`3px solid ${c.color}` }}>
            <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginBottom:6 }}>{c.label}</div>
            <div style={{ fontSize:26, fontWeight:900, color:c.color, fontFamily:'Outfit,sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros internos */}
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
          <input className="form-input" style={{ paddingLeft:34 }} placeholder="Buscar aluno ou tipo..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="tab-list">
          {(['todas','leve','media','grave'] as const).map(f => (
            <button key={f} className={`tab-trigger ${filtroGrav===f?'active':''}`} onClick={() => setFiltroGrav(f)}>
              {f==='todas' ? 'Todas' : GRAV_CONFIG[f].label}
            </button>
          ))}
        </div>
        <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{filtered.length} result.</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
          {ocDaTurma.length === 0
            ? <><CheckCircle size={36} style={{ margin:'0 auto 12px', opacity:0.15 }} /><div style={{ fontSize:14, fontWeight:600 }}>Nenhuma ocorrência nesta turma</div><button className="btn btn-primary" style={{ marginTop:16 }} onClick={openNew}><Plus size={13} />Nova Ocorrência</button></>
            : <div>Nenhuma ocorrência com os filtros aplicados.</div>
          }
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(oc => {
            const cfg = GRAV_CONFIG[oc.gravidade as GravOcorrencia] ?? GRAV_CONFIG.leve
            return (
              <div key={oc.id} style={{ display:'flex', gap:14, padding:'16px 18px', background:cfg.bg, border:`1px solid ${cfg.border}`, borderLeft:`4px solid ${cfg.color}`, borderRadius:12, transition:'box-shadow 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow=`0 4px 20px ${cfg.color}15`)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow='')}>
                <div className="avatar" style={{ width:40, height:40, fontSize:12, background:`${cfg.color}20`, color:cfg.color, flexShrink:0 }}>
                  {getInitials(oc.alunoNome)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                    <span style={{ fontSize:14, fontWeight:700 }}>{oc.alunoNome}</span>
                    <span className="badge badge-neutral">{oc.tipo}</span>
                    <span style={{ fontSize:10, padding:'1px 7px', borderRadius:100, background:`${cfg.color}18`, color:cfg.color, fontWeight:700 }}>{cfg.label}</span>
                  </div>
                  <p style={{ fontSize:13, color:'hsl(var(--text-secondary))', lineHeight:1.5, marginBottom:6 }}>{oc.descricao}</p>
                  <div style={{ display:'flex', gap:16, fontSize:11, color:'hsl(var(--text-muted))' }}>
                    {oc.data && <span><Calendar size={9} style={{ display:'inline', marginRight:4 }} />{oc.data}</span>}
                    {oc.responsavel && <span><User size={9} style={{ display:'inline', marginRight:4 }} />{oc.responsavel}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0 }}>
                  {oc.ciencia_responsavel
                    ? <span className="badge badge-success"><CheckCircle size={9} />Ciência confirmada</span>
                    : <span className="badge badge-warning"><AlertTriangle size={9} />Aguardando</span>}
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(oc.id)}><Pencil size={12} /></button>
                    {!oc.ciencia_responsavel && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize:10 }} onClick={() => marcarCiencia(oc.id)}>
                        <MessageSquare size={10} />Confirmar
                      </button>
                    )}
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color:'#f87171' }} onClick={() => handleDelete(oc.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <OcorrenciaModal form={form} setForm={setForm} onSave={handleSave} onClose={() => setModalOpen(false)} alunosDaTurma={alunosDaTurmaAtual} todosAlunos={todosAlunosMapped} tiposOcorrencia={tiposAtivos} />
      )}
    </div>
  )
}
