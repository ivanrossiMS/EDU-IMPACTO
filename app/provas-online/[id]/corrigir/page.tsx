'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileCheck2, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff,
  User, BookOpen, Sparkles, Send, RefreshCw, Check, X, ShieldAlert,
  ChevronRight, ChevronLeft, Sliders, MessageSquare, AlertTriangle,
  Award, Layers, ArrowUpRight, Scale, Calculator
} from 'lucide-react'
import { toast } from 'sonner'
import { HtmlContent } from '@/components/HtmlContent'
import { QuestaoProva } from '@/types/provas-online'

interface SubmissionItem {
  tentativaId: string
  alunoId: string
  alunoNome: string
  alunoMatricula: string
  turmaId: string
  entregueEm: string
  pontuacaoObjetiva?: number
  pontuacaoDissertativa?: number
  notaFinal?: number
  statusCorrecao: 'pendente' | 'parcial' | 'concluida'
  respostas: Record<string, any>
}

export default function CorrigirProvaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [prova, setProva] = useState<any>(null)
  const [questoesDissertativas, setQuestoesDissertativas] = useState<QuestaoProva[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [pendentesCount, setPendentesCount] = useState(0)

  // Modes & Toggles
  const [isAnonimo, setIsAnonimo] = useState(false)
  const [viewMode, setViewMode] = useState<'questao' | 'aluno'>('questao')

  // Selected for Question View
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('')

  // Selected for Student View
  const [selectedSubmissionIndex, setSelectedSubmissionIndex] = useState(0)

  // Grading form state: key = `${tentativaId}_${questaoId}` -> { nota, comentario, criteriosPontos }
  const [gradingState, setGradingState] = useState<Record<string, {
    nota: number
    comentario: string
    criteriosPontos?: Record<string, number>
    saving?: boolean
  }>>({})

  // Modals
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const [annulModalOpen, setAnnulModalOpen] = useState(false)
  const [annulQuestionId, setAnnulQuestionId] = useState('')
  const [annulMetodo, setAnnulMetodo] = useState<'pontuar_todos' | 'redistribuir'>('pontuar_todos')
  const [annulMotivo, setAnnulMotivo] = useState('')
  const [annulSimulation, setAnnulSimulation] = useState<any>(null)
  const [simulatingAnnul, setSimulatingAnnul] = useState(false)
  const [confirmingAnnul, setConfirmingAnnul] = useState(false)

  // Load Submissions
  const loadData = async (anon = isAnonimo) => {
    if (!id) return
    try {
      setLoading(true)
      const res = await fetch(`/api/provas-online/${id}/corrigir?anonimo=${anon}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Erro ao carregar dados de correção')

      setProva(data.prova)
      setQuestoesDissertativas(data.questoesDissertativas || [])
      setSubmissions(data.submissions || [])
      setPendentesCount(data.pendentesCorrecao || 0)

      if (data.questoesDissertativas && data.questoesDissertativas.length > 0 && !selectedQuestionId) {
        setSelectedQuestionId(data.questoesDissertativas[0].id)
      }

      // Initialize grading state
      const initialGrading: Record<string, any> = {}
      data.submissions?.forEach((sub: SubmissionItem) => {
        data.questoesDissertativas?.forEach((q: QuestaoProva) => {
          const resp = sub.respostas ? (sub.respostas[q.id] || (Array.isArray(sub.respostas) ? sub.respostas.find((r: any) => r.questaoId === q.id) : null)) : null
          const key = `${sub.tentativaId}_${q.id}`
          initialGrading[key] = {
            nota: resp?.pontosAtribuidos ?? resp?.nota ?? 0,
            comentario: resp?.comentarioCorrecao || resp?.comentario || '',
            criteriosPontos: resp?.criteriosPontos || {}
          }
        })
      })
      setGradingState(initialGrading)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao buscar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(isAnonimo)
  }, [id, isAnonimo])

  // Save Single Essay Grade
  const handleSaveGrade = async (tentativaId: string, questaoId: string) => {
    const key = `${tentativaId}_${questaoId}`
    const state = gradingState[key]
    if (!state) return

    setGradingState(prev => ({
      ...prev,
      [key]: { ...prev[key], saving: true }
    }))

    try {
      const res = await fetch(`/api/provas-online/${id}/corrigir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'salvar_correcao',
          tentativaId,
          questaoId,
          nota: Number(state.nota) || 0,
          comentario: state.comentario || '',
          criteriosPontos: state.criteriosPontos || {}
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar nota')

      toast.success('Nota salva com sucesso!')
      loadData(isAnonimo)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar correção')
    } finally {
      setGradingState(prev => ({
        ...prev,
        [key]: { ...prev[key], saving: false }
      }))
    }
  }

  // Publish Results Handler
  const handlePublishResults = async () => {
    setPublishing(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/corrigir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'publicar_resultados',
          publicarGabaritoENota: true
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao publicar resultados')

      toast.success('Resultados e gabarito publicados com sucesso para alunos e famílias!')
      setPublishModalOpen(false)
      loadData(isAnonimo)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setPublishing(false)
    }
  }

  // Question Annulment Simulation
  const handleSimulateAnnul = async () => {
    if (!annulQuestionId) {
      toast.error('Selecione a questão a ser anulada.')
      return
    }

    setSimulatingAnnul(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/anular-questao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questaoId: annulQuestionId,
          metodo: annulMetodo,
          justificativa: annulMotivo.trim() || 'Anulação administrativa por inconsistência ou recurso.',
          simulacao: true
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao simular anulação')

      setAnnulSimulation(data)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSimulatingAnnul(false)
    }
  }

  // Confirm Annulment
  const handleConfirmAnnul = async () => {
    if (!annulQuestionId) return
    setConfirmingAnnul(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/anular-questao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questaoId: annulQuestionId,
          metodo: annulMetodo,
          justificativa: annulMotivo.trim() || 'Anulação administrativa.',
          simulacao: false
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao efetivar anulação')

      toast.success('Questão anulada e notas de todos os alunos recalculadas!')
      setAnnulModalOpen(false)
      setAnnulSimulation(null)
      loadData(isAnonimo)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setConfirmingAnnul(false)
    }
  }

  const activeQuestion = useMemo(() => {
    return (prova?.questoes || []).find((q: QuestaoProva) => q.id === selectedQuestionId) || questoesDissertativas[0]
  }, [prova, selectedQuestionId, questoesDissertativas])

  const activeSubmission = submissions[selectedSubmissionIndex]

  if (loading && !prova) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-sm font-semibold text-slate-700">Carregando fila de correção...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. TOP HEADER & WORKFLOW BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/provas-online"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors mr-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              Fila de Correção & Devolutivas
            </span>
            <span className="text-xs text-slate-500">
              {submissions.length} entregas recebidas • {pendentesCount} correções pendentes
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{prova?.titulo}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Blind Grading (Modo Anônimo) Toggle */}
          <button
            type="button"
            onClick={() => setIsAnonimo(!isAnonimo)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: isAnonimo ? '1px solid #7dd3fc' : '1px solid #cbd5e1',
              background: isAnonimo ? '#f0f9ff' : '#ffffff',
              color: isAnonimo ? '#0369a1' : '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            {isAnonimo ? <EyeOff size={16} color="#0284c7" /> : <Eye size={16} color="#64748b" />}
            {isAnonimo ? 'Modo Anônimo Ativo' : 'Ativar Modo Anônimo'}
          </button>

          {/* Annul Question Button */}
          <button
            type="button"
            onClick={() => setAnnulModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <Scale size={16} color="#d97706" />
            Anular Questão
          </button>

          {/* Integrate to Gradebook / Diário Button */}
          <Link
            href={`/provas-online/${id}/relatorio`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <ArrowUpRight size={16} color="#0284c7" />
            Relatório & Notas
          </Link>

          {/* Publish Results Button */}
          <button
            type="button"
            onClick={() => setPublishModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 20px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.28)',
              transition: 'all 0.15s'
            }}
          >
            <Award size={16} color="#ffffff" />
            Publicar Gabarito & Notas
          </button>
        </div>
      </div>

      {/* 2. MODE SELECTOR (POR QUESTÃO vs POR ALUNO) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '10px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f1f5f9',
          padding: '3px',
          borderRadius: '10px',
          gap: '3px'
        }}>
          <button
            onClick={() => setViewMode('questao')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: viewMode === 'questao' ? 800 : 600,
              background: viewMode === 'questao' ? '#ffffff' : 'transparent',
              color: viewMode === 'questao' ? '#0284c7' : '#64748b',
              border: 'none',
              boxShadow: viewMode === 'questao' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Layers size={14} />
            Corrigir por Questão ({questoesDissertativas.length})
          </button>
          <button
            onClick={() => setViewMode('aluno')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: viewMode === 'aluno' ? 800 : 600,
              background: viewMode === 'aluno' ? '#ffffff' : 'transparent',
              color: viewMode === 'aluno' ? '#0284c7' : '#64748b',
              border: 'none',
              boxShadow: viewMode === 'aluno' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <User size={14} />
            Corrigir por Aluno ({submissions.length})
          </button>
        </div>

        {questoesDissertativas.length === 0 && (
          <div style={{ fontSize: '12px', color: '#047857', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={15} color="#059669" />
            Prova 100% objetiva. Todas as notas calculadas automaticamente!
          </div>
        )}
      </div>

      {/* 3. VIEW MODE A: CORRIGIR POR QUESTÃO (BATCH ESSAY GRADING) */}
      {viewMode === 'questao' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Question Selector Tabs */}
          {questoesDissertativas.length > 0 && (
            <div className="col-span-12 flex flex-wrap gap-2">
              {questoesDissertativas.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuestionId(q.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: activeQuestion?.id === q.id ? 800 : 600,
                    border: activeQuestion?.id === q.id ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                    background: activeQuestion?.id === q.id ? '#f0f9ff' : '#ffffff',
                    color: activeQuestion?.id === q.id ? '#0284c7' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <span>Dissertativa #{idx + 1}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>({(q.valorPontos || q.pontuacao || 0).toFixed(1)} pts)</span>
                </button>
              ))}
            </div>
          )}

          {/* Left Column: Question Details & Expected Answer (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              position: 'sticky',
              top: '80px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                Enunciado da Questão
              </span>
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                <HtmlContent html={activeQuestion?.enunciado || 'Nenhuma questão dissertativa selecionada.'} />
              </div>

              {/* Expected Answer (Gabarito do Professor) */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <CheckCircle2 size={14} color="#059669" />
                  Resposta Esperada (Guia do Corretor)
                </span>
                <p style={{ fontSize: '12px', color: '#166534', background: '#f0fdf4', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0', lineHeight: 1.5, margin: 0 }}>
                  {activeQuestion?.respostaEsperada || 'Não informada pelo autor da questão.'}
                </p>
              </div>

              {/* Rubrics Criteria Table */}
              {activeQuestion?.criteriosAvaliacao && activeQuestion.criteriosAvaliacao.length > 0 && (
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                    Grade de Critérios
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(activeQuestion.criteriosAvaliacao || []).map((crit: any) => (
                      <div
                        key={crit.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12px'
                        }}
                      >
                        <span style={{ color: '#334155' }}>{crit.descricao}</span>
                        <span style={{ color: '#0284c7', fontWeight: 800, fontFamily: 'monospace' }}>+{(crit.pesoPontos || crit.pontosMaximos || 0).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Student Responses Cards (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {submissions.length === 0 ? (
              <div style={{
                padding: '64px 24px',
                textAlign: 'center',
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #e2e8f0'
                }}>
                  <BookOpen size={28} color="#94a3b8" />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#334155' }}>
                  Nenhuma resposta entregue até o momento
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0, maxWidth: '340px' }}>
                  Assim que os estudantes concluírem suas tentativas e enviarem as avaliações, elas aparecerão aqui prontas para correção.
                </p>
              </div>
            ) : (
              submissions.map(sub => {
                const qid = activeQuestion?.id || ''
                const key = `${sub.tentativaId}_${qid}`
                const state = gradingState[key] || { nota: 0, comentario: '' }
                const resp = sub.respostas ? (sub.respostas[qid] || (Array.isArray(sub.respostas) ? sub.respostas.find((r: any) => r.questaoId === qid) : null)) : null
                const maxPoints = activeQuestion?.valorPontos || activeQuestion?.pontuacao || 10

                return (
                  <div
                    key={sub.tentativaId}
                    className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs hover:border-slate-300 transition-all"
                  >
                    {/* Student Info Bar */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs font-mono border border-slate-200">
                          {isAnonimo ? '#' : sub.alunoNome.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">
                            {sub.alunoNome}
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            Entregue em {new Date(sub.entregueEm || Date.now()).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      {/* Current saved status */}
                      {resp?.corrigidaEm ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Corrigida ({resp.pontosAtribuidos ?? resp.nota} pts)
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          Aguardando Nota
                        </span>
                      )}
                    </div>

                    {/* Student Written Response */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                        Resposta do Aluno:
                      </span>
                      {resp?.textoDissertativo || resp?.respostaTexto ? (
                        <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                          {resp.textoDissertativo || resp.respostaTexto}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Questão deixada em branco pelo aluno.</span>
                      )}
                    </div>

                    {/* Rubric evaluation sliders (if criteria configured) */}
                    {activeQuestion?.criteriosAvaliacao && activeQuestion.criteriosAvaliacao.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <span className="text-xs font-semibold text-slate-700 block">Pontuação por Critério:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(activeQuestion.criteriosAvaliacao || []).map((crit: any) => {
                            const maxP = crit.pesoPontos || crit.pontosMaximos || 1
                            const currentCritScore = state.criteriosPontos?.[crit.id] ?? maxP
                            return (
                              <div
                                key={crit.id}
                                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                              >
                                <span className="text-slate-700 truncate">{crit.descricao}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max={maxP}
                                    value={currentCritScore}
                                    onChange={e => {
                                      const val = parseFloat(e.target.value) || 0
                                      const nextCriterios = { ...(state.criteriosPontos || {}), [crit.id]: val }
                                      const sum = Object.values(nextCriterios).reduce<number>((acc, cur) => acc + Number(cur || 0), 0)
                                      setGradingState(prev => ({
                                        ...prev,
                                        [key]: {
                                          ...prev[key],
                                          criteriosPontos: nextCriterios,
                                          nota: Math.min(maxPoints, sum)
                                        }
                                      }))
                                    }}
                                    className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-mono text-sky-700 font-bold focus:outline-none focus:border-sky-500"
                                  />
                                  <span className="text-slate-400 font-mono">/ {maxP.toFixed(1)}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quick Points & Comment Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
                      {/* Score Input */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Nota Final do Item:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={maxPoints}
                          value={state.nota}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0
                            setGradingState(prev => ({
                              ...prev,
                              [key]: { ...prev[key], nota: Math.min(maxPoints, Math.max(0, val)) }
                            }))
                          }}
                          className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-2 text-center font-mono font-bold text-sky-700 text-sm focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-xs text-slate-400 font-mono">de {maxPoints.toFixed(1)} pts</span>
                      </div>

                      {/* Quick percentage pills */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setGradingState(prev => ({ ...prev, [key]: { ...prev[key], nota: 0 } }))}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-mono text-slate-600 hover:bg-slate-200"
                        >
                          0%
                        </button>
                        <button
                          type="button"
                          onClick={() => setGradingState(prev => ({ ...prev, [key]: { ...prev[key], nota: maxPoints / 2 } }))}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-mono text-slate-600 hover:bg-slate-200"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setGradingState(prev => ({ ...prev, [key]: { ...prev[key], nota: maxPoints } }))}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[11px] font-mono text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        >
                          100%
                        </button>
                      </div>

                      {/* Save Button */}
                      <button
                        type="button"
                        onClick={() => handleSaveGrade(sub.tentativaId, qid)}
                        disabled={state.saving}
                        className="sm:ml-auto px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                      >
                        {state.saving ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Salvar Nota
                      </button>
                    </div>

                    {/* Teacher Feedback Comment Field */}
                    <div>
                      <input
                        type="text"
                        value={state.comentario}
                        onChange={e => setGradingState(prev => ({
                          ...prev,
                          [key]: { ...prev[key], comentario: e.target.value }
                        }))}
                        placeholder="Adicionar feedback ou devolutiva pedagógica para o aluno..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* 4. VIEW MODE B: CORRIGIR POR ALUNO */}
      {viewMode === 'aluno' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Submissions list sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Selecione o Aluno:
            </h3>
            {submissions.map((sub, idx) => {
              const isSelected = idx === selectedSubmissionIndex
              return (
                <div
                  key={sub.tentativaId}
                  onClick={() => setSelectedSubmissionIndex(idx)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-200 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs font-mono border border-slate-200">
                      {isAnonimo ? `#${idx + 1}` : sub.alunoNome.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{sub.alunoNome}</h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Nota Total: {sub.notaFinal !== undefined ? sub.notaFinal.toFixed(1) : '--'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sub.statusCorrecao === 'concluida'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {sub.statusCorrecao === 'concluida' ? 'Corrigida' : 'Pendente'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Student Complete Exam View (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {activeSubmission ? (
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-6 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{activeSubmission.alunoNome}</h2>
                    <p className="text-xs text-slate-500">
                      Entregue em {new Date(activeSubmission.entregueEm || Date.now()).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">Nota Atual</span>
                    <span className="text-xl font-bold font-mono text-sky-700">
                      {activeSubmission.notaFinal !== undefined ? activeSubmission.notaFinal.toFixed(1) : '--'} / {prova?.valorTotal}
                    </span>
                  </div>
                </div>

                {/* Questions Breakdown */}
                <div className="space-y-6">
                  {(prova?.questoes || []).map((q: QuestaoProva, qIdx: number) => {
                    const resp = activeSubmission.respostas ? (activeSubmission.respostas[q.id] || (Array.isArray(activeSubmission.respostas) ? activeSubmission.respostas.find((r: any) => r.questaoId === q.id) : null)) : null
                    const isDissertativa = q.tipo === 'dissertativa'

                    return (
                      <div key={q.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 uppercase">
                            Questão {qIdx + 1} ({q.tipo.replace('_', ' ')})
                          </span>
                          <span className="text-xs font-mono font-bold text-sky-700">
                            {resp?.pontosAtribuidos ?? resp?.nota ?? 0} / {(q.valorPontos || q.pontuacao || 0).toFixed(1)} pts
                          </span>
                        </div>

                        <div className="text-xs text-slate-800">
                          <HtmlContent html={q.enunciado} />
                        </div>

                        {/* Student response summary */}
                        <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                          <span className="text-slate-400 font-medium block mb-1">Resposta do Estudante:</span>
                          <p className="text-slate-800">
                            {resp?.textoDissertativo || resp?.respostaTexto || (resp?.alternativaIdSelecionada ? `Alternativa selecionada: ${resp.alternativaIdSelecionada}` : 'Sem resposta preenchida.')}
                          </p>
                        </div>

                        {/* If dissertativa, allow quick inline score save */}
                        {isDissertativa && (
                          <div className="flex items-center gap-3 pt-2">
                            <span className="text-xs text-slate-600 font-medium">Atribuir Nota:</span>
                            <input
                              type="number"
                              step="0.5"
                              max={q.valorPontos || q.pontuacao || 10}
                              defaultValue={resp?.pontosAtribuidos ?? resp?.nota ?? 0}
                              onBlur={e => {
                                handleSaveGrade(activeSubmission.tentativaId, q.id)
                              }}
                              className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-mono text-sky-700 font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveGrade(activeSubmission.tentativaId, q.id)}
                              className="px-3 py-1 rounded-lg bg-sky-600 text-white font-bold text-xs cursor-pointer hover:bg-sky-700"
                            >
                              Salvar
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-center text-slate-400 py-12">Selecione uma entrega para visualizar.</p>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL: PUBLICAR RESULTADOS & GABARITO */}
      <AnimatePresence>
        {publishModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '480px',
                margin: '0 auto',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  background: '#f0f9ff',
                  color: '#0284c7',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #bae6fd',
                }}
              >
                <Award className="w-6 h-6" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">Publicar Gabarito e Notas</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Ao publicar, as notas calculadas e o gabarito oficial com justificativas ficarão visíveis para todos os alunos e responsáveis no portal.
                </p>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  textAlign: 'left',
                }}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Total de Entregas:</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">{submissions.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Dissertativas Pendentes:</span>
                  <span className={`font-bold font-mono text-sm ${pendentesCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {pendentesCount}
                  </span>
                </div>
              </div>

              {pendentesCount > 0 && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textAlign: 'left',
                  }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Atenção: Ainda existem questões dissertativas sem nota atribuída.</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPublishModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                  className="hover:bg-slate-200 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handlePublishResults}
                  disabled={publishing}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  className="hover:bg-sky-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {publishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                  Confirmar Publicação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODAL: ANULAR QUESTÃO (COM PRÉVIA E SIMULAÇÃO DE IMPACTO) */}
      <AnimatePresence>
        {annulModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '540px',
                maxHeight: '90vh',
                overflowY: 'auto',
                margin: '0 auto',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Anular Questão Pós-Aplicação</h3>
                  <p className="text-xs text-slate-500">Recálculo automático com auditoria de notas</p>
                </div>
              </div>

              {/* Select Question */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Questão a anular:</label>
                <select
                  value={annulQuestionId}
                  onChange={e => {
                    setAnnulQuestionId(e.target.value)
                    setAnnulSimulation(null)
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                >
                  <option value="">Selecione uma questão...</option>
                  {(prova?.questoes || []).map((q: QuestaoProva, idx: number) => (
                    <option key={q.id} value={q.id}>
                      Questão {idx + 1} ({(q.valorPontos || q.pontuacao || 0).toFixed(1)} pts) - {q.tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Method choice */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Política de Anulação:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAnnulMetodo('pontuar_todos')
                      setAnnulSimulation(null)
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      annulMetodo === 'pontuar_todos'
                        ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold block mb-1">Atribuir Acerto Geral</span>
                    <span className="text-[11px] text-slate-500">Todos os alunos recebem a pontuação integral da questão.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAnnulMetodo('redistribuir')
                      setAnnulSimulation(null)
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      annulMetodo === 'redistribuir'
                        ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold block mb-1">Redistribuir Pontos</span>
                    <span className="text-[11px] text-slate-500">O valor da questão é rateado proporcionalmente entre as demais.</span>
                  </button>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Justificativa da Anulação:</label>
                <textarea
                  rows={2}
                  value={annulMotivo}
                  onChange={e => setAnnulMotivo(e.target.value)}
                  placeholder="Ex: Duplicidade de gabarito ou enunciado com ambiguidade identificado pela banca..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Simulation Result Preview */}
              {annulSimulation ? (
                <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-800 font-semibold mb-1">
                    <Calculator className="w-4 h-4 text-amber-600" />
                    <span>Prévia do Impacto nas Notas:</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Média anterior da turma:</span>
                    <span className="font-mono">{annulSimulation.mediaAnterior?.toFixed(2) || '--'}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Nova média projetada:</span>
                    <span className="font-mono">{annulSimulation.novaMedia?.toFixed(2) || '--'}</span>
                  </div>
                  <div className="flex justify-between text-sky-700">
                    <span>Alunos impactados positivamente:</span>
                    <span className="font-mono font-bold">{annulSimulation.alunosBeneficiados || 0} alunos</span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSimulateAnnul}
                  disabled={simulatingAnnul || !annulQuestionId}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                >
                  {simulatingAnnul ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5 text-sky-600" />}
                  Simular Prévia do Impacto
                </button>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAnnulModalOpen(false)
                    setAnnulSimulation(null)
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAnnul}
                  disabled={confirmingAnnul || !annulQuestionId}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {confirmingAnnul ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Efetivar Anulação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
