import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { checkIsAdmin } from '@/lib/chatPermissions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const body = await request.json()
    const { conversation_id, user_id: overrideUserId, aluno_id: overrideAlunoId, context } = body

    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id é obrigatório' }, { status: 400 })
    }

    let dbUser: any = null
    const { data: foundUser } = await supabase
      .from('system_users')
      .select('id, perfil, cargo, dados, auth_id')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    const isFamilyContext = 
      context === 'familia' ||
      !!overrideAlunoId ||
      perfil.toLowerCase().includes('família') || 
      perfil.toLowerCase().includes('familia') || 
      cargo.toLowerCase().includes('aluno') || 
      cargo.toLowerCase().includes('responsável') || 
      cargo.toLowerCase().includes('responsavel')

    let allCandidateIds: string[] = []

    if (isFamilyContext || overrideAlunoId) {
      const { resolveFamilyScope } = await import('@/lib/server/chatFamilyHelper')
      const familyScope = await resolveFamilyScope(user, {
        alunoIdParam: overrideAlunoId ? String(overrideAlunoId) : undefined,
        context: 'familia'
      })
      allCandidateIds = Array.from(familyScope.candidateUserIds || [])
    }

    if (overrideAlunoId && !allCandidateIds.includes(String(overrideAlunoId))) {
      allCandidateIds.push(String(overrideAlunoId))
    }

    const metaColabId = user.user_metadata?.colaborador_id || user.user_metadata?.system_user_id
    const metaRespId = user.user_metadata?.responsavel_id
    const metaAlunoId = user.user_metadata?.aluno_id

    const effectiveUserId = overrideUserId || dbUser?.id || user.id

    const targetUserIds = Array.from(new Set([
      effectiveUserId,
      overrideUserId,
      overrideAlunoId ? String(overrideAlunoId) : null,
      dbUser?.id,
      user.id,
      metaColabId,
      metaRespId,
      metaAlunoId,
      ...allCandidateIds
    ].filter(Boolean))) as string[]

    // 1. Zerar contador de não lidos para todos os IDs associados a este usuário / família nesta conversa
    const { data: updatedParts } = await supabase
      .from('chat_participants')
      .update({
        unread_count: 0,
        last_read_at: new Date().toISOString()
      })
      .eq('conversation_id', conversation_id)
      .in('user_id', targetUserIds)
      .select('id')

    // Se nenhum participante foi atualizado (ex: primeiro acesso a um grupo de turma pelo aluno/família),
    // garantir que o participante seja registrado com unread_count: 0
    if (!updatedParts || updatedParts.length === 0) {
      const primaryUserId = overrideAlunoId || overrideUserId || dbUser?.id || user.id
      const userName = user.user_metadata?.nome || dbUser?.nome || 'Usuário'
      const userRole = isAdmin ? 'admin' : 'member'
      const userPerfil = dbUser?.perfil || user.user_metadata?.perfil || (isFamilyContext ? 'Família' : 'Colaborador')

      await supabase
        .from('chat_participants')
        .upsert({
          conversation_id,
          user_id: primaryUserId,
          user_name: userName,
          user_perfil: userPerfil,
          user_role: userRole,
          unread_count: 0,
          last_read_at: new Date().toISOString()
        }, { onConflict: 'conversation_id,user_id' })
    }

    // 2. Marcar mensagens enviadas pelo outro usuário como 'read' (Blue Ticks ✓✓)
    if (targetUserIds.length > 0) {
      const safeIdList = targetUserIds.map(id => `"${id}"`).join(',')
      await supabase
        .from('chat_messages')
        .update({
          status: 'read'
        })
        .eq('conversation_id', conversation_id)
        .not('sender_id', 'in', `(${safeIdList})`)
        .neq('status', 'read')
    }

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('Erro ao marcar mensagens como lidas:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
