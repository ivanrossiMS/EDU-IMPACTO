import { checkIsAdmin, checkIsStaffManagement, checkIsCollaboratorOrTeacher } from '@/lib/chatPermissions'

export interface GroupMembershipStatus {
  isMember: boolean
  hasLeft: boolean
  leftAt: string | null
}

/**
 * Sincroniza e resolve o status de participação de grupos para usuários colaboradores.
 * Se o colaborador NÃO estiver mais na turma (removido de colaboradoresIds em agenda_grupos),
 * detecta automaticamente e atualiza left_at na tabela chat_participants, garantindo que:
 * - A conversa anterior continue visível para ele até o momento em que ele saiu.
 * - Mensagens enviadas após a saída NUNCA apareçam para ele.
 * - A contagem de não lidos para essa conversa seja zerada e não incremente mais.
 */
export async function syncAndResolveGroupMemberships(
  supabase: any,
  userIds: string[],
  cargo?: string | null,
  perfil?: string | null
): Promise<{
  isEquipeEscolar: boolean
  activeGroupIds: Set<string>
  activeTurmaIds: Set<string>
  groupStatusByConvId: Map<string, GroupMembershipStatus>
}> {
  const isColab = checkIsCollaboratorOrTeacher(cargo, perfil)
  const isEquipeEscolar = checkIsAdmin(perfil, cargo) || checkIsStaffManagement(cargo, perfil)
  const activeGroupIds = new Set<string>()
  const activeTurmaIds = new Set<string>()
  const groupStatusByConvId = new Map<string, GroupMembershipStatus>()

  // Responsáveis, familiares e alunos NUNCA saem de turmas através do controle de colaboradores
  if (userIds.length === 0 || !isColab) {
    return { isEquipeEscolar, activeGroupIds, activeTurmaIds, groupStatusByConvId }
  }

  // 1. Carregar todos os grupos e turmas onde o usuário é atualmente colaborador ativo
  const { data: allGrupos } = await supabase
    .from('agenda_grupos')
    .select('id, dados')

  if (allGrupos) {
    allGrupos.forEach((g: any) => {
      const cIds = Array.isArray(g.dados?.colaboradoresIds) ? g.dados.colaboradoresIds.map(String) : []
      if (userIds.some(uid => cIds.includes(String(uid)))) {
        if (g.id) activeGroupIds.add(String(g.id))
        const tId = g.dados?.syncId || g.dados?.turma_id
        if (tId) activeTurmaIds.add(String(tId))
      }
    })
  }

  // Se for equipe escolar/gestão geral, eles têm acesso global a todas as turmas (não saem de turmas)
  if (isEquipeEscolar) {
    return { isEquipeEscolar, activeGroupIds, activeTurmaIds, groupStatusByConvId }
  }

  // 2. Buscar participações do usuário em conversas de grupo
  const { data: myGroupParts } = await supabase
    .from('chat_participants')
    .select('id, conversation_id, user_id, user_perfil, left_at, unread_count, last_read_at, chat_conversations!inner(id, type, grupo_id, turma_id)')
    .in('user_id', userIds)
    .eq('chat_conversations.type', 'group')

  if (!myGroupParts || myGroupParts.length === 0) {
    return { isEquipeEscolar, activeGroupIds, activeTurmaIds, groupStatusByConvId }
  }

  for (const part of myGroupParts) {
    const conv = part.chat_conversations
    if (!conv) continue

    // Ignora e limpa qualquer left_at caso esta participação seja com perfil de família/aluno
    const partPerfil = (part.user_perfil || '').toLowerCase().trim()
    const isFamilyPart = ['família', 'familia', 'responsável', 'responsavel', 'aluno'].some(k => partPerfil.includes(k))
    if (isFamilyPart) {
      if (part.left_at) {
        await supabase.from('chat_participants').update({ left_at: null }).eq('id', part.id)
      }
      continue
    }

    const isMemberNow = 
      (conv.grupo_id && activeGroupIds.has(String(conv.grupo_id))) ||
      (conv.turma_id && (activeTurmaIds.has(String(conv.turma_id)) || activeGroupIds.has(String(conv.turma_id))))

    if (isMemberNow) {
      // Usuário está ativo no grupo
      if (part.left_at) {
        // Se tinha sido marcado como left_at anteriormente mas voltou para a turma, restaura
        await supabase
          .from('chat_participants')
          .update({ left_at: null })
          .eq('id', part.id)
      }

      groupStatusByConvId.set(conv.id, {
        isMember: true,
        hasLeft: false,
        leftAt: null
      })
    } else {
      // O colaborador NÃO está mais no grupo da turma!
      let effectiveLeftAt = part.left_at

      if (!effectiveLeftAt) {
        // Determinar o momento exato em que ele saiu:
        // Busca a última mensagem enviada por ele nesta conversa
        const { data: lastMyMsg } = await supabase
          .from('chat_messages')
          .select('created_at')
          .eq('conversation_id', conv.id)
          .in('sender_id', userIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastMyMsg?.created_at) {
          // Acrescenta 1 segundo após a última mensagem para garantir que ela fique incluída
          const d = new Date(lastMyMsg.created_at)
          d.setSeconds(d.getSeconds() + 1)
          effectiveLeftAt = d.toISOString()
        } else if (part.last_read_at) {
          effectiveLeftAt = part.last_read_at
        } else {
          effectiveLeftAt = new Date().toISOString()
        }

        // Persistir no banco de dados para evitar reprocessamento futuro
        await supabase
          .from('chat_participants')
          .update({
            left_at: effectiveLeftAt,
            unread_count: 0
          })
          .eq('id', part.id)

        part.left_at = effectiveLeftAt
        part.unread_count = 0
      } else if (part.unread_count > 0) {
        // Zerar unread_count caso tenha ficado resquício
        await supabase
          .from('chat_participants')
          .update({ unread_count: 0 })
          .eq('id', part.id)
        part.unread_count = 0
      }

      groupStatusByConvId.set(conv.id, {
        isMember: false,
        hasLeft: true,
        leftAt: effectiveLeftAt
      })
    }
  }

  return { isEquipeEscolar, activeGroupIds, activeTurmaIds, groupStatusByConvId }
}
