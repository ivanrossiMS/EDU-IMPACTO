import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

// Valid email: must have TLD of at least 2 chars after last dot, not our internal domain
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !email.endsWith('@impactoedu.local')

export async function POST(request: NextRequest) {
  try {
    const { email: rawLogin, password } = await request.json()
    
    if (!rawLogin || !password) {
      return NextResponse.json({ error: 'E-mail/matrícula e senha são obrigatórios' }, { status: 400 })
    }

    const loginInput = rawLogin.trim().toLowerCase()

    const supabaseAdmin = getAdminClient()

    // ── Resolve the actual email for Supabase Auth ──────────────────
    // If it's NOT an email format, it might be a matrícula or CPF
    let resolvedEmail = loginInput
    let userType: 'system_user' | 'aluno' | 'responsavel' = 'system_user'
    let alunoRecord: any = null
    let responsavelRecord: any = null

    const isEmailFormat = loginInput.includes('@') && !loginInput.endsWith('@impactoedu.local')

    if (!isEmailFormat) {
      // ── Busca filtrada no banco (sem full table scan) ─────────────────────
      const loginDigits = loginInput.replace(/\D/g, '')

      // 1. Tentar aluno por matrícula
      const { data: alunoByMatricula } = await supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados, status')
        .eq('matricula', loginInput)
        .maybeSingle()

      if (alunoByMatricula) {
        alunoRecord = alunoByMatricula
      } else if (loginDigits.length >= 11) {
        // 2. Tentar aluno por CPF (armazenado em dados JSONB)
        const { data: alunosByCpf } = await supabaseAdmin
          .from('alunos')
          .select('id, nome, email, matricula, dados, status')
          .eq('dados->>cpf', loginDigits)
          .limit(1)
        alunoRecord = alunosByCpf?.[0] || null
      }

      if (alunoRecord) {
        const matricula   = alunoRecord.matricula || alunoRecord.dados?.codigo || alunoRecord.id
        const storedEmail = (alunoRecord.email || '').trim().toLowerCase()
        // Use virtual email pattern (same one registered at first-access)
        resolvedEmail = isValidEmail(storedEmail)
          ? storedEmail
          : `aluno.${matricula}@impactoedu.local`
        userType = 'aluno'
      } else {
        // 3. Tentar responsável por código
        const { data: respByCodigo } = await supabaseAdmin
          .from('responsaveis')
          .select('id, nome, email, celular, codigo, telefone, dados')
          .eq('codigo', loginInput)
          .maybeSingle()

        if (respByCodigo) {
          responsavelRecord = respByCodigo
        } else if (loginDigits.length >= 10) {
          // 4. Tentar responsável por CPF
          if (loginDigits.length >= 11) {
            const { data: respByCpf } = await supabaseAdmin
              .from('responsaveis')
              .select('id, nome, email, celular, codigo, telefone, dados')
              .eq('dados->>cpf', loginDigits)
              .limit(1)
            responsavelRecord = respByCpf?.[0] || null
          }
          // 5. Tentar responsável por celular (só se ainda não achou)
          if (!responsavelRecord) {
            const { data: respByCelular } = await supabaseAdmin
              .from('responsaveis')
              .select('id, nome, email, celular, codigo, telefone, dados')
              .or(`celular.eq.${loginDigits},telefone.eq.${loginDigits}`)
              .limit(1)
            responsavelRecord = respByCelular?.[0] || null
          }
        }

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
    if (userType === 'responsavel' && responsavelRecord) {
      const { data: links } = await supabaseAdmin
        .from('aluno_responsavel')
        .select('resp_financeiro, resp_pedagogico')
        .eq('responsavel_id', responsavelRecord.id)

      const isAllowed = (links || []).some(
        (l: any) => l.resp_financeiro === true || l.resp_pedagogico === true
      )

      if (!isAllowed) {
        return NextResponse.json({ 
          error: 'Acesso não autorizado. Apenas responsáveis Financeiro ou Pedagógico possuem login no sistema.' 
        }, { status: 403 })
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

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password })
    
    let user = signInData?.user
    let session = signInData?.session
    let error = signInError

    // FALLBACK for students: If login failed and they have a real email, their Auth user might still be on their virtual email
    if (error && userType === 'aluno' && alunoRecord) {
      const matricula = alunoRecord.matricula || alunoRecord.dados?.codigo || alunoRecord.id
      const virtualEmail = `aluno.${matricula}@impactoedu.local`
      
      if (resolvedEmail !== virtualEmail) {
        const fallbackAttempt = await supabase.auth.signInWithPassword({ email: virtualEmail, password })
        if (!fallbackAttempt.error && fallbackAttempt.data?.user) {
          user = fallbackAttempt.data.user
          session = fallbackAttempt.data.session
          error = null
          resolvedEmail = virtualEmail // update resolved email for downstream logic
        }
      }
    }

    if (error || !user) {
      // Friendly messages per user type
      if (userType === 'aluno') {
        return NextResponse.json({ error: 'Matrícula ou senha incorreta. Se nunca acessou, clique em "Primeiro Acesso".' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
    }

    // ── Enrich metadata & Database validation based on actual DB tables ──────────────────────────
    let nome   = user?.user_metadata?.nome   || rawLogin.split('@')[0]
    let cargo  = user?.user_metadata?.cargo  || 'Usuário'
    let perfil = user?.user_metadata?.perfil || 'Usuário'

    let dbRecordExists = false
    let responsavel_id = ''
    let aluno_id = ''

    // 1. Check system_users
    const { data: dbSystemUser } = await supabaseAdmin
      .from('system_users')
      .select('id, nome, email, cargo, perfil, status')
      .or(`id.eq."${user.id}",email.eq."${user.email}"`)
      .maybeSingle()

    if (dbSystemUser) {
      dbRecordExists = true
      if (dbSystemUser.status === 'inativo') {
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
      nome   = dbSystemUser.nome   || nome
      cargo  = dbSystemUser.cargo  || cargo
      perfil = dbSystemUser.perfil || perfil
    } else {
      // 2. Check responsaveis
      const { data: dbResp } = await supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email')
        .or(`id.eq."${user.id}",email.eq."${user.email}"`)
        .maybeSingle()

      if (dbResp) {
        dbRecordExists = true
        responsavel_id = dbResp.id
        // Check active financial or pedagogical links
        const { data: links } = await supabaseAdmin
          .from('aluno_responsavel')
          .select('resp_financeiro, resp_pedagogico')
          .eq('responsavel_id', dbResp.id)

        const isAllowed = (links || []).some(
          (l: any) => l.resp_financeiro === true || l.resp_pedagogico === true
        )

        if (!isAllowed) {
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
          return NextResponse.json({ 
            error: 'Acesso não autorizado. Apenas responsáveis Financeiro ou Pedagógico com alunos ativos possuem login.' 
          }, { status: 403 })
        }

        nome   = dbResp.nome || nome
        cargo  = 'Responsável'
        perfil = 'Família'
      } else {
        // 3. Check alunos
        const { data: dbAluno } = await supabaseAdmin
          .from('alunos')
          .select('id, nome, email, status')
          .or(`id.eq."${user.id}",email.eq."${user.email}"`)
          .maybeSingle()

        if (dbAluno) {
          dbRecordExists = true
          aluno_id = dbAluno.id
          nome   = dbAluno.nome || nome
          cargo  = 'Aluno'
          perfil = 'Família'
        }
      }
    }

    if (!dbRecordExists) {
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
      
      // Se a conta de login autenticou mas não existe na base escolar, ela é deletada imediatamente
      if (user?.id) {
        await supabaseAdmin.auth.admin.deleteUser(user.id).catch((e: any) => console.error('Erro ao deletar conta fantasma ao logar:', e))
      }

      return NextResponse.json({ error: 'Acesso não autorizado. Cadastro não encontrado no sistema escolar.' }, { status: 403 })
    }

    // Persist enriched metadata
    const userMetadataUpdate: any = { nome, cargo, perfil }
    if (responsavel_id) userMetadataUpdate.responsavel_id = responsavel_id
    if (aluno_id) userMetadataUpdate.aluno_id = aluno_id

    if (user) {
      supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: userMetadataUpdate
      }).catch((e: any) => console.warn('[login] metadata update failed:', e.message))
    }

    const enrichedUser = {
      ...user,
      user_metadata: { ...user?.user_metadata, ...userMetadataUpdate }
    }

    const body = JSON.stringify({ user: enrichedUser, session: session })
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
