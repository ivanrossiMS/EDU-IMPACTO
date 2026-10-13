'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'
import { useApp } from '@/lib/context'

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

function getRouteInfo(pathname: string): { title: string; subtitle: string } {
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '')
  if (!cleanPath || cleanPath === 'dashboard') {
    return { title: 'Dashboard', subtitle: 'VISÃO GERAL' }
  }

  if (ROUTE_INFO[cleanPath]) {
    return ROUTE_INFO[cleanPath]
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

export function GlobalNavigationLoader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { moduleTransition, loadingPath } = useApp()

  const [isNavigating, setIsNavigating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [navInfo, setNavInfo] = useState<{ title: string; subtitle: string }>({
    title: 'Página',
    subtitle: 'SISTEMA'
  })

  const sourcePathRef = useRef<string>('')
  const targetPathRef = useRef<string>('')
  const failsafeRef = useRef<NodeJS.Timeout | null>(null)

  const triggerNav = useCallback((anchor: HTMLAnchorElement | null, targetUrl: URL) => {
    const currentPath = window.location.pathname + window.location.search
    const targetPath = targetUrl.pathname + targetUrl.search

    // Se for exatamente o mesmo caminho e query, não recarrega
    if (currentPath === targetPath) return

    const routeFallback = getRouteInfo(targetUrl.pathname)
    const linkText = extractLinkText(anchor)

    const finalTitle = linkText || routeFallback.title
    const finalSubtitle = routeFallback.subtitle

    sourcePathRef.current = currentPath
    targetPathRef.current = targetPath
    setNavInfo({ title: finalTitle, subtitle: finalSubtitle })
    setIsNavigating(true)
    setIsLoading(true)
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
        // Usa requestAnimationFrame para nunca disparar síncrono durante render/lifecycle do React
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

  // 3. Monitora quando a nova página é carregada
  useEffect(() => {
    if (!isLoading || !sourcePathRef.current) return

    const currentFull = pathname + (searchParams?.toString() ? '?' + searchParams.toString() : '')
    if (currentFull !== sourcePathRef.current) {
      // Nova página entrou e React montou o componente: finaliza o carregamento
      setIsLoading(false)
    }
  }, [pathname, searchParams, isLoading])

  // 4. Failsafe timeout: nunca trava a tela por mais de 5s sob qualquer hipótese
  useEffect(() => {
    if (isNavigating) {
      if (failsafeRef.current) clearTimeout(failsafeRef.current)
      failsafeRef.current = setTimeout(() => {
        setIsLoading(false)
      }, 5000)
    }
    return () => {
      if (failsafeRef.current) clearTimeout(failsafeRef.current)
    }
  }, [isNavigating])

  const handleFinished = useCallback(() => {
    setIsNavigating(false)
    targetPathRef.current = ''
    sourcePathRef.current = ''
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
      minDisplayTimeMs={480}
      onFinished={handleFinished}
    />
  )
}
