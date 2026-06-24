'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Calendar, Layers, ChevronRight, PenTool } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SimuladosListaPage() {
  const [simulados, setSimulados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('simulados').select(`
        *,
        simulados_bimestres ( nome ),
        simulados_questoes ( id )
      `).order('created_at', { ascending: false })

      if (data) {
        setSimulados(data.map(s => ({
          ...s,
          questoesCadastradas: s.simulados_questoes?.length || 0
        })))
      }
      setLoading(false)
    }
    loadData()
  }, [])

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Meus Simulados</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0', fontSize: 14 }}>Selecione um simulado para gerenciar suas questões e gabarito</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ color: 'hsl(var(--text-secondary))' }}>Carregando simulados...</div>
          </div>
        ) : simulados.length === 0 ? (
          <div style={{ 
            background: 'hsl(var(--bg-surface))', 
            border: '1px solid hsl(var(--border-subtle))', 
            borderRadius: 20, 
            padding: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center'
          }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <FileText size={32} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 8px' }}>Nenhum Simulado Encontrado</h2>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: '0 0 24px', maxWidth: 400 }}>
              Você ainda não possui nenhum simulado cadastrado. Vá até a tela de Gerenciamento para criar o seu primeiro simulado.
            </p>
            <Link href="/simulados/gerenciamento/novo" style={{ background: '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
              Criar Simulado
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {simulados.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/simulados/lista/${s.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ 
                    background: 'hsl(var(--bg-surface))', 
                    border: '1px solid hsl(var(--border-subtle))', 
                    borderRadius: 20, 
                    padding: 24,
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(244,63,94,0.1)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PenTool size={20} />
                      </div>
                      {s.status === 'publicado' ? (
                        <span style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Publicado</span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Rascunho</span>
                      )}
                    </div>
                    
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 16px', lineHeight: 1.3 }}>{s.titulo}</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 13 }}>
                        <Calendar size={14} />
                        <span>Aplicação: {s.data_aplicacao?.split('-').reverse().join('/') || 'Não definida'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 13 }}>
                        <Layers size={14} />
                        <span>{s.simulados_bimestres?.nome || 'Bimestre não definido'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 13 }}>
                        <FileText size={14} />
                        <span>{s.questoesCadastradas} questões cadastradas</span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#3b82f6', fontSize: 14, fontWeight: 600 }}>
                      <span>Gerenciar Questões</span>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}

