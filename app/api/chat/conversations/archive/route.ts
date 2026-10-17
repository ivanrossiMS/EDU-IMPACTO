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
    const { conversation_id, is_archived } = body

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

    const { resolveFamilyScope } = await import('@/lib/server/chatFamilyHelper')
    const familyScope = await resolveFamilyScope(user, { dbUser })

    const userCandidateIds = Array.from(new Set([
      String(user.id),
      dbUser?.id ? String(dbUser.id) : null,
      dbUser?.auth_id ? String(dbUser.auth_id) : null,
      user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : null,
      ...(familyScope.candidateUserIds || [])
    ].filter(Boolean))) as string[]

    // 2. Verificar se já existe participação
    const { data: existingParts } = await supabase
      .from('chat_participants')
      .select('id, user_id, is_archived')
      .eq('conversation_id', conversation_id)
      .in('user_id', userCandidateIds)

    const nowIso = new Date().toISOString()
    let targetArchivedState: boolean

    if (typeof is_archived === 'boolean') {
      targetArchivedState = is_archived
    } else {
      // Toggle estado atual
      const current = existingParts && existingParts.length > 0 ? !!existingParts[0].is_archived : false
      targetArchivedState = !current
    }

    if (existingParts && existingParts.length > 0) {
      // Atualizar todas as participações do usuário nesta conversa
      await supabase
        .from('chat_participants')
        .update({
          is_archived: targetArchivedState,
          updated_at: nowIso
        })
        .eq('conversation_id', conversation_id)
        .in('user_id', userCandidateIds)
    } else {
      const { data: convInfo } = await supabase
        .from('chat_conversations')
        .select('id, type, grupo_id, turma_id')
        .eq('id', conversation_id)
        .maybeSingle()

      if (!convInfo) {
        return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
      }

      if (convInfo.type === 'direct' && !familyScope.isAdmin) {
        return NextResponse.json({ error: 'Acesso negado a esta conversa direta' }, { status: 403 })
      }

      if (convInfo.type === 'group' && !familyScope.isAdmin && familyScope.isFamilyOrStudent) {
        const rawGId = convInfo.grupo_id ? String(convInfo.grupo_id) : ''
        const rawTId = convInfo.turma_id ? String(convInfo.turma_id) : ''
        const cleanTId = rawTId.replace(/^sync-/, '')
        const isAllowedGroup =
          (rawGId && (familyScope.allGroupIds.has(rawGId) || familyScope.historicalGroupIds.has(rawGId))) ||
          (rawTId && (familyScope.allTurmaIds.has(rawTId) || familyScope.allGroupIds.has(rawTId) || familyScope.historicalGroupIds.has(rawTId))) ||
          (cleanTId && (familyScope.allTurmaIds.has(cleanTId) || familyScope.allGroupIds.has(cleanTId) || familyScope.historicalGroupIds.has(cleanTId)))

        if (!isAllowedGroup) {
          return NextResponse.json({ error: 'Acesso negado a este grupo' }, { status: 403 })
        }
      }

      // Criar participação com o estado de arquivado
      await supabase
        .from('chat_participants')
        .insert({
          conversation_id,
          user_id: user.id,
          user_name: dbUser?.nome || user.user_metadata?.nome || user.email || 'Usuário',
          user_perfil: dbUser?.cargo || dbUser?.perfil || 'Usuário',
          user_role: 'member',
          is_archived: targetArchivedState,
          created_at: nowIso,
          updated_at: nowIso
        })
    }

    return NextResponse.json({
      success: true,
      conversation_id,
      is_archived: targetArchivedState
    })

  } catch (err: any) {
    console.error('Erro ao arquivar/desarquivar conversa:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
