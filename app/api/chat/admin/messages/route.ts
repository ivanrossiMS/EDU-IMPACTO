import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { checkIsAdmin } from '@/lib/chatPermissions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()

    const { data: dbUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso restrito à administração escolar.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversation_id')

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id é obrigatório' }, { status: 400 })
    }

    const [convRes, messagesRes, participantsRes] = await Promise.all([
      supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle(),
      supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      supabase
        .from('chat_participants')
        .select('*')
        .eq('conversation_id', conversationId)
    ])

    if (convRes.error) throw convRes.error
    if (!convRes.data) {
      return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
    }

    return NextResponse.json({
      conversation: convRes.data,
      messages: messagesRes.data || [],
      participants: participantsRes.data || []
    })

  } catch (err: any) {
    console.error('[GET /api/chat/admin/messages] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()

    const { data: dbUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso restrito à administração escolar.' }, { status: 403 })
    }

    const body = await request.json()
    const { message_id, new_content, reason } = body

    if (!message_id || !new_content || !new_content.trim()) {
      return NextResponse.json({ error: 'message_id e new_content são obrigatórios' }, { status: 400 })
    }

    const { data: currentMsg, error: errFetch } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', message_id)
      .maybeSingle()

    if (errFetch || !currentMsg) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    const adminName = dbUser?.nome || user.user_metadata?.nome || user.email || 'Administrador'
    const nowIso = new Date().toISOString()

    const currentMeta = currentMsg.metadata || {}
    const existingHistory = Array.isArray(currentMeta.audit_history) ? currentMeta.audit_history : []

    const updatedAuditHistory = [
      ...existingHistory,
      {
        previous_content: currentMsg.content,
        edited_content: new_content.trim(),
        edited_at: nowIso,
        edited_by: adminName,
        reason: reason || 'Edição administrativa'
      }
    ]

    const updatedMetadata = {
      ...currentMeta,
      is_edited_by_admin: true,
      last_edited_by: adminName,
      last_edited_at: nowIso,
      audit_history: updatedAuditHistory
    }

    const { data: updatedMsg, error: errUpdate } = await supabase
      .from('chat_messages')
      .update({
        content: new_content.trim(),
        is_edited: true,
        edited_at: nowIso,
        edited_by: adminName,
        metadata: updatedMetadata,
        updated_at: nowIso
      })
      .eq('id', message_id)
      .select()
      .single()

    if (errUpdate) throw errUpdate

    // Se for a última mensagem da conversa, atualiza o preview da conversa
    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('id, last_message_at')
      .eq('id', currentMsg.conversation_id)
      .maybeSingle()

    if (conv) {
      const { data: latestMsg } = await supabase
        .from('chat_messages')
        .select('id, content, created_at')
        .eq('conversation_id', currentMsg.conversation_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestMsg && latestMsg.id === message_id) {
        await supabase
          .from('chat_conversations')
          .update({
            last_message_text: new_content.trim().substring(0, 100),
            updated_at: nowIso
          })
          .eq('id', currentMsg.conversation_id)
      }
    }

    return NextResponse.json({ success: true, message: updatedMsg })

  } catch (err: any) {
    console.error('[PATCH /api/chat/admin/messages] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()

    const { data: dbUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso restrito à administração escolar.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('message_id')
    const hardDelete = searchParams.get('hard_delete') === 'true'

    if (!messageId) {
      return NextResponse.json({ error: 'message_id é obrigatório' }, { status: 400 })
    }

    const { data: msgToDel } = await supabase
      .from('chat_messages')
      .select('id, conversation_id')
      .eq('id', messageId)
      .maybeSingle()

    if (!msgToDel) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    const adminName = dbUser?.nome || user.user_metadata?.nome || user.email || 'Administrador'
    const nowIso = new Date().toISOString()

    if (hardDelete) {
      await supabase.from('chat_messages').delete().eq('id', messageId)
    } else {
      await supabase
        .from('chat_messages')
        .update({
          is_deleted: true,
          deleted_at: nowIso,
          deleted_by: adminName,
          updated_at: nowIso
        })
        .eq('id', messageId)
    }

    // Recalcular última mensagem da conversa
    const { data: remainingLatest } = await supabase
      .from('chat_messages')
      .select('content, created_at, sender_id, content_type')
      .eq('conversation_id', msgToDel.conversation_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (remainingLatest) {
      await supabase
        .from('chat_conversations')
        .update({
          last_message_text: (remainingLatest.content || '').substring(0, 100),
          last_message_at: remainingLatest.created_at,
          last_message_by: remainingLatest.sender_id,
          updated_at: nowIso
        })
        .eq('id', msgToDel.conversation_id)
    } else {
      await supabase
        .from('chat_conversations')
        .update({
          last_message_text: null,
          last_message_at: null,
          last_message_by: null,
          updated_at: nowIso
        })
        .eq('id', msgToDel.conversation_id)
    }

    return NextResponse.json({ success: true, message: 'Mensagem excluída com sucesso.' })

  } catch (err: any) {
    console.error('[DELETE /api/chat/admin/messages] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()

    const { data: dbUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso restrito à administração escolar.' }, { status: 403 })
    }

    const body = await request.json()
    const { conversation_id, content, content_type = 'text', metadata = {} } = body

    if (!conversation_id || !content || !content.trim()) {
      return NextResponse.json({ error: 'conversation_id e content são obrigatórios' }, { status: 400 })
    }

    const adminId = dbUser?.id || user.id
    const adminName = dbUser?.nome || user.user_metadata?.nome || user.email || 'Direção Geral'
    const adminPerfil = 'Direção Escolar'

    // Garantir que o administrador esteja registrado como participante na conversa com cargo de moderação
    await supabase
      .from('chat_participants')
      .upsert({
        conversation_id,
        user_id: adminId,
        user_name: adminName,
        user_perfil: adminPerfil,
        user_role: 'admin',
        unread_count: 0,
        last_read_at: new Date().toISOString()
      }, { onConflict: 'conversation_id,user_id' })

    // Inserir mensagem de intervenção institucional
    const { data: insertedMsg, error: errInsert } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id,
        sender_id: adminId,
        sender_name: adminName,
        sender_perfil: adminPerfil,
        content: content.trim(),
        content_type,
        status: 'sent',
        metadata: {
          ...metadata,
          is_admin_intervention: true
        }
      })
      .select()
      .single()

    if (errInsert) throw errInsert

    const nowIso = new Date().toISOString()
    await supabase
      .from('chat_conversations')
      .update({
        last_message_at: insertedMsg.created_at,
        last_message_text: insertedMsg.content.substring(0, 100),
        last_message_by: adminId,
        updated_at: nowIso
      })
      .eq('id', conversation_id)

    // Incrementar contagem não lida dos outros participantes
    const { data: otherParts } = await supabase
      .from('chat_participants')
      .select('id, unread_count')
      .eq('conversation_id', conversation_id)
      .neq('user_id', adminId)

    if (otherParts && otherParts.length > 0) {
      for (const p of otherParts) {
        await supabase
          .from('chat_participants')
          .update({ unread_count: (p.unread_count || 0) + 1, updated_at: nowIso })
          .eq('id', p.id)
      }
    }

    // Disparar push notification assíncrona
    try {
      const { dispatchChatPushNotification } = await import('@/lib/server/chatPushNotification')
      dispatchChatPushNotification({
        conversationId: conversation_id,
        messageId: insertedMsg.id,
        senderId: adminId,
        senderName: adminName,
        senderPerfil: adminPerfil,
        content: insertedMsg.content,
        contentType: 'text',
        metadata: insertedMsg.metadata
      }).catch(err => console.error('[POST /api/chat/admin/messages] Erro no push:', err))
    } catch (_) {}

    return NextResponse.json({ success: true, message: insertedMsg }, { status: 201 })

  } catch (err: any) {
    console.error('[POST /api/chat/admin/messages] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
