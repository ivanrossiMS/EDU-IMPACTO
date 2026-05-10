'use client'
import { useData, ConfigDisciplina, EsquemaNota, Turma, newId } from '@/lib/dataContext'
import { TIPOS_META } from '@/lib/notasEngine'
import { useState, useMemo } from 'react'
import {
  Search, Link2, Unlink, CheckCircle, AlertTriangle, XCircle,
  BookOpen, Layers, ChevronRight, X, Check, Shield,
  ArrowLeft, Info, Zap, RefreshCw, BarChart2, GraduationCap
} from 'lucide-react'

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface ComponenteCurricular {
  disciplinaId: string
  disciplinaNome: string
  disciplinaCodigo: string
  cargaHoraria: number
  curricular: 'Curricular' | 'Extracurricular'
  tipo: string          // Nota / Conceito / etc
  ordem: number
  lancarComo: string
  mostrarComo: string
  esquemaVinculadoId: string | null
  esquemaVinculadoNome: string
}

interface TurmaComComponentes extends Turma {
  componentes: ComponenteCurricular[]
}

const COR = {
  primary: '#0ea5e9',
  accent: '#0284c7',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  purple: '#8b5cf6',
}

const SEG_COLORS: Record<string, string> = {
  EI: '#ec4899', EF1: '#3b82f6', EF2: '#8b5cf6', EM: '#10b981', EJA: '#f59e0b'
}

// Gera componentes curriculares a partir das disciplinas EXPLICITAMENTE vinculadas à turma
// (aba Disciplinas do card da turma em Acadêmico → Turmas).
// Fallback: disciplinas ativas do segmento da turma (retrocompatibilidade para turmas antigas).
function gerarComponentes(
  turma: Turma,
  cfgDisciplinas: ConfigDisciplina[],
  esquemaNota: EsquemaNota[]
): ComponenteCurricular[] {
  let disciplinas: Array<{ id: string; nome: string; codigo: string; cargaHoraria: number; obrigatoria: boolean }> = []

  const turmaDiscs = (turma as any).disciplinas as Array<{ id: string; nome: string; codigo: string; cargaHoraria: number; professor: string }> | undefined

  if (Array.isArray(turmaDiscs) && turmaDiscs.length > 0) {
    // ── Primary path: use disciplines explicitly linked to this turma ──────────
    // Cross-reference with cfgDisciplinas by name to get canonical id + metadata
    const cfgByNome = new Map(cfgDisciplinas.map(d => [d.nome, d]))
    disciplinas = turmaDiscs.map(td => {
      const cfg = cfgByNome.get(td.nome)
      return {
        id: cfg?.id ?? td.id,          // prefer canonical cfgDisciplinas id
        nome: td.nome,
        codigo: td.codigo || cfg?.codigo || '',
        cargaHoraria: td.cargaHoraria ?? cfg?.cargaHoraria ?? 0,
        obrigatoria: cfg?.obrigatoria ?? true,
      }
    })
  } else {
    // ── Fallback: filter cfgDisciplinas by turma's niveisEnsino segment ────────
    // (legacy behaviour for turmas that haven't had disciplines linked yet)
    disciplinas = cfgDisciplinas
      .filter(d =>
        d.situacao === 'ativa' &&
        (!d.niveisEnsino?.length || !turma.serie ||
          d.niveisEnsino.some(n => turma.serie?.startsWith(n) || n === turma.serie))
      )
      .sort((a, b) => Number(a.codigo) - Number(b.codigo))
      .map(d => ({ id: d.id, nome: d.nome, codigo: d.codigo, cargaHoraria: d.cargaHoraria, obrigatoria: d.obrigatoria }))
  }

  return disciplinas.map((d, idx) => {
    // Verifica se há esquema vinculado a esta turma+disciplina
    const esquemaVinculado = esquemaNota.find(e =>
      e.turmaIds.includes(turma.id) &&
      (e.disciplinaIds.includes(d.id) || e.disciplinaIds.length === 0)
    ) || null

    // Tipo padrão baseado no esquema ou 'Nota'
    const tipoPadrao = esquemaVinculado?.detalhes?.[0]?.tipoDado ?? 'Nota'

    return {
      disciplinaId: d.id,
      disciplinaNome: d.nome,
      disciplinaCodigo: d.codigo,
      cargaHoraria: d.cargaHoraria,
      curricular: d.obrigatoria ? 'Curricular' : 'Extracurricular',
      tipo: tipoPadrao,
      ordem: idx + 1,
      lancarComo: tipoPadrao,
      mostrarComo: tipoPadrao,
      esquemaVinculadoId: esquemaVinculado?.id ?? null,
      esquemaVinculadoNome: esquemaVinculado?.descricao ?? '',
    }
  })
}

