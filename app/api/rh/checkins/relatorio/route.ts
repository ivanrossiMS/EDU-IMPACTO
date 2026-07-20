import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = getAdminClient()

  try {
    // 1. Obter todos os checkins
    const { data: checkins, error: checkinsError } = await supabase
      .from('colaborador_checkin')
      .select('*')
      .order('data_checkin', { ascending: false })

    if (checkinsError && checkinsError.code !== '42P01') {
      throw checkinsError
    }

    const checkinsData = checkins || []

    // 2. Obter usuários do Auth (até 1000)
    let authUsersMap: Record<string, any> = {} // Mapeia id/uid_legacy para usuário do Auth
    
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (authUsers?.users) {
        authUsers.users.forEach(u => {
          const userObj = { email: u.email?.toLowerCase(), nome: u.user_metadata?.nome || u.email }
          authUsersMap[String(u.id)] = userObj
          if (u.user_metadata?.uid_legacy) {
            authUsersMap[String(u.user_metadata.uid_legacy)] = userObj
          }
        })
      }
    } catch (err) {
      console.log('Error fetching auth users:', err)
    }

    // 3. Obter todos os funcionários do banco para pegar o Cargo oficial
    let funcionariosMap: Record<string, any> = {} // Mapeia email -> Funcionario
    try {
      const { data: funcionarios } = await supabase.from('funcionarios').select('id, nome, email, cargo')
      if (funcionarios) {
        funcionarios.forEach(f => {
          if (f.email) {
            funcionariosMap[f.email.toLowerCase()] = f
          }
        })
      }
    } catch (err) {
      console.log('Error fetching funcionarios:', err)
    }

    // 4. Cruzar e enriquecer os dados
    const relatorio = checkinsData.map(ck => {
      let nome = 'Colaborador Desconhecido'
      let email = ''
      let cargo = 'Não informado'

      const authUser = authUsersMap[String(ck.usuario_id)]
      if (authUser) {
        email = authUser.email || ''
        nome = authUser.nome || nome

        // Tenta pegar o cargo oficial da tabela funcionarios
        const func = funcionariosMap[email]
        if (func) {
          nome = func.nome || nome
          cargo = func.cargo || cargo
        }
      }

      return {
        ...ck,
        colaborador_nome: nome,
        colaborador_email: email,
        colaborador_cargo: cargo
      }
    })

    return NextResponse.json({ success: true, checkins: relatorio })

  } catch (err: any) {
    console.error('Erro ao buscar relatório de checkins:', err)
    return NextResponse.json({ error: 'Erro interno ao buscar relatório' }, { status: 500 })
  }
}
