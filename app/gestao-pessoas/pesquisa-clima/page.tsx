'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Plus, Calendar, Users, BarChart3, Copy, X, Trash2 } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { SidePanel } from '@/components/ui/SidePanel'

type Pergunta = {
  id: string
  titulo: string
  tipo: 'texto' | 'escala_5' | 'escala_10' | 'multipla_escolha' | 'sim_nao'
  opcoes?: string[]
}

type Pesquisa = {
  id: string
  titulo: string
  descricao?: string
  tipo: string
  status: string
  data_fim: string
  perguntas: Pergunta[]
  respostasCount: number
  respostas: any[]
}

export default function PesquisaClimaAdminPage() {
  const isMobile = useIsMobile()
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modals state
  const [isNovaPesquisaOpen, setIsNovaPesquisaOpen] = useState(false)
  const [viewPesquisa, setViewPesquisa] = useState<Pesquisa | null>(null)
  const [expandedRespostas, setExpandedRespostas] = useState<Record<string, boolean>>({})
  
  // Form state
  const [formData, setFormData] = useState({ 
    titulo: '', 
    descricao: '', 
    tipo: 'eNPS', 
    data_fim: '',
    perguntas: [] as Pergunta[]
  })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetchPesquisas()
  }, [])

  const fetchPesquisas = async () => {
    try {
      const res = await fetch(`/api/gestao-pessoas/pesquisas?t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      setPesquisas(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.perguntas.length === 0) {
      setFormError('Você precisa adicionar pelo menos uma pergunta à pesquisa.')
      return
    }

    try {
      const res = await fetch('/api/gestao-pessoas/pesquisas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const responseData = await res.json()
      if (res.ok) {
        setIsNovaPesquisaOpen(false)
        setFormData({ titulo: '', descricao: '', tipo: 'eNPS', data_fim: '', perguntas: [] })
        setFormError('')
        fetchPesquisas()
      } else {
        setFormError(responseData.error || 'Erro ao criar pesquisa. Verifique o console.')
      }
    } catch (e) {
      setFormError('Erro ao criar pesquisa. Verifique sua conexão com a API.')
    }
  }

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/pesquisa/${id}`
    navigator.clipboard.writeText(url)
    alert('Link copiado para a área de transferência!')
  }

  const fetchResultados = async (id: string) => {
    try {
      const res = await fetch(`/api/gestao-pessoas/pesquisas/${id}?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setViewPesquisa({
          ...data,
          respostasCount: data.gp_pesquisa_respostas?.length || 0,
          respostas: data.gp_pesquisa_respostas || []
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Calculate generic metrics
  let totalRespostasGlobal = 0
  pesquisas.forEach(p => { totalRespostasGlobal += p.respostasCount })

  const addPergunta = () => {
    setFormData({
      ...formData,
      perguntas: [
        ...formData.perguntas,
        { id: `p_${Date.now()}`, titulo: '', tipo: 'texto', opcoes: [] }
      ]
    })
  }

  const updatePergunta = (id: string, updates: Partial<Pergunta>) => {
    setFormData({
      ...formData,
      perguntas: formData.perguntas.map(p => p.id === id ? { ...p, ...updates } : p)
    })
  }

  const removePergunta = (id: string) => {
    setFormData({
      ...formData,
      perguntas: formData.perguntas.filter(p => p.id !== id)
    })
  }

  const toggleResposta = (id: string) => {
    setExpandedRespostas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div style={{ minHeight: '100%', padding: isMobile ? 16 : 40, background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PieChart size={28} color="#4f46e5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Pesquisa de Clima</h1>
            <p style={{ margin: 0, fontSize: 15, color: '#64748b', marginTop: 4 }}>Crie pesquisas dinâmicas e monitore o engajamento da equipe.</p>
          </div>
        </div>

        <button 
          onClick={() => setIsNovaPesquisaOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
            background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s'
          }}
        >
          <Plus size={20} /> Nova Pesquisa
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 24, marginBottom: 40 }}>
        <div style={{ background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={20} /></div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>Total de Respostas Globais</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a' }}>{totalRespostasGlobal}</div>
        </div>
        
        <div style={{ background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 size={20} /></div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>Campanhas Criadas</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a' }}>{pesquisas.length}</div>
        </div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Suas Campanhas</h2>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando pesquisas...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
          {pesquisas.map((p, i) => (
            <motion.div 
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{ background: '#fff', borderRadius: 24, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{p.titulo}</h3>
                <span style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: p.status === 'ativa' ? '#dcfce7' : '#f1f5f9',
                  color: p.status === 'ativa' ? '#16a34a' : '#64748b'
                }}>
                  {p.status === 'ativa' ? 'Ativa' : 'Encerrada'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  {p.perguntas?.length || 0} {p.perguntas?.length === 1 ? 'pergunta' : 'perguntas'}
                </span>
                <span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  {p.tipo || 'Padrão'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>RESPOSTAS</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{p.respostasCount}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>ENCERRA EM</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={16} color="#94a3b8" />
                    {new Date(p.data_fim).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => fetchResultados(p.id)}
                  style={{ flex: 1, padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}
                >
                  Ver Resultados
                </button>
                <button 
                  onClick={() => copyLink(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#4f46e5', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Copy size={16} /> Copiar Link
                </button>
              </div>
            </motion.div>
          ))}
          {pesquisas.length === 0 && (
            <div style={{ color: '#64748b' }}>Nenhuma pesquisa encontrada.</div>
          )}
        </div>
      )}

      {/* Nova Pesquisa Modal - CONSTRUTOR DINÂMICO */}
      <SidePanel isOpen={isNovaPesquisaOpen} onClose={() => setIsNovaPesquisaOpen(false)} title="Nova Pesquisa de Clima" subtitle="Construtor Dinâmico de Formulário">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {formError && (
            <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#991b1b', fontSize: 14 }}>
              {formError}
            </div>
          )}

          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Informações Básicas</h3>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Título da Pesquisa</label>
              <input required value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', fontSize: 15 }} placeholder="Ex: Pesquisa de Clima 1º Semestre..." />
            </div>
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Tipo de Pesquisa</label>
                <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: 15 }}>
                  <option value="eNPS">eNPS Clássico</option>
                  <option value="Avaliação de Liderança">Avaliação de Liderança</option>
                  <option value="Saúde Mental">Saúde Mental e Bem-estar</option>
                  <option value="Customizada">Pesquisa Customizada</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Data Limite</label>
                <input required type="date" value={formData.data_fim} onChange={e => setFormData({...formData, data_fim: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', fontSize: 15 }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Descrição / Instruções</label>
              <textarea value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} rows={2} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical', fontSize: 15 }} placeholder="Pequeno texto instrucional para os respondentes..."></textarea>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Perguntas do Formulário</h3>
              <button type="button" onClick={addPergunta} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={16} /> Adicionar Pergunta
              </button>
            </div>

            {formData.perguntas.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', background: '#f8fafc', borderRadius: 16, border: '1px dashed #cbd5e1', color: '#64748b' }}>
                Nenhuma pergunta adicionada ainda.
              </div>
            ) : (
              formData.perguntas.map((p, index) => (
                <div key={p.id} style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', position: 'relative' }}>
                  <button type="button" onClick={() => removePergunta(p.id)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={18} />
                  </button>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Pergunta {index + 1}</label>
                    <input required value={p.titulo} onChange={e => updatePergunta(p.id, { titulo: e.target.value })} style={{ width: 'calc(100% - 30px)', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontSize: 14 }} placeholder="Digite a pergunta..." />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Tipo de Resposta</label>
                    <select value={p.tipo} onChange={e => updatePergunta(p.id, { tipo: e.target.value as any })} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: 14 }}>
                      <option value="escala_10">Escala de 0 a 10 (eNPS)</option>
                      <option value="escala_5">Escala de 1 a 5</option>
                      <option value="texto">Texto Livre</option>
                      <option value="sim_nao">Sim ou Não</option>
                      <option value="multipla_escolha">Múltipla Escolha</option>
                    </select>
                  </div>
                  {p.tipo === 'multipla_escolha' && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Opções (separadas por vírgula)</label>
                      <input required value={p.opcoes?.join(', ') || ''} onChange={e => updatePergunta(p.id, { opcoes: e.target.value.split(',').map(s => s.trim()) })} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontSize: 14 }} placeholder="Opção A, Opção B, Opção C..." />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 40 }}>
             <button type="button" onClick={() => setIsNovaPesquisaOpen(false)} style={{ padding: '12px 20px', borderRadius: 12, background: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
             <button type="submit" style={{ padding: '12px 20px', borderRadius: 12, background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Salvar Pesquisa</button>
          </div>
        </form>
      </SidePanel>

      {/* Ver Resultados Modal Dinâmico */}
      <SidePanel isOpen={!!viewPesquisa} onClose={() => setViewPesquisa(null)} title="Resultados Dinâmicos" subtitle={viewPesquisa?.titulo || ''}>
        {viewPesquisa && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>TOTAL DE RESPONDENTES</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{viewPesquisa.respostasCount}</div>
              </div>
            </div>
            
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Respostas Individuais</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {viewPesquisa.respostas.length === 0 ? (
                  <p style={{ color: '#64748b' }}>Nenhuma resposta registrada ainda.</p>
                ) : (
                  viewPesquisa.respostas.map((r: any) => {
                    const isExpanded = expandedRespostas[r.id]
                    let parsedJson = r.respostas_json || {}
                    if (typeof parsedJson === 'string') {
                      try { parsedJson = JSON.parse(parsedJson) } catch (e) {}
                    }

                    return (
                      <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
                        <div 
                          onClick={() => toggleResposta(r.id)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff', transition: 'background 0.2s' }}
                        >
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{r.usuario_nome}</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>{r.usuario_cargo}</div>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(r.data_assinatura).toLocaleString('pt-BR')}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>IP: {r.ip_assinatura}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', marginTop: 4 }}>
                              {isExpanded ? 'Ocultar Respostas ▲' : 'Ver Respostas ▼'}
                            </div>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px 20px', borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                            {viewPesquisa.perguntas.map((p, index) => {
                              // Ler a resposta do JSON
                              const resposta = parsedJson[p.id] !== undefined ? parsedJson[p.id] : (r.nota !== null ? r.nota : r.comentario) || 'Não respondido'
                              
                              let visualResposta = <span>{resposta}</span>
                              if (p.tipo === 'escala_10') {
                                visualResposta = <span style={{ fontWeight: 800, color: '#4f46e5' }}>{resposta} / 10</span>
                              } else if (p.tipo === 'escala_5') {
                                visualResposta = <span style={{ fontWeight: 800, color: '#4f46e5' }}>{resposta} / 5</span>
                              }
                              
                              return (
                                <div key={p.id}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                                    {index + 1}. {p.titulo}
                                  </div>
                                  <div style={{ fontSize: 15, color: '#334155', background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                                    {visualResposta}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  )
}