type StatusValidacao = 'ok' | 'aviso' | 'erro'

interface ResultadoValidacao {
  status: StatusValidacao
  titulo: string
  mensagem: string
  disciplina?: string
}

function validarTurma(
  turma: Turma,
  componentes: ComponenteCurricular[],
  esquemaNota: EsquemaNota[]
): ResultadoValidacao[] {
  const resultados: ResultadoValidacao[] = []

  // Regra 1: Todas as disciplinas devem ter esquema vinculado
  const semEsquema = componentes.filter(c => !c.esquemaVinculadoId)
  if (semEsquema.length > 0) {
    resultados.push({
      status: 'aviso',
      titulo: 'Disciplinas sem esquema',
      mensagem: `${semEsquema.length} disciplina(s) sem esquema de notas vinculado. Configure antes de iniciar lançamentos.`,
    })
  }

  // Regra 2: Esquema vinculado deve estar homologado
  const esquemasTurma = esquemaNota.filter(e => e.turmaIds.includes(turma.id))
  const naoHomologados = esquemasTurma.filter(e => !e.homologado)
  if (naoHomologados.length > 0) {
    resultados.push({
      status: 'aviso',
      titulo: 'Esquemas não homologados',
      mensagem: `${naoHomologados.map(e => `"${e.descricao}"`).join(', ')} ainda não está(ão) homologado(s). Homologue antes de iniciar o período letivo.`,
    })
  }

  // Regra 3: Esquema com detalhes configurados
  const semDetalhes = esquemasTurma.filter(e => e.detalhes.length === 0)
  if (semDetalhes.length > 0) {
    resultados.push({
      status: 'erro',
      titulo: 'Esquemas sem fórmula',
      mensagem: `${semDetalhes.map(e => `"${e.descricao}"`).join(', ')} não possui(em) detalhes/componentes configurados.`,
    })
  }

  // Regra 4: Carga horária zerada
  const semCarga = componentes.filter(c => c.cargaHoraria === 0)
  if (semCarga.length > 0) {
    resultados.push({
      status: 'aviso',
      titulo: 'Carga horária zerada',
      mensagem: `${semCarga.length} disciplina(s) com carga horária = 0h. Verifique o cadastro.`,
    })
  }

  if (resultados.length === 0) {
    resultados.push({
      status: 'ok',
      titulo: 'Configuração validada',
      mensagem: 'Todos os componentes curriculares estão configurados corretamente para lançamento.',
    })
  }

  return resultados
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function ComponentesCurricularesPage() {
  const { turmas: _turmas, cfgDisciplinas: _cfgDisc, esquemaNota: _esquemaNota, setEsquemaNota, logSystemAction } = useData()
  const turmas        = Array.isArray(_turmas)      ? _turmas      : []
  const cfgDisciplinas= Array.isArray(_cfgDisc)     ? _cfgDisc     : []
  const esquemaNota   = Array.isArray(_esquemaNota)  ? _esquemaNota : []

  // ── Seleção de turma ───────────────────────────────────────────────
  const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null)
  const [buscaTurma, setBuscaTurma] = useState('')
  const [showTurmaPicker, setShowTurmaPicker] = useState(false)
  const [filtroAnoTurma, setFiltroAnoTurma] = useState<number>(new Date().getFullYear())

  // ── Estado da tabela ───────────────────────────────────────────────
  const [buscaDisc, setBuscaDisc] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showValidacao, setShowValidacao] = useState(false)

  // ── Modal Vincular Esquema ─────────────────────────────────────────
  const [showModalVincular, setShowModalVincular] = useState(false)
  const [esquemaSelecionadoId, setEsquemaSelecionadoId] = useState('')
  const [modoVinculo, setModoVinculo] = useState<'selecionadas' | 'todas'>('todas')

  // ── Anos disponíveis ───────────────────────────────────────────────
  const anosDisponiveis = useMemo(() => {
    const anos = [...new Set(turmas.map(t => t.ano))].filter(Boolean).sort((a, b) => b - a)
    return anos.length > 0 ? anos : [new Date().getFullYear()]
  }, [turmas])

  // ── Turmas filtradas para o picker ────────────────────────────────
  const turmasFiltradas = useMemo(() =>
    turmas
      .filter(t => t.ano === filtroAnoTurma)
      .filter(t => !buscaTurma || t.nome.toLowerCase().includes(buscaTurma.toLowerCase()) || t.serie?.toLowerCase().includes(buscaTurma.toLowerCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [turmas, filtroAnoTurma, buscaTurma]
  )

  // ── Componentes curriculares calculados ───────────────────────────
  const componentes = useMemo<ComponenteCurricular[]>(() => {
    if (!turmaSelecionada) return []
    return gerarComponentes(turmaSelecionada, cfgDisciplinas, esquemaNota)
  }, [turmaSelecionada, cfgDisciplinas, esquemaNota])

  // ── Filtro de busca na tabela ─────────────────────────────────────
  const componentesFiltrados = useMemo(() =>
    componentes.filter(c =>
      !buscaDisc || c.disciplinaNome.toLowerCase().includes(buscaDisc.toLowerCase()) || c.disciplinaCodigo.includes(buscaDisc)
    ),
    [componentes, buscaDisc]
  )

  // ── Esquemas compatíveis (ano da turma, ativo, com detalhes) ──────
  const esquemasDisponiveis = useMemo(() =>
    esquemaNota
      .filter(e => e.situacao === 'Ativo')
      .sort((a, b) => a.sequencial - b.sequencial),
    [esquemaNota]
  )

  // ── Validação ─────────────────────────────────────────────────────
  const resultadosValidacao = useMemo(() => {
    if (!turmaSelecionada) return []
    return validarTurma(turmaSelecionada, componentes, esquemaNota)
  }, [turmaSelecionada, componentes, esquemaNota])

  const statusGeral = useMemo(() => {
    if (resultadosValidacao.some(r => r.status === 'erro')) return 'erro'
    if (resultadosValidacao.some(r => r.status === 'aviso')) return 'aviso'
    return 'ok'
  }, [resultadosValidacao])

  // ── KPIs da turma selecionada ─────────────────────────────────────
  const kpis = useMemo(() => {
    if (!turmaSelecionada) return null
    const total = componentes.length
    const comEsquema = componentes.filter(c => c.esquemaVinculadoId).length
    const semEsquema = total - comEsquema
    const curriculares = componentes.filter(c => c.curricular === 'Curricular').length
    return { total, comEsquema, semEsquema, curriculares }
  }, [componentes, turmaSelecionada])

  // ── Handlers ───────────────────────────────────────────────────────

  function toggleRow(disciplinaId: string) {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(disciplinaId)) next.delete(disciplinaId)
      else next.add(disciplinaId)
      return next
    })
  }

  function toggleAll() {
    if (selectedRows.size === componentesFiltrados.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(componentesFiltrados.map(c => c.disciplinaId)))
    }
  }

  function vincularEsquema() {
    if (!turmaSelecionada || !esquemaSelecionadoId) return
    const esquema = esquemaNota.find(e => e.id === esquemaSelecionadoId)
    if (!esquema) return

    const disciplinasAlvo = modoVinculo === 'selecionadas'
      ? [...selectedRows]
      : componentes.map(c => c.disciplinaId)

    setEsquemaNota(prev => prev.map(e => {
      if (e.id !== esquemaSelecionadoId) return e
      // Adiciona a turma se não estiver
      const novasTurmaIds = e.turmaIds.includes(turmaSelecionada.id)
        ? e.turmaIds : [...e.turmaIds, turmaSelecionada.id]
      // Adiciona as disciplinas se não estiverem (ou mantém vazio = todas)
      const novasDisciplinaIds = [...new Set([...e.disciplinaIds, ...disciplinasAlvo])]
      return { ...e, turmaIds: novasTurmaIds, disciplinaIds: novasDisciplinaIds, updatedAt: new Date().toISOString() }
    }))

    logSystemAction('Configurações', 'Vínculo', `Esquema "${esquema.descricao}" vinculado à turma ${turmaSelecionada.nome} — ${disciplinasAlvo.length} disciplina(s)`)
    setShowModalVincular(false)
    setSelectedRows(new Set())
  }

  function desvincularEsquema() {
    if (!turmaSelecionada) return

    const disciplinasAlvo = selectedRows.size > 0
      ? [...selectedRows]
      : componentes.map(c => c.disciplinaId)

    if (!confirm(`Desvincular o esquema de ${disciplinasAlvo.length} disciplina(s) da turma ${turmaSelecionada.nome}?`)) return

    setEsquemaNota(prev => prev.map(e => {
      if (!e.turmaIds.includes(turmaSelecionada.id)) return e
      // Remove a turma e as disciplinas selecionadas
      const novasDisciplinaIds = e.disciplinaIds.filter(d => !disciplinasAlvo.includes(d))
      // Se não sobram disciplinas vinculadas desta turma, remove a turma também
      const novasTurmaIds = novasDisciplinaIds.length === 0
        ? e.turmaIds.filter(t => t !== turmaSelecionada.id)
        : e.turmaIds
      return { ...e, turmaIds: novasTurmaIds, disciplinaIds: novasDisciplinaIds, updatedAt: new Date().toISOString() }
    }))

    logSystemAction('Configurações', 'Desvinculação', `Esquema desvinculado da turma ${turmaSelecionada.nome} — ${disciplinasAlvo.length} disciplina(s)`)
    setSelectedRows(new Set())
  }

  const segColor = turmaSelecionada ? (SEG_COLORS[turmaSelecionada.serie ?? ''] ?? COR.primary) : COR.primary

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100vh' }}>

      {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, ${COR.primary}, ${COR.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${COR.primary}40`
          }}>
            <GraduationCap size={24} color="#fff" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
              Componentes Curriculares
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, marginTop: 2 }}>
              Vincule e valide esquemas de notas por turma e disciplina
            </p>
          </div>
        </div>

        {turmaSelecionada && (
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Status badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 10,
              background: statusGeral === 'ok' ? 'rgba(16,185,129,0.10)' : statusGeral === 'aviso' ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)',
              border: `1px solid ${statusGeral === 'ok' ? 'rgba(16,185,129,0.30)' : statusGeral === 'aviso' ? 'rgba(245,158,11,0.30)' : 'rgba(239,68,68,0.30)'}`,
              fontSize: 12, fontWeight: 700,
              color: statusGeral === 'ok' ? '#059669' : statusGeral === 'aviso' ? '#b45309' : '#dc2626',
            }}>
              {statusGeral === 'ok' ? <CheckCircle size={13} /> : statusGeral === 'aviso' ? <AlertTriangle size={13} /> : <XCircle size={13} />}
              {statusGeral === 'ok' ? 'Configuração OK' : statusGeral === 'aviso' ? `${resultadosValidacao.filter(r => r.status !== 'ok').length} aviso(s)` : 'Erro de config.'}
            </div>
          </div>
        )}
      </div>

      {/* ── SELETOR DE TURMA ─────────────────────────────────────────── */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
            Curso / Turma
          </div>

          {/* Input de seleção da turma */}
          <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
            <div
              onClick={() => setShowTurmaPicker(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, height: 44,
                padding: '0 14px', borderRadius: 10,
                border: `2px solid ${turmaSelecionada ? segColor + '60' : '#e2e8f0'}`,
                background: turmaSelecionada ? `${segColor}08` : '#f8fafc',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {turmaSelecionada ? (
                <>
                  <div style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                    background: `${segColor}15`, color: segColor
                  }}>
                    {turmaSelecionada.serie}
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', flex: 1 }}>
                    {turmaSelecionada.codigo} — {turmaSelecionada.nome} · {turmaSelecionada.turno}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setTurmaSelecionada(null); setBuscaTurma(''); setSelectedRows(new Set()); setShowValidacao(false) }}
                    style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <span style={{ color: '#9ca3af', fontSize: 13 }}>Clique para selecionar a turma...</span>
              )}
            </div>
          </div>

          {/* Botões de ação */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowModalVincular(true); setModoVinculo(selectedRows.size > 0 ? 'selecionadas' : 'todas') }}
              disabled={!turmaSelecionada}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 18px', height: 42,
                borderRadius: 10, border: 'none', cursor: turmaSelecionada ? 'pointer' : 'not-allowed',
                background: turmaSelecionada
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'rgba(107,114,128,0.12)',
                color: turmaSelecionada ? '#fff' : '#9ca3af',
                fontWeight: 800, fontSize: 13, opacity: turmaSelecionada ? 1 : 0.6,
                boxShadow: turmaSelecionada ? '0 4px 14px rgba(16,185,129,0.35)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Link2 size={15} /> Vincular Esquema
            </button>
            <button
              onClick={desvincularEsquema}
              disabled={!turmaSelecionada || componentes.filter(c => c.esquemaVinculadoId).length === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 18px', height: 42,
                borderRadius: 10, border: 'none',
                cursor: (turmaSelecionada && componentes.filter(c => c.esquemaVinculadoId).length > 0) ? 'pointer' : 'not-allowed',
                background: (turmaSelecionada && componentes.filter(c => c.esquemaVinculadoId).length > 0)
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : 'rgba(107,114,128,0.12)',
                color: (turmaSelecionada && componentes.filter(c => c.esquemaVinculadoId).length > 0) ? '#fff' : '#9ca3af',
                fontWeight: 800, fontSize: 13,
                opacity: (turmaSelecionada && componentes.filter(c => c.esquemaVinculadoId).length > 0) ? 1 : 0.6,
                boxShadow: (turmaSelecionada && componentes.filter(c => c.esquemaVinculadoId).length > 0) ? '0 4px 14px rgba(239,68,68,0.35)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Unlink size={15} /> Desvincular Esquema
            </button>
            <button
              onClick={() => setShowValidacao(v => !v)}
              disabled={!turmaSelecionada}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 18px', height: 42,
                borderRadius: 10,
                border: `2px solid ${showValidacao ? '#7c3aed' : '#e2e8f0'}`,
                background: showValidacao ? 'rgba(124,58,237,0.10)' : '#fff',
                color: showValidacao ? '#7c3aed' : '#64748b',
                fontWeight: 800, fontSize: 13, cursor: turmaSelecionada ? 'pointer' : 'not-allowed',
                opacity: turmaSelecionada ? 1 : 0.5, transition: 'all 0.2s',
              }}
            >
              <CheckCircle size={15} /> Validar Compatibilidade
            </button>
          </div>
        </div>
      </div>

      {/* ── TURMA PICKER ─────────────────────────────────────────────── */}
      {showTurmaPicker && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={e => { if (e.target === e.currentTarget) setShowTurmaPicker(false) }}>
          <div style={{
            background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            width: '100%', maxWidth: 620, maxHeight: '85vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${COR.primary}, ${COR.accent})`, display: 'flex', alignItems: 'center', justifyContent:'center' }}>
                <Layers size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a' }}>Selecionar Turma</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{turmasFiltradas.length} turmas disponíveis</div>
              </div>
              <button onClick={() => setShowTurmaPicker(false)} style={{ padding: 7, borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer' }}>
                <X size={16} color="#64748b" />
              </button>
            </div>

            {/* Filtros */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  className="form-input" style={{ paddingLeft: 32, height: 40, fontSize: 13 }}
                  placeholder="Buscar turma ou série..."
                  value={buscaTurma} onChange={e => setBuscaTurma(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {anosDisponiveis.map(ano => (
                  <button key={ano} onClick={() => setFiltroAnoTurma(ano)}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: `1px solid ${filtroAnoTurma === ano ? COR.primary : '#e2e8f0'}`,
                      background: filtroAnoTurma === ano ? `${COR.primary}15` : '#fff',
                      color: filtroAnoTurma === ano ? COR.primary : '#64748b',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}>
                    {ano}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
              {turmasFiltradas.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
                  <Layers size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <div style={{ fontSize: 14 }}>Nenhuma turma encontrada para {filtroAnoTurma}</div>
                </div>
              ) : turmasFiltradas.map(t => {
                const cor = SEG_COLORS[t.serie ?? ''] ?? COR.primary
                const esquemasTurma = esquemaNota.filter(e => e.turmaIds.includes(t.id))
                return (
                  <button key={t.id}
                    onClick={() => { setTurmaSelecionada(t); setShowTurmaPicker(false); setBuscaTurma(''); setSelectedRows(new Set()); setShowValidacao(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      borderRadius: 12, border: `1px solid ${cor}20`, background: '#fafafa',
                      width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 6,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${cor}08`; e.currentTarget.style.borderColor = `${cor}40` }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = `${cor}20` }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${cor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontWeight: 900, fontSize: 11, color: cor }}>{t.serie}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{t.nome}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{t.serie} · {t.turno} · {t.professor || 'Professor não definido'}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {esquemasTurma.length > 0 ? (
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.10)', color: '#059669', fontSize: 10, fontWeight: 700 }}>
                          {esquemasTurma.length} esquema(s)
                        </span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.10)', color: '#b45309', fontSize: 10, fontWeight: 700 }}>
                          Sem esquema
                        </span>
                      )}
                      <ChevronRight size={14} style={{ color: cor, display: 'block', marginLeft: 'auto', marginTop: 4 }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ──────────────────────────────────────────────── */}
      {!turmaSelecionada && (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: `${COR.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={36} style={{ color: COR.primary, opacity: 0.6 }} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Selecione uma turma para iniciar</div>
              <div style={{ fontSize: 13, color: '#64748b', maxWidth: 420 }}>
                Clique no campo "Curso / Turma" acima para buscar e selecionar a turma.
                Você poderá então vincular, desvincular e validar os esquemas de notas por disciplina.
              </div>
            </div>
            <button
              onClick={() => setShowTurmaPicker(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                borderRadius: 12, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${COR.primary}, ${COR.accent})`,
                color: '#fff', fontWeight: 800, fontSize: 13,
                boxShadow: `0 4px 14px ${COR.primary}40`,
              }}
            >
              <Search size={15} /> Pesquisar Turma
            </button>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO COM TURMA SELECIONADA ───────────────────────────── */}
      {turmaSelecionada && (
        <>
          {/* KPIs */}
          {kpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Total de Disciplinas', value: kpis.total, color: COR.primary, icon: '📚' },
                { label: 'Curriculares', value: kpis.curriculares, color: '#6366f1', icon: '🎓' },
                { label: 'Com Esquema', value: kpis.comEsquema, color: COR.success, icon: '✅' },
                { label: 'Sem Esquema', value: kpis.semEsquema, color: kpis.semEsquema > 0 ? COR.warning : COR.success, icon: kpis.semEsquema > 0 ? '⚠️' : '✓' },
              ].map(k => (
                <div key={k.label} style={{
                  padding: '18px 20px', borderRadius: 14, background: '#fff',
                  border: `1px solid ${k.color}20`, position: 'relative', overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.color }} />
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 22 }}>{k.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 3 }}>{k.label}</div>
                      <div style={{ fontSize: 30, fontWeight: 900, color: k.color, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{k.value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Validação */}
          {showValidacao && resultadosValidacao.length > 0 && (
            <div className="card" style={{ padding: '18px 22px', borderLeft: `4px solid ${statusGeral === 'ok' ? '#10b981' : statusGeral === 'aviso' ? '#f59e0b' : '#ef4444'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                {statusGeral === 'ok' ? <CheckCircle size={18} color={COR.success} /> : statusGeral === 'aviso' ? <AlertTriangle size={18} color={COR.warning} /> : <XCircle size={18} color={COR.danger} />}
                <div style={{ fontWeight: 800, fontSize: 14 }}>Resultado da Validação — {turmaSelecionada.nome}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resultadosValidacao.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10,
                    background: r.status === 'ok' ? 'rgba(16,185,129,0.07)' : r.status === 'aviso' ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)',
                    border: `1px solid ${r.status === 'ok' ? 'rgba(16,185,129,0.20)' : r.status === 'aviso' ? 'rgba(245,158,11,0.20)' : 'rgba(239,68,68,0.20)'}`,
                  }}>
                    {r.status === 'ok' ? <CheckCircle size={15} color={COR.success} style={{ flexShrink: 0, marginTop: 1 }} /> : r.status === 'aviso' ? <AlertTriangle size={15} color={COR.warning} style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={15} color={COR.danger} style={{ flexShrink: 0, marginTop: 1 }} />}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: r.status === 'ok' ? '#065f46' : r.status === 'aviso' ? '#92400e' : '#991b1b', marginBottom: 2 }}>{r.titulo}</div>
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{r.mensagem}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de ações da tabela */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input className="form-input" style={{ paddingLeft: 32, height: 38, fontSize: 13, borderRadius: 9 }}
                placeholder="Pesquisar disciplina..."
                value={buscaDisc} onChange={e => setBuscaDisc(e.target.value)} />
            </div>
            {selectedRows.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: `${COR.primary}10`, border: `1px solid ${COR.primary}30`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: COR.primary }}>
                {selectedRows.size} selecionada(s)
                <button onClick={() => setSelectedRows(new Set())} style={{ padding: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: COR.primary, display: 'flex' }}>
                  <X size={12} />
                </button>
              </div>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              Mostrando {componentesFiltrados.length} de {componentes.length} disciplina(s)
            </span>
          </div>

          {/* Tabela */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', width: 40 }}>
                      <input type="checkbox"
                        checked={selectedRows.size === componentesFiltrados.length && componentesFiltrados.length > 0}
                        onChange={toggleAll}
                        style={{ cursor: 'pointer', accentColor: COR.primary }}
                      />
                    </th>
                    {[
                      { label: 'Disciplina', w: 'auto' },
                      { label: 'C.H', w: 60 },
                      { label: 'Curricular', w: 110 },
                      { label: 'Tipo', w: 100 },
                      { label: 'Ordem', w: 70 },
                      { label: 'Lançar como', w: 130 },
                      { label: 'Mostrar Como', w: 130 },
                      { label: 'Esquema Vinculado', w: 220 },
                    ].map(col => (
                      <th key={col.label} style={{
                        padding: '12px 14px', fontSize: 11, fontWeight: 800,
                        color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em',
                        width: col.w, whiteSpace: 'nowrap',
                      }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {componentesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '50px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                          <BookOpen size={36} style={{ color: '#cbd5e1' }} />
                          <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>
                            {buscaDisc ? 'Nenhuma disciplina encontrada' : 'Nenhuma disciplina configurada para esta turma'}
                          </div>
                          {!buscaDisc && (
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>
                              Configure disciplinas em <strong>Config. Pedagógico → Disciplinas</strong>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : componentesFiltrados.map((comp, idx) => {
                    const isSel = selectedRows.has(comp.disciplinaId)
                    const isEven = idx % 2 === 0
                    const meta = TIPOS_META[comp.tipo as keyof typeof TIPOS_META]
                    const temEsquema = !!comp.esquemaVinculadoId
                    const esquemaObj = temEsquema ? esquemaNota.find(e => e.id === comp.esquemaVinculadoId) : null

                    return (
                      <tr key={comp.disciplinaId}
                        onClick={() => toggleRow(comp.disciplinaId)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isSel ? `${COR.primary}08` : isEven ? '#fff' : '#fafafa',
                          cursor: 'pointer', transition: 'background 0.15s',
                          outline: isSel ? `2px solid ${COR.primary}30` : 'none',
                          outlineOffset: -1,
                        }}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#f0f9ff' }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isEven ? '#fff' : '#fafafa' }}
                      >
                        <td style={{ padding: '13px 16px' }}>
                          <input type="checkbox" checked={isSel}
                            onChange={() => toggleRow(comp.disciplinaId)}
                            onClick={e => e.stopPropagation()}
                            style={{ cursor: 'pointer', accentColor: COR.primary }}
                          />
                        </td>

                        {/* Disciplina */}
                        <td style={{ padding: '13px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <code style={{ fontSize: 11, padding: '2px 6px', borderRadius: 5, background: `${segColor}12`, color: segColor, fontWeight: 800, flexShrink: 0 }}>
                              {comp.disciplinaCodigo}
                            </code>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{comp.disciplinaNome}</span>
                          </div>
                        </td>

                        {/* C.H */}
                        <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: comp.cargaHoraria === 0 ? '#f59e0b' : '#374151' }}>
                          {comp.cargaHoraria}h
                        </td>

                        {/* Curricular */}
                        <td style={{ padding: '13px 14px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: comp.curricular === 'Curricular' ? 'rgba(59,130,246,0.10)' : 'rgba(107,114,128,0.10)',
                            color: comp.curricular === 'Curricular' ? '#3b82f6' : '#6b7280',
                          }}>
                            {comp.curricular}
                          </span>
                        </td>

                        {/* Tipo */}
                        <td style={{ padding: '13px 14px' }}>
                          <span style={{
                            padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: meta?.corFundo ?? '#f1f5f9',
                            color: meta?.cor ?? '#64748b',
                          }}>
                            {meta?.icone ?? ''} {comp.tipo}
                          </span>
                        </td>

                        {/* Ordem */}
                        <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: 900, fontSize: 14, color: segColor, fontFamily: 'Outfit, monospace' }}>
                          {comp.ordem}
                        </td>

                        {/* Lançar como */}
                        <td style={{ padding: '13px 14px', fontSize: 12, color: '#374151', fontWeight: 600 }}>
                          {comp.lancarComo}
                        </td>

                        {/* Mostrar Como */}
                        <td style={{ padding: '13px 14px', fontSize: 12, color: '#374151', fontWeight: 600 }}>
                          {comp.mostrarComo}
                        </td>

                        {/* Esquema Vinculado */}
                        <td style={{ padding: '13px 14px' }}>
                          {temEsquema && esquemaObj ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8,
                                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)',
                                maxWidth: 200,
                              }}>
                                {esquemaObj.homologado && <Shield size={10} color="#059669" />}
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#065f46', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  #{esquemaObj.sequencial} {esquemaObj.descricao}
                                </span>
                              </div>
                              {!esquemaObj.homologado && (
                                <span title="Esquema não homologado" style={{ display: 'inline-flex' }}>
                                  <AlertTriangle size={13} color={COR.warning} />
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                              <Link2 size={11} /> Sem esquema
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer da tabela */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 14, background: '#fafafa' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Mostrando {componentesFiltrados.length} de {componentes.length} disciplina(s) • {selectedRows.size} selecionada(s)
              </span>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, background: 'rgba(16,185,129,0.10)', color: '#059669', fontSize: 11, fontWeight: 700 }}>
                  <CheckCircle size={10} /> {kpis?.comEsquema} c/ esquema
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, background: 'rgba(245,158,11,0.10)', color: '#b45309', fontSize: 11, fontWeight: 700 }}>
                  <AlertTriangle size={10} /> {kpis?.semEsquema} s/ esquema
                </span>
              </div>
            </div>
          </div>

          {/* Legenda */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '5px 2px' }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Legenda:</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: 'rgba(16,185,129,0.08)', color: '#059669', fontSize: 11, fontWeight: 700 }}>
              <Shield size={10} /> Esquema Homologado
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: 'rgba(245,158,11,0.08)', color: '#b45309', fontSize: 11, fontWeight: 700 }}>
              <AlertTriangle size={10} /> Não Homologado / Sem esquema
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: `${COR.primary}10`, color: COR.primary, fontSize: 11, fontWeight: 700 }}>
              <Check size={10} /> Linha selecionada
            </span>
          </div>
        </>
      )}

      {/* ══════════ MODAL VINCULAR ESQUEMA ══════════ */}
      {showModalVincular && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(15,23,42,0.56)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={e => { if (e.target === e.currentTarget) setShowModalVincular(false) }}>
          <div style={{
            background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ padding: '22px 26px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, background: `linear-gradient(135deg, rgba(16,185,129,0.08), #fff)` }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Link2 size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a' }}>Vincular Esquema de Notas</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                  Turma: <strong>{turmaSelecionada?.nome}</strong>
                  {selectedRows.size > 0 && <> · <span style={{ color: COR.primary }}>{selectedRows.size} disciplina(s) selecionada(s)</span></>}
                </div>
              </div>
              <button onClick={() => setShowModalVincular(false)} style={{ padding: 7, borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer' }}>
                <X size={16} color="#64748b" />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Modo de vínculo */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Aplicar em quais disciplinas?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {([
                    { key: 'todas' as const, label: 'Todas as disciplinas', desc: `${componentes.length} disciplinas da turma`, icon: '📚' },
                    { key: 'selecionadas' as const, label: 'Selecionadas', desc: selectedRows.size > 0 ? `${selectedRows.size} disciplina(s) marcadas` : 'Nenhuma selecionada', icon: '☑️', disabled: selectedRows.size === 0 },
                  ]).map(opt => (
                    <button key={opt.key}
                      disabled={(opt as any).disabled}
                      onClick={() => setModoVinculo(opt.key)}
                      style={{
                        padding: '14px', borderRadius: 12, border: `2px solid ${modoVinculo === opt.key ? '#10b981' : '#e2e8f0'}`,
                        background: modoVinculo === opt.key ? 'rgba(16,185,129,0.07)' : '#fafafa',
                        cursor: (opt as any).disabled ? 'not-allowed' : 'pointer',
                        opacity: (opt as any).disabled ? 0.5 : 1,
                        textAlign: 'left', transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: modoVinculo === opt.key ? '#065f46' : '#0f172a' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seleção do esquema */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Selecionar Esquema de Notas
                </label>
                {esquemasDisponiveis.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: '#fffbeb', borderRadius: 12, border: '1px solid rgba(245,158,11,0.30)' }}>
                    <AlertTriangle size={24} color={COR.warning} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Nenhum esquema de notas ativo cadastrado</div>
                    <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                      Acesse <strong>Config. de Notas → Esquema de Notas</strong> para criar.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {esquemasDisponiveis.map(e => {
                      const isSel = esquemaSelecionadoId === e.id
                      return (
                        <button key={e.id} onClick={() => setEsquemaSelecionadoId(e.id)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                            borderRadius: 12, border: `2px solid ${isSel ? '#10b981' : '#e2e8f0'}`,
                            background: isSel ? 'rgba(16,185,129,0.06)' : '#fafafa',
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                          }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isSel ? 'rgba(16,185,129,0.15)' : '#f1f5f9',
                          }}>
                            {isSel
                              ? <Check size={16} color="#059669" strokeWidth={3} />
                              : <Layers size={16} color="#94a3b8" />
                            }
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{ fontWeight: 900, fontSize: 14, fontFamily: 'Outfit, monospace', color: isSel ? '#065f46' : COR.primary }}>
                                #{e.sequencial}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{e.descricao}</span>
                              {e.homologado && <Shield size={11} color="#059669" />}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: '#64748b' }}>Ano: {e.ano}</span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>·</span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>{e.detalhes.length} detalhe(s) configurado(s)</span>
                              {e.homologado && (
                                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: 'rgba(16,185,129,0.10)', color: '#059669', fontWeight: 700 }}>
                                  Homologado
                                </span>
                              )}
                              {!e.homologado && (
                                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: 'rgba(245,158,11,0.10)', color: '#b45309', fontWeight: 700 }}>
                                  Não homologado
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Alerta de esquema não homologado */}
              {esquemaSelecionadoId && !esquemaNota.find(e => e.id === esquemaSelecionadoId)?.homologado && (
                <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <AlertTriangle size={16} color={COR.warning} style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                    <strong>Atenção:</strong> O esquema selecionado ainda não está homologado. O vínculo será feito, mas homologue antes de iniciar os lançamentos de notas para evitar inconsistências.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 26px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fafafa' }}>
              <button onClick={() => setShowModalVincular(false)} style={{ height: 42, padding: '0 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <X size={14} /> Cancelar
              </button>
              <button
                onClick={vincularEsquema}
                disabled={!esquemaSelecionadoId}
                style={{
                  height: 42, padding: '0 24px', borderRadius: 10, border: 'none',
                  background: esquemaSelecionadoId ? 'linear-gradient(135deg, #10b981, #059669)' : '#e2e8f0',
                  color: esquemaSelecionadoId ? '#fff' : '#94a3b8',
                  fontWeight: 800, fontSize: 13, cursor: esquemaSelecionadoId ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 7,
                  boxShadow: esquemaSelecionadoId ? '0 4px 14px rgba(16,185,129,0.35)' : 'none',
                  transition: 'all 0.2s',
                }}>
                <Check size={15} /> Confirmar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
