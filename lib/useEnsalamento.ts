/**
 * useEnsalamento — Hook centralizado para número de chamada
 *
 * Lê turmaObj.dados.ensalamento (estrutura canônica do ERP)
 * e expõe utilitários de resolução e ordenação.
 *
 * Regras de negócio:
 * - numeroChamada pertence ao vínculo aluno↔turma, não ao cadastro global
 * - Fallback A-Z quando ensalamento não definido
 * - Nunca quebra: null é o valor seguro quando não há número
 */
import { useMemo } from 'react'

export interface EnsalEntry {
  alunoId: string
  numeroChamada: number
}

export interface UseEnsalamentoResult {
  /** Array completo do ensalamento da turma */
  ensalamento: EnsalEntry[]
  /** Resolve o numeroChamada de um aluno (null se não encontrado) */
  getNumeroChamada: (alunoId: string) => number | null
  /**
   * Ordena qualquer lista de objetos com campo `id` pelo numeroChamada.
   * Alunos sem número vão ao final, ordenados A-Z pelo campo `nome` se disponível.
   */
  ordenarPorChamada: <T extends { id: string; nome?: string }>(lista: T[]) => T[]
  /** Formata o número com zero-padding (ex: "01", "12") ou "—" se null */
  formatarNumero: (alunoId: string) => string
}

export function useEnsalamento(turmaObj: any): UseEnsalamentoResult {
  const ensalamento: EnsalEntry[] = useMemo(() => {
    let dadosObj = turmaObj?.dados
    // Pense Profundo: Resolve aninhamento infinito legado (dados.dados.dados...)
    while (dadosObj && dadosObj.dados) {
      dadosObj = dadosObj.dados
    }
    
    const ensal = dadosObj?.ensalamento
    if (!Array.isArray(ensal)) return []
    return ensal.filter(
      (e: any) => e && typeof e.alunoId === 'string' && typeof e.numeroChamada === 'number'
    )
  }, [turmaObj?.dados])

  const ensalMap = useMemo(() => {
    const m = new Map<string, number>()
    ensalamento.forEach(e => m.set(e.alunoId, e.numeroChamada))
    return m
  }, [ensalamento])

  const getNumeroChamada = (alunoId: string): number | null => {
    return ensalMap.get(alunoId) ?? null
  }

  const ordenarPorChamada = <T extends { id: string; nome?: string }>(lista: T[]): T[] => {
    return [...lista].sort((a, b) => {
      const ca = ensalMap.get(a.id) ?? null
      const cb = ensalMap.get(b.id) ?? null
      // Ambos com número: ordem numérica crescente
      if (ca !== null && cb !== null) return ca - cb
      // Só A tem número: A vem primeiro
      if (ca !== null) return -1
      // Só B tem número: B vem primeiro
      if (cb !== null) return 1
      // Nenhum tem número: A-Z pelo nome
      return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')
    })
  }

  const formatarNumero = (alunoId: string): string => {
    const n = getNumeroChamada(alunoId)
    return n !== null ? String(n).padStart(2, '0') : '—'
  }

  return { ensalamento, getNumeroChamada, ordenarPorChamada, formatarNumero }
}
