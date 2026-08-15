'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  FileCheck2
} from 'lucide-react'
import { DeclaracaoIrpfDocument, DeclaracaoIrpfData } from './DeclaracaoIrpfDocument'
import { generateDeclaracaoHtml } from './declaracaoHtmlGenerator'

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
  alunos,
  currentAno = '2026',
  responsavelId,
}: DeclaracaoIrpfModalProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedAluno, setSelectedAluno] = useState<StudentOption | null>(alunos[0] || null)
  const [selectedAno, setSelectedAno] = useState<string>(currentAno)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docData, setDocData] = useState<DeclaracaoIrpfData | null>(null)
  const [viewMode, setViewMode] = useState<'config' | 'preview'>('config')

  const printAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Atualiza o aluno selecionado quando a lista mudar
  useEffect(() => {
    if (alunos.length > 0 && !selectedAluno) {
      setSelectedAluno(alunos[0])
    }
  }, [alunos, selectedAluno])

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

  // Imprimir / Salvar em PDF via iframe isolado
  const handlePrint = () => {
    if (!docData) return
    const htmlContent = generateDeclaracaoHtml(docData)

    // Remove iframe anterior se houver
    const existingIframe = document.getElementById('irpf-print-iframe')
    if (existingIframe) {
      existingIframe.remove()
    }

    const iframe = document.createElement('iframe')
    iframe.id = 'irpf-print-iframe'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(htmlContent)
      doc.close()

      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      }, 300)
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
                <button
                  onClick={handlePrint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 3px 10px rgba(79, 70, 229, 0.3)',
                  }}
                >
                  <Printer size={15} />
                  <span>Imprimir / Salvar PDF</span>
                </button>
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {alunos.map((al) => {
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

                    <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                      • <strong>Instrução Normativa:</strong> Apenas os valores de mensalidades escolares são dedutíveis.
                      Materiais e taxas não constam na somatória.
                    </div>
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

                <button
                  onClick={handlePrint}
                  style={{
                    flex: 1,
                    maxWidth: '280px',
                    padding: '12px 20px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                  }}
                >
                  <Printer size={16} />
                  <span>Imprimir / Salvar PDF</span>
                </button>
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
                  disabled={loading || !docData}
                  onClick={handlePrint}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: 14,
                    border: 'none',
                    background:
                      loading || !docData
                        ? '#cbd5e1'
                        : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: loading || !docData ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow:
                      loading || !docData ? 'none' : '0 4px 16px rgba(79, 70, 229, 0.35)',
                    transition: 'all 0.2s',
                  }}
                >
                  <Download size={17} />
                  <span>Salvar Declaração em PDF</span>
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
