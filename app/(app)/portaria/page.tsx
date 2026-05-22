'use client'

import { useState, useMemo, useEffect } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import {
  LayoutDashboard, Users, Clock, Wifi, WifiOff, TrendingUp,
  ArrowRight, Scan, Activity, UserCheck, Building2, AlertTriangle,
  ShieldCheck, ShieldAlert, BadgeInfo, Play, Pause, Camera, Eye
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function PortariaDashboardPage() {
  const [filtroData, setFiltroData] = useState(new Date().toISOString().slice(0, 10))
  const [liveMonitoring, setLiveMonitoring] = useState(true)

  // 1. Buscar todos os eventos da portaria na data selecionada
  const { data: eventosRes, isLoading: loadingEventos, refetch: refetchEventos } = useApiQuery<{ data: any[] }>(
    ['portaria-eventos-dash', filtroData],
    '/api/portaria/eventos',
    { data_inicio: `${filtroData}T00:00:00`, data_fim: `${filtroData}T23:59:59`, limit: '500' },
    { staleTime: 5000 }
  )
  const eventos = eventosRes?.data || []

  // 2. Buscar dispositivos
  const { data: dispositivosRes } = useApiQuery<{ data: any[] }>(
    ['portaria-dispositivos-dash'],
    '/api/portaria/dispositivos',
    undefined,
    { staleTime: 10000 }
  )
  const dispositivos = dispositivosRes?.data || []

  // 3. Buscar alunos ativos (para cruzar fotos oficiais do ERP e dados de turmas)
  const { data: alunosRes } = useApiQuery<any>(
    ['portaria-alunos-dash'],
    '/api/alunos',
    undefined,
    { staleTime: 30000 }
  )
  const alunos = Array.isArray(alunosRes) ? alunosRes : (alunosRes?.data || [])

  // Mapa de alunos por ID para busca rápida
  const alunosMap = useMemo(() => {
    const map: Record<string, any> = {}
    alunos.forEach((a: any) => { map[a.id] = a })
    return map
  }, [alunos])

  // Live polling automático a cada 5 segundos se estiver ativo
  useEffect(() => {
    if (!liveMonitoring) return
    const interval = setInterval(() => {
      refetchEventos()
    }, 5000)
    return () => clearInterval(interval)
  }, [liveMonitoring, refetchEventos])

  // KPIs
  const totalEntradas = eventos.filter(e => e.status === 'sucesso').length
  const totalFalhas = eventos.filter(e => e.status === 'falha').length
  const totalInconsistencias = eventos.filter(e => e.status === 'inconsistencia').length
  const devicesOnline = dispositivos.filter(d => d.status === 'online').length

  // Últimas entradas válidas
  const ultimasEntradas = useMemo(() => {
    return eventos.slice(0, 15)
  }, [eventos])

  // Último reconhecimento facial destacado para a tela de monitoramento
  const ultimoReconhecimento = useMemo(() => {
    const validEvents = eventos.filter(e => e.status === 'sucesso')
    if (validEvents.length === 0) return null
    
    const ev = validEvents[0]
    const alunoERP = ev.aluno_id ? alunosMap[ev.aluno_id] : null
    
    return {
      ...ev,
      fotoOficial: alunoERP?.foto || ev.aluno_foto || null,
      turma: ev.aluno_turma || alunoERP?.turma || 'Sem turma',
      periodo: alunoERP?.turno || ev.aluno_turno || 'Todos',
      responsaveis: alunoERP?.responsaveis || []
    }
  }, [eventos, alunosMap])

  // Entradas por hora
  const entradasPorHora = useMemo(() => {
    const hours: Record<number, number> = {}
    for (let h = 6; h <= 21; h++) hours[h] = 0
    eventos.filter(e => e.status === 'sucesso').forEach(e => {
      const h = new Date(e.data_hora).getUTCHours()
      if (hours[h] !== undefined) hours[h]++
    })
    return Object.entries(hours).map(([h, count]) => ({ hora: `${h}h`, count }))
  }, [eventos])
  const maxHour = Math.max(...entradasPorHora.map(h => h.count), 1)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 20px ${ACCENT}30`
            }}>
              <Scan size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 26, margin: 0, letterSpacing: '-0.03em' }}>
                Centro de Operações - Portaria iDFace
              </h1>
              <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
                Monitoramento facial em tempo real · Controle de acesso de alunos
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="date"
            className="form-input"
            value={filtroData}
            onChange={e => {
              setFiltroData(e.target.value)
              // Pausar live polling se escolher outra data para evitar sobrescritas
              if (e.target.value !== new Date().toISOString().slice(0, 10)) {
                setLiveMonitoring(false)
              }
            }}
            style={{ height: 38, borderRadius: 12, fontSize: 12, fontWeight: 700, paddingLeft: 10, paddingRight: 10 }}
          />

          <button
            onClick={() => setLiveMonitoring(!liveMonitoring)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: liveMonitoring ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
              border: `1px solid ${liveMonitoring ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.2)'}`,
              color: liveMonitoring ? '#10b981' : 'hsl(var(--text-muted))',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {liveMonitoring ? (
              <>
                <Play size={14} style={{ fill: '#10b981' }} />
                <span>POLING ATIVO (5s)</span>
              </>
            ) : (
              <>
                <Pause size={14} />
                <span>MONITORAMENTO PAUSADO</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: filtroData === new Date().toISOString().slice(0, 10) ? 'Entradas Hoje' : 'Entradas na Data', value: totalEntradas, icon: <UserCheck size={22} />, color: '#10b981', bg: 'rgba(16,185,129,0.06)', bd: 'rgba(16,185,129,0.2)' },
          { label: 'Inconsistências', value: totalInconsistencias, icon: <AlertTriangle size={22} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', bd: 'rgba(245,158,11,0.2)' },
          { label: 'Acessos Negados', value: totalFalhas, icon: <ShieldAlert size={22} />, color: '#f43f5e', bg: 'rgba(244,63,94,0.06)', bd: 'rgba(244,63,94,0.2)' },
          { label: 'Leitores Conectados', value: `${devicesOnline}/${dispositivos.length}`, icon: devicesOnline > 0 ? <Wifi size={22} /> : <WifiOff size={22} />, color: devicesOnline > 0 ? '#06b6d4' : '#94a3b8', bg: devicesOnline > 0 ? 'rgba(6,182,212,0.06)' : 'rgba(148,163,184,0.06)', bd: devicesOnline > 0 ? 'rgba(6,182,212,0.2)' : 'rgba(148,163,184,0.15)' },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: 'hsl(var(--bg-elevated))',
            border: `1px solid ${kpi.bd}`,
            borderRadius: 18,
            padding: '20px 22px',
            display: 'flex', alignItems: 'center', gap: 16,
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: `0 8px 30px ${kpi.color}04`,
            cursor: 'pointer'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = `0 12px 30px ${kpi.color}08`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = `0 8px 30px ${kpi.color}04`
          }}
          >
            <div style={{
              width: 50, height: 50, borderRadius: 14,
              background: kpi.bg, border: `1px solid ${kpi.bd}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: kpi.color, flexShrink: 0,
            }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em' }}>{kpi.value}</div>
              <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid Central: Último Reconhecimento Destacado + Feed Tempo Real */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 24 }}>
        
        {/* Painel do Último Reconhecimento Facial */}
        <div style={{
          background: 'hsl(var(--bg-elevated))',
          border: `1px solid hsl(var(--border-subtle))`,
          borderRadius: 22, padding: '24px 28px',
          display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="#10b981" />
              <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit,sans-serif' }}>
                🟢 Último Acesso Autorizado
              </div>
            </div>
            {ultimoReconhecimento && (
              <span style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                ⏱ Sincronizado há {Math.max(0, Math.floor((Date.now() - new Date(ultimoReconhecimento.data_hora).getTime()) / 1000))}s atrás
              </span>
            )}
          </div>

          {ultimoReconhecimento ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                
                {/* Comparador Side-by-Side */}
                <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                  
                  {/* Foto Oficial ERP */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 105, height: 135, borderRadius: 16,
                      background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
                    }}>
                      {ultimoReconhecimento.fotoOficial ? (
                        <img src={ultimoReconhecimento.fotoOficial} alt="ERP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>Sem Foto</div>
                      )}
                      <span style={{ position: 'absolute', bottom: 6, left: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 8.5, padding: '2px 0', borderRadius: 4, fontWeight: 800 }}>
                        FOTO OFICIAL
                      </span>
                    </div>
                  </div>

                  {/* Foto Capturada iDFace */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 105, height: 135, borderRadius: 16,
                      background: 'hsl(var(--bg-base))', border: `2px solid ${ACCENT}`,
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', boxShadow: `0 4px 20px ${ACCENT}20`
                    }}>
                      {ultimoReconhecimento.foto_captura ? (
                        <img src={ultimoReconhecimento.foto_captura} alt="iDFace" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'hsl(var(--text-muted))' }}>
                          <Camera size={20} style={{ opacity: 0.5 }} />
                          <span style={{ fontSize: 8.5, fontWeight: 700, marginTop: 4 }}>Sem capture</span>
                        </div>
                      )}
                      <span style={{ position: 'absolute', bottom: 6, left: 6, right: 6, background: `${ACCENT}`, color: '#fff', fontSize: 8.5, padding: '2px 0', borderRadius: 4, fontWeight: 800 }}>
                        CATRACA LIVE
                      </span>
                    </div>
                  </div>

                </div>

                {/* Informações detalhadas do aluno e acesso */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: ACCENT, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Código: {ultimoReconhecimento.user_id_equipamento}
                    </span>
                    <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 20, color: 'hsl(var(--text-primary))', margin: '4px 0 0 0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                      {ultimoReconhecimento.aluno_nome}
                    </h2>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'hsl(var(--bg-base))', padding: '12px 16px', borderRadius: 14, border: '1px solid hsl(var(--border-subtle))' }}>
                    {[
                      ['Turma', ultimoReconhecimento.turma],
                      ['Horário de Entrada', (() => {
                        const d = new Date(ultimoReconhecimento.data_hora);
                        const h = String(d.getUTCHours()).padStart(2, '0');
                        const m = String(d.getUTCMinutes()).padStart(2, '0');
                        const s = String(d.getUTCSeconds()).padStart(2, '0');
                        return `${h}:${m}:${s}`;
                      })()],
                      ['Dispositivo', ultimoReconhecimento.dispositivo_nome],
                      ['Confiança', `${ultimoReconhecimento.confianca || 98}%`],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Contatos dos Responsáveis */}
              {ultimoReconhecimento.responsaveis && ultimoReconhecimento.responsaveis.length > 0 && (
                <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>👪 Responsáveis Notificados</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {ultimoReconhecimento.responsaveis.map((r: any, idx: number) => (
                      <div key={idx} style={{
                        padding: '6px 12px', borderRadius: 10, background: 'hsl(var(--bg-base))',
                        border: '1px solid hsl(var(--border-subtle))', fontSize: 11.5, fontWeight: 700,
                        color: 'hsl(var(--text-secondary))'
                      }}>
                        {r.nome} ({r.parentesco || 'Responsável'}) · <span style={{ color: '#10b981', fontSize: 10 }}>💬 SMS/Push enviado</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Camera size={32} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Nenhum acesso registrado hoje ainda.</div>
              <div style={{ fontSize: 11, maxWidth: 300 }}>Os acessos detectados por reconhecimento facial aparecerão aqui de forma instantânea com imagem comparativa.</div>
            </div>
          )}
        </div>

        {/* Feed de Acessos Recentes */}
        <div style={{
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 22, padding: '24px 28px',
          display: 'flex', flexDirection: 'column', gap: 14,
          maxHeight: 390, overflow: 'auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit,sans-serif' }}>
              🕐 Feed de Acessos Recentes
            </div>
            <span style={{ fontSize: 10, background: `${ACCENT}12`, color: ACCENT, padding: '3px 8px', borderRadius: 6, fontWeight: 800 }}>
              {eventos.length} EVENTOS
            </span>
          </div>

          {loadingEventos && eventos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--text-muted))' }}>
              <Activity size={20} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
              Carregando eventos...
            </div>
          ) : eventos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhuma entrada registrada hoje.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ultimasEntradas.map((e, idx) => {
                const isSuccess = e.status === 'sucesso'
                const isWarning = e.status === 'inconsistencia'
                
                let badgeColor = '#10b981'
                let badgeBg = 'rgba(16,185,129,0.06)'
                let badgeText = 'Sucesso'
                
                if (isWarning) {
                  badgeColor = '#f59e0b'
                  badgeBg = 'rgba(245,158,11,0.06)'
                  badgeText = 'Inconsistência'
                } else if (e.status === 'falha') {
                  badgeColor = '#f43f5e'
                  badgeBg = 'rgba(244,63,94,0.06)'
                  badgeText = 'Recusado'
                }

                return (
                  <div key={e.id || idx} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 14,
                    background: 'hsl(var(--bg-base))',
                    border: `1px solid ${isSuccess ? 'hsl(var(--border-subtle))' : badgeColor + '30'}`,
                    transition: 'all 0.15s'
                  }}>
                    {/* Avatar do Aluno */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
                      position: 'relative', flexShrink: 0
                    }}>
                      {e.aluno_foto ? (
                        <img src={e.aluno_foto} alt={e.aluno_nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ fontSize: 9, fontWeight: 900, color: 'hsl(var(--text-muted))' }}>
                          {(e.aluno_nome || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      {/* Pequeno indicador de status no canto do avatar */}
                      <div style={{
                        position: 'absolute', right: 0, bottom: 0,
                        width: 8, height: 8, borderRadius: '50%',
                        background: badgeColor, border: '1.5px solid hsl(var(--bg-base))',
                        boxShadow: `0 0 4px ${badgeColor}70`
                      }} />
                    </div>

                    {/* Dados */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.aluno_nome || 'Usuário Não Cadastrado'}
                        </div>
                        <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                          {(() => {
                            const d = new Date(e.data_hora);
                            const h = String(d.getUTCHours()).padStart(2, '0');
                            const m = String(d.getUTCMinutes()).padStart(2, '0');
                            const s = String(d.getUTCSeconds()).padStart(2, '0');
                            return `${h}:${m}:${s}`;
                          })()}
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Código: {e.user_id_equipamento || '—'}</span>
                        <span>·</span>
                        <span>{e.dispositivo_nome}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span style={{
                      fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                      padding: '3px 8px', borderRadius: 6,
                      background: badgeBg, color: badgeColor
                    }}>
                      {badgeText}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Gráfico e Status de Leitores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        
        {/* Histograma de entradas por hora */}
        <div style={{
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 22, padding: '24px 28px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 20, fontFamily: 'Outfit,sans-serif' }}>
            📊 Curva de Fluxo de Entrada por Hora
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, paddingBottom: 10 }}>
            {entradasPorHora.map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: h.count > 0 ? ACCENT : 'hsl(var(--text-muted))' }}>{h.count || ''}</div>
                <div style={{
                  width: '100%', maxWidth: 28,
                  height: `${Math.max((h.count / maxHour) * 120, 5)}px`,
                  background: h.count > 0 ? `linear-gradient(to top, ${ACCENT}, ${ACCENT}aa)` : 'hsl(var(--border-subtle))',
                  borderRadius: '6px 6px 3px 3px',
                  boxShadow: h.count > 0 ? `0 4px 12px ${ACCENT}20` : 'none',
                  transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }} />
                <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>{h.hora}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Físico dos Equipamentos */}
        <div style={{
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 22, padding: '24px 28px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 16, fontFamily: 'Outfit,sans-serif' }}>
            📡 Rede de Dispositivos Conectados
          </div>
          
          {dispositivos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum dispositivo cadastrado. <a href="/portaria/dispositivos" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Cadastrar →</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dispositivos.map((d: any) => {
                const isOnline = d.status === 'online'
                return (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 16,
                    background: 'hsl(var(--bg-base))',
                    border: `1px solid ${isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.12)'}`,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: isOnline ? 'rgba(16,185,129,0.05)' : 'rgba(244,63,94,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isOnline ? '#10b981' : '#f43f5e',
                    }}>
                      {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</div>
                      <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>IP: {d.ip}</div>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
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

      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
