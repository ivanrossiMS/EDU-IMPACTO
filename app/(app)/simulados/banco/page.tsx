'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Library, Plus, Search, Filter, BookOpen, Layers, User, MoreVertical, LayoutGrid, List, Trash2, X, Sparkles, Bot } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function BancoQuestoesPage() {
  const router = useRouter()
  const [questoes, setQuestoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid'|'list'>('list')
  
  // Filtros
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [disciplinas, setDisciplinas] = useState<any[]>([])
  const [filterDisciplina, setFilterDisciplina] = useState('')
  const [filterDificuldade, setFilterDificuldade] = useState('')
  const [filterTurma, setFilterTurma] = useState('')

  const turmasDisponiveis = [
    '6º Ano Fundamental', '7º Ano Fundamental', '8º Ano Fundamental', '9º Ano Fundamental',
    '1º Ano Ensino Médio', '2º Ano Ensino Médio', '3º Ano Ensino Médio'
  ]

  useEffect(() => {
    fetchQuestoes()
    fetchDisciplinas()
  }, [])

  const fetchDisciplinas = async () => {
    const { data } = await supabase.from('simulados_disciplinas').select('*').order('nome')
    if (data) setDisciplinas(data)
  }

  const fetchQuestoes = async () => {
    try {
      const { data, error } = await supabase
        .from('simulados_questoes')
        .select('*, simulados_disciplinas (nome, cor), simulados_professores (nome)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setQuestoes(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm('Tem certeza que deseja excluir esta questão? Ela será apagada permanentemente.')) {
      try {
        const { error } = await supabase.from('simulados_questoes').delete().eq('id', id);
        if (error) throw error;
        setQuestoes(prev => prev.filter(q => q.id !== id));
      } catch (err: any) {
        console.error(err);
        alert('Erro ao excluir: ' + err.message);
      }
    }
  }

  const filtered = questoes.filter(q => {
    const matchesSearch = q.enunciado.toLowerCase().includes(search.toLowerCase()) || 
                          q.simulados_disciplinas?.nome?.toLowerCase().includes(search.toLowerCase());
    const matchesDisciplina = filterDisciplina ? q.id_disciplina === filterDisciplina : true;
    const matchesDificuldade = filterDificuldade ? q.nivel_dificuldade === filterDificuldade : true;
    
    // Extracted turma
    const matchTurma = q.enunciado.match(/<meta name="turma" content="(.*?)">/);
    const questaoTurma = matchTurma ? matchTurma[1] : '';
    const matchesTurma = filterTurma ? questaoTurma === filterTurma : true;

    return matchesSearch && matchesDisciplina && matchesDificuldade && matchesTurma;
  })

  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

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
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Library size={32} color="#8b5cf6" />
            </div>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.03em' }}>Banco de Questões</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '6px 0 0', fontSize: 15 }}>Catálogo central de itens, questões adaptadas e filtros</p>
            </div>
          </div>
          
          <Link href="/simulados/banco/nova" style={{ textDecoration: 'none' }}>
            <motion.button 
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', color: '#fff', fontWeight: 800, border: 'none', boxShadow: '0 10px 25px -10px rgba(139,92,246,0.6)', cursor: 'pointer' }}
            >
              <Plus size={20} /> Nova Questão
            </motion.button>
          </Link>
        </div>

        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: '24px 32px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: isFilterOpen ? 24 : 32 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={20} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Busque por trechos do enunciado, disciplina ou habilidades..." 
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '16px 20px 16px 52px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#8b5cf6'}
                onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} 
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              style={{ height: 54, background: isFilterOpen ? '#8b5cf6' : 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', padding: '0 24px', borderRadius: 16, color: isFilterOpen ? '#fff' : '#8b5cf6', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s' }} 
              onMouseEnter={e => { if (!isFilterOpen) e.currentTarget.style.background = 'rgba(139,92,246,0.1)' }} 
              onMouseLeave={e => { if (!isFilterOpen) e.currentTarget.style.background = 'rgba(139,92,246,0.05)' }}
            >
              <Filter size={18} /> {isFilterOpen ? 'Ocultar Filtros' : 'Filtros Avançados'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', background: 'hsl(var(--bg-app))', borderRadius: 12, padding: 4, border: '1px solid hsl(var(--border-subtle))' }}>
              <div onClick={() => setViewMode('list')} style={{ width: 44, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: viewMode === 'list' ? 'hsl(var(--bg-surface))' : 'transparent', color: viewMode === 'list' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', boxShadow: viewMode === 'list' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>
                <List size={18} />
              </div>
              <div onClick={() => setViewMode('grid')} style={{ width: 44, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: viewMode === 'grid' ? 'hsl(var(--bg-surface))' : 'transparent', color: viewMode === 'grid' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', boxShadow: viewMode === 'grid' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>
                <LayoutGrid size={18} />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden', marginBottom: 32 }}
              >
                <div style={{ background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Disciplina</label>
                    <select 
                      value={filterDisciplina} 
                      onChange={e => setFilterDisciplina(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
                    >
                      <option value="">Todas as disciplinas</option>
                      {disciplinas.map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Turma</label>
                    <select 
                      value={filterTurma} 
                      onChange={e => setFilterTurma(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
                    >
                      <option value="">Todas as turmas</option>
                      {turmasDisponiveis.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Dificuldade</label>
                    <select 
                      value={filterDificuldade} 
                      onChange={e => setFilterDificuldade(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
                    >
                      <option value="">Qualquer dificuldade</option>
                      <option value="facil">Fácil</option>
                      <option value="media">Média</option>
                      <option value="dificil">Difícil</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button 
                      onClick={() => { setFilterDisciplina(''); setFilterDificuldade(''); setFilterTurma(''); setSearch(''); }}
                      style={{ height: 46, width: '100%', background: 'transparent', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--bg-surface))'; e.currentTarget.style.color = 'hsl(var(--text-primary))'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'hsl(var(--text-secondary))'; }}
                    >
                      <X size={16} /> Limpar Filtros
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: 40, height: 40, border: '4px solid rgba(139,92,246,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'hsl(var(--bg-app))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 24, padding: 80, textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(139,92,246,0.05)', color: '#8b5cf6', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Library size={36} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 12px' }}>Banco Vazio</h3>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, maxWidth: 400, margin: '0 auto' }}>Não há questões correspondentes aos filtros selecionados ou o banco está vazio.</p>
              {(search || filterDisciplina || filterDificuldade || filterTurma) && (
                <button 
                  onClick={() => { setFilterDisciplina(''); setFilterDificuldade(''); setFilterTurma(''); setSearch(''); }}
                  style={{ marginTop: 24, padding: '10px 20px', background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 100, color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 600 }}
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(400px, 1fr))' : '1fr', 
              gap: 20 
            }}>
              <AnimatePresence>
                {filtered.map((item, index) => {
                  const matchTurma = item.enunciado.match(/<meta name="turma" content="(.*?)">/);
                  const questaoTurma = matchTurma ? matchTurma[1] : null;
                  const isAiGenerated = item.enunciado.includes('<meta name="gerado_por_ia" content="true">');
                  const matchAiAutor = item.enunciado.match(/<meta name="ia_autor_nome" content="(.*?)">/);
                  const iaAutor = matchAiAutor ? matchAiAutor[1] : null;
                  const matchAiProva = item.enunciado.match(/<meta name="ia_prova_titulo" content="(.*?)">/);
                  const iaProva = matchAiProva ? matchAiProva[1] : null;

                  return (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: index * 0.05 }} key={item.id}>
                    <div onClick={() => router.push(`/simulados/banco/${item.id}`)} style={{ textDecoration: 'none' }}>
                      <div style={{ 
                        padding: '24px 28px', background: 'hsl(var(--bg-app))', 
                        borderRadius: 20, border: '1px solid hsl(var(--border-subtle))', 
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column', height: '100%'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#8b5cf6'
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = '0 12px 25px -5px rgba(139,92,246,0.15)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.02)'
                      }}>
                        
                        {/* Status Strip */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: item.nivel_dificuldade === 'facil' ? '#10b981' : item.nivel_dificuldade === 'dificil' ? '#ef4444' : '#f59e0b' }} />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, marginTop: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-primary))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              <BookOpen size={14} color={item.simulados_disciplinas?.cor || '#8b5cf6'} />
                              {item.simulados_disciplinas?.nome || 'Sem Disciplina'}
                            </div>
                            {questaoTurma && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '6px 12px', borderRadius: 100, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {questaoTurma}
                              </div>
                            )}
                            <div style={{ background: item.nivel_dificuldade === 'facil' ? 'rgba(16,185,129,0.1)' : item.nivel_dificuldade === 'dificil' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: item.nivel_dificuldade === 'facil' ? '#10b981' : item.nivel_dificuldade === 'dificil' ? '#ef4444' : '#f59e0b', padding: '6px 14px', borderRadius: 100, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {item.nivel_dificuldade || 'MÉDIO'}
                            </div>
                            {item.eh_adaptada && (
                              <div style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', padding: '6px 14px', borderRadius: 100, fontSize: 11, fontWeight: 900, letterSpacing: '0.05em' }}>ADAPTADA</div>
                            )}
                            {isAiGenerated && (
                              <div style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(139,92,246,0.1))', border: '1px solid rgba(217,70,239,0.2)', color: '#d946ef', padding: '6px 14px', borderRadius: 100, fontSize: 11, fontWeight: 900, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Sparkles size={12} /> IA
                              </div>
                            )}
                          </div>
                          
                          <button 
                            onClick={(e) => handleDelete(e, item.id)}
                            style={{ 
                              background: 'transparent', border: 'none', color: 'hsl(var(--text-muted))', 
                              cursor: 'pointer', padding: 6, borderRadius: 8, transition: 'all 0.2s',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-muted))'; e.currentTarget.style.background = 'transparent'; }}
                            title="Excluir questão"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div style={{ flex: 1, fontSize: 16, color: 'hsl(var(--text-primary))', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: viewMode === 'grid' ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 24, paddingRight: 16 }}>
                          {stripHtml(item.enunciado)}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))', marginTop: 'auto', flexWrap: 'wrap', gap: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={12} />
                              </div>
                              <span>Por <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 700 }}>{item.simulados_professores?.nome || 'Sistema'}</span></span>
                            </div>
                            {isAiGenerated && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--text-secondary))', background: 'rgba(236,72,153,0.05)', padding: '6px 10px', borderRadius: 8, border: '1px dashed rgba(236,72,153,0.2)' }}>
                                <Bot size={14} color="#d946ef" />
                                <span>Gerado por: <strong style={{ color: 'hsl(var(--text-primary))' }}>{iaAutor || 'IA'}</strong> | Origem: <strong style={{ color: 'hsl(var(--text-primary))' }}>{iaProva || 'Desconhecida'}</strong></span>
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                            {new Date(item.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </div>

                      </div>
                    </div>
                  </motion.div>
                )})}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
