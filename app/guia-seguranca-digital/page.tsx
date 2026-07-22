'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  Shield,
  Smartphone,
  CheckCircle2,
  Lock,
  Clock,
  Eye,
  UserX,
  Zap,
  Moon,
  BookOpen,
  CreditCard,
  Globe,
  Video,
  MessageSquare,
  Gamepad2,
  HeartHandshake,
  CheckSquare,
  Share2,
  Printer,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Sliders,
  Check,
  HelpCircle,
  ShieldAlert,
  Key,
  FileText,
  ChevronDown,
  UserCheck
} from 'lucide-react'

// Custom Youtube Icon component
function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

// Items for the interactive checklist
const INITIAL_CHECKLIST = [
  { id: 'ios_android', text: 'Tempo de Uso ativado (iOS) ou Family Link configurado (Android)' },
  { id: 'sleep_limit', text: 'Tempo de tela diário definido e limite de sono programado' },
  { id: 'purchases', text: 'Compras bloqueadas e loja de aplicativos protegida com senha' },
  { id: 'adult_content', text: 'Conteúdo adulto restrito no navegador de internet (Safari/Chrome)' },
  { id: 'youtube_kids', text: 'YouTube Kids configurado ou Modo Restrito ativado' },
  { id: 'house_rules', text: 'Regras de convivência familiares estabelecidas na casa' },
  { id: 'open_dialogue', text: 'Conversas frequentes e abertas iniciadas com os filhos' }
]

