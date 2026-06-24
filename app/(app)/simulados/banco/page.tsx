'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Library, Plus, Search, Filter, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function BancoQuestoesPage() {
  const [questoes, setQuestoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  

  useEffect(() => {
    fetchQuestoes()
  }, [])

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

  const filtered = questoes.filter(q => 
    q.enunciado.toLowerCase().includes(search.toLowerCase()) || 
    q.simulados_disciplinas?.nome?.toLowerCase().includes(search.toLowerCase())
  )

  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  return (
    <div style={{ padding: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
            <Library size={24} color="#f43f5e" />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Banco de Questões</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Explore e gerencie as questões disponíveis</p>
          </div>
        </div>
        <Link href="/simulados/banco/nova" style={{ textDecoration: 'none' }}>
          <button style={{ background: 'linear-gradient(135deg, #f43f5e, #be123c)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <Plus size={18} /> Nova Questão
          </button>
        </Link>
      </div>

      <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: 24 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 16, top: 14 }} />
            <input 
              type="text" 
              placeholder="Buscar pelo enunciado ou disciplina..." 
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none' }} 
            />
          </div>
          <button style={{ background: 'rgba(100, 116, 139, 0.1)', border: '1px solid hsl(var(--border-subtle))', padding: '0 20px', borderRadius: 12, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <Filter size={18} /> Filtros
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>Carregando questões...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(item => (
              <Link href={`/simulados/banco/${item.id}`} key={item.id} style={{ textDecoration: 'none' }}>
                <div style={{ padding: 20, background: 'hsl(var(--bg-app))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', transition: 'all 0.2s', cursor: 'pointer' }}
                     onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(244,63,94,0.3)'}
                     onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(100, 116, 139, 0.1)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                      <BookOpen size={12} color={item.simulados_disciplinas?.cor || '#3b82f6'} />
                      {item.simulados_disciplinas?.nome || 'Sem Disciplina'}
                    </div>
                    <div style={{ background: item.nivel_dificuldade === 'facil' ? 'rgba(16,185,129,0.1)' : item.nivel_dificuldade === 'dificil' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: item.nivel_dificuldade === 'facil' ? '#10b981' : item.nivel_dificuldade === 'dificil' ? '#ef4444' : '#f59e0b', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                      {item.nivel_dificuldade}
                    </div>
                    {item.eh_adaptada && (
                      <div style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>ADAPTADA</div>
                    )}
                  </div>

                  <div style={{ fontSize: 15, color: 'hsl(var(--text-primary))', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {stripHtml(item.enunciado)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
                      Autor: <span style={{ color: 'hsl(var(--text-primary))' }}>{item.simulados_professores?.nome || 'Sistema'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                      Cadastrada em {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                </div>
              </Link>
            ))}
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>Nenhuma questão encontrada no banco.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
