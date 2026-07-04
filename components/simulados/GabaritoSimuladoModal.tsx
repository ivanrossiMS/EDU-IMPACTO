'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Printer, CheckSquare, Layers, Calendar, Users, FileText,
  Upload, Camera, ScanLine, User, Trophy, AlertCircle, ChevronDown,
  ChevronUp, Loader2, CheckCircle, XCircle, BarChart3, BookOpen, Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface GabaritoSimuladoModalProps {
  simuladoUploadId: string
  onClose: () => void
}

interface Correcao {
  id: string
  nome_aluno: string
  total_questoes: number
  total_acertos: number
  percentual_acerto: number
  respostas_aluno: { numero: number; resposta: string | null }[]
  gabarito_oficial: { numero: number; resposta: string }[]
  created_at: string
}

export function GabaritoSimuladoModal({ simuladoUploadId, onClose }: GabaritoSimuladoModalProps) {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [simulado, setSimulado] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'gabarito' | 'correcoes'>('gabarito')

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [nomeAluno, setNomeAluno] = useState('')
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [imagemBase64, setImagemBase64] = useState<string | null>(null)
  const [imagemMime, setImagemMime] = useState<string>('image/jpeg')
  const [processando, setProcessando] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Corrections list
  const [correcoes, setCorrecoes] = useState<Correcao[]>([])
  const [loadingCorrecoes, setLoadingCorrecoes] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: p, error } = await (supabase as any).from('simulados_upload').select('*').eq('id', simuladoUploadId).single()
        if (error) throw error
        const pd = p as any
        let bimestreNome = 'Sem Bimestre'
        if (pd?.id_bimestre) {
          const { data: b } = await (supabase as any).from('simulados_bimestres').select('nome').eq('id', pd.id_bimestre).single()
          if (b) bimestreNome = (b as any).nome
        }
        if (pd) {
          setSimulado({ ...pd, simulados_bimestres: { nome: bimestreNome } })
          setQuestoes(pd.questoes_json || [])
        }
      } catch (err) {
        console.error('Erro ao carregar gabarito:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [simuladoUploadId])

  const loadCorrecoes = useCallback(async () => {
    setLoadingCorrecoes(true)
    try {
      const { data, error } = await (supabase as any)
        .from('gabarito_correcoes')
        .select('*')
        .eq('id_simulado_upload', simuladoUploadId)
        .order('created_at', { ascending: false })
      if (!error && data) setCorrecoes(data)
    } finally {
      setLoadingCorrecoes(false)
    }
  }, [simuladoUploadId])

  useEffect(() => {
    if (activeTab === 'correcoes') loadCorrecoes()
  }, [activeTab, loadCorrecoes])

  // Print styles
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @media print {
        @page { margin: 1cm; size: A4 portrait; }
        body * { visibility: hidden; }
        #gabarito-print-area, #gabarito-print-area * { visibility: visible; }
        #gabarito-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: white !important; color: black !important; }
        .no-print { display: none !important; }
        #gabarito-print-area h1 { font-size: 16px !important; margin-bottom: 6px !important; }
        #gabarito-print-area .print-header-info { font-size: 10px !important; gap: 8px !important; }
        #gabarito-print-area .print-grid-container { padding: 8px !important; }
        #gabarito-print-area .print-grid-columns { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
        .gabarito-list-item { padding: 3px 6px !important; margin-bottom: 4px !important; border: 1px solid #e2e8f0 !important; border-radius: 4px !important; box-shadow: none !important; }
        .gabarito-list-item span { font-size: 10px !important; }
        .gabarito-bubble { width: 18px !important; height: 18px !important; font-size: 10px !important; border: 1px solid #000 !important; color: #000 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  const handleImageFile = (file: File) => {
    setUploadError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImagemPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setImagemBase64(base64)
      setImagemMime(file.type || 'image/jpeg')
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageFile(file)
  }

  const handleProcessar = async () => {
    if (!nomeAluno.trim()) { setUploadError('Informe o nome do aluno.'); return }
    if (!imagemBase64) { setUploadError('Envie ou tire uma foto do gabarito.'); return }
    if (questoes.length === 0) { setUploadError('Este simulado não possui questões no gabarito.'); return }

    setProcessando(true)
    setUploadError(null)

    try {
      // Build official answer key
      const gabaritoOficial = questoes.map((q: any, idx: number) => {
        const correta = q.alternativas?.find((a: any) => a.correct)
        return { numero: idx + 1, resposta: correta?.letter || '?' }
      })

      // Call AI API
      const res = await fetch('/api/ai/corrigir-gabarito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imagemBase64, mimeType: imagemMime, gabaritoOficial })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erro ao processar a imagem.')

      // Save to DB
      await (supabase as any).from('gabarito_correcoes').insert({
        id_simulado_upload: simuladoUploadId,
        nome_aluno: nomeAluno.trim(),
        respostas_aluno: result.respostasAluno,
        gabarito_oficial: gabaritoOficial,
        total_questoes: result.totalQuestoes,
        total_acertos: result.totalAcertos,
        percentual_acerto: result.percentual,
      })

      // Close upload modal, switch to results tab
      setShowUploadModal(false)
      setNomeAluno('')
      setImagemPreview(null)
      setImagemBase64(null)
      setActiveTab('correcoes')
      loadCorrecoes()
    } catch (err: any) {
      setUploadError(err.message || 'Erro desconhecido.')
    } finally {
      setProcessando(false)
    }
  }

  const handleDeleteCorrecao = async (id: string) => {
    if (!confirm('Excluir esta correção?')) return
    await (supabase as any).from('gabarito_correcoes').delete().eq('id', id)
    setCorrecoes(prev => prev.filter(c => c.id !== id))
  }

  const getScoreColor = (pct: number) => {
    if (pct >= 70) return '#10b981'
    if (pct >= 50) return '#f59e0b'
    return '#ef4444'
  }

  const getScoreLabel = (pct: number) => {
    if (pct >= 70) return 'Aprovado'
    if (pct >= 50) return 'Regular'
    return 'Abaixo'
  }

  const averageScore = correcoes.length > 0
    ? correcoes.reduce((acc, c) => acc + c.percentual_acerto, 0) / correcoes.length
    : 0

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ background: '#ffffff', width: '100%', maxWidth: 960, height: '90vh', borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 64px rgba(0,0,0,0.3)', border: '1px solid #e2e8f0' }}
      >
        {/* Header */}
        <div className="no-print" style={{ 
          padding: isMobile ? '16px' : '20px 24px', 
          borderBottom: '1px solid #e2e8f0', 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center', 
          justifyContent: 'space-between', 
          background: '#f8fafc',
          gap: isMobile ? 12 : 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                <CheckSquare size={20} color="white" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Gabarito & Correções</h2>
                <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{simulado?.titulo || 'Carregando...'}</p>
              </div>
            </div>
            {isMobile && (
              <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, flexShrink: 0, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
            {activeTab === 'gabarito' && (
              <button onClick={() => window.print()} style={{ flex: isMobile ? 1 : 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, background: '#10b981', color: 'white', padding: '10px 16px', borderRadius: 10, border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                <Printer size={16} /> Imprimir
              </button>
            )}
            {activeTab === 'correcoes' && (
              <button onClick={() => setShowUploadModal(true)} style={{ flex: isMobile ? 1 : 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13, boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
                <ScanLine size={16} /> {isMobile ? 'Corrigir c/ IA' : 'Corrigir Gabarito com IA'}
              </button>
            )}
            {!isMobile && (
              <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="no-print" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: isMobile ? '8px' : 0, gap: isMobile ? 8 : 0 }}>
          {[
            { key: 'gabarito', label: 'Gabarito Oficial', icon: CheckSquare },
            { key: 'correcoes', label: `Correções por IA ${correcoes.length > 0 ? `(${correcoes.length})` : ''}`, icon: ScanLine }
          ].map(({ key, label, icon: Icon }) => {
            const isAI = key === 'correcoes'
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                style={{
                  flex: isMobile ? 1 : 'none',
                  justifyContent: 'center',
                  padding: isAI ? '10px 16px' : (isMobile ? '12px' : '14px 24px'), 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontWeight: isActive ? 700 : 600, 
                  fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: isAI 
                    ? (isActive ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'rgba(168, 85, 247, 0.1)') 
                    : (isActive ? '#ffffff' : 'transparent'),
                  color: isAI 
                    ? (isActive ? '#ffffff' : '#9333ea') 
                    : (isActive ? '#6366f1' : '#64748b'),
                  borderBottom: isAI ? 'none' : (isActive ? '2px solid #6366f1' : '2px solid transparent'),
                  borderRadius: isAI ? '12px' : '0',
                  margin: isAI && !isMobile ? '6px 16px' : '0',
                  boxShadow: isAI && isActive ? '0 8px 20px rgba(168, 85, 247, 0.35)' : 'none',
                  textShadow: isAI && isActive ? '0 0 10px rgba(255,255,255,0.3)' : 'none',
                  transform: isAI && isActive ? 'translateY(-2px)' : 'none'
                }}
                className={isAI && !isActive ? "animate-pulse-glow" : ""}
              >
                <Icon size={16} /> {label}
                {isAI && !isActive && (
                  <span style={{ 
                    position: 'absolute', top: 4, right: 4, width: 8, height: 8, 
                    background: '#ef4444', borderRadius: '50%', border: '2px solid #f8fafc' 
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* ===== GABARITO TAB ===== */}
          {activeTab === 'gabarito' && (
            <div id="gabarito-print-area" style={{ padding: '28px 32px', background: '#ffffff', color: '#0f172a' }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: '#64748b' }}>
                  <Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite' }} /> Carregando gabarito...
                </div>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 12px', textTransform: 'uppercase' }}>Gabarito: {simulado?.titulo || 'Simulado'}</h1>
                    <div className="print-header-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
                        <Calendar size={14} /> <span>Aplicação: {simulado?.data_aplicacao ? new Date(simulado.data_aplicacao + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data não definida'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
                        <Layers size={14} /> <span>{simulado?.simulados_bimestres?.nome || 'Sem Bimestre'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
                        <Users size={14} /> <span>Turmas: {Array.isArray(simulado?.series) ? simulado.series.join(', ') : (simulado?.series || 'Geral')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                        <FileText size={14} color="#3b82f6" /> <span style={{ color: '#3b82f6' }}>Total: {questoes.length} Questões</span>
                      </div>
                    </div>
                  </div>
                  <div className="print-grid-container" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
                    <div className="print-grid-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                      {[questoes.slice(0, Math.ceil(questoes.length / 2)), questoes.slice(Math.ceil(questoes.length / 2))].map((colQuestoes, colIndex) => (
                        <div key={colIndex} style={{ display: 'flex', flexDirection: 'column' }}>
                          {colQuestoes.map((q: any, idx: number) => {
                            const num = colIndex === 0 ? idx + 1 : Math.ceil(questoes.length / 2) + idx + 1
                            const alt = q.alternativas?.find((a: any) => a.correct)
                            const letra = alt ? alt.letter : '?'
                            return (
                              <div key={q.id || num} className="gabarito-list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', marginBottom: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Questão {num.toString().padStart(2, '0')}</span>
                                <div className="gabarito-bubble" style={{ width: 32, height: 32, borderRadius: '50%', background: letra !== '?' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', color: letra !== '?' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, border: letra !== '?' ? '2px solid rgba(16,185,129,0.35)' : '2px dashed rgba(239,68,68,0.4)' }}>
                                  {letra}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== CORREÇÕES TAB ===== */}
          {activeTab === 'correcoes' && (
            <div style={{ padding: '24px 28px' }}>
              {/* Stats bar */}
              {correcoes.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: 'Alunos Corrigidos', value: correcoes.length, icon: Users, color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
                    { label: 'Média da Turma', value: `${parseFloat(averageScore.toFixed(1))}%`, icon: BarChart3, color: getScoreColor(averageScore), bg: `${getScoreColor(averageScore)}14` },
                    { label: 'Melhor Resultado', value: (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span>{parseFloat(Math.max(...correcoes.map(c => c.percentual_acerto)).toFixed(1))}%</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', opacity: 0.9 }}>
                          ({Math.max(...correcoes.map(c => c.total_acertos))} de {correcoes[0]?.total_questoes})
                        </span>
                      </div>
                    ), icon: Trophy, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                  ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={22} color={color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.03em' }}>{value}</div>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Corrections List */}
              {loadingCorrecoes ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: '#64748b' }}>
                  <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite' }} /> Carregando correções...
                </div>
              ) : correcoes.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 16, textAlign: 'center' }}
                >
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(99,102,241,0.2)' }}>
                    <ScanLine size={36} color="#6366f1" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Nenhuma correção ainda</h3>
                    <p style={{ color: '#64748b', fontSize: 14, maxWidth: 340, margin: 0 }}>
                      Clique em <strong style={{ color: '#6366f1' }}>Corrigir Gabarito com IA</strong> para enviar a foto do gabarito respondido por um aluno e obter a correção automaticamente.
                    </p>
                  </div>
                  <button onClick={() => setShowUploadModal(true)} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', padding: '12px 24px', borderRadius: 12, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>
                    <ScanLine size={18} /> Corrigir Gabarito com IA
                  </button>
                </motion.div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {correcoes.map((c, i) => {
                    const color = getScoreColor(c.percentual_acerto)
                    const isExpanded = expandedId === c.id
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}
                      >
                        {/* Card Header */}
                        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                          {/* Avatar */}
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}20`, border: `2px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <User size={20} color={color} />
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>{c.nome_aluno}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, color: '#64748b' }}>
                                {c.total_acertos} de {c.total_questoes} acertos
                              </span>
                              {(() => {
                                const anuladasCount = (c.respostas_aluno || []).filter((r: any) => r.resposta === 'ANULADA').length
                                if (anuladasCount > 0) {
                                  return (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                      {anuladasCount} anulada{anuladasCount > 1 ? 's' : ''}
                                    </span>
                                  )
                                }
                                return null
                              })()}
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${color}15`, color }}>
                                {getScoreLabel(c.percentual_acerto)}
                              </span>
                            </div>
                          </div>

                          {/* Score */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: '-0.03em' }}>{parseFloat(c.percentual_acerto.toFixed(1))}%</div>
                            {/* Mini progress bar */}
                            <div style={{ width: 70, height: 5, background: '#ffffff', borderRadius: 99, overflow: 'hidden', marginTop: 4 }}>
                              <div style={{ height: '100%', width: `${c.percentual_acerto}%`, background: color, borderRadius: 99, transition: 'width 0.8s ease' }} />
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => setExpandedId(isExpanded ? null : c.id)} style={{ width: 34, height: 34, borderRadius: 8, background: '#ffffff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <button onClick={() => handleDeleteCorrecao(c.id)} style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px 20px', background: '#ffffff' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Detalhe por questão</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                                  {(c.gabarito_oficial || []).map((g: any, idx: number) => {
                                    const respostaAluno = c.respostas_aluno?.find((r: any) => r.numero === g.numero)
                                    const ra = respostaAluno?.resposta?.toUpperCase() || '–'
                                    const rc = g.resposta?.toUpperCase()
                                    const correto = ra === rc
                                    return (
                                      <div key={idx} style={{ background: correto ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${correto ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Q{g.numero}</span>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                          <span style={{ fontSize: 14, fontWeight: 900, color: correto ? '#10b981' : '#ef4444' }}>{ra}</span>
                                          {!correto && <span style={{ fontSize: 11, color: '#64748b' }}>({rc})</span>}
                                        </div>
                                        {correto ? <CheckCircle size={12} color="#10b981" /> : <XCircle size={12} color="#ef4444" />}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ===== UPLOAD MODAL (Student + Photo) ===== */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowUploadModal(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ background: '#ffffff', borderRadius: 24, width: '100%', maxWidth: 520, padding: 28, border: '1px solid #e2e8f0', boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
                    <ScanLine size={22} color="white" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Corrigir com IA</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Envie a foto do gabarito respondido</p>
                  </div>
                </div>
                <button onClick={() => { setShowUploadModal(false); setImagemPreview(null); setImagemBase64(null); setNomeAluno(''); setUploadError(null) }} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Student Name */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                  <User size={13} style={{ display: 'inline', marginRight: 6 }} />Nome do Aluno
                </label>
                <input
                  type="text"
                  value={nomeAluno}
                  onChange={e => setNomeAluno(e.target.value)}
                  placeholder="Digite o nome completo do aluno..."
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              {/* Image Upload Area */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                  <BookOpen size={13} style={{ display: 'inline', marginRight: 6 }} />Foto do Gabarito
                </label>

                {imagemPreview ? (
                  <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(99,102,241,0.3)' }}>
                    <img src={imagemPreview} alt="Preview gabarito" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block', background: '#000' }} />
                    <button onClick={() => { setImagemPreview(null); setImagemBase64(null) }} style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 8, background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={16} />
                    </button>
                    <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(99,102,241,0.9)', color: 'white', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                      ✓ Imagem carregada
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '2px dashed #e2e8f0', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ScanLine size={28} color="#6366f1" />
                    </div>
                    <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', margin: 0 }}>
                      Envie ou tire uma foto do gabarito preenchido pelo aluno
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                      >
                        <Upload size={15} /> Escolher Arquivo
                      </button>
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                      >
                        <Camera size={15} /> Câmera
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
                  </div>
                )}
              </div>

              {/* Error */}
              {uploadError && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                  <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{uploadError}</p>
                </div>
              )}

              {/* Processing indicator */}
              {processando && (
                <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Loader2 size={18} color="#6366f1" style={{ animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#6366f1' }}>IA lendo o gabarito...</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8b5cf6' }}>
                    Identificando marcações • Calculando acertos • Gerando resultado
                  </div>
                  <div style={{ height: 4, background: 'rgba(99,102,241,0.15)', borderRadius: 99, overflow: 'hidden' }}>
                    <motion.div
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ height: '100%', width: '40%', background: 'linear-gradient(90deg, transparent, #6366f1, transparent)', borderRadius: 99 }}
                    />
                  </div>
                </div>
              )}

              {/* Action button */}
              <button
                onClick={handleProcessar}
                disabled={processando || !imagemBase64 || !nomeAluno.trim()}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: processando || !imagemBase64 || !nomeAluno.trim()
                    ? 'rgba(99,102,241,0.3)'
                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white', fontWeight: 800, fontSize: 15, cursor: processando || !imagemBase64 || !nomeAluno.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: processando || !imagemBase64 || !nomeAluno.trim() ? 'none' : '0 6px 24px rgba(99,102,241,0.4)',
                  transition: 'all 0.2s'
                }}
              >
                {processando ? (
                  <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Processando...</>
                ) : (
                  <><ScanLine size={18} /> Corrigir com Inteligência Artificial</>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  )
}
