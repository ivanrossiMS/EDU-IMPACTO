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
    if (anoLetivo !== undefined && anoLetivo !== null && String(anoLetivo).trim() !== '') {
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
 * Returns array of active vinculo objects for the student.
 */
export function getAlunoVinculosAtivos(aluno: any, anoLetivo?: string | number): any[] {
  if (!aluno) return []
  const hist = aluno.historicoTurmas || aluno.dados?.historicoTurmas
  if (Array.isArray(hist) && hist.length > 0) {
    if (anoLetivo !== undefined && anoLetivo !== null && String(anoLetivo).trim() !== '') {
      const matchingYear = hist.filter((h: any) => String(h.anoLetivo || '').trim() === String(anoLetivo).trim())
      if (matchingYear.length > 0) {
        return [matchingYear[matchingYear.length - 1]]
      }
    }
    return [hist[hist.length - 1]]
  }
  return [{
    turma: aluno.turma,
    serieTurma: aluno.turma,
    serie: aluno.serie || aluno.dados?.serie,
    anoLetivo: anoLetivo || aluno.anoLetivo || aluno.ano_letivo || aluno.dados?.anoLetivo,
    isIntegralIntermediario: aluno.isIntegralIntermediario || aluno.dados?.isIntegralIntermediario,
    modalidade: aluno.modalidade || aluno.dados?.modalidade
  }]
}

export function getSegmentoKey(str: any): string {
  if (!str) return ''
  const s = String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (s.includes('infantil') || s.includes('bercario') || s.includes('maternal') || s === 'ei') return 'infantil'
  if (s.includes('fundamental i') || s.includes('fundamental 1') || s.includes('fund 1') || s.includes('ef1') || s.includes('efi')) return 'fund1'
  if (s.includes('fundamental ii') || s.includes('fundamental 2') || s.includes('fund 2') || s.includes('ef2') || s.includes('efii')) return 'fund2'
  if (s.includes('medio') || s === 'em') return 'medio'
  return s.replace(/[^a-z0-9]/g, '')
}

export function getSerieKey(str: any): string {
  if (!str) return ''
  const s = String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const matchNum = s.match(/(\d+)/)
  const num = matchNum ? matchNum[1] : ''

  if (s.includes('nivel') || s.includes('infantil') || s.includes('maternal') || s.includes('bercario')) {
    return num ? `nivel_${num}` : s.replace(/[^a-z0-9]/g, '')
  }
  if (s.includes('serie')) {
    return num ? `serie_${num}` : s.replace(/[^a-z0-9]/g, '')
  }
  if (s.includes('ano') || num) {
    return num ? `ano_${num}` : s.replace(/[^a-z0-9]/g, '')
  }
  return s.replace(/[^a-z0-9]/g, '')
}

/**
 * Checks if the given class (`turmaRef`) is a active/cursando class for the student.
 * Supports dual-enrollment for Integral/Intermediário students.
 */
export function isAlunoCursandoTurma(aluno: any, turmaRef: any, anoLetivo?: string | number, turmasList?: any[]): boolean {
  if (!aluno || !turmaRef) return false

  const norm = (str: any) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

  // Resolve string turmaRef if turmasList provided
  let resolvedTurma = turmaRef
  if (typeof turmaRef === 'string' && Array.isArray(turmasList) && turmasList.length > 0) {
    const found = turmasList.find(t => String(t.id) === turmaRef || String(t.nome) === turmaRef || String(t.codigo) === turmaRef)
    if (found) resolvedTurma = found
  }

  const tNome = typeof resolvedTurma === 'string' ? resolvedTurma.trim() : String(resolvedTurma.nome || '').trim()
  const tId = typeof resolvedTurma === 'string' ? resolvedTurma.trim() : String(resolvedTurma.id || '').trim()
  const tCod = typeof resolvedTurma === 'object' && resolvedTurma && resolvedTurma.codigo ? String(resolvedTurma.codigo).trim() : ''
  const tTurno = typeof resolvedTurma === 'object' && resolvedTurma && resolvedTurma.turno ? String(resolvedTurma.turno).trim() : ''
  const tSerie = typeof resolvedTurma === 'object' && resolvedTurma && (resolvedTurma.serie || resolvedTurma.dados?.serie) ? String(resolvedTurma.serie || resolvedTurma.dados?.serie).trim() : ''
  const tSegmento = typeof resolvedTurma === 'object' && resolvedTurma && (resolvedTurma.segmento || resolvedTurma.dados?.segmento) ? String(resolvedTurma.segmento || resolvedTurma.dados?.segmento).trim() : ''
  const tAno = typeof resolvedTurma === 'object' && resolvedTurma ? (resolvedTurma.ano || resolvedTurma.anoLetivo || '') : (anoLetivo || '')

  // 1. Check direct property aluno.turma
  const directTurma = String(aluno.turma || '').trim()
  if (directTurma !== '') {
    const directNorm = norm(directTurma)
    if (directNorm === norm(tNome) || directNorm === norm(tId) || (tCod && directNorm === norm(tCod))) {
      return true
    }
  }

  // 2. Check direct property aluno.turma_nome
  const directTurmaNome = String(aluno.turma_nome || '').trim()
  if (directTurmaNome !== '') {
    const directNorm = norm(directTurmaNome)
    if (directNorm === norm(tNome) || directNorm === norm(tId) || (tCod && directNorm === norm(tCod))) {
      return true
    }
  }

  // 3. Check active vinculos in historicoTurmas & turmasAdicionais
  const vinculos = getAlunoVinculosAtivos(aluno, anoLetivo || tAno)

  for (const v of vinculos) {
    const vTurma = String(v.serieTurma || v.turma || '').trim()
    if (vTurma !== '') {
      const vNorm = norm(vTurma)
      if (vNorm === norm(tNome) || vNorm === norm(tId) || (tCod && vNorm === norm(tCod))) {
        return true
      }
    }

    if (Array.isArray(v.turmasAdicionais)) {
      for (const sub of v.turmasAdicionais) {
        const subTurma = String(sub.serieTurma || sub.turma || sub.nome || '').trim()
        if (subTurma !== '') {
          const subNorm = norm(subTurma)
          if (subNorm === norm(tNome) || subNorm === norm(tId) || (tCod && subNorm === norm(tCod))) {
            return true
          }
        }
      }
    }
  }

  // 4. Dual-Enrollment check for Integral/Intermediário classes!
  const tNormNome = norm(tNome)
  const tNormTurno = norm(tTurno)
  const isIntegralTurma = tNormNome.includes('integral') || tNormNome.includes('intermediario') ||
                          tNormTurno.includes('integral') || tNormTurno.includes('intermediario') ||
                          (typeof resolvedTurma === 'object' && Boolean(resolvedTurma.isIntegralIntermediario || resolvedTurma.dados?.isIntegralIntermediario))

  if (isIntegralTurma) {
    const hasExplicitIntegral = Boolean(
      aluno.isIntegralIntermediario === true ||
      aluno.dados?.isIntegralIntermediario === true ||
      aluno.modalidade === 'INTEGRAL/INTERMEDIÁRIO' ||
      aluno.dados?.modalidade === 'INTEGRAL/INTERMEDIÁRIO' ||
      aluno.integral_tipo || aluno.dados?.integral_tipo ||
      String(aluno.turno || aluno.turno_nome || aluno.dados?.turno || '').toLowerCase().includes('integral') ||
      String(aluno.turno || aluno.turno_nome || aluno.dados?.turno || '').toLowerCase().includes('intermediario')
    ) || vinculos.some(v => 
      v.isIntegralIntermediario === true || 
      v.modalidade === 'INTEGRAL/INTERMEDIÁRIO' ||
      v.modalidade === 'Integral/Intermediário' ||
      v.integral_tipo ||
      String(v.turno || '').toLowerCase().includes('integral') ||
      String(v.turno || '').toLowerCase().includes('intermediario')
    )

    if (hasExplicitIntegral) {
      const targetSerieKey = getSerieKey(tSerie) || getSerieKey(tNome)

      if (targetSerieKey) {
        // Resolve student's main class from turmasList if available
        const mainTurmaObj = Array.isArray(turmasList) && turmasList.length > 0
          ? turmasList.find(t => 
              String(t.id) === directTurma || 
              String(t.codigo) === directTurma || 
              String(t.nome) === directTurma ||
              (aluno.turma_nome && String(t.nome).toLowerCase() === String(aluno.turma_nome).toLowerCase())
            )
          : null

        const targetSegKey = getSegmentoKey(tSegmento)

        for (const v of vinculos) {
          const vSegmento = v.segmento || aluno.segmento || aluno.dados?.segmento || mainTurmaObj?.dados?.segmento || mainTurmaObj?.segmento || ''
          const vSegKey = getSegmentoKey(vSegmento)

          if (targetSegKey && vSegKey && targetSegKey !== vSegKey) {
            continue
          }

          const vinculoSerieKey = getSerieKey(v.serie) ||
                                  getSerieKey(v.serieTurma) ||
                                  getSerieKey(v.turma) ||
                                  getSerieKey(aluno.serie) ||
                                  getSerieKey(aluno.turma_nome) ||
                                  getSerieKey(aluno.turma) ||
                                  getSerieKey(mainTurmaObj?.serie) ||
                                  getSerieKey(mainTurmaObj?.nome) ||
                                  getSerieKey(aluno.dados?.serie)

          if (vinculoSerieKey && vinculoSerieKey === targetSerieKey) {
            return true
          }
        }
      } else {
        return true
      }
    }
  }

  return false
}

/**
 * Returns array of ALL turmas (IDs and names) that the student currently attends (cursando).
 */
export function getAlunoTurmasCursando(aluno: any, turmas: any[] = [], anoLetivo?: string | number): string[] {
  if (!aluno) return []
  const result = new Set<string>()

  const cursando = getAlunoTurmaCursando(aluno, anoLetivo)
  if (cursando) result.add(cursando)
  if (aluno.turma) result.add(String(aluno.turma))

  if (Array.isArray(turmas) && turmas.length > 0) {
    for (const t of turmas) {
      if (isAlunoCursandoTurma(aluno, t, anoLetivo || t.ano)) {
        if (t.id) result.add(String(t.id))
        if (t.nome) result.add(String(t.nome))
      }
    }
  }

  return Array.from(result)
}

/**
 * Returns array of ALL turmas and groups (IDs and names) that the student belongs to in the academic year.
 */
export function getAlunoTodasTurmasEGrupos(aluno: any, turmas: any[] = [], grupos: any[] = [], anoLetivo?: string | number): string[] {
  if (!aluno) return []
  const result = new Set<string>()

  // 1. Direct properties
  if (aluno.turma) result.add(String(aluno.turma).trim())
  if (aluno.turma_nome) result.add(String(aluno.turma_nome).trim())
  if (aluno.turmaNome) result.add(String(aluno.turmaNome).trim())
  if (aluno.dados?.turma) result.add(String(aluno.dados.turma).trim())
  if (aluno.dados?.turma_nome) result.add(String(aluno.dados.turma_nome).trim())

  // 2. Matching turmas in ERP (isAlunoCursandoTurma)
  if (Array.isArray(turmas) && turmas.length > 0) {
    for (const t of turmas) {
      if (!t) continue
      if (isAlunoCursandoTurma(aluno, t, anoLetivo || t.ano, turmas)) {
        if (t.id != null) result.add(String(t.id).trim())
        if (t.nome) result.add(String(t.nome).trim())
        if (t.codigo) result.add(String(t.codigo).trim())
      }
    }
  }

  // 3. Matching groups in agenda/grupos (alunosIds or synced group of cursando turma)
  if (Array.isArray(grupos) && grupos.length > 0) {
    const cleanStudentId = String(aluno.id || '').replace(/^(a_|_ALU)/, '')
    for (const g of grupos) {
      if (!g) continue
      let aIds = g.alunosIds || g.dados?.alunosIds || []
      if (typeof aIds === 'string') {
        try { aIds = JSON.parse(aIds) } catch { aIds = [] }
      }
      const isMember = (Array.isArray(aIds) ? aIds : []).some(
        (id: any) => String(id).replace(/^(a_|_ALU)/, '') === cleanStudentId
      )
      
      const gNome = g.nome || g.dados?.nome
      const syncId = g.syncId || g.dados?.syncId || (String(g.id).startsWith('sync-') ? g.id : '')
      const turmaId = syncId ? syncId.replace(/^sync-/, '') : null
      const gTurmaRef = turmaId
        ? (turmas || []).find((t: any) => t && (String(t.id) === turmaId || t.nome === gNome))
        : (turmas || []).find((t: any) => t && t.nome === gNome)

      const isCursandoGrupo = gTurmaRef ? isAlunoCursandoTurma(aluno, gTurmaRef, gTurmaRef.ano || anoLetivo, turmas) : false

      if (isMember || isCursandoGrupo) {
        if (g.id != null) result.add(String(g.id).trim())
        if (gNome) result.add(String(gNome).trim())
      }
    }
  }

  // 4. historicoTurmas & turmasAdicionais
  const hist = aluno.historicoTurmas || aluno.dados?.historicoTurmas
  if (Array.isArray(hist)) {
    hist.forEach((ht: any) => {
      if (!ht || ht.status === 'Inativo') return
      if (ht.serieTurma) result.add(String(ht.serieTurma).trim())
      if (ht.turma) result.add(String(ht.turma).trim())
      if (Array.isArray(ht.turmasAdicionais)) {
        ht.turmasAdicionais.forEach((sub: any) => {
          if (!sub || sub.status === 'Inativo') return
          if (sub.serieTurma) result.add(String(sub.serieTurma).trim())
          if (sub.turma) result.add(String(sub.turma).trim())
          if (sub.nome) result.add(String(sub.nome).trim())
        })
      }
    })
  }

  // 5. Direct turmasAdicionais on aluno
  const directAdic = aluno.turmasAdicionais || aluno.dados?.turmasAdicionais
  if (Array.isArray(directAdic)) {
    directAdic.forEach((sub: any) => {
      if (!sub) return
      if (typeof sub === 'string') result.add(sub.trim())
      else {
        if (sub.serieTurma) result.add(String(sub.serieTurma).trim())
        if (sub.turma) result.add(String(sub.turma).trim())
        if (sub.nome) result.add(String(sub.nome).trim())
      }
    })
  }

  return Array.from(result).filter(Boolean)
}

/**
 * Normalizes turma/group text for precise, accent-insensitive and formatting-insensitive comparison
 * WITHOUT stripping shift/turno information.
 */
export function normalizeTurmaText(str: any): string {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Returns set of active shifts (turnos) for the student based on all active enrollments and groups.
 * ('matutino', 'vespertino', 'noturno', 'integral', 'intermediario')
 */
export function getAlunoTurnosAtivos(aluno: any, turmas: any[] = [], grupos: any[] = [], anoLetivo?: string | number): Set<string> {
  const turnos = new Set<string>()
  if (!aluno) return turnos

  const checkAndAdd = (val: any) => {
    if (!val) return
    const s = String(val).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (s.includes('matutino') || s.includes('manha')) turnos.add('matutino')
    if (s.includes('vespertino') || s.includes('tarde')) turnos.add('vespertino')
    if (s.includes('noturno') || s.includes('noite')) turnos.add('noturno')
    if (s.includes('integral')) turnos.add('integral')
    if (s.includes('intermediario')) turnos.add('intermediario')
  }

  // 1. Direct properties on student
  checkAndAdd(aluno.turno)
  checkAndAdd(aluno.turno_nome)
  checkAndAdd(aluno.dados?.turno)
  checkAndAdd(aluno.dados?.turno_nome)
  checkAndAdd(aluno.modalidade)
  checkAndAdd(aluno.dados?.modalidade)
  checkAndAdd(aluno.turma_nome)
  checkAndAdd(aluno.dados?.turma_nome)

  // 2. If student is integral/intermediario
  if (isAlunoIntegralIntermediario(aluno, turmas, grupos, anoLetivo)) {
    turnos.add('integral')
    turnos.add('intermediario')
  }

  // 3. From cursando turmas in ERP
  if (Array.isArray(turmas) && turmas.length > 0) {
    for (const t of turmas) {
      if (t && isAlunoCursandoTurma(aluno, t, anoLetivo || t.ano, turmas)) {
        checkAndAdd(t.turno)
        checkAndAdd(t.dados?.turno)
        checkAndAdd(t.modalidade)
        checkAndAdd(t.dados?.modalidade)
        checkAndAdd(t.nome)
        checkAndAdd(t.dados?.nome)
      }
    }
  }

  // 4. From historicoTurmas & turmasAdicionais
  const hist = aluno.historicoTurmas || aluno.dados?.historicoTurmas
  if (Array.isArray(hist)) {
    hist.forEach((ht: any) => {
      if (!ht || ht.status === 'Inativo') return
      checkAndAdd(ht.turno)
      checkAndAdd(ht.modalidade)
      checkAndAdd(ht.serieTurma)
      checkAndAdd(ht.turma)
      if (Array.isArray(ht.turmasAdicionais)) {
        ht.turmasAdicionais.forEach((sub: any) => {
          if (!sub || sub.status === 'Inativo') return
          checkAndAdd(sub.turno)
          checkAndAdd(sub.modalidade)
          checkAndAdd(sub.serieTurma)
          checkAndAdd(sub.turma)
          checkAndAdd(sub.nome)
        })
      }
    })
  }

  // 5. From agenda_grupos
  if (Array.isArray(grupos) && grupos.length > 0) {
    const cleanStudentId = String(aluno.id || '').replace(/^(a_|_ALU)/, '')
    for (const g of grupos) {
      if (!g) continue
      let aIds = g.alunosIds || g.dados?.alunosIds || []
      if (typeof aIds === 'string') {
        try { aIds = JSON.parse(aIds) } catch { aIds = [] }
      }
      const isMember = (Array.isArray(aIds) ? aIds : []).some(
        (id: any) => String(id).replace(/^(a_|_ALU)/, '') === cleanStudentId
      )
      if (isMember) {
        checkAndAdd(g.nome)
        checkAndAdd(g.dados?.nome)
      }
    }
  }

  return turnos
}

/**
 * Checks if an event target or candidate class/group matches the student's active classes/groups.
 * Enforces strict shift (turno) compatibility so that opposite shifts (e.g. Vespertino vs Matutino)
 * are NEVER conflated or matched.
 */
export function isTurmaOrGroupMatch(
  target: any,
  aluno: any,
  turmas: any[] = [],
  grupos: any[] = [],
  anoLetivo?: string | number
): boolean {
  if (!aluno || !target) return false

  const rawTarget = String(target).trim()
  const targetNorm = normalizeTurmaText(rawTarget)
  if (!targetNorm) return false

  // 1. Universal targets
  if (
    targetNorm === 'todos' ||
    targetNorm === 'toda a escola' ||
    targetNorm === 'todas' ||
    targetNorm === 'todos todos'
  ) {
    return true
  }

  // 2. Academic year targets: TODOS:2026
  if (rawTarget.toLowerCase().startsWith('todos:')) {
    const targetAno = rawTarget.split(':')[1]?.trim()
    if (targetAno) {
      const studentAno = String(anoLetivo || aluno.anoLetivo || aluno.ano_letivo || aluno.dados?.anoLetivo || '').trim()
      if (studentAno && studentAno === targetAno) return true
      const studentTurmasList = Array.isArray(turmas)
        ? turmas.filter(t => t && isAlunoCursandoTurma(aluno, t, t.ano || anoLetivo, turmas))
        : []
      if (studentTurmasList.some(t => String(t.ano || t.ano_letivo || t.anoLetivo || '').trim() === targetAno)) {
        return true
      }
    }
    return false
  }

  // 3. Shift conflict check!
  const studentTurnos = getAlunoTurnosAtivos(aluno, turmas, grupos, anoLetivo)

  const isTargetVespertino = targetNorm.includes('vespertino') || targetNorm.includes('tarde')
  const isTargetMatutino = targetNorm.includes('matutino') || targetNorm.includes('manha')
  const isTargetNoturno = targetNorm.includes('noturno') || targetNorm.includes('noite')

  // If candidate specifies vespertino and student is NOT vespertino -> STRICT REJECTION
  if (isTargetVespertino && !studentTurnos.has('vespertino')) {
    return false
  }
  // If candidate specifies matutino and student is NOT matutino -> STRICT REJECTION
  if (isTargetMatutino && !studentTurnos.has('matutino')) {
    return false
  }
  // If candidate specifies noturno and student is NOT noturno -> STRICT REJECTION
  if (isTargetNoturno && !studentTurnos.has('noturno')) {
    return false
  }

  // 4. Exact ID or Code match or Normalized Name match
  const studentTurmasEGrupos = getAlunoTodasTurmasEGrupos(aluno, turmas, grupos, anoLetivo)
  for (const item of studentTurmasEGrupos) {
    if (rawTarget === item || rawTarget.toLowerCase() === item.toLowerCase()) {
      return true
    }
    const itemNorm = normalizeTurmaText(item)
    if (targetNorm === itemNorm) {
      return true
    }
  }

  // 5. Matching via turmas list if target is ID, code, or name of a turma
  if (Array.isArray(turmas) && turmas.length > 0) {
    const matchedTurma = turmas.find(t => 
      t && (
        String(t.id) === rawTarget || 
        String(t.codigo) === rawTarget || 
        normalizeTurmaText(t.nome) === targetNorm
      )
    )
    if (matchedTurma) {
      const tTurnoNorm = normalizeTurmaText(matchedTurma.turno || matchedTurma.dados?.turno)
      if (tTurnoNorm.includes('vespertino') && !studentTurnos.has('vespertino')) return false
      if (tTurnoNorm.includes('matutino') && !studentTurnos.has('matutino')) return false
      if (tTurnoNorm.includes('noturno') && !studentTurnos.has('noturno')) return false

      if (isAlunoCursandoTurma(aluno, matchedTurma, matchedTurma.ano || anoLetivo, turmas)) {
        return true
      }
    }
  }

  // 6. Matching via agenda_grupos if target is ID or name of a group
  if (Array.isArray(grupos) && grupos.length > 0) {
    const cleanStudentId = String(aluno.id || '').replace(/^(a_|_ALU)/, '')
    const matchedGroup = grupos.find(g => 
      g && (
        String(g.id) === rawTarget || 
        normalizeTurmaText(g.nome || g.dados?.nome) === targetNorm
      )
    )
    if (matchedGroup) {
      let aIds = matchedGroup.alunosIds || matchedGroup.dados?.alunosIds || []
      if (typeof aIds === 'string') {
        try { aIds = JSON.parse(aIds) } catch { aIds = [] }
      }
      const isMember = (Array.isArray(aIds) ? aIds : []).some(
        (id: any) => String(id).replace(/^(a_|_ALU)/, '') === cleanStudentId
      )
      if (isMember) return true

      const syncId = matchedGroup.syncId || matchedGroup.dados?.syncId || (String(matchedGroup.id).startsWith('sync-') ? matchedGroup.id : '')
      const turmaId = syncId ? syncId.replace(/^sync-/, '') : null
      const gTurmaRef = turmaId
        ? turmas.find(t => t && (String(t.id) === turmaId || t.nome === matchedGroup.nome))
        : turmas.find(t => t && t.nome === matchedGroup.nome)
      if (gTurmaRef && isAlunoCursandoTurma(aluno, gTurmaRef, gTurmaRef.ano || anoLetivo, turmas)) {
        return true
      }
    }
  }

  return false
}

/**
 * Returns array of clean, human-readable class and group names for UI display.
 * Filters out raw UUIDs, numeric IDs, and synthetic 'sync-' prefixes.
 */
export function getAlunoNomesTurmasEGrupos(aluno: any, turmas: any[] = [], grupos: any[] = [], anoLetivo?: string | number): string[] {
  if (!aluno) return []
  const namesSet = new Set<string>()

  // 1. Turmas no ERP que o aluno cursa ou possui ID/código vinculado
  if (Array.isArray(turmas) && turmas.length > 0) {
    const rawTurma = String(aluno.turma || aluno.dados?.turma || '').trim()
    turmas.forEach((t: any) => {
      if (!t) return
      if (isAlunoCursandoTurma(aluno, t, anoLetivo || t.ano, turmas)) {
        if (t.nome) namesSet.add(String(t.nome).trim())
      }
      if (rawTurma && (String(t.id).trim() === rawTurma || String(t.codigo || '').trim() === rawTurma || String(t.dados?.codigo || '').trim() === rawTurma)) {
        if (t.nome) namesSet.add(String(t.nome).trim())
      }
    })
  }

  // 2. Grupos em agenda/grupos onde o aluno é membro direto
  if (Array.isArray(grupos) && grupos.length > 0) {
    const cleanStudentId = String(aluno.id || '').replace(/^(a_|_ALU)/, '')
    grupos.forEach((g: any) => {
      let aIds = g.alunosIds || g.dados?.alunosIds || []
      if (typeof aIds === 'string') {
        try { aIds = JSON.parse(aIds) } catch { aIds = [] }
      }
      const isMember = (Array.isArray(aIds) ? aIds : []).some(
        (id: any) => String(id).replace(/^(a_|_ALU)/, '') === cleanStudentId
      )
      const gNome = g.nome || g.dados?.nome
      if (isMember && gNome) {
        namesSet.add(String(gNome).trim())
      }
    })
  }

  // 3. Propriedade direta aluno.turma_nome se for um texto legível
  if (aluno.turma_nome && isNaN(Number(aluno.turma_nome)) && !/^[0-9a-fA-F-]{10,}$/.test(aluno.turma_nome)) {
    namesSet.add(String(aluno.turma_nome).trim())
  }
  if (aluno.dados?.turma_nome && isNaN(Number(aluno.dados.turma_nome)) && !/^[0-9a-fA-F-]{10,}$/.test(aluno.dados.turma_nome)) {
    namesSet.add(String(aluno.dados.turma_nome).trim())
  }

  // 4. historicoTurmas & turmas adicionais (ex: Integral)
  const hist = aluno.historicoTurmas || aluno.dados?.historicoTurmas
  if (Array.isArray(hist)) {
    hist.forEach((ht: any) => {
      if (!ht || ht.status === 'Inativo') return
      const htName = ht.serieTurma || ht.turma || ht.nome
      if (htName && isNaN(Number(htName)) && !/^[0-9a-fA-F-]{10,}$/.test(htName)) {
        namesSet.add(String(htName).trim())
      }
      if (Array.isArray(ht.turmasAdicionais)) {
        ht.turmasAdicionais.forEach((sub: any) => {
          if (!sub || sub.status === 'Inativo') return
          const subName = sub.nome || sub.serieTurma || sub.turma
          if (subName && isNaN(Number(subName)) && !/^[0-9a-fA-F-]{10,}$/.test(subName)) {
            namesSet.add(String(subName).trim())
          }
        })
      }
    })
  }

  // 5. Turmas adicionais diretas
  const directAdic = aluno.turmasAdicionais || aluno.dados?.turmasAdicionais
  if (Array.isArray(directAdic)) {
    directAdic.forEach((sub: any) => {
      if (!sub) return
      const subName = typeof sub === 'string' ? sub : (sub.nome || sub.serieTurma || sub.turma)
      if (subName && isNaN(Number(subName)) && !/^[0-9a-fA-F-]{10,}$/.test(subName)) {
        namesSet.add(String(subName).trim())
      }
    })
  }

  // Filtrar e limpar nomes inválidos / IDs técnicos
  const rawList = Array.from(namesSet).filter(n => {
    if (!n) return false
    const s = n.toLowerCase().trim()
    if (s.startsWith('sync-') || s === 'sync') return false
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(n)) return false
    if (/^\d+$/.test(n)) return false
    if (s === String(aluno.id || '').toLowerCase()) return false
    return true
  })

  // Deduplicar nomes equivalentes mantendo o formato mais informativo
  const uniqueList: string[] = []
  const seenNorms = new Set<string>()
  for (const name of rawList) {
    const norm = normalizeTurmaText(name)
    if (!seenNorms.has(norm)) {
      seenNorms.add(norm)
      uniqueList.push(name)
    }
  }

  return uniqueList
}

/**
 * Checks whether a student is enrolled in any Integral or Intermediário class, group, or modalidade.
 */
export function isAlunoIntegralIntermediario(aluno: any, turmas: any[] = [], grupos: any[] = [], anoLetivo?: string | number): boolean {
  if (!aluno) return false;

  // 1. Explicit true flag on student
  if (aluno.isIntegralIntermediario === true || aluno.dados?.isIntegralIntermediario === true) return true;

  const directTurno = String(aluno.turno || aluno.turno_nome || aluno.dados?.turno || '').toLowerCase();
  if (directTurno.includes('integral') || directTurno.includes('intermediario') || directTurno.includes('intermediário')) return true;

  const directModalidade = String(aluno.modalidade || aluno.dados?.modalidade || '').toLowerCase();
  if (directModalidade.includes('integral/intermediário')) return true;

  // 2. Active turmas for student
  if (Array.isArray(turmas) && turmas.length > 0) {
    for (const t of turmas) {
      if (isAlunoCursandoTurma(aluno, t, anoLetivo || t.ano)) {
        const tNome = String(t.nome || t.dados?.nome || '').toLowerCase();
        const tTurno = String(t.turno || t.dados?.turno || '').toLowerCase();
        const tMod = String(t.modalidade || t.dados?.modalidade || '').toLowerCase();
        if (
          tTurno.includes('integral') || tTurno.includes('intermediario') || tTurno.includes('intermediário') ||
          tMod.includes('integral/intermediário') ||
          ((tNome.includes('integral') || tNome.includes('intermediario')) && !tNome.includes('matutino') && !tNome.includes('vespertino'))
        ) {
          return true;
        }
      }
    }
  }

  // 3. Matching active groups in agenda/grupos
  if (Array.isArray(grupos) && grupos.length > 0) {
    const cleanStudentId = String(aluno.id || '').replace(/^(a_|_ALU)/, '');
    for (const g of grupos) {
      let aIds = g.alunosIds || g.dados?.alunosIds || [];
      if (typeof aIds === 'string') {
        try { aIds = JSON.parse(aIds) } catch { aIds = [] }
      }
      const isMember = (Array.isArray(aIds) ? aIds : []).some(
        (id: any) => String(id).replace(/^(a_|_ALU)/, '') === cleanStudentId
      );
      const gNome = String(g.nome || g.dados?.nome || '').toLowerCase();
      if (isMember && (gNome.includes('integral') || gNome.includes('intermediario') || gNome.includes('intermediário'))) {
        return true;
      }
    }
  }

  // 4. historicoTurmas & turmasAdicionais (Apenas vínculos ativos/específicos)
  const hist = aluno.historicoTurmas || aluno.dados?.historicoTurmas;
  if (Array.isArray(hist) && hist.length > 0) {
    for (const ht of hist) {
      if (ht.status === 'Inativo') continue;
      if (ht.isIntegralIntermediario === true || ht.modalidade === 'INTEGRAL/INTERMEDIÁRIO') return true;
      if (Array.isArray(ht.turmasAdicionais)) {
        for (const sub of ht.turmasAdicionais) {
          if (sub.isIntegralIntermediario === true || sub.modalidade === 'INTEGRAL/INTERMEDIÁRIO') return true;
          const subSt = String(sub.serieTurma || sub.turma || '').toLowerCase();
          if ((subSt.includes('integral') || subSt.includes('intermediario')) && !subSt.includes('matutino') && !subSt.includes('vespertino')) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Returns the Turno display string for the student card.
 * If the student belongs to any Integral or Intermediário class/group, returns 'Integral/Intermediário'.
 */
export function getAlunoTurnoDisplay(aluno: any, turmas: any[] = [], grupos: any[] = [], anoLetivo?: string | number): string {
  if (!aluno) return 'Vespertino';
  if (isAlunoIntegralIntermediario(aluno, turmas, grupos, anoLetivo)) {
    return 'Integral/Intermediário';
  }
  if (aluno.turno_nome) return aluno.turno_nome;
  if (aluno.turno && aluno.turno.trim() !== '') return aluno.turno;
  const turmaObj = (turmas || []).find((t: any) => t && (String(t.id) === String(aluno.turma) || String(t.codigo) === String(aluno.turma) || String(t.nome) === String(aluno.turma)));
  return turmaObj?.turno || 'Vespertino';
}

/**
 * Auxiliary conversion from Roman numerals to Arabic number (I-VI).
 */
export function romanToNumber(r: string): number | null {
  if (!r) return null
  const map: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }
  return map[r.toUpperCase()] ?? null
}

export function parseNumberOrRoman(str: string): number {
  if (!str) return 1
  const trimmed = str.trim().toUpperCase()
  const num = parseInt(trimmed, 10)
  if (!isNaN(num)) return num
  return romanToNumber(trimmed) || 1
}

export function getTurmaString(t: any): string {
  if (!t) return ''
  if (typeof t === 'string') return t
  return `${t.nome || t.title || t.turma || t.label || ''} ${t.serie || t.dados?.serie || ''} ${t.categoria || ''}`
}

export function getTurnoWeight(str: string): number {
  const s = (str || '').toUpperCase()
  if (s.includes('MATUTINO') || s.includes('MANHÃ') || s.includes('MANHA')) return 1
  if (s.includes('VESPERTINO') || s.includes('TARDE')) return 2
  if (s.includes('NOTURNO') || s.includes('NOITE')) return 3
  if (s.includes('INTEGRAL') || s.includes('INTERMEDIÁRIO') || s.includes('INTERMEDIARIO')) return 4
  return 5
}

/**
 * Calculates a numerical pedagogical weight for a class/turma/grupo so they can be
 * sorted strictly in school grade order (Infantil -> Fund 1 -> Fund 2 -> Médio -> Equipe/Outros).
 */
export function getTurmaSerieWeight(t: any): number {
  if (!t) return 900
  if (t?.isEquipeEscolar) return 990
  const raw = getTurmaString(t)
  const str = raw.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  if (str.includes('EQUIPE ESCOLAR')) return 990

  // 1. Berçário
  if (str.includes('BERCARIO')) {
    const m = str.match(/BERCARIO\s*([IVX\d]+)?/)
    const num = m && m[1] ? parseNumberOrRoman(m[1]) : 1
    return 10 + num
  }

  // 2. Maternal
  if (str.includes('MATERNAL')) {
    const m = str.match(/MATERNAL\s*([IVX\d]+)?/)
    const num = m && m[1] ? parseNumberOrRoman(m[1]) : 1
    return 20 + num
  }

  // 3. Jardim
  if (str.includes('JARDIM')) {
    const m = str.match(/JARDIM\s*([IVX\d]+)?/)
    const num = m && m[1] ? parseNumberOrRoman(m[1]) : 1
    return 30 + num
  }

  // 4. Pré-Escola
  if (str.includes('PRE') || str.includes('PRE-ESCOLA') || str.includes('PRE ESCOLA')) {
    const m = str.match(/PRE(?:-|\s)*ESCOLA\s*([IVX\d]+)?/) || str.match(/PRE\s*([IVX\d]+)?/)
    const num = m && m[1] ? parseNumberOrRoman(m[1]) : 1
    return 40 + num
  }

  // 5. Níveis da Educação Infantil (ex: NÍVEL 1, NÍVEL 2, NÍVEL 4, NÍVEL 5)
  const nivelMatch = str.match(/NIVEL\s*(\d+)/)
  if (nivelMatch) {
    return 50 + parseInt(nivelMatch[1], 10)
  }

  // 6. Ensino Médio (prioridade antes de fundamental para casos como '1º ANO MÉDIO' ou '1ª SÉRIE')
  const isMedio = str.includes('MEDIO') || str.includes('E.M') || /\bEM\b/.test(str) || str.includes('SERIE')
  if (isMedio) {
    const serieMatch = str.match(/(\d+)[ªºa-z]?\s*(?:SERIE|ANO|MEDIO)/) || str.match(/(?:SERIE|ANO|MEDIO)\s*(\d+)/)
    if (serieMatch) {
      return 200 + parseInt(serieMatch[1], 10)
    }
    if (str.includes('TERCEIRAO')) return 203
    if (str.includes('PRE-VESTIBULAR') || str.includes('PRE VESTIBULAR') || /\bPV\b/.test(str)) return 204
    if (str.includes('EXTENSIVO')) return 205
    return 200
  }

  // 7. Anos do Ensino Fundamental (ex: 1º ANO, 2º ANO, ..., 9º ANO)
  const anoMatch = str.match(/(\d+)[ºªa-z]?\s*ANO/)
  if (anoMatch) {
    return 100 + parseInt(anoMatch[1], 10)
  }

  // 8. Fallback por número no início do nome
  const anyNumMatch = str.match(/^(\d+)/)
  if (anyNumMatch) {
    return 300 + parseInt(anyNumMatch[1], 10)
  }

  return 900
}

/**
 * Comparator function to sort classes/groups strictly in school grade order.
 * Order: Infantil (Berçário -> Maternal -> Jardim -> Pré -> Níveis 1..5)
 *      -> Fundamental I (1º Ano .. 5º Ano)
 *      -> Fundamental II (6º Ano .. 9º Ano)
 *      -> Ensino Médio (1ª Série .. 3ª Série / Terceirão)
 * Tie-breaker 1: Turma letter (e.g. 8º Ano A before 8º Ano B)
 * Tie-breaker 2: Shift (Matutino -> Vespertino -> Noturno -> Integral)
 * Tie-breaker 3: Alphabetical localeCompare
 */
export function compareTurmasBySerie(a: any, b: any): number {
  const wA = getTurmaSerieWeight(a)
  const wB = getTurmaSerieWeight(b)
  if (wA !== wB) return wA - wB

  // Desempate por letra da turma (ex: 8º ANO A vs 8º ANO B)
  const strA = getTurmaString(a).toUpperCase()
  const strB = getTurmaString(b).toUpperCase()

  const letterMatchA = strA.match(/(?:ANO|S[ÉE]RIE|N[ÍI]VEL\s*\d+)\s+([A-Z])\b/)
  const letterMatchB = strB.match(/(?:ANO|S[ÉE]RIE|N[ÍI]VEL\s*\d+)\s+([A-Z])\b/)
  const letterA = letterMatchA ? letterMatchA[1] : ''
  const letterB = letterMatchB ? letterMatchB[1] : ''
  if (letterA && letterB && letterA !== letterB) {
    return letterA.localeCompare(letterB)
  }

  // Desempate por Turno (Matutino -> Vespertino -> Noturno -> Integral)
  const tA = getTurnoWeight(strA)
  const tB = getTurnoWeight(strB)
  if (tA !== tB) return tA - tB

  const nomeA = a?.nome || a?.title || a?.turma || strA
  const nomeB = b?.nome || b?.title || b?.turma || strB
  return String(nomeA).localeCompare(String(nomeB), 'pt-BR', { numeric: true, sensitivity: 'base' })
}
