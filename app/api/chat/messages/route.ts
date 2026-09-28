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

    let hasLeft = false
    let effectiveLeftAt: string | null = null
    let finalMessages = messagesRes.data || []

    // Verificação de privacidade para conversa direta (1 a 1):
    // Apenas participantes registrados (ou administradores com acesso institucional) podem visualizar mensagens
    if (convInfo?.type === 'direct' && !isAdmin) {
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

    // Verificação de saída do grupo (aplica-se estritamente a colaboradores não-administradores)
    if (!isAdmin && isColabUser && !isFamilyUser && convInfo?.type === 'group') {
      const userCandidateIds = Array.from(new Set([
        user.id,
        dbUser?.id,
        searchParams.get('espelhar_colaborador'),
        searchParams.get('aluno_id')
      ].filter(Boolean))) as string[]

      const { syncAndResolveGroupMemberships } = await import('@/lib/server/chatGroupMembership')
      const { groupStatusByConvId } = await syncAndResolveGroupMemberships(
        supabase,
        userCandidateIds,
        cargoUser,
        perfilUser
      )
      const status = groupStatusByConvId.get(conversationId)
      if (status?.hasLeft && status.leftAt) {
        hasLeft = true
        effectiveLeftAt = status.leftAt
      }

      if (!hasLeft) {
        const { data: myPart } = await supabase
          .from('chat_participants')
          .select('left_at, user_perfil')
          .eq('conversation_id', conversationId)
          .in('user_id', userCandidateIds)
          .not('left_at', 'is', null)
          .order('left_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const partPerfil = (myPart?.user_perfil || '').toLowerCase()
        const isPartFamily = ['família', 'familia', 'responsável', 'responsavel', 'aluno'].some(k => partPerfil.includes(k))

        if (myPart?.left_at && !isPartFamily) {
          hasLeft = true
          effectiveLeftAt = myPart.left_at
        }
      }

      if (hasLeft && effectiveLeftAt) {
        const leftTimestamp = new Date(effectiveLeftAt).getTime()
        finalMessages = finalMessages.filter((m: any) => new Date(m.created_at).getTime() <= leftTimestamp)
      }
    } else if (isFamilyUser && convInfo?.type === 'group') {
      const userCandidateIds = Array.from(new Set([
        user.id,
        dbUser?.id,
        searchParams.get('espelhar_responsavel'),
        searchParams.get('aluno_id')
      ].filter(Boolean))) as string[]

      // 1. Checa se o participante tem left_at gravado
      const { data: myPart } = await supabase
        .from('chat_participants')
        .select('left_at')
        .eq('conversation_id', conversationId)
        .in('user_id', userCandidateIds)
        .not('left_at', 'is', null)
        .order('left_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (myPart?.left_at) {
        hasLeft = true
        effectiveLeftAt = myPart.left_at
      } else {
        // 2. Ou checa via resolveFamilyScope se a turma/grupo é histórica para o aluno
        try {
          const { resolveFamilyScope } = await import('@/lib/server/chatFamilyHelper')
          const familyScope = await resolveFamilyScope(user, {
            alunoIdParam: searchParams.get('aluno_id'),
            context: 'familia',
            dbUser
          })
          const histInfo = 
            (convInfo.grupo_id ? familyScope.historicalGroupIds.get(String(convInfo.grupo_id)) : null) ||
            (convInfo.turma_id ? familyScope.historicalGroupIds.get(String(convInfo.turma_id)) : null) ||
            (convInfo.turma_id ? familyScope.historicalGroupIds.get(String(convInfo.turma_id).replace(/^sync-/, '')) : null)

          if (histInfo) {
            hasLeft = true
            effectiveLeftAt = histInfo.dataSaida || null
          }
        } catch (e) {
          console.error('[Chat Messages] Error resolving historical group for family:', e)
        }
      }

      if (hasLeft && effectiveLeftAt) {
        const leftTimestamp = new Date(effectiveLeftAt).getTime()
        finalMessages = finalMessages.filter((m: any) => new Date(m.created_at).getTime() <= leftTimestamp)
      }
    }

    return NextResponse.json({ 
      messages: finalMessages,
      hasLeft,
      leftAt: effectiveLeftAt
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

    const perfilUser = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargoUser = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfilUser, cargoUser)

    // 1.1 Buscar detalhes da conversa para validação de permissões
    const { data: convInfo } = await supabase
      .from('chat_conversations')
      .select('id, type, grupo_id, turma_id, title')
      .eq('id', conversation_id)
      .maybeSingle()

    if (convInfo?.type === 'direct') {
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
    }

    if (convInfo?.type === 'group') {
      const isColabOrTeacher = checkIsCollaboratorOrTeacher(cargoUser, perfilUser, dbUser)

      // Regra 1: No modo família, o envio em grupos de turma é estritamente desativado.
      // O envio em grupos de turma é permitido exclusivamente no Modo Colaborador.
      if (context === 'familia' || isFamilyInitiated) {
        return NextResponse.json(
          {
            error: isColabOrTeacher
              ? 'No Modo Família, grupos da turma são somente leitura. Alterne para o Modo Colaborador para enviar mensagens.'
              : 'No Modo Família, grupos da turma são somente leitura.'
          },
          { status: 403 }
        )
      }

      const isAdmin = checkIsAdmin(perfilUser, cargoUser)
      const isEquipeEscolar = isAdmin || checkIsStaffManagement(cargoUser, perfilUser)

      // Regra: se o envio de colaboradores em grupos de turma estiver desativado pela escola
      if (!isAdmin) {
        try {
          const { getChatAutoConfig } = await import('@/lib/server/chatAutoResponder')
          const autoConfig = await getChatAutoConfig()
          if (autoConfig.recursos?.permitirColaboradorEnviarGrupoTurma === false) {
            return NextResponse.json(
              { error: 'O envio de mensagens nos grupos da turma por colaboradores foi temporariamente pausado pela administração escolar.' },
              { status: 403 }
            )
          }
        } catch (errGroupColab) {
          console.error('[ChatMessagesRoute] Erro ao checar permissão de grupo:', errGroupColab)
        }
      }

      // Se não for da equipe escolar geral (ex: professor de sala de aula), verifica se está vinculado à turma
      if (!isEquipeEscolar) {
        const userCandidateIds = [String(senderId), String(user.id), String(dbUser?.id), String(dbUser?.auth_id)].filter(Boolean)

        // Verificar se já possui registro de left_at
        const { data: myPart } = await supabase
          .from('chat_participants')
          .select('left_at')
          .eq('conversation_id', conversation_id)
          .in('user_id', userCandidateIds)
          .not('left_at', 'is', null)
          .maybeSingle()

        if (myPart?.left_at) {
          return NextResponse.json(
            { error: 'Você não participa mais deste grupo e não pode enviar novas mensagens.' },
            { status: 403 }
          )
        }

        let targetGrupo: any = null
        if (convInfo.grupo_id) {
          const { data: grp } = await supabase
            .from('agenda_grupos')
            .select('id, dados')
            .eq('id', convInfo.grupo_id)
            .maybeSingle()
          targetGrupo = grp
        } else if (convInfo.turma_id) {
          const cleanTId = String(convInfo.turma_id).replace(/^sync-/, '')
          const { data: grp } = await supabase
            .from('agenda_grupos')
            .select('id, dados')
            .or(`dados->>syncId.eq."${convInfo.turma_id}",dados->>turma_id.eq."${convInfo.turma_id}",dados->>syncId.eq."${cleanTId}",dados->>turma_id.eq."${cleanTId}"`)
            .maybeSingle()
          targetGrupo = grp
        }

        const colabIds = Array.isArray(targetGrupo?.dados?.colaboradoresIds)
          ? targetGrupo.dados.colaboradoresIds.map(String)
          : []
        const isLinkedToThisTurma = userCandidateIds.some(uid => colabIds.includes(uid)) || !!targetGrupo?.dados?.isGlobalAccess

        if (!isLinkedToThisTurma) {
          return NextResponse.json(
            { error: 'Você só pode enviar mensagens na turma em que está vinculado(a). Membros da equipe escolar podem enviar em qualquer turma.' },
            { status: 403 }
          )
        }
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

    // Verificações de Regras e Horário para Famílias
    try {
      const { getChatAutoConfig, isWithinBusinessHours } = await import('@/lib/server/chatAutoResponder')
      const autoConfig = await getChatAutoConfig()

      // 1. Bloqueio de conversas diretas com colaborador para famílias quando desativado pela escola
      if (convInfo?.type === 'direct' && isFamilySender && autoConfig.recursos?.permitirConversaColaborador === false) {
        return NextResponse.json(
          {
            error: 'O envio de mensagens diretas para colaboradores e professores está temporariamente desativado pela administração escolar.'
          },
          { status: 403 }
        )
      }

      // 2. Se o admin configurou "Pausar Envio Fora do Horário", bloqueia o envio das famílias fora do expediente
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
    } catch (errCheckRules) {
      console.error('[ChatMessagesRoute] Erro ao checar regras do chat:', errCheckRules)
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
      // Se for mensagem de grupo, garantir que o membro da equipe escolar esteja registrado como participante
      if (convInfo?.type === 'group') {
        await supabase
          .from('chat_participants')
          .upsert({
            conversation_id,
            user_id: senderId,
            user_name: senderName,
            user_perfil: senderPerfil,
            user_role: 'admin',
            unread_count: 0,
            last_read_at: new Date().toISOString()
          }, { onConflict: 'conversation_id,user_id' })
      }

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
      .select('id, auth_id, nome, cargo, perfil, dados')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    const perfilUser = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargoUser = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfilUser, cargoUser)
    const isColabOrTeacher = checkIsCollaboratorOrTeacher(cargoUser, perfilUser, dbUser || user)

    // Regra: Apenas colaboradores, professores e administradores podem excluir mensagens. Famílias e alunos não podem.
    if (!isColabOrTeacher && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas colaboradores e professores podem excluir mensagens.' },
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

    // 3. Regra de autorização para exclusão:
    // Candidatos de ID do usuário autenticado para comparar com sender_id
    const myCandidateIds = Array.from(new Set([
      String(user.id),
      dbUser?.id ? String(dbUser.id) : null,
      dbUser?.auth_id ? String(dbUser.auth_id) : null,
      dbUser?.dados?.colaborador_id ? String(dbUser.dados.colaborador_id) : null,
      (user as any)?.user_metadata?.colaborador_id ? String((user as any).user_metadata.colaborador_id) : null,
      searchParams.get('espelhar_colaborador')
    ].filter(Boolean))) as string[]

    const isMyMessage = myCandidateIds.includes(String(targetMsg.sender_id))

    // Se não for master admin, o professor/colaborador só pode excluir a sua própria mensagem
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
