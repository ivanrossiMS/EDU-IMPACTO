'use client'

import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useData, LancamentoNota, newId, DetalheEsquemaNota, EsquemaNota, FormulaNotas } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { getInitials } from '@/lib/utils'
import { useState, useMemo, useEffect } from 'react'
import { useEnsalamento } from '@/lib/useEnsalamento'
import { Save, Download, BookOpen, ArrowLeft, ChevronRight, CheckCircle, AlertTriangle, Info, Calendar, Search, Filter, Lock, LockOpen, Clock, User, History, ShieldCheck } from 'lucide-react'
import { TIPOS_META, isTipoLancavelManualmente, calcularMediaParcialBimestre, TIPOS_RESULTADO_FINAL, getEscopoPadrao, getCasasVirgula, aplicarArredondamentoGeral } from '@/lib/notasEngine'

const BIMESTRES = ['1º Bim', '2º Bim', '3º Bim', '4º Bim']
const RESULTADO_FINAL_TAB = 'Resultado Final'
const SEG_COLORS: Record<string,string> = { EI:'#10b981', EF1:'#3b82f6', EF2:'#8b5cf6', EM:'#f59e0b', EJA:'#ec4899' }

function mediaColor(m: number | null, formula?: FormulaNotas) { 
  if (m === null) return 'hsl(var(--text-muted))'
  const mediaAprov = formula?.media || 6
  const mediaRec = formula?.mediaAposRecuperacao || mediaAprov - 1
  return m >= mediaAprov ? '#10b981' : m >= mediaRec ? '#f59e0b' : '#ef4444' 
}

function situacaoBadge(m: number | null, formula?: FormulaNotas) {
  if (m === null) return { label:'Aguardando', color:'hsl(var(--text-muted))', bg:'hsl(var(--bg-overlay))' }
  const mediaAprov = formula?.media || 6
  const mediaRec = formula?.mediaAposRecuperacao || mediaAprov - 1

  if (m >= mediaAprov) return { label:'Aprovado', color:'#10b981', bg:'rgba(16,185,129,0.1)' }
  if (m >= mediaRec) return { label:'Recuperação', color:'#f59e0b', bg:'rgba(245,158,11,0.1)' }
  return { label:'Reprovado', color:'#ef4444', bg:'rgba(239,68,68,0.1)' }
}

