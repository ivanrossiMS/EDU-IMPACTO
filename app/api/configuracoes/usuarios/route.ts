import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  
  if (url.searchParams.get('checkMaster') === 'true') {
    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabaseAdmin.from('system_users').select('id').eq('email', 'direcao@colegioimpacto.net').maybeSingle()
    return NextResponse.json({ masterExists: !!data })
  }

  const supabase = await createProtectedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sysUsers, error: sysErr } = await supabase.from('system_users').select('*')
  if (sysErr) return NextResponse.json({ error: sysErr.message }, { status: 500 })
  
  const mappedSys = sysUsers?.map(u => ({ ...u, ultimoAcesso: u.ultimoacesso || u.ultimoAcesso })) || []

  // Buscar alunos para prover acesso virtual à família/alunos
  const { data: alunosData } = await supabase.from('alunos').select('*')

  const mappedAlunos = (alunosData || []).reduce((acc: any[], aluno: any) => {
     // 1. Criar Virtual User para o Aluno
     const alunoEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
     if (alunoEmail) {
        acc.push({
           id: `virtual-${aluno.id}`,
           nome: aluno.nome,
           email: alunoEmail,
           cargo: 'Aluno',
           perfil: 'Família',
           status: 'ativo',
           ultimoAcesso: 'Nunca'
        })
     }
     
     // 2. Criar Virtual User para o Responsável (email DIFERENTE do aluno)
     const realRespEmail = (
       aluno.dados?.emailResponsavel ||
       aluno.dados?.email_responsavel ||
       aluno.email_responsavel ||
       aluno.emailResponsavel ||
       aluno.dados?.responsaveis?.[0]?.email ||
       (Array.isArray(aluno.responsaveis) ? aluno.responsaveis[0]?.email : null)
     )?.trim().toLowerCase()
     
     // Só adicionar responsável se tiver email diferente do aluno
     if (realRespEmail && realRespEmail !== alunoEmail) {
        const respNome = aluno.responsavel || aluno.dados?.responsavel || `Responsável por ${aluno.nome}`
        if (!acc.some(u => u.email === realRespEmail)) {
           acc.push({
             id: `virtual-resp-${aluno.id}`, 
             nome: respNome,
             email: realRespEmail,
             cargo: 'Responsável',
             perfil: 'Família',
             status: 'ativo',
             ultimoAcesso: 'Nunca'
           })
        }
     }
     
     return acc
  }, [])

  return NextResponse.json([...mappedSys, ...mappedAlunos])
}

export async function POST(req: Request) {
  const body = await req.json()
  
  const prepare = (b: any) => { 
     const out = { ...b }; 
     if ('ultimoAcesso' in out) { out.ultimoacesso = out.ultimoAcesso; delete out.ultimoAcesso; }
     return out;
  }

  // Always use service-role admin for Auth provisioning
  const supabaseAdmin = require('@supabase/supabase-js').createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
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
     const { createProtectedClient } = require('@/lib/server/supabaseAuthFactory');
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
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existingAuthUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === email)
    
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
}
