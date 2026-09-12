/**
 * notificationHelper.ts — Resolução de Destinatários para Push Notifications
 * 
 * Responsável por resolver quais usuários (responsáveis) devem receber
 * notificações com base nos destinatários de comunicados, momentos, eventos, etc.
 * 
 * Estratégias de segmentação:
 * - "Todos" → Todos os responsáveis cadastrados
 * - Turma específica → Responsáveis dos alunos dessa turma
 * - Aluno específico → Responsáveis desse aluno
 * - Colaborador → IDs diretos quando passados
 * 
 * LGPD: Retorna apenas IDs de usuário, sem dados pessoais.
 */

import { supabaseServer } from '@/lib/supabaseServer'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'

async function fetchInChunks<T>(
  supabase: any,
  table: string,
  select: string,
  column: string,
  values: string[],
  chunkSize = 100
): Promise<T[]> {
  if (!values || values.length === 0) return []
  const results: T[] = []
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize)
    const { data, error } = await supabase.from(table).select(select).in(column, chunk)
    if (error) {
      console.error(`[fetchInChunks] Error fetching from ${table}:`, error.message)
    } else if (data) {
      results.push(...data)
    }
  }
  return results
}

/**
 * Normaliza um termo de turma removendo acentuação, caracteres especiais (º, ª, °, hífens, etc.)
 * e espaços, permitindo comparações resilientes entre formatos variados (ex: "4 ano A - matutino" e "4º Ano A - Matutino").
 */
