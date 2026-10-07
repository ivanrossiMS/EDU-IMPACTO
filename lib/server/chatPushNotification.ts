/**
 * chatPushNotification.ts — Serviço Especializado de Notificações Push para o Chat
 *
 * Responsabilidades:
 * 1. Resolução inteligente de destinatários para grupos de turma e mensagens diretas
 * 2. Formatação humanizada de títulos, previews e ícones
 * 3. Deep Linking específico por perfil (Família vs Colaborador)
 * 4. Agrupamento (collapseId) para evitar sobrecarga de alertas no celular
 * 5. Respeito integral às novas regras:
 *    - Famílias/Alunos nunca são bloqueados por left_at
 *    - Colaboradores que saíram do grupo (left_at !== null) NÃO recebem push
 *    - Respeita participantes que silenciaram (is_muted) ou desativaram notificações
 *    - Respeita configuração global ad_config.notificacoes.pushMensagemChat
 */

import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { sendPushNotification } from '@/lib/server/pushService'
import { getResponsavelIdsForTargets, getColaboradorIds } from '@/lib/server/notificationHelper'
import { checkIsCollaboratorOrTeacher } from '@/lib/chatPermissions'

export interface DispatchChatPushParams {
  conversationId: string
  messageId: string
  senderId: string
  senderName: string
  senderPerfil?: string
  content: string
  contentType: 'text' | 'image' | 'video' | 'file' | 'audio' | 'system'
  metadata?: any
}

