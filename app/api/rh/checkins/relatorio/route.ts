import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const dataInicio = searchParams.get('data_inicio')
  const dataFim = searchParams.get('data_fim')
  const risco = searchParams.get('risco')
  const querConversar = searchParams.get('quer_conversar')
  const search = searchParams.get('search')

  const supabase = getAdminClient()

  try {
    // 1. Obter todos os checkins com ordenação
    let query = supabase
      .from('colaborador_checkin')
      .select('*')
      .order('data_checkin', { ascending: false })

    if (dataInicio) {
      query = query.gte('data_checkin', `${dataInicio}T00:00:00.000Z`)
    }
    if (dataFim) {
      query = query.lte('data_checkin', `${dataFim}T23:59:59.999Z`)
    }
    if (risco && risco !== 'todos') {
      query = query.eq('risco_burnout', risco)
    }

    const { data: checkins, error: checkinsError } = await query

    if (checkinsError && checkinsError.code !== '42P01') {
      throw checkinsError
    }

    const checkinsData = checkins || []

    // 2. Mapeamento de Usuários do Auth e System Users
    let usersMap: Record<string, { nome: string; email: string; cargo: string }> = {}

    try {
      const { data: sysUsers } = await supabase
        .from('system_users')
        .select('id, email, nome, cargo')

      if (sysUsers) {
        sysUsers.forEach(u => {
          const info = {
            nome: u.nome || u.email || 'Colaborador',
            email: u.email || '',
            cargo: u.cargo || 'Colaborador'
          }
          if (u.id) usersMap[String(u.id)] = info
          if (u.email) usersMap[u.email.toLowerCase()] = info
        })
      }

      // Complementar com auth listUsers
      const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (authUsers?.users) {
        authUsers.users.forEach(u => {
          const email = u.email?.toLowerCase() || ''
          const current = usersMap[String(u.id)] || (email ? usersMap[email] : null)
          const nome = current?.nome || u.user_metadata?.nome || u.email || 'Colaborador'
          const cargo = current?.cargo || 'Colaborador'

          const userObj = { nome, email, cargo }
          usersMap[String(u.id)] = userObj
          if (u.user_metadata?.uid_legacy) {
            usersMap[String(u.user_metadata.uid_legacy)] = userObj
          }
          if (email) usersMap[email] = userObj
        })
      }
    } catch (err) {
      console.error('[Checkin Relatorio] Erro ao carregar mapeamento de usuários:', err)
    }

    // 3. Cruzar e enriquecer os dados
    let relatorio = checkinsData.map(ck => {
      const userMeta = usersMap[String(ck.usuario_id)] || {
        nome: 'Colaborador',
        email: '',
        cargo: 'Não informado'
      }

      return {
        ...ck,
        colaborador_nome: userMeta.nome,
        colaborador_email: userMeta.email,
        colaborador_cargo: userMeta.cargo
      }
    })

    // 4. Filtros pós-processamento (para busca textual e quer_conversar)
    if (querConversar === 'sim') {
      relatorio = relatorio.filter(item => Boolean(item.quer_conversar))
    } else if (querConversar === 'nao') {
      relatorio = relatorio.filter(item => !item.quer_conversar)
    } else if (querConversar && querConversar !== 'todos') {
      relatorio = relatorio.filter(item => item.quer_conversar === querConversar)
    }

    if (search && search.trim()) {
      const term = search.toLowerCase().trim()
      relatorio = relatorio.filter(item =>
        item.colaborador_nome.toLowerCase().includes(term) ||
        item.colaborador_email.toLowerCase().includes(term) ||
        item.colaborador_cargo.toLowerCase().includes(term) ||
        (item.emocao_geral && item.emocao_geral.toLowerCase().includes(term))
      )
    }

    return NextResponse.json({ success: true, checkins: relatorio })
  } catch (err: any) {
    console.error('Erro ao buscar relatório de checkins:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao buscar relatório' }, { status: 500 })
  }
}