export function normalizeTurmaTerm(term: any): string {
  if (!term) return ''
  return String(term)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function matchesTurmaTerm(t: any, term: string): boolean {
  const tl = term.toLowerCase().trim()
  const tAno = t.ano !== undefined ? String(t.ano) : (t.dados?.anoLetivo || '')
  if (tl.startsWith('todos:')) {
    const targetAno = tl.split(':')[1]?.trim()
    return targetAno === tAno
  }

  const tId = String(t.id).toLowerCase()
  const tNome = String(t.nome || '').toLowerCase()
  const tCod = String(t.codigo || '').toLowerCase()

  if (tl === tId || tl === tNome || tl === tCod || tNome.includes(tl) || tl.includes(tNome)) {
    return true
  }

  const tlNorm = normalizeTurmaTerm(term)
  const tNomeNorm = normalizeTurmaTerm(t.nome)
  const tCodNorm = normalizeTurmaTerm(t.codigo)
  const tIdNorm = normalizeTurmaTerm(t.id)

  if (!tlNorm) return false

  if (
    tlNorm === tNomeNorm ||
    tlNorm === tCodNorm ||
    tlNorm === tIdNorm ||
    (tNomeNorm.length >= 4 && tlNorm.includes(tNomeNorm)) ||
    (tlNorm.length >= 4 && tNomeNorm.includes(tlNorm))
  ) {
    return true
  }

  const tlNormClean = tlNorm.replace(/^turma/, '')
  if (tlNormClean && tlNormClean.length >= 4 && (tNomeNorm.includes(tlNormClean) || tlNormClean.includes(tNomeNorm))) {
    return true
  }

  return false
}

export interface TargetParams {
  /** Nomes ou IDs das turmas destinatárias */
  turmas?: string[]
  /** Alias para turmas */
  targetClasses?: string[]
  /** IDs das turmas */
  turmasIds?: string[]
  /** IDs dos alunos destinatários */
  alunosIds?: string[]
  /** Alias para alunosIds */
  targetStudents?: string[]
  /** Destino geral: "todos", "selecionados", "interno", etc. */
  destino?: string
  /** IDs diretos de colaboradores/funcionários a incluir */
  colaboradoresIds?: string[]
  /** Nomes ou IDs de grupos manuais a incluir */
  grupos?: string[]
  /** Alias para grupos */
  targetGrupos?: string[]
  /** IDs dos grupos */
  gruposIds?: string[]
  /** IDs de funcionários enviados pelo frontend */
  funcionariosIds?: string[]
  /** Dados internos aninhados */
  dados?: any
}

/**
 * Resolve a lista de External User IDs (IDs dos responsáveis no banco)
 * que devem receber uma notificação push baseado nos parâmetros do comunicado.
 * 
 * Os IDs retornados devem corresponder ao que foi passado no OneSignal.login()
 * no frontend durante o login do usuário.
 */
export async function getResponsavelIdsForTargets(dados: TargetParams | null | undefined): Promise<string[]> {
  if (!dados) return []

  try {
    const supabase = supabaseServer

    const grupos = (dados.grupos || []).map(String).filter(Boolean)
    const allGroupTerms = Array.from(new Set([...(dados.turmas || dados.targetClasses || []).map(String).filter(Boolean), ...grupos]))
    const alunosIds = (dados.alunosIds || dados.targetStudents || []).map(String).filter(Boolean)
    const colaboradoresIds = (dados.colaboradoresIds || []).map(String).filter(Boolean)
    const destino = String(dados.destino || '').toLowerCase().trim()

    const todosAnoMatch = allGroupTerms.find(t => t.toLowerCase().trim().startsWith('todos:'))

    const isTodos =
      destino === 'todos' ||
      destino === 'toda a escola' ||
      destino === 'all' ||
      allGroupTerms.some(t => {
        const tl = t.toLowerCase().trim()
        return tl === 'todos' || tl === 'toda a escola' || tl === 'all' || tl === 'todas'
      })

    // ── Modo "Todos" ──────────────────────────────────────────────────────
    if (isTodos && !todosAnoMatch) {
      const { data, error } = await supabase
        .from('aluno_responsavel')
        .select('responsavel_id')

      if (error) {
        console.error('[NotifHelper] Erro ao buscar todos os responsáveis:', error.message)
        return []
      }

      // Usar Set durante toda a construção para eliminar duplicatas desde o início
      const idsSet = new Set<string>(
        (data || []).map((d: any) => d.responsavel_id).filter(Boolean).map(String)
      )

      // Inclui colaboradores diretos (Set garante que não há duplicatas)
      colaboradoresIds.forEach(id => { if (id) idsSet.add(id) })

      const ids = Array.from(idsSet)
      console.log(`[NotifHelper] 'Todos' selecionado. Retornando ${ids.length} destinatários.`)
      return ids
    }

    // ── Selecionados ──────────────────────────────────────────────────────
    let targetAlunosSet = new Set<string>()

    alunosIds.forEach(id => {
      const cleanId = id.replace(/^(a_|_ALU)/, '')
      if (cleanId) targetAlunosSet.add(cleanId)
    })

    if (allGroupTerms.length > 0) {
      // 1. Resolver grupos na tabela agenda_grupos
      const { data: allGrupos, error: gruposError } = await supabase
        .from('agenda_grupos')
        .select('id, dados')

      if (!gruposError && allGrupos) {
        const matchedGrupos = allGrupos.filter(g => {
          const gId = String(g.id).toLowerCase()
          const gNome = String(g.dados?.nome || (g as any).nome || '').toLowerCase()
          return allGroupTerms.some(term => {
            const tl = term.toLowerCase().trim()
            return tl === gId || tl === gNome || gNome.includes(tl) || tl.includes(gNome)
          })
        })
        
        matchedGrupos.forEach(g => {
          let alunosIdsList = g.dados?.alunosIds || (g as any).alunosIds || [];
          if (typeof alunosIdsList === 'string') {
            try { alunosIdsList = JSON.parse(alunosIdsList) } catch { alunosIdsList = [] }
          }
          if (Array.isArray(alunosIdsList)) {
            alunosIdsList.forEach((aId: string) => {
              const cleanId = String(aId).replace(/^(a_|_ALU)/, '')
              if (cleanId) targetAlunosSet.add(cleanId)
            })
          }
        })
      }

      // 2. Resolver nomes/IDs de turmas para IDs reais no banco
      const { data: allTurmas, error: turmasError } = await supabase
        .from('turmas')
        .select('id, codigo, nome, serie, turno, ano, dados')
        .limit(500) // evitar full-table scan em escolas grandes

      if (turmasError) {
        console.error('[NotifHelper] Erro ao buscar turmas:', turmasError.message)
      } else {
        const matchedTurmas = (allTurmas || []).filter((t: any) => {
          return allGroupTerms.some(turma => matchesTurmaTerm(t, turma))
        })

        const matchedTurmaIds = matchedTurmas.map((t: any) => String(t.id))
        const allSearchTerms = Array.from(new Set([...allGroupTerms.filter(t => !t.toLowerCase().trim().startsWith('todos:')), ...matchedTurmaIds]))

        if (allSearchTerms.length > 0) {
          const alunosTurma = await fetchInChunks<any>(supabase, 'alunos', 'id', 'turma', allSearchTerms)
          alunosTurma.forEach((a: any) => targetAlunosSet.add(String(a.id)))
        }

        // Adicionar alunosIds de grupos sincronizados associados às turmas encontradas
        if (allGrupos && matchedTurmas.length > 0) {
          matchedTurmas.forEach((t: any) => {
            const tIdStr = String(t.id)
            const syncG = allGrupos.find((g: any) => {
              const gSync = g.dados?.syncId || (g as any).syncId || (String(g.id).startsWith('sync-') ? g.id : '')
              return gSync === `sync-${tIdStr}` || g.id === `sync-${tIdStr}` || ((g.nome || g.dados?.nome) && String(g.nome || g.dados?.nome).toLowerCase() === String(t.nome || '').toLowerCase())
            })
            if (syncG) {
              let aList = syncG.dados?.alunosIds || (syncG as any).alunosIds || []
              if (typeof aList === 'string') {
                try { aList = JSON.parse(aList) } catch { aList = [] }
              }
              if (Array.isArray(aList)) {
                aList.forEach((aId: string) => {
                  const cleanId = String(aId).replace(/^(a_|_ALU)/, '')
                  if (cleanId) targetAlunosSet.add(cleanId)
                })
              }
            }
          })
        }

        // Buscar todos alunos ativos para verificar pertencimento por duplo vínculo Integral/Intermediário
        if (matchedTurmas.length > 0) {
          const { data: allStudents } = await supabase
            .from('alunos')
            .select('id, turma, status, dados')
            .or('status.neq.inativo,status.is.null')

          if (allStudents) {
            allStudents.forEach((a: any) => {
              matchedTurmas.forEach((t: any) => {
                if (isAlunoCursandoTurma(a, t, t.ano)) {
                  targetAlunosSet.add(String(a.id))
                }
              })
            })
          }
        }
      }
    }

    const finalAlunosIds = Array.from(targetAlunosSet).filter(Boolean)

    // ── Buscar responsáveis dos alunos ────────────────────────────────────
    let allResponsavelIds = new Set<string>()

    if (finalAlunosIds.length > 0) {
      const vinculados = await fetchInChunks<any>(supabase, 'aluno_responsavel', 'responsavel_id', 'aluno_id', finalAlunosIds)
      vinculados.forEach(v => {
        if (v.responsavel_id) allResponsavelIds.add(String(v.responsavel_id))
      })
    }

    // ── Adicionar colaboradores diretos ───────────────────────────────────
    colaboradoresIds.forEach(id => allResponsavelIds.add(id))

    // Também incluímos os próprios IDs dos alunos, pois os responsáveis virtuais (sem cadastro fixo) 
    // se inscrevem no OneSignal usando o alias 'aluno_id'.
    finalAlunosIds.forEach(id => allResponsavelIds.add(String(id)))

    // ── Mapear IDs de responsáveis com a tabela responsaveis ───────────────────
    const rawIds = Array.from(allResponsavelIds)
    const respEmails = new Set<string>()

    if (rawIds.length > 0) {
      try {
        const respRecords = await fetchInChunks<any>(supabase, 'responsaveis', 'id, email, user_id, dados', 'id', rawIds)
        if (respRecords && respRecords.length > 0) {
          respRecords.forEach((r: any) => {
            if (r.user_id) allResponsavelIds.add(String(r.user_id))
            if (r.dados?.auth_id) allResponsavelIds.add(String(r.dados.auth_id))
            if (r.dados?.user_id) allResponsavelIds.add(String(r.dados.user_id))
            if (r.email) {
              const em = String(r.email).toLowerCase().trim()
              if (em) {
                respEmails.add(em)
                allResponsavelIds.add(em)
              }
            }
          })
        }
      } catch (respErr) {
        console.warn('[NotifHelper] Aviso ao buscar dados de responsaveis:', respErr)
      }
    }

    // ── Mapear IDs de responsáveis/alunos para system_users.id e auth_id ─────────
    const expandedRawIds = Array.from(allResponsavelIds)
    if (expandedRawIds.length > 0) {
      try {
        const { data: sysUsers } = await supabase
          .from('system_users')
          .select('id, auth_id, dados, email')
          .limit(5000)

        if (sysUsers && sysUsers.length > 0) {
          sysUsers.forEach((u: any) => {
            const uId = String(u.id)
            const suAuthId = u.auth_id ? String(u.auth_id) : ''
            const suEmail = (u.email || '').toLowerCase().trim()
            const rId = u.dados?.responsavel_id || u.dados?.responsavelId
            const aId = u.dados?.aluno_id || u.dados?.alunoId

            const matches = 
              expandedRawIds.includes(uId) ||
              (suAuthId && expandedRawIds.includes(suAuthId)) ||
              (suEmail && expandedRawIds.includes(suEmail)) ||
              (rId && expandedRawIds.includes(String(rId))) ||
              (aId && expandedRawIds.includes(String(aId)))

            if (matches) {
              allResponsavelIds.add(uId)
              if (suAuthId) allResponsavelIds.add(suAuthId)
              if (u.dados?.auth_id) allResponsavelIds.add(String(u.dados.auth_id))
            }
          })
        }
      } catch (sysErr) {
        console.warn('[NotifHelper] Aviso ao expandir IDs via system_users:', sysErr)
      }

      // Buscar Auth UUIDs de responsáveis via admin.listUsers para os emails encontrados
      if (respEmails.size > 0 && supabase.auth?.admin) {
        try {
          let page = 1
          let foundCount = 0
          while (page <= 5 && foundCount < respEmails.size) {
            const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
            if (!list?.users || list.users.length === 0) break
            list.users.forEach((u: any) => {
              const mail = (u.email || '').toLowerCase().trim()
              const metaRespId = String(u.user_metadata?.responsavel_id || '').trim()
              if (respEmails.has(mail) || (metaRespId && expandedRawIds.includes(metaRespId))) {
                foundCount++
                allResponsavelIds.add(String(u.id))
              }
            })
            if (list.users.length < 1000) break
            page++
          }
        } catch (authListErr) {
          console.warn('[NotifHelper] Aviso ao listar auth.users para responsáveis:', authListErr)
        }
      }
    }

    const result = Array.from(allResponsavelIds)
    console.log(`[NotifHelper] ${result.length} destinatário(s) resolvido(s) | turmas=${allGroupTerms.length} | alunos=${finalAlunosIds.length}`)
    return result

  } catch (err: any) {
    console.error('[NotifHelper] Erro crítico ao resolver destinatários:', err.message)
    return []
  }
}

/**
 * Resolve os IDs de colaboradores para push direto.
 * Mapeia tanto system_users.id, auth_id (Auth UUID), email quanto funcionarios.id/user_id para entrega OneSignal.
 */
export async function getColaboradorIds(colaboradoresIds: string[]): Promise<string[]> {
  if (!colaboradoresIds || colaboradoresIds.length === 0) return []
  const finalIds = new Set<string>()
  colaboradoresIds.forEach(id => {
    const idAny = id as any
    const val = typeof idAny === 'object' && idAny !== null
      ? (idAny.id || idAny.colaboradorId || idAny.usuarioId || idAny.funcionarioId || idAny.user_id)
      : idAny
    const clean = String(val || '').replace(/^[feq_]+/, '').trim()
    if (clean && clean !== '[object Object]') finalIds.add(clean)
  })

  try {
    const supabase = supabaseServer
    const [sysRes, funcRes] = await Promise.allSettled([
      supabase.from('system_users').select('id, auth_id, email, dados, status').or('status.neq.inativo,status.is.null').limit(3000),
      supabase.from('funcionarios').select('id, codigo, email, dados, status').limit(3000),
    ])

    const sysColabs = sysRes.status === 'fulfilled' && sysRes.value.data ? sysRes.value.data : []
    const funcRows = funcRes.status === 'fulfilled' && funcRes.value.data ? funcRes.value.data : []

    const matchedEmails = new Set<string>()
    const matchedUserIds = new Set<string>()

    funcRows.forEach((f: any) => {
      const fId = String(f.id).trim()
      const fCodigo = f.codigo ? String(f.codigo).trim() : ''
      const fUserId = String(f.dados?.auth_id || f.dados?.user_id || '').trim()
      const fEmail = (f.email || '').toLowerCase().trim()

      if (
        finalIds.has(fId) ||
        (fCodigo && finalIds.has(fCodigo)) ||
        (fUserId && finalIds.has(fUserId)) ||
        (fEmail && finalIds.has(fEmail))
      ) {
        finalIds.add(fId)
        if (fCodigo) finalIds.add(fCodigo)
        if (fUserId) {
          finalIds.add(fUserId)
          matchedUserIds.add(fUserId)
        }
        if (fEmail) {
          finalIds.add(fEmail)
          matchedEmails.add(fEmail)
        }
      }
    })

    sysColabs.forEach((su: any) => {
      const suId = String(su.id).trim()
      const suAuthId = su.auth_id ? String(su.auth_id).trim() : ''
      const suEmail = (su.email || '').toLowerCase().trim()
      const dadosAuthId = su.dados?.auth_id ? String(su.dados.auth_id).trim() : ''
      const dadosColabId = su.dados?.colaborador_id ? String(su.dados.colaborador_id).trim() : ''

      const matches = 
        finalIds.has(suId) || 
        (suAuthId && finalIds.has(suAuthId)) || 
        (suEmail && finalIds.has(suEmail)) ||
        (dadosAuthId && finalIds.has(dadosAuthId)) ||
        (dadosColabId && finalIds.has(dadosColabId)) ||
        (suEmail && matchedEmails.has(suEmail)) ||
        (suId && matchedUserIds.has(suId)) ||
        (suAuthId && matchedUserIds.has(suAuthId))

      if (matches) {
        finalIds.add(suId)
        if (suAuthId) finalIds.add(suAuthId)
        if (dadosAuthId) finalIds.add(dadosAuthId)
        if (dadosColabId) finalIds.add(dadosColabId)
        if (suEmail) finalIds.add(suEmail)
      }
    })
  } catch (e) {
    console.warn('[NotifHelper] Erro ao expandir getColaboradorIds:', e)
  }

  return Array.from(finalIds)
}

function extractCleanTerms(arr: any): string[] {
  if (!arr) return []
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr) } catch { return [arr.trim()].filter(Boolean) }
  }
  if (!Array.isArray(arr)) return []
  const terms: string[] = []
  arr.forEach(item => {
    if (!item) return
    if (typeof item === 'string' || typeof item === 'number') {
      const s = String(item).trim()
      if (s && s !== '[object Object]') terms.push(s)
    } else if (typeof item === 'object') {
      if (item.name) terms.push(String(item.name).trim())
      if (item.nome) terms.push(String(item.nome).trim())
      if (item.id) terms.push(String(item.id).trim())
      if (item.title) terms.push(String(item.title).trim())
    }
  })
  return Array.from(new Set(terms.filter(Boolean)))
}

