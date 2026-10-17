'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useIsFetching } from '@tanstack/react-query'
import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'
import { useApp } from '@/lib/context'
import {
  ensureFetchTrackerInstalled,
  subscribeToNetworkActivity,
  getActiveApiRequestsCount,
  getLastApiRequestEndTime,
  isIntermediateRedirectRoute,
  isMainContentStillLoading,
  setGlobalNavOverlayActive,
} from '@/lib/navigation/pageReadiness'

const ROUTE_INFO: Record<string, { title: string; subtitle: string }> = {
  // Principal
  'dashboard': { title: 'Dashboard', subtitle: 'VISÃO GERAL' },
  'tarefas': { title: 'Minhas Tarefas', subtitle: 'PRODUTIVIDADE' },
  'calendario': { title: 'Calendário', subtitle: 'AGENDAMENTOS' },

  // Matrículas
  'matriculas': { title: 'Matrículas', subtitle: 'GESTÃO ESCOLAR' },
  'matriculas/digital': { title: 'Matrícula Digital', subtitle: 'MATRÍCULAS' },
  'matriculas/valores': { title: 'Tabela de Valores', subtitle: 'MATRÍCULAS' },
  'matriculas/contratos': { title: 'Contratos', subtitle: 'MATRÍCULAS' },

  // Acadêmico
  'academico': { title: 'Acadêmico', subtitle: 'GESTÃO PEDAGÓGICA' },
  'academico/alunos': { title: 'Alunos', subtitle: 'ACADÊMICO' },
  'academico/turmas': { title: 'Turmas', subtitle: 'ACADÊMICO' },
  'academico/professores': { title: 'Professores', subtitle: 'ACADÊMICO' },
  'academico/diario': { title: 'Diário de Classe', subtitle: 'ACADÊMICO' },
  'academico/notas': { title: 'Notas', subtitle: 'ACADÊMICO' },
  'academico/frequencia': { title: 'Frequência', subtitle: 'ACADÊMICO' },
  'academico/horarios': { title: 'Horários', subtitle: 'ACADÊMICO' },
  'academico/disciplinas': { title: 'Disciplinas', subtitle: 'ACADÊMICO' },

  // Financeiro
  'financeiro': { title: 'Financeiro', subtitle: 'GESTÃO FINANCEIRA' },
  'financeiro/mensalidades': { title: 'Mensalidades', subtitle: 'FINANCEIRO' },
  'financeiro/boletos': { title: 'Boletos', subtitle: 'FINANCEIRO' },
  'financeiro/caixa': { title: 'Fluxo de Caixa', subtitle: 'FINANCEIRO' },
  'financeiro/relatorios': { title: 'Relatórios Financeiros', subtitle: 'FINANCEIRO' },

  // Módulos Integrados
  'agenda-digital': { title: 'Agenda Digital', subtitle: 'COMUNICAÇÃO' },
  'agenda-digital/admin': { title: 'Admin da Agenda', subtitle: 'COMUNICAÇÃO' },
  'agenda-digital/colaborador': { title: 'Painel do Professor', subtitle: 'COMUNICAÇÃO' },
  'provas-online': { title: 'Provas Online', subtitle: 'AVALIAÇÕES DIGITAIS' },
  'simulados': { title: 'Simulados', subtitle: 'AVALIAÇÕES' },
  'credimpacto': { title: 'CredImpacto', subtitle: 'BENEFÍCIOS' },
  'gestao-pessoas': { title: 'Gestão de Pessoas', subtitle: 'RECURSOS HUMANOS' },
  'regimento-interno': { title: 'Regimento Interno', subtitle: 'INSTITUCIONAL' },
  'regulamento-interno': { title: 'Regulamento Interno', subtitle: 'INSTITUCIONAL' },
  'configuracoes': { title: 'Configurações', subtitle: 'SISTEMA' },
  'meu-perfil': { title: 'Meu Perfil', subtitle: 'CONTA' },
  'monitor-tv': { title: 'Monitor TV', subtitle: 'SISTEMA DE MÍDIA' },
  'relatorios': { title: 'Relatórios', subtitle: 'BUSINESS INTELLIGENCE' },
}

