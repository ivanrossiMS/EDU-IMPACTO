'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, PenTool, FileText, AlertCircle, Calendar, 
  ChevronRight, Sparkles, BookOpen, Clock, Activity, FileSignature, 
  User, Users, Upload, CheckCircle, ArrowRight, PlusCircle, Settings, 
  FileEdit, BookMarked
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { getDerivedStatus } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils'

export default function SimuladosDashboard() {
  const router = useRouter()
  const { currentUserPerfil, currentUser, hydrated } = useApp()
  const isProfessor = currentUserPerfil === 'Professor'
  
  const [loading, setLoading] = useState(true)
  
  // Coordinator Stats
  const [adminStats, setAdminStats] = useState({
    provasAtivas: 0,
    simuladosAtivos: 0,
    redacoesAtivas: 0,
  })
  const [adminRecent, setAdminRecent] = useState<any[]>([])

  // Professor Stats
  const [profStats, setProfStats] = useState({
    provasPendentes: 0,
    simuladosPendentes: 0,
    redacoesPendentes: 0,
  })
  const [profTasks, setProfTasks] = useState<any[]>([])

  useEffect(() => {
    if (!hydrated || !currentUser) return

    async function loadDashboard() {
      setLoading(true)
      try {
        if (isProfessor) {
          // ==============================
          // VISÃO DO PROFESSOR
          // ==============================
          
          // Buscar requisições pendentes do professor
          const [resProvas, resSimulados, resRedacao] = await Promise.all([
            (supabase as any).from('provas_upload_requisicoes').select('*, provas_upload(*)').eq('id_professor', currentUser?.id),
            (supabase as any).from('simulados_upload_requisicoes').select('*, simulados_upload(*)').eq('id_professor', currentUser?.id),
            (supabase as any).from('redacao_upload_requisicoes').select('*, redacao_upload(*)').eq('id_professor', currentUser?.id)
          ])

          const pReq = resProvas.data || []
          const sReq = resSimulados.data || []
          const rReq = resRedacao.data || []

          const pPendentes = pReq.filter((r: any) => r.status === 'pendente' || r.status === 'rejeitado')
          const sPendentes = sReq.filter((r: any) => r.status === 'pendente' || r.status === 'rejeitado')
          const rPendentes = rReq.filter((r: any) => r.status === 'pendente' || r.status === 'rejeitado')

          setProfStats({
            provasPendentes: pPendentes.length,
            simuladosPendentes: sPendentes.length,
            redacoesPendentes: rPendentes.length
          })

          // Combine and sort tasks
          let allTasks: any[] = []
          
          pPendentes.forEach((r: any) => {
            if (r.provas_upload) {
              allTasks.push({
                id: r.id,
                parentId: r.provas_upload.id,
                type: 'Prova',
                title: r.provas_upload.titulo,
                disciplina: r.disciplina_nome,
                prazo: r.provas_upload.data_limite_upload,
                statusReq: r.status,
                link: `/simulados/provas-upload/${r.provas_upload.id}/upload`,
                icon: FileSignature,
                color: '#10b981'
              })
            }
          })

          sPendentes.forEach((r: any) => {
            if (r.simulados_upload) {
              allTasks.push({
                id: r.id,
                parentId: r.simulados_upload.id,
                type: 'Simulado',
                title: r.simulados_upload.titulo,
                disciplina: r.disciplina_nome,
                prazo: r.simulados_upload.data_limite_upload,
                statusReq: r.status,
                link: `/simulados/simulados-upload/${r.simulados_upload.id}/upload`,
                icon: BookOpen,
                color: '#3b82f6'
              })
            }
          })

          rPendentes.forEach((r: any) => {
            if (r.redacao_upload) {
              allTasks.push({
                id: r.id,
                parentId: r.redacao_upload.id,
                type: 'Redação',
                title: r.redacao_upload.titulo,
                disciplina: r.disciplina_nome,
                prazo: r.redacao_upload.data_limite_upload,
                statusReq: r.status,
                link: `/simulados/redacao-upload/${r.redacao_upload.id}/upload`,
                icon: PenTool,
                color: '#f43f5e'
              })
            }
          })

          // Sort by deadline (closest first)
          allTasks.sort((a, b) => {
            if (!a.prazo) return 1
            if (!b.prazo) return -1
            return new Date(a.prazo).getTime() - new Date(b.prazo).getTime()
          })

          setProfTasks(allTasks)

        } else {
          // ==============================
          // VISÃO DO COORDENADOR
          // ==============================
          
          const [resProvas, resSimulados, resRedacao] = await Promise.all([
            (supabase as any).from('provas_upload').select('id, titulo, status, data_aplicacao, created_at, provas_upload_requisicoes(status)').order('created_at', { ascending: false }).limit(10),
            (supabase as any).from('simulados_upload').select('id, titulo, status, data_aplicacao, created_at, simulados_upload_requisicoes(status)').order('created_at', { ascending: false }).limit(10),
            (supabase as any).from('redacao_upload').select('id, titulo, status, data_aplicacao, created_at, redacao_upload_requisicoes(status)').order('created_at', { ascending: false }).limit(10)
          ])

          const pData = (resProvas.data || []).map((p: any) => ({ ...p, status: getDerivedStatus(p, 'prova') }))
          const sData = (resSimulados.data || []).map((s: any) => ({ ...s, status: getDerivedStatus(s, 'simulado') }))
          const rData = (resRedacao.data || []).map((r: any) => ({ ...r, status: getDerivedStatus(r, 'redacao') }))

          const pAtivas = pData.filter((r: any) => r.status === 'aguardando' || r.status === 'em_revisao').length
          const sAtivas = sData.filter((r: any) => r.status === 'aguardando' || r.status === 'em_revisao').length
          const rAtivas = rData.filter((r: any) => r.status === 'aguardando' || r.status === 'em_revisao').length

          setAdminStats({
            provasAtivas: pAtivas,
            simuladosAtivos: sAtivas,
            redacoesAtivas: rAtivas
          })

          let allRecent: any[] = []
          
          pData.forEach((r: any) => {
            allRecent.push({ ...r, type: 'Prova', icon: FileSignature, color: '#10b981', link: `/simulados/provas-upload/${r.id}` })
          })
          sData.forEach((r: any) => {
            allRecent.push({ ...r, type: 'Simulado', icon: BookOpen, color: '#3b82f6', link: `/simulados/simulados-upload/${r.id}` })
          })
          rData.forEach((r: any) => {
            allRecent.push({ ...r, type: 'Redação', icon: PenTool, color: '#f43f5e', link: `/simulados/redacao-upload/${r.id}` })
          })

          allRecent.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          setAdminRecent(allRecent.slice(0, 8)) // Show last 8
        }
      } catch (e: any) {
        console.error("Dashboard error:", e)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [hydrated, currentUser])

  if (!hydrated) return null

  // ==============================
  // RENDER: PROFESSOR
  // ==============================
  if (isProfessor) {
    return (
      <div className="simulados-dash-container" style={{ padding: '48px', minHeight: '100vh', background: 'hsl(var(--bg-base))' }}>
        <style>{`
          @media (max-width: 768px) {
            .simulados-dash-container {
              padding: 16px !important;
            }
            .task-feed-card {
              padding: 16px !important;
              gap: 12px !important;
            }
            .task-feed-card > div:first-child {
              gap: 12px !important;
              min-width: 0 !important;
            }
            .task-feed-card-content {
              min-width: 0 !important;
            }
            .task-feed-card-info {
              flex-direction: column !important;
              align-items: flex-start !important;
              gap: 4px !important;
            }
            .task-feed-card-arrow {
              display: none !important;
            }
            .task-feed-card h3 {
              font-size: 16px !important;
              word-break: break-word !important;
              white-space: normal !important;
            }
          }
        `}</style>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 1200, margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40, background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.02))', padding: '32px', borderRadius: 32, border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px -6px rgba(139,92,246,0.5)' }}>
              <User size={32} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                Olá, {currentUser?.nome?.split(' ')[0]}! 👋
              </h1>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 16, margin: 0, fontWeight: 500 }}>
                Você tem <strong style={{ color: '#f43f5e' }}>{profTasks.length} uploads pendentes</strong> no momento.
              </p>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 48 }}>
            {[
              { title: 'Provas Pendentes', value: profStats.provasPendentes, icon: FileSignature, color: '#10b981' },
              { title: 'Simulados Pendentes', value: profStats.simuladosPendentes, icon: BookOpen, color: '#3b82f6' },
              { title: 'Redações Pendentes', value: profStats.redacoesPendentes, icon: PenTool, color: '#f43f5e' }
            ].map((card, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * idx }}
                style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: 24, border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 24px -8px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${card.color}20, ${card.color}10)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <card.icon size={28} color={card.color} strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: 'hsl(var(--text-primary))', lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pending Tasks Feed */}
          <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 32, padding: 32, border: '1px solid hsl(var(--border-subtle))' }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Clock size={24} color="#f59e0b" /> Seus Trabalhos Pendentes
            </h2>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-secondary))' }}>
                <Activity size={40} className="animate-spin mx-auto mb-4" opacity={0.5} />
                <p>Carregando tarefas...</p>
              </div>
            ) : profTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px dashed hsl(var(--border-subtle))' }}>
                <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 8px' }}>Tudo em dia!</h3>
                <p style={{ color: 'hsl(var(--text-secondary))', margin: 0 }}>Você não possui nenhum upload pendente no momento.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {profTasks.map((task) => (
                  <Link href={task.link} key={task.id} style={{ textDecoration: 'none' }}>
                    <motion.div whileHover={{ scale: 1.01, x: 4 }} whileTap={{ scale: 0.99 }}
                      className="task-feed-card"
                      style={{ background: 'hsl(var(--bg-surface))', border: `1px solid ${task.color}30`, borderRadius: 20, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, cursor: 'pointer', transition: 'all 0.2s', boxShadow: `0 4px 20px -10px ${task.color}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${task.color}20, ${task.color}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <task.icon size={24} color={task.color} />
                        </div>
                        <div className="task-feed-card-content" style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: task.color, background: `${task.color}15`, padding: '4px 10px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {task.type}
                            </span>
                            {task.statusReq === 'rejeitado' && (
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '4px 10px', borderRadius: 100, textTransform: 'uppercase' }}>
                                Refazer
                              </span>
                            )}
                          </div>
                          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 4px' }}>{task.title}</h3>
                          <div className="task-feed-card-info" style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 500, flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookMarked size={14} /> {task.disciplina}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: task.prazo && new Date(task.prazo) < new Date() ? '#ef4444' : 'inherit' }}>
                              <Calendar size={14} /> Prazo: {task.prazo ? task.prazo.split('-').reverse().join('/') : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="task-feed-card-arrow" style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ArrowRight size={20} />
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  // ==============================
  // RENDER: COORDENADOR
  // ==============================
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aguardando': return { c: '#f59e0b', b: 'rgba(245,158,11,0.15)', l: 'Aguardando' }
      case 'em_revisao': return { c: '#3b82f6', b: 'rgba(59,130,246,0.15)', l: 'Em Revisão' }
      case 'publicado': return { c: '#8b5cf6', b: 'rgba(139,92,246,0.15)', l: 'Publicado' }
      default: return { c: '#10b981', b: 'rgba(16,185,129,0.15)', l: status }
    }
  }

  return (
    <div style={{ padding: '48px', minHeight: '100vh', background: 'hsl(var(--bg-base))' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Header & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 24 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: '0 0 8px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
              <LayoutDashboard size={32} color="#8b5cf6" /> Painel de Controle
            </h1>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 16, margin: 0, fontWeight: 500 }}>
              Visão geral do sistema de Provas, Simulados e Redações.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/simulados/provas-upload/nova" style={{ textDecoration: 'none' }}>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 14, background: '#10b981', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 8px 16px -4px rgba(16,185,129,0.4)' }}>
                <PlusCircle size={18} /> Nova Prova
              </motion.button>
            </Link>
            <Link href="/simulados/simulados-upload/nova" style={{ textDecoration: 'none' }}>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 14, background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 8px 16px -4px rgba(59,130,246,0.4)' }}>
                <PlusCircle size={18} /> Novo Simulado
              </motion.button>
            </Link>
            <Link href="/simulados/redacao-upload/nova" style={{ textDecoration: 'none' }}>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 14, background: '#f43f5e', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 8px 16px -4px rgba(244,63,94,0.4)' }}>
                <PlusCircle size={18} /> Nova Redação
              </motion.button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 48 }}>
          {[
            { title: 'Provas Ativas', value: adminStats.provasAtivas, icon: FileSignature, color: '#10b981', link: '/simulados/provas-upload' },
            { title: 'Simulados Ativos', value: adminStats.simuladosAtivos, icon: BookOpen, color: '#3b82f6', link: '/simulados/simulados-upload' },
            { title: 'Redações Ativas', value: adminStats.redacoesAtivas, icon: PenTool, color: '#f43f5e', link: '/simulados/redacao-upload' }
          ].map((card, idx) => (
            <Link href={card.link} key={idx} style={{ textDecoration: 'none' }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * idx }} whileHover={{ y: -4 }}
                style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: 24, border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 24px -8px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${card.color}20, ${card.color}10)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <card.icon size={28} color={card.color} strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: 'hsl(var(--text-primary))', lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Recent Activity Feed */}
        <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 32, padding: 32, border: '1px solid hsl(var(--border-subtle))' }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Activity size={24} color="#8b5cf6" /> Avaliações Recentes
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-secondary))' }}>
              <Activity size={40} className="animate-spin mx-auto mb-4" opacity={0.5} />
              <p>Carregando feed...</p>
            </div>
          ) : adminRecent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px dashed hsl(var(--border-subtle))' }}>
              <AlertCircle size={48} color="#94a3b8" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 8px' }}>Nenhuma avaliação encontrada</h3>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: 0 }}>Crie uma nova prova ou simulado para começar.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {adminRecent.map((item) => {
                const sColor = getStatusColor(item.status)
                return (
                  <Link href={item.link} key={`${item.type}-${item.id}`} style={{ textDecoration: 'none' }}>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      style={{ background: 'hsl(var(--bg-surface))', border: `1px solid ${item.color}30`, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${item.color}20, ${item.color}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <item.icon size={20} color={item.color} />
                          </div>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: item.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.type}</span>
                            <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                              {new Date(item.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                        <div style={{ background: sColor.b, color: sColor.c, padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          {sColor.l}
                        </div>
                      </div>

                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.titulo}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600 }}>
                          <Calendar size={14} /> Aplicação: {item.data_aplicacao ? item.data_aplicacao.split('-').reverse().join('/') : 'Não definida'}
                        </div>
                      </div>

                    </motion.div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

      </motion.div>
    </div>
  )
}
