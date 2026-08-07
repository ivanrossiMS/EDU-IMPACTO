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

  // 2. Matching turmas in ERP (isAlunoCursandoTurma)
  if (Array.isArray(turmas) && turmas.length > 0) {
    for (const t of turmas) {
      if (isAlunoCursandoTurma(aluno, t, anoLetivo || t.ano)) {
        if (t.id) result.add(String(t.id).trim())
        if (t.nome) result.add(String(t.nome).trim())
        if (t.codigo) result.add(String(t.codigo).trim())
      }
    }
  }

  // 3. Matching groups in agenda/grupos (alunosIds or synced group of cursando turma)
  if (Array.isArray(grupos) && grupos.length > 0) {
    const cleanStudentId = String(aluno.id || '').replace(/^(a_|_ALU)/, '')
    for (const g of grupos) {
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
        ? (turmas || []).find((t: any) => String(t.id) === turmaId || t.nome === gNome)
        : (turmas || []).find((t: any) => t.nome === gNome)

      const isCursandoGrupo = gTurmaRef ? isAlunoCursandoTurma(aluno, gTurmaRef, gTurmaRef.ano || anoLetivo) : false

      if (isMember || isCursandoGrupo) {
        if (g.id) result.add(String(g.id).trim())
        if (gNome) result.add(String(gNome).trim())
      }
    }
  }

  // 4. historicoTurmas & turmasAdicionais
  const hist = aluno.historicoTurmas || aluno.dados?.historicoTurmas
  if (Array.isArray(hist)) {
    hist.forEach((ht: any) => {
      if (ht.serieTurma) result.add(String(ht.serieTurma).trim())
      if (ht.turma) result.add(String(ht.turma).trim())
      if (Array.isArray(ht.turmasAdicionais)) {
        ht.turmasAdicionais.forEach((sub: any) => {
          if (sub.serieTurma) result.add(String(sub.serieTurma).trim())
          if (sub.turma) result.add(String(sub.turma).trim())
        })
      }
    })
  }

  return Array.from(result).filter(Boolean)
}

/**
 * Returns array of clean, human-readable class and group names for UI display.
 * Filters out raw UUIDs, numeric IDs, and synthetic 'sync-' prefixes.
 */
export function getAlunoNomesTurmasEGrupos(aluno: any, turmas: any[] = [], grupos: any[] = [], anoLetivo?: string | number): string[] {
  if (!aluno) return []
  const namesSet = new Set<string>()

  // 1. Turmas no ERP que o aluno cursa
  if (Array.isArray(turmas) && turmas.length > 0) {
    turmas.forEach((t: any) => {
      if (isAlunoCursandoTurma(aluno, t, anoLetivo || t.ano)) {
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
  if (aluno.turma_nome && isNaN(Number(aluno.turma_nome))) {
    namesSet.add(String(aluno.turma_nome).trim())
  }

  // Filtrar e limpar nomes inválidos / IDs técnicos
  const cleanList = Array.from(namesSet).filter(n => {
    if (!n) return false
    const s = n.toLowerCase().trim()
    if (s.startsWith('sync-') || s === 'sync') return false
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(n)) return false
    if (/^\d+$/.test(n)) return false
    if (s === String(aluno.id || '').toLowerCase()) return false
    return true
  })

  return cleanList
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