const AGENDA_SUBROUTE_TITLES: Record<string, string> = {
  'comunicados': 'Comunicados',
  'momentos': 'Mídia',
  'calendario': 'Agenda',
  'financeiro': 'Financeiro',
  'frequencia': 'Frequência',
  'ocorrencias': 'Ocorrências',
  'notas': 'Notas',
  'provas-online': 'Provas Online',
  'perfil': 'Perfil',
  'turmas': 'Turmas',
  'pessoas': 'Usuários',
  'espelhar': 'Espelhar Agenda',
  'chat': 'Chat',
  'relatorios': 'Relatórios',
  'cobrancas': 'Cobranças',
  'push-teste': 'Testar Notificações',
  'ajustes': 'Ajustes',
  'selecionar-aluno': 'Seleção de Aluno',
  'selecionar-perfil-admin': 'Seleção de Perfil',
}

function getRouteInfo(pathname: string): { title: string; subtitle: string } {
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '')
  if (!cleanPath || cleanPath === 'dashboard') {
    return { title: 'Dashboard', subtitle: 'VISÃO GERAL' }
  }

  if (ROUTE_INFO[cleanPath]) {
    return ROUTE_INFO[cleanPath]
  }

  if (cleanPath.startsWith('agenda-digital/')) {
    const parts = cleanPath.split('/')
    const lastPart = parts[parts.length - 1]
    const subPart = parts[2] || parts[1]
    const matchedTitle = AGENDA_SUBROUTE_TITLES[lastPart] || AGENDA_SUBROUTE_TITLES[subPart]
    if (matchedTitle) {
      return { title: matchedTitle, subtitle: 'COMUNICAÇÃO' }
    }
  }

  for (const [key, val] of Object.entries(ROUTE_INFO)) {
    if (cleanPath.startsWith(key + '/')) {
      const subSegment = cleanPath.slice(key.length + 1).split('/')[0]
      const formattedSub = subSegment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return { title: formattedSub, subtitle: val.subtitle || val.title.toUpperCase() }
    }
  }

  const segments = cleanPath.split('/').filter(Boolean)
  const lastSegment = segments[segments.length - 1] || 'Início'
  const formatted = lastSegment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const topSegment = segments[0] ? segments[0].replace(/-/g, ' ').toUpperCase() : 'SISTEMA'

  return { title: formatted, subtitle: topSegment }
}

