import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { supabaseServer } from '@/lib/supabaseServer'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getStudentTargetsForComunicados } from '@/lib/server/notificationHelper'
import { getCachedSystemUsers, getCachedFuncionarios } from '@/lib/server/turmasGruposCache'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const REMINDER_COOLDOWN_MS = 30_000
const MAX_CUSTOM_MESSAGE_LEN = 160
const BATCH_SIZE = 35

const ADMIN_ROLES = [
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

function normalizeText(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function cleanStudentKey(id: any): string {
  return String(id || '')
    .replace(/^(?:a_|_ALU|_)/i, '')
    .trim()
    .replace(/^0+/, '')
}

function cleanStaffKey(id: any): string {
  return String(id || '')
    .replace(/^(?:f_|func_)/i, '')
    .trim()
    .toLowerCase()
}

function isAdminRoleText(perfil?: string, cargo?: string): boolean {
  const pNorm = normalizeText(perfil)
  const cNorm = normalizeText(cargo)
  return ADMIN_ROLES.some(
    r =>
      pNorm === r ||
      cNorm === r ||
      pNorm.includes('administrador') ||
      cNorm.includes('administrador master') ||
      pNorm.includes('diretor geral') ||
      cNorm.includes('diretor geral') ||
      pNorm.includes('coordenad') ||
      cNorm.includes('coordenad')
  )
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
    if (!error && data) {
      results.push(...(data as T[]))
    }
  }
  return results
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
      const stuAlunoId = String(match[1]).trim()
      map.set(stuAlunoId, String(rawStuId))
      const cleaned = cleanStudentKey(stuAlunoId)
      if (cleaned) map.set(cleaned, String(rawStuId))
    }
  }

  if (Array.isArray(dados?.stuIds) && dados.stuIds.length > 0) {
    const candidateIds = dados.stuIds.map(String).filter(Boolean)
    const existingStus = await fetchInChunks<{ id: string }>('comunicados', 'id', 'id', candidateIds)
    existingStus.forEach(row => registerStuId(String(row.id)))
    if (map.size > 0) return map
  }

  // Fallback para relatórios legados sem dados.stuIds: localizar pelo prefixo de timestamp e autor
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
    console.warn('[Comunicados Lembrete] Falha ao resolver relatórios individuais vinculados:', err)
  }

  return map
}

function hasStudentActivity(
  student: { aluno_id: string; responsaveis_ids: string[] },
  records: Array<{ content_id: string; usuario_id?: string | null; aluno_id?: string | null }>,
  legacyMap: Record<string, any> | undefined,
  expectedContentId: string
): boolean {
  const rawAlunoId = String(student.aluno_id || '').trim()
  const cleanAluno = cleanStudentKey(rawAlunoId)
  const respIdSet = new Set(student.responsaveis_ids.map(r => String(r).trim().toLowerCase()))

  for (const r of records) {
    if (String(r.content_id) !== expectedContentId) continue
    const rAlunoClean = cleanStudentKey(r.aluno_id)
    if (rAlunoClean && cleanAluno && rAlunoClean === cleanAluno) {
      return true
    }
    const uid = String(r.usuario_id || '').trim()
    if (!uid) continue
    if (uid.includes('#')) {
      const hashPart = cleanStudentKey(uid.split('#')[1])
      if (hashPart && cleanAluno && hashPart === cleanAluno) {
        return true
      }
    } else if (!r.aluno_id) {
      if (
        uid === rawAlunoId ||
        cleanStudentKey(uid) === cleanAluno ||
        uid === `aluno_${rawAlunoId}` ||
        respIdSet.has(uid.toLowerCase())
      ) {
        return true
      }
    }
  }

  if (legacyMap && typeof legacyMap === 'object') {
    for (const key of Object.keys(legacyMap)) {
      if (!legacyMap[key]) continue
      if (
        key === rawAlunoId ||
        key === cleanAluno ||
        key === `aluno_${rawAlunoId}` ||
        key === `aluno_${cleanAluno}` ||
        key.endsWith(`_${rawAlunoId}`) ||
        (cleanAluno && key.endsWith(`_${cleanAluno}`))
      ) {
        return true
      }
      if (!key.includes('_') && respIdSet.has(key.toLowerCase())) {
        return true
      }
    }
  }

  return false
}

