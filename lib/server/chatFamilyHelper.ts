import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { resolveCollaboratorUsers } from '@/lib/server/collaboratorLookup'
import { checkIsAdmin, sortTurmasByName } from '@/lib/chatPermissions'
import { getAlunoVinculosComPeriodo } from '@/lib/studentTurmaUtils'

export interface LinkedStudentTurmaGrupo {
  id: string
  nome: string
  cor: string
  tipo: 'turma'
  turma_id: string | null
  ano_letivo?: string | number | null
  membrosCount: number
  colaboradoresIds: string[]
  descricao?: string
  isHistorico?: boolean
  dataSaida?: string | null
  dataInicio?: string | null
}

export interface LinkedStudent {
  id: string
  nome: string
  turma: string | null
  turmaNome: string
  turmaAno?: number | string | null
  foto: string | null
  serie?: string
  turmaGrupo?: LinkedStudentTurmaGrupo | null
  turmaGrupos?: LinkedStudentTurmaGrupo[]
  colaboradores: Array<{
    id: string
    nome: string
    cargo: string
    perfil: string
    foto: string | null
    isTurmaColab: boolean
    turmaNome: string
    turmas?: string[]
    alunoId: string
    alunoNome: string
  }>
}

export interface FamilyScope {
  isFamilyOrStudent: boolean
  isAdmin: boolean
  students: LinkedStudent[]
  allStudentIds: Set<string>
  allTurmaIds: Set<string>
  allGroupIds: Set<string>
  allColabIds: Set<string>
  historicalGroupIds: Map<string, { dataSaida: string | null }>
  equipeEscolarGroups: Array<{
    id: string
    nome: string
    cor: string
    tipo: 'equipe_escolar'
    membrosCount: number
    descricao: string
    colaboradoresIds: string[]
  }>
  candidateUserIds: string[]
}

/**
 * Resolve todos os alunos vinculados a um responsável/familiar ou aluno autenticado,
 * bem como suas turmas, grupos oficiais e educadores específicos de cada aluno.
 */
