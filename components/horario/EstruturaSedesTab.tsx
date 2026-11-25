'use client'

import React, { useState } from 'react'
import {
  Building2,
  Clock,
  Plus,
  Trash2,
  MapPin,
  Layers,
  FlaskConical,
  ArrowRightLeft,
  CalendarDays,
  Check,
  Edit2,
} from 'lucide-react'
import {
  AmbienteRecurso,
  CampusSede,
  DiaSemanaId,
  DIAS_SEMANA_LABELS,
  FaixaHorario,
  HorarioProjeto,
  ModeloHorario,
  TipoAmbiente,
} from '@/lib/horario/types'
import { pickColor } from '@/lib/horario/presets'

interface Props {
  projeto: HorarioProjeto
  onChange: (next: HorarioProjeto) => void
}

const TIPOS_AMBIENTE: Array<{ value: TipoAmbiente; label: string }> = [
  { value: 'sala_comum', label: 'Sala Comum' },
  { value: 'quadra', label: 'Quadra de Esportes' },
  { value: 'laboratorio', label: 'Laboratório' },
  { value: 'informatica', label: 'Informática / Robótica' },
  { value: 'auditorio', label: 'Auditório' },
  { value: 'artes', label: 'Sala de Artes / Música' },
  { value: 'outro', label: 'Outro Ambiente' },
]

