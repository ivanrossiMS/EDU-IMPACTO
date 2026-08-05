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

/**
 * Checks if the given class (`turmaRef`) is a active/cursando class for the student.
 * Supports dual-enrollment for Integral/Intermediário students.
 */
export function isAlunoCursandoTurma(aluno: any, turmaRef: any, anoLetivo?: string | number): boolean {
  if (!aluno || !turmaRef) return false

  const norm = (str: any) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').toLowerCase()

  const tNome = typeof turmaRef === 'string' ? turmaRef.trim() : String(turmaRef.nome || '').trim()
  const tId = typeof turmaRef === 'string' ? turmaRef.trim() : String(turmaRef.id || '').trim()
  const tCod = typeof turmaRef === 'object' && turmaRef && turmaRef.codigo ? String(turmaRef.codigo).trim() : ''
  const tSerie = typeof turmaRef === 'object' && turmaRef ? (turmaRef.serie || turmaRef.dados?.serie || '') : ''
  const tAno = typeof turmaRef === 'object' && turmaRef ? (turmaRef.ano || turmaRef.anoLetivo || '') : (anoLetivo || '')
  const tTurno = typeof turmaRef === 'object' && turmaRef ? String(turmaRef.turno || '').toLowerCase() : (typeof turmaRef === 'string' ? turmaRef.toLowerCase() : '')

  const isIntegralTurma = tTurno.includes('integral') || tTurno.includes('intermediario') || tTurno.includes('intermediário') || norm(tNome).includes('integral')

  const vinculos = getAlunoVinculosAtivos(aluno, anoLetivo || tAno)

  for (const v of vinculos) {
    const vTurma = String(v.serieTurma || v.turma || aluno.turma || '').trim()
    const vTurmaNorm = norm(vTurma)

    // 1. Direct match by ID, Nome, or Codigo
    if (vTurmaNorm !== '' && (
      vTurmaNorm === norm(tNome) || 
      vTurmaNorm === norm(tId) || 
      (tCod && vTurmaNorm === norm(tCod))
    )) {
      return true
    }

    // Direct match on student.turma property
    const directTurmaNorm = norm(aluno.turma)
    if (directTurmaNorm !== '' && (
      directTurmaNorm === norm(tNome) || 
      directTurmaNorm === norm(tId) || 
      (tCod && directTurmaNorm === norm(tCod))
    )) {
      return true
    }

    // 2. Integral / Intermediário dual-enrollment check
    const isIntegralSel = v.isIntegralIntermediario === true || 
                          v.modalidade === 'INTEGRAL/INTERMEDIÁRIO' || 
                          aluno.isIntegralIntermediario === true || 
                          aluno.dados?.isIntegralIntermediario === true ||
                          aluno.dados?.modalidade === 'INTEGRAL/INTERMEDIÁRIO'

    if (isIntegralSel && isIntegralTurma) {
      const vAno = v.anoLetivo || aluno.dados?.anoLetivo || aluno.ano_letivo
      const anoMatch = !tAno || !vAno || String(vAno).trim() === String(tAno).trim()

      const vSerie = v.serie || aluno.serie || aluno.dados?.serie || ''
      const serieMatch = !tSerie || !vSerie || norm(tSerie) === norm(vSerie) || norm(tNome).includes(norm(vSerie))

      if (anoMatch && serieMatch) {
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

  // 1. Direct properties on student
  if (aluno.isIntegralIntermediario || aluno.dados?.isIntegralIntermediario) return true;
  const directModalidade = String(aluno.modalidade || aluno.dados?.modalidade || '').toLowerCase();
  if (directModalidade.includes('integral') || directModalidade.includes('intermediario') || directModalidade.includes('intermediário')) return true;
  const directTurno = String(aluno.turno || aluno.turno_nome || aluno.dados?.turno || '').toLowerCase();
  if (directTurno.includes('integral') || directTurno.includes('intermediario') || directTurno.includes('intermediário')) return true;

  // 2. Active turmas
  if (Array.isArray(turmas) && turmas.length > 0) {
    for (const t of turmas) {
      if (isAlunoCursandoTurma(aluno, t, anoLetivo || t.ano)) {
        const tNome = String(t.nome || t.dados?.nome || '').toLowerCase();
        const tTurno = String(t.turno || t.dados?.turno || '').toLowerCase();
        const tMod = String(t.modalidade || t.dados?.modalidade || '').toLowerCase();
        if (
          tNome.includes('integral') || tNome.includes('intermediario') || tNome.includes('intermediário') ||
          tTurno.includes('integral') || tTurno.includes('intermediario') || tTurno.includes('intermediário') ||
          tMod.includes('integral') || tMod.includes('intermediario') || tMod.includes('intermediário')
        ) {
          return true;
        }
      }
    }
  }

  // 3. Matching groups in agenda/grupos
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

  // 4. historicoTurmas & turmasAdicionais
  const hist = aluno.historicoTurmas || aluno.dados?.historicoTurmas;
  if (Array.isArray(hist)) {
    for (const ht of hist) {
      const st = String(ht.serieTurma || ht.turma || '').toLowerCase();
      const mod = String(ht.modalidade || ht.turno || '').toLowerCase();
      if (st.includes('integral') || st.includes('intermediario') || st.includes('intermediário') ||
          mod.includes('integral') || mod.includes('intermediario') || mod.includes('intermediário')) {
        return true;
      }
      if (Array.isArray(ht.turmasAdicionais)) {
        for (const sub of ht.turmasAdicionais) {
          const subSt = String(sub.serieTurma || sub.turma || '').toLowerCase();
          const subMod = String(sub.modalidade || sub.turno || '').toLowerCase();
          if (subSt.includes('integral') || subSt.includes('intermediario') || subSt.includes('intermediário') ||
              subMod.includes('integral') || subMod.includes('intermediario') || subMod.includes('intermediário')) {
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



