'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { PenTool, Plus, Printer, MoreVertical, Search, Trash2, Edit2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function GerenciamentoSimuladosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [simulados, setSimulados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase.from('simulados').select(`
      *,
      simulados_requisicoes ( quantidade_questoes ),
      simulados_questoes ( id )
    `).order('created_at', { ascending: false })
    
    if (data) {
      const mapped = data.map(s => {
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
    loadData()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este simulado?')) return
    
    try {
      // Deleta questões primeiro, dps requisições, dps simulado
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

  const filtered = simulados.filter(s => s.titulo.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
              <PenTool size={24} color="#f43f5e" />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Gerenciar Simulados</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Crie, acompanhe e imprima as avaliações</p>
            </div>
          </div>
          
          <Link href="/simulados/gerenciamento/novo" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
            <Plus size={18} /> Novo Simulado
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar simulado..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderTopLeftRadius: 20 }}>Título</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Séries</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Criação</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progresso (Questões)</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderTopRightRadius: 20 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 15 }}>
                    Carregando simulados...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 15 }}>
                    Nenhum simulado encontrado.
                  </td>
                </tr>
              ) : filtered.map((s, index) => (
                <tr key={s.id} style={{ borderBottom: index === filtered.length - 1 ? 'none' : '1px solid hsl(var(--border-subtle))', transition: 'background 0.2s' }}>
                  <td style={{ padding: '20px 24px', borderBottomLeftRadius: index === filtered.length - 1 ? 20 : 0 }}>
                    <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', fontSize: 15, marginBottom: 4 }}>{s.titulo}</div>
                    <div style={{ color: 'hsl(var(--text-secondary))', fontSize: 13 }}>Aplicação: {s.dataAplicacao?.split('-').reverse().join('/') || '-'}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(s.turmas || []).map((serie: string) => (
                        <span key={serie} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(100, 116, 139, 0.1)', color: 'hsl(var(--text-secondary))', fontSize: 11, fontWeight: 600 }}>{serie}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                    <div style={{ color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 600 }}>{s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '-'}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 13, color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{s.questoesCadastradas} / {s.questoesTotais}</div>
                      <div style={{ width: 100, height: 6, background: 'rgba(100, 116, 139, 0.2)', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: s.questoesCadastradas >= s.questoesTotais && s.questoesTotais > 0 ? '#10b981' : '#3b82f6', width: s.questoesTotais > 0 ? `${(s.questoesCadastradas / s.questoesTotais) * 100}%` : '0%', borderRadius: 100 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                    {s.status === 'publicado' ? (
                      <span style={{ padding: '6px 12px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Publicado</span>
                    ) : (
                      <span style={{ padding: '6px 12px', borderRadius: 100, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Rascunho</span>
                    )}
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'right', position: 'relative', borderBottomRightRadius: index === filtered.length - 1 ? 20 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <Link href={`/simulados/imprimir/${s.id}`} target="_blank" style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(100, 116, 139, 0.1)', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration: 'none' }}>
                        <Printer size={16} />
                      </Link>
                      
                      <div style={{ position: 'relative' }}>
                        <button 
                          onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)}
                          style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(100, 116, 139, 0.1)', color: 'hsl(var(--text-primary))', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <MoreVertical size={16} />
                        </button>
                        
                        {menuOpen === s.id && (
                          <div style={{ position: 'absolute', right: 0, top: 40, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 8, zIndex: 50, minWidth: 150, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                            <Link 
                              href={`/simulados/gerenciamento/editar/${s.id}`}
                              style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(100, 116, 139, 0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <Edit2 size={16} /> Editar
                            </Link>

                            {s.status !== 'publicado' && (
                              <button 
                                onClick={() => {
                                  setMenuOpen(null)
                                  handleApprove(s.id)
                                }}
                                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Aprovar
                              </button>
                            )}

                            <button 
                              onClick={() => {
                                setMenuOpen(null)
                                handleDelete(s.id)
                              }}
                              style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <Trash2 size={16} /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </motion.div>
    </div>
  )
}
