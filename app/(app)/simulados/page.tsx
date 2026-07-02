'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, PenTool, FileText, AlertCircle, Calendar, ChevronRight, Sparkles, BookOpen, Clock, Activity, RefreshCw, FileSignature, User, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'

export default function SimuladosDashboard() {
  const router = useRouter()
  const { currentUserPerfil, currentUser, hydrated } = useApp()
  const isProfessor = currentUserPerfil === 'Professor'
  
  const [statsSimulados, setStatsSimulados] = useState({
    ativas: 0,
    questoesBanco: 0,
    requisicoesPendentes: 0,
    bimestreAtual: 'Carregando...'
  })
  const [recentesSimulados, setRecentesSimulados] = useState<any[]>([])

  const [statsProvas, setStatsProvas] = useState({
    ativas: 0,
    requisicoesPendentes: 0,
    bimestreAtual: 'Carregando...'
  })
  const [recentesProvas, setRecentesProvas] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [professoresMap, setProfessoresMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!hydrated) return
    async function loadStats() {
      try {
        const res = await fetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000')
        if (res.ok) {
          const json = await res.json()
          const users = json.data || json
          const profMap: Record<string, string> = {}
          users.forEach((u: any) => { profMap[u.id] = u.nome })
          setProfessoresMap(profMap)
        }
      } catch(e) {}

      // 1. CARREGAR DADOS DE SIMULADOS
      if (isProfessor && currentUser) {
        // Professor Stats (Simulados)
        const { data: reqsSim } = await supabase.from('simulados_requisicoes').select('id, id_simulado, status').eq('id_professor', currentUser.id)
        const totalPendentesSim = reqsSim?.filter((r: any) => r.status === 'pendente').length || 0
        const simIds = [...new Set(reqsSim?.map((r: any) => r.id_simulado))]
        
        const { count: cQuestSim } = await supabase.from('simulados_questoes').select('*', { count: 'exact', head: true }).eq('id_professor', currentUser.id)
        
        setStatsSimulados({
          ativas: simIds.length,
          questoesBanco: cQuestSim || 0,
          requisicoesPendentes: totalPendentesSim,
          bimestreAtual: 'N/A'
        })

        if (simIds.length > 0) {
          const { data: recSim } = await supabase.from('simulados').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome), turmas, simulados_questoes(id, id_professor, id_disciplina), simulados_requisicoes(id_professor, id_disciplina, quantidade_questoes, simulados_disciplinas(nome))').in('id', simIds).order('created_at', { ascending: false }).limit(5)
          if (recSim) setRecentesSimulados(recSim)
        } else {
          setRecentesSimulados([])
        }
      } else {
        // Admin Stats (Simulados)
        const { count: cSim } = await supabase.from('simulados').select('*', { count: 'exact', head: true })
        const { count: cQuestSim } = await supabase.from('simulados_questoes').select('*', { count: 'exact', head: true })
        const { count: cReqSim } = await supabase.from('simulados_requisicoes').select('*', { count: 'exact', head: true }).eq('status', 'pendente')
        const { data: bimSim } = await supabase.from('simulados_bimestres').select('nome').eq('status', 'ativo').limit(1).maybeSingle()

        setStatsSimulados({
          ativas: cSim || 0,
          questoesBanco: cQuestSim || 0,
          requisicoesPendentes: cReqSim || 0,
          bimestreAtual: (bimSim as any)?.nome || 'Não definido'
        })

        const { data: recSim } = await supabase.from('simulados').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome), turmas, simulados_questoes(id, id_professor, id_disciplina), simulados_requisicoes(id_professor, id_disciplina, quantidade_questoes, simulados_disciplinas(nome))').order('created_at', { ascending: false }).limit(5)
        if (recSim) setRecentesSimulados(recSim)
      }

      // 2. CARREGAR DADOS DE PROVAS
      if (isProfessor && currentUser) {
        // Professor Stats (Provas)
        const { data: reqsProv } = await supabase.from('provas_requisicoes').select('id, id_prova, status').eq('id_professor', currentUser.id)
        const totalPendentesProv = reqsProv?.filter((r: any) => r.status === 'pendente').length || 0
        const provIds = [...new Set(reqsProv?.map((r: any) => r.id_prova))]
        
        setStatsProvas({
          ativas: provIds.length,
          requisicoesPendentes: totalPendentesProv,
          bimestreAtual: 'N/A'
        })

        if (provIds.length > 0) {
          const { data: recProv } = await supabase.from('provas').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome), turmas, provas_questoes(id, id_professor, id_disciplina), provas_requisicoes(id_professor, id_disciplina, quantidade_questoes, simulados_disciplinas(nome))').in('id', provIds).order('created_at', { ascending: false }).limit(5)
          if (recProv) setRecentesProvas(recProv)
        } else {
          setRecentesProvas([])
        }
      } else {
        // Admin Stats (Provas)
        const { count: cProv } = await supabase.from('provas').select('*', { count: 'exact', head: true })
        const { count: cReqProv } = await supabase.from('provas_requisicoes').select('*', { count: 'exact', head: true }).eq('status', 'pendente')
        const { data: bimProv } = await supabase.from('simulados_bimestres').select('nome').eq('status', 'ativo').limit(1).maybeSingle()

        setStatsProvas({
          ativas: cProv || 0,
          requisicoesPendentes: cReqProv || 0,
          bimestreAtual: (bimProv as any)?.nome || 'Não definido'
        })

        const { data: recProv } = await supabase.from('provas').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome), turmas, provas_questoes(id, id_professor, id_disciplina), provas_requisicoes(id_professor, id_disciplina, quantidade_questoes, simulados_disciplinas(nome))').order('created_at', { ascending: false }).limit(5)
        if (recProv) setRecentesProvas(recProv)
      }

      setLoading(false)
    }
    loadStats()
  }, [])

  if (!hydrated) return null

  // CARDS ADMIN SIMULADOS
  const cardsAdminSimulados = [
    { title: 'Total de Simulados', value: statsSimulados.ativas, icon: PenTool, color: '#f43f5e', bg: 'linear-gradient(135deg, rgba(244,63,94,0.15) 0%, rgba(244,63,94,0.05) 100%)', link: '/simulados/lista' },
    { title: 'Questões no Banco', value: statsSimulados.questoesBanco, icon: FileText, color: '#3b82f6', bg: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)', link: '/simulados/banco' },
    { title: 'Requisições Pendentes', value: statsSimulados.requisicoesPendentes, icon: AlertCircle, color: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)', link: '/simulados/gerenciamento' },
  ]

  // CARDS PROFESSOR SIMULADOS
  const cardsProfessorSimulados = [
    { title: 'Simulados Pendentes', value: statsSimulados.requisicoesPendentes, icon: AlertCircle, color: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)', link: '/simulados/lista' },
    { title: 'Minhas Questões', value: statsSimulados.questoesBanco, icon: FileText, color: '#3b82f6', bg: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)', link: '/simulados/lista' },
    { title: 'Total de Simulados', value: statsSimulados.ativas, icon: PenTool, color: '#8b5cf6', bg: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%)', link: '/simulados/lista' },
  ]

  // CARDS ADMIN PROVAS
  const cardsAdminProvas = [
    { title: 'Total de Provas', value: statsProvas.ativas, icon: FileSignature, color: '#10b981', bg: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)', link: '/provas/lista' },
    { title: 'Requisições Pendentes', value: statsProvas.requisicoesPendentes, icon: AlertCircle, color: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)', link: '/provas/gerenciamento' },
    { title: 'Bimestre Atual', value: statsProvas.bimestreAtual, icon: Calendar, color: '#6366f1', bg: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)', link: '/simulados/cadastros/bimestres', isString: true },
  ]

  // CARDS PROFESSOR PROVAS
  const cardsProfessorProvas = [
    { title: 'Provas Pendentes', value: statsProvas.requisicoesPendentes, icon: AlertCircle, color: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)', link: '/provas/lista' },
    { title: 'Minhas Provas', value: statsProvas.ativas, icon: FileSignature, color: '#10b981', bg: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)', link: '/provas/lista' },
    { title: 'Bimestre Atual', value: statsProvas.bimestreAtual, icon: Calendar, color: '#6366f1', bg: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)', link: '#', isString: true },
  ]

  const currentProvasCards = isProfessor ? cardsProfessorProvas : cardsAdminProvas
  const currentSimuladosCards = isProfessor ? cardsProfessorSimulados : cardsAdminSimulados

  // Render Section Helper
  const renderSection = (
    title: string, 
    type: 'provas' | 'simulados', 
    cards: any[], 
    recentes: any[], 
    linkPrefix: string,
    IconPrincipal: any,
    colorMain: string
  ) => (
    <div style={{ marginBottom: 48, background: 'hsl(var(--bg-elevated))', borderRadius: 32, padding: 32, border: '1px solid hsl(var(--border-subtle))' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: `linear-gradient(135deg, ${colorMain} 0%, ${colorMain}80 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px -4px ${colorMain}40` }}>
          <IconPrincipal size={24} color="#fff" strokeWidth={2.5} />
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>
          {title}
        </h2>
      </div>

      {/* Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
        {cards.map((c: any, i) => (
          <Link href={c.link} key={i} style={{ textDecoration: 'none' }}>
            <motion.div 
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i, duration: 0.4 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ 
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))', 
                borderRadius: 20, 
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '50%', background: c.bg, opacity: 0.4, filter: 'blur(20px)', transform: 'translate(30%, -20%)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 800, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{c.title}</div>
                <div style={{ fontSize: c.isString ? 20 : 32, fontWeight: 900, color: 'hsl(var(--text-primary))', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {loading ? '...' : c.value}
                </div>
              </div>
              <div style={{ position: 'relative', zIndex: 1, width: 48, height: 48, borderRadius: 14, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${c.color}20` }}>
                <c.icon size={24} color={c.color} strokeWidth={2.5} />
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Recentes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.01em' }}>
          {isProfessor ? 'Trabalhos Pendentes' : `${type === 'provas' ? 'Provas Recentes' : 'Simulados Recentes'}`}
        </h3>
        <Link href={linkPrefix} style={{ fontSize: 13, fontWeight: 700, color: colorMain, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          Ver todas <ChevronRight size={14} />
        </Link>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px solid hsl(var(--border-subtle))' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: 'inline-block', marginBottom: 12 }}>
            <RefreshCw size={20} color={colorMain} />
          </motion.div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Carregando dados...</div>
        </div>
      ) : recentes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentes.map((s, idx) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * idx }}
              key={s.id}
              onClick={() => router.push(`${linkPrefix}/${s.id}`)}
              whileHover={{ scale: 1.01, backgroundColor: 'hsl(var(--bg-elevated))' }}
              whileTap={{ scale: 0.99 }}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                padding: '16px 20px', background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${colorMain}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colorMain}30` }}>
                  {type === 'provas' ? <FileSignature size={18} color={colorMain} /> : <BookOpen size={18} color={colorMain} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', fontSize: 15, letterSpacing: '-0.01em' }}>{s.titulo}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Users size={10} /> {s.turmas && s.turmas.length > 0 ? s.turmas.join(', ') : 'Geral'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {s.simulados_bimestres?.nome}</span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'hsl(var(--border-subtle))' }} />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> Aplicação: {s.data_aplicacao ? new Date(s.data_aplicacao).toLocaleDateString('pt-BR') : 'Não definida'}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200, maxWidth: 350 }}>
                {(() => {
                  const reqs = type === 'provas' ? s.provas_requisicoes : s.simulados_requisicoes;
                  const questoes = type === 'provas' ? s.provas_questoes : s.simulados_questoes;
                  if (reqs && reqs.length > 0) {
                    return reqs.map((req: any, i: number) => {
                      const profName = professoresMap[req.id_professor] || 'Professor não encontrado'
                      const requestedQty = req.quantidade_questoes || 0
                      const currentQty = questoes?.filter((q: any) => 
                        q.id_professor === req.id_professor && q.id_disciplina === req.id_disciplina
                      ).length || 0
                      const isComplete = currentQty >= requestedQty
                      const percent = requestedQty > 0 ? Math.min(100, Math.round((currentQty / requestedQty) * 100)) : 100

                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'hsl(var(--bg-app))', padding: '6px 10px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <User size={12} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 2 }}>
                            <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profName}</span>
                            <div style={{ width: '100%', height: 4, background: 'hsl(var(--bg-surface))', borderRadius: 100, overflow: 'hidden' }}>
                              <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                                style={{ height: '100%', background: isComplete ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: isComplete ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: isComplete ? '#10b981' : '#f59e0b', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                            {currentQty}/{requestedQty}
                          </div>
                        </div>
                      )
                    })
                  }
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 11, padding: '6px 10px', background: 'hsl(var(--bg-app))', borderRadius: 8, border: '1px dashed hsl(var(--border-subtle))' }}>
                      <User size={12} />
                      <span>Nenhum professor designado</span>
                    </div>
                  )
                })()}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ 
                  padding: '4px 12px', borderRadius: 100, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: s.status === 'aprovado' ? 'rgba(16,185,129,0.15)' : s.status === 'publicado' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                  color: s.status === 'aprovado' ? '#10b981' : s.status === 'publicado' ? '#3b82f6' : '#f59e0b',
                  border: `1px solid ${s.status === 'aprovado' ? 'rgba(16,185,129,0.3)' : s.status === 'publicado' ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)'}`
                }}>
                  {s.status || 'Rascunho'}
                </span>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'hsl(var(--bg-base))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))' }}>
                  <ChevronRight size={14} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 20, padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
          <div style={{ width: 48, height: 48, margin: '0 auto 12px', background: 'hsl(var(--bg-elevated))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {type === 'provas' ? <FileSignature size={20} color="hsl(var(--text-muted))" /> : <BookOpen size={20} color="hsl(var(--text-muted))" />}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Nenhum{type === 'provas' ? 'a prova cadastrada' : ' simulado cadastrado'}</div>
          <div style={{ fontSize: 13 }}>Comece criando su{type === 'provas' ? 'a' : 'o'} primeir{type === 'provas' ? 'a' : 'o'} {type === 'provas' ? 'prova' : 'simulado'} ou adicionando questões.</div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ padding: '40px', maxWidth: 1400, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
        
        {/* HERO HEADER - Ultra Moderno */}
        <div style={{ 
          position: 'relative',
          padding: '40px', 
          borderRadius: 32, 
          background: 'linear-gradient(135deg, hsl(var(--bg-elevated)) 0%, hsl(var(--bg-surface)) 100%)',
          border: '1px solid hsl(var(--border-subtle))',
          overflow: 'hidden',
          marginBottom: 40,
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)'
        }}>
          {/* Decorative Background Elements */}
          <div style={{ position: 'absolute', top: -100, right: -50, width: 300, height: 300, background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', bottom: -100, left: 100, width: 250, height: 250, background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', filter: 'blur(30px)' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24 }}>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
              style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px -5px rgba(99,102,241,0.4)' }}
            >
              <Activity size={32} color="#fff" strokeWidth={2.5} />
            </motion.div>
            <div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Sparkles size={16} color="#ec4899" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Central de Avaliações</span>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} style={{ fontSize: 36, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Dashboard Geral
              </motion.h1>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {renderSection('Provas e Exames', 'provas', currentProvasCards, recentesProvas, '/provas/lista', FileSignature, '#10b981')}
          {renderSection('Simulados', 'simulados', currentSimuladosCards, recentesSimulados, '/simulados/lista', PenTool, '#ec4899')}
        </div>
      </motion.div>
    </div>
  )
}
