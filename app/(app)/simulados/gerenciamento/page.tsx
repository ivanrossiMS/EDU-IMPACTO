'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PenTool, Plus, Printer, MoreVertical, Search, Trash2, Edit2, Calendar, Layout, FileText, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'

export default function GerenciamentoSimuladosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTurma, setSelectedTurma] = useState('')
  const [simulados, setSimulados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const { currentUser, currentUserPerfil } = useApp()

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true)
    const { data } = await supabase.from('simulados').select(`
      *,
      simulados_bimestres ( nome ),
      simulados_requisicoes ( quantidade_questoes, id_professor ),
      simulados_questoes ( id )
    `).order('created_at', { ascending: false })
    
    if (data) {
      let filteredData = data;
      if (currentUserPerfil === 'Professor') {
         filteredData = data.filter(s => {
           return s.simulados_requisicoes?.some((r: any) => r.id_professor === currentUser.id);
         });
      }

      const mapped = filteredData.map(s => {
        const questoesTotais = s.simulados_requisicoes?.reduce((acc: number, r: any) => acc + (r.quantidade_questoes || 0), 0) || 0
        const questoesCadastradas = s.simulados_questoes?.length || 0
        return {
          ...s,
          questoesTotais,
          questoesCadastradas,
          dataAplicacao: s.data_aplicacao
        }
      })
      setSimulados(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (currentUser) {
      loadData()
    }
  }, [currentUser])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este simulado? Esta ação não pode ser desfeita.')) return
    
    try {
      await supabase.from('simulados_questoes').delete().eq('id_simulado', id)
      await supabase.from('simulados_requisicoes').delete().eq('id_simulado', id)
      const { error } = await supabase.from('simulados').delete().eq('id', id)
      if (error) throw error
      
      loadData()
    } catch (e) {
      console.error(e)
      alert('Erro ao excluir simulado.')
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm('Deseja realmente aprovar e publicar este simulado? Ele ficará visível aos alunos e professores.')) return
    
    try {
      const { error } = await supabase.from('simulados').update({ status: 'publicado' }).eq('id', id)
      if (error) throw error
      
      loadData()
    } catch (e) {
      console.error(e)
      alert('Erro ao aprovar simulado.')
    }
  }

  const filtered = simulados.filter(s => {
    const matchName = s.titulo.toLowerCase().includes(searchTerm.toLowerCase())
    const matchTurma = selectedTurma === '' ? true : (s.turmas || []).includes(selectedTurma)
    return matchName && matchTurma
  })

  // Extrair todas as turmas únicas para o filtro
  const todasTurmas = Array.from(new Set(simulados.flatMap(s => s.turmas || []))).sort()

  return (
    <div style={{ padding: '40px', maxWidth: 1400, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 40,
          background: 'linear-gradient(135deg, hsl(var(--bg-surface)) 0%, hsl(var(--bg-elevated)) 100%)',
          padding: '28px 36px',
          borderRadius: 24,
          border: '1px solid hsl(var(--border-subtle))',
          boxShadow: '0 10px 30px -15px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
              <PenTool size={32} color="#f43f5e" />
            </div>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.03em' }}>Gerenciar Simulados</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '6px 0 0', fontSize: 15 }}>Painel de controle para criação, edição e publicação</p>
            </div>
          </div>
          
          <Link href="/simulados/gerenciamento/novo" style={{ textDecoration: 'none' }}>
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 14, background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', color: '#fff', fontWeight: 800, boxShadow: '0 10px 25px -10px rgba(244,63,94,0.6)', cursor: 'pointer' }}
            >
              <Plus size={20} /> Novo Simulado
            </motion.div>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={20} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Pesquisar por título do simulado..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', padding: '16px 20px 16px 52px', borderRadius: 16, 
                background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', 
                color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}
              onFocus={e => e.target.style.borderColor = '#f43f5e'}
              onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'}
            />
          </div>
          <select
            value={selectedTurma}
            onChange={e => setSelectedTurma(e.target.value)}
            style={{
              padding: '16px 24px', borderRadius: 16,
              background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
              color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none',
              cursor: 'pointer', minWidth: 200, fontWeight: 600,
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <option value="">Todas as Séries</option>
            {todasTurmas.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: 40, height: 40, border: '4px solid rgba(244,63,94,0.2)', borderTopColor: '#f43f5e', borderRadius: '50%' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 24, padding: 80, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(244,63,94,0.05)', color: '#f43f5e', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layout size={36} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 12px' }}>Nenhum simulado encontrado</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, maxWidth: 400, margin: '0 auto' }}>Tente ajustar os termos de pesquisa ou crie um novo simulado para começar.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {filtered.map((s, index) => {
              const progress = s.questoesTotais > 0 ? (s.questoesCadastradas / s.questoesTotais) * 100 : 0
              const isComplete = s.questoesCadastradas >= s.questoesTotais && s.questoesTotais > 0
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                  key={s.id}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '24px 32px', background: 'hsl(var(--bg-surface))', 
                    borderRadius: 20, border: '1px solid hsl(var(--border-subtle))',
                    boxShadow: '0 4px 15px -5px rgba(0,0,0,0.02)', transition: 'all 0.3s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.borderColor = 'hsl(var(--border-muted))'
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.05)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                    e.currentTarget.style.boxShadow = '0 4px 15px -5px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(244,63,94,0.1)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{s.titulo}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 500 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} /> Aplicação: {s.dataAplicacao?.split('-').reverse().join('/') || 'Indefinida'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Layout size={14} /> {s.simulados_bimestres?.nome || 'S/ Bimestre'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', flex: 1, minWidth: 200 }}>
                    {(s.turmas || []).map((t: string) => (
                      <span key={t} style={{ 
                        padding: '8px 16px', 
                        borderRadius: 12, 
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.15) 100%)', 
                        color: '#2563eb', 
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        fontSize: 16, 
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        textAlign: 'center'
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 40, flex: 1, justifyContent: 'flex-end' }}>
                    <div style={{ width: 140 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, marginBottom: 8, color: isComplete ? '#10b981' : '#f43f5e' }}>
                        <span>PROGRESSO</span>
                        <span>{s.questoesCadastradas}/{s.questoesTotais}</span>
                      </div>
                      <div style={{ height: 6, background: 'hsl(var(--bg-app))', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: isComplete ? '#10b981' : '#f43f5e', borderRadius: 100, transition: 'width 0.5s easeOut' }} />
                      </div>
                    </div>

                    <div style={{ width: 100, textAlign: 'center' }}>
                      {s.status === 'publicado' ? (
                        <span style={{ padding: '6px 14px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Publicado</span>
                      ) : (
                        <span style={{ padding: '6px 14px', borderRadius: 100, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rascunho</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Link href={`/simulados/imprimir/${s.id}`} target="_blank">
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ width: 40, height: 40, borderRadius: 10, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Printer size={18} />
                        </motion.div>
                      </Link>
                      
                      <div style={{ position: 'relative' }}>
                        <motion.button 
                          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                          onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)}
                          style={{ width: 40, height: 40, borderRadius: 10, background: menuOpen === s.id ? 'rgba(244,63,94,0.1)' : 'hsl(var(--bg-app))', color: menuOpen === s.id ? '#f43f5e' : 'hsl(var(--text-secondary))', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                        >
                          <MoreVertical size={18} />
                        </motion.button>
                        
                        <AnimatePresence>
                          {menuOpen === s.id && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.15 }}
                              style={{ position: 'absolute', right: 0, top: 48, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 8, zIndex: 50, minWidth: 180, boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)' }}
                            >
                              <Link href={`/simulados/gerenciamento/editar/${s.id}`} style={{ textDecoration: 'none' }}>
                                <div style={{ width: '100%', padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-app))'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <Edit2 size={16} /> Editar Simulado
                                </div>
                              </Link>

                              {s.status !== 'publicado' && (
                                <div 
                                  onClick={() => { setMenuOpen(null); handleApprove(s.id) }}
                                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} 
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <CheckCircle2 size={16} /> Publicar Oficial
                                </div>
                              )}

                              <div style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />

                              <div 
                                onClick={() => { setMenuOpen(null); handleDelete(s.id) }}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} 
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <Trash2 size={16} /> Excluir Simulado
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

      </motion.div>
    </div>
  )
}
