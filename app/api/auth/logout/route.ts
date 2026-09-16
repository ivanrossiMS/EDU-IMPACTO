import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

// GET: browser navigation — clears session AND redirects to /login in one atomic response
export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/login', request.url)
  const response = NextResponse.redirect(redirectUrl, { status: 302 })
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
  const projectCookiePrefix = `sb-${projectRef}-auth-token`

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              path: options?.path || '/',
              maxAge: 0,
              expires: new Date(0),
            })
          )
        },
      },
    }
  )

  try {
    await supabase.auth.signOut()
  } catch (error) {
    // Silencia erros de token durante signOut
  }

  // Limpeza explícita RFC 6265 restrita ao projeto atual e migração de cookies legados HttpOnly
  request.cookies.getAll().forEach(cookie => {
    if (cookie.name === projectCookiePrefix || cookie.name.startsWith(`${projectCookiePrefix}.`) || cookie.name === 'edu_keep_connected') {
      response.cookies.set(cookie.name, '', {
        maxAge: 0,
        expires: new Date(0),
        path: '/',
        sameSite: 'lax',
      })
    }
  })
  response.cookies.set('edu_keep_connected', '', { maxAge: 0, expires: new Date(0), path: '/' })
  response.cookies.set('edu_logout_pending_barrier', '1', { maxAge: 86400, path: '/', sameSite: 'lax' })

  return response
}

// POST: programmatic API call — returns JSON OK
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
  const projectCookiePrefix = `sb-${projectRef}-auth-token`

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              path: options?.path || '/',
              maxAge: 0,
              expires: new Date(0),
            })
          )
        },
      },
    }
  )

  try {
    await supabase.auth.signOut()
  } catch (error) {
    // Silencia erros durante signOut
  }

  request.cookies.getAll().forEach(cookie => {
    if (cookie.name === projectCookiePrefix || cookie.name.startsWith(`${projectCookiePrefix}.`) || cookie.name === 'edu_keep_connected') {
      response.cookies.set(cookie.name, '', {
        maxAge: 0,
        expires: new Date(0),
        path: '/',
        sameSite: 'lax',
      })
    }
  })
  response.cookies.set('edu_keep_connected', '', { maxAge: 0, expires: new Date(0), path: '/' })
  response.cookies.set('edu_logout_pending_barrier', '1', { maxAge: 86400, path: '/', sameSite: 'lax' })

  return response
}
