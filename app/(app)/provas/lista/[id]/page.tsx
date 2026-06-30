'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Image as ImageIcon, CheckCircle, Circle, Edit2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ProvaQuestaoFormModal } from '@/components/simulados/ProvaQuestaoFormModal'
import { useApp } from '@/lib/context'

import { use } from 'react';

export default function SimuladoQuestoesPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const { id } = resolvedParams as { id: string };
  const searchParams = useSearchParams();
  const professorFiltro = searchParams.get('professor');
  const disciplinaFiltro = searchParams.get('disciplina');
  const [prova, setSimulado] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingQuestao, setEditingQuestao] = useState<any>(null)
  const { currentUserPerfil, currentUser, hydrated } = useApp()
  const isProfessor = currentUserPerfil === 'Professor'
  const [professorDisciplinas, setProfessorDisciplinas] = useState<string[]>([])

  const [requisicoesLimits, setRequisicoesLimits] = useState<any[]>([])

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    // 1. Get prova info
    const { data: sim } = await supabase.from('provas').select('*, simulados_bimestres(nome)').eq('id', id).single()
    if (sim) setSimulado(sim)

    // 2. Get prova requisicoes to know the discipline order and limits
    const { data: reqs } = await supabase
      .from('provas_requisicoes')
      .select('id_disciplina, id_professor, created_at, quantidade_questoes, simulados_disciplinas(nome)')
      .eq('id_prova', id)
      .order('created_at', { ascending: true })
    
    const disciplineOrder: string[] = []
    if (reqs) {
      setRequisicoesLimits(reqs)
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
      .from('provas_questoes')
      .select('*, simulados_disciplinas(nome), provas_alternativas(*)')
      .eq('id_prova', id)
      .order('ordem', { ascending: true })

    if (q) {
      // Sort array according to discipline order
      const sortedQ = q.sort((a, b) => {
        const indexA = disciplineOrder.indexOf(a.id_disciplina)
        const indexB = disciplineOrder.indexOf(b.id_disciplina)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
      
      // If filtered by professor/disciplina, apply filter
      let finalQ = sortedQ
      if (professorFiltro && disciplinaFiltro) {
        finalQ = finalQ.filter(questao => 
          questao.id_professor === professorFiltro && 
          questao.id_disciplina === disciplinaFiltro
        )
      } else if (isProfessor) {
        // If professor is looking at all questions (no filter in URL),
        // we show all questions of the prova but only allow editing of their own
      }
      
      setQuestoes(finalQ)
    }

    setLoading(false)
  }

  const canAddQuestion = () => {
    if (professorFiltro && disciplinaFiltro) {
      const req = requisicoesLimits.find(r => r.id_professor === professorFiltro && r.id_disciplina === disciplinaFiltro)
      if (req) {
        const limit = req.quantidade_questoes || 0
        const current = questoes.filter(q => q.id_professor === professorFiltro && q.id_disciplina === disciplinaFiltro).length
        return current < limit
      }
    } else if (isProfessor && currentUser) {
      let canAdd = false
      for (const d of professorDisciplinas) {
        const req = requisicoesLimits.find(r => r.id_professor === currentUser.id && r.id_disciplina === d)
        const limit = req?.quantidade_questoes || 0
        const current = questoes.filter(q => q.id_professor === currentUser.id && q.id_disciplina === d).length
        if (current < limit) {
          canAdd = true
          break
        }
      }
      return canAdd
    }
    return true
  }

  useEffect(() => {
    if (hydrated) {
      loadData()
    }
  }, [id, professorFiltro, disciplinaFiltro, hydrated, currentUser])

  const handleDeleteQuestao = async (questaoId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta questão? As alternativas também serão excluídas.')) return
    try {
      await supabase.from('provas_alternativas').delete().eq('id_questao', questaoId)
      await supabase.from('provas_questoes').delete().eq('id', questaoId)
      loadData()
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir questão.')
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>Carregando questões...</div>
  if (!prova) return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>Prova não encontrada.</div>

  // Calcula progresso da disciplina ativa
  let activeDiscNome = '';
  let activeCurrent = 0;
  let activeLimit = 0;
  
  if (professorFiltro && disciplinaFiltro) {
    const activeReq = requisicoesLimits.find(r => r.id_professor === professorFiltro && r.id_disciplina === disciplinaFiltro);
    if (activeReq) {
      activeCurrent = questoes.filter(q => q.id_professor === professorFiltro && q.id_disciplina === disciplinaFiltro).length;
      activeLimit = activeReq.quantidade_questoes;
      activeDiscNome = activeReq.simulados_disciplinas?.nome || 'Disciplina';
    }
  } else if (isProfessor && currentUser && professorDisciplinas.length === 1) {
    const activeReq = requisicoesLimits.find(r => r.id_professor === currentUser.id && r.id_disciplina === professorDisciplinas[0]);
    if (activeReq) {
      activeCurrent = questoes.filter(q => q.id_professor === currentUser.id && q.id_disciplina === professorDisciplinas[0]).length;
      activeLimit = activeReq.quantidade_questoes;
      activeDiscNome = activeReq.simulados_disciplinas?.nome || 'Disciplina';
    }
  }
  
  const showProgress = activeLimit > 0;
  const progressPercent = showProgress ? Math.min(100, Math.round((activeCurrent / activeLimit) * 100)) : 0;

  return (
    <div className="page-container" style={{ padding: '40px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="header-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ flex: 1 }}>
            <Link href="/provas/lista" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6', textDecoration: 'none', fontWeight: 600, marginBottom: 12 }}>
              <ArrowLeft size={16} /> Voltar para Lista
            </Link>
            <div className="title-progress-box" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 32 }}>
              <div>
                <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>{prova.titulo}</h1>
                <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>
                  {prova.simulados_bimestres?.nome} • {prova.data_aplicacao ? new Date(prova.data_aplicacao).toLocaleDateString('pt-BR') : 'Data não definida'}
                  {professorFiltro && disciplinaFiltro && (
                    <span style={{ marginLeft: 8, padding: '2px 8px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 4, fontWeight: 600 }}>Filtrado por Professor</span>
                  )}
                </p>
              </div>
              
              {showProgress && (
                <div className="progress-box" style={{ 
                  background: 'hsl(var(--bg-surface))', 
                  border: '1px solid hsl(var(--border-subtle))', 
                  borderRadius: 16, 
                  padding: '16px 20px',
                  minWidth: 280,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-secondary))' }}>
                      {activeDiscNome}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: progressPercent === 100 ? '#10b981' : '#3b82f6' }}>
                      {activeCurrent} / {activeLimit} <span style={{ fontSize: 12, opacity: 0.7 }}>({progressPercent}%)</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'hsl(var(--border-subtle))', borderRadius: 8, overflow: 'hidden' }}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{ 
                        height: '100%', 
                        background: progressPercent === 100 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                        borderRadius: 8
                      }} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="new-btn-container" style={{ marginLeft: 24, alignSelf: 'flex-start' }}>
            {(!isProfessor || professorDisciplinas.length > 0) && canAddQuestion() && (
              <button 
                onClick={() => { setEditingQuestao(null); setModalOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#3b82f6', color: 'white', padding: '12px 20px', borderRadius: 12, border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
              >
                <Plus size={18} /> Nova Questão
              </button>
            )}
          </div>
        </div>

        {/* Questões List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {questoes.length === 0 ? (
            <div className="empty-state" style={{ background: 'hsl(var(--bg-surface))', padding: 60, borderRadius: 20, textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))' }}>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, margin: 0 }}>Nenhuma questão cadastrada neste prova ainda.</p>
            </div>
          ) : (
            questoes.map((q, index) => (
              <div key={q.id} className="question-card" style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24 }}>
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

                {q.tipo_questao === 'multipla_escolha' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(q.provas_alternativas || []).sort((a: any, b: any) => a.letra.localeCompare(b.letra)).map((alt: any) => (
                      <div key={alt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: alt.eh_correta ? 'rgba(16,185,129,0.1)' : 'hsl(var(--bg-app))', border: `1px solid ${alt.eh_correta ? '#10b981' : 'hsl(var(--border-subtle))'}` }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: alt.eh_correta ? '#10b981' : 'rgba(100,116,139,0.2)', color: alt.eh_correta ? 'white' : 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                          {alt.letra}
                        </div>
                        <div 
                          style={{ color: alt.eh_correta ? '#10b981' : 'hsl(var(--text-primary))', fontSize: 14, fontWeight: alt.eh_correta ? 600 : 400 }}
                          dangerouslySetInnerHTML={{ __html: alt.texto }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ padding: '24px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px dashed hsl(var(--border-subtle))', textAlign: 'center' }}>
                      <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 14 }}>Questão Descritiva - Espaço para resposta do aluno no cartão/prova impresso.</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </motion.div>

      {modalOpen && (
        <ProvaQuestaoFormModal 
          provaId={id} 
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
      
      <style>{`
        @media (max-width: 768px) {
          .page-container { padding: 16px !important; }
          .header-box { flex-direction: column !important; align-items: stretch !important; gap: 16px; margin-bottom: 24px !important; }
          .title-progress-box { flex-direction: column !important; gap: 16px !important; }
          .page-title { font-size: 20px !important; line-height: 1.3 !important; }
          .progress-box { min-width: 100% !important; padding: 16px !important; margin-top: 8px; }
          .new-btn-container { margin-left: 0 !important; width: 100%; margin-top: 12px; }
          .new-btn-container button { width: 100%; justify-content: center; padding: 16px !important; font-size: 16px !important; }
          .empty-state { padding: 30px 16px !important; }
          .question-card { padding: 16px !important; }
        }
      `}</style>
    </div>
  )
}
