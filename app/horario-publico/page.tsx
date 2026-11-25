'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarClock, Printer, RefreshCw, Search, UserCheck, Users } from 'lucide-react'
import { DiaSemanaId, DIAS_SEMANA_LABELS } from '@/lib/horario/types'

interface PublicHorarioPayload {
  projetoId: string
  nomeProjeto: string
  anoLetivo: string
  cenarioNome: string
  publicadoEm: string
  sedes: Array<{ id: string; nome: string; cor: string }>
  turmas: Array<{
    id: string
    nome: string
    serie: string
    segmento: string
    turno: string
    unidadeId: string
    unidadeNome: string
    diasAtivos: DiaSemanaId[]
    faixas: Array<{ id: string; ordem: number; inicio: string; fim: string; tipo: 'aula' | 'intervalo'; label?: string }>
  }>
  professores: Array<{ id: string; nome: string; apelido: string; cor: string }>
  aulas: Array<{
    id: string
    turmaId: string
    unidadeId: string
    unidadeNome: string
    dia: DiaSemanaId
    faixaId: string
    ordem: number
    inicio: string
    fim: string
    disciplinaNome: string
    disciplinaSigla: string
    professoresIds: string[]
    professoresNomes: string[]
    ambienteNome: string
    cor: string
  }>
}

