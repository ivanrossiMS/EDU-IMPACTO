const fs = require('fs');
const file = 'app/api/configuracoes/usuarios/route.ts';
let content = fs.readFileSync(file, 'utf8');

const newGet = `export async function GET(req: Request) {
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

    const type = url.searchParams.get('type')
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    const search = url.searchParams.get('search') || ''
    
    const page = parseInt(pageParam || '1')
    const limit = parseInt(limitParam || '20')
    const from = (page - 1) * limit
    const to = from + limit - 1

    const supabaseAdmin = getAdminClient()
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 10000 }).catch(() => ({ data: { users: [] } }))
    const authUsersList = authData?.users || []
    
    const authMap = new Map<string, any>()
    for (const au of authUsersList) {
      if (au.email) authMap.set(au.email.toLowerCase(), au)
    }

    if (type === 'colaboradores') {
      let query = supabase.from('system_users').select('*', { count: 'exact' })
      if (search) {
        query = query.or(\`nome.ilike.%\${search}%,email.ilike.%\${search}%\`)
      }
      
      const { data: sysUsers, count } = await query.order('nome').range(from, to)

      const mappedSys = (sysUsers || []).map(u => {
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
    
    const mappedSys = sysUsers.map(u => {
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
       const virtualEmail = \`aluno.\${aluno.matricula || aluno.dados?.codigo || aluno.id}@impactoedu.local\`.toLowerCase()
       
       const authUser = authMap.get(alunoEmail) || authMap.get(virtualEmail)
       
       acc.push({
          id: \`virtual-\${aluno.id}\`,
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
          id: \`resp-\${resp.id}\`,
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
}`;

content = content.replace(/export async function GET\(req: Request\) \{[\s\S]*?(?=export async function POST\(req: Request\))/, newGet + '\n\n');
fs.writeFileSync(file, content);
