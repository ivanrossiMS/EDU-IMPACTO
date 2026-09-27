import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { checkIsAdmin, checkIsStaffManagement, checkIsCollaboratorOrTeacher, sortTurmasByName } from '@/lib/chatPermissions'

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

    // 1. Resolver usuário no system_users
    let dbUser: any = null
    const { data: foundUser } = await supabase
      .from('system_users')
      .select('id, nome, email, cargo, perfil, dados, auth_id')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    // 2. Buscar todos os grupos da agenda e configurações de WhatsApp
    const [allGruposRes, configRes] = await Promise.all([
      supabase.from('agenda_grupos').select('id, dados'),
      supabase.from('configuracoes').select('valor').eq('chave', 'ad_config').maybeSingle()
    ])

    if (allGruposRes.error) throw allGruposRes.error

    const allGrupos = (allGruposRes.data || []).map(g => ({
      id: g.id,
      nome: g.dados?.nome || 'Grupo',
      cor: g.dados?.cor || '#10b981',
      isEquipeEscolar: !!g.dados?.isEquipeEscolar,
      isGlobalAccess: !!g.dados?.isGlobalAccess,
      colaboradoresIds: Array.isArray(g.dados?.colaboradoresIds) ? g.dados.colaboradoresIds : [],
      alunosIds: Array.isArray(g.dados?.alunosIds) ? g.dados.alunosIds : [],
      turma_id: g.dados?.syncId || g.dados?.turma_id || null,
      dados: g.dados || {}
    }))

    const whatsappChannels = (configRes.data?.valor?.contatosWhatsapp || [])
      .filter((c: any) => c.ativo)
      .sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))

    // 3. Resolver escopo familiar para verificar se possui acesso familiar legítimo
    const { resolveFamilyScope } = await import('@/lib/server/chatFamilyHelper')
    const familyScope = await resolveFamilyScope(user, {
      alunoIdParam,
      context: contextParam as any,
      espelharRespId,
      espelharColabId,
      espelharAluno,
      dbUser,
      allGrupos
    })

    const hasFamilyAccess = familyScope.students.length > 0
    const isCollaboratorUser = checkIsCollaboratorOrTeacher(cargo, perfil, dbUser) || Boolean(espelharColabId)
    const hasDualRole = hasFamilyAccess && isCollaboratorUser

    // Determinar se a visualização atual deve ser Familiar
    // - Se contexto explicitamente pedir 'familia'
    // - Ou se não for modo 'colaborador' e tiver parâmetro de aluno ou for usuário puramente familiar
    const isFamilyView = 
      contextParam === 'familia' ||
      (contextParam !== 'colaborador' && (!!alunoIdParam || !isCollaboratorUser || (hasFamilyAccess && !isAdmin)))

    // =========================================================================
    // REGRA 1: VISÃO FAMILIAR (Modo Família)
    // Mostra apenas a turma do aluno, educadores e canais da escola via WhatsApp.
    // =========================================================================
    if (isFamilyView && hasFamilyAccess) {
      const allStudentTurmas: any[] = []
      familyScope.students.forEach(s => {
        const list = (s.turmaGrupos && s.turmaGrupos.length > 0) ? s.turmaGrupos : (s.turmaGrupo ? [s.turmaGrupo] : [])
        list.forEach(tg => {
          if (tg && !allStudentTurmas.some(existing => existing.id === tg.id)) {
            allStudentTurmas.push(tg)
          }
        })
      })
      const flatTurmas = sortTurmasByName(allStudentTurmas)

      const seenColabIds = new Set<string>()
      const flatColabs: any[] = []
      familyScope.students.forEach(s => {
        s.colaboradores.forEach(c => {
          if (!seenColabIds.has(c.id)) {
            seenColabIds.add(c.id)
            flatColabs.push(c)
          }
        })
      })
      flatColabs.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }))

      const firstStudent = familyScope.students[0]

      return NextResponse.json({
        role: 'familia',
        activeMode: 'familia',
        hasDualRole,
        dualRoleInfo: hasDualRole ? {
          alunoNome: firstStudent?.nome,
          alunoId: firstStudent?.id,
          colaboradorCargo: cargo || 'Colaborador',
          colaboradorPerfil: perfil || 'Colaborador'
        } : null,
        isMultiStudent: familyScope.students.length > 1,
        alunos: familyScope.students,
        aluno: firstStudent ? { id: firstStudent.id, nome: firstStudent.nome, turma: firstStudent.turma } : null,
        equipes: [],
        whatsappChannels,
        turmas: flatTurmas,
        colaboradores: flatColabs
      })
    }

    // =========================================================================
    // REGRA 2: VISÃO COLABORADOR / PROFESSOR / ADMIN (Modo Colaborador)
    // Turmas Oficiais ordenadas alfabeticamente/naturalmente por nome (A-Z)
    // =========================================================================
    const effectiveColabId = espelharColabId || dbUser?.id || user.id
    const userCandidateIds = [String(effectiveColabId), String(user.id), String(dbUser?.id), String(dbUser?.auth_id)].filter(Boolean)

    // Verificar se o usuário faz parte da Equipe Escolar (Gestão / Administração / Setores da Escola)
    const isEquipeEscolar = 
      isAdmin ||
      checkIsStaffManagement(cargo, perfil) ||
      allGrupos.some(g => g.isEquipeEscolar && g.colaboradoresIds.some((cId: any) => userCandidateIds.includes(String(cId))))

    let matchedGroups: any[] = []

    if (isEquipeEscolar) {
      // Pessoas da equipe escolar podem enviar mensagens para qualquer grupo/turma e veem todas as turmas oficiais
      matchedGroups = allGrupos.filter(g => !g.isEquipeEscolar)
    } else {
      // O professor/colaborador que NÃO está na equipe escolar só vê a turma que ele está vinculado!
      matchedGroups = allGrupos.filter(g => 
        !g.isEquipeEscolar && 
        g.colaboradoresIds.some((cId: any) => userCandidateIds.includes(String(cId)))
      )
    }

    const rawTurmas = matchedGroups.map(g => ({
      id: g.id,
      nome: g.nome,
      cor: g.cor,
      tipo: 'turma',
      membrosCount: g.alunosIds.length,
      turma_id: g.turma_id,
      ano_letivo: g.dados?.ano || g.dados?.ano_letivo || '2026',
      descricao: `Turma: ${g.nome}`
    }))

    // Ordenar turmas por nome (A-Z natural: 1º Ano A, 1º Ano B, ..., Nível 1, etc.)
    const turmas = sortTurmasByName(rawTurmas)

    const firstStudent = familyScope.students[0]

    return NextResponse.json({
      role: isAdmin ? 'admin' : 'colaborador',
      activeMode: 'colaborador',
      hasDualRole,
      dualRoleInfo: hasDualRole ? {
        alunoNome: firstStudent?.nome,
        alunoId: firstStudent?.id,
        colaboradorCargo: cargo || 'Colaborador',
        colaboradorPerfil: perfil || 'Colaborador'
      } : null,
      equipes: [],
      whatsappChannels,
      turmas,
      colaboradores: [],
      alunos: []
    })

  } catch (err: any) {
    console.error('Erro ao buscar contatos do chat:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