export function EstruturaSedesTab({ projeto, onChange }: Props) {
  const [novaSedeNome, setNovaSedeNome] = useState('')
  const [novoAmbNome, setNovoAmbNome] = useState('')
  const [novoAmbTipo, setNovoAmbTipo] = useState<TipoAmbiente>('quadra')
  const [novoAmbSede, setNovoAmbSede] = useState(projeto.sedes[0]?.id || '')
  const [novoAmbCap, setNovoAmbCap] = useState(1)

  const [modeloSelId, setModeloSelId] = useState<string>(projeto.modelosHorario[0]?.id || '')
  const [novoModeloNome, setNovoModeloNome] = useState('')
  const [novoModeloTurno, setNovoModeloTurno] = useState('Matutino')

  const [novaTurmaNome, setNovaTurmaNome] = useState('')
  const [novaTurmaTurno, setNovaTurmaTurno] = useState('Matutino')
  const [novaTurmaSede, setNovaTurmaSede] = useState(projeto.sedes[0]?.id || '')
  const [novaTurmaModelo, setNovaTurmaModelo] = useState(projeto.modelosHorario[0]?.id || '')

  const modeloAtivo = projeto.modelosHorario.find(m => m.id === modeloSelId) || projeto.modelosHorario[0]

  // ── Sedes ──
  const addSede = () => {
    if (!novaSedeNome.trim()) return
    const id = `SEDE-${Date.now().toString(36).toUpperCase()}`
    const nova: CampusSede = {
      id,
      nome: novaSedeNome.trim(),
      cor: pickColor(novaSedeNome),
    }
    onChange({ ...projeto, sedes: [...projeto.sedes, nova] })
    setNovaSedeNome('')
  }

  const removeSede = (id: string) => {
    if (projeto.sedes.length <= 1) return
    const remaining = projeto.sedes.filter(s => s.id !== id)
    const fallbackId = remaining[0].id
    onChange({
      ...projeto,
      sedes: remaining,
      turmas: projeto.turmas.map(t => (t.unidadeId === id ? { ...t, unidadeId: fallbackId } : t)),
      ambientes: projeto.ambientes.map(a => (a.unidadeId === id ? { ...a, unidadeId: fallbackId } : a)),
    })
  }

  const updateDeslocamento = (sedeA: string, sedeB: string, minutos: number) => {
    const key = `${sedeA}__${sedeB}`
    const revKey = `${sedeB}__${sedeA}`
    const next = { ...projeto.matrizDeslocamento }
    next[key] = Math.max(0, minutos)
    next[revKey] = Math.max(0, minutos)
    onChange({ ...projeto, matrizDeslocamento: next })
  }

  // ── Modelos de Horário ──
  const addModelo = () => {
    if (!novoModeloNome.trim()) return
    const id = `MOD-${Date.now().toString(36).toUpperCase()}`
    const inicioBase = novoModeloTurno === 'Vespertino' ? '13:00' : novoModeloTurno === 'Noturno' ? '19:00' : '07:00'
    const novo: ModeloHorario = {
      id,
      nome: novoModeloNome.trim(),
      turno: novoModeloTurno,
      diasAtivos: [1, 2, 3, 4, 5],
      faixas: [
        { id: `${id}-1`, ordem: 1, inicio: inicioBase, fim: addMinutesStr(inicioBase, 50), tipo: 'aula', label: '1ª Aula' },
        { id: `${id}-2`, ordem: 2, inicio: addMinutesStr(inicioBase, 50), fim: addMinutesStr(inicioBase, 100), tipo: 'aula', label: '2ª Aula' },
        { id: `${id}-3`, ordem: 3, inicio: addMinutesStr(inicioBase, 100), fim: addMinutesStr(inicioBase, 150), tipo: 'aula', label: '3ª Aula' },
        { id: `${id}-int`, ordem: 99, inicio: addMinutesStr(inicioBase, 150), fim: addMinutesStr(inicioBase, 170), tipo: 'intervalo', label: 'Intervalo' },
        { id: `${id}-4`, ordem: 4, inicio: addMinutesStr(inicioBase, 170), fim: addMinutesStr(inicioBase, 220), tipo: 'aula', label: '4ª Aula' },
        { id: `${id}-5`, ordem: 5, inicio: addMinutesStr(inicioBase, 220), fim: addMinutesStr(inicioBase, 270), tipo: 'aula', label: '5ª Aula' },
      ],
    }
    onChange({ ...projeto, modelosHorario: [...projeto.modelosHorario, novo] })
    setModeloSelId(id)
    setNovoModeloNome('')
  }

  const updateModelo = (id: string, patch: Partial<ModeloHorario>) => {
    onChange({
      ...projeto,
      modelosHorario: projeto.modelosHorario.map(m => (m.id === id ? { ...m, ...patch } : m)),
    })
  }

  const toggleDiaModelo = (modelo: ModeloHorario, dia: DiaSemanaId) => {
    const exists = modelo.diasAtivos.includes(dia)
    const nextDias = exists
      ? modelo.diasAtivos.filter(d => d !== dia)
      : ([...modelo.diasAtivos, dia].sort((a, b) => a - b) as DiaSemanaId[])
    if (nextDias.length === 0) return
    updateModelo(modelo.id, { diasAtivos: nextDias })
  }

  const addFaixa = (modelo: ModeloHorario, tipo: 'aula' | 'intervalo') => {
    const last = modelo.faixas[modelo.faixas.length - 1]
    const inicio = last ? last.fim : '07:00'
    const duracao = tipo === 'intervalo' ? 20 : 50
    const fim = addMinutesStr(inicio, duracao)
    const aulaCount = modelo.faixas.filter(f => f.tipo === 'aula').length
    const nova: FaixaHorario = {
      id: `FX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      ordem: tipo === 'aula' ? aulaCount + 1 : 99,
      inicio,
      fim,
      tipo,
      label: tipo === 'aula' ? `${aulaCount + 1}ª Aula` : 'Intervalo',
    }
    updateModelo(modelo.id, { faixas: renumberFaixas([...modelo.faixas, nova]) })
  }

  const updateFaixa = (modelo: ModeloHorario, faixaId: string, patch: Partial<FaixaHorario>) => {
    const updated = modelo.faixas.map(f => (f.id === faixaId ? { ...f, ...patch } : f))
    updateModelo(modelo.id, { faixas: renumberFaixas(updated) })
  }

  const removeFaixa = (modelo: ModeloHorario, faixaId: string) => {
    const updated = modelo.faixas.filter(f => f.id !== faixaId)
    updateModelo(modelo.id, { faixas: renumberFaixas(updated) })
  }

  // ── Ambientes ──
  const addAmbiente = () => {
    if (!novoAmbNome.trim()) return
    const novo: AmbienteRecurso = {
      id: `AMB-${Date.now().toString(36).toUpperCase()}`,
      nome: novoAmbNome.trim(),
      tipo: novoAmbTipo,
      unidadeId: novoAmbSede || projeto.sedes[0]?.id || '',
      capacidadeSimultanea: Math.max(1, novoAmbCap),
    }
    onChange({ ...projeto, ambientes: [...projeto.ambientes, novo] })
    setNovoAmbNome('')
  }

  // ── Turmas ──
  const addTurmaRapida = () => {
    if (!novaTurmaNome.trim()) return
    const id = `TUR-${Date.now().toString(36).toUpperCase()}`
    onChange({
      ...projeto,
      turmas: [
        ...projeto.turmas,
        {
          id,
          nome: novaTurmaNome.trim(),
          turno: novaTurmaTurno,
          unidadeId: novaTurmaSede || projeto.sedes[0]?.id || '',
          modeloHorarioId: novaTurmaModelo || projeto.modelosHorario[0]?.id || '',
          cor: pickColor(novaTurmaNome),
          ativa: true,
        },
      ],
    })
    setNovaTurmaNome('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ROW 1: Sedes & Deslocamento + Ambientes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
        {/* Sedes e Matriz de Deslocamento */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Building2 size={17} style={{ color: '#3b82f6' }} />
                Sedes / Unidades & Deslocamento
              </h3>
              <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0' }}>
                Gerencie múltiplas sedes e o tempo mínimo de deslocamento entre elas
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              className="form-input"
              placeholder="Nova sede (ex: Unidade Sul)"
              value={novaSedeNome}
              onChange={e => setNovaSedeNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSede()}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={addSede}>
              <Plus size={14} /> Adicionar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {projeto.sedes.map(sede => (
              <div
                key={sede.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-subtle))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: sede.cor }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{sede.nome}</div>
                    {sede.endereco && (
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={10} /> {sede.endereco}
                      </div>
                    )}
                  </div>
                </div>
                {projeto.sedes.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ color: '#ef4444' }}
                    onClick={() => removeSede(sede.id)}
                    aria-label={`Remover ${sede.nome}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {projeto.sedes.length > 1 && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa' }}>
                <ArrowRightLeft size={14} /> Tempo de Deslocamento entre Sedes (minutos)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projeto.sedes.map((sA, idxA) =>
                  projeto.sedes.slice(idxA + 1).map(sB => {
                    const val =
                      projeto.matrizDeslocamento[`${sA.id}__${sB.id}`] ??
                      projeto.parametros.tempoDeslocamentoPadraoMin ??
                      30
                    return (
                      <div key={`${sA.id}-${sB.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {sA.nome} ↔ {sB.nome}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            min={0}
                            max={180}
                            className="form-input"
                            style={{ width: 78, padding: '6px 10px', textAlign: 'center' }}
                            value={val}
                            onChange={e => updateDeslocamento(sA.id, sB.id, parseInt(e.target.value || '0', 10))}
                          />
                          <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>min</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ambientes e Espaços Compartilhados */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <FlaskConical size={17} style={{ color: '#8b5cf6' }} />
              Ambientes Especiais (Quadras, Labs, Salas)
            </h3>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0' }}>
              Controle a capacidade simultânea de quadras, laboratórios e auditórios
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.2fr 72px auto', gap: 8, marginBottom: 14, alignItems: 'end' }}>
            <div>
              <label className="form-label">Nome</label>
              <input
                className="form-input"
                placeholder="Ex: Quadra 1, Lab. Química"
                value={novoAmbNome}
                onChange={e => setNovoAmbNome(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={novoAmbTipo} onChange={e => setNovoAmbTipo(e.target.value as TipoAmbiente)}>
                {TIPOS_AMBIENTE.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Sede</label>
              <select className="form-input" value={novoAmbSede} onChange={e => setNovoAmbSede(e.target.value)}>
                {projeto.sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" title="Quantas turmas podem usar ao mesmo tempo">Cap.</label>
              <input
                type="number"
                min={1}
                max={10}
                className="form-input"
                value={novoAmbCap}
                onChange={e => setNovoAmbCap(parseInt(e.target.value || '1', 10))}
              />
            </div>
            <button type="button" className="btn btn-primary btn-sm" style={{ height: 40 }} onClick={addAmbiente}>
              <Plus size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridAutoRows: 'max-content', gap: 8, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
            {projeto.ambientes.map(amb => {
              const sedeNome = projeto.sedes.find(s => s.id === amb.unidadeId)?.nome || 'Sede'
              return (
                <div
                  key={amb.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{amb.nome}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', gap: 8 }}>
                      <span>{TIPOS_AMBIENTE.find(t => t.value === amb.tipo)?.label}</span>
                      <span>•</span>
                      <span>{sedeNome}</span>
                      <span>•</span>
                      <span style={{ color: '#a78bfa', fontWeight: 600 }}>
                        {amb.capacidadeSimultanea} turma(s) simultânea(s)
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="form-input"
                      style={{ width: 58, padding: '4px 8px', textAlign: 'center', fontSize: 12 }}
                      title="Capacidade simultânea"
                      value={amb.capacidadeSimultanea}
                      onChange={e =>
                        onChange({
                          ...projeto,
                          ambientes: projeto.ambientes.map(a =>
                            a.id === amb.id ? { ...a, capacidadeSimultanea: Math.max(1, parseInt(e.target.value || '1', 10)) } : a
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() =>
                        onChange({ ...projeto, ambientes: projeto.ambientes.filter(a => a.id !== amb.id) })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ROW 2: Modelos de Horário (Início/Término personalizados) */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Clock size={17} style={{ color: '#10b981' }} />
              Modelos de Horários (Início, Término e Intervalos por Turma/Turno)
            </h3>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0' }}>
              Crie quantos modelos quiser para turmas com horários diferentes de entrada, saída ou recreio
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ width: 220 }}
              placeholder="Novo modelo (ex: Fund I 07:30)"
              value={novoModeloNome}
              onChange={e => setNovoModeloNome(e.target.value)}
            />
            <select className="form-input" style={{ width: 130 }} value={novoModeloTurno} onChange={e => setNovoModeloTurno(e.target.value)}>
              <option value="Matutino">Matutino</option>
              <option value="Vespertino">Vespertino</option>
              <option value="Noturno">Noturno</option>
              <option value="Integral">Integral</option>
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={addModelo}>
              <Plus size={14} /> Novo Modelo
            </button>
          </div>
        </div>

        {/* Selector pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {projeto.modelosHorario.map(mod => {
            const active = mod.id === modeloAtivo?.id
            const aulasCount = mod.faixas.filter(f => f.tipo === 'aula').length
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setModeloSelId(mod.id)}
                className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              >
                <Clock size={13} />
                {mod.nome} ({aulasCount}×{mod.diasAtivos.length}={aulasCount * mod.diasAtivos.length})
              </button>
            )
          })}
        </div>

        {modeloAtivo && (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: 'hsl(var(--bg-elevated))',
              border: '1px solid hsl(var(--border-subtle))',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  style={{ width: 280, fontWeight: 700 }}
                  value={modeloAtivo.nome}
                  onChange={e => updateModelo(modeloAtivo.id, { nome: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CalendarDays size={14} style={{ color: 'hsl(var(--text-muted))' }} />
                  {([1, 2, 3, 4, 5, 6] as DiaSemanaId[]).map(dia => {
                    const on = modeloAtivo.diasAtivos.includes(dia)
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => toggleDiaModelo(modeloAtivo, dia)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: on ? '1px solid rgba(16,185,129,0.5)' : '1px solid hsl(var(--border-subtle))',
                          background: on ? 'rgba(16,185,129,0.16)' : 'transparent',
                          color: on ? '#34d399' : 'hsl(var(--text-muted))',
                        }}
                      >
                        {DIAS_SEMANA_LABELS[dia].curto}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addFaixa(modeloAtivo, 'aula')}>
                  <Plus size={13} /> + Aula
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addFaixa(modeloAtivo, 'intervalo')}>
                  <Plus size={13} /> + Intervalo
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
              {modeloAtivo.faixas.map(faixa => (
                <div
                  key={faixa.id}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: faixa.tipo === 'intervalo' ? 'rgba(245,158,11,0.08)' : 'hsl(var(--bg-surface))',
                    border:
                      faixa.tipo === 'intervalo'
                        ? '1px dashed rgba(245,158,11,0.45)'
                        : '1px solid hsl(var(--border-subtle))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: faixa.tipo === 'intervalo' ? '#f59e0b' : '#60a5fa',
                        textTransform: 'uppercase',
                      }}
                    >
                      {faixa.tipo === 'intervalo' ? '☕ Intervalo' : `${faixa.ordem}ª Aula`}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ padding: 4, color: '#ef4444' }}
                      onClick={() => removeFaixa(modeloAtivo, faixa.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="time"
                      className="form-input"
                      style={{ padding: '4px 6px', fontSize: 12 }}
                      value={faixa.inicio}
                      onChange={e => updateFaixa(modeloAtivo, faixa.id, { inicio: e.target.value })}
                    />
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>às</span>
                    <input
                      type="time"
                      className="form-input"
                      style={{ padding: '4px 6px', fontSize: 12 }}
                      value={faixa.fim}
                      onChange={e => updateFaixa(modeloAtivo, faixa.id, { fim: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ROW 3: Turmas Participantes (Sede + Modelo de Horário + Sala Base) */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Layers size={17} style={{ color: '#f59e0b' }} />
              Turmas & Vinculação de Sede / Horário ({projeto.turmas.filter(t => t.ativa).length} ativas)
            </h3>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0' }}>
              Cada turma pode pertencer a uma sede diferente e ter seu próprio horário de início/término
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ width: 170 }}
              placeholder="Adicionar turma..."
              value={novaTurmaNome}
              onChange={e => setNovaTurmaNome(e.target.value)}
            />
            <select className="form-input" style={{ width: 140 }} value={novaTurmaSede} onChange={e => setNovaTurmaSede(e.target.value)}>
              {projeto.sedes.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
            <select className="form-input" style={{ width: 170 }} value={novaTurmaModelo} onChange={e => setNovaTurmaModelo(e.target.value)}>
              {projeto.modelosHorario.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={addTurmaRapida}>
              <Plus size={14} /> Turma
            </button>
          </div>
        </div>

        <div tabIndex={0} role="region" aria-label="Configuração das turmas" className="table-container">
          <table>
            <thead>
              <tr>
                <th>Ativa</th>
                <th>Turma</th>
                <th>Turno</th>
                <th>Sede / Unidade</th>
                <th>Modelo de Horário (Entrada/Saída)</th>
                <th>Sala Fixa (Opcional)</th>
                <th style={{ width: 60 }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {projeto.turmas.map(t => (
                <tr key={t.id} style={{ opacity: t.ativa ? 1 : 0.55 }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={t.ativa}
                      onChange={e =>
                        onChange({
                          ...projeto,
                          turmas: projeto.turmas.map(tr => (tr.id === t.id ? { ...tr, ativa: e.target.checked } : tr)),
                        })
                      }
                    />
                  </td>
                  <td style={{ fontWeight: 700 }}>{t.nome}</td>
                  <td>
                    <input
                      className="form-input"
                      style={{ padding: '5px 8px', width: 115, fontSize: 12 }}
                      value={t.turno}
                      onChange={e =>
                        onChange({
                          ...projeto,
                          turmas: projeto.turmas.map(tr => (tr.id === t.id ? { ...tr, turno: e.target.value } : tr)),
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ padding: '5px 8px', fontSize: 12 }}
                      value={t.unidadeId}
                      onChange={e =>
                        onChange({
                          ...projeto,
                          turmas: projeto.turmas.map(tr => (tr.id === t.id ? { ...tr, unidadeId: e.target.value } : tr)),
                        })
                      }
                    >
                      {projeto.sedes.map(s => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ padding: '5px 8px', fontSize: 12 }}
                      value={t.modeloHorarioId}
                      onChange={e =>
                        onChange({
                          ...projeto,
                          turmas: projeto.turmas.map(tr => (tr.id === t.id ? { ...tr, modeloHorarioId: e.target.value } : tr)),
                        })
                      }
                    >
                      {projeto.modelosHorario.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ padding: '5px 8px', fontSize: 12 }}
                      value={t.salaBaseId || ''}
                      onChange={e =>
                        onChange({
                          ...projeto,
                          turmas: projeto.turmas.map(tr => (tr.id === t.id ? { ...tr, salaBaseId: e.target.value || undefined } : tr)),
                        })
                      }
                    >
                      <option value="">Sem sala fixa</option>
                      {projeto.ambientes.map(a => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() =>
                        onChange({
                          ...projeto,
                          turmas: projeto.turmas.filter(tr => tr.id !== t.id),
                          alocacoes: projeto.alocacoes.filter(al => al.turmaId !== t.id),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function addMinutesStr(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h || 0) * 60 + (m || 0) + mins
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function renumberFaixas(faixas: FaixaHorario[]): FaixaHorario[] {
  const sorted = [...faixas].sort((a, b) => a.inicio.localeCompare(b.inicio))
  let aulaIdx = 1
  return sorted.map(f =>
    f.tipo === 'aula'
      ? { ...f, ordem: aulaIdx, label: `${aulaIdx++}ª Aula` }
      : { ...f, ordem: 99, label: 'Intervalo' }
  )
}
