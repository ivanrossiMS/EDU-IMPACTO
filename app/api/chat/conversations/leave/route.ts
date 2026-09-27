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
    const { conversation_id } = body

    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id é obrigatório' }, { status: 400 })
    }

    // 1. Obter dados do usuário
    let dbUser: any = null
    const { data: foundUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser

    const currentUserId = user.id
    const currentUserName = dbUser?.nome || user.user_metadata?.nome || user.email || 'Usuário'
    const userCandidateIds = [String(user.id), String(dbUser?.id), String(dbUser?.auth_id)].filter(Boolean)

    // 2. Buscar a conversa
    const { data: conv, error: errConv } = await supabase
      .from('chat_conversations')
      .select('id, type, title, grupo_id, turma_id')
      .eq('id', conversation_id)
      .maybeSingle()

    if (errConv || !conv) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    if (conv.type !== 'group') {
      return NextResponse.json({ error: 'Apenas grupos permitem sair da conversa' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    // 3. Atualizar chat_participants para marcar a saída e zerar não lidos
    await supabase
      .from('chat_participants')
      .update({
        left_at: nowIso,
        unread_count: 0,
        updated_at: nowIso
      })
      .eq('conversation_id', conversation_id)
      .in('user_id', userCandidateIds)

    // 4. Remover colaborador de agenda_grupos se aplicável
    let grp: any = null
    if (conv.grupo_id) {
      const { data } = await supabase.from('agenda_grupos').select('id, dados').eq('id', conv.grupo_id).maybeSingle()
      grp = data
    } else if (conv.turma_id) {
      const cleanTId = String(conv.turma_id).replace(/^sync-/, '')
      const { data } = await supabase
        .from('agenda_grupos')
        .select('id, dados')
        .or(`dados->>syncId.eq."${conv.turma_id}",dados->>turma_id.eq."${conv.turma_id}",dados->>syncId.eq."${cleanTId}",dados->>turma_id.eq."${cleanTId}"`)
        .maybeSingle()
      grp = data
    }

    if (grp) {
      const colabIds = Array.isArray(grp.dados?.colaboradoresIds) ? grp.dados.colaboradoresIds.map(String) : []
      const updatedColabIds = colabIds.filter((cid: string) => !userCandidateIds.includes(cid))

      if (updatedColabIds.length !== colabIds.length) {
        await supabase
          .from('agenda_grupos')
          .update({
            dados: {
              ...grp.dados,
              colaboradoresIds: updatedColabIds
            }
          })
          .eq('id', grp.id)
      }
    }

    // 5. Inserir mensagem de sistema informando a saída
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id,
        sender_id: currentUserId,
        sender_name: currentUserName,
        sender_perfil: 'Sistema',
        content: `${currentUserName} saiu do grupo.`,
        content_type: 'system',
        status: 'sent',
        created_at: nowIso
      })

    // 6. Atualizar last_message_at na conversa
    await supabase
      .from('chat_conversations')
      .update({
        last_message_at: nowIso,
        last_message_text: `${currentUserName} saiu do grupo.`,
        last_message_by: currentUserId,
        updated_at: nowIso
      })
      .eq('id', conversation_id)

    return NextResponse.json({
      success: true,
      left_at: nowIso,
      message: 'Você saiu do grupo com sucesso. O histórico anterior permanece disponível para consulta.'
    })

  } catch (err: any) {
    console.error('Erro ao sair do grupo:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
