'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, HelpCircle, Heart, PhoneCall, ShieldAlert, Stethoscope, GraduationCap, PieChart, Lock, Coffee, BookOpen } from 'lucide-react'

const FAQ_DATA = [
  {
    category: 'Saúde Mental',
    icon: Heart,
    color: '#ec4899',
    bg: '#fdf2f8',
    questions: [
      { q: 'Quando devo procurar ajuda?', a: 'Sempre que você perceber que o estresse, ansiedade, tristeza ou cansaço estiverem afetando sua qualidade de vida ou seu trabalho.' },
      { q: 'O que é considerado esgotamento emocional (burnout)?', a: 'É um estado de exaustão física e mental causado pelo estresse crônico relacionado ao trabalho.' },
      { q: 'Como saber se preciso conversar com alguém?', a: 'Se você sentir que está sobrecarregado, sem motivação, com dificuldade para dormir, concentrar-se ou controlar emoções, vale a pena buscar apoio.' },
      { q: 'Estresse no trabalho é normal?', a: 'Momentos de estresse podem acontecer, mas quando se tornam frequentes e prejudicam sua saúde, é importante procurar ajuda.' },
      { q: 'Posso procurar ajuda mesmo que o problema seja pessoal?', a: 'Sim. O canal de escuta está disponível para acolher situações pessoais que possam impactar seu bem-estar.' },
      { q: 'Procurar ajuda pode prejudicar minha carreira?', a: 'Não. Buscar apoio demonstra responsabilidade com sua saúde e bem-estar.' },
    ]
  },
  {
    category: 'Canal de Escuta',
    icon: PhoneCall,
    color: '#3b82f6',
    bg: '#eff6ff',
    questions: [
      { q: 'Como funciona o Canal de Escuta?', a: 'Você agenda um atendimento sigiloso para conversar com um profissional parceiro ou com a equipe responsável.' },
      { q: 'As conversas são confidenciais?', a: 'Sim. Todas as informações são tratadas com confidencialidade, respeitando a legislação e a privacidade do colaborador.' },
      { q: 'Meu gestor será informado?', a: 'Não automaticamente. Informações só são compartilhadas quando houver necessidade legal ou autorização do colaborador, conforme as políticas internas.' },
      { q: 'Posso solicitar atendimento fora do horário de trabalho?', a: 'Depende da disponibilidade do serviço, mas sempre que possível serão oferecidas alternativas.' },
      { q: 'Posso remarcar um atendimento?', a: 'Sim.' },
    ]
  },
  {
    category: 'Canal de Denúncias',
    icon: ShieldAlert,
    color: '#ef4444',
    bg: '#fee2e2',
    questions: [
      { q: 'Posso denunciar anonimamente?', a: 'Sim, quando essa opção estiver disponível.' },
      { q: 'Quem pode utilizar o canal?', a: 'Todos os colaboradores da instituição.' },
      { q: 'Quem analisa as denúncias?', a: 'Somente pessoas autorizadas e responsáveis pela apuração.' },
      { q: 'Meu nome será divulgado?', a: 'Não, exceto quando houver obrigação legal ou autorização expressa.' },
      { q: 'Posso acompanhar minha denúncia?', a: 'Sim, por meio do número de protocolo, quando disponível.' },
      { q: 'O que acontece depois que faço uma denúncia?', a: 'Ela será analisada, investigada e as providências cabíveis serão adotadas.' },
      { q: 'Posso denunciar assédio moral ou sexual?', a: 'Sim, ambas as práticas devem ser denunciadas rigorosamente.' },
      { q: 'Posso denunciar discriminação?', a: 'Sim.' },
      { q: 'Posso denunciar situações de risco à saúde ou segurança?', a: 'Sim.' },
      { q: 'E se eu denunciar de má-fé?', a: 'Denúncias devem ser feitas com responsabilidade. Informações falsas intencionalmente podem gerar consequências disciplinares.' },
    ]
  },
  {
    category: 'Saúde no Trabalho',
    icon: Stethoscope,
    color: '#10b981',
    bg: '#ecfdf5',
    questions: [
      { q: 'O que são riscos psicossociais?', a: 'São fatores relacionados ao ambiente ou à organização do trabalho que podem afetar a saúde mental dos colaboradores.' },
      { q: 'O que caracteriza sobrecarga de trabalho?', a: 'Excesso contínuo de demandas, prazos incompatíveis, jornadas prolongadas ou falta de recursos para realizar as atividades.' },
      { q: 'Como posso solicitar apoio caso esteja sobrecarregado?', a: 'Utilize o Canal de Escuta ou converse com o RH.' },
      { q: 'Posso pedir uma conversa com o RH?', a: 'Sim. O colaborador pode solicitar atendimento sempre que sentir necessidade.' },
    ]
  },
  {
    category: 'Treinamentos',
    icon: GraduationCap,
    color: '#8b5cf6',
    bg: '#f3e8ff',
    questions: [
      { q: 'Os treinamentos são obrigatórios?', a: 'Alguns treinamentos relacionados à segurança e saúde ocupacional podem ser obrigatórios.' },
      { q: 'Como faço para acessar os treinamentos?', a: 'Na área "Treinamentos" da plataforma.' },
      { q: 'Receberei certificado?', a: 'Quando aplicável, sim.' },
    ]
  },
  {
    category: 'Pesquisa de Clima',
    icon: PieChart,
    color: '#f59e0b',
    bg: '#fef3c7',
    questions: [
      { q: 'Minhas respostas são anônimas?', a: 'Sempre que a pesquisa for configurada como anônima, nenhuma resposta será vinculada ao colaborador.' },
      { q: 'Para que serve a pesquisa?', a: 'Ela ajuda a identificar oportunidades de melhoria no ambiente de trabalho.' },
    ]
  },
  {
    category: 'Privacidade',
    icon: Lock,
    color: '#64748b',
    bg: '#f1f5f9',
    questions: [
      { q: 'Quem pode visualizar minhas informações?', a: 'Somente profissionais autorizados conforme suas atribuições e respeitando a LGPD.' },
      { q: 'Meus dados estão protegidos?', a: 'Sim. A instituição adota medidas para proteger seus dados pessoais.' },
      { q: 'O histórico das minhas solicitações fica registrado?', a: 'Sim, para garantir acompanhamento adequado e segurança das informações.' },
    ]
  },
  {
    category: 'Bem-estar',
    icon: Coffee,
    color: '#14b8a6',
    bg: '#ccfbf1',
    questions: [
      { q: 'O que posso fazer para reduzir o estresse durante o expediente?', a: 'Realizar pequenas pausas, manter boa hidratação, organizar prioridades e utilizar os recursos de bem-estar disponíveis na plataforma.' },
      { q: 'Como funcionam as pausas ativas?', a: 'São exercícios rápidos que ajudam a reduzir tensão muscular e melhorar a disposição.' },
      { q: 'A escola incentiva ações de saúde mental?', a: 'Sim. A instituição promove iniciativas voltadas à prevenção, acolhimento e desenvolvimento de um ambiente de trabalho saudável.' },
      { q: 'Posso sugerir melhorias para o ambiente de trabalho?', a: 'Sim. Utilize o Canal de Ideias ou converse com o RH.' },
      { q: 'Existe apoio em situações de crise emocional?', a: 'Sim. Em situações urgentes, procure imediatamente o Canal de Escuta ou os serviços de emergência indicados na plataforma.' },
    ]
  },
  {
    category: 'Ambiente Escolar',
    icon: BookOpen,
    color: '#0284c7',
    bg: '#e0f2fe',
    questions: [
      { q: 'Como devo agir se estiver emocionalmente abalado para dar aula?', a: 'A prioridade é a sua saúde e a segurança dos alunos. Comunique imediatamente a coordenação ou a direção escolar para que um substituto ou atividade alternativa seja arranjada. Em seguida, busque apoio pelo Canal de Escuta.' },
      { q: 'O que fazer quando um conflito com pais ou responsáveis afetar meu bem-estar?', a: 'Nunca lide com conflitos sozinho. Acione a direção para intermediar a situação, registre o ocorrido nos canais formais da escola e, se o desgaste emocional for grande, busque acolhimento pelo nosso canal de apoio psicológico.' },
      { q: 'Como solicitar apoio após uma situação difícil em sala de aula?', a: 'Informe a coordenação pedagógica sobre o incidente para o devido registro e suporte imediato. Você também pode acessar o módulo "Bem-Estar" e solicitar "Apoio Psicológico" de forma sigilosa.' },
      { q: 'Posso pedir orientação antes que o problema se torne grave?', a: 'Com certeza! A prevenção é o melhor caminho. Se você identificar os primeiros sinais de estresse, cansaço excessivo ou dificuldade com alguma turma, procure a gestão escolar ou os nossos canais de escuta para receber orientação.' },
      { q: 'Como proceder se eu me sentir desrespeitado por um colega ou gestor?', a: 'O respeito é inegociável. Você pode tentar um diálogo franco caso se sinta seguro, ou registrar uma denúncia sigilosa no "Canal de Denúncias", que será apurada de forma imparcial.' },
      { q: 'O que fazer se eu perceber que outro colaborador está emocionalmente sobrecarregado?', a: 'Demonstre empatia e pergunte de forma acolhedora se a pessoa precisa de algo. Sugira delicadamente que ela acesse as ferramentas de Bem-Estar e o Canal de Escuta disponíveis no sistema.' },
      { q: 'Existe algum acompanhamento após um incidente envolvendo alunos ou famílias?', a: 'Sim. A instituição se compromete a fornecer suporte psicológico e jurídico (quando aplicável) aos educadores após incidentes críticos, visando a pronta recuperação e segurança do profissional.' },
      { q: 'Como a instituição promove um ambiente de trabalho respeitoso e seguro?', a: 'Através de políticas de tolerância zero contra assédio, promoção constante de campanhas de saúde mental, pesquisas de clima regulares e canais abertos para diálogo e denúncia.' },
      { q: 'Onde encontro as políticas internas sobre saúde mental, assédio e convivência?', a: 'Todos os manuais e políticas institucionais podem ser encontrados na seção "Materiais (PDFs)" dentro da aba "Manuais" na página de Bem-Estar.' },
      { q: 'Quem posso procurar caso tenha dúvidas sobre meus direitos relacionados à saúde e segurança no trabalho?', a: 'O departamento de Gestão de Pessoas (RH) está sempre à disposição para tirar essas dúvidas. Você também pode abrir um chamado do tipo "Dúvida" no módulo de Atendimentos.' },
    ]
  }
]