function extractCleanIds(arr: any, prefixRegex = /^[feqag_]+/): string[] {
  if (!arr) return []
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr) } catch { return [arr.replace(prefixRegex, '').trim()].filter(Boolean) }
  }
  if (!Array.isArray(arr)) return []
  const ids: string[] = []
  arr.forEach(item => {
    if (!item) return
    if (typeof item === 'string' || typeof item === 'number') {
      const s = String(item).replace(prefixRegex, '').trim()
      if (s && s !== '[object Object]') ids.push(s)
    } else if (typeof item === 'object') {
      const val = item.id || item.colaboradorId || item.usuarioId || item.funcionarioId || item.user_id || item.alunoId
      if (val) {
        const s = String(val).replace(prefixRegex, '').trim()
        if (s && s !== '[object Object]') ids.push(s)
      }
    }
  })
  return Array.from(new Set(ids.filter(Boolean)))
}

/**
 * Resolve alvos para Comunicados (Per-Student).
 * Retorna uma lista de alunos com seus respectivos responsáveis e nomes, 
 * para permitir o disparo de notificações push separadas (não agrupadas) por aluno.
 */
export async function getStudentTargetsForComunicados(dados: TargetParams | null | undefined): Promise<{
  students: { aluno_id: string; aluno_nome: string; responsaveis_ids: string[] }[];
  directColaboradores: string[];
}> {
  if (!dados) return { students: [], directColaboradores: [] }

  try {
    const supabase = supabaseServer
    const innerDados = (dados as any)?.dados || {}

    const rawTurmas = [
      ...(dados.turmas || []),
      ...(dados.targetClasses || []),
      ...(dados.turmasIds || []),
      ...(innerDados.turmas || []),
      ...(innerDados.targetClasses || []),
      ...(innerDados.turmasIds || []),
    ]
    const rawGrupos = [
      ...(dados.grupos || []),
      ...(dados.targetGrupos || []),
      ...(dados.gruposIds || []),
      ...(innerDados.grupos || []),
      ...(innerDados.targetGrupos || []),
      ...(innerDados.gruposIds || []),
    ]
    const turmas = extractCleanTerms(rawTurmas)
    const grupos = extractCleanTerms(rawGrupos)
    const allGroupTerms = Array.from(new Set([...turmas, ...grupos]))

    // Separar alunosIds de colaboradoresIds: itens com prefixo f_ são colaboradores
    // (fallback para dados antigos salvos antes do fix do DestinatariosModal)
    const rawAlunosIds = [
      ...(dados.alunosIds || []),
      ...(dados.targetStudents || []),
      ...(innerDados.alunosIds || []),
      ...(innerDados.targetStudents || []),
    ]
    const colabsFromAlunosIds = rawAlunosIds.filter((id: any) => {
      const s = typeof id === 'string' ? id : String(id || '')
      return s.startsWith('f_') || s.startsWith('func_')
    })
    const alunosIds = extractCleanIds(
      rawAlunosIds.filter((id: any) => {
        const s = typeof id === 'string' ? id : String(id || '')
        return !s.startsWith('f_') && !s.startsWith('func_')
      }),
      /^(a_|_ALU)/
    )

    const colaboradoresIds = extractCleanIds([
      ...(dados.colaboradoresIds || []),
      ...(dados.funcionariosIds || []),
      ...(innerDados.colaboradoresIds || []),
      ...(innerDados.funcionariosIds || []),
      ...colabsFromAlunosIds, // fallback: colaboradores que foram mal colocados em alunosIds
    ], /^[feq_]+/)

    if (colabsFromAlunosIds.length > 0) {
      console.log(`[NotifHelper] Fallback: ${colabsFromAlunosIds.length} colaboradores detectados em alunosIds e movidos para colaboradoresIds`)
    }

    const rawDestino = String(dados.destino || innerDados.destino || '').toLowerCase().trim()
    const isInterno = rawDestino === 'interno'

    const todosAnoMatch = allGroupTerms.find(t => t.toLowerCase().trim().startsWith('todos:'))
    const isTodos =
      rawDestino === 'todos' ||
      rawDestino === 'toda a escola' ||
      rawDestino === 'all' ||
      rawDestino === 'todas' ||
      allGroupTerms.some(t => {
        const tl = t.toLowerCase().trim()
        return tl === 'todos' || tl === 'toda a escola' || tl === 'all' || tl === 'todas'
      })

    let alunosToProcess: { id: string, nome: string }[] = []

    if (isInterno) {
      // Comunicados internos são exclusivamente para a equipe escolar/colaboradores!
      // Alunos e responsáveis NÃO devem receber push de comunicado interno.
      alunosToProcess = []

      // Se nenhum colaborador ou grupo específico foi selecionado, envia para toda a equipe
      if (colaboradoresIds.length === 0 && allGroupTerms.length === 0) {
        try {
          const { data: allSysUsers } = await supabase
            .from('system_users')
            .select('id, auth_id, email, status')
            .or('status.neq.inativo,status.is.null')
            .limit(3000)

          if (allSysUsers) {
            allSysUsers.forEach((u: any) => {
              if (u.id) colaboradoresIds.push(String(u.id))
              if (u.auth_id) colaboradoresIds.push(String(u.auth_id))
              if (u.email) colaboradoresIds.push(String(u.email).toLowerCase().trim())
            })
          }
        } catch (sysAllErr) {
          console.warn('[NotifHelper] Erro ao buscar todos colaboradores para destino interno:', sysAllErr)
        }
      }
    } else if (isTodos && !todosAnoMatch) {
      // Busca TODOS os alunos (limit alto para escolas grandes, mas evita full scan sem limite)
      const { data, error } = await supabase.from('alunos').select('id, nome').limit(5000)
      if (!error && data) {
        alunosToProcess = data.map((d: any) => ({ id: String(d.id), nome: d.nome || '' }))
      }

      // Toda a Escola / Todos também inclui todos os colaboradores ativos!
      try {
        const { data: allSysUsers } = await supabase
          .from('system_users')
          .select('id, auth_id, email, status')
          .or('status.neq.inativo,status.is.null')
          .limit(3000)

        if (allSysUsers) {
          allSysUsers.forEach((u: any) => {
            if (u.id) colaboradoresIds.push(String(u.id))
            if (u.auth_id) colaboradoresIds.push(String(u.auth_id))
            if (u.email) colaboradoresIds.push(String(u.email).toLowerCase().trim())
          })
        }
      } catch (sysAllErr) {
        console.warn('[NotifHelper] Erro ao buscar todos colaboradores para isTodos:', sysAllErr)
      }
    } else {
      let targetAlunosSet = new Map<string, string>() // id -> nome

      // Adicionar alunos explicitamente listados
      if (alunosIds.length > 0) {
        const data = await fetchInChunks<any>(supabase, 'alunos', 'id, nome', 'id', alunosIds)
        data.forEach(a => targetAlunosSet.set(String(a.id), a.nome || ''))
      }

      // Adicionar turmas, grupos e equipes
      if (allGroupTerms.length > 0) {
        // 1. Resolver grupos na tabela agenda_grupos e agenda_equipes
        const [gruposRes, equipesRes] = await Promise.allSettled([
          supabase.from('agenda_grupos').select('id, dados'),
          supabase.from('agenda_equipes').select('id, dados')
        ])

        const allGrupos = gruposRes.status === 'fulfilled' && gruposRes.value.data ? gruposRes.value.data : []
        const allEquipes = equipesRes.status === 'fulfilled' && equipesRes.value.data ? equipesRes.value.data : []

        if (allGrupos.length > 0) {
          const matchedGrupos = allGrupos.filter((g: any) => {
            const gId = String(g.id || '').toLowerCase()
            const gNome = String(g.dados?.nome || g.nome || '').toLowerCase()
            const gSync = String(g.dados?.syncId || g.syncId || '').toLowerCase()
            return allGroupTerms.some(term => {
              const tl = term.toLowerCase().trim()
              return tl === gId || tl === gNome || gNome.includes(tl) || tl.includes(gNome) || tl === `g_${gId}` || tl === gSync || (gSync && `sync-${tl}` === gSync)
            })
          })
          
          let grupoAlunosIds: string[] = []
          matchedGrupos.forEach((g: any) => {
            const list = g.dados?.alunosIds || g.alunosIds || [];
            let parsedList = list
            if (typeof list === 'string') {
              try { parsedList = JSON.parse(list) } catch { parsedList = [] }
            }
            if (Array.isArray(parsedList)) {
              parsedList.forEach((aId: string) => {
                const cleanId = String(aId).replace(/^(a_|_ALU)/, '')
                if (cleanId) grupoAlunosIds.push(cleanId)
              })
            }

            let colabs = g.dados?.colaboradoresIds || g.dados?.funcionariosIds || g.colaboradoresIds || g.funcionariosIds || [];
            if (typeof colabs === 'string') {
              try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
            }
            if (Array.isArray(colabs)) {
              colabs.forEach((c: any) => {
                const val = typeof c === 'object' && c !== null ? (c.id || c.colaboradorId || c.usuarioId || c.funcionarioId || c.user_id) : c;
                const clean = String(val || '').replace(/^[feq_]+/, '').trim()
                if (clean && clean !== '[object Object]') colaboradoresIds.push(clean)
              });
            }
          })

          if (grupoAlunosIds.length > 0) {
            const data = await fetchInChunks<any>(supabase, 'alunos', 'id, nome', 'id', grupoAlunosIds)
            data.forEach(a => targetAlunosSet.set(String(a.id), a.nome || ''))
          }
        }

        // Resolver em agenda_equipes (equipes pedagógicas e escolares)
        if (allEquipes.length > 0) {
          const matchedEquipes = allEquipes.filter((e: any) => {
            const eId = String(e.id || '').toLowerCase()
            const eNome = String(e.dados?.nome || e.nome || '').toLowerCase()
            return allGroupTerms.some(term => {
              const tl = term.toLowerCase().trim()
              return tl === eId || tl === eNome || eNome.includes(tl) || tl.includes(eNome) || tl === `eq_${eId}` || tl === `g_${eId}`
            })
          })

          matchedEquipes.forEach((e: any) => {
            let membros = e.dados?.membrosIds || e.dados?.colaboradoresIds || e.dados?.funcionariosIds || e.membrosIds || e.colaboradoresIds || [];
            if (typeof membros === 'string') {
              try { membros = JSON.parse(membros); } catch(err) { membros = []; }
            }
            if (Array.isArray(membros)) {
              membros.forEach((c: any) => {
                const val = typeof c === 'object' && c !== null ? (c.id || c.colaboradorId || c.usuarioId || c.funcionarioId || c.user_id) : c;
                const clean = String(val || '').replace(/^[feq_]+/, '').trim()
                if (clean && clean !== '[object Object]') colaboradoresIds.push(clean)
              })
            }
          })
        }

        // 2. Resolver nomes/IDs de turmas para IDs reais no banco
        const { data: allTurmas, error: turmasError } = await supabase
          .from('turmas')
          .select('id, codigo, nome, serie, turno, ano, dados')
          .limit(500)

        if (!turmasError && allTurmas) {
          const matchedTurmas = allTurmas.filter(t => {
            return allGroupTerms.some(turma => matchesTurmaTerm(t, turma))
          });
          
          const matchedTurmaIds = matchedTurmas.map(t => String(t.id))

          // Extrair colaboradores dessas turmas (através dos agenda_grupos correspondentes)
          if (allGrupos && allGrupos.length > 0) {
             matchedTurmas.forEach(t => {
                const tId = String(t.id);
                const tNomeNorm = normalizeTurmaTerm(t.nome);
                const relatedGroup = allGrupos.find((g: any) => {
                  const sId = String(g.dados?.syncId || '');
                  const gId = String(g.id || '');
                  const gNomeNorm = normalizeTurmaTerm(g.dados?.nome || g.nome);
                  return sId === `sync-${tId}` || gId === `sync-${tId}` || (tNomeNorm && gNomeNorm === tNomeNorm);
                });
                if (relatedGroup) {
                  let colabs = (relatedGroup as any).dados?.colaboradoresIds || (relatedGroup as any).colaboradoresIds || [];
                  if (typeof colabs === 'string') {
                    try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
                  }
                  if (Array.isArray(colabs)) {
                    colabs.forEach((c: any) => {
                      const val = typeof c === 'object' && c !== null ? (c.id || c.colaboradorId || c.usuarioId || c.funcionarioId || c.user_id) : c;
                      const clean = String(val || '').replace(/^[feq_]+/, '').trim()
                      if (clean && clean !== '[object Object]') colaboradoresIds.push(clean)
                    });
                  }
                }
             });
          }

          const allSearchTerms = Array.from(new Set([...allGroupTerms.filter(t => !t.toLowerCase().trim().startsWith('todos:')), ...matchedTurmaIds]))

          if (allSearchTerms.length > 0) {
            const alunosTurma = await fetchInChunks<any>(supabase, 'alunos', 'id, nome', 'turma', allSearchTerms)
            alunosTurma.forEach(a => targetAlunosSet.set(String(a.id), a.nome || ''))
          }

          // Adicionar alunosIds de grupos sincronizados associados às turmas encontradas (ex: sync-6866 para Integral)
          if (allGrupos && matchedTurmas.length > 0) {
            matchedTurmas.forEach((t: any) => {
              const tIdStr = String(t.id);
              const tNomeNorm = normalizeTurmaTerm(t.nome);
              const syncG = allGrupos.find((g: any) => {
                const gSync = g.dados?.syncId || (String(g.id).startsWith('sync-') ? g.id : '');
                const gNomeNorm = normalizeTurmaTerm(g.dados?.nome || (g as any).nome);
                return gSync === `sync-${tIdStr}` || g.id === `sync-${tIdStr}` || (tNomeNorm && gNomeNorm === tNomeNorm);
              });
              if (syncG) {
                let aList = syncG.dados?.alunosIds || (syncG as any).alunosIds || [];
                if (typeof aList === 'string') {
                  try { aList = JSON.parse(aList); } catch { aList = []; }
                }
                if (Array.isArray(aList)) {
                  aList.forEach((aId: string) => {
                    const cleanId = String(aId).replace(/^(a_|_ALU)/, '');
                    if (cleanId && !targetAlunosSet.has(cleanId)) targetAlunosSet.set(cleanId, '');
                  });
                }
              }
            });
          }

          // Buscar todos alunos ativos para verificar pertencimento por duplo vínculo (Integral/Intermediário)
          if (matchedTurmas.length > 0) {
            const { data: allStudents } = await supabase
              .from('alunos')
              .select('id, nome, turma, status, dados')
              .or('status.neq.inativo,status.is.null');

            if (allStudents) {
              allStudents.forEach((a: any) => {
                matchedTurmas.forEach((t: any) => {
                  if (isAlunoCursandoTurma(a, t, t.ano)) {
                    targetAlunosSet.set(String(a.id), a.nome || '');
                  }
                });
                if (targetAlunosSet.has(String(a.id)) && !targetAlunosSet.get(String(a.id))) {
                  targetAlunosSet.set(String(a.id), a.nome || '');
                }
              });
            }
          }
        }
      }

      alunosToProcess = Array.from(targetAlunosSet.entries()).map(([id, nome]) => ({ id, nome }))
    }

    // Buscar responsáveis para TODOS os alunos agrupados
    let studentsResult: { aluno_id: string; aluno_nome: string; responsaveis_ids: string[] }[] = []

    if (alunosToProcess.length > 0) {
      const allAlunoIds = alunosToProcess.map(a => a.id)
      const expandedAlunoIds = new Set<string>()
      allAlunoIds.forEach(id => {
        expandedAlunoIds.add(id)
        const clean = id.replace(/^(a_|_ALU)/, '')
        if (clean) expandedAlunoIds.add(clean)
        const num = parseInt(id.replace(/\D/g, ''), 10)
        if (!isNaN(num)) {
          expandedAlunoIds.add(String(num))
          expandedAlunoIds.add(String(num).padStart(6, '0'))
        }
      })

      const searchIdsArray = Array.from(expandedAlunoIds)
      const vinculados = await fetchInChunks<any>(supabase, 'aluno_responsavel', 'aluno_id, responsavel_id', 'aluno_id', searchIdsArray)

      // Agrupar responsáveis por aluno, sempre incluindo o ID do próprio aluno (para logins virtuais)
      const mapResponsaveis = new Map<string, Set<string>>()
      
      alunosToProcess.forEach(a => {
        mapResponsaveis.set(a.id, new Set([a.id]))
      })

      if (vinculados && vinculados.length > 0) {
        vinculados.forEach(v => {
          if (v.aluno_id && v.responsavel_id) {
            const aid = String(v.aluno_id)
            const aidClean = aid.replace(/^0+/, '')
            const matchedAluno = alunosToProcess.find(a => 
              a.id === aid || 
              a.id.replace(/^0+/, '') === aidClean
            )
            const targetKey = matchedAluno ? matchedAluno.id : aid
            if (!mapResponsaveis.has(targetKey)) mapResponsaveis.set(targetKey, new Set([targetKey]))
            mapResponsaveis.get(targetKey)!.add(String(v.responsavel_id))
          }
        })
      }

      // Mapear responsáveis e alunos para Auth UUIDs (OneSignal external_id) e dados de contato
      const allRawIds = new Set<string>()
      mapResponsaveis.forEach(set => set.forEach(id => allRawIds.add(id)))
      const rawIdsArray = Array.from(allRawIds)

      if (rawIdsArray.length > 0) {
        try {
          const respEmails = new Set<string>()
          const respRows = await fetchInChunks<any>(supabase, 'responsaveis', 'id, email, user_id, dados', 'id', rawIdsArray)
          if (respRows && respRows.length > 0) {
            respRows.forEach((r: any) => {
              const rIdStr = String(r.id)
              const uId = r.user_id ? String(r.user_id) : ''
              const authId = r.dados?.auth_id ? String(r.dados.auth_id) : (r.dados?.user_id ? String(r.dados.user_id) : '')
              const rEmail = (r.email || '').toLowerCase().trim()
              if (rEmail) respEmails.add(rEmail)

              mapResponsaveis.forEach((set) => {
                if (set.has(rIdStr)) {
                  if (uId) set.add(uId)
                  if (authId) set.add(authId)
                  if (rEmail) set.add(rEmail)
                }
              })
            })
          }

          const { data: sysUsers } = await supabase
            .from('system_users')
            .select('id, auth_id, dados, email')
            .limit(5000)

          if (sysUsers && sysUsers.length > 0) {
            sysUsers.forEach((u: any) => {
              const rId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
              const aId = String(u.dados?.aluno_id || u.dados?.alunoId || '').trim()
              const uEmail = (u.email || '').toLowerCase().trim()
              
              mapResponsaveis.forEach((set, alunoIdKey) => {
                if (
                  (rId && set.has(rId)) ||
                  (uEmail && set.has(uEmail)) ||
                  (aId && (alunoIdKey === aId || alunoIdKey.replace(/^0+/, '') === aId.replace(/^0+/, '')))
                ) {
                  set.add(String(u.id))
                  if (u.auth_id) set.add(String(u.auth_id))
                  if (u.dados?.auth_id) set.add(String(u.dados.auth_id))
                }
              })
            })
          }

          // Se houver emails de responsáveis, buscar no Supabase Auth para obter o Auth UUID do OneSignal
          if (respEmails.size > 0 && supabase.auth?.admin) {
            try {
              let page = 1
              let foundCount = 0
              while (page <= 5 && foundCount < respEmails.size) {
                const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
                if (!list?.users || list.users.length === 0) break
                list.users.forEach((u: any) => {
                  const mail = (u.email || '').toLowerCase().trim()
                  const metaRespId = String(u.user_metadata?.responsavel_id || '').trim()
                  if (respEmails.has(mail) || (metaRespId && rawIdsArray.includes(metaRespId))) {
                    foundCount++
                    mapResponsaveis.forEach((set) => {
                      if (set.has(mail) || (metaRespId && set.has(metaRespId))) {
                        set.add(String(u.id))
                      }
                    })
                  }
                })
                if (list.users.length < 1000) break
                page++
              }
            } catch (authListErr) {
              console.warn('[NotifHelper] Erro ao buscar auth.users para comunicados:', authListErr)
            }
          }
        } catch (sysErr) {
          console.warn('[NotifHelper] Erro ao mapear identificadores para comunicados:', sysErr)
        }
      }

      studentsResult = alunosToProcess.map(a => ({
        aluno_id: a.id,
        aluno_nome: a.nome,
        responsaveis_ids: Array.from(mapResponsaveis.get(a.id) || [])
      }))
    }

    // Mapear colaboradoresIds para incluir IDs de system_users, funcionarios e Auth UUIDs (OneSignal external_id)
    const finalColabIds = new Set<string>()
    colaboradoresIds.forEach(id => {
      const idAny = id as any
      const val = typeof idAny === 'object' && idAny !== null ? (idAny.id || idAny.colaboradorId || idAny.usuarioId || idAny.funcionarioId || idAny.user_id) : idAny;
      const clean = String(val || '').replace(/^[feq_]+/, '').trim()
      if (clean && clean !== '[object Object]') finalColabIds.add(clean)
    })

    if (finalColabIds.size > 0) {
      try {
        const [sysRes, funcRes] = await Promise.allSettled([
          supabase.from('system_users').select('id, auth_id, email, dados, status').or('status.neq.inativo,status.is.null').limit(3000),
          supabase.from('funcionarios').select('id, codigo, email, dados, status').limit(3000),
        ])

        const sysColabs = sysRes.status === 'fulfilled' && sysRes.value.data ? sysRes.value.data : []
        const funcRows = funcRes.status === 'fulfilled' && funcRes.value.data ? funcRes.value.data : []

        const matchedEmails = new Set<string>()
        const matchedUserIds = new Set<string>()

        // 1. Mapear de funcionarios para user_id, auth_id, codigo e email
        funcRows.forEach((f: any) => {
          const fId = String(f.id).trim()
          const fCodigo = f.codigo ? String(f.codigo).trim() : ''
          const fUserId = String(f.dados?.auth_id || f.dados?.user_id || '').trim()
          const fEmail = (f.email || '').toLowerCase().trim()

          if (
            finalColabIds.has(fId) ||
            (fCodigo && finalColabIds.has(fCodigo)) ||
            (fUserId && finalColabIds.has(fUserId)) ||
            (fEmail && finalColabIds.has(fEmail))
          ) {
            finalColabIds.add(fId)
            if (fCodigo) finalColabIds.add(fCodigo)
            if (fUserId) {
              finalColabIds.add(fUserId)
              matchedUserIds.add(fUserId)
            }
            if (fEmail) {
              finalColabIds.add(fEmail)
              matchedEmails.add(fEmail)
            }
          }
        })

        // 2. Mapear de system_users para auth_id (UUID do OneSignal) e outros identificadores
        sysColabs.forEach((su: any) => {
          const suId = String(su.id).trim()
          const suAuthId = su.auth_id ? String(su.auth_id).trim() : ''
          const suEmail = (su.email || '').toLowerCase().trim()
          const dadosAuthId = su.dados?.auth_id ? String(su.dados.auth_id).trim() : ''
          const dadosColabId = su.dados?.colaborador_id ? String(su.dados.colaborador_id).trim() : ''

          const matches = 
            finalColabIds.has(suId) || 
            (suAuthId && finalColabIds.has(suAuthId)) || 
            (suEmail && finalColabIds.has(suEmail)) ||
            (dadosAuthId && finalColabIds.has(dadosAuthId)) ||
            (dadosColabId && finalColabIds.has(dadosColabId)) ||
            (suEmail && matchedEmails.has(suEmail)) ||
            (suId && matchedUserIds.has(suId)) ||
            (suAuthId && matchedUserIds.has(suAuthId))

          if (matches) {
            finalColabIds.add(suId)
            if (suAuthId) finalColabIds.add(suAuthId)
            if (dadosAuthId) finalColabIds.add(dadosAuthId)
            if (dadosColabId) finalColabIds.add(dadosColabId)
            if (suEmail) finalColabIds.add(suEmail)
          }
        })
      } catch (colabErr) {
        console.warn('[NotifHelper] Aviso ao expandir colaboradores via system_users e funcionarios:', colabErr)
      }
    }

    return {
      students: studentsResult,
      directColaboradores: Array.from(finalColabIds)
    }
  } catch (err: any) {
    console.error('[NotifHelper] Erro em getStudentTargetsForComunicados:', err.message)
    return { students: [], directColaboradores: [] }
  }
}

