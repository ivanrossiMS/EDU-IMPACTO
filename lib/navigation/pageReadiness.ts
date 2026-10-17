'use client'

/**
 * Monitor global de prontidão de navegação (Rede + DOM + Redirecionamentos).
 * Garante que a tela de carregamento (AgendaLuxuryLoader) nunca suma antes de:
 * 1. A rota de destino ter efetivamente entrado no Next.js (pathname atualizado e sem redirect intermediário);
 * 2. Todas as requisições de dados (/api/...) disparadas pela página nova terem finalizado;
 * 3. Os indicadores visuais de carregamento (skeletons, spinners de página, LoadingGlass) terem sido substituídos pelo conteúdo real.
 */

type Listener = () => void

let activeRequests = new Map<number, { url: string; startTime: number }>()
let nextRequestId = 1
let lastRequestEndTime = 0
let isFetchPatched = false
let globalNavOverlayActive = false
const listeners = new Set<Listener>()

function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn()
    } catch {}
  })
}

export function setGlobalNavOverlayActive(active: boolean) {
  if (globalNavOverlayActive !== active) {
    globalNavOverlayActive = active
    notifyListeners()
  }
}

export function isGlobalNavOverlayActive(): boolean {
  return globalNavOverlayActive
}

/**
 * Filtra endpoints de telemetria/background que não bloqueiam a renderização visual da página.
 */
function isBackgroundFireAndForgetUrl(urlStr: string, method: string): boolean {
  if (!urlStr) return true
  if (
    urlStr.includes('/api/agenda/notificacoes/marcar-lido') ||
    urlStr.includes('/api/audit') ||
    urlStr.includes('/api/web-vitals') ||
    urlStr.includes('/api/logs') ||
    urlStr.includes('_next/webpack-hmr') ||
    urlStr.includes('onesignal.com')
  ) {
    return true
  }
  // Leituras de chamadas de portaria em background (polling periódico) não devem travar se já passou o boot
  if (method !== 'GET' && !urlStr.includes('/api/provas-online') && !urlStr.includes('/api/agenda')) {
    return true
  }
  return false
}

function extractSameOriginApiUrl(input: RequestInfo | URL): string | null {
  if (typeof window === 'undefined') return null
  let raw = ''
  if (typeof input === 'string') {
    raw = input
  } else if (input instanceof URL) {
    raw = input.href
  } else if (input && typeof input === 'object' && 'url' in input) {
    raw = (input as Request).url
  }
  if (!raw) return null

  if (raw.startsWith('/api/')) return raw
  try {
    const parsed = new URL(raw, window.location.origin)
    if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')) {
      return parsed.pathname + parsed.search
    }
  } catch {}
  return null
}

export function ensureFetchTrackerInstalled() {
  if (typeof window === 'undefined' || isFetchPatched) return
  isFetchPatched = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const apiUrl = extractSameOriginApiUrl(input)
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET') || 'GET').toUpperCase()

    if (!apiUrl || isBackgroundFireAndForgetUrl(apiUrl, method)) {
      return originalFetch(input, init)
    }

    const reqId = nextRequestId++
    activeRequests.set(reqId, { url: apiUrl, startTime: Date.now() })
    notifyListeners()

    try {
      return await originalFetch(input, init)
    } finally {
      activeRequests.delete(reqId)
      lastRequestEndTime = Date.now()
      notifyListeners()
    }
  }
}

export function subscribeToNetworkActivity(listener: Listener): () => void {
  ensureFetchTrackerInstalled()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Retorna a quantidade de requisições `/api/...` em andamento (descartando requisições zumbis com > 12s).
 */
export function getActiveApiRequestsCount(): number {
  const now = Date.now()
  let count = 0
  for (const [id, req] of activeRequests.entries()) {
    if (now - req.startTime > 12000) {
      activeRequests.delete(id)
    } else {
      count++
    }
  }
  return count
}

export function getLastApiRequestEndTime(): number {
  return lastRequestEndTime
}

/**
 * Detecta se a rota atual é uma página puramente intermediária de redirecionamento
 * (que dispara router.replace imediatamente após montar).
 */
export function isIntermediateRedirectRoute(pathname: string | null): boolean {
  if (!pathname) return true
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (clean === '/' || clean === '/agenda-digital' || clean === '/agenda-digital/colaborador') {
    return true
  }

  // Rotas /agenda-digital/[slug] com apenas 2 segmentos (ex: /agenda-digital/4697 ou /agenda-digital/comunicados)
  // exceto rotas reais de 2 segmentos (/agenda-digital/admin, /agenda-digital/selecionar-aluno, /agenda-digital/selecionar-perfil-admin)
  const segments = clean.split('/').filter(Boolean)
  if (segments.length === 2 && segments[0] === 'agenda-digital') {
    const second = segments[1].toLowerCase()
    if (!['admin', 'selecionar-aluno', 'selecionar-perfil-admin'].includes(second)) {
      return true
    }
  }

  return false
}

/**
 * Verifica se a área principal da página (<main> / .ad-content-page-area / .page-content)
 * ainda está exibindo esqueletos (skeletons), tela vazia ou spinners de carregamento de página inteira.
 */
export function isMainContentStillLoading(): boolean {
  if (typeof document === 'undefined') return false

  const containers = document.querySelectorAll<HTMLElement>(
    '.ad-content-page-area, main.ad-content-inner, main.page-content, main'
  )

  if (containers.length === 0) {
    // Se estamos numa página sem <main> (ex: selecionar-aluno), verifica [data-page-loading="true"] no body
    return document.querySelector('[data-page-loading="true"]') !== null
  }

  for (let i = 0; i < containers.length; i++) {
    const container = containers[i]

    // 1. Marcador explícito de carregamento de página ou skeleton
    if (container.querySelector('[data-page-loading="true"]')) {
      return true
    }

    // 2. Skeletons conhecidos da Agenda Digital e ERP
    if (
      container.querySelector('.ultra-shimmer') ||
      container.querySelector('[style*="pulse-skeleton"]') ||
      container.querySelector('.polaroid-card [style*="pulse"]') ||
      container.querySelector('.spinner')
    ) {
      return true
    }

    // 3. Spinners de página inteira (Loader2 grande >= 28px ou div com animation: spin de tamanho >= 28px)
    const spinningLoaders = container.querySelectorAll<SVGElement | HTMLElement>(
      'svg.lucide-loader-2.animate-spin, svg.lucide-loader-circle.animate-spin, [style*="animation: spin"]'
    )
    for (let j = 0; j < spinningLoaders.length; j++) {
      const el = spinningLoaders[j]
      const rect = el.getBoundingClientRect()
      if (rect.width >= 26 && rect.height >= 26) {
        return true
      }
    }
  }

  return false
}
