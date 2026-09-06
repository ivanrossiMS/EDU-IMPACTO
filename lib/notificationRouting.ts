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
 * 3. Parâmetros de query (ex: id=...) sejam preservados.
 */
export function resolveNotificationRoute(data: any, event?: any, alunoIdFallback?: string | null): string | null {
  if (!data && !event) return null

  // 1. Tentar obter URL completa ou caminho direto fornecido no payload
  const rawUrl =
    data?.target_url ||
    data?.targetUrl ||
    data?.url ||
    data?.full_url ||
    event?.notification?.launchURL ||
    event?.result?.url ||
    ''

  let parsedPath = extractAppPath(rawUrl) || ''
  const itemId = data?.item_id || data?.id

  // 2. Verificar se o push é de acesso institucional / colaborador
  const isColab =
    data?.isColab === true ||
    data?.is_colab === true ||
    data?.perfil === 'colaborador' ||
    parsedPath.includes('/colaborador/')

  if (isColab) {
    let route = parsedPath
    if (!route || !route.includes('/colaborador/')) {
      const section = data?.rota || typeToRoute(data?.type || data?.tipo) || 'comunicados'
      route = `/agenda-digital/colaborador/${section}`
    }
    if (itemId && !route.includes('id=')) {
      route += (route.includes('?') ? '&' : '?') + `id=${itemId}`
    }
    return route
  }

  // 3. Se temos uma rota específica já construída para o aluno (ex: /agenda-digital/123/comunicados)
  if (
    parsedPath &&
    !parsedPath.startsWith('/agenda-digital/comunicados') &&
    !parsedPath.startsWith('/agenda-digital/momentos') &&
    !parsedPath.startsWith('/agenda-digital/calendario')
  ) {
    let route = parsedPath
    if (itemId && !route.includes('id=')) {
      route += (route.includes('?') ? '&' : '?') + `id=${itemId}`
    }
    return route
  }

  // 4. Caso padrão familiar: usar o aluno_id do payload ou o aluno atualmente ativo
  const section = data?.rota || typeToRoute(data?.type || data?.tipo)
  if (section) {
    const slug = data?.aluno_id || alunoIdFallback
    let route = slug ? `/agenda-digital/${slug}/${section}` : `/agenda-digital?redirect=${section}`
    if (itemId && !route.includes('id=')) {
      route += (route.includes('?') ? '&' : '?') + `id=${itemId}`
    }
    return route
  }

  if (parsedPath) {
    let route = parsedPath
    if (itemId && !route.includes('id=')) {
      route += (route.includes('?') ? '&' : '?') + `id=${itemId}`
    }
    return route
  }

  return null
}
