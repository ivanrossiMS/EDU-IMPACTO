'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Plus,
  Users,
  Sparkles,
  Check,
  X,
  Trash2,
  Link2,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react'
import {
  AlocacaoCurricular,
  DisciplinaHorarioConfig,
  HorarioProjeto,
  TipoDistribuicao,
} from '@/lib/horario/types'
import { pickColor } from '@/lib/horario/presets'

interface Props {
  projeto: HorarioProjeto
  onChange: (next: HorarioProjeto) => void
}

const DISTRIBUICAO_OPTS: Array<{ value: TipoDistribuicao; label: string; desc: string }> = [
  { value: 'livre', label: 'Livre', desc: 'Sem restrição de agrupamento' },
  { value: 'geminadas', label: 'Priorizar Geminadas', desc: 'Tenta formar pares consecutivos (2+2)' },
  { value: 'obrigatorio_geminada', label: 'Exigir Geminadas', desc: 'Obriga aulas em duplas consecutivas' },
  { value: 'separadas', label: 'Separadas (1 aula/dia)', desc: 'Nunca repete no mesmo dia' },
  { value: 'max_2_dia', label: 'Máx. 2 aulas/dia', desc: 'Evita aulas triplas no mesmo dia' },
  { value: 'dias_alternados', label: 'Dias Alternados', desc: 'Evita dias seguidos quando possível' },
]

