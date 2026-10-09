import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

// Valid email: must have TLD of at least 2 chars after last dot, not our internal domain
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !email.endsWith('@impactoedu.local')

export async function POST(request: NextRequest) {
  try {
    const { email: rawLogin, password, keepConnected } = await request.json()
    
    if (!rawLogin || !password) {
      return NextResponse.json({ error: 'E-mail/matrícula e senha são obrigatórios' }, { status: 200 })
    }

    const loginInput = rawLogin.trim().toLowerCase()

    const supabaseAdmin = getAdminClient()

    // ── Resolve the actual email for Supabase Auth ──────────────────
    // If it's NOT an email format or internal, it might be a matrícula, CPF, or student email
    let resolvedEmail = loginInput
    let userType: 'system_user' | 'aluno' | 'responsavel' = 'system_user'
    let alunoRecord: any = null
    let responsavelRecord: any = null

    const isVirtualEmail = loginInput.endsWith('@impactoedu.local')
    const hasValidEmailSyntax = isValidEmail(loginInput)

    if (isVirtualEmail) {
      resolvedEmail = loginInput
      if (loginInput.startsWith('aluno.')) {
        userType = 'aluno'
        const matricula = loginInput.replace('aluno.', '').replace('@impactoedu.local', '')
        const isMatriculaUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matricula)
        const orConditions = [`matricula.eq.${matricula}`, `dados->>codigo.eq.${matricula}`]
        if (isMatriculaUuid) orConditions.push(`id.eq.${matricula}`)
        const { data: aData } = await supabaseAdmin
          .from('alunos')
          .select('id, nome, email, matricula, dados, status, foto')
          .or(orConditions.join(','))
          .limit(1)
        alunoRecord = aData?.[0] || null
      }
    } else if (!hasValidEmailSyntax) {
      // ── Entrada é Matrícula, CPF, Código, Telefone ou E-mail sem domínio padrão (ex: aluno@aluno) ──
      const loginDigits = loginInput.replace(/\D/g, '')
      const isLoginUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loginInput)

      let alunoConditions = [
        `matricula.eq.${loginInput}`,
        `dados->>codigo.eq.${loginInput}`,
        `email.ilike.${loginInput}`,
        `dados->>email.ilike.${loginInput}`
      ]
      if (isLoginUuid) alunoConditions.push(`id.eq.${loginInput}`)
      if (loginDigits.length >= 11) alunoConditions.push(`dados->>cpf.eq.${loginDigits}`)
      if (loginDigits.length >= 8) alunoConditions.push(`telefone.ilike.%${loginDigits}%`)

      let respConditions = [
        `codigo.eq.${loginInput}`,
        `email.ilike.${loginInput}`
      ]
      if (loginDigits.length >= 11) respConditions.push(`dados->>cpf.eq.${loginDigits}`)
      if (loginDigits.length >= 8) respConditions.push(`celular.ilike.%${loginDigits}%`, `telefone.ilike.%${loginDigits}%`)

      const alunoPromise = supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados, status, foto')
        .or(alunoConditions.join(','))
        .limit(1)
        .then(r => r.data?.[0] || null)

      const responsavelPromise = supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email, celular, codigo, telefone, dados')
        .or(respConditions.join(','))
        .limit(1)
        .then(r => r.data?.[0] || null)

      const [alunoResult, responsavelResult] = await Promise.all([alunoPromise, responsavelPromise])

      if (alunoResult) {
        alunoRecord = alunoResult
        const matricula   = alunoRecord.matricula || alunoRecord.dados?.codigo || alunoRecord.id
        const storedEmail = (alunoRecord.email || '').trim().toLowerCase()
        resolvedEmail = isValidEmail(storedEmail)
          ? storedEmail
          : `aluno.${matricula}@impactoedu.local`
        userType = 'aluno'
      } else if (responsavelResult) {
        responsavelRecord = responsavelResult
        resolvedEmail   = (responsavelRecord.email || '').trim().toLowerCase()
        userType        = 'responsavel'
        if (!resolvedEmail || !resolvedEmail.includes('@')) {
          return NextResponse.json({ error: 'Responsável sem e-mail cadastrado. Faça o Primeiro Acesso primeiro.' }, { status: 200 })
        }
      }
    } else {
      // ── Entrada já é um e-mail válido com domínio: autentica diretamente sem table scans prévios ──
      resolvedEmail = loginInput
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
        }, { status: 200 })
      }
    }

    const cookieStore = await cookies()
    const INFINITE_SESSION_SECONDS = 31536000 // 1 ano (365 dias) — seguro contra overflow de 32 bits (RFC 6265bis)
    const expiresDate = new Date(Date.now() + INFINITE_SESSION_SECONDS * 1000)
    const capturedCookiesToSet: { name: string; value: string; options: any }[] = []

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
    const projectCookiePrefix = `sb-${projectRef}-auth-token`

    const supabase = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            const newNames = cookiesToSet.map(c => c.name)
            cookieStore.getAll().forEach(c => {
               if ((c.name === projectCookiePrefix || c.name.startsWith(`${projectCookiePrefix}.`)) && !newNames.includes(c.name)) {
                  try { 
                    cookieStore.set(c.name, '', { maxAge: 0, expires: new Date(0), path: '/' }) 
                    capturedCookiesToSet.push({ name: c.name, value: '', options: { maxAge: 0, expires: new Date(0), path: '/' } })
                  } catch(e) {}
               }
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              try { 
                const sessionOptions = { 
                  ...options,
                  path: options?.path || '/',
                  sameSite: options?.sameSite || 'lax',
                  httpOnly: options?.httpOnly !== undefined ? options.httpOnly : false,
                };
                if (keepConnected === false) {
                  delete sessionOptions.maxAge;
                  delete sessionOptions.expires;
                } else {
                  // Sessão permanente/vitalícia
                  sessionOptions.maxAge = INFINITE_SESSION_SECONDS;
                  sessionOptions.expires = expiresDate;
                }
                cookieStore.set(name, value, sessionOptions)
                capturedCookiesToSet.push({ name, value, options: sessionOptions })
              } catch(e) {}
            })
          },
        },
      }
    )

    let signInResult: any = null
    try {
      signInResult = await Promise.race([
        supabase.auth.signInWithPassword({ email: resolvedEmail, password }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_SUPABASE')), 18000))
      ])
    } catch (e: any) {
      if (e?.message === 'TIMEOUT_SUPABASE') {
        return NextResponse.json({ 
          error: 'O banco de dados do Supabase está temporariamente indisponível ou reiniciando (Timeout 522). Se o projeto estiver pausado, acesse o painel do Supabase para restaurá-lo.' 
        }, { status: 504 })
      }
      throw e
    }

    let user = signInResult?.data?.user
    let session = signInResult?.data?.session
    let error = signInResult?.error

    // FALLBACK for students: If login failed, their Auth user might still be on their virtual email
    if (error) {
      let studentToTry = (userType === 'aluno' && alunoRecord) ? alunoRecord : null
      if (!studentToTry) {
        const { data: matchAlunos } = await supabaseAdmin
          .from('alunos')
          .select('id, nome, email, matricula, dados, status, foto')
          .or(`email.ilike.${loginInput},dados->>email.ilike.${loginInput},matricula.eq.${loginInput},id.eq.${loginInput}`)
          .limit(1)
        studentToTry = matchAlunos?.[0] || null
      }

      if (studentToTry) {
        const matricula = studentToTry.matricula || studentToTry.dados?.codigo || studentToTry.id
        const virtualEmail = `aluno.${matricula}@impactoedu.local`
        
        if (resolvedEmail !== virtualEmail) {
          const fallbackAttempt: any = await Promise.race([
            supabase.auth.signInWithPassword({ email: virtualEmail, password }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_SUPABASE')), 8000))
          ]).catch(() => null)

          if (fallbackAttempt && !fallbackAttempt.error && fallbackAttempt.data?.user) {
            user = fallbackAttempt.data.user
            session = fallbackAttempt.data.session
            error = null
            resolvedEmail = virtualEmail // update resolved email for downstream logic
            userType = 'aluno'
            alunoRecord = studentToTry
          }
        }
      }
    }

    if (error || !user) {
      const errMsg = (error?.message || '').toLowerCase()
      const isNetworkError = errMsg.includes('fetch') || errMsg.includes('timed out') || errMsg.includes('522') || error?.status === 522;
      const isHtmlError = error?.message?.includes('Unexpected token') || error?.message?.includes('is not valid JSON');
      
      if (isNetworkError || isHtmlError) {
        return NextResponse.json({ error: 'Erro de conexão com o banco de dados (Timeout 522). O projeto no Supabase pode estar acordando ou em pausa. Verifique o painel do Supabase.' }, { status: 504 })
      }

      // Friendly messages per user type
      if (userType === 'aluno') {
        return NextResponse.json({ error: 'Matrícula ou senha incorreta. Se nunca acessou, clique em "Primeiro Acesso".' }, { status: 200 })
      }
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 200 })
    }

    // ── Enrich metadata & Database validation based on actual DB tables ──────────────────────────
    let nome   = user?.user_metadata?.nome   || rawLogin.split('@')[0]
    let cargo  = user?.user_metadata?.cargo  || 'Usuário'
    let perfil = user?.user_metadata?.perfil || 'Usuário'

    let dbRecordExists = false
    let responsavel_id = ''
    let aluno_id = ''

    // 1. Tenta identificar na tabela system_users (Colaboradores / Administradores)
    let hasDualRole = false
    let dbSystemUser: any = null

    let resolvedFoto: string | undefined = user?.user_metadata?.foto || user?.user_metadata?.fotoUrl || undefined
    let respFoundRecord: any = null
    let alunoFoundRecord: any = null

    if (userType === 'system_user') {
      const { data: dbSystemUserRows } = await supabaseAdmin
        .from('system_users')
        .select('id, nome, email, cargo, perfil, status, dados')
        .or(`auth_id.eq.${user?.id || ''},email.ilike.${resolvedEmail}`)
        .limit(1)

      dbSystemUser = dbSystemUserRows?.[0] || null

      if (dbSystemUser) {
        dbRecordExists = true
        if (dbSystemUser.status === 'inativo') {
          const supabaseSignOut = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                  cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set({ name, value, ...options, maxAge: 0 })
                  })
                },
              },
            }
          )
          await supabaseSignOut.auth.signOut()
          return NextResponse.json({ error: 'Acesso bloqueado: Usuário inativo. Contate o suporte.' }, { status: 200 })
        }
        nome   = dbSystemUser.nome   || nome
        cargo  = dbSystemUser.cargo  || cargo
        perfil = dbSystemUser.perfil || perfil
        const sysFoto = dbSystemUser.dados?.foto
        if (sysFoto) resolvedFoto = sysFoto
        
        // Verifica papel duplo para colaboradores rapidamente
        const { data: respFound } = await supabaseAdmin
          .from('responsaveis')
          .select('id, dados')
          .ilike('email', resolvedEmail)
          .limit(1)
        if (respFound && respFound.length > 0) {
          hasDualRole = true
          if (!responsavel_id) responsavel_id = respFound[0].id
          const dualRespFoto = respFound[0].dados?.foto
          if (!resolvedFoto && dualRespFoto) resolvedFoto = dualRespFoto
        }
      }
    }

    if (!dbRecordExists) {
      if (userType === 'responsavel' && responsavelRecord) {
        dbRecordExists = true
        respFoundRecord = responsavelRecord
        responsavel_id = responsavelRecord.id
        nome   = responsavelRecord.nome || nome
        cargo  = 'Responsável'
        perfil = 'Família'
        const rFoto = responsavelRecord.dados?.foto
        if (rFoto) resolvedFoto = rFoto

        // Verifica se este responsável também é colaborador ativo na system_users
        if (resolvedEmail) {
          const { data: sysUserMatch } = await supabaseAdmin
            .from('system_users')
            .select('id, cargo, perfil, status')
            .or(`auth_id.eq.${user?.id || ''},email.ilike.${resolvedEmail}`)
            .eq('status', 'ativo')
            .limit(1)
          if (sysUserMatch && sysUserMatch.length > 0) {
            hasDualRole = true
            dbSystemUser = sysUserMatch[0]
          }
        }
      } else if (userType === 'aluno' && alunoRecord) {
        dbRecordExists = true
        alunoFoundRecord = alunoRecord
        aluno_id = alunoRecord.id
        nome   = alunoRecord.nome || nome
        cargo  = 'Aluno'
        perfil = 'Família'
        const aFoto = alunoRecord.foto || alunoRecord.dados?.foto
        if (aFoto) resolvedFoto = aFoto
      } else {
        // Usuário logou com e-mail direto mas não é system_user: verifica se é Responsável ou Aluno
        const metaAlunoId = user?.user_metadata?.aluno_id || user?.user_metadata?.matricula
        let alunoLookupQuery = supabaseAdmin.from('alunos').select('id, nome, email, matricula, status, foto, dados')
        if (metaAlunoId) {
          alunoLookupQuery = alunoLookupQuery.or(`id.eq.${metaAlunoId},matricula.eq.${metaAlunoId}`)
        } else {
          alunoLookupQuery = alunoLookupQuery.ilike('email', resolvedEmail)
        }

        const metaRespId = user?.user_metadata?.responsavel_id
        let respLookupQuery = supabaseAdmin.from('responsaveis').select('id, nome, email, dados')
        if (metaRespId) {
          respLookupQuery = respLookupQuery.eq('id', metaRespId)
        } else {
          respLookupQuery = respLookupQuery.ilike('email', resolvedEmail)
        }

        const [respLookup, alunoLookup] = await Promise.all([
          respLookupQuery.limit(1).then(r => r.data?.[0] || null),
          alunoLookupQuery.limit(1).then(r => r.data?.[0] || null)
        ])

        if (respLookup) {
          const { data: links } = await supabaseAdmin
            .from('aluno_responsavel')
            .select('resp_financeiro, resp_pedagogico')
            .eq('responsavel_id', respLookup.id)

          const isAllowed = (links || []).some(
            (l: any) => l.resp_financeiro === true || l.resp_pedagogico === true
          )

          if (!isAllowed) {
            const supabaseSignOut = createServerClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              {
                cookies: {
                  getAll() { return cookieStore.getAll() },
                  setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                      cookieStore.set({ name, value, ...options, maxAge: 0 })
                    })
                  },
                },
              }
            )
            await supabaseSignOut.auth.signOut()
            return NextResponse.json({ 
              error: 'Acesso não autorizado. Apenas responsáveis Financeiro ou Pedagógico possuem login no sistema.' 
            }, { status: 200 })
          }

          dbRecordExists = true
          respFoundRecord = respLookup
          userType = 'responsavel'
          responsavel_id = respLookup.id
          nome   = respLookup.nome || nome
          cargo  = 'Responsável'
          perfil = 'Família'
          const rFoto = respLookup.dados?.foto
          if (rFoto) resolvedFoto = rFoto
        } else if (alunoLookup) {
          dbRecordExists = true
          alunoFoundRecord = alunoLookup
          userType = 'aluno'
          aluno_id = alunoLookup.id
          nome   = alunoLookup.nome || nome
          cargo  = 'Aluno'
          perfil = 'Família'
          const aFoto = alunoLookup.foto || alunoLookup.dados?.foto
          if (aFoto) resolvedFoto = aFoto
        }
      }
    }

    if (!dbRecordExists) {
      const supabaseSignOut = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set({ name, value, ...options, maxAge: 0 })
              })
            },
          },
        }
      )
      await supabaseSignOut.auth.signOut()

      return NextResponse.json({ error: 'Acesso não autorizado. Cadastro não encontrado no sistema escolar.' }, { status: 200 })
    }

    // Persist enriched metadata if changed
    const userMetadataUpdate: any = { nome, cargo, perfil }
    if (responsavel_id) userMetadataUpdate.responsavel_id = responsavel_id
    if (aluno_id) userMetadataUpdate.aluno_id = aluno_id
    if (dbSystemUser?.id) {
      userMetadataUpdate.colaborador_id = dbSystemUser.id
      userMetadataUpdate.system_user_id = dbSystemUser.id
    }
    userMetadataUpdate.hasDualRole = Boolean(hasDualRole)
    // Only store short/hosted URLs in user_metadata to avoid overflowing JWT headers and cookies (>16KB)
    if (resolvedFoto && !resolvedFoto.startsWith('data:') && resolvedFoto.length <= 500) {
      userMetadataUpdate.foto = resolvedFoto
    } else if (user?.user_metadata?.foto && (user.user_metadata.foto.startsWith('data:') || user.user_metadata.foto.length > 500)) {
      // Remove any legacy massive base64 image from user_metadata to fix cookie header overflow
      userMetadataUpdate.foto = null
    }

    if (user) {
      const currentMeta = user.user_metadata || {}
      let hasChanges = false
      for (const key of Object.keys(userMetadataUpdate)) {
        if (currentMeta[key] !== userMetadataUpdate[key]) hasChanges = true
      }
      if (hasChanges) {
        supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: userMetadataUpdate
        }).catch((e: any) => console.warn('[login] metadata update failed:', e.message))
      }
    }

    const enrichedUser = {
      ...user,
      foto: resolvedFoto,
      hasDualRole: Boolean(hasDualRole),
      user_metadata: { ...user?.user_metadata, ...userMetadataUpdate, hasDualRole: Boolean(hasDualRole) }
    }

    const response = NextResponse.json({ user: enrichedUser, session: session }, { status: 200 })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')

    // Garantir que todos os cookies de sessão sejam anexados no cabeçalho Set-Cookie da resposta
    capturedCookiesToSet.forEach(({ name, value, options }) => {
      try {
        response.cookies.set(name, value, options)
      } catch (e) {}
    })

    try {
      if (keepConnected !== false) {
        (await cookies()).set('edu_keep_connected', '1', { maxAge: INFINITE_SESSION_SECONDS, expires: expiresDate, path: '/' })
        response.cookies.set('edu_keep_connected', '1', {
          maxAge: INFINITE_SESSION_SECONDS,
          expires: expiresDate,
          path: '/',
          sameSite: 'lax',
          httpOnly: false,
        })
      } else {
        (await cookies()).delete('edu_keep_connected')
        response.cookies.delete('edu_keep_connected')
      }
      (await cookies()).delete('edu_logout_pending_barrier')
      response.cookies.delete('edu_logout_pending_barrier')
    } catch(e) {}

    return response
  } catch (err: any) {
    console.error('[API login]', err)
    return NextResponse.json({ error: 'Erro interno de autenticação' }, { status: 500 })
  }
}