export async function dispatchChatPushNotification({
  conversationId,
  messageId,
  senderId,
  senderName,
  senderPerfil,
  content,
  contentType,
  metadata = {}
}: DispatchChatPushParams): Promise<{ success: boolean; reason?: string }> {
  try {
    const supabase = getAdminClient()

    // 0. Verificar se as notificações estão pausadas globalmente no sistema
    try {
      const { isPushNotificationsPaused } = await import('@/lib/server/pushPauseService')
      if (await isPushNotificationsPaused()) {
        console.log(`[ChatPush][${conversationId}] ⏸️ Notificações push estão pausadas globalmente. Push de chat cancelado e não será reenviado.`)
        return { success: true, reason: 'notifications_paused' }
      }
    } catch (e) {
      console.warn(`[ChatPush][${conversationId}] Aviso ao verificar pausa:`, e)
    }

    // 1. Verificar configuração global do sistema (ad_config)
    try {
      const { data: configRow } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'ad_config')
        .maybeSingle()

      if (configRow?.valor?.notificacoes?.pushMensagemChat === false) {
        console.log(`[ChatPush][${conversationId}] Push de chat está desativado em ad_config. Abortando.`)
        return { success: true, reason: 'disabled_by_config' }
      }
    } catch (e) {
      console.warn(`[ChatPush][${conversationId}] Aviso ao ler ad_config:`, e)
    }

    // 1.1 Ignorar mensagens automáticas de sistema
    if (contentType === 'system') {
      console.log(`[ChatPush][${conversationId}] Mensagem de sistema ignorada para disparo de push.`)
      return { success: true, reason: 'system_message_ignored' }
    }

    // 2. Buscar detalhes da conversa
    const { data: conv, error: errConv } = await supabase
      .from('chat_conversations')
      .select('id, type, title, turma_id, grupo_id, aluno_id, is_muted_global')
      .eq('id', conversationId)
      .maybeSingle()

    if (errConv || !conv) {
      console.warn(`[ChatPush][${conversationId}] Conversa não encontrada para disparo de push.`)
      return { success: false, reason: 'conversation_not_found' }
    }

    // 2.1 Respeitar silenciamento global da conversa
    if (conv.is_muted_global) {
      console.log(`[ChatPush][${conversationId}] Conversa está silenciada globalmente. Abortando envio de push.`)
      return { success: true, reason: 'conversation_muted_global' }
    }

    // 3. Resolver todos os identificadores possíveis do remetente para nunca enviar push para si mesmo
    const senderCandidateIds = new Set<string>([String(senderId)])
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(senderId))
    const isNumeric = /^\d+$/.test(String(senderId))
    const isEmail = String(senderId).includes('@')

    try {
      if (isUuid) {
        const { data: su } = await supabase
          .from('system_users')
          .select('id, auth_id, email, dados')
          .or(`id.eq.${senderId},auth_id.eq.${senderId}`)
          .maybeSingle()

        if (su) {
          if (su.id) senderCandidateIds.add(String(su.id))
          if (su.auth_id) senderCandidateIds.add(String(su.auth_id))
          if (su.email) senderCandidateIds.add(su.email.toLowerCase().trim())
          if (su.dados?.colaborador_id) senderCandidateIds.add(String(su.dados.colaborador_id))
          if (su.dados?.responsavel_id) senderCandidateIds.add(String(su.dados.responsavel_id))
          if (su.dados?.aluno_id) senderCandidateIds.add(String(su.dados.aluno_id))
        }
      } else if (isNumeric) {
        const { data: resp } = await supabase
          .from('responsaveis')
          .select('id, email')
          .eq('id', senderId)
          .maybeSingle()

        if (resp?.email) senderCandidateIds.add(resp.email.toLowerCase().trim())

        const { data: suList } = await supabase
          .from('system_users')
          .select('id, auth_id, email, dados')
          .or(`dados->>responsavel_id.eq.${senderId},dados->>colaborador_id.eq.${senderId},dados->>aluno_id.eq.${senderId}`)

        suList?.forEach((su: any) => {
          if (su.id) senderCandidateIds.add(String(su.id))
          if (su.auth_id) senderCandidateIds.add(String(su.auth_id))
          if (su.email) senderCandidateIds.add(su.email.toLowerCase().trim())
          if (su.dados?.colaborador_id) senderCandidateIds.add(String(su.dados.colaborador_id))
          if (su.dados?.responsavel_id) senderCandidateIds.add(String(su.dados.responsavel_id))
          if (su.dados?.aluno_id) senderCandidateIds.add(String(su.dados.aluno_id))
        })
      } else if (isEmail) {
        const cleanEmail = String(senderId).toLowerCase().trim()
        senderCandidateIds.add(cleanEmail)
        const { data: suList } = await supabase
          .from('system_users')
          .select('id, auth_id, email, dados')
          .eq('email', cleanEmail)

        suList?.forEach((su: any) => {
          if (su.id) senderCandidateIds.add(String(su.id))
          if (su.auth_id) senderCandidateIds.add(String(su.auth_id))
          if (su.dados?.colaborador_id) senderCandidateIds.add(String(su.dados.colaborador_id))
          if (su.dados?.responsavel_id) senderCandidateIds.add(String(su.dados.responsavel_id))
        })
      }
    } catch (e) {
      console.warn('[ChatPush] Aviso ao resolver senderCandidateIds:', e)
    }

    // 4. Buscar participantes registrados para capturar mute, bloqueios, left_at e nomes
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('user_id, user_name, is_muted, notifications_enabled, is_blocked, left_at, user_perfil')
      .eq('conversation_id', conversationId)

    const mutedOrBlockedUserIds = new Set<string>()
    const leftColabUserIds = new Set<string>()
    let directRecipientName = ''

    if (participants && participants.length > 0) {
      for (const p of participants) {
        const uid = String(p.user_id)
        if (p.is_muted || p.notifications_enabled === false || p.is_blocked) {
          mutedOrBlockedUserIds.add(uid)
        }
        // Respeito rigoroso à nova regra: apenas colaboradores podem ter status de saída legítimo
        if (p.left_at) {
          const isColab = checkIsCollaboratorOrTeacher(p.user_perfil || '', p.user_perfil || '')
          if (isColab) {
            leftColabUserIds.add(uid)
          }
        }
        // Em conversa direta, identificar o nome legível do outro participante
        if (conv.type !== 'group' && !senderCandidateIds.has(uid) && p.user_name) {
          directRecipientName = p.user_name
        }
      }
    }

    // 5. Formatar Título e Mensagem Humanizados
    const cleanSenderName = senderName || 'Novo recado'
    let pushTitle = ''
    let pushBody = ''

    if (conv.type === 'group') {
      pushTitle = `💬 ${conv.title || 'Mural da Turma'}`

      switch (contentType) {
        case 'image':
          pushBody = `📷 ${cleanSenderName} enviou uma foto`
          break
        case 'video':
          pushBody = `🎥 ${cleanSenderName} enviou um vídeo`
          break
        case 'file':
          pushBody = `📄 ${cleanSenderName} enviou um arquivo${metadata?.file_name ? `: ${metadata.file_name}` : ''}`
          break
        case 'audio':
          pushBody = `🎤 ${cleanSenderName} enviou uma mensagem de voz`
          break
        default:
          pushBody = `${cleanSenderName}: ${(content || '').trim().slice(0, 110)}`
          break
      }
    } else {
      // Conversa Direta
      const senderRoleSuffix = senderPerfil && !['aluno', 'responsável', 'responsavel', 'família', 'familia'].includes(senderPerfil.toLowerCase())
        ? ` • ${senderPerfil}`
        : ''
      pushTitle = `💬 ${cleanSenderName}${senderRoleSuffix}`

      switch (contentType) {
        case 'image':
          pushBody = `📷 Foto recebida`
          break
        case 'video':
          pushBody = `🎥 Vídeo recebido`
          break
        case 'file':
          pushBody = `📄 Arquivo recebido${metadata?.file_name ? `: ${metadata.file_name}` : ''}`
          break
        case 'audio':
          pushBody = `🎤 Mensagem de voz recebida`
          break
        default:
          pushBody = (content || '').trim().slice(0, 120)
          break
      }
    }

    // 6. Resolução dos Destinatários Segmentados
    const familyTargetIds = new Set<string>()
    const colabTargetIds = new Set<string>()

    if (conv.type === 'group') {
      // A) Obter Turma e Grupo correspondentes
      const targetTurmas: string[] = []
      if (conv.turma_id) targetTurmas.push(String(conv.turma_id))

      let grupoColabIds: string[] = []
      if (conv.grupo_id) {
        const { data: grp } = await supabase
          .from('agenda_grupos')
          .select('id, dados')
          .eq('id', conv.grupo_id)
          .maybeSingle()

        if (grp?.dados?.turma_id) targetTurmas.push(String(grp.dados.turma_id))
        if (grp?.dados?.syncId) targetTurmas.push(String(grp.dados.syncId))
        if (grp?.dados?.nome) targetTurmas.push(String(grp.dados.nome))

        if (Array.isArray(grp?.dados?.colaboradoresIds)) {
          grupoColabIds = grp.dados.colaboradoresIds.map(String)
        }
      }

      // B) Mural da Turma: Buscar TODOS os responsáveis e TODOS os alunos da turma
      if (targetTurmas.length > 0) {
        const respIds = await getResponsavelIdsForTargets({ turmas: targetTurmas })
        respIds.forEach(id => {
          if (id && !senderCandidateIds.has(String(id)) && !mutedOrBlockedUserIds.has(String(id))) {
            familyTargetIds.add(String(id))
          }
        })
      }

      // C) Buscar colaboradores vinculados à turma
      if (grupoColabIds.length > 0) {
        const resolvedColabIds = await getColaboradorIds(grupoColabIds)
        resolvedColabIds.forEach(id => {
          if (
            id &&
            !senderCandidateIds.has(String(id)) &&
            !mutedOrBlockedUserIds.has(String(id)) &&
            !leftColabUserIds.has(String(id))
          ) {
            colabTargetIds.add(String(id))
          }
        })
      }

      // D) Incluir participantes já registrados em chat_participants para este grupo
      if (participants && participants.length > 0) {
        for (const p of participants) {
          const uid = String(p.user_id)
          if (senderCandidateIds.has(uid) || mutedOrBlockedUserIds.has(uid)) continue

          const isStaff = checkIsCollaboratorOrTeacher(p.user_perfil || '', p.user_perfil || '')
          if (isStaff) {
            if (!leftColabUserIds.has(uid)) {
              colabTargetIds.add(uid)
            }
          } else {
            familyTargetIds.add(uid)
          }
        }
      }
    } else {
      // Conversa Direta (1 a 1): estritamente e exclusivamente o participante selecionado!
      // NUNCA buscar outros responsáveis da tabela aluno_responsavel e NUNCA adicionar outros parentes!
      if (participants && participants.length > 0) {
        for (const p of participants) {
          const uid = String(p.user_id)
          if (senderCandidateIds.has(uid) || mutedOrBlockedUserIds.has(uid)) continue

          const isStaff = checkIsCollaboratorOrTeacher(p.user_perfil || '', p.user_perfil || '')
          if (isStaff) {
            colabTargetIds.add(uid)
          } else {
            familyTargetIds.add(uid)
          }
        }
      }
    }

    // Expandir aliases (auth_id, email, responsavel_id) EXCLUSIVAMENTE para os destinatários selecionados
    if (familyTargetIds.size > 0) {
      const familyArr = Array.from(familyTargetIds)
      const numericRespIds = familyArr.filter(id => /^\d+$/.test(id))

      if (numericRespIds.length > 0) {
        try {
          const { data: respRows } = await supabase
            .from('responsaveis')
            .select('id, email')
            .in('id', numericRespIds)

          const emails = (respRows || []).map(r => r.email?.toLowerCase().trim()).filter(Boolean)
          emails.forEach(e => familyTargetIds.add(e))

          if (emails.length > 0) {
            const { data: sysUsers } = await supabase
              .from('system_users')
              .select('id, auth_id, email')
              .in('email', emails)

            sysUsers?.forEach(su => {
              if (su.id) familyTargetIds.add(String(su.id))
              if (su.auth_id) familyTargetIds.add(String(su.auth_id))
            })

            // Buscar auth.users exclusivamente por email ou responsavel_id específico dos numericRespIds
            try {
              const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
              authList?.users?.forEach(au => {
                if (au.email && emails.includes(au.email.toLowerCase().trim())) {
                  familyTargetIds.add(String(au.id))
                }
                const rId = au.user_metadata?.responsavel_id
                if (rId && numericRespIds.includes(String(rId))) {
                  familyTargetIds.add(String(au.id))
                }
              })
            } catch (_) {}
          }
        } catch (e) {
          console.warn('[ChatPush] Aviso ao enriquecer aliases familiares:', e)
        }
      }
    }

    if (colabTargetIds.size > 0) {
      const colabArr = Array.from(colabTargetIds)
      try {
        const { data: colabUsers } = await supabase
          .from('system_users')
          .select('id, auth_id, email')
          .or(`id.in.(${colabArr.map(c => `"${c}"`).join(',')}),auth_id.in.(${colabArr.map(c => `"${c}"`).join(',')})`)

        colabUsers?.forEach(cu => {
          if (cu.id) colabTargetIds.add(String(cu.id))
          if (cu.auth_id) colabTargetIds.add(String(cu.auth_id))
          if (cu.email) colabTargetIds.add(cu.email.toLowerCase().trim())
        })
      } catch (e) {
        console.warn('[ChatPush] Aviso ao enriquecer aliases colaboradores:', e)
      }
    }

    // Garantir que nenhum identificador do remetente receba o push
    senderCandidateIds.forEach(sid => {
      familyTargetIds.delete(sid)
      colabTargetIds.delete(sid)
    })

    // 7. Disparo em Paralelo com Deep Linking Específico por Contexto
    const pushPromises: Promise<any>[] = []
    const collapseId = `chat_${conversationId}`
    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu.net').replace(/\/$/, '')

    // Envio para Famílias (abre no modo família com a conversa e o aluno)
    const finalFamilyIds = Array.from(familyTargetIds)
    if (finalFamilyIds.length > 0) {
      let resolvedFamilyAlunoId = conv.aluno_id
      if (!resolvedFamilyAlunoId) {
        try {
          const numericRespIds = finalFamilyIds.filter(id => /^\d+$/.test(id))
          if (numericRespIds.length > 0) {
            const { data: vincRows } = await supabase
              .from('aluno_responsavel')
              .select('aluno_id')
              .in('responsavel_id', numericRespIds)
              .order('created_at', { ascending: true })
              .limit(1)

            if (vincRows && vincRows.length > 0 && vincRows[0].aluno_id) {
              resolvedFamilyAlunoId = String(vincRows[0].aluno_id)
            }
          }
        } catch (e) {
          console.warn('[ChatPush] Aviso ao resolver aluno para URL familiar:', e)
        }
      }

      const turmaParam = conv.turma_id ? `&turma_id=${encodeURIComponent(conv.turma_id)}` : ''
      const familyUrl = resolvedFamilyAlunoId
        ? `${appBaseUrl}/agenda-digital/${resolvedFamilyAlunoId}/comunicados?conversation_id=${conversationId}`
        : `${appBaseUrl}/agenda-digital/selecionar-aluno?redirect=comunicados&conversation_id=${conversationId}${turmaParam}`

      const targetTag = conv.type === 'group'
        ? `turma_${conv.turma_id || 'geral'}`
        : `resp_${finalFamilyIds[0] || 'direto'}`
      const familyItemId = `chat_${conversationId}_${targetTag}_msg_${messageId}_familia`

      const familyPromise = (async () => {
        try {
          const pushRes = await sendPushNotification({
            title: pushTitle,
            body: pushBody,
            targetUserIds: finalFamilyIds,
            collapseId,
            url: familyUrl,
            data: {
              type: 'chat',
              rota: 'comunicados',
              conversation_id: conversationId,
              message_id: messageId,
              aluno_id: resolvedFamilyAlunoId || null,
              turma_id: conv.turma_id || null,
              context: 'familia'
            }
          })

          // Registrar no Histórico & Auditoria de Disparos (agenda_push_logs)
          try {
            const logStatus = pushRes.success ? 'sent' : 'failed'
            const logErrorMsg = pushRes.mock
              ? 'Mock mode: credenciais OneSignal não configuradas (push simulado)'
              : (pushRes.success ? null : (pushRes.error || 'Erro no envio do push'))

            const responsePayloadObj = {
              ...(pushRes.data && typeof pushRes.data === 'object' ? pushRes.data : { raw: pushRes.data }),
              _target_user_ids: finalFamilyIds,
              _metadata: {
                conversation_id: conversationId,
                message_id: messageId,
                conversation_type: conv.type,
                aluno_id: conv.aluno_id || null,
                turma_id: conv.turma_id || null,
                conversation_title: conv.title || directRecipientName || null,
                recipient_name: conv.type === 'group' ? (conv.title || 'Mural da Turma') : (directRecipientName || conv.title || 'Destinatário'),
                sender_id: senderId,
                sender_name: cleanSenderName,
                sender_perfil: senderPerfil || null,
                perfil_destino: 'familia',
                target_url: familyUrl
              }
            }

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(senderId))

            await supabase
              .from('agenda_push_logs')
              .upsert({
                user_id: isUuid ? String(senderId) : null,
                type: 'chat',
                item_id: familyItemId,
                title: pushTitle,
                message: pushBody,
                target_url: familyUrl,
                target_count: pushRes.recipients || finalFamilyIds.length,
                status: logStatus,
                error_message: logErrorMsg,
                onesignal_response: JSON.stringify(responsePayloadObj),
                created_at: new Date().toISOString()
              }, {
                onConflict: 'item_id,type',
                ignoreDuplicates: true
              })
          } catch (logErr: any) {
            console.warn(`[ChatPush] Erro ao gravar log de auditoria família:`, logErr?.message)
          }

          return pushRes
        } catch (err) {
          console.error(`[ChatPush] Erro ao enviar push para famílias:`, err)
          return null
        }
      })()

      pushPromises.push(familyPromise)
    }

    // Envio para Colaboradores (abre no modo colaborador)
    const finalColabIds = Array.from(colabTargetIds)
    if (finalColabIds.length > 0) {
      const colabUrl = `${appBaseUrl}/agenda-digital/colaborador/comunicados?conversation_id=${conversationId}`
      const colabItemId = `chat_${conversationId}_msg_${messageId}_colaborador`

      const colabPromise = (async () => {
        try {
          const pushRes = await sendPushNotification({
            title: pushTitle,
            body: pushBody,
            targetUserIds: finalColabIds,
            collapseId,
            url: colabUrl,
            data: {
              type: 'chat',
              rota: 'comunicados',
              conversation_id: conversationId,
              message_id: messageId,
              turma_id: conv.turma_id || null,
              context: 'colaborador'
            }
          })

          // Registrar no Histórico & Auditoria de Disparos (agenda_push_logs)
          try {
            const logStatus = pushRes.success ? 'sent' : 'failed'
            const logErrorMsg = pushRes.mock
              ? 'Mock mode: credenciais OneSignal não configuradas (push simulado)'
              : (pushRes.success ? null : (pushRes.error || 'Erro no envio do push'))

            const responsePayloadObj = {
              ...(pushRes.data && typeof pushRes.data === 'object' ? pushRes.data : { raw: pushRes.data }),
              _target_user_ids: finalColabIds,
              _metadata: {
                conversation_id: conversationId,
                message_id: messageId,
                conversation_type: conv.type,
                turma_id: conv.turma_id || null,
                conversation_title: conv.title || directRecipientName || null,
                recipient_name: conv.type === 'group' ? (conv.title || 'Mural da Turma') : (directRecipientName || 'Equipe Escolar'),
                sender_id: senderId,
                sender_name: cleanSenderName,
                sender_perfil: senderPerfil || null,
                perfil_destino: 'colaborador',
                target_url: colabUrl
              }
            }

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(senderId))

            await supabase
              .from('agenda_push_logs')
              .upsert({
                user_id: isUuid ? String(senderId) : null,
                type: 'chat',
                item_id: colabItemId,
                title: pushTitle,
                message: pushBody,
                target_url: colabUrl,
                target_count: pushRes.recipients || finalColabIds.length,
                status: logStatus,
                error_message: logErrorMsg,
                onesignal_response: JSON.stringify(responsePayloadObj),
                created_at: new Date().toISOString()
              }, {
                onConflict: 'item_id,type',
                ignoreDuplicates: true
              })
          } catch (logErr: any) {
            console.warn(`[ChatPush] Erro ao gravar log de auditoria colaborador:`, logErr?.message)
          }

          return pushRes
        } catch (err) {
          console.error(`[ChatPush] Erro ao enviar push para colaboradores:`, err)
          return null
        }
      })()

      pushPromises.push(colabPromise)
    }

    if (pushPromises.length > 0) {
      await Promise.allSettled(pushPromises)
      console.log(`[ChatPush][${conversationId}] Pushes disparados: ${finalFamilyIds.length} famílias, ${finalColabIds.length} colaboradores.`)
    } else {
      console.log(`[ChatPush][${conversationId}] Nenhum destinatário elegível para push.`)
    }

    return { success: true }
  } catch (err: any) {
    console.error(`[ChatPush] Erro geral ao despachar push de chat:`, err)
    return { success: false, reason: err.message }
  }
}
