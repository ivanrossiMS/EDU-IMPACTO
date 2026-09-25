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
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/verify-first-access',
  '/api/auth/update-password',
  '/api/auth/reset-access',
  '/api/auth/debug-db',
  '/api/test',
  '/api/push/sync-subscription', // Sincronização direta de push OneSignal (App Móvel / WebView)
  '/monitor-tv',        // painel TV da portaria
  '/painel-tablet',     // tablet da portaria
  '/api/portaria/webhook', // catraca iDFace — recebe push dos dispositivos (auth por token próprio)
  '/api/notifications', // endpoints padrão de push do Control iD (/api/notifications/dao, etc.)
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
  '/_next',             // assets Next.js
  '/favicon.ico',
  '/pdf.worker',
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
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Sempre deixa passar rotas públicas e assets
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Permite checagem inicial de master/setup sem autenticação
  if (pathname === '/api/configuracoes/usuarios' && request.nextUrl.searchParams.get('checkMaster') === 'true') {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // 365 dias (1 ano) em segundos — dentro do padrão RFC 6265bis e sem overflow de 32 bits
  const SAFE_SESSION_SECONDS = 31536000;

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
    try {
      const userPromise = supabase.auth.getUser(bearerToken)
      const timeoutPromise = new Promise<{ data: { user: any }, error?: any }>(res =>
        setTimeout(() => res({ data: { user: null }, error: new Error('TIMEOUT') }), 8000)
      )
      const { data, error } = await Promise.race([userPromise, timeoutPromise])
      if (!error && data?.user) {
        user = data.user
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
    }

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
    // ── 2. Fluxo Tradicional por Cookies (Navegação Web / SSR) ──
    try {
      const userPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise<{ data: { user: any }, error?: any }>(res =>
        setTimeout(() => res({ data: { user: null }, error: new Error('TIMEOUT') }), 8000)
      )
      const { data, error } = await Promise.race([userPromise, timeoutPromise])
      if (!error && data?.user) {
        user = data.user
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
  const isFamilyOrStudent = (
    perfil === 'Família' ||
    perfil === 'Responsável' ||
    perfil === 'Aluno' ||
    cargo === 'Responsável' ||
    cargo === 'Aluno'
  )

  // Família/Aluno só pode acessar /agenda-digital e suas APIs
  if (isFamilyOrStudent) {
    const allowedForFamily = [
      '/agenda-digital',
      '/assinar',
      '/validar-assinatura',
      '/recibo',
      '/api/alunos',
      '/api/comunicados',
      '/api/agenda',
      '/api/aluno-responsavel',
      '/api/auth',
      '/api/financeiro/baixar-por-responsavel',
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

    const isAllowed = allowedForFamily.some(
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
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|webmanifest)$).*)',
  ],
}
