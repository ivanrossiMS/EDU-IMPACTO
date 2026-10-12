import { SYSTEM_FIELDS } from './systemFields'
import { SystemFieldDef } from './types'

export function normalizeHeader(str: string): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function autoMapHeaders(headers: string[]): {
  mapping: Record<string, string>
  mappedCount: number
  unmappedHeaders: string[]
  missingRequired: SystemFieldDef[]
} {
  const mapping: Record<string, string> = {}
  const usedFields = new Set<string>()

  headers.forEach(originalHeader => {
    const normH = normalizeHeader(originalHeader)
    if (!normH) return

    let bestMatch: SystemFieldDef | null = null
    let bestScore = 0

    for (const field of SYSTEM_FIELDS) {
      if (usedFields.has(field.value)) continue

      const normLabel = normalizeHeader(field.label)
      const normValue = normalizeHeader(field.value)

      // 1. Match exato com label ou value
      if (normH === normLabel || normH === normValue) {
        bestMatch = field
        bestScore = 100
        break
      }

      // 2. Match exato com aliases
      for (const alias of field.aliases) {
        const normAlias = normalizeHeader(alias)
        if (normH === normAlias) {
          bestMatch = field
          bestScore = 95
          break
        }
      }
      if (bestScore >= 95) break

      // 3. Substring match com aliases
      for (const alias of field.aliases) {
        const normAlias = normalizeHeader(alias)
        if (normH.includes(normAlias) || normAlias.includes(normH)) {
          // Penalizar matches muito curtos
          if (normAlias.length >= 3 && bestScore < 80) {
            bestMatch = field
            bestScore = 80
          }
        }
      }
    }

    if (bestMatch && bestScore >= 80) {
      mapping[originalHeader] = bestMatch.value
      usedFields.add(bestMatch.value)
    }
  })

  const mappedCount = Object.keys(mapping).length
  const unmappedHeaders = headers.filter(h => !mapping[h])
  const mappedValues = Object.values(mapping)

  const missingRequired = SYSTEM_FIELDS.filter(
    f => f.required && !mappedValues.includes(f.value)
  )

  return {
    mapping,
    mappedCount,
    unmappedHeaders,
    missingRequired
  }
}
