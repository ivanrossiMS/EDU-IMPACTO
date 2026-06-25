'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Users, PenTool, FileText, TrendingUp, AlertCircle, Calendar, ChevronRight } from 'lucide-react'
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
          bimestreAtual: 'N/A' // Not super relevant for professor home, but we can leave it
        })

        if (simuladosIds.length > 0) {
          const { data: rec } = await supabase.from('simulados').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome)').in('id', simuladosIds).order('created_at', { ascending: false }).limit(4)
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

        const { data: rec } = await supabase.from('simulados').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome)').order('created_at', { ascending: false }).limit(4)
        if (rec) setRecentes(rec)
      }

      setLoading(false)
    }
    loadStats()
  }, [])

  if (!hydrated) return null

  const cardsAdmin = [
    { title: 'Total de Provas', value: stats.provasAtivas.toString(), icon: <PenTool size={24} color="#f43f5e" />, link: '/simulados/lista' },
    { title: 'Questões no Banco', value: stats.questoesBanco.toString(), icon: <FileText size={24} color="#3b82f6" />, link: '/simulados/lista' },
    { title: 'Requisições Pendentes', value: stats.requisicoesPendentes.toString(), icon: <AlertCircle size={24} color="#f59e0b" />, link: '/simulados/gerenciamento' },
    { title: 'Bimestre Atual', value: stats.bimestreAtual, icon: <Calendar size={24} color="#10b981" />, link: '/simulados/cadastros/bimestres' },
  ]

  const cardsProfessor = [
    { title: 'Provas Pendentes', value: stats.requisicoesPendentes.toString(), icon: <AlertCircle size={24} color="#f59e0b" />, link: '/simulados/lista' },
    { title: 'Minhas Questões', value: stats.questoesBanco.toString(), icon: <FileText size={24} color="#3b82f6" />, link: '/simulados/lista' },
    { title: 'Total de Provas Vinculadas', value: stats.provasAtivas.toString(), icon: <PenTool size={24} color="#f43f5e" />, link: '/simulados/lista' },
  ]

  const cards = isProfessor ? cardsProfessor : cardsAdmin

  return (
    <div style={{ padding: '40px' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
            <LayoutDashboard size={24} color="#f43f5e" />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Visão Geral</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Módulo de Geração e Gerenciamento de Simulados</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 40 }}>
          {cards.map((c, i) => (
            <Link href={c.link} key={i} style={{ textDecoration: 'none' }}>
              <div 
                style={{ 
                  background: 'hsl(var(--bg-surface))', 
                  border: '1px solid hsl(var(--border-subtle))', 
                  borderRadius: 20, 
                  padding: 24,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  opacity: loading ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.borderColor = 'hsl(var(--text-muted))'
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.title}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'hsl(var(--text-primary))', lineHeight: 1 }}>
                    {loading ? '...' : c.value}
                  </div>
                </div>
                {c.icon}
              </div>
            </Link>
          ))}
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 20 }}>{isProfessor ? 'Meus Trabalhos Pendentes' : 'Simulados Recentes'}</h3>
        
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>Carregando dados...</div>
        ) : recentes.length > 0 ? (
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, overflow: 'hidden' }}>
            {recentes.map((s, idx) => (
              <div 
                key={s.id}
                onClick={() => router.push(`/simulados/lista`)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '20px 24px',
                  borderBottom: idx < recentes.length - 1 ? '1px solid hsl(var(--border-subtle))' : 'none',
                  transition: 'background 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-app))'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', fontSize: 15 }}>{s.titulo}</span>
                  <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
                    {s.simulados_bimestres?.nome} • Aplicação: {s.data_aplicacao ? new Date(s.data_aplicacao).toLocaleDateString('pt-BR') : 'Não definida'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: 100, 
                    fontSize: 11, 
                    fontWeight: 700, 
                    textTransform: 'uppercase',
                    background: s.status === 'aprovado' ? 'rgba(16,185,129,0.1)' : s.status === 'publicado' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                    color: s.status === 'aprovado' ? '#10b981' : s.status === 'publicado' ? '#3b82f6' : '#f59e0b'
                  }}>
                    {s.status || 'Rascunho'}
                  </span>
                  <div style={{ color: 'hsl(var(--text-secondary))', display: 'flex' }}>
                    <ChevronRight size={18} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
            Nenhum simulado cadastrado ainda.
          </div>
        )}
      </motion.div>
    </div>
  )
}