async function resolveCollaboratorReadAndCount(
  directColaboradores: string[],
  comunicadoId: string,
  readRows: Array<{ content_id: string; usuario_id?: string | null }>,
  legacyLeituras: Record<string, any> | undefined,
  filterUnread: boolean
): Promise<{ aliases: string[]; personCount: number; skippedCount: number }> {
  if (directColaboradores.length === 0) {
    return { aliases: [], personCount: 0, skippedCount: 0 }
  }

  const readTokens = new Set<string>()
  if (filterUnread) {
    for (const r of readRows) {
      if (String(r.content_id) !== comunicadoId) continue
      const rawUid = String(r.usuario_id || '').split('#')[0].trim()
      if (rawUid) {
        readTokens.add(rawUid.toLowerCase())
        readTokens.add(cleanStaffKey(rawUid))
      }
    }
    if (legacyLeituras && typeof legacyLeituras === 'object') {
      for (const [k, v] of Object.entries(legacyLeituras)) {
        if (v && !k.includes('_')) {
          readTokens.add(k.toLowerCase())
          readTokens.add(cleanStaffKey(k))
        }
      }
    }
  }

  // Agrupa aliases por colaborador para contagem precisa de pessoas e exclusão coerente de quem já leu
  const [sysRes, funcRes] = await Promise.allSettled([getCachedSystemUsers(), getCachedFuncionarios()])
  const sysUsers = sysRes.status === 'fulfilled' && Array.isArray(sysRes.value) ? sysRes.value : []
  const funcionarios = funcRes.status === 'fulfilled' && Array.isArray(funcRes.value) ? funcRes.value : []

  const tokenToGroup = new Map<string, Set<string>>()

  const addGroup = (tokens: string[]) => {
    const cleanTokens = tokens.map(t => String(t || '').trim().toLowerCase()).filter(Boolean)
    if (cleanTokens.length === 0) return
    let group: Set<string> | undefined
    for (const t of cleanTokens) {
      if (tokenToGroup.has(t)) {
        group = tokenToGroup.get(t)
        break
      }
    }
    if (!group) {
      group = new Set<string>()
    }
    for (const t of cleanTokens) {
      group.add(t)
      tokenToGroup.set(t, group)
    }
  }

  for (const f of funcionarios) {
    addGroup([
      f.id,
      cleanStaffKey(f.id),
      f.codigo,
      f.email,
      f.dados?.auth_id,
      f.dados?.user_id,
    ])
  }
  for (const su of sysUsers) {
    addGroup([
      su.id,
      cleanStaffKey(su.id),
      su.auth_id,
      su.email,
      su.dados?.auth_id,
      su.dados?.colaborador_id,
      cleanStaffKey(su.dados?.colaborador_id),
      su.dados?.uid_legacy,
    ])
  }

  const targetGroups = new Set<Set<string>>()
  const standaloneAliases = new Set<string>()
  const directLowerMap = new Map<string, string>()

  for (const rawAlias of directColaboradores) {
    const lower = rawAlias.trim().toLowerCase()
    const clean = cleanStaffKey(rawAlias)
    directLowerMap.set(lower, rawAlias)
    const grp = tokenToGroup.get(lower) || tokenToGroup.get(clean)
    if (grp) {
      targetGroups.add(grp)
    } else {
      standaloneAliases.add(rawAlias)
    }
  }

  if (!filterUnread || readTokens.size === 0) {
    return {
      aliases: directColaboradores,
      personCount: targetGroups.size + standaloneAliases.size,
      skippedCount: 0,
    }
  }

  const unreadAliases = new Set<string>()
  let skippedCount = 0
  let personCount = 0

  for (const rawAlias of standaloneAliases) {
    const lower = rawAlias.trim().toLowerCase()
    const clean = cleanStaffKey(rawAlias)
    if (readTokens.has(lower) || readTokens.has(clean)) {
      skippedCount++
    } else {
      unreadAliases.add(rawAlias)
      personCount++
    }
  }

  for (const grp of targetGroups) {
    let hasRead = false
    for (const token of grp) {
      if (readTokens.has(token) || readTokens.has(cleanStaffKey(token))) {
        hasRead = true
        break
      }
    }
    if (hasRead) {
      skippedCount++
    } else {
      personCount++
      for (const token of grp) {
        const original = directLowerMap.get(token)
        if (original) unreadAliases.add(original)
      }
    }
  }

  return { aliases: Array.from(unreadAliases), personCount, skippedCount }
}

