'use client'

import { useState, useMemo } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import { useData } from '@/lib/dataContext'
import {
  LayoutDashboard, Users, Clock, Wifi, WifiOff, TrendingUp,
  ArrowRight, Scan, Activity, UserCheck, Building2, AlertTriangle
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function PortariaDashboardPage() {
  const { turmas } = useData()
  const [filtroUnidade, setFiltroUnidade] = useState('Todas')
  const [filtroPeriodo, setFiltroPeriodo] = useState('Todos')

  const hoje = new Date().toISOString().slice(0, 10)

  const { data: eventosRes, isLoading: loadingEventos } = useApiQuery<{ data: any[] }>(
    ['portaria-eventos-dash'],
    '/api/portaria/eventos',
    { data_inicio: `${hoje}T00:00:00`, limit: '500' },
    { staleTime: 5000 }
  )
  const eventos = eventosRes?.data || []

  const { data: dispositivosRes } = useApiQuery<{ data: any[] }>(
    ['portaria-dispositivos-dash'],
    '/api/portaria/dispositivos',
    undefined,
    { staleTime: 10000 }
  )
  const dispositivos = dispositivosRes?.data || []

  // KPIs
  const totalEntradas = eventos.filter(e => e.status === 'sucesso').length
  const totalFalhas = eventos.filter(e => e.status !== 'sucesso').length
  const devicesOnline = dispositivos.filter(d => d.status === 'online').length

  // Entradas por hora
  const entradasPorHora = useMemo(() => {
    const hours: Record<number, number> = {}
    for (let h = 6; h <= 22; h++) hours[h] = 0
    eventos.filter(e => e.status === 'sucesso').forEach(e => {
      const h = new Date(e.data_hora).getHours()
      if (hours[h] !== undefined) hours[h]++
    })
    return Object.entries(hours).map(([h, count]) => ({ hora: `${h}h`, count }))
  }, [eventos])
  const maxHour = Math.max(...entradasPorHora.map(h => h.count), 1)

  // Entradas por turma
  const entradasPorTurma = useMemo(() => {
    const map: Record<string, number> = {}
    eventos.filter(e => e.status === 'sucesso' && e.aluno_nome).forEach(e => {
      const key = e.unidade || 'Sem turma'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [eventos])

  // Últimas 10 entradas
  const ultimasEntradas = eventos.filter(e => e.status === 'sucesso').slice(0, 10)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 20px ${ACCENT}30` }}>
              <Scan size={22} color="#fff" />
            </div>
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 26, margin: 0, letterSpacing: '-0.03em' }}>
              Portaria Inteligente
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
            Controle de entrada facial · iDFace Integration · Portaria Rua das Garças
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="form-input"
            style={{ height: 36, borderRadius: 10, fontSize: 12, fontWeight: 600, minWidth: 140 }}
            value={filtroPeriodo}
            onChange={e => setFiltroPeriodo(e.target.value)}
          >
            <option value="Todos">Todos os Períodos</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
            <option value="Noite">Noite</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Entradas Hoje', value: totalEntradas, icon: <UserCheck size={20} />, color: '#10b981', bg: 'rgba(16,185,129,0.08)', bd: 'rgba(16,185,129,0.2)' },
          { label: 'Falhas / Inconsistências', value: totalFalhas, icon: <AlertTriangle size={20} />, color: '#f43f5e', bg: 'rgba(244,63,94,0.08)', bd: 'rgba(244,63,94,0.2)' },
          { label: 'Dispositivos Online', value: `${devicesOnline}/${dispositivos.length}`, icon: devicesOnline > 0 ? <Wifi size={20} /> : <WifiOff size={20} />, color: devicesOnline > 0 ? '#06b6d4' : '#94a3b8', bg: devicesOnline > 0 ? 'rgba(6,182,212,0.08)' : 'rgba(148,163,184,0.08)', bd: devicesOnline > 0 ? 'rgba(6,182,212,0.2)' : 'rgba(148,163,184,0.2)' },
          { label: 'Hora de Pico', value: entradasPorHora.reduce((a, b) => b.count > a.count ? b : a, { hora: '--', count: 0 }).hora, icon: <TrendingUp size={20} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', bd: 'rgba(245,158,11,0.2)' },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: 'hsl(var(--bg-elevated))',
            border: `1px solid ${kpi.bd}`,
            borderRadius: 18,
            padding: '20px 22px',
            display: 'flex', alignItems: 'center', gap: 16,
            transition: 'all 0.2s',
            boxShadow: `0 4px 20px ${kpi.color}08`,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: kpi.bg, border: `1px solid ${kpi.bd}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: kpi.color, flexShrink: 0,
            }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))' }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid: Gráfico + Últimas entradas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Gráfico de barras: Entradas por hora */}
        <div style={{
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 18, padding: '20px 24px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 16, fontFamily: 'Outfit,sans-serif' }}>
            📊 Entradas por Hora
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
            {entradasPorHora.map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>{h.count || ''}</div>
                <div style={{
                  width: '100%', maxWidth: 32,
                  height: `${Math.max((h.count / maxHour) * 110, 4)}px`,
                  background: h.count > 0 ? `linear-gradient(to top, ${ACCENT}, ${ACCENT}88)` : 'hsl(var(--border-subtle))',
                  borderRadius: '6px 6px 2px 2px',
                  transition: 'height 0.4s ease',
                }} />
                <div style={{ fontSize: 9, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>{h.hora}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feed de últimas entradas */}
        <div style={{
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 18, padding: '20px 24px',
          maxHeight: 280, overflow: 'auto',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 12, fontFamily: 'Outfit,sans-serif' }}>
            🕐 Últimas Entradas
          </div>
          {loadingEventos ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              <Activity size={20} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
              Carregando eventos...
            </div>
          ) : ultimasEntradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhuma entrada registrada hoje.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ultimasEntradas.map((e, i) => (
                <div key={e.id || i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10,
                  background: 'hsl(var(--bg-base))',
                  border: '1px solid hsl(var(--border-subtle))',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, color: ACCENT, fontFamily: 'monospace',
                  }}>
                    {e.user_id_equipamento?.slice(-4) || '—'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.aluno_nome || 'Não identificado'}
                    </div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                      {new Date(e.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {e.dispositivo_nome || 'Dispositivo'}
                    </div>
                  </div>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px rgba(16,185,129,0.4)',
                  }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status dos dispositivos */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 18, padding: '20px 24px',
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 14, fontFamily: 'Outfit,sans-serif' }}>
          📡 Status dos Equipamentos
        </div>
        {dispositivos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'hsl(var(--text-muted))', fontSize: 13 }}>
            Nenhum dispositivo cadastrado. <a href="/portaria/dispositivos" style={{ color: ACCENT, fontWeight: 700 }}>Cadastrar →</a>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {dispositivos.map((d: any) => {
              const isOnline = d.status === 'online'
              return (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14,
                  background: 'hsl(var(--bg-base))',
                  border: `1px solid ${isOnline ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.2)'}`,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: isOnline ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isOnline ? '#10b981' : '#f43f5e',
                  }}>
                    {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{d.nome}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>{d.ip || 'IP não configurado'}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '3px 8px', borderRadius: 6,
                    background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                    color: isOnline ? '#10b981' : '#f43f5e',
                  }}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
