/**
 * studentNameHelper.ts
 * 
 * Utilitário para formatar nomes de alunos de forma amigável e humanizada para notificações push da Agenda Digital.
 * Converte caixa alta para Title Case e preserva nomes compostos tradicionais (ex: João Pedro, Maria Clara, Enzo Gabriel).
 */

const COMPOUND_PREFIXES = new Set([
  'maria', 'joao', 'joão', 'ana', 'pedro', 'luiz', 'luís',
  'jose', 'josé', 'vitor', 'victor', 'enzo', 'davi', 'carlos'
])

const COMPOUND_SECOND_NAMES = new Set([
  'clara', 'eduarda', 'fernanda', 'julia', 'júlia', 'luisa', 'luísa',
  'luiza', 'luíza', 'alice', 'cecilia', 'cecília', 'beatriz', 'laura',
  'sophia', 'sofia', 'vitoria', 'vitória', 'helena', 'valentina',
  'pedro', 'henrique', 'miguel', 'lucas', 'gabriel', 'vitor', 'victor',
  'guilherme', 'felipe', 'otavio', 'otávio', 'arthur', 'artur', 'augusto', 'hugo'
])

export function formatFriendlyStudentName(fullName?: string | null): string {
  if (!fullName || typeof fullName !== 'string') return 'seu(sua) filho(a)'

  const parts = fullName.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'seu(sua) filho(a)'

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  if (parts.length >= 2 && COMPOUND_PREFIXES.has(parts[0]) && COMPOUND_SECOND_NAMES.has(parts[1])) {
    return `${capitalize(parts[0])} ${capitalize(parts[1])}`
  }

  return capitalize(parts[0])
}
