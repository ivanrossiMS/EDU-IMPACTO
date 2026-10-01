'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileCheck2, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff,
  User, BookOpen, RefreshCw, Check, X, Award,
  ArrowUpRight, Scale, Calculator, Search, AlertTriangle,
  ChevronRight, HelpCircle, CheckSquare, MessageSquare, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { HtmlContent } from '@/components/HtmlContent'
import { QuestaoProva, AlternativaQuestao, ItemVerdadeiroFalso } from '@/types/provas-online'
import { cleanAlternativeText } from '@/lib/provas-online/textSanitizer'

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
  statusCorrecao: 'pendente' | 'parcial' | 'corrigida' | 'concluida'
  respostas: Record<string, any>
}

function getStudentQuestionResponse(sub: SubmissionItem | undefined, q: QuestaoProva | undefined, qIdx: number) {
  if (!sub || !sub.respostas || !q) return null
  const resps = sub.respostas
  if (resps[q.id]) return resps[q.id]
  if (resps[String(qIdx)]) return resps[String(qIdx)]
  if (Array.isArray(resps)) {
    return resps.find((r: any) => r?.questaoId === q.id) || resps[qIdx] || null
  }
  const vals = Object.values(resps)
  return vals.find((r: any) => r?.questaoId === q.id) || vals[qIdx] || null
}

// ─── Design tokens ──────────────────────────────────────────────────────────
const S = {
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  } as React.CSSProperties,
  pill: (color: string, bg: string, border: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 99,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: 11,
    fontWeight: 700,
  } as React.CSSProperties),
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    padding: '0 16px',
    borderRadius: 10,
    border: 'none',
    background: '#0284c7',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  } as React.CSSProperties,
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    padding: '0 14px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#334155',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    textDecoration: 'none',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  input: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    fontSize: 12,
    color: '#0f172a',
    outline: 'none',
    padding: '0 12px',
  } as React.CSSProperties,
}

// ─── GradingPanel Component (defined outside to avoid re-mounting) ───────────
interface GradingPanelProps {
  tentativaId: string
  questaoId: string
  maxPoints: number
  gradingState: Record<string, { nota: number; comentario: string; criteriosPontos?: Record<string, number>; saving?: boolean }>
  setGradingState: React.Dispatch<React.SetStateAction<Record<string, any>>>
  onSave: (tentativaId: string, questaoId: string) => void
}

