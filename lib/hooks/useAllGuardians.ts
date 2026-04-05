'use client'
import { useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { useSaida, Guardian } from '@/lib/saidaContext'

/**
 * Returns a merged, deduplicated list of guardians from two sources:
 * 1. Portaria guardians (registered manually in Configurações)
 * 2. ERP school guardians derived from all students' responsavel fields
 *
 * ERP guardians are read-only (no RFID, no edit), marked with source: 'erp'.
 * Portaria guardians always take precedence over ERP guardians with the same name.
 */
export interface MergedGuardian extends Guardian {
  source: 'portaria' | 'erp'
  linkedStudentName?: string  // for ERP guardians, which student they belong to
}

export function useAllGuardians(): MergedGuardian[] {
  const { alunos } = useData()
  const { guardians } = useSaida()

  return useMemo(() => {
    const result: MergedGuardian[] = []
    const seen = new Set<string>()

    // 1. Portaria guardians first (with priority)
    for (const g of guardians) {
      seen.add(g.name.toLowerCase().trim())
      result.push({ ...g, source: 'portaria' })
    }

    // 2. Derive from ERP alunos
    for (const aluno of (alunos as any[])) {
      const candidates: { name: string; role: string }[] = []

      if (aluno.responsavel?.trim())           candidates.push({ name: aluno.responsavel.trim(),           role: 'Responsável' })
      if (aluno.responsavelFinanceiro?.trim()) candidates.push({ name: aluno.responsavelFinanceiro.trim(), role: 'Resp. Financeiro' })
      if (aluno.responsavelPedagogico?.trim()) candidates.push({ name: aluno.responsavelPedagogico.trim(), role: 'Resp. Pedagógico' })

      for (const c of candidates) {
        const key = c.name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        result.push({
          id: `erp-${key.replace(/\s+/g, '-')}`,
          name: c.name,
          type: 'outro',
          active: true,
          source: 'erp',
          linkedStudentName: aluno.nome,
        })
      }
    }

    return result
  }, [alunos, guardians])
}
