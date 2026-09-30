import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const body = await request.json()
    const { message_id, emoji, aluno_id, user_id, user_name, espelhar_colaborador } = body

    if (!message_id || !emoji) {
      return NextResponse.json({ error: 'message_id e emoji são obrigatórios' }, { status: 400 })
    }

    // 1. Obter usuário do banco ou metadados
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    let resolvedUserId = user_id || aluno_id || espelhar_colaborador || dbUser?.id || user.id
    let resolvedUserName = user_name || dbUser?.nome || user.user_metadata?.nome || user.user_metadata?.name || user.email || 'Usuário'

    if (espelhar_colaborador && !user_name) {
      const { data: espUser } = await supabase
        .from('system_users')
        .select('id, nome')
        .eq('id', espelhar_colaborador)
        .maybeSingle()
      if (espUser?.nome) {
        resolvedUserName = espUser.nome
      }
    }

    // 2. Buscar comentário no banco
    const { data: msg, error: errFetch } = await supabase
      .from('comunicados_respostas')
      .select('*')
      .eq('id', message_id)
      .maybeSingle()

    if (errFetch || !msg) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 })
    }

    // 3. Extrair reações existentes
    let reactions: any[] = []
    if (Array.isArray(msg.reacoes) && msg.reacoes.length > 0) {
      reactions = [...msg.reacoes]
    } else if (Array.isArray(msg.anexos)) {
      const rxItem = msg.anexos.find((a: any) => typeof a === 'object' && a !== null && a.__reactions__)
      if (rxItem && Array.isArray(rxItem.__reactions__)) {
        reactions = [...rxItem.__reactions__]
      }
    }

    // 4. Lógica WhatsApp:
    // Se o mesmo usuário clicar no mesmo emoji -> remove (toggle off)
    // Se clicar num emoji diferente -> substitui (apenas 1 reação ativa por usuário por comentário)
    const existingIndex = reactions.findIndex(
      r => String(r.user_id) === String(resolvedUserId) && r.emoji === emoji
    )

    if (existingIndex >= 0) {
      reactions.splice(existingIndex, 1)
    } else {
      reactions = reactions.filter(r => String(r.user_id) !== String(resolvedUserId))
      reactions.push({
        emoji,
        user_id: String(resolvedUserId),
        user_name: resolvedUserName,
        created_at: new Date().toISOString()
      })
    }

    // 5. Salva atualização no banco
    let updatedInColumn = false
    try {
      const { error: errCol } = await supabase
        .from('comunicados_respostas')
        .update({ reacoes: reactions })
        .eq('id', message_id)
      if (!errCol) {
        updatedInColumn = true
      }
    } catch {
      updatedInColumn = false
    }

    if (!updatedInColumn) {
      const cleanAnexos = (Array.isArray(msg.anexos) ? msg.anexos : []).filter(
        (a: any) => !(typeof a === 'object' && a !== null && a.__reactions__)
      )
      const updatedAnexos = reactions.length > 0 ? [...cleanAnexos, { __reactions__: reactions }] : cleanAnexos
      const { error: errUpd } = await supabase
        .from('comunicados_respostas')
        .update({ anexos: updatedAnexos })
        .eq('id', message_id)
      if (errUpd) throw errUpd
    }

    return NextResponse.json({
      success: true,
      message_id,
      reacoes: reactions
    })

  } catch (err: any) {
    console.error('Erro ao reagir ao comentário:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
