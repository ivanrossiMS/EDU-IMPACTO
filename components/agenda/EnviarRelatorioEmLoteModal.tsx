'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, X, User, Crown, CheckCircle2, AlertCircle, 
  Search, CheckSquare, Square, Users, Calendar, 
  Loader2, Sparkles, Filter, ChevronDown, ChevronUp, AlertTriangle, ArrowRight, FileText
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { generateFrequencyReportImage } from '@/lib/reportCanvasGenerator'

interface ColaboradorItem {
  id?: string
  nome: string
  cargo?: string
  perfil?: string
  foto?: string | null
}

interface AuthorStats {
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
}

interface EnviarRelatorioEmLoteModalProps {
  isOpen: boolean
  onClose: () => void
  colaboradores: ColaboradorItem[]
  autoresReport: AuthorStats[]
  mes: number
  ano: number
  diasNoMes: number
  onSuccessBatch: (totalEnviados: number) => void
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

export function EnviarRelatorioEmLoteModal({
  isOpen,
  onClose,
  colaboradores,
  autoresReport,
  mes,
  ano,
  diasNoMes,
  onSuccessBatch
}: EnviarRelatorioEmLoteModalProps) {
  const mesNome = MONTH_NAMES[mes - 1]

  // Estado da lista enriquecida de colaboradores
  const enrichedColabs = useMemo(() => {
    return colaboradores.map(c => {
      const matchReport = autoresReport.find(
        a => a.nome.trim().toLowerCase() === c.nome.trim().toLowerCase()
      )
      return {
        id: c.id,
        nome: c.nome,
        cargo: c.cargo || c.perfil || matchReport?.cargo || 'Colaborador(a)',
        foto: c.foto || matchReport?.foto || null,
        stats: matchReport ? {
          total: matchReport.total,
          comunicados: matchReport.comunicados,
          relatorios: matchReport.relatorios,
          momentos: matchReport.momentos,
          diasComEnvios: matchReport.diasComEnvios ?? 0,
          dias: matchReport.dias || null
        } : {
          total: 0,
          comunicados: 0,
          relatorios: 0,
          momentos: 0,
          diasComEnvios: 0,
          dias: null
        }
      }
    }).sort((a, b) => {
      // Priorizar quem tem mais envios, depois ordem alfabética
      if (b.stats.total !== a.stats.total) return b.stats.total - a.stats.total
      return a.nome.localeCompare(b.nome)
    })
  }, [colaboradores, autoresReport])

  // Seleção de usuários (conjunto de nomes)
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'com_envios' | 'sem_envios'>('todos')
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templatePreviewTab, setTemplatePreviewTab] = useState<'com_envios' | 'zero_envios'>('com_envios')

