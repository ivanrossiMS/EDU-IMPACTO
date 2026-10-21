'use client'

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { supabase } from '@/lib/supabase'
import { CredImpactoHeader } from '@/components/credimpacto/CredImpactoHeader'
import { CredImpactoSidebar, CredImpactoBottomBar, TabId } from '@/components/credimpacto/CredImpactoNavigation'
import { ColaboradorDashboard } from '@/components/credimpacto/ColaboradorDashboard'
import { AdminDashboard } from '@/components/credimpacto/AdminDashboard'
import { SimuladorEmprestimo } from '@/components/credimpacto/SimuladorEmprestimo'
import { ConciliacaoFolhaTab } from '@/components/credimpacto/ConciliacaoFolhaTab'
import { ParcelasTab } from '@/components/credimpacto/ParcelasTab'
import { FichaColaboradorTab } from '@/components/credimpacto/FichaColaboradorTab'
import { RelatoriosTab } from '@/components/credimpacto/RelatoriosTab'
import { RescisaoDesligamentoTab } from '@/components/credimpacto/RescisaoDesligamentoTab'
import { ConfiguracoesTab } from '@/components/credimpacto/ConfiguracoesTab'
import { AuditoriaTab } from '@/components/credimpacto/AuditoriaTab'
import { EmprestimoDetalhesModal, EmprestimoDetalhesSubTab } from '@/components/credimpacto/EmprestimoDetalhesModal'
import { AssinaturaEletronicaModal } from '@/components/credimpacto/AssinaturaEletronicaModal'
import { QuitacaoAntecipadaModal } from '@/components/credimpacto/QuitacaoAntecipadaModal'
import { CredImpactoConfig, CredImpactoEmprestimo } from '@/types/credimpacto'
import { DEFAULT_TERMO_AUTORIZACAO } from '@/lib/credimpacto/contractTemplate'
import { isCredImpactoAdmin, isLoanOwnedByUser } from '@/lib/credimpacto/authHelper'
import { toast } from 'sonner'
import { Landmark } from 'lucide-react'
import { Capacitor } from '@capacitor/core'

export default function CredImpactoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando CredImpacto...</div>}>
      <CredImpactoContent />
    </Suspense>
  )
}