export default function NotasPage() {
  const { 
    turmas = [], 
    lancamentosNota = [], 
    setLancamentosNota, 
    cfgDisciplinas = [], 
    esquemaNota = [], 
    cfgArredondamentos = [], 
    cfgFormulasNotas = [], 
    cfgSeries = [],
    cfgNiveisEnsino = [],
    logSystemAction 
  } = useData()
  const [alunos] = useSupabaseArray<any>('alunos', [])

  const getSerieNome = (serieIdOrName: string) => {
    if (!serieIdOrName) return ''
    const serieMatch = cfgSeries.find(s => s.id === serieIdOrName || s.codigo === serieIdOrName)
    if (serieMatch) return serieMatch.nome
    const nivelMatch = cfgNiveisEnsino.find(n => n.id === serieIdOrName || n.codigo === serieIdOrName)
    if (nivelMatch) return nivelMatch.nome
    return serieIdOrName
  }

  const [anoLetivoSel, setAnoLetivoSel] = useState<number | null>(null)
  const [turmaSel, setTurmaSel] = useState<string | null>(null)
  const [bimestre, setBimestre] = useState('1º Bim')
  const [disciplina, setDisciplina] = useState('')
  
  // valores: { [alunoId]: { [detalheId]: valorNum | string } }
  const [notas, setNotas] = useState<Record<string, Record<string, string>>>({})
  const [salvo, setSalvo] = useState(false)
  const [travandoConfirm, setTravandoConfirm] = useState(false)
  const [destravandoConfirm, setDestravandoConfirm] = useState(false)

  // Nome do usuário logado — consumido diretamente do AppContext (React state)
  const { currentUser } = useApp()
  const usuarioAtual = currentUser?.nome || 'Usuário'

  function fmtDataHora(iso?: string): string {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  // Filtros da home (Dashboard)
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [filtroTurno, setFiltroTurno] = useState('Todos')
  const [filtroBusca, setFiltroBusca] = useState('')

  const anosDisponiveis = useMemo(() => {
    const anos = turmas.map(t => t.ano).filter(Boolean)
    return [...new Set(anos)].sort((a,b) => b - a)
  }, [turmas])

  const turmaObj = turmaSel ? turmas.find(t => t.nome === turmaSel) : null
  const turmaId = turmaObj?.id ?? turmaSel ?? ''
  const { getNumeroChamada, ordenarPorChamada, formatarNumero } = useEnsalamento(turmaObj)

  // Alunos ordenados pelo número de chamada (ensalamento) ou A-Z como fallback
  const alunosDaTurma = useMemo(() => {
    const lista = turmaSel ? (alunos || []).filter((a: any) => a.turma === turmaSel) : []
    return ordenarPorChamada(lista)
  }, [alunos, turmaSel, ordenarPorChamada])

  const disciplinas = useMemo(() => {
    if (!turmaObj) return []
    const extra = turmaObj as any
    if (extra?.disciplinas?.length > 0) return (extra.disciplinas as any[]).map(d => d.nome ?? d) as string[]
    if (cfgDisciplinas?.length) {
      return cfgDisciplinas.filter(d => d.situacao === 'ativa' && (!turmaObj.serie || !d.niveisEnsino?.length || d.niveisEnsino.includes(turmaObj.serie))).map(d => d.nome)
    }
    return ['Matemática','Português','História','Ciências','Inglês','Educação Física','Arte','Geografia']
  }, [turmaObj, cfgDisciplinas])

  const discEfetiva = disciplinas.includes(disciplina) ? disciplina : (disciplinas[0] ?? '')
  const bimIdx = BIMESTRES.indexOf(bimestre) + 1
  
  // Buscar a fórmula ativa baseada na série/nível da turma
  const formulaAtiva = useMemo(() => {
    if (!cfgFormulasNotas?.length) return undefined
    const ativas = cfgFormulasNotas.filter(f => f.situacao === 'Ativo')
    if (ativas.length === 0) return undefined
    if (ativas.length === 1) return ativas[0]
    // Se tiver mais de uma, tenta match com o nível/série da turma
    if (turmaObj?.serie) {
      const match = ativas.find(f => f.nivel?.toLowerCase() === turmaObj.serie?.toLowerCase())
      if (match) return match
    }
    return ativas[0]
  }, [cfgFormulasNotas, turmaObj])
  
  // Buscar o esquema de notas ativo para a turma atual
  const esquemaAtivo = useMemo(() => {
    if (!turmaId) return null
    // Tenta achar um esquema que vincule a turma e a disciplina (se tiver disciplina vinculada)
    const discId = cfgDisciplinas.find(d => d.nome === discEfetiva)?.id
    let e = esquemaNota.find(esq => 
      esq.situacao === 'Ativo' && 
      esq.homologado &&
      esq.turmaIds.includes(turmaId) &&
      (esq.disciplinaIds.length === 0 || (discId && esq.disciplinaIds.includes(discId)))
    )
    // Fallback genérico caso não ache um específico (qualquer esquema homologado ativo com a turma)
    if (!e) e = esquemaNota.find(esq => esq.situacao === 'Ativo' && esq.homologado && esq.turmaIds.includes(turmaId))
    return e || null
  }, [turmaId, discEfetiva, esquemaNota, cfgDisciplinas])

  const isResultadoFinal = bimestre === RESULTADO_FINAL_TAB

  const detalhes = useMemo(() => {
    if (!esquemaAtivo) return []
    const allDetalhes = esquemaAtivo.detalhes.sort((a,b) => a.sequencial - b.sequencial)
    if (isResultadoFinal) {
      // Na aba de resultado final, mostrar apenas detalhes de escopo resultado_final
      // Usa getEscopoPadrao como fallback inteligente (backward compat com itens antigos sem escopoLancamento)
      return allDetalhes.filter(d => (d.escopoLancamento ?? getEscopoPadrao(d.tipoDado)) === 'resultado_final')
    }
    // Nos bimestres, mostrar apenas detalhes de escopo bimestral
    return allDetalhes.filter(d => (d.escopoLancamento ?? getEscopoPadrao(d.tipoDado)) === 'bimestral')
  }, [esquemaAtivo, isResultadoFinal])

  // Para a aba de resultado final, buscamos o lançamento com bimestre = 0
  // Para as abas bimestrais, buscamos com bimestre = 1..4
  const bimIdxEffective = isResultadoFinal ? 0 : bimIdx

  const lancExistente = lancamentosNota.find(l =>
    l.turmaId === turmaId &&
    l.disciplina === discEfetiva &&
    l.bimestre === bimIdxEffective
  )

  // Para a aba Resultado Final: buscar as médias parciais dos 4 bimestres
  // para exibição em colunas read-only (contexto do fechamento)
  const mediasParciais = useMemo(() => {
    if (!isResultadoFinal || !turmaId) return null
    const result: Record<string, Record<number, number | null>> = {}
    // Para cada aluno da turma, busca a mediaParcial por bimestre
    alunosDaTurma.forEach((a: any) => {
      result[a.id] = {}
      ;[1,2,3,4].forEach(bim => {
        const lanc = lancamentosNota.find(l =>
          l.turmaId === turmaId &&
          l.disciplina === discEfetiva &&
          l.bimestre === bim
        )
        const notaAluno = lanc?.notas.find(n => n.alunoId === a.id)
        result[a.id][bim] = notaAluno?.mediaParcial ?? null
      })
    })
    return result
  }, [isResultadoFinal, turmaId, discEfetiva, lancamentosNota, alunosDaTurma])

  // Ao mudar de turma/disc/bimestre, carregar notas existentes
  useEffect(() => {
    if (lancExistente) {
      const state: Record<string, Record<string, string>> = {}
      lancExistente.notas.forEach(n => {
        const strVals: Record<string, string> = {}
        Object.entries(n.valores || {}).forEach(([k, v]) => {
          strVals[k] = v === null ? '' : String(v)
        })
        state[n.alunoId] = strVals
      })
      setNotas(state)
    } else {
      setNotas({})
    }
  }, [lancExistente, turmaId, discEfetiva, bimestre])

  const getNota = (alunoId: string, detalheId: string) => {
    if (notas[alunoId] && notas[alunoId][detalheId] !== undefined) return notas[alunoId][detalheId]
    return ''
  }

  const setNotaStr = (alunoId: string, detalheId: string, value: string) => {
    setNotas(prev => ({
      ...prev,
      [alunoId]: {
        ...(prev[alunoId] || {}),
        [detalheId]: value
      }
    }))
  }

  const calcAlunoMetrics = (alunoId: string) => {
    if (isResultadoFinal) {
      // Na aba de Resultado Final, a coluna "Resultado" exibe a
      // média das médias parciais dos 4 bimestres (Média Final automática)
      const mps = mediasParciais?.[alunoId]
      if (!mps) return { mediaParcial: null, faltas: 0 }
      const valores = [mps[1], mps[2], mps[3], mps[4]].filter(v => v !== null && v !== undefined) as number[]
      if (valores.length === 0) return { mediaParcial: null, faltas: 0 }
      // Média das parciais disponíveis
      const mediaFinalBruta = valores.reduce((a, b) => a + b, 0) / valores.length
      // Aplica o arredondamento configurado na fórmula (igual ao que os bimestres fazem)
      const mediaFinalArredondada = aplicarArredondamentoGeral(mediaFinalBruta, cfgArredondamentos, formulaAtiva, true)
      return { mediaParcial: mediaFinalArredondada, faltas: 0 }
    }
    const alunoVals = notas[alunoId] || {}
    return calcularMediaParcialBimestre(alunoVals, detalhes, cfgArredondamentos, formulaAtiva)
  }

  const handleSalvar = () => {
    const notasArr = alunosDaTurma.map(a => {
      const { mediaParcial, faltas } = calcAlunoMetrics(a.id)
      
      const vFormat: Record<string, number | string | null> = {}
      detalhes.forEach(d => {
        const raw = getNota(a.id, d.id)
        if (raw === '') {
          vFormat[d.id] = null
        } else {
          const meta = TIPOS_META[d.tipoDado]
          if (meta.categoria === 'conceitual') {
            vFormat[d.id] = raw
          } else {
            vFormat[d.id] = parseFloat(raw) || 0
          }
        }
      })

      return { 
        alunoId: a.id, 
        valores: vFormat, 
        mediaParcial, 
        faltas,
        situacao: situacaoBadge(mediaParcial).label 
      }
    })

    const agora = new Date().toISOString()
    const novaEntradaHistorico = { acao: 'salvo' as const, por: usuarioAtual, em: agora }

    setLancamentosNota(prev => {
      if (lancExistente) {
        return prev.map(l => l.id === lancExistente.id ? {
          ...l,
          esquemaId: esquemaAtivo?.id,
          notas: notasArr,
          // Se criadoPor era placeholder genérico ou vazio, corrige com o usuário real
          criadoPor: (!l.criadoPor || l.criadoPor === 'Usuário') ? usuarioAtual : l.criadoPor,
          ultimoSalvoPor: usuarioAtual,
          ultimoSalvoEm: agora,
          historico: [...(l.historico || []), novaEntradaHistorico].slice(-20)
        } : l)
      }
      return [...prev, { 
        id: newId('LN'), 
        turmaId, 
        disciplina: discEfetiva, 
        bimestre: bimIdxEffective, 
        esquemaId: esquemaAtivo?.id,
        notas: notasArr, 
        criadoPor: usuarioAtual, 
        createdAt: agora,
        ultimoSalvoPor: usuarioAtual,
        ultimoSalvoEm: agora,
        historico: [novaEntradaHistorico]
      }]
    })

    logSystemAction(
      'Acadêmico (Notas)', 
      lancExistente ? 'Edição' : 'Cadastro', 
      `${lancExistente ? 'Atualização' : 'Lançamento'} de notas: ${discEfetiva} / ${isResultadoFinal ? 'Resultado Final' : `Bim. ${bimIdxEffective}`} / Turma: ${turmaObj?.nome || turmaId}`, 
      { registroId: turmaId, detalhesDepois: { disciplina: discEfetiva, bimestre: bimIdxEffective, turmaId } }
    )
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  const handleTravar = () => {
    if (!lancExistente || travandoConfirm === false) { setTravandoConfirm(true); return }
    const agora = new Date().toISOString()
    setLancamentosNota(prev => prev.map(l => l.id === lancExistente.id ? {
      ...l,
      travado: true,
      travadoPor: usuarioAtual,
      travadoEm: agora,
      historico: [...(l.historico || []), { acao: 'travado' as const, por: usuarioAtual, em: agora, obs: 'Planilha finalizada e travada para entrega' }].slice(-20)
    } : l))
    setTravandoConfirm(false)
    logSystemAction('Acadêmico (Notas)', 'Travamento', `Planilha travada: ${discEfetiva} / ${isResultadoFinal ? 'RF' : `Bim. ${bimIdxEffective}`} / Turma: ${turmaObj?.nome}`, { registroId: lancExistente.id })
  }

  const handleDestravar = () => {
    if (!lancExistente || destravandoConfirm === false) { setDestravandoConfirm(true); return }
    const agora = new Date().toISOString()
    setLancamentosNota(prev => prev.map(l => l.id === lancExistente.id ? {
      ...l,
      travado: false,
      historico: [...(l.historico || []), { acao: 'destravado' as const, por: usuarioAtual, em: agora, obs: 'Planilha reaberta para edição' }].slice(-20)
    } : l))
    setDestravandoConfirm(false)
    logSystemAction('Acadêmico (Notas)', 'Destravamento', `Planilha destravada: ${discEfetiva} / ${isResultadoFinal ? 'RF' : `Bim. ${bimIdxEffective}`} / Turma: ${turmaObj?.nome}`, { registroId: lancExistente.id })
  }

  // ── VISTA 0: Seleção do Ano Letivo ─────────────────────────────────────────
  if (anoLetivoSel === null) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70vh' }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 10px 30px rgba(59,130,246,0.3)' }}>
          <Calendar size={40} />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 10, fontFamily: 'Outfit,sans-serif' }}>Selecione o Ano Letivo</h1>
        <p style={{ color: 'hsl(var(--text-muted))', marginBottom: 40, fontSize: 16 }}>Escolha o período para realizar o lançamento de notas.</p>
        
        {anosDisponiveis.length === 0 ? (
          <div style={{ padding: '20px 40px', background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
            Nenhum ano letivo configurado nas turmas.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {anosDisponiveis.map(ano => {
              const turmasDoAno = turmas.filter(t => t.ano === ano)
              return (
                <button key={ano} onClick={() => setAnoLetivoSel(ano)} style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: '24px 40px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 200 }} onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.borderColor='#3b82f6'; e.currentTarget.style.boxShadow='0 12px 24px rgba(59,130,246,0.1)' }} onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.borderColor='hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow='' }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#3b82f6', fontFamily: 'Outfit,sans-serif' }}>{ano}</div>
                  <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{turmasDoAno.length} turmas</div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── VISTA 1: HOME (Turmas do Ano Selecionado) ──────────────────────────────
  if (!turmaSel) {
    const turmasDoAno = turmas.filter(t => t.ano === anoLetivoSel)
    const alunosDoAno = (alunos || []).filter((a: any) => turmasDoAno.some(t => t.nome === a.turma))
    const lancsDoAno = lancamentosNota.filter(l => turmasDoAno.some(t => t.id === l.turmaId))
    
    const turmasComLanc = [...new Set(lancsDoAno.map(l => l.turmaId))].length
    const bimestresComLanc = [...new Set(lancsDoAno.map(l => l.bimestre))].length

    const safeCfgDisciplinas = cfgDisciplinas || []

    const mediasPorBim = BIMESTRES.map((b, i) => {
      const lancsB = lancsDoAno.filter(l => l.bimestre === i + 1)
      if (!lancsB.length) return { bim: b, media: null, alunos: 0 }
      const todasNotas = lancsB.flatMap(l => l.notas.map(n => n.mediaParcial).filter(m => m !== null) as number[])
      const media = todasNotas.length ? todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length : null
      return { bim: b, media: media ? +media.toFixed(1) : null, alunos: todasNotas.length }
    })

    const turmaStats = turmasDoAno.map(t => {
      const lancs = lancsDoAno.filter(l => l.turmaId === t.id)
      if (!lancs.length) return { turma: t, media: null, aprovados: null, reprovados: null, pctLancado: 0 }
      const medias = lancs.flatMap(l => l.notas.map(n => n.mediaParcial).filter(m => m !== null) as number[])
      const media = medias.length ? medias.reduce((a, b) => a + b, 0) / medias.length : null
      const aprovados = medias.filter(m => m >= 6).length
      const reprovados = medias.filter(m => m < 5).length
      const discsEsperadas = safeCfgDisciplinas.filter(d => d.situacao === 'ativa').length || 8
      const pctLancado = Math.round((lancs.length / (discsEsperadas * 4)) * 100)
      return { turma: t, media: media ? +media.toFixed(1) : null, aprovados, reprovados, pctLancado }
    }).filter(s => s.media !== null).sort((a, b) => (a.media ?? 10) - (b.media ?? 10))

    const turmasCriticas = turmaStats.filter(s => s.media !== null && s.media < 6)
    const turmasDestaque = turmaStats.filter(s => s.media !== null && s.media >= 8).slice(-3).reverse()

    const segsDisp = [...new Set(turmasDoAno.map(t => t.serie).filter(Boolean))].sort()
    const turnosDisp = [...new Set(turmasDoAno.map(t => t.turno).filter(Boolean))]

    const turmasFiltradas = turmasDoAno.filter(t => {
      const mb = !filtroBusca || t.nome.toLowerCase().includes(filtroBusca.toLowerCase())
      const ms = filtroSeg === 'todos' || t.serie === filtroSeg
      const mtu = filtroTurno === 'Todos' || t.turno === filtroTurno
      return mb && ms && mtu
    })

    const clearF = () => { setFiltroBusca(''); setFiltroSeg('todos'); setFiltroTurno('Todos') }
    const hasF = !!(filtroBusca || filtroSeg !== 'todos' || filtroTurno !== 'Todos')

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => setAnoLetivoSel(null)} title="Trocar Ano Letivo">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 className="page-title" style={{ marginBottom: 0 }}>Lançamento de Notas</h1>
                <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 13, fontWeight: 800, fontFamily: 'Outfit,sans-serif' }}>{anoLetivoSel}</span>
              </div>
              <p className="page-subtitle">Gestão de notas e acompanhamento de desempenho acadêmico</p>
            </div>
          </div>
        </div>

        {/* KPIs Contextuais */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14, marginBottom:24 }}>
          {[
            { label:'Turmas do Ano', value: turmasDoAno.length, sub: `${turmasComLanc} turmas com lançamentos`, color:'#3b82f6', icon:'🏫' },
            { label:'Alunos Ativos', value: alunosDoAno.length, sub: `Matriculados em ${anoLetivoSel}`, color:'#8b5cf6', icon:'👨‍🎓' },
            { label:'Lançamentos Registrados', value: lancsDoAno.length, sub: `${bimestresComLanc} bimestre(s) movimentados`, color:'#10b981', icon:'📝' },
            { label:'Atenção Pedagógica', value: turmasCriticas.length, sub: 'Turmas com média geral < 6,0', color: turmasCriticas.length > 0 ? '#ef4444' : '#6b7280', icon: turmasCriticas.length > 0 ? '⚠️' : '✅' },
          ].map((c, i) => (
            <div key={i} style={{ padding:'20px', background:'hsl(var(--bg-elevated))', borderRadius:16, border:`1px solid ${c.color}20`, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:c.color }} />
              <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:10 }}>
                <span style={{ fontSize:24 }}>{c.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'hsl(var(--text-muted))', fontWeight:700, marginBottom:4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
                  <div style={{ fontSize:32, fontWeight:900, color:c.color, fontFamily:'Outfit,sans-serif', lineHeight:1 }}>{c.value}</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:'hsl(var(--text-muted))', paddingTop:8, borderTop:'1px solid hsl(var(--border-subtle))' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Barra de Filtros */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center', padding:'12px 16px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(10px)' }}>
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }} />
            <input className="form-input" style={{ paddingLeft:34, fontSize:13, borderRadius: 8, height: 38 }} placeholder="Buscar turma por nome..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Filter size={14} style={{ color: 'hsl(var(--text-muted))', marginLeft: 8 }} />
            <select className="form-input" style={{ width: 140, fontSize: 13, borderRadius: 8, height: 38 }} value={filtroSeg} onChange={e => setFiltroSeg(e.target.value)}>
              <option value="todos">Todos os Segmentos</option>
              {segsDisp.map(s => <option key={s} value={s}>{getSerieNome(s)}</option>)}
            </select>
            <select className="form-input" style={{ width: 140, fontSize: 13, borderRadius: 8, height: 38 }} value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
              <option value="Todos">Todos os Turnos</option>
              {turnosDisp.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {hasF && <button className="btn btn-ghost btn-sm" style={{ fontSize:12, height: 38 }} onClick={clearF}>✕ Limpar</button>}
          </div>
          <span style={{ marginLeft:'auto', fontSize:12, color:'hsl(var(--text-muted))', fontWeight: 600 }}>{turmasFiltradas.length} turmas listadas</span>
        </div>

        {/* Grid de turmas */}
        {turmasDoAno.length === 0 ? (
          <div className="card" style={{ padding:'60px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <BookOpen size={48} style={{ margin:'0 auto 16px', opacity:0.15 }} />
            <div style={{ fontSize:16, fontWeight:700, marginBottom: 8 }}>Nenhuma turma encontrada para {anoLetivoSel}</div>
            <p style={{ fontSize: 14 }}>Cadastre turmas em Configurações &gt; Turmas e vincule-as a este ano letivo.</p>
          </div>
        ) : turmasFiltradas.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhuma turma corresponde aos filtros aplicados.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px,1fr))', gap:16 }}>
            {turmasFiltradas.map(turma => {
              const cardColor = SEG_COLORS[turma.serie] ?? '#3b82f6'
              const alunosTurma = alunosDoAno.filter((a: any) => a.turma === turma.nome)
              const lancs = lancsDoAno.filter(l => l.turmaId === turma.id)
              const discsLancadas = [...new Set(lancs.map(l => l.disciplina))].length
              const extra = turma as any
              const totalDiscs = extra?.disciplinas?.length || cfgDisciplinas?.filter((d: any) => d.situacao === 'ativa' && (!turma.serie || !d.niveisEnsino?.length || d.niveisEnsino.includes(turma.serie))).length || 8
              const pct = totalDiscs > 0 ? Math.min(100, Math.round((discsLancadas / (totalDiscs * 4)) * 100)) : 0
              const stat = turmaStats.find(s => s.turma.id === turma.id)
              const mediaGeral = stat?.media

              // Status de travamento por bimestre/resultado
              type EstadoSlot = 'vazio' | 'aberto' | 'travado'
              const SLOTS: { label: string; idx: number }[] = [
                { label: '1º Bim', idx: 1 }, { label: '2º Bim', idx: 2 },
                { label: '3º Bim', idx: 3 }, { label: '4º Bim', idx: 4 },
                { label: 'Result.', idx: 0 },
              ]
              const slotStats: (typeof SLOTS[0] & { estado: EstadoSlot })[] = SLOTS.map(slot => {
                const bimLancs = lancs.filter(l => l.bimestre === slot.idx)
                if (bimLancs.length === 0) return { ...slot, estado: 'vazio' }
                const allLocked = bimLancs.every(l => !!(l as any).travado)
                return { ...slot, estado: allLocked ? 'travado' : 'aberto' }
              })
              const travCount = slotStats.filter(s => s.estado === 'travado').length
              const abertCount = slotStats.filter(s => s.estado === 'aberto').length
              const withData   = travCount + abertCount

              return (
                <button key={turma.id} onClick={() => { setTurmaSel(turma.nome); setDisciplina(''); setNotas({}) }}
                  style={{ textAlign:'left', background:'hsl(var(--bg-elevated))', border:`1px solid hsl(var(--border-subtle))`, borderRadius:16, padding:'24px', cursor:'pointer', transition:'all 0.2s', display:'flex', flexDirection:'column', gap:14, width:'100%', position:'relative', overflow:'hidden' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.borderColor=`${cardColor}60`; e.currentTarget.style.boxShadow=`0 12px 32px ${cardColor}15` }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.borderColor='hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow='' }}>

                  <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:`linear-gradient(to right, ${cardColor}, ${cardColor}80)` }} />

                  {/* Identidade + Média */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:800, color:cardColor, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{getSerieNome(turma.serie)}</div>
                      <div style={{ fontSize:22, fontWeight:900, color:'hsl(var(--text-primary))', fontFamily:'Outfit,sans-serif', lineHeight:1.1 }}>{turma.nome}</div>
                      <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginTop:6, display:'flex', gap:8, alignItems:'center' }}>
                        <span>{turma.turno}</span><span>•</span><span>{alunosTurma.length} alunos</span>
                      </div>
                    </div>
                    {mediaGeral != null && (
                      <div style={{ textAlign:'right', background: mediaGeral >= 6 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding:'8px 12px', borderRadius:12 }}>
                        <div style={{ fontSize:24, fontWeight:900, color: mediaGeral >= 6 ? '#10b981' : '#ef4444', fontFamily:'Outfit,sans-serif', lineHeight:1 }}>{mediaGeral}</div>
                        <div style={{ fontSize:9, fontWeight:700, color: mediaGeral >= 6 ? '#10b981' : '#ef4444', textTransform:'uppercase', marginTop:2 }}>Média Geral</div>
                      </div>
                    )}
                  </div>

                  {/* ── Status de Travamento por Período ─────────────────── */}
                  <div style={{ padding:'10px 12px', borderRadius:12, background:'hsl(var(--bg-overlay))', border:'1px solid hsl(var(--border-subtle))' }}>
                    {/* Cabeçalho da seção */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                        Períodos
                      </span>
                      {withData === 0 && (
                        <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:'hsl(var(--bg-elevated))', color:'hsl(var(--text-muted))', fontWeight:700 }}>
                          Sem lançamentos
                        </span>
                      )}
                      {withData > 0 && travCount === 5 && (
                        <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', color:'#10b981', fontWeight:800, display:'inline-flex', alignItems:'center', gap:3 }}>
                          🔒 Todos travados
                        </span>
                      )}
                      {withData > 0 && travCount > 0 && travCount < 5 && (
                        <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', color:'#f59e0b', fontWeight:800, display:'inline-flex', alignItems:'center', gap:3 }}>
                          🔒 {travCount}/{withData} travados
                        </span>
                      )}
                      {withData > 0 && travCount === 0 && (
                        <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', color:'#6366f1', fontWeight:800 }}>
                          ✏️ Em edição
                        </span>
                      )}
                    </div>

                    {/* Pills por período */}
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {slotStats.map(slot => {
                        const cfg =
                          slot.estado === 'travado' ? { bg:'rgba(16,185,129,0.14)', color:'#10b981', border:'rgba(16,185,129,0.35)', icon:'🔒' } :
                          slot.estado === 'aberto'  ? { bg:'rgba(99,102,241,0.1)',  color:'#6366f1', border:'rgba(99,102,241,0.3)',  icon:'✏️' } :
                                                      { bg:'transparent', color:'hsl(var(--text-muted))', border:'hsl(var(--border-subtle))', icon:'○' }
                        return (
                          <span key={slot.idx} title={slot.estado === 'travado' ? `${slot.label}: Travado` : slot.estado === 'aberto' ? `${slot.label}: Aberto para edição` : `${slot.label}: Sem lançamento`}
                            style={{ fontSize:10, padding:'4px 8px', borderRadius:7, fontWeight:800,
                              background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`,
                              display:'inline-flex', alignItems:'center', gap:3,
                              opacity: slot.estado === 'vazio' ? 0.45 : 1, transition:'opacity 0.2s' }}>
                            <span style={{ fontSize:8 }}>{cfg.icon}</span>
                            {slot.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div style={{ borderTop:'1px solid hsl(var(--border-subtle))', paddingTop:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:600, color:'hsl(var(--text-muted))', marginBottom:6 }}>
                      <span>Progresso de Lançamentos</span>
                      <span style={{ color: pct === 100 ? '#10b981' : 'hsl(var(--text-primary))' }}>{pct}%</span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:'hsl(var(--bg-overlay))', overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background: pct===100?'#10b981':cardColor, borderRadius:3, transition:'width 1s ease-out' }} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Derivar estado de travamento do lançamento atual ──────────────────────
  const isTravado = !!lancExistente?.travado
  const color = SEG_COLORS[turmaObj?.serie ?? ''] ?? '#3b82f6'

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => { setTurmaSel(null); setNotas({}); setTravandoConfirm(false); setDestravandoConfirm(false) }}><ArrowLeft size={18} /></button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 className="page-title" style={{ marginBottom:0 }}>Planilha de Lançamento</h1>
              <span style={{ padding:'4px 10px', borderRadius:20, background:`${color}15`, color, fontSize:12, fontWeight:800 }}>{turmaSel}</span>
              {isTravado && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:20, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:11, fontWeight:800 }}>
                  <Lock size={11} /> TRAVADO
                </span>
              )}
            </div>
            <p className="page-subtitle">{alunosDaTurma.length} alunos matriculados • Ano Letivo {anoLetivoSel}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button className="btn btn-secondary btn-sm" title="Exportar Planilha"><Download size={14} />Exportar</button>

          {/* ── Botão Travar / Destravar ────────────────────────────────── */}
          {lancExistente && !isTravado && (
            travandoConfirm ? (
              <div style={{ display:'flex', gap:6, alignItems:'center', padding:'6px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10 }}>
                <span style={{ fontSize:12, color:'#ef4444', fontWeight:700 }}>Confirmar travamento?</span>
                <button onClick={handleTravar} style={{ padding:'4px 14px', borderRadius:8, background:'#ef4444', color:'#fff', border:'none', fontWeight:800, fontSize:12, cursor:'pointer' }}>Sim, Travar</button>
                <button onClick={() => setTravandoConfirm(false)} style={{ padding:'4px 12px', borderRadius:8, background:'hsl(var(--bg-overlay))', color:'hsl(var(--text-secondary))', border:'1px solid hsl(var(--border-subtle))', fontWeight:700, fontSize:12, cursor:'pointer' }}>Cancelar</button>
              </div>
            ) : (
              <button onClick={handleTravar} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'0 18px', height:38, borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', fontWeight:800, fontSize:13, cursor:'pointer', transition:'all 0.2s' }}
                title="Travar planilha — impede edições futuras e sinaliza que as notas estão prontas para entrega"
                onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.16)'; e.currentTarget.style.borderColor='rgba(239,68,68,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor='rgba(239,68,68,0.25)' }}>
                <Lock size={14} /> Travar Planilha
              </button>
            )
          )}
          {isTravado && (
            destravandoConfirm ? (
              <div style={{ display:'flex', gap:6, alignItems:'center', padding:'6px 12px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10 }}>
                <span style={{ fontSize:12, color:'#f59e0b', fontWeight:700 }}>Reabrir para edição?</span>
                <button onClick={handleDestravar} style={{ padding:'4px 14px', borderRadius:8, background:'#f59e0b', color:'#fff', border:'none', fontWeight:800, fontSize:12, cursor:'pointer' }}>Sim, Reabrir</button>
                <button onClick={() => setDestravandoConfirm(false)} style={{ padding:'4px 12px', borderRadius:8, background:'hsl(var(--bg-overlay))', color:'hsl(var(--text-secondary))', border:'1px solid hsl(var(--border-subtle))', fontWeight:700, fontSize:12, cursor:'pointer' }}>Cancelar</button>
              </div>
            ) : (
              <button onClick={handleDestravar} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'0 18px', height:38, borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', color:'#f59e0b', fontWeight:800, fontSize:13, cursor:'pointer', transition:'all 0.2s' }}
                title="Reabrir planilha para edição"
                onMouseEnter={e => { e.currentTarget.style.background='rgba(245,158,11,0.16)'; e.currentTarget.style.borderColor='rgba(245,158,11,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(245,158,11,0.08)'; e.currentTarget.style.borderColor='rgba(245,158,11,0.25)' }}>
                <LockOpen size={14} /> Reabrir
              </button>
            )
          )}

          {/* ── Botão Salvar (oculto se travado) ───────────────────────── */}
          {!isTravado && (
            <button className="btn btn-primary btn-sm" onClick={handleSalvar} disabled={!discEfetiva || alunosDaTurma.length === 0 || !esquemaAtivo} style={{ padding: '0 20px', height: 38, fontSize: 13, background: salvo ? '#10b981' : undefined, color: salvo ? '#fff' : undefined, borderColor: salvo ? '#10b981' : undefined }}>
              {salvo ? <><CheckCircle size={14} />Salvo com sucesso!</> : <><Save size={14} />Salvar Notas</>}
            </button>
          )}
        </div>
      </div>

      {/* ── BARRA DE AUDITORIA ─────────────────────────────────────────────── */}
      {lancExistente && (
        <div style={{ marginBottom: 16, padding:'12px 20px', borderRadius:14, border:`1px solid ${isTravado ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.2)'}`, background: isTravado ? 'rgba(239,68,68,0.04)' : 'rgba(99,102,241,0.04)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap', flexShrink:0 }}>
          
          {/* Status principal */}
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {isTravado
                ? <div style={{ width:32, height:32, borderRadius:10, background:'rgba(239,68,68,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}><Lock size={15} color="#ef4444" /></div>
                : <div style={{ width:32, height:32, borderRadius:10, background:'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}><ShieldCheck size={15} color="#10b981" /></div>
              }
              <div>
                <div style={{ fontSize:11, fontWeight:800, color: isTravado ? '#ef4444' : '#10b981', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  {isTravado ? '🔒 Planilha Travada' : '✏️ Aberta para Edição'}
                </div>
                {isTravado && lancExistente.travadoPor && (
                  <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:1 }}>
                    Travada por <strong>{lancExistente.travadoPor}</strong> em {fmtDataHora(lancExistente.travadoEm)}
                  </div>
                )}
              </div>
            </div>

            <div style={{ width:1, height:28, background:'hsl(var(--border-subtle))' }} />

            {/* Último salvamento */}
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <Clock size={13} style={{ color:'hsl(var(--text-muted))', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:10, color:'hsl(var(--text-muted))', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em' }}>Último salvamento</div>
                <div style={{ fontSize:12, fontWeight:700, color:'hsl(var(--text-primary))', marginTop:1 }}>
                  {lancExistente.ultimoSalvoPor && lancExistente.ultimoSalvoPor !== 'Usuário'
                    ? <><span style={{ color:'#6366f1' }}>{lancExistente.ultimoSalvoPor}</span> · {fmtDataHora(lancExistente.ultimoSalvoEm)}</>
                    : lancExistente.createdAt
                      ? <span style={{ color:'hsl(var(--text-muted))' }}>Registrado em {fmtDataHora(lancExistente.createdAt)}</span>
                      : <span style={{ color:'hsl(var(--text-muted))' }}>Sem registro de salvamento</span>
                  }
                </div>
              </div>
            </div>

            {/* Criado por — exibe apenas se o valor for um nome real */}
            {lancExistente.criadoPor && lancExistente.criadoPor !== 'Usuário' && (
              <>
                <div style={{ width:1, height:28, background:'hsl(var(--border-subtle))' }} />
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <User size={13} style={{ color:'hsl(var(--text-muted))', flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em' }}>Criado por</div>
                    <div style={{ fontSize:12, fontWeight:700, color:'hsl(var(--text-primary))', marginTop:1 }}>{lancExistente.criadoPor}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Histórico compacto (últimas 3 ações) */}
          {(lancExistente.historico?.length ?? 0) > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <History size={12} style={{ color:'hsl(var(--text-muted))' }} />
              {[...(lancExistente.historico || [])].reverse().slice(0,3).map((h, i) => (
                <span key={i} style={{ fontSize:10, padding:'3px 9px', borderRadius:20, fontWeight:700,
                  background: h.acao==='travado' ? 'rgba(239,68,68,0.1)' : h.acao==='destravado' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.08)',
                  color: h.acao==='travado' ? '#ef4444' : h.acao==='destravado' ? '#f59e0b' : '#6366f1',
                  border: `1px solid ${h.acao==='travado' ? 'rgba(239,68,68,0.2)' : h.acao==='destravado' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.15)'}`,
                  display:'inline-flex', alignItems:'center', gap:4
                }}>
                  {h.acao==='salvo' ? '💾' : h.acao==='travado' ? '🔒' : '🔓'}
                  {h.por} · {fmtDataHora(h.em)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barra de Seletores (Filtros de Contexto da Planilha) */}
      <div style={{ display:'flex', gap:16, marginBottom:20, padding:'12px 20px', background:'hsl(var(--bg-elevated))', borderRadius:16, border:'1px solid hsl(var(--border-subtle))', alignItems:'center', flexWrap:'wrap', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Período</div>
          <div className="tab-list" style={{ padding:'4px', background: 'hsl(var(--bg-overlay))', borderRadius: 10, display: 'flex', gap: 2 }}>
            {BIMESTRES.map(b => (
              <button key={b} className={`tab-trigger ${bimestre===b?'active':''}`} onClick={() => { setBimestre(b); setNotas({}) }} style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8 }}>{b}</button>
            ))}
            <div style={{ width: 1, background: 'hsl(var(--border-subtle))', margin: '4px 4px' }} />
            <button
              className={`tab-trigger ${isResultadoFinal?'active':''}`}
              onClick={() => { setBimestre(RESULTADO_FINAL_TAB); setNotas({}) }}
              style={{
                fontSize: 12, fontWeight: 800, padding: '6px 14px', borderRadius: 8,
                background: isResultadoFinal ? '#10b981' : undefined,
                color: isResultadoFinal ? '#fff' : '#10b981',
                border: isResultadoFinal ? 'none' : '1px dashed #10b981',
              }}
            >
              🏁 Resultado Final
            </button>
          </div>
        </div>

        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
            Disciplina <span style={{ color }}>{disciplinas.length > 0 ? `(${disciplinas.length} disponíveis)` : ''}</span>
          </div>
          {disciplinas.length > 0 ? (
            <div style={{ position: 'relative', maxWidth: '350px' }}>
              <select
                style={{
                  width: '100%',
                  appearance: 'none',
                  padding: '10px 16px',
                  paddingRight: '40px',
                  borderRadius: '10px',
                  border: `1px solid ${color}40`,
                  background: 'var(--bg-app)',
                  color: 'hsl(var(--text-primary))',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxShadow: `0 2px 8px ${color}10`
                }}
                value={discEfetiva}
                onChange={e => {
                  setDisciplina(e.target.value);
                  setNotas({});
                }}
                onFocus={e => e.currentTarget.style.borderColor = color}
                onBlur={e => e.currentTarget.style.borderColor = `${color}40`}
              >
                {disciplinas.map(d => {
                  const temLanc = lancamentosNota.some(l => l.turmaId === turmaId && l.disciplina === d && l.bimestre === bimIdx)
                  return (
                    <option key={d} value={d}>
                      {temLanc ? '✓ ' : ''}{d}
                    </option>
                  )
                })}
              </select>
              <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: color, display: 'flex', alignItems: 'center' }}>
                <ChevronRight size={16} style={{ transform: 'rotate(90deg)' }} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize:12, color:'#f59e0b', display:'flex', alignItems:'center', gap:8, padding: '8px 0' }}>
              <AlertTriangle size={14} />Nenhuma disciplina configurada para esta turma.
            </div>
          )}
        </div>
        
        {lancExistente && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(16,185,129,0.1)', borderRadius: 10, color: '#10b981', fontSize: 12, fontWeight: 700 }}>
            <CheckCircle size={14} /> Notas já registradas neste bimestre
          </div>
        )}
      </div>

      {/* Planilha */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
        {!discEfetiva ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
            <BookOpen size={48} style={{ opacity:0.15, marginBottom: 16 }} />
            <div style={{ fontSize:14, fontWeight: 600 }}>Selecione uma disciplina para abrir a planilha.</div>
          </div>
        ) : alunosDaTurma.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>Nenhum aluno matriculado nesta turma.</div>
        ) : !esquemaAtivo ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ef4444', background: 'rgba(239,68,68,0.02)' }}>
            <AlertTriangle size={40} style={{ marginBottom: 16, opacity:0.6 }} />
            <div style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>Esquema de Notas Indisponível</div>
            <div style={{ fontSize:14, color:'hsl(var(--text-muted))', maxWidth:500, textAlign: 'center', lineHeight: 1.5 }}>
              O sistema não encontrou um Esquema de Notas homologado para a turma <strong>{turmaSel}</strong> na disciplina de <strong>{discEfetiva}</strong>. Verifique as configurações.
            </div>
          </div>
        ) : detalhes.length === 0 && !isResultadoFinal ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', background: 'rgba(245,158,11,0.02)' }}>
            <AlertTriangle size={40} style={{ marginBottom: 16, opacity:0.6 }} />
            <div style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>Esquema Sem Componentes Bimestrais</div>
            <div style={{ fontSize:14, color:'hsl(var(--text-muted))', maxWidth:500, textAlign: 'center' }}>
              O esquema "{esquemaAtivo.descricao}" não possui avaliações de escopo bimestral configuradas.
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            {/* Banner informativo no Resultado Final */}
            {isResultadoFinal && (
              <div style={{ padding: '10px 20px', background: 'rgba(16,185,129,0.06)', borderBottom: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#059669', fontWeight: 600 }}>
                <Info size={14} />
                <span>
                  <strong>Resultado Final:</strong> Preencha os campos de fechamento anual abaixo.
                  As médias parciais de cada bimestre são exibidas automaticamente para referência (leitura somente).
                </span>
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 20, background: 'hsl(var(--bg-elevated))', padding: '16px 20px', textAlign: 'left', borderBottom: '2px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-muted))', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11, minWidth: 250 }}>
                    Aluno
                  </th>
                  {/* Colunas de médias parciais: apenas no Resultado Final, read-only */}
                  {isResultadoFinal && [1,2,3,4].map(bim => (
                    <th key={`mp${bim}`} style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(14,165,233,0.06)', padding: '16px 10px', textAlign: 'center', borderBottom: '2px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))', minWidth: 70 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#0ea5e9', whiteSpace: 'nowrap' }}>{bim}º Bim</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', marginTop: 2 }}>MP • Leitura</div>
                    </th>
                  ))}
                  {/* Colunas dos detalhes do escopo ativo */}
                  {detalhes.map(d => (
                    <th key={d.id} style={{ position: 'sticky', top: 0, zIndex: 10, background: 'hsl(var(--bg-elevated))', padding: '16px 12px', textAlign: 'center', borderBottom: '2px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap' }}>{d.nomeAvaliacao}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: TIPOS_META[d.tipoDado]?.cor || 'hsl(var(--text-muted))', textTransform: 'uppercase', marginTop: 4, opacity: 0.8 }}>
                        {TIPOS_META[d.tipoDado]?.icone} {TIPOS_META[d.tipoDado]?.categoria} • P:{d.peso}
                      </div>
                    </th>
                  ))}
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'hsl(var(--bg-elevated))', padding: '16px 12px', textAlign: 'center', borderBottom: '2px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                    {isResultadoFinal ? 'Resultado' : 'Média Parcial'}
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'hsl(var(--bg-elevated))', padding: '16px 20px', textAlign: 'center', borderBottom: '2px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody>
                {alunosDaTurma.map((aluno, idx) => {
                  const metrics = calcAlunoMetrics(aluno.id)
                  const hasNotas = metrics.mediaParcial !== null
                  const sit = situacaoBadge(metrics.mediaParcial, formulaAtiva)
                  const mColor = mediaColor(metrics.mediaParcial, formulaAtiva)

                  return (
                    <tr key={aluno.id} style={{ transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-overlay))'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {/* Aluno Pinned Column */}
                      <td style={{ position: 'sticky', left: 0, zIndex: 5, background: 'inherit', borderBottom: '1px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))', padding: '12px 20px' }}>
                        {/* Background filler for sticky column to avoid transparent overlap issues */}
                        <div style={{ position: 'absolute', inset: 0, background: 'hsl(var(--bg-elevated))', zIndex: -1 }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'inherit', zIndex: -1 }} />
                        
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ width:36, height:36, borderRadius:12, background:`${color}15`, color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0 }}>
                            {getInitials(aluno.nome)}
                          </div>
                          <div>
                            <div style={{ fontSize:14, fontWeight:700, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap' }}>{aluno.nome}</div>
                            <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop: 2 }}>Nº <strong>{formatarNumero(aluno.id)}</strong>{aluno.matricula ? ` • Cód: ${aluno.matricula}` : ''}</div>
                          </div>
                        </div>
                      </td>

                      {/* Colunas de Médias Parciais — apenas no Resultado Final, read-only */}
                      {isResultadoFinal && [1,2,3,4].map(bim => {
                        const mp = mediasParciais?.[aluno.id]?.[bim] ?? null
                        const mpColor = mediaColor(mp, formulaAtiva)
                        return (
                          <td key={`mp${bim}`} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))', padding: '8px 8px', textAlign: 'center', background: 'rgba(14,165,233,0.03)' }}>
                            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: 'Outfit,monospace', color: mp !== null ? mpColor : '#94a3b8' }}>
                              {mp !== null ? mp.toFixed(getCasasVirgula(formulaAtiva)) : '—'}
                            </div>
                          </td>
                        )
                      })}

                      {/* Grade Inputs */}
                      {detalhes.map((d, colIdx) => {
                        const val = getNota(aluno.id, d.id)
                        const isNumber = TIPOS_META[d.tipoDado]?.categoria !== 'conceitual'
                        const meta = TIPOS_META[d.tipoDado]
                        const lancavel = isTipoLancavelManualmente(d.tipoDado) && !isTravado
                        
                        const isAbaixoMedia = isNumber && val !== '' && parseFloat(val) < (meta?.minAprovacao || 6)

                        return (
                          <td key={d.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))', padding: '8px 12px', textAlign: 'center', background: isTravado ? 'rgba(239,68,68,0.02)' : !lancavel ? 'rgba(0,0,0,0.015)' : isAbaixoMedia ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                            <input 
                              type={isNumber ? "number" : "text"} 
                              disabled={!lancavel}
                              min={isNumber ? (d.valorMin >= 0 ? d.valorMin : 0) : undefined} 
                              max={isNumber ? d.valorMax : undefined} 
                              step={isNumber ? (meta?.categoria === 'frequencia' ? 1 : 0.1) : undefined} 
                              value={val}
                              onChange={e => {
                                if (!lancavel) return
                                let v = e.target.value
                                if (isNumber && v !== '') {
                                  const num = parseFloat(v)
                                  if (num > d.valorMax) v = String(d.valorMax)
                                  if (d.valorMin >= 0 && num < d.valorMin) v = String(d.valorMin)
                                }
                                setNotaStr(aluno.id, d.id, v)
                              }}
                              placeholder={isTravado ? '🔒' : !lancavel ? 'Automático' : '—'}
                              title={isTravado ? 'Planilha travada — sem edição permitida' : `${d.tipoDado} (Máx: ${d.valorMax})`}
                              style={{ 
                                width:'100%', minWidth: 64, maxWidth: 80, padding:'10px 8px', margin: '0 auto', display: 'block',
                                background: isTravado ? 'transparent' : !lancavel ? 'transparent' : 'hsl(var(--bg-overlay))', 
                                border:`1px solid ${isAbaixoMedia && !isTravado ? 'rgba(239,68,68,0.4)' : 'transparent'}`, 
                                borderRadius:8, textAlign:'center', 
                                color: isTravado ? 'hsl(var(--text-muted))' : !lancavel ? 'hsl(var(--text-muted))' : isAbaixoMedia ? '#ef4444' : 'hsl(var(--text-primary))', 
                                fontWeight:700, fontSize:15, fontFamily:'Outfit,monospace', outline:'none', transition:'all 0.15s',
                                cursor: isTravado ? 'not-allowed' : !lancavel ? 'not-allowed' : 'text',
                                boxShadow: lancavel ? 'inset 0 1px 3px rgba(0,0,0,0.05)' : 'none'
                              }}
                              onFocus={e => {
                                if (!lancavel) return
                                e.currentTarget.style.borderColor = color
                                e.currentTarget.style.boxShadow = `0 0 0 3px ${color}20`
                              }}
                              onBlur={e => {
                                e.currentTarget.style.borderColor = isAbaixoMedia ? 'rgba(239,68,68,0.4)' : 'transparent'
                                e.currentTarget.style.boxShadow = lancavel ? 'inset 0 1px 3px rgba(0,0,0,0.05)' : 'none'
                              }}
                              onKeyDown={e => {
                                // Facilitar navegação por setas ou Enter se desejar
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  // Tentar focar no próximo input da mesma coluna
                                  const form = e.currentTarget.closest('table')
                                  if (form) {
                                    const inputs = Array.from(form.querySelectorAll(`input:not([disabled])`)) as HTMLInputElement[]
                                    const index = inputs.indexOf(e.currentTarget)
                                    // Acha o próximo da mesma coluna (que está N passos a frente onde N = número de inputs habilitados por linha)
                                    // Pra simplificar, vamos pular pro próximo input validando o Tab
                                    if (index > -1 && index + 1 < inputs.length) {
                                      inputs[index + 1].focus()
                                    }
                                  }
                                }
                              }}
                            />
                          </td>
                        )
                      })}

                      {/* Média Parcial / Resultado Final */}
                      <td style={{ borderBottom: '1px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))', padding: '12px', textAlign: 'center', background: hasNotas && mColor === '#ef4444' ? 'rgba(239,68,68,0.03)' : isResultadoFinal && hasNotas ? `${mColor}05` : 'transparent' }}>
                        {isResultadoFinal ? (
                          <div>
                            <div style={{ fontWeight:900, fontSize:22, fontFamily:'Outfit,sans-serif', color: mColor }}>
                              {hasNotas ? metrics.mediaParcial!.toFixed(getCasasVirgula(formulaAtiva)) : '—'}
                            </div>
                            {hasNotas && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Méd. Final Auto
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontWeight:900, fontSize:22, fontFamily:'Outfit,sans-serif', color: mColor }}>
                            {hasNotas ? metrics.mediaParcial!.toFixed(getCasasVirgula(formulaAtiva)) : '—'}
                          </div>
                        )}
                      </td>

                      {/* Situação */}
                      <td style={{ borderBottom: '1px solid hsl(var(--border-subtle))', padding: '12px 20px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:800, textTransform: 'uppercase', letterSpacing: '0.05em', background:sit.bg, color:sit.color }}>
                          {sit.label}
                        </span>
                        {isResultadoFinal && !hasNotas && mediasParciais?.[aluno.id] && Object.keys(mediasParciais[aluno.id]).length === 0 && (
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Lance ao menos 1 bimestre</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
