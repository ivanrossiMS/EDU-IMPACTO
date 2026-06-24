'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Image as ImageIcon, CheckCircle, Circle, Edit2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { QuestaoFormModal } from '@/components/simulados/QuestaoFormModal'

export default function SimuladoQuestoesPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [simulado, setSimulado] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingQuestao, setEditingQuestao] = useState<any>(null)

  const loadData = async () => {
    setLoading(true)
    const { data: sData } = await supabase.from('simulados').select('*, simulados_bimestres(nome)').eq('id', id).single()
    if (sData) setSimulado(sData)

    const { data: qData } = await supabase.from('simulados_questoes').select(`
      *,
      simulados_disciplinas(nome),
      simulados_alternativas(*)
    `).eq('id_simulado', id).order('ordem', { ascending: true })

    if (qData) {
      setQuestoes(qData)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleDeleteQuestao = async (questaoId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta questão? As alternativas também serão excluídas.')) return
    try {
      await supabase.from('simulados_alternativas').delete().eq('id_questao', questaoId)
      await supabase.from('simulados_questoes').delete().eq('id', questaoId)
      loadData()
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir questão.')
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>Carregando questões...</div>
  if (!simulado) return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>Simulado não encontrado.</div>

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/simulados/lista" style={{ width: 40, height: 40, borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-primary))', textDecoration: 'none' }}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>{simulado.titulo}</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0', fontSize: 13 }}>
                {simulado.simulados_bimestres?.nome || 'Bimestre Geral'} • {questoes.length} Questões cadastradas
              </p>
            </div>
          </div>
          <button 
            onClick={() => { setEditingQuestao(null); setModalOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#3b82f6', color: 'white', padding: '12px 20px', borderRadius: 12, border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
          >
            <Plus size={18} /> Nova Questão
          </button>
        </div>

        {/* Questões List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {questoes.length === 0 ? (
            <div style={{ background: 'hsl(var(--bg-surface))', padding: 60, borderRadius: 20, textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))' }}>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, margin: 0 }}>Nenhuma questão cadastrada neste simulado ainda.</p>
            </div>
          ) : (
            questoes.map((q, index) => (
              <div key={q.id} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                      {index + 1}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {q.simulados_disciplinas?.nome || 'Sem Disciplina'}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 100, background: 'rgba(100,116,139,0.1)', color: 'hsl(var(--text-secondary))', fontSize: 11, fontWeight: 600 }}>
                      Dificuldade: {q.dificuldade}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditingQuestao(q); setModalOpen(true); }} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteQuestao(q.id)} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div 
                  style={{ color: 'hsl(var(--text-primary))', fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}
                  dangerouslySetInnerHTML={{ __html: q.enunciado || '' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(q.simulados_alternativas || []).sort((a: any, b: any) => a.letra.localeCompare(b.letra)).map((alt: any) => (
                    <div key={alt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: alt.correta ? 'rgba(16,185,129,0.1)' : 'hsl(var(--bg-app))', border: `1px solid ${alt.correta ? '#10b981' : 'hsl(var(--border-subtle))'}` }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: alt.correta ? '#10b981' : 'rgba(100,116,139,0.2)', color: alt.correta ? 'white' : 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                        {alt.letra}
                      </div>
                      <div style={{ color: alt.correta ? '#10b981' : 'hsl(var(--text-primary))', fontSize: 14, fontWeight: alt.correta ? 600 : 400 }}>
                        {alt.texto}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

      </motion.div>

      {modalOpen && (
        <QuestaoFormModal 
          simuladoId={id} 
          questao={editingQuestao} 
          onClose={() => setModalOpen(false)} 
          onSave={() => { setModalOpen(false); loadData(); }} 
        />
      )}
    </div>
  )
}
