import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    
    if (url.searchParams.get('checkMaster') === 'true') {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Faltam as variáveis de ambiente do Supabase.' }, { status: 500 })
      }
      const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      const { data } = await supabaseAdmin.from('system_users').select('id').eq('email', 'direcao@colegioimpacto.net').maybeSingle()
      return NextResponse.json({ masterExists: !!data })
    }

    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const supabase = await createProtectedClient()
    
    let supabaseUser = null;
    try {
      const { data } = await supabase.auth.getUser()
      supabaseUser = data.user;
    } catch (err: any) {
      if (err?.message?.includes('stole it') || err?.message?.includes('Lock')) {
        try {
          const retryRes = await supabase.auth.getUser()
          supabaseUser = retryRes.data.user;
        } catch (e) {}
      }
    }
    
    if (!supabaseUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    async function fetchAll(table: string, cols: string) {
      let all: any[] = []
      let from = 0
      let to = 999
      let hasMore = true
      while(hasMore) {
        const { data } = await supabase.from(table).select(cols).range(from, to)
        if (!data || data.length === 0) {
          hasMore = false
        } else {
          all = [...all, ...data]
          if (data.length < 1000) hasMore = false
          else {
            from += 1000
            to += 1000
          }
        }
      }
      return all
    }

    const sysUsers = await fetchAll('system_users', '*')

    // Fetch active Auth users to check their actual existence and map orphaned records
    const supabaseAdmin = getAdminClient()
    // Aumentamos o limite para 10000 para capturar o último acesso de todos os colaboradores, alunos e responsáveis
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 10000 }).catch(() => ({ data: { users: [] } }))
    const authUsersList = authData?.users || []

    const mappedSys = sysUsers.map(u => {
      const email = (u.email || '').trim().toLowerCase()
      const authUser = authUsersList.find((au: any) => au.email?.toLowerCase() === email)

      const sysProfile = authUser?.user_metadata?.profile_code
      let perfilStr = 'Colaborador'
      if (sysProfile === 'DIRECAO') perfilStr = 'Direção'
      else if (sysProfile === 'SECRETARIA') perfilStr = 'Secretaria'
      else if (sysProfile === 'FINANCEIRO') perfilStr = 'Financeiro'
      else if (sysProfile === 'COORDENACAO') perfilStr = 'Coordenação'
      else if (sysProfile === 'PROFESSOR') perfilStr = 'Professor'
      else if (sysProfile === 'PORTARIA') perfilStr = 'Portaria'

      if (u.perfil && typeof u.perfil === 'string') {
        perfilStr = u.perfil
      }

      return {
        id: u.id,
        nome: u.nome,
        email: email,
        cargo: u.cargo || 'Não definido',
        perfil: perfilStr,
        status: authUser ? 'ativo' : 'inativo',
        ultimoAcesso: authUser?.last_sign_in_at 
          ? new Date(authUser.last_sign_in_at).toLocaleDateString('pt-BR') 
          : 'Nunca acessou'
      }
    })

    // Buscar alunos de forma LEVE para prover acesso virtual a alunos
    const alunosData = await fetchAll('alunos', 'id, nome, email, dados, matricula')

    const mappedAlunos = (alunosData || []).reduce((acc: any[], aluno: any) => {
       const alunoEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
       if (alunoEmail) {
          const virtualEmail = `aluno.${aluno.matricula || aluno.dados?.codigo || aluno.id}@impactoedu.local`.toLowerCase()
          
          const authUser = authUsersList.find((au: any) => {
             const auEmail = au.email?.toLowerCase()
             return auEmail === alunoEmail || auEmail === virtualEmail
          })
          
          acc.push({
             id: `virtual-${aluno.id}`,
             nome: aluno.nome,
             email: alunoEmail,
             cargo: 'Alunos',
             perfil: 'Família',
             status: authUser ? 'ativo' : 'inativo',
             ultimoAcesso: authUser?.last_sign_in_at 
               ? new Date(authUser.last_sign_in_at).toLocaleDateString('pt-BR') 
               : 'Nunca acessou'
          })
       }
       return acc
    }, [])

    // Fetch active Auth users to check their actual existence and map orphaned records
    // (Already fetched above for mappedSys)


    const respData = await fetchAll('responsaveis', 'id, nome, email')
    const linksData = await fetchAll('aluno_responsavel', 'responsavel_id, resp_financeiro, resp_pedagogico')

    const mappedResps: any[] = []

    // 1. Processar responsáveis cadastrados no banco
    if (respData && Array.isArray(respData)) {
      respData.forEach((resp: any) => {
        const email = (resp.email || '').trim().toLowerCase()
        if (!email) return

        const links = (linksData || []).filter((l: any) => String(l.responsavel_id) === String(resp.id))
        const hasActiveLink = links.some((l: any) => l.resp_financeiro === true || l.resp_pedagogico === true)
        
        // APENAS responsáveis com vínculos financeiros ou pedagógicos ativos são listados
        if (!hasActiveLink) return

        // Localiza se o responsável possui uma conta Auth correspondente
        const authUser = authUsersList.find((au: any) => au.email?.toLowerCase() === email)

        mappedResps.push({
          id: `resp-${resp.id}`,
          nome: resp.nome,
          email: email,
          cargo: 'Responsáveis',
          perfil: 'Família',
          status: authUser ? 'ativo' : 'inativo',
          ultimoAcesso: authUser?.last_sign_in_at 
            ? new Date(authUser.last_sign_in_at).toLocaleDateString('pt-BR') 
            : 'Nunca acessou'
        })
      })
    }

    return NextResponse.json([...mappedSys, ...mappedAlunos, ...mappedResps])
  } catch (err: any) {
    console.error('[API GET configuracoes/usuarios]', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await req.json()
    
    const prepare = (b: any) => { 
       const out = { ...b }; 
       if ('ultimoAcesso' in out) { out.ultimoacesso = out.ultimoAcesso; delete out.ultimoAcesso; }
       return out;
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Faltam as variáveis de ambiente do Supabase.' }, { status: 500 })
    }

    // Always use service-role admin for Auth provisioning
    const supabaseAdmin = getAdminClient()
    
    const singleBody = Array.isArray(body) ? body[0] : body;
    const isMasterSetup = singleBody?.email?.toLowerCase().trim() === 'direcao@colegioimpacto.net';
    
    const { count } = await supabaseAdmin
      .from('system_users')
      .select('*', { count: 'exact', head: true });

    const { data: masterCheck } = await supabaseAdmin
      .from('system_users')
      .select('id')
      .eq('email', 'direcao@colegioimpacto.net')
      .maybeSingle();

    let supabaseClientToUse;
    let authUserIdToLink: string | null = null;

    if (count === 0 || (isMasterSetup && !masterCheck)) {
       // Bootstrap Mode — bypass RLS
       supabaseClientToUse = supabaseAdmin;
    } else {
       supabaseClientToUse = await createProtectedClient();
       
       const { data: { user } } = await supabaseClientToUse.auth.getUser();
       if (!user) {
           return NextResponse.json({ error: 'Acesso negado: faça login.' }, { status: 401 });
       }
    }

    // ── Provision Supabase Auth user for EVERY new system_user ─────────────────
    
    if (singleBody?.email) {
      const email = singleBody.email.trim().toLowerCase()
      
      // Check if Auth user already exists for this email
      // Usa system_users e getUserById em vez de listUsers
      let existingAuthUser: any = null
      const { data: sysMatch } = await supabaseAdmin
        .from('system_users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      
      if (sysMatch?.id) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(sysMatch.id).catch(() => ({ data: { user: null } }))
        existingAuthUser = user
      }
      if (!existingAuthUser) {
         // Fallback para caso não esteja sincronizado
         const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 50 })
         existingAuthUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === email)
      }
      
      if (existingAuthUser) {
        // Already in Auth — just link the ID
        authUserIdToLink = existingAuthUser.id
      } else {
        // Create Auth user with the provided password, or a temporary placeholder if none is provided
        const userPass = singleBody.senha || singleBody.password || `EduTemp_${Math.random().toString(36).slice(2, 10)}!`
        try {
          const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: userPass,
            email_confirm: true,   // skip email confirmation — admin-provisioned
          })
          if (authErr && !authErr.message.toLowerCase().includes('already')) {
            console.error('[POST /api/configuracoes/usuarios] Auth user creation failed:', authErr.message)
          } else if (authData?.user?.id) {
            authUserIdToLink = authData.user.id
          }
        } catch (e: any) {
          console.error('[POST /api/configuracoes/usuarios] Auth provision error:', e.message)
        }
      }
    }

    // Prepare DB payload
    let fixedBodyList = Array.isArray(body) ? body.map(prepare) : [prepare(body)]

    // Link Auth UUID to system_users.id so auth→db lookup works natively
    if (authUserIdToLink) {
      fixedBodyList[0].id = authUserIdToLink
      fixedBodyList[0].auth_id = authUserIdToLink
    }

    // Upsert into system_users
    const { data, error } = await supabaseClientToUse.from('system_users').upsert(fixedBodyList).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Sync to funcionarios
    for (const row of (data || [])) {
      if (row.email && row.status !== undefined) {
        await supabaseAdmin.from('funcionarios').update({ status: row.status }).eq('email', row.email)
      }
    }

    return NextResponse.json(Array.isArray(body) ? data : data[0])
  } catch (err: any) {
    console.error('[API POST configuracoes/usuarios]', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
