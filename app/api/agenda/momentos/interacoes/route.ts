import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getColaboradorIds } from '@/lib/server/notificationHelper'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, dbUser, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse || NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { momentId, action, value, authorName, commentId } = await request.json()
    if (!momentId || !action || (!authorName && action !== 'delete_comment')) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // 1. Fetch current momento
    const { data: momento, error: fetchErr } = await adminClient
      .from('momentos')
      .select('*')
      .eq('id', momentId)
      .maybeSingle()

    if (fetchErr || !momento) {
      return NextResponse.json({ error: fetchErr?.message || 'Momento not found' }, { status: 404 })
    }

    const dados = momento.dados || {}
    let likes: string[] = Array.isArray(dados.likes) ? dados.likes : []
    let comments: any[] = Array.isArray(dados.comments) ? dados.comments : []
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

      // Verificar permissão no ad_config
      const { data: cfgRow } = await adminClient
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'ad_config')
        .maybeSingle()

      if (cfgRow?.valor?.permissoes?.comentariosMural === false) {
        return NextResponse.json({ error: 'Comentários no mural estão desativados.' }, { status: 403 })
      }

      comments.push({
        id: Date.now().toString(),
        author: authorName,
        authorId: user.id,
        text: value,
        time: 'Agora'
      })
      dados.comments = comments
    } else if (action === 'delete_comment') {
      if (!commentId) return NextResponse.json({ error: 'Comment ID missing' }, { status: 400 })
      const targetComment = comments.find((c: any) => String(c.id) === String(commentId))
      if (!targetComment) {
        return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 })
      }

      const roleTokens = `${dbUser?.perfil || ''} ${dbUser?.cargo || ''}`.toLowerCase()
      const isManager = isStaff && (
        roleTokens.includes('admin') ||
        roleTokens.includes('master') ||
        roleTokens.includes('diretor') ||
        roleTokens.includes('coordenad') ||
        roleTokens.includes('supervisor') ||
        roleTokens.includes('gestor')
      )

      if (!isManager) {
        const userNames = [
          dbUser?.nome,
          user.user_metadata?.nome,
          user.email,
        ]
          .filter(Boolean)
          .map((n: any) => String(n).trim().toLowerCase())

        const isCommentAuthor =
          (targetComment.authorId && String(targetComment.authorId) === String(user.id)) ||
          (!targetComment.authorId && targetComment.author && userNames.includes(String(targetComment.author).trim().toLowerCase()))

        if (!isCommentAuthor) {
          return NextResponse.json(
            { error: 'Acesso negado: você só pode excluir seus próprios comentários.' },
            { status: 403 }
          )
        }
      }

      comments = comments.filter((c: any) => String(c.id) !== String(commentId))
      dados.comments = comments
    }

    // 3. Save Update
    const { error: updateErr } = await adminClient
      .from('momentos')
      .update({ dados })
      .eq('id', momentId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    // 4. Dispatch Push Notification EXCLUSIVELY to the author (if they are not the one interacting)
    if (!isRemoval) {
      const rawAuthorId = dados.authorId || dados.autorId || dados.autor_id || dados.criadoPorId || momento.autor_id || momento.colaborador_id
      const momAuthorName = (dados.author || dados.autor || '').trim()

      let targetUserIds: string[] = []

      // Se temos o ID do autor, expandimos com todas as credenciais do colaborador
      if (rawAuthorId) {
        const resolved = await getColaboradorIds([String(rawAuthorId)])
        targetUserIds = resolved.length > 0 ? resolved : [String(rawAuthorId)]
      }

      // Se não resolveu pelo ID ou se faltou algum alias, busca também pelo nome do autor em system_users
      if (targetUserIds.length === 0 && momAuthorName) {
        const { data: authorByName } = await adminClient
          .from('system_users')
          .select('id, auth_id, email')
          .ilike('nome', momAuthorName)
          .maybeSingle()

        if (authorByName) {
          const candidateIds = [authorByName.id, authorByName.auth_id, authorByName.email].filter(Boolean) as string[]
          const resolved = await getColaboradorIds(candidateIds)
          targetUserIds = resolved.length > 0 ? resolved : candidateIds
        }
      }

      // Verificar se a interação foi feita pelo próprio autor (não notificar a si mesmo)
      const userCandidateIds = new Set<string>(
        [
          String(user.id),
          dbUser?.id ? String(dbUser.id) : null,
          dbUser?.auth_id ? String(dbUser.auth_id) : null,
          dbUser?.email ? String(dbUser.email).toLowerCase() : null,
          user.email ? String(user.email).toLowerCase() : null,
          user.user_metadata?.colaborador_id ? String(user.user_metadata.colaborador_id) : null,
          user.user_metadata?.system_user_id ? String(user.user_metadata.system_user_id) : null,
          user.user_metadata?.nome ? String(user.user_metadata.nome).toLowerCase().trim() : null,
          dbUser?.nome ? String(dbUser.nome).toLowerCase().trim() : null,
        ].filter(Boolean) as string[]
      )

      const isSelfInteraction = targetUserIds.some(id => userCandidateIds.has(String(id).toLowerCase().trim())) ||
        (momAuthorName && userCandidateIds.has(momAuthorName.toLowerCase()))

      if (targetUserIds.length > 0 && !isSelfInteraction) {
        // Chave única por interação para NUNCA ser bloqueada pela deduplicação de agenda_push_logs
        // Agrupa likes do mesmo usuário por intervalo de 1 minuto para evitar spam de duplo clique acidental
        const minuteBucket = Math.floor(Date.now() / 60000)
        const interactionId = action === 'like'
          ? `momento_like_${momentId}_${user.id}_${minuteBucket}`
          : `momento_comment_${momentId}_${commentId || Date.now()}`

        const collapseId = action === 'like'
          ? `like_${momentId}_${user.id}`
          : `comment_${momentId}_${commentId || Date.now()}`

        const message = action === 'like'
          ? `${authorName} curtiu sua publicação.`
          : `${authorName} comentou na sua publicação: "${value}"`

        // Destino canônico para o autor visualizar sua publicação na galeria de colaboradores
        const targetUrl = `/agenda-digital/colaborador/momentos?id=${momentId}`

        sendAgendaPushNotification({
          type: 'momentos',
          itemId: interactionId,
          title: action === 'like' ? '❤️ Nova Curtida' : '💬 Novo Comentário',
          message,
          targetUserIds,
          targetUrl,
          collapseId,
          senderUserId: user.id,
          metadata: {
            perfil_destino: 'colaborador',
            item_id: String(momentId),
            interaction_id: interactionId,
            rota: 'momentos',
            targetUrl,
            author: authorName,
            action,
          }
        }).catch(err => console.error('[Push Dispatch Error] Interacoes Momento:', err))
      }
    }

    return NextResponse.json({ ok: true, likes, comments })

  } catch (err: any) {
    console.error('[API Momentos Interacoes] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
