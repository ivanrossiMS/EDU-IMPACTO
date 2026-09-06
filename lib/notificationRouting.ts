/**
 * notificationRouting.ts — Resolução central de Deep Links e Notificações
 *
 * Mapeia eventos de clique de push (OneSignal) e links do Capacitor/App
 * para a rota interna correta da aplicação.
 */

export function extractAppPath(urlStr?: string): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null
  try {
    if (urlStr.startsWith('/')) return urlStr
    const parsed = new URL(urlStr)
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return urlStr.startsWith('/') ? urlStr : `/${urlStr}`
  }
}

export function typeToRoute(type?: string): string {
  if (!type) return ''
  const map: Record<string, string> = {
    comunicados: 'comunicados',
    comunicado:  'comunicados',
    momentos:    'momentos',
    momento:     'momentos',
    calendario:  'calendario',
    evento:      'calendario',
    eventos:     'calendario',
    frequencia:  'frequencia',
    ocorrencias: 'ocorrencias',
    ocorrencia:  'ocorrencias',
    notas:       'notas',
    nota:        'notas',
    cobrancas:   'financeiro',
    cobranca:    'financeiro',
    saida:       'portaria',
  }
  return map[type.toLowerCase()] || type
}

/**
 * Resolve a rota de destino exata ao clicar em qualquer notificação push (Nativo ou Web).
 * Garante que:
 * 1. Pushes institucionais (colaborador) abram diretamente em /agenda-digital/colaborador/{seção}?id=...
 * 2. Pushes familiares abram em /agenda-digital/{alunoId}/{seção}?id=...
 * 3. Notificações abertas por colaborador logado (sem aluno_id) nunca caiam em rotas familiares ou seleção de módulo.
 * 4. Parâmetros de query (ex: id=...) sejam preservados e limpos de sufixos de deduplicação.
 */
export function resolveNotificationRoute(
  data: any,
  event?: any,
  alunoIdFallback?: string | null,
  userContext?: any
): string | null {
  if (!data && !event) return null

  // 1. Extrair payload efetivo (suporta additionalData e rawPayload do Android/iOS)
  let effectiveData: Record<string, any> = { ...(data || {}) }
  if (event?.notification?.additionalData) {
    effectiveData = { ...event.notification.additionalData, ...effectiveData }
  }
  if (event?.notification?.rawPayload && typeof event.notification.rawPayload === 'string') {
    try {
      const parsed = JSON.parse(event.notification.rawPayload)
      if (parsed?.custom?.a) effectiveData = { ...parsed.custom.a, ...effectiveData }
      else if (parsed?.additionalData) effectiveData = { ...parsed.additionalData, ...effectiveData }
    } catch {}
  } else if (event?.notification?.rawPayload && typeof event.notification.rawPayload === 'object') {
    const raw = event.notification.rawPayload
    if (raw?.custom?.a) effectiveData = { ...raw.custom.a, ...effectiveData }
    else if (raw?.additionalData) effectiveData = { ...raw.additionalData, ...effectiveData }
  }

  // 2. Tentar obter URL completa ou caminho direto fornecido no payload
  const rawUrl =
    effectiveData?.target_url ||
    effectiveData?.targetUrl ||
    effectiveData?.url ||
    effectiveData?.full_url ||
    event?.notification?.launchURL ||
    event?.result?.url ||
    ''

  let parsedPath = extractAppPath(rawUrl) || ''

  // Limpar itemId de sufixos de deduplicação (ex: -reminder, -all-students)
  const rawItemId = effectiveData?.item_id || effectiveData?.id
  let itemId = rawItemId ? String(rawItemId).trim() : null
  if (itemId) {
    itemId = itemId
      .replace(/-all-students-reminder$/, '')
      .replace(/-all-students$/, '')
      .replace(/-reminder$/, '')
  }

  // 3. Determinar se o usuário atualmente logado é da equipe institucional (colaborador/admin)
  let isUserColaborador = false
  const user = userContext || (typeof window !== 'undefined' ? (() => {
    try {
      const stored = localStorage.getItem('edu-current-user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })() : null)

  if (user) {
    const perfil = String(user.perfil || '').toLowerCase().trim()
    const cargo = String(user.cargo || '').toLowerCase().trim()
    const isFamily =
      perfil === 'família' ||
      perfil === 'familia' ||
      perfil === 'responsável' ||
      perfil === 'responsavel' ||
      perfil === 'aluno' ||
      cargo === 'responsável' ||
      cargo === 'responsavel' ||
      cargo === 'aluno'
    isUserColaborador = !isFamily
  } else if (typeof window !== 'undefined') {
    const perfilStored = (localStorage.getItem('edu-current-perfil') || '').toLowerCase().trim()
    if (perfilStored && !['família', 'familia', 'responsável', 'responsavel', 'aluno'].includes(perfilStored)) {
      isUserColaborador = true
    }
  }

  const section = effectiveData?.rota || typeToRoute(effectiveData?.type || effectiveData?.tipo)

  // 4. Verificar se o push é de acesso institucional / colaborador
  const isColab =
    effectiveData?.isColab === true ||
    effectiveData?.is_colab === true ||
    effectiveData?.perfil === 'colaborador' ||
    effectiveData?.destino === 'interno' ||
    parsedPath.includes('/colaborador/') ||
    // Se o usuário está logado como colaborador e a notificação não é exclusiva de um aluno
    (isUserColaborador && !effectiveData?.aluno_id)

  if (isColab) {
    let route = parsedPath
    if (!route || !route.includes('/colaborador/')) {
      const sec = section || 'comunicados'
      route = `/agenda-digital/colaborador/${sec}`
    } else if (itemId && route.includes('id=')) {
      route = route.replace(/id=[^&]+/, `id=${encodeURIComponent(itemId)}`)
    }
    if (itemId && !route.includes('id=')) {
      route += (route.includes('?') ? '&' : '?') + `id=${encodeURIComponent(itemId)}`
    }
    return route
  }

  // 5. Se temos uma rota específica já construída para o aluno (ex: /agenda-digital/123/comunicados)
  if (
    parsedPath &&
    !parsedPath.startsWith('/agenda-digital/comunicados') &&
    !parsedPath.startsWith('/agenda-digital/momentos') &&
    !parsedPath.startsWith('/agenda-digital/calendario')
  ) {
    let route = parsedPath
    if (itemId && !route.includes('id=')) {
      route += (route.includes('?') ? '&' : '?') + `id=${encodeURIComponent(itemId)}`
    }
    return route
  }

  // 6. Caso padrão familiar: usar o aluno_id do payload ou o aluno atualmente ativo
  if (section) {
    const slug = effectiveData?.aluno_id || alunoIdFallback
    let route = slug ? `/agenda-digital/${slug}/${section}` : `/agenda-digital?redirect=${section}`
    if (itemId && !route.includes('id=')) {
      route += (route.includes('?') ? '&' : '?') + `id=${encodeURIComponent(itemId)}`
    }
    return route
  }

  if (parsedPath) {
    let route = parsedPath
    if (itemId && !route.includes('id=')) {
      route += (route.includes('?') ? '&' : '?') + `id=${encodeURIComponent(itemId)}`
    }
    return route
  }

  return null
}
