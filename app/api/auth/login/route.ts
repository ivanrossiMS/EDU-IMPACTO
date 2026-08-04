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
    // If it's NOT an email format, it might be a matrícula or CPF
    let resolvedEmail = loginInput
    let userType: 'system_user' | 'aluno' | 'responsavel' = 'system_user'
    let alunoRecord: any = null
    let responsavelRecord: any = null

    const isEmailFormat = loginInput.includes('@') && !loginInput.endsWith('@impactoedu.local')

    if (!isEmailFormat) {
      // ── Busca filtrada no banco com Promise.all (Paralelo) ─────────────────────
      const loginDigits = loginInput.replace(/\D/g, '')

      let alunoQuery = `matricula.eq.${loginInput}`
      if (loginDigits.length >= 11) alunoQuery += `,dados->>cpf.eq.${loginDigits}`

      let respQuery = `codigo.eq.${loginInput}`
      if (loginDigits.length >= 11) respQuery += `,dados->>cpf.eq.${loginDigits}`
      if (loginDigits.length >= 10) respQuery += `,celular.eq.${loginDigits},telefone.eq.${loginDigits}`

      const alunoPromise = supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados, status')
        .or(alunoQuery)
        .limit(1)
        .then(r => r.data?.[0] || null)

      const responsavelPromise = supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email, celular, codigo, telefone, dados')
        .or(respQuery)
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
      // Email format — check se é aluno, responsavel ou system_user (Paralelo case-insensitive)
      const alunoPromise = supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados, status')
        .ilike('email', loginInput)
        .limit(1)
        .then(r => r.data?.[0] || null)
        
      const respPromise = supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email')
        .ilike('email', loginInput)
        .limit(1)
        .then(r => r.data?.[0] || null)
        
      const sysUserPromise = supabaseAdmin
        .from('system_users')
        .select('id, nome, email')
        .ilike('email', loginInput)
        .limit(1)
        .then(r => r.data?.[0] || null)
        
      const [alunoByEmail, respByEmail, sysUserByEmail] = await Promise.all([alunoPromise, respPromise, sysUserPromise])
      
      if (alunoByEmail) {
        alunoRecord   = alunoByEmail
        userType      = 'aluno'
        resolvedEmail = loginInput
      } else if (sysUserByEmail) {
        userType      = 'system_user'
        resolvedEmail = loginInput
      } else if (respByEmail) {
        responsavelRecord = respByEmail
        userType          = 'responsavel'
        resolvedEmail     = loginInput
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
        }, { status: 200 })
      }
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            const newNames = cookiesToSet.map(c => c.name)
            cookieStore.getAll().forEach(c => {
               if (c.name.startsWith('sb-') && !newNames.includes(c.name)) {
                  try { cookieStore.set({ name: c.name, value: '', maxAge: 0 }) } catch(e) {}
               }
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              try { 
                const sessionOptions = { ...options };
                if (!keepConnected) {
                  delete sessionOptions.maxAge;
                  delete sessionOptions.expires;
                } else {
                  const expires = new Date();
                  expires.setFullYear(expires.getFullYear() + 1);
                  sessionOptions.maxAge = options.maxAge || 315360000;
                  sessionOptions.expires = expires;
                }
                cookieStore.set({ 
                  name, 
                  value, 
                  ...sessionOptions 
                }) 
              } catch(e) {}
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

      const isNetworkError = error?.message?.toLowerCase().includes('fetch') || error?.message?.toLowerCase().includes('timed out') || error?.status === 522;
      const isHtmlError = error?.message?.includes('Unexpected token') || error?.message?.includes('is not valid JSON');
      
      if (isNetworkError || isHtmlError) {
        return NextResponse.json({ error: 'Erro de conexão: O banco de dados está indisponível ou "dormindo" (Timeout). Se você usa o plano gratuito, ele pode estar acordando. Tente novamente em 1 minuto.' }, { status: 504 })
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
    let hasDualRole = false

    // Busca unificada por ID, auth_id ou ilike email nas 3 tabelas
    const userId = user.id
    const userAuthEmail = user.email || resolvedEmail

    const sysUserQuery = supabaseAdmin
      .from('system_users')
      .select('id, nome, email, cargo, perfil, status')
      .or(`auth_id.eq.${userId},id.eq.${userId},email.ilike.${userAuthEmail}`)
      .limit(1)
      .then(r => r.data?.[0] || null)

    const respQuery = supabaseAdmin
      .from('responsaveis')
      .select('id, nome, email')
      .or(`auth_id.eq.${userId},id.eq.${userId},email.ilike.${userAuthEmail}`)
      .limit(1)
      .then(r => r.data?.[0] || null)

    const alunoQuery = supabaseAdmin
      .from('alunos')
      .select('id, nome, email')
      .or(`auth_id.eq.${userId},id.eq.${userId},email.ilike.${userAuthEmail}`)
      .limit(1)
      .then(r => r.data?.[0] || null)

    const [dbSystemUser, dbRespUser, dbAlunoUser] = await Promise.all([sysUserQuery, respQuery, alunoQuery])

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
      if (dbRespUser) hasDualRole = true
    } else if (dbRespUser || (userType === 'responsavel' && responsavelRecord)) {
      const respRec = dbRespUser || responsavelRecord
      dbRecordExists = true
      responsavel_id = respRec.id
      nome   = respRec.nome || nome
      cargo  = 'Responsável'
      perfil = 'Família'
    } else if (dbAlunoUser || (userType === 'aluno' && alunoRecord)) {
      const aluRec = dbAlunoUser || alunoRecord
      dbRecordExists = true
      aluno_id = aluRec.id
      nome   = aluRec.nome || nome
      cargo  = 'Aluno'
      perfil = 'Família'
    } else if (user) {
      // Fallback de resiliência: se o usuário autenticou no Supabase Auth com sucesso
      dbRecordExists = true
      nome   = user.user_metadata?.nome || nome
      cargo  = user.user_metadata?.cargo || cargo
      perfil = user.user_metadata?.perfil || perfil
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
      hasDualRole,
      user_metadata: { ...user?.user_metadata, ...userMetadataUpdate }
    }

    try {
      if (keepConnected) {
        (await cookies()).set('edu_keep_connected', '1', { maxAge: 315360000, path: '/' })
      } else {
        (await cookies()).delete('edu_keep_connected')
      }
    } catch(e) {}

    const body = JSON.stringify({ user: enrichedUser, session: session })
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[API login]', err)
    return NextResponse.json({ error: 'Erro interno de autenticação' }, { status: 500 })
  }
}