export default function FAQPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [openQ, setOpenQ] = useState<string | null>(null)

  const filteredData = FAQ_DATA.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      q.q.toLowerCase().includes(searchTerm.toLowerCase()) || 
      q.a.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.questions.length > 0)

  return (
    <div style={{
      minHeight: '100%',
      background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* HEADER */}
      <div style={{ 
        padding: '48px 40px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Abstract shapes */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: 100, width: 200, height: 200, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', filter: 'blur(40px)' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255, 255, 255, 0.1)', padding: '8px 20px', borderRadius: 30, marginBottom: 24, border: '1px solid rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)' }}>
            <HelpCircle size={18} color="#38bdf8" />
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Centro de Ajuda</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', fontFamily: "'Outfit', sans-serif", marginBottom: 16 }}>
            Perguntas Frequentes
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: '#cbd5e1', lineHeight: 1.6, maxWidth: 600, marginInline: 'auto' }}>
            Tire suas dúvidas sobre saúde mental, canais de escuta, denúncias, pesquisas de clima e políticas do ambiente escolar.
          </p>

          <div style={{ marginTop: 32, position: 'relative', maxWidth: 500, marginInline: 'auto' }}>
            <input 
              type="text"
              placeholder="O que você está procurando?"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '16px 20px 16px 52px',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: 16,
                outline: 'none',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s'
              }}
              onFocus={e => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
              onBlur={e => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            />
            <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: 40 }}>
        
        {filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Search size={24} color="#64748b" />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Nenhum resultado encontrado</h3>
            <p style={{ margin: '8px 0 0 0', color: '#64748b' }}>Tente buscar com palavras diferentes.</p>
          </div>
        ) : (
          filteredData.map((category, idx) => (
            <div key={idx}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: category.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <category.icon size={20} color={category.color} strokeWidth={2.5} />
                </div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
                  {category.category}
                </h2>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {category.questions.map((q, qIdx) => {
                  const uniqueId = `${category.category}-${qIdx}`
                  const isOpen = openQ === uniqueId

                  return (
                    <motion.div 
                      key={qIdx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ 
                        background: '#fff', 
                        borderRadius: 16, 
                        border: '1px solid',
                        borderColor: isOpen ? category.color : '#e2e8f0',
                        overflow: 'hidden',
                        boxShadow: isOpen ? `0 4px 20px ${category.color}15` : '0 2px 8px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <button 
                        onClick={() => setOpenQ(isOpen ? null : uniqueId)}
                        style={{ 
                          width: '100%', 
                          padding: '20px 24px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 700, color: isOpen ? category.color : '#1e293b', paddingRight: 16 }}>
                          {q.q}
                        </span>
                        <div style={{ 
                          width: 32, height: 32, borderRadius: '50%', background: isOpen ? `${category.color}15` : '#f1f5f9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s'
                        }}>
                          <ChevronDown size={18} color={isOpen ? category.color : '#64748b'} />
                        </div>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div style={{ padding: '0 24px 24px 24px' }}>
                              <div style={{ height: 1, background: '#f1f5f9', marginBottom: 16 }} />
                              <p style={{ margin: 0, fontSize: 15, color: '#475569', lineHeight: 1.7 }}>
                                {q.a}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))
        )}

      </div>
    </div>
  )
}
