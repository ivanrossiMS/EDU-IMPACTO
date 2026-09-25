const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface CollaboratorUser {
  id: string
  auth_id?: string
  nome: string
  email?: string
  perfil?: string
  cargo?: string
}

/**
 * Resolução segura de colaboradores: busca por id (texto), auth_id (apenas UUIDs válidos para evitar erro 22P02 no PostgreSQL)
 * e fallback na tabela funcionarios.
 */
export async function resolveCollaboratorUsers(
  supabaseService: any,
  rawTargetIds: string[]
): Promise<CollaboratorUser[]> {
  const cleanTargetIds = Array.from(new Set(rawTargetIds.map(id => String(id).trim()).filter(Boolean)))
  if (cleanTargetIds.length === 0) return []

  // 1. Buscar por id (coluna texto: aceita master-dziia1l, UUIDs, códigos, etc.)
  const { data: usersById } = await supabaseService
    .from('system_users')
    .select('id, auth_id, nome, email, perfil, cargo')
    .in('id', cleanTargetIds)

  const effectiveUsers: CollaboratorUser[] = usersById ? [...usersById] : []
  const foundIds = new Set(effectiveUsers.flatMap(u => [String(u.id), String(u.auth_id)].filter(Boolean)))

  // 2. Se houver IDs não encontrados que sejam UUIDs válidos, buscar por auth_id (coluna UUID)
  const uuidTargets = cleanTargetIds.filter(id => UUID_REGEX.test(id) && !foundIds.has(id))
  if (uuidTargets.length > 0) {
    const { data: usersByAuthId } = await supabaseService
      .from('system_users')
      .select('id, auth_id, nome, email, perfil, cargo')
      .in('auth_id', uuidTargets)
    if (usersByAuthId && usersByAuthId.length > 0) {
      usersByAuthId.forEach((u: any) => {
        if (!foundIds.has(String(u.id))) {
          foundIds.add(String(u.id))
          if (u.auth_id) foundIds.add(String(u.auth_id))
          effectiveUsers.push(u)
        }
      })
    }
  }

  // 3. Fallback: buscar na tabela funcionarios por id para quaisquer IDs faltantes
  const missingIds = cleanTargetIds.filter(id => !foundIds.has(id))
  if (missingIds.length > 0) {
    const { data: funcs } = await supabaseService
      .from('funcionarios')
      .select('id, nome, email, cargo')
      .in('id', missingIds)
    if (funcs && funcs.length > 0) {
      funcs.forEach((f: any) => {
        effectiveUsers.push({
          id: f.id,
          auth_id: f.id,
          nome: f.nome,
          email: f.email,
          perfil: 'Colaborador',
          cargo: f.cargo,
        })
      })
    }
  }

  return effectiveUsers
}
