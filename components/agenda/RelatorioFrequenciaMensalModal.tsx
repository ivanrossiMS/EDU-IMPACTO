'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar, ChevronLeft, ChevronRight, X, User, Paperclip, 
  Send, FileBarChart, Camera, CheckCircle2, Filter, RotateCw,
  Users, Clock, Eye, Sparkles, TrendingUp, Layers, Info, Copy, Check, Loader2, Crown
} from 'lucide-react'
import { ADComunicado } from '@/lib/agendaDigitalContext'
import { createPortal } from 'react-dom'
import { EnviarRelatorioColaboradorModal } from './EnviarRelatorioColaboradorModal'
import { EnviarRelatorioEmLoteModal } from './EnviarRelatorioEmLoteModal'
import { generateFrequencyReportImage } from '@/lib/reportCanvasGenerator'

interface RelatorioFrequenciaMensalModalProps {
  isOpen: boolean
  onClose: () => void
  colaboradores: { id?: string; nome: string; cargo?: string; perfil?: string; foto?: string }[]
  onSelectComunicado?: (comunicado: ADComunicado) => void
  initialAuthorFilter?: string
}

type ItemReport = {
  id: string | number
  tipo: 'comunicado' | 'relatorio' | 'momento'
  titulo: string
  conteudo: string
  autor: string
  autorCargo: string
  autorFoto: string | null
  dataEnvio: string
  horario: string
  dia: number
  turmas: string[]
  grupos: string[]
  anexosCount: number
  midiasCount: number
  raw: any
}

type DiaData = {
  total: number
  comunicados: number
  relatorios: number
  momentos: number
  itens: ItemReport[]
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const ClientPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? createPortal(children, document.body) : null
}

