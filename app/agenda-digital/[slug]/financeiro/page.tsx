'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  AlertCircle, 
  Sparkles, 
  Wallet, 
  QrCode, 
  Receipt, 
  BellRing, 
  Clock 
} from 'lucide-react'

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { EmptyStateCard } from '../../components/EmptyStateCard'

export default function ADFinanceiroPageMock() {
  const { adConfig } = useAgendaDigital()

  if (adConfig?.permissoes?.visualizarFinanceiro === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Acesso Restrito"
          description="A visualização do painel financeiro está desativada para a sua conta ou suspensa pela instituição escolar. Para mais informações, entre em contato com o setor financeiro."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  const upcomingFeatures = [
    {
      icon: <QrCode size={22} color="#818cf8" />,
      title: "Pagamentos Instantâneos",
      desc: "Pix Copia e Cola e Cartão de Crédito com conciliação automática."
    },
    {
      icon: <Receipt size={22} color="#a78bfa" />,
      title: "Histórico & Recibos",
      desc: "Download rápido de boletos e comprovantes em PDF a qualquer momento."
    },
    {
      icon: <BellRing size={22} color="#38bdf8" />,
      title: "Notificações Inteligentes",
      desc: "Lembretes proativos de vencimento direto na sua Agenda Digital."
    }
  ]

  return (
    <div style={{ 
      maxWidth: 900, 
      margin: '0 auto', 
      padding: '20px 16px 80px', 
      fontFamily: 'Outfit, Inter, system-ui, sans-serif',
      position: 'relative'
    }}>
      {/* Background Ambient Glows */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 600,
        height: 350,
        background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.08) 40%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Main Glassmorphic Card */}
      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ 
          position: 'relative',
          zIndex: 1,
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 27, 75, 0.94) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 32,
          padding: '48px 32px',
          color: '#ffffff',
          boxShadow: '0 30px 60px -12px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
          textAlign: 'center',
          overflow: 'hidden'
        }}
      >
        {/* Decorative Grid Lines */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 0.5,
          pointerEvents: 'none'
        }} />

        {/* Floating Pulsing Badge */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 8, 
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(129, 140, 248, 0.3)',
            borderRadius: 99,
            padding: '6px 16px',
            marginBottom: 28
          }}
        >
          <span style={{ 
            position: 'relative', 
            display: 'flex', 
            width: 8, 
            height: 8 
          }}>
            <span style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: '#818cf8',
              animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              opacity: 0.75
            }} />
            <span style={{
              position: 'relative',
              borderRadius: '50%',
              width: 8,
              height: 8,
              background: '#6366f1'
            }} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#c7d2fe', textTransform: 'uppercase' }}>
            Página Em Desenvolvimento
          </span>
        </motion.div>

        {/* Central Icon Illustration */}
        <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 28px' }}>
          {/* Animated Glow Halo */}
          <motion.div 
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.4, 0.8, 0.4]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: -10,
              borderRadius: 30,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              filter: 'blur(20px)',
              opacity: 0.5
            }}
          />

          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 28,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 30px rgba(0,0,0,0.3)'
          }}>
            <Wallet size={44} color="#a5b4fc" strokeWidth={1.5} />
            <motion.div 
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 32,
                height: 32,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)',
                border: '2px solid #0f172a'
              }}
            >
              <Sparkles size={16} color="#ffffff" />
            </motion.div>
          </div>
        </div>

        {/* Title & Subtitle */}
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          style={{ 
            fontSize: 'clamp(24px, 4vw, 34px)', 
            fontWeight: 800, 
            letterSpacing: '-0.03em', 
            margin: '0 0 12px 0',
            background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Central Financeira
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          style={{ 
            fontSize: 15, 
            color: '#94a3b8', 
            maxWidth: 520, 
            margin: '0 auto 36px', 
            lineHeight: 1.6,
            fontWeight: 450
          }}
        >
          Estamos reformulando nossa Central Financeira para oferecer uma experiência ultra moderna, segura e com pagamentos facilitados diretamente pela Agenda Digital.
        </motion.p>

        {/* Upcoming Features Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
            gap: 16,
            margin: '0 auto 36px',
            textAlign: 'left'
          }}
        >
          {upcomingFeatures.map((feat, idx) => (
            <div 
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 20,
                padding: 20,
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 12, 
                background: 'rgba(255, 255, 255, 0.06)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: 14,
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                {feat.icon}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>
                {feat.title}
              </h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                {feat.desc}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Bottom Info Banner */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: '14px 20px',
            fontSize: 13,
            color: '#cbd5e1'
          }}
        >
          <Clock size={16} color="#818cf8" />
          <span>Em breve disponível. Caso necessite de boletos ou suporte financeiro no momento, entre em contato com a secretaria.</span>
        </motion.div>
      </motion.div>

      {/* Ping Animation Style Tag */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ping {
          75%, 100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
      `}} />
    </div>
  )
}

