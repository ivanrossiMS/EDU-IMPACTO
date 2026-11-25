'use client'

import React, { useMemo, useState } from 'react'
import {
  UserCheck,
  Search,
  Plus,
  Trash2,
  Star,
  Ban,
  CheckCircle2,
  Building2,
  Clock,
  Sliders,
} from 'lucide-react'
import {
  DiaSemanaId,
  DIAS_SEMANA_LABELS,
  HorarioProjeto,
  ProfessorHorarioConfig,
  StatusDisponibilidade,
} from '@/lib/horario/types'
import { pickColor } from '@/lib/horario/presets'

interface Props {
  projeto: HorarioProjeto
  onChange: (next: HorarioProjeto) => void
}

const NEXT_STATUS: Record<StatusDisponibilidade, StatusDisponibilidade> = {
  disponivel: 'preferencial',
  preferencial: 'indisponivel',
  indisponivel: 'disponivel',
}

export function ProfessoresRestricoesTab({ projeto, onChange }: Props) {
  const [busca, setBusca] = useState('')
  const [profSelId, setProfSelId] = useState<string>(projeto.professores[0]?.id || '')
  const [novoNome, setNovoNome] = useState('')
  const [pincel, setPincel] = useState<StatusDisponibilidade | 'ciclo'>('ciclo')
  const [modeloGradeId, setModeloGradeId] = useState<string>(projeto.modelosHorario[0]?.id || '')

  const profsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return projeto.professores.filter(p => !q || p.nome.toLowerCase().includes(q))
  }, [projeto.professores, busca])

  const profSel = projeto.professores.find(p => p.id === profSelId) || projeto.professores[0]
  const modeloAtivo = projeto.modelosHorario.find(m => m.id === modeloGradeId) || projeto.modelosHorario[0]

  const cargasPorProf = useMemo(() => {
    const map = new Map<string, number>()
    const activeTurmaIds = new Set(projeto.turmas.filter(t => t.ativa).map(t => t.id))
    for (const al of projeto.alocacoes) {
      if (!activeTurmaIds.has(al.turmaId)) continue
      for (const pid of al.professoresIds) {
        map.set(pid, (map.get(pid) || 0) + (al.aulasSemana || 0))
      }
    }
    return map
  }, [projeto.alocacoes, projeto.turmas])

  const updateProf = (id: string, patch: Partial<ProfessorHorarioConfig>) => {
    onChange({
      ...projeto,
      professores: projeto.professores.map(p => (p.id === id ? { ...p, ...patch } : p)),
    })
  }

  const addProfessor = () => {
    if (!novoNome.trim()) return
    const id = `PR-${Date.now().toString(36).toUpperCase()}`
    const novo: ProfessorHorarioConfig = {
      id,
      nome: novoNome.trim(),
      apelido: novoNome.trim().split(' ').slice(0, 2).join(' '),
      cor: pickColor(novoNome),
      sedePrincipalId: projeto.sedes[0]?.id,
      sedesPermitidas: [],
      maxAulasPorDia: 6,
      maxAulasSemana: 30,
      maxJanelasDia: 1,
      maxDiasSemana: 5,
      tempoDeslocamentoMin: projeto.parametros.tempoDeslocamentoPadraoMin || 30,
      evitarTrocaSedeMesmoTurno: true,
      disponibilidade: {},
    }
    onChange({ ...projeto, professores: [...projeto.professores, novo] })
    setProfSelId(id)
    setNovoNome('')
  }

  const toggleSlot = (prof: ProfessorHorarioConfig, dia: DiaSemanaId, inicio: string, fim: string) => {
    const key = `${dia}_${inicio}-${fim}`
    const current = prof.disponibilidade[key] || prof.disponibilidade[`${dia}_${inicio}`] || 'disponivel'
    const nextVal = pincel === 'ciclo' ? NEXT_STATUS[current] : pincel
    const nextDisp = { ...prof.disponibilidade }
    delete nextDisp[`${dia}_${inicio}`]
    if (nextVal === 'disponivel') {
      delete nextDisp[key]
    } else {
      nextDisp[key] = nextVal
    }
    updateProf(prof.id, { disponibilidade: nextDisp })
  }

  const marcarDiaInteiro = (prof: ProfessorHorarioConfig, dia: DiaSemanaId, status: StatusDisponibilidade) => {
    if (!modeloAtivo) return
    const nextDisp = { ...prof.disponibilidade }
    for (const f of modeloAtivo.faixas) {
      if (f.tipo !== 'aula') continue
      const key = `${dia}_${f.inicio}-${f.fim}`
      delete nextDisp[`${dia}_${f.inicio}`]
      if (status === 'disponivel') delete nextDisp[key]
      else nextDisp[key] = status
    }
    updateProf(prof.id, { disponibilidade: nextDisp })
  }

  const toggleSedePermitida = (prof: ProfessorHorarioConfig, sedeId: string) => {
    const cur = prof.sedesPermitidas || []
    // Se vazio significa "todas"; ao clicar em uma sede pela 1ª vez, inicializa com todas exceto ou só a clicada
    if (cur.length === 0) {
      const next = projeto.sedes.map(s => s.id).filter(id => id !== sedeId)
      updateProf(prof.id, { sedesPermitidas: next })
      return
    }
    const exists = cur.includes(sedeId)
    const next = exists ? cur.filter(id => id !== sedeId) : [...cur, sedeId]
    updateProf(prof.id, { sedesPermitidas: next.length === projeto.sedes.length ? [] : next })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(270px, 320px) 1fr', gap: 16, alignItems: 'start' }}>
      {/* Lista de Professores */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={16} style={{ color: '#3b82f6' }} />
          Docentes ({projeto.professores.length})
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'hsl(var(--text-muted))' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 32, fontSize: 12 }}
            placeholder="Buscar professor..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <input
            className="form-input"
            style={{ fontSize: 12 }}
            placeholder="Novo docente..."
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addProfessor()}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={addProfessor}>
            <Plus size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
          {profsFiltrados.map(p => {
            const active = p.id === profSel?.id
            const carga = cargasPorProf.get(p.id) || 0
            const restricoes = Object.values(p.disponibilidade || {}).filter(v => v === 'indisponivel').length
            const prefs = Object.values(p.disponibilidade || {}).filter(v => v === 'preferencial').length
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProfSelId(p.id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: active ? 'rgba(59,130,246,0.14)' : 'hsl(var(--bg-elevated))',
                  border: active ? '1px solid rgba(59,130,246,0.55)' : '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.cor, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.nome}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', gap: 6 }}>
                      <span>{carga} aulas/sem</span>
                      {restricoes > 0 && <span style={{ color: '#f87171' }}>• {restricoes} bloq.</span>}
                      {prefs > 0 && <span style={{ color: '#fbbf24' }}>• {prefs} pref.</span>}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Painel do Professor Selecionado */}
      {profSel ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Regras & Limites do Professor */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: `${profSel.cor}22`,
                    border: `1px solid ${profSel.cor}55`,
                    color: profSel.cor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 15,
                  }}
                >
                  {profSel.nome.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{profSel.nome}</h3>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                    Carga atribuída na matriz: <strong>{cargasPorProf.get(profSel.id) || 0}</strong> aula(s)/semana
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  const rem = projeto.professores.filter(p => p.id !== profSel.id)
                  onChange({
                    ...projeto,
                    professores: rem,
                    alocacoes: projeto.alocacoes.map(a => ({
                      ...a,
                      professoresIds: a.professoresIds.filter(id => id !== profSel.id),
                    })),
                  })
                  setProfSelId(rem[0]?.id || '')
                }}
              >
                <Trash2 size={13} /> Remover Docente
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div>
                <label className="form-label">Máx. Aulas / Dia</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="form-input"
                  value={profSel.maxAulasPorDia}
                  onChange={e => updateProf(profSel.id, { maxAulasPorDia: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                />
              </div>
              <div>
                <label className="form-label">Máx. Aulas / Semana</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="form-input"
                  value={profSel.maxAulasSemana}
                  onChange={e => updateProf(profSel.id, { maxAulasSemana: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                />
              </div>
              <div>
                <label className="form-label">Máx. Dias na Semana</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  className="form-input"
                  value={profSel.maxDiasSemana}
                  onChange={e => updateProf(profSel.id, { maxDiasSemana: Math.max(1, parseInt(e.target.value || '5', 10)) })}
                />
              </div>
              <div>
                <label className="form-label">Deslocamento Pessoal (min)</label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  className="form-input"
                  value={profSel.tempoDeslocamentoMin}
                  onChange={e => updateProf(profSel.id, { tempoDeslocamentoMin: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                />
              </div>
            </div>

            {projeto.sedes.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingTop: 10, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                <span style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={14} style={{ color: '#60a5fa' }} /> Sedes Permitidas:
                </span>
                {projeto.sedes.map(s => {
                  const allowed = profSel.sedesPermitidas.length === 0 || profSel.sedesPermitidas.includes(s.id)
                  return (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={allowed}
                        onChange={() => toggleSedePermitida(profSel, s.id)}
                      />
                      {s.nome}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Grade de Disponibilidade Clicável */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={15} style={{ color: '#10b981' }} />
                  Disponibilidade & Preferências por Horário
                </h4>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '3px 0 0' }}>
                  Clique nas células para alternar entre Disponível, Preferencial (⭐) e Indisponível (🚫)
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="form-input"
                  style={{ width: 230, fontSize: 12, padding: '6px 10px' }}
                  value={modeloAtivo?.id || ''}
                  onChange={e => setModeloGradeId(e.target.value)}
                >
                  {projeto.modelosHorario.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => updateProf(profSel.id, { disponibilidade: {} })}
                >
                  Liberar Tudo
                </button>
              </div>
            </div>

            {/* Pincel de marcação rápida */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { id: 'ciclo', label: 'Modo Alternar (Clique)', color: '#3b82f6' },
                { id: 'disponivel', label: '🟢 Pintar Disponível', color: '#10b981' },
                { id: 'preferencial', label: '⭐ Pintar Preferencial', color: '#f59e0b' },
                { id: 'indisponivel', label: '🔴 Pintar Indisponível', color: '#ef4444' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPincel(opt.id as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: pincel === opt.id ? `2px solid ${opt.color}` : '1px solid hsl(var(--border-subtle))',
                    background: pincel === opt.id ? `${opt.color}18` : 'hsl(var(--bg-elevated))',
                    color: pincel === opt.id ? opt.color : 'hsl(var(--text-secondary))',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {modeloAtivo && (
              <div tabIndex={0} role="region" aria-label="Grade de disponibilidade do professor" className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 130 }}>Horário</th>
                      {modeloAtivo.diasAtivos.map(dia => (
                        <th key={dia} style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                            <span>{DIAS_SEMANA_LABELS[dia].curto}</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', fontSize: 10, color: '#34d399' }}
                                onClick={() => marcarDiaInteiro(profSel, dia, 'disponivel')}
                                title="Liberar dia inteiro"
                              >
                                Livre
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', fontSize: 10, color: '#f87171' }}
                                onClick={() => marcarDiaInteiro(profSel, dia, 'indisponivel')}
                                title="Bloquear dia inteiro"
                              >
                                Bloq.
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modeloAtivo.faixas
                      .filter(f => f.tipo === 'aula')
                      .map(faixa => (
                        <tr key={faixa.id}>
                          <td style={{ fontWeight: 700, fontSize: 12 }}>
                            <div>{faixa.label || `${faixa.ordem}ª Aula`}</div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                              {faixa.inicio} – {faixa.fim}
                            </div>
                          </td>
                          {modeloAtivo.diasAtivos.map(dia => {
                            const status: StatusDisponibilidade =
                              profSel.disponibilidade[`${dia}_${faixa.inicio}-${faixa.fim}`] ||
                              profSel.disponibilidade[`${dia}_${faixa.inicio}`] ||
                              'disponivel'

                            const ui =
                              status === 'indisponivel'
                                ? { bg: 'rgba(239,68,68,0.16)', border: 'rgba(239,68,68,0.45)', color: '#f87171', label: 'Indisponível', icon: <Ban size={13} /> }
                                : status === 'preferencial'
                                ? { bg: 'rgba(245,158,11,0.16)', border: 'rgba(245,158,11,0.45)', color: '#fbbf24', label: 'Preferencial', icon: <Star size={13} /> }
                                : { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: '#34d399', label: 'Disponível', icon: <CheckCircle2 size={13} /> }

                            return (
                              <td key={dia} style={{ padding: 6, textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => toggleSlot(profSel, dia, faixa.inicio, faixa.fim)}
                                  style={{
                                    width: '100%',
                                    padding: '10px 8px',
                                    borderRadius: 10,
                                    background: ui.bg,
                                    border: `1px solid ${ui.border}`,
                                    color: ui.color,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 5,
                                    transition: 'transform 0.12s',
                                  }}
                                >
                                  {ui.icon}
                                  <span>{ui.label}</span>
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          Adicione ao menos um professor para configurar disponibilidades.
        </div>
      )}
    </div>
  )
}
