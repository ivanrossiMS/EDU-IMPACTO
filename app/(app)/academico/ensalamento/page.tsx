'use client'

import { useData } from '@/lib/dataContext'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import {
  ArrowLeft, Save, CheckCircle, Search, Users,
  ChevronRight, GripVertical, Printer, Loader2, ArrowUpDown, GraduationCap, Clock, ShieldAlert
} from 'lucide-react'

// Utilizando as cores de segmentos modernas do sistema
const SEG_COLORS: Record<string,string> = {
  'Maternal': '#ec4899',          // Rosa
  'Pré Escola': '#d946ef',        // Fúcsia
  'Ensino Fundamental I': '#8b5cf6', // Roxo Claro
  'Ensino Fundamental II': '#6366f1', // Indigo
  'Ensino Médio': '#3b82f6',      // Azul Base
}

// Interface Enxuta de Ensalamento: Apenas a numeração sequencial
interface EnsalAluno {
  alunoId: string
  numeroChamada: number
}

interface EnsalTurma {
  turmaId: string
  ensalamento: EnsalAluno[]
}

// ─── Motor de Match Corrigido ─────────────────────────────────────────────────
// A API /api/alunos faz merge do JSONB e retorna um campo flat "turma" (nome da turma)
// que é a fonte de verdade primária. O histórico de matrículas serve como fallback legado.
const GLOBAL_STATUS_DENY = ['inativo', 'cancelado', 'evadido', 'trancado', 'inadimplente-bloqueado', 'desistente', 'transferido']
const HIST_STATUS_DENY   = ['inativo', 'cancelado', 'evadido', 'trancado', 'transferido', 'desistente']

const matchAlunoTurmaAndCursando = (a: any, turma: any): boolean => {
    const tNome = String(turma.nome || '').trim().toUpperCase()
    const tId   = String(turma.id   || '').trim().toUpperCase()

    // ── Filtro 1: Status Global do Aluno (coluna flat no Supabase) ──────────────
    const globalStatus = String(a.status || '').toLowerCase().trim()
    if (GLOBAL_STATUS_DENY.includes(globalStatus)) return false

    // ── Match Primário: campo flat "turma" (nome) preenchido pelo buildRowAuth ───
    // Este é o caminho padrão para 99% dos alunos cadastrados pela UI
    if (a.turma) {
        const aTurmaUp = String(a.turma).trim().toUpperCase()
        if (aTurmaUp === tNome || aTurmaUp === tId) return true
    }

    // ── Fallback: historicoMatriculas no JSONB (alunos legados/importados) ───────
    let dParsed: any = {}
    try { dParsed = typeof a.dados === 'string' ? JSON.parse(a.dados) : (a.dados || {}) } catch { dParsed = {} }

    const histArr: any[] = dParsed.historicoMatriculas || []
    const histValido = histArr.find((h: any) => {
        const hStat = String(h.status || h.situacao || '').toLowerCase().trim()
        return !HIST_STATUS_DENY.includes(hStat)
    })

    if (histValido) {
        const hTurmaId   = String(histValido.turmaId   || '').trim().toUpperCase()
        const hTurmaNome = String(histValido.turmaNome || histValido.turma || '').trim().toUpperCase()
        if (hTurmaId === tId || hTurmaNome === tNome) return true
    }

    // ── Fallback 2: dadosMatricula.turmaId ────────────────────────────────────────
    const dMat = dParsed.dadosMatricula || {}
    if (dMat.turmaId && String(dMat.turmaId).trim().toUpperCase() === tId) return true

    return false
}

