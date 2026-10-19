/**
 * middleware.ts — Edge Auth Guard
 *
 * Executa NO EDGE antes de qualquer route handler ou Server Component.
 * Protege rotas autenticadas, refresca o token Supabase e aplica RBAC básico.
 *
 * FLUXO:
 *  1. Rotas públicas → passa direto (login, api, assets)
 *  2. Rotas protegidas → verifica sessão Supabase
 *  3. Sem sessão → redireciona para /login
 *  4. Com sessão → refresca token nos cookies e segue
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ── Rotas que NÃO precisam de autenticação ─────────────────────────────────
const PUBLIC_PATHS = [
  '/login',
  '/esqueci-senha',
  '/atualizar-senha',
  '/auth/callback',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/verify-first-access',
  '/api/auth/update-password',
  '/api/auth/recover-password',
  '/api/auth/first-access',
  '/api/push/sync-subscription', // Sincronização direta de push OneSignal (App Móvel / WebView)
  '/monitor-tv',        // painel TV da portaria
  '/painel-tablet',     // tablet da portaria
  '/api/portaria/webhook', // catraca iDFace — recebe push dos dispositivos (auth por token próprio)
  '/api/notifications', // endpoints padrão de push do Control iD (/api/notifications/dao, etc.)
  '/api/agenda/notificacoes/reads', // Leitura de notificações dos colaboradores
  '/api/portaria/sync-queue', // fila de sincronização para catracas/daemon local
  '/api/portaria/cron-push', // cron job da portaria
  '/api/cron',          // rotas de cron jobs agendados (auth interna via CRON_SECRET)
  '/api/academico/totem-frequencia', // catraca/totem — auth por token próprio (API_TOTEM_SECRET)
  '/api/saida/config',  // TV e tablet precisam acessar sem redirect
  '/api/saida/calls',   // TV e tablet precisam acessar sem redirect
  '/recibo',            // recibos públicos
  '/assinar',           // Portal público de assinatura eletrônica de contratos
  '/validar-assinatura',// Consulta pública de autenticidade e validade jurídica de documentos
  '/api/matriculas/digital/validar', // Validação pública de protocolo/hash
  '/api/matriculas/digital/enviar-otp', // Envio de OTP para assinatura pública
  '/api/matriculas/digital/verificar-otp', // Verificação de OTP para assinatura pública
  '/api/matriculas/digital/assinar', // Assinatura pública selada com certificado
  '/api/matriculas/digital/reenviar-email', // Reenvio público com token ou protocolo
  '/api/matriculas/digital/pdf', // Visualização do PDF no portal de assinatura
  '/api/matriculas/zapsign/webhook', // Webhook externo do ZapSign
  '/_next',             // assets Next.js
  '/favicon.ico',
  '/pdf.worker',
  '/cmaps',
  '/standard_fonts',
  '/api/chat/media/preview',
  '/manifest.webmanifest',
  '/manifest.json',
  '/api/webhooks',      // webhooks externos (Asaas, etc)
  '/ajuda',             // Central de ajuda pública
  '/pesquisa',          // Formulários de pesquisa de clima (público)
  '/api/pesquisa',      // API pública para formulários de pesquisa
  '/guia-seguranca-digital', // Guia E-book de Segurança Digital (Público/Orfão)
  '/guia-seguranca',    // Alias do guia público
  '/regimento-interno', // Regimento Interno do Colégio Impacto (Público/Orfão)
  '/regulamento-interno', // Regulamento Interno de Trabalho para Funcionários (Público/Orfão)
  '/politica-de-privacidade', // Política de Privacidade oficial (App Store / Google Play / LGPD)
  '/privacidade',             // Alias público de privacidade
  '/splash-preview',          // Pré-visualização da tela cinematográfica de carregamento
  '/api/gestao-pessoas/materiais-divulgacao', // Central de materiais de divulgação (acesso público para incremento de visitas)
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_PATHS.some(p => {
    if (p === '/pesquisa') return pathname === '/pesquisa' || pathname.startsWith('/pesquisa/')
    return pathname.startsWith(p)
  })
}

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  try {
    const hostname = new URL(url).hostname
    return hostname.split('.')[0] || 'default'
  } catch {
    return 'default'
  }
}

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
}

const EDGE_TOKEN_CACHE_TTL_MS = 45_000
const edgeVerifiedTokenCache = new Map<string, { user: any; expiresAt: number }>()
const edgeInflightVerifications = new Map<string, Promise<{ user: any | null; isTransientError: boolean }>>()

function getEdgeJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4 !== 0) b64 += '='
    const binStr = atob(b64)
    const bytes = new Uint8Array(binStr.length)
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i)
    const payload = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof payload?.exp === 'number') {
      return payload.exp * 1000
    }
  } catch {}
  return null
}

function isEdgeJwtTokenExpired(token: string, clockSkewSeconds = 0): boolean {
  const expMs = getEdgeJwtExpMs(token)
  if (expMs === null) return false
  return expMs <= Date.now() + clockSkewSeconds * 1000
}

function extractEdgeAccessTokenFromCookies(
  allCookies: Array<{ name: string; value: string }>,
  projectRef: string
): string | null {
  try {
    if (!allCookies || allCookies.length === 0) return null
    const baseName = `sb-${projectRef}-auth-token`
    let rawValue = ''
    const exact = allCookies.find(c => c.name === baseName && c.value)
    if (exact) {
      rawValue = exact.value
    } else {
      const chunks = allCookies
        .filter(c => c.name.startsWith(`${baseName}.`) && /^\d+$/.test(c.name.slice(baseName.length + 1)))
        .sort((a, b) => {
          const idxA = parseInt(a.name.slice(baseName.length + 1), 10)
          const idxB = parseInt(b.name.slice(baseName.length + 1), 10)
          return idxA - idxB
        })
      if (chunks.length > 0) {
        rawValue = chunks.map(c => c.value).join('')
      }
    }

    if (!rawValue) {
      const fallback = allCookies.find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token') && c.value)
      if (fallback) rawValue = fallback.value
    }
    if (!rawValue) return null

    let jsonStr = rawValue
    if (jsonStr.startsWith('base64-')) {
      let b64 = jsonStr.slice(7).replace(/-/g, '+').replace(/_/g, '/')
      while (b64.length % 4 !== 0) b64 += '='
      const binStr = atob(b64)
      const bytes = new Uint8Array(binStr.length)
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i)
      jsonStr = new TextDecoder().decode(bytes)
    } else if (jsonStr.startsWith('%7B') || jsonStr.startsWith('%5B')) {
      jsonStr = decodeURIComponent(jsonStr)
    }

    const parsed = JSON.parse(jsonStr)
    const token = parsed?.access_token || (Array.isArray(parsed) ? parsed[0] : null)
    if (typeof token === 'string' && token.split('.').length === 3) {
      return token
    }
  } catch {}
  return null
}

async function verifyEdgeTokenWithDedup(
  supabase: any,
  token: string
): Promise<{ user: any | null; isTransientError: boolean }> {
  if (!token || isEdgeJwtTokenExpired(token, 0)) {
    edgeVerifiedTokenCache.delete(token)
    return { user: null, isTransientError: false }
  }

  const now = Date.now()
  const cached = edgeVerifiedTokenCache.get(token)
  if (cached && cached.expiresAt > now && cached.user) {
    return { user: cached.user, isTransientError: false }
  }

  let inflight = edgeInflightVerifications.get(token)
  if (!inflight) {
    inflight = (async () => {
      try {
        const userPromise = supabase.auth.getUser(token)
        const timeoutPromise = new Promise<{ data: { user: any }; error?: any }>(res =>
          setTimeout(() => res({ data: { user: null }, error: new Error('TIMEOUT') }), 8000)
        )
        const { data, error } = await Promise.race([userPromise, timeoutPromise])
        if (!error && data?.user) {
          if (edgeVerifiedTokenCache.size > 500) edgeVerifiedTokenCache.clear()
          const expMs = getEdgeJwtExpMs(token)
          const cacheUntil = Date.now() + EDGE_TOKEN_CACHE_TTL_MS
          edgeVerifiedTokenCache.set(token, {
            user: data.user,
            expiresAt: expMs ? Math.min(cacheUntil, expMs) : cacheUntil
          })
          return { user: data.user, isTransientError: false }
        }
        if (error) {
          const errMsg = (error.message || '').toLowerCase()
          const transient =
            errMsg.includes('timeout') ||
            errMsg.includes('fetch') ||
            errMsg.includes('network') ||
            (error as any).name === 'AuthRetryableFetchError'
          return { user: null, isTransientError: transient }
        }
        return { user: null, isTransientError: false }
      } catch {
        return { user: null, isTransientError: true }
      }
    })().finally(() => {
      edgeInflightVerifications.delete(token)
    })
    edgeInflightVerifications.set(token, inflight)
  }

  return inflight
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Interceptação de links de recuperação de senha (type=recovery ou token_hash) ──
  if (
    !pathname.startsWith('/atualizar-senha') &&
    !pathname.startsWith('/api/') &&
    (request.nextUrl.searchParams.get('type') === 'recovery' ||
      request.nextUrl.searchParams.has('token_hash'))
  ) {
    const recoveryUrl = new URL('/atualizar-senha', request.url)
    request.nextUrl.searchParams.forEach((val, key) => {
      recoveryUrl.searchParams.set(key, val)
    })
    return NextResponse.redirect(recoveryUrl)
  }

  // ── Interceptação de /login para usuários com sessão ativa (Zero Flash) ──────
  if (pathname === '/login') {
    const hasLogoutBarrier = request.cookies.has('edu_logout_pending_barrier')
    const stepParam = request.nextUrl.searchParams.get('step')

    // Se não há logout pendente e nenhum step especial solicitado (como choose_system ou primeiro acesso):
    if (!hasLogoutBarrier && !stepParam) {
      const projectRef = getProjectRef()
      const allCookies = request.cookies.getAll()
      const loginCookieToken = extractEdgeAccessTokenFromCookies(allCookies, projectRef)

      if (loginCookieToken && !isEdgeJwtTokenExpired(loginCookieToken, 0)) {
        try {
          const supabaseAuthCheck = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              cookies: {
                getAll() {
                  return request.cookies.getAll()
                },
                setAll() {},
              },
              auth: { autoRefreshToken: false },
            }
          )

          const { user: verifiedLoginUser } = await verifyEdgeTokenWithDedup(supabaseAuthCheck, loginCookieToken)
          const data = { user: verifiedLoginUser }

          if (data.user) {
            const redirectParam = request.nextUrl.searchParams.get('next') || request.nextUrl.searchParams.get('redirect')
            if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
              return NextResponse.redirect(new URL(redirectParam, request.url))
            }

            const perfil = data.user.user_metadata?.perfil || ''
            const cargo = data.user.user_metadata?.cargo || ''
            const appRoleType = data.user.app_metadata?.role_type || ''
            const hasOnlyFamilyIds = Boolean(data.user.user_metadata?.aluno_id || data.user.user_metadata?.responsavel_id) &&
              !data.user.user_metadata?.system_user_id &&
              !data.user.user_metadata?.colaborador_id &&
              !data.user.user_metadata?.hasDualRole
            const isFamilyOrStudent = (
              appRoleType === 'aluno' ||
              appRoleType === 'responsavel' ||
              perfil === 'Família' ||
              perfil === 'Responsável' ||
              perfil === 'Aluno' ||
              cargo === 'Responsável' ||
              cargo === 'Aluno' ||
              hasOnlyFamilyIds
            )

            if (isFamilyOrStudent) {
              return NextResponse.redirect(new URL('/agenda-digital', request.url))
            } else {
              return NextResponse.redirect(new URL('/', request.url))
            }
          }
        } catch {
          // Em caso de erro na checagem no Edge, segue normalmente para renderização
        }
      }
    }
  }

  // Sempre deixa passar rotas públicas e assets
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Permite checagem inicial de master/setup sem autenticação (apenas leitura GET)
  if (request.method === 'GET' && pathname === '/api/configuracoes/usuarios' && request.nextUrl.searchParams.get('checkMaster') === 'true') {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // 365 dias (1 ano) em segundos — dentro do padrão RFC 6265bis e sem overflow de 32 bits
  const SAFE_SESSION_SECONDS = 31536000;
  const isApiRoute = pathname.startsWith('/api/')

  // Cria cliente Supabase SSR no edge — lê/escreve cookies da requisição
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Escreve cookies novos na response (token refresh para navegação web)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            if (options?.maxAge === 0 || value === '') {
              response.cookies.set(name, '', { ...options, maxAge: 0, path: '/' })
              return
            }
            const sessionOptions = { ...options };
            const expires = new Date(Date.now() + SAFE_SESSION_SECONDS * 1000);
            sessionOptions.maxAge = SAFE_SESSION_SECONDS;
            sessionOptions.expires = expires;
            sessionOptions.path = options?.path || '/';
            sessionOptions.sameSite = options?.sameSite || 'lax';
            response.cookies.set(name, value, sessionOptions)
          })
        },
      },
      auth: isApiRoute ? { autoRefreshToken: false } : undefined,
    }
  )

  // ── 1. Verificação de Autenticação com Bearer Token (Mobile / API Clients) ──
  const authHeader = request.headers.get('authorization')
  const hasBearer = authHeader ? authHeader.toLowerCase().startsWith('bearer ') : false
  const bearerToken = hasBearer ? authHeader!.substring(7).trim() : null

  let user = null
  let isTransientError = false

  if (bearerToken) {
    // REGRA DE SEGURANÇA: Se o Bearer foi fornecido explicitamente, ele é a credencial autoritativa.
    // NUNCA assume silenciosamente identidade do cookie se o Bearer falhar.
    const verified = await verifyEdgeTokenWithDedup(supabase, bearerToken)
    user = verified.user
    isTransientError = verified.isTransientError

    // Se o Bearer token for inválido ou expirado, rejeita com 401 imediato sem rotacionar no servidor
    if (!user) {
      if (isTransientError) {
        return NextResponse.json(
          { error: 'Serviço de autenticação temporariamente indisponível.', isNetworkError: true },
          { status: 503, headers: NO_CACHE_HEADERS }
        )
      }
      return NextResponse.json(
        { error: 'Não autorizado. Token expirado ou inválido.', code: 'token_expired' },
        { status: 401, headers: { ...NO_CACHE_HEADERS, 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
      )
    }
  } else {
    // ── 2. Fluxo por Cookies (Navegação Web / SSR / fetch sem Bearer) ──
    const cookieToken = extractEdgeAccessTokenFromCookies(request.cookies.getAll(), getProjectRef())
    if (cookieToken) {
      const verified = await verifyEdgeTokenWithDedup(supabase, cookieToken)
      user = verified.user
      isTransientError = verified.isTransientError
    }

    // Se não for rota de API (ex: navegação de página HTML e o access_token do cookie expirou),
    // permite que o @supabase/ssr tente refrescar a sessão uma única vez na navegação da página.
    if (!user && !isTransientError && (!isApiRoute || !cookieToken)) {
      try {
        const userPromise = supabase.auth.getUser()
        const timeoutPromise = new Promise<{ data: { user: any }, error?: any }>(res =>
          setTimeout(() => res({ data: { user: null }, error: new Error('TIMEOUT') }), 8000)
        )
        const { data, error } = await Promise.race([userPromise, timeoutPromise])
        if (!error && data?.user) {
          user = data.user
          if (cookieToken) {
            edgeVerifiedTokenCache.set(cookieToken, {
              user: data.user,
              expiresAt: Date.now() + EDGE_TOKEN_CACHE_TTL_MS
            })
          }
        } else if (error) {
          const errMsg = (error.message || '').toLowerCase()
          if (
            errMsg.includes('timeout') ||
            errMsg.includes('fetch') ||
            errMsg.includes('network') ||
            (error as any).name === 'AuthRetryableFetchError'
          ) {
            isTransientError = true
          }
        }
      } catch (err: any) {
        isTransientError = true
        if (!err?.message?.includes('Refresh Token') && err?.code !== 'refresh_token_not_found') {
          console.warn('[Middleware Auth Warning]', err)
        }
      }
    }
  }

  // ── Sem sessão no Edge (após verificação de cookies) ─────────────────────
  if (!user) {
    if (pathname.startsWith('/api/')) {
      if (isTransientError) {
        return NextResponse.json(
          { error: 'Serviço de autenticação temporariamente indisponível.', isNetworkError: true },
          { status: 503, headers: NO_CACHE_HEADERS }
        )
      }
      return NextResponse.json(
        { error: 'Não autorizado. Faça login para continuar.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      )
    }

    // Para requisições de página (HTML):
    const projectRef = getProjectRef()
    const allCookies = request.cookies.getAll()
    const hasAuthCookie = allCookies.some(
      c => (c.name === `sb-${projectRef}-auth-token` || c.name.startsWith(`sb-${projectRef}-auth-token.`)) && c.value.length > 0
    )
    const hasKeepConnected = request.cookies.has('edu_keep_connected')
    const hasLogoutBarrier = request.cookies.has('edu_logout_pending_barrier')
    const userAgent = request.headers.get('user-agent') || ''
    const isCapacitorClient = userAgent.includes('Capacitor') || request.headers.has('x-capacitor-platform')

    // Se houve logout explícito recente (marcador persistente), NUNCA permite bypass para restaurar credencial
    if (hasLogoutBarrier) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      const redirectResponse = NextResponse.redirect(loginUrl)
      response.cookies.getAll().forEach(c => {
        redirectResponse.cookies.set(c.name, c.value, c)
      })
      return redirectResponse
    }

    // Se houve erro de rede/timeout OU se o cliente possui cookie de sessão do projeto / app móvel,
    // permite o carregamento da página para que o client-side restaure do Keychain/Preferences
    if (isTransientError || hasAuthCookie || hasKeepConnected || isCapacitorClient) {
      return response
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)

    // Repassa cookies definidos/atualizados em response (sem apagar os cookies existentes)
    response.cookies.getAll().forEach(c => {
      redirectResponse.cookies.set(c.name, c.value, c)
    })

    return redirectResponse
  }

  // ── Usuário autenticado: verificar se não é família/aluno tentando acessar rotas do ERP ──
  const perfil = user.user_metadata?.perfil || ''
  const cargo = user.user_metadata?.cargo || ''
  const appRoleType = user.app_metadata?.role_type || ''
  const hasOnlyFamilyIds = Boolean(user.user_metadata?.aluno_id || user.user_metadata?.responsavel_id) &&
    !user.user_metadata?.system_user_id &&
    !user.user_metadata?.colaborador_id &&
    !user.user_metadata?.hasDualRole
  const isFamilyOrStudent = (
    appRoleType === 'aluno' ||
    appRoleType === 'responsavel' ||
    perfil === 'Família' ||
    perfil === 'Responsável' ||
    perfil === 'Aluno' ||
    cargo === 'Responsável' ||
    cargo === 'Aluno' ||
    hasOnlyFamilyIds
  )

  // Família/Aluno só pode acessar /agenda-digital e suas APIs
  if (isFamilyOrStudent) {
    const blockedForFamily = [
      '/api/auth/reset-access',
      '/api/auth/migrate',
      '/api/auth/debug-db',
      '/api/configuracoes/usuarios',
      '/api/configuracoes/importar-backup',
      '/api/configuracoes/google-drive',
      '/api/configuracoes/logs',
      '/api/configuracoes/midia',
      '/api/provas-online/importar',
    ]

    const isExplicitlyBlocked = blockedForFamily.some(
      p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?')
    )

    const allowedForFamily = [
      '/agenda-digital',
      '/assinar',
      '/validar-assinatura',
      '/recibo',
      '/provas-online/fazer',
      '/api/provas-online',
      '/api/alunos',
      '/api/comunicados',
      '/api/agenda',
      '/api/chat',
      '/api/aluno-responsavel',
      '/api/auth',
      '/api/financeiro/titulos',
      '/api/cobrancas',
      '/api/upload-midia',
      '/api/comunicados_respostas',
      '/api/configuracoes',
      '/api/ocorrencias',
      '/api/boletins',
      '/api/academico/frequencias',
      '/api/portaria/eventos',
      '/api/turmas',
      '/api/saida/guardians',
      '/api/saida/rfid',
      '/api/saida/student_guardians',
      '/api/responsaveis',
      '/api/user-photo',
      '/api/user-photo/extra',
      '/api/isaac',        // ← Isaac Escola: financeiro da Agenda Digital
      '/favicon.ico'
    ]

    const isAllowed = !isExplicitlyBlocked && allowedForFamily.some(
      p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?')
    )

    if (!isAllowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Acesso negado. Seu perfil não tem permissão para esta operação.' },
          { status: 403, headers: NO_CACHE_HEADERS }
        )
      }
      return NextResponse.redirect(new URL('/agenda-digital', request.url))
    }
  }

  // ── Com sessão: headers de segurança já estão em next.config.ts (securityHeaders)
  // Não duplicar aqui — evita conflito entre X-Frame-Options: SAMEORIGIN (middleware)
  // e frame-ancestors 'none' (CSP no next.config.ts). O next.config.ts é a fonte da verdade.

  return response
}

// ── Configuração do matcher ────────────────────────────────────────────────
// O middleware só roda nas rotas especificadas abaixo
export const config = {
  matcher: [
    /*
     * Exclui:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - Arquivos com extensão (ex: .png, .svg, .jpg)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|woff|woff2|ttf|bcmap|pfb|webmanifest)$).*)',
  ],
}
