'use client'

import React, { useEffect, useState } from 'react'
import { 
  Users, ShieldAlert, GraduationCap, ArrowRight, HeartPulse, 
  Building2, PieChart, Heart, Activity, CheckCircle2, AlertTriangle, 
  ChevronRight, Smile, Stethoscope, Sparkles
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function GestaoPessoasDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    colaboradores: 0,
    pesquisasAtivas: 0,
    denunciasAbertas: 0,
    atendimentos: 0,
  })
  
  const [pesquisas, setPesquisas] = useState<any[]>([])

  useEffect(() => {
    // Buscar KPIs Reais
    Promise.all([
      fetch('/api/rh/funcionarios').then(res => res.ok ? res.json() : []),
      fetch('/api/gestao-pessoas/pesquisas').then(res => res.ok ? res.json() : []),
      fetch('/api/gestao-pessoas/denuncias').then(res => res.ok ? res.json() : []),
      fetch('/api/gestao-pessoas/atendimentos').then(res => res.ok ? res.json() : [])
    ]).then(([funcs, pesq, denun, atends]) => {
      
      const pAtivas = Array.isArray(pesq) ? pesq.filter(p => p.status === 'ativa') : []
      const dAbertas = Array.isArray(denun) ? denun.filter(d => d.status === 'Nova' || d.status === 'Em Análise') : []
      
      setStats({
        colaboradores: Array.isArray(funcs) ? funcs.length : 0,
        pesquisasAtivas: pAtivas.length,
        denunciasAbertas: dAbertas.length,
        atendimentos: Array.isArray(atends) ? atends.length : 0,
      })
      
      setPesquisas(pAtivas.slice(0, 3)) // Top 3
      setLoading(false)
    }).catch((e) => {
      console.error(e)
      setLoading(false)
    })
  }, [])

  const cards = [
    { label: 'Colaboradores Ativos', value: stats.colaboradores, icon: Users, color: '#4f46e5', bg: '#e0e7ff', link: '/gestao-pessoas/colaboradores' },
    { label: 'Pesquisas em Andamento', value: stats.pesquisasAtivas, icon: PieChart, color: '#0ea5e9', bg: '#e0f2fe', link: '/gestao-pessoas/pesquisa-clima' },
    { label: 'Denúncias Abertas', value: stats.denunciasAbertas, icon: ShieldAlert, color: '#f43f5e', bg: '#ffe4e6', link: '/gestao-pessoas/denuncias' },
    { label: 'Atendimentos / ASO', value: stats.atendimentos, icon: HeartPulse, color: '#10b981', bg: '#d1fae5', link: '/gestao-pessoas/atendimentos' }
  ]

  const quickLinks = [
    { title: 'Bem-Estar & Saúde Mental', desc: 'Recursos para apoio ao colaborador.', icon: Heart, link: '/gestao-pessoas/saude-mental', color: '#ec4899' },
    { title: 'SST e NR-01', desc: 'Gestão de Saúde e Segurança do Trabalho.', icon: Stethoscope, link: '/gestao-pessoas/sst', color: '#8b5cf6' },
    { title: 'Pesquisas de Clima', desc: 'Acesse relatórios e crie novas pesquisas.', icon: Smile, link: '/gestao-pessoas/pesquisa-clima', color: '#f59e0b' },
    { title: 'Treinamentos Corporativos', desc: 'Capacitação e desenvolvimento.', icon: GraduationCap, link: '/gestao-pessoas/treinamentos', color: '#14b8a6' },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1600, margin: '0 auto', minHeight: '100%', background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background Decorativo */}
      <div style={{ position: 'absolute', top: '-15%', right: '-5%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', left: '-10%', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 1);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.03);
        }
        .kpi-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
        }
        .quick-link:hover {
          background: #fff;
          transform: translateX(6px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.04);
        }
      `}</style>

      {/* Header Premium */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6 }}
        style={{ marginBottom: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)', color: '#4f46e5', padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
            <Sparkles size={16} /> Central de Gestão de Pessoas
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 48, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
            Visão Geral
          </h1>
          <p style={{ fontSize: 17, color: '#64748b', maxWidth: 600, marginTop: 12, lineHeight: 1.5 }}>
            Tenha o controle total sobre o engajamento, segurança e a saúde dos colaboradores através do ecossistema IMPACTO EDU.
          </p>
        </div>
      </motion.div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 100, color: '#94a3b8' }}>
          Carregando indicadores em tempo real...
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          
          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 48 }}>
            {cards.map((c, i) => (
              <motion.div 
                key={i} 
                variants={itemVariants}
                onClick={() => router.push(c.link)} 
                className="glass-card kpi-card"
                style={{ 
                  borderRadius: 24, padding: 32, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', 
                  display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: `radial-gradient(circle, ${c.bg} 0%, transparent 70%)`, opacity: 0.6, transform: 'translate(30%, -30%)' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px ${c.bg}` }}>
                    <c.icon size={32} strokeWidth={2.5} />
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    <ArrowRight size={20} />
                  </div>
                </div>
                
                <div style={{ zIndex: 1, marginTop: 8 }}>
                  <div style={{ fontSize: 56, fontWeight: 900, color: '#0f172a', fontFamily: "'Outfit', sans-serif", lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {c.value}
                  </div>
                  <div style={{ fontSize: 16, color: '#64748b', fontWeight: 600, marginTop: 12 }}>{c.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32 }}>
            
            {/* Quick Links / Navegação Rápida */}
            <motion.div variants={itemVariants} className="glass-card" style={{ borderRadius: 24, padding: 32 }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Activity size={24} color="#6366f1" />
                Acesso Rápido
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {quickLinks.map((link, idx) => (
                  <div 
                    key={idx} 
                    className="quick-link"
                    onClick={() => router.push(link.link)}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      padding: '20px 24px', background: 'rgba(255,255,255,0.4)', borderRadius: 16, 
                      border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${link.color}15`, color: link.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <link.icon size={24} strokeWidth={2.5} />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{link.title}</div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{link.desc}</div>
                      </div>
                    </div>
                    <ChevronRight size={20} color="#cbd5e1" />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Alertas e Pesquisas */}
            <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              
              {/* Box de Alerta (Opcional) */}
              {stats.denunciasAbertas > 0 && (
                <div className="glass-card" style={{ borderRadius: 24, padding: 32, background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', border: '1px solid #fecdd3' }}>
                  <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: '#9f1239', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: '#f43f5e', opacity: 0.2, animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                      <AlertTriangle size={24} color="#e11d48" />
                    </div>
                    Atenção Imediata
                  </h2>
                  <p style={{ color: '#be123c', fontSize: 15, margin: 0, lineHeight: 1.5 }}>
                    Existem <strong>{stats.denunciasAbertas} denúncias</strong> aguardando análise no Canal de Ética e Denúncias.
                  </p>
                  <button onClick={() => router.push('/gestao-pessoas/denuncias')} style={{ marginTop: 20, padding: '12px 24px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    Acessar Canal <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* Box de Pesquisas */}
              <div className="glass-card" style={{ borderRadius: 24, padding: 32, flex: 1 }}>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <PieChart size={24} color="#0ea5e9" />
                  Pesquisas Ativas
                </h2>
                
                {pesquisas.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {pesquisas.map((p, i) => (
                      <div key={i} onClick={() => router.push('/gestao-pessoas/pesquisa-clima')} style={{ padding: 20, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }} className="quick-link">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <strong style={{ color: '#0f172a', fontSize: 15 }}>{p.titulo}</strong>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', background: '#e0f2fe', color: '#0284c7', borderRadius: 8 }}>{p.tipo}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
                          <CheckCircle2 size={14} color="#10b981" /> {p.qtd_respostas || 0} respostas coletadas
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.5)', borderRadius: 16, border: '2px dashed #cbd5e1' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Smile size={24} />
                    </div>
                    <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Nenhuma pesquisa de clima em andamento.</p>
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