function HorarioPublicoContent() {
  const searchParams = useSearchParams()
  const tipoParam = searchParams.get('tipo') === 'professores' ? 'professores' : 'turmas'
  const anoParam = searchParams.get('ano') || ''

  const [tipo, setTipo] = useState<'turmas' | 'professores'>(tipoParam)
  const [data, setData] = useState<PublicHorarioPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState('')

  useEffect(() => {
    setTipo(tipoParam)
  }, [tipoParam])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const url = `/api/administrativo/gerador-horario/publico${anoParam ? `?ano=${encodeURIComponent(anoParam)}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        const json = res.ok ? await res.json() : { horario: null }
        setData(json?.horario || null)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [anoParam])

  const turmasFiltradas = useMemo(() => {
    if (!data) return []
    const q = busca.trim().toLowerCase()
    return data.turmas.filter(t => (!selId || t.id === selId) && (!q || t.nome.toLowerCase().includes(q) || t.unidadeNome.toLowerCase().includes(q)))
  }, [data, busca, selId])

  const profsFiltrados = useMemo(() => {
    if (!data) return []
    const q = busca.trim().toLowerCase()
    return data.professores.filter(p => (!selId || p.id === selId) && (!q || p.nome.toLowerCase().includes(q)))
  }, [data, busca, selId])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1120', color: '#e2e8f0' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1120', color: '#e2e8f0', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 440 }}>
          <CalendarClock size={44} style={{ margin: '0 auto 16px', color: '#3b82f6' }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Nenhum horário publicado</h1>
          <p style={{ fontSize: 14, color: '#94a3b8' }}>
            A coordenação ainda não publicou a grade horária oficial para este período.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b1120', color: '#f1f5f9', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: 20, borderRadius: 16, background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Grade Horária Oficial • Atualizada em Tempo Real
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: '4px 0 4px' }}>
              {data.nomeProjeto} ({data.anoLetivo})
            </h1>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Versão: {data.cenarioNome} • Publicado em {new Date(data.publicadoEm).toLocaleString('pt-BR')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setTipo('turmas')
                setSelId('')
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: tipo === 'turmas' ? '#3b82f6' : '#1e293b',
                color: 'white',
              }}
            >
              <Users size={15} /> Horário dos Alunos/Turmas
            </button>
            <button
              type="button"
              onClick={() => {
                setTipo('professores')
                setSelId('')
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: tipo === 'professores' ? '#3b82f6' : '#1e293b',
                color: 'white',
              }}
            >
              <UserCheck size={15} /> Horário dos Professores
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                background: 'transparent',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Printer size={15} /> Imprimir
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={tipo === 'turmas' ? 'Buscar turma ou sede...' : 'Buscar professor...'}
              style={{
                width: '100%',
                padding: '10px 12px 10px 34px',
                borderRadius: 10,
                background: '#111827',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'white',
                fontSize: 13,
              }}
            />
          </div>
          <select
            value={selId}
            onChange={e => setSelId(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'white',
              fontSize: 13,
              minWidth: 220,
            }}
          >
            <option value="">{tipo === 'turmas' ? 'Todas as Turmas' : 'Todos os Professores'}</option>
            {tipo === 'turmas'
              ? data.turmas.map(t => (
                  <option key={t.id} value={t.id}>{t.nome} ({t.unidadeNome})</option>
                ))
              : data.professores.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
          </select>
        </div>

        {/* Conteúdo: Turmas */}
        {tipo === 'turmas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {turmasFiltradas.map(turma => {
              const aulasTurma = data.aulas.filter(a => a.turmaId === turma.id)
              return (
                <div key={turma.id} style={{ padding: 18, borderRadius: 16, background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{turma.nome}</h2>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {turma.unidadeNome} • Turno {turma.turno}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Horário</th>
                          {turma.diasAtivos.map(d => (
                            <th key={d} style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: '#f1f5f9', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {DIAS_SEMANA_LABELS[d].completo}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {turma.faixas.map(fx => {
                          if (fx.tipo === 'intervalo') {
                            return (
                              <tr key={fx.id} style={{ background: 'rgba(245,158,11,0.08)' }}>
                                <td style={{ padding: '8px 10px', fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>{fx.inicio}–{fx.fim}</td>
                                <td colSpan={turma.diasAtivos.length} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '0.35em', color: '#fbbf24' }}>
                                  INTERVALO
                                </td>
                              </tr>
                            )
                          }
                          return (
                            <tr key={fx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              <td style={{ padding: '10px', fontSize: 12, fontWeight: 700 }}>
                                <div>{fx.label || `${fx.ordem}ª`}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{fx.inicio}–{fx.fim}</div>
                              </td>
                              {turma.diasAtivos.map(d => {
                                const a = aulasTurma.find(item => item.dia === d && item.faixaId === fx.id)
                                return (
                                  <td key={d} style={{ padding: 6, textAlign: 'center' }}>
                                    {a ? (
                                      <div style={{ padding: '8px 6px', borderRadius: 10, background: `${a.cor}20`, border: `1px solid ${a.cor}55` }}>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: a.cor }}>{a.disciplinaNome}</div>
                                        <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>{a.professoresNomes.join(' + ')}</div>
                                        {a.ambienteNome && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{a.ambienteNome}</div>}
                                      </div>
                                    ) : (
                                      <span style={{ color: '#475569', fontSize: 11 }}>—</span>
                                    )}
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
              )
            })}
          </div>
        )}

        {/* Conteúdo: Professores */}
        {tipo === 'professores' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 16 }}>
            {profsFiltrados.map(prof => {
              const profAulas = data.aulas.filter(a => a.professoresIds.includes(prof.id))
              if (profAulas.length === 0) return null
              return (
                <div key={prof.id} style={{ padding: 18, borderRadius: 16, background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{prof.nome}</h2>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{profAulas.length} aula(s)/semana</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {([1, 2, 3, 4, 5] as DiaSemanaId[]).map(d => {
                      const list = profAulas.filter(a => a.dia === d).sort((a, b) => a.inicio.localeCompare(b.inicio))
                      return (
                        <div key={d} style={{ padding: 8, borderRadius: 10, background: '#0f172a', border: '1px solid rgba(255,255,255,0.06)', minHeight: 100 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textAlign: 'center', marginBottom: 6, color: '#94a3b8' }}>
                            {DIAS_SEMANA_LABELS[d].curto}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {list.map(a => {
                              const tNome = data.turmas.find(t => t.id === a.turmaId)?.nome || a.turmaId
                              return (
                                <div key={a.id} style={{ padding: '5px 6px', borderRadius: 7, background: `${a.cor}20`, border: `1px solid ${a.cor}44`, fontSize: 10 }}>
                                  <div style={{ fontWeight: 800, color: a.cor }}>{tNome}</div>
                                  <div>{a.disciplinaSigla} • {a.inicio}</div>
                                  {a.unidadeNome && <div style={{ color: '#94a3b8', fontSize: 9 }}>{a.unidadeNome}</div>}
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
      </div>
    </div>
  )
}

export default function HorarioPublicoPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0b1120' }} />}>
      <HorarioPublicoContent />
    </Suspense>
  )
}
