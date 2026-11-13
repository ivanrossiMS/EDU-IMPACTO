/**
 * Utilitários de permissão e vinculação para o Sistema de Provas e Simulados.
 * Garante que professores só possam criar provas, simulados e questões com
 * as disciplinas às quais estão explicitamente vinculados no cadastro de disciplinas.
 */

export function checkIsStrictProfessor(currentUser: any, currentUserPerfil?: string): boolean {
  const role = String(currentUserPerfil || currentUser?.perfil || currentUser?.cargo || '').toLowerCase().trim()
  const isProf = role.includes('prof')
  const isAdminOrCoord = [
    'direção',
    'direcao',
    'administrador',
    'diretor geral',
    'administrador master',
    'coordenador',
    'coordenação',
    'coordenacao',
    'secretaria'
  ].some(r => role.includes(r))
  return isProf && !isAdminOrCoord
}

export function getTeacherUserIds(currentUser: any, professores: any[] = []): string[] {
  if (!currentUser) return []
  const ids = new Set<string>()
  if (currentUser.id) ids.add(String(currentUser.id))
  if (currentUser.system_user_id) ids.add(String(currentUser.system_user_id))
  if (currentUser.colaborador_id) ids.add(String(currentUser.colaborador_id))

  // Localiza professor correspondente por e-mail ou nome na lista de colaboradores/professores
  if (professores && professores.length > 0) {
    const curEmail = (currentUser.email || '').toLowerCase().trim()
    const curNome = (currentUser.nome || '').toLowerCase().trim()
    
    const found = professores.find(p => {
      const pEmail = (p.email || '').toLowerCase().trim()
      const pNome = (p.nome || '').toLowerCase().trim()
      return (curEmail && pEmail && pEmail === curEmail) || (curNome && pNome && pNome === curNome)
    })
    if (found?.id) ids.add(String(found.id))
  }

  return Array.from(ids)
}

export function isTeacherLinkedToDisciplina(disciplina: any, teacherIdsOrUser: string[] | any): boolean {
  if (!disciplina || !teacherIdsOrUser) return false
  
  let teacherIds: string[] = []
  if (Array.isArray(teacherIdsOrUser)) {
    teacherIds = teacherIdsOrUser
  } else if (typeof teacherIdsOrUser === 'string') {
    teacherIds = [teacherIdsOrUser]
  } else if (typeof teacherIdsOrUser === 'object') {
    teacherIds = getTeacherUserIds(teacherIdsOrUser)
  }

  if (teacherIds.length === 0) return false
  const tSet = new Set(teacherIds.map(String))

  let ids: string[] = []
  if (Array.isArray(disciplina.professores_ids)) {
    ids = disciplina.professores_ids
  } else if (typeof disciplina.professores_ids === 'string') {
    try {
      const parsed = JSON.parse(disciplina.professores_ids)
      if (Array.isArray(parsed)) ids = parsed
    } catch {}
  }
  if (disciplina.id_professor) {
    ids.push(String(disciplina.id_professor))
  }

  return ids.some(id => tSet.has(String(id)))
}

export function filterDisciplinasForUser(
  disciplinas: any[],
  currentUser: any,
  currentUserPerfil?: string,
  professores: any[] = []
): any[] {
  if (!checkIsStrictProfessor(currentUser, currentUserPerfil)) {
    return disciplinas
  }
  const teacherIds = getTeacherUserIds(currentUser, professores)
  return (disciplinas || []).filter(d => isTeacherLinkedToDisciplina(d, teacherIds))
}
