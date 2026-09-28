/**
 * Helper central de permissões e utilitários do Chat Institucional
 * Compartilhado entre APIs do servidor e componentes do cliente Next.js.
 */

export function checkIsAdmin(perfil?: string | null, cargo?: string | null): boolean {
  const p = (perfil || '').toLowerCase().trim()
  const c = (cargo || '').toLowerCase().trim()

  // Se contiver palavras que caracterizam funções subordinadas, docentes ou operacionais, NÃO é administrador master/direção
  const nonAdminKeywords = [
    'auxiliar',
    'assistente',
    'estagiário',
    'estagiario',
    'atendente',
    'apoio',
    'secretária',
    'secretaria',
    'portaria',
    'professor',
    'professora',
    'educador',
    'educadora'
  ]
  if (nonAdminKeywords.some(k => p.includes(k) || c.includes(k))) {
    return false
  }

  // Perfis ou cargos com privilégio total de administração institucional
  const adminExactMatches = [
    'administrador master',
    'administrador',
    'administradora',
    'admin',
    'diretor geral',
    'diretora geral',
    'diretor',
    'diretora',
    'direção',
    'direcao',
    'master',
    'gestor geral',
    'gestora geral',
    'superadmin'
  ]

  return adminExactMatches.some(title => 
    p === title || 
    c === title ||
    p.startsWith('administrador ') ||
    c.startsWith('administrador ') ||
    p.startsWith('diretor') ||
    c.startsWith('diretor')
  )
}

/**
 * Ordenação natural e alfabética de turmas em português (ex: 1º Ano A, 1º Ano B, ..., Nível 1, etc.)
 */
export function sortTurmasByName<T extends { nome?: string }>(turmas: T[]): T[] {
  return [...turmas].sort((a, b) => 
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true, sensitivity: 'base' })
  )
}

/**
 * Verifica se o usuário faz parte da Gestão / Equipe Escolar Administrativa
 * (Direção, Coordenação, Secretaria, Administrativo, Financeiro, Portaria, Inspetores, etc.)
 * Esses membros possuem visão global de todas as turmas e podem enviar mensagens para qualquer grupo/turma.
 */
export function checkIsStaffManagement(cargo?: string | null, perfil?: string | null): boolean {
  const p = (perfil || '').toLowerCase().trim()
  const c = (cargo || '').toLowerCase().trim()

  const mgmtKeywords = [
    'diretor',
    'diretora',
    'direção',
    'direcao',
    'coordenador',
    'coordenadora',
    'pedagógico',
    'pedagogico',
    'secretár',
    'secretar',
    'financeiro',
    'auxiliar administrativo',
    'assistente administrativo',
    'portaria',
    'segurança',
    'seguranca',
    'inspetor',
    'inspetora',
    'recepção',
    'recepcao',
    'gestor',
    'gestora',
    'admin',
    'administrador',
    'administradora'
  ]

  return mgmtKeywords.some(keyword => p.includes(keyword) || c.includes(keyword))
}

/**
 * Verifica se o usuário é colaborador/educador (equipe escolar ou professor de sala)
 */
export function checkIsCollaboratorOrTeacher(cargo?: string | null, perfil?: string | null, userObject?: any): boolean {
  const p = (perfil || '').toLowerCase().trim()
  const c = (cargo || '').toLowerCase().trim()

  const isFamiliaOrResp = 
    p.includes('família') || 
    p.includes('familia') || 
    p.includes('responsável') || 
    p.includes('responsavel') ||
    p === 'aluno' ||
    c.includes('responsável') ||
    c.includes('responsavel') ||
    c === 'aluno'

  const staffKeywords = [
    'professor',
    'professora',
    'educador',
    'educadora',
    'docente',
    'docentes',
    'monitor',
    'monitora',
    'auxiliar',
    'assistente',
    'coordenador',
    'coordenadora',
    'diretor',
    'diretora',
    'direção',
    'direcao',
    'secretár',
    'secretar',
    'financeiro',
    'portaria',
    'segurança',
    'seguranca',
    'colaborador',
    'colaboradora',
    'equipe',
    'gestor',
    'gestora',
    'admin',
    'administrador',
    'administradora',
    'pedagógico',
    'pedagogico',
    'estagiár',
    'estagiar',
    'atendente',
    'apoio'
  ]

  const hasStaffKeyword = staffKeywords.some(keyword => p.includes(keyword) || c.includes(keyword))
  const isAdmin = checkIsAdmin(perfil, cargo)

  // Verifica se possui um ID de colaborador explícito e válido na tabela de equipe escolar
  const rawColabId = (userObject?.colaborador_id || userObject?.dados?.colaborador_id || userObject?.system_user_id || '').toString().trim()
  const hasValidColabId = rawColabId.length > 0 && rawColabId !== 'null' && rawColabId !== 'undefined'

  // Se o usuário possui perfil ou cargo familiar/aluno:
  // Só pode ser considerado membro da equipe escolar se tiver cargo/perfil de equipe, for admin,
  // ou possuir vínculo explícito e válido de colaborador_id.
  if (isFamiliaOrResp) {
    if (!hasStaffKeyword && !isAdmin && !hasValidColabId) {
      return false
    }
  }

  if (hasStaffKeyword || isAdmin) {
    return true
  }

  if (hasValidColabId) {
    return true
  }

  return false
}

// Alias para compatibilidade
export const checkIsEquipeEscolar = checkIsCollaboratorOrTeacher


