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

    // 1. Validar permissão de Administrador Escolar
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acesso restrito à administração escolar.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').toLowerCase().trim()
    const startDate = searchParams.get('startDate') // YYYY-MM-DD
    const endDate = searchParams.get('endDate')     // YYYY-MM-DD
    const turmaId = searchParams.get('turmaId')
    const alunoId = searchParams.get('alunoId')
    const contentTypeFilter = searchParams.get('contentType') // 'all' | 'image' | 'video' | 'file' | 'audio' | 'edited'

    // 2. Buscar todas as turmas para os filtros
    const { data: turmasRows } = await supabase
      .from('turmas')
      .select('id, nome, ano')
      .order('nome', { ascending: true })

    const turmasMap = new Map<string, string>()
    ;(turmasRows || []).forEach(t => {
      turmasMap.set(String(t.id), t.nome)
      turmasMap.set(`sync-${t.id}`, t.nome)
    })

    // 3. Montar query base de conversas diretas
    let convQuery = supabase
      .from('chat_conversations')
      .select('id, type, title, turma_id, aluno_id, last_message_text, last_message_at, last_message_by, message_count, created_at')
      .eq('type', 'direct')
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (turmaId) {
      convQuery = convQuery.or(`turma_id.eq."${turmaId}",turma_id.eq."sync-${turmaId}"`)
    }

    if (alunoId) {
      convQuery = convQuery.eq('aluno_id', alunoId)
    }

    if (startDate) {
      const startIso = new Date(`${startDate}T00:00:00.000Z`).toISOString()
      convQuery = convQuery.gte('last_message_at', startIso)
    }

    if (endDate) {
      const endIso = new Date(`${endDate}T23:59:59.999Z`).toISOString()
      convQuery = convQuery.lte('last_message_at', endIso)
    }

    const { data: convRows, error: errConv } = await convQuery
    if (errConv) throw errConv

    const allConvList = convRows || []
    const convIds = allConvList.map(c => c.id)

    // 4. Buscar participantes de todas as conversas
    let allParticipants: any[] = []
    if (convIds.length > 0) {
      const { data: partData } = await supabase
        .from('chat_participants')
        .select('conversation_id, user_id, user_name, user_perfil, user_role, last_read_at, unread_count, is_archived')
        .in('conversation_id', convIds)
      allParticipants = partData || []
    }

    const partsByConv = new Map<string, any[]>()
    allParticipants.forEach(p => {
      const list = partsByConv.get(p.conversation_id) || []
      list.push(p)
      partsByConv.set(p.conversation_id, list)
    })

    // 5. Buscar alunos vinculados para obter seus dados reais (nome e turma)
    const alunoIds = Array.from(new Set(allConvList.map(c => c.aluno_id).filter(Boolean))) as string[]
    const alunoMap = new Map<string, any>()
    if (alunoIds.length > 0) {
      const { data: alunosData } = await supabase
        .from('alunos')
        .select('id, nome, turma, dados')
        .in('id', alunoIds)

      ;(alunosData || []).forEach(a => {
        alunoMap.set(String(a.id), {
          id: a.id,
          nome: a.nome,
          turma: a.turma,
          turmaNome: turmasMap.get(String(a.turma)) || a.dados?.turma_nome || a.turma
        })
      })
    }

    // 6. Buscar mídias e estatísticas globais
    const todayStartIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

    const [totalMsgRes, todayMsgRes, mediaMsgRes, editedMsgRes] = await Promise.all([
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', todayStartIso),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('is_deleted', false).in('content_type', ['image', 'video', 'file', 'audio']),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('is_edited', true)
    ])

    // 7. Formatar conversas
    let formattedConversations = allConvList.map(conv => {
      const parts = partsByConv.get(conv.id) || []
      const student = conv.aluno_id ? alunoMap.get(String(conv.aluno_id)) : null
      const turmaNome = conv.turma_id ? (turmasMap.get(String(conv.turma_id)) || conv.turma_id) : (student?.turmaNome || null)

      // Identificar educador e familiar/aluno
      const educator = parts.find(p => {
        const pf = (p.user_perfil || '').toLowerCase()
        return !['aluno', 'pai', 'mãe', 'mae', 'responsável', 'responsavel', 'família', 'familia'].includes(pf)
      }) || parts[0]

      const familyOrStudent = parts.find(p => p !== educator) || parts[1] || null

      return {
        id: conv.id,
        type: 'direct',
        title: conv.title,
        created_at: conv.created_at,
        last_message_at: conv.last_message_at || conv.created_at,
        last_message_text: conv.last_message_text || 'Sem mensagens',
        last_message_by: conv.last_message_by,
        message_count: conv.message_count || 0,
        turma_id: conv.turma_id,
        turma_nome: turmaNome,
        aluno_id: conv.aluno_id,
        aluno_nome: student?.nome || null,
        participants: parts.map(p => ({
          user_id: p.user_id,
          user_name: p.user_name || 'Contato',
          user_perfil: p.user_perfil || 'Usuário',
          user_role: p.user_role || 'member',
          last_read_at: p.last_read_at,
          unread_count: p.unread_count || 0,
          is_archived: Boolean(p.is_archived)
        })),
        educator: educator ? {
          user_id: educator.user_id,
          user_name: educator.user_name || 'Educador(a)',
          user_perfil: educator.user_perfil || 'Colaborador'
        } : null,
        target: familyOrStudent ? {
          user_id: familyOrStudent.user_id,
          user_name: familyOrStudent.user_name || 'Família',
          user_perfil: familyOrStudent.user_perfil || 'Responsável'
        } : null
      }
    })

    // 8. Aplicar busca textual se houver
    if (q) {
      formattedConversations = formattedConversations.filter(c => {
        const matchTitle = (c.title || '').toLowerCase().includes(q)
        const matchLastMsg = (c.last_message_text || '').toLowerCase().includes(q)
        const matchAluno = (c.aluno_nome || '').toLowerCase().includes(q)
        const matchTurma = (c.turma_nome || '').toLowerCase().includes(q)
        const matchParts = c.participants.some(p => (p.user_name || '').toLowerCase().includes(q) || (p.user_perfil || '').toLowerCase().includes(q))
        return matchTitle || matchLastMsg || matchAluno || matchTurma || matchParts
      })
    }

    return NextResponse.json({
      stats: {
        totalConversations: allConvList.length,
        totalMessages: totalMsgRes.count || 0,
        messagesToday: todayMsgRes.count || 0,
        totalMedia: mediaMsgRes.count || 0,
        totalEdited: editedMsgRes.count || 0
      },
      conversations: formattedConversations,
      turmas: (turmasRows || []).map(t => ({ id: t.id, nome: t.nome, ano: t.ano }))
    })

  } catch (err: any) {
    console.error('[GET /api/chat/admin/conversations] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()

    // 1. Validar Administrador Escolar
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('id, nome, cargo, perfil')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acesso restrito à administração escolar.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversation_id')

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id é obrigatório' }, { status: 400 })
    }

    // Excluir todas as mensagens, recibos, participantes e a conversa
    await Promise.all([
      supabase.from('chat_read_receipts').delete().eq('conversation_id', conversationId),
      supabase.from('chat_messages').delete().eq('conversation_id', conversationId),
      supabase.from('chat_participants').delete().eq('conversation_id', conversationId),
      supabase.from('chat_conversations').delete().eq('id', conversationId)
    ])

    return NextResponse.json({ success: true, message: 'Conversa e mensagens excluídas com sucesso.' })

  } catch (err: any) {
    console.error('[DELETE /api/chat/admin/conversations] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
