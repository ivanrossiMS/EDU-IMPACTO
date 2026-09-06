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


interface TargetParams {
  /** Nomes ou IDs das turmas destinatárias */
  turmas?: string[]
  /** IDs das turmas destinatárias */
  turmasIds?: string[]
  /** Alias para turmas */
  targetClasses?: string[]
  /** IDs dos alunos destinatários */
  alunosIds?: string[]
  /** Alias para alunosIds */
  targetStudents?: string[]
  /** Destino geral: "todos", "selecionados", etc. */
  destino?: string
  /** IDs diretos de colaboradores/funcionários a incluir */
  colaboradoresIds?: string[]
  /** Nomes ou IDs de grupos manuais a incluir */
  grupos?: string[]
  /** IDs de grupos manuais a incluir */
  gruposIds?: string[]
  /** IDs de funcionários enviados pelo frontend */
  funcionariosIds?: string[]
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

    const turmas = (dados.turmas || dados.targetClasses || []).map(String).filter(Boolean)
    const turmasIds = (dados.turmasIds || []).map(String).filter(Boolean)
    const grupos = (dados.grupos || []).map(String).filter(Boolean)
    const gruposIds = (dados.gruposIds || []).map(String).filter(Boolean)
    const allGroupTerms = Array.from(new Set([...turmas, ...turmasIds, ...grupos, ...gruposIds]))
    const alunosIds = (dados.alunosIds || dados.targetStudents || []).map(String).filter(Boolean)
    const colaboradoresIds = [...(dados.colaboradoresIds || []), ...(dados.funcionariosIds || [])].map(String).filter(Boolean)
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
      // 1. Resolver grupos na tabela agenda_grupos (apenas id e dados existem na tabela)
      const { data: allGrupos, error: gruposError } = await supabase
        .from('agenda_grupos')
        .select('id, dados')

