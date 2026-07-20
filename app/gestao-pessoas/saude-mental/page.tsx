'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Heart, Activity, Coffee, Brain, Phone, ShieldCheck, FileText, ArrowRight, 
  CheckCircle, Star, Moon, AlertCircle, Zap, Flame, Users, Wind, Video, Headphones,
  Lightbulb, Send, Droplet, Dumbbell, CheckSquare, Square, MessageCircle,
  Monitor, Sun, User, MousePointer2, Keyboard
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useRouter } from 'next/navigation'
import { SidePanel } from '@/components/ui/SidePanel'
import { useApp } from '@/lib/context'

export default function SaudeMentalPage() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const { currentUser } = useApp()
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [activeCard, setActiveCard] = useState<{ id: string, title: string, icon: any, color: string, bg: string, subtitle: string } | null>(null)

  // Novas ferramentas
  const [ideia, setIdeia] = useState('')
  const [ideiaEnviada, setIdeiaEnviada] = useState(false)
  const [isIdeiaModalOpen, setIsIdeiaModalOpen] = useState(false)
  const [dicaDia, setDicaDia] = useState('')
  
  useEffect(() => {
    const dicas = [
      "Levante da cadeira a cada 60 minutos.",
      "Beba água, hidratação é energia.",
      "Descanse a visão focando longe por 20 segundos.",
      "Ajuste seu monitor para a altura dos olhos.",
      "Alongue o pescoço e os pulsos antes de começar.",
      "Respire fundo 3 vezes antes de reuniões.",
      "Mantenha as costas totalmente apoiadas na cadeira."
    ]
    setDicaDia(dicas[Math.floor(Math.random() * dicas.length)])
  }, [])

  const cards = [
    { id: 'sono', title: 'Higiene do Sono', desc: 'Práticas para melhorar a qualidade do seu descanso e restaurar a energia.', icon: Moon, color: '#6366f1', bg: '#e0e7ff', subtitle: 'Durma melhor, viva melhor.' },
    { id: 'ansiedade', title: 'Ansiedade', desc: 'Como identificar gatilhos e técnicas de aterramento para momentos de crise.', icon: AlertCircle, color: '#f59e0b', bg: '#fef3c7', subtitle: 'Trazendo a mente de volta para o presente.' },
    { id: 'estresse', title: 'Gestão de Estresse', desc: 'Estratégias para lidar com a sobrecarga diária e pressões do ambiente.', icon: Zap, color: '#3b82f6', bg: '#eff6ff', subtitle: 'Reduzindo a tensão do dia a dia.' },
    { id: 'burnout', title: 'Prevenção ao Burnout', desc: 'Sinais de esgotamento profissional e passos para buscar equilíbrio.', icon: Flame, color: '#ef4444', bg: '#fee2e2', subtitle: 'Protegendo sua chama interior.' },
    { id: 'relacionamentos', title: 'Relacionamentos', desc: 'Comunicação não-violenta e construção de uma rede de apoio sólida.', icon: Users, color: '#ec4899', bg: '#fce7f3', subtitle: 'A força do coletivo e da empatia.' },
    { id: 'respiracao', title: 'Respiração e Foco', desc: 'Exercícios práticos de respiração para acalmar o sistema nervoso.', icon: Wind, color: '#14b8a6', bg: '#ccfbf1', subtitle: 'O controle do corpo através do ar.' },
    { id: 'videos', title: 'Vídeos Recomendados', desc: 'Palestras e documentários sobre bem-estar emocional e mental.', icon: Video, color: '#8b5cf6', bg: '#ede9fe', subtitle: 'Aprenda com especialistas.' },
    { id: 'podcasts', title: 'Podcasts', desc: 'Programas de áudio para ouvir no trânsito ou durante caminhadas.', icon: Headphones, color: '#f97316', bg: '#ffedd5', subtitle: 'Conteúdo em áudio para o seu bem-estar.' },
    { id: 'pdfs', title: 'Materiais (PDFs)', desc: 'Guias, cartilhas e manuais para download e leitura offline.', icon: FileText, color: '#0ea5e9', bg: '#e0f2fe', subtitle: 'Biblioteca de recursos em PDF.' }
  ]

  const ergoCards = [
    { id: 'monitor', title: 'Monitor', desc: 'Ajuste a altura do monitor para que o topo da tela fique na linha dos olhos.', icon: Monitor, color: '#3b82f6', bg: '#eff6ff', subtitle: 'Protegendo sua visão e pescoço.' },
    { id: 'iluminacao', title: 'Iluminação', desc: 'Evite reflexos na tela e priorize luz natural sempre que possível.', icon: Sun, color: '#f59e0b', bg: '#fef3c7', subtitle: 'Ambiente claro, mente focada.' },
    { id: 'postura', title: 'Postura', desc: 'Mantenha as costas retas e apoiadas no encosto da cadeira. Pés retos no chão.', icon: User, color: '#10b981', bg: '#ecfdf5', subtitle: 'A base para um dia produtivo.' },
    { id: 'mouse', title: 'Mouse', desc: 'Deixe o mouse próximo ao teclado para evitar esticar demais o braço.', icon: MousePointer2, color: '#8b5cf6', bg: '#ede9fe', subtitle: 'Prevenindo lesões por esforço.' },
    { id: 'teclado', title: 'Teclado', desc: 'Mantenha os pulsos retos e relaxados enquanto digita.', icon: Keyboard, color: '#6366f1', bg: '#e0e7ff', subtitle: 'Conforto na ponta dos dedos.' },
    { id: 'agua', title: 'Beber Água', desc: 'Mantenha uma garrafa de água na mesa e hidrate-se constantemente.', icon: Droplet, color: '#0ea5e9', bg: '#e0f2fe', subtitle: 'Hidratação é saúde e foco.' },
    { id: 'alongar', title: 'Alongar', desc: 'Faça pausas a cada hora para esticar os braços, pernas e pescoço.', icon: Activity, color: '#ef4444', bg: '#fee2e2', subtitle: 'Movimento é vida.' },
    { id: 'academia', title: 'Academia', desc: 'Fortaleça a musculatura para evitar dores causadas pela posição sentada.', icon: Dumbbell, color: '#ec4899', bg: '#fce7f3', subtitle: 'Corpo forte, mente forte.' },
    { id: 'meditacao', title: 'Meditação', desc: 'Tire 5 minutos para fechar os olhos, respirar e clarear a mente.', icon: Brain, color: '#14b8a6', bg: '#ccfbf1', subtitle: 'Tranquilidade e foco.' }
  ]

  return (
    <div style={{
      minHeight: '100%',
      padding: isMobile ? '24px 16px' : '40px 48px',
      background: '#f8fafc',
      fontFamily: "'Outfit', sans-serif"
    }}>
      {/* Header */}
      <div style={{ marginBottom: 40, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
        }}>
          <Heart size={32} color="#fff" strokeWidth={2.5} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
            Saúde Mental e Bem-Estar
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: '#64748b', marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
            Cuidar de quem cuida do futuro. Seu bem-estar é nossa prioridade absoluta.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2.5fr 1fr', gap: 32 }}>
        
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, minWidth: 0 }}>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#fff', borderRadius: 24, padding: 32,
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              border: '1px solid #f1f5f9',
              position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 10, background: '#ecfdf5', borderRadius: 12, color: '#10b981' }}>
                <Brain size={24} />
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Manual de Saúde Mental</h2>
            </div>
            
            <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: 24, fontFamily: "'Inter', sans-serif", fontSize: 15 }}>
              Este manual central foi desenvolvido para ajudar você a identificar sinais de esgotamento, gerenciar o estresse diário e encontrar o tão sonhado equilíbrio entre a vida pessoal e a profissional dentro do ambiente escolar.
            </p>

            <button 
              onClick={() => setIsManualOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', background: '#0f172a', color: '#fff',
                border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer',
                transition: 'transform 0.2s, background 0.2s, box-shadow 0.2s',
                fontFamily: "'Inter', sans-serif"
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(15,23,42,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <FileText size={18} /> Ler o Manual Completo
            </button>
          </motion.div>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 -8px 0' }}>Trilhas de Cuidado</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {cards.map((item, i) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * (i + 1) }}
                onClick={() => setActiveCard(item)}
                style={{
                  background: '#fff', borderRadius: 24, padding: 24,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9',
                  display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer',
                  position: 'relative', overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.borderColor = item.bg;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#f1f5f9';
                }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle, ${item.bg} 0%, transparent 70%)`, opacity: 0.8, transform: 'translate(30%, -30%)' }} />
                
                <div style={{ width: 56, height: 56, borderRadius: 16, background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, zIndex: 1 }}>
                  <item.icon size={28} />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 800, color: '#0f172a', zIndex: 1 }}>{item.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5, flexGrow: 1, fontFamily: "'Inter', sans-serif", zIndex: 1 }}>{item.desc}</p>
                
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, color: item.color, fontSize: 13, fontWeight: 700, zIndex: 1 }}>
                  Acessar <ArrowRight size={14} />
                </div>
              </motion.div>
            ))}
          </div>

          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 -8px 0' }}>Ergonomia e Hábitos Saudáveis</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginTop: 32 }}>
              {ergoCards.map((item, i) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * (i + 1) }}
                  onClick={() => setActiveCard(item)}
                  style={{
                    background: '#fff', borderRadius: 24, padding: 24,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9',
                    display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer',
                    position: 'relative', overflow: 'hidden'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.borderColor = item.bg;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.03)';
                    e.currentTarget.style.borderColor = '#f1f5f9';
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle, ${item.bg} 0%, transparent 70%)`, opacity: 0.8, transform: 'translate(30%, -30%)' }} />
                  
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, zIndex: 1 }}>
                    <item.icon size={28} />
                  </div>
                  
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8, zIndex: 1 }}>
                    {item.title}
                  </h3>
                  
                  <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.6, flex: 1, zIndex: 1 }}>
                    {item.desc}
                  </p>

                  <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8, color: item.color, fontSize: 14, fontWeight: 700, zIndex: 1 }}>
                    Acessar <ArrowRight size={16} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>

        {/* Sidebar Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              borderRadius: 24, padding: '24px 32px', color: '#b45309',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.1)', border: '1px solid #fde68a',
              position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Lightbulb size={20} color="#d97706" />
              <strong style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dica do Dia</strong>
            </div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#92400e', lineHeight: 1.4 }}>
              {dicaDia}
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: 24, padding: 32, color: '#fff',
              boxShadow: '0 10px 40px rgba(15,23,42,0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ padding: 12, background: 'rgba(56, 189, 248, 0.15)', borderRadius: 12 }}>
                <Phone size={24} color="#38bdf8" />
              </div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Canal de Escuta</h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.6, marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>
              Precisando conversar? Temos profissionais parceiros prontos para ouvir de forma 100% sigilosa, sem burocracia.
            </p>
            <button 
              onClick={() => {
                sessionStorage.setItem('novoAtendimentoTipo', 'Apoio Psicológico')
                router.push('/gestao-pessoas/atendimentos')
              }}
              style={{
                width: '100%', padding: '14px', background: '#38bdf8', color: '#0f172a',
                border: 'none', borderRadius: 12, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'transform 0.2s', fontSize: 15
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Agendar Atendimento <ArrowRight size={18} />
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              background: '#fff', borderRadius: 24, padding: 32,
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 10, background: '#fee2e2', borderRadius: 12, color: '#ef4444' }}>
                <ShieldCheck size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Ambiente Seguro</h3>
            </div>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>
              Presenciou algo inadequado ou está sofrendo assédio? Não se cale. Denuncie anonimamente e nós tomaremos as medidas necessárias.
            </p>
            <a 
              href="/gestao-pessoas/denuncias/nova" 
              style={{ fontSize: 15, fontWeight: 700, color: '#ef4444', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              Acessar Canal de Denúncias <ArrowRight size={16} />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
              borderRadius: 24, padding: 32, color: '#fff',
              boxShadow: '0 10px 40px rgba(49, 46, 129, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#a5b4fc' }}>
                <MessageCircle size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>Canal de Ideias</h3>
            </div>
            <p style={{ color: '#c7d2fe', fontSize: 14, lineHeight: 1.6, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>
              Como podemos melhorar o ambiente de trabalho e o bem-estar da equipe?
            </p>
            
            {!ideiaEnviada ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea
                  value={ideia}
                  onChange={e => setIdeia(e.target.value)}
                  placeholder="Deixe sua sugestão aqui..."
                  style={{
                    width: '100%', padding: '16px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.05)', color: '#fff', outline: 'none', resize: 'none',
                    minHeight: 100, fontFamily: "'Inter', sans-serif", fontSize: 14
                  }}
                />
                <button
                  onClick={async () => {
                    if(ideia.trim()) {
                      try {
                        const res = await fetch('/api/gestao-pessoas/atendimentos', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            tipo: 'Sugestões',
                            categoria: 'Sugestão',
                            solicitante: currentUser?.nome || 'Anônimo (Canal de Ideias)',
                            descricao: `[SUGESTÃO] ${ideia.trim()}`,
                            status: 'novo',
                            funcionario_id: currentUser?.id
                          })
                        })
                        if (res.ok) {
                          setIdeiaEnviada(true)
                        } else {
                          const errText = await res.text()
                          console.error(`Erro ao salvar ideia: STATUS ${res.status} BODY: ${errText}`)
                        }
                      } catch(e) {
                        console.error('Erro de rede ou crash:', e)
                      }
                    }
                  }}
                  disabled={!ideia.trim()}
                  style={{
                    padding: '12px', background: ideia.trim() ? '#fff' : 'rgba(255,255,255,0.1)', 
                    color: ideia.trim() ? '#312e81' : 'rgba(255,255,255,0.3)',
                    border: 'none', borderRadius: 12, fontWeight: 700, cursor: ideia.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s'
                  }}
                >
                  <Send size={16} /> Enviar Ideia
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                style={{ padding: 20, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}
              >
                <CheckCircle size={28} color="#34d399" />
                <span style={{ color: '#a7f3d0', fontWeight: 600 }}>Ideia enviada! Obrigado por contribuir.</span>
                <button 
                  onClick={() => { setIdeia(''); setIdeiaEnviada(false); }}
                  style={{ marginTop: 8, background: 'transparent', border: 'none', color: '#fff', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Enviar outra
                </button>
              </motion.div>
            )}
          </motion.div>

        </div>
      </div>

      {/* MODAL MANUAL COMPLETO */}
      <SidePanel
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        title="Manual de Saúde Mental"
        subtitle="Diretrizes práticas para uma vida equilibrada."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 40, fontFamily: "'Inter', sans-serif" }}>
          
          <div style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', borderRadius: 20, padding: 24, border: '1px solid #a7f3d0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
              <Star size={20} /> O que é Saúde Mental no Trabalho?
            </h3>
            <p style={{ margin: 0, fontSize: 15, color: '#064e3b', lineHeight: 1.6 }}>
              Saúde mental não é apenas a ausência de doenças. É um estado de bem-estar onde o indivíduo percebe suas habilidades, consegue lidar com os estresses normais da vida, trabalha de forma produtiva e contribui ativamente para a comunidade escolar. No ambiente educacional, onde lidamos diariamente com o desenvolvimento humano, estar com a mente saudável é o primeiro passo para o sucesso coletivo.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
              Principais Sinais de Alerta
            </h3>
            <p style={{ margin: '0 0 8px 0', fontSize: 15, color: '#475569' }}>Preste atenção aos avisos que o seu corpo e a sua mente enviam:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', borderLeft: '4px solid #f59e0b' }}>
                <strong style={{ display: 'block', color: '#0f172a', marginBottom: 8 }}>Físicos</strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>Dores de cabeça constantes, tensão muscular, alterações no sono ou no apetite, queda de imunidade e fadiga crônica.</p>
              </div>
              <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', borderLeft: '4px solid #3b82f6' }}>
                <strong style={{ display: 'block', color: '#0f172a', marginBottom: 8 }}>Emocionais</strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>Irritabilidade aguda, apatia, sensação de vazio, ansiedade desproporcional, choro fácil e angústia persistente.</p>
              </div>
              <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', borderLeft: '4px solid #8b5cf6' }}>
                <strong style={{ display: 'block', color: '#0f172a', marginBottom: 8 }}>Comportamentais</strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>Procrastinação extrema, isolamento social, cinismo com os colegas, faltas frequentes e queda no rendimento.</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
              Mitos e Verdades
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
                <span style={{ display: 'inline-block', background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Mito</span>
                <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>"Transtornos mentais são fraqueza ou falta do que fazer."</p>
                <div style={{ height: 1, background: '#f1f5f9', margin: '16px 0' }} />
                <span style={{ display: 'inline-block', background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Verdade</span>
                <p style={{ margin: 0, color: '#0f172a', fontSize: 14, fontWeight: 500 }}>São condições de saúde reais causadas por fatores biológicos, genéticos, psicológicos e pressões do ambiente. Exigem tratamento.</p>
              </div>
              
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
                <span style={{ display: 'inline-block', background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Mito</span>
                <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>"Apenas profissionais descomprometidos sofrem de Burnout."</p>
                <div style={{ height: 1, background: '#f1f5f9', margin: '16px 0' }} />
                <span style={{ display: 'inline-block', background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Verdade</span>
                <p style={{ margin: 0, color: '#0f172a', fontSize: 14, fontWeight: 500 }}>O Burnout afeta frequentemente os profissionais mais dedicados e perfeccionistas, justamente porque ultrapassam seus limites continuamente.</p>
              </div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 20, padding: 24, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
              <Activity size={20} color="#64748b" /> A Regra dos 3 Oitos (8-8-8)
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 15, color: '#475569', lineHeight: 1.6 }}>
              O dia possui 24 horas. Para manter a sanidade e o equilíbrio a longo prazo, o ideal é que você divida seu dia em três grandes blocos equitativos:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 15, lineHeight: 1.8 }}>
              <li><strong>8 horas para o Trabalho:</strong> Foco absoluto nas entregas, aulas e resolução de problemas institucionais.</li>
              <li><strong>8 horas para o Lazer/Vida:</strong> Família, hobbies, esportes, estudos pessoais e relaxamento. Não leve pendências para este bloco!</li>
              <li><strong>8 horas para o Sono:</strong> Descanso restaurador para o corpo e para a mente (sem telas na última hora).</li>
            </ul>
          </div>

          <div style={{ background: '#fef3c7', borderRadius: 20, padding: 24, border: '1px solid #fde68a' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
              <Coffee size={20} color="#92400e" /> Dicas de Ergonomia Mental
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 15, color: '#92400e', lineHeight: 1.6 }}>Pequenas atitudes preventivas para adotar imediatamente:</p>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#92400e', fontSize: 15, lineHeight: 1.8 }}>
              <li><strong>Desconexão Pós-Expediente:</strong> Desative notificações de grupos de trabalho após seu horário. Responder amanhã raramente é o fim do mundo.</li>
              <li><strong>Alimentação Intencional:</strong> Pular refeições para "render mais" aumenta o cortisol e o estresse. Proteja sua pausa para o almoço.</li>
              <li><strong>Micro-pausas:</strong> A cada 90 minutos de foco intenso, levante-se, tome água e olhe para o horizonte (descanso ocular) por 5 minutos.</li>
            </ul>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #fee2e2' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 800, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
              <Heart size={20} color="#ef4444" /> Nossa Rede de Apoio Institucional
            </h3>
            <p style={{ margin: 0, fontSize: 15, color: '#475569', lineHeight: 1.6 }}>
              Acreditamos que pedir ajuda é um sinal de força e autoconhecimento. Se você identificar que as pressões estão além da sua capacidade de gerenciamento momentâneo, nossa instituição disponibiliza o <strong>Canal de Escuta</strong>. 
              <br/><br/>
              É um atendimento psicológico acolhedor, <strong>100% sigiloso</strong> e sem repasse de informações para lideranças. Você não está sozinho nesta jornada. Use os nossos canais sempre que precisar.
            </p>
          </div>
        </div>
      </SidePanel>

      {/* MODAL ESPECÍFICO DOS CARDS */}
      <SidePanel
        isOpen={!!activeCard}
        onClose={() => setActiveCard(null)}
        title={activeCard?.title || ''}
        subtitle={activeCard?.subtitle || 'Aprofunde-se neste tema e descubra práticas para o dia a dia.'}
      >
        {activeCard && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 40, fontFamily: "'Inter', sans-serif" }}>
            
            {/* Cabeçalho do Card */}
            <div style={{ background: activeCard.bg, borderRadius: 24, padding: 32, display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: '#fff', color: activeCard.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                <activeCard.icon size={32} strokeWidth={2.5} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Guia Prático</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 15, color: '#475569' }}>Práticas e conhecimentos aplicáveis.</p>
              </div>
            </div>

            {/* Conteúdos Específicos por ID */}

            {/* SONO */}
            {activeCard.id === 'sono' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>A Importância do Sono</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Durante o sono, o cérebro realiza uma verdadeira "limpeza", consolidando memórias e removendo toxinas acumuladas ao longo do dia. Dormir mal afeta o humor, a concentração e a imunidade.</p>
                </div>
                
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
                    <Moon size={20} color={activeCard.color} /> 4 Passos para a Higiene do Sono
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 15, lineHeight: 1.8 }}>
                    <li><strong>Desconexão Digital:</strong> Evite telas (celular, TV) pelo menos 1 hora antes de dormir. A luz azul inibe a produção de melatonina.</li>
                    <li><strong>Ambiente Adequado:</strong> Mantenha o quarto escuro, silencioso e com temperatura agradável.</li>
                    <li><strong>Rotina Consistente:</strong> Tente dormir e acordar sempre nos mesmos horários, inclusive aos finais de semana.</li>
                    <li><strong>Cuidado com Estimulantes:</strong> Evite cafeína (café, chás escuros, energéticos) após as 15h.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ANSIEDADE */}
            {activeCard.id === 'ansiedade' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Entendendo a Ansiedade</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>A ansiedade é uma resposta natural a situações de ameaça. O problema ocorre quando ela se torna constante e desproporcional. Aprender a aterrar a mente é o primeiro passo para o controle.</p>
                </div>
                
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
                    <AlertCircle size={20} color={activeCard.color} /> Técnica de Aterramento (5-4-3-2-1)
                  </h4>
                  <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>Quando sentir uma crise de ansiedade chegando, olhe ao seu redor e identifique em voz alta:</p>
                  <ol style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 15, lineHeight: 1.8 }}>
                    <li><strong>5 coisas</strong> que você pode VER.</li>
                    <li><strong>4 coisas</strong> que você pode TOCAR.</li>
                    <li><strong>3 coisas</strong> que você pode OUVIR.</li>
                    <li><strong>2 coisas</strong> que você pode CHEIRAR.</li>
                    <li><strong>1 coisa</strong> que você pode SABOREAR.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* ESTRESSE */}
            {activeCard.id === 'estresse' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Gerenciando a Sobrecarga</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Estresse prolongado eleva os níveis de cortisol, podendo causar problemas cardíacos, digestivos e dores musculares. A chave não é eliminar o estresse, mas saber gerenciá-lo.</p>
                </div>
                
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
                    <Zap size={20} color={activeCard.color} /> Práticas Diárias
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 15, lineHeight: 1.8 }}>
                    <li><strong>Circulo de Controle:</strong> Diferencie o que está sob seu controle (suas ações, reações) do que não está (ações dos outros, trânsito). Foque apenas no que pode mudar.</li>
                    <li><strong>Exercício Físico:</strong> O movimento consome os hormônios do estresse e libera endorfina. 30 minutos diários já fazem diferença.</li>
                    <li><strong>Pausas Ativas:</strong> Pare por 5 minutos a cada 2 horas para alongar e desfocar a visão.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* BURNOUT */}
            {activeCard.id === 'burnout' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Síndrome de Esgotamento</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Burnout é o esgotamento profissional extremo crônico. Manifesta-se através de três pilares: exaustão emocional absoluta, distanciamento afetivo (cinismo com os colegas) e sensação de baixa realização pessoal.</p>
                </div>
                
                <div style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: 20, padding: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#b91c1c', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
                    <Flame size={20} color="#b91c1c" /> Como agir preventivamente?
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 15, lineHeight: 1.8 }}>
                    <li><strong>Limites Claros:</strong> Determine um horário para encerrar o expediente e, principalmente, para se desconectar de e-mails e mensagens de trabalho.</li>
                    <li><strong>Comunicação Transparente:</strong> Aprenda a dizer "não" a prazos e sobrecargas irrealistas, dialogando com sua liderança.</li>
                    <li><strong>Apoio Profissional:</strong> Ao sentir que não consegue mais sozinho, use nosso Canal de Escuta para apoio psicológico o mais rápido possível.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* RELACIONAMENTOS */}
            {activeCard.id === 'relacionamentos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>O Papel do Coletivo</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>A qualidade das nossas interações afeta diretamente nosso bem-estar. Equipes onde existe segurança psicológica e comunicação empática possuem índices muito menores de adoecimento.</p>
                </div>
                
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
                    <Users size={20} color={activeCard.color} /> Princípios Básicos
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 15, lineHeight: 1.8 }}>
                    <li><strong>Escuta Ativa:</strong> Escute para compreender, não apenas para responder.</li>
                    <li><strong>Comunicação Não-Violenta:</strong> Foque no fato e não na pessoa ao dar feedback. (Ex: "A tarefa atrasou" em vez de "Você é atrasado").</li>
                    <li><strong>Fofoca Tóxica:</strong> Evite participar de conversas destrutivas sobre colegas de trabalho. Foque em soluções.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* RESPIRAÇÃO */}
            {activeCard.id === 'respiracao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>O Controle através do Ar</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>A respiração é a ponte mais rápida entre a mente e o corpo. Respirar de forma controlada "avisa" o sistema nervoso parassimpático que você está seguro, diminuindo a ansiedade quase instantaneamente.</p>
                </div>
                
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
                    <Wind size={20} color={activeCard.color} /> Técnica 4-7-8
                  </h4>
                  <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>Sente-se com a coluna reta e os pés no chão. Faça o ciclo 4 vezes:</p>
                  <ol style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 15, lineHeight: 1.8 }}>
                    <li>Inspire o ar lentamente pelo nariz contando até <strong>4</strong>.</li>
                    <li>Prenda a respiração confortavelmente contando até <strong>7</strong>.</li>
                    <li>Expire todo o ar lentamente pela boca contando até <strong>8</strong>.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* VÍDEOS */}
            {activeCard.id === 'videos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Seleção de Vídeos e TED Talks</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Separamos algumas palestras essenciais sobre inteligência emocional, vulnerabilidade e produtividade saudável.</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  {[
                    { title: 'O poder da vulnerabilidade', author: 'Brené Brown', time: '20 min' },
                    { title: 'Como transformar o estresse em um amigo', author: 'Kelly McGonigal', time: '14 min' },
                    { title: 'Por que dormimos?', author: 'Matthew Walker', time: '19 min' }
                  ].map((v, idx) => (
                    <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <strong style={{ display: 'block', color: '#0f172a', fontSize: 15 }}>{v.title}</strong>
                        <span style={{ color: '#64748b', fontSize: 13 }}>TED Talk • {v.author}</span>
                      </div>
                      <div style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#475569' }}>{v.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PODCASTS */}
            {activeCard.id === 'podcasts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Recomendações em Áudio</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Ótimos para ouvir no trajeto casa-trabalho ou enquanto realiza atividades domésticas.</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  {[
                    { title: 'Autoconsciente', author: 'Regina Giannetti', desc: 'Entenda sua mente e emoções de forma prática.' },
                    { title: 'Naruhodo', author: 'Ken Fujioka e Altay de Souza', desc: 'Ciência aplicada ao comportamento humano.' },
                    { title: 'Estamos Bem?', author: 'Thiago Theodoro e Bárbara dos Anjos', desc: 'Reflexões leves sobre a vida e sentimentos.' }
                  ].map((v, idx) => (
                    <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: 15, marginBottom: 4 }}>{v.title}</strong>
                      <span style={{ color: '#4f46e5', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>{v.author}</span>
                      <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>{v.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PDFS */}
            {activeCard.id === 'pdfs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Biblioteca de Manuais</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Materiais oficiais para baixar, imprimir ou ler offline.</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  {[
                    { title: 'Cartilha de Saúde Mental no Trabalho', size: '2.4 MB' },
                    { title: 'Guia Rápido: Ergonomia e Postura', size: '1.1 MB' },
                    { title: 'O que a Liderança precisa saber sobre Burnout', size: '3.5 MB' }
                  ].map((v, idx) => (
                    <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <FileText size={20} color="#0ea5e9" />
                        <div>
                          <strong style={{ display: 'block', color: '#0f172a', fontSize: 15 }}>{v.title}</strong>
                          <span style={{ color: '#64748b', fontSize: 13 }}>PDF • {v.size}</span>
                        </div>
                      </div>
                      <button style={{ padding: '8px 16px', background: '#f1f5f9', color: '#0ea5e9', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Download</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MONITOR */}
            {activeCard.id === 'monitor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Ajuste do Monitor</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Para evitar dores no pescoço e tensão ocular, o topo da tela do seu monitor deve estar exatamente na linha dos seus olhos. Mantenha uma distância de um braço esticado entre você e a tela.</p>
                </div>
              </div>
            )}

            {/* ILUMINAÇÃO */}
            {activeCard.id === 'iluminacao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Luz e Foco</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Trabalhe preferencialmente com luz natural. Evite que a janela fique diretamente atrás do monitor (ofuscamento) ou atrás de você (reflexo na tela). A iluminação correta reduz dores de cabeça no fim do dia.</p>
                </div>
              </div>
            )}

            {/* POSTURA */}
            {activeCard.id === 'postura' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>O Ponto de Apoio</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Sente-se com as costas totalmente apoiadas no encosto da cadeira. Seus joelhos devem formar um ângulo de 90 graus e a planta dos pés deve estar totalmente encostada no chão ou em um suporte.</p>
                </div>
              </div>
            )}

            {/* MOUSE */}
            {activeCard.id === 'mouse' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Ergonomia do Mouse</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Mantenha o mouse próximo ao teclado. Seu antebraço deve estar apoiado na mesa ou no braço da cadeira, evitando que você "estique" o braço constantemente para alcançar o mouse.</p>
                </div>
              </div>
            )}

            {/* TECLADO */}
            {activeCard.id === 'teclado' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Digitando com Saúde</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Durante a digitação, seus pulsos devem estar retos (neutros), não flexionados para cima ou para baixo. Teclados ergonômicos ou suportes macios de punho podem prevenir tendinites.</p>
                </div>
              </div>
            )}

            {/* ÁGUA */}
            {activeCard.id === 'agua' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>A Regra da Garrafinha</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>A desidratação leve causa fadiga e queda de atenção. Deixe sempre uma garrafa de água visível em cima da sua mesa de trabalho. Beba água antes de sentir sede!</p>
                </div>
              </div>
            )}

            {/* ALONGAR */}
            {activeCard.id === 'alongar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Pausas Ativas</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>A cada hora de trabalho, levante-se por 5 minutos. Estique os braços para o teto, gire os ombros para trás, alongue o pescoço suavemente e caminhe um pouco pelo ambiente.</p>
                </div>
              </div>
            )}

            {/* ACADEMIA */}
            {activeCard.id === 'academia' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Músculos Protetores</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>O corpo humano não foi feito para ficar 8 horas sentado. Fortalecer os músculos das costas e do core (abdômen) é a melhor armadura contra hérnias de disco e dores crônicas.</p>
                </div>
              </div>
            )}

            {/* MEDITAÇÃO */}
            {activeCard.id === 'meditacao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Pausa para a Mente</h4>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 15 }}>Se sentir que o estresse está subindo, afaste-se das telas. Feche os olhos, inspire profundamente contando até 4, segure por 2, e solte contando até 6. Repita isso 5 vezes.</p>
                </div>
              </div>
            )}

          </div>
        )}
      </SidePanel>
    </div>
  )
}
