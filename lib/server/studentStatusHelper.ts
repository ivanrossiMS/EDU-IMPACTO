import { supabaseServer } from '@/lib/supabaseServer'
import { getAdminClient, getAllAuthUsersCached, invalidateAuthUsersCache } from '@/lib/server/supabaseAdminSingleton'
import { clearAuthGuardCache } from '@/lib/server/authGuard'
import { invalidateAlunosCache, invalidateGruposCache } from '@/lib/server/turmasGruposCache'

export const INACTIVE_STUDENT_STATUSES = [
  'inativo',
  'inativa',
  'evadido',
  'transferido',
  'cancelado',
  'trancado',
  'desistente',
]

/**
 * Verifica se o status acadêmico/matrícula do aluno é inativo.
 */
export function isStudentInactiveStatus(student: any): boolean {
  if (!student) return true
  if (student.inativo === true || student.dados?.inativo === true) return true

  const topStatus = String(student.status || '').trim().toLowerCase()
  const dadosStatus = String(student.dados?.status || '').trim().toLowerCase()

  if (topStatus && INACTIVE_STUDENT_STATUSES.includes(topStatus)) return true
  if (dadosStatus && INACTIVE_STUDENT_STATUSES.includes(dadosStatus)) return true

  if (!topStatus && !dadosStatus) {
    if (student.ativo === false || student.dados?.ativo === false) return true
    const ativoStr = String(student.dados?.ativo ?? '').trim().toLowerCase()
    if (ativoStr === 'false' || ativoStr === 'nao' || ativoStr === 'não') return true
  }

  return false
}

/**
 * Verifica se o acesso do aluno ao sistema está bloqueado (seja por matrícula inativa ou bloqueio manual de acesso).
 */
export function isStudentAccessBlocked(student: any): boolean {
  if (isStudentInactiveStatus(student)) return true
  if (student?.dados?.acesso_inativo === true || student?.dados?.acesso_bloqueado === true) return true
  if (String(student?.dados?.auth_status || '').trim().toUpperCase() === 'INATIVO') return true
  return false
}

/**
 * Verifica se o responsável possui bloqueio direto de acesso ao sistema.
 */
export function isResponsavelAccessBlocked(resp: any): boolean {
  if (!resp) return true
  if (resp.dados?.acesso_inativo === true || resp.dados?.acesso_bloqueado === true) return true
  if (String(resp.dados?.status || '').trim().toLowerCase() === 'inativo') return true
  if (String(resp.dados?.auth_status || '').trim().toUpperCase() === 'INATIVO') return true
  return false
}

/**
 * Normaliza referências de ID/matrícula de aluno para cruzamento com aluno_responsavel.
 */
function getStudentMatchTokens(student: any): string[] {
  const raw = [
    student?.id,
    student?.matricula,
    student?.codigo,
    student?.dados?.codigo,
    student?.dados?.codigoAluno,
    student?.dados?.id,
  ]
  const tokens = new Set<string>()
  for (const val of raw) {
    if (val === undefined || val === null) continue
    const s = String(val).trim().toLowerCase()
    if (!s) continue
    tokens.add(s)
    const unpadded = s.replace(/^0+/, '')
    if (unpadded) tokens.add(unpadded)
  }
  return Array.from(tokens)
}

/**
 * Verifica se um ou mais IDs de responsável possuem pelo menos um aluno ATIVO vinculado.
 */