export async function resolveFamilyScope(
  user: any,
  options?: {
    alunoIdParam?: string | null
    context?: 'familia' | 'colaborador' | null
    espelharRespId?: string | null
    espelharColabId?: string | null
    espelharAluno?: boolean
    dbUser?: any
    allGrupos?: any[]
  }
): Promise<FamilyScope> {
  const supabase = getAdminClient()
  const alunoIdParam = options?.alunoIdParam || null
  const contextParam = options?.context || null
  const espelharRespId = options?.espelharRespId || null
  const espelharColabId = options?.espelharColabId || null
  const espelharAluno = !!options?.espelharAluno

  // 1. Resolver usuário no system_users (reutiliza se já fornecido pelo caller)
  let dbUser: any = options?.dbUser || null
  if (!dbUser) {
    const { data: foundUser } = await supabase
      .from('system_users')
      .select('id, nome, email, cargo, perfil, dados, auth_id')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser
  }

  const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
  const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
  const isAdmin = checkIsAdmin(perfil, cargo)

  // Se o contexto explícito for colaborador, não carrega escopo familiar
  if (contextParam === 'colaborador') {
    return {
      isFamilyOrStudent: false,
      isAdmin,
      students: [],
      allStudentIds: new Set(),
      allTurmaIds: new Set(),
      allGroupIds: new Set(),
      allColabIds: new Set(),
      historicalGroupIds: new Map(),
      equipeEscolarGroups: [],
      candidateUserIds: [user.id, dbUser?.id, espelharColabId].filter(Boolean) as string[]
    }
  }

  // 2. Identificar todos os identificadores possíveis do responsável
  const candidateRespIds = new Set<string>()
  if (espelharRespId) candidateRespIds.add(String(espelharRespId))
  if (user.user_metadata?.responsavel_id) candidateRespIds.add(String(user.user_metadata.responsavel_id))
  if (dbUser?.dados?.responsavel_id) candidateRespIds.add(String(dbUser.dados.responsavel_id))
  if (dbUser?.dados?.responsavelId) candidateRespIds.add(String(dbUser.dados.responsavelId))
  if (user.id) candidateRespIds.add(String(user.id))

  // Buscar na tabela responsaveis por auth_id, user_id (dentro do JSON dados) ou email
  // ATENÇÃO: a tabela responsaveis NÃO possui coluna direta user_id
  const respOrConds: string[] = []
  if (user.id) {
    respOrConds.push(`dados->>auth_id.eq.${user.id}`, `dados->>user_id.eq.${user.id}`)
  }
  if (user.email) {
    respOrConds.push(`email.ilike.${user.email.toLowerCase().trim()}`)
  }

  if (respOrConds.length > 0) {
    const { data: respRows } = await supabase
      .from('responsaveis')
      .select('id')
      .or(respOrConds.join(','))
      .limit(10)
    if (respRows) {
      respRows.forEach((r: any) => { if (r.id) candidateRespIds.add(String(r.id)) })
    }
  }

  const isFamilyOrStudent = 
    espelharAluno || 
    !!espelharRespId || 
    contextParam === 'familia' ||
    perfil.toLowerCase().includes('família') || 
    perfil.toLowerCase().includes('familia') || 
    cargo.toLowerCase().includes('aluno') || 
    cargo.toLowerCase().includes('responsável') || 
    cargo.toLowerCase().includes('responsavel') ||
    !!alunoIdParam ||
    candidateRespIds.size > 0

  // Se não for família nem aluno e for admin, retorna escopo aberto
  if ((isAdmin && !alunoIdParam && contextParam !== 'familia') || !isFamilyOrStudent) {
    return {
      isFamilyOrStudent: false,
      isAdmin,
      students: [],
      allStudentIds: new Set(),
      allTurmaIds: new Set(),
      allGroupIds: new Set(),
      allColabIds: new Set(),
      historicalGroupIds: new Map(),
      equipeEscolarGroups: [],
      candidateUserIds: [user.id, dbUser?.id, espelharColabId].filter(Boolean) as string[]
    }
  }

  // 3 & 4. Executar em PARALELO: busca de vínculos, aluno direto e grupos da agenda (se não fornecidos)
  const linksPromise = candidateRespIds.size > 0
    ? supabase.from('aluno_responsavel').select('aluno_id').in('responsavel_id', Array.from(candidateRespIds))
    : Promise.resolve({ data: [] as any[] })

  const alunoLogadoPromise = supabase
    .from('alunos')
    .select('id')
    .or(`dados->>auth_id.eq.${user.id},dados->>user_id.eq.${user.id}${user.email ? `,email.ilike.${user.email.toLowerCase().trim()}` : ''}`)
    .maybeSingle()

  const allGruposPromise = options?.allGrupos
    ? Promise.resolve({ data: null, error: null })
    : supabase.from('agenda_grupos').select('id, dados')

  const [linksRes, alunoLogadoRes, allGruposRes] = await Promise.all([
    linksPromise,
    alunoLogadoPromise,
    allGruposPromise
  ])

  const linkedAlunoIds = new Set<string>()
  if (linksRes.data) {
    linksRes.data.forEach((l: any) => { if (l.aluno_id) linkedAlunoIds.add(String(l.aluno_id)) })
  }
  if (alunoLogadoRes.data?.id) {
    linkedAlunoIds.add(String(alunoLogadoRes.data.id))
  }

  // Se passou alunoIdParam explícito, garantir presença
  if (alunoIdParam) linkedAlunoIds.add(String(alunoIdParam))
  if (dbUser?.dados?.aluno_id) linkedAlunoIds.add(String(dbUser.dados.aluno_id))
  if (user.user_metadata?.aluno_id) linkedAlunoIds.add(String(user.user_metadata.aluno_id))

  const candidateUserIds = Array.from(new Set([
    user.id,
    dbUser?.id,
    espelharColabId,
    ...Array.from(candidateRespIds),
    ...Array.from(linkedAlunoIds)
  ].filter(Boolean))) as string[]

  const allGrupos: any[] = options?.allGrupos
    ? options.allGrupos
    : (allGruposRes.data || []).map((g: any) => ({
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

  const equipeEscolarGroups: Array<{
    id: string
    nome: string
    cor: string
    tipo: 'equipe_escolar'
    membrosCount: number
    descricao: string
    colaboradoresIds: string[]
  }> = []

  // Se nenhum aluno foi encontrado, retornar vazio
  if (linkedAlunoIds.size === 0) {
    return {
      isFamilyOrStudent: true,
      isAdmin: false,
      students: [],
      allStudentIds: new Set(),
      allTurmaIds: new Set(),
      allGroupIds: new Set(),
      allColabIds: new Set(),
      historicalGroupIds: new Map(),
      equipeEscolarGroups: [],
      candidateUserIds
    }
  }

  // 5. Buscar dados dos alunos vinculados
  const { data: alunosRows } = await supabase
    .from('alunos')
    .select('id, nome, turma, status, foto, serie, dados')
    .in('id', Array.from(linkedAlunoIds))

  const alunos = alunosRows || []

  // Coletar todos os possíveis IDs de turma (da coluna turma, historicoTurmas e dos grupos da agenda)
  const candidateTurmaIds = new Set<string>()
  alunos.forEach(a => {
    if (a.turma) candidateTurmaIds.add(String(a.turma))
    const htList = Array.isArray(a.dados?.historicoTurmas) ? a.dados.historicoTurmas : []
    htList.forEach((ht: any) => {
      if (ht.serieTurma) candidateTurmaIds.add(String(ht.serieTurma))
      if (ht.turmaId) candidateTurmaIds.add(String(ht.turmaId))
      if (ht.turma_id) candidateTurmaIds.add(String(ht.turma_id))
      if (ht.turma) candidateTurmaIds.add(String(ht.turma))
    })
  })

  // Também adiciona turmas dos grupos que contêm esses alunos
  allGrupos.forEach(g => {
    if (g.isEquipeEscolar) return
    const aIds = (g.alunosIds || []).map(String)
    const hasStudent = alunos.some(a => (a.id && aIds.includes(String(a.id))) || (a.dados?.codigo && aIds.includes(String(a.dados.codigo))))
    if (hasStudent) {
      if (g.turma_id) candidateTurmaIds.add(String(g.turma_id))
      const rawId = String(g.id).replace(/^sync-/, '')
      if (rawId) candidateTurmaIds.add(rawId)
    }
  })

  let turmasMap: Record<string, { id: string; nome: string; ano: number; codigo?: string }> = {}
  if (candidateTurmaIds.size > 0) {
    const idList = Array.from(candidateTurmaIds).filter(Boolean)
    const { data: turmasData } = await supabase
      .from('turmas')
      .select('id, codigo, nome, ano')
      .or(idList.map(id => `id.eq."${id}",codigo.eq."${id}",nome.eq."${id}"`).join(','))
    if (turmasData) {
      turmasData.forEach((t: any) => {
        const obj = { id: String(t.id), nome: t.nome, ano: t.ano || new Date().getFullYear(), codigo: t.codigo ? String(t.codigo) : undefined }
        turmasMap[String(t.id)] = obj
        if (t.codigo) turmasMap[String(t.codigo)] = obj
        if (t.nome) turmasMap[String(t.nome)] = obj
      })
    }
  }

  // OTIMIZAÇÃO CRÍTICA: Coletar colaboradores APENAS dos grupos relevantes para esses alunos!
  // Evita carregar e resolver todos os colaboradores da instituição inteira.
  const relevantGroups = allGrupos.filter(g => {
    if (g.isEquipeEscolar) return false
    return alunos.some(a => {
      const aIds = (g.alunosIds || []).map(String)
      if (a.id && aIds.includes(String(a.id))) return true
      if (a.dados?.codigo && aIds.includes(String(a.dados.codigo))) return true

      const allStudentTurmaRefs = new Set<string>()
      if (a.turma) {
        allStudentTurmaRefs.add(String(a.turma))
        allStudentTurmaRefs.add(`sync-${a.turma}`)
        const tInfo = turmasMap[String(a.turma)]
        if (tInfo?.nome) allStudentTurmaRefs.add(tInfo.nome)
        if (tInfo?.id) allStudentTurmaRefs.add(tInfo.id)
      }
      const htList = Array.isArray(a.dados?.historicoTurmas) ? a.dados.historicoTurmas : []
      htList.forEach((ht: any) => {
        const ref = String(ht.serieTurma || ht.turma || ht.turmaId || ht.turma_id || '').trim()
        if (ref) {
          allStudentTurmaRefs.add(ref)
          allStudentTurmaRefs.add(`sync-${ref}`)
          const tInfo = turmasMap[ref]
          if (tInfo?.nome) allStudentTurmaRefs.add(tInfo.nome)
          if (tInfo?.id) allStudentTurmaRefs.add(tInfo.id)
        }
      })

      if (g.turma_id && allStudentTurmaRefs.has(String(g.turma_id))) return true
      if (g.id && allStudentTurmaRefs.has(String(g.id))) return true
      if (g.nome && allStudentTurmaRefs.has(String(g.nome))) return true
      return false
    })
  })

  const neededColabIds = new Set<string>()
  relevantGroups.forEach(g => {
    (g.colaboradoresIds || []).forEach((cId: any) => neededColabIds.add(String(cId)))
  })

  // Buscar detalhes APENAS dos colaboradores relevantes
  const resolvedColabsList = neededColabIds.size > 0
    ? await resolveCollaboratorUsers(supabase, Array.from(neededColabIds))
    : []

  const colabMap = new Map<string, any>()
  resolvedColabsList.forEach(c => {
    colabMap.set(String(c.id), c)
    if (c.auth_id) colabMap.set(String(c.auth_id), c)
  })

  // 6. Estruturar cada aluno com sua(s) respectiva(s) turma(s) e educadores
  const students: LinkedStudent[] = []
  const allGroupIds = new Set<string>()
  const allColabIds = new Set<string>()
  const allTurmaIds = new Set<string>()
  const historicalGroupIds = new Map<string, { dataSaida: string | null }>()

  alunos.forEach(aluno => {
    const tInfo = turmasMap[String(aluno.turma)]
    const turmaNome = tInfo?.nome || aluno.turma || aluno.serie || 'Turma Oficial'
    if (aluno.turma) {
      allTurmaIds.add(String(aluno.turma))
      allTurmaIds.add(`sync-${aluno.turma}`)
    }

    const vinculos = getAlunoVinculosComPeriodo(aluno, undefined, Object.values(turmasMap))

    const studentCandidateTurmaIds = new Set<string>()
    if (aluno.turma) {
      studentCandidateTurmaIds.add(String(aluno.turma))
      studentCandidateTurmaIds.add(`sync-${aluno.turma}`)
    }
    vinculos.forEach(v => {
      if (v.turmaId) {
        studentCandidateTurmaIds.add(String(v.turmaId))
        studentCandidateTurmaIds.add(`sync-${v.turmaId}`)
      }
      if (v.turmaNome) {
        studentCandidateTurmaIds.add(String(v.turmaNome))
      }
    })

    // Achar TODOS os grupos correspondentes à(s) turma(s) do aluno (ex: regular matutino + integral/intermediário + turmas históricas)
    const matchedGrupos = sortTurmasByName(
      allGrupos.filter(g => {
        if (g.isEquipeEscolar) return false
        const aIds = (g.alunosIds || []).map(String)
        if (aluno.id && aIds.includes(String(aluno.id))) return true
        if (aluno.dados?.codigo && aIds.includes(String(aluno.dados.codigo))) return true
        if (g.turma_id && studentCandidateTurmaIds.has(String(g.turma_id))) return true
        if (g.id && studentCandidateTurmaIds.has(String(g.id))) return true
        if (g.nome && studentCandidateTurmaIds.has(String(g.nome))) return true
        const rawId = String(g.id || '').replace(/^sync-/, '')
        if (rawId && studentCandidateTurmaIds.has(rawId)) return true
        return false
      })
    )

    const turmaGrupos: LinkedStudentTurmaGrupo[] = matchedGrupos.map(mg => {
      allGroupIds.add(mg.id)
      const rawTurmaId = String(mg.turma_id || mg.id || '').replace(/^sync-/, '')
      if (rawTurmaId) {
        allTurmaIds.add(rawTurmaId)
        allTurmaIds.add(`sync-${rawTurmaId}`)
      }
      if (mg.turma_id) {
        allTurmaIds.add(String(mg.turma_id))
      }

      const groupTInfo = turmasMap[rawTurmaId] || (mg.turma_id ? turmasMap[mg.turma_id] : null)
      const groupTurmaNome = mg.nome || groupTInfo?.nome || turmaNome

      // Determinar se o grupo é histórico vs ativo
      const activeVinculo = vinculos.find(v => v.isCursando && (
        String(v.turmaId) === rawTurmaId || v.turmaNome === groupTurmaNome || (mg.turma_id && String(v.turmaId) === String(mg.turma_id))
      ))
      const histVinculo = vinculos.find(v => !v.isCursando && (
        String(v.turmaId) === rawTurmaId || v.turmaNome === groupTurmaNome || (mg.turma_id && String(v.turmaId) === String(mg.turma_id))
      ))

      const isHistorico = !activeVinculo && Boolean(histVinculo)
      const dataSaida = isHistorico ? (histVinculo?.dataFim || null) : null
      const dataInicio = activeVinculo ? activeVinculo.dataInicio : (histVinculo?.dataInicio || null)

      if (isHistorico) {
        historicalGroupIds.set(String(mg.id), { dataSaida })
        if (mg.turma_id) historicalGroupIds.set(String(mg.turma_id), { dataSaida })
        if (rawTurmaId) historicalGroupIds.set(rawTurmaId, { dataSaida })
      }

      return {
        id: mg.id,
        nome: groupTurmaNome,
        cor: mg.cor || '#10b981',
        tipo: 'turma',
        turma_id: mg.turma_id || rawTurmaId,
        ano_letivo: mg.dados?.ano || mg.dados?.ano_letivo || groupTInfo?.ano || tInfo?.ano || '2026',
        membrosCount: mg.colaboradoresIds.length,
        colaboradoresIds: mg.colaboradoresIds,
        descricao: isHistorico ? `Turma anterior: ${groupTurmaNome}` : `Turma oficial: ${groupTurmaNome}`,
        isHistorico,
        dataSaida,
        dataInicio
      }
    })

    // Ordenar turmaGrupos para que os ativos fiquem na frente
    turmaGrupos.sort((a, b) => {
      if (a.isHistorico && !b.isHistorico) return 1
      if (!a.isHistorico && b.isHistorico) return -1
      return 0
    })

    const turmaGrupo = turmaGrupos.find(g => !g.isHistorico) || turmaGrupos[0] || null

    // Mapear todas as turmas que cada colaborador leciona para este aluno
    const colabTurmasMap = new Map<string, string[]>()
    matchedGrupos.forEach(mg => {
      if (mg.colaboradoresIds && mg.colaboradoresIds.length > 0) {
        mg.colaboradoresIds.forEach((colabId: any) => {
          allColabIds.add(String(colabId))
          const found = colabMap.get(String(colabId))
          if (found?.auth_id) allColabIds.add(String(found.auth_id))
          if (found?.id) allColabIds.add(String(found.id))
          const sColabId = String(colabId)
          const list = colabTurmasMap.get(sColabId) || []
          const gName = mg.nome || turmaNome
          if (gName && !list.includes(gName)) {
            list.push(gName)
          }
          colabTurmasMap.set(sColabId, list)
        })
      }
    })

    const studentColabs: LinkedStudent['colaboradores'] = []
    const seenColabIds = new Set<string>()

    matchedGrupos.forEach(mg => {
      if (mg.colaboradoresIds && mg.colaboradoresIds.length > 0) {
        mg.colaboradoresIds.forEach((colabId: any) => {
          const sColabId = String(colabId)
          if (!seenColabIds.has(sColabId)) {
            seenColabIds.add(sColabId)
            const found = colabMap.get(sColabId)
            if (found) {
              const myTurmas = colabTurmasMap.get(sColabId) || [mg.nome || turmaNome]
              myTurmas.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
              studentColabs.push({
                id: found.id,
                nome: found.nome,
                cargo: found.cargo || 'Educador(a)',
                perfil: found.perfil || 'Colaborador',
                foto: (found as any).foto || null,
                isTurmaColab: true,
                turmaNome: myTurmas[0],
                turmas: myTurmas,
                alunoId: aluno.id,
                alunoNome: aluno.nome
              })
            }
          }
        })
      }
    })

    // Ordenar colaboradores por nome
    studentColabs.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

    students.push({
      id: aluno.id,
      nome: aluno.nome,
      turma: aluno.turma,
      turmaNome,
      turmaAno: tInfo?.ano || matchedGrupos[0]?.dados?.ano || '2026',
      foto: aluno.foto || null,
      serie: aluno.serie,
      turmaGrupo,
      turmaGrupos,
      colaboradores: studentColabs
    })
  })

  // Ordenar alunos alfabeticamente
  students.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  return {
    isFamilyOrStudent: true,
    isAdmin: false,
    students,
    allStudentIds: linkedAlunoIds,
    allTurmaIds,
    allGroupIds,
    allColabIds,
    historicalGroupIds,
    equipeEscolarGroups,
    candidateUserIds
  }
}
