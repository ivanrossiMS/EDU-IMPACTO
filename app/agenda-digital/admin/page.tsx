'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useState, useEffect, useMemo } from 'react'
import { useAgendaDigital, ADComunicado } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import Link from 'next/link'
import {
  Send, Eye, MessageCircle, AlertCircle, Users, UserCheck,
  DollarSign, Image as ImageIcon, Calendar, Bell, TrendingUp,
  ArrowRight, Cake, ShieldAlert, CheckCircle2, Clock, Activity
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

export default function ADAdminDashboard() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { comunicados, chatsList = [], momentosFeed = [] } = useAgendaDigital()
  const { currentUser } = useApp()
  const [alunos] = useSupabaseArray<any>('alunos')
  const [titulos] = useSupabaseArray<any>('titulos')
  const { ocorrencias = [] } = useData()

  const alunosAtivos = useMemo(() =>
    (alunos || []).filter((a: any) => a.status === 'matriculado' || a.status === 'ativo'),
    [alunos]
  )

  const inadimplentes = useMemo(() =>
    (alunos || []).filter((a: any) => a.inadimplente === true || a.inadimplente === 'true'),
    [alunos]
  )

  const totalAtrasado = useMemo(() =>
    (titulos || []).filter((t: any) => t.status === 'atrasado').reduce((acc: number, t: any) => acc + (t.valor || 0), 0),
    [titulos]
  )

  // Aniversariantes desta semana
  const aniversariantesSemana = useMemo(() => {
    const hoje = new Date()
    const diaHoje = hoje.getDate()
    const mesHoje = hoje.getMonth() + 1
    const fimSemana = new Date(hoje)
    fimSemana.setDate(hoje.getDate() + 7)
    const diaFim = fimSemana.getDate()
    const mesFim = fimSemana.getMonth() + 1

    return (alunos || []).filter((a: any) => {
      const dn = a.data_nascimento || a.dataNascimento || ''
      if (!dn) return false
      const parts = dn.includes('/') ? dn.split('/') : dn.split('-')
      if (parts.length < 2) return false
      const dia = parseInt(dn.includes('/') ? parts[0] : parts[2])
      const mes = parseInt(dn.includes('/') ? parts[1] : parts[1])
      if (isNaN(dia) || isNaN(mes)) return false
      if (mesHoje === mesFim) return mes === mesHoje && dia >= diaHoje && dia <= diaFim
      return (mes === mesHoje && dia >= diaHoje) || (mes === mesFim && dia <= diaFim)
    })
  }, [alunos])

  // Taxa real de leitura e ciência
  const { leituraRate, cienciaRate, totalLeituras } = useMemo(() => {
    const ativos = alunosAtivos || []
    const coms = Array.isArray(comunicados) ? comunicados : []
    
    if (coms.length === 0 || ativos.length === 0) {
      return { leituraRate: 0, cienciaRate: 0, totalLeituras: 0 }
    }
    
    let tl = 0, tc = 0, expected = 0
    coms.forEach((c: ADComunicado) => {
      tl += Object.keys(c?.leituras || {}).length
      tc += Object.keys(c?.ciencias || {}).length
      expected += ativos.length
    })
    
    return {
      leituraRate: expected > 0 ? Math.round((tl / expected) * 100) : 0,
      cienciaRate: expected > 0 ? Math.round((tc / expected) * 100) : 0,
      totalLeituras: tl
    }
  }, [comunicados, alunosAtivos])



  // Momentos pendentes de aprovação
  const momentosPendentes = useMemo(() =>
    (momentosFeed || []).filter((m: any) => m.status === 'pending').length,
    [momentosFeed]
  )

  // Ocorrências dos últimos 7 dias
  const ocorrenciasRecentes = useMemo(() => {
    const limite = new Date()
    limite.setDate(limite.getDate() - 7)
    return ocorrencias.filter((o: any) => {
      if (!o.created_at) return true
      return new Date(o.created_at) >= limite
    })
  }, [ocorrencias])

  // Gráfico — envios e leituras por dia da semana (dados REAIS)
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const chartData = useMemo(() => {
    const base = diasSemana.map(name => ({ name, envios: 0, leituras: 0 }))
    comunicados.forEach((c: ADComunicado) => {
      const rawDate = c.dataEnvio || (c as any).data || (c as any).created_at;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          const idx = d.getDay()
          base[idx].envios += 1
          base[idx].leituras += Object.keys(c.leituras || {}).length
        }
      }
    })
    return base
  }, [comunicados])

  // Últimos comunicados com taxa real
  const recentComms = useMemo(() =>
    [...comunicados]
      .filter((c: ADComunicado) => c.status === 'enviado')
      .sort((a, b) => {
        const timeA = new Date(a.dataEnvio || (a as any).data || (a as any).created_at || 0).getTime()
        const timeB = new Date(b.dataEnvio || (b as any).data || (b as any).created_at || 0).getTime()
        return timeB - timeA
      })
      .slice(0, 5),
    [comunicados]
  )

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  if (!mounted) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
      Carregando painel...
    </div>
  )

  const kpis = [
    { label: 'Alunos', value: (alunos || []).length, icon: <Users size={20} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    { label: 'Ativos', value: alunosAtivos.length, icon: <UserCheck size={20} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Enviados', value: (comunicados || []).length, icon: <Send size={20} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    { label: 'Leituras', value: `${leituraRate}%`, icon: <Eye size={20} />, color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
    { label: 'Ciências', value: `${cienciaRate}%`, icon: <CheckCircle2 size={20} />, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
    { label: 'Aniversariantes', value: aniversariantesSemana.length, icon: <Cake size={20} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  ]

  const alertas = [

    momentosPendentes > 0 && {
      icon: <ImageIcon size={16} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',
      text: `${momentosPendentes} momento${momentosPendentes > 1 ? 's' : ''} aguardando aprovação`,
      href: '/agenda-digital/admin/momentos'
    },
    ocorrenciasRecentes.length > 0 && {
      icon: <AlertCircle size={16} />, color: '#ef4444', bg: 'rgba(239,68,68,0.08)',
      text: `${ocorrenciasRecentes.length} ocorrência${ocorrenciasRecentes.length > 1 ? 's' : ''} nos últimos 7 dias`,
      href: '/agenda-digital/admin/pessoas'
    },
    inadimplentes.length > 0 && {
      icon: <ShieldAlert size={16} />, color: '#ef4444', bg: 'rgba(239,68,68,0.08)',
      text: `${inadimplentes.length} aluno${inadimplentes.length > 1 ? 's' : ''} inadimplente${inadimplentes.length > 1 ? 's' : ''}`,
      href: '/agenda-digital/admin/cobrancas'
    },
  ].filter(Boolean) as any[]

  const quickActions = [
    { icon: '📣', label: 'Novo Comunicado', desc: 'Enviar para turmas ou famílias', href: '/agenda-digital/admin/comunicados', color: '#8b5cf6' },

    { icon: '📸', label: 'Aprovar Momentos', desc: `${momentosPendentes > 0 ? momentosPendentes + ' pendentes' : 'Sem pendências'}`, href: '/agenda-digital/admin/momentos', color: '#ec4899' },
    { icon: '📅', label: 'Criar Evento', desc: 'Calendário escolar', href: '/agenda-digital/admin/calendario', color: '#10b981' },
  ]

  return (
    <div className="ad-admin-page-container">
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-admin-page-container { padding: 0 16px !important; }
          .dash-kpi-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 10px !important; }
          .dash-main-grid { grid-template-columns: 1fr !important; }
          .dash-quick-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}} />

      {/* Saudação */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
          {saudacao}, {currentUser?.nome?.split(' ')[0] || 'Admin'} 👋
        </h2>
        <p style={{ color: 'hsl(var(--text-muted))', marginTop: 4 }}>
          Visão geral em tempo real da Agenda Digital.
        </p>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {alertas.map((al: any, i: number) => (
            <Link key={i} href={al.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderRadius: 12, background: al.bg, border: `1px solid ${al.color}20`,
                color: al.color, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                {al.icon}
                <span style={{ flex: 1 }}>{al.text}</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map((kpi, i) => (
          <div key={i} className="card" style={{ padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: kpi.bg, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 3 }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ações Rápidas */}
      <div className="dash-quick-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {quickActions.map((qa, i) => (
          <Link key={i} href={qa.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              padding: '18px 16px', cursor: 'pointer', transition: 'all 0.2s',
              borderLeft: `3px solid ${qa.color}`, display: 'flex', flexDirection: 'column', gap: 6
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${qa.color}20` }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              <div style={{ fontSize: 24 }}>{qa.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'hsl(var(--text-main))' }}>{qa.label}</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{qa.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Gráfico + Sidebar */}
      <div className="dash-main-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 20 }}>
        {/* Gráfico real */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Engajamento Semanal</h3>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Activity size={12} /> {totalLeituras} leituras totais
            </span>
          </div>
          {(comunicados || []).length === 0 ? (
            <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
              <Send size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p style={{ fontSize: 13 }}>Envie comunicados para gerar dados no gráfico.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLeit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEnv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border-subtle))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--text-muted))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--text-muted))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="leituras" name="Famílias que Leram" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLeit)" />
                  <Area type="monotone" dataKey="envios" name="Comunicados Enviados" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEnv)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Sidebar direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Inadimplência */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={16} color="#ef4444" /> Cobranças em Aberto
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: totalAtrasado > 0 ? '#ef4444' : '#10b981', lineHeight: 1 }}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAtrasado)}
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                  {inadimplentes.length} aluno{inadimplentes.length !== 1 ? 's' : ''} inadimplente{inadimplentes.length !== 1 ? 's' : ''}
                </div>
              </div>
              <Link href="/agenda-digital/admin/cobrancas" style={{ textDecoration: 'none' }}>
                <button className="btn btn-secondary btn-sm">Ver todos</button>
              </Link>
            </div>
          </div>

          {/* Aniversariantes */}
          {aniversariantesSemana.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cake size={16} color="#f59e0b" /> Aniversariantes da Semana
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {aniversariantesSemana.slice(0, 4).map((a: any) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎂</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nome}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.turma}</div>
                    </div>
                  </div>
                ))}
                {aniversariantesSemana.length > 4 && (
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center' }}>
                    +{aniversariantesSemana.length - 4} mais esta semana
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feed de comunicados recentes */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} /> Comunicados Recentes
          </h3>
          <Link href="/agenda-digital/admin/comunicados" style={{ textDecoration: 'none' }}>
            <button className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Ver todos <ArrowRight size={14} />
            </button>
          </Link>
        </div>
        {recentComms.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <Send size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
            <p style={{ fontSize: 13 }}>Nenhum comunicado enviado ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentComms.map((c: ADComunicado, i: number) => {
              const leituras = Object.keys(c.leituras || {}).length
              const ciencias = Object.keys(c.ciencias || {}).length
              const pctL = alunosAtivos.length > 0 ? Math.round((leituras / alunosAtivos.length) * 100) : 0
              const pctC = alunosAtivos.length > 0 ? Math.round((ciencias / alunosAtivos.length) * 100) : 0
              const prioColor = c.prioridade === 'urgente' ? '#ef4444' : c.prioridade === 'alta' ? '#f59e0b' : '#10b981'

              return (
                <div key={c.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  gap: 16, alignItems: 'center',
                  padding: '14px 0',
                  borderBottom: i < recentComms.length - 1 ? '1px solid hsl(var(--border-subtle))' : 'none'
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: prioColor, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {c.titulo}
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={10} /> {(() => {
                            const rawDate = c.dataEnvio || (c as any).data || (c as any).created_at;
                            return rawDate ? new Date(rawDate).toLocaleDateString('pt-BR') : '—';
                          })()}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Eye size={10} /> {leituras} leituras ({pctL}%)
                        </span>
                        {c.exigeCiencia && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle2 size={10} /> {ciencias} ciências ({pctC}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 5, borderRadius: 3, background: 'hsl(var(--border-subtle))', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pctL}%`, background: pctL >= 60 ? '#10b981' : pctL >= 30 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pctL >= 60 ? '#10b981' : pctL >= 30 ? '#f59e0b' : '#ef4444', minWidth: 35, textAlign: 'right' }}>
                      {pctL}%
                    </span>
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
