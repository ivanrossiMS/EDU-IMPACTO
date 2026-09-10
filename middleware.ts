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
  '/monitor-tv',        // painel TV da portaria
  '/painel-tablet',     // tablet da portaria
  '/api/portaria/webhook', // catraca iDFace — recebe push dos dispositivos (auth por token próprio)
  '/api/portaria/sync-queue', // fila de sincronização para catracas/daemon local
  '/api/academico/totem-frequencia', // catraca/totem — auth por token próprio (API_TOTEM_SECRET)
  '/api/saida/config',  // TV e tablet precisam acessar sem redirect
  '/api/saida/calls',   // TV e tablet precisam acessar sem redirect
  '/recibo',            // recibos públicos
  '/_next',             // assets Next.js
  '/favicon.ico',
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
  '/api/gestao-pessoas/materiais-divulgacao', // Central de materiais de divulgação (acesso público para incremento de visitas)
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
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
          // Escreve cookies novos na response (token refresh)
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
            // Preserva sessão permanente/vitalícia com rolagem contínua
            const INFINITE_SESSION_SECONDS = 3153600000;
            const expires = new Date(Date.now() + INFINITE_SESSION_SECONDS * 1000);
            sessionOptions.maxAge = INFINITE_SESSION_SECONDS;
            sessionOptions.expires = expires;
            sessionOptions.path = options?.path || '/';
            sessionOptions.sameSite = options?.sameSite || 'lax';
            response.cookies.set(name, value, sessionOptions)
          })
        },
      },
    }
  )

  // PERFORMANCE & RESILIÊNCIA: Timeout de 8s para evitar falsos negativos em conexões móveis (3G/4G).
  let user = null
  try {
    const userPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise<{ data: { user: any }, error?: any }>(res =>
      setTimeout(() => res({ data: { user: null }, error: new Error('TIMEOUT') }), 8000)
    )
    const { data, error } = await Promise.race([userPromise, timeoutPromise])
    if (!error && data?.user) {
      user = data.user
    }
  } catch (err: any) {
    if (!err?.message?.includes('Refresh Token') && err?.code !== 'refresh_token_not_found') {
      console.warn('[Middleware Auth Warning]', err)
    }
  }

  // ── Sem sessão → redireciona para login ──────────────────────────────────
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login para continuar.' },
        { status: 401 }
      )
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
          { status: 403 }
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)$).*)',
  ],
}