function GradingPanel({
  tentativaId,
  questaoId,
  maxPoints,
  gradingState,
  setGradingState,
  onSave
}: GradingPanelProps) {
  const key = `${tentativaId}_${questaoId}`
  const state = gradingState[key] || { nota: 0, comentario: '' }

  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>Atribuir Nota:</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            step="0.5"
            min="0"
            max={maxPoints}
            value={state.nota ?? 0}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0
              setGradingState(prev => ({
                ...prev,
                [key]: { ...prev[key], nota: Math.min(maxPoints, Math.max(0, val)) }
              }))
            }}
            style={{ ...S.input, width: 70, height: 34, textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, color: '#0369a1', fontSize: 13 }}
          />
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>/ {maxPoints.toFixed(1)} pts</span>
        </div>

        {/* Quick percentage buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 50, 100].map(pct => (
            <button
              key={pct}
              type="button"
              onClick={() => setGradingState(prev => ({
                ...prev,
                [key]: { ...prev[key], nota: (maxPoints * pct) / 100 }
              }))}
              style={{
                height: 28,
                padding: '0 8px',
                borderRadius: 7,
                border: `1px solid ${pct === 100 ? '#a7f3d0' : '#e2e8f0'}`,
                background: pct === 100 ? '#ecfdf5' : '#ffffff',
                color: pct === 100 ? '#065f46' : '#64748b',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'monospace',
                cursor: 'pointer'
              }}
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={() => onSave(tentativaId, questaoId)}
          disabled={state.saving}
          style={{
            ...S.btnPrimary,
            height: 34,
            marginLeft: 'auto',
            opacity: state.saving ? 0.6 : 1,
            cursor: state.saving ? 'not-allowed' : 'pointer'
          }}
        >
          {state.saving ? <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> : <Check style={{ width: 13, height: 13 }} />}
          Salvar Nota
        </button>
      </div>

      <input
        type="text"
        value={state.comentario || ''}
        onChange={e => setGradingState(prev => ({
          ...prev,
          [key]: { ...prev[key], comentario: e.target.value }
        }))}
        placeholder="Feedback ou devolutiva pedagógica para o aluno (opcional)..."
        style={{ ...S.input, height: 34, width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  )
}

export default function CorrigirProvaPage() {
  const params = useParams()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [prova, setProva] = useState<any>(null)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [pendentesCount, setPendentesCount] = useState(0)

  const [isAnonimo, setIsAnonimo] = useState(false)
  const [selectedSubmissionIndex, setSelectedSubmissionIndex] = useState(0)
  const [studentSearch, setStudentSearch] = useState('')

  const [gradingState, setGradingState] = useState<Record<string, {
    nota: number; comentario: string; criteriosPontos?: Record<string, number>; saving?: boolean
  }>>({})

  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const [annulModalOpen, setAnnulModalOpen] = useState(false)
  const [annulQuestionId, setAnnulQuestionId] = useState('')
  const [annulMetodo, setAnnulMetodo] = useState<'pontuar_todos' | 'redistribuir'>('pontuar_todos')
  const [annulMotivo, setAnnulMotivo] = useState('')
  const [annulSimulation, setAnnulSimulation] = useState<any>(null)
  const [simulatingAnnul, setSimulatingAnnul] = useState(false)
  const [confirmingAnnul, setConfirmingAnnul] = useState(false)
  const [repairing, setRepairing] = useState(false)

  const handleRepairTextos = async () => {
    setRepairing(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/corrigir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'reparar_textos' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao higienizar')
      toast.success(data.message || 'Textos e alternativas higienizados com sucesso!')
      await loadData(isAnonimo)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao higienizar textos')
    } finally {
      setRepairing(false)
    }
  }

  const loadData = async (anon = isAnonimo) => {
    if (!id) return
    try {
      setLoading(true)
      const res = await fetch(`/api/provas-online/${id}/corrigir?anonimo=${anon}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar dados de correção')

      setProva(data.prova)
      setSubmissions(data.submissions || [])
      setPendentesCount(data.pendentesCorrecao || 0)

      const allQuestoes: QuestaoProva[] = data.prova?.questoes || []

      // Initialize grading state from submissions answers
      const initialGrading: Record<string, any> = {}
      data.submissions?.forEach((sub: SubmissionItem) => {
        allQuestoes.forEach((q: QuestaoProva, qIdx: number) => {
          if (q.tipo === 'dissertativa') {
            const resp = getStudentQuestionResponse(sub, q, qIdx)
            const key = `${sub.tentativaId}_${q.id}`
            const currentPoints = resp?.pontuacaoObtida ?? resp?.pontosAtribuidos ?? resp?.nota ?? 0
            initialGrading[key] = {
              nota: Number(currentPoints),
              comentario: resp?.comentarioProfessor ?? resp?.comentarioCorrecao ?? resp?.comentario ?? '',
              criteriosPontos: resp?.correcaoCriterios ?? resp?.criteriosPontos ?? {}
            }
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

  useEffect(() => { loadData(isAnonimo) }, [id, isAnonimo])

  // Save single grade with instant optimistic UI update
  const handleSaveGrade = async (tentativaId: string, questaoId: string) => {
    const key = `${tentativaId}_${questaoId}`
    const state = gradingState[key]
    if (!state) return

    setGradingState(prev => ({ ...prev, [key]: { ...prev[key], saving: true } }))
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

      // Optimistic update on submissions state
      setSubmissions(prev => prev.map(sub => {
        if (sub.tentativaId !== tentativaId) return sub
        const updatedRespostas = { ...(sub.respostas || {}) }
        if (updatedRespostas[questaoId]) {
          updatedRespostas[questaoId] = {
            ...updatedRespostas[questaoId],
            corrigida: true,
            corrigidoEm: new Date().toISOString(),
            pontuacaoObtida: Number(state.nota) || 0
          }
        }
        return {
          ...sub,
          statusCorrecao: (data.statusCorrecao || 'corrigida') as any,
          pontuacaoDissertativa: data.pontuacaoDissertativa ?? sub.pontuacaoDissertativa,
          notaFinal: data.notaFinal ?? sub.notaFinal,
          respostas: updatedRespostas
        }
      }))

      // Recalculate pending count
      setPendentesCount(prev => Math.max(0, prev - 1))
      loadData(isAnonimo)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar nota')
    } finally {
      setGradingState(prev => ({ ...prev, [key]: { ...prev[key], saving: false } }))
    }
  }

  // Publish results officially
  const handlePublishResults = async () => {
    setPublishing(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/corrigir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'publicar_resultados',
          publicarGabaritoENota: true,
          grades: gradingState
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao publicar')

      toast.success('Gabarito e notas publicados com sucesso!')
      setPublishModalOpen(false)

      // Optimistically clear pendentes and set all submissions to corrigida
      setPendentesCount(0)
      setSubmissions(prev => prev.map(s => ({ ...s, statusCorrecao: 'corrigida' })))
      if (prova) {
        setProva((prev: any) => ({ ...prev, status: 'publicada' }))
      }

      loadData(isAnonimo)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  const handleSimulateAnnul = async () => {
    if (!annulQuestionId) return
    setSimulatingAnnul(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/corrigir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'simular_anulacao', questaoId: annulQuestionId, metodo: annulMetodo })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha na simulação')
      setAnnulSimulation(data.simulacao || data)
    } catch (err: any) { toast.error(err.message) }
    finally { setSimulatingAnnul(false) }
  }

  const handleConfirmAnnul = async () => {
    if (!annulQuestionId || !annulMotivo.trim()) { toast.error('Informe a justificativa.'); return }
    setConfirmingAnnul(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/corrigir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'anular_questao', questaoId: annulQuestionId, metodo: annulMetodo, motivo: annulMotivo.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao anular questão')
      toast.success(data.message || 'Questão anulada e notas recalculadas!')
      setAnnulModalOpen(false)
      setAnnulSimulation(null)
      loadData(isAnonimo)
    } catch (err: any) { toast.error(err.message) }
    finally { setConfirmingAnnul(false) }
  }

  // All questions list
  const allQuestoes: QuestaoProva[] = prova?.questoes || []
  const questoesDissertativas = allQuestoes.filter(q => q.tipo === 'dissertativa')

  const activeSubmission = submissions[selectedSubmissionIndex]

  const filteredSubmissions = useMemo(() => {
    if (!studentSearch.trim()) return submissions
    const q = studentSearch.toLowerCase()
    return submissions.filter(s => s.alunoNome.toLowerCase().includes(q) || s.alunoMatricula.toLowerCase().includes(q))
  }, [submissions, studentSearch])

  // Helper to format question type nicely
  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'multipla_escolha': return 'Múltipla Escolha'
      case 'verdadeiro_falso': return 'Verdadeiro ou Falso'
      case 'multipla_selecao': return 'Múltipla Seleção'
      case 'dissertativa': return 'Dissertativa'
      default: return tipo
    }
  }

  // Modal Backdrop wrapper
  const ModalBackdrop = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
    >
      {children}
    </div>
  )

  const ModalCard = ({ children, maxWidth = 480 }: { children: React.ReactNode; maxWidth?: number }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      style={{ width: '100%', maxWidth, background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}
    >
      {children}
    </motion.div>
  )

  if (loading && !prova) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#f8fafc' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: '#e0f2fe', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw style={{ width: 20, height: 20, color: '#0284c7' }} className="animate-spin" />
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Carregando Central de Correção...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px', minHeight: '100vh', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── HEADER CARD ─────────────────────────────────────────────────── */}
        <div style={S.card}>
          {/* Breadcrumb + Status badges */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <Link
              href="/provas-online"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              <ArrowLeft style={{ width: 13, height: 13 }} /> Provas Online
            </Link>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={S.pill('#0369a1', '#e0f2fe', '#bae6fd')}>Central de Correção</span>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>• {submissions.length} entrega(s)</span>

            {/* Dynamic Status Pill */}
            {prova?.status === 'publicada' ? (
              <span style={S.pill('#5b21b6', '#ede9fe', '#ddd6fe')}>
                <Award style={{ width: 11, height: 11 }} /> Gabarito e Notas Publicados
              </span>
            ) : pendentesCount === 0 ? (
              <span style={S.pill('#065f46', '#d1fae5', '#a7f3d0')}>
                <CheckCircle2 style={{ width: 11, height: 11 }} /> Todas as Correções Concluídas
              </span>
            ) : (
              <span style={S.pill('#92400e', '#fef3c7', '#fde68a')}>
                <AlertCircle style={{ width: 11, height: 11 }} /> {pendentesCount} dissertativa(s) pendente(s)
              </span>
            )}
          </div>

          {/* Title and Top Actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0369a1' }}>
                  {prova?.disciplina || 'Geral'} {prova?.bimestre ? `• ${prova.bimestre}º Bimestre` : ''}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>•</span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  {allQuestoes.length} questões ({prova?.valorTotal || 10} pts totais)
                </span>
              </div>
              <h1
                style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
                title={prova?.titulo || ''}
              >
                {prova?.titulo || 'Carregando avaliação...'}
              </h1>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsAnonimo(!isAnonimo)}
                style={{
                  ...S.btnSecondary,
                  background: isAnonimo ? '#e0f2fe' : '#ffffff',
                  borderColor: isAnonimo ? '#bae6fd' : '#e2e8f0',
                  color: isAnonimo ? '#0369a1' : '#334155'
                }}
              >
                {isAnonimo ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                {isAnonimo ? 'Anônimo Ativo' : 'Modo Anônimo'}
              </button>

              <button
                type="button"
                onClick={handleRepairTextos}
                disabled={repairing}
                style={S.btnSecondary}
                title="Higienizar enunciados e alternativas coladas de Word/Office"
              >
                <Sparkles style={{ width: 13, height: 13, color: '#0284c7' }} />
                {repairing ? 'Higienizando...' : 'Higienizar Textos'}
              </button>

              <button
                type="button"
                onClick={() => setAnnulModalOpen(true)}
                style={S.btnSecondary}
              >
                <Scale style={{ width: 13, height: 13, color: '#b45309' }} /> Anular Questão
              </button>

              <Link
                href={`/provas-online/${id}/relatorio`}
                style={S.btnSecondary}
              >
                <ArrowUpRight style={{ width: 13, height: 13, color: '#64748b' }} /> Relatório
              </Link>

              <button
                type="button"
                onClick={() => setPublishModalOpen(true)}
                style={{ ...S.btnPrimary, background: '#0284c7' }}
              >
                <Award style={{ width: 14, height: 14 }} /> Publicar Gabarito & Notas
              </button>
            </div>
          </div>

          {/* Header Sub-bar: Visão por Estudante */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 10, background: '#e0f2fe', color: '#0369a1', fontSize: 13, fontWeight: 700, border: '1px solid #bae6fd' }}>
              <User style={{ width: 15, height: 15, color: '#0284c7' }} />
              Visão por Estudante ({submissions.length})
            </div>

            {questoesDissertativas.length === 0 ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 12, fontWeight: 600 }}>
                <CheckCircle2 style={{ width: 14, height: 14, color: '#16a34a' }} />
                Prova 100% objetiva — notas calculadas automaticamente pelo sistema.
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {questoesDissertativas.length} questão(ões) dissertativa(s) exigem avaliação do professor.
              </div>
            )}
          </div>
        </div>

        {/* ── VISÃO POR ESTUDANTE ────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 4fr) minmax(0, 9fr)', gap: 20, alignItems: 'start' }}>

            {/* Left: Students Navigation List */}
            <div style={{ position: 'sticky', top: 24 }}>
              <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Estudantes ({submissions.length})
                  </h3>
                </div>

                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Buscar estudante..."
                    style={{ ...S.input, width: '100%', height: 34, paddingLeft: 32, boxSizing: 'border-box' }}
                  />
                </div>

                {/* List of Students */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto', paddingRight: 2 }}>
                  {filteredSubmissions.map((sub, idx) => {
                    const isSelected = sub.tentativaId === activeSubmission?.tentativaId
                    const isCorrigida = sub.statusCorrecao === 'corrigida' || sub.statusCorrecao === 'concluida'
                    const isParcial = sub.statusCorrecao === 'parcial'

                    return (
                      <div
                        key={sub.tentativaId}
                        onClick={() => {
                          const originalIdx = submissions.findIndex(s => s.tentativaId === sub.tentativaId)
                          if (originalIdx >= 0) setSelectedSubmissionIndex(originalIdx)
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: `1px solid ${isSelected ? '#0284c7' : '#e2e8f0'}`,
                          background: isSelected ? '#e0f2fe' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          boxShadow: isSelected ? '0 0 0 2px rgba(2, 132, 199, 0.2)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: isSelected ? '#0284c7' : '#f1f5f9',
                            border: `1px solid ${isSelected ? '#0284c7' : '#e2e8f0'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 11,
                            color: isSelected ? '#ffffff' : '#475569',
                            fontFamily: 'monospace',
                            flexShrink: 0
                          }}>
                            {isAnonimo ? `#${idx + 1}` : sub.alunoNome.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isAnonimo ? `Estudante #${idx + 1}` : sub.alunoNome}
                            </h4>
                            <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', display: 'block' }}>
                              Nota: <strong style={{ color: '#0f172a' }}>{sub.notaFinal !== undefined ? sub.notaFinal.toFixed(1) : '--'}</strong> pts
                            </span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span style={{
                          ...S.pill(
                            isCorrigida ? '#065f46' : isParcial ? '#92400e' : '#991b1b',
                            isCorrigida ? '#d1fae5' : isParcial ? '#fef3c7' : '#fee2e2',
                            isCorrigida ? '#a7f3d0' : isParcial ? '#fde68a' : '#fca5a5'
                          ),
                          fontSize: 10,
                          flexShrink: 0
                        }}>
                          {isCorrigida ? 'Corrigida' : isParcial ? 'Parcial' : 'Pendente'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right: Full Exam Breakdown for Selected Student */}
            <div>
              {activeSubmission ? (
                <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Student Header Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingBottom: 16, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                        {isAnonimo ? 'Estudante Selecionado' : activeSubmission.alunoNome}
                      </h2>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                        Entregue em {new Date(activeSubmission.entregueEm || Date.now()).toLocaleString('pt-BR')} • Matrícula: {activeSubmission.alunoMatricula || 'S/M'}
                      </p>
                    </div>

                    <div style={{ padding: '10px 18px', borderRadius: 14, background: '#e0f2fe', border: '1px solid #bae6fd', flexShrink: 0, textAlign: 'right' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#0369a1', display: 'block' }}>
                        Nota Calculada
                      </span>
                      <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', color: '#0f172a' }}>
                        {activeSubmission.notaFinal !== undefined ? activeSubmission.notaFinal.toFixed(1) : '--'}
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}> / {prova?.valorTotal || 10}</span>
                      </span>
                    </div>
                  </div>

                  {/* Quick question jump bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginRight: 4 }}>Pular para:</span>
                    {allQuestoes.map((q, idx) => (
                      <a
                        key={q.id}
                        href={`#q-${q.id}`}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          color: '#0369a1',
                          fontSize: 11,
                          fontWeight: 700,
                          textDecoration: 'none'
                        }}
                      >
                        Q{idx + 1} ({q.tipo === 'dissertativa' ? 'Diss.' : 'Obj.'})
                      </a>
                    ))}
                  </div>

                  {/* Questions List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {allQuestoes.map((q: QuestaoProva, qIdx: number) => {
                      const resp = getStudentQuestionResponse(activeSubmission, q, qIdx)
                      const isDissertativa = q.tipo === 'dissertativa'
                      const maxPoints = Number(q.valorPontos || q.pontuacao || 10)
                      const scoreObtained = Number(resp?.pontuacaoObtida ?? resp?.pontosAtribuidos ?? resp?.nota ?? 0)

                      return (
                        <div
                          key={q.id}
                          id={`q-${q.id}`}
                          style={{
                            padding: '18px 20px',
                            borderRadius: 14,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14
                          }}
                        >
                          {/* Question header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 24, height: 24, borderRadius: 8, background: '#e0f2fe', color: '#0369a1', fontWeight: 900, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', flexShrink: 0 }}>
                                {qIdx + 1}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Questão {qIdx + 1} · {getTipoLabel(q.tipo)}
                              </span>
                            </div>
                            <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 800, color: '#0369a1', background: '#e0f2fe', padding: '3px 10px', borderRadius: 8, flexShrink: 0 }}>
                              {scoreObtained.toFixed(1)} / {maxPoints.toFixed(1)} pts
                            </span>
                          </div>

                          {/* Enunciado */}
                          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#ffffff', border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>
                            <HtmlContent html={q.enunciado} />
                          </div>

                          {/* Multiple Choice */}
                          {q.tipo === 'multipla_escolha' && (() => {
                            const selectedAltId = resp?.alternativaIdSelecionada || resp?.respostaOpcaoId
                            const correctAlt = (q.alternativas || []).find(a => a.correta)
                            const isCorrect = Boolean(selectedAltId && correctAlt && selectedAltId === correctAlt.id)

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Alternativas:</span>
                                  {selectedAltId ? (
                                    isCorrect
                                      ? <span style={S.pill('#065f46', '#d1fae5', '#a7f3d0')}><CheckCircle2 style={{ width: 11, height: 11 }} /> Acertou (+{maxPoints.toFixed(1)} pts)</span>
                                      : <span style={S.pill('#991b1b', '#fee2e2', '#fca5a5')}><X style={{ width: 11, height: 11 }} /> Errou (0.0 pts)</span>
                                  ) : <span style={S.pill('#92400e', '#fef3c7', '#fde68a')}>Não respondida</span>}
                                </div>
                                {(q.alternativas || []).map(alt => {
                                  const isSelected = alt.id === selectedAltId
                                  const isThisCorrect = alt.correta
                                  let bg = '#ffffff', border = '#e2e8f0', color = '#475569'
                                  if (isSelected && isThisCorrect) { bg = '#f0fdf4'; border = '#86efac'; color = '#166534' }
                                  else if (isSelected && !isThisCorrect) { bg = '#fff1f2'; border = '#fca5a5'; color = '#9f1239' }
                                  else if (!isSelected && isThisCorrect) { bg = '#f0fdf4'; border = '#86efac'; color = '#166534' }

                                  return (
                                    <div key={alt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderRadius: 10, border: `1px solid ${border}`, background: bg, fontSize: 12, color }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
                                        <span style={{ width: 22, height: 22, borderRadius: 6, background: isSelected ? '#1e293b' : '#f1f5f9', color: isSelected ? '#ffffff' : '#475569', fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                          {alt.letra}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', lineHeight: 1.5 }}>
                                          <HtmlContent html={cleanAlternativeText(alt.texto)} />
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                        {isSelected && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: '#e2e8f0', color: '#475569' }}>Marcada</span>}
                                        {isThisCorrect && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: '#bbf7d0', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check style={{ width: 10, height: 10 }} /> Gabarito</span>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}

                          {/* Verdadeiro ou Falso */}
                          {q.tipo === 'verdadeiro_falso' && (() => {
                            const vfAnswers: Record<string, boolean> = {}
                            if (resp?.respostaVF && typeof resp.respostaVF === 'object') Object.assign(vfAnswers, resp.respostaVF)
                            if (resp?.itensVouF) {
                              if (Array.isArray(resp.itensVouF)) {
                                resp.itensVouF.forEach((it: any) => {
                                  if (it?.id) { const val = it.respostaAluno !== undefined ? it.respostaAluno : it.valor !== undefined ? it.valor : it.resposta; if (val !== undefined) vfAnswers[it.id] = Boolean(val) }
                                })
                              } else if (typeof resp.itensVouF === 'object') {
                                Object.entries(resp.itensVouF).forEach(([k, v]: [string, any]) => {
                                  const val = v?.respostaAluno !== undefined ? v.respostaAluno : v?.valor !== undefined ? v.valor : v; if (val !== undefined) vfAnswers[k] = Boolean(val)
                                })
                              }
                            }

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Itens (V / F):</span>
                                {(q.itensVF || []).map((item, idx) => {
                                  const studentVal = vfAnswers[item.id]
                                  const hasAnswered = studentVal !== undefined
                                  const isCorrect = hasAnswered && studentVal === item.correta
                                  return (
                                    <div key={item.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderRadius: 10, border: `1px solid ${!hasAnswered ? '#e2e8f0' : isCorrect ? '#86efac' : '#fca5a5'}`, background: !hasAnswered ? '#ffffff' : isCorrect ? '#f0fdf4' : '#fff1f2', fontSize: 12 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, color: '#64748b' }}>#{idx + 1}</span>
                                        <span style={{ color: '#475569' }}>{item.afirmacao}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                        {hasAnswered && (
                                          <span style={{ fontWeight: 800, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 6, background: isCorrect ? '#16a34a' : '#dc2626', color: '#ffffff', fontSize: 11 }}>
                                            {studentVal ? 'V' : 'F'} {isCorrect ? '✓' : '✗'}
                                          </span>
                                        )}
                                        <span style={{ fontSize: 11, color: '#64748b' }}>Gabarito: <strong>{item.correta ? 'V' : 'F'}</strong></span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}

                          {/* Dissertativa: Written response + Scoring Form */}
                          {isDissertativa && (() => {
                            const studentText = resp?.textoDissertativo || resp?.respostaTexto || resp?.respostaDissertativa

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: 6 }}>
                                    Resposta do Estudante:
                                  </span>
                                  {studentText?.trim() ? (
                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: '#ffffff', border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                      {studentText}
                                    </div>
                                  ) : (
                                    <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fffbeb', border: '1px dashed #fde68a', fontSize: 12, color: '#92400e', fontStyle: 'italic' }}>
                                      Questão deixada em branco pelo aluno.
                                    </div>
                                  )}
                                </div>

                                {q.respostaEsperada && (
                                  <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
                                    <span style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, fontSize: 10, textTransform: 'uppercase' }}>
                                      <CheckCircle2 style={{ width: 12, height: 12 }} /> Resposta Esperada de Referência:
                                    </span>
                                    <p style={{ margin: 0, lineHeight: 1.6 }}>{q.respostaEsperada}</p>
                                  </div>
                                )}

                                {/* Interactive Grading Panel */}
                                <GradingPanel
                                  tentativaId={activeSubmission.tentativaId}
                                  questaoId={q.id}
                                  maxPoints={maxPoints}
                                  gradingState={gradingState}
                                  setGradingState={setGradingState}
                                  onSave={handleSaveGrade}
                                />
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '64px 24px', textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, color: '#94a3b8', fontSize: 12 }}>
                  Selecione um estudante na lista ao lado para visualizar a prova completa.
                </div>
              )}
            </div>
          </div>

      </div>

      {/* ── MODAL: PUBLICAR RESULTADOS ─────────────────────────────────────── */}
      <AnimatePresence>
        {publishModalOpen && (
          <ModalBackdrop onClose={() => setPublishModalOpen(false)}>
            <ModalCard maxWidth={460}>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: '#e0f2fe', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award style={{ width: 26, height: 26, color: '#0284c7' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>Publicar Gabarito e Notas</h2>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                    Ao publicar, as notas calculadas e o gabarito oficial ficarão imediatamente visíveis para todos os estudantes e responsáveis no portal.
                  </p>
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                  <span>Total de Entregas Recebidas:</span>
                  <strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#0f172a' }}>{submissions.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                  <span>Dissertativas Pendentes:</span>
                  <strong style={{ fontFamily: 'monospace', fontSize: 14, color: pendentesCount > 0 ? '#b45309' : '#059669' }}>
                    {pendentesCount}
                  </strong>
                </div>
              </div>

              {pendentesCount > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, color: '#b45309' }} />
                  <span>Atenção: A publicação consolidará as notas pendentes e marcará todas as entregas como corrigidas.</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setPublishModalOpen(false)}
                  style={{ ...S.btnSecondary, flex: 1, justifyContent: 'center' }}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handlePublishResults}
                  disabled={publishing}
                  style={{ ...S.btnPrimary, flex: 1, justifyContent: 'center', opacity: publishing ? 0.6 : 1 }}
                >
                  {publishing ? <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" /> : <Award style={{ width: 14, height: 14 }} />}
                  Confirmar Publicação
                </button>
              </div>
            </ModalCard>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* ── MODAL: ANULAR QUESTÃO ──────────────────────────────────────────── */}
      <AnimatePresence>
        {annulModalOpen && (
          <ModalBackdrop onClose={() => { setAnnulModalOpen(false); setAnnulSimulation(null) }}>
            <ModalCard maxWidth={520}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Scale style={{ width: 20, height: 20, color: '#b45309' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>Anular Questão Pós-Aplicação</h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Recálculo automático e auditoria pedagógica</p>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Questão a anular:
                </label>
                <select
                  value={annulQuestionId}
                  onChange={e => { setAnnulQuestionId(e.target.value); setAnnulSimulation(null) }}
                  style={{ ...S.input, width: '100%', height: 38, boxSizing: 'border-box' }}
                >
                  <option value="">Selecione uma questão...</option>
                  {allQuestoes.map((q: QuestaoProva, idx: number) => (
                    <option key={q.id} value={q.id}>
                      Questão {idx + 1} ({(q.valorPontos || q.pontuacao || 0).toFixed(1)} pts) - {getTipoLabel(q.tipo)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  Política de Anulação:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { id: 'pontuar_todos', title: 'Atribuir Acerto Geral', desc: 'Todos os alunos recebem a pontuação integral da questão.' },
                    { id: 'redistribuir', title: 'Redistribuir Pontos', desc: 'O valor da questão é rateado proporcionalmente entre as demais.' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { setAnnulMetodo(opt.id as any); setAnnulSimulation(null) }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1px solid ${annulMetodo === opt.id ? '#fde68a' : '#e2e8f0'}`,
                        background: annulMetodo === opt.id ? '#fffbeb' : '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: annulMetodo === opt.id ? '0 0 0 2px #fde68a' : 'none'
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', display: 'block', marginBottom: 4 }}>{opt.title}</span>
                      <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, display: 'block' }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Justificativa (Auditoria):
                </label>
                <textarea
                  rows={2}
                  value={annulMotivo}
                  onChange={e => setAnnulMotivo(e.target.value)}
                  placeholder="Ex: Duplicidade de gabarito ou ambiguidade identificada no enunciado..."
                  style={{ ...S.input, width: '100%', padding: '10px 12px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              {annulSimulation ? (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#92400e' }}>
                    <Calculator style={{ width: 14, height: 14, color: '#b45309' }} /> Prévia do Impacto nas Notas:
                  </div>
                  {[
                    { label: 'Média anterior', val: annulSimulation.mediaAnterior?.toFixed(2) || '--', color: '#475569' },
                    { label: 'Nova média projetada', val: annulSimulation.novaMedia?.toFixed(2) || '--', color: '#059669' },
                    { label: 'Alunos beneficiados', val: `${annulSimulation.alunosBeneficiados || 0} estudantes`, color: '#0369a1' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: row.color }}>
                      <span>{row.label}:</span>
                      <strong style={{ fontFamily: 'monospace' }}>{row.val}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSimulateAnnul}
                  disabled={simulatingAnnul || !annulQuestionId}
                  style={{ ...S.btnSecondary, width: '100%', justifyContent: 'center', height: 38, opacity: (simulatingAnnul || !annulQuestionId) ? 0.5 : 1 }}
                >
                  {simulatingAnnul ? <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> : <Calculator style={{ width: 13, height: 13, color: '#0284c7' }} />}
                  Simular Prévia do Impacto
                </button>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => { setAnnulModalOpen(false); setAnnulSimulation(null) }}
                  style={S.btnSecondary}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAnnul}
                  disabled={confirmingAnnul || !annulQuestionId}
                  style={{ ...S.btnPrimary, background: '#b45309', opacity: (confirmingAnnul || !annulQuestionId) ? 0.5 : 1 }}
                >
                  {confirmingAnnul ? <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> : <Check style={{ width: 13, height: 13 }} />}
                  Efetivar Anulação
                </button>
              </div>
            </ModalCard>
          </ModalBackdrop>
        )}
      </AnimatePresence>
    </div>
  )
}
