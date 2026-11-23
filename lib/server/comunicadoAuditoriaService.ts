import { supabaseServer } from '@/lib/supabaseServer'
import { getAllAuthUsersCached } from '@/lib/server/supabaseAdminSingleton'
import {
  getCachedTurmasAndGrupos,
  getCachedEquipes,
  getCachedActiveAlunos,
  getCachedSystemUsers,
  getCachedFuncionarios,
} from '@/lib/server/turmasGruposCache'
import { fetchDeliveriesForContentIds, type DeliveryRow } from '@/lib/server/comunicadoDeliveryService'
import {
  isAlunoCursandoTurma,
  canStudentReceiveTurmaContent,
  getAlunoTurmaCursando,
  compareTurmasBySerie,
} from '@/lib/studentTurmaUtils'

export type DeliveryState = 'read' | 'received' | 'sent' | 'no_channel'

export interface AuditoriaResponsavel {
  id: string
  nome: string
  parentesco: string
  avatarUrl?: string | null
  email?: string | null
  telefone?: string | null
  isFinanceiro: boolean
  isPedagogico: boolean
  temContaAtiva: boolean
  statusConta: 'active' | 'never_activated' | 'no_email'
  status: DeliveryState
  recebeu: boolean
  recebeuEm?: string | null
  canalRecebimento?: 'push' | 'app' | 'push_e_app' | null
  leu: boolean
  leuEm?: string | null
  ciente: boolean
  cienteEm?: string | null
}

export interface AuditoriaAluno {
  id: string
  plainId: string
  nome: string
  matricula?: string | null
  turmaId?: string | null
  turmaNome: string
  avatarUrl?: string | null
  status: DeliveryState
  recebeu: boolean
  recebeuEm?: string | null
  leu: boolean
  leuEm?: string | null
  alunoProprioLeu: boolean
  alunoProprioLeuEm?: string | null
  ciente: boolean
  cienteEm?: string | null
  stuComunicadoId?: string | null
  hasIndividualReport?: boolean
  responsaveis: AuditoriaResponsavel[]
}

export interface AuditoriaTurma {
  id: string
  nome: string
  cor?: string | null
  isPartial: boolean
  totalAlunos: number
  leramCount: number
  receberamCount: number
  pendentesCount: number
  semAcessoCount: number
  cientesCount: number
  alunos: AuditoriaAluno[]
}

export interface AuditoriaColaborador {
  id: string
  nome: string
  cargo: string
  avatarUrl?: string | null
  email?: string | null
  temContaAtiva: boolean
  status: DeliveryState
  recebeu: boolean
  recebeuEm?: string | null
  canalRecebimento?: 'push' | 'app' | 'push_e_app' | null
  leu: boolean
  leuEm?: string | null
}

export interface AuditoriaGrupo {
  id: string
  nome: string
  isEquipeEscolar: boolean
  totalMembros: number
  leramCount: number
  receberamCount: number
  colaboradores: AuditoriaColaborador[]
  alunosCount: number
}

export interface ComunicadoAuditoriaResponse {
  comunicado: {
    id: string
    titulo: string
    autor: string
    autorCargo?: string | null
    dataEnvio: string
    status: string
    destino: string
    exigeCiencia: boolean
    isReport: boolean
    isIndividual: boolean
    isGlobal: boolean
    lembretesCount: number
    ultimoLembreteEm?: string | null
  }
  permissions: {
    canSendReminder: boolean
    canEditReport: boolean
  }
  resumo: {
    totalAlunos: number
    alunosLeram: number
    alunosReceberam: number
    alunosReceberamSemLer: number
    alunosPendentes: number
    alunosSemAcesso: number
    alunosCientes: number
    totalResponsaveis: number
    responsaveisLeram: number
    responsaveisReceberam: number
    totalColaboradores: number
    colaboradoresLeram: number
    colaboradoresReceberam: number
    pushResumo: {
      totalDisparos: number
      enviados: number
      semAparelho: number
      falhas: number
      pausados: number
    }
  }
  turmas: AuditoriaTurma[]
  grupos: AuditoriaGrupo[]
  colaboradores: AuditoriaColaborador[]
}

function normalizeText(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function cleanStudentKey(val: any): string {
  return String(val || '')
    .replace(/^(?:a_|_ALU|_)/i, '')
    .trim()
}

function stripLeadingZeros(val: string): string {
  const s = val.replace(/^0+/, '')
  return s || val
}

function cleanStaffKey(val: any): string {
  return String(val || '')
    .replace(/^(?:f_|func_)/i, '')
    .trim()
    .toLowerCase()
}

function parseJsonField<T = any>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T
    } catch {
      return fallback
    }
  }
  return val as T
}

async function fetchInChunks<T>(
  table: string,
  select: string,
  column: string,
  values: string[],
  chunkSize = 120
): Promise<T[]> {
  if (!values || values.length === 0) return []
  const results: T[] = []
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize)
    const { data, error } = await supabaseServer.from(table).select(select).in(column, chunk)
    if (!error && Array.isArray(data)) {
      results.push(...(data as T[]))
    }
  }
  return results
}

function formatPhone(raw?: string | null): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return String(raw).trim() || null
}

function pickEarliestIso(a?: string | null, b?: string | null): string | null {
  if (!a) return b || null
  if (!b) return a || null
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b
}

