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
  '/api/auth',          // endpoints de login/logout/me
  '/api/agenda',        // endpoints da agenda que o aluno acessa sem auth do supabase
  '/api/test',
  '/monitor-tv',        // painel TV da portaria
  '/painel-tablet',     // tablet da portaria
  '/api/portaria/webhook', // catraca iDFace — recebe push dos dispositivos (auth por token próprio)
  '/api/academico/totem-frequencia', // catraca/totem — auth por token próprio (API_TOTEM_SECRET)
  '/api/saida/config',  // TV e tablet precisam acessar sem redirect
  '/api/saida/calls',   // TV e tablet precisam acessar sem redirect
  '/recibo',            // recibos públicos
  '/_next',             // assets Next.js
  '/favicon.ico',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Sempre deixa passar rotas públicas e assets
  if (isPublicPath(pathname)) {
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verifica sessão via JWT local para performance no middleware (evita 2.5s de latência)
  // O getUser() real e seguro continua sendo chamado nas rotas de API via requireAuth()
  // O getUser() real e seguro continua sendo chamado nas rotas de API via requireAuth()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Sem sessão → redireciona para login ───────────────────────────────────
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login para continuar.' },
        { status: 401 }
      )
    }
    const loginUrl = new URL('/login', request.url)
    // Guarda a URL que o usuário tentou acessar para redirecionar após login
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
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

  // ── Com sessão → adiciona headers de segurança extras ────────────────────
  // Previne clickjacking nas páginas protegidas
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')

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
