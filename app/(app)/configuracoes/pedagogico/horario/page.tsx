'use client'
import { useData, RotinaItem, newId } from '@/lib/dataContext'
import { useState, useMemo, useEffect } from 'react'
import { Save, Download, Check, Filter, Plus, Edit2, Trash2, Clock, CheckCircle2, AlertCircle, Users, ChevronLeft, Calendar } from 'lucide-react'

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
const DIA_IDX: Record<string, 1 | 2 | 3 | 4 | 5> = { Segunda: 1, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5 }

interface TimeSlot {
  id: string
  inicio: string
  fim: string
  tipo: 'aula' | 'intervalo'
}

const DEFAULT_SLOTS: TimeSlot[] = [
  { id: 's1', inicio: '07:00', fim: '07:50', tipo: 'aula' },
  { id: 's2', inicio: '07:50', fim: '08:40', tipo: 'aula' },
  { id: 's3', inicio: '08:40', fim: '09:30', tipo: 'aula' },
  { id: 's4', inicio: '09:30', fim: '09:50', tipo: 'intervalo' },
  { id: 's5', inicio: '09:50', fim: '10:40', tipo: 'aula' },
  { id: 's6', inicio: '10:40', fim: '11:30', tipo: 'aula' },
]

function getColorFromName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

export default function HorarioAulasPage() {
  const { turmas, rotinaItems, setRotinaItems, cfgDisciplinas } = useData()

  // Navigation State
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista')
  const [turmaSel, setTurmaSel] = useState<string | null>(null)

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

  // Custom Grade State (Persisted in localStorage per client visual preferences)
  const [grade, setGrade] = useState<Record<string, TimeSlot[]>>({})
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem('edu-horarios-grade')
      if (stored) setGrade(JSON.parse(stored))
    } catch(e) {}
  }, [])

  const saveGrade = (newGrade: Record<string, TimeSlot[]>) => {
    setGrade(newGrade)
    localStorage.setItem('edu-horarios-grade', JSON.stringify(newGrade))
  }

  const currentSlots = useMemo(() => turmaSel ? (grade[turmaSel] || DEFAULT_SLOTS) : [], [grade, turmaSel])

  // Cell Editing
  const [editCell, setEditCell] = useState<{ dia: string; slotId: string } | null>(null)
  const [cellForm, setCellForm] = useState({ disciplina: '', professor: '', sala: '' })

  // Row Editing
  const [editRowId, setEditRowId] = useState<string | null>(null)
  const [rowForm, setRowForm] = useState<TimeSlot | null>(null)

  const [salvo, setSalvo] = useState(false)

  const disciplinas = cfgDisciplinas.length > 0
    ? Array.from(new Set(cfgDisciplinas.map(d => d.nome)))
    : ['Matemática', 'Português', 'História', 'Geografia', 'Ciências', 'Ed. Física', 'Arte', 'Inglês']

  const getCell = (dia: string, startTime: string): RotinaItem | undefined => {
    if (!turmaSel) return undefined
    return rotinaItems.find(r =>
      r.turma === turmaSel &&
      r.diaSemana === DIA_IDX[dia] &&
      r.horaInicio === startTime
    )
  }

  const handleCellClick = (dia: string, slotId: string, startTime: string) => {
    const cell = getCell(dia, startTime)
    setCellForm({ disciplina: cell?.disciplina ?? '', professor: cell?.professor ?? '', sala: cell?.sala ?? '' })
    setEditCell({ dia, slotId })
  }

  const handleCellSave = () => {
    if (!editCell || !turmaSel) return
    const { dia, slotId } = editCell
    const slot = currentSlots.find(s => s.id === slotId)
    if (!slot) return

    const key = DIA_IDX[dia]
    
    setRotinaItems(prev => {
      const filtered = prev.filter(r => !(r.turma === turmaSel && r.diaSemana === key && r.horaInicio === slot.inicio))
      if (!cellForm.disciplina) return filtered
      const cor = getColorFromName(cellForm.disciplina)
      const novo: RotinaItem = {
        id: newId('RT'), turma: turmaSel, diaSemana: key,
        horaInicio: slot.inicio, horaFim: slot.fim,
        disciplina: cellForm.disciplina, professor: cellForm.professor,
        sala: cellForm.sala, tipo: 'aula',
        cor: cor,
      }
      return [...filtered, novo]
    })
    setEditCell(null)
  }

  const handleClearCell = () => {
    if (!editCell || !turmaSel) return
    const { dia, slotId } = editCell
    const slot = currentSlots.find(s => s.id === slotId)
    if (slot) {
      setRotinaItems(prev => prev.filter(r => !(r.turma === turmaSel && r.diaSemana === DIA_IDX[dia] && r.horaInicio === slot.inicio)))
    }
    setEditCell(null)
  }

  // ---- ROW MANAGEMENT ---- //
  
  const handleEditRowClick = (slot: TimeSlot) => {
    setEditRowId(slot.id)
    setRowForm({ ...slot })
  }

  const handleSaveRow = () => {
    if (!rowForm || !editRowId || !turmaSel) return
    const oldSlot = currentSlots.find(s => s.id === editRowId)
    if (!oldSlot) return
    
    const newSlots = currentSlots.map(s => s.id === editRowId ? rowForm : s)
    saveGrade({ ...grade, [turmaSel]: newSlots })

    if (oldSlot.inicio !== rowForm.inicio || oldSlot.fim !== rowForm.fim) {
      setRotinaItems(prev => prev.map(r => {
        if (r.turma === turmaSel && r.horaInicio === oldSlot.inicio) {
          return { ...r, horaInicio: rowForm.inicio, horaFim: rowForm.fim }
        }
        return r
      }))
    }
    setEditRowId(null)
  }

  const handleDeleteRow = (id: string, oldInicio: string) => {
    if (!turmaSel) return
    if (confirm('Tem certeza? Todas as aulas cadastradas nesta linha também serão apagadas.')) {
      const newSlots = currentSlots.filter(s => s.id !== id)
      saveGrade({ ...grade, [turmaSel]: newSlots })
      setRotinaItems(prev => prev.filter(r => !(r.turma === turmaSel && r.horaInicio === oldInicio)))
      setEditRowId(null)
    }
  }

  const handleCreateRow = () => {
    if (!turmaSel) return
    const lastSlot = currentSlots[currentSlots.length - 1]
    const novoInicio = lastSlot ? lastSlot.fim : '07:00'
    let nextH = parseInt(novoInicio.split(':')[0])
    let nextM = parseInt(novoInicio.split(':')[1]) + 50
    if (nextM >= 60) { nextM -= 60; nextH += 1; }
    const novoFim = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`

    const newRow: TimeSlot = { id: newId('SLOT'), inicio: novoInicio, fim: novoFim, tipo: 'aula' }
    saveGrade({ ...grade, [turmaSel]: [...currentSlots, newRow] })
    setEditRowId(newRow.id)
    setRowForm(newRow)
  }

  const openTurma = (id: string) => {
    setTurmaSel(id);
    setViewMode('grade');
    setEditCell(null);
    setEditRowId(null);
  }

  const closeTurma = () => {
    setTurmaSel(null);
    setViewMode('lista');
  }

  // LIST VIEW
  if (viewMode === 'lista') {
    return (
      <div className="page-container animation-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Grade de Horários</h1>
            <p className="page-subtitle">Selecione uma turma para organizar e gerenciar a grade de aulas</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-input" style={{ width: 120 }} value={anoFiltro} onChange={e => setAnoFiltro(e.target.value)}>
              <option value="">Todos anos</option>
              {anosLetivos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {segmentos.length > 0 && (
              <select className="form-input" style={{ width: 150 }} value={segFiltro} onChange={e => setSegFiltro(e.target.value)}>
                <option value="todos">Todos segmentos</option>
                {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
        </div>

        {turmasFiltradas.length === 0 ? (
          <div className="card" style={{ padding: '64px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'hsl(var(--text-primary))' }}>
              Nenhuma turma encontrada
            </div>
            <div style={{ fontSize: 14 }}>
              Cadastre as turmas no Acadêmico ou revise os filtros de ano/segmento.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {turmasFiltradas.map(turma => {
              const aulasConfiguradas = rotinaItems.filter(r => r.turma === turma.id).length
              const nomeSegmento = (turma as any).segmento || 'Segmento não definido'
              
              return (
                <div key={turma.id} onClick={() => openTurma(turma.id)} className="card hover-card" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#3b82f6' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{(turma as any).anoLetivo || anoFiltro}</div>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))' }}>{turma.nome}</h3>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                      <Calendar size={20} />
                    </div>
                  </div>
                  
                  <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Segmento:</span>
                      <strong style={{ color: 'hsl(var(--text-secondary))' }}>{nomeSegmento}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Turno:</span>
                      <strong style={{ color: 'hsl(var(--text-secondary))' }}>{(turma as any).turno || 'Geral'}</strong>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: aulasConfiguradas > 0 ? '#10b981' : '#f59e0b' }}>
                      <CheckCircle2 size={14} />
                      {aulasConfiguradas > 0 ? `${aulasConfiguradas} aulas salvas` : 'Pendente de grade'}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>Abrir Grade →</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // DETAIL VIEW (Grade)
  const totalAulas = rotinaItems.filter(r => r.turma === turmaSel).length
  const nomeTurmaAtual = turmas.find(t => t.id === turmaSel)?.nome || ''

  return (
    <div className="page-container animation-fade-in">
      <div className="page-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
          <button className="btn btn-ghost btn-icon" onClick={closeTurma} style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))' }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ paddingTop: '2px' }}>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              Turma {nomeTurmaAtual}
            </h1>
            <p className="page-subtitle">Personalize as linhas de tempo, aulas e intervalos nesta grade</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar Grade</button>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: '20px 0 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: '0 4px' }}>
        <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 12, fontWeight: 800 }}>📅 Grade Semanal Oficial</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> {totalAulas} blocos de aulas</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6' }} /> {currentSlots.length} linhas de fuso de tempo</span>
      </div>

      {/* Célula Pop-up Edition */}
      {editCell && (
        <div className="card shadow-lg animation-fade-in" style={{ padding: '16px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.4)', background: 'hsl(var(--bg-elevated))', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', zIndex: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, width: '100%', color: '#3b82f6', marginBottom: -4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} /> Editando bloco {editCell.dia} ({currentSlots.find(s => s.id === editCell.slotId)?.inicio} – {currentSlots.find(s => s.id === editCell.slotId)?.fim})
          </div>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label className="form-label">Disciplina Oficial</label>
            <select className="form-input" value={cellForm.disciplina} onChange={e => setCellForm(p => ({ ...p, disciplina: e.target.value }))}>
              <option value="">(livre / excluir bloco)</option>
              {disciplinas.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 140 }}>
            <label className="form-label">Professor Solicitado</label>
            <input className="form-input" value={cellForm.professor} onChange={e => setCellForm(p => ({ ...p, professor: e.target.value }))} placeholder="Ex: Ana Silva" />
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <label className="form-label">Sala Predial</label>
            <input className="form-input" value={cellForm.sala} onChange={e => setCellForm(p => ({ ...p, sala: e.target.value }))} placeholder="Ex: 101" />
          </div>
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end', paddingBottom: 2 }}>
            <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={handleClearCell}>Destituir</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditCell(null)}>Ocultar</button>
            <button className="btn btn-primary btn-sm" onClick={handleCellSave}><Check size={14} />Confirmar</button>
          </div>
        </div>
      )}

      {/* Grade Tabela Principal */}
      <div className="card" style={{ padding: '0', overflowX: 'auto', border: '1px solid hsl(var(--border-subtle))' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'hsl(var(--bg-overlay))' }}>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 800, width: 140, borderBottom: '2px solid rgba(59,130,246,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FUSO HORÁRIO</th>
              {DIAS.map(d => (
                <th key={d} style={{ padding: '16px 8px', textAlign: 'center', fontSize: 13, color: 'hsl(var(--text-primary))', fontWeight: 800, borderBottom: '2px solid rgba(59,130,246,0.3)' }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentSlots.map((slot, index) => {
              const isEditingRow = editRowId === slot.id

              // Modo de edição da ROW
              if (isEditingRow && rowForm) {
                return (
                  <tr key={slot.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: 'rgba(59,130,246,0.04)' }}>
                    <td colSpan={6} style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 11 }}>Emissão</label>
                          <input type="time" className="form-input" style={{ width: 120 }} value={rowForm.inicio} onChange={e => setRowForm({ ...rowForm, inicio: e.target.value })} />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 11 }}>Corte</label>
                          <input type="time" className="form-input" style={{ width: 120 }} value={rowForm.fim} onChange={e => setRowForm({ ...rowForm, fim: e.target.value })} />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 11 }}>Função da Linha</label>
                          <select className="form-input" style={{ width: 180 }} value={rowForm.tipo} onChange={e => setRowForm({ ...rowForm, tipo: e.target.value as 'aula' | 'intervalo' })}>
                            <option value="aula">Estudo Disciplinar</option>
                            <option value="intervalo">Descanso (Recreio)</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost btn-icon" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5' }} onClick={() => handleDeleteRow(slot.id, slot.inicio)} title="Destruir o Fuso Inteiro"><Trash2 size={16} /></button>
                          <button className="btn btn-secondary" onClick={() => setEditRowId(null)}>Retrair</button>
                          <button className="btn btn-primary" onClick={handleSaveRow}><CheckCircle2 size={16} /> Gravar Linha</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              }

              // INTERVALO Row
              if (slot.tipo === 'intervalo') {
                return (
                  <tr key={slot.id} style={{ background: 'hsl(var(--bg-overlay))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                    <td style={{ padding: '12px 16px', borderRight: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.02em', fontFamily: '"Outfit", sans-serif' }}>{slot.inicio}<span style={{opacity:0.5, fontWeight:400, margin:'0 4px'}}>-</span>{slot.fim}</span>
                          <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transição</span>
                        </div>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEditRowClick(slot)} style={{ transform: 'scale(0.85)', opacity: 0.6 }} title="Ajuste fino da hora"><Edit2 size={14} /></button>
                      </div>
                    </td>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '16px', background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(245,158,11,0.03) 10px, rgba(245,158,11,0.03) 20px)' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: 16, letterSpacing: '0.4em', opacity: 0.6, width: '100%', textShadow: '1px 1px 0px rgba(245,158,11,0.1)' }}>
                        I N T E R V A L O
                      </div>
                    </td>
                  </tr>
                )
              }

              // AULA NORMAL Row
              return (
                <tr key={slot.id} style={{ borderBottom: index < currentSlots.length - 1 ? '1px solid hsl(var(--border-subtle))' : 'none', transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px', background: 'hsl(var(--bg-elevated))', borderRight: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))', fontFamily: '"Outfit", sans-serif' }}>{slot.inicio}<span style={{opacity:0.4, fontWeight:400, margin:'0 4px'}}>-</span>{slot.fim}</span>
                        <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Academico</span>
                      </div>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEditRowClick(slot)} style={{ transform: 'scale(0.85)', opacity: 0.3 }} title="Ajustar limite"><Edit2 size={14} /></button>
                    </div>
                  </td>
                  
                  {DIAS.map(dia => {
                    const cell = getCell(dia, slot.inicio)
                    const isEditing = editCell?.dia === dia && editCell?.slotId === slot.id
                    return (
                      <td key={dia} style={{ padding: '6px', textAlign: 'center', width: '16%' }}>
                        <div onClick={() => handleCellClick(dia, slot.id, slot.inicio)}
                          style={{
                            height: '100%', minHeight: 76, padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                            background: cell ? `${cell.cor}15` : isEditing ? 'rgba(59,130,246,0.1)' : 'transparent',
                            border: isEditing ? `2px solid rgba(59,130,246,0.7)` : `2px solid ${cell ? `${cell.cor}30` : 'transparent'}`,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                            boxShadow: isEditing ? '0 0 0 4px rgba(59,130,246,0.15)' : 'none'
                          }}
                          onMouseEnter={e => { 
                            if (!isEditing) {
                              e.currentTarget.style.background = cell ? `${cell.cor}25` : 'hsl(var(--bg-overlay))'
                              if (!cell) e.currentTarget.style.borderColor = 'hsl(var(--border-default))'
                            }
                          }}
                          onMouseLeave={e => { 
                            if (!isEditing) {
                              e.currentTarget.style.background = cell ? `${cell.cor}15` : 'transparent'
                              e.currentTarget.style.borderColor = cell ? `${cell.cor}30` : 'transparent'
                            }
                          }}
                        >
                          {cell ? (
                            <>
                              <div style={{ fontSize: 13, fontWeight: 800, color: cell.cor, lineHeight: 1.1, textAlign: 'center', padding: '0 4px' }}>{cell.disciplina}</div>
                              {cell.professor && <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600, marginTop: 2 }}>{cell.professor.split(' ').slice(-1)[0]}</div>}
                              {cell.sala && <div style={{ fontSize: 9, color: 'hsl(var(--text-disabled))', fontWeight: 800, padding: '3px 8px', background: `${cell.cor}20`, borderRadius: 6, marginTop: 4 }}>SALA {cell.sala}</div>}
                            </>
                          ) : (
                            <div style={{ fontSize: 20, color: 'hsl(var(--text-disabled))', fontWeight: 300, opacity: 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'hsl(var(--bg-elevated))' }}>+</div>
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
      
      {/* Botões do Rodapé */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 16 }}>
          <button className="btn btn-secondary" onClick={handleCreateRow} style={{ borderStyle: 'dashed', borderWidth: '2px', background: 'transparent', height: 48, padding: '0 24px', borderRadius: 16 }}>
            <Plus size={18} /> Projetar Novo Fuso Horário de Linha
          </button>
      </div>
    </div>
  )
}
