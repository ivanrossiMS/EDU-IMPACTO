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
    const { message_id, emoji, aluno_id } = body

    if (!message_id || !emoji) {
      return NextResponse.json({ error: 'message_id e emoji são obrigatórios' }, { status: 400 })
    }

    // 1. Obter usuário do banco
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    const userId = aluno_id || dbUser?.id || user.id
    const userName = dbUser?.nome || user.user_metadata?.nome || user.email || 'Usuário'

    // 2. Buscar mensagem atual
    const { data: msg, error: errFetch } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, metadata')
      .eq('id', message_id)
      .maybeSingle()

    if (errFetch || !msg) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    const currentMeta = msg.metadata || {}
    let reactions: any[] = Array.isArray(currentMeta.reactions) ? [...currentMeta.reactions] : []

    // 3. Verificar se o usuário já reagiu com o mesmo emoji
    const existingIndex = reactions.findIndex(
      r => String(r.user_id) === String(userId) && r.emoji === emoji
    )

    if (existingIndex >= 0) {
      // Toggle off: se clicar na mesma reação, remove
      reactions.splice(existingIndex, 1)
    } else {
      // Estilo WhatsApp: 1 reação ativa por usuário por mensagem (substitui anterior se houver)
      reactions = reactions.filter(r => String(r.user_id) !== String(userId))
      reactions.push({
        emoji,
        user_id: String(userId),
        user_name: userName,
        created_at: new Date().toISOString()
      })
    }

    const updatedMeta = {
      ...currentMeta,
      reactions
    }

    const { data: updatedMsg, error: errUpdate } = await supabase
      .from('chat_messages')
      .update({
        metadata: updatedMeta,
        updated_at: new Date().toISOString()
      })
      .eq('id', message_id)
      .select()
      .single()

    if (errUpdate) throw errUpdate

    return NextResponse.json({ success: true, message: updatedMsg })

  } catch (err: any) {
    console.error('Erro ao reagir à mensagem:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