export async function checkResponsavelHasActiveStudent(
  responsavelIds: string | string[],
  options?: {
    requireFinOrPed?: boolean
    supabaseClient?: any
  }
): Promise<{
  hasActiveStudent: boolean
  activeStudents: any[]
  inactiveStudents: any[]
  allStudents: any[]
}> {
  const client = options?.supabaseClient || getAdminClient() || supabaseServer
  const requireFinOrPed = options?.requireFinOrPed !== false

  const ids = (Array.isArray(responsavelIds) ? responsavelIds : [responsavelIds])
    .map(id => String(id || '').trim())
    .filter(Boolean)

  if (ids.length === 0) {
    return { hasActiveStudent: false, activeStudents: [], inactiveStudents: [], allStudents: [] }
  }

  const { data: links } = await client
    .from('aluno_responsavel')
    .select('aluno_id, responsavel_id, resp_financeiro, resp_pedagogico, resp_outro, tipo')
    .in('responsavel_id', ids)

  if (!links || links.length === 0) {
    return { hasActiveStudent: false, activeStudents: [], inactiveStudents: [], allStudents: [] }
  }

  const validLinks = requireFinOrPed
    ? links.filter(
        (l: any) =>
          l.resp_financeiro === true ||
          l.resp_pedagogico === true ||
          l.tipo === 'financeiro' ||
          l.tipo === 'pedagogico'
      )
    : links

  if (validLinks.length === 0) {
    return { hasActiveStudent: false, activeStudents: [], inactiveStudents: [], allStudents: [] }
  }

  const targetRefs: string[] = Array.from(
    new Set(validLinks.map((l: any) => String(l.aluno_id || '').trim()).filter(Boolean))
  )

  if (targetRefs.length === 0) {
    return { hasActiveStudent: false, activeStudents: [], inactiveStudents: [], allStudents: [] }
  }

  const formatRef = (r: string) => (/[ ,()\/]/.test(r) ? `"${r.replace(/"/g, '\\"')}"` : r)
  const formattedRefs = targetRefs.map(formatRef).join(',')

  const { data: studentsData } = await client
    .from('alunos')
    .select('id, nome, matricula, status, turma, email, dados')
    .or(`id.in.(${formattedRefs}),matricula.in.(${formattedRefs})`)

  const allStudents = Array.isArray(studentsData) ? studentsData : []
  const activeStudents = allStudents.filter(s => !isStudentAccessBlocked(s))
  const inactiveStudents = allStudents.filter(s => isStudentAccessBlocked(s))

  return {
    hasActiveStudent: activeStudents.length > 0,
    activeStudents,
    inactiveStudents,
    allStudents,
  }
}

/**
 * Retorna o conjunto de IDs de responsáveis que possuem APENAS alunos inativos (nenhum aluno ativo),
 * ou que estão explicitamente marcados como acesso inativo.
 */
export async function getInactiveOnlyResponsavelIds(
  supabaseClient?: any
): Promise<{
  inactiveRespIds: Set<string>
  activeRespIds: Set<string>
  activeFinOrPedRespIds: Set<string>
  inactiveAlunoIds: Set<string>
  activeAlunoIds: Set<string>
}> {
  const client = supabaseClient || getAdminClient() || supabaseServer

  const fetchAll = async (table: string, selectStr: string) => {
    let all: any[] = []
    let from = 0
    const step = 1000
    while (true) {
      const { data, error } = await client.from(table).select(selectStr).range(from, from + step - 1)
      if (error || !data || data.length === 0) break
      all = all.concat(data)
      if (data.length < step) break
      from += step
    }
    return all
  }

  const [alunos, links, responsaveis] = await Promise.all([
    fetchAll('alunos', 'id, matricula, status, dados'),
    fetchAll('aluno_responsavel', 'aluno_id, responsavel_id, resp_financeiro, resp_pedagogico, tipo'),
    fetchAll('responsaveis', 'id, dados'),
  ])

  const studentByToken = new Map<string, any>()
  const inactiveAlunoIds = new Set<string>()
  const activeAlunoIds = new Set<string>()

  for (const a of alunos) {
    const isInat = isStudentInactiveStatus(a)
    if (isInat) {
      inactiveAlunoIds.add(String(a.id).trim())
    } else {
      activeAlunoIds.add(String(a.id).trim())
    }
    for (const tok of getStudentMatchTokens(a)) {
      studentByToken.set(tok, a)
    }
  }

  const respLinksMap = new Map<string, any[]>()
  for (const l of links) {
    const rid = String(l.responsavel_id || '').trim()
    if (!rid) continue
    if (!respLinksMap.has(rid)) respLinksMap.set(rid, [])
    respLinksMap.get(rid)!.push(l)
  }

  const inactiveRespIds = new Set<string>()
  const activeRespIds = new Set<string>()
  const activeFinOrPedRespIds = new Set<string>()

  for (const r of responsaveis) {
    const rid = String(r.id || '').trim()
    if (!rid) continue

    const rLinks = respLinksMap.get(rid) || []
    let hasAnyValidStudent = false
    let hasActiveStudent = false
    let hasActiveFinOrPed = false

    for (const l of rLinks) {
      const ref = String(l.aluno_id || '').trim().toLowerCase()
      const unpadded = ref.replace(/^0+/, '')
      const st = studentByToken.get(ref) || (unpadded ? studentByToken.get(unpadded) : null)
      if (!st) continue
      hasAnyValidStudent = true
      if (!isStudentInactiveStatus(st)) {
        hasActiveStudent = true
        const isFinOrPed =
          l.resp_financeiro === true ||
          l.resp_pedagogico === true ||
          l.tipo === 'financeiro' ||
          l.tipo === 'pedagogico'
        if (isFinOrPed) {
          hasActiveFinOrPed = true
        }
      }
    }

    if (hasActiveStudent) {
      activeRespIds.add(rid)
      if (hasActiveFinOrPed && !isResponsavelAccessBlocked(r)) {
        activeFinOrPedRespIds.add(rid)
      }
    } else if (hasAnyValidStudent || isResponsavelAccessBlocked(r)) {
      // Todos os alunos vinculados estão inativos (ou o próprio responsável está inativo)
      inactiveRespIds.add(rid)
    }
  }

  return {
    inactiveRespIds,
    activeRespIds,
    activeFinOrPedRespIds,
    inactiveAlunoIds,
    activeAlunoIds,
  }
}

