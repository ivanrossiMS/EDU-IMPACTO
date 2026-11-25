'use client'

import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  Globe,
  Layers,
  Lock,
  Printer,
  RotateCcw,
  RotateCw,
  Send,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AulaAlocada,
  CenarioHorario,
  DiaSemanaId,
  DIAS_SEMANA_LABELS,
  FaixaHorario,
  HorarioProjeto,
} from '@/lib/horario/types'
import {
  avaliarGradeCompleta,
  avaliarSlotParaAula,
  gerarRelatorioCargaHoraria,
  parseTimeToMinutes,
} from '@/lib/horario/solver'

interface Props {
  projeto: HorarioProjeto
  cenario: CenarioHorario | null
  canUndo: boolean
  canRedo: boolean
  isPublishing: boolean
  onUndo: () => void
  onRedo: () => void
  onUpdateAulas: (nextAulas: AulaAlocada[]) => void
  onPublish: (syncRotina: boolean) => void
  onIrParaGerador: () => void
}

type SubView = 'geral' | 'turma' | 'professores' | 'ambientes' | 'relatorios'

export function GradeInterativaTab({
  projeto,
  cenario,
  canUndo,
  canRedo,
  isPublishing,
  onUndo,
  onRedo,
  onUpdateAulas,
  onPublish,
  onIrParaGerador,
}: Props) {
  const [subView, setSubView] = useState<SubView>('geral')
  const [filtroSede, setFiltroSede] = useState('todas')
  const [diaGeral, setDiaGeral] = useState<DiaSemanaId>(1)
  const [turmaSelId, setTurmaSelId] = useState<string>(projeto.turmas.find(t => t.ativa)?.id || '')
  const [profFiltro, setProfFiltro] = useState('')
  const [aulaEmMovimento, setAulaEmMovimento] = useState<AulaAlocada | null>(null)
  const [syncRotinaOnPublish, setSyncRotinaOnPublish] = useState(true)

  const turmasAtivas = useMemo(
    () =>
      projeto.turmas.filter(
        t => t.ativa && (filtroSede === 'todas' || t.unidadeId === filtroSede)
      ),
    [projeto.turmas, filtroSede]
  )

  const profMap = useMemo(() => new Map(projeto.professores.map(p => [p.id, p])), [projeto.professores])
  const sedeMap = useMemo(() => new Map(projeto.sedes.map(s => [s.id, s])), [projeto.sedes])
  const modeloMap = useMemo(() => new Map(projeto.modelosHorario.map(m => [m.id, m])), [projeto.modelosHorario])

  const aulas = cenario?.aulas || []
  const metricas = cenario?.metricas

  const relatorio = useMemo(() => gerarRelatorioCargaHoraria(projeto, aulas), [projeto, aulas])

  const turmaAtual = turmasAtivas.find(t => t.id === turmaSelId) || turmasAtivas[0]
  const modeloTurmaAtual = turmaAtual ? modeloMap.get(turmaAtual.modeloHorarioId) : undefined

  // Ações de edição direta na grade
  const toggleLock = (aulaId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onUpdateAulas(aulas.map(a => (a.id === aulaId ? { ...a, fixa: !a.fixa } : a)))
  }

  const removeAula = (aulaId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onUpdateAulas(aulas.filter(a => a.id !== aulaId))
    if (aulaEmMovimento?.id === aulaId) setAulaEmMovimento(null)
  }

  const handleSlotClick = (dia: DiaSemanaId, faixa: FaixaHorario, existingAula?: AulaAlocada) => {
    if (faixa.tipo !== 'aula' || !turmaAtual) return

    if (!aulaEmMovimento) {
      if (existingAula) {
        if (existingAula.fixa) {
          toast.info('Esta aula está travada (🔒). Destrave antes de mover.')
          return
        }
        setAulaEmMovimento(existingAula)
      }
      return
    }

    // Clicou na própria aula selecionada -> cancelar seleção
    if (existingAula && existingAula.id === aulaEmMovimento.id) {
      setAulaEmMovimento(null)
      return
    }

    if (existingAula?.fixa) {
      toast.error('A aula de destino está travada (🔒).')
      return
    }

    const aval = avaliarSlotParaAula(projeto, aulas, aulaEmMovimento, dia, faixa)
    if (aval.status === 'conflito') {
      toast.warning(`Movido com alerta de conflito: ${aval.motivos[0] || ''}`)
    }

    const next = aulas.map(a => {
      if (a.id === aulaEmMovimento.id) {
        return {
          ...a,
          dia,
          faixaId: faixa.id,
          ordem: faixa.ordem,
          inicio: faixa.inicio,
          fim: faixa.fim,
          inicioMin: parseTimeToMinutes(faixa.inicio),
          fimMin: parseTimeToMinutes(faixa.fim),
        }
      }
      if (existingAula && a.id === existingAula.id) {
        return {
          ...a,
          dia: aulaEmMovimento.dia,
          faixaId: aulaEmMovimento.faixaId,
          ordem: aulaEmMovimento.ordem,
          inicio: aulaEmMovimento.inicio,
          fim: aulaEmMovimento.fim,
          inicioMin: aulaEmMovimento.inicioMin,
          fimMin: aulaEmMovimento.fimMin,
        }
      }
      return a
    })

    const evaluated = avaliarGradeCompleta(projeto, next)
    onUpdateAulas(evaluated.aulasComConflitos)
    setAulaEmMovimento(null)
    toast.success(existingAula ? 'Aulas trocadas com sucesso!' : 'Aula movida com sucesso!')
  }

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new()

    // Aba 1: Grade por Turmas
    const rowsTurmas = aulas.map(a => {
      const turma = projeto.turmas.find(t => t.id === a.turmaId)
      return {
        Sede: sedeMap.get(a.unidadeId)?.nome || '',
        Turma: turma?.nome || a.turmaId,
        Dia: DIAS_SEMANA_LABELS[a.dia]?.completo || a.dia,
        Horario: `${a.inicio} - ${a.fim}`,
        Disciplina: a.disciplinaNome,
        Professores: a.professoresIds.map(id => profMap.get(id)?.nome || id).join(' + '),
        Ambiente: a.ambienteNome || '',
        Conflitos: (a.conflitos || []).map(c => c.mensagem).join(' | '),
      }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsTurmas), 'Grade_Geral')

    // Aba 2: Carga Horária Professores
    const rowsProfs = relatorio.porProfessor.map(r => ({
      Professor: r.nome,
      Aulas_Previstas: r.aulasPrevistas,
      Aulas_Alocadas: r.aulasAlocadas,
      Dias_Trabalhados: r.diasTrabalhados,
      Janelas_Semana: r.janelasSemana,
      Trocas_Sede: r.trocasSede,
      Turmas: r.turmasDetalhes.map(d => `${d.turmaNome} (${d.disciplinaNome}: ${d.aulas})`).join(', '),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsProfs), 'Carga_Professores')

    // Aba 3: Carga Horária Turmas
    const rowsCargaTurmas = relatorio.porTurma.flatMap(t =>
      t.disciplinas.map(d => ({
        Sede: t.sedeNome,
        Turma: t.turmaNome,
        Turno: t.turno,
        Disciplina: d.disciplinaNome,
        Professor: d.professoresNomes,
        Aulas_Previstas: d.previstas,
        Aulas_Alocadas: d.alocadas,
      }))
    )
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsCargaTurmas), 'Carga_Turmas')

    XLSX.writeFile(wb, `Horario_Escolar_${projeto.anoLetivo}_${cenario?.nome || 'Grade'}.xlsx`)
    toast.success('Planilha Excel exportada com 3 abas!')
  }

  const copyPublicLink = (tipo: 'professores' | 'turmas') => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/horario-publico?tipo=${tipo}&ano=${encodeURIComponent(projeto.anoLetivo)}`
    navigator.clipboard.writeText(url)
    toast.success(`Link público dos ${tipo === 'professores' ? 'Professores' : 'Alunos/Turmas'} copiado!`)
  }

  if (!cenario) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <Calendar size={44} style={{ margin: '0 auto 14px', opacity: 0.3 }} />
        <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px' }}>Nenhum horário gerado ainda</h3>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: '0 0 20px' }}>
          Vá até a aba <strong>Diagnóstico & Gerador</strong> para executar o algoritmo automático ou carregar a demonstração.
        </p>
        <button type="button" className="btn btn-primary" onClick={onIrParaGerador}>
          Ir para Diagnóstico & Gerador
        </button>
      </div>
    )
  }

  // Faixas consolidadas para a Grade Geral do dia
  const faixasUnicasDia = useMemo(() => {
    const seen = new Map<string, { inicio: string; fim: string; inicioMin: number }>()
    for (const t of turmasAtivas) {
      const m = modeloMap.get(t.modeloHorarioId)
      for (const f of m?.faixas || []) {
        if (f.tipo !== 'aula') continue
        const key = `${f.inicio}-${f.fim}`
        if (!seen.has(key)) {
          seen.set(key, { inicio: f.inicio, fim: f.fim, inicioMin: parseTimeToMinutes(f.inicio) })
        }
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].inicioMin - b[1].inicioMin)
      .map(([key, val]) => ({ key, ...val }))
  }, [turmasAtivas, modeloMap])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs de Qualidade do Cenário */}
      {metricas && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div className="kpi-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>SCORE GERAL</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: metricas.scoreGeral >= 85 ? '#10b981' : '#f59e0b' }}>
              {metricas.scoreGeral}%
            </div>
          </div>
          <div className="kpi-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>AULAS ENCAIXADAS</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#3b82f6' }}>
              {metricas.totalAulasAlocadas}/{metricas.totalAulasPrevistas}
            </div>
          </div>
          <div className="kpi-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>CHOQUES</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: metricas.choquesProfessor === 0 ? '#10b981' : '#ef4444' }}>
              {metricas.choquesProfessor}
            </div>
          </div>
          <div className="kpi-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>JANELAS PROF.</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: metricas.totalJanelasProfessores === 0 ? '#10b981' : '#f59e0b' }}>
              {metricas.totalJanelasProfessores}
            </div>
          </div>
          <div className="kpi-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>RESTRIÇÕES VIOLADAS</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: metricas.violacoesDisponibilidade + metricas.violacoesAmbiente + metricas.violacoesDeslocamento === 0 ? '#10b981' : '#ef4444' }}>
              {metricas.violacoesDisponibilidade + metricas.violacoesAmbiente + metricas.violacoesDeslocamento}
            </div>
          </div>
          <div className="kpi-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>TROCAS DE SEDE</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#a78bfa' }}>
              {metricas.trocasSedeNoDia}
            </div>
          </div>
        </div>
      )}

      {/* Aulas não alocadas warning */}
      {cenario.naoAlocadas.length > 0 && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} />
            {cenario.naoAlocadas.reduce((a, n) => a + n.quantidadeFaltante, 0)} aula(s) não puderam ser alocadas sob as restrições estritas:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {cenario.naoAlocadas.map(n => {
              const tNome = projeto.turmas.find(t => t.id === n.turmaId)?.nome || n.turmaId
              return (
                <span key={n.alocacaoId} className="badge badge-danger" style={{ fontSize: 11 }}>
                  {tNome} • {n.disciplinaNome} ({n.quantidadeFaltante}x)
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Barra de Controles, Sub-visões, Undo/Redo, Exportação & Publicação */}
      <div className="card" style={{ padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'geral', label: 'Grade Geral (Turmas)', icon: <Layers size={14} /> },
            { id: 'turma', label: 'Editar por Turma', icon: <ArrowLeftRight size={14} /> },
            { id: 'professores', label: 'Horário Professores', icon: <UserCheck size={14} /> },
            { id: 'ambientes', label: 'Ambientes / Quadras', icon: <FlaskConical size={14} /> },
            { id: 'relatorios', label: 'Carga Horária', icon: <Users size={14} /> },
          ].map(v => (
            <button
              key={v.id}
              type="button"
              className={subView === v.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => {
                setSubView(v.id as SubView)
                setAulaEmMovimento(null)
              }}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!canUndo} onClick={onUndo} title="Desfazer">
            <RotateCcw size={14} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!canRedo} onClick={onRedo} title="Refazer">
            <RotateCw size={14} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportarExcel}>
            <Download size={14} /> Excel
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Barra de Publicação & Links Públicos Sempre Atualizados (WebHorário Style) */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(90deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))',
          border: '1px solid rgba(16,185,129,0.28)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={16} style={{ color: '#10b981' }} />
            <span style={{ fontSize: 13, fontWeight: 800 }}>Publicação & Links Ao Vivo:</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={syncRotinaOnPublish}
              onChange={e => setSyncRotinaOnPublish(e.target.checked)}
            />
            Sincronizar com Grade Oficial do ERP (`Horários`)
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => copyPublicLink('professores')}
            title="Copiar link público sempre atualizado para professores"
          >
            <Copy size={13} /> Link Professores
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => copyPublicLink('turmas')}
            title="Copiar link público sempre atualizado para alunos/famílias"
          >
            <Copy size={13} /> Link Alunos/Turmas
          </button>
          <a
            href={`/horario-publico?tipo=turmas&ano=${encodeURIComponent(projeto.anoLetivo)}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
          >
            <ExternalLink size={13} /> Visualizar Portal
          </a>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isPublishing}
            onClick={() => onPublish(syncRotinaOnPublish)}
          >
            <Send size={13} /> {isPublishing ? 'Publicando...' : 'Publicar Horário'}
          </button>
        </div>
      </div>

      {/* ════════════ SUB-VISÃO 1: GRADE GERAL (TODAS AS TURMAS) ════════════ */}
      {subView === 'geral' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([1, 2, 3, 4, 5, 6] as DiaSemanaId[]).map(d => (
                <button
                  key={d}
                  type="button"
                  className={diaGeral === d ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  onClick={() => setDiaGeral(d)}
                >
                  {DIAS_SEMANA_LABELS[d].completo}
                </button>
              ))}
            </div>
            {projeto.sedes.length > 1 && (
              <select
                className="form-input"
                style={{ width: 200, fontSize: 12, padding: '6px 10px' }}
                value={filtroSede}
                onChange={e => setFiltroSede(e.target.value)}
              >
                <option value="todas">Todas as Sedes</option>
                {projeto.sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            )}
          </div>

          <div tabIndex={0} role="region" aria-label="Grade Geral por Turmas" className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 115, position: 'sticky', left: 0, zIndex: 2 }}>Horário</th>
                  {turmasAtivas.map(t => (
                    <th key={t.id} style={{ textAlign: 'center', minWidth: 140 }}>
                      <div style={{ fontWeight: 800, fontSize: 12 }}>{t.nome}</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                        {sedeMap.get(t.unidadeId)?.nome}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {faixasUnicasDia.map(fx => (
                  <tr key={fx.key}>
                    <th
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        background: 'hsl(var(--bg-surface))',
                        borderRight: '1px solid hsl(var(--border-subtle))',
                        fontSize: 11,
                      }}
                    >
                      {fx.inicio} – {fx.fim}
                    </th>
                    {turmasAtivas.map(t => {
                      const aula = aulas.find(
                        a => a.turmaId === t.id && a.dia === diaGeral && `${a.inicio}-${a.fim}` === fx.key
                      )
                      const hasConflict = (aula?.conflitos?.length || 0) > 0
                      const profs = (aula?.professoresIds || [])
                        .map(id => profMap.get(id)?.apelido || profMap.get(id)?.nome?.split(' ')[0])
                        .join(' + ')

                      return (
                        <td
                          key={t.id}
                          style={{ padding: 5, textAlign: 'center', cursor: 'pointer' }}
                          onClick={() => {
                            setTurmaSelId(t.id)
                            setSubView('turma')
                          }}
                          title={hasConflict ? aula?.conflitos?.map(c => c.mensagem).join('\n') : 'Clique para editar esta turma'}
                        >
                          {aula ? (
                            <div
                              style={{
                                padding: '8px 6px',
                                borderRadius: 10,
                                background: hasConflict ? 'rgba(239,68,68,0.18)' : `${aula.cor}1a`,
                                border: hasConflict
                                  ? '2px solid #ef4444'
                                  : `1px solid ${aula.cor}44`,
                                minHeight: 54,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                gap: 2,
                              }}
                            >
                              <div style={{ fontSize: 12, fontWeight: 800, color: hasConflict ? '#f87171' : aula.cor }}>
                                {aula.disciplinaSigla} {aula.fixa ? '🔒' : ''}
                              </div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                                {profs}
                              </div>
                              {aula.ambienteNome && (
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>{aula.ambienteNome}</div>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-disabled))' }}>—</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ SUB-VISÃO 2: EDIÇÃO POR TURMA + SEMÁFORO INTELIGENTE ════════════ */}
      {subView === 'turma' && turmaAtual && modeloTurmaAtual && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select
                className="form-input"
                style={{ width: 260, fontWeight: 700 }}
                value={turmaAtual.id}
                onChange={e => {
                  setTurmaSelId(e.target.value)
                  setAulaEmMovimento(null)
                }}
              >
                {turmasAtivas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({sedeMap.get(t.unidadeId)?.nome})
                  </option>
                ))}
              </select>
              <span className="badge badge-primary">{modeloTurmaAtual.nome}</span>
            </div>

            {aulaEmMovimento ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 10, background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.45)' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  Movendo: <strong>{aulaEmMovimento.disciplinaNome}</strong> — Clique em um horário 🟢 para mover/trocar
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAulaEmMovimento(null)}>
                  <X size={13} /> Cancelar
                </button>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                💡 Clique em qualquer aula para mover ou trocar com feedback em tempo real (🟢 Livre / 🔴 Choque)
              </span>
            )}
          </div>

          <div tabIndex={0} role="region" aria-label={`Grade semanal da turma ${turmaAtual.nome}`} className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Horário</th>
                  {modeloTurmaAtual.diasAtivos.map(d => (
                    <th key={d} style={{ textAlign: 'center' }}>{DIAS_SEMANA_LABELS[d].completo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modeloTurmaAtual.faixas.map(faixa => {
                  if (faixa.tipo === 'intervalo') {
                    return (
                      <tr key={faixa.id} style={{ background: 'rgba(245,158,11,0.06)' }}>
                        <td style={{ fontWeight: 700, fontSize: 11, color: '#f59e0b' }}>
                          {faixa.inicio} – {faixa.fim}
                        </td>
                        <td colSpan={modeloTurmaAtual.diasAtivos.length} style={{ textAlign: 'center', fontWeight: 800, fontSize: 12, letterSpacing: '0.35em', color: '#f59e0b' }}>
                          I N T E R V A L O
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={faixa.id}>
                      <td style={{ fontWeight: 700, fontSize: 12 }}>
                        <div>{faixa.label || `${faixa.ordem}ª Aula`}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{faixa.inicio} – {faixa.fim}</div>
                      </td>
                      {modeloTurmaAtual.diasAtivos.map(dia => {
                        const cell = aulas.find(
                          a => a.turmaId === turmaAtual.id && a.dia === dia && a.faixaId === faixa.id
                        )
                        const isSelected = aulaEmMovimento?.id === cell?.id
                        const aval =
                          aulaEmMovimento && !isSelected
                            ? avaliarSlotParaAula(projeto, aulas, aulaEmMovimento, dia, faixa)
                            : null

                        const hasConflict = (cell?.conflitos?.length || 0) > 0
                        let borderStyle = cell ? `1.5px solid ${cell.cor}44` : '1.5px dashed hsl(var(--border-subtle))'
                        let bgStyle = cell ? `${cell.cor}16` : 'transparent'

                        if (hasConflict) {
                          borderStyle = '2px solid #ef4444'
                          bgStyle = 'rgba(239,68,68,0.16)'
                        }
                        if (isSelected) {
                          borderStyle = '2px solid #3b82f6'
                          bgStyle = 'rgba(59,130,246,0.22)'
                        } else if (aval) {
                          if (aval.status === 'valido') {
                            borderStyle = '2px dashed #10b981'
                            bgStyle = 'rgba(16,185,129,0.14)'
                          } else if (aval.status === 'ocupado') {
                            borderStyle = '2px dashed #3b82f6'
                            bgStyle = 'rgba(59,130,246,0.12)'
                          } else if (aval.status === 'aviso') {
                            borderStyle = '2px dashed #f59e0b'
                            bgStyle = 'rgba(245,158,11,0.14)'
                          } else if (aval.status === 'conflito') {
                            borderStyle = '2px solid rgba(239,68,68,0.85)'
                            bgStyle = 'rgba(239,68,68,0.12)'
                          }
                        }

                        const profNames = (cell?.professoresIds || [])
                          .map(id => profMap.get(id)?.nome || 'Professor')
                          .join(' + ')

                        return (
                          <td key={dia} style={{ padding: 6 }}>
                            <div
                              onClick={() => handleSlotClick(dia, faixa, cell)}
                              title={
                                aval
                                  ? aval.motivos.join(' • ')
                                  : hasConflict
                                  ? cell?.conflitos?.map(c => c.mensagem).join('\n')
                                  : undefined
                              }
                              style={{
                                minHeight: 78,
                                padding: '8px 10px',
                                borderRadius: 12,
                                background: bgStyle,
                                border: borderStyle,
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                position: 'relative',
                                transition: 'all 0.15s',
                              }}
                            >
                              {cell ? (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: hasConflict ? '#f87171' : cell.cor, lineHeight: 1.2 }}>
                                      {cell.disciplinaNome}
                                    </span>
                                    <div style={{ display: 'flex', gap: 2 }}>
                                      <button
                                        type="button"
                                        onClick={e => toggleLock(cell.id, e)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: cell.fixa ? '#f59e0b' : 'hsl(var(--text-muted))' }}
                                        title={cell.fixa ? 'Destravar aula' : 'Travar aula (manter fixa ao regerar)'}
                                      >
                                        {cell.fixa ? <Lock size={12} /> : <Unlock size={12} />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={e => removeAula(cell.id, e)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ef4444' }}
                                        title="Remover aula deste horário"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                                    {profNames}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                                    {cell.ambienteNome && (
                                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: `${cell.cor}22`, fontWeight: 700 }}>
                                        {cell.ambienteNome}
                                      </span>
                                    )}
                                    {hasConflict && (
                                      <span style={{ fontSize: 10, color: '#f87171', fontWeight: 800 }}>⚠ Conflito</span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div style={{ margin: 'auto', fontSize: 11, color: aval?.status === 'valido' ? '#34d399' : 'hsl(var(--text-disabled))', fontWeight: 700 }}>
                                  {aval ? (aval.status === 'valido' ? '✓ Mover aqui' : '✕ Conflito') : 'Livre'}
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ SUB-VISÃO 3: HORÁRIO DOS PROFESSORES ════════════ */}
      {subView === 'professores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ maxWidth: 320 }}
              placeholder="Filtrar professor..."
              value={profFiltro}
              onChange={e => setProfFiltro(e.target.value)}
            />
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              Exibindo grade individual, janelas e deslocamentos entre sedes
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 14 }}>
            {relatorio.porProfessor
              .filter(r => !profFiltro.trim() || r.nome.toLowerCase().includes(profFiltro.toLowerCase()))
              .map(row => {
                const profAulas = aulas.filter(a => a.professoresIds.includes(row.professorId))
                const dias: DiaSemanaId[] = [1, 2, 3, 4, 5]
                return (
                  <div
                    key={row.professorId}
                    className="card timetable-column"
                    style={{ padding: 16 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: row.cor }} />
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800 }}>{row.nome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                            {row.aulasAlocadas} aulas • {row.diasTrabalhados} dias •{' '}
                            <strong style={{ color: row.janelasSemana === 0 ? '#10b981' : '#f59e0b' }}>
                              {row.janelasSemana} janela(s)
                            </strong>
                            {row.trocasSede > 0 && ` • 🚗 ${row.trocasSede} troca(s) de sede`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                      {dias.map(d => {
                        const dayList = profAulas.filter(a => a.dia === d).sort((a, b) => a.inicioMin - b.inicioMin)
                        return (
                          <div
                            key={d}
                            style={{
                              padding: 8,
                              borderRadius: 10,
                              background: 'hsl(var(--bg-elevated))',
                              border: '1px solid hsl(var(--border-subtle))',
                              minHeight: 110,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 800, textAlign: 'center', marginBottom: 6, color: 'hsl(var(--text-muted))' }}>
                              {DIAS_SEMANA_LABELS[d].curto}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {dayList.length === 0 ? (
                                <div style={{ textAlign: 'center', fontSize: 11, color: 'hsl(var(--text-disabled))', marginTop: 18 }}>
                                  —
                                </div>
                              ) : (
                                dayList.map((a, idx) => {
                                  const tNome = projeto.turmas.find(t => t.id === a.turmaId)?.nome || a.turmaId
                                  const prev = idx > 0 ? dayList[idx - 1] : null
                                  const gapMin = prev ? a.inicioMin - prev.fimMin : 0
                                  const hasJanelaBefore = prev && gapMin > 25 && Math.floor(prev.fimMin / 765) === Math.floor(a.inicioMin / 765)
                                  const changedSede = prev && prev.unidadeId !== a.unidadeId
                                  return (
                                    <React.Fragment key={a.id}>
                                      {changedSede && (
                                        <div style={{ fontSize: 9, textAlign: 'center', color: '#a78bfa', fontWeight: 700 }}>
                                          🚗 Desloc. ({gapMin}m)
                                        </div>
                                      )}
                                      {hasJanelaBefore && !changedSede && (
                                        <div style={{ fontSize: 9, textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>
                                          ☕ Janela ({gapMin}m)
                                        </div>
                                      )}
                                      <div
                                        style={{
                                          padding: '5px 6px',
                                          borderRadius: 7,
                                          background: `${a.cor}1a`,
                                          border: `1px solid ${a.cor}44`,
                                          fontSize: 10,
                                        }}
                                      >
                                        <div style={{ fontWeight: 800, color: a.cor }}>{tNome}</div>
                                        <div style={{ fontWeight: 600 }}>{a.disciplinaSigla} • {a.inicio}</div>
                                      </div>
                                    </React.Fragment>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ════════════ SUB-VISÃO 4: AMBIENTES & QUADRAS ════════════ */}
      {subView === 'ambientes' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
          {projeto.ambientes.map(amb => {
            const ambAulas = aulas.filter(a => a.ambienteId === amb.id)
            return (
              <div key={amb.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{amb.nome}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      {sedeMap.get(amb.unidadeId)?.nome} • Capacidade simultânea: {amb.capacidadeSimultanea} turma(s) • {ambAulas.length} uso(s)/sem
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {([1, 2, 3, 4, 5] as DiaSemanaId[]).map(d => {
                    const list = ambAulas.filter(a => a.dia === d).sort((a, b) => a.inicioMin - b.inicioMin)
                    return (
                      <div key={d} style={{ padding: 8, borderRadius: 10, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', minHeight: 90 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textAlign: 'center', marginBottom: 6, color: 'hsl(var(--text-muted))' }}>
                          {DIAS_SEMANA_LABELS[d].curto}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {list.map(a => {
                            const tNome = projeto.turmas.find(t => t.id === a.turmaId)?.nome || a.turmaId
                            return (
                              <div key={a.id} style={{ padding: '4px 6px', borderRadius: 6, background: `${a.cor}1a`, border: `1px solid ${a.cor}44`, fontSize: 10 }}>
                                <div style={{ fontWeight: 800, color: a.cor }}>{tNome}</div>
                                <div>{a.inicio} • {a.disciplinaSigla}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ════════════ SUB-VISÃO 5: RELATÓRIOS DE CARGA HORÁRIA (WEBHORÁRIO STYLE) ════════════ */}
      {subView === 'relatorios' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
          {/* Relatório 1: Carga Horária dos Professores */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>Relatório de Carga Horária — Professores</h3>
            <div tabIndex={0} role="region" aria-label="Carga horária dos professores" className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Professor</th>
                    <th>Alocadas / Prev.</th>
                    <th>Dias</th>
                    <th>Janelas</th>
                    <th>Turmas</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.porProfessor.map(r => (
                    <tr key={r.professorId}>
                      <td style={{ fontWeight: 700 }}>{r.nome}</td>
                      <td className="num">
                        <span style={{ color: r.aulasAlocadas === r.aulasPrevistas ? '#10b981' : '#f59e0b', fontWeight: 800 }}>
                          {r.aulasAlocadas}/{r.aulasPrevistas}
                        </span>
                      </td>
                      <td className="num">{r.diasTrabalhados}</td>
                      <td className="num" style={{ color: r.janelasSemana === 0 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                        {r.janelasSemana}
                      </td>
                      <td style={{ whiteSpace: 'normal', fontSize: 11 }}>
                        {r.turmasDetalhes.map(d => `${d.turmaNome} (${d.disciplinaNome}: ${d.aulas})`).join(' • ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Relatório 2: Carga Horária das Turmas */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>Relatório de Carga Horária — Turmas & Disciplinas</h3>
            <div style={{ display: 'grid', gridAutoRows: 'max-content', gap: 12, maxHeight: 540, overflowY: 'auto', paddingRight: 4 }}>
              {relatorio.porTurma.map(t => (
                <div
                  key={t.turmaId}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{t.turmaNome}</span>
                    <span className="badge badge-primary" style={{ fontSize: 11 }}>
                      {t.aulasAlocadas}/{t.aulasPrevistas} alocadas (Cap: {t.capacidadeGrade})
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                    {t.disciplinas.map((d, idx) => (
                      <div key={idx} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>{d.disciplinaNome}</span>
                          <span style={{ color: d.alocadas === d.previstas ? '#10b981' : '#f87171' }}>
                            {d.alocadas}/{d.previstas}
                          </span>
                        </div>
                        <div style={{ color: 'hsl(var(--text-muted))', marginTop: 2 }}>{d.professoresNomes}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