function CredImpactoContent() {
  const { currentUser, currentUserPerfil } = useApp()
  const { perfis, perfisLoading } = useData()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabId | null

  const effectivePerfil = currentUserPerfil || currentUser?.perfil || currentUser?.cargo || ''
  const effectiveCargo = currentUser?.cargo || ''

  // Verificação de bloqueio no perfil com fallback resiliente e normalização
  const normalize = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  const userPerfilObj = (perfis || []).find((p: any) => 
    p.nome === effectivePerfil || 
    p.nome === currentUser?.perfil || 
    p.nome === currentUser?.cargo ||
    (effectivePerfil && normalize(p.nome) === normalize(effectivePerfil)) ||
    (currentUser?.perfil && normalize(p.nome) === normalize(currentUser.perfil)) ||
    (currentUser?.cargo && normalize(p.nome) === normalize(currentUser.cargo))
  )
  const isBlocked = !perfisLoading && userPerfilObj?.bloqueadoCredImpacto === true

  // Perfil enriquecido do usuário logado (com CPF, IDs e Unidade)
  const [currentMe, setCurrentMe] = useState<{
    id: string
    systemUserId?: string
    funcionarioId?: string
    nome: string
    email: string
    cpf?: string
    cargo?: string
    perfil?: string
    salarioBase?: number
    unidade?: string
    isAdminOrFinance: boolean
  } | null>(null)

  // Identificação do Perfil e Privilégios: SOMENTE Admin e Diretor Geral têm acesso à Gestão
  const isAdminOrFinance = isCredImpactoAdmin(effectivePerfil, effectiveCargo) || Boolean(currentMe?.isAdminOrFinance)

  // Estado da Visão: apenas admin/diretor geral pode acessar 'admin'; todos os demais acessam 'colaborador'
  const [viewMode, setViewMode] = useState<'admin' | 'colaborador'>(isAdminOrFinance ? 'admin' : 'colaborador')
  const [activeTab, setActiveTab] = useState<TabId>(isAdminOrFinance ? 'dashboard' : 'meus_emprestimos')

  // Sincroniza viewMode e activeTab iniciais conforme privilégio
  useEffect(() => {
    if (isAdminOrFinance) {
      setViewMode('admin')
      const adminAllowedTabs: TabId[] = [
        'dashboard',
        'analise',
        'liberacoes',
        'parcelas',
        'ficha_colaborador',
        'folha',
        'rescisao',
        'simular',
        'relatorios',
        'configuracoes',
        'auditoria'
      ]
      if (tabParam && adminAllowedTabs.includes(tabParam as TabId)) {
        setActiveTab(tabParam as TabId)
      } else {
        setActiveTab('dashboard')
      }
    } else {
      setViewMode('colaborador')
      // Se não for admin/diretor geral, restringe estritamente às abas do colaborador
      const colabTabs: TabId[] = ['meus_emprestimos', 'simular']
      if (tabParam && colabTabs.includes(tabParam as TabId)) {
        setActiveTab(tabParam as TabId)
      } else {
        setActiveTab('meus_emprestimos')
      }
    }
  }, [isAdminOrFinance, tabParam])

  // Dados do Módulo
  const [config, setConfig] = useState<CredImpactoConfig>({
    taxaMensalPadrao: 1.5,
    metodoCalculoPadrao: 'JUROS_SIMPLES_SALDO',
    metodosPermitidos: [
      'JUROS_SIMPLES_SALDO',
      'JUROS_SIMPLES_INICIAL',
      'ACRESCIMO_UNICO',
      'TABELA_PRICE',
      'BALAO_FINAL_COMPOSTO'
    ],
    prazoMinimoParcelas: 1,
    prazoMaximoParcelas: 24,
    valorMinimoEmprestimo: 200,
    valorMaximoEmprestimo: 25000,
    diaPadraoDescontoFolha: 5,
    exigeAprovacaoDupla: false,
    limiteCompensacaoRescisaoCltPercentual: 100,
    termoAutorizacaoDesconto: DEFAULT_TERMO_AUTORIZACAO
  })

  const [emprestimos, setEmprestimos] = useState<CredImpactoEmprestimo[]>([])
  const [colaboradoresList, setColaboradoresList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'online' | 'offline'>('connecting')

  // Modais
  const [selectedLoanForDetails, setSelectedLoanForDetails] = useState<CredImpactoEmprestimo | null>(null)
  const [detailsInitialTab, setDetailsInitialTab] = useState<EmprestimoDetalhesSubTab>('resumo')
  const [selectedLoanForSign, setSelectedLoanForSign] = useState<CredImpactoEmprestimo | null>(null)
  const [selectedLoanForPayoff, setSelectedLoanForPayoff] = useState<CredImpactoEmprestimo | null>(null)

  const handleOpenLoanDetails = useCallback(
    (loan: CredImpactoEmprestimo | null, initialTab: EmprestimoDetalhesSubTab = 'resumo') => {
      setDetailsInitialTab(initialTab)
      setSelectedLoanForDetails(loan)
    },
    []
  )

  // Mantém modais abertos sincronizados em tempo real quando a lista de empréstimos atualiza
  useEffect(() => {
    setSelectedLoanForDetails((prev) => {
      if (!prev) return null
      const updated = emprestimos.find((e) => e.id === prev.id)
      if (!updated) return null
      return {
        ...prev,
        ...updated,
        contratoConteudoHtml: updated.contratoConteudoHtml || prev.contratoConteudoHtml
      }
    })
    setSelectedLoanForSign((prev) => {
      if (!prev) return null
      const updated = emprestimos.find((e) => e.id === prev.id)
      if (!updated) return null
      return {
        ...prev,
        ...updated,
        contratoConteudoHtml: updated.contratoConteudoHtml || prev.contratoConteudoHtml
      }
    })
    setSelectedLoanForPayoff((prev) => {
      if (!prev) return null
      const updated = emprestimos.find((e) => e.id === prev.id)
      if (!updated) return null
      return {
        ...prev,
        ...updated,
        contratoConteudoHtml: updated.contratoConteudoHtml || prev.contratoConteudoHtml
      }
    })
  }, [emprestimos])

  // Ficha Financeira por Colaborador selecionado
  const colaboradorParam = searchParams.get('colaborador') || undefined
  const [selectedColaboradorForFicha, setSelectedColaboradorForFicha] = useState<string | undefined>(colaboradorParam)

  useEffect(() => {
    if (colaboradorParam) {
      setSelectedColaboradorForFicha(colaboradorParam)
    }
  }, [colaboradorParam])

  const handleOpenFichaColaborador = (colaboradorId: string) => {
    setSelectedColaboradorForFicha(colaboradorId)
    setActiveTab('ficha_colaborador')
    router.replace(`/credimpacto?tab=ficha_colaborador&colaborador=${encodeURIComponent(colaboradorId)}`, { scroll: false })
  }

  // Carga de Dados (com suporte a modo silencioso para atualizações Realtime sem spinner)
  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const isSilent = Boolean(options?.silent)
    if (!isSilent) {
      setIsRefreshing(true)
    }
    try {
      const [cfgRes, empRes, meRes] = await Promise.all([
        fetch('/api/credimpacto/configuracao', { cache: 'no-store' }),
        fetch('/api/credimpacto/emprestimos', { cache: 'no-store' }),
        fetch('/api/credimpacto/me', { cache: 'no-store' })
      ])

      if (cfgRes.ok) {
        const cfgData = await cfgRes.json()
        setConfig(cfgData)
      }

      if (empRes.ok) {
        const empData = await empRes.json()
        setEmprestimos(empData)
      }

      let resolvedAdmin = isAdminOrFinance
      if (meRes.ok) {
        const meData = await meRes.json()
        setCurrentMe(meData)
        if (meData?.isAdminOrFinance) resolvedAdmin = true
      }

      // Se for admin, carrega lista de funcionários para dropdowns de concessão
      if (resolvedAdmin) {
        try {
          const funcRes = await fetch('/api/rh/funcionarios?lightweight=true', { cache: 'no-store' })
          if (funcRes.ok) {
            const funcs = await funcRes.json()
            setColaboradoresList(funcs)
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error('[CredImpacto loadData error]', err)
    } finally {
      setIsLoading(false)
      if (!isSilent) {
        setIsRefreshing(false)
      }
    }
  }, [isAdminOrFinance])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Refs estáveis para callbacks de Realtime
  const currentMeRef = useRef(currentMe)
  const currentUserRef = useRef(currentUser)
  const isAdminOrFinanceRef = useRef(isAdminOrFinance)
  const viewModeRef = useRef(viewMode)
  const loadDataRef = useRef(loadData)
  const processedEventsRef = useRef<Set<string>>(new Set())
  const silentRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    currentMeRef.current = currentMe
    currentUserRef.current = currentUser
    isAdminOrFinanceRef.current = isAdminOrFinance
    viewModeRef.current = viewMode
    loadDataRef.current = loadData
  }, [currentMe, currentUser, isAdminOrFinance, viewMode, loadData])

  // ============================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL (SUPABASE BROADCAST + POSTGRES_CHANGES + FOCUS)
  // ============================================================================
  useEffect(() => {
    let isMounted = true

    const scheduleSilentRefresh = (delayMs = 150) => {
      if (silentRefreshTimerRef.current) {
        clearTimeout(silentRefreshTimerRef.current)
      }
      silentRefreshTimerRef.current = setTimeout(() => {
        if (isMounted) {
          loadDataRef.current({ silent: true })
        }
      }, delayMs)
    }

    const rememberEventId = (id?: string) => {
      if (!id) return false
      if (processedEventsRef.current.has(id)) return true
      processedEventsRef.current.add(id)
      if (processedEventsRef.current.size > 200) {
        const first = processedEventsRef.current.values().next().value
        if (first) processedEventsRef.current.delete(first)
      }
      return false
    }

    // Remove canais órfãos de HMR / StrictMode
    try {
      for (const ch of supabase.getChannels()) {
        if (ch?.topic === 'realtime:credimpacto_realtime_room') {
          supabase.removeChannel(ch).catch(() => {})
        }
      }
    } catch (_) {}

    const channel = supabase.channel('credimpacto_realtime_room')

    channel
      .on('broadcast', { event: 'CREDIMPACTO_EVENT' }, (msg: any) => {
        if (!isMounted) return
        const payload = msg?.payload || {}
        if (rememberEventId(payload.eventId)) return

        const me = currentMeRef.current
        const usr = currentUserRef.current
        const isAdmin = isAdminOrFinanceRef.current
        const userIdentity = {
          id: me?.id || usr?.id,
          systemUserId: me?.systemUserId,
          funcionarioId: me?.funcionarioId || (usr as any)?.colaborador_id,
          email: me?.email || usr?.email,
          cpf: me?.cpf || (usr as any)?.cpf || (usr as any)?.user_metadata?.cpf,
          nome: me?.nome || usr?.nome
        }

        const isTriggeredByOther =
          Boolean(payload.autorId) &&
          payload.autorId !== userIdentity.id &&
          payload.autorId !== userIdentity.systemUserId &&
          payload.autorId !== userIdentity.funcionarioId

        if (payload.type === 'CONFIG_UPDATE') {
          if (payload.config) {
            setConfig(payload.config)
          }
          scheduleSilentRefresh(100)
          window.dispatchEvent(new CustomEvent('credimpacto:realtime-update', { detail: payload }))
          return
        }

        if (payload.type === 'EMPRESTIMO_DELETE') {
          const targetId = payload.emprestimoId
          if (targetId) {
            setEmprestimos((prev) => {
              const exists = prev.some((e) => e.id === targetId)
              if (!exists) return prev
              if (isTriggeredByOther && payload.codigoOperacao) {
                toast.info(`A operação ${payload.codigoOperacao} foi removida.`)
              }
              return prev.filter((e) => e.id !== targetId)
            })
          }
          scheduleSilentRefresh(100)
          window.dispatchEvent(new CustomEvent('credimpacto:realtime-update', { detail: payload }))
          return
        }

        if (payload.type === 'EMPRESTIMO_UPSERT') {
          const belongsToMe = isLoanOwnedByUser(payload.emprestimo || payload, userIdentity)
          if (!isAdmin && !belongsToMe) {
            // Verifica se já estava na lista local do colaborador
            setEmprestimos((prev) => {
              if (prev.some((e) => e.id === payload.emprestimoId)) {
                scheduleSilentRefresh(100)
              }
              return prev
            })
            return
          }

          // Atualização otimista instantânea (<50ms) na lista de empréstimos
          if (payload.emprestimo) {
            const incomingLoan = payload.emprestimo as CredImpactoEmprestimo
            setEmprestimos((prev) => {
              const idx = prev.findIndex((e) => e.id === incomingLoan.id)
              if (idx >= 0) {
                const updatedList = [...prev]
                updatedList[idx] = {
                  ...updatedList[idx],
                  ...incomingLoan,
                  contratoConteudoHtml:
                    incomingLoan.contratoConteudoHtml || updatedList[idx].contratoConteudoHtml
                }
                return updatedList
              }
              const next = [incomingLoan, ...prev]
              next.sort(
                (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
              )
              return next
            })
          }

          // Notificações em tempo real quando a ação partiu da outra ponta (Escola <-> Colaborador)
          if (isTriggeredByOther) {
            const cod = payload.codigoOperacao || 'Empréstimo'
            if (viewModeRef.current === 'colaborador' || !isAdmin) {
              if (payload.acao === 'CRIACAO') {
                toast.success(`Nova operação ${cod} disponível no seu painel!`)
              } else if (payload.acao === 'APROVACAO') {
                if (payload.status === 'aguardando_assinatura') {
                  toast.success(`Empréstimo ${cod} aprovado! Assine digitalmente para liberação.`)
                } else if (payload.status === 'ativo') {
                  toast.success(`Empréstimo ${cod} aprovado e ativado!`)
                } else {
                  toast.success(`Empréstimo ${cod} aprovado e encaminhado para liberação!`)
                }
              } else if (payload.acao === 'CONTRAPROPOSTA') {
                toast.info(`Você recebeu uma contraproposta para o empréstimo ${cod}.`)
              } else if (payload.acao === 'LIBERACAO') {
                toast.success(`Recursos do empréstimo ${cod} liberados!`)
              } else if (payload.acao === 'RECUSA') {
                toast.error(`Sua solicitação ${cod} não foi aprovada.`)
              } else if (payload.acao === 'CONCILIACAO_FOLHA') {
                toast.success(`Parcela do empréstimo ${cod} conciliada com sucesso!`)
              } else if (payload.acao === 'QUITACAO_ANTECIPADA') {
                toast.success(`Empréstimo ${cod} quitado integralmente!`)
              }
            } else if (isAdmin) {
              const colab = payload.colaboradorNome || 'Colaborador'
              if (payload.acao === 'CRIACAO') {
                toast.info(`Nova solicitação (${cod}) enviada por ${colab}!`)
              } else if (payload.acao === 'ASSINATURA') {
                toast.success(`Contrato ${cod} assinado por ${colab}! Pronto para liberação TED.`)
              } else if (payload.acao === 'APROVACAO' && payload.status === 'aguardando_assinatura') {
                toast.success(`${colab} aceitou a contraproposta (${cod})!`)
              } else if (payload.acao === 'CANCELAMENTO') {
                toast.warning(`Operação ${cod} (${colab}) foi cancelada.`)
              }
            }
          }

          scheduleSilentRefresh(120)
          window.dispatchEvent(new CustomEvent('credimpacto:realtime-update', { detail: payload }))
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credimpacto_emprestimos' },
        () => {
          if (!isMounted) return
          scheduleSilentRefresh(180)
          window.dispatchEvent(new CustomEvent('credimpacto:realtime-update'))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credimpacto_parcelas' },
        () => {
          if (!isMounted) return
          scheduleSilentRefresh(180)
          window.dispatchEvent(new CustomEvent('credimpacto:realtime-update'))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credimpacto_configuracao' },
        () => {
          if (!isMounted) return
          scheduleSilentRefresh(180)
          window.dispatchEvent(new CustomEvent('credimpacto:realtime-update'))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'relatorios_records' },
        (payload: any) => {
          if (!isMounted) return
          const rowId = String(payload?.new?.id || payload?.old?.id || '')
          if (rowId.startsWith('credimpacto:')) {
            scheduleSilentRefresh(180)
            window.dispatchEvent(new CustomEvent('credimpacto:realtime-update'))
          }
        }
      )
      .subscribe((status: string) => {
        if (!isMounted) return
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('online')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('offline')
        } else {
          setRealtimeStatus('connecting')
        }
      })

    // Sincroniza silenciosamente ao focar a janela, voltar para a aba ou reconectar à rede
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        scheduleSilentRefresh(80)
        window.dispatchEvent(new CustomEvent('credimpacto:realtime-update'))
      }
    }

    window.addEventListener('focus', handleVisibilityOrFocus)
    window.addEventListener('online', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)

    // Heartbeat silencioso a cada 15s enquanto a página estiver visível (contingência p/ firewalls restritos)
    const heartbeatInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadDataRef.current({ silent: true })
      }
    }, 15000)

    return () => {
      isMounted = false
      if (silentRefreshTimerRef.current) {
        clearTimeout(silentRefreshTimerRef.current)
      }
      clearInterval(heartbeatInterval)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      window.removeEventListener('online', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      try {
        supabase.removeChannel(channel).catch(() => {})
      } catch (_) {}
    }
  }, [])

  // Ajusta a StatusBar no aplicativo mobile nativo para estilo escuro (ícones escuros legíveis sobre fundo claro)
  useEffect(() => {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: Style.Light }).catch(() => {})
      })
      return () => {
        import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
          StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
        })
      }
    }
  }, [])

  const pendingRequestsCount = emprestimos.filter(
    (e) => e.status === 'solicitado' || e.status === 'em_analise'
  ).length

  const pendingDisbursementCount = emprestimos.filter(
    (e) => e.status === 'aguardando_liberacao'
  ).length

  const totalEmprestadoAtivo = emprestimos
    .filter((e) => e.status === 'ativo')
    .reduce((acc, e) => acc + (e.valorAprovado || 0), 0)

  const saldoDevedorTotal = emprestimos
    .filter((e) => e.status === 'ativo')
    .reduce((acc, e) => acc + (e.saldoDevedorAtual || 0), 0)

  const handleToggleViewMode = (mode: 'admin' | 'colaborador') => {
    if (mode === 'admin' && !isAdminOrFinance) {
      toast.error('Acesso ao Painel Gestão restrito ao Administrador e Diretor Geral.')
      return
    }
    setViewMode(mode)
    if (mode === 'admin') {
      setActiveTab('dashboard')
    } else {
      setActiveTab('meus_emprestimos')
    }
  }

  const handleTabChange = (tab: TabId) => {
    const colabTabs: TabId[] = ['meus_emprestimos', 'simular']
    if (!colabTabs.includes(tab) && (!isAdminOrFinance || viewMode !== 'admin')) {
      toast.error('Acesso restrito ao Administrador e Diretor Geral.')
      setActiveTab('meus_emprestimos')
      return
    }
    // Administrador não tem Meu Espaço
    if (isAdminOrFinance && tab === 'meus_emprestimos') {
      setActiveTab('dashboard')
      return
    }
    setActiveTab(tab)
  }

  const handleOpenNewLoan = () => {
    setActiveTab('simular')
  }

  const handleNavigateToLoan = useCallback(
    (emprestimoId?: string, targetUrl?: string) => {
      if (targetUrl) {
        try {
          const qIndex = targetUrl.indexOf('?')
          if (qIndex !== -1) {
            const sp = new URLSearchParams(targetUrl.slice(qIndex + 1))
            const tabParam = sp.get('tab') as TabId | null
            const actionParam = sp.get('action')
            const loanParam = sp.get('loanId') || sp.get('id') || emprestimoId

            if (tabParam) {
              if (tabParam === 'meus_emprestimos' && !isAdminOrFinance) {
                setViewMode('colaborador')
                setActiveTab('meus_emprestimos')
              } else if (isAdminOrFinance) {
                setViewMode('admin')
                setActiveTab(tabParam === 'meus_emprestimos' ? 'dashboard' : tabParam)
              } else {
                setActiveTab(tabParam)
              }
            }

            if (loanParam) {
              const found = emprestimos.find((e) => e.id === loanParam)
              if (found) {
                if (actionParam === 'assinar' && found.status === 'aguardando_assinatura') {
                  setSelectedLoanForSign(found)
                } else {
                  setSelectedLoanForDetails(found)
                }
                return
              }
            }
          }
        } catch {}
      }

      if (emprestimoId) {
        const found = emprestimos.find((e) => e.id === emprestimoId)
        if (found) {
          setSelectedLoanForDetails(found)
        }
      }
    },
    [emprestimos, isAdminOrFinance]
  )

  // Deep-link automático ao abrir o CredImpacto via clique em Notificação Push (?tab=...&loanId=...&action=...)
  const handledUrlLoanRef = useRef<string | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || emprestimos.length === 0) return
    const search = window.location.search
    if (!search) return
    const sp = new URLSearchParams(search)
    const loanParam = sp.get('loanId') || sp.get('id')
    const tabParam = sp.get('tab') as TabId | null
    const key = `${tabParam || ''}:${loanParam || ''}:${sp.get('action') || ''}`
    if (!tabParam && !loanParam) return
    if (handledUrlLoanRef.current === key) return
    handledUrlLoanRef.current = key

    handleNavigateToLoan(loanParam || undefined, window.location.pathname + search)
  }, [isLoading, emprestimos, handleNavigateToLoan])

  if (perfisLoading && !userPerfilObj) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
      </div>
    )
  }

  if (isBlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6" data-theme="light">
        <div className="max-w-md w-full text-center p-8 rounded-2xl bg-white border border-slate-200 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 text-2xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Módulo Não Habilitado</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            O módulo <strong>CredImpacto</strong> está desativado para o seu perfil ({currentUser?.perfil || 'Usuário'}). Solicite a liberação de acesso à Direção Geral em Configurações &gt; Usuários &gt; Perfis.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-slate-50/60 text-slate-900" data-theme="light">
      {/* SIDEBAR DEDICADA DO CREDIMPACTO (DESKTOP - STANDALONE EDGE-TO-EDGE) */}
      <CredImpactoSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        isAdminOrFinance={isAdminOrFinance}
        pendingRequestsCount={pendingRequestsCount}
        pendingDisbursementCount={pendingDisbursementCount}
        onNewLoanClick={handleOpenNewLoan}
        onRefresh={() => loadData()}
        isRefreshing={isRefreshing}
        totalAtivo={totalEmprestadoAtivo}
        saldoDevedor={saldoDevedorTotal}
        currentMe={currentMe}
        realtimeStatus={realtimeStatus}
      />

      {/* ÁREA DE CONTEÚDO PRINCIPAL (COM SCROLL INDEPENDENTE) */}
      <div className="flex-1 min-w-0 h-screen overflow-y-auto">
        <div className="p-4 sm:p-6 lg:px-7 lg:py-6 max-w-[1536px] mx-auto space-y-6 pb-28 md:pb-12 pt-[calc(1rem+env(safe-area-inset-top,0px))] md:pt-6">
          {/* CABEÇALHO SUPERIOR */}
          <CredImpactoHeader
            isAdminOrFinance={isAdminOrFinance}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewMode}
            onNewLoanClick={handleOpenNewLoan}
            onRefresh={() => loadData()}
            isRefreshing={isRefreshing}
            activeTab={activeTab}
            currentMe={currentMe}
            realtimeStatus={realtimeStatus}
            onNavigateToLoan={handleNavigateToLoan}
          />

          {/* CONTEÚDO PRINCIPAL DE CADA ABA */}
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto animate-pulse">
                <Landmark size={24} className="text-emerald-400" />
              </div>
              <div className="text-sm font-semibold">Carregando módulo CredImpacto...</div>
            </div>
          ) : (
            <main>
              {/* VISÃO GERAL (ADMIN) */}
              {activeTab === 'dashboard' && viewMode === 'admin' && (
                <AdminDashboard
                  viewModeTab="dashboard"
                  emprestimos={emprestimos}
                  colaboradoresList={colaboradoresList}
                  onOpenDetails={handleOpenLoanDetails}
                  onRefresh={() => loadData()}
                  onOpenFichaColaborador={handleOpenFichaColaborador}
                />
              )}

              {/* TODAS AS OPERAÇÕES (ADMIN) */}
              {activeTab === 'emprestimos' && viewMode === 'admin' && (
                <AdminDashboard
                  viewModeTab="emprestimos"
                  emprestimos={emprestimos}
                  colaboradoresList={colaboradoresList}
                  onOpenDetails={handleOpenLoanDetails}
                  onRefresh={() => loadData()}
                  onOpenFichaColaborador={handleOpenFichaColaborador}
                />
              )}

              {/* FILA DE APROVAÇÃO (ADMIN) */}
              {activeTab === 'analise' && viewMode === 'admin' && (
                <AdminDashboard
                  viewModeTab="analise"
                  emprestimos={emprestimos}
                  colaboradoresList={colaboradoresList}
                  onOpenDetails={handleOpenLoanDetails}
                  onRefresh={() => loadData()}
                  onOpenFichaColaborador={handleOpenFichaColaborador}
                />
              )}

              {/* LIBERAÇÕES TED / TESOURARIA (ADMIN) */}
              {activeTab === 'liberacoes' && viewMode === 'admin' && (
                <AdminDashboard
                  viewModeTab="liberacoes"
                  emprestimos={emprestimos}
                  colaboradoresList={colaboradoresList}
                  onOpenDetails={handleOpenLoanDetails}
                  onRefresh={() => loadData()}
                  onOpenFichaColaborador={handleOpenFichaColaborador}
                />
              )}

              {/* CONTROLE DE PARCELAS (ADMIN) */}
              {activeTab === 'parcelas' && viewMode === 'admin' && (
                <ParcelasTab
                  emprestimos={emprestimos}
                  onOpenDetails={handleOpenLoanDetails}
                  onRefresh={() => loadData()}
                />
              )}

              {/* FICHA FINANCEIRA POR COLABORADOR (ADMIN) */}
              {activeTab === 'ficha_colaborador' && viewMode === 'admin' && (
                <FichaColaboradorTab
                  emprestimos={emprestimos}
                  colaboradoresList={colaboradoresList}
                  config={config}
                  onOpenDetails={handleOpenLoanDetails}
                  onRefresh={() => loadData()}
                  initialSelectedColaboradorId={selectedColaboradorForFicha}
                />
              )}

              {/* CONCILIAÇÃO EM FOLHA (ADMIN) */}
              {activeTab === 'folha' && viewMode === 'admin' && (
                <ConciliacaoFolhaTab onRefresh={() => loadData()} />
              )}

              {/* RESCISÃO E DESLIGAMENTO CLT (ADMIN) */}
              {activeTab === 'rescisao' && viewMode === 'admin' && (
                <RescisaoDesligamentoTab
                  emprestimos={emprestimos}
                  config={config}
                  onRefresh={() => loadData()}
                />
              )}

              {/* CONCEDER EMPRÉSTIMO / SIMULADOR */}
              {activeTab === 'simular' && (
                <SimuladorEmprestimo
                  config={config}
                  userSalary={
                    currentMe?.salarioBase ||
                    ((currentUser as any)?.salario || currentUser?.user_metadata?.salario
                      ? Number((currentUser as any)?.salario || currentUser?.user_metadata?.salario)
                      : undefined)
                  }
                  isAdminOrFinance={isAdminOrFinance}
                  viewMode={viewMode}
                  currentUserId={currentMe?.id || currentUser?.id}
                  currentUserName={currentMe?.nome || currentUser?.nome || currentUser?.email}
                  currentUserCpf={currentMe?.cpf || (currentUser as any)?.cpf || (currentUser as any)?.user_metadata?.cpf || ''}
                  currentUserUnidade={currentMe?.unidade}
                  colaboradoresList={colaboradoresList}
                  onRequestSubmitted={() => {
                    loadData()
                    setActiveTab(viewMode === 'admin' ? 'dashboard' : 'meus_emprestimos')
                  }}
                />
              )}

              {/* RELATÓRIOS & DRE (ADMIN) */}
              {activeTab === 'relatorios' && viewMode === 'admin' && (
                <RelatoriosTab
                  emprestimos={emprestimos}
                  onOpenDetails={handleOpenLoanDetails}
                />
              )}

              {/* PARÂMETROS E POLÍTICAS (ADMIN) */}
              {activeTab === 'configuracoes' && viewMode === 'admin' && (
                <ConfiguracoesTab
                  initialConfig={config}
                  onConfigSaved={(newCfg) => setConfig(newCfg)}
                />
              )}

              {/* AUDITORIA (ADMIN) */}
              {activeTab === 'auditoria' && viewMode === 'admin' && (
                <AuditoriaTab />
              )}

              {/* MEUS EMPRÉSTIMOS (COLABORADOR) */}
              {activeTab === 'meus_emprestimos' && (
                <ColaboradorDashboard
                  emprestimos={emprestimos}
                  onOpenDetails={handleOpenLoanDetails}
                  onOpenSignModal={setSelectedLoanForSign}
                  onOpenPayoffModal={setSelectedLoanForPayoff}
                  onRefresh={() => loadData()}
                  onOpenNewLoan={handleOpenNewLoan}
                />
              )}
            </main>
          )}
        </div>
      </div>

      {/* RODAPÉ ULTRA MODERNO (DOCK MOBILE) */}
      <CredImpactoBottomBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        isAdminOrFinance={isAdminOrFinance}
        pendingRequestsCount={pendingRequestsCount}
        pendingDisbursementCount={pendingDisbursementCount}
        onNewLoanClick={handleOpenNewLoan}
        onRefresh={() => loadData()}
        isRefreshing={isRefreshing}
        totalAtivo={totalEmprestadoAtivo}
        saldoDevedor={saldoDevedorTotal}
        currentMe={currentMe}
        realtimeStatus={realtimeStatus}
      />

      {/* MODAL DE DETALHES COMPLETOS & PARCELAS */}
      <EmprestimoDetalhesModal
        loan={selectedLoanForDetails}
        initialSubTab={detailsInitialTab}
        onClose={() => setSelectedLoanForDetails(null)}
        onRefresh={() => loadData({ silent: true })}
        onOpenSignModal={(l) => {
          setSelectedLoanForDetails(null)
          setSelectedLoanForSign(l)
        }}
        onOpenPayoffModal={(l) => {
          setSelectedLoanForDetails(null)
          setSelectedLoanForPayoff(l)
        }}
        onDirectApprove={async (l) => {
          if (
            !confirm(
              `Deseja aprovar diretamente o empréstimo ${l.codigoOperacao} de ${l.colaboradorNome} dispensando a autorização do colaborador?\n\nA operação será homologada administrativamente e encaminhada para a fila de Liberações TED.`
            )
          ) {
            return
          }
          try {
            const res = await fetch(`/api/credimpacto/emprestimos/${l.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                acao: 'aprovar_direto',
                ativarDireto: false
              })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao aprovar empréstimo')
            toast.success(`Empréstimo ${data.codigoOperacao} aprovado diretamente! Encaminhado para a fila de Liberações TED.`)
            setSelectedLoanForDetails(null)
            loadData()
          } catch (e: any) {
            toast.error(e.message || 'Falha ao aprovar operação diretamente.')
          }
        }}
        onDelete={async (l) => {
          if (!confirm(`Deseja realmente excluir permanentemente a operação ${l.codigoOperacao} de ${l.colaboradorNome}? Esta ação é irreversível.`)) return
          try {
            const res = await fetch(`/api/credimpacto/emprestimos?id=${l.id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao excluir')
            toast.success(`Empréstimo ${l.codigoOperacao} excluído com sucesso!`)
            setSelectedLoanForDetails(null)
            loadData()
          } catch (e: any) {
            toast.error(e.message || 'Falha ao excluir operação.')
          }
        }}
        isAdminOrFinance={isAdminOrFinance}
      />

      {/* MODAL DE ASSINATURA ELETRÔNICA */}
      <AssinaturaEletronicaModal
        loan={selectedLoanForSign}
        onClose={() => setSelectedLoanForSign(null)}
        onSignatureSuccess={() => {
          loadData()
        }}
      />

      {/* MODAL DE QUITAÇÃO ANTECIPADA */}
      <QuitacaoAntecipadaModal
        loan={selectedLoanForPayoff}
        onClose={() => setSelectedLoanForPayoff(null)}
        onSuccess={() => {
          loadData()
        }}
        isAdminOrFinance={isAdminOrFinance}
      />
    </div>
  )
}