/**
 * Sincroniza o estado de acesso (Supabase Auth, grupos da Agenda Digital e participantes do Chat)
 * quando um aluno é inativado, bloqueado ou reativado.
 */
export async function syncStudentAndGuardiansAccess(studentId: string): Promise<void> {
  const admin = getAdminClient()
  const client = admin || supabaseServer
  const cleanStudentId = String(studentId || '').trim()
  if (!cleanStudentId) return

  try {
    const { data: student } = await client
      .from('alunos')
      .select('id, nome, matricula, email, status, turma, dados')
      .or(`id.eq.${cleanStudentId},matricula.eq.${cleanStudentId}`)
      .limit(1)
      .maybeSingle()

    if (!student) return

    const studentBlocked = isStudentAccessBlocked(student)
    const studentInactive = isStudentInactiveStatus(student)

    const authUsers = await getAllAuthUsersCached()
    const { data: sysUsers } = await client
      .from('system_users')
      .select('id, email, status, perfil, cargo')

    const activeStaffEmails = new Set(
      (sysUsers || [])
        .filter((u: any) => String(u.status || 'ativo').trim().toLowerCase() !== 'inativo')
        .map((u: any) => String(u.email || '').trim().toLowerCase())
        .filter(Boolean)
    )

    // 1. Sincronizar Auth do próprio aluno
    const code = String(student.matricula || student.dados?.codigo || student.id || '').trim()
    const virtualEmail = `${code}@aluno.impacto.edu.br`.toLowerCase()
    const realEmail = String(student.email || student.dados?.email || '').trim().toLowerCase()

    const studentAuthUsers = authUsers.filter((u: any) => {
      const ue = String(u.email || '').trim().toLowerCase()
      return (
        ue === virtualEmail ||
        (realEmail && ue === realEmail) ||
        String(u.user_metadata?.aluno_id || '') === String(student.id)
      )
    })

    if (admin) {
      for (const au of studentAuthUsers) {
        const ue = String(au.email || '').trim().toLowerCase()
        if (ue && activeStaffEmails.has(ue)) continue // Preserva conta se for colaborador ativo

        if (studentBlocked) {
          await admin.auth.admin
            .updateUserById(au.id, {
              ban_duration: '876000h',
              user_metadata: {
                ...(au.user_metadata || {}),
                status: 'inativo',
                acesso_bloqueado: true,
              },
            })
            .catch(() => {})
          await admin.auth.admin.signOut(au.id, 'global').catch(() => {})
        } else {
          await admin.auth.admin
            .updateUserById(au.id, {
              ban_duration: 'none',
              user_metadata: {
                ...(au.user_metadata || {}),
                status: 'ativo',
                acesso_bloqueado: false,
              },
            })
            .catch(() => {})
        }
      }
    }

    // 2. Buscar responsáveis vinculados ao aluno
    const studentRefs = Array.from(
      new Set([String(student.id), String(student.matricula || ''), String(student.dados?.codigo || '')].filter(Boolean))
    )

    const { data: links } = await client
      .from('aluno_responsavel')
      .select('responsavel_id')
      .in('aluno_id', studentRefs)

    const respIds = Array.from(
      new Set((links || []).map((l: any) => String(l.responsavel_id || '').trim()).filter(Boolean))
    )

    const orphanRespIds: string[] = []

    if (respIds.length > 0) {
      const { data: respsData } = await client
        .from('responsaveis')
        .select('id, nome, email, auth_id, proibido, dados')
        .in('id', respIds)

      for (const resp of respsData || []) {
        const rid = String(resp.id).trim()
        const { hasActiveStudent } = await checkResponsavelHasActiveStudent(rid, {
          requireFinOrPed: true,
          supabaseClient: client,
        })
        const respBlocked = !hasActiveStudent || isResponsavelAccessBlocked(resp)
        if (!hasActiveStudent) {
          orphanRespIds.push(rid)
        }

        const remail = String(resp.email || resp.dados?.email || '').trim().toLowerCase()
        const isStaff = Boolean(remail && activeStaffEmails.has(remail))

        const matchedRespAuth = authUsers.filter((u: any) => {
          const ue = String(u.email || '').trim().toLowerCase()
          return (
            (resp.auth_id && u.id === resp.auth_id) ||
            (remail && ue === remail) ||
            String(u.user_metadata?.responsavel_id || '') === rid
          )
        })

        if (admin) {
          for (const au of matchedRespAuth) {
            if (isStaff) {
              // Colaborador mantém acesso ao sistema, mas atualiza hasDualRole conforme tenha aluno ativo
              await admin.auth.admin
                .updateUserById(au.id, {
                  ban_duration: 'none',
                  user_metadata: {
                    ...(au.user_metadata || {}),
                    hasDualRole: !respBlocked,
                  },
                })
                .catch(() => {})
            } else if (respBlocked) {
              await admin.auth.admin
                .updateUserById(au.id, {
                  ban_duration: '876000h',
                  user_metadata: {
                    ...(au.user_metadata || {}),
                    status: 'inativo',
                    acesso_bloqueado: true,
                  },
                })
                .catch(() => {})
              await admin.auth.admin.signOut(au.id, 'global').catch(() => {})
            } else {
              await admin.auth.admin
                .updateUserById(au.id, {
                  ban_duration: 'none',
                  user_metadata: {
                    ...(au.user_metadata || {}),
                    status: 'ativo',
                    acesso_bloqueado: false,
                  },
                })
                .catch(() => {})
            }
          }
        }
      }
    }

    // 3. Se o aluno está inativo, remover de agenda_grupos (alunosIds) e encerrar participação em grupos do chat
    if (studentInactive) {
      const { data: groups } = await client.from('agenda_grupos').select('id, dados')
      if (groups && Array.isArray(groups)) {
        for (const group of groups) {
          const gDados = group.dados || {}
          const gAlunosIds: string[] = Array.isArray(gDados.alunosIds) ? gDados.alunosIds.map(String) : []
          if (gAlunosIds.includes(String(student.id))) {
            const updatedIds = gAlunosIds.filter(id => id !== String(student.id))
            await client
              .from('agenda_grupos')
              .update({ dados: { ...gDados, alunosIds: updatedIds } })
              .eq('id', group.id)
          }
        }
      }

      const nowIso = new Date().toISOString()
      const idsToLeaveChat = Array.from(
        new Set([
          String(student.id),
          ...studentAuthUsers.map((u: any) => String(u.id)),
          ...orphanRespIds,
        ].filter(Boolean))
      )

      if (idsToLeaveChat.length > 0) {
        try {
          await client
            .from('chat_participants')
            .update({ left_at: nowIso })
            .in('user_id', idsToLeaveChat)
            .is('left_at', null)
        } catch {}
      }
    }

    invalidateAuthUsersCache()
    invalidateAlunosCache()
    invalidateGruposCache()
    clearAuthGuardCache()
  } catch (err: any) {
    console.error('[syncStudentAndGuardiansAccess] Error:', err?.message || err)
  }
}
