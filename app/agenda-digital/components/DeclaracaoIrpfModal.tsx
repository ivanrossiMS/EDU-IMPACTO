'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
  X,
  FileText,
  Printer,
  Calendar,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  Download,
  ShieldCheck,
  RefreshCw,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Eye,
  FileCheck2,
  ChevronDown
} from 'lucide-react'
import { DeclaracaoIrpfDocument, DeclaracaoIrpfData } from './DeclaracaoIrpfDocument'
import { generateDeclaracaoHtml } from './declaracaoHtmlGenerator'
import { generateDeclaracaoPdf } from './declaracaoPdfGenerator'
import { toast } from 'sonner'

interface StudentOption {
  id?: string
  nome: string
  turma?: string
  matricula?: string
}

function getStudentInitials(name: string): string {
  if (!name) return 'AL'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface DeclaracaoIrpfModalProps {
  isOpen: boolean
  onClose: () => void
  alunos: StudentOption[]
  currentAno?: string
  responsavelId?: string
}

const ANOS_IRPF = ['2026', '2025', '2024', '2023']

const YEAR_METADATA: Record<string, { exercicio: string; label: string; tag?: string }> = {
  '2026': { exercicio: '2027', label: 'Ano Letivo Vigente', tag: 'Atual' },
  '2025': { exercicio: '2026', label: 'Ano Letivo Anterior' },
  '2024': { exercicio: '2025', label: 'Histórico Escolar' },
  '2023': { exercicio: '2024', label: 'Histórico Escolar' },
}

export function DeclaracaoIrpfModal({
  isOpen,
  onClose,
  alunos = [],
  currentAno = '2026',
  responsavelId,
}: DeclaracaoIrpfModalProps) {
  const [mounted, setMounted] = useState(false)
  const [responsibleStudents, setResponsibleStudents] = useState<StudentOption[]>([])
  const [loadingResponsibleStudents, setLoadingResponsibleStudents] = useState(false)
  // Lista unificada de alunos (props + responsáveis vinculados)
  const allStudents = useMemo(() => {
    const list: StudentOption[] = []
    const seen = new Set<string>()

    const addIfNew = (a: StudentOption) => {
      if (!a?.nome) return
      const key = a.nome.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        list.push(a)
      }
    }

    for (const a of alunos || []) addIfNew(a)
    for (const a of responsibleStudents) addIfNew(a)

    return list
  }, [alunos, responsibleStudents])

  const [selectedAluno, setSelectedAluno] = useState<StudentOption | null>(allStudents[0] || null)
  const [selectedAno, setSelectedAno] = useState<string>(currentAno)
  const [isYearOpen, setIsYearOpen] = useState(false)
  const yearSelectRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docData, setDocData] = useState<DeclaracaoIrpfData | null>(null)
  const [viewMode, setViewMode] = useState<'config' | 'preview'>('config')
  const [savingPdf, setSavingPdf] = useState(false)

  const printAreaRef = useRef<HTMLDivElement>(null)

  // Fecha o seletor em lista de ano ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (yearSelectRef.current && !yearSelectRef.current.contains(event.target as Node)) {
        setIsYearOpen(false)
      }
    }
    if (isYearOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isYearOpen])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Atualiza o aluno selecionado quando a lista mudar
  useEffect(() => {
    if (allStudents.length > 0 && !selectedAluno) {
      setSelectedAluno(allStudents[0])
    }
  }, [allStudents, selectedAluno])

  // Busca automática de todos os alunos vinculados a este responsável financeiro
  useEffect(() => {
    if (!isOpen) return

    let isCancelled = false
    const loadLinkedStudents = async () => {
      setLoadingResponsibleStudents(true)
      try {
        const query = responsavelId
          ? `responsavel_id=${encodeURIComponent(responsavelId)}`
          : selectedAluno?.id
          ? `aluno_id=${encodeURIComponent(selectedAluno.id)}&mode=co_students`
          : ''

        if (!query) return

        const res = await fetch(`/api/aluno-responsavel?${query}`)
        if (!res.ok) return
        const json = await res.json()
        if (json?.alunos && Array.isArray(json.alunos) && !isCancelled) {
          setResponsibleStudents((prev) => {
            const map = new Map<string, StudentOption>()
            for (const s of prev) map.set(s.nome.trim().toLowerCase(), s)
            for (const a of json.alunos) {
              const key = a.nome.trim().toLowerCase()
              if (!map.has(key)) {
                map.set(key, {
                  id: a.id ? String(a.id) : undefined,
                  nome: a.nome,
                  turma: a.turma || 'Ensino Regular',
                  matricula: a.matricula,
                })
              }
            }
            return Array.from(map.values())
          })
        }
      } catch (err) {
        console.warn('[DeclaracaoIrpfModal] Falha ao carregar alunos vinculados:', err)
      } finally {
        if (!isCancelled) setLoadingResponsibleStudents(false)
      }
    }

    loadLinkedStudents()
    return () => {
      isCancelled = true
    }
  }, [isOpen, responsavelId, selectedAluno?.id])

  // Buscar dados da declaração
  const fetchDeclaracao = useCallback(async () => {
    if (!selectedAluno) return
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        ano: selectedAno,
        alunoNome: selectedAluno.nome,
      })
      if (selectedAluno.id) params.append('alunoId', selectedAluno.id)
      if (responsavelId) params.append('responsavelId', responsavelId)

      const res = await fetch(`/api/isaac/declaracao-irpf?${params.toString()}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível gerar a declaração de IRPF.')
      }

      setDocData(json)

      // Atualiza a lista de dependentes disponíveis a partir da resposta do Isaac
      if (json?.alunosDisponiveis && Array.isArray(json.alunosDisponiveis)) {
        setResponsibleStudents((prev) => {
          const map = new Map<string, StudentOption>()
          for (const s of prev) map.set(s.nome.trim().toLowerCase(), s)
          for (const a of json.alunosDisponiveis) {
            const key = a.nome.trim().toLowerCase()
            if (!map.has(key)) {
              map.set(key, {
                id: a.id ? String(a.id) : undefined,
                nome: a.nome,
                turma: a.turma || 'Ensino Regular',
                matricula: a.matricula,
              })
            }
          }
          return Array.from(map.values())
        })
      }
    } catch (err: any) {
      setError(err.message)
      setDocData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedAluno, selectedAno, responsavelId])

  useEffect(() => {
    if (isOpen && selectedAluno) {
      fetchDeclaracao()
    }
  }, [isOpen, selectedAluno, selectedAno, fetchDeclaracao])

  // Tratar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Bloquear scroll do body quando aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setViewMode('config')
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Gerar e Salvar o arquivo PDF oficial (Mobile e Desktop)
  const handleSavePdf = async () => {
    if (!docData) return
    setSavingPdf(true)

    try {
      const pdfBytes = await generateDeclaracaoPdf(docData)
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const safeName = (docData.aluno.nome || 'Aluno').replace(/\s+/g, '_')
      const fileName = `Declaracao_IRPF_${docData.anoCalendario}_${safeName}.pdf`

      const isMobile =
        typeof navigator !== 'undefined' &&
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')

      let shared = false
      // 1. Mobile Web Share API nativa (iOS / Android)
      if (isMobile && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        try {
          const file = new File([blob], fileName, { type: 'application/pdf' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Declaração IRPF ${docData.anoCalendario} - ${docData.aluno.nome}`,
              text: `Comprovante de Quitação Anual de Mensalidades - ${docData.aluno.nome}`,
            })
            shared = true
            toast.success('Declaração salva com sucesso!')
          }
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            setSavingPdf(false)
            return
          }
        }
      }

      // 2. Download direto via elemento <a> se não foi compartilhado via Web Share
      if (!shared) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a)
          }
          URL.revokeObjectURL(url)
        }, 1500)

        // 3. Fallback em WebViews restritas
        if (isMobile) {
          setTimeout(() => {
            const previewUrl = URL.createObjectURL(blob)
            window.open(previewUrl, '_blank')
            setTimeout(() => URL.revokeObjectURL(previewUrl), 60000)
          }, 400)
        }

        toast.success('Declaração em PDF salva com sucesso!')
      }
    } catch (err: any) {
      console.error('Erro ao gerar/salvar PDF:', err)
      toast.error('Erro ao gerar PDF: ' + (err.message || 'Falha desconhecida'))
      handlePrintWindow()
    } finally {
      setSavingPdf(false)
    }
  }

  // Abertura em janela de impressão dedicada com UTF-8
  const handlePrintWindow = () => {
    if (!docData) return
    try {
      const htmlContent = generateDeclaracaoHtml(docData)
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)

      if (!win) {
        // Popup bloqueado -> aciona download direto do PDF
        handleSavePdf()
      }
    } catch (e) {
      handleSavePdf()
    }
  }

  if (!mounted || !isOpen) return null

  return createPortal(
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        {/* Backdrop com Blur */}
        <motion.div
          className="no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          style={{
            position: 'relative',
            zIndex: 10,
            background: '#ffffff',
            borderRadius: 24,
            width: '100%',
            maxWidth: viewMode === 'preview' ? '920px' : '560px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
            overflow: 'hidden',
            transition: 'max-width 0.3s ease',
          }}
        >
          {/* ── HEADER DO MODAL ────────────────────────────────────────────── */}
          <div
            className="no-print"
            style={{
              padding: '18px 22px',
              borderBottom: '1.5px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 14px rgba(79, 70, 229, 0.25)',
                  color: '#ffffff',
                }}
              >
                <FileText size={22} />
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 900,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Declaração de IRPF
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                  Comprovante oficial de quitação anual de mensalidades
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {docData && viewMode === 'preview' && (
                <>
                  <button
                    disabled={savingPdf}
                    onClick={handleSavePdf}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: savingPdf
                        ? '#cbd5e1'
                        : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      color: '#ffffff',
                      fontSize: 12.5,
                      fontWeight: 800,
                      cursor: savingPdf ? 'not-allowed' : 'pointer',
                      boxShadow: '0 3px 10px rgba(79, 70, 229, 0.3)',
                    }}
                  >
                    {savingPdf ? (
                      <>
                        <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                        <span>Gerando PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span>Baixar PDF</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handlePrintWindow}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: 12.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Printer size={15} />
                    <span>Imprimir</span>
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                aria-label="Fechar"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── CORPO DO MODAL ─────────────────────────────────────────────── */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {/* Modo Configuração / Seleção */}
            {viewMode === 'config' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Seleção de Aluno */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}
                  >
                    1. Selecione o Aluno / Beneficiário:
                  </label>

                  {loadingResponsibleStudents && allStudents.length === 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '14px 16px',
                        borderRadius: 14,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#64748b',
                        fontSize: 13,
                      }}
                    >
                      <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Carregando alunos vinculados...</span>
                    </div>
                  ) : allStudents.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {allStudents.map((al) => {
                        const isSelected = selectedAluno?.nome === al.nome
                        const initials = getStudentInitials(al.nome)

                        return (
                          <div
                            key={al.id || al.nome}
                            onClick={() => setSelectedAluno(al)}
                            style={{
                              padding: '12px 16px',
                              borderRadius: 16,
                              border: isSelected ? '2px solid #4f46e5' : '1.5px solid #e2e8f0',
                              background: isSelected ? '#f5f3ff' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              transition: 'all 0.2s',
                              boxShadow: isSelected ? '0 4px 14px rgba(79, 70, 229, 0.15)' : 'none',
                            }}
                          >
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                background: isSelected ? '#4f46e5' : '#e0e7ff',
                                color: isSelected ? '#ffffff' : '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                fontWeight: 900,
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 800,
                                  color: isSelected ? '#4338ca' : '#0f172a',
                                }}
                              >
                                {al.nome}
                              </div>
                              <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, marginTop: 1 }}>
                                {al.turma || 'Aluno Colégio Impacto'} {al.matricula ? `• Matrícula: ${al.matricula}` : ''}
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 size={20} color="#4f46e5" style={{ flexShrink: 0 }} />}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: 14,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: 13,
                        color: '#64748b',
                      }}
                    >
                      Nenhum aluno vinculado encontrado para este responsável financeiro.
                    </div>
                  )}
                </div>

                {/* Seleção do Ano-Calendário em Lista Ultra Moderna */}
                <div ref={yearSelectRef} style={{ position: 'relative' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}
                  >
                    2. Selecione o Ano-Calendário:
                  </label>

                  {/* Trigger da Lista Ultra Moderna */}
                  <div
                    onClick={() => setIsYearOpen((prev) => !prev)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setIsYearOpen((prev) => !prev)
                      }
                    }}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 16,
                      border: isYearOpen ? '2px solid #4f46e5' : '1.5px solid #e2e8f0',
                      background: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isYearOpen
                        ? '0 6px 20px rgba(79, 70, 229, 0.15)'
                        : '0 2px 6px rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                          color: '#4338ca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Calendar size={19} strokeWidth={2.3} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
                            Ano-Calendário {selectedAno}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#4f46e5',
                              background: '#eef2ff',
                              border: '1px solid #c7d2fe',
                              padding: '2px 8px',
                              borderRadius: 8,
                            }}
                          >
                            Exercício {YEAR_METADATA[selectedAno]?.exercicio || Number(selectedAno) + 1}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                          {YEAR_METADATA[selectedAno]?.label || 'Declaração para IRPF'}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: isYearOpen ? '#f5f3ff' : '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background 0.2s',
                      }}
                    >
                      <ChevronDown
                        size={18}
                        color={isYearOpen ? '#4f46e5' : '#64748b'}
                        style={{
                          transform: isYearOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Menu Suspenso da Lista Ultra Moderna */}
                  <AnimatePresence>
                    {isYearOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: 8,
                          background: '#ffffff',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: 16,
                          padding: 6,
                          boxShadow: '0 12px 30px -6px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.05)',
                          zIndex: 50,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        {ANOS_IRPF.map((ano) => {
                          const isSelected = selectedAno === ano
                          const meta = YEAR_METADATA[ano] || {
                            exercicio: String(Number(ano) + 1),
                            label: 'Declaração para IRPF',
                          }

                          return (
                            <div
                              key={ano}
                              onClick={() => {
                                setSelectedAno(ano)
                                setIsYearOpen(false)
                              }}
                              style={{
                                padding: '10px 14px',
                                borderRadius: 12,
                                border: isSelected ? '1.5px solid #c7d2fe' : '1.5px solid transparent',
                                background: isSelected ? '#f5f3ff' : '#ffffff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = '#f8fafc'
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = '#ffffff'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: isSelected ? '#4f46e5' : '#f1f5f9',
                                    color: isSelected ? '#ffffff' : '#475569',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {ano.slice(-2)}
                                </div>

                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span
                                      style={{
                                        fontSize: 13.5,
                                        fontWeight: 800,
                                        color: isSelected ? '#4338ca' : '#0f172a',
                                      }}
                                    >
                                      Ano-Calendário {ano}
                                    </span>
                                    {meta.tag && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 800,
                                          color: '#059669',
                                          background: '#ecfdf5',
                                          border: '1px solid #a7f3d0',
                                          padding: '1px 6px',
                                          borderRadius: 6,
                                          textTransform: 'uppercase',
                                        }}
                                      >
                                        {meta.tag}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                    Exercício IRPF {meta.exercicio} • {meta.label}
                                  </div>
                                </div>
                              </div>

                              {isSelected ? (
                                <CheckCircle2 size={18} color="#4f46e5" />
                              ) : (
                                <div
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: '#e2e8f0',
                                  }}
                                />
                              )}
                            </div>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Card de Resumo e Pré-visualização dos Dados Calculados */}
                {loading && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Buscando mensalidades no Isaac...</div>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}

                {error && !loading && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1.5px solid #fecaca',
                      borderRadius: 16,
                      padding: '14px 16px',
                      color: '#991b1b',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={18} color="#dc2626" />
                    <span>{error}</span>
                  </div>
                )}

                {!loading && docData && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 18,
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5 }}>
                        Resumo do Comprovante de IRPF
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          background: docData.quantidadeMensalidades > 0 ? '#ecfdf5' : '#f1f5f9',
                          color: docData.quantidadeMensalidades > 0 ? '#059669' : '#64748b',
                          padding: '2px 8px',
                          borderRadius: 6,
                          border: `1px solid ${docData.quantidadeMensalidades > 0 ? '#a7f3d0' : '#e2e8f0'}`,
                        }}
                      >
                        {docData.quantidadeMensalidades} Mensalidade(s) Paga(s)
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>Total Dedutível (Mensalidades)</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#059669', marginTop: 2 }}>
                          {docData.totalPagoFormatado}
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>CNPJ Declarado na Receita</div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>
                          {docData.escola.cnpj}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{docData.escola.nomeFantasia}</div>
                      </div>
                    </div>

                    <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4, marginBottom: 12 }}>
                      • <strong>Instrução Normativa:</strong> Apenas os valores de mensalidades escolares são dedutíveis.
                      Materiais e taxas não constam na somatória.
                    </div>

                    <button
                      onClick={() => setViewMode('preview')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1.5px solid #c7d2fe',
                        background: '#ffffff',
                        color: '#4338ca',
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Eye size={16} />
                      <span>Visualizar Documento Timbrado Completo</span>
                    </button>
                  </motion.div>
                )}
              </div>
            )}

            {/* Modo Visualização Prévia do Documento Timbrado */}
            {viewMode === 'preview' && docData && (
              <div ref={printAreaRef} style={{ display: 'flex', justifyContent: 'center' }}>
                <DeclaracaoIrpfDocument data={docData} isPrintMode={false} />
              </div>
            )}
          </div>

          {/* ── FOOTER DO MODAL (AÇÕES) ────────────────────────────────────── */}
          <div
            className="no-print"
            style={{
              padding: '16px 22px',
              borderTop: '1.5px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {viewMode === 'preview' ? (
              <>
                <button
                  onClick={() => setViewMode('config')}
                  style={{
                    padding: '11px 18px',
                    borderRadius: 14,
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ← Voltar às Opções
                </button>

                <div style={{ display: 'flex', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                  <button
                    onClick={handlePrintWindow}
                    style={{
                      padding: '12px 18px',
                      borderRadius: 14,
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: 13.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Printer size={16} />
                    <span>Imprimir</span>
                  </button>

                  <button
                    disabled={savingPdf || !docData}
                    onClick={handleSavePdf}
                    style={{
                      flex: 1,
                      maxWidth: '280px',
                      padding: '12px 20px',
                      borderRadius: 14,
                      border: 'none',
                      background:
                        savingPdf || !docData
                          ? '#cbd5e1'
                          : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: savingPdf || !docData ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow:
                        savingPdf || !docData
                          ? 'none'
                          : '0 4px 16px rgba(79, 70, 229, 0.35)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {savingPdf ? (
                      <>
                        <RefreshCw size={17} style={{ animation: 'spin 0.8s linear infinite' }} />
                        <span>Gerando PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download size={17} />
                        <span>Salvar Declaração em PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  style={{
                    padding: '11px 18px',
                    borderRadius: 14,
                    border: '1.5px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>

                <button
                  disabled={loading || !docData || savingPdf}
                  onClick={handleSavePdf}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: 14,
                    border: 'none',
                    background:
                      loading || !docData || savingPdf
                        ? '#cbd5e1'
                        : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: loading || !docData || savingPdf ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow:
                      loading || !docData || savingPdf ? 'none' : '0 4px 16px rgba(79, 70, 229, 0.35)',
                    transition: 'all 0.2s',
                  }}
                >
                  {savingPdf ? (
                    <>
                      <RefreshCw size={17} style={{ animation: 'spin 0.8s linear infinite' }} />
                      <span>Gerando PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download size={17} />
                      <span>Salvar Declaração em PDF</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