/**
 * Verifica se o usuário logado (authUserId) tem permissão de visualizar 
 * dados sensíveis de um aluno específico (alunoId).
 * Garante proteção contra IDOR (Insecure Direct Object Reference).
 */
export async function checkResponsavelRelationship(authUserId: string, alunoId: string): Promise<boolean> {
  if (!authUserId || !alunoId) return false;
  try {
    const supabase = supabaseServer;
    
    const cleanAlunoId = String(alunoId).replace(/^(a_|_ALU)/, '');
    const cleanAuthId = String(authUserId).replace(/^(a_|_ALU)/, '');
    
    // Se o próprio aluno estiver logado
    if (cleanAuthId === cleanAlunoId) return true;
    
    // 1. Verifica na tabela aluno_responsavel por match direto de responsavel_id
    const { data, error } = await supabase
      .from('aluno_responsavel')
      .select('id')
      .eq('aluno_id', cleanAlunoId)
      .or(`responsavel_id.eq."${cleanAuthId}",responsavel_id.eq."${authUserId}"`)
      .maybeSingle();
      
    if (!error && data) return true;

    // 2. Se authUserId for um Auth UUID, buscar na tabela responsaveis por user_id ou dados->auth_id
    const candidateRespIds = new Set<string>();
    const { data: respRows } = await supabase
      .from('responsaveis')
      .select('id, dados')
      .or(`user_id.eq."${authUserId}",dados->>auth_id.eq."${authUserId}",dados->>user_id.eq."${authUserId}"`)
      .limit(10);

    if (respRows && respRows.length > 0) {
      respRows.forEach((r: any) => {
        if (r.id) candidateRespIds.add(String(r.id));
      });
    }

    // 3. Checar em system_users se existe vínculo com responsavel_id
    const { data: sysRows } = await supabase
      .from('system_users')
      .select('id, dados')
      .or(`id.eq."${authUserId}",auth_id.eq."${authUserId}"`)
      .limit(5);

    if (sysRows && sysRows.length > 0) {
      sysRows.forEach((s: any) => {
        const rId = s.dados?.responsavel_id || s.dados?.responsavelId;
        if (rId) candidateRespIds.add(String(rId));
      });
    }

    if (candidateRespIds.size > 0) {
      const respIdList = Array.from(candidateRespIds);
      const { data: linkMatch } = await supabase
        .from('aluno_responsavel')
        .select('id')
        .eq('aluno_id', cleanAlunoId)
        .in('responsavel_id', respIdList)
        .limit(1)
        .maybeSingle();

      if (linkMatch) return true;
    }
    
    return false;
  } catch (err) {
    console.error('[NotifHelper] Erro ao verificar vínculo de responsável:', err);
    return false;
  }
}