      if (!gruposError && allGrupos) {
        const matchedGrupos = allGrupos.filter(g => {
          const gId = String(g.id).toLowerCase()
          const gNome = String(g.dados?.nome || (g as any).nome || '').toLowerCase()
          return allGroupTerms.some(term => {
            const tl = term.toLowerCase().trim()
            return tl === gId || tl === gNome || (tl.length > 2 && (gNome.includes(tl) || tl.includes(gNome)))
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
        .select('id, nome, codigo, ano, dados')
        .limit(500) // evitar full-table scan em escolas grandes

      if (turmasError) {
        console.error('[NotifHelper] Erro ao buscar turmas:', turmasError.message)
      } else {
        const matchedTurmas = (allTurmas || []).filter((t: any) => {
          const tId = String(t.id).toLowerCase()
          const tNome = String(t.nome || '').toLowerCase()
          const tCod = String(t.codigo || '').toLowerCase()
          const tAno = t.ano !== undefined ? String(t.ano) : (t.dados?.anoLetivo || '')

          return allGroupTerms.some(turma => {
            const tl = turma.toLowerCase().trim()
            if (tl.startsWith('todos:')) {
              const targetAno = tl.split(':')[1]?.trim()
              return targetAno === tAno
            }
            return tl === tId || tl === tNome || tl === tCod ||
              tNome.includes(tl) || tl.includes(tNome)
          })
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

    // ── Mapear IDs de responsáveis/alunos para system_users.id ───────────
    // Garante que se o usuário logou com seu ID de system_user (Auth UUID), 
    // a notificação o encontre mesmo se o destino foi especificado como responsavel_id
    const rawIds = Array.from(allResponsavelIds)
    if (rawIds.length > 0) {
      try {
        // 1. Coletar e-mails dos responsáveis vinculados aos alvos
        const numericRespIds = rawIds.filter(id => /^\d+$/.test(id))
        const respEmailToIdMap = new Map<string, string>()
        if (numericRespIds.length > 0) {
          const respRows = await fetchInChunks<any>(supabase, 'responsaveis', 'id, email', 'id', numericRespIds)
          respRows.forEach((r: any) => {
            if (r.email) {
              respEmailToIdMap.set(String(r.email).toLowerCase().trim(), String(r.id))
            }
          })
        }

        const { data: sysUsers } = await supabase
          .from('system_users')
          .select('id, dados, email')
          .limit(5000)

        if (sysUsers && sysUsers.length > 0) {
          sysUsers.forEach((u: any) => {
            const rId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
            const aId = String(u.dados?.aluno_id || u.dados?.alunoId || '').trim()
            const uEmail = String(u.email || '').toLowerCase().trim()

            const matchByDados = (rId && rawIds.includes(rId)) || (aId && rawIds.includes(aId))
            const matchByEmail = uEmail && respEmailToIdMap.has(uEmail)

            if (matchByDados || matchByEmail) {
              allResponsavelIds.add(String(u.id))
              if (u.dados?.auth_id) {
                allResponsavelIds.add(String(u.dados.auth_id))
              }
            }
          })
        }
      } catch (sysErr) {
        console.warn('[NotifHelper] Aviso ao expandir IDs via system_users:', sysErr)
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
 * Útil quando a notificação é endereçada diretamente a colaboradores,
 * sem necessidade de passar pelos responsáveis de alunos.
 */
export async function getColaboradorIds(colaboradoresIds: string[]): Promise<string[]> {
  if (!colaboradoresIds || colaboradoresIds.length === 0) return []
  return colaboradoresIds.map(String).filter(Boolean)
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

    const turmas = (dados.turmas || dados.targetClasses || []).map(String).filter(Boolean)
    const turmasIds = (dados.turmasIds || []).map(String).filter(Boolean)
    const grupos = (dados.grupos || []).map(String).filter(Boolean)
    const gruposIds = (dados.gruposIds || []).map(String).filter(Boolean)
    const allGroupTerms = Array.from(new Set([...turmas, ...turmasIds, ...grupos, ...gruposIds]))
    const alunosIds = (dados.alunosIds || dados.targetStudents || []).map(String).filter(Boolean)
    const colaboradoresIds = [...(dados.colaboradoresIds || []), ...(dados.funcionariosIds || [])].map(String).filter(Boolean)
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

    let alunosToProcess: { id: string, nome: string }[] = []

    if (isTodos && !todosAnoMatch) {
      // Busca TODOS os alunos (limit alto para escolas grandes, mas evita full scan sem limite)
      const { data, error } = await supabase.from('alunos').select('id, nome').limit(5000)
      if (!error && data) {
        alunosToProcess = data.map((d: any) => ({ id: String(d.id), nome: d.nome || '' }))
      }
    } else {
      let targetAlunosSet = new Map<string, string>() // id -> nome

      // Adicionar alunos explicitamente listados
      const cleanAlunosIds = alunosIds.map(id => id.replace(/^(a_|_ALU)/, '')).filter(Boolean)
      if (cleanAlunosIds.length > 0) {
        const data = await fetchInChunks<any>(supabase, 'alunos', 'id, nome', 'id', cleanAlunosIds)
        data.forEach(a => targetAlunosSet.set(String(a.id), a.nome || ''))
      }

      // Adicionar turmas e grupos
      if (allGroupTerms.length > 0) {
        // 1. Resolver grupos na tabela agenda_grupos (apenas id e dados existem na tabela)
        const { data: allGrupos, error: gruposError } = await supabase.from('agenda_grupos').select('id, dados')
        if (!gruposError && allGrupos) {
          const matchedGrupos = allGrupos.filter(g => {
            const gId = String(g.id).toLowerCase()
            const gNome = String((g as any).nome || g.dados?.nome || '').toLowerCase()
            return allGroupTerms.some(term => {
              const tl = term.toLowerCase().trim()
              return tl === gId || tl === gNome || (tl.length > 2 && (gNome.includes(tl) || tl.includes(gNome)))
            })
          })
          
          let grupoAlunosIds: string[] = []
          matchedGrupos.forEach(g => {
            const list = g.dados?.alunosIds || (g as any).alunosIds || [];
            list.forEach((aId: string) => {
              const cleanId = aId.replace(/^(a_|_ALU)/, '')
              if (cleanId) grupoAlunosIds.push(cleanId)
            })

            let colabs = g.dados?.colaboradoresIds || (g as any).colaboradoresIds || [];
            if (typeof colabs === 'string') {
              try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
            }
            if (Array.isArray(colabs)) {
              colabs.forEach((c: any) => colaboradoresIds.push(String(c)));
            }

            let funcs = g.dados?.funcionariosIds || [];
            if (typeof funcs === 'string') {
              try { funcs = JSON.parse(funcs); } catch(e) { funcs = []; }
            }
            if (Array.isArray(funcs)) {
              funcs.forEach((f: any) => colaboradoresIds.push(String(f)));
            }

            let equipes = g.dados?.equipesIds || [];
            if (typeof equipes === 'string') {
              try { equipes = JSON.parse(equipes); } catch(e) { equipes = []; }
            }
            if (Array.isArray(equipes)) {
              equipes.forEach((eq: any) => colaboradoresIds.push(String(eq)));
            }
          })

          if (grupoAlunosIds.length > 0) {
            const data = await fetchInChunks<any>(supabase, 'alunos', 'id, nome', 'id', grupoAlunosIds)
            data.forEach(a => targetAlunosSet.set(String(a.id), a.nome || ''))
          }
        }

        // 2. Resolver nomes/IDs de turmas para IDs reais no banco
        const { data: allTurmas, error: turmasError } = await supabase.from('turmas').select('id, nome, codigo, ano, dados').limit(500)
        if (!turmasError && allTurmas) {
          const matchedTurmas = allTurmas.filter(t => {
            const tId = String(t.id).toLowerCase()
            const tNome = String(t.nome || '').toLowerCase()
            const tCod = String(t.codigo || '').toLowerCase()
            const tAno = t.ano !== undefined ? String(t.ano) : (t.dados?.anoLetivo || '')

            return allGroupTerms.some(turma => {
              const tl = turma.toLowerCase().trim()
              if (tl.startsWith('todos:')) {
                const targetAno = tl.split(':')[1]?.trim()
                return targetAno === tAno
              }
              return tl === tId || tl === tNome || tl === tCod || tNome.includes(tl) || tl.includes(tNome)
            })
          });
          
          const matchedTurmaIds = matchedTurmas.map(t => String(t.id))

          // Extrair colaboradores dessas turmas (através dos agenda_grupos correspondentes)
          if (!gruposError && allGrupos) {
             matchedTurmas.forEach(t => {
                const tId = String(t.id);
                const tNome = String(t.nome || '').trim().toLowerCase();
                const relatedGroup = allGrupos.find(g => {
                  const sId = String(g.dados?.syncId || '');
                  const gId = String(g.id || '');
                  return sId === `sync-${tId}` || gId === `sync-${tId}` || String(g.dados?.nome || '').trim().toLowerCase() === tNome;
                });
                if (relatedGroup) {
                  let colabs = relatedGroup.dados?.colaboradoresIds || [];
                  if (typeof colabs === 'string') {
                    try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
                  }
                  if (Array.isArray(colabs)) {
                    colabs.forEach((c: any) => colaboradoresIds.push(String(c)));
                  }
                }
             });
          }

          const allSearchTerms = Array.from(new Set([...allGroupTerms.filter(t => !t.toLowerCase().trim().startsWith('todos:')), ...matchedTurmaIds]))

          if (allSearchTerms.length > 0) {
            const alunosTurma = await fetchInChunks<any>(supabase, 'alunos', 'id, nome', 'turma', allSearchTerms)
            alunosTurma.forEach(a => targetAlunosSet.set(String(a.id), a.nome || ''))
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

      // Mapear responsáveis e alunos para system_users (Auth UUIDs para o OneSignal)
      const allRawIds = new Set<string>()
      mapResponsaveis.forEach(set => set.forEach(id => allRawIds.add(id)))
      const rawIdsArray = Array.from(allRawIds)

      if (rawIdsArray.length > 0) {
        try {
          // 1. Coletar e-mails dos responsáveis vinculados aos alunos
          const numericRespIds = rawIdsArray.filter(id => /^\d+$/.test(id))
          const respEmailToIdMap = new Map<string, string>()
          if (numericRespIds.length > 0) {
            const respRows = await fetchInChunks<any>(supabase, 'responsaveis', 'id, email', 'id', numericRespIds)
            respRows.forEach((r: any) => {
              if (r.email) {
                respEmailToIdMap.set(String(r.email).toLowerCase().trim(), String(r.id))
              }
            })
          }

          const { data: sysUsers } = await supabase
            .from('system_users')
            .select('id, dados, email')
            .limit(5000)

          if (sysUsers && sysUsers.length > 0) {
            sysUsers.forEach((u: any) => {
              const rId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
              const aId = String(u.dados?.aluno_id || u.dados?.alunoId || '').trim()
              const uEmail = String(u.email || '').toLowerCase().trim()
              const mappedRespIdFromEmail = uEmail ? respEmailToIdMap.get(uEmail) : undefined
              
              mapResponsaveis.forEach((set, alunoIdKey) => {
                const matchByDados = (rId && set.has(rId)) || (aId && (alunoIdKey === aId || alunoIdKey.replace(/^0+/, '') === aId.replace(/^0+/, '')))
                const matchByEmail = mappedRespIdFromEmail && set.has(mappedRespIdFromEmail)

                if (matchByDados || matchByEmail) {
                  set.add(String(u.id))
                  if (u.dados?.auth_id) {
                    set.add(String(u.dados.auth_id))
                  }
                }
              })
            })
          }
        } catch (sysErr) {
          console.warn('[NotifHelper] Erro ao mapear system_users para comunicados:', sysErr)
        }
      }

      studentsResult = alunosToProcess.map(a => ({
        aluno_id: a.id,
        aluno_nome: a.nome,
        responsaveis_ids: Array.from(mapResponsaveis.get(a.id) || [])
      }))
    }

    // ── Resolução Completa de Colaboradores (Duplo Papel & Mapeamento para Auth ID) ──
    const resolvedDirectColaboradores = new Set<string>()
    const rawCleanColabIds = Array.from(
      new Set(
        colaboradoresIds
          .map(id => String(id).replace(/^(f_|_COLAB)/, '').trim())
          .filter(Boolean)
      )
    )

    if (rawCleanColabIds.length > 0 || isTodos) {
      try {
        const { data: allSysUsers, error: colabErr } = await supabase
          .from('system_users')
          .select('id, email, dados, status')
          .limit(1000)

        if (!colabErr && allSysUsers) {
          const colabEmailsToFetch: string[] = []
          
          allSysUsers.forEach((u: any) => {
            const uId = String(u.id || '').trim()
            const uAuthId = String(u.dados?.auth_id || '').trim()
            const uRespId = String(u.dados?.responsavel_id || '').trim()
            const uEmail = String(u.email || '').toLowerCase().trim()
            
            const isMatch = isTodos 
              ? (u.status !== 'inativo')
              : (rawCleanColabIds.includes(uId) || (uAuthId && rawCleanColabIds.includes(uAuthId)))

            if (isMatch) {
              if (uId) resolvedDirectColaboradores.add(uId)
              if (uAuthId) resolvedDirectColaboradores.add(uAuthId)
              if (uRespId) resolvedDirectColaboradores.add(uRespId)
              if (uEmail) colabEmailsToFetch.push(uEmail)
            }
          })

          // Para os colaboradores encontrados, se tiverem e-mail, buscar vínculos em responsaveis
          if (colabEmailsToFetch.length > 0) {
            const respRows = await fetchInChunks<any>(supabase, 'responsaveis', 'id, email', 'email', colabEmailsToFetch)
            respRows.forEach((r: any) => {
              if (r.id) resolvedDirectColaboradores.add(String(r.id))
            })
          }
        }

        // Também garantir que os IDs originais fornecidos estejam presentes
        rawCleanColabIds.forEach(id => resolvedDirectColaboradores.add(id))
      } catch (colabError) {
        console.warn('[NotifHelper] Erro ao resolver directColaboradores:', colabError)
        rawCleanColabIds.forEach(id => resolvedDirectColaboradores.add(id))
      }
    }

    return {
      students: studentsResult,
      directColaboradores: Array.from(resolvedDirectColaboradores)
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
    
    // 1. Verifica direto na tabela aluno_responsavel (pode ser authUserId ou o responsavel_id vindo do metadata)
    const { data, error } = await supabase
      .from('aluno_responsavel')
      .select('id, responsavel_id')
      .eq('aluno_id', cleanAlunoId)
      .or(`responsavel_id.eq."${cleanAuthId}",responsavel_id.eq."${authUserId}"`)
      .maybeSingle();
      
    if (!error && data) return true;

    // 2. Se for um colaborador de system_users com acesso duplo, valida vínculo pelo e-mail ou dados
    const { data: sysUser } = await supabase
      .from('system_users')
      .select('email, dados')
      .or(`id.eq."${cleanAuthId}",id.eq."${authUserId}",dados->>auth_id.eq."${cleanAuthId}",dados->>auth_id.eq."${authUserId}"`)
      .maybeSingle();

    let userEmail = sysUser?.email;
    let respIdInDados = sysUser?.dados?.responsavel_id || sysUser?.dados?.responsavelId;

    if (!userEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(authUserId).catch(() => ({ data: { user: null } }));
      if (authUser?.user) {
        userEmail = authUser.user.email;
        respIdInDados = respIdInDados || authUser.user.user_metadata?.responsavel_id;
      }
    }

    if (respIdInDados) {
      const { data: linkByDados } = await supabase
        .from('aluno_responsavel')
        .select('id')
        .eq('aluno_id', cleanAlunoId)
        .eq('responsavel_id', String(respIdInDados))
        .maybeSingle();
      if (linkByDados) return true;
    }

    if (userEmail) {
      const { data: respByEmail } = await supabase
        .from('responsaveis')
        .select('id')
        .ilike('email', userEmail);
      
      if (respByEmail && respByEmail.length > 0) {
        const respIds = respByEmail.map((r: any) => String(r.id));
        const { data: linkByEmail } = await supabase
          .from('aluno_responsavel')
          .select('id')
          .eq('aluno_id', cleanAlunoId)
          .in('responsavel_id', respIds)
          .maybeSingle();
        if (linkByEmail) return true;
      }
    }
    
    return false;
  } catch (err) {
    console.error('[NotifHelper] Erro ao verificar vínculo de responsável:', err);
    return false;
  }
}
