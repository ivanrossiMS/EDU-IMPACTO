import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

// ── Cache em memória para lista de colaboradores (TTL = 2 minutos) ──────────
// Evita N chamadas ao Supabase Auth por cada page mount nos 16+ locais do app.
const _colaboradoresCache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutos

function getCachedColaboradores(key: string) {
  const entry = _colaboradoresCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _colaboradoresCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedColaboradores(key: string, data: any) {
  _colaboradoresCache.set(key, { data, ts: Date.now() })
}

// Nota: não exportar funções não-handler de route files (Next.js App Router)
function invalidateColaboradoresCache() {
  _colaboradoresCache.clear()
}

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

    // FIX A: requireAuth() já valida o JWT — não chamar getUser() novamente
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const supabase = await createProtectedClient()

    const type = url.searchParams.get('type')
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    const search = url.searchParams.get('search') || ''
    
    const page = parseInt(pageParam || '1')
    const limit = parseInt(limitParam || '20')
    const from = (page - 1) * limit
    const to = from + limit - 1

    if (type === 'colaboradores') {
      // FIX E: Modo "dropdown" — quando limit=1000, as páginas só precisam de id/nome/email/perfil
      // para preencher selects. Retornar só dados da DB sem chamar o Supabase Auth.
      const isDropdownMode = limit >= 500

      // FIX D: Checar cache em memória (TTL 2min) para evitar N chamadas repetidas
      // Cache só ativo no modo dropdown (sem search, sem paginação real)
      const cacheKey = `colaboradores-dropdown`
      if (isDropdownMode && !search) {
        const cached = getCachedColaboradores(cacheKey)
        if (cached) {
          return NextResponse.json(cached)
        }
      }

      let query = supabase.from('system_users').select(
        isDropdownMode 
          ? 'id, nome, email, cargo, perfil, status' // campos mínimos para dropdowns
          : '*',
        { count: 'exact' }
      )
      if (search) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`)
      }
      
      const { data: sysUsers, count } = await query
        .order('nome')
        .range(from, isDropdownMode ? 999 : to)

      // FIX E: No modo dropdown, pular Auth queries — economiza N×HTTP round-trips
      // Os dados de perfil já estão na coluna `perfil` da system_users
      if (isDropdownMode) {
        const mappedDropdown = (sysUsers || []).map((u: any) => ({
          id: u.id,
          nome: u.nome,
          email: (u.email || '').trim().toLowerCase(),
          cargo: u.cargo || 'Não definido',
          perfil: u.perfil || 'Colaborador',
          status: u.status || 'ativo',
          ultimoAcesso: 'N/A'
        }))
        const result = { data: mappedDropdown, total: count || 0, page: 1, limit }
        if (!search) setCachedColaboradores(cacheKey, result)
        return NextResponse.json(result)
      }

      // Modo administração (limit <= 20): enriquecer com dados do Supabase Auth
      const supabaseAdmin = getAdminClient()
      const authMap = new Map<string, any>()
      if (sysUsers && sysUsers.length > 0) {
        // Busca em paralelo apenas os usuários desta página (máx 20 por vez)
        const authResults = await Promise.allSettled(
          sysUsers.map((u: any) => supabaseAdmin.auth.admin.getUserById(u.id))
        )
        authResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.data?.user) {
            const au = result.value.data.user
            if (au.email) authMap.set(au.email.toLowerCase(), au)
          }
        })
      }

      const mappedSys = (sysUsers || []).map((u: any) => {
        const email = (u.email || '').trim().toLowerCase()
        const authUser = authMap.get(email)

        const sysProfile = authUser?.user_metadata?.profile_code
        let perfilStr = u.perfil || 'Colaborador'
        if (!u.perfil) {
          if (sysProfile === 'DIRECAO') perfilStr = 'Direção'
          else if (sysProfile === 'SECRETARIA') perfilStr = 'Secretaria'
          else if (sysProfile === 'FINANCEIRO') perfilStr = 'Financeiro'
          else if (sysProfile === 'COORDENACAO') perfilStr = 'Coordenação'
          else if (sysProfile === 'PROFESSOR') perfilStr = 'Professor'
          else if (sysProfile === 'PORTARIA') perfilStr = 'Portaria'
        }

        return {
          id: u.id,
          nome: u.nome,
          email: email,
          cargo: u.cargo || 'Não definido',
          perfil: perfilStr,
          status: u.status || (authUser ? 'ativo' : 'inativo'),
          ultimoAcesso: authUser?.last_sign_in_at 
            ? new Date(authUser.last_sign_in_at).toLocaleDateString('pt-BR') 
            : 'Nunca acessou'
        }
      })

      return NextResponse.json({ data: mappedSys, total: count || 0, page, limit })
    }


    // Fallback logic for general users fetch (legacy support)
    async function fetchAll(table: string, cols: string) {
      let all: any[] = []
      let fromLoop = 0
      let toLoop = 999
      let hasMore = true
      while(hasMore) {
        const { data } = await supabase.from(table).select(cols).range(fromLoop, toLoop)
        if (!data || data.length === 0) {
          hasMore = false
        } else {
          all = [...all, ...data]
          if (data.length < 1000) hasMore = false
          else {
            fromLoop += 1000
            toLoop += 1000
          }
        }
      }
      return all
    }

    const sysUsers = await fetchAll('system_users', '*')

    // Para o relatório completo (fallback geral), ainda precisamos do mapa de Auth.
    // Carregamos em paralelo com os dados de alunos para minimizar o tempo total.
    const supabaseAdminFallback = getAdminClient()
    const { data: authDataFallback } = await supabaseAdminFallback.auth.admin
      .listUsers({ page: 1, perPage: 10000 })
      .catch(() => ({ data: { users: [] } }))
    const authMap = new Map<string, any>()
    for (const au of (authDataFallback?.users || [])) {
      if (au.email) authMap.set(au.email.toLowerCase(), au)
    }
    
    const mappedSys = sysUsers.map((u: any) => {
      const email = (u.email || '').trim().toLowerCase()
      const authUser = authMap.get(email)


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

    const alunosData = await fetchAll('alunos', 'id, nome, email, dados, matricula')

    const mappedAlunos = (alunosData || []).reduce((acc: any[], aluno: any) => {
       const alunoEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
       const virtualEmail = `aluno.${aluno.matricula || aluno.dados?.codigo || aluno.id}@impactoedu.local`.toLowerCase()
       
       const authUser = authMap.get(alunoEmail) || authMap.get(virtualEmail)
       
       acc.push({
          id: `virtual-${aluno.id}`,
          nome: aluno.nome,
          email: alunoEmail || '',
          cargo: 'Alunos',
          perfil: 'Família',
          status: authUser ? 'ativo' : 'inativo',
          ultimoAcesso: authUser?.last_sign_in_at 
            ? new Date(authUser.last_sign_in_at).toLocaleDateString('pt-BR') 
            : 'Nunca acessou'
       })
       return acc
    }, [])

    const respData = await fetchAll('responsaveis', 'id, nome, email')
    const linksData = await fetchAll('aluno_responsavel', 'responsavel_id, resp_financeiro, resp_pedagogico')

    const mappedResps: any[] = []

    if (respData && Array.isArray(respData)) {
      respData.forEach((resp: any) => {
        const email = (resp.email || '').trim().toLowerCase()

        const links = (linksData || []).filter((l: any) => String(l.responsavel_id) === String(resp.id))
        const hasActiveLink = links.some((l: any) => l.resp_financeiro === true || l.resp_pedagogico === true)
        
        if (!hasActiveLink) return

        const authUser = email ? authMap.get(email) : undefined

        mappedResps.push({
          id: `resp-${resp.id}`,
          nome: resp.nome,
          email: email || '',
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
