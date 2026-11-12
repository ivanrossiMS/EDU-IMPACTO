import { NextResponse } from 'next/server'
import { requireAuth, requireStaff, requireAdminOrDirecao, clearAuthGuardCache } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAdminClient, findAuthUserByEmail, getAllAuthUsersCached, invalidateAuthUsersCache } from '@/lib/server/supabaseAdminSingleton'
import {
  getCachedColaboradores,
  setCachedColaboradores,
  invalidateColaboradoresCache,
  getFullUsersReportCache,
  setFullUsersReportCache,
  invalidateFullUsersReportCache,
} from '@/lib/server/colaboradoresCache'
import { isStudentInactiveStatus, isStudentAccessBlocked, isResponsavelAccessBlocked, syncCollaboratorAccessStatus } from '@/lib/server/studentStatusHelper'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

let inflightFullUsersReport: Promise<{ data: any[], stats: any, expires: number }> | null = null

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    
    if (url.searchParams.get('checkMaster') === 'true') {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Faltam as variáveis de ambiente do Supabase.' }, { status: 500 })
      }
      const supabaseAdmin = getAdminClient()
      const { data } = await supabaseAdmin.from('system_users').select('id').eq('email', 'direcao@colegioimpacto.net').maybeSingle()
      return NextResponse.json({ masterExists: !!data })
    }

    const { errorResponse } = await requireStaff(req)
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
      // FIX E: Modo "dropdown" — quando limit=1000, as páginas só precisam de dados de system_users
      // sem chamar o Supabase Auth API 10.000 vezes.
      const isDropdownMode = limit >= 500
      const includeInactive = url.searchParams.get('includeInactive') === 'true'
      const activeOnly = url.searchParams.get('activeOnly') === 'true' || (isDropdownMode && !includeInactive)
      const supabaseAdmin = getAdminClient()

      let query = supabaseAdmin.from('system_users').select(
        '*',
        { count: 'exact' }
      )
      if (activeOnly) {
        query = query.or('status.is.null,status.not.ilike.inativo')
      }
      if (search) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,cargo.ilike.%${search}%,perfil.ilike.%${search}%`)
      }
      
      const { data: sysUsers, count } = await query
        .order('nome')
        .range(from, isDropdownMode ? 999 : to)

      const filteredSysUsers = activeOnly
        ? (sysUsers || []).filter((u: any) => String(u.status || 'ativo').trim().toLowerCase() !== 'inativo')
        : (sysUsers || [])

      if (isDropdownMode) {
        const mappedDropdown = filteredSysUsers.map((u: any) => ({
          id: u.id,
          auth_id: u.auth_id || u.dados?.auth_id || null,
          uid_legacy: u.dados?.uid_legacy || null,
          nome: u.nome,
          email: (u.email || '').trim().toLowerCase(),
          cargo: u.cargo || 'Não definido',
          perfil: u.perfil || 'Colaborador',
          status: u.status || 'ativo',
          twofa: Boolean(u.twofa),
          hasDualRole: Boolean(u.dados?.responsavel_id),
          responsavel_id: u.dados?.responsavel_id || null,
          foto: u.dados?.foto || u.foto || null,
          unidades: u.dados?.unidades || [],
          dados: u.dados || {},
          ultimoAcesso: u.ultimoacesso || u.ultimoAcesso || 'N/A'
        }))
        const result = { data: mappedDropdown, total: count || mappedDropdown.length, page: 1, limit }
        return NextResponse.json(result, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        })
      }

      // Modo administração (limit <= 20): enriquecer com dados do Supabase Auth
      const authMap = new Map<string, any>()
      const usersList: any[] = filteredSysUsers
      if (usersList.length > 0) {
        // Busca em paralelo apenas os usuários desta página (máx 20 por vez)
        // Prioriza auth_id caso seja diferente de id
        const authResults = await Promise.allSettled(
          usersList.map((u: any) => {
            const targetId = u.auth_id || u.id
            return supabaseAdmin.auth.admin.getUserById(targetId)
          })
        )
        authResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.data?.user) {
            const au = result.value.data.user
            if (au.email) authMap.set(au.email.toLowerCase().trim(), au)
          }
        })

        // Fallback: se algum usuário desta página não foi localizado pelo ID (ex: id desatualizado), busca por e-mail
        for (const u of usersList) {
          const email = (u.email || '').trim().toLowerCase()
          if (email && !authMap.has(email)) {
            const au = await findAuthUserByEmail(email)
            if (au) authMap.set(email, au)
          }
        }
      }


      const mappedSys = usersList.map((u: any) => {
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
          status: u.status || 'ativo',
          twofa: u.twofa || false,
          hasDualRole: Boolean(authUser?.user_metadata?.hasDualRole || u.dados?.responsavel_id),
          responsavel_id: authUser?.user_metadata?.responsavel_id || u.dados?.responsavel_id || null,
          foto: authUser?.user_metadata?.foto || u.dados?.foto || u.foto || null,
          dados: u.dados || {},
          telefone: u.dados?.telefone || u.telefone || '',
          unidade: u.dados?.unidade || u.unidade || '',
          ultimoAcesso: authUser?.last_sign_in_at 
            ? new Date(authUser.last_sign_in_at).toLocaleDateString('pt-BR') 
            : 'Nunca acessou'
        }
      })

      return NextResponse.json({ data: mappedSys, total: count || 0, page, limit })
    }

    const isSummaryOnly = url.searchParams.get('summary') === 'true'
    const cachedReport = getFullUsersReportCache()
    if (cachedReport) {
      const payload = isSummaryOnly ? { stats: cachedReport.stats, data: [] } : cachedReport.data
      return NextResponse.json(payload, {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      })
    }

    if (!inflightFullUsersReport) {
      inflightFullUsersReport = (async () => {
        // Fallback logic for general users fetch (legacy support)
        async function fetchAll(table: string, cols: string) {
          let all: any[] = []
          let fromLoop = 0
          let toLoop = 999
          let hasMore = true
          while (hasMore) {
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

        const [sysUsers, allAuthUsers, alunosData, respData, linksData] = await Promise.all([
          fetchAll('system_users', 'id, auth_id, nome, email, cargo, perfil, status, dados'),
          getAllAuthUsersCached(),
          fetchAll('alunos', 'id, nome, email, matricula, status, dados'),
          fetchAll('responsaveis', 'id, nome, email, auth_id, dados'),
          fetchAll('aluno_responsavel', 'aluno_id, responsavel_id, resp_financeiro, resp_pedagogico')
        ])

        const activeAlunosData = (alunosData || []).filter((a: any) => !isStudentInactiveStatus(a))
        const activeAlunoRefs = new Set<string>()
        for (const a of activeAlunosData) {
          for (const ref of [a.id, a.matricula, a.dados?.codigo, a.dados?.codigoAluno]) {
            if (ref !== undefined && ref !== null && String(ref).trim() !== '') {
              const clean = String(ref).trim().toLowerCase()
              activeAlunoRefs.add(clean)
              const unpadded = clean.replace(/^0+/, '')
              if (unpadded) activeAlunoRefs.add(unpadded)
            }
          }
        }

        const authMap = new Map<string, any>()
        const authById = new Map<string, any>()
        for (const au of allAuthUsers) {
          if (au.id) authById.set(String(au.id), au)
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

          const dbStatusStr = String(u.status || 'ativo').trim().toLowerCase()
          const isDbActive = dbStatusStr !== 'inativo'

          return {
            id: u.id,
            nome: u.nome,
            email: email,
            cargo: u.cargo || 'Não definido',
            perfil: perfilStr,
            status: isDbActive && authUser ? 'ativo' : 'inativo',
            colabStatus: u.status || 'ativo',
            vinculoAtivo: isDbActive,
            foto: authUser?.user_metadata?.foto || u.dados?.foto || u.foto || null,
            dados: u.dados || {},
            telefone: u.dados?.telefone || u.telefone || '',
            unidade: u.dados?.unidade || u.unidade || '',
            ultimoAcesso: authUser?.last_sign_in_at 
              ? new Date(authUser.last_sign_in_at).toLocaleDateString('pt-BR') 
              : 'Nunca acessou'
          }
        })

        const mappedAlunos = (alunosData || []).reduce((acc: any[], aluno: any) => {
          const alunoEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
          const code = String(aluno.matricula || aluno.dados?.codigo || aluno.id).toLowerCase()
          const virtualEmail = `aluno.${code}@impactoedu.local`
          const altVirtualEmail = `${code}@aluno.impacto.edu.br`
          
          const authUser =
            (aluno.dados?.auth_id ? authById.get(String(aluno.dados.auth_id)) : undefined) ||
            (alunoEmail ? authMap.get(alunoEmail) : undefined) ||
            authMap.get(virtualEmail) ||
            authMap.get(altVirtualEmail)
          const isBlocked = isStudentAccessBlocked(aluno)
          const vinculoAtivo = !isStudentInactiveStatus(aluno)
          
          acc.push({
            id: `virtual-${aluno.id}`,
            nome: aluno.nome,
            email: alunoEmail || '',
            cargo: 'Alunos',
            perfil: 'Família',
            status: authUser && !isBlocked ? 'ativo' : 'inativo',
            vinculoAtivo,
            ultimoAcesso: authUser?.last_sign_in_at 
              ? new Date(authUser.last_sign_in_at).toLocaleDateString('pt-BR') 
              : 'Nunca acessou'
          })
          return acc
        }, [])

        const activeRespIds = new Set(
          (linksData || [])
            .filter((l: any) => {
              if (l.resp_financeiro !== true && l.resp_pedagogico !== true) return false
              const ref = String(l.aluno_id || '').trim().toLowerCase()
              const unpadded = ref.replace(/^0+/, '')
              return activeAlunoRefs.has(ref) || (Boolean(unpadded) && activeAlunoRefs.has(unpadded))
            })
            .map((l: any) => String(l.responsavel_id).trim())
        )

        const mappedResps: any[] = []

        if (respData && Array.isArray(respData)) {
          respData.forEach((resp: any) => {
            const respIdStr = String(resp.id).trim()
            const vinculoAtivo = activeRespIds.has(respIdStr)

            const email = (resp.email || resp.dados?.email || '').trim().toLowerCase()
            const authId = resp.auth_id || resp.dados?.auth_id || resp.dados?.user_id
            const authUser =
              (authId ? authById.get(String(authId)) : undefined) ||
              (email ? authMap.get(email) : undefined)
            const isBlocked = !vinculoAtivo || isResponsavelAccessBlocked(resp)

            mappedResps.push({
              id: `resp-${resp.id}`,
              nome: resp.nome,
              email: email || '',
              cargo: 'Responsáveis',
              perfil: 'Família',
              status: authUser && !isBlocked ? 'ativo' : 'inativo',
              vinculoAtivo,
              ultimoAcesso: authUser?.last_sign_in_at 
                ? new Date(authUser.last_sign_in_at).toLocaleDateString('pt-BR') 
                : 'Nunca acessou'
            })
          })
        }

        const combined = [...mappedSys, ...mappedAlunos, ...mappedResps]
        let colab = 0, colabTotal = 0
        let alunos = 0, alunosTotal = 0
        let resps = 0, respsTotal = 0
        let totalAtivos = 0
        let totalGeralAtivos = 0

        for (const u of combined) {
          if (u.vinculoAtivo === false) continue
          totalGeralAtivos++
          const isAtivo = u.ultimoAcesso && u.ultimoAcesso !== 'Nunca acessou'
          if (isAtivo) totalAtivos++
          if (u.cargo === 'Alunos') {
            alunosTotal++
            if (isAtivo) alunos++
          } else if (u.cargo === 'Responsáveis') {
            respsTotal++
            if (isAtivo) resps++
          } else {
            colabTotal++
            if (isAtivo) colab++
          }
        }

        const stats = {
          colab,
          colabTotal,
          alunos,
          alunosTotal,
          resps,
          respsTotal,
          total: totalAtivos,
          totalGeral: totalGeralAtivos
        }

        const entry = { data: combined, stats, expires: Date.now() + 60_000 }
        setFullUsersReportCache(entry)
        return entry
      })().finally(() => {
        inflightFullUsersReport = null
      })
    }

    const report = await inflightFullUsersReport
    const payload = isSummaryOnly ? { stats: report.stats, data: [] } : report.data

    return NextResponse.json(payload, {
      headers: {
        // Cache curto de 30s — dados de usuários mudam raramente durante a sessão
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    })
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

    if (masterCheck || (count && count > 0 && !isMasterSetup)) {
      const { errorResponse: staffErr } = await requireStaff(req)
      if (staffErr) return staffErr
      const { errorResponse: adminErr } = await requireAdminOrDirecao(req)
      if (adminErr) return adminErr
    }

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
    
    let respMatch: any = null
    if (singleBody?.email) {
      const email = singleBody.email.trim().toLowerCase()
      
      // Checa se já existe como responsável (papel duplo Família + Colaborador)
      const { data: rm } = await supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email')
        .ilike('email', email)
        .maybeSingle()
      respMatch = rm

      // Check if Auth user already exists for this email
      let existingAuthUser: any = await findAuthUserByEmail(email)
      
      if (!existingAuthUser) {
        // Create Auth user with the provided password, or a temporary placeholder if none is provided
        const userPass = singleBody.senha || singleBody.password || `EduTemp_${Math.random().toString(36).slice(2, 10)}!`
        try {
          const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: userPass,
            email_confirm: true,   // skip email confirmation — admin-provisioned
            user_metadata: {
              nome: singleBody.nome,
              cargo: singleBody.cargo,
              perfil: singleBody.perfil
            }
          })
          if (authData?.user?.id) {
            existingAuthUser = authData.user
            authUserIdToLink = authData.user.id
          } else if (authErr?.message?.toLowerCase().includes('already')) {
            existingAuthUser = await findAuthUserByEmail(email)
            if (existingAuthUser?.id) authUserIdToLink = existingAuthUser.id
          }
        } catch (e: any) {
          console.error('[POST /api/configuracoes/usuarios] Auth provision error:', e.message)
        }
      } else {
        authUserIdToLink = existingAuthUser.id
      }

      // Se encontrou usuário no Auth (inclusive pré-existente como Responsável), atualiza metadados apenas se colaborador ativo
      if (authUserIdToLink && String(singleBody.status || 'ativo').trim().toLowerCase() !== 'inativo') {
        const existingMeta = existingAuthUser?.user_metadata || {}
        const hasDual = Boolean(respMatch?.id || existingMeta.responsavel_id)
        await supabaseAdmin.auth.admin.updateUserById(authUserIdToLink, {
          user_metadata: {
            ...existingMeta,
            nome: singleBody.nome || existingMeta.nome,
            cargo: singleBody.cargo || existingMeta.cargo,
            perfil: singleBody.perfil || existingMeta.perfil,
            colaborador_id: authUserIdToLink,
            system_user_id: authUserIdToLink,
            ...(respMatch?.id ? { responsavel_id: String(respMatch.id) } : {}),
            hasDualRole: hasDual,
          }
        }).catch((err: any) => console.warn('[POST /api/configuracoes/usuarios] Erro ao atualizar metadata:', err?.message))
      }
    }

    // Prepare DB payload
    let fixedBodyList = Array.isArray(body) ? body.map(prepare) : [prepare(body)]

    // Link Auth UUID to system_users.id so auth→db lookup works natively
    if (authUserIdToLink) {
      fixedBodyList[0].id = authUserIdToLink
      fixedBodyList[0].auth_id = authUserIdToLink
      if (respMatch?.id) {
        fixedBodyList[0].dados = {
          ...(fixedBodyList[0].dados || {}),
          responsavel_id: String(respMatch.id)
        }
      }
    } else {
      // Se não há Auth UUID, garantir ID UUID válido para não quebrar constraints
      const validUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null
      if (validUuid) fixedBodyList[0].id = validUuid
      fixedBodyList[0].auth_id = null
    }

    // Upsert into system_users (usar supabaseAdmin para consistência de novos colaboradores)
    const { data, error } = await supabaseAdmin.from('system_users').upsert(fixedBodyList).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Invalida caches de colaboradores e permissões
    invalidateColaboradoresCache()
    clearAuthGuardCache()
    invalidateAuthUsersCache()
    invalidateFullUsersReportCache()

    // Sync to funcionarios and Auth/Grupos/Chat
    for (const row of (data || [])) {
      if (row.email && row.status !== undefined) {
        await supabaseAdmin.from('funcionarios').update({
          status: row.status,
          ...(row.perfil ? { perfil_sistema: row.perfil } : {})
        }).ilike('email', row.email)
      }
      await syncCollaboratorAccessStatus({
        userId: row.id,
        authId: row.auth_id,
        email: row.email,
        status: row.status,
        nome: row.nome,
        cargo: row.cargo,
        perfil: row.perfil,
        systemUserDados: row.dados,
        supabaseClient: supabaseAdmin,
      })
    }

    return NextResponse.json(Array.isArray(body) ? data : data[0])

  } catch (err: any) {
    console.error('[API POST configuracoes/usuarios]', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
