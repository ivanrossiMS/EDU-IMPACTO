import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { checkIsAdmin, checkIsStaffManagement, checkIsCollaboratorOrTeacher } from '@/lib/chatPermissions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversation_id')
    const limit = parseInt(searchParams.get('limit') || '60', 10)
    const before = searchParams.get('before')

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id é obrigatório' }, { status: 400 })
    }

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    // Executa em PARALELO: busca de mensagens, dados do usuário e metadados da conversa
    const [messagesRes, foundUserRes, convInfoRes] = await Promise.all([
      query,
      supabase
        .from('system_users')
        .select('id, cargo, perfil, auth_id, dados')
        .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
        .maybeSingle(),
      supabase
        .from('chat_conversations')
        .select('id, type, grupo_id, turma_id')
        .eq('id', conversationId)
        .maybeSingle()
    ])

    if (messagesRes.error) throw messagesRes.error

    const dbUser = foundUserRes.data
    const perfilUser = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargoUser = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfilUser, cargoUser)
    const isColabUser = checkIsCollaboratorOrTeacher(cargoUser, perfilUser)
    const isFamilyUser = 
      (perfilUser && ['família', 'familia', 'responsável', 'responsavel', 'aluno'].some(k => perfilUser.toLowerCase().includes(k))) ||
      (cargoUser && ['responsável', 'responsavel', 'aluno'].some(k => cargoUser.toLowerCase().includes(k)))
    const convInfo = convInfoRes.data

    if (convInfo?.type === 'group') {
      return NextResponse.json(
        { error: 'Grupos de turma foram descontinuados no chat.' },
        { status: 400 }
      )
    }

    // Verificação de privacidade para conversa direta (1 a 1):
    // Apenas participantes registrados (ou administradores com acesso institucional) podem visualizar mensagens
    if (!isAdmin) {
      const userCandidateIds = Array.from(new Set([
        String(user.id),
        dbUser?.id ? String(dbUser.id) : null,
        dbUser?.auth_id ? String(dbUser.auth_id) : null,
        user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : null,
        dbUser?.dados?.responsavel_id ? String(dbUser.dados.responsavel_id) : null,
        dbUser?.dados?.colaborador_id ? String(dbUser.dados.colaborador_id) : null,
        searchParams.get('espelhar_responsavel'),
        searchParams.get('espelhar_colaborador'),
      ].filter(Boolean))) as string[]

      const { data: isParticipant } = await supabase
        .from('chat_participants')
        .select('id')
        .eq('conversation_id', conversationId)
        .in('user_id', userCandidateIds)
        .limit(1)
        .maybeSingle()

      if (!isParticipant) {
        return NextResponse.json(
          { error: 'Acesso negado. Esta conversa direta é restrita ao participante selecionado.' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({ 
      messages: messagesRes.data || [],
      hasLeft: false,
      leftAt: null
    }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-transform'
      }
    })

  } catch (err: any) {
    console.error('Erro ao buscar mensagens do chat:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const body = await request.json()
    const {
      conversation_id,
      content,
      content_type = 'text',
      reply_to_id = null,
      reply_preview = null,
      metadata = {},
      sender_id: overrideSenderId,
      sender_name: overrideSenderName,
      sender_perfil: overrideSenderPerfil,
      context,
      isFamilyInitiated
    } = body

    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id é obrigatório' }, { status: 400 })
    }

    if (!content && (!metadata || !metadata.attachments || metadata.attachments.length === 0)) {
      return NextResponse.json({ error: 'Conteúdo ou anexo é obrigatório' }, { status: 400 })
    }

    // 1. Obter dados do usuário no system_users
    let dbUser: any = null
    const { data: foundUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil, dados')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser

    const senderId = overrideSenderId || dbUser?.id || user.id
    const senderName = overrideSenderName || dbUser?.nome || user.user_metadata?.nome || user.email || 'Usuário'
    const senderPerfil = overrideSenderPerfil || dbUser?.cargo || dbUser?.perfil || user.user_metadata?.perfil || 'Usuário'

    // 1.1 Buscar detalhes da conversa para validação de permissões
    const { data: convInfo } = await supabase
      .from('chat_conversations')
      .select('id, type, grupo_id, turma_id, title')
      .eq('id', conversation_id)
      .maybeSingle()

    if (convInfo?.type === 'group') {
      return NextResponse.json(
        { error: 'Grupos de turma foram descontinuados no chat. As mensagens agora são exclusivamente diretas.' },
        { status: 400 }
      )
    }

    const perfilUser = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargoUser = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfilUser, cargoUser)

    if (!isAdmin) {
      const userCandidateIds = Array.from(new Set([
        String(senderId),
        String(user.id),
        dbUser?.id ? String(dbUser.id) : null,
        dbUser?.auth_id ? String(dbUser.auth_id) : null,
        user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : null,
        dbUser?.dados?.responsavel_id ? String(dbUser.dados.responsavel_id) : null,
        dbUser?.dados?.colaborador_id ? String(dbUser.dados.colaborador_id) : null,
      ].filter(Boolean))) as string[]

      const { data: isParticipant } = await supabase
        .from('chat_participants')
        .select('id')
        .eq('conversation_id', conversation_id)
        .in('user_id', userCandidateIds)
        .limit(1)
        .maybeSingle()

      if (!isParticipant) {
        return NextResponse.json(
          { error: 'Acesso negado. Você não participa desta conversa direta e privada.' },
          { status: 403 }
        )
      }
    }

    const isSchoolStaff = checkIsCollaboratorOrTeacher(cargoUser, perfilUser, dbUser)

    const isFamilySender = 
      perfilUser.toLowerCase().includes('família') || 
      perfilUser.toLowerCase().includes('familia') || 
      perfilUser.toLowerCase().includes('responsável') || 
      perfilUser.toLowerCase().includes('responsavel') || 
      cargoUser.toLowerCase().includes('aluno') || 
      cargoUser.toLowerCase().includes('responsável') || 
      cargoUser.toLowerCase().includes('responsavel') ||
      (!isAdmin && !isSchoolStaff)

    // Se o admin configurou "Pausar Envio Fora do Horário", bloqueia o envio das famílias fora do expediente
    try {
      const { getChatAutoConfig, isWithinBusinessHours } = await import('@/lib/server/chatAutoResponder')
      const autoConfig = await getChatAutoConfig()
      const { isBusinessHours } = isWithinBusinessHours(autoConfig)

      if (
        autoConfig.horarioAtendimento.ativo &&
        !isBusinessHours &&
        isFamilySender
      ) {
        return NextResponse.json(
          {
            error: 'O atendimento escolar está fora do horário de expediente. O envio de mensagens está desabilitado no momento.'
          },
          { status: 403 }
        )
      }
    } catch (errCheckHours) {
      console.error('[ChatMessagesRoute] Erro ao checar horário:', errCheckHours)
    }

    // 2. Inserir mensagem
    const { data: insertedMsg, error: errInsert } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id,
        sender_id: senderId,
        sender_name: senderName,
        sender_perfil: senderPerfil,
        content: content || (content_type === 'image' ? '📷 Foto' : content_type === 'video' ? '🎥 Vídeo' : content_type === 'file' ? '📄 Arquivo' : 'Mensagem'),
        content_type,
        reply_to_id,
        reply_preview,
        status: 'sent',
        metadata: metadata || {}
      })
      .select()
      .single()

    if (errInsert) throw errInsert

    // 3. Atualizar last_message e timestamps na conversa (garantido caso trigger do banco precise de fallback)
    try {
      await supabase
        .from('chat_conversations')
        .update({
          last_message_at: insertedMsg.created_at,
          last_message_text: (insertedMsg.content || '').substring(0, 100),
          last_message_by: senderId,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation_id)


      // Incrementar unread_count para participantes exceto o sender (APENAS para participantes ativos que NÃO saíram)
      const { data: otherParticipants } = await supabase
        .from('chat_participants')
        .select('id, user_id, unread_count')
        .eq('conversation_id', conversation_id)
        .neq('user_id', senderId)
        .is('left_at', null)

      if (otherParticipants && otherParticipants.length > 0) {
        for (const part of otherParticipants) {
          await supabase
            .from('chat_participants')
            .update({
              unread_count: (part.unread_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', part.id)
        }
      }
    } catch (e) {
      console.warn('Fallback trigger notice:', e)
    }

    // 4. Disparo assíncrono de notificações push (sem bloquear a resposta instantânea do chat)
    try {
      const { dispatchChatPushNotification } = await import('@/lib/server/chatPushNotification')
      dispatchChatPushNotification({
        conversationId: conversation_id,
        messageId: insertedMsg.id,
        senderId,
        senderName,
        senderPerfil,
        content: insertedMsg.content,
        contentType: insertedMsg.content_type,
        metadata: insertedMsg.metadata || metadata
      }).catch(pushErr => console.error('[POST /api/chat/messages] Erro no push background:', pushErr))
    } catch (e) {
      console.error('[POST /api/chat/messages] Falha ao invocar dispatchChatPushNotification:', e)
    }

    // 5. Automação Institucional do Chat (Saudação de Boas-Vindas e Mensagem de Ausência Automática)
    let autoReplyMsg: any = null
    try {
      const { triggerChatAutoReplyIfNeeded } = await import('@/lib/server/chatAutoResponder')
      autoReplyMsg = await triggerChatAutoReplyIfNeeded({
        conversationId: conversation_id,
        senderId,
        senderName,
        senderPerfil,
        messageContent: insertedMsg.content
      })
    } catch (e) {
      console.error('[POST /api/chat/messages] Falha ao invocar auto-reply:', e)
    }

    return NextResponse.json({
      message: insertedMsg,
      auto_reply: autoReplyMsg || null
    }, { status: 201 })

  } catch (err: any) {
    console.error('Erro ao enviar mensagem:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    let messageId = searchParams.get('message_id')

    if (!messageId) {
      try {
        const body = await request.json()
        messageId = body?.message_id
      } catch {}
    }

    if (!messageId) {
      return NextResponse.json({ error: 'message_id é obrigatório' }, { status: 400 })
    }

    // 1. Obter usuário do banco para verificar cargo/perfil
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    const perfilUser = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargoUser = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfilUser, cargoUser)

    const isColabRole = 
      isAdmin ||
      perfilUser.includes('professor') || 
      perfilUser.includes('educador') || 
      perfilUser.includes('colaborador') || 
      cargoUser.includes('professor') || 
      cargoUser.includes('educador') || 
      cargoUser.includes('colaborador')

    const isFamilyOrStudent = 
      perfilUser.includes('família') || 
      perfilUser.includes('familia') || 
      perfilUser.includes('responsável') || 
      perfilUser.includes('responsavel') || 
      cargoUser.includes('aluno') || 
      cargoUser.includes('responsável') || 
      cargoUser.includes('responsavel')

    // Regra: Família e alunos NUNCA podem excluir mensagens
    if (!isColabRole || (isFamilyOrStudent && !isAdmin)) {
      return NextResponse.json(
        { error: 'Apenas colaboradores podem excluir mensagens.' },
        { status: 403 }
      )
    }

    // 2. Buscar a mensagem alvo
    const { data: targetMsg, error: errFetch } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle()

    if (errFetch || !targetMsg) {
      return NextResponse.json({ error: 'Mensagem não encontrada.' }, { status: 404 })
    }

    // 3. Regra: Excluir a mensagem enviada do colaborador apenas
    const senderPerfil = (targetMsg.sender_perfil || '').toLowerCase()
    const isSenderColab =
      senderPerfil.includes('professor') ||
      senderPerfil.includes('educador') ||
      senderPerfil.includes('colaborador') ||
      senderPerfil.includes('admin') ||
      senderPerfil.includes('master') ||
      senderPerfil.includes('diretor') ||
      senderPerfil.includes('direção') ||
      senderPerfil.includes('gestor') ||
      (!senderPerfil.includes('aluno') && !senderPerfil.includes('família') && !senderPerfil.includes('familia') && !senderPerfil.includes('responsável') && !senderPerfil.includes('responsavel'))

    if (!isSenderColab && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas mensagens enviadas por colaboradores podem ser excluídas.' },
        { status: 403 }
      )
    }

    // 4. Se não for master admin, o colaborador só pode excluir a sua própria mensagem
    const myCandidateIds = [String(user.id), String(dbUser?.id)].filter(Boolean)
    const isMyMessage = myCandidateIds.includes(String(targetMsg.sender_id))

    if (!isMyMessage && !isAdmin) {
      return NextResponse.json(
        { error: 'Você só pode excluir mensagens enviadas por você.' },
        { status: 403 }
      )
    }

    // 5. Atualizar mensagem com soft-delete
    const nowIso = new Date().toISOString()
    const { data: updatedMsg, error: errDelete } = await supabase
      .from('chat_messages')
      .update({
        is_deleted: true,
        deleted_at: nowIso,
        deleted_by: dbUser?.id || user.id,
        updated_at: nowIso
      })
      .eq('id', messageId)
      .select()
      .single()

    if (errDelete) throw errDelete

    // 6. Atualizar conversa caso esta mensagem tenha sido a última
    try {
      const { data: latestRemaining } = await supabase
        .from('chat_messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', targetMsg.conversation_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      await supabase
        .from('chat_conversations')
        .update({
          last_message_at: latestRemaining?.created_at || null,
          last_message_text: latestRemaining ? (latestRemaining.content || '').substring(0, 100) : '',
          last_message_by: latestRemaining?.sender_id || null,
          updated_at: nowIso
        })
        .eq('id', targetMsg.conversation_id)
    } catch (e) {
      console.warn('Erro ao atualizar last_message da conversa após exclusão:', e)
    }

    return NextResponse.json({ success: true, message: updatedMsg })

  } catch (err: any) {
    console.error('Erro ao excluir mensagem:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
