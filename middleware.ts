import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            if (value !== '') {
              delete options.maxAge
              delete options.expires
            }
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const path = request.nextUrl.pathname

  // ── Always bypass static assets ───────────────────────────────────────────────
  if (
    path.startsWith('/_next') ||
    path.includes('.')  // static files (images, fonts, etc.)
  ) {
    return supabaseResponse
  }

  // ── Public auth endpoints (no session needed) ─────────────────────────────────
  const isPublicApi =
    path === '/api/auth/callback' ||
    path === '/api/auth/login' ||
    path === '/api/auth/logout' ||
    path.startsWith('/api/auth/logout') ||
    path === '/api/auth/update-password' ||
    path === '/api/auth/verify-first-access' ||
    path === '/api/configuracoes/usuarios' ||        // needed for bootstrap + login page check
    path === '/api/recibos/validar' ||
    path.startsWith('/api/recibos/validar/')

  if (isPublicApi) {
    return supabaseResponse
  }

  // ── Validate session ──────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()

  // ── /login page: let unauthenticated through, redirect authenticated to app ───
  if (path === '/login' || path.startsWith('/login/')) {
    if (user) {
      const perfil = user.user_metadata?.perfil
      const cargo  = user.user_metadata?.cargo
      let dest = '/dashboard'
      if (perfil === 'Família' || cargo === 'Aluno' || cargo === 'Responsável') dest = '/agenda-digital'
      if (perfil === 'Professor') dest = '/professor'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return supabaseResponse
  }

  // ── Root → redirect to dashboard (or login if not authed) ────────────────────
  if (path === '/') {
    if (user) return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── If not authenticated ──────────────────────────────────────────────────────
  if (!user) {
    if (path.startsWith('/api/')) {
      // API calls: always return JSON — never HTML redirect
      return NextResponse.json(
        { error: 'Sessão expirada. Faça login novamente.' },
        { status: 401 }
      )
    }
    // Page request: redirect to login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
