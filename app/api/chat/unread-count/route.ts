import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { checkIsAdmin, checkIsCollaboratorOrTeacher } from '@/lib/chatPermissions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    const alunoIdParam = searchParams.get('aluno_id')
    const contextParam = searchParams.get('context') // 'familia' | 'colaborador' | null
    const espelharRespId = searchParams.get('espelhar_responsavel')
    const espelharColabId = searchParams.get('espelhar_colaborador')

    let dbUser: any = null
    const { data: foundUser } = await supabase
      .from('system_users')
      .select('id, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    const isColabMode = contextParam === 'colaborador' || (!alunoIdParam && !espelharRespId && !isAdmin && dbUser && contextParam !== 'familia')

    // Se for modo colaborador ou admin sem filtro familiar
    if (isColabMode || (isAdmin && !alunoIdParam && contextParam !== 'familia')) {
      const userIds = Array.from(new Set([
        espelharColabId,
        dbUser?.id,
        dbUser?.auth_id,
        user.id
      ].filter(Boolean))) as string[]

      if (isColabMode && !isAdmin) {
        const { syncAndResolveGroupMemberships } = await import('@/lib/server/chatGroupMembership')
        await syncAndResolveGroupMemberships(supabase, userIds, cargo, perfil)
      }

      const { data: parts, error } = await supabase
        .from('chat_participants')
        .select('unread_count')
        .in('user_id', userIds)
        .gt('unread_count', 0)
        .is('left_at', null)
        .neq('is_archived', true)

      if (error) throw error
      const total = (parts || []).reduce((acc, curr) => acc + (curr.unread_count || 0), 0)
      return NextResponse.json({ total })
    }

    // Regras de escopo de permissão para Aluno e Família
    const { resolveFamilyScope } = await import('@/lib/server/chatFamilyHelper')
    const familyScope = await resolveFamilyScope(user, {
      alunoIdParam,
      context: 'familia',
      espelharRespId,
      espelharColabId
    })

    const userIds = familyScope.candidateUserIds

    const { data: parts, error } = await supabase
      .from('chat_participants')
      .select('conversation_id, unread_count, user_id')
      .in('user_id', userIds)
      .gt('unread_count', 0)
      .is('left_at', null)
      .neq('is_archived', true)

    if (error) throw error

    if (!parts || parts.length === 0) {
      return NextResponse.json({ total: 0 })
    }

    const convIds = parts.map(p => p.conversation_id)
    const { data: convs } = await supabase
      .from('chat_conversations')
      .select('id, type, grupo_id, turma_id, aluno_id')
      .in('id', convIds)
      .is('deleted_at', null)

    const { data: allParts } = await supabase
      .from('chat_participants')
      .select('conversation_id, user_id, user_perfil, user_role')
      .in('conversation_id', convIds)

    const partsByConv = new Map<string, any[]>()
    ;(allParts || []).forEach(p => {
      const list = partsByConv.get(p.conversation_id) || []
      list.push(p)
      partsByConv.set(p.conversation_id, list)
    })

    let total = 0
    for (const part of parts) {
      const conv = (convs || []).find(c => c.id === part.conversation_id)
      if (!conv) continue

      let isAllowed = false
      if (conv.type === 'group') {
        isAllowed = (conv.grupo_id && familyScope.allGroupIds.has(conv.grupo_id)) ||
                    (conv.turma_id && (familyScope.allTurmaIds.has(conv.turma_id) || familyScope.allGroupIds.has(conv.turma_id)))
      } else if (conv.type === 'direct') {
        const cp = partsByConv.get(conv.id) || []
        const other = cp.find(p => !userIds.includes(p.user_id))
        if (other) {
          const otherPerfil = (other.user_perfil || '').toLowerCase().trim()
          const isOtherFamily = ['pai', 'mãe', 'mae', 'responsável', 'responsavel', 'aluno', 'família', 'familia'].includes(otherPerfil)
          const isOtherStaff = 
            other.user_role === 'admin' ||
            other.user_role === 'colaborador' ||
            checkIsCollaboratorOrTeacher(other.user_perfil, other.user_role) ||
            familyScope.allColabIds?.has(String(other.user_id)) ||
            !isOtherFamily

          if (isOtherStaff) {
            if (!conv.aluno_id || familyScope.allStudentIds.size === 0 || familyScope.allStudentIds.has(String(conv.aluno_id))) {
              isAllowed = true
            }
          }
        }
      }

      if (isAllowed) {
        total += part.unread_count || 0
      }
    }

    return NextResponse.json({ total })

  } catch (err: any) {
    console.error('Erro ao somar não lidos:', err)
    return NextResponse.json({ total: 0 })
  }
}
