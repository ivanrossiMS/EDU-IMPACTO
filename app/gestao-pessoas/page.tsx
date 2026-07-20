'use client'

import React, { useEffect, useState } from 'react'
import { 
  Users, ShieldAlert, GraduationCap, ArrowRight, HeartPulse, 
  PieChart, Heart, Activity, CheckCircle2, AlertTriangle, 
  Stethoscope, Sparkles, Scale, HelpCircle, BookOpen, Clock, Zap
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion, Variants } from 'framer-motion'
import { useApp } from '@/lib/context'

export default function GestaoPessoasDashboard() {
  const router = useRouter()
  const { currentUser } = useApp()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    colaboradores: 0,
    pesquisasAtivas: 0,
    denunciasAbertas: 0,
    atendimentos: 0,
  })
  
  const [pesquisas, setPesquisas] = useState<any[]>([])
  const [denunciasList, setDenunciasList] = useState<any[]>([])
  const [atendimentosList, setAtendimentosList] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/rh/funcionarios').then(res => res.ok ? res.json() : []),
      fetch('/api/gestao-pessoas/pesquisas').then(res => res.ok ? res.json() : []),
      fetch('/api/gestao-pessoas/denuncias').then(res => res.ok ? res.json() : []),
      fetch('/api/gestao-pessoas/atendimentos').then(res => res.ok ? res.json() : [])
    ]).then(([funcs, pesq, denun, atends]) => {
      
      const isAdmin = currentUser?.cargo === 'Administrador Master' || currentUser?.perfil === 'Administrador'
      
      const pAtivas = Array.isArray(pesq) ? pesq.filter(p => String(p.status || '').toLowerCase() === 'ativa') : []
      const dAbertas = Array.isArray(denun) ? denun.filter(d => {
        const s = String(d.status || '').toLowerCase()
        const isOpen = ['nova', 'novo', 'em análise', 'em analise', 'em andamento', 'aberta', 'pendente'].includes(s)
        return isOpen && (isAdmin || d.relator_id === currentUser?.id)
      }) : []
      const aPendentes = Array.isArray(atends) ? atends.filter(a => {
        const s = String(a.status || '').toLowerCase()
        const isOpen = ['novo', 'nova', 'agendado', 'aguardando', 'em andamento', 'em análise', 'aberto', 'pendente'].includes(s)
        return isOpen && (isAdmin || a.funcionario_id === currentUser?.id)
      }) : []
      
      setStats({
        colaboradores: Array.isArray(funcs) ? funcs.length : 0,
        pesquisasAtivas: pAtivas.length,
        denunciasAbertas: dAbertas.length,
        atendimentos: aPendentes.length,
      })
      
      setPesquisas(pAtivas.slice(0, 4))
      setDenunciasList(dAbertas.slice(0, 4))
      setAtendimentosList(aPendentes.slice(0, 4))
      setLoading(false)
    }).catch((e) => {
      console.error(e)
      setLoading(false)
    })
  }, [currentUser])

  const isAdmin = currentUser?.cargo === 'Administrador Master' || currentUser?.perfil === 'Administrador'

  const modules = [
    { title: 'Colaboradores', desc: 'Gestão de equipe e perfis.', icon: Users, link: '/gestao-pessoas/colaboradores', color: '#3b82f6', bg: '#eff6ff', adminOnly: true },
    { title: 'Pesquisa de Clima', desc: 'Análise de engajamento.', icon: PieChart, link: '/gestao-pessoas/pesquisa-clima', color: '#0ea5e9', bg: '#e0f2fe' },
    { title: 'Treinamentos', desc: 'Capacitação contínua.', icon: GraduationCap, link: '/gestao-pessoas/treinamentos', color: '#14b8a6', bg: '#ccfbf1' },
    { title: 'SST e NR-01', desc: 'Segurança do trabalho.', icon: Stethoscope, link: '/gestao-pessoas/sst', color: '#8b5cf6', bg: '#f3e8ff', adminOnly: true },
    { title: 'Bem-Estar', desc: 'Apoio à saúde mental.', icon: Heart, link: '/gestao-pessoas/saude-mental', color: '#ec4899', bg: '#fdf2f8' },
    { title: 'Atendimentos', desc: 'Gestão de consultas.', icon: HeartPulse, link: '/gestao-pessoas/atendimentos', color: '#10b981', bg: '#ecfdf5' },
    { title: 'Denúncias', desc: 'Canal de ética seguro.', icon: ShieldAlert, link: '/gestao-pessoas/denuncias', color: '#f43f5e', bg: '#ffe4e6' },
    { title: 'Direitos', desc: 'Guia do colaborador.', icon: Scale, link: '/gestao-pessoas/direitos', color: '#f59e0b', bg: '#fef3c7' },
    { title: 'FAQ', desc: 'Dúvidas frequentes.', icon: HelpCircle, link: '/gestao-pessoas/faq', color: '#6366f1', bg: '#e0e7ff' },
  ].filter(m => isAdmin || !m.adminOnly)

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } }
  }

  return (
    <div style={{ padding: '48px', maxWidth: 1600, margin: '0 auto', minHeight: '100%', background: '#f8fafc', position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Decoração de Fundo */}
      <div style={{ position: 'absolute', top: -200, right: -100, width: 600, height: 600, background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 60%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -200, left: -100, width: 600, height: 600, background: 'radial-gradient(circle, rgba(236,72,153,0.06) 0%, transparent 60%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <style>{`
        .module-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .module-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.06);
          border-color: #cbd5e1;
        }
        .module-card:hover .module-icon-box {
          transform: scale(1.1) rotate(5deg);
        }
        .kpi-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          transition: all 0.3s;
        }
        .kpi-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
        }
      `}</style>

      {/* Cabeçalho */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6 }}
        style={{ marginBottom: 40 }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)', color: '#4f46e5', padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
          <Sparkles size={16} /> Ecossistema IMPACTO EDU
        </div>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 44, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
          Gestão de Pessoas
        </h1>
        <p style={{ fontSize: 17, color: '#64748b', maxWidth: 650, marginTop: 12, lineHeight: 1.6 }}>
          Acompanhe os principais indicadores organizacionais, gerencie o bem-estar da equipe e garanta um ambiente seguro e em conformidade com as normas institucionais.
        </p>
      </motion.div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: '#94a3b8', gap: 12, fontSize: 16 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
            <Activity size={24} color="#6366f1" />
          </motion.div>
          Sincronizando dados da central...
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          
          {/* Métricas Principais (KPIs) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {[
              { label: 'Colaboradores Ativos', value: stats.colaboradores, icon: Users, color: '#4f46e5', bg: '#e0e7ff', link: '/gestao-pessoas/colaboradores', adminOnly: true },
              { label: 'Pesquisas em Andamento', value: stats.pesquisasAtivas, icon: PieChart, color: '#0ea5e9', bg: '#e0f2fe', link: '/gestao-pessoas/pesquisa-clima' },
              { label: 'Atendimentos Pendentes', value: stats.atendimentos, icon: Clock, color: '#f59e0b', bg: '#fef3c7', link: '/gestao-pessoas/atendimentos' },
              { label: 'Denúncias Abertas', value: stats.denunciasAbertas, icon: ShieldAlert, color: '#f43f5e', bg: '#ffe4e6', link: '/gestao-pessoas/denuncias' }
            ].filter(c => isAdmin || !c.adminOnly).map((c, i) => (
              <motion.div 
                key={i} 
                variants={itemVariants}
                onClick={() => router.push(c.link)} 
                className="kpi-card"
                style={{ 
                  borderRadius: 24, padding: 28, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: c.bg, opacity: 0.5, filter: 'blur(30px)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <c.icon size={28} strokeWidth={2.5} />
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    <ArrowRight size={18} />
                  </div>
                </div>
                <div style={{ zIndex: 1, marginTop: 4 }}>
                  <div style={{ fontSize: 44, fontWeight: 900, color: '#0f172a', fontFamily: "'Outfit', sans-serif", lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {c.value}
                  </div>
                  <div style={{ fontSize: 15, color: '#64748b', fontWeight: 600, marginTop: 8 }}>{c.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Seção de Listas Dinâmicas (3 colunas) */}
          <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            
            {/* Lista de Denúncias */}
            <div style={{ borderRadius: 24, padding: 28, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={20} color="#f43f5e" />
                  Denúncias Abertas
                </h3>
                <span style={{ fontSize: 12, fontWeight: 700, background: '#ffe4e6', color: '#e11d48', padding: '4px 10px', borderRadius: 100 }}>
                  {stats.denunciasAbertas}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                {denunciasList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {denunciasList.map((d, i) => (
                      <div key={i} onClick={() => router.push('/gestao-pessoas/denuncias')} style={{ padding: 16, background: '#f8fafc', borderRadius: 16, border: '1px solid #fecdd3', cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #f43f5e' }} onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2' }} onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <strong style={{ color: '#1e293b', fontSize: 14, textTransform: 'capitalize' }}>{d.assunto || d.tipo || d.protocolo || 'Denúncia'}</strong>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: '#ffe4e6', color: '#e11d48', borderRadius: 6 }}>{d.status}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          Relatado em: {new Date(d.created_at || d.createdAt || new Date()).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                    {stats.denunciasAbertas > 4 && (
                      <button onClick={() => router.push('/gestao-pessoas/denuncias')} style={{ width: '100%', background: '#fff1f2', border: 'none', color: '#f43f5e', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8, padding: 12, borderRadius: 12 }}>
                        Ver todas as denúncias &rarr;
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: 16, border: '1px dashed #cbd5e1', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: 12 }} />
                    <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Nenhuma denúncia pendente.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de Atendimentos */}
            <div style={{ borderRadius: 24, padding: 28, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HeartPulse size={20} color="#10b981" />
                  Atendimentos Pendentes
                </h3>
                <span style={{ fontSize: 12, fontWeight: 700, background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: 100 }}>
                  {stats.atendimentos}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                {atendimentosList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {atendimentosList.map((a, i) => (
                      <div key={i} onClick={() => router.push('/gestao-pessoas/atendimentos')} style={{ padding: 16, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #10b981' }} onMouseEnter={e => { e.currentTarget.style.background = '#ecfdf5' }} onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <strong style={{ color: '#1e293b', fontSize: 14 }}>{a.solicitante || 'Apoio Psicológico'}</strong>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: '#ecfdf5', color: '#059669', borderRadius: 6 }}>{a.tipo}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          Criado em: {a.created_at || a.data ? new Date(a.created_at || a.data).toLocaleDateString() : 'Aguardando'}
                        </div>
                      </div>
                    ))}
                    {stats.atendimentos > 4 && (
                      <button onClick={() => router.push('/gestao-pessoas/atendimentos')} style={{ width: '100%', background: '#ecfdf5', border: 'none', color: '#10b981', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8, padding: 12, borderRadius: 12 }}>
                        Ver todos atendimentos &rarr;
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: 16, border: '1px dashed #cbd5e1', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Stethoscope size={32} color="#94a3b8" style={{ marginBottom: 12 }} />
                    <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Nenhum atendimento pendente.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de Pesquisas */}
            <div style={{ borderRadius: 24, padding: 28, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={20} color="#0ea5e9" />
                  Pesquisas Ativas
                </h3>
                <span style={{ fontSize: 12, fontWeight: 700, background: '#f0f9ff', color: '#0284c7', padding: '4px 10px', borderRadius: 100 }}>
                  {stats.pesquisasAtivas}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                {pesquisas.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pesquisas.map((p, i) => (
                      <div key={i} onClick={() => router.push('/gestao-pessoas/pesquisa-clima')} style={{ padding: 16, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #0ea5e9' }} onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff' }} onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <strong style={{ color: '#1e293b', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{p.titulo}</strong>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: '#e0f2fe', color: '#0284c7', borderRadius: 6, flexShrink: 0 }}>{p.tipo}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12 }}>
                          <CheckCircle2 size={14} color="#10b981" /> <strong>{p.qtd_respostas || 0}</strong> respostas coletadas
                        </div>
                      </div>
                    ))}
                    {stats.pesquisasAtivas > 4 && (
                      <button onClick={() => router.push('/gestao-pessoas/pesquisa-clima')} style={{ width: '100%', background: '#f0f9ff', border: 'none', color: '#0ea5e9', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8, padding: 12, borderRadius: 12 }}>
                        Ver todas pesquisas &rarr;
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: 16, border: '1px dashed #cbd5e1', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <PieChart size={32} color="#94a3b8" style={{ marginBottom: 12 }} />
                    <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>O ambiente está mapeado. Não há pesquisas em andamento.</p>
                  </div>
                )}
              </div>
            </div>

          </motion.div>

          {/* Grid de Módulos (Navegação Principal) */}
          <motion.div variants={itemVariants} style={{ marginTop: 16 }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={24} color="#3b82f6" />
              Explorar Módulos
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
              {modules.map((mod, idx) => (
                <div 
                  key={idx} 
                  className="module-card"
                  onClick={() => router.push(mod.link)}
                  style={{ 
                    borderRadius: 20, padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 16
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="module-icon-box" style={{ width: 52, height: 52, borderRadius: 14, background: mod.bg, color: mod.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                      <mod.icon size={26} strokeWidth={2} />
                    </div>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{mod.title}</h3>
                    <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>{mod.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
