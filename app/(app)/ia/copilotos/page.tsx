'use client'

import { useState } from 'react'
import { Brain, Send, ChevronDown, MessageSquare, Zap, BarChart3, DollarSign, Users, GraduationCap, Copy, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react'

const COPILOTOS = [
  { id: 'direcao', icon: '🎯', label: 'Copiloto da Direção', desc: 'Visão estratégica, KPIs executivos, decisões gerenciais', color: '#3b82f6', sistema: 'Você é o Copiloto da Direção do IMPACTO EDU. Ajude o diretor com insights estratégicos, análise de KPIs e tomada de decisão. Seja conciso, profissional e baseado em dados.' },
  { id: 'pedagogico', icon: '📚', label: 'Copiloto Pedagógico', desc: 'Desempenho de alunos, evasão, planos de aula', color: '#8b5cf6', sistema: 'Você é o Copiloto Pedagógico. Especialista em desempenho acadêmico, prevenção de evasão, currículos e BNCC.' },
  { id: 'rh', icon: '👥', label: 'Copiloto de RH', desc: 'Equipe, folha de pagamento, ponto, férias', color: '#f59e0b', sistema: 'Você é o Copiloto de RH. Especialista em gestão de pessoas, folha de pagamento, ponto eletrônico e CLT educacional.' },
  { id: 'crm', icon: '📣', label: 'Copiloto de CRM', desc: 'Leads, captação, retenção e campanhas', color: '#ec4899', sistema: 'Você é o Copiloto de CRM. Especialista em captação de alunos, funil de leads, estratégias de retenção e marketing educacional.' },
]

const QUICK_PROMPTS: Record<string, string[]> = {
  direcao: ['Qual é o resumo executivo de hoje?', 'Quais os 3 maiores riscos da escola?', 'Crie um plano de ação para reduzir evasão', 'Compare nossa performance com benchmarks do setor'],
  pedagogico: ['Quais turmas têm pior desempenho?', 'Crie um plano de recuperação para o 8B', 'Liste alunos com frequência abaixo de 75%', 'Gere um plano de aula de matemática para o 9A'],
  rh: ['Quantos funcionários estão de férias em abril?', 'Quais os maiores custos de folha?', 'Gere relatório de ponto de março', 'Quem tem aniversário esta semana?'],
  crm: ['Quantos leads em aberto?', 'Qual a taxa de conversão do último mês?', 'Monte uma estratégia de rematrícula 2026/2', 'Quais alunos têm maior risco de não renovar?'],
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: string
}

const DEMO_RESPONSES: Record<string, string> = {
  'Qual é o resumo executivo de hoje?': `**📊 Resumo Executivo — 27 de Março de 2026**

**Situação Geral:** ✅ Saudável, com alertas pontuais

**💰 Financeiro:**
- Receita do mês: **R$ 497.000** (+2,5% vs. fevereiro)
- Inadimplência: **8,3%** — abaixo da meta de 10% ✅
- 3 títulos vencidos acima de 60 dias necessitam atenção

**👥 Acadêmico:**
- Taxa de ocupação: **94,7%** (recorde!)
- 47 alunos em risco de evasão (alto + médio)
- Frequência média geral: **89,4%**

**⚠️ Ações Urgentes:**
1. Heitor Araújo (EM) — frequência 58%, risco crítico
2. Censo Escolar: 18 dias para o prazo, 12 inconsistências
3. Sofia Lima — 3 mensalidades em atraso

**📈 Projeção do Mês:** Receita estimada R$ 510k (+2,6% se régua ativa)`
}

export default function CopilotosPage() {
  const [activeBot, setActiveBot] = useState(COPILOTOS[0])
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const currentMessages = messages[activeBot.id] || []

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => ({
      ...prev,
      [activeBot.id]: [...(prev[activeBot.id] || []), { role, content, ts }]
    }))
  }

  const send = async (text: string = input) => {
    if (!text.trim() || loading) return
    setInput('')
    addMessage('user', text)
    setLoading(true)

    // Simulate AI response
    await new Promise(r => setTimeout(r, 1200))
    const response = DEMO_RESPONSES[text] ||
      `**${activeBot.label} respondendo...**\n\nAnalisei os dados do sistema e posso informar que:\n\n📊 Com base nos dados atuais do IMPACTO EDU, ${text.toLowerCase().includes('aluno') ? 'temos 1.842 alunos matriculados, com 47 em risco de evasão identificados pelo algoritmo de predição.' : text.toLowerCase().includes('financeiro') || text.toLowerCase().includes('receita') ? 'a receita do mês está em R$ 497.000, com margem líquida de 47,3%.' : 'aqui está minha análise baseada nos dados mais recentes da plataforma.'}\n\n💡 **Recomendação:** Para informações mais específicas, acesse o módulo correspondente no menu lateral ou refine sua pergunta.`

    addMessage('assistant', response)
    setLoading(false)
  }

  const quickPrompts = QUICK_PROMPTS[activeBot.id] || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Copilotos com IA</h1>
          <p className="page-subtitle">5 assistentes especializados na gestão escolar</p>
        </div>
        <span className="ia-chip"><Brain size={13} />Powered by Gemini</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: '75vh' }}>
        {/* Bot Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {COPILOTOS.map(bot => (
            <button key={bot.id} onClick={() => setActiveBot(bot)}
              style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${activeBot.id === bot.id ? bot.color + '50' : 'hsl(var(--border-subtle))'}`, background: activeBot.id === bot.id ? bot.color + '12' : 'hsl(var(--bg-surface))', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{bot.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: activeBot.id === bot.id ? bot.color : 'hsl(var(--text-primary))' }}>{bot.label}</div>
                </div>
                {activeBot.id === bot.id && <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: bot.color, boxShadow: `0 0 6px ${bot.color}` }} />}
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', lineHeight: 1.4 }}>{bot.desc}</div>
              {messages[bot.id]?.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'hsl(var(--text-disabled))' }}>
                  {messages[bot.id].length} mensagem(ns)
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Chat Interface */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 14, background: `linear-gradient(to right, ${activeBot.color}08, transparent)` }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: activeBot.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {activeBot.icon}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{activeBot.label}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.5)', display: 'inline-block' }} />
                Online • Modelo Gemini
              </div>
            </div>
            <button onClick={() => setMessages(prev => ({ ...prev, [activeBot.id]: [] }))} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
              <RefreshCw size={13} />Limpar
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentMessages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{activeBot.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Olá! Sou o {activeBot.label}</div>
                <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>{activeBot.desc}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {quickPrompts.map(prompt => (
                    <button key={prompt} onClick={() => send(prompt)}
                      style={{ padding: '10px 16px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 10, fontSize: 13, color: 'hsl(var(--text-secondary))', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--bg-hover))'; e.currentTarget.style.borderColor = activeBot.color + '60' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--bg-elevated))'; e.currentTarget.style.borderColor = 'hsl(var(--border-default))' }}>
                      💬 {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {currentMessages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 10, alignItems: 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: activeBot.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {activeBot.icon}
                  </div>
                )}
                <div style={{ maxWidth: '75%' }}>
                  <div style={{ padding: '12px 16px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? 'var(--gradient-primary)' : 'hsl(var(--bg-elevated))', border: msg.role === 'assistant' ? '1px solid hsl(var(--border-subtle))' : 'none', fontSize: 13, color: msg.role === 'user' ? '#fff' : 'hsl(var(--text-primary))', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-disabled))', marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left', display: 'flex', gap: 8 }}>
                    {msg.ts}
                    {msg.role === 'assistant' && (
                      <>
                        <button className="btn btn-ghost btn-icon" style={{ width: 18, height: 18, padding: 0 }}><ThumbsUp size={10} /></button>
                        <button className="btn btn-ghost btn-icon" style={{ width: 18, height: 18, padding: 0 }}><ThumbsDown size={10} /></button>
                        <button className="btn btn-ghost btn-icon" style={{ width: 18, height: 18, padding: 0 }}><Copy size={10} /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: activeBot.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                  {activeBot.icon}
                </div>
                <div style={{ padding: '12px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: '18px 18px 18px 4px', border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: activeBot.color, animation: `pulse 1.4s ease-in-out ${d}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={`Pergunte ao ${activeBot.label}...`}
                style={{ flex: 1, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'hsl(var(--text-primary))', resize: 'none', height: 44, minHeight: 44, outline: 'none', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}
                onFocus={e => e.target.style.borderColor = activeBot.color}
                onBlur={e => e.target.style.borderColor = 'hsl(var(--border-default))'}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                style={{ width: 44, height: 44, borderRadius: 12, background: input.trim() ? `linear-gradient(135deg, ${activeBot.color}, ${activeBot.color}cc)` : 'hsl(var(--bg-overlay))', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
                <Send size={16} color={input.trim() ? '#fff' : 'hsl(var(--text-disabled))'} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {quickPrompts.slice(0, 2).map(p => (
                <button key={p} onClick={() => send(p)} style={{ fontSize: 11, padding: '3px 8px', background: activeBot.color + '15', border: `1px solid ${activeBot.color}30`, borderRadius: 6, color: activeBot.color, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {p.slice(0, 32) + (p.length > 32 ? '...' : '')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
