'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Image as ImageIcon, CheckCircle, Circle, Edit2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { QuestaoFormModal } from '@/components/simulados/QuestaoFormModal'
import { useApp } from '@/lib/context'

import { use } from 'react';

export default function SimuladoQuestoesPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const { id } = resolvedParams as { id: string };
  const searchParams = useSearchParams();
  const professorFiltro = searchParams.get('professor');
  const disciplinaFiltro = searchParams.get('disciplina');
  const [simulado, setSimulado] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingQuestao, setEditingQuestao] = useState<any>(null)
  const { currentUserPerfil, currentUser, hydrated } = useApp()
  const isProfessor = currentUserPerfil === 'Professor'
  const [professorDisciplinas, setProfessorDisciplinas] = useState<string[]>([])

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    // 1. Get simulado info
    const { data: sim } = await supabase.from('simulados').select('*, simulados_bimestres(nome)').eq('id', id).single()
    if (sim) setSimulado(sim)

    // 2. Get simulado requisicoes to know the discipline order
    const { data: reqs } = await supabase
      .from('simulados_requisicoes')
      .select('id_disciplina, id_professor, created_at')
      .eq('id_simulado', id)
      .order('created_at', { ascending: true })
    
    const disciplineOrder: string[] = []
    if (reqs) {
      reqs.forEach(r => {
        if (!disciplineOrder.includes(r.id_disciplina)) {
          disciplineOrder.push(r.id_disciplina)
        }
      })

      if (isProfessor && currentUser) {
        const myDisciplines = reqs.filter(r => r.id_professor === currentUser.id).map(r => r.id_disciplina)
        setProfessorDisciplinas(myDisciplines)
      }
    }

    // 3. Get questoes and alternativas
    const { data: q } = await supabase
      .from('simulados_questoes')
      .select('*, simulados_disciplinas(nome), simulados_alternativas(*)')
      .eq('id_simulado', id)

    if (q) {
      let filtered = q;
      if (professorFiltro && disciplinaFiltro) {
        filtered = q.filter(quest => quest.id_professor == professorFiltro && quest.id_disciplina == disciplinaFiltro);
      }
      
      // Sort by discipline original order, then chronological
      filtered.sort((a, b) => {
        const indexA = disciplineOrder.indexOf(a.id_disciplina)
        const indexB = disciplineOrder.indexOf(b.id_disciplina)
        
        if (indexA !== indexB) {
          const aRank = indexA !== -1 ? indexA : 9999
          const bRank = indexB !== -1 ? indexB : 9999
          return aRank - bRank
        }
        
        const orderA = a.ordem || 0
        const orderB = b.ordem || 0
        if (orderA !== orderB) return orderA - orderB
        
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      
      setQuestoes(filtered)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (hydrated) {
      loadData()
    }
  }, [id, professorFiltro, disciplinaFiltro, hydrated, currentUser])

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <Link href="/simulados/lista" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6', textDecoration: 'none', fontWeight: 600, marginBottom: 12 }}>
              <ArrowLeft size={16} /> Voltar para Lista
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>{simulado.titulo}</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>
              {simulado.simulados_bimestres?.nome} • {simulado.data_aplicacao ? new Date(simulado.data_aplicacao).toLocaleDateString('pt-BR') : 'Data não definida'}
              {professorFiltro && disciplinaFiltro && (
                <span style={{ marginLeft: 8, padding: '2px 8px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 4, fontWeight: 600 }}>Filtrado por Professor</span>
              )}
            </p>
          </div>
          {(!isProfessor || professorDisciplinas.length > 0) && (
            <button 
              onClick={() => { setEditingQuestao(null); setModalOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#3b82f6', color: 'white', padding: '12px 20px', borderRadius: 12, border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
            >
              <Plus size={18} /> Nova Questão
            </button>
          )}
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {q.simulados_disciplinas?.nome || 'Sem Disciplina'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(!isProfessor || professorDisciplinas.includes(q.id_disciplina)) && (
                      <>
                        <button onClick={() => { setEditingQuestao(q); setModalOpen(true); }} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteQuestao(q.id)} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    {(isProfessor && !professorDisciplinas.includes(q.id_disciplina)) && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-app))', padding: '4px 8px', borderRadius: 6 }}>
                        Sem Permissão
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, marginTop: 2 }}>
                    {index + 1}
                  </div>
                  <div 
                    style={{ color: 'hsl(var(--text-primary))', fontSize: 15, lineHeight: 1.6, flex: 1, wordBreak: 'break-word', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'justify' }}
                    dangerouslySetInnerHTML={{ __html: q.enunciado || '' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(q.simulados_alternativas || []).sort((a: any, b: any) => a.letra.localeCompare(b.letra)).map((alt: any) => (
                    <div key={alt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: alt.eh_correta ? 'rgba(16,185,129,0.1)' : 'hsl(var(--bg-app))', border: `1px solid ${alt.eh_correta ? '#10b981' : 'hsl(var(--border-subtle))'}` }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: alt.eh_correta ? '#10b981' : 'rgba(100,116,139,0.2)', color: alt.eh_correta ? 'white' : 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                        {alt.letra}
                      </div>
                      <div style={{ color: alt.eh_correta ? '#10b981' : 'hsl(var(--text-primary))', fontSize: 14, fontWeight: alt.eh_correta ? 600 : 400 }}>
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
          defaultProfessorId={isProfessor ? currentUser?.id : (professorFiltro || undefined)}
          defaultDisciplinaId={isProfessor && professorDisciplinas.length > 0 ? professorDisciplinas[0] : (disciplinaFiltro || undefined)}
          onClose={() => {
            setModalOpen(false)
            setEditingQuestao(null)
          }} 
          onSave={() => { 
            setModalOpen(false)
            setEditingQuestao(null)
            loadData() 
          }} 
        />
      )}
    </div>
  )
}
