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

interface TargetParams {
  /** Nomes ou IDs das turmas destinatárias */
  turmas?: string[]
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
    const alunosIds = (dados.alunosIds || dados.targetStudents || []).map(String).filter(Boolean)
    const colaboradoresIds = (dados.colaboradoresIds || []).map(String).filter(Boolean)
    const destino = String(dados.destino || '').toLowerCase().trim()

    const isTodos =
      destino === 'todos' ||
      destino === 'toda a escola' ||
      destino === 'all' ||
      turmas.some(t => {
        const tl = t.toLowerCase().trim()
        return tl === 'todos' || tl === 'toda a escola' || tl === 'all' || tl === 'todas'
      })

    // ── Modo "Todos" ──────────────────────────────────────────────────────
    if (isTodos) {
      const { data, error } = await supabase
        .from('aluno_responsavel')
        .select('responsavel_id')

      if (error) {
        console.error('[NotifHelper] Erro ao buscar todos os responsáveis:', error.message)
        return []
      }

      const ids = Array.from(new Set(
        (data || []).map(d => d.responsavel_id).filter(Boolean).map(String)
      ))
      console.log(`[NotifHelper] Modo "Todos": ${ids.length} responsáveis encontrados`)
      return ids
    }

    // ── Resolver alunos por turma ─────────────────────────────────────────
    let targetAlunosSet = new Set<string>()

    // Adicionar alunos explicitamente listados (limpar prefixos como "a_" ou "_ALU")
    alunosIds.forEach(id => {
      const cleanId = id.replace(/^(a_|_ALU)/, '')
      if (cleanId) targetAlunosSet.add(cleanId)
    })

    if (turmas.length > 0) {
      // Resolver nomes/IDs de turmas para IDs reais no banco
      const { data: allTurmas, error: turmasError } = await supabase
        .from('turmas')
        .select('id, nome, codigo')

      if (turmasError) {
        console.error('[NotifHelper] Erro ao buscar turmas:', turmasError.message)
      } else {
        const matchedTurmaIds = (allTurmas || [])
          .filter(t => {
            const tId = String(t.id).toLowerCase()
            const tNome = String(t.nome || '').toLowerCase()
            const tCod = String(t.codigo || '').toLowerCase()
            return turmas.some(turma => {
              const tl = turma.toLowerCase().trim()
              return tl === tId || tl === tNome || tl === tCod ||
                tNome.includes(tl) || tl.includes(tNome)
            })
          })
          .map(t => String(t.id))

        // Busca por ID e por nome (backward compatibility)
        const allSearchTerms = Array.from(new Set([...turmas, ...matchedTurmaIds]))

        if (allSearchTerms.length > 0) {
          const { data: alunosTurma, error: alunosError } = await supabase
            .from('alunos')
            .select('id')
            .in('turma', allSearchTerms)

          if (alunosError) {
            console.error('[NotifHelper] Erro ao buscar alunos por turma:', alunosError.message)
          } else {
            ;(alunosTurma || []).forEach(a => targetAlunosSet.add(String(a.id)))
          }
        }
      }
    }

    const finalAlunosIds = Array.from(targetAlunosSet).filter(Boolean)

    // ── Buscar responsáveis dos alunos ────────────────────────────────────
    let allResponsavelIds = new Set<string>()

    if (finalAlunosIds.length > 0) {
      const { data: vinculados, error: vincError } = await supabase
        .from('aluno_responsavel')
        .select('responsavel_id')
        .in('aluno_id', finalAlunosIds)

      if (vincError) {
        console.error('[NotifHelper] Erro ao buscar vínculos:', vincError.message)
      } else {
        ;(vinculados || []).forEach(v => {
          if (v.responsavel_id) allResponsavelIds.add(String(v.responsavel_id))
        })
      }
    }

    // ── Adicionar colaboradores diretos ───────────────────────────────────
    colaboradoresIds.forEach(id => allResponsavelIds.add(id))

    const result = Array.from(allResponsavelIds)
    console.log(`[NotifHelper] ${result.length} destinatário(s) resolvido(s) | turmas=${turmas.length} | alunos=${finalAlunosIds.length}`)
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
