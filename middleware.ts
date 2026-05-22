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
  '/api/auth',          // endpoints de login/logout/me
  '/api/agenda/perfil-acesso', // acesso público da agenda
  '/monitor-tv',        // painel TV da portaria
  '/painel-tablet',     // tablet da portaria
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

  // Verifica sessão — getUser() é a chamada segura (valida JWT no servidor)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Sem sessão → redireciona para login ───────────────────────────────────
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    // Guarda a URL que o usuário tentou acessar para redirecionar após login
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
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
