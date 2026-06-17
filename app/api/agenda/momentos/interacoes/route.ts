import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { momentId, action, value, authorName } = await request.json()
    if (!momentId || !action || !authorName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createProtectedClient()

    // 1. Fetch current momento
    const { data: momento, error: fetchErr } = await supabase
      .from('momentos')
      .select('*')
      .eq('id', momentId)
      .maybeSingle()

    if (fetchErr || !momento) {
      return NextResponse.json({ error: fetchErr?.message || 'Momento not found' }, { status: 404 })
    }

    const dados = momento.dados || {}
    let likes = dados.likes || []
    let comments = dados.comments || []
    let isRemoval = false

    // 2. Apply Interaction
    if (action === 'like') {
      const isLiked = likes.includes(authorName)
      if (isLiked) {
        likes = likes.filter((n: string) => n !== authorName)
        isRemoval = true
      } else {
        likes.push(authorName)
      }
      dados.likes = likes
    } else if (action === 'comment') {
      if (!value) return NextResponse.json({ error: 'Comment value missing' }, { status: 400 })
      comments.push({
        id: Date.now().toString(),
        author: authorName,
        text: value,
        time: 'Agora'
      })
      dados.comments = comments
    }

    // 3. Save Update
    const { error: updateErr } = await supabase
      .from('momentos')
      .update({ dados })
      .eq('id', momentId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    // 4. Dispatch Push Notification EXCLUSIVELY to authorId (if they are not the one interacting)
    if (!isRemoval && dados.authorId && String(dados.authorId) !== String(user.id)) {
      const isColab = String(dados.authorId).startsWith('COLAB-') || String(dados.authorId).startsWith('AD-')
      const message = action === 'like' 
        ? `${authorName} curtiu sua publicação.` 
        : `${authorName} comentou na sua publicação: "${value}"`
        
      sendAgendaPushNotification({
        type: 'momentos',
        itemId: String(momentId),
        title: action === 'like' ? '❤️ Nova Curtida' : '💬 Novo Comentário',
        message,
        targetUserIds: [dados.authorId],
        targetUrl: isColab ? '/agenda-digital/colaborador/momentos' : '/agenda-digital/momentos'
      }).catch(err => console.error('[Push Dispatch Error] Interacoes Momento:', err))
    }

    return NextResponse.json({ ok: true, likes, comments })

  } catch (err: any) {
    console.error('[API Momentos Interacoes] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