function pickLatestIso(a?: string | null, b?: string | null): string | null {
  if (!a) return b || null
  if (!b) return a || null
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

function extractExplicitStudentIdsFromComunicado(comId: string, com: any, dados: any): Set<string> {
  const result = new Set<string>()
  const addId = (raw: any) => {
    const c = cleanStudentKey(raw)
    if (c) result.add(c)
  }

  const arr1 = Array.isArray(dados?.alunosIds) ? dados.alunosIds : (Array.isArray(com?.alunosIds) ? com.alunosIds : [])
  arr1.forEach(addId)

  const arr2 = Array.isArray(dados?.stu_target_ids) ? dados.stu_target_ids : (Array.isArray(com?.stu_target_ids) ? com.stu_target_ids : [])
  arr2.forEach(addId)

  const stuIds = Array.isArray(dados?.stuIds) ? dados.stuIds : []
  stuIds.forEach((sId: any) => {
    const m = String(sId).match(/AD-COM-REL-STU-\d+-([^-]+)-/)
    if (m && m[1]) addId(m[1])
  })

  if (comId.startsWith('AD-COM-REL-STU-')) {
    const m = comId.match(/AD-COM-REL-STU-\d+-([^-]+)-/)
    if (m && m[1]) addId(m[1])
  }

  const anexos = Array.isArray(dados?.anexos) ? dados.anexos : []
  anexos.forEach((anx: any) => {
    if (typeof anx !== 'string' || !anx.includes('payload:')) return
    try {
      const pPart = anx.split('|').find((p: string) => p.startsWith('payload:'))
      if (pPart) {
        const parsed = JSON.parse(pPart.substring(8))
        const pStuId = parsed?.studentInfo?.id || Object.keys(parsed?.values || {})[0] || ''
        if (pStuId) addId(pStuId)
      }
    } catch {}
  })

  return result
}

async function resolveStuMapForConsolidatedReport(
  comId: string,
  existingCom: any,
  dados: Record<string, any>
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  const registerStuId = (rawStuId: string) => {
    const match = String(rawStuId).match(/^AD-COM-REL-STU-\d+-([^-]+)-/i)
    if (match && match[1]) {
      const stuAlunoId = cleanStudentKey(match[1])
      map.set(stuAlunoId, String(rawStuId))
      map.set(stripLeadingZeros(stuAlunoId), String(rawStuId))
    }
  }

  if (Array.isArray(dados?.stuIds) && dados.stuIds.length > 0) {
    const candidateIds = dados.stuIds.map(String).filter(Boolean)
    const existingStus = await fetchInChunks<{ id: string }>('comunicados', 'id', 'id', candidateIds)
    existingStus.forEach(row => registerStuId(String(row.id)))
    if (map.size > 0) return map
  }

  try {
    const idMatch = String(comId).match(/AD-COM-REL-[A-Za-z]+-(\d+)/)
    const colabTs = idMatch ? parseInt(idMatch[1], 10) : null
    const baseTime =
      colabTs ||
      (existingCom?.created_at ? new Date(existingCom.created_at).getTime() : null) ||
      (dados?.dataEnvio ? new Date(dados.dataEnvio).getTime() : Date.now())

    const minDate = new Date(baseTime - 15 * 60000).toISOString()
    const maxDate = new Date(baseTime + 15 * 60000).toISOString()
    const { data: stusByDate } = await supabaseServer
      .from('comunicados')
      .select('id, autor, created_at')
      .ilike('id', 'AD-COM-REL-STU-%')
      .gte('created_at', minDate)
      .lte('created_at', maxDate)

    const colabAutorNorm = normalizeText(existingCom?.autor || dados?.autor || '')
    for (const s of stusByDate || []) {
      const sMatch = String(s.id).match(/AD-COM-REL-STU-(\d+)/)
      const sTs = sMatch ? parseInt(sMatch[1], 10) : null
      const sameAutor = !colabAutorNorm || !s.autor || normalizeText(s.autor) === colabAutorNorm
      if (sameAutor && (!colabTs || !sTs || Math.abs(sTs - colabTs) < 60_000)) {
        registerStuId(String(s.id))
      }
    }
  } catch (err) {
    console.warn('[Auditoria Destinatários] Falha ao resolver relatórios individuais:', err)
  }

  return map
}

function isEquipeEscolarGrupo(g: any): boolean {
  if (!g) return false
  const gd = g.dados || g
  if (
    gd.isEquipeEscolar === true ||
    gd.isEquipeEscolar === 'true' ||
    gd.isEquipeEscolar === 1 ||
    gd.ano === 'Equipe Escolar'
  ) {
    return true
  }
  const n = normalizeText(gd.nome || g.nome || '')
  if (
    n.includes('coordenacao') ||
    n.includes('direcao') ||
    n.includes('secretaria') ||
    n.includes('financeiro') ||
    n.includes('inspetor') ||
    n.includes('recepcao') ||
    n.includes('portaria') ||
    n.includes('limpeza') ||
    n.includes('equipe escolar') ||
    n.includes('equipe pedagogica') ||
    n.includes('professores') ||
    n.includes('docentes') ||
    n.includes('colaboradores')
  ) {
    return true
  }
  const cIds = parseJsonField<any[]>(gd.colaboradoresIds, [])
  const aIds = parseJsonField<any[]>(gd.alunosIds, [])
  return Array.isArray(cIds) && cIds.length > 0 && (!Array.isArray(aIds) || aIds.length === 0)
}

export async function buildComunicadoAuditoria(
  comId: string,
  viewerContext: { userId: string; dbUser?: any; perfil?: string; cargo?: string }
): Promise<{ data?: ComunicadoAuditoriaResponse; error?: string; status?: number }> {
  const { data: comRow, error: comErr } = await supabaseServer
    .from('comunicados')
    .select('id, titulo, texto, autor, data, destino, fixado, dados, created_at')
    .eq('id', comId)
    .maybeSingle()

  if (comErr) {
    return { error: comErr.message, status: 500 }
  }
  if (!comRow) {
    return { error: 'Comunicado não encontrado.', status: 404 }
  }

  const dados = parseJsonField<Record<string, any>>(comRow.dados, {})
  const comStatus = String(dados.status || 'enviado').toLowerCase().trim()
  const dataEnvio = String(dados.dataEnvio || comRow.data || comRow.created_at || new Date().toISOString())
  const destinoRaw = String(comRow.destino || dados.destino || '').trim()
  const destinoNorm = destinoRaw.toLowerCase()

  const isIndividualStudentReport = Boolean(
    comId.startsWith('AD-COM-REL-STU-') || dados.tipoRelatorio === 'individual'
  )
  const isConsolidatedReport = Boolean(
    comId.startsWith('AD-COM-REL-COLAB-') ||
      comId.startsWith('AD-COM-REL-TURMA-') ||
      (comId.startsWith('AD-COM-REL-') && !comId.startsWith('AD-COM-REL-STU-'))
  )
  const isReport = isConsolidatedReport || isIndividualStudentReport || dados.tipo === 'relatorio'

  // Permissões do visualizador
  const viewerPerfilNorm = normalizeText(viewerContext.dbUser?.perfil || viewerContext.perfil)
  const viewerCargoNorm = normalizeText(viewerContext.dbUser?.cargo || viewerContext.cargo)
  const adminRoles = [
    'administrador',
    'admin',
    'administrador master',
    'master',
    'diretor geral',
    'diretora geral',
    'diretor',
    'diretora',
    'direcao',
    'diretoria',
    'coordenador',
    'coordenadora',
    'coordenador(a) pedagogico(a)',
    'gestor',
    'auxiliar administrativo',
  ]
  const isAdmin = adminRoles.some(
    r =>
      viewerPerfilNorm === r ||
      viewerCargoNorm === r ||
      viewerPerfilNorm.includes('administrador') ||
      viewerCargoNorm.includes('administrador master') ||
      viewerPerfilNorm.includes('diretor geral') ||
      viewerCargoNorm.includes('diretor geral') ||
      viewerPerfilNorm.includes('coordenad') ||
      viewerCargoNorm.includes('coordenad')
  )
  const viewerStaffIds = new Set(
    [
      viewerContext.userId,
      viewerContext.dbUser?.id,
      viewerContext.dbUser?.auth_id,
      viewerContext.dbUser?.dados?.colaborador_id,
      viewerContext.dbUser?.dados?.uid_legacy,
    ]
      .filter(Boolean)
      .map(cleanStaffKey)
  )
  const viewerNameNorm = normalizeText(viewerContext.dbUser?.nome)
  const comAutorKey = cleanStaffKey(dados.autorId || dados.autor_id)
  const comAutorNameNorm = normalizeText(comRow.autor || dados.autorNome || dados.autor)
  const isAuthor = Boolean(
    (comAutorKey && viewerStaffIds.has(comAutorKey)) ||
      (viewerNameNorm && comAutorNameNorm && (viewerNameNorm === comAutorNameNorm || viewerNameNorm.includes(comAutorNameNorm)))
  )

  const canSendReminder = Boolean(
    (isAdmin || isAuthor) && comStatus !== 'rascunho' && comStatus !== 'agendado'
  )
  const canEditReport = Boolean(isAdmin || isAuthor)

  // Carregar dados base em paralelo (caches em memória no servidor)
  const [
    { allTurmas, allGrupos },
    allEquipes,
    cachedActiveAlunos,
    sysUsers,
    funcionarios,
    authUsers,
    stuComIdByAlunoId,
  ] = await Promise.all([
    getCachedTurmasAndGrupos(),
    getCachedEquipes().catch(() => [] as any[]),
    getCachedActiveAlunos(),
    getCachedSystemUsers().catch(() => [] as any[]),
    getCachedFuncionarios().catch(() => [] as any[]),
    getAllAuthUsersCached().catch(() => [] as any[]),
    isConsolidatedReport
      ? resolveStuMapForConsolidatedReport(comId, comRow, dados)
      : Promise.resolve(new Map<string, string>()),
  ])

  const targetTurmasRaw: string[] = Array.isArray(dados.turmas) ? [...dados.turmas] : []
  const explicitTurmasIds: string[] = Array.isArray(dados.turmasIds) ? dados.turmasIds.map(String) : []
  if (dados.turmaId && !targetTurmasRaw.includes(String(dados.turmaId))) {
    targetTurmasRaw.push(String(dados.turmaId))
  }
  const targetGruposNames: string[] = Array.isArray(dados.grupos) ? dados.grupos : []
  const targetFuncsIdsRaw: any[] = [
    ...(Array.isArray(dados.funcionariosIds) ? dados.funcionariosIds : []),
    ...(Array.isArray(dados.colaboradoresIds) ? dados.colaboradoresIds : []),
  ]
  const explicitStudentIds = extractExplicitStudentIdsFromComunicado(comId, comRow, dados)
  stuComIdByAlunoId.forEach((_stuComId, stuAlunoKey) => {
    const clean = cleanStudentKey(stuAlunoKey)
    if (clean) explicitStudentIds.add(clean)
  })

  const isGlobal = destinoNorm === 'todos'
  const isInterno = destinoNorm === 'interno' || destinoNorm === 'funcionarios'

  // Garantir acesso aos alunos explicitamente marcados mesmo que algum esteja inativo/transferido
  const activeAlunosByCleanId = new Map<string, any>()
  cachedActiveAlunos.forEach(a => {
    const c = cleanStudentKey(a.id)
    if (c) activeAlunosByCleanId.set(c, a)
  })
  const missingExplicitIds = Array.from(explicitStudentIds).filter(id => !activeAlunosByCleanId.has(id))
  let allAlunos = [...cachedActiveAlunos]
  if (missingExplicitIds.length > 0) {
    const extraAlunos = await fetchInChunks<any>(
      'alunos',
      'id, nome, matricula, turma, serie, turno, unidade, status, foto, foto_url, codigo, dados',
      'id',
      missingExplicitIds
    )
    extraAlunos.forEach(a => {
      const c = cleanStudentKey(a.id)
      if (c && !activeAlunosByCleanId.has(c)) {
        activeAlunosByCleanId.set(c, a)
        allAlunos.push(a)
      }
    })
  }

  // Resolver grupos alvo (turma/alunos vs equipe escolar)
  const normalizedGrupos = (allGrupos || []).map((g: any) => ({
    ...g,
    ...(g.dados || {}),
    id: String(g.id),
    nome: String(g.dados?.nome || g.nome || ''),
  }))
  const normalizedEquipes = (allEquipes || []).map((e: any) => ({
    ...e,
    ...(e.dados || {}),
    id: String(e.id),
    nome: String(e.dados?.nome || e.nome || ''),
    isEquipeEscolar: true,
  }))

  const matchedGruposRaw = [...normalizedGrupos, ...normalizedEquipes].filter(g => {
    const gNome = normalizeText(g.nome)
    const gId = String(g.id).toLowerCase()
    return targetGruposNames.some(tg => {
      const tNorm = normalizeText(tg)
      return tNorm === gNome || tNorm === gId || tNorm === `g_${gId}` || tNorm === `eq_${gId}`
    })
  })
  const matchedGruposByName = new Map<string, any>()
  matchedGruposRaw.forEach(g => {
    const key = normalizeText(g.nome) || String(g.id)
    if (!matchedGruposByName.has(key)) {
      matchedGruposByName.set(key, g)
    } else {
      // Merge membros/alunos caso exista em ambas as tabelas (agenda_grupos e agenda_equipes)
      const prev = matchedGruposByName.get(key)
      const mergedColabs = Array.from(
        new Set([
          ...parseJsonField<any[]>(prev.colaboradoresIds || prev.membrosIds || prev.funcionariosIds, []),
          ...parseJsonField<any[]>(g.colaboradoresIds || g.membrosIds || g.funcionariosIds, []),
        ])
      )
      const mergedAlunos = Array.from(
        new Set([
          ...parseJsonField<any[]>(prev.alunosIds, []),
          ...parseJsonField<any[]>(g.alunosIds, []),
        ])
      )
      matchedGruposByName.set(key, {
        ...prev,
        colaboradoresIds: mergedColabs,
        alunosIds: mergedAlunos,
      })
    }
  })
  const matchedGrupos = Array.from(matchedGruposByName.values())

  const grupoAlunosIds = new Set<string>()
  const grupoFuncsIds = new Set<string>()
  matchedGrupos.forEach(g => {
    const aIds = parseJsonField<any[]>(g.alunosIds, [])
    aIds.forEach(id => {
      const c = cleanStudentKey(id)
      if (c) grupoAlunosIds.add(c)
    })
    const cIds = parseJsonField<any[]>(g.colaboradoresIds || g.membrosIds || g.funcionariosIds, [])
    cIds.forEach(id => {
      const c = cleanStaffKey(id)
      if (c) grupoFuncsIds.add(c)
    })
  })

  // Mapear turmas do sistema
  const turmaByIdOrName = new Map<string, any>()
  const turmaObjects = (allTurmas || []).map((t: any) => {
    const obj = {
      ...t,
      ...(t.dados || {}),
      id: String(t.id),
      nome: String(t.dados?.nome || t.nome || ''),
      codigo: t.codigo ? String(t.codigo) : (t.dados?.codigo ? String(t.dados.codigo) : ''),
      ano: t.ano || t.dados?.anoLetivo || '',
      cor: t.dados?.cor || t.cor || null,
    }
    if (obj.id) turmaByIdOrName.set(obj.id.toLowerCase(), obj)
    if (obj.codigo) turmaByIdOrName.set(obj.codigo.toLowerCase(), obj)
    if (obj.nome) turmaByIdOrName.set(normalizeText(obj.nome), obj)
    return obj
  })

  // Sincronizar grupos de turma (para pegar cor / alunos vinculados manualmente no grupo da turma)
  const turmaSyncGroupByTurmaKey = new Map<string, any>()
  normalizedGrupos
    .filter(g => !isEquipeEscolarGrupo(g))
    .forEach(g => {
      const syncId = String(g.syncId || (String(g.id).startsWith('sync-') ? g.id : ''))
      const rawId = syncId ? syncId.replace(/^sync-/, '') : g.id
      if (rawId) turmaSyncGroupByTurmaKey.set(String(rawId).toLowerCase(), g)
      if (g.nome) turmaSyncGroupByTurmaKey.set(normalizeText(g.nome), g)
    })

  const matchedTargetTurmas = turmaObjects.filter(t => {
    return (
      targetTurmasRaw.some(tr => {
        const trNorm = normalizeText(tr)
        return trNorm === normalizeText(t.nome) || String(tr) === t.id || (t.codigo && String(tr) === t.codigo)
      }) || explicitTurmasIds.includes(t.id)
    )
  })
  const matchedTargetTurmasIds = new Set(matchedTargetTurmas.map(t => t.id))

  // Resolver lista final de Alunos alvo e em qual Turma cada aluno aparece
  const selectedStudentsMap = new Map<string, { aluno: any; turmaObj: any | null; turmaNome: string; isPartial: boolean }>()

  const resolveTurmaForAluno = (a: any): { turmaObj: any | null; turmaNome: string } => {
    // 1. Se o comunicado especificou turmas alvo, prioriza a turma alvo em que o aluno está/estava matriculado
    for (const t of matchedTargetTurmas) {
      if (
        String(a.turma || '') === t.id ||
        normalizeText(a.turma) === normalizeText(t.nome) ||
        isAlunoCursandoTurma(a, t, t.ano) ||
        canStudentReceiveTurmaContent(a, t.nome || t.id, dataEnvio, turmaObjects)
      ) {
        return { turmaObj: t, turmaNome: t.nome }
      }
    }
    // 2. Caso contrário, resolve a turma atual do aluno
    const cursandoRef = getAlunoTurmaCursando(a) || String(a.turma || '').trim()
    const foundT =
      turmaByIdOrName.get(cursandoRef.toLowerCase()) ||
      turmaByIdOrName.get(normalizeText(cursandoRef)) ||
      null
    if (foundT) return { turmaObj: foundT, turmaNome: foundT.nome }
    return {
      turmaObj: null,
      turmaNome: String(dados.turma_nome || cursandoRef || 'Sem Turma Definida'),
    }
  }

  if (!isInterno || isConsolidatedReport || (isReport && explicitStudentIds.size > 0)) {
    if (isReport && explicitStudentIds.size > 0) {
      // Relatórios (consolidado ou individual): exibe exatamente os alunos que possuem relatório individual
      allAlunos.forEach(a => {
        const plainId = cleanStudentKey(a.id)
        if (!explicitStudentIds.has(plainId)) return
        const { turmaObj, turmaNome } = resolveTurmaForAluno(a)
        selectedStudentsMap.set(plainId, {
          aluno: a,
          turmaObj,
          turmaNome,
          isPartial: true,
        })
      })
    } else if (isGlobal) {
      allAlunos.forEach(a => {
        const plainId = cleanStudentKey(a.id)
        const { turmaObj, turmaNome } = resolveTurmaForAluno(a)
        selectedStudentsMap.set(plainId, {
          aluno: a,
          turmaObj,
          turmaNome,
          isPartial: false,
        })
      })
    } else {
      // 1. Alunos de turmas selecionadas (respeitando histórico de matrícula na data do comunicado)
      if (matchedTargetTurmas.length > 0 || targetTurmasRaw.length > 0) {
        allAlunos.forEach(a => {
          const plainId = cleanStudentKey(a.id)
          const matchedT = matchedTargetTurmas.find(t => {
            if (isAlunoCursandoTurma(a, t, t.ano)) return true
            if (String(a.turma || '') === t.id || normalizeText(a.turma) === normalizeText(t.nome)) return true
            return canStudentReceiveTurmaContent(a, t.nome || t.id, dataEnvio, turmaObjects)
          })
          const matchedRawTurma = !matchedT
            ? targetTurmasRaw.find(tr => canStudentReceiveTurmaContent(a, tr, dataEnvio, turmaObjects))
            : null

          if (matchedT) {
            selectedStudentsMap.set(plainId, {
              aluno: a,
              turmaObj: matchedT,
              turmaNome: matchedT.nome,
              isPartial: false,
            })
          } else if (matchedRawTurma) {
            selectedStudentsMap.set(plainId, {
              aluno: a,
              turmaObj: null,
              turmaNome: matchedRawTurma,
              isPartial: false,
            })
          }
        })

        // Incluir também alunos vinculados manualmente no grupo da turma
        matchedTargetTurmas.forEach(t => {
          const syncGrp =
            turmaSyncGroupByTurmaKey.get(t.id.toLowerCase()) ||
            turmaSyncGroupByTurmaKey.get(normalizeText(t.nome))
          if (syncGrp) {
            const gAIds = parseJsonField<any[]>(syncGrp.alunosIds, [])
            gAIds.forEach(rawId => {
              const plain = cleanStudentKey(rawId)
              if (plain && !selectedStudentsMap.has(plain)) {
                const aObj = activeAlunosByCleanId.get(plain)
                if (aObj) {
                  selectedStudentsMap.set(plain, {
                    aluno: aObj,
                    turmaObj: t,
                    turmaNome: t.nome,
                    isPartial: false,
                  })
                }
              }
            })
          }
        })
      }

      // 2. Alunos de grupos selecionados
      if (grupoAlunosIds.size > 0) {
        allAlunos.forEach(a => {
          const plainId = cleanStudentKey(a.id)
          if (grupoAlunosIds.has(plainId) && !selectedStudentsMap.has(plainId)) {
            const { turmaObj, turmaNome } = resolveTurmaForAluno(a)
            selectedStudentsMap.set(plainId, {
              aluno: a,
              turmaObj,
              turmaNome,
              isPartial: true,
            })
          }
        })
      }

      // 3. Alunos explicitamente marcados (comunicados individuais ou mistos)
      if (explicitStudentIds.size > 0) {
        allAlunos.forEach(a => {
          const plainId = cleanStudentKey(a.id)
          if (explicitStudentIds.has(plainId) && !selectedStudentsMap.has(plainId)) {
            const { turmaObj, turmaNome } = resolveTurmaForAluno(a)
            selectedStudentsMap.set(plainId, {
              aluno: a,
              turmaObj,
              turmaNome,
              isPartial: true,
            })
          }
        })
      }
    }
  }

  // Verificar se cada turma listada foi seleção parcial (ex.: apenas alguns alunos) ou turma inteira
  if (isReport && explicitStudentIds.size > 0) {
    // Em relatórios, se nem todos os alunos ativos da turma receberam, marca como parcial
    const totalPorTurma = new Map<string, number>()
    cachedActiveAlunos.forEach(a => {
      const { turmaNome } = resolveTurmaForAluno(a)
      const k = normalizeText(turmaNome)
      totalPorTurma.set(k, (totalPorTurma.get(k) || 0) + 1)
    })
    const selPorTurma = new Map<string, number>()
    selectedStudentsMap.forEach(entry => {
      const k = normalizeText(entry.turmaNome)
      selPorTurma.set(k, (selPorTurma.get(k) || 0) + 1)
    })
    selectedStudentsMap.forEach(entry => {
      const k = normalizeText(entry.turmaNome)
      const totalAtivos = totalPorTurma.get(k) || 0
      const qtdSel = selPorTurma.get(k) || 0
      entry.isPartial = totalAtivos > 0 && qtdSel < totalAtivos
    })
  }

  // Mapear IDs de referência de todos os alunos selecionados para buscar vínculos com responsáveis
  const selectedStudentsList = Array.from(selectedStudentsMap.values())
  const stuRefToPlainId = new Map<string, string>()
  const allStuRefs = new Set<string>()
  selectedStudentsList.forEach(({ aluno }) => {
    const plainId = cleanStudentKey(aluno.id)
    const refs = [
      String(aluno.id),
      plainId,
      stripLeadingZeros(plainId),
      aluno.matricula ? String(aluno.matricula).trim() : '',
      aluno.codigo ? String(aluno.codigo).trim() : '',
      aluno.dados?.codigo ? String(aluno.dados.codigo).trim() : '',
    ].filter(Boolean)
    refs.forEach(r => {
      allStuRefs.add(r)
      stuRefToPlainId.set(r.toLowerCase(), plainId)
    })
  })

  // Content IDs a consultar para leituras, entregas, ciências e push logs
  const stuComIds = Array.from(new Set(Array.from(stuComIdByAlunoId.values())))
  const allContentIds = Array.from(new Set([comId, ...stuComIds]))

  // Gerar possíveis item_ids da tabela agenda_push_logs
  const pushLogItemIds = new Set<string>([comId, `${comId}_perfil_colaborador`])
  selectedStudentsList.forEach(({ aluno }) => {
    const rawId = String(aluno.id)
    const plainId = cleanStudentKey(rawId)
    const targetStuComId =
      stuComIdByAlunoId.get(plainId) ||
      stuComIdByAlunoId.get(stripLeadingZeros(plainId)) ||
      comId
    pushLogItemIds.add(`${targetStuComId}_aluno_${rawId}`)
    pushLogItemIds.add(`${targetStuComId}_aluno_${plainId}`)
    pushLogItemIds.add(`${comId}_aluno_${rawId}`)
    pushLogItemIds.add(`${comId}_aluno_${plainId}`)
    pushLogItemIds.add(targetStuComId)
  })

  // Buscar vínculos, leituras, ciências, entregas no feed e push logs em PARALELO
  const [vinculos, readRows, cienciaRows, deliveryRows, pushLogRows] = await Promise.all([
    allStuRefs.size > 0
      ? fetchInChunks<any>(
          'aluno_responsavel',
          'aluno_id, responsavel_id, parentesco, resp_financeiro, resp_pedagogico, resp_outro',
          'aluno_id',
          Array.from(allStuRefs)
        )
      : Promise.resolve([] as any[]),
    fetchInChunks<any>(
      'agenda_notification_reads',
      'content_id, usuario_id, read_at, aluno_id, perfil',
      'content_id',
      allContentIds
    ),
    datosRequiresCiencia(dados)
      ? fetchInChunks<any>(
          'agenda_ciencias',
          'content_id, usuario_id, ciente_em, aluno_id',
          'content_id',
          allContentIds
        )
      : Promise.resolve([] as any[]),
    fetchDeliveriesForContentIds(allContentIds),
    fetchInChunks<any>(
      'agenda_push_logs',
      'id, item_id, status, onesignal_response, created_at, target_count, error_message',
      'item_id',
      Array.from(pushLogItemIds)
    ),
  ])

  // Buscar registros de responsáveis vinculados
  const rawRespIds = Array.from(
    new Set(
      vinculos
        .map((v: any) => String(v.responsavel_id || '').trim())
        .filter(Boolean)
    )
  )
  const expandedRespIds = Array.from(
    new Set(
      rawRespIds.flatMap(id => {
        const noZ = stripLeadingZeros(id)
        const padded = !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : ''
        return [id, noZ, padded].filter(Boolean)
      })
    )
  )
  const responsaveisRows =
    expandedRespIds.length > 0
      ? await fetchInChunks<any>(
          'responsaveis',
          'id, nome, email, telefone, celular, auth_id, dados',
          'id',
          expandedRespIds
        )
      : []

  // Índices rápidos de authUsers e system_users para determinar conta ativa e último acesso
  const authByEmail = new Map<string, any>()
  const authById = new Map<string, any>()
  const authByRespId = new Map<string, any>()
  const authByPhone = new Map<string, any>()
  ;(authUsers || []).forEach((u: any) => {
    if (u.id) authById.set(String(u.id).toLowerCase(), u)
    const em = String(u.email || u.user_metadata?.email || '').trim().toLowerCase()
    if (em) authByEmail.set(em, u)
    const mr = String(u.user_metadata?.responsavel_id || u.user_metadata?.responsavelId || '').trim()
    if (mr) {
      authByRespId.set(mr.toLowerCase(), u)
      authByRespId.set(stripLeadingZeros(mr).toLowerCase(), u)
    }
    const ph = String(u.phone || u.user_metadata?.telefone || u.user_metadata?.celular || '').replace(/\D/g, '').slice(-8)
    if (ph.length >= 8) authByPhone.set(ph, u)
  })

  const sysByEmail = new Map<string, any>()
  const sysById = new Map<string, any>()
  const sysByAuthId = new Map<string, any>()
  const sysByRespId = new Map<string, any>()
  ;(sysUsers || []).forEach((su: any) => {
    if (su.id) {
      sysById.set(String(su.id).toLowerCase(), su)
      sysById.set(cleanStaffKey(su.id), su)
    }
    if (su.auth_id) sysByAuthId.set(String(su.auth_id).toLowerCase(), su)
    const em = String(su.email || '').trim().toLowerCase()
    if (em) sysByEmail.set(em, su)
    const mr = String(su.dados?.responsavel_id || su.dados?.responsavelId || '').trim()
    if (mr) {
      sysByRespId.set(mr.toLowerCase(), su)
      sysByRespId.set(stripLeadingZeros(mr).toLowerCase(), su)
    }
  })

  const respById = new Map<string, any>()
  responsaveisRows.forEach(r => {
    const rId = String(r.id).trim()
    respById.set(rId.toLowerCase(), r)
    respById.set(stripLeadingZeros(rId).toLowerCase(), r)
  })

  // Indexar reads, entregas, ciências e push logs para consulta O(1)
  const readsByContent = new Map<string, any[]>()
  readRows.forEach(r => {
    const cid = String(r.content_id || '')
    if (!readsByContent.has(cid)) readsByContent.set(cid, [])
    readsByContent.get(cid)!.push(r)
  })

  const cienciasByContent = new Map<string, any[]>()
  cienciaRows.forEach(c => {
    const cid = String(c.content_id || '')
    if (!cienciasByContent.has(cid)) cienciasByContent.set(cid, [])
    cienciasByContent.get(cid)!.push(c)
  })

  const deliveriesByContent = new Map<string, DeliveryRow[]>()
  deliveryRows.forEach(d => {
    const cid = String(d.content_id || '')
    if (!deliveriesByContent.has(cid)) deliveriesByContent.set(cid, [])
    deliveriesByContent.get(cid)!.push(d)
  })

  // Push logs por contentId + alunoId e por perfil_colaborador
  const pushLogByStuKey = new Map<string, any>()
  let colabPushLog: any = null
  const pushStatsCount = { totalDisparos: 0, enviados: 0, semAparelho: 0, falhas: 0, pausados: 0 }

  pushLogRows.forEach(pl => {
    pushStatsCount.totalDisparos++
    if (pl.status === 'sent') pushStatsCount.enviados++
    else if (pl.status === 'skipped') pushStatsCount.semAparelho++
    else if (pl.status === 'failed') pushStatsCount.falhas++
    else if (pl.status === 'paused') pushStatsCount.pausados++

    const itemStr = String(pl.item_id || '')
    if (itemStr.endsWith('_perfil_colaborador')) {
      colabPushLog = pl
      return
    }
    const parsedResp = parseJsonField<any>(pl.onesignal_response, {})
    const metaStu = parsedResp?._metadata?.aluno_id ? cleanStudentKey(parsedResp._metadata.aluno_id) : ''
    const suffixMatch = itemStr.match(/_aluno_(.+)$/)
    const suffixStu = suffixMatch ? cleanStudentKey(suffixMatch[1]) : ''
    const stuKey = metaStu || suffixStu
    if (stuKey) {
      pushLogByStuKey.set(stuKey, pl)
      pushLogByStuKey.set(stripLeadingZeros(stuKey), pl)
    }
  })

  // Função auxiliar para checar se um conjunto de tokens de usuário leu/entregou/deu ciência para um aluno específico (anti-vazamento entre irmãos)
  const dadosLeituras = parseJsonField<Record<string, any>>(dados.leituras, {})
  const dadosCiencias = parseJsonField<Record<string, any>>(dados.ciencias, {})
  const comSentTs = new Date(dataEnvio).getTime()

  const resolveGuardianActivity = (
    respTokens: string[],
    plainAlunoId: string,
    targetContentIds: string[]
  ): {
    leuEm: string | null
    cienteEm: string | null
    feedDeliveredEm: string | null
  } => {
    const tokenSet = new Set(respTokens.filter(Boolean).map(t => t.toLowerCase()))
    const cleanStu = cleanStudentKey(plainAlunoId)
    const noZStu = stripLeadingZeros(cleanStu)

    let leuEm: string | null = null
    let cienteEm: string | null = null
    let feedDeliveredEm: string | null = null

    // 1. Tabela agenda_notification_reads
    for (const cid of targetContentIds) {
      const list = readsByContent.get(cid) || []
      for (const r of list) {
        const rawUid = String(r.usuario_id || '')
        const [uidPart, hashStu] = rawUid.split('#')
        const rUidLower = (uidPart || '').trim().toLowerCase()
        if (!tokenSet.has(rUidLower)) continue

        const rAluno = r.aluno_id ? cleanStudentKey(r.aluno_id) : (hashStu ? cleanStudentKey(hashStu) : '')
        if (rAluno) {
          if (rAluno === cleanStu || stripLeadingZeros(rAluno) === noZStu) {
            leuEm = pickEarliestIso(leuEm, r.read_at)
          }
        } else {
          // Somente se não houver aluno_id vinculado no registro
          leuEm = pickEarliestIso(leuEm, r.read_at)
        }
      }

      // 2. Tabela agenda_ciencias
      const cList = cienciasByContent.get(cid) || []
      for (const c of cList) {
        const rawUid = String(c.usuario_id || '')
        const [uidPart, hashStu] = rawUid.split('#')
        const cUidLower = (uidPart || '').trim().toLowerCase()
        if (!tokenSet.has(cUidLower)) continue
        const cAluno = c.aluno_id ? cleanStudentKey(c.aluno_id) : (hashStu ? cleanStudentKey(hashStu) : '')
        if (!cAluno || cAluno === cleanStu || stripLeadingZeros(cAluno) === noZStu) {
          cienteEm = pickEarliestIso(cienteEm, c.ciente_em)
        }
      }

      // 3. Tabela agenda_notification_deliveries
      const dList = deliveriesByContent.get(cid) || []
      for (const d of dList) {
        const dUidLower = String(d.usuario_id || '').trim().toLowerCase()
        if (!tokenSet.has(dUidLower)) continue
        const dAluno = d.aluno_id ? cleanStudentKey(d.aluno_id) : ''
        if (!dAluno || dAluno === cleanStu || stripLeadingZeros(dAluno) === noZStu) {
          feedDeliveredEm = pickEarliestIso(feedDeliveredEm, d.delivered_at)
        }
      }
    }

    // 4. Fallback em comunicados.dados.leituras (respeitando escopo de irmãos)
    if (!leuEm && dadosLeituras && typeof dadosLeituras === 'object') {
      const hasAnyScopedKeyForResp = Object.keys(dadosLeituras).some(k => {
        if (!k.includes('_')) return false
        const prefix = k.split('_')[0].toLowerCase()
        return tokenSet.has(prefix)
      })

      for (const rk of tokenSet) {
        const scoped1 = dadosLeituras[`${rk}_${cleanStu}`]
        const scoped2 = dadosLeituras[`${rk}_${noZStu}`]
        if (scoped1) leuEm = pickEarliestIso(leuEm, String(scoped1))
        if (scoped2) leuEm = pickEarliestIso(leuEm, String(scoped2))

        if (!hasAnyScopedKeyForResp) {
          const exactKey = Object.keys(dadosLeituras).find(k => k.toLowerCase() === rk)
          if (exactKey && dadosLeituras[exactKey]) {
            leuEm = pickEarliestIso(leuEm, String(dadosLeituras[exactKey]))
          }
        }
      }
    }

    if (!cienteEm && dadosCiencias && typeof dadosCiencias === 'object') {
      for (const rk of tokenSet) {
        const scoped1 = dadosCiencias[`${rk}_${cleanStu}`]
        if (scoped1) cienteEm = pickEarliestIso(cienteEm, String(scoped1))
        const exactKey = Object.keys(dadosCiencias).find(k => k.toLowerCase() === rk)
        if (exactKey && dadosCiencias[exactKey]) {
          cienteEm = pickEarliestIso(cienteEm, String(dadosCiencias[exactKey]))
        }
      }
    }

    return { leuEm, cienteEm, feedDeliveredEm }
  }

  // Vincular aluno -> lista de aluno_responsavel
  const vinculosByAlunoPlainId = new Map<string, any[]>()
  vinculos.forEach((v: any) => {
    const refLower = String(v.aluno_id || '').trim().toLowerCase()
    const mappedPlain = stuRefToPlainId.get(refLower) || stuRefToPlainId.get(stripLeadingZeros(refLower))
    if (!mappedPlain) return
    if (!vinculosByAlunoPlainId.has(mappedPlain)) vinculosByAlunoPlainId.set(mappedPlain, [])
    const list = vinculosByAlunoPlainId.get(mappedPlain)!
    if (!list.some(x => String(x.responsavel_id) === String(v.responsavel_id))) {
      list.push(v)
    }
  })

  // Montar alunos + responsáveis agrupados por Turma
  const turmasBucket = new Map<
    string,
    {
      id: string
      nome: string
      cor?: string | null
      turmaObj: any | null
      isPartial: boolean
      alunos: AuditoriaAluno[]
    }
  >()

  let totalResponsaveis = 0
  let responsaveisLeram = 0
  let responsaveisReceberam = 0

  selectedStudentsList.forEach(({ aluno, turmaObj, turmaNome, isPartial }) => {
    const plainId = cleanStudentKey(aluno.id)
    const noZId = stripLeadingZeros(plainId)
    const stuComId = stuComIdByAlunoId.get(plainId) || stuComIdByAlunoId.get(noZId) || null
    const targetContentIds = stuComId ? [stuComId, comId] : [comId]

    // Verificar se o próprio aluno (portal do aluno) leu ou recebeu
    let alunoProprioLeuEm: string | null = null
    let alunoFeedDeliveredEm: string | null = null
    for (const cid of targetContentIds) {
      for (const r of readsByContent.get(cid) || []) {
        const [uid] = String(r.usuario_id || '').split('#')
        const cleanU = cleanStudentKey(uid)
        const isStuToken =
          cleanU === plainId ||
          stripLeadingZeros(cleanU) === noZId ||
          uid === `aluno_${plainId}` ||
          uid === `aluno_${aluno.id}`
        if (isStuToken) {
          alunoProprioLeuEm = pickEarliestIso(alunoProprioLeuEm, r.read_at)
        }
      }
      for (const d of deliveriesByContent.get(cid) || []) {
        const cleanU = cleanStudentKey(d.usuario_id)
        if (cleanU === plainId || stripLeadingZeros(cleanU) === noZId) {
          alunoFeedDeliveredEm = pickEarliestIso(alunoFeedDeliveredEm, d.delivered_at)
        }
      }
    }
    if (!alunoProprioLeuEm && dadosLeituras) {
      const sKey =
        dadosLeituras[`${plainId}_${plainId}`] ||
        dadosLeituras[`aluno_${plainId}`] ||
        dadosLeituras[`aluno_${aluno.id}`]
      if (sKey) alunoProprioLeuEm = String(sKey)
    }

    const pushLog = pushLogByStuKey.get(plainId) || pushLogByStuKey.get(noZId) || null
    const pushSent = pushLog?.status === 'sent'
    const pushSkipped = pushLog?.status === 'skipped'

    const stuVinculos = vinculosByAlunoPlainId.get(plainId) || []
    const responsaveis: AuditoriaResponsavel[] = []

    stuVinculos.forEach((link: any) => {
      const rKey = String(link.responsavel_id || '').trim()
      const respRow = respById.get(rKey.toLowerCase()) || respById.get(stripLeadingZeros(rKey).toLowerCase())
      if (!respRow) return

      const rIdStr = String(respRow.id).trim()
      const rIdNoZ = stripLeadingZeros(rIdStr)
      const rEmail = String(respRow.email || respRow.dados?.email || '').trim().toLowerCase()
      const rPhoneDigits = String(respRow.telefone || respRow.celular || respRow.dados?.telefone || respRow.dados?.celular || '')
        .replace(/\D/g, '')
        .slice(-8)

      const matchedAuth =
        (respRow.auth_id && authById.get(String(respRow.auth_id).toLowerCase())) ||
        (rEmail && authByEmail.get(rEmail)) ||
        authByRespId.get(rIdStr.toLowerCase()) ||
        authByRespId.get(rIdNoZ.toLowerCase()) ||
        (rPhoneDigits.length >= 8 ? authByPhone.get(rPhoneDigits) : null) ||
        null

      const matchedSys =
        (respRow.auth_id && sysByAuthId.get(String(respRow.auth_id).toLowerCase())) ||
        (rEmail && sysByEmail.get(rEmail)) ||
        sysByRespId.get(rIdStr.toLowerCase()) ||
        sysByRespId.get(rIdNoZ.toLowerCase()) ||
        null

      const effectiveAuthId = matchedAuth?.id || matchedSys?.auth_id || respRow.auth_id || respRow.dados?.auth_id || null
      const ultimoAcesso: string | null =
        matchedAuth?.last_sign_in_at ||
        respRow.dados?.ultimo_acesso ||
        matchedSys?.ultimoacesso ||
        null

      const temContaAtiva = Boolean(
        matchedAuth && (matchedAuth.last_sign_in_at || matchedAuth.user_metadata?.password_confirmed_at)
      ) || Boolean(respRow.dados?.app_instalado || respRow.dados?.appInstalado)

      const statusConta: 'active' | 'never_activated' | 'no_email' = temContaAtiva
        ? 'active'
        : (!rEmail ? 'no_email' : 'never_activated')

      const tokens = [
        rIdStr,
        rIdNoZ,
        rEmail,
        effectiveAuthId ? String(effectiveAuthId) : '',
        matchedSys?.id ? String(matchedSys.id) : '',
      ].filter(Boolean)

      const { leuEm, cienteEm, feedDeliveredEm } = resolveGuardianActivity(tokens, plainId, targetContentIds)

      const accessedFeedAfterSend = Boolean(
        ultimoAcesso && !isNaN(comSentTs) && new Date(ultimoAcesso).getTime() >= comSentTs
      )
      const receivedViaApp = Boolean(feedDeliveredEm || accessedFeedAfterSend)
      const receivedViaPush = Boolean(pushSent && temContaAtiva)

      const leu = Boolean(leuEm)
      const recebeu = Boolean(leu || receivedViaApp || receivedViaPush)
      const canalRecebimento: 'push' | 'app' | 'push_e_app' | null =
        receivedViaPush && receivedViaApp
          ? 'push_e_app'
          : receivedViaPush
            ? 'push'
            : receivedViaApp
              ? 'app'
              : null

      const recebeuEm = leu
        ? pickEarliestIso(leuEm, feedDeliveredEm || (pushSent ? pushLog?.created_at : null))
        : (feedDeliveredEm || (receivedViaPush ? pushLog?.created_at : null) || (accessedFeedAfterSend ? ultimoAcesso : null))

      const respStatus: DeliveryState = leu
        ? 'read'
        : recebeu
          ? 'received'
          : (!temContaAtiva || pushSkipped ? 'no_channel' : 'sent')

      totalResponsaveis++
      if (leu) responsaveisLeram++
      if (recebeu) responsaveisReceberam++

      responsaveis.push({
        id: rIdStr,
        nome: respRow.nome || matchedSys?.nome || 'Responsável',
        parentesco: link.parentesco || 'Responsável',
        avatarUrl: respRow.dados?.foto || respRow.dados?.fotoUrl || respRow.dados?.avatarUrl || null,
        email: rEmail || null,
        telefone: formatPhone(respRow.celular || respRow.telefone || respRow.dados?.celular || respRow.dados?.telefone),
        isFinanceiro: Boolean(link.resp_financeiro),
        isPedagogico: Boolean(link.resp_pedagogico),
        temContaAtiva,
        statusConta,
        status: respStatus,
        recebeu,
        recebeuEm,
        canalRecebimento,
        leu,
        leuEm,
        ciente: Boolean(cienteEm),
        cienteEm,
      })
    })

    // Status consolidado do aluno
    const anyRespRead = responsaveis.some(r => r.leu)
    const anyRespReceived = responsaveis.some(r => r.recebeu)
    const anyRespCiente = responsaveis.some(r => r.ciente)

    const leu = Boolean(anyRespRead || alunoProprioLeuEm)
    const recebeu = Boolean(leu || anyRespReceived || alunoFeedDeliveredEm || (pushSent && responsaveis.some(r => r.temContaAtiva)))

    const allNoChannel =
      responsaveis.length === 0
        ? !leu && !recebeu
        : responsaveis.every(r => r.status === 'no_channel')

    const stuStatus: DeliveryState = leu
      ? 'read'
      : recebeu
        ? 'received'
        : allNoChannel
          ? 'no_channel'
          : 'sent'

    let stuLeuEm: string | null = alunoProprioLeuEm
    responsaveis.forEach(r => {
      if (r.leuEm) stuLeuEm = pickEarliestIso(stuLeuEm, r.leuEm)
    })

    let stuRecebeuEm: string | null = stuLeuEm || alunoFeedDeliveredEm || null
    responsaveis.forEach(r => {
      if (r.recebeuEm) stuRecebeuEm = pickEarliestIso(stuRecebeuEm, r.recebeuEm)
    })

    let stuCienteEm: string | null = null
    responsaveis.forEach(r => {
      if (r.cienteEm) stuCienteEm = pickEarliestIso(stuCienteEm, r.cienteEm)
    })

    const bucketKey = turmaObj?.id ? `t_${turmaObj.id}` : `name_${normalizeText(turmaNome)}`
    if (!turmasBucket.has(bucketKey)) {
      const syncGrp = turmaObj
        ? turmaSyncGroupByTurmaKey.get(turmaObj.id.toLowerCase()) || turmaSyncGroupByTurmaKey.get(normalizeText(turmaNome))
        : null
      turmasBucket.set(bucketKey, {
        id: turmaObj?.id || bucketKey,
        nome: turmaNome,
        cor: turmaObj?.cor || syncGrp?.cor || null,
        turmaObj,
        isPartial,
        alunos: [],
      })
    }
    const bucket = turmasBucket.get(bucketKey)!
    if (!isPartial) bucket.isPartial = false

    bucket.alunos.push({
      id: String(aluno.id),
      plainId,
      nome: aluno.nome || 'Aluno',
      matricula: aluno.matricula || null,
      turmaId: turmaObj?.id || null,
      turmaNome,
      avatarUrl: aluno.foto_url || aluno.foto || aluno.dados?.foto || aluno.dados?.avatarUrl || null,
      status: stuStatus,
      recebeu,
      recebeuEm: stuRecebeuEm,
      leu,
      leuEm: stuLeuEm,
      alunoProprioLeu: Boolean(alunoProprioLeuEm),
      alunoProprioLeuEm,
      ciente: anyRespCiente,
      cienteEm: stuCienteEm,
      stuComunicadoId: stuComId,
      hasIndividualReport: Boolean(isReport),
      responsaveis,
    })
  })

  // Ordenar turmas por série e alunos por prioridade (pendentes/sem acesso primeiro, depois recebidos, depois lidos)
  const stateRank: Record<DeliveryState, number> = {
    no_channel: 0,
    sent: 1,
    received: 2,
    read: 3,
  }

  const turmas: AuditoriaTurma[] = Array.from(turmasBucket.values())
    .sort((a, b) => {
      if (a.turmaObj && b.turmaObj) return compareTurmasBySerie(a.turmaObj, b.turmaObj)
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
    .map(bucket => {
      const sortedAlunos = [...bucket.alunos].sort((a, b) => {
        const diff = stateRank[a.status] - stateRank[b.status]
        if (diff !== 0) return diff
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })

      const leramCount = sortedAlunos.filter(a => a.leu).length
      const receberamCount = sortedAlunos.filter(a => a.recebeu).length
      const semAcessoCount = sortedAlunos.filter(a => a.status === 'no_channel').length
      const pendentesCount = sortedAlunos.filter(a => !a.leu).length
      const cientesCount = sortedAlunos.filter(a => a.ciente).length

      return {
        id: bucket.id,
        nome: bucket.nome,
        cor: bucket.cor,
        isPartial: bucket.isPartial,
        totalAlunos: sortedAlunos.length,
        leramCount,
        receberamCount,
        pendentesCount,
        semAcessoCount,
        cientesCount,
        alunos: sortedAlunos,
      }
    })

  // ── Resolver Colaboradores e Grupos ───────────────────────────────────────
  const funcByAnyKey = new Map<string, any>()
  ;(funcionarios || []).forEach((f: any) => {
    if (!f) return
    const tokens = [
      String(f.id || ''),
      cleanStaffKey(f.id),
      f.codigo ? String(f.codigo) : '',
      f.email ? String(f.email).trim().toLowerCase() : '',
      f.dados?.auth_id ? String(f.dados.auth_id) : '',
      f.dados?.user_id ? String(f.dados.user_id) : '',
    ].filter(Boolean)
    tokens.forEach(t => funcByAnyKey.set(t.toLowerCase(), f))
  })
  ;(sysUsers || []).forEach((su: any) => {
    if (!su) return
    const p = normalizeText(su.perfil)
    const c = normalizeText(su.cargo)
    if (p === 'familia' || p === 'responsavel' || p === 'aluno' || c === 'responsavel' || c === 'aluno') return
    const tokens = [
      String(su.id || ''),
      cleanStaffKey(su.id),
      su.auth_id ? String(su.auth_id) : '',
      su.email ? String(su.email).trim().toLowerCase() : '',
      su.dados?.colaborador_id ? cleanStaffKey(su.dados.colaborador_id) : '',
      su.dados?.uid_legacy ? cleanStaffKey(su.dados.uid_legacy) : '',
    ].filter(Boolean)
    tokens.forEach(t => {
      if (!funcByAnyKey.has(t.toLowerCase())) {
        funcByAnyKey.set(t.toLowerCase(), su)
      }
    })
  })

  const buildColaboradorAuditoria = (rawColab: any): AuditoriaColaborador => {
    const cId = String(rawColab.id || '')
    const cClean = cleanStaffKey(cId)
    const cEmail = String(rawColab.email || '').trim().toLowerCase()
    const matchedSys =
      sysById.get(cId.toLowerCase()) ||
      sysById.get(cClean) ||
      (cEmail ? sysByEmail.get(cEmail) : null) ||
      (rawColab.dados?.auth_id ? sysByAuthId.get(String(rawColab.dados.auth_id).toLowerCase()) : null) ||
      null
    const matchedAuth =
      (matchedSys?.auth_id && authById.get(String(matchedSys.auth_id).toLowerCase())) ||
      (rawColab.auth_id && authById.get(String(rawColab.auth_id).toLowerCase())) ||
      (cEmail ? authByEmail.get(cEmail) : null) ||
      null

    const tokens = Array.from(
      new Set(
        [
          cId,
          cClean,
          `f_${cClean}`,
          cEmail,
          rawColab.codigo ? String(rawColab.codigo) : '',
          rawColab.dados?.auth_id ? String(rawColab.dados.auth_id) : '',
          matchedSys?.id ? String(matchedSys.id) : '',
          matchedSys?.auth_id ? String(matchedSys.auth_id) : '',
          matchedSys?.dados?.colaborador_id ? String(matchedSys.dados.colaborador_id) : '',
          matchedSys?.dados?.uid_legacy ? String(matchedSys.dados.uid_legacy) : '',
          matchedAuth?.id ? String(matchedAuth.id) : '',
        ]
          .filter(Boolean)
          .map(t => t.toLowerCase())
      )
    )

    let leuEm: string | null = null
    let feedDeliveredEm: string | null = null

    for (const r of readsByContent.get(comId) || []) {
      const [uid] = String(r.usuario_id || '').split('#')
      if (tokens.includes(uid.toLowerCase()) || tokens.includes(cleanStaffKey(uid))) {
        leuEm = pickEarliestIso(leuEm, r.read_at)
      }
    }
    if (!leuEm && dadosLeituras) {
      for (const [k, v] of Object.entries(dadosLeituras)) {
        if (!v || k.includes('_')) continue
        if (tokens.includes(k.toLowerCase()) || tokens.includes(cleanStaffKey(k))) {
          leuEm = pickEarliestIso(leuEm, String(v))
        }
      }
    }

    for (const d of deliveriesByContent.get(comId) || []) {
      const du = String(d.usuario_id || '').toLowerCase()
      if (tokens.includes(du) || tokens.includes(cleanStaffKey(du))) {
        feedDeliveredEm = pickEarliestIso(feedDeliveredEm, d.delivered_at)
      }
    }

    const ultimoAcesso: string | null =
      matchedAuth?.last_sign_in_at || matchedSys?.ultimoacesso || null
    const temContaAtiva = Boolean(
      matchedAuth || matchedSys?.ultimoacesso || rawColab.dados?.auth_id
    )
    const accessedAfterSend = Boolean(
      ultimoAcesso && !isNaN(comSentTs) && new Date(ultimoAcesso).getTime() >= comSentTs
    )

    const pushSentColab = Boolean(colabPushLog && colabPushLog.status === 'sent')
    const receivedViaApp = Boolean(feedDeliveredEm || accessedAfterSend)
    const receivedViaPush = Boolean(pushSentColab && temContaAtiva)
    const leu = Boolean(leuEm)
    const recebeu = Boolean(leu || receivedViaApp || receivedViaPush)

    const canalRecebimento: 'push' | 'app' | 'push_e_app' | null =
      receivedViaPush && receivedViaApp
        ? 'push_e_app'
        : receivedViaPush
          ? 'push'
          : receivedViaApp
            ? 'app'
            : null

    const recebeuEm = leu
      ? pickEarliestIso(leuEm, feedDeliveredEm || (pushSentColab ? colabPushLog?.created_at : null))
      : (feedDeliveredEm || (receivedViaPush ? colabPushLog?.created_at : null) || (accessedAfterSend ? ultimoAcesso : null))

    const status: DeliveryState = leu
      ? 'read'
      : recebeu
        ? 'received'
        : !temContaAtiva
          ? 'no_channel'
          : 'sent'

    return {
      id: cId,
      nome: rawColab.nome || matchedSys?.nome || 'Colaborador',
      cargo: rawColab.cargo || matchedSys?.cargo || matchedSys?.perfil || 'Colaborador',
      avatarUrl: rawColab.dados?.foto || rawColab.dados?.fotoUrl || matchedSys?.dados?.foto || matchedSys?.dados?.fotoUrl || null,
      email: cEmail || null,
      temContaAtiva,
      status,
      recebeu,
      recebeuEm,
      canalRecebimento,
      leu,
      leuEm,
    }
  }

  // Colaboradores diretos (e todos ativos se global)
  const resolvedColabMap = new Map<string, AuditoriaColaborador>()
  if (!isIndividualStudentReport) {
    if (isGlobal) {
      ;(funcionarios || [])
        .filter((f: any) => !f.status || String(f.status).toLowerCase() !== 'inativo')
        .forEach((f: any) => {
          const item = buildColaboradorAuditoria(f)
          resolvedColabMap.set(cleanStaffKey(item.id), item)
        })
    } else {
      const allStaffIds = new Set<string>()
      targetFuncsIdsRaw.forEach(id => {
        const val = typeof id === 'object' && id !== null ? (id.id || id.colaboradorId || id.usuarioId) : id
        const c = cleanStaffKey(val)
        if (c) allStaffIds.add(c)
      })
      grupoFuncsIds.forEach(c => allStaffIds.add(c))

      allStaffIds.forEach(cKey => {
        const found = funcByAnyKey.get(cKey)
        if (found) {
          const item = buildColaboradorAuditoria(found)
          resolvedColabMap.set(cleanStaffKey(item.id), item)
        }
      })
    }
  }

  const colaboradores = Array.from(resolvedColabMap.values()).sort((a, b) => {
    const diff = stateRank[a.status] - stateRank[b.status]
    if (diff !== 0) return diff
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  // Grupos com membros detalhados
  const grupos: AuditoriaGrupo[] = matchedGrupos.map(g => {
    const cIds = parseJsonField<any[]>(g.colaboradoresIds || g.membrosIds || g.funcionariosIds, [])
    const aIds = parseJsonField<any[]>(g.alunosIds, [])
    const membrosColab: AuditoriaColaborador[] = []
    const seenM = new Set<string>()
    cIds.forEach(id => {
      const cKey = cleanStaffKey(id)
      const existing = resolvedColabMap.get(cKey) || (funcByAnyKey.get(cKey) ? buildColaboradorAuditoria(funcByAnyKey.get(cKey)) : null)
      if (existing && !seenM.has(cleanStaffKey(existing.id))) {
        seenM.add(cleanStaffKey(existing.id))
        membrosColab.push(existing)
      }
    })
    return {
      id: String(g.id),
      nome: g.nome,
      isEquipeEscolar: isEquipeEscolarGrupo(g),
      totalMembros: membrosColab.length + aIds.length,
      leramCount: membrosColab.filter(m => m.leu).length,
      receberamCount: membrosColab.filter(m => m.recebeu).length,
      colaboradores: membrosColab,
      alunosCount: aIds.length,
    }
  })

  // Resumo geral
  const allAlunosAuditoria = turmas.flatMap(t => t.alunos)
  const lembretesHist = Array.isArray(dados.lembretes_historico) ? dados.lembretes_historico : []

  return {
    data: {
      comunicado: {
        id: String(comRow.id),
        titulo: String(comRow.titulo || ''),
        autor: String(comRow.autor || ''),
        autorCargo: dados.autorCargo || null,
        dataEnvio,
        status: comStatus,
        destino: destinoRaw || 'selecionados',
        exigeCiencia: Boolean(dados.exigeCiencia),
        isReport,
        isIndividual: !isGlobal && !isReport && matchedTargetTurmas.length === 0 && explicitStudentIds.size > 0,
        isGlobal,
        lembretesCount: lembretesHist.length,
        ultimoLembreteEm: lembretesHist[0]?.sentAt || null,
      },
      permissions: {
        canSendReminder,
        canEditReport,
      },
      resumo: {
        totalAlunos: allAlunosAuditoria.length,
        alunosLeram: allAlunosAuditoria.filter(a => a.leu).length,
        alunosReceberam: allAlunosAuditoria.filter(a => a.recebeu).length,
        alunosReceberamSemLer: allAlunosAuditoria.filter(a => a.recebeu && !a.leu).length,
        alunosPendentes: allAlunosAuditoria.filter(a => !a.leu).length,
        alunosSemAcesso: allAlunosAuditoria.filter(a => a.status === 'no_channel').length,
        alunosCientes: allAlunosAuditoria.filter(a => a.ciente).length,
        totalResponsaveis,
        responsaveisLeram,
        responsaveisReceberam,
        totalColaboradores: colaboradores.length,
        colaboradoresLeram: colaboradores.filter(c => c.leu).length,
        colaboradoresReceberam: colaboradores.filter(c => c.recebeu).length,
        pushResumo: pushStatsCount,
      },
      turmas,
      grupos,
      colaboradores,
    },
  }
}

function datosRequiresCiencia(dados: any): boolean {
  return Boolean(dados?.exigeCiencia)
}