export async function POST(request: Request) {
  const { user, dbUser, perfil, cargo, errorResponse } = await requireStaff(request)
  if (errorResponse || !user || !dbUser) {
    return errorResponse || NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const mode: 'all' | 'unread' = body?.mode === 'unread' ? 'unread' : 'all'
    const rawCustomMessage = typeof body?.customMessage === 'string' ? body.customMessage : ''
    const customMessage = rawCustomMessage
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CUSTOM_MESSAGE_LEN)

    if (!id) {
      return NextResponse.json({ error: 'ID do comunicado é obrigatório.' }, { status: 400 })
    }

    const { data: existingCom, error: fetchErr } = await supabaseServer
      .from('comunicados')
      .select('id, titulo, texto, autor, data, destino, fixado, dados, created_at')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!existingCom) {
      return NextResponse.json({ error: 'Comunicado não encontrado.' }, { status: 404 })
    }

    const dados =
      typeof existingCom.dados === 'string'
        ? (() => {
            try {
              return JSON.parse(existingCom.dados)
            } catch {
              return {}
            }
          })()
        : existingCom.dados || {}

    // Verificação de autorização: apenas Administrador/Direção/Coordenação ou o próprio autor
    let isAdmin = isAdminRoleText(dbUser.perfil || perfil, dbUser.cargo || cargo)
    if (!isAdmin) {
      const userCandidateIds = new Set<string>(
        [
          String(user.id),
          String(dbUser.id || ''),
          String(dbUser.auth_id || ''),
          String(dbUser.dados?.id || ''),
          String(dbUser.dados?.auth_id || ''),
          String(dbUser.dados?.colaborador_id || ''),
          String(dbUser.dados?.uid_legacy || ''),
          String(user.user_metadata?.id || ''),
          String(user.user_metadata?.colaborador_id || ''),
          String(user.user_metadata?.system_user_id || ''),
          String(user.user_metadata?.uid_legacy || ''),
        ]
          .filter(Boolean)
          .map(s => cleanStaffKey(s))
      )

      const userCandidateNames = new Set<string>(
        [dbUser.nome, user.user_metadata?.nome, user.user_metadata?.name]
          .filter(Boolean)
          .map(n => normalizeText(String(n)))
      )

      const comAutorId = cleanStaffKey(dados?.autorId || dados?.autor_id || '')
      const comAutorNome = normalizeText(existingCom?.autor || dados?.autorNome || dados?.autor)

      const isAuthor = Boolean(
        (comAutorId && userCandidateIds.has(comAutorId)) ||
          (comAutorNome && userCandidateNames.has(comAutorNome))
      )

      if (!isAuthor) {
        return NextResponse.json(
          { error: 'Acesso negado: Apenas quem enviou o comunicado ou um administrador pode enviar lembrete.' },
          { status: 403 }
        )
      }
    }

    const comStatus = String(dados?.status || 'enviado').toLowerCase().trim()
    if (comStatus === 'rascunho' || comStatus === 'agendado') {
      return NextResponse.json(
        { error: 'Só é possível enviar lembrete para comunicados que já foram enviados.' },
        { status: 400 }
      )
    }

    // Cooldown anti-clique duplo / spam (30s)
    const prevHistory: any[] = Array.isArray(dados?.lembretes_historico) ? dados.lembretes_historico : []
    const lastReminder = prevHistory[0]
    if (lastReminder?.sentAt) {
      const elapsedMs = Date.now() - new Date(lastReminder.sentAt).getTime()
      if (!isNaN(elapsedMs) && elapsedMs >= 0 && elapsedMs < REMINDER_COOLDOWN_MS) {
        const waitSec = Math.ceil((REMINDER_COOLDOWN_MS - elapsedMs) / 1000)
        return NextResponse.json(
          { error: `Um lembrete acabou de ser enviado. Aguarde ${waitSec}s antes de enviar outro.` },
          { status: 429 }
        )
      }
    }

    // Verificar configuração global de push para comunicados
    try {
      const { data: configRow } = await supabaseServer
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'ad_config')
        .maybeSingle()
      if (configRow?.valor?.notificacoes?.pushComunicados === false) {
        return NextResponse.json(
          {
            ok: false,
            disabledByConfig: true,
            error: 'As notificações push para comunicados estão desativadas nas configurações da Agenda Digital.',
          },
          { status: 400 }
        )
      }
    } catch (cfgErr) {
      console.warn('[Comunicados Lembrete] Aviso ao consultar ad_config:', cfgErr)
    }

    const destinoNorm = String(existingCom.destino || dados.destino || '').toLowerCase().trim()
    const isInterno = destinoNorm === 'interno'
    const comIdStr = String(existingCom.id)
    const isIndividualStudentReport = Boolean(
      comIdStr.startsWith('AD-COM-REL-STU-') || dados?.tipoRelatorio === 'individual'
    )
    const isConsolidatedReport = Boolean(
      comIdStr.startsWith('AD-COM-REL-COLAB-') ||
        comIdStr.startsWith('AD-COM-REL-TURMA-') ||
        (comIdStr.startsWith('AD-COM-REL-') && !comIdStr.startsWith('AD-COM-REL-STU-'))
    )

    const [{ students, directColaboradores }, stuComIdByAlunoId] = await Promise.all([
      getStudentTargetsForComunicados({
        ...dados,
        id: comIdStr,
        destino: existingCom.destino,
        tipoRelatorio: dados?.tipoRelatorio,
      }),
      isConsolidatedReport
        ? resolveStuMapForConsolidatedReport(comIdStr, existingCom, dados)
        : Promise.resolve(new Map<string, string>()),
    ])

    let targetStudents = isInterno ? [] : students
    let targetColaboradores = isIndividualStudentReport ? [] : directColaboradores
    let targetColaboradoresCount = 0
    let alreadyReadSkipped = 0

    // Para relatórios consolidados, garante que só enviaremos para alunos cujo comunicado individual existe
    if (isConsolidatedReport && stuComIdByAlunoId.size > 0) {
      targetStudents = targetStudents.filter(s => {
        const raw = String(s.aluno_id || '').trim()
        const clean = cleanStudentKey(raw)
        return stuComIdByAlunoId.has(raw) || (clean && stuComIdByAlunoId.has(clean))
      })
    } else if (isConsolidatedReport && stuComIdByAlunoId.size === 0) {
      // Sem relatórios individuais encontrados — não expor AD-COM-REL-COLAB para famílias
      targetStudents = []
    }

    // Filtrar quem já leu (e já confirmou ciência, se exigeCiencia) quando mode === 'unread'
    if (mode === 'unread') {
      const contentIdsToCheck = Array.from(new Set([comIdStr, ...Array.from(stuComIdByAlunoId.values())]))
      const exigeCiencia = Boolean(dados?.exigeCiencia)

      const [readRows, cienciaRows] = await Promise.all([
        fetchInChunks<{ content_id: string; usuario_id: string | null; aluno_id: string | null }>(
          'agenda_notification_reads',
          'content_id, usuario_id, aluno_id',
          'content_id',
          contentIdsToCheck
        ),
        exigeCiencia
          ? fetchInChunks<{ content_id: string; usuario_id: string | null; aluno_id: string | null }>(
              'agenda_ciencias',
              'content_id, usuario_id, aluno_id',
              'content_id',
              contentIdsToCheck
            )
          : Promise.resolve([]),
      ])

      const nextStudents: typeof targetStudents = []
      for (const s of targetStudents) {
        const raw = String(s.aluno_id || '').trim()
        const clean = cleanStudentKey(raw)
        const expectedContentId = isConsolidatedReport
          ? stuComIdByAlunoId.get(raw) || stuComIdByAlunoId.get(clean) || comIdStr
          : comIdStr

        const hasRead = hasStudentActivity(s, readRows, dados?.leituras, expectedContentId)
        const hasCiencia = exigeCiencia
          ? hasStudentActivity(s, cienciaRows, dados?.ciencias, expectedContentId)
          : true

        if (hasRead && hasCiencia) {
          alreadyReadSkipped++
        } else {
          nextStudents.push(s)
        }
      }
      targetStudents = nextStudents

      if (targetColaboradores.length > 0) {
        const colabRes = await resolveCollaboratorReadAndCount(
          targetColaboradores,
          comIdStr,
          readRows,
          dados?.leituras,
          true
        )
        targetColaboradores = colabRes.aliases
        targetColaboradoresCount = colabRes.personCount
        alreadyReadSkipped += colabRes.skippedCount
      }
    } else if (targetColaboradores.length > 0) {
      const colabRes = await resolveCollaboratorReadAndCount(
        targetColaboradores,
        comIdStr,
        [],
        undefined,
        false
      )
      targetColaboradoresCount = colabRes.personCount
    }

    const reminderBatchId = String(Date.now())
    const senderDisplayName =
      dbUser.nome || user.user_metadata?.nome || user.user_metadata?.name || existingCom.autor || 'Equipe Escolar'
    const tituloCom = String(existingCom.titulo || 'Comunicado').trim()
    const pushTitle = `🔔 Lembrete: ${tituloCom}`

    const pushTasks: Array<{ weight: number; run: () => Promise<any> }> = []

    if (!isInterno) {
      for (const student of targetStudents) {
        if (!student.responsaveis_ids || student.responsaveis_ids.length === 0) continue

        const rawAluno = String(student.aluno_id || '').trim()
        const cleanAluno = cleanStudentKey(rawAluno)
        const targetComId = isConsolidatedReport
          ? stuComIdByAlunoId.get(rawAluno) || stuComIdByAlunoId.get(cleanAluno) || comIdStr
          : comIdStr

        const nomeAluno = formatFriendlyStudentName(student.aluno_nome)
        const familyTargetUrl = `/agenda-digital/${encodeURIComponent(rawAluno)}/comunicados?id=${encodeURIComponent(targetComId)}`

        const bodyMessage = customMessage
          ? nomeAluno
            ? `${nomeAluno}: ${customMessage}`
            : customMessage
          : isIndividualStudentReport
            ? `Lembrete de ${senderDisplayName}: confira o relatório diário de ${nomeAluno}. Toque para abrir!`
            : `Lembrete de ${senderDisplayName}: confira o comunicado "${tituloCom}" para ${nomeAluno}. Toque para abrir!`

        pushTasks.push({
          weight: 1,
          run: () =>
            sendAgendaPushNotification({
              type: 'comunicados',
              itemId: `${targetComId}-reminder-${reminderBatchId}`,
              collapseId: `rem_${targetComId}_${reminderBatchId}`,
              title: pushTitle,
              message: bodyMessage,
              targetUserIds: student.responsaveis_ids,
              targetUrl: familyTargetUrl,
              senderUserId: user.id,
              metadata: {
                aluno_id: rawAluno,
                aluno_nome: nomeAluno,
                perfil_destino: 'familiar',
                item_id: String(targetComId),
                comunicado_id: String(targetComId),
                parent_comunicado_id: isConsolidatedReport ? comIdStr : undefined,
                rota: 'comunicados',
                targetUrl: familyTargetUrl,
                is_reminder: true,
                reminder_batch_id: reminderBatchId,
                reminder_mode: mode,
                reminder_sent_by: user.id,
                reminder_sent_by_name: senderDisplayName,
                author: existingCom.autor || senderDisplayName,
                author_id: dados?.autorId || user.id,
                author_cargo: dados?.autorCargo || cargo,
                author_foto: dados?.autorFoto || null,
              },
            }),
        })
      }
    }

    if (targetColaboradores.length > 0 && !isIndividualStudentReport) {
      const colabTargetUrl = `/agenda-digital/colaborador/comunicados?id=${encodeURIComponent(comIdStr)}`
      const colabMessage = customMessage
        ? `${senderDisplayName}: ${customMessage}`
        : `Lembrete de ${senderDisplayName}: confira o comunicado "${tituloCom}". Toque para abrir!`

      pushTasks.push({
        weight: Math.max(1, targetColaboradoresCount),
        run: () =>
          sendAgendaPushNotification({
            type: 'comunicados',
            itemId: `${comIdStr}-reminder-${reminderBatchId}`,
            collapseId: `rem_${comIdStr}_${reminderBatchId}`,
            title: pushTitle,
            message: colabMessage,
            targetUserIds: targetColaboradores,
            targetUrl: colabTargetUrl,
            senderUserId: user.id,
            metadata: {
              perfil_destino: 'colaborador',
              item_id: comIdStr,
              comunicado_id: comIdStr,
              rota: 'comunicados',
              targetUrl: colabTargetUrl,
              is_reminder: true,
              reminder_batch_id: reminderBatchId,
              reminder_mode: mode,
              reminder_sent_by: user.id,
              reminder_sent_by_name: senderDisplayName,
              author: existingCom.autor || senderDisplayName,
              author_id: dados?.autorId || user.id,
              author_cargo: dados?.autorCargo || cargo,
              author_foto: dados?.autorFoto || null,
            },
          }),
      })
    }

    if (pushTasks.length === 0) {
      const noTargetMsg =
        mode === 'unread' && alreadyReadSkipped > 0
          ? Boolean(dados?.exigeCiencia)
            ? 'Todos os destinatários já leram e confirmaram ciência neste comunicado.'
            : 'Todos os destinatários já visualizaram este comunicado.'
          : 'Nenhum destinatário elegível encontrado para este comunicado.'

      return NextResponse.json(
        { ok: false, noTargets: true, alreadyReadSkipped, error: noTargetMsg },
        { status: 400 }
      )
    }

    const totalWeightedTargets = pushTasks.reduce((acc, t) => acc + t.weight, 0)
    const outcomes: Array<{ weight: number; res: any }> = []
    for (let i = 0; i < pushTasks.length; i += BATCH_SIZE) {
      const slice = pushTasks.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(slice.map(t => t.run()))
      batchResults.forEach((r, idx) => {
        outcomes.push({
          weight: slice[idx].weight,
          res: r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message || 'Erro' },
        })
      })
    }

    let sentCount = 0
    let noSubscribersCount = 0
    let pausedCount = 0
    let disabledCount = 0
    let failedCount = 0
    let mockCount = 0

    for (const { weight, res } of outcomes) {
      if (res?.skipped) {
        if (res.reason === 'notifications_paused') pausedCount += weight
        else if (res.reason === 'disabled_by_admin_config') disabledCount += weight
        else noSubscribersCount += weight
      } else if (res?.success) {
        sentCount += weight
        if (res.mock) mockCount += weight
      } else if (res?.noSubscribers) {
        noSubscribersCount += weight
      } else {
        failedCount += weight
      }
    }

    if (sentCount === 0 && pausedCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          paused: true,
          error:
            'As notificações push estão pausadas globalmente no sistema. Desative o modo pausa para enviar lembretes.',
        },
        { status: 409 }
      )
    }

    if (sentCount === 0 && disabledCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          disabledByConfig: true,
          error: 'O envio de notificações push para comunicados está desativado nas configurações.',
        },
        { status: 400 }
      )
    }

    const historyEntry = {
      id: `REM-${reminderBatchId}`,
      sentAt: new Date().toISOString(),
      sentById: user.id,
      sentByName: senderDisplayName,
      mode,
      customMessage: customMessage || null,
      totalTargets: totalWeightedTargets,
      sent: sentCount,
      noSubscribers: noSubscribersCount,
      failed: failedCount,
      alreadyReadSkipped,
      mock: mockCount > 0,
    }

    const nextHistory = [historyEntry, ...prevHistory].slice(0, 20)
    const updatedDados = {
      ...dados,
      lembretes_historico: nextHistory,
    }

    const { error: updateErr } = await supabaseServer
      .from('comunicados')
      .update({
        dados: updatedDados,
        updated_at: new Date().toISOString(),
      })
      .eq('id', comIdStr)

    if (updateErr) {
      console.warn('[Comunicados Lembrete] Falha ao gravar histórico de lembrete:', updateErr.message)
    }

    let message = ''
    if (sentCount > 0) {
      message = `Lembrete enviado para ${sentCount} destinatário(s)!`
      if (noSubscribersCount > 0) {
        message += ` (${noSubscribersCount} sem aparelho inscrito para push)`
      }
      if (alreadyReadSkipped > 0) {
        message += ` • ${alreadyReadSkipped} já haviam lido.`
      }
    } else if (noSubscribersCount > 0 && failedCount === 0) {
      message = `Nenhum destinatário elegível possui aparelho inscrito para notificações push no momento (${noSubscribersCount} sem inscrição).`
    } else {
      return NextResponse.json(
        {
          ok: false,
          sent: sentCount,
          noSubscribers: noSubscribersCount,
          failed: failedCount,
          error: 'Não foi possível entregar o lembrete via OneSignal. Verifique a configuração de push.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      ...historyEntry,
      lembretes_historico: nextHistory,
      message,
    })
  } catch (err: any) {
    console.error('[POST /api/comunicados/lembrete] Erro:', err)
    return NextResponse.json({ error: err?.message || 'Erro interno ao enviar lembrete.' }, { status: 500 })
  }
}
