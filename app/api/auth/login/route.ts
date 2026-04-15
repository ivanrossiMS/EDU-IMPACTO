import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email: rawLogin, password } = await request.json()
    
    if (!rawLogin || !password) {
      return NextResponse.json({ error: 'E-mail/matrícula e senha são obrigatórios' }, { status: 400 })
    }

    const loginInput = rawLogin.trim().toLowerCase()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ── Resolve the actual email for Supabase Auth ──────────────────
    // If it's NOT an email format, it might be a matrícula or CPF
    let resolvedEmail = loginInput
    let userType: 'system_user' | 'aluno' | 'responsavel' = 'system_user'
    let alunoRecord: any = null
    let responsavelRecord: any = null

    const isEmailFormat = loginInput.includes('@') && !loginInput.endsWith('@impactoedu.local')

    if (!isEmailFormat) {
      // Try student by matricula or CPF
      const { data: alunosRows } = await supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados')

      const loginDigits = loginInput.replace(/\D/g, '')
      alunoRecord = (alunosRows || []).find((a: any) => {
        const matricA  = (a.matricula || a.dados?.codigo || '').trim().toLowerCase()
        const cpfA     = (a.cpf || '').replace(/\D/g, '')
        return (
          (matricA && matricA === loginInput) ||
          (cpfA && loginDigits.length >= 11 && cpfA === loginDigits)
        )
      })

      if (alunoRecord) {
        const matricula   = alunoRecord.matricula || alunoRecord.dados?.codigo || alunoRecord.id
        const storedEmail = (alunoRecord.email || '').trim().toLowerCase()
        // Use virtual email pattern (same one registered at first-access)
        resolvedEmail = storedEmail && storedEmail.includes('@') && !storedEmail.endsWith('@impactoedu.local')
          ? storedEmail
          : `aluno.${matricula}@impactoedu.local`
        userType = 'aluno'
      } else {
        // Try responsavel by CPF or celular
        const { data: respRows } = await supabaseAdmin
          .from('responsaveis')
          .select('id, nome, email, cpf, celular, codigo')
        
        responsavelRecord = (respRows || []).find((r: any) => {
          const cpfR    = (r.cpf || '').replace(/\D/g, '')
          const celR    = (r.celular || '').replace(/\D/g, '')
          const codigoR = (r.codigo || '').trim().toLowerCase()
          return (
            (cpfR && loginDigits.length >= 11 && cpfR === loginDigits) ||
            (celR && loginDigits.length >= 10 && celR === loginDigits) ||
            (codigoR && codigoR === loginInput)
          )
        })

        if (responsavelRecord) {
          resolvedEmail   = (responsavelRecord.email || '').trim().toLowerCase()
          userType        = 'responsavel'
          if (!resolvedEmail || !resolvedEmail.includes('@')) {
            return NextResponse.json({ error: 'Responsável sem e-mail cadastrado. Faça o Primeiro Acesso primeiro.' }, { status: 401 })
          }
        }
      }
    } else {
      // Email format — check if responsavel or aluno first, fallback to system_user
      const { data: alunoByEmail } = await supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados, status')
        .eq('email', loginInput)
        .maybeSingle()
      
      if (alunoByEmail) {
        alunoRecord   = alunoByEmail
        userType      = 'aluno'
        resolvedEmail = loginInput
      } else {
        const { data: respByEmail } = await supabaseAdmin
          .from('responsaveis')
          .select('id, nome, email')
          .eq('email', loginInput)
          .maybeSingle()
        
        if (respByEmail) {
          responsavelRecord = respByEmail
          userType          = 'responsavel'
          resolvedEmail     = loginInput
        }
      }
    }

    // ── Sign in with resolved email ─────────────────────────────────
    const response = NextResponse.next()

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

    const { data, error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password })
    
    if (error || !data?.user) {
      // Friendly messages per user type
      if (userType === 'aluno') {
        return NextResponse.json({ error: 'Matrícula ou senha incorreta. Se nunca acessou, clique em "Primeiro Acesso".' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
    }

    // ── Enrich metadata based on user type ──────────────────────────
    let nome   = data.user.user_metadata?.nome   || rawLogin.split('@')[0]
    let cargo  = data.user.user_metadata?.cargo  || 'Usuário'
    let perfil = data.user.user_metadata?.perfil || 'Usuário'

    if (userType === 'aluno' && alunoRecord) {
      nome   = alunoRecord.nome || nome
      cargo  = 'Aluno'
      perfil = 'Família'
    } else if (userType === 'responsavel' && responsavelRecord) {
      nome   = responsavelRecord.nome || nome
      cargo  = 'Responsável'
      perfil = 'Família'
    } else if (userType === 'system_user') {
      // Lookup system_users
      const { data: byId } = await supabaseAdmin
        .from('system_users')
        .select('id, nome, email, cargo, perfil, status')
        .eq('id', data.user.id)
        .maybeSingle()
      
      let sysUser = byId
      if (!sysUser) {
        const { data: byEmail } = await supabaseAdmin
          .from('system_users')
          .select('id, nome, email, cargo, perfil, status')
          .eq('email', resolvedEmail)
          .maybeSingle()
        sysUser = byEmail
      }

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
        nome   = sysUser.nome   || nome
        cargo  = sysUser.cargo  || cargo
        perfil = sysUser.perfil || perfil
      }
    }

    // Persist enriched metadata
    supabaseAdmin.auth.admin.updateUserById(data.user.id, {
      user_metadata: { nome, cargo, perfil }
    }).catch((e: any) => console.warn('[login] metadata update failed:', e.message))

    const enrichedUser = {
      ...data.user,
      user_metadata: { ...data.user.user_metadata, nome, cargo, perfil }
    }

    const body = JSON.stringify({ user: enrichedUser, session: data.session })
    const finalResponse = new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    
    return finalResponse
  } catch (err: any) {
    console.error('[API login]', err)
    return NextResponse.json({ error: 'Erro interno de autenticação' }, { status: 500 })
  }
}