export default function GuiaSegurancaDigitalPage() {
  const [activeOS, setActiveOS] = useState<'all' | 'ios' | 'android'>('all')
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [copiedToast, setCopiedToast] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('impacto_guia_checklist')
      if (saved) {
        setCheckedItems(JSON.parse(saved))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const toggleCheckitem = (id: string) => {
    const updated = { ...checkedItems, [id]: !checkedItems[id] }
    setCheckedItems(updated)
    try {
      localStorage.setItem('impacto_guia_checklist', JSON.stringify(updated))
    } catch (e) {
      console.error(e)
    }
  }

  const completedCount = Object.values(checkedItems).filter(Boolean).length
  const progressPercent = Math.round((completedCount / INITIAL_CHECKLIST.length) * 100)

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Guia de Segurança Digital - Colégio Impacto',
        text: 'Aprenda a configurar o Controle Parental e proteger seus filhos na internet com o guia prático do Colégio Impacto.',
        url: window.location.href,
      }).catch(() => {})
    } else if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopiedToast(true)
      setTimeout(() => setCopiedToast(false), 3000)
    }
  }

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      lineHeight: 1.6,
      overflowX: 'hidden'
    }}>
      
      {/* ──────────────── STICKY HEADER ──────────────── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          
          {/* Brand & Logo Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              height: 48,
              padding: '6px 14px',
              borderRadius: 14,
              backgroundColor: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <Image
                src="/logo-impacto.png"
                alt="Logo Colégio Impacto"
                width={140}
                height={40}
                style={{ height: 32, width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#0047ab', display: 'block' }}>
                COLÉGIO IMPACTO
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1.1 }}>
                Guia de Segurança Digital
              </span>
            </div>
          </div>

          {/* Navigation Jump Links */}
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            fontSize: 13,
            fontWeight: 700,
            color: '#475569'
          }}>
            <a href="#apresentacao" style={{ color: '#475569', textDecoration: 'none' }}>Visão Geral</a>
            <a href="#iphone" style={{ color: '#475569', textDecoration: 'none' }}>🍏 iPhone</a>
            <a href="#android" style={{ color: '#475569', textDecoration: 'none' }}>🤖 Android</a>
            <a href="#apps-populares" style={{ color: '#475569', textDecoration: 'none' }}>🎮 Apps</a>
            <a href="#faq" style={{ color: '#475569', textDecoration: 'none' }}>❓ Dúvidas</a>
            <a href="#checklist" style={{ color: '#0047ab', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckSquare size={16} /> Checklist
            </a>
          </nav>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleShare}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Share2 size={15} color="#0047ab" />
              <span>Compartilhar</span>
            </button>
            <button
              onClick={handlePrint}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                border: 'none',
                backgroundColor: '#0047ab',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(0, 71, 171, 0.2)'
              }}
            >
              <Printer size={15} />
              <span>Salvar PDF</span>
            </button>
          </div>

        </div>

        {copiedToast && (
          <div style={{ backgroundColor: '#10b981', color: '#ffffff', textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '6px' }}>
            Link copiado para a área de transferência!
          </div>
        )}
      </header>


      {/* ──────────────── HERO SECTION (PÁGINA 1) ──────────────── */}
      <section id="inicio" style={{
        padding: '60px 24px 80px',
        background: 'linear-gradient(180deg, #f0f6ff 0%, #ffffff 100%)',
        borderBottom: '1px solid #f1f5f9'
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 48,
          alignItems: 'center'
        }}>
          
          {/* Left Text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '8px 16px 8px 10px',
              borderRadius: 20,
              backgroundColor: '#ffffff',
              border: '1px solid #bfdbfe',
              boxShadow: '0 6px 20px rgba(0, 71, 171, 0.08)',
              width: 'fit-content'
            }}>
              <div style={{
                padding: '6px 12px',
                borderRadius: 12,
                backgroundColor: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Image
                  src="/logo-impacto.png"
                  alt="Logo Colégio Impacto"
                  width={120}
                  height={36}
                  style={{ height: 26, width: 'auto', objectFit: 'contain' }}
                />
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#0047ab', display: 'block' }}>
                  INICIATIVA PEDAGÓGICA OFICIAL
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'block' }}>
                  Colégio Impacto
                </span>
              </div>
            </div>

            <h1 style={{
              fontSize: 'clamp(2.2rem, 4vw, 3.4rem)',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              margin: 0
            }}>
              GUIA DE SEGURANÇA DIGITAL{' '}
              <span style={{
                display: 'block',
                background: 'linear-gradient(135deg, #0047ab 0%, #2563eb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Para Pais e Responsáveis
              </span>
            </h1>

            <p style={{ fontSize: 18, color: '#475569', fontWeight: 500, margin: 0, lineHeight: 1.6 }}>
              Como proteger crianças e adolescentes na internet de forma simples, visual e prática — passo a passo sem jargões técnicos.
            </p>

            {/* Quick Stats Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 16, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', fontSize: 14, fontWeight: 700, color: '#334155' }}>
                <CheckCircle2 size={18} color="#10b981" />
                <span>25 Tópicos Práticos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 16, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', fontSize: 14, fontWeight: 700, color: '#334155' }}>
                <Clock size={18} color="#0047ab" />
                <span>Configuração em Minutos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 16, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', fontSize: 14, fontWeight: 700, color: '#334155' }}>
                <Shield size={18} color="#6366f1" />
                <span>100% Gratuito & Oficial</span>
              </div>
            </div>

            {/* Hero CTAs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, paddingTop: 12 }}>
              <a
                href="#apresentacao"
                style={{
                  padding: '14px 28px',
                  borderRadius: 16,
                  backgroundColor: '#0047ab',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 16,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 6px 20px rgba(0, 71, 171, 0.3)'
                }}
              >
                Começar Leitura Prática
                <ArrowRight size={18} />
              </a>
              <a
                href="#checklist"
                style={{
                  padding: '14px 24px',
                  borderRadius: 16,
                  backgroundColor: '#f1f5f9',
                  color: '#0f172a',
                  fontWeight: 800,
                  fontSize: 16,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                Ir para Checklist
              </a>
            </div>

          </div>

          {/* Right Hero Image Card */}
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{
              borderRadius: 28,
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 40px rgba(0, 71, 171, 0.12)'
            }}>
              <Image
                src="/guia-seguranca/family_digital_safety.jpg"
                alt="Família no uso seguro de dispositivos"
                width={700}
                height={400}
                priority
                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
              />
              <div style={{
                padding: 20,
                backgroundColor: '#0f172a',
                color: '#ffffff'
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>
                  Aesthetic Apple & Google Education
                </span>
                <p style={{ fontSize: 14, fontWeight: 700, margin: '4px 0 0 0', color: '#ffffff' }}>
                  Ambiente digital seguro para quem você mais ama
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 2: APRESENTAÇÃO ──────────────── */}
      <section id="apresentacao" style={{ padding: '80px 24px', backgroundColor: '#ffffff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          
          <div style={{
            backgroundColor: '#f8fafc',
            borderRadius: 32,
            padding: '40px 36px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 32
            }}>
              
              <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0047ab', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <HeartHandshake size={20} />
                  <span>Boas-vindas ao Guia</span>
                </div>

                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Bem-vindos ao mundo digital seguro! 👋
                </h2>

                <p style={{ fontSize: 16, color: '#334155', margin: 0, lineHeight: 1.6 }}>
                  A tecnologia é uma janela incrível para o mundo. Ela aproxima, ensina e diverte. Mas o ambiente digital exige o mesmo cuidado que temos no mundo físico.
                </p>

                <p style={{ fontSize: 16, color: '#334155', fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
                  Nós não deixamos nossos filhos andarem sozinhos à noite em uma rua desconhecida. Na internet, também precisamos guiá-los e segurar suas mãos.
                </p>

                <p style={{ fontSize: 15, color: '#475569', margin: 0 }}>
                  O <strong style={{ color: '#0047ab' }}>Colégio Impacto</strong> preparou este guia prático. Sem jargões técnicos, você aprenderá a configurar o Controle Parental nos celulares da sua casa em poucos minutos.
                </p>

                <p style={{ fontSize: 17, fontWeight: 800, color: '#0047ab', margin: '4px 0 0 0' }}>
                  Vamos juntos proteger quem mais amamos?
                </p>

              </div>

              {/* Handshake vector icon */}
              <div style={{
                width: 120,
                height: 120,
                borderRadius: 28,
                backgroundColor: '#dbeafe',
                border: '2px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0047ab',
                flexShrink: 0
              }}>
                <HeartHandshake size={64} />
              </div>

            </div>

            {/* Recommendation Box */}
            <div style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              backgroundColor: '#ecfdf5',
              borderLeft: '5px solid #10b981',
              padding: '16px 20px',
              borderRadius: 16
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#10b981',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 18,
                flexShrink: 0
              }}>
                ✓
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#064e3b', margin: 0 }}>
                  Recomendação Prática da Equipe Pedagógica
                </p>
                <p style={{ fontSize: 13, color: '#065f46', margin: '2px 0 0 0' }}>
                  Leia este guia com o celular da criança em mãos. Vá aplicando as configurações passo a passo!
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 3: O QUE É E COMO FUNCIONA? ──────────────── */}
      <section id="conceito" style={{ padding: '80px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 48px' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Fundamentos da Proteção
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 0 0' }}>
              O &quot;cinto de segurança&quot; da internet 🛡️
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
            marginBottom: 40
          }}>
            
            <div style={{ backgroundColor: '#ffffff', padding: 32, borderRadius: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#dbeafe', color: '#0047ab', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Shield size={24} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>O que é o Controle Parental?</h3>
              <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.6 }}>
                São ferramentas gratuitas e oficiais (embutidas no próprio celular) que ajudam você a gerenciar a experiência dos seus filhos nas telas de maneira preventiva.
              </p>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: 32, borderRadius: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Sliders size={24} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>Como funciona?</h3>
              <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.6 }}>
                Você conecta o seu aparelho ao da criança. À distância, você define regras invisíveis: bloqueia conteúdos, define horários e aprova novos aplicativos.
              </p>
            </div>

          </div>

          {/* VISUAL FLOWCHART (1. Seu Celular -> 2. Nuvem -> 3. Celular da Criança) */}
          <div style={{ backgroundColor: '#ffffff', padding: 36, borderRadius: 28, border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <h4 style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0047ab', margin: '0 0 28px 0' }}>
              Fluxo da Conexão e Controle à Distância
            </h4>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20
            }}>
              
              <div style={{ backgroundColor: '#eff6ff', padding: 24, borderRadius: 20, border: '1px solid #bfdbfe', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, margin: '0 auto 12px', borderRadius: 14, backgroundColor: '#0047ab', color: '#ffffff', fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  1
                </div>
                <h5 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>Seu Celular</h5>
                <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Você envia comandos, define permissões e limites de tempo.</p>
              </div>

              <div style={{ backgroundColor: '#eef2ff', padding: 24, borderRadius: 20, border: '1px solid #c7d2fe', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, margin: '0 auto 12px', borderRadius: 14, backgroundColor: '#4338ca', color: '#ffffff', fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  2
                </div>
                <h5 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>Nuvem Segura</h5>
                <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Sinal criptografado oficial (Apple iCloud / Google Family).</p>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: 24, borderRadius: 20, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, margin: '0 auto 12px', borderRadius: 14, backgroundColor: '#15803d', color: '#ffffff', fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  3
                </div>
                <h5 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>Celular da Criança</h5>
                <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Aplica automaticamente as restrições e filtros de horário.</p>
              </div>

            </div>
          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 4: POR QUE É IMPORTANTE ATUALMENTE? ──────────────── */}
      <section id="riscos" style={{ padding: '80px 24px', backgroundColor: '#eef6ff', borderTop: '1px solid #dbeafe' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 48px' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Conscientização Necessária
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 12px 0' }}>
              A internet não tem faixa etária 🌍
            </h2>
            <p style={{ fontSize: 16, color: '#334155', margin: 0 }}>
              Navegar sem filtros expõe o cérebro em desenvolvimento a riscos diários reais. As crianças têm curiosidade, mas não têm maturidade para lidar com:
            </p>
          </div>

          {/* 4 Quadrantes (Cards brancos no fundo azul) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 20
          }}>
            
            <div style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 24, border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Eye size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>👁️ Conteúdo Inadequado</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Violência extrema e sites adultos a apenas um clique inadvertido no navegador.
              </p>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 24, border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <UserX size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>🎭 Contato com Estranhos</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Adultos mal-intencionados se passando por crianças em chats de jogos.
              </p>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 24, border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Clock size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>⏳ Excesso de Telas</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Aplicativos projetados para viciar o cérebro, roubando horas de sono e estudos.
              </p>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 24, border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Zap size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>⚡ Cyberbullying</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Agressões virtuais rápidas e anônimas em grupos de mensagens ou redes.
              </p>
            </div>

          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 5: BENEFÍCIOS DO CONTROLE PARENTAL ──────────────── */}
      <section id="beneficios" style={{ padding: '80px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 48px' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Transformação Positiva
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 12px 0' }}>
              Paz para os pais, saúde para os filhos 🌟
            </h2>
            <p style={{ fontSize: 16, color: '#475569', margin: 0 }}>
              Quando você aplica as configurações deste guia, a rotina da sua casa muda imediatamente:
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 20
          }}>
            
            <div style={{ backgroundColor: '#f0f6ff', padding: 24, borderRadius: 24, border: '1px solid #bfdbfe' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#0047ab', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Moon size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>💤 Sono de Qualidade</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                O celular &quot;dorme&quot; e trava na hora certa de ir para a cama à noite.
              </p>
            </div>

            <div style={{ backgroundColor: '#f0f6ff', padding: 24, borderRadius: 24, border: '1px solid #bfdbfe' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#4338ca', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <BookOpen size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>📚 Foco Total</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Aplicativos de distração somem na hora de fazer a lição de casa.
              </p>
            </div>

            <div style={{ backgroundColor: '#f0f6ff', padding: 24, borderRadius: 24, border: '1px solid #bfdbfe' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#059669', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <CreditCard size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>💳 Economia Segura</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Nenhuma compra é efetuada sem a sua senha e aprovação prévia.
              </p>
            </div>

            <div style={{ backgroundColor: '#f0f6ff', padding: 24, borderRadius: 24, border: '1px solid #bfdbfe' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#0284c7', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Shield size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>🛡️ Navegação Limpa</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Filtros bloqueiam sites perigosos de forma automática 24h por dia.
              </p>
            </div>

          </div>

        </div>
      </section>


      {/* ──────────────── OS FILTER SWITCHER ──────────────── */}
      <div style={{ padding: '36px 24px 12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', display: 'block', marginBottom: 10 }}>
          Filtrar por dispositivo
        </span>
        <div style={{
          display: 'inline-flex',
          padding: 6,
          borderRadius: 16,
          backgroundColor: '#e2e8f0',
          gap: 6
        }}>
          <button
            onClick={() => setActiveOS('all')}
            style={{
              padding: '8px 18px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: activeOS === 'all' ? '#ffffff' : 'transparent',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: activeOS === 'all' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            Ver Todos os Passos
          </button>
          <button
            onClick={() => setActiveOS('ios')}
            style={{
              padding: '8px 18px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: activeOS === 'ios' ? '#0047ab' : 'transparent',
              color: activeOS === 'ios' ? '#ffffff' : '#334155',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            🍏 iPhone (iOS)
          </button>
          <button
            onClick={() => setActiveOS('android')}
            style={{
              padding: '8px 18px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: activeOS === 'android' ? '#059669' : 'transparent',
              color: activeOS === 'android' ? '#ffffff' : '#334155',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            🤖 Android (Google)
          </button>
        </div>
      </div>


      {/* ──────────────── PÁGINA 6 & 7: GUIA DO IPHONE (iOS) ──────────────── */}
      {(activeOS === 'all' || activeOS === 'ios') && (
        <section id="iphone" style={{ padding: '60px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 36 }}>
            
            {/* iPhone Intro Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 32,
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#6b21a8', backgroundColor: '#f3e8ff', padding: '4px 12px', borderRadius: 20, width: 'fit-content' }}>
                  🍏 Recursos Nativos da Apple
                </span>
                <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Guia do iPhone (iOS)
                </h2>
                <p style={{ fontSize: 15, color: '#334155', margin: 0, lineHeight: 1.6 }}>
                  A ferramenta oficial da Apple já vem instalada. Ela se chama <strong style={{ color: '#6b21a8' }}>Tempo de Uso</strong>. É gratuita, segura e você não precisa baixar nada.
                </p>
                <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
                  Ela permite ver relatórios de uso, bloquear compras e limitar aplicativos. Tudo protegido por um código secreto de 4 dígitos.
                </p>
              </div>

              {/* iPhone Mockup Vector */}
              <div style={{ display: 'flex', justifySelf: 'center' }}>
                <div style={{
                  width: 220,
                  height: 330,
                  borderRadius: 36,
                  border: '4px solid #1e293b',
                  backgroundColor: '#0f172a',
                  padding: 10,
                  boxShadow: '0 16px 36px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ width: 70, height: 12, backgroundColor: '#1e293b', borderRadius: '0 0 10px 10px', margin: '0 auto 10px' }}></div>
                  <div style={{
                    flex: 1,
                    backgroundColor: '#581c87',
                    borderRadius: 24,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: 12
                  }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#ffffff', color: '#6b21a8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={32} />
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#e9d5ff', textTransform: 'uppercase' }}>Apple iOS</span>
                      <p style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', margin: 0 }}>Tempo de Uso</p>
                    </div>
                    <span style={{ fontSize: 10, backgroundColor: '#ffffff', color: '#6b21a8', fontWeight: 800, padding: '4px 8px', borderRadius: 12 }}>
                      Código de 4 Dígitos
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* iPhone Steps (1 a 4) */}
            <div style={{ backgroundColor: '#ffffff', padding: 36, borderRadius: 28, border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={22} color="#6b21a8" />
                Como ativar agora mesmo no iPhone:
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 24
              }}>
                <div style={{ padding: 16, borderRadius: 16, backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: '#6b21a8', color: '#ffffff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>1</span>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>Abra os ⚙️ Ajustes</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>No menu inicial do iOS</p>
                </div>
                <div style={{ padding: 16, borderRadius: 16, backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: '#6b21a8', color: '#ffffff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>2</span>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>Toque em ⏳ Tempo de Uso</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Procure o ícone roxo</p>
                </div>
                <div style={{ padding: 16, borderRadius: 16, backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: '#6b21a8', color: '#ffffff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>3</span>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>Toque em Ativar</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Confirme o início</p>
                </div>
                <div style={{ padding: 16, borderRadius: 16, backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: '#6b21a8', color: '#ffffff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>4</span>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>Selecione:</p>
                  <span style={{ fontSize: 11, fontWeight: 800, backgroundColor: '#e9d5ff', color: '#581c87', padding: '2px 8px', borderRadius: 8 }}>
                    &quot;Este iPhone é de uma Criança&quot;
                  </span>
                </div>
              </div>

              {/* Warning Alert */}
              <div style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: '#fffbeb',
                borderLeft: '4px solid #f59e0b',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12
              }}>
                <AlertTriangle size={20} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#78350f', margin: 0 }}>⚠ Atenção ao criar o Código do Tempo de Uso</p>
                  <p style={{ fontSize: 12, color: '#92400e', margin: '2px 0 0 0' }}>
                    O sistema pedirá para criar o Código do Tempo de Uso (4 dígitos). <strong style={{ color: '#78350f' }}>Nunca coloque a mesma senha que a criança já usa para desbloquear a tela!</strong>
                  </p>
                </div>
              </div>

            </div>

          </div>
        </section>
      )}


      {/* ──────────────── PÁGINA 8 & 9: GUIA DO ANDROID (GOOGLE) ──────────────── */}
      {(activeOS === 'all' || activeOS === 'android') && (
        <section id="android" style={{ padding: '60px 24px', backgroundColor: '#ecfdf5', borderTop: '1px solid #a7f3d0' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 36 }}>
            
            {/* Android Intro Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 32,
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#047857', backgroundColor: '#d1fae5', padding: '4px 12px', borderRadius: 20, width: 'fit-content' }}>
                  🤖 Recursos Nativos do Google
                </span>
                <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Guia do Android (Google)
                </h2>
                <p style={{ fontSize: 15, color: '#334155', margin: 0, lineHeight: 1.6 }}>
                  Se o celular for Samsung, Motorola ou Xiaomi, a ferramenta oficial é o aplicativo <strong style={{ color: '#047857' }}>Google Family Link</strong>.
                </p>
                <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
                  Ele funciona como um controle remoto: você instala o app no seu celular e gerencia o aparelho do seu filho de onde você estiver.
                </p>

                <div style={{ padding: 14, borderRadius: 16, backgroundColor: '#ffffff', border: '1px solid #a7f3d0', fontSize: 13, color: '#064e3b', fontWeight: 600 }}>
                  💡 <strong>Dica:</strong> O Family Link permite até ver a <u>localização no mapa (GPS) em tempo real</u> do celular da criança.
                </div>
              </div>

              {/* Android Mockup Vector */}
              <div style={{ display: 'flex', justifySelf: 'center' }}>
                <div style={{
                  width: 220,
                  height: 330,
                  borderRadius: 36,
                  border: '4px solid #1e293b',
                  backgroundColor: '#0f172a',
                  padding: 10,
                  boxShadow: '0 16px 36px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ width: 10, height: 10, backgroundColor: '#1e293b', borderRadius: '50%', margin: '0 auto 10px' }}></div>
                  <div style={{
                    flex: 1,
                    backgroundColor: '#047857',
                    borderRadius: 24,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: 12
                  }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#ffffff', color: '#047857', fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      🪁
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#a7f3d0', textTransform: 'uppercase' }}>Google Android</span>
                      <p style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', margin: 0 }}>Family Link</p>
                    </div>
                    <span style={{ fontSize: 10, backgroundColor: '#ffffff', color: '#047857', fontWeight: 800, padding: '4px 8px', borderRadius: 12 }}>
                      GPS + Controle Remoto
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Android Steps (1 a 3) */}
            <div style={{ backgroundColor: '#ffffff', padding: 36, borderRadius: 28, border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={22} color="#047857" />
                Como conectar os aparelhos em 3 passos:
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                <div style={{ padding: 18, borderRadius: 18, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#047857', color: '#ffffff', fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    1
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>No SEU celular:</p>
                    <p style={{ fontSize: 13, color: '#475569', margin: '2px 0 0 0' }}>
                      Baixe o app <strong>Google Family Link</strong>. Abra e confirme que você é o &quot;Pai/Mãe&quot;. O app vai gerar um código numérico.
                    </p>
                  </div>
                </div>

                <div style={{ padding: 18, borderRadius: 18, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#047857', color: '#ffffff', fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    2
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>No celular da CRIANÇA:</p>
                    <p style={{ fontSize: 13, color: '#475569', margin: '2px 0 0 0' }}>
                      Vá em <strong>Configurações &gt; Google &gt; Controle Parental</strong> (ou abra o app Family Link para Crianças).
                    </p>
                  </div>
                </div>

                <div style={{ padding: 18, borderRadius: 18, backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#065f46', color: '#ffffff', fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    3
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#064e3b', margin: 0 }}>A Conexão Interligada:</p>
                    <p style={{ fontSize: 13, color: '#065f46', margin: '2px 0 0 0' }}>
                      Siga as instruções na tela da criança e digite o código de interligação gerado no seu celular. Pronto! Aparelhos conectados.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Segredos Anti-Burlar */}
            <div style={{ backgroundColor: '#ffffff', padding: 32, borderRadius: 28, border: '1px solid #fcd34d', boxShadow: '0 4px 16px rgba(245, 158, 11, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b45309' }}>Segurança Avançada</span>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>🕵️ Segredos Anti-Burlar (Truques comuns das crianças)</h3>
                </div>
              </div>

              <p style={{ fontSize: 14, color: '#475569', margin: '0 0 20px 0', lineHeight: 1.6 }}>
                Crianças e adolescentes descobrem rapidamente truques na internet para tentar contornar os bloqueios. Veja como fechar essas brechas:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
                
                <div style={{ backgroundColor: '#fffbeb', padding: 18, borderRadius: 18, border: '1px solid #fde68a' }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#78350f', margin: '0 0 6px 0' }}>🍏 Truque no iPhone: Mudar Fuso Horário</p>
                  <p style={{ fontSize: 13, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                    Eles alteram o relógio do aparelho para ganhar horas extras de tela. <br />
                    <strong>Solução:</strong> Vá em <em>Ajustes &gt; Tempo de Uso &gt; Restrições de Conteúdo e Privacidade &gt; Alterações de Fuso Horário</em> e marque <strong>Não Permitir</strong>.
                  </p>
                </div>

                <div style={{ backgroundColor: '#fffbeb', padding: 18, borderRadius: 18, border: '1px solid #fde68a' }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#78350f', margin: '0 0 6px 0' }}>🤖 Truque no Android: Remover Conta Google</p>
                  <p style={{ fontSize: 13, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                    Eles tentam desvincular a conta infantil das configurações. <br />
                    <strong>Solução:</strong> No app Family Link, acesse <em>Controles &gt; Dispositivo &gt; Exigir senha do responsável para remover conta</em>.
                  </p>
                </div>

              </div>
            </div>

          </div>
        </section>
      )}


      {/* ──────────────── PÁGINA 10: TEMPO DE TELA & TABELA DE IDADES ──────────────── */}
      <section id="tempo" style={{ padding: '80px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 40px' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Recomendação Médica e Pedagógica
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 12px 0' }}>
              ⏳ A dose certa de internet
            </h2>
            <p style={{ fontSize: 16, color: '#475569', margin: 0 }}>
              O cérebro precisa descansar das telas para se desenvolver com saúde. Limitar o uso não é castigo, é cuidado médico.
            </p>
          </div>

          {/* Age Recommendation Table */}
          <div style={{
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid #cbd5e1',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <th style={{ padding: '16px 24px', textAlign: 'left' }}>Idade</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left' }}>Recomendação dos Especialistas</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 14, color: '#334155' }}>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 800, color: '#0f172a' }}>
                    <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>Até 2 anos</span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <strong style={{ color: '#dc2626' }}>Zero telas.</strong> Foco no mundo real e estímulos sensoriais físicos.
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 800, color: '#0f172a' }}>
                    <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>2 a 5 anos</span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    Máximo de <strong>1 hora/dia</strong> (com supervisão ativa de um adulto).
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 800, color: '#0f172a' }}>
                    <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>6 a 10 anos</span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <strong>1 a 2 horas/dia</strong> (focando em qualidade de conteúdo).
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '16px 24px', fontWeight: 800, color: '#0f172a' }}>
                    <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>11+ anos</span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    Tempo combinado em acordo familiar (sem prejudicar sono/estudos).
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 11 & 12: LIMITAR TEMPO & BLOQUEIO DE APPS ──────────────── */}
      <section id="regras" style={{ padding: '80px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Configurações Práticas
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 0 0' }}>
              O celular avisa quando acaba! ⏰
            </h2>
            <p style={{ fontSize: 15, color: '#475569', margin: '4px 0 0 0' }}>
              Delegue o &quot;não&quot; para o aparelho. Faça o celular &quot;dormir&quot; automaticamente à noite.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            
            <div style={{ backgroundColor: '#ffffff', padding: 28, borderRadius: 24, border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>🍏</span>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>No iPhone (iOS):</h3>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Tempo de Repouso</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#334155', margin: 0, backgroundColor: '#faf5ff', padding: 14, borderRadius: 14, border: '1px solid #e9d5ff' }}>
                Vá em <strong>Ajustes &gt; Tempo de Uso &gt; Tempo de Repouso</strong>. Defina o horário em que tudo é bloqueado automaticamente (ex: 21h às 07h).
              </p>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: 28, borderRadius: 24, border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>🤖</span>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>No Android:</h3>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Hora de Dormir</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#334155', margin: 0, backgroundColor: '#ecfdf5', padding: 14, borderRadius: 14, border: '1px solid #a7f3d0' }}>
                Abra o <strong>Family Link</strong>, escolha o perfil do filho e vá em <strong>Hora de dormir</strong>. Configure o bloqueio total para a noite.
              </p>
            </div>

          </div>

          {/* Alerta de 1h antes de deitar */}
          <div style={{
            backgroundColor: '#fff1f2',
            borderLeft: '5px solid #f43f5e',
            padding: 20,
            borderRadius: 18,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14
          }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>❌</span>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: '#881337', margin: 0 }}>Evite telas 1 hora antes de deitar</h4>
              <p style={{ fontSize: 13, color: '#9f1239', margin: '4px 0 0 0' }}>
                A luz azul do visor bloqueia o hormônio do sono (melatonina), gerando insônia, irritabilidade e cansaço escolar no dia seguinte.
              </p>
            </div>
          </div>

          {/* Bloqueio de Apps */}
          <div style={{ backgroundColor: '#ffffff', padding: 32, borderRadius: 28, border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#0047ab', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Lock size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>🚫 Você no controle do que é instalado</h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0 0' }}>
                  Sempre que a criança tentar baixar um novo jogo, uma notificação de aprovação chegará no seu celular.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div style={{ padding: 14, borderRadius: 14, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155' }}>
                <strong style={{ color: '#6b21a8' }}>🍏 iPhone:</strong> Tempo de Uso &gt; Limites de Apps &gt; Adicionar Limite. (Você pode travar redes como TikTok em 30 min por dia).
              </div>
              <div style={{ padding: 14, borderRadius: 14, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155' }}>
                <strong style={{ color: '#047857' }}>🤖 Android:</strong> Family Link &gt; Limites de apps. (Escolha o app da lista e toque no cadeado para travar).
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 13 & 14: COMPRAS & CONTEÚDO ADULTO ──────────────── */}
      <section id="compras-conteudo" style={{ padding: '80px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* Card Compras */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
            color: '#ffffff',
            padding: '36px 32px',
            borderRadius: 28,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd' }}>
                <CreditCard size={26} />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#93c5fd' }}>Proteção Financeira</span>
                <h3 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#ffffff' }}>💳 Adeus às faturas surpresas!</h3>
              </div>
            </div>

            <p style={{ fontSize: 15, color: '#e2e8f0', margin: '0 0 20px 0', lineHeight: 1.6 }}>
              Jogos infantis são fáceis de baixar, mas induzem as crianças a comprar &quot;moedas&quot; ou &quot;roupas virtuais&quot; com dinheiro de verdade. Com um clique rápido, a criança gera uma dívida.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', fontSize: 13, color: '#f1f5f9' }}>
                <strong style={{ color: '#93c5fd' }}>🍏 No iPhone:</strong> Tempo de Uso &gt; Restrições de Conteúdo e Privacidade &gt; Compras na App Store. Mude &quot;Compras dentro de apps&quot; para <strong>Não Permitir</strong>.
              </div>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', fontSize: 13, color: '#f1f5f9' }}>
                <strong style={{ color: '#a7f3d0' }}>🤖 No Android:</strong> App Family Link &gt; Controles &gt; Aprovações de Compras. Marque a opção <strong>Todo o conteúdo</strong>.
              </div>
            </div>
          </div>

          {/* Card Conteúdo Adulto */}
          <div style={{ backgroundColor: '#f8fafc', padding: 32, borderRadius: 28, border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#4338ca', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={22} />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4338ca' }}>Navegação Web</span>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>🔒 Navegação livre de riscos</h3>
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#475569', margin: '0 0 16px 0' }}>
              As crianças usam navegadores (Safari, Chrome) para pesquisas da escola. É crucial ativar filtros contra sites violentos e adultos na web.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, fontSize: 13, color: '#334155' }}>
              <div style={{ backgroundColor: '#ffffff', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <strong>🍏 No Safari (iPhone):</strong> Tempo de Uso &gt; Restrições de Conteúdo e Privacidade &gt; Restrições de Conteúdo &gt; Conteúdo da Web. Marque <strong>Limitar Sites Adultos</strong>.
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <strong>🤖 No Chrome (Android):</strong> Family Link &gt; Controles &gt; Google Chrome. Selecione a opção <strong>Tentar bloquear sites explícitos</strong>.
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 15 & 16: YOUTUBE KIDS E MODO RESTRITO ──────────────── */}
      <section id="youtube" style={{ padding: '80px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#dc2626' }}>
              Vídeos & Streaming
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 0 0' }}>
              📺 O filtro certo para vídeos
            </h2>
            <p style={{ fontSize: 15, color: '#475569', margin: '4px 0 0 0' }}>
              O YouTube tradicional tem um algoritmo altamente viciante desenhado para adolescentes e adultos.
            </p>
          </div>

          {/* Comparativo YouTube Tradicional vs YouTube Kids */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            
            <div style={{ backgroundColor: '#ffffff', padding: 28, borderRadius: 24, border: '1px solid #fecdd3' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <YoutubeIcon style={{ width: 28, height: 28, color: '#94a3b8' }} />
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>YouTube Normal</h3>
                </div>
                <span style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffe4e6', color: '#e11d48', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</span>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Não recomendado para menores de 12 anos. Conteúdo sem filtro prévio e algoritmo viciante.
              </p>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: 28, borderRadius: 24, border: '2px solid #10b981', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.1)', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <YoutubeIcon style={{ width: 28, height: 28, color: '#dc2626' }} />
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>YouTube Kids</h3>
                </div>
                <span style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#d1fae5', color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</span>
              </div>
              <p style={{ fontSize: 13, color: '#334155', margin: '0 0 12px 0' }}>
                Ambiente 100% curado e seguro. Exclua o YouTube normal e instale apenas o YouTube Kids.
              </p>
              <div style={{ backgroundColor: '#ecfdf5', padding: 10, borderRadius: 12, border: '1px solid #a7f3d0', fontSize: 12, color: '#064e3b', fontWeight: 600 }}>
                💡 <strong>Dica:</strong> Desative a lupa de &quot;Pesquisa&quot; nas configurações do YouTube Kids.
              </div>
            </div>

          </div>

          {/* Modo Restrito para Adolescentes */}
          <div style={{ backgroundColor: '#ffffff', padding: 28, borderRadius: 24, border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={20} color="#0047ab" />
              O Modo Restrito para Adolescentes (13+ anos)
            </h3>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px 0' }}>
              Se o seu filho já é adolescente e o YouTube Kids ficou infantil, ajuste o aplicativo normal:
            </p>
            <div style={{ backgroundColor: '#eff6ff', padding: 14, borderRadius: 14, border: '1px solid #bfdbfe', fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
              Abra o YouTube &gt; Foto de perfil &gt; Configurações &gt; Geral &gt; <strong>Ativar Modo Restrito</strong>. Isso filtra automaticamente vídeos com linguagem pesada ou violência.
            </div>
          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 17 & 18: REDES SOCIAIS ──────────────── */}
      <section id="redes" style={{ padding: '80px 24px', backgroundColor: '#eef6ff', borderTop: '1px solid #dbeafe' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Convivência Conectada
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 0 0' }}>
              💬 A praça pública da internet
            </h2>
            <p style={{ fontSize: 15, color: '#334155', margin: '4px 0 0 0' }}>
              WhatsApp, Instagram e TikTok exigem idade mínima de 13 anos. Se o adolescente usa, a privacidade é obrigatória.
            </p>
          </div>

          <div style={{
            backgroundColor: '#fffbeb',
            borderLeft: '5px solid #f59e0b',
            padding: 20,
            borderRadius: 18
          }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#78350f', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="#d97706" />
              Atenção à Segurança Física
            </p>
            <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
              Adolescentes amam postar o dia a dia. <strong style={{ color: '#78350f' }}>Ensine-os a nunca postar a localização em tempo real (GPS), principalmente com o uniforme do colégio na rua.</strong>
            </p>
          </div>

          {/* Checklist de Blindagem */}
          <div style={{ backgroundColor: '#ffffff', padding: 32, borderRadius: 28, border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={22} color="#0047ab" />
              Ajustes obrigatórios nos perfis:
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
              
              <div style={{ backgroundColor: '#f0f6ff', padding: 20, borderRadius: 18, border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: 24 }}>🔒</span>
                <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '6px 0 4px 0' }}>Conta Privada</h4>
                <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Apenas conhecidos da vida real podem ver as fotos publicadas.</p>
              </div>

              <div style={{ backgroundColor: '#f0f6ff', padding: 20, borderRadius: 18, border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: 24 }}>🔕</span>
                <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '6px 0 4px 0' }}>Restrição de DM</h4>
                <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Bloqueie mensagens diretas de pessoas estranhas.</p>
              </div>

              <div style={{ backgroundColor: '#f0f6ff', padding: 20, borderRadius: 18, border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: 24 }}>👁️</span>
                <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '6px 0 4px 0' }}>Ocultar Curtidas</h4>
                <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Esconder os likes alivia a pressão estética e ansiedade.</p>
              </div>

            </div>
          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 19: JOGOS ON-LINE ──────────────── */}
      <section id="jogos" style={{ padding: '80px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          
          <div style={{
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '36px 32px',
            borderRadius: 28,
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Gamepad2 size={24} />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#60a5fa' }}>Roblox, Minecraft, Free Fire</span>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', margin: 0 }}>🎮 O perigo invisível do Bate-papo</h2>
              </div>
            </div>

            <p style={{ fontSize: 15, color: '#cbd5e1', margin: '0 0 16px 0', lineHeight: 1.6 }}>
              Jogos on-line não são perigosos apenas pelos gráficos, mas por conectarem as crianças ao mundo todo simultaneamente. Adultos mal-intencionados usam chats de voz/texto disfarçados de crianças.
            </p>

            <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,0.12)' }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Como blindar:</p>
              <p style={{ fontSize: 13, color: '#ffffff', margin: 0 }}>
                Acesse as configurações de segurança dentro de cada jogo e mude a comunicação para <strong>&quot;Ninguém&quot;</strong> ou <strong>&quot;Apenas Amigos&quot;</strong>.
              </p>
            </div>
          </div>

        </div>
      </section>


      {/* ──────────────── APPS POPULARES ──────────────── */}
      <section id="apps-populares" style={{ padding: '80px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Proteção Aplicativo por Aplicativo
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 0 0' }}>
              📱 Guia Rápido dos Apps Mais Usados
            </h2>
            <p style={{ fontSize: 15, color: '#475569', margin: '4px 0 0 0' }}>
              Passo a passo direto para blindar as redes e jogos favoritos das crianças e adolescentes:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            
            <div style={{ backgroundColor: '#f8fafc', padding: 24, borderRadius: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>🤖</span>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>Roblox</h3>
              </div>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Crie um <strong>PIN de Responsáveis</strong> (4 dígitos) em <em>Configurações &gt; Segurança</em> para impedir que a criança altere a senha ou gaste Robux sem permissão.
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: 24, borderRadius: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>💬</span>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>WhatsApp</h3>
              </div>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Ative a <strong>Verificação em Duas Etapas</strong> (PIN de 6 dígitos) para evitar clonagem e em <em>Privacidade &gt; Grupos</em> selecione <strong>Apenas meus contatos</strong>.
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: 24, borderRadius: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>🎵</span>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>TikTok</h3>
              </div>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Use a <strong>Sincronização Familiar</strong> (Family Pairing) para vincular sua conta à do filho e definir tempo máximo e bloqueio de pesquisas.
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: 24, borderRadius: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>🎧</span>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>Discord</h3>
              </div>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Conecte-se via <strong>Central da Família</strong> do Discord para ver em quais servidores seu filho está sem ler o conteúdo privado das DMs.
              </p>
            </div>

          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 20, 21 & 22: DIÁLOGO & HÁBITOS ──────────────── */}
      <section id="dialogo" style={{ padding: '80px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Acompanhamento Afetivo
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 0 0' }}>
              🗣️ O maior filtro é o diálogo
            </h2>
            <p style={{ fontSize: 15, color: '#475569', margin: '4px 0 0 0' }}>
              Controles parentais não substituem a presença. Sente ao lado deles e demonstre interesse.
            </p>
          </div>

          {/* O Pacto da Segurança Familiar */}
          <div style={{ backgroundColor: '#ffffff', padding: 32, borderRadius: 28, border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={20} color="#0047ab" />
              O Pacto da Segurança Familiar:
            </h3>

            <div style={{ backgroundColor: '#0047ab', color: '#ffffff', padding: 24, borderRadius: 24, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Diga a eles:</span>
              <p style={{ fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.5 }}>
                &quot;Se alguém falar algo estranho ou assustador com você na internet, venha correndo me contar. Você não vai ficar de castigo e eu não vou tomar seu celular. Eu vou proteger você.&quot;
              </p>
            </div>
          </div>

          {/* Hábitos Digitais Saudáveis */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
            <div style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 24, border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <span style={{ fontSize: 32 }}>🌙</span>
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>Desconexão Noturna</h4>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Substitua a tela por um livro ou conversa 1 hora antes de dormir.</p>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 24, border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <span style={{ fontSize: 32 }}>⚽</span>
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>Lazer Offline</h4>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Tenha sempre jogos de tabuleiro ou convites para esportes à mão.</p>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 24, border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <span style={{ fontSize: 32 }}>🌱</span>
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>O Exemplo Arrasta</h4>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Se os pais usam o celular na mesa do jantar sem parar, a criança imita.</p>
            </div>
          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 23: REGRAS DA CASA ──────────────── */}
      <section id="acordo" style={{ padding: '80px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Convivência Harmoniosa
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 0 0' }}>
              🤝 O Acordo da Nossa Casa
            </h2>
            <p style={{ fontSize: 15, color: '#475569', margin: '4px 0 0 0' }}>
              Crie regras claras de convivência. Reúna a família e combinem juntos:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
            
            <div style={{ backgroundColor: '#f0f6ff', padding: 24, borderRadius: 24, border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: 32 }}>🍽️</span>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>1. Mesa Livre</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Durante as refeições, nenhum celular é permitido (nem dos adultos).
              </p>
            </div>

            <div style={{ backgroundColor: '#f0f6ff', padding: 24, borderRadius: 24, border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: 32 }}>🛏️</span>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>2. Quarto para Descanso</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Celulares devem carregar na sala à noite, nunca no quarto.
              </p>
            </div>

            <div style={{ backgroundColor: '#f0f6ff', padding: 24, borderRadius: 24, border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: 32 }}>🔓</span>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>3. Acesso Aberto</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Os pais devem saber as senhas. Privacidade total é para adultos.
              </p>
            </div>

            <div style={{ backgroundColor: '#f0f6ff', padding: 24, borderRadius: 24, border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: 32 }}>⏸️</span>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>4. Pausa Imediata</h3>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Quando um familiar estiver falando com você, a tela deve ser pausada.
              </p>
            </div>

          </div>

        </div>
      </section>





      {/* ──────────────── PERGUNTAS FREQUENTES (FAQ PEDAGÓGICO) ──────────────── */}
      <section id="faq" style={{ padding: '80px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Orientação da Equipe Pedagógica
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 0 0' }}>
              ❓ Perguntas Frequentes dos Pais
            </h2>
            <p style={{ fontSize: 15, color: '#475569', margin: '4px 0 0 0' }}>
              Respostas para os dilemas mais comuns na rotina de educar no mundo digital:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            
            {[
              {
                q: 'Meu filho diz que os colegas da escola não têm limites de tempo. O que responder?',
                a: 'Explique com afeto que cada família possui regras próprias de proteção baseadas no amor e na saúde. Lembre-o de que regras de segurança como usar o cinto de segurança no carro ou horário de dormir também variam entre famílias, e que o limite de telas é um ato de cuidado da sua casa, não uma punição.'
              },
              {
                q: 'Como lidar com birras ou forte resistência na hora de desligar o celular?',
                a: 'Dê avisos prévios graduais ("Faltam 15 minutos", "Faltam 5 minutos para encerrar o tempo"). O cérebro da criança precisa desse tempo de transição. Mantenha a firmeza sem gritar e redirecione imediatamente a atenção dela para uma atividade física, refeição ou banho agradável.'
              },
              {
                q: 'Tenho o direito de ler as mensagens e checar o celular do meu filho adolescente?',
                a: 'A supervisão parental é um dever legal e moral dos pais até a maioridade. No entanto, para adolescentes (13+ anos), faça a checagem com transparência ("Vamos dar uma olhada nos seus aplicativos juntos hoje") em vez de esconder. O objetivo é orientar sobre riscos reais, e não bisbilhotar conversas inofensivas.'
              },
              {
                q: 'O que fazer em caso de suspeita de Cyberbullying ou contato estranho?',
                a: '1. Não apague as mensagens ou prints (eles servem de prova legal). 2. Acolha seu filho sem brigar ou ameaçar tirar o celular para manter o canal de confiança aberto. 3. Bloqueie e denuncie o perfil. 4. Notifique a coordenação do Colégio Impacto para apoio pedagógico e, se houver crime, registre um B.O.'
              }
            ].map((item, index) => {
              const isOpen = openFaq === index
              return (
                <div
                  key={index}
                  style={{
                    backgroundColor: isOpen ? '#f0f6ff' : '#f8fafc',
                    borderRadius: 20,
                    border: isOpen ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    overflow: 'hidden',
                    transition: 'all 0.2s'
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    style={{
                      width: '100%',
                      padding: 20,
                      backgroundColor: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      cursor: 'pointer',
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#0f172a'
                    }}
                  >
                    <span>{item.q}</span>
                    <ChevronDown size={20} color="#0047ab" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 20px 20px 20px', fontSize: 14, color: '#334155', lineHeight: 1.6, borderTop: '1px solid rgba(0,71,171,0.1)', paddingTop: 12 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              )
            })}

          </div>

        </div>
      </section>


      {/* ──────────────── PÁGINA 24: CHECKLIST FINAL INTERATIVO ──────────────── */}
      <section id="checklist" style={{ padding: '80px 24px', backgroundColor: '#0f172a', color: '#ffffff', borderTop: '1px solid #1e293b' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#60a5fa' }}>
              Checklist Prático Interativo
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#ffffff', margin: '8px 0 0 0' }}>📋 Missão Cumprida?</h2>
            <p style={{ fontSize: 15, color: '#94a3b8', margin: '4px 0 0 0' }}>
              Marque os itens à medida que for configurando o aparelho da sua família:
            </p>
          </div>

          {/* Progress Bar */}
          <div style={{ backgroundColor: '#1e293b', padding: 20, borderRadius: 20, border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: '#cbd5e1', marginBottom: 8 }}>
              <span>Progresso de Proteção:</span>
              <span style={{ color: '#60a5fa' }}>{completedCount} de {INITIAL_CHECKLIST.length} ({progressPercent}%)</span>
            </div>
            <div style={{ width: '100%', height: 12, backgroundColor: '#334155', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #10b981)', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>

          {/* Interactive Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {INITIAL_CHECKLIST.map((item) => {
              const isChecked = !!checkedItems[item.id]
              return (
                <button
                  key={item.id}
                  onClick={() => toggleCheckitem(item.id)}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 18,
                    border: isChecked ? '1px solid #2563eb' : '1px solid #334155',
                    backgroundColor: isChecked ? 'rgba(37, 99, 235, 0.15)' : '#1e293b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    border: isChecked ? '2px solid #2563eb' : '2px solid #64748b',
                    backgroundColor: isChecked ? '#2563eb' : '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0
                  }}>
                    {isChecked && <Check size={16} />}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.8 : 1 }}>
                    {item.text}
                  </span>
                </button>
              )
            })}
          </div>

          {completedCount === INITIAL_CHECKLIST.length && (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', padding: 20, borderRadius: 20, textAlign: 'center', color: '#34d399' }}>
              <p style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>🎉 Parabéns! Dispositivo 100% Protegido!</p>
              <p style={{ fontSize: 13, margin: '4px 0 0 0' }}>Você garantiu um espaço digital seguro para a sua família.</p>
            </div>
          )}

        </div>
      </section>


      {/* ──────────────── PÁGINA 25: MENSAGEM DO COLÉGIO IMPACTO & RODAPÉ ──────────────── */}
      <section style={{ padding: '80px 24px', backgroundColor: '#0047ab', color: '#ffffff', textAlign: 'center' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center' }}>
          
          <div style={{
            padding: '12px 28px',
            borderRadius: 24,
            backgroundColor: '#0f172a',
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Image
              src="/logo-impacto.png"
              alt="Colégio Impacto"
              width={180}
              height={56}
              style={{ height: 50, width: 'auto', objectFit: 'contain' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: '#ffffff' }}>
              🎓 Conectando Família, Escola e Futuro
            </h2>

            <p style={{ fontSize: 16, color: '#e0edff', margin: 0, lineHeight: 1.6 }}>
              Nós acreditamos que a tecnologia, quando bem guiada, aproxima as pessoas, ensina habilidades incríveis e prepara nossas crianças para um mundo repleto de possibilidades.
            </p>

            <p style={{ fontSize: 16, color: '#e0edff', margin: 0, lineHeight: 1.6 }}>
              Nenhum aplicativo ou filtro substitui o olhar atento, o diálogo profundo e o afeto de uma família. O Controle Parental é apenas um ato de cuidado, que garante aos nossos alunos um espaço digital seguro para aprender e crescer.
            </p>

            <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', padding: 20, borderRadius: 20, fontWeight: 800, fontSize: 16, color: '#ffffff' }}>
              A combinação infalível para promover uma infância saudável e segura é o elo entre Família, Escola e Controle Parental.
            </div>

            <p style={{ fontSize: 15, color: '#e0edff', margin: 0 }}>
              Contem sempre com o nosso apoio para guiar seus filhos — no pátio da escola e na imensidão da internet.
            </p>
          </div>

          <div style={{ paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.2)', width: '100%' }}>
            <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#ffffff' }}>Um abraço afetuoso,</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#bfdbfe', margin: '4px 0 0 0' }}>Equipe Pedagógica – Colégio Impacto</p>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: '#090d16', color: '#64748b', padding: '24px 24px', textAlign: 'center', fontSize: 12, borderTop: '1px solid #1e293b' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>© {new Date().getFullYear()} Colégio Impacto. Todos os direitos reservados. Guia de Segurança Digital para Famílias.</span>
          <a href="#inicio" style={{ color: '#94a3b8', textDecoration: 'none' }}>Voltar ao topo ↑</a>
        </div>
      </footer>

    </div>
  )
}