export function GradeCurricularTab({ projeto, onChange }: Props) {
  const [novaDiscNome, setNovaDiscNome] = useState('')
  const [novaDiscAmb, setNovaDiscAmb] = useState('')
  const [editingKey, setEditingKey] = useState<{ turmaId: string; disciplinaId: string } | null>(null)
  const [formAulas, setFormAulas] = useState(2)
  const [formProfs, setFormProfs] = useState<string[]>([])
  const [formDist, setFormDist] = useState<TipoDistribuicao>('max_2_dia')
  const [formAmb, setFormAmb] = useState('')
  const [formSync, setFormSync] = useState('')

  const dialogRef = useRef<HTMLDialogElement>(null)

  const turmasAtivas = useMemo(() => projeto.turmas.filter(t => t.ativa), [projeto.turmas])
  const disciplinasUnicas = useMemo(() => {
    const seen = new Set<string>()
    return projeto.disciplinas.filter(d => {
      if (!d?.id || seen.has(d.id)) return false
      seen.add(d.id)
      return true
    })
  }, [projeto.disciplinas])
  const modeloMap = useMemo(() => new Map(projeto.modelosHorario.map(m => [m.id, m])), [projeto.modelosHorario])
  const profMap = useMemo(() => new Map(projeto.professores.map(p => [p.id, p])), [projeto.professores])

  const getAloc = (turmaId: string, disciplinaId: string): AlocacaoCurricular | undefined =>
    projeto.alocacoes.find(a => a.turmaId === turmaId && a.disciplinaId === disciplinaId)

  const openEditor = (turmaId: string, disciplinaId: string) => {
    const existing = getAloc(turmaId, disciplinaId)
    const disc = projeto.disciplinas.find(d => d.id === disciplinaId)
    setFormAulas(existing?.aulasSemana ?? 2)
    setFormProfs(existing?.professoresIds || [])
    setFormDist(existing?.distribuicao || 'max_2_dia')
    setFormAmb(existing?.ambienteId || disc?.ambientePadraoId || '')
    setFormSync(existing?.syncGroupId || '')
    setEditingKey({ turmaId, disciplinaId })
  }

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (editingKey && !dlg.open) {
      dlg.showModal()
    } else if (!editingKey && dlg.open) {
      dlg.close()
    }
  }, [editingKey])

  const handleCloseDialog = () => {
    setEditingKey(null)
  }

  const saveCell = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingKey) return
    const { turmaId, disciplinaId } = editingKey
    const existing = getAloc(turmaId, disciplinaId)
    const disc = projeto.disciplinas.find(d => d.id === disciplinaId)

    let nextAlocacoes = [...projeto.alocacoes]
    if (formAulas <= 0) {
      nextAlocacoes = nextAlocacoes.filter(a => !(a.turmaId === turmaId && a.disciplinaId === disciplinaId))
    } else if (existing) {
      nextAlocacoes = nextAlocacoes.map(a =>
        a.id === existing.id
          ? {
              ...a,
              aulasSemana: formAulas,
              professoresIds: formProfs,
              distribuicao: formDist,
              ambienteId: formAmb || undefined,
              syncGroupId: formSync.trim() || undefined,
            }
          : a
      )
    } else {
      nextAlocacoes.push({
        id: `AL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        turmaId,
        disciplinaId,
        professoresIds: formProfs,
        aulasSemana: formAulas,
        distribuicao: formDist,
        ambienteId: formAmb || undefined,
        syncGroupId: formSync.trim() || undefined,
        cor: disc?.cor,
      })
    }

    onChange({ ...projeto, alocacoes: nextAlocacoes })
    setEditingKey(null)
  }

  const toggleProfInForm = (profId: string) => {
    setFormProfs(prev => (prev.includes(profId) ? prev.filter(id => id !== profId) : [...prev, profId]))
  }

  const addDisciplina = () => {
    if (!novaDiscNome.trim()) return
    const id = `DISC-${Date.now().toString(36).toUpperCase()}`
    const nova: DisciplinaHorarioConfig = {
      id,
      nome: novaDiscNome.trim(),
      sigla: novaDiscNome.trim().slice(0, 4).toUpperCase(),
      cor: pickColor(novaDiscNome),
      ambientePadraoId: novaDiscAmb || undefined,
      pesoCognitivo: 'medio',
    }
    onChange({ ...projeto, disciplinas: [...projeto.disciplinas, nova] })
    setNovaDiscNome('')
    setNovaDiscAmb('')
  }

  const turmaEditing = editingKey ? projeto.turmas.find(t => t.id === editingKey.turmaId) : null
  const discEditing = editingKey ? projeto.disciplinas.find(d => d.id === editingKey.disciplinaId) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header + Quick Add Disciplina */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={17} style={{ color: '#3b82f6' }} />
              Matriz Curricular Visual (Turmas × Disciplinas)
            </h3>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0' }}>
              Clique em qualquer célula para definir carga semanal, 1 ou mais professores (<strong>Aula em Dupla</strong>), distribuição (geminada/separada), ambiente e sincronismo.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ width: 190 }}
              placeholder="Nova disciplina..."
              value={novaDiscNome}
              onChange={e => setNovaDiscNome(e.target.value)}
            />
            <select
              className="form-input"
              style={{ width: 170 }}
              value={novaDiscAmb}
              onChange={e => setNovaDiscAmb(e.target.value)}
            >
              <option value="">Ambiente padrão (opcional)</option>
              {projeto.ambientes.map(a => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={addDisciplina}>
              <Plus size={14} /> Disciplina
            </button>
          </div>
        </div>
      </div>

      {/* Matriz Interativa (Lira Pro Style) */}
      <div tabIndex={0} role="region" aria-label="Matriz Curricular Turmas por Disciplinas" className="table-container card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 160, position: 'sticky', left: 0, zIndex: 2 }}>Turma / Carga</th>
              {disciplinasUnicas.map(d => (
                <th key={d.id} style={{ textAlign: 'center', minWidth: 112 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: `${d.cor}22`,
                        color: d.cor,
                        fontWeight: 800,
                        fontSize: 11,
                      }}
                    >
                      {d.sigla}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-secondary))', maxWidth: 105, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.nome}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turmasAtivas.map(turma => {
              const mod = modeloMap.get(turma.modeloHorarioId)
              const cap = mod ? mod.diasAtivos.length * mod.faixas.filter(f => f.tipo === 'aula').length : 0
              const totalTurma = projeto.alocacoes
                .filter(a => a.turmaId === turma.id)
                .reduce((acc, a) => acc + (a.aulasSemana || 0), 0)
              const over = totalTurma > cap
              const full = totalTurma === cap && cap > 0

              return (
                <tr key={turma.id}>
                  <th
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      background: 'hsl(var(--bg-surface))',
                      borderRight: '1px solid hsl(var(--border-subtle))',
                      textAlign: 'left',
                      textTransform: 'none',
                      letterSpacing: 'normal',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{turma.nome}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: over ? '#f87171' : full ? '#34d399' : '#fbbf24' }}>
                      {totalTurma}/{cap} aulas
                    </div>
                  </th>

                  {disciplinasUnicas.map(disc => {
                    const al = getAloc(turma.id, disc.id)
                    const hasData = al && al.aulasSemana > 0
                    const semProf = hasData && al.professoresIds.length === 0
                    const isDupla = hasData && al.professoresIds.length >= 2
                    const profNames = (al?.professoresIds || [])
                      .map(pid => profMap.get(pid)?.apelido || profMap.get(pid)?.nome?.split(' ')[0] || '?')
                      .join(' + ')

                    return (
                      <td key={disc.id} style={{ padding: 6, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openEditor(turma.id, disc.id)}
                          style={{
                            width: '100%',
                            minHeight: 56,
                            padding: '6px 8px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                            background: semProf
                              ? 'rgba(239,68,68,0.12)'
                              : hasData
                              ? `${disc.cor}16`
                              : 'transparent',
                            border: semProf
                              ? '1.5px dashed rgba(239,68,68,0.65)'
                              : hasData
                              ? `1px solid ${disc.cor}44`
                              : '1px dashed hsl(var(--border-subtle))',
                            color: 'inherit',
                            transition: 'transform 0.12s',
                          }}
                        >
                          {hasData ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 15, fontWeight: 800, color: semProf ? '#f87171' : disc.cor }}>
                                  {al.aulasSemana}
                                </span>
                                {isDupla && (
                                  <span
                                    title="Aula em Dupla / Co-docência"
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 800,
                                      padding: '1px 5px',
                                      borderRadius: 5,
                                      background: 'rgba(139,92,246,0.2)',
                                      color: '#a78bfa',
                                    }}
                                  >
                                    DUPLA
                                  </span>
                                )}
                                {al.syncGroupId && <Link2 size={11} style={{ color: '#06b6d4' }} />}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: semProf ? '#f87171' : 'hsl(var(--text-secondary))',
                                  maxWidth: 96,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {semProf ? '⚠ Sem prof.' : profNames}
                              </div>
                            </>
                          ) : (
                            <span style={{ fontSize: 14, color: 'hsl(var(--text-disabled))' }}>+</span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Native Accessible Dialog para Editor Avançado da Célula */}
      <dialog
        ref={dialogRef}
        aria-labelledby="cell-editor-title"
        onClose={handleCloseDialog}
        style={{
          margin: 'auto',
          padding: 0,
          borderRadius: 18,
          border: '1px solid hsl(var(--border-default))',
          background: 'hsl(var(--bg-surface))',
          color: 'hsl(var(--text-primary))',
          width: 'min(94vw, 560px)',
          maxHeight: '90vh',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
        }}
      >
        {editingKey && (
          <form onSubmit={saveCell} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 12 }}>
              <div>
                <h1 id="cell-editor-title" style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                  {turmaEditing?.nome} • {discEditing?.nome}
                </h1>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '3px 0 0' }}>
                  Configure carga semanal, professores em dupla, distribuição e ambiente
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" onClick={handleCloseDialog} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Aulas / Semana</label>
                <input
                  autoFocus
                  type="number"
                  min={0}
                  max={20}
                  className="form-input"
                  value={formAulas}
                  onChange={e => setFormAulas(Math.max(0, parseInt(e.target.value || '0', 10)))}
                />
              </div>
              <div>
                <label className="form-label">Disposição na Semana</label>
                <select
                  className="form-input"
                  value={formDist}
                  onChange={e => setFormDist(e.target.value as TipoDistribuicao)}
                >
                  {DISTRIBUICAO_OPTS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.desc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seleção Múltipla de Professores (Suporta Aula em Dupla!) */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Professores ({formProfs.length} selecionado{formProfs.length === 1 ? '' : 's'})</span>
                {formProfs.length >= 2 && (
                  <span className="badge badge-purple" style={{ fontSize: 10, padding: '2px 8px' }}>
                    🤝 Aula em Dupla / Co-docência Ativa
                  </span>
                )}
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 6,
                  maxHeight: 170,
                  overflowY: 'auto',
                  padding: 10,
                  borderRadius: 10,
                  background: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-subtle))',
                }}
              >
                {projeto.professores.map(prof => {
                  const selected = formProfs.includes(prof.id)
                  return (
                    <label
                      key={prof.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: selected ? 700 : 500,
                        background: selected ? 'rgba(59,130,246,0.16)' : 'transparent',
                        border: selected ? '1px solid rgba(59,130,246,0.45)' : '1px solid transparent',
                      }}
                    >
                      <input type="checkbox" checked={selected} onChange={() => toggleProfInForm(prof.id)} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prof.nome}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Ambiente / Sala Especial</label>
                <select className="form-input" value={formAmb} onChange={e => setFormAmb(e.target.value)}>
                  <option value="">Sala padrão da turma</option>
                  {projeto.ambientes.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" title="Turmas com o mesmo código de sincronismo terão esta aula exatamente no mesmo dia e horário">
                  Código de Sincronismo (Opcional)
                </label>
                <input
                  className="form-input"
                  placeholder="Ex: ELETIVA-1"
                  value={formSync}
                  onChange={e => setFormSync(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid hsl(var(--border-subtle))' }}>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  onChange({
                    ...projeto,
                    alocacoes: projeto.alocacoes.filter(
                      a => !(a.turmaId === editingKey.turmaId && a.disciplinaId === editingKey.disciplinaId)
                    ),
                  })
                  setEditingKey(null)
                }}
              >
                <Trash2 size={13} /> Zerar Célula
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCloseDialog}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  <Check size={14} /> Salvar Matriz
                </button>
              </div>
            </div>
          </form>
        )}
      </dialog>
    </div>
  )
}
