'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, PenTool, FileText, AlertCircle, Calendar, ChevronRight, Sparkles, BookOpen, Clock, Activity, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'

export default function SimuladosDashboard() {
  const router = useRouter()
  const { currentUserPerfil, currentUser, hydrated } = useApp()
  const isProfessor = currentUserPerfil === 'Professor'
  const [stats, setStats] = useState({
    provasAtivas: 0,
    questoesBanco: 0,
    requisicoesPendentes: 0,
    bimestreAtual: 'Carregando...'
  })
  const [recentes, setRecentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hydrated) return
    async function loadStats() {
      if (isProfessor && currentUser) {
        // Professor Stats
        const { data: requisicoes } = await supabase.from('simulados_requisicoes').select('id, id_simulado, status').eq('id_professor', currentUser.id)
        const totalPendentes = requisicoes?.filter(r => r.status === 'pendente').length || 0
        const simuladosIds = [...new Set(requisicoes?.map(r => r.id_simulado))]
        
        const { count: cQuestoes } = await supabase.from('simulados_questoes').select('*', { count: 'exact', head: true }).eq('id_professor', currentUser.id)
        
        setStats({
          provasAtivas: simuladosIds.length,
          questoesBanco: cQuestoes || 0,
          requisicoesPendentes: totalPendentes,
          bimestreAtual: 'N/A'
        })

        if (simuladosIds.length > 0) {
          const { data: rec } = await supabase.from('simulados').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome)').in('id', simuladosIds).order('created_at', { ascending: false }).limit(5)
          if (rec) setRecentes(rec)
        } else {
          setRecentes([])
        }
      } else {
        // Admin Stats
        const { count: cProvas } = await supabase.from('simulados').select('*', { count: 'exact', head: true })
        const { count: cQuestoes } = await supabase.from('simulados_questoes').select('*', { count: 'exact', head: true })
        const { count: cReq } = await supabase.from('simulados_requisicoes').select('*', { count: 'exact', head: true }).eq('status', 'pendente')
        const { data: bim } = await supabase.from('simulados_bimestres').select('nome').eq('status', 'ativo').limit(1).maybeSingle()

        setStats({
          provasAtivas: cProvas || 0,
          questoesBanco: cQuestoes || 0,
          requisicoesPendentes: cReq || 0,
          bimestreAtual: bim?.nome || 'Não definido'
        })

        const { data: rec } = await supabase.from('simulados').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome)').order('created_at', { ascending: false }).limit(5)
        if (rec) setRecentes(rec)
      }
      setLoading(false)
    }
    loadStats()
  }, [])

  if (!hydrated) return null

  const cardsAdmin = [
    { title: 'Total de Provas', value: stats.provasAtivas, icon: PenTool, color: '#f43f5e', bg: 'linear-gradient(135deg, rgba(244,63,94,0.15) 0%, rgba(244,63,94,0.05) 100%)', link: '/simulados/lista' },
    { title: 'Questões no Banco', value: stats.questoesBanco, icon: FileText, color: '#3b82f6', bg: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)', link: '/simulados/banco' },
    { title: 'Requisições Pendentes', value: stats.requisicoesPendentes, icon: AlertCircle, color: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)', link: '/simulados/gerenciamento' },
    { title: 'Bimestre Atual', value: stats.bimestreAtual, icon: Calendar, color: '#10b981', bg: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)', link: '/simulados/cadastros/bimestres', isString: true },
  ]

  const cardsProfessor = [
    { title: 'Provas Pendentes', value: stats.requisicoesPendentes, icon: AlertCircle, color: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)', link: '/simulados/lista' },
    { title: 'Minhas Questões', value: stats.questoesBanco, icon: FileText, color: '#3b82f6', bg: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)', link: '/simulados/lista' },
    { title: 'Total de Provas', value: stats.provasAtivas, icon: PenTool, color: '#8b5cf6', bg: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%)', link: '/simulados/lista' },
  ]

  const cards = isProfessor ? cardsProfessor : cardsAdmin

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
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Módulo de Simulados</span>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} style={{ fontSize: 36, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Visão Geral do Sistema
              </motion.h1>
            </div>
          </div>
        </div>

        {/* ESTATÍSTICAS - Glassmorphism Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 48 }}>
          {cards.map((c, i) => (
            <Link href={c.link} key={i} style={{ textDecoration: 'none' }}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i, duration: 0.5 }}
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{ 
                  background: 'hsl(var(--bg-surface))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid hsl(var(--border-subtle))', 
                  borderRadius: 24, 
                  padding: '24px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.05)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '40%', background: c.bg, opacity: 0.5, filter: 'blur(20px)', transform: 'translate(20%, -20%)' }} />
                
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{c.title}</div>
                  <div style={{ fontSize: c.isString ? 24 : 36, fontWeight: 900, color: 'hsl(var(--text-primary))', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {loading ? '...' : c.value}
                  </div>
                </div>
                
                <div style={{ 
                  position: 'relative', zIndex: 1, width: 56, height: 56, borderRadius: 16, 
                  background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${c.color}20`
                }}>
                  <c.icon size={28} color={c.color} strokeWidth={2.5} />
                </div>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* RECENTES - Premium List */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>
            {isProfessor ? 'Meus Trabalhos Pendentes' : 'Simulados Recentes'}
          </h3>
          <Link href="/simulados/lista" style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            Ver todos <ChevronRight size={14} />
          </Link>
        </div>
        
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-surface))', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: 'inline-block', marginBottom: 16 }}>
              <RefreshCw size={24} color="#6366f1" />
            </motion.div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Carregando dados...</div>
          </div>
        ) : recentes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AnimatePresence>
              {recentes.map((s, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * idx }}
                  key={s.id}
                  onClick={() => router.push(`/simulados/lista`)}
                  whileHover={{ scale: 1.01, backgroundColor: 'hsl(var(--bg-elevated))' }}
                  whileTap={{ scale: 0.99 }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '20px 28px',
                    background: 'hsl(var(--bg-surface))',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 20,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <BookOpen size={20} color="#6366f1" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', fontSize: 16, letterSpacing: '-0.01em' }}>{s.titulo}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={14} /> {s.simulados_bimestres?.nome}</span>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'hsl(var(--border-subtle))' }} />
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> Aplicação: {s.data_aplicacao ? new Date(s.data_aplicacao).toLocaleDateString('pt-BR') : 'Não definida'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <span style={{ 
                      padding: '6px 14px', 
                      borderRadius: 100, 
                      fontSize: 11, 
                      fontWeight: 800, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      background: s.status === 'aprovado' ? 'rgba(16,185,129,0.15)' : s.status === 'publicado' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                      color: s.status === 'aprovado' ? '#10b981' : s.status === 'publicado' ? '#3b82f6' : '#f59e0b',
                      border: `1px solid ${s.status === 'aprovado' ? 'rgba(16,185,129,0.3)' : s.status === 'publicado' ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)'}`
                    }}>
                      {s.status || 'Rascunho'}
                    </span>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'hsl(var(--bg-base))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))' }}>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 24, padding: 60, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 16px', background: 'hsl(var(--bg-elevated))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={24} color="hsl(var(--text-muted))" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Nenhum simulado cadastrado</div>
            <div style={{ fontSize: 14 }}>Comece criando seu primeiro simulado ou adicionando questões.</div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
