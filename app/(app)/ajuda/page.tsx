'use client'

import { useState } from 'react'
import { HelpCircle, Book, MessageSquare, Video, Search, ChevronRight, ExternalLink } from 'lucide-react'

const FAQS = [
  { pergunta: 'Como lançar notas para uma turma?', resposta: 'Acesse Acadêmico → Lançamento de Notas, selecione a turma, disciplina e bimestre. Clique nas células para editar e depois em Salvar Notas.', categoria: 'Acadêmico' },
  { pergunta: 'Como gerar um boleto de mensalidade?', resposta: 'Acesse Financeiro → Banking & PIX → aba Boletos. Selecione o mês e clique em Emitir boletos do mês para gerar em lote.', categoria: 'Financeiro' },
  { pergunta: 'Como emitir uma Declaração de Matrícula?', resposta: 'Acesse Secretaria → Emitir Documento, selecione o aluno, tipo "Declaração de Matrícula" e clique em Gerar e enviar.', categoria: 'Secretaria' },
  { pergunta: 'Como registrar falta de um aluno?', resposta: 'Acesse Acadêmico → Frequência, selecione a turma e clique nas células de presença para alterar entre P (presente), F (falta) e J (justificada).', categoria: 'Acadêmico' },
  { pergunta: 'Como funciona o Copiloto IA?', resposta: 'O Copiloto IA utiliza o modelo Gemini para responder perguntas sobre os dados da escola em tempo real. Acesse IA → Copilotos para diferentes especialidades.', categoria: 'Inteligência' },
  { pergunta: 'O sistema está lento — o que fazer?', resposta: 'Tente limpar o cache do navegador (Ctrl+Shift+Del) e recarregar. Se o problema persistir, contate o suporte pelo chat abaixo.', categoria: 'Suporte' },
]

const VIDEOS = [
  { titulo: 'Tour completo: 5 minutos', duracao: '5:12', categoria: 'Início' },
  { titulo: 'Como configurar o Censo Escolar', duracao: '12:30', categoria: 'MEC/INEP' },
  { titulo: 'Portal do Professor completo', duracao: '6:18', categoria: 'Professores' },
]

export default function AjudaPage() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'faq' | 'videos' | 'suporte'>('faq')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const filtered = FAQS.filter(f => f.pergunta.toLowerCase().includes(search.toLowerCase()) || f.categoria.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de Ajuda</h1>
          <p className="page-subtitle">FAQ, tutoriais em vídeo e suporte técnico</p>
        </div>
      </div>

      {/* Busca */}
      <div style={{ position: 'relative', marginBottom: 24, maxWidth: 600 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
        <input className="form-input" style={{ paddingLeft: 42, fontSize: 15, height: 48 }} placeholder="🔍 Pesquisar ajuda... Ex: 'como lançar nota'" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="tab-list" style={{ marginBottom: 20, width: 'fit-content' }}>
        <button className={`tab-trigger ${tab === 'faq' ? 'active' : ''}`} onClick={() => setTab('faq')}><HelpCircle size={12} />FAQ</button>
        <button className={`tab-trigger ${tab === 'videos' ? 'active' : ''}`} onClick={() => setTab('videos')}><Video size={12} />Tutoriais</button>
        <button className={`tab-trigger ${tab === 'suporte' ? 'active' : ''}`} onClick={() => setTab('suporte')}><MessageSquare size={12} />Suporte</button>
      </div>

      {tab === 'faq' && (
        <div style={{ maxWidth: 760 }}>
          {filtered.map((faq, i) => (
            <div key={i} style={{ marginBottom: 8, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: openFaq === i ? 'hsl(var(--bg-surface))' : 'hsl(var(--bg-surface))', overflow: 'hidden' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <HelpCircle size={16} color="#8b5cf6" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{faq.pergunta}</span>
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{faq.categoria}</span>
                <ChevronRight size={14} style={{ color: 'hsl(var(--text-muted))', transform: openFaq === i ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 18px 16px 48px', fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.7 }}>
                  {faq.resposta}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'videos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, maxWidth: 760 }}>
          {VIDEOS.map((v, i) => (
            <div key={i} className="card" style={{ padding: '20px', display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ width: 60, height: 60, borderRadius: 12, background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 24 }}>▶</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'hsl(var(--text-primary))' }}>{v.titulo}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{v.categoria}</span>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>⏱ {v.duracao}</span>
                </div>
              </div>
              <ExternalLink size={14} color="hsl(var(--text-muted))" />
            </div>
          ))}
        </div>
      )}

      {tab === 'suporte' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            {[
              { titulo: 'Chat ao vivo', desc: 'Tempo médio de resposta: 3 min', icon: '💬', color: '#3b82f6', action: 'Iniciar chat' },
              { titulo: 'E-mail suporte', desc: 'suporte@impactoedu.com.br', icon: '📧', color: '#10b981', action: 'Enviar e-mail' },
              { titulo: 'Telefone', desc: '0800 123 4567 (seg-sex 8h–18h)', icon: '📞', color: '#8b5cf6', action: 'Ligar' },
              { titulo: 'Base de conhecimento', desc: 'Documentação técnica completa', icon: '📚', color: '#f59e0b', action: 'Acessar' },
            ].map(c => (
              <div key={c.titulo} className="card" style={{ padding: '20px', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{c.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{c.titulo}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 14 }}>{c.desc}</div>
                <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>{c.action}</button>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Abrir chamado de suporte</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="form-label">Assunto</label><input className="form-input" placeholder="Resumo do problema..." /></div>
              <div>
                <label className="form-label">Categoria</label>
                <select className="form-input"><option>Financeiro</option><option>Acadêmico</option><option>RH</option><option>Comunicação</option><option>Relatórios</option><option>Acesso/login</option><option>Outro</option></select>
              </div>
              <div><label className="form-label">Descrição</label><textarea className="form-input" rows={4} placeholder="Descreva o problema com detalhes..." /></div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-primary"><MessageSquare size={13} />Abrir chamado</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