  // Estados do processamento em lote
  const [isProcessing, setIsProcessing] = useState(false)
  const [processLogs, setProcessLogs] = useState<Array<{
    nome: string
    status: 'pending' | 'processing' | 'success' | 'error'
    message?: string
  }>>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedSuccessCount, setCompletedSuccessCount] = useState(0)
  const [isAborted, setIsAborted] = useState(false)
  const [batchFinished, setBatchFinished] = useState(false)

  // Inicializar seleção: selecionar por padrão os colaboradores que têm envios no mês
  useEffect(() => {
    if (isOpen) {
      const initialSelected = new Set<string>()
      enrichedColabs.forEach(c => {
        if (c.stats.total > 0) {
          initialSelected.add(c.nome)
        }
      })
      setSelectedNames(initialSelected)
      setIsProcessing(false)
      setBatchFinished(false)
      setProcessLogs([])
      setCurrentIndex(0)
      setCompletedSuccessCount(0)
      setIsAborted(false)
    }
  }, [isOpen, enrichedColabs])

  // Filtragem da lista exibida
  const filteredList = useMemo(() => {
    return enrichedColabs.filter(c => {
      const matchSearch = c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.cargo.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchSearch) return false

      if (statusFilter === 'com_envios') return c.stats.total > 0
      if (statusFilter === 'sem_envios') return c.stats.total === 0
      return true
    })
  }, [enrichedColabs, searchQuery, statusFilter])

  // Contadores
  const comEnviosCount = useMemo(() => enrichedColabs.filter(c => c.stats.total > 0).length, [enrichedColabs])
  const semEnviosCount = useMemo(() => enrichedColabs.filter(c => c.stats.total === 0).length, [enrichedColabs])

  // Toggle de seleção individual
  const toggleSelect = (nome: string) => {
    if (isProcessing) return
    setSelectedNames(prev => {
      const next = new Set(prev)
      if (next.has(nome)) next.delete(nome)
      else next.add(nome)
      return next
    })
  }

  // Selecionar todos os visíveis no filtro atual
  const selectAllVisible = () => {
    if (isProcessing) return
    setSelectedNames(prev => {
      const next = new Set(prev)
      filteredList.forEach(c => next.add(c.nome))
      return next
    })
  }

  // Desmarcar todos os visíveis
  const deselectAllVisible = () => {
    if (isProcessing) return
    setSelectedNames(prev => {
      const next = new Set(prev)
      filteredList.forEach(c => next.delete(c.nome))
      return next
    })
  }

  // Selecionar todos os colaboradores
  const selectAll = () => {
    if (isProcessing) return
    const all = new Set<string>()
    enrichedColabs.forEach(c => all.add(c.nome))
    setSelectedNames(all)
  }

  // Selecionar apenas colaboradores com envios
  const selectOnlyWithActivity = () => {
    if (isProcessing) return
    const withActivity = new Set<string>()
    enrichedColabs.forEach(c => {
      if (c.stats.total > 0) withActivity.add(c.nome)
    })
    setSelectedNames(withActivity)
  }

  // Selecionar apenas colaboradores com 0 envios
  const selectOnlyZeroActivity = () => {
    if (isProcessing) return
    const zeroActivity = new Set<string>()
    enrichedColabs.forEach(c => {
      if (c.stats.total === 0) zeroActivity.add(c.nome)
    })
    setSelectedNames(zeroActivity)
  }

  // Desmarcar todos
  const deselectAll = () => {
    if (isProcessing) return
    setSelectedNames(new Set())
  }

  // Construir mensagem personalizada para um colaborador específico
  const buildMensagemParaColaborador = (nome: string, stats: typeof enrichedColabs[0]['stats']) => {
    const pctAssiduidade = diasNoMes > 0 
      ? Math.round((stats.diasComEnvios / diasNoMes) * 100) 
      : 0

    if (stats.total === 0) {
      return `Olá, ${nome}! 👋

A Direção Geral e Administração Master informa que, referente ao período de ${mesNome} de ${ano} na Agenda Digital do Colégio Impacto, não foram identificados registros de publicações no seu perfil.

📊 Resumo de Suas Atividades no Período:
• Total de Publicações Realizadas: 0 envios
• 📢 Comunicados Gerais: 0
• 📋 Relatórios de Rotina Diária: 0
• 📸 Momentos Fotográficos: 0
• 📅 Dias com Atividade: 0 de ${diasNoMes} dias (0% de assiduidade)

Pedimos zelo e compromisso com o registro pedagógico dos nossos alunos e na comunicação transparente com as famílias!

Confira em anexo o seu relatório oficial de acompanhamento do período. Caso tenha ocorrido alguma divergência em seus lançamentos, procure a coordenação.

Atenciosamente,
Ivan Rossi
Administrador Master • Diretor Geral
Colégio Impacto`
    }

    return `Olá, ${nome}! 👋

A Direção Geral e Administração Master preparou e disponibiliza o seu Relatório Oficial de Frequência e Envios referente ao período de ${mesNome} de ${ano} na Agenda Digital do Colégio Impacto.

📊 Resumo de Suas Atividades no Período:
• Total de Publicações Realizadas: ${stats.total} envios
• 📢 Comunicados Gerais: ${stats.comunicados}
• 📋 Relatórios de Rotina Diária: ${stats.relatorios}
• 📸 Momentos Fotográficos: ${stats.momentos}
• 📅 Dias com Atividade: ${stats.diasComEnvios} de ${diasNoMes} dias (${pctAssiduidade}% de assiduidade)

Pedimos zelo e compromisso com o registro pedagógico dos nossos alunos e na comunicação transparente com as famílias!

Confira em anexo o seu infográfico com o calendário detalhado de envios.

Atenciosamente,
Ivan Rossi
Administrador Master • Diretor Geral
Colégio Impacto`
  }

  // Iniciar Envio em Lote
  const handleStartBatchSend = async () => {
    const targets = enrichedColabs.filter(c => selectedNames.has(c.nome))
    if (targets.length === 0) {
      alert('Selecione ao menos um colaborador para realizar o envio.')
      return
    }

    setIsProcessing(true)
    setIsAborted(false)
    setBatchFinished(false)
    setCurrentIndex(0)
    setCompletedSuccessCount(0)

    // Inicializar logs
    const initialLogs = targets.map(t => ({
      nome: t.nome,
      status: 'pending' as const
    }))
    setProcessLogs(initialLogs)

    let successCount = 0

    for (let i = 0; i < targets.length; i++) {
      if (isAborted) break

      const current = targets[i]
      setCurrentIndex(i + 1)

      // Atualizar status para processando
      setProcessLogs(prev => prev.map((log, idx) => idx === i ? { ...log, status: 'processing' } : log))

      try {
        // 1. Preparar mapa de dias do autor
        let authorDias = current.stats.dias
        if (!authorDias) {
          authorDias = {}
          for (let d = 1; d <= diasNoMes; d++) {
            authorDias[d] = { total: 0, comunicados: 0, relatorios: 0, momentos: 0 }
          }
        }

        const summaryData = {
          totalGeral: current.stats.total,
          totalComunicados: current.stats.comunicados,
          totalRelatorios: current.stats.relatorios,
          totalMomentos: current.stats.momentos,
          diasComEnvios: current.stats.diasComEnvios,
          diasNoMes: diasNoMes,
          mediaPorDiaAtivo: current.stats.diasComEnvios > 0 
            ? (current.stats.total / current.stats.diasComEnvios).toFixed(1) 
            : '0'
        }

        // 2. Gerar infográfico personalizado para este colaborador
        const imageBase64 = await generateFrequencyReportImage({
          colaboradorNome: current.nome,
          colaboradorCargo: current.cargo,
          mes,
          ano,
          summary: summaryData,
          dias: authorDias
        })

        // 3. Montar mensagem personalizada
        const textoMsg = buildMensagemParaColaborador(current.nome, current.stats)
        const tituloMsg = `📊 Relatório Oficial de Frequência e Envios - ${mesNome}/${ano}`

        // 4. Disparar chamada de envio via API
        const res = await fetch('/api/agenda/relatorio-frequencia/enviar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            colaboradorNome: current.nome,
            colaboradorId: current.id,
            mes,
            ano,
            summary: summaryData,
            customTitulo: tituloMsg,
            customMensagem: textoMsg.replace(/\n/g, '<br />'),
            imageBase64
          })
        })

        const resData = await res.json()
        if (!res.ok || resData.error) {
          throw new Error(resData.error || 'Erro no envio')
        }

        // Sucesso
        successCount++
        setCompletedSuccessCount(successCount)
        setProcessLogs(prev => prev.map((log, idx) => idx === i ? { ...log, status: 'success' } : log))

        // Disparar evento para atualizar feed de comunicados na tela de fundo
        window.dispatchEvent(new CustomEvent('ad:comunicados-insert', {
          detail: { id: resData.comunicadoId, titulo: tituloMsg }
        }))

      } catch (err: any) {
        console.error(`Erro ao enviar relatório para ${current.nome}:`, err)
        setProcessLogs(prev => prev.map((log, idx) => idx === i ? { 
          ...log, 
          status: 'error', 
          message: err.message || 'Falha ao processar' 
        } : log))
      }

      // Pequena pausa defensiva (250ms) para não sobrecarregar backend/push
      await new Promise(r => setTimeout(r, 250))
    }

    setIsProcessing(false)
    setBatchFinished(true)
    if (successCount > 0) {
      onSuccessBatch(successCount)
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

  const selectedTargets = enrichedColabs.filter(c => selectedNames.has(c.nome))
  const progressPercent = processLogs.length > 0 
    ? Math.round((completedSuccessCount / processLogs.length) * 100) 
    : 0

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
          zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          overscrollBehavior: 'none',
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!isProcessing) onClose()
        }}
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
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#ffffff',
            borderRadius: 24,
            width: '100%',
            maxWidth: 780,
            maxHeight: 'min(92vh, 860px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
            border: '1px solid #e2e8f0',
            margin: 'auto',
            position: 'relative',
          }}
        >
          {/* Header Superior */}
          <div 
            style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #7c3aed 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div 
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(8px)'
                }}
              >
                <Users size={22} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Envio de Relatórios em Lote por Comunicado
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.85)' }}>
                  Disparo individual e personalizado para {mesNome}/{ano}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              title="Fechar"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.5 : 1
              }}
            >
              <X size={17} />
            </button>
          </div>

          {/* Cards de Remetente e Período */}
          <div style={{ padding: '14px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: '1 1 280px', display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', padding: '10px 14px', borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Crown size={18} />
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5 }}>Remetente Oficial</span>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Ivan Rossi</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Administrador Master • Direção Geral</div>
              </div>
            </div>

            <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', padding: '10px 14px', borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                <Calendar size={18} />
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Período de Referência</span>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{mesNome} de {ano}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{diasNoMes} dias no mês</div>
              </div>
            </div>
          </div>

          {/* Seção Principal: Seleção ou Tela de Progresso */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isProcessing || batchFinished ? (
              // TELA DE PROGRESSO DO DISPARO
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isProcessing ? (
                        <Loader2 size={18} className="animate-spin text-indigo-600" />
                      ) : (
                        <CheckCircle2 size={18} color="#10b981" />
                      )}
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                        {isProcessing 
                          ? `Enviando ${currentIndex} de ${processLogs.length}...` 
                          : `Disparo Concluído! (${completedSuccessCount} de ${processLogs.length} enviados)`}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#4f46e5' }}>
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.3 }}
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #4f46e5, #10b981)',
                        borderRadius: 10
                      }}
                    />
                  </div>
                </div>

                {/* Lista de Status Individual */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
                  {processLogs.map((log, idx) => (
                    <div
                      key={log.nome}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: log.status === 'processing' 
                          ? '#eef2ff' 
                          : log.status === 'success' 
                            ? '#f0fdf4' 
                            : log.status === 'error' 
                              ? '#fef2f2' 
                              : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>#{idx + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{log.nome}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {log.status === 'pending' && (
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#94a3b8' }}>Aguardando fila</span>
                        )}
                        {log.status === 'processing' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4f46e5', fontSize: 12, fontWeight: 700 }}>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Gerando relatório e enviando...</span>
                          </div>
                        )}
                        {log.status === 'success' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', fontSize: 12, fontWeight: 800 }}>
                            <CheckCircle2 size={15} />
                            <span>Enviado com sucesso!</span>
                          </div>
                        )}
                        {log.status === 'error' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#dc2626', fontSize: 12, fontWeight: 700 }}>
                            <AlertCircle size={15} />
                            <span>{log.message || 'Falha no envio'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // TELA DE SELEÇÃO DE COLABORADORES
              <>
                {/* Barra de Busca e Filtros Rápidos */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ position: 'relative', flex: '1 1 240px' }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Buscar por colaborador ou cargo..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        paddingLeft: 34,
                        paddingRight: 12,
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Tabs de Filtro */}
                  <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 3, borderRadius: 12 }}>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('todos')}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 9,
                        border: 'none',
                        background: statusFilter === 'todos' ? '#ffffff' : 'transparent',
                        color: statusFilter === 'todos' ? '#0f172a' : '#64748b',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: statusFilter === 'todos' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      Todos ({enrichedColabs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('com_envios')}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 9,
                        border: 'none',
                        background: statusFilter === 'com_envios' ? '#ffffff' : 'transparent',
                        color: statusFilter === 'com_envios' ? '#16a34a' : '#64748b',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: statusFilter === 'com_envios' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      Com Envios ({comEnviosCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('sem_envios')}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 9,
                        border: 'none',
                        background: statusFilter === 'sem_envios' ? '#ffffff' : 'transparent',
                        color: statusFilter === 'sem_envios' ? '#d97706' : '#64748b',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: statusFilter === 'sem_envios' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      Sem Envios ({semEnviosCount})
                    </button>
                  </div>
                </div>

                {/* Barra de Ações Rápidas de Seleção */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                      {selectedNames.size} de {enrichedColabs.length} selecionados
                    </span>
                    {selectedNames.size > 0 && (
                      <span style={{ background: '#eef2ff', color: '#4f46e5', padding: '2px 8px', borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
                        {selectedNames.size} comunicados a enviar
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={selectAll}
                      title="Selecionar todos os colaboradores da escola"
                      style={{
                        padding: '4px 9px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      Todos ({enrichedColabs.length})
                    </button>
                    <button
                      type="button"
                      onClick={selectOnlyWithActivity}
                      title="Selecionar apenas quem tem envios no mês"
                      style={{
                        padding: '4px 9px',
                        borderRadius: 8,
                        border: '1px solid #bbf7d0',
                        background: '#f0fdf4',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#166534',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      Com Envios ({comEnviosCount})
                    </button>
                    <button
                      type="button"
                      onClick={selectOnlyZeroActivity}
                      title="Selecionar colaboradores com 0 envios para cobrança/alerta institucional"
                      style={{
                        padding: '4px 9px',
                        borderRadius: 8,
                        border: '1px solid #fde68a',
                        background: '#fffbeb',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#b45309',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      ⚠️ Sem Envios ({semEnviosCount})
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                {/* Lista de Colaboradores com Scroll */}
                <div 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 320,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    padding: 8,
                    background: '#f8fafc'
                  }}
                >
                  {filteredList.length === 0 ? (
                    <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      Nenhum colaborador encontrado com os filtros atuais.
                    </div>
                  ) : (
                    filteredList.map(c => {
                      const isSelected = selectedNames.has(c.nome)
                      return (
                        <div
                          key={c.id || c.nome}
                          onClick={() => toggleSelect(c.nome)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: isSelected ? '#ffffff' : '#f8fafc',
                            border: isSelected ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 2px 6px rgba(99, 102, 241, 0.12)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ color: isSelected ? '#4f46e5' : '#94a3b8' }}>
                              {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                            </div>

                            {/* Avatar */}
                            <div 
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                background: isSelected ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#cbd5e1',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                fontWeight: 800,
                                overflow: 'hidden'
                              }}
                            >
                              {c.foto ? (
                                <img src={c.foto} alt={c.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                c.nome.charAt(0).toUpperCase()
                              )}
                            </div>

                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                                {c.nome}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {c.cargo}
                              </div>
                            </div>
                          </div>

                          {/* Métricas do Mês */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {c.stats.total > 0 ? (
                              <>
                                <span style={{ background: '#eef2ff', color: '#4338ca', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                                  {c.stats.total} envios ({c.stats.diasComEnvios} dias)
                                </span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {c.stats.comunicados > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb' }}>📢 {c.stats.comunicados}</span>
                                  )}
                                  {c.stats.relatorios > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>📋 {c.stats.relatorios}</span>
                                  )}
                                  {c.stats.momentos > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#db2777' }}>📸 {c.stats.momentos}</span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                                0 envios no mês
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Botão de Prévia do Modelo da Mensagem */}
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowTemplateModal(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#6366f1'
                      e.currentTarget.style.background = '#eef2ff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1'
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: '#e0e7ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4f46e5'
                      }}>
                        <FileText size={17} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ color: '#0f172a', fontWeight: 800 }}>Ver modelo de texto que cada colaborador receberá</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                          Clique para visualizar a mensagem completa que será disparada (com e sem envios)
                        </div>
                      </div>
                    </div>
                    <span style={{ 
                      fontSize: 11.5, 
                      fontWeight: 800, 
                      background: '#4f46e5', 
                      color: '#ffffff', 
                      padding: '6px 12px', 
                      borderRadius: 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      Visualizar
                      <ArrowRight size={13} />
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer de Ações */}
          <div 
            style={{
              padding: '16px 24px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            {batchFinished ? (
              <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Concluir e Fechar
                </button>
              </div>
            ) : isProcessing ? (
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#4f46e5' }}>
                  ⏳ Não feche a janela até o término do envio...
                </span>
                <button
                  type="button"
                  onClick={() => setIsAborted(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: '1px solid #ef4444',
                    background: '#ffffff',
                    color: '#dc2626',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Interromper Envio
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleStartBatchSend}
                  disabled={selectedNames.size === 0}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 12,
                    border: 'none',
                    background: selectedNames.size > 0 
                      ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' 
                      : '#cbd5e1',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: selectedNames.size > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: selectedNames.size > 0 ? '0 4px 14px rgba(79, 70, 229, 0.35)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <Send size={15} />
                  <span>
                    Disparar para {selectedNames.size} Colaborador{selectedNames.size !== 1 ? 'es' : ''}
                  </span>
                </button>
              </>
            )}
          </div>
        </motion.div>

        {/* Modal de Prévia do Modelo de Mensagem */}
        <AnimatePresence>
          {showTemplateModal && (
            <div
              onClick={() => setShowTemplateModal(false)}
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
              style={{
                position: 'fixed',
                inset: 0,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100dvh',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px 16px',
                boxSizing: 'border-box',
                overflow: 'hidden',
                overscrollBehavior: 'none',
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: 680,
                  maxHeight: 'min(90vh, 750px)',
                  background: '#ffffff',
                  borderRadius: 20,
                  boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  margin: 'auto',
                  position: 'relative',
                }}
              >
                {/* Header da Prévia */}
                <div style={{
                  padding: '18px 24px',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FileText size={20} color="#38bdf8" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Modelo de Comunicado Oficial</h3>
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                        Veja exatamente como a mensagem será formatada e enviada pelo Remetente Master
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: 8,
                      width: 32,
                      height: 32,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Abas: Com Envios vs Sem Envios */}
                <div style={{
                  display: 'flex',
                  gap: 8,
                  padding: '12px 24px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <button
                    type="button"
                    onClick={() => setTemplatePreviewTab('com_envios')}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: templatePreviewTab === 'com_envios' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      background: templatePreviewTab === 'com_envios' ? '#eef2ff' : '#ffffff',
                      color: templatePreviewTab === 'com_envios' ? '#4338ca' : '#64748b',
                      fontWeight: 800,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <CheckCircle2 size={16} color={templatePreviewTab === 'com_envios' ? '#4f46e5' : '#94a3b8'} />
                    <span>Exemplo: Colaborador COM Envios</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTemplatePreviewTab('zero_envios')}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: templatePreviewTab === 'zero_envios' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                      background: templatePreviewTab === 'zero_envios' ? '#fffbeb' : '#ffffff',
                      color: templatePreviewTab === 'zero_envios' ? '#b45309' : '#64748b',
                      fontWeight: 800,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <AlertTriangle size={16} color={templatePreviewTab === 'zero_envios' ? '#d97706' : '#94a3b8'} />
                    <span>Exemplo: Colaborador com 0 Envios</span>
                  </button>
                </div>

                {/* Conteúdo da Prévia (scrollável) */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, minHeight: 0, maxHeight: '55vh' }}>
                  {/* Card Metadados */}
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    marginBottom: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b' }}>Remetente Oficial:</span>
                      <strong style={{ color: '#0f172a' }}>👑 Ivan Rossi (Administrador Master • Diretor Geral)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b' }}>Destinatário:</span>
                      <strong style={{ color: '#4f46e5' }}>
                        {templatePreviewTab === 'com_envios' ? 'Maria Silva (Professora)' : 'João Souza (Educador)'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b' }}>Assunto / Título:</span>
                      <strong style={{ color: '#0f172a' }}>📊 Relatório Oficial de Frequência e Envios - {mesNome}/{ano}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b' }}>Anexo:</span>
                      <span style={{ color: '#059669', fontWeight: 700 }}>🖼️ Infográfico personalizado com mini-calendário e assinatura</span>
                    </div>
                  </div>

                  {/* Corpo do Comunicado */}
                  <div style={{
                    padding: '18px 20px',
                    borderRadius: 12,
                    background: templatePreviewTab === 'com_envios' ? '#ffffff' : '#fffdf5',
                    border: templatePreviewTab === 'com_envios' ? '1px solid #cbd5e1' : '1px solid #fde68a',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: 13,
                    color: '#1e293b',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {templatePreviewTab === 'com_envios' ? (
                      buildMensagemParaColaborador('Maria Silva', {
                        total: 35,
                        comunicados: 12,
                        relatorios: 15,
                        momentos: 8,
                        diasComEnvios: 18,
                        dias: null
                      })
                    ) : (
                      buildMensagemParaColaborador('João Souza', {
                        total: 0,
                        comunicados: 0,
                        relatorios: 0,
                        momentos: 0,
                        diasComEnvios: 0,
                        dias: null
                      })
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  padding: '14px 24px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    style={{
                      padding: '9px 20px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#0f172a',
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Entendi / Fechar Prévia
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ClientPortal>
  )
}
