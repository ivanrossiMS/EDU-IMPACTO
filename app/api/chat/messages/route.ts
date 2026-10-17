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
      .order('created_at', { ascending: false })
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

    const rawEspelharResp = searchParams.get('espelhar_responsavel')
    const rawEspelharColab = searchParams.get('espelhar_colaborador')
    const rawEspelharAluno = searchParams.get('espelhar_aluno') === 'true'

    if (!isAdmin && (rawEspelharResp || rawEspelharColab || rawEspelharAluno)) {
      return NextResponse.json(
        { error: 'Acesso negado: apenas administradores podem espelhar usuários.' },
        { status: 403 }
      )
    }

    const espelharResp = isAdmin ? rawEspelharResp : null
    const espelharColab = isAdmin ? rawEspelharColab : null

    let hasLeft = false
    let effectiveLeftAt: string | null = null
    let finalMessages = (messagesRes.data || []).slice().reverse()

    // Verificação de privacidade para conversa direta (1 a 1):
    // Apenas participantes registrados (ou administradores com acesso institucional) podem visualizar mensagens
    if (convInfo?.type === 'direct' && !isAdmin) {
      const { resolveFamilyScope } = await import('@/lib/server/chatFamilyHelper')
      const familyScope = await resolveFamilyScope(user, { dbUser, espelharRespId: espelharResp, espelharColabId: espelharColab })
      const userCandidateIds = Array.from(new Set([
        String(user.id),
        dbUser?.id ? String(dbUser.id) : null,
        dbUser?.auth_id ? String(dbUser.auth_id) : null,
        user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : null,
        dbUser?.dados?.responsavel_id ? String(dbUser.dados.responsavel_id) : null,
        dbUser?.dados?.colaborador_id ? String(dbUser.dados.colaborador_id) : null,
        ...(familyScope.candidateUserIds || []),
        espelharResp,
        espelharColab,
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
        espelharColab
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
      const { resolveFamilyScope } = await import('@/lib/server/chatFamilyHelper')
      const familyScope = await resolveFamilyScope(user, {
        alunoIdParam: searchParams.get('aluno_id'),
        context: 'familia',
        dbUser
      })

      const userCandidateIds = Array.from(new Set([
        user.id,
        dbUser?.id,
        espelharResp,
        ...(familyScope.candidateUserIds || [])
      ].filter(Boolean))) as string[]

      // 1. Checa se o participante está registrado ou se o grupo pertence ao escopo familiar
      const { data: myParts } = await supabase
        .from('chat_participants')
        .select('id, left_at')
        .eq('conversation_id', conversationId)
        .in('user_id', userCandidateIds)
        .order('left_at', { ascending: false })

      const myPartWithLeft = (myParts || []).find((p: any) => p.left_at)
      let belongsToFamilyGroup = Boolean(myParts && myParts.length > 0)

      if (myPartWithLeft?.left_at) {
        hasLeft = true
        effectiveLeftAt = myPartWithLeft.left_at
      }

      try {
        const rawGId = convInfo.grupo_id ? String(convInfo.grupo_id) : ''
        const rawTId = convInfo.turma_id ? String(convInfo.turma_id) : ''
        const cleanTId = rawTId.replace(/^sync-/, '')

        if (
          (rawGId && familyScope.allGroupIds.has(rawGId)) ||
          (rawTId && (familyScope.allTurmaIds.has(rawTId) || familyScope.allGroupIds.has(rawTId))) ||
          (cleanTId && (familyScope.allTurmaIds.has(cleanTId) || familyScope.allGroupIds.has(cleanTId)))
        ) {
          belongsToFamilyGroup = true
        }

        const histInfo = 
          (rawGId ? familyScope.historicalGroupIds.get(rawGId) : null) ||
          (rawTId ? familyScope.historicalGroupIds.get(rawTId) : null) ||
          (cleanTId ? familyScope.historicalGroupIds.get(cleanTId) : null)

        if (histInfo) {
          belongsToFamilyGroup = true
          if (!hasLeft) {
            hasLeft = true
            effectiveLeftAt = histInfo.dataSaida || null
          }
        }
      } catch (e) {
        console.error('[Chat Messages] Error resolving historical group for family:', e)
      }

      if (!belongsToFamilyGroup) {
        return NextResponse.json(
          { error: 'Acesso negado: você não participa deste grupo.' },
          { status: 403 }
        )
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
      .select('id, auth_id, nome, cargo, perfil, dados')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser

    const perfilUser = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargoUser = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfilUser, cargoUser)

    // Validar overrideSenderId para evitar falsificação de identidade por usuários não-admin
    if (overrideSenderId && !isAdmin) {
      const legitimateIds = new Set<string>(
        [
          String(user.id),
          dbUser?.id ? String(dbUser.id) : null,
          dbUser?.auth_id ? String(dbUser.auth_id) : null,
          user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : null,
          user.user_metadata?.aluno_id ? String(user.user_metadata.aluno_id) : null,
          user.user_metadata?.colaborador_id ? String(user.user_metadata.colaborador_id) : null,
          user.user_metadata?.system_user_id ? String(user.user_metadata.system_user_id) : null,
          user.user_metadata?.uid_legacy ? String(user.user_metadata.uid_legacy) : null,
          dbUser?.dados?.responsavel_id ? String(dbUser.dados.responsavel_id) : null,
          dbUser?.dados?.colaborador_id ? String(dbUser.dados.colaborador_id) : null,
          dbUser?.dados?.aluno_id ? String(dbUser.dados.aluno_id) : null,
        ].filter(Boolean) as string[]
      )

      if (!legitimateIds.has(String(overrideSenderId))) {
        try {
          const { resolveFamilyScope } = await import('@/lib/server/chatFamilyHelper')
          const familyScope = await resolveFamilyScope(user, { context: 'familia', dbUser })
          for (const cid of familyScope.candidateUserIds || []) {
            legitimateIds.add(String(cid))
          }
        } catch {}
      }

      if (!legitimateIds.has(String(overrideSenderId))) {
        return NextResponse.json(
          { error: 'Acesso negado: o sender_id informado não pertence ao usuário autenticado.' },
          { status: 403 }
        )
      }
    }

    const senderId = overrideSenderId || dbUser?.id || user.id
    const senderName = overrideSenderName || dbUser?.nome || user.user_metadata?.nome || user.email || 'Usuário'
    const senderPerfil = overrideSenderPerfil || dbUser?.cargo || dbUser?.perfil || user.user_metadata?.perfil || 'Usuário'

    // 1.1 Buscar detalhes da conversa para validação de permissões
    let { data: convInfo } = await supabase
      .from('chat_conversations')
      .select('id, type, grupo_id, turma_id, title')
      .eq('id', conversation_id)
      .maybeSingle()

    // Se a conversa não existir no banco (era um rascunho), criar a conversa agora que a primeira mensagem está sendo enviada
    if (!convInfo) {
      const draftData = body.draft_data || {}
      const convType = draftData.type || 'direct'
      const convTitle = draftData.title || draftData.targetUserName || (convType === 'group' ? 'Grupo Escolar' : 'Conversa Direta')
      const convAlunoId = draftData.alunoId || null
      const convTurmaId = draftData.turmaId || null
      const convGrupoId = draftData.grupoId || null
      const targetUserId = draftData.targetUserId
      const targetUserName = draftData.targetUserName || 'Contato'
      const targetUserPerfil = draftData.targetUserPerfil || 'Colaborador'

      const msgPreview = (content || (content_type === 'image' ? '📷 Foto' : content_type === 'video' ? '🎥 Vídeo' : content_type === 'file' ? '📄 Arquivo' : 'Mensagem')).substring(0, 100)

      const { data: createdConv, error: errCreateConv } = await supabase
        .from('chat_conversations')
        .insert({
          id: conversation_id,
          type: convType,
          title: convTitle,
          created_by: senderId,
          aluno_id: convAlunoId,
          turma_id: convTurmaId,
          grupo_id: convGrupoId,
          last_message_text: msgPreview,
          last_message_at: new Date().toISOString(),
          last_message_by: senderId,
          message_count: 0
        })
        .select('id, type, grupo_id, turma_id, title')
        .single()

      if (errCreateConv) {
        console.error('[POST /api/chat/messages] Erro ao criar conversa no primeiro envio:', errCreateConv)
        throw errCreateConv
      }

      convInfo = createdConv

      // Inserir participantes da conversa
      if (convType === 'group') {
        await supabase
          .from('chat_participants')
          .insert({
            conversation_id: conversation_id,
            user_id: senderId,
            user_name: senderName,
            user_perfil: senderPerfil,
            user_role: 'admin'
          })

        const { syncTurmaParticipants } = await import('@/lib/server/chatGroupMembership')
        await syncTurmaParticipants(supabase, conversation_id, convGrupoId, convTurmaId)
      } else {
        const partsToInsert = [
          {
            conversation_id: conversation_id,
            user_id: senderId,
            user_name: senderName,
            user_perfil: senderPerfil,
            user_role: 'admin'
          }
        ]
        if (targetUserId) {
          partsToInsert.push({
            conversation_id: conversation_id,
            user_id: targetUserId,
            user_name: targetUserName,
            user_perfil: targetUserPerfil,
            user_role: 'member'
          })
        }
        await supabase
          .from('chat_participants')
          .insert(partsToInsert)
      }
    }

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
        const nowUpdateIso = new Date().toISOString()
        await Promise.all(
          otherParticipants.map((part: any) =>
            supabase
              .from('chat_participants')
              .update({
                unread_count: (part.unread_count || 0) + 1,
                updated_at: nowUpdateIso
              })
              .eq('id', part.id)
          )
        )
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
      isAdmin ? searchParams.get('espelhar_colaborador') : null
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

      if (!latestRemaining) {
        // Se não restou nenhuma mensagem ativa na conversa:
        // Quando não houver mensagem enviada, não deve guardar a conversa!
        await Promise.all([
          supabase.from('chat_participants').delete().eq('conversation_id', targetMsg.conversation_id),
          supabase.from('chat_read_receipts').delete().eq('conversation_id', targetMsg.conversation_id),
          supabase.from('chat_conversations').delete().eq('id', targetMsg.conversation_id)
        ])
      } else {
        await supabase
          .from('chat_conversations')
          .update({
            last_message_at: latestRemaining.created_at,
            last_message_text: (latestRemaining.content || '').substring(0, 100),
            last_message_by: latestRemaining.sender_id || null,
            updated_at: nowIso
          })
          .eq('id', targetMsg.conversation_id)
      }
    } catch (e) {
      console.warn('Erro ao atualizar last_message da conversa após exclusão:', e)
    }

    return NextResponse.json({ success: true, message: updatedMsg })

  } catch (err: any) {
    console.error('Erro ao excluir mensagem:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
