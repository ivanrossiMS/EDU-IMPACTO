'use client'
import { useData, RotinaItem, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { Save, Download, Check, Filter } from 'lucide-react'

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
const DIA_IDX: Record<string, 1 | 2 | 3 | 4 | 5> = { Segunda: 1, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5 }
const SLOTS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

const DISC_COLORS: Record<string, string> = {
  'Matemática': '#3b82f6', 'Português': '#10b981', 'História': '#f59e0b',
  'Geografia': '#8b5cf6', 'Ciências': '#06b6d4', 'Ed. Física': '#ef4444',
  'Arte': '#ec4899', 'Inglês': '#a78bfa', 'Filosofia': '#84cc16', 'Sociologia': '#f97316',
}

export default function HorarioAulasPage() {
  const { turmas, rotinaItems, setRotinaItems, cfgDisciplinas } = useData()

  // Filtros
  const anosLetivos = useMemo(() => {
    const anos = turmas.map(t => (t as any).anoLetivo || String(new Date().getFullYear())).filter(Boolean)
    return [...new Set(anos)].sort().reverse()
  }, [turmas])
  const [anoFiltro, setAnoFiltro] = useState(() => String(new Date().getFullYear()))
  const [segFiltro, setSegFiltro] = useState('todos')

  const turmasFiltradas = useMemo(() =>
    turmas.filter(t => {
      if (anoFiltro && (t as any).anoLetivo && (t as any).anoLetivo !== anoFiltro) return false
      if (segFiltro !== 'todos' && (t as any).segmento && (t as any).segmento !== segFiltro) return false
      return true
    })
  , [turmas, anoFiltro, segFiltro])

  const segmentos = useMemo(() => {
    const segs = turmas.map(t => (t as any).segmento).filter(Boolean)
    return [...new Set(segs)]
  }, [turmas])

  const [turmaSel, setTurmaSel] = useState(() => turmas[0]?.id ?? '')
  const [editCell, setEditCell] = useState<{ dia: string; slot: string } | null>(null)
  const [cellForm, setCellForm] = useState({ disciplina: '', professor: '', sala: '' })
  const [salvo, setSalvo] = useState(false)

  const disciplinas = cfgDisciplinas.length > 0
    ? cfgDisciplinas.map(d => d.nome)
    : Object.keys(DISC_COLORS)

  const getCell = (dia: string, slot: string): RotinaItem | undefined => {
    return rotinaItems.find(r =>
      r.turma === turmaSel &&
      r.diaSemana === DIA_IDX[dia] &&
      r.horaInicio === slot
    )
  }

  const handleCellClick = (dia: string, slot: string) => {
    const cell = getCell(dia, slot)
    setCellForm({ disciplina: cell?.disciplina ?? '', professor: cell?.professor ?? '', sala: cell?.sala ?? '' })
    setEditCell({ dia, slot })
  }

  const handleCellSave = () => {
    if (!editCell) return
    const { dia, slot } = editCell
    const key = DIA_IDX[dia]
    const hora = `${parseInt(slot.split(':')[0]) + 1}:00`

    setRotinaItems(prev => {
      const filtered = prev.filter(r => !(r.turma === turmaSel && r.diaSemana === key && r.horaInicio === slot))
      if (!cellForm.disciplina) return filtered
      const novo: RotinaItem = {
        id: newId('RT'), turma: turmaSel, diaSemana: key,
        horaInicio: slot, horaFim: hora,
        disciplina: cellForm.disciplina, professor: cellForm.professor,
        sala: cellForm.sala, tipo: 'aula',
        cor: DISC_COLORS[cellForm.disciplina] ?? '#6b7280',
      }
      return [...filtered, novo]
    })
    setEditCell(null)
  }

  const handleClearCell = () => {
    if (!editCell) return
    const { dia, slot } = editCell
    setRotinaItems(prev => prev.filter(r => !(r.turma === turmaSel && r.diaSemana === DIA_IDX[dia] && r.horaInicio === slot)))
    setEditCell(null)
  }

  const totalAulas = rotinaItems.filter(r => r.turma === turmaSel).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Horário de Aulas</h1>
          <p className="page-subtitle">Grade semanal por turma — clique em uma célula para editar</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Filtro Ano Letivo */}
          <select className="form-input" style={{ width: 120 }} value={anoFiltro} onChange={e => setAnoFiltro(e.target.value)}>
            <option value="">Todos os anos</option>
            {anosLetivos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {/* Filtro Segmento */}
          {segmentos.length > 0 && (
            <select className="form-input" style={{ width: 150 }} value={segFiltro} onChange={e => setSegFiltro(e.target.value)}>
              <option value="todos">Todos segmentos</option>
              {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {/* Selector Turma (filtrada) */}
          {turmasFiltradas.length > 0 && (
            <select className="form-input" style={{ width: 170 }} value={turmaSel} onChange={e => setTurmaSel(e.target.value)}>
              {turmasFiltradas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar PDF</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setSalvo(true); setTimeout(() => setSalvo(false), 2000) }}>
            {salvo ? <><Check size={13} color="#34d399" />Salvo!</> : <><Save size={13} />Salvar Horário</>}
          </button>
        </div>
        </div>
      </div>

      {turmasFiltradas.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            {turmas.length === 0 ? 'Nenhuma turma cadastrada' : 'Nenhuma turma com esses filtros'}
          </div>
          <div style={{ fontSize: 13 }}>
            {turmas.length === 0 ? 'Cadastre turmas em Acadêmico → Turmas para configurar o horário.' : 'Ajuste os filtros de ano letivo ou segmento.'}
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            Turma <strong style={{ color: '#60a5fa' }}>{turmasFiltradas.find(t => t.id === turmaSel)?.nome || turmas.find(t => t.id === turmaSel)?.nome}</strong>
            {anoFiltro && <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontSize: 11, fontWeight: 700 }}>📅 {anoFiltro}</span>}
            · {totalAulas} aulas configuradas
            · {turmasFiltradas.length} turma(s) no filtro
          </div>

          {/* Edit popup */}
          {editCell && (
            <div className="card" style={{ padding: '16px', marginBottom: 14, border: '1px solid rgba(59,130,246,0.4)', maxWidth: 500, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, fontWeight: 700, width: '100%', color: '#60a5fa' }}>
                {editCell.dia} — {editCell.slot} às {`${parseInt(editCell.slot.split(':')[0]) + 1}:00`}
              </div>
              <div style={{ flex: 2, minWidth: 160 }}>
                <label className="form-label">Disciplina</label>
                <select className="form-input" value={cellForm.disciplina} onChange={e => setCellForm(p => ({ ...p, disciplina: e.target.value }))}>
                  <option value="">(livre / intervalo)</option>
                  {disciplinas.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div style={{ flex: 2, minWidth: 140 }}>
                <label className="form-label">Professor(a)</label>
                <input className="form-input" value={cellForm.professor} onChange={e => setCellForm(p => ({ ...p, professor: e.target.value }))} placeholder="Nome do professor" />
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label className="form-label">Sala</label>
                <input className="form-input" value={cellForm.sala} onChange={e => setCellForm(p => ({ ...p, sala: e.target.value }))} placeholder="101" />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={handleClearCell}>Limpar</button>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setEditCell(null)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={handleCellSave}><Check size={11} />OK</button>
              </div>
            </div>
          )}

          {/* Grade */}
          <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700, width: 85, background: 'hsl(var(--bg-elevated))' }}>Horário</th>
                  {DIAS.map(d => (
                    <th key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 700, background: 'hsl(var(--bg-elevated))' }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.slice(0, -1).map((slot, si) => (
                  <tr key={slot} style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
                    <td style={{ padding: '6px 14px', fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600, whiteSpace: 'nowrap', background: 'hsl(var(--bg-elevated))' }}>
                      {slot}–{SLOTS[si + 1]}
                    </td>
                    {DIAS.map(dia => {
                      const cell = getCell(dia, slot)
                      const cor = cell ? (DISC_COLORS[cell.disciplina] ?? '#6b7280') : 'transparent'
                      const isEditing = editCell?.dia === dia && editCell?.slot === slot
                      return (
                        <td key={dia} style={{ padding: '4px', textAlign: 'center' }}>
                          <div onClick={() => handleCellClick(dia, slot)}
                            style={{
                              minHeight: 52, padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
                              background: cell ? `${cor}18` : isEditing ? 'rgba(59,130,246,0.08)' : 'transparent',
                              border: isEditing ? `1px solid rgba(59,130,246,0.5)` : `1px solid ${cell ? `${cor}40` : 'hsl(var(--border-subtle))'}`,
                              transition: 'all 0.15s',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${cor}28`; e.currentTarget.style.borderColor = `${cor}60` }}
                            onMouseLeave={e => { e.currentTarget.style.background = cell ? `${cor}18` : 'transparent'; e.currentTarget.style.borderColor = cell ? `${cor}40` : 'hsl(var(--border-subtle))' }}
                          >
                            {cell ? (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: cor }}>{cell.disciplina}</div>
                                {cell.professor && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{cell.professor.split(' ').slice(-1)[0]}</div>}
                                {cell.sala && <div style={{ fontSize: 9, color: 'hsl(var(--text-disabled))', fontWeight: 600 }}>{cell.sala}</div>}
                              </>
                            ) : (
                              <div style={{ fontSize: 10, color: 'hsl(var(--text-disabled))' }}>+</div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legenda */}
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(DISC_COLORS).map(([d, c]) => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{d}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
