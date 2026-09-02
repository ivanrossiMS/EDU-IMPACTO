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
  Plus,
  UserPlus,
  User,
  UserCheck
} from 'lucide-react'
import { DeclaracaoIrpfDocument, DeclaracaoIrpfData } from './DeclaracaoIrpfDocument'
import { generateDeclaracaoHtml } from './declaracaoHtmlGenerator'
import { generateDeclaracaoPdf } from './declaracaoPdfGenerator'
import { toast } from 'sonner'

interface StudentOption {
  id?: string
  nome: string
  turma?: string
}

interface DeclaracaoIrpfModalProps {
  isOpen: boolean
  onClose: () => void
  alunos: StudentOption[]
  currentAno?: string
  responsavelId?: string
}

const ANOS_IRPF = ['2026', '2025', '2024', '2023']

export function DeclaracaoIrpfModal({
  isOpen,
  onClose,
  alunos = [],
  currentAno = '2026',
  responsavelId,
}: DeclaracaoIrpfModalProps) {
  const [mounted, setMounted] = useState(false)
  const [customStudents, setCustomStudents] = useState<StudentOption[]>([])
  const [isAddingStudent, setIsAddingStudent] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentTurma, setNewStudentTurma] = useState('')

  // Lista unificada de alunos (props + adicionados dinamicamente)
  const allStudents = useMemo(() => {
    const list: StudentOption[] = []
    const seen = new Set<string>()

    for (const a of alunos || []) {
      if (a?.nome && !seen.has(a.nome.trim().toLowerCase())) {
        seen.add(a.nome.trim().toLowerCase())
        list.push(a)
      }
    }

    for (const a of customStudents) {
      if (a?.nome && !seen.has(a.nome.trim().toLowerCase())) {
        seen.add(a.nome.trim().toLowerCase())
        list.push(a)
      }
    }

    return list
  }, [alunos, customStudents])

  const [selectedAluno, setSelectedAluno] = useState<StudentOption | null>(allStudents[0] || null)
  const [selectedAno, setSelectedAno] = useState<string>(currentAno)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docData, setDocData] = useState<DeclaracaoIrpfData | null>(null)
  const [viewMode, setViewMode] = useState<'config' | 'preview'>('config')
  const [savingPdf, setSavingPdf] = useState(false)

  const printAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Atualiza o aluno selecionado quando a lista mudar
  useEffect(() => {
    if (allStudents.length > 0 && !selectedAluno) {
      setSelectedAluno(allStudents[0])
    }
  }, [allStudents, selectedAluno])

  // Handler para adicionar novo aluno manualmente
  const handleAddCustomStudent = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newStudentName.trim()
    if (!trimmed) {
      toast.error('Informe o nome do aluno.')
      return
    }

    const newStudent: StudentOption = {
      nome: trimmed,
      turma: newStudentTurma.trim() || 'Ensino Regular',
    }

    setCustomStudents((prev) => [...prev, newStudent])
    setSelectedAluno(newStudent)
    setNewStudentName('')
    setNewStudentTurma('')
    setIsAddingStudent(false)
    toast.success(`Aluno "${trimmed}" adicionado com sucesso!`)
  }

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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      1. Selecione o Aluno / Beneficiário:
                    </label>
                    {allStudents.length > 0 && !isAddingStudent && (
                      <button
                        type="button"
                        onClick={() => setIsAddingStudent(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'none',
                          border: 'none',
                          color: '#4f46e5',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: 6,
                        }}
                      >
                        <Plus size={14} />
                        <span>Adicionar outro</span>
                      </button>
                    )}
                  </div>

                  {/* Formulário para Adicionar Aluno (quando a lista estiver vazia ou usuário desejar adicionar) */}
                  {(allStudents.length === 0 || isAddingStudent) && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1.5px dashed #818cf8',
                        borderRadius: 16,
                        padding: '14px 16px',
                        marginBottom: allStudents.length > 0 ? 12 : 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <UserPlus size={18} color="#4f46e5" />
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
                          {allStudents.length === 0 ? 'Informe o Nome do Aluno' : 'Adicionar Outro Aluno'}
                        </span>
                      </div>

                      <form onSubmit={handleAddCustomStudent} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <input
                            type="text"
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            placeholder="Nome completo do aluno (ex: João Silva Santos)"
                            autoFocus
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: 12,
                              border: '1.5px solid #cbd5e1',
                              fontSize: 13.5,
                              color: '#0f172a',
                              background: '#ffffff',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text"
                            value={newStudentTurma}
                            onChange={(e) => setNewStudentTurma(e.target.value)}
                            placeholder="Turma / Série (opcional, ex: 3º Ano EM)"
                            style={{
                              flex: 1,
                              padding: '9px 12px',
                              borderRadius: 12,
                              border: '1.5px solid #cbd5e1',
                              fontSize: 12.5,
                              color: '#0f172a',
                              background: '#ffffff',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />

                          <button
                            type="submit"
                            disabled={!newStudentName.trim()}
                            style={{
                              padding: '9px 16px',
                              borderRadius: 12,
                              border: 'none',
                              background: newStudentName.trim()
                                ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                                : '#cbd5e1',
                              color: '#ffffff',
                              fontSize: 12.5,
                              fontWeight: 800,
                              cursor: newStudentName.trim() ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <UserCheck size={14} />
                            <span>Confirmar Aluno</span>
                          </button>

                          {isAddingStudent && allStudents.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingStudent(false)
                                setNewStudentName('')
                                setNewStudentTurma('')
                              }}
                              style={{
                                padding: '9px 12px',
                                borderRadius: 12,
                                border: '1.5px solid #e2e8f0',
                                background: '#ffffff',
                                color: '#64748b',
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Lista de Alunos Disponíveis */}
                  {allStudents.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {allStudents.map((al) => {
                        const isSelected = selectedAluno?.nome === al.nome
                        const initials = al.nome
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()

                        return (
                          <div
                            key={al.nome}
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
                                {al.turma || 'Aluno Colégio Impacto'}
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 size={20} color="#4f46e5" style={{ flexShrink: 0 }} />}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Seleção do Ano Letivo */}
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
                    2. Selecione o Ano-Calendário:
                  </label>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {ANOS_IRPF.map((ano) => (
                      <button
                        key={ano}
                        onClick={() => setSelectedAno(ano)}
                        style={{
                          flex: 1,
                          padding: '10px 0',
                          borderRadius: 12,
                          border: selectedAno === ano ? '2px solid #4f46e5' : '1.5px solid #e2e8f0',
                          background: selectedAno === ano ? '#4f46e5' : '#ffffff',
                          color: selectedAno === ano ? '#ffffff' : '#334155',
                          fontSize: 13.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: selectedAno === ano ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {ano}
                      </button>
                    ))}
                  </div>
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
