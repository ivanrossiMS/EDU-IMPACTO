import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

// GET: browser navigation — clears session AND redirects to /login in one atomic response
export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/login', request.url)
  const response = NextResponse.redirect(redirectUrl, { status: 302 })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // Write cookie changes into the redirect response
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Sign out — Supabase will clear session cookies via setAll above
  await supabase.auth.signOut()

  // Belt-and-suspenders: forcibly expire every sb-* cookie from this request
  request.cookies.getAll().forEach(cookie => {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      })
    }
  })

  return response
}

// POST: programmatic API call — returns JSON OK
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.signOut()

  request.cookies.getAll().forEach(cookie => {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      })
    }
  })

  return response
}
