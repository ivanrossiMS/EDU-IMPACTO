import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })
    }

    // We need to build the response first so we can write cookies into it
    const response = NextResponse.next()

    // 1. Sign in with SSR client so the session cookie is properly set
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (value !== '') {
                delete options.maxAge
                delete options.expires
              }
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
    }

    // 2. Enrich with system_users data (nome, cargo, perfil)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let sysUser: any = null
    
    // Try by Auth UUID first (linked accounts)
    const { data: byId } = await supabaseAdmin
      .from('system_users')
      .select('id, nome, email, cargo, perfil, status')
      .eq('id', data.user.id)
      .single()
    
    if (byId) {
      sysUser = byId
    } else {
      // Fallback: lookup by email
      const { data: byEmail } = await supabaseAdmin
        .from('system_users')
        .select('id, nome, email, cargo, perfil, status')
        .eq('email', email.trim().toLowerCase())
        .single()
      sysUser = byEmail
    }

    // 3. Persist enriched metadata into Supabase Auth (so next login is instant)
    const nome   = sysUser?.nome   || data.user.user_metadata?.nome   || email.split('@')[0]
    const cargo  = sysUser?.cargo  || data.user.user_metadata?.cargo  || 'Colaborador'
    const perfil = sysUser?.perfil || data.user.user_metadata?.perfil || 'Usuário'

    if (sysUser) {
      if (sysUser.status === 'inativo') {
        const supabaseSignOut = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() { return request.cookies.getAll() },
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                  response.cookies.set(name, value, { ...options, maxAge: 0 })
                })
              },
            },
          }
        )
        await supabaseSignOut.auth.signOut()
        return NextResponse.json({ error: 'Acesso bloqueado: Usuário inativo. Contate o suporte.' }, { status: 403 })
      }

      supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        user_metadata: { nome, cargo, perfil }
      }).catch((e: any) => console.warn('[login] metadata update failed:', e.message))
    }

    // 4. Return enriched user — cookies are already set in `response`
    const enrichedUser = {
      ...data.user,
      user_metadata: { ...data.user.user_metadata, nome, cargo, perfil }
    }

    // Copy the enriched response body onto the cookie-bearing response
    const body = JSON.stringify({ user: enrichedUser, session: data.session })
    const finalResponse = new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    // Copy all Set-Cookie headers from the SSR response
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    
    return finalResponse
  } catch (err: any) {
    console.error('[API login]', err)
    return NextResponse.json({ error: 'Erro interno de autenticação' }, { status: 500 })
  }
}