export function RelatorioFrequenciaMensalModal({
  isOpen,
  onClose,
  colaboradores,
  onSelectComunicado,
  initialAuthorFilter = 'todos'
}: RelatorioFrequenciaMensalModalProps) {
  const today = useMemo(() => new Date(), [])
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1) // 1..12
  const [selectedAuthor, setSelectedAuthor] = useState<string>(initialAuthorFilter)
  const [selectedType, setSelectedType] = useState<string>('todos')
  const [selectedAttachment, setSelectedAttachment] = useState<string>('todos')
  
  // Selected day for inspection
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dayTypeFilter, setDayTypeFilter] = useState<'todos' | 'comunicado' | 'relatorio' | 'momento'>('todos')

  // API Data State
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [reportData, setReportData] = useState<{
    summary: {
      totalGeral: number
      totalComunicados: number
      totalRelatorios: number
      totalMomentos: number
      diasComEnvios: number
      diasNoMes: number
      mediaPorDiaAtivo: string
    }
    dias: Record<number, DiaData>
    autores: Array<{
      nome: string
      cargo: string
      foto: string | null
      total: number
      comunicados: number
      relatorios: number
      momentos: number
      diasComEnvios?: number
      dias?: Record<number, {
        total: number
        comunicados: number
        relatorios: number
        momentos: number
      }>
    }>
    diasNoMes: number
    startDayOfWeek: number
  } | null>(null)

  const [copiedSummary, setCopiedSummary] = useState(false)
  const [showAuthorsRanking, setShowAuthorsRanking] = useState(false)

  // Estados para envio do relatório por comunicado
  const [showSendModal, setShowSendModal] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string>('')
  const [sendSuccessToast, setSendSuccessToast] = useState<string | null>(null)
  const [showBatchSendModal, setShowBatchSendModal] = useState(false)

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('mes', String(selectedMonth))
      params.set('ano', String(selectedYear))
      if (selectedAuthor && selectedAuthor !== 'todos') {
        params.set('autor', selectedAuthor)
      }
      if (selectedType && selectedType !== 'todos') {
        params.set('tipo', selectedType)
      }
      if (selectedAttachment && selectedAttachment !== 'todos') {
        params.set('anexo', selectedAttachment)
      }

      const res = await fetch(`/api/agenda/relatorio-frequencia?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setReportData(json)
      } else {
        console.error('Falha ao carregar relatório de frequência:', res.statusText)
      }
    } catch (err) {
      console.error('Erro na requisição do relatório de frequência:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedMonth, selectedYear, selectedAuthor, selectedType, selectedAttachment])

  useEffect(() => {
    if (isOpen) {
      fetchReport()
    }
  }, [isOpen, fetchReport])

  // Reset selected day on month or author change
  useEffect(() => {
    setSelectedDay(null)
    setDayTypeFilter('todos')
  }, [selectedMonth, selectedYear, selectedAuthor])

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(prev => prev - 1)
    } else {
      setSelectedMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(prev => prev + 1)
    } else {
      setSelectedMonth(prev => prev + 1)
    }
  }

  const handleGoToCurrentMonth = () => {
    setSelectedYear(today.getFullYear())
    setSelectedMonth(today.getMonth() + 1)
  }

  const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === (today.getMonth() + 1)

  // Find info about selected user
  const selectedUserObj = useMemo(() => {
    if (!selectedAuthor || selectedAuthor === 'todos') return null
    const foundColab = colaboradores.find(c => c.nome?.trim().toLowerCase() === selectedAuthor.trim().toLowerCase())
    const foundInReport = reportData?.autores.find(a => a.nome?.trim().toLowerCase() === selectedAuthor.trim().toLowerCase())
    return {
      nome: foundColab?.nome || foundInReport?.nome || selectedAuthor,
      cargo: foundColab?.cargo || foundColab?.perfil || foundInReport?.cargo || 'Colaborador',
      foto: foundColab?.foto || foundInReport?.foto || null,
      stats: foundInReport || null
    }
  }, [selectedAuthor, colaboradores, reportData?.autores])

  // Filtered items for selected day
  const selectedDayData = selectedDay && reportData?.dias ? reportData.dias[selectedDay] : null
  const dayItems = useMemo(() => {
    if (!selectedDayData) return []
    if (dayTypeFilter === 'todos') return selectedDayData.itens
    return selectedDayData.itens.filter(i => i.tipo === dayTypeFilter)
  }, [selectedDayData, dayTypeFilter])

  // Copy monthly summary to clipboard
  const handleCopySummary = () => {
    if (!reportData) return
    const monthName = MONTH_NAMES[selectedMonth - 1]
    const title = `📊 Relatório de Frequência Mensal - ${monthName} de ${selectedYear}`
    const target = selectedAuthor !== 'todos' ? `👤 Usuário: ${selectedAuthor}` : '👥 Abrangência: Todos os Usuários'
    const total = `• Total de Publicações: ${reportData.summary.totalGeral}`
    const coms = `  - Comunicados: ${reportData.summary.totalComunicados}`
    const rels = `  - Relatórios de Rotina: ${reportData.summary.totalRelatorios}`
    const moms = `  - Momentos (Fotos/Vídeos): ${reportData.summary.totalMomentos}`
    const active = `• Dias com Envios: ${reportData.summary.diasComEnvios} de ${reportData.diasNoMes} dias`
    const avg = `• Média por Dia Ativo: ${reportData.summary.mediaPorDiaAtivo} envios/dia`

    const text = `${title}\n${target}\n${total}\n${coms}\n${rels}\n${moms}\n${active}\n${avg}`
    navigator.clipboard.writeText(text)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  // Gera o infográfico em alta resolução e abre o modal de confirmação de envio
  const handleOpenSendModal = async () => {
    if (!selectedUserObj || !reportData) return
    setIsGeneratingImage(true)
    try {
      const userStats = selectedUserObj.stats || {
        total: reportData.summary.totalGeral,
        comunicados: reportData.summary.totalComunicados,
        relatorios: reportData.summary.totalRelatorios,
        momentos: reportData.summary.totalMomentos,
        diasComEnvios: reportData.summary.diasComEnvios,
        diasNoMes: reportData.diasNoMes,
        mediaPorDiaAtivo: reportData.summary.mediaPorDiaAtivo
      }

      const img = await generateFrequencyReportImage({
        colaboradorNome: selectedUserObj.nome,
        colaboradorCargo: selectedUserObj.cargo,
        mes: selectedMonth,
        ano: selectedYear,
        summary: {
          totalGeral: userStats.total,
          totalComunicados: userStats.comunicados,
          totalRelatorios: userStats.relatorios,
          totalMomentos: userStats.momentos,
          diasComEnvios: reportData.summary.diasComEnvios,
          diasNoMes: reportData.diasNoMes,
          mediaPorDiaAtivo: reportData.summary.mediaPorDiaAtivo
        },
        dias: reportData.dias
      })

      setGeneratedImageBase64(img)
      setShowSendModal(true)
    } catch (err) {
      console.error('Erro ao gerar infográfico para envio:', err)
      alert('Não foi possível gerar o infográfico do relatório. Tente novamente.')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  // Bloqueio rigoroso de rolagem vertical no fundo (body, html e container .ad-main-scroll)
  useEffect(() => {
    if (!isOpen) return

    const origBodyOverflow = document.body.style.overflow
    const origBodyOverscroll = document.body.style.overscrollBehavior
    const origHtmlOverflow = document.documentElement.style.overflow
    const mainScroll = document.querySelector('.ad-main-scroll') as HTMLElement | null
    const origMainScrollOverflow = mainScroll?.style.overflow || ''

    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.documentElement.style.overflow = 'hidden'
    if (mainScroll) mainScroll.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = origBodyOverflow
      document.body.style.overscrollBehavior = origBodyOverscroll
      document.documentElement.style.overflow = origHtmlOverflow
      if (mainScroll) mainScroll.style.overflow = origMainScrollOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <ClientPortal>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 10005,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px 16px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          overscrollBehavior: 'none',
        }}
        onClick={onClose}
        onTouchMove={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
          }
        }}
        onWheel={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
          }
        }}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          style={{ 
            width: 880, 
            maxWidth: '100%', 
            maxHeight: 'min(92vh, 880px)',
            background: '#ffffff', 
            borderRadius: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            margin: 'auto'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header Superior Moderno */}
          <div 
            style={{ 
              padding: '20px 28px', 
              background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #7c3aed 100%)', 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 20px rgba(79, 70, 229, 0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Decoração sutil de fundo */}
            <div style={{ position: 'absolute', top: -40, right: 120, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -50, right: 40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 1 }}>
              <div 
                style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: 14, 
                  background: 'rgba(255, 255, 255, 0.18)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <Calendar size={22} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Relatório de Frequência Mensal
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
                  Acompanhamento de Comunicados, Relatórios de Rotina e Momentos por dia
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>
              <button
                type="button"
                onClick={fetchReport}
                disabled={isLoading}
                title="Atualizar dados"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <RotateCw size={16} className={isLoading ? 'ad-spin-icon' : ''} />
              </button>

              <button 
                type="button"
                onClick={onClose}
                title="Fechar modal"
                style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 10, 
                  background: 'rgba(255, 255, 255, 0.15)', 
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Barra de Filtros e Seleção de Mês */}
          <div 
            style={{ 
              padding: '14px 24px', 
              background: '#f8fafc', 
              borderBottom: '1px solid #e2e8f0',
              display: 'flex', 
              flexWrap: 'wrap', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            {/* Seletor de Mês e Ano Interativo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', padding: '4px 6px', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Mês anterior"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronLeft size={17} />
              </button>

              {/* Dropdown de Mês */}
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: '#1e293b',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  outline: 'none'
                }}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>

              {/* Dropdown de Ano */}
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: '#6366f1',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  outline: 'none'
                }}
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextMonth}
                title="Próximo mês"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronRight size={17} />
              </button>

              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={handleGoToCurrentMonth}
                  title="Ir para o mês atual"
                  style={{
                    marginLeft: 4,
                    padding: '3px 8px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: '#4f46e5',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                >
                  Mês Atual
                </button>
              )}
            </div>

            {/* Controles de Filtro: Usuário, Tipo e Anexos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Filtro por Usuário */}
              <div style={{ position: 'relative' }}>
                <User size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6366f1', pointerEvents: 'none' }} />
                <select
                  value={selectedAuthor}
                  onChange={e => setSelectedAuthor(e.target.value)}
                  style={{
                    height: 34,
                    paddingLeft: 30,
                    paddingRight: 24,
                    borderRadius: 12,
                    border: selectedAuthor !== 'todos' ? '1.5px solid #6366f1' : '1px solid #cbd5e1',
                    background: selectedAuthor !== 'todos' ? '#eef2ff' : '#ffffff',
                    color: selectedAuthor !== 'todos' ? '#4338ca' : '#334155',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                    maxWidth: 190
                  }}
                >
                  <option value="todos">👥 Todos os Usuários</option>
                  {colaboradores.map(c => (
                    <option key={c.id || c.nome} value={c.nome}>
                      {c.nome} {c.cargo ? `(${c.cargo})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Tipo */}
              <div style={{ position: 'relative' }}>
                <Filter size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6', pointerEvents: 'none' }} />
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  style={{
                    height: 34,
                    paddingLeft: 28,
                    paddingRight: 20,
                    borderRadius: 12,
                    border: selectedType !== 'todos' ? '1.5px solid #8b5cf6' : '1px solid #cbd5e1',
                    background: selectedType !== 'todos' ? '#f5f3ff' : '#ffffff',
                    color: selectedType !== 'todos' ? '#6d28d9' : '#334155',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="todos">Todos os Tipos</option>
                  <option value="comunicado">📢 Comunicados</option>
                  <option value="relatorio">📋 Relatórios</option>
                  <option value="momento">📸 Momentos</option>
                </select>
              </div>

              {/* Filtro por Anexo */}
              <div style={{ position: 'relative' }}>
                <Paperclip size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <select
                  value={selectedAttachment}
                  onChange={e => setSelectedAttachment(e.target.value)}
                  style={{
                    height: 34,
                    paddingLeft: 28,
                    paddingRight: 20,
                    borderRadius: 12,
                    border: selectedAttachment !== 'todos' ? '1.5px solid #ec4899' : '1px solid #cbd5e1',
                    background: selectedAttachment !== 'todos' ? '#fdf2f8' : '#ffffff',
                    color: selectedAttachment !== 'todos' ? '#be185d' : '#334155',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="todos">Todos Anexos</option>
                  <option value="qualquer">Com Anexo</option>
                  <option value="nenhum">Sem Anexo</option>
                  <option value="imagem">Imagens</option>
                  <option value="video">Vídeos</option>
                  <option value="formulario">Formulários</option>
                  <option value="relatorio">Relatórios</option>
                  <option value="enquete">Enquetes</option>
                  <option value="autorizacao">Autorizações</option>
                  <option value="cobranca">Cobranças</option>
                </select>
              </div>

              {/* Botão de Envio em Lote para Múltiplos Usuários */}
              <button
                type="button"
                onClick={() => setShowBatchSendModal(true)}
                title="Enviar relatórios personalizados para múltiplos colaboradores de uma vez"
                style={{
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <Users size={14} />
                <span>Enviar para Vários</span>
              </button>
            </div>
          </div>

          {/* Corpo do Modal com Scroll Customizado */}
          <div style={{ padding: '20px 28px', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* DESTAQUE DO USUÁRIO SELECIONADO (Solicitação explícita do usuário) */}
            <AnimatePresence>
              {selectedUserObj && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.12) 100%)',
                    border: '1.5px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: 18,
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.06)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div 
                      style={{ 
                        width: 46, 
                        height: 46, 
                        borderRadius: 16, 
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)', 
                        color: '#fff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 800,
                        boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)',
                        overflow: 'hidden'
                      }}
                    >
                      {selectedUserObj.foto ? (
                        <img 
                          src={selectedUserObj.foto} 
                          alt={selectedUserObj.nome} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      ) : (
                        selectedUserObj.nome.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Filtro Ativo • Usuário Selecionado
                        </span>
                        <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8 }}>
                          {selectedUserObj.cargo}
                        </span>
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                        {selectedUserObj.nome}
                      </div>
                    </div>
                  </div>

                  {/* Resumo rápido do usuário no mês */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', padding: '6px 12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Total no Mês:</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                        {selectedUserObj.stats?.total ?? reportData?.summary.totalGeral ?? 0}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                        📢 {selectedUserObj.stats?.comunicados ?? reportData?.summary.totalComunicados ?? 0} com.
                      </span>
                      <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                        📋 {selectedUserObj.stats?.relatorios ?? reportData?.summary.totalRelatorios ?? 0} rel.
                      </span>
                      <span style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#db2777', padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                        📸 {selectedUserObj.stats?.momentos ?? reportData?.summary.totalMomentos ?? 0} mom.
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleOpenSendModal}
                        disabled={isGeneratingImage}
                        title={`Enviar relatório oficial deste mês como comunicado para ${selectedUserObj.nome}`}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 10,
                          border: 'none',
                          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: isGeneratingImage ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
                          transition: 'all 0.2s',
                          opacity: isGeneratingImage ? 0.7 : 1
                        }}
                        onMouseEnter={e => { if (!isGeneratingImage) e.currentTarget.style.transform = 'translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
                      >
                        {isGeneratingImage ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Gerando imagem...</span>
                          </>
                        ) : (
                          <>
                            <Send size={13} />
                            <span>Enviar Relatório para {selectedUserObj.nome.split(' ')[0]}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedAuthor('todos')}
                        title="Ver todos os usuários"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#475569',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#475569'; }}
                      >
                        <X size={13} />
                        <span>Limpar filtro</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cards de Métricas Principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {/* Card 1: Período */}
              <div 
                style={{ 
                  background: '#f8fafc', 
                  padding: '16px 18px', 
                  borderRadius: 18, 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Mês de Referência
                  </span>
                  <Calendar size={15} color="#6366f1" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>
                  {reportData?.diasNoMes || 30} dias no período
                </div>
              </div>

              {/* Card 2: Total Geral de Envios */}
              <div 
                style={{ 
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.04), rgba(99, 102, 241, 0.08))', 
                  padding: '16px 18px', 
                  borderRadius: 18, 
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Publicado
                  </span>
                  <Layers size={15} color="#4f46e5" />
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#4f46e5', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  {isLoading ? '...' : (reportData?.summary.totalGeral || 0)}
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>envios</span>
                </div>
                {/* Micro badges com a quebra de tipos */}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#2563eb' }}>
                    📢 {reportData?.summary.totalComunicados || 0}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#7c3aed' }}>
                    📋 {reportData?.summary.totalRelatorios || 0}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#db2777' }}>
                    📸 {reportData?.summary.totalMomentos || 0}
                  </span>
                </div>
              </div>

              {/* Card 3: Dias com Envios */}
              <div 
                style={{ 
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04), rgba(5, 150, 105, 0.08))', 
                  padding: '16px 18px', 
                  borderRadius: 18, 
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Dias com Atividade
                  </span>
                  <CheckCircle2 size={15} color="#059669" />
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#059669' }}>
                  {isLoading ? '...' : (reportData?.summary.diasComEnvios || 0)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                    / {reportData?.diasNoMes || 30} dias
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: '#059669', marginTop: 4, fontWeight: 600 }}>
                  {reportData?.summary.diasNoMes 
                    ? `${Math.round(((reportData.summary.diasComEnvios || 0) / reportData.summary.diasNoMes) * 100)}% de frequência` 
                    : '--'}
                </div>
              </div>

              {/* Card 4: Ritmo / Média */}
              <div 
                style={{ 
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.04), rgba(217, 119, 6, 0.08))', 
                  padding: '16px 18px', 
                  borderRadius: 18, 
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#d97706', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Média por Dia Ativo
                  </span>
                  <TrendingUp size={15} color="#d97706" />
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#d97706' }}>
                  {isLoading ? '...' : (reportData?.summary.mediaPorDiaAtivo || '0')}
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginLeft: 4 }}>envios/dia</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>
                  Média nos dias com registro
                </div>
              </div>
            </div>

            {/* Barra de Composição Visual por Categoria */}
            {reportData && reportData.summary.totalGeral > 0 && (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>Distribuição de Conteúdo no Mês</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>
                    {reportData.summary.totalGeral} itens no total
                  </span>
                </div>

                {/* Segmented bar */}
                <div style={{ display: 'flex', height: 10, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9' }}>
                  {reportData.summary.totalComunicados > 0 && (
                    <div 
                      title={`Comunicados: ${reportData.summary.totalComunicados} (${Math.round((reportData.summary.totalComunicados / reportData.summary.totalGeral) * 100)}%)`}
                      style={{ 
                        width: `${(reportData.summary.totalComunicados / reportData.summary.totalGeral) * 100}%`, 
                        background: '#3b82f6',
                        transition: 'width 0.4s ease'
                      }} 
                    />
                  )}
                  {reportData.summary.totalRelatorios > 0 && (
                    <div 
                      title={`Relatórios: ${reportData.summary.totalRelatorios} (${Math.round((reportData.summary.totalRelatorios / reportData.summary.totalGeral) * 100)}%)`}
                      style={{ 
                        width: `${(reportData.summary.totalRelatorios / reportData.summary.totalGeral) * 100}%`, 
                        background: '#8b5cf6',
                        transition: 'width 0.4s ease'
                      }} 
                    />
                  )}
                  {reportData.summary.totalMomentos > 0 && (
                    <div 
                      title={`Momentos: ${reportData.summary.totalMomentos} (${Math.round((reportData.summary.totalMomentos / reportData.summary.totalGeral) * 100)}%)`}
                      style={{ 
                        width: `${(reportData.summary.totalMomentos / reportData.summary.totalGeral) * 100}%`, 
                        background: '#ec4899',
                        transition: 'width 0.4s ease'
                      }} 
                    />
                  )}
                </div>

                {/* Legenda com percentuais */}
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11.5, fontWeight: 700, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: '#3b82f6' }} />
                    <span>Comunicados ({reportData.summary.totalComunicados}) • {Math.round((reportData.summary.totalComunicados / reportData.summary.totalGeral) * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7c3aed' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: '#8b5cf6' }} />
                    <span>Relatórios ({reportData.summary.totalRelatorios}) • {Math.round((reportData.summary.totalRelatorios / reportData.summary.totalGeral) * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#db2777' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: '#ec4899' }} />
                    <span>Momentos ({reportData.summary.totalMomentos}) • {Math.round((reportData.summary.totalMomentos / reportData.summary.totalGeral) * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* SEÇÃO PRINCIPAL: CALENDÁRIO COM DIFERENCIAÇÃO */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>Calendário de Envios Diários</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>• Clique em um dia para ver os envios</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {reportData?.autores && reportData.autores.length > 0 && selectedAuthor === 'todos' && (
                    <button
                      type="button"
                      onClick={() => setShowAuthorsRanking(prev => !prev)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        background: showAuthorsRanking ? '#eef2ff' : '#ffffff',
                        color: showAuthorsRanking ? '#4f46e5' : '#64748b',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <Users size={13} />
                      <span>{showAuthorsRanking ? 'Ocultar Colaboradores' : 'Ver Colaboradores do Mês'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    title="Copiar resumo textual para colar no WhatsApp ou documento"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      color: copiedSummary ? '#059669' : '#64748b',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5
                    }}
                  >
                    {copiedSummary ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedSummary ? 'Copiado!' : 'Copiar Resumo'}</span>
                  </button>
                </div>
              </div>

              {/* Ranking / Lista de Autores do Mês (expansível) */}
              <AnimatePresence>
                {showAuthorsRanking && reportData?.autores && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      marginBottom: 16,
                      background: '#f8fafc',
                      borderRadius: 16,
                      border: '1px solid #e2e8f0',
                      padding: '14px 18px',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 10 }}>
                      Colaboradores que enviaram publicações neste mês (clique para filtrar):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {reportData.autores.map(a => (
                        <button
                          key={a.nome}
                          type="button"
                          onClick={() => setSelectedAuthor(a.nome)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 12,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#6366f1'
                            e.currentTarget.style.background = '#eef2ff'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#e2e8f0'
                            e.currentTarget.style.background = '#ffffff'
                          }}
                        >
                          <span>{a.nome}</span>
                          <span style={{ background: '#f1f5f9', color: '#6366f1', padding: '1px 6px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                            {a.total}
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cabeçalho dos Dias da Semana */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 800, color: '#64748b', paddingBottom: 4 }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid dos Dias do Calendário */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {/* Espaços vazios para offset do início do mês */}
                {Array.from({ length: reportData?.startDayOfWeek ?? new Date(selectedYear, selectedMonth - 1, 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ minHeight: 74, opacity: 0.2 }} />
                ))}

                {/* Dias do Mês */}
                {Array.from({ length: reportData?.diasNoMes ?? new Date(selectedYear, selectedMonth, 0).getDate() }).map((_, i) => {
                  const day = i + 1
                  const dayData = reportData?.dias ? reportData.dias[day] : null
                  const qtd = dayData?.total || 0
                  const comsQtd = dayData?.comunicados || 0
                  const relsQtd = dayData?.relatorios || 0
                  const momsQtd = dayData?.momentos || 0

                  const isToday = isCurrentMonth && day === today.getDate()
                  const isSelected = selectedDay === day

                  // Determinar visual do card
                  let bg = '#f8fafc'
                  let border = '1px solid #e2e8f0'
                  let shadow = 'none'

                  if (qtd > 0) {
                    bg = '#ffffff'
                    border = '1px solid #cbd5e1'
                    shadow = '0 2px 5px rgba(0,0,0,0.03)'
                    if (qtd >= 5) {
                      border = '1.5px solid rgba(99, 102, 241, 0.4)'
                      shadow = '0 3px 8px rgba(99, 102, 241, 0.08)'
                    }
                  }

                  if (isSelected) {
                    border = '2px solid #6366f1'
                    shadow = '0 0 0 3px rgba(99, 102, 241, 0.25), 0 4px 12px rgba(99, 102, 241, 0.15)'
                    bg = '#ffffff'
                  }

                  return (
                    <div 
                      key={day} 
                      onClick={() => {
                        if (qtd > 0) {
                          setSelectedDay(isSelected ? null : day)
                          setDayTypeFilter('todos')
                        } else {
                          setSelectedDay(isSelected ? null : day)
                        }
                      }}
                      style={{ 
                        background: bg, 
                        border: border,
                        borderRadius: 14, 
                        padding: '10px 8px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: 78,
                        position: 'relative',
                        cursor: qtd > 0 ? 'pointer' : 'default',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: shadow
                      }}
                      onMouseEnter={e => {
                        if (qtd > 0 && !isSelected) {
                          e.currentTarget.style.borderColor = '#818cf8'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 6px 14px rgba(99, 102, 241, 0.12)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = border.replace(/.*solid\s/, '')
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = shadow
                        }
                      }}
                    >
                      {/* Ponto indicador de Hoje */}
                      {isToday && (
                        <div 
                          title="Hoje"
                          style={{ 
                            position: 'absolute', 
                            top: 6, 
                            right: 6, 
                            width: 8, 
                            height: 8, 
                            background: '#3b82f6', 
                            borderRadius: '50%', 
                            boxShadow: '0 0 0 2px #fff'
                          }} 
                        />
                      )}

                      {/* Número do Dia */}
                      <span 
                        style={{ 
                          fontSize: 14, 
                          fontWeight: isToday ? 900 : 800, 
                          color: isToday ? '#2563eb' : (qtd > 0 ? '#0f172a' : '#94a3b8')
                        }}
                      >
                        {day}
                      </span>

                      {/* Tags de Diferenciação por Categoria */}
                      {qtd > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', alignItems: 'center', marginTop: 4 }}>
                          {/* Mini pills categorizadas */}
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {comsQtd > 0 && (
                              <span 
                                title={`${comsQtd} comunicado(s)`}
                                style={{ 
                                  fontSize: 9.5, 
                                  fontWeight: 800, 
                                  background: 'rgba(59, 130, 246, 0.12)', 
                                  color: '#1d4ed8', 
                                  padding: '1px 4px', 
                                  borderRadius: 5,
                                  lineHeight: 1.2
                                }}
                              >
                                📢 {comsQtd}
                              </span>
                            )}
                            {relsQtd > 0 && (
                              <span 
                                title={`${relsQtd} relatório(s) de rotina`}
                                style={{ 
                                  fontSize: 9.5, 
                                  fontWeight: 800, 
                                  background: 'rgba(124, 58, 237, 0.12)', 
                                  color: '#6d28d9', 
                                  padding: '1px 4px', 
                                  borderRadius: 5,
                                  lineHeight: 1.2
                                }}
                              >
                                📋 {relsQtd}
                              </span>
                            )}
                            {momsQtd > 0 && (
                              <span 
                                title={`${momsQtd} momento(s)`}
                                style={{ 
                                  fontSize: 9.5, 
                                  fontWeight: 800, 
                                  background: 'rgba(236, 72, 153, 0.12)', 
                                  color: '#be185d', 
                                  padding: '1px 4px', 
                                  borderRadius: 5,
                                  lineHeight: 1.2
                                }}
                              >
                                📸 {momsQtd}
                              </span>
                            )}
                          </div>

                          {/* Total badge */}
                          <span 
                            style={{ 
                              fontSize: 10, 
                              fontWeight: 700, 
                              color: '#64748b',
                              marginTop: 2
                            }}
                          >
                            {qtd} {qtd === 1 ? 'envio' : 'envios'}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>-</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* PAINEL DE DETALHAMENTO DO DIA SELECIONADO */}
            <AnimatePresence>
              {selectedDay !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #6366f1',
                    borderRadius: 18,
                    padding: '18px 20px',
                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.12)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>
                        {selectedDay}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                          Envios de {selectedDay} de {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}
                        </h4>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                          {selectedDayData?.total || 0} publicações registradas neste dia
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Abas de filtro no dia */}
                      {selectedDayData && selectedDayData.total > 0 && (
                        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
                          <button
                            type="button"
                            onClick={() => setDayTypeFilter('todos')}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 8,
                              border: 'none',
                              fontSize: 11,
                              fontWeight: 700,
                              background: dayTypeFilter === 'todos' ? '#ffffff' : 'transparent',
                              color: dayTypeFilter === 'todos' ? '#0f172a' : '#64748b',
                              cursor: 'pointer',
                              boxShadow: dayTypeFilter === 'todos' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                            }}
                          >
                            Todos ({selectedDayData.total})
                          </button>
                          {selectedDayData.comunicados > 0 && (
                            <button
                              type="button"
                              onClick={() => setDayTypeFilter('comunicado')}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 8,
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 700,
                                background: dayTypeFilter === 'comunicado' ? '#3b82f6' : 'transparent',
                                color: dayTypeFilter === 'comunicado' ? '#ffffff' : '#2563eb',
                                cursor: 'pointer'
                              }}
                            >
                              📢 {selectedDayData.comunicados}
                            </button>
                          )}
                          {selectedDayData.relatorios > 0 && (
                            <button
                              type="button"
                              onClick={() => setDayTypeFilter('relatorio')}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 8,
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 700,
                                background: dayTypeFilter === 'relatorio' ? '#8b5cf6' : 'transparent',
                                color: dayTypeFilter === 'relatorio' ? '#ffffff' : '#7c3aed',
                                cursor: 'pointer'
                              }}
                            >
                              📋 {selectedDayData.relatorios}
                            </button>
                          )}
                          {selectedDayData.momentos > 0 && (
                            <button
                              type="button"
                              onClick={() => setDayTypeFilter('momento')}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 8,
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 700,
                                background: dayTypeFilter === 'momento' ? '#ec4899' : 'transparent',
                                color: dayTypeFilter === 'momento' ? '#ffffff' : '#db2777',
                                cursor: 'pointer'
                              }}
                            >
                              📸 {selectedDayData.momentos}
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedDay(null)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: 'none',
                          background: '#f1f5f9',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Lista de Itens do Dia */}
                  {dayItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
                      Nenhuma publicação encontrada para o filtro selecionado neste dia.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                      {dayItems.map(item => {
                        const isRel = item.tipo === 'relatorio'
                        const isMom = item.tipo === 'momento'
                        const isCom = item.tipo === 'comunicado'

                        let badgeBg = 'rgba(59, 130, 246, 0.1)'
                        let badgeColor = '#2563eb'
                        let badgeLabel = 'Comunicado'
                        let badgeBorder = '1px solid rgba(59, 130, 246, 0.2)'

                        if (isRel) {
                          badgeBg = 'rgba(124, 58, 237, 0.1)'
                          badgeColor = '#7c3aed'
                          badgeLabel = 'Relatório de Rotina'
                          badgeBorder = '1px solid rgba(124, 58, 237, 0.2)'
                        } else if (isMom) {
                          badgeBg = 'rgba(236, 72, 153, 0.1)'
                          badgeColor = '#db2777'
                          badgeLabel = 'Momento'
                          badgeBorder = '1px solid rgba(236, 72, 153, 0.2)'
                        }

                        return (
                          <div
                            key={item.id}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 14,
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 14,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{ background: badgeBg, color: badgeColor, border: badgeBorder, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                                  {isCom && '📢 '}
                                  {isRel && '📋 '}
                                  {isMom && '📸 '}
                                  {badgeLabel}
                                </span>

                                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.titulo}
                                </span>

                                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Clock size={11} /> {item.horario}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <User size={12} color="#6366f1" />
                                  <span style={{ fontWeight: 700, color: '#334155' }}>{item.autor}</span>
                                  {item.autorCargo && <span style={{ color: '#94a3b8' }}>({item.autorCargo})</span>}
                                </div>

                                {item.turmas && item.turmas.length > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Users size={12} color="#10b981" />
                                    <span style={{ fontWeight: 600, color: '#059669' }}>
                                      {item.turmas.join(', ')}
                                    </span>
                                  </div>
                                )}

                                {item.anexosCount > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Paperclip size={12} color="#f59e0b" />
                                    <span>{item.anexosCount} anexo(s)</span>
                                  </div>
                                )}

                                {item.midiasCount > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Camera size={12} color="#ec4899" />
                                    <span>{item.midiasCount} foto(s)/vídeo(s)</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Ação de Visualização */}
                            {onSelectComunicado && item.tipo !== 'momento' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectComunicado(item.raw)
                                  onClose()
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 10,
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  color: '#4f46e5',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#4f46e5'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = '#4f46e5'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#4f46e5'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                              >
                                <Eye size={13} />
                                <span>Ver Detalhes</span>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Legenda Informativa Inferior */}
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: 16, 
                paddingTop: 12, 
                borderTop: '1px solid #f1f5f9',
                fontSize: 12, 
                fontWeight: 600, 
                color: '#64748b' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: '#334155' }}>Categorias:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13 }}>📢</span>
                  <span style={{ color: '#2563eb', fontWeight: 700 }}>Comunicados</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13 }}>📋</span>
                  <span style={{ color: '#7c3aed', fontWeight: 700 }}>Relatórios de Rotina</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13 }}>📸</span>
                  <span style={{ color: '#db2777', fontWeight: 700 }}>Momentos Fotográficos</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: '#f8fafc', border: '1px solid #e2e8f0' }} />
                  <span>0 envios</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: '#ffffff', border: '1px solid #cbd5e1' }} />
                  <span>1-4 envios</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: '#ffffff', border: '1.5px solid rgba(99, 102, 241, 0.4)' }} />
                  <span>5+ envios</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal de envio do relatório para o colaborador selecionado */}
        {selectedUserObj && showSendModal && (
          <EnviarRelatorioColaboradorModal
            key={`send-modal-${selectedUserObj.nome}-${selectedMonth}-${selectedYear}-${selectedUserObj.stats?.total ?? reportData?.summary.totalGeral ?? 0}`}
            isOpen={showSendModal}
            onClose={() => setShowSendModal(false)}
            colaboradorNome={selectedUserObj.nome}
            colaboradorId={colaboradores.find(c => c.nome?.trim().toLowerCase() === selectedUserObj.nome.trim().toLowerCase())?.id}
            colaboradorCargo={selectedUserObj.cargo}
            colaboradorFoto={selectedUserObj.foto}
            mes={selectedMonth}
            ano={selectedYear}
            summary={{
              totalGeral: selectedUserObj.stats?.total ?? reportData?.summary.totalGeral ?? 0,
              totalComunicados: selectedUserObj.stats?.comunicados ?? reportData?.summary.totalComunicados ?? 0,
              totalRelatorios: selectedUserObj.stats?.relatorios ?? reportData?.summary.totalRelatorios ?? 0,
              totalMomentos: selectedUserObj.stats?.momentos ?? reportData?.summary.totalMomentos ?? 0,
              diasComEnvios: reportData?.summary.diasComEnvios ?? 0,
              diasNoMes: reportData?.diasNoMes ?? 30,
              mediaPorDiaAtivo: reportData?.summary.mediaPorDiaAtivo ?? '0'
            }}
            imageBase64={generatedImageBase64}
            onSuccess={() => {
              setSendSuccessToast(`Relatório oficial enviado com sucesso para ${selectedUserObj.nome}!`)
              setTimeout(() => setSendSuccessToast(null), 4000)
            }}
          />
        )}

        {/* Modal de envio de relatório em lote para múltiplos colaboradores */}
        {showBatchSendModal && (
          <EnviarRelatorioEmLoteModal
            isOpen={showBatchSendModal}
            onClose={() => setShowBatchSendModal(false)}
            colaboradores={colaboradores}
            autoresReport={reportData?.autores || []}
            mes={selectedMonth}
            ano={selectedYear}
            diasNoMes={reportData?.diasNoMes || 30}
            onSuccessBatch={(totalEnviados) => {
              setSendSuccessToast(`Envio em lote concluído com sucesso para ${totalEnviados} colaboradores!`)
              setTimeout(() => setSendSuccessToast(null), 5000)
            }}
          />
        )}

        {/* Toast Notificação de Sucesso */}
        <AnimatePresence>
          {sendSuccessToast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              style={{
                position: 'fixed',
                bottom: 30,
                right: 30,
                zIndex: 999999,
                background: '#0f172a',
                color: '#ffffff',
                padding: '14px 20px',
                borderRadius: 14,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: '1px solid rgba(16, 185, 129, 0.4)'
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 50, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Comunicado Enviado!</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{sendSuccessToast}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </ClientPortal>
  )
}
