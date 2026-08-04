/**
 * Utilities for resolving student class (turma) status.
 *
 * Rules for class links (historicoTurmas / vínculos):
 * - If a student has multiple class links in the same academic year (or overall),
 *   the LAST entry added to `historicoTurmas` for that year is defined as
 *   `MATRICULADO (CURSANDO)` (the student's current active class).
 * - Preceding entries in `historicoTurmas` for that year are `HISTÓRICO (ANTERIOR)`
 *   and must NOT appear in the digital agenda groups or class communications for that previous class.
 */

/**
 * Returns the student's CURSANDO (currently enrolled/active) class name or ID.
 */
export function getAlunoTurmaCursando(aluno: any, anoLetivo?: string | number): string {
  if (!aluno) return ''
  const hist = aluno.historicoTurmas || aluno.dados?.historicoTurmas
  if (Array.isArray(hist) && hist.length > 0) {
    if (anoLetivo !== undefined && anoLetivo !== null) {
      const matchingYear = hist.filter((h: any) => String(h.anoLetivo || '').trim() === String(anoLetivo).trim())
      if (matchingYear.length > 0) {
        const lastHist = matchingYear[matchingYear.length - 1]
        return String(lastHist.serieTurma || lastHist.turma || '').trim()
      }
    }
    const lastHist = hist[hist.length - 1]
    if (lastHist?.serieTurma || lastHist?.turma) {
      return String(lastHist.serieTurma || lastHist.turma).trim()
    }
  }
  return String(aluno.turma || '').trim()
}

/**
 * Checks if the given class (`turmaRef`) is the student's CURSANDO (currently enrolled/active) class.
 * Returns `false` if `turmaRef` is a `HISTÓRICO (ANTERIOR)` class link for the student.
 */
export function isAlunoCursandoTurma(aluno: any, turmaRef: any, anoLetivo?: string | number): boolean {
  if (!aluno || !turmaRef) return false

  const turmaCursando = getAlunoTurmaCursando(aluno, anoLetivo).toLowerCase()
  if (!turmaCursando) return false

  const tNome = typeof turmaRef === 'string' ? turmaRef.trim().toLowerCase() : String(turmaRef.nome || '').trim().toLowerCase()
  const tId = typeof turmaRef === 'string' ? turmaRef.trim().toLowerCase() : String(turmaRef.id || '').trim().toLowerCase()
  const tCod = typeof turmaRef === 'object' && turmaRef && turmaRef.codigo ? String(turmaRef.codigo).trim().toLowerCase() : ''

  if (turmaCursando === tNome || turmaCursando === tId || (tCod && turmaCursando === tCod)) return true

  // Comparação normalizada sem acentos e sem caracteres especiais
  const norm = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  const cursandoNorm = norm(turmaCursando)
  const tNomeNorm = norm(tNome)
  const tIdNorm = norm(tId)

  return cursandoNorm !== '' && (cursandoNorm === tNomeNorm || cursandoNorm === tIdNorm)
}