function extractLinkText(anchor: HTMLAnchorElement | null): string | null {
  if (!anchor) return null

  const dataTitle = anchor.getAttribute('data-title') || anchor.getAttribute('aria-label') || anchor.getAttribute('title')
  if (dataTitle && dataTitle.trim().length > 1) {
    return dataTitle.trim()
  }

  const text = (anchor.innerText || anchor.textContent || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(LIVE|NOVO|NEW|2026|2027|PRO|VIP)\b/gi, '')
    .trim()

  if (text.length >= 2 && text.length <= 40 && !text.includes('\n')) {
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  return null
}

// Fase 1: Tempo máximo aguardando o Next.js compilar/baixar e trocar a rota (pathname)
const MAX_WAIT_ROUTE_CHANGE_MS = 18000
// Fase 2: Tempo máximo aguardando APIs/skeletons após a rota nova já ter montado
const MAX_WAIT_AFTER_ROUTE_ENTER_MS = 8000
// Janela mínima após a montagem da nova rota para que todos os useEffects disparem seus fetches
const MIN_SETTLE_AFTER_ENTER_MS = 240
// Janela de silêncio após a última requisição /api/ terminar para garantir commit do DOM
const NETWORK_QUIET_WINDOW_MS = 160

export function GlobalNavigationLoader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFetchingReactQuery = useIsFetching()
  const { moduleTransition, loadingPath } = useApp()

  const [isNavigating, setIsNavigating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [navInfo, setNavInfo] = useState<{ title: string; subtitle: string }>({
    title: 'Página',
    subtitle: 'SISTEMA'
  })

  const currentReactFull = (pathname || '') + (searchParams?.toString() ? '?' + searchParams.toString() : '')
  const currentReactFullRef = useRef<string>(currentReactFull)
  currentReactFullRef.current = currentReactFull

  const sourceRouteRef = useRef<string>('')
  const lastObservedRouteRef = useRef<string>('')
  const hasRouteEnteredRef = useRef<boolean>(false)
  const routeEnteredAtRef = useRef<number>(0)
  const navStartedAtRef = useRef<number>(0)
  const isFetchingRef = useRef<number>(isFetchingReactQuery)
  isFetchingRef.current = isFetchingReactQuery

  useEffect(() => {
    ensureFetchTrackerInstalled()
  }, [])

  useEffect(() => {
    setGlobalNavOverlayActive(isNavigating && isLoading)
    return () => {
      if (!isNavigating) setGlobalNavOverlayActive(false)
    }
  }, [isNavigating, isLoading])

  const triggerNav = useCallback((anchor: HTMLAnchorElement | null, targetUrl: URL) => {
    const currentPath = window.location.pathname + window.location.search
    const targetPath = targetUrl.pathname + targetUrl.search

    // Se for exatamente o mesmo caminho e query, não recarrega
    if (currentPath === targetPath || (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search)) {
      return
    }

    const routeFallback = getRouteInfo(targetUrl.pathname)
    const linkText = extractLinkText(anchor)

    const finalTitle = linkText || routeFallback.title
    const finalSubtitle = routeFallback.subtitle

    sourceRouteRef.current = currentReactFullRef.current
    lastObservedRouteRef.current = currentReactFullRef.current
    hasRouteEnteredRef.current = false
    routeEnteredAtRef.current = 0
    navStartedAtRef.current = Date.now()

    setNavInfo({ title: finalTitle, subtitle: finalSubtitle })
    setIsNavigating(true)
    setIsLoading(true)
    setGlobalNavOverlayActive(true)
  }, [])

  // 1. Intercepta cliques imediatos em qualquer tag <a> ou <Link> de todo o sistema
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignora botões secundários ou teclas modificadoras (nova aba/janela)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const anchor = target?.closest('a')
      if (!anchor || !anchor.href) return

      // Filtros de segurança para não disparar em downloads, novas abas ou links externos
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return
      if (anchor.getAttribute('data-no-loader') === 'true') return

      const hrefAttr = anchor.getAttribute('href') || ''
      if (hrefAttr.startsWith('#') || hrefAttr.startsWith('javascript:') || hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) {
        return
      }

      try {
        const dest = new URL(anchor.href, window.location.href)
        if (dest.origin !== window.location.origin) return

        // Ignora se for a mesma rota apenas pulando para âncora interna (#)
        if (dest.pathname === window.location.pathname && (dest.hash || dest.search === window.location.search)) {
          return
        }

        triggerNav(anchor, dest)
      } catch {
        // Se falhar o parse da URL, ignora silenciosamente
      }
    }

    // Capture: true garante que interceptamos no momento exato do clique antes de qualquer outro handler
    document.addEventListener('click', handleClick, { capture: true })
    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
    }
  }, [triggerNav])

  // 2. Intercepta navegação por histórico do navegador (botões voltar / avançar) de forma segura
  useEffect(() => {
    const handlePopState = () => {
      try {
        const dest = new URL(window.location.href)
        requestAnimationFrame(() => {
          triggerNav(null, dest)
        })
      } catch {}
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [triggerNav])

  // 3. Detecta quando a rota do Next.js efetivamente mudou para a página de destino
  useEffect(() => {
    if (!isLoading) return

    if (currentReactFull !== sourceRouteRef.current) {
      // Se ainda estiver em uma rota intermediária de redirecionamento, aguarda o redirect final
      if (isIntermediateRedirectRoute(pathname)) {
        lastObservedRouteRef.current = currentReactFull
        return
      }

      // Se a rota mudou (ou sofreu um redirect secundário após entrar), reinicia o relógio de prontidão da página nova
      if (!hasRouteEnteredRef.current || currentReactFull !== lastObservedRouteRef.current) {
        hasRouteEnteredRef.current = true
        routeEnteredAtRef.current = Date.now()
        lastObservedRouteRef.current = currentReactFull
      }
    }
  }, [currentReactFull, pathname, isLoading])

  // 4. Monitora a prontidão completa da nova página (Rede + React Query + Skeletons/Spinners no DOM)
  useEffect(() => {
    if (!isLoading) return

    const evaluateReadiness = () => {
      const now = Date.now()
      const totalElapsed = now - navStartedAtRef.current

      // Failsafe absoluto de Fase 1 (caso a navegação tenha sido cancelada ou bloqueada)
      if (totalElapsed >= MAX_WAIT_ROUTE_CHANGE_MS) {
        setIsLoading(false)
        return
      }

      // Enquanto o Next.js ainda não trocou o pathname para a página nova, mantém o loader ativo!
      if (!hasRouteEnteredRef.current) {
        return
      }

      const elapsedSinceEnter = now - routeEnteredAtRef.current

      // Aguarda janela mínima para que os useEffects da nova página iniciem suas buscas de dados
      if (elapsedSinceEnter < MIN_SETTLE_AFTER_ENTER_MS) {
        return
      }

      // Failsafe de Fase 2: se a página já montou há mais de 8s, libera a tela
      if (elapsedSinceEnter >= MAX_WAIT_AFTER_ROUTE_ENTER_MS) {
        setIsLoading(false)
        return
      }

      // Verifica se ainda há requisições de API ou React Query em andamento
      const activeApiCount = getActiveApiRequestsCount()
      if (activeApiCount > 0 || isFetchingRef.current > 0) {
        return
      }

      // Aguarda uma curta janela de silêncio após a última requisição de API terminar
      // para dar tempo ao React de processar o JSON e remover skeletons/spinners
      const timeSinceLastApi = now - getLastApiRequestEndTime()
      if (getLastApiRequestEndTime() > navStartedAtRef.current && timeSinceLastApi < NETWORK_QUIET_WINDOW_MS) {
        return
      }

      // Verifica se o DOM da página nova ainda exibe esqueletos ou spinners de carregamento
      if (isMainContentStillLoading()) {
        return
      }

      // A página nova entrou, todas as APIs finalizaram e o conteúdo final já está renderizado no DOM!
      setIsLoading(false)
    }

    const unsubscribe = subscribeToNetworkActivity(evaluateReadiness)
    const interval = setInterval(evaluateReadiness, 60)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [isLoading])

  const handleFinished = useCallback(() => {
    setIsNavigating(false)
    setGlobalNavOverlayActive(false)
    sourceRouteRef.current = ''
    lastObservedRouteRef.current = ''
    hasRouteEnteredRef.current = false
    routeEnteredAtRef.current = 0
  }, [])

  // Se houver transição de módulo específica ou logout ativo, eles têm prioridade
  if (moduleTransition || loadingPath === 'logout') {
    return null
  }

  if (!isNavigating) {
    return null
  }

  return (
    <AgendaLuxuryLoader
      isLoading={isLoading}
      subtitle={navInfo.subtitle}
      statusText={`Acessando ${navInfo.title}...`}
      minDisplayTimeMs={520}
      maxDisplayTimeMs={MAX_WAIT_ROUTE_CHANGE_MS}
      onFinished={handleFinished}
    />
  )
}
