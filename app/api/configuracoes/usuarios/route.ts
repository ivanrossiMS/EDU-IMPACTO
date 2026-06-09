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
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: sysUsers, error: sysErr } = await supabase.from('system_users').select('*')
    if (sysErr) return NextResponse.json({ error: sysErr.message }, { status: 500 })
    
    const mappedSys = sysUsers?.map(u => ({ ...u, ultimoAcesso: u.ultimoacesso || u.ultimoAcesso })) || []

    // Buscar alunos de forma LEVE para prover acesso virtual a alunos
    const { data: alunosData } = await supabase.from('alunos').select('id, nome, email, dados')

    const mappedAlunos = (alunosData || []).reduce((acc: any[], aluno: any) => {
       const alunoEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
       if (alunoEmail) {
          acc.push({
             id: `virtual-${aluno.id}`,
             nome: aluno.nome,
             email: alunoEmail,
             cargo: 'Alunos',
             perfil: 'Família',
             status: 'ativo',
             ultimoAcesso: 'Nunca'
          })
       }
       return acc
    }, [])

    // Fetch active Auth users to check their actual existence and map orphaned records
    const supabaseAdmin = getAdminClient()
    // Em vez de puxar 1000 usuários na memória, assumimos ativo se ele estiver no system_users
    // (a verificação do último acesso pode ser relaxada aqui para listagens grandes, ou buscada individualmente)
    // Se precisarmos muito do auth, buscamos as páginas que interessam
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 }).catch(() => ({ data: { users: [] } }))
    const authUsersList = authData?.users || []

    // Buscar responsáveis e seus vínculos no banco
    const { data: respData } = await supabase.from('responsaveis').select('id, nome, email')
    const { data: linksData } = await supabase.from('aluno_responsavel').select('responsavel_id, resp_financeiro, resp_pedagogico')

    const mappedResps: any[] = []

    // 1. Processar responsáveis cadastrados no banco
    if (respData && Array.isArray(respData)) {
      respData.forEach((resp: any) => {
        const email = (resp.email || '').trim().toLowerCase()
        if (!email) return

        const links = (linksData || []).filter((l: any) => l.responsavel_id === resp.id)
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
            : 'Nunca'
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