export default function EnsalamentoPage() {
  const { turmas, cfgNiveisEnsino } = useData()

  // Busca real dos alunos via React Query (useData().alunos é stub vazio — alunos foram desacoplados)
  const { data: alunosResponse, isLoading: isLoadingAlunos } = useApiQuery<{ data: any[]; meta: any }>(
    ['alunos-ensalamento'],
    '/api/alunos',
    { limit: 3000 }
  )
  // ── Estabilizar referência de alunos ────────────────────────────────────────
  // CRÍTICO: `alunosResponse?.data || []` cria UM NOVO array [] a cada render enquanto
  // a query está loading. Isso faz useMemo de alunosDaTurma retornar nova ref → useEffect
  // dispara → setLocalEnsal → re-render → loop infinito.
  const alunos: any[] = useMemo(() => alunosResponse?.data || [], [alunosResponse?.data])

  // Estados de Controle
  const [turmaSel, setTurmaSel] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [editingChamada, setEditingChamada] = useState<string | null>(null)  // alunoId em edição
  const [editChamadaVal, setEditChamadaVal] = useState('')

  // Filtros da home
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [filtroTurno, setFiltroTurno] = useState('Todos')
  const [filtroAno, setFiltroAno] = useState('Todos')
  const [filtroBuscaHome, setFiltroBuscaHome] = useState('')

  // Objeto da Turma Selecionada
  const currentTurma = useMemo(() => (turmas || []).find(t => t.id === turmaSel), [turmas, turmaSel])

  // Motor Especializado: Capta APENAS os alunos confirmados na sala (via Histórico ou Fallback)
  const alunosDaTurma = useMemo(() => {
    if (!currentTurma) return []
    return (alunos || []).filter(a => matchAlunoTurmaAndCursando(a, currentTurma))
  }, [alunos, currentTurma])

  // ── Chave estável para evitar loop infinito ──────────────────────────────────
  // Usamos uma string de IDs como dependência do useEffect em lugar do array de objetos,
  // pois arrays novos com o mesmo conteúdo NÃO são iguais por referência no JS.
  const alunosDaTurmaKey = useMemo(
    () => alunosDaTurma.map(a => a.id).join(','),
    [alunosDaTurma]
  )

  // Estado Local (em tela) do Ensalamento daquela turma
  const [localEnsal, setLocalEnsal] = useState<EnsalAluno[]>([])

  // ── Ref para alunosDaTurma: mantém o valor atual sem ser dep. do useEffect ──
  // Isso quebra o ciclo: useEffect → setLocalEnsal → re-render → novo alunosDaTurma → useEffect
  const alunosDaTurmaRef = useRef<any[]>([])
  useEffect(() => { alunosDaTurmaRef.current = alunosDaTurma }, [alunosDaTurma])

  // Load Database Configuration on Turma Load (Appends sequentially)
  useEffect(() => {
    if (!currentTurma) return
    const dbEnsal: EnsalAluno[] = (currentTurma as any).dados?.ensalamento || []
    const snapshot = alunosDaTurmaRef.current   // valor estável, sem ser dep. reativa
    
    // Reconstruímos para preservar a ordem existente na íntegra
    let newEnsal = [...dbEnsal]
    const savedIds = new Set(newEnsal.map(e => e.alunoId))
    
    // Captura o último número registrado para iniciar o append
    let maxCall = newEnsal.reduce((m, c) => Math.max(m, c.numeroChamada), 0)

    // INJEÇÃO SEQUENCIAL: Todo novo aluno que caiu na turma vai pro final (N+1).
    snapshot.forEach(a => {
      if (!savedIds.has(a.id)) {
        maxCall++
        newEnsal.push({ alunoId: a.id, numeroChamada: maxCall })
      }
    })

    // GARANTIA: Removemos evadidos para não gerar buracos fantasma
    const activeIds = new Set(snapshot.map(a => a.id))
    let finalEnsal = newEnsal.filter(e => activeIds.has(e.alunoId))

    // Renumerar sem perder a posição orgânica: (1, 3, 4 → 1, 2, 3) fechando gaps.
    finalEnsal.sort((a, b) => a.numeroChamada - b.numeroChamada)
    finalEnsal = finalEnsal.map((e, idx) => ({ ...e, numeroChamada: idx + 1 }))

    // Guard: não chamar setLocalEnsal se o resultado for estruturalmente idêntico
    setLocalEnsal(prev => {
      const prevKey = prev.map(e => `${e.alunoId}:${e.numeroChamada}`).join(',')
      const nextKey = finalEnsal.map(e => `${e.alunoId}:${e.numeroChamada}`).join(',')
      return prevKey === nextKey ? prev : finalEnsal
    })
  // turmaSel: quando muda de turma, reinicia o ensalamento.
  // alunosDaTurmaKey: quando a lista de alunos muda (aluno novo/saiu), recalcula.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaSel, alunosDaTurmaKey])

  // Getters Helper
  const getAluno = (id: string) => (alunos || []).find(a => a.id === id)
  const renumerar = (list: EnsalAluno[]) => list.map((e, i) => ({ ...e, numeroChamada: i + 1 }))

  // Salvar Permanentemente no BD Backend
  const handleSalvar = async () => {
    if (!currentTurma) return
    setIsSaving(true)
    try {
       const payload = {
          ...currentTurma,
          dados: {
             ...((currentTurma as any).dados || {}),
             ensalamento: renumerar(localEnsal)
          }
       }
       
       const res = await fetch('/api/turmas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
       })
       if (!res.ok) throw new Error()
       
       setSalvo(true)
       setTimeout(() => setSalvo(false), 2500)
    } catch (e) {
       console.error("Erro ao salvar ensalamento", e)
       alert("Ocorreu um erro ao gravar a Lista de Chamada de forma permanente.")
    } finally {
       setIsSaving(false)
    }
  }

  // Alterar número de chamada diretamente (move o aluno para a posição destino)
  const confirmarEdicaoChamada = (alunoId: string, novoNum: string) => {
    const n = parseInt(novoNum, 10)
    if (!isNaN(n) && n >= 1) {
      const target = Math.min(n, localEnsal.length)
      setLocalEnsal(prev => {
        const copy = [...prev]
        const fromIdx = copy.findIndex(e => e.alunoId === alunoId)
        if (fromIdx === -1) return prev
        const [item] = copy.splice(fromIdx, 1)
        copy.splice(target - 1, 0, item)
        return copy.map((e, i) => ({ ...e, numeroChamada: i + 1 }))
      })
    }
    setEditingChamada(null)
  }

  // Ordenação Forçada Manual A-Z (caso necessitem padronizar)
  const ordenarComAviso = () => {
     if (confirm('Atenção: A ordenação A-Z afetará TODOS os alunos da sala regravando seus números de chamada pelo alfabeto. Confirma a reordenação?')) {
        const copy = [...localEnsal].sort((a, b) => {
           const na = getAluno(a.alunoId)?.nome || ''
           const nb = getAluno(b.alunoId)?.nome || ''
           return na.localeCompare(nb, 'pt-BR')
        })
        setLocalEnsal(renumerar(copy))
     }
  }

  // Drag Reorder Logistics
  const onDragStart = (i: number) => setDragIdx(i)
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIdx(i) }
  const onDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return }
    const copy = [...localEnsal]
    const [moved] = copy.splice(dragIdx, 1)
    copy.splice(i, 0, moved)
    setLocalEnsal(renumerar(copy)) // the magic of re-enumerating sequentially gap-free!
    setDragIdx(null); setDragOverIdx(null)
  }

  // Busca Interna do Ensalamento
  const filteredEnsal = localEnsal.filter(e => {
    if (!busca) return true
    const nome = getAluno(e.alunoId)?.nome ?? ''
    return nome.toLowerCase().includes(busca.toLowerCase()) || String(e.numeroChamada).includes(busca)
  })

  // ----------------------------------------------------
  // Render: VISTA HOME (Executive Cards)
  // ----------------------------------------------------
  if (!turmaSel) {
    const turnosDisponiveis = [...new Set((turmas || []).map(t => t.turno).filter(Boolean))]
    const anosDisponiveis = [...new Set((turmas || []).map(t => String(t.ano)).filter(Boolean))].sort().reverse()
    const segsDisponiveis = [...new Set((turmas || []).map(t => t.serie).filter(Boolean))].sort()

    const turmasFiltradas = (turmas || []).filter(t => {
      const mb = !filtroBuscaHome || t.nome.toLowerCase().includes(filtroBuscaHome.toLowerCase()) || (t.professor || '').toLowerCase().includes(filtroBuscaHome.toLowerCase())
      const ms = filtroSeg === 'todos' || t.serie === filtroSeg
      const mtu = filtroTurno === 'Todos' || t.turno === filtroTurno
      const ma = filtroAno === 'Todos' || String(t.ano) === filtroAno
      return mb && ms && mtu && ma
    })

    const hasFilters = !!(filtroBuscaHome || filtroSeg !== 'todos' || filtroTurno !== 'Todos' || filtroAno !== 'Todos')
    const clearFilters = () => { setFiltroBuscaHome(''); setFiltroSeg('todos'); setFiltroTurno('Todos'); setFiltroAno('Todos') }

    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Gerenciamento de Chamadas</h1>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>Gestão automatizada e reordenação das turmas matriculadas.</p>
          </div>
          {isLoadingAlunos && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(99,102,241,0.08)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)' }}>
              <Loader2 size={14} className="spin" style={{ color: '#6366f1' }} />
              <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Carregando alunos...</span>
            </div>
          )}
        </div>

        {(turmas || []).length === 0 ? (
          <div className="card" style={{ padding:'60px 40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <Users size={60} style={{ margin:'0 auto 16px', opacity:0.1 }} />
            <div style={{ fontSize:15, fontWeight:700 }}>Nenhuma turma matriculada no sistema.</div>
          </div>
        ) : (
          <>
            {/* Filtros Container Premium */}
            <div style={{ display:'flex', gap:10, marginBottom:22, flexWrap:'wrap', alignItems:'center', padding:'18px 24px', background:'hsl(var(--bg-elevated))', borderRadius:16, border:'1px solid hsl(var(--border-subtle))', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <div style={{ position:'relative', flex:1, minWidth:220 }}>
                <Search size={14} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
                <input className="form-input" style={{ width: '100%', paddingLeft:36, height: 42, fontSize: 13, borderRadius: 10 }} placeholder="Buscar turma ou professor..." value={filtroBuscaHome} onChange={e => setFiltroBuscaHome(e.target.value)} />
              </div>

              {/* Segmento */}
              {segsDisponiveis.length > 0 && (
                <select className="form-input" style={{ height: 42, fontSize:13, borderRadius: 10, width: 220, background: 'hsl(var(--bg-layer))' }} value={filtroSeg} onChange={e => setFiltroSeg(e.target.value)}>
                  <option value="todos">Todos Segmentos</option>
                  {segsDisponiveis.map(s => {
                     const nivel = (cfgNiveisEnsino || []).find(n => String(n.id) === String(s) || String(n.codigo) === String(s));
                     const label = nivel ? nivel.nome : s;
                     return <option key={s} value={s}>{label}</option>
                  })}
                </select>
              )}

              {/* Turno */}
              {turnosDisponiveis.length > 0 && (
                <select className="form-input" style={{ height: 42, fontSize:13, borderRadius: 10, width: 140 }} value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
                  <option value="Todos">Turnos</option>
                  {turnosDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}

              {/* Ano */}
              {anosDisponiveis.length > 0 && (
                <select className="form-input" style={{ height: 42, fontSize:13, borderRadius: 10, width: 100 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                  <option value="Todos">Ano</option>
                  {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              {hasFilters && <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding: '0 12px', height: 42 }} onClick={clearFilters}>Limpar Filtros</button>}
            </div>

            {turmasFiltradas.length === 0 ? (
              <div className="card" style={{ padding:'50px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
                <div style={{ fontSize:14, fontWeight:600 }}>Sua busca não encontrou turmas correspondentes.</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:16 }}>
                {turmasFiltradas.map(turma => {
                  const color = SEG_COLORS[turma.serie] ?? '#6366f1'
                  // Count total accurate alunos mapping
                  const totalAl = (alunos || []).filter(a => matchAlunoTurmaAndCursando(a, turma)).length

                  return (
                    <button key={turma.id} onClick={() => { setTurmaSel(turma.id); setBusca(''); setSalvo(false); }}
                      style={{ textAlign:'left', background:'hsl(var(--bg-elevated))', border:`1px solid hsl(var(--border-subtle))`, borderRadius:16, padding:'16px', cursor:'pointer', transition:'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', display:'flex', flexDirection: 'column', width:'100%', position:'relative', overflow:'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}
                      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow=`0 14px 28px ${color}15`; e.currentTarget.style.borderColor = `${color}40` }}
                      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 4px 10px rgba(0,0,0,0.02)'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>
                      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:6, background:`${color}` }} />

                      <div style={{ display:'flex', justifyContent:'space-between', alignItems: 'flex-start', marginBottom: 12, paddingLeft: 6 }}>
                        <div>
                          <div style={{ fontSize:18, fontWeight:900, color: 'hsl(var(--text-primary))', fontFamily:'Outfit,sans-serif', lineHeight: 1.1 }}>{turma.nome}</div>
                          <div style={{ fontSize:10, color:color, fontWeight: 700, marginTop:4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                             {((cfgNiveisEnsino || []).find(n => String(n.id) === String(turma.serie) || String(n.codigo) === String(turma.serie))?.nome || turma.serie)}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', padding: '6px 12px', background: `${color}12`, borderRadius: 12 }}>
                          <Users size={16} style={{ color, marginBottom: 4 }} className="block mx-auto" />
                          <div style={{ fontSize:14, fontWeight:900, color }}>{totalAl}</div>
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12, paddingLeft: 6 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-layer))', padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}>
                            <Clock size={12} style={{ color: 'hsl(var(--text-muted))' }} /> {turma.turno} {turma.ano ? `• ${turma.ano}` : ''}
                         </div>
                      </div>

                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingLeft: 6, borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 16, marginTop: 'auto', width: '100%' }}>
                        <span style={{ fontSize: 12, color:'hsl(var(--text-muted))', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                           <GraduationCap size={14} /> {turma.professor || 'Prof. Indefinido'}
                        </span>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'hsl(var(--bg-layer))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ChevronRight size={16} style={{ color: 'hsl(var(--text-secondary))' }} />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ----------------------------------------------------
  // Render: VISTA INTERNA (Listagem de Chamada Sequencial)
  // ----------------------------------------------------
  const cColor = SEG_COLORS[currentTurma?.serie || ''] || '#6366f1'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 80 }}>
      {/* Header Listagem */}
      <div style={{ display:'flex', alignItems:'center', justifyContent: 'space-between', background: 'hsl(var(--bg-elevated))', padding: '20px 24px', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', marginBottom: 20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:18 }}>
          <button className="btn btn-secondary btn-icon" style={{ borderRadius: '50%' }} onClick={() => { setTurmaSel(null); setBusca('') }}><ArrowLeft size={16} /></button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Lista de Chamada</h1>
              <span style={{ padding:'3px 12px', borderRadius:20, background:`${cColor}15`, color: cColor, fontSize:11, fontWeight:800 }}>{currentTurma?.nome}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--text-muted))' }}>{alunosDaTurma.length} Alunos na Sala • Geração Numérica Sequencial Ativa</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <button className="btn btn-secondary btn-sm" onClick={ordenarComAviso}>
            <ArrowUpDown size={14} /> Forçar Ordem A-Z
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer size={14} /></button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Controle da Lista interna */}
        <div style={{ display:'flex', gap:14, padding: '20px', borderBottom: '1px solid hsl(var(--border-subtle))', alignItems: 'center', background: 'linear-gradient(180deg, hsl(var(--bg-elevated)) 0%, hsl(var(--bg-base)) 100%)' }}>
          <div style={{ position:'relative', flex:1, maxWidth: 300 }}>
            <Search size={14} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
            <input className="form-input" style={{ width:'100%', paddingLeft:38, height: 38, borderRadius: 10, fontSize: 13 }} placeholder="Localizar aluno..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <span style={{ fontSize:12, color:'hsl(var(--text-muted))', fontWeight: 600 }}>Listando {filteredEnsal.length} registros</span>

          {/* Botão de Save Flutuante à Direita */}
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn" 
              onClick={handleSalvar} 
              disabled={isSaving}
              style={{ background: salvo ? '#10b981' : '#6366f1', color: '#fff', border: 'none', height: 40, borderRadius: 10, padding: '0 20px', fontWeight: 700, display: 'flex', gap: 8, transition: 'all .3s', boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
              {isSaving ? <Loader2 size={16} className="spin" /> : salvo ? <CheckCircle size={16} /> : <Save size={16} />}
              {isSaving ? 'Gravando...' : salvo ? 'Salvo no BD!' : 'Gravar Numeração'}
            </button>
          </div>
        </div>

        {/* Informação Orgânica */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'rgba(99,102,241,0.03)', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
           <GripVertical size={14} style={{ color: '#6366f1' }} />
           <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
             <strong>Arraste os blocos</strong> para alterar a ordem de formato manual. Novos alunos que entram na turma agora são posicionados <strong>no final da sala de aula automaticamente</strong>.
           </span>
        </div>

        {/* Tabela Interativa de Lista */}
        <div style={{ padding: '16px 20px', minHeight: 400 }}>
          <div style={{ display:'grid', gridTemplateColumns:'24px 80px 1fr 100px', gap:16, padding:'0 16px 12px', borderBottom: '1px solid hsl(var(--border-subtle))', marginBottom: 12 }}>
            <div style={{ width: 24 }}></div>
            <div style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing: 1 }}>CHAMADA</div>
            <div style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing: 1 }}>ALUNO MATRICULADO</div>
            <div style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing: 1, textAlign: 'center' }}>MATRÍCULA</div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
            {filteredEnsal.map((e, displayIdx) => {
              const realIdx = localEnsal.findIndex(x => x.alunoId === e.alunoId)
              const aluno = getAluno(e.alunoId)
              const isDragging = dragIdx === realIdx
              const isDragOver = dragOverIdx === realIdx
              const isEditing = editingChamada === e.alunoId
              if (!aluno) return null

              return (
                <div key={e.alunoId}
                  draggable={!isEditing}
                  onDragStart={() => !isEditing && onDragStart(realIdx)}
                  onDragOver={ev => onDragOver(ev, realIdx)}
                  onDrop={() => onDrop(realIdx)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  style={{ display:'grid', gridTemplateColumns:'24px 80px 1fr 100px', gap:16, padding:'14px 16px', background:'hsl(var(--bg-base))', borderRadius:12, border:`1px solid ${isDragOver ? cColor : 'transparent'}`, alignItems:'center', cursor: isEditing ? 'default' : 'grab', opacity: isDragging ? 0.3 : 1, transition:'all 0.15s', boxShadow: isDragOver ? `0 8px 24px ${cColor}25` : '0 1px 3px rgba(0,0,0,0.02)' }}
                  onMouseEnter={ev => (ev.currentTarget.style.background='hsl(var(--bg-elevated))')}
                  onMouseLeave={ev => { ev.currentTarget.style.background='hsl(var(--bg-base))' }}>
                  
                  <div style={{ color: 'hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', cursor: isEditing ? 'default' : 'grab' }}><GripVertical size={16} /></div>
                  
                  {/* Número de Chamada Editável */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Clique para alterar número de chamada">
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        min={1}
                        max={localEnsal.length}
                        value={editChamadaVal}
                        onChange={ev => setEditChamadaVal(ev.target.value)}
                        onBlur={() => confirmarEdicaoChamada(e.alunoId, editChamadaVal)}
                        onKeyDown={ev => {
                          if (ev.key === 'Enter') confirmarEdicaoChamada(e.alunoId, editChamadaVal)
                          if (ev.key === 'Escape') setEditingChamada(null)
                        }}
                        style={{ width: 56, height: 44, textAlign: 'center', fontSize: 16, fontWeight: 900, fontFamily: 'monospace', borderRadius: '50%', border: `2px solid ${cColor}`, background: `${cColor}12`, color: cColor, outline: 'none', padding: 0 }}
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingChamada(e.alunoId); setEditChamadaVal(String(e.numeroChamada)) }}
                        title="Clique para editar número"
                        style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${cColor}12`, borderRadius: '50%', color: cColor, fontSize: 16, fontWeight: 900, fontFamily: 'monospace', border: `1.5px dashed ${cColor}40`, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={ev => { ev.currentTarget.style.border=`1.5px solid ${cColor}`; ev.currentTarget.style.background=`${cColor}22` }}
                        onMouseLeave={ev => { ev.currentTarget.style.border=`1.5px dashed ${cColor}40`; ev.currentTarget.style.background=`${cColor}12` }}>
                        {String(e.numeroChamada).padStart(2, '0')}
                      </button>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{aluno.nome}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                      {[aluno.turno, aluno.serie].filter(Boolean).join(' • ') || aluno.status || 'Cursando'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', fontSize: 12, color: 'hsl(var(--text-muted))', fontFamily: 'monospace', fontWeight: 600 }}>
                    {aluno.matricula || aluno.id.slice(0,6).toUpperCase()}
                  </div>
                </div>
              )
            })}
            
            {filteredEnsal.length === 0 && (
                <div style={{ padding: '60px 0', textAlign: 'center' }}>
                    <ShieldAlert size={40} style={{ margin: '0 auto 12px', color: 'hsl(var(--border-subtle))' }} />
                    <div style={{ color: 'hsl(var(--text-muted))', fontSize: 14, fontWeight: 600 }}>Nenhum aluno ativo nesta lista de chamada.</div>
                </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
