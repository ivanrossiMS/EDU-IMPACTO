import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

import { checkIsAdmin, checkIsStaffManagement, checkIsCollaboratorOrTeacher } from '@/lib/chatPermissions'

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
    const espelharAluno = searchParams.get('espelhar_aluno') === 'true'

    // Resolver usuário local
    let dbUser: any = null
    const { data: foundUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil, dados')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)
    const isSchoolStaff = checkIsCollaboratorOrTeacher(cargo, perfil, dbUser) || checkIsStaffManagement(cargo, perfil)

    // Se o contexto for explicitamente colaborador, ou se for administrador/equipe escolar (sem contexto explícito de família/aluno)
    const isColabMode = 
      contextParam === 'colaborador' ||
      ((isAdmin || isSchoolStaff || Boolean(dbUser)) && !alunoIdParam && !espelharRespId && !espelharAluno && contextParam !== 'familia')

    // Regras de escopo de permissão para Aluno e Família
    let familyScope: any = null
    let userIds: string[] = []

    if (!isColabMode) {
      const { resolveFamilyScope } = await import('@/lib/server/chatFamilyHelper')
      familyScope = await resolveFamilyScope(user, {
        alunoIdParam,
        context: 'familia',
        espelharRespId,
        espelharColabId,
        espelharAluno,
        dbUser
      })
      userIds = familyScope.candidateUserIds
    } else {
      userIds = Array.from(new Set([
        espelharColabId,
        dbUser?.id,
        dbUser?.auth_id,
        user.id,
        user.user_metadata?.colaborador_id,
        user.user_metadata?.system_user_id
      ].filter(Boolean))) as string[]
    }

    // Buscar participações do usuário (seja pelo id do aluno, da família ou da conta)
    const { data: myParticipations, error: errPart } = await supabase
      .from('chat_participants')
      .select('conversation_id, unread_count, last_read_at, is_pinned, is_muted, is_archived')
      .in('user_id', userIds)

    if (errPart) throw errPart

    const convIds = (myParticipations || []).map(p => p.conversation_id)

    // Se o usuário não tiver conversas registradas, retornar lista vazia
    if (convIds.length === 0) {
      return NextResponse.json({ conversations: [] })
    }

    // Buscar as conversas diretas, todos os participantes, grupos e turmas em PARALELO
    const [convRowsRes, allParticipantsRes, allGruposRes, allTurmasRes] = await Promise.all([
      supabase
        .from('chat_conversations')
        .select('id, type, title, grupo_id, turma_id, aluno_id, last_message_text, last_message_at, last_message_by, created_at')
        .in('id', convIds)
        .eq('type', 'direct')
        .is('deleted_at', null)
        .order('last_message_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('chat_participants')
        .select('conversation_id, user_id, user_name, user_perfil, user_role')
        .in('conversation_id', convIds),
      supabase
        .from('agenda_grupos')
        .select('id, dados'),
      supabase
        .from('turmas')
        .select('id, ano')
    ])

    if (convRowsRes.error) throw convRowsRes.error

    const convRows = convRowsRes.data || []
    const allParticipants = allParticipantsRes.data || []

    const anoByGroupOrTurma = new Map<string, string | number>()
    allGruposRes.data?.forEach((g: any) => {
      const ano = g.dados?.ano || g.dados?.ano_letivo || g.dados?.anoLetivo
      if (ano) {
        anoByGroupOrTurma.set(String(g.id), ano)
        if (g.dados?.syncId) anoByGroupOrTurma.set(String(g.dados.syncId), ano)
        if (g.dados?.turma_id) anoByGroupOrTurma.set(String(g.dados.turma_id), ano)
      }
    })
    allTurmasRes.data?.forEach((t: any) => {
      if (t.ano) {
        anoByGroupOrTurma.set(String(t.id), t.ano)
        anoByGroupOrTurma.set(`sync-${t.id}`, t.ano)
      }
    })

    const participantsByConv = new Map<string, any[]>()
    ;(allParticipants || []).forEach(p => {
      const list = participantsByConv.get(p.conversation_id) || []
      list.push(p)
      participantsByConv.set(p.conversation_id, list)
    })

    const participationsMap = new Map<string, any>()
    ;(myParticipations || []).forEach(p => {
      const existing = participationsMap.get(p.conversation_id)
      if (!existing) {
        participationsMap.set(p.conversation_id, p)
      } else {
        participationsMap.set(p.conversation_id, {
          ...existing,
          ...p,
          unread_count: Math.max(existing.unread_count || 0, p.unread_count || 0),
          is_pinned: existing.is_pinned || p.is_pinned,
          is_archived: Boolean(existing.is_archived || p.is_archived)
        })
      }
    })

    // Filtrar conversas: apenas conversas com mensagens válidas devem aparecer em "Conversas"
    // Se o usuário apenas iniciou a conversa mas nenhuma mensagem foi enviada, NÃO deve aparecer em conversas
    const filteredConvRows = (convRows || []).filter(conv => {
      const hasMessage = !!(conv.last_message_text && conv.last_message_text.trim() !== '')
      if (!hasMessage) {
        return false
      }

      if (!isColabMode && familyScope) {
        const convParts = participantsByConv.get(conv.id) || []
        const otherPart = convParts.find(p => !userIds.includes(p.user_id))
        if (!otherPart) return false

        // O outro participante deve ser um educador, colaborador ou administrador da escola
        const otherPerfil = (otherPart.user_perfil || '').toLowerCase().trim()
        const isOtherFamily = ['pai', 'mãe', 'mae', 'responsável', 'responsavel', 'aluno', 'família', 'familia'].includes(otherPerfil)
        const isOtherStaff = 
          otherPart.user_role === 'admin' ||
          otherPart.user_role === 'colaborador' ||
          checkIsCollaboratorOrTeacher(otherPart.user_perfil, otherPart.user_role) ||
          familyScope.allColabIds?.has(String(otherPart.user_id)) ||
          !isOtherFamily

        if (!isOtherStaff) return false

        // Se tiver aluno_id vinculado à conversa, deve pertencer aos alunos vinculados à família
        if (conv.aluno_id && familyScope.allStudentIds?.size > 0 && !familyScope.allStudentIds.has(String(conv.aluno_id))) {
          return false
        }
        return true
      }
      return true
    })

    // Desduplicar conversas diretas com o mesmo contato (por aluno se aplicável)
    const seenDirectTargets = new Set<string>()

    const studentsMap = new Map<string, any>()
    if (familyScope?.students) {
      familyScope.students.forEach((s: any) => studentsMap.set(String(s.id), s))
    }

    const conversations = filteredConvRows
      .map(conv => {
        const partInfo = participationsMap.get(conv.id)
        const convParticipants = participantsByConv.get(conv.id) || []
        const otherPart = convParticipants.find(p => !userIds.includes(p.user_id)) || convParticipants[0]

        let displayName = conv.title
        let displayRole = 'Contato'

        if (otherPart) {
          displayName = otherPart.user_name || conv.title || 'Contato'
          displayRole = otherPart.user_perfil || 'Colaborador'
        }

        const studentInfo = conv.aluno_id ? studentsMap.get(String(conv.aluno_id)) : null

        let anoLetivo: string | number = '2026'
        if (studentInfo?.turmaAno) {
          anoLetivo = studentInfo.turmaAno
        }

        return {
          id: conv.id,
          type: 'direct',
          title: displayName,
          subtitle: displayRole,
          ano_letivo: String(anoLetivo),
          isGroup: false,
          hasLeft: false,
          leftAt: null,
          isReadOnly: false,
          isArchived: Boolean(partInfo?.is_archived),
          turma_id: conv.turma_id,
          grupo_id: conv.grupo_id,
          aluno_id: conv.aluno_id || null,
          aluno_nome: studentInfo?.nome || null,
          aluno_turma: studentInfo?.turmaNome || null,
          unreadCount: partInfo?.unread_count || 0,
          context: contextParam || (isColabMode ? 'colaborador' : 'familia'),
          isPinned: partInfo?.is_pinned || false,
          lastMessageText: conv.last_message_text || null,
          lastMessageAt: conv.last_message_at || conv.created_at,
          lastMessageBy: conv.last_message_by || null,
          otherParticipant: otherPart ? {
            id: otherPart.user_id,
            nome: otherPart.user_name,
            perfil: otherPart.user_perfil
          } : null
        }
      })
      .filter(c => {
        if (c.otherParticipant?.id) {
          const directKey = c.aluno_id ? `${c.otherParticipant.id}_${c.aluno_id}` : c.otherParticipant.id
          if (seenDirectTargets.has(directKey)) return false
          seenDirectTargets.add(directKey)
        }
        return true
      })

    return NextResponse.json({ conversations })

  } catch (err: any) {
    console.error('Erro ao listar conversas:', err)
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
      type = 'direct', 
      targetUserId, 
      targetUserName, 
      targetUserPerfil,
      grupoId, 
      turmaId, 
      title,
      alunoId,
      colaboradorId
    } = body

    // 0. Grupos de turma foram descontinuados no chat
    if (type === 'group') {
      return NextResponse.json(
        { error: 'Grupos de turma foram descontinuados no chat. As mensagens agora são exclusivamente diretas.' },
        { status: 400 }
      )
    }

    // 1. Obter dados do usuário que está chamando
    let dbUser: any = null
    const { data: foundUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil, dados')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser

    const reqContext = body.context || (colaboradorId ? 'colaborador' : undefined)
    const isColabAction = reqContext === 'colaborador' || (Boolean(dbUser) && !body.isFamilyInitiated && reqContext !== 'familia')

    let currentUserId = user.id
    let currentUserName = user.user_metadata?.nome || user.email || 'Usuário'
    let currentUserPerfil = user.user_metadata?.perfil || 'Usuário'

    if (isColabAction && dbUser) {
      currentUserId = colaboradorId || dbUser.id || user.id
      currentUserName = dbUser.nome || user.user_metadata?.nome || 'Colaborador'
      currentUserPerfil = dbUser.cargo || dbUser.perfil || 'Colaborador'
    } else {
      currentUserId = user.user_metadata?.responsavel_id || user.id
      currentUserName = user.user_metadata?.nome || dbUser?.nome || user.email || 'Família'
      currentUserPerfil = 'Família'
    }

    // =========================================================================
    // CASO 2: CONVERSA DIRETA (1 a 1)
    // =========================================================================
    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId é obrigatório para conversa direta' }, { status: 400 })
    }

    // Verificar se já existe conversa direta entre os dois (busca em batch)
    const { data: commonParts } = await supabase
      .from('chat_participants')
      .select('conversation_id, user_id')
      .in('user_id', [currentUserId, targetUserId])

    if (commonParts && commonParts.length >= 2) {
      const countByConv = new Map<string, number>()
      commonParts.forEach(p => {
        countByConv.set(p.conversation_id, (countByConv.get(p.conversation_id) || 0) + 1)
      })
      const candidateConvIds = Array.from(countByConv.entries())
        .filter(([_, count]) => count >= 2)
        .map(([cId]) => cId)

      if (candidateConvIds.length > 0) {
        let existingConvQuery = supabase
          .from('chat_conversations')
          .select('id, type, title, grupo_id, turma_id, aluno_id, last_message_text, last_message_at, last_message_by, created_at')
          .in('id', candidateConvIds)
          .eq('type', 'direct')
          .is('deleted_at', null)

        if (alunoId) {
          existingConvQuery = existingConvQuery.eq('aluno_id', alunoId)
        }

        const { data: existingDirectConv } = await existingConvQuery.maybeSingle()

        if (existingDirectConv) {
          return NextResponse.json({ conversation: { ...existingDirectConv, ano_letivo: body.ano_letivo || '2026' }, isNew: false })
        }
      }
    }

    // Resolver nome do target se não fornecido
    let resolvedTargetName = targetUserName
    let resolvedTargetPerfil = targetUserPerfil

    if (!resolvedTargetName) {
      const { data: targetUserObj } = await supabase
        .from('system_users')
        .select('nome, cargo, perfil')
        .eq('id', targetUserId)
        .maybeSingle()

      if (targetUserObj) {
        resolvedTargetName = targetUserObj.nome
        resolvedTargetPerfil = targetUserObj.cargo || targetUserObj.perfil
      }
    }

    // Criar nova conversa direta
    const convTitle = resolvedTargetName || title || 'Conversa Direta'

    const { data: newConv, error: errNewConv } = await supabase
      .from('chat_conversations')
      .insert({
        type: 'direct',
        title: convTitle,
        created_by: currentUserId,
        aluno_id: alunoId || null,
        turma_id: turmaId || null,
        last_message_text: null,
        last_message_at: null,
        last_message_by: null
      })
      .select()
      .single()

    if (errNewConv) throw errNewConv

    // Inserir os dois participantes
    await supabase
      .from('chat_participants')
      .insert([
        {
          conversation_id: newConv.id,
          user_id: currentUserId,
          user_name: currentUserName,
          user_perfil: currentUserPerfil,
          user_role: 'admin'
        },
        {
          conversation_id: newConv.id,
          user_id: targetUserId,
          user_name: resolvedTargetName || 'Contato',
          user_perfil: resolvedTargetPerfil || 'Colaborador',
          user_role: 'member'
        }
      ])

    return NextResponse.json({ conversation: { ...newConv, ano_letivo: body.ano_letivo || '2026' }, isNew: true }, { status: 201 })

  } catch (err: any) {
    console.error('Erro ao criar/obter conversa:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
