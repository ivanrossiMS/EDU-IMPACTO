import {
  AlocacaoCurricular,
  AmbienteRecurso,
  AulaAlocada,
  AulaConflito,
  CenarioHorario,
  DiagnosticoGeral,
  DiagnosticoItem,
  DiaSemanaId,
  DIAS_SEMANA_LABELS,
  FaixaHorario,
  HorarioProjeto,
  MetricasHorario,
  ModeloHorario,
  ProfessorHorarioConfig,
  StatusDisponibilidade,
  TurmaHorarioConfig,
} from './types'

// ─── Utilitários de Tempo ─────────────────────────────────────────────────────

export function parseTimeToMinutes(hhmm: string): number {
  if (!hhmm || !hhmm.includes(':')) return 0
  const [hStr, mStr] = hhmm.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return h * 60 + m
}

export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd)
}

export function getTurnoFaixaMacro(inicioMin: number): 'manha' | 'tarde' | 'noite' {
  if (inicioMin < 12 * 60 + 35) return 'manha'
  if (inicioMin < 18 * 60 + 15) return 'tarde'
  return 'noite'
}

export function getTravelTimeMinutes(
  projeto: HorarioProjeto,
  sedeA: string,
  sedeB: string,
  prof?: ProfessorHorarioConfig
): number {
  if (!sedeA || !sedeB || sedeA === sedeB) return 0
  const key1 = `${sedeA}__${sedeB}`
  const key2 = `${sedeB}__${sedeA}`
  const matrixVal = projeto.matrizDeslocamento?.[key1] ?? projeto.matrizDeslocamento?.[key2]
  if (typeof matrixVal === 'number' && matrixVal >= 0) {
    return Math.max(matrixVal, prof?.tempoDeslocamentoMin || 0)
  }
  return prof?.tempoDeslocamentoMin ?? projeto.parametros.tempoDeslocamentoPadraoMin ?? 30
}

/**
 * Avalia a disponibilidade de um professor para uma faixa real [inicioMin, fimMin) no dia.
 * Suporta chaves no formato `${dia}_${inicio}` ou `${dia}_${inicio}-${fim}`.
 */
export function getProfessorDisponibilidadeNoHorario(
  prof: ProfessorHorarioConfig,
  dia: DiaSemanaId,
  inicio: string,
  fim: string
): StatusDisponibilidade {
  const disp = prof.disponibilidade || {}
  const exactKey = `${dia}_${inicio}`
  const rangeKey = `${dia}_${inicio}-${fim}`

  if (disp[rangeKey]) return disp[rangeKey]
  if (disp[exactKey]) return disp[exactKey]

  const targetStart = parseTimeToMinutes(inicio)
  const targetEnd = parseTimeToMinutes(fim)
  let best: StatusDisponibilidade = 'disponivel'

  for (const [key, status] of Object.entries(disp)) {
    if (!key.startsWith(`${dia}_`)) continue
    const timePart = key.slice(`${dia}_`.length)
    let kStart = 0
    let kEnd = 0
    if (timePart.includes('-')) {
      const [s, e] = timePart.split('-')
      kStart = parseTimeToMinutes(s)
      kEnd = parseTimeToMinutes(e)
    } else {
      kStart = parseTimeToMinutes(timePart)
      kEnd = kStart + 50
    }
    if (intervalsOverlap(targetStart, targetEnd, kStart, kEnd)) {
      if (status === 'indisponivel') return 'indisponivel'
      if (status === 'preferencial') best = 'preferencial'
    }
  }

  return best
}

export function isAmbienteIndisponivel(
  ambiente: AmbienteRecurso | undefined,
  dia: DiaSemanaId,
  inicio: string,
  fim: string
): boolean {
  if (!ambiente?.indisponivel) return false
  if (ambiente.indisponivel[`${dia}_${inicio}-${fim}`] || ambiente.indisponivel[`${dia}_${inicio}`]) {
    return true
  }
  const s = parseTimeToMinutes(inicio)
  const e = parseTimeToMinutes(fim)
  for (const [k, blocked] of Object.entries(ambiente.indisponivel)) {
    if (!blocked || !k.startsWith(`${dia}_`)) continue
    const tp = k.slice(`${dia}_`.length)
    if (tp.includes('-')) {
      const [ks, ke] = tp.split('-')
      if (intervalsOverlap(s, e, parseTimeToMinutes(ks), parseTimeToMinutes(ke))) return true
    } else {
      const ks = parseTimeToMinutes(tp)
      if (intervalsOverlap(s, e, ks, ks + 50)) return true
    }
  }
  return false
}

// ─── Diagnóstico Pré-Geração (Viabilidade estilo Lira Pro) ───────────────────

export function analisarViabilidade(projeto: HorarioProjeto): DiagnosticoGeral {
  const itens: DiagnosticoItem[] = []
  const modeloMap = new Map<string, ModeloHorario>(projeto.modelosHorario.map(m => [m.id, m]))
  const profMap = new Map<string, ProfessorHorarioConfig>(projeto.professores.map(p => [p.id, p]))
  const discMap = new Map(projeto.disciplinas.map(d => [d.id, d]))
  const ambMap = new Map(projeto.ambientes.map(a => [a.id, a]))

  const turmasAtivas = projeto.turmas.filter(t => t.ativa)
  const turmaMap = new Map(turmasAtivas.map(t => [t.id, t]))

  // 1. Por Turno
  const turnoBuckets = new Map<string, { demanda: number; capacidade: number; turmas: number }>()
  for (const t of turmasAtivas) {
    const mod = modeloMap.get(t.modeloHorarioId)
    const capTurma = mod ? mod.diasAtivos.length * mod.faixas.filter(f => f.tipo === 'aula').length : 0
    const demTurma = projeto.alocacoes
      .filter(a => a.turmaId === t.id)
      .reduce((acc, a) => acc + (a.aulasSemana || 0), 0)

    const turnoKey = t.turno || mod?.turno || 'Geral'
    const cur = turnoBuckets.get(turnoKey) || { demanda: 0, capacidade: 0, turmas: 0 }
    cur.demanda += demTurma
    cur.capacidade += capTurma
    cur.turmas += 1
    turnoBuckets.set(turnoKey, cur)

    if (!mod) {
      itens.push({
        id: `diag-turma-nomod-${t.id}`,
        escopo: 'turma',
        titulo: `${t.nome}: sem modelo de horário`,
        nivel: 'inviavel',
        resumo: 'Turma sem grade de horários configurada',
        detalhe: `A turma ${t.nome} não possui um modelo de início/término de aulas vinculado.`,
        sugestao: 'Vincule um modelo de horário para esta turma na aba Estrutura & Sedes.',
      })
    } else if (demTurma > capTurma) {
      itens.push({
        id: `diag-turma-over-${t.id}`,
        escopo: 'turma',
        titulo: `${t.nome}: excesso de carga (${demTurma}/${capTurma} aulas)`,
        nivel: 'inviavel',
        resumo: `${demTurma - capTurma} aulas a mais que os horários da turma`,
        detalhe: `A grade curricular pede ${demTurma} aulas/semana, mas o turno possui apenas ${capTurma} espaços.`,
        sugestao: `Adicione mais tempos ao modelo "${mod.nome}" ou reduza a carga curricular.`,
        taxaOcupacaoPct: capTurma > 0 ? Math.round((demTurma / capTurma) * 100) : 100,
      })
    } else if (demTurma === 0) {
      itens.push({
        id: `diag-turma-empty-${t.id}`,
        escopo: 'turma',
        titulo: `${t.nome}: nenhuma disciplina alocada`,
        nivel: 'atencao',
        resumo: '0 aulas cadastradas na matriz curricular',
        detalhe: `A turma ${t.nome} está ativa mas não tem aulas previstas na Grade Curricular.`,
        sugestao: 'Preencha as cargas na aba Grade Curricular & Duplas.',
      })
    }
  }

  const porTurno = Array.from(turnoBuckets.entries()).map(([turno, b]) => {
    const pct = b.capacidade > 0 ? (b.demanda / b.capacidade) * 100 : 0
    let nivel: 'viavel' | 'atencao' | 'inviavel' = 'viavel'
    let mensagem = `${b.demanda}/${b.capacidade} aulas (${Math.round(pct)}% ocupação)`
    if (b.capacidade === 0 || b.demanda > b.capacidade) {
      nivel = 'inviavel'
      mensagem = b.capacidade === 0 ? 'Sem modelo de horário definido' : `Excesso de ${b.demanda - b.capacidade} aulas`
    } else if (b.demanda === 0) {
      nivel = 'atencao'
      mensagem = 'Nenhuma aula curricular configurada'
    } else if (pct >= 96 && b.turmas > 1) {
      nivel = 'viavel'
    }
    return { turno, nivel, demanda: b.demanda, capacidade: b.capacidade, mensagem }
  })

  // 2. Validação de Alocações Curriculares (sem professor, distribuição impossível)
  for (const aloc of projeto.alocacoes) {
    if (aloc.aulasSemana <= 0) continue
    const turma = turmaMap.get(aloc.turmaId)
    if (!turma) continue
    const disc = discMap.get(aloc.disciplinaId)
    const mod = modeloMap.get(turma.modeloHorarioId)
    const discNome = disc?.nome || 'Disciplina'

    if (!aloc.professoresIds || aloc.professoresIds.length === 0) {
      itens.push({
        id: `diag-aloc-noprof-${aloc.id}`,
        escopo: 'curriculo',
        titulo: `${turma.nome} • ${discNome}: sem professor`,
        nivel: 'inviavel',
        resumo: `${aloc.aulasSemana} aula(s) sem docente vinculado`,
        detalhe: `Defina ao menos um professor para ${discNome} na turma ${turma.nome}.`,
        sugestao: 'Abra a célula na Grade Curricular e selecione o professor.',
      })
    }

    if (mod && aloc.distribuicao === 'separadas' && aloc.aulasSemana > mod.diasAtivos.length) {
      itens.push({
        id: `diag-aloc-sep-${aloc.id}`,
        escopo: 'curriculo',
        titulo: `${turma.nome} • ${discNome}: "1 aula/dia" impossível`,
        nivel: 'inviavel',
        resumo: `${aloc.aulasSemana} aulas para ${mod.diasAtivos.length} dias letivos`,
        detalhe: `Não é possível ter no máximo 1 aula por dia quando há ${aloc.aulasSemana} aulas em ${mod.diasAtivos.length} dias.`,
        sugestao: 'Altere a distribuição para "Máx. 2/dia" ou "Geminadas".',
      })
    }
  }

  // 3. Por Professor (Carga vs Disponibilidade real e Sedes)
  for (const prof of projeto.professores) {
    const alocsProf = projeto.alocacoes.filter(
      a => a.aulasSemana > 0 && turmaMap.has(a.turmaId) && a.professoresIds.includes(prof.id)
    )
    const totalAulas = alocsProf.reduce((acc, a) => acc + a.aulasSemana, 0)
    if (totalAulas === 0) continue

    // Calcular slots disponíveis do professor considerando os modelos das turmas em que ele atua
    const uniqueSlotsByDay = new Map<DiaSemanaId, Set<string>>()
    const sedesUsadas = new Set<string>()
    for (const a of alocsProf) {
      const t = turmaMap.get(a.turmaId)!
      sedesUsadas.add(t.unidadeId)
      const mod = modeloMap.get(t.modeloHorarioId)
      if (!mod) continue
      for (const dia of mod.diasAtivos) {
        if (!uniqueSlotsByDay.has(dia)) uniqueSlotsByDay.set(dia, new Set())
        for (const f of mod.faixas) {
          if (f.tipo !== 'aula') continue
          const st = getProfessorDisponibilidadeNoHorario(prof, dia, f.inicio, f.fim)
          if (st !== 'indisponivel') {
            uniqueSlotsByDay.get(dia)!.add(`${f.inicio}-${f.fim}`)
          }
        }
      }
    }

    let capacidadeDisp = 0
    let diasComDisp = 0
    for (const [, slotSet] of uniqueSlotsByDay.entries()) {
      if (slotSet.size > 0) diasComDisp++
      capacidadeDisp += Math.min(slotSet.size, prof.maxAulasPorDia || 99)
    }

    // Checar sedes permitidas
    if (prof.sedesPermitidas && prof.sedesPermitidas.length > 0) {
      for (const sId of sedesUsadas) {
        if (!prof.sedesPermitidas.includes(sId)) {
          itens.push({
            id: `diag-prof-sede-${prof.id}-${sId}`,
            escopo: 'professor',
            titulo: `${prof.nome}: alocado em sede não permitida`,
            nivel: 'inviavel',
            resumo: 'Restrição de sede incompatível com a grade',
            detalhe: `O professor está atribuído a turmas em uma sede fora da sua lista de sedes permitidas.`,
            sugestao: 'Libere a sede no cadastro do professor ou troque o docente da turma.',
          })
        }
      }
    }

    if (totalAulas > capacidadeDisp) {
      itens.push({
        id: `diag-prof-over-${prof.id}`,
        escopo: 'professor',
        titulo: `${prof.nome}: demanda (${totalAulas}) maior que disponibilidade (${capacidadeDisp})`,
        nivel: 'inviavel',
        resumo: `Faltam ${totalAulas - capacidadeDisp} horários livres para este professor`,
        detalhe: `Considerando bloqueios de disponibilidade e limite de ${prof.maxAulasPorDia} aulas/dia, há apenas ${capacidadeDisp} horários úteis.`,
        sugestao: `Libere mais horários na disponibilidade de ${prof.nome} ou aumente o limite diário.`,
        taxaOcupacaoPct: capacidadeDisp > 0 ? Math.round((totalAulas / capacidadeDisp) * 100) : 100,
      })
    } else if (prof.maxAulasSemana > 0 && totalAulas > prof.maxAulasSemana) {
      itens.push({
        id: `diag-prof-maxsem-${prof.id}`,
        escopo: 'professor',
        titulo: `${prof.nome}: excede limite semanal (${totalAulas}/${prof.maxAulasSemana})`,
        nivel: 'inviavel',
        resumo: `${totalAulas - prof.maxAulasSemana} aulas acima do teto semanal`,
        detalhe: `O limite semanal cadastrado para ${prof.nome} é de ${prof.maxAulasSemana} aulas.`,
        sugestao: 'Ajuste o limite semanal ou redistribua aulas com outro docente.',
      })
    } else if (capacidadeDisp > 0 && totalAulas / capacidadeDisp >= 0.88) {
      itens.push({
        id: `diag-prof-tight-${prof.id}`,
        escopo: 'professor',
        titulo: `${prof.nome}: agenda muito apertada (${totalAulas}/${capacidadeDisp})`,
        nivel: 'atencao',
        resumo: `${Math.round((totalAulas / capacidadeDisp) * 100)}% dos horários disponíveis ocupados`,
        detalhe: `Pouca folga para evitar janelas ou conflitos com aulas em dupla (${diasComDisp} dias disponíveis).`,
        sugestao: 'Considere liberar 2 a 4 horários extras caso o gerador encontre janelas.',
        taxaOcupacaoPct: Math.round((totalAulas / capacidadeDisp) * 100),
      })
    }
  }

  // 4. Por Ambiente (Quadra, Labs)
  for (const amb of projeto.ambientes) {
    if (amb.tipo === 'sala_comum') continue
    const alocsAmb = projeto.alocacoes.filter(a => {
      if (a.aulasSemana <= 0 || !turmaMap.has(a.turmaId)) return false
      const resolvedAmb = a.ambienteId || discMap.get(a.disciplinaId)?.ambientePadraoId
      return resolvedAmb === amb.id
    })
    const demandaAmb = alocsAmb.reduce((acc, a) => acc + a.aulasSemana, 0)
    if (demandaAmb === 0) continue

    // Estimar slots abertos nos modelos das turmas daquela sede
    const modelosSede = new Set<ModeloHorario>()
    for (const a of alocsAmb) {
      const t = turmaMap.get(a.turmaId)!
      const m = modeloMap.get(t.modeloHorarioId)
      if (m) modelosSede.add(m)
    }
    const slotKeys = new Set<string>()
    for (const m of modelosSede) {
      for (const d of m.diasAtivos) {
        for (const f of m.faixas) {
          if (f.tipo === 'aula' && !isAmbienteIndisponivel(amb, d, f.inicio, f.fim)) {
            slotKeys.add(`${d}_${f.inicio}-${f.fim}`)
          }
        }
      }
    }
    const capTotal = slotKeys.size * Math.max(1, amb.capacidadeSimultanea || 1)
    if (demandaAmb > capTotal) {
      itens.push({
        id: `diag-amb-over-${amb.id}`,
        escopo: 'ambiente',
        titulo: `Ambiente "${amb.nome}": superlotado (${demandaAmb}/${capTotal})`,
        nivel: 'inviavel',
        resumo: `Demanda supera capacidade de ${amb.capacidadeSimultanea} turma(s) simultânea(s)`,
        detalhe: `Há ${demandaAmb} aulas/semana exigindo "${amb.nome}", mas apenas ${capTotal} vagas semanais.`,
        sugestao: 'Aumente a capacidade simultânea (ex: dividir quadra) ou libere mais horários.',
      })
    } else if (capTotal > 0 && demandaAmb / capTotal >= 0.85) {
      itens.push({
        id: `diag-amb-tight-${amb.id}`,
        escopo: 'ambiente',
        titulo: `Ambiente "${amb.nome}": alta ocupação (${demandaAmb}/${capTotal})`,
        nivel: 'atencao',
        resumo: `${Math.round((demandaAmb / capTotal) * 100)}% de uso semanal`,
        detalhe: 'Uso intenso do espaço especial; pode limitar combinações de horários.',
      })
    }
  }

  const temInviavel = itens.some(i => i.nivel === 'inviavel') || porTurno.some(t => t.nivel === 'inviavel')
  const temAtencao = itens.some(i => i.nivel === 'atencao') || porTurno.some(t => t.nivel === 'atencao')

  const status: 'viavel' | 'atencao' | 'inviavel' = temInviavel
    ? 'inviavel'
    : temAtencao
    ? 'atencao'
    : 'viavel'

  const inviavelCount = itens.filter(i => i.nivel === 'inviavel').length
  const atencaoCount = itens.filter(i => i.nivel === 'atencao').length
  const scoreViabilidade = Math.max(0, Math.min(100, 100 - inviavelCount * 22 - atencaoCount * 6))

  if (itens.length === 0) {
    itens.push({
      id: 'diag-ok',
      escopo: 'turno',
      titulo: 'Configuração 100% viável para geração',
      nivel: 'viavel',
      resumo: 'Capacidade, professores, sedes e ambientes em equilíbrio',
      detalhe: 'Nenhum bloqueio matemático detectado antes da geração.',
    })
  }

  return { status, scoreViabilidade, itens, porTurno }
}

// ─── Avaliador Completo de Conflitos e Métricas ──────────────────────────────

export function avaliarGradeCompleta(
  projeto: HorarioProjeto,
  aulasInput: AulaAlocada[]
): {
  aulasComConflitos: AulaAlocada[]
  metricas: MetricasHorario
} {
  const profMap = new Map(projeto.professores.map(p => [p.id, p]))
  const ambMap = new Map(projeto.ambientes.map(a => [a.id, a]))
  const alocMap = new Map(projeto.alocacoes.map(a => [a.id, a]))
  const turmaMap = new Map(projeto.turmas.map(t => [t.id, t]))
  const modeloMap = new Map(projeto.modelosHorario.map(m => [m.id, m]))

  const conflitosPorAula = new Map<string, AulaConflito[]>()
  const pushConflito = (aulaId: string, c: AulaConflito) => {
    const arr = conflitosPorAula.get(aulaId) || []
    arr.push(c)
    conflitosPorAula.set(aulaId, arr)
  }

  let choquesProfessor = 0
  let violacoesDisponibilidade = 0
  let violacoesDeslocamento = 0
  let violacoesAmbiente = 0
  let violacoesDistribuicao = 0

  // 1. Verificar choques de professor, deslocamento entre sedes, disponibilidade e limite diário
  const aulasPorProfDia = new Map<string, AulaAlocada[]>()
  for (const aula of aulasInput) {
    for (const pId of aula.professoresIds) {
      const key = `${pId}__${aula.dia}`
      const arr = aulasPorProfDia.get(key) || []
      arr.push(aula)
      aulasPorProfDia.set(key, arr)

      const prof = profMap.get(pId)
      if (prof) {
        const disp = getProfessorDisponibilidadeNoHorario(prof, aula.dia, aula.inicio, aula.fim)
        if (disp === 'indisponivel') {
          violacoesDisponibilidade++
          pushConflito(aula.id, {
            tipo: 'indisponibilidade_professor',
            severidade: 'erro',
            mensagem: `${prof.nome} possui restrição de indisponibilidade em ${DIAS_SEMANA_LABELS[aula.dia].curto} ${aula.inicio}–${aula.fim}.`,
          })
        }
        if (prof.sedesPermitidas.length > 0 && !prof.sedesPermitidas.includes(aula.unidadeId)) {
          violacoesDeslocamento++
          pushConflito(aula.id, {
            tipo: 'deslocamento_sede',
            severidade: 'erro',
            mensagem: `${prof.nome} não está habilitado para lecionar nesta sede.`,
          })
        }
      }
    }
  }

  let totalJanelasProfessores = 0
  let professoresComJanelaSet = new Set<string>()
  let trocasSedeNoDia = 0

  for (const [key, list] of aulasPorProfDia.entries()) {
    const [pId] = key.split('__')
    const prof = profMap.get(pId)
    const sorted = [...list].sort((a, b) => a.inicioMin - b.inicioMin)

    // Limite diário
    if (prof && prof.maxAulasPorDia > 0 && sorted.length > prof.maxAulasPorDia) {
      for (let i = prof.maxAulasPorDia; i < sorted.length; i++) {
        violacoesDistribuicao++
        pushConflito(sorted[i].id, {
          tipo: 'limite_diario_professor',
          severidade: 'aviso',
          mensagem: `${prof.nome} excedeu o limite de ${prof.maxAulasPorDia} aulas no dia (${sorted.length} aulas).`,
        })
      }
    }

    // Choques simultâneos + Deslocamento + Janelas
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]
        if (intervalsOverlap(a.inicioMin, a.fimMin, b.inicioMin, b.fimMin)) {
          choquesProfessor++
          const tB = turmaMap.get(b.turmaId)?.nome || b.turmaId
          const tA = turmaMap.get(a.turmaId)?.nome || a.turmaId
          pushConflito(a.id, {
            tipo: 'choque_professor',
            severidade: 'erro',
            mensagem: `Choque de horário: ${prof?.nome || 'Professor'} também está na turma ${tB} (${b.inicio}–${b.fim}).`,
          })
          pushConflito(b.id, {
            tipo: 'choque_professor',
            severidade: 'erro',
            mensagem: `Choque de horário: ${prof?.nome || 'Professor'} também está na turma ${tA} (${a.inicio}–${a.fim}).`,
          })
        } else {
          // Tempo de deslocamento entre sedes diferentes
          if (a.unidadeId && b.unidadeId && a.unidadeId !== b.unidadeId) {
            const gap = b.inicioMin - a.fimMin
            const needed = getTravelTimeMinutes(projeto, a.unidadeId, b.unidadeId, prof)
            if (gap < needed) {
              violacoesDeslocamento++
              pushConflito(b.id, {
                tipo: 'deslocamento_sede',
                severidade: 'erro',
                mensagem: `Deslocamento insuficiente para ${prof?.nome || 'Professor'}: intervalo de ${gap}min (necessário ${needed}min entre sedes).`,
              })
            }
          }
        }
      }

      if (i > 0) {
        const prev = sorted[i - 1]
        if (prev.unidadeId && a.unidadeId && prev.unidadeId !== a.unidadeId) {
          trocasSedeNoDia++
        }
        // Contar janelas dentro do mesmo turno macro
        if (!intervalsOverlap(prev.inicioMin, prev.fimMin, a.inicioMin, a.fimMin)) {
          const sameShift = getTurnoFaixaMacro(prev.fimMin) === getTurnoFaixaMacro(a.inicioMin)
          const gap = a.inicioMin - prev.fimMin
          if (sameShift && gap > 25) {
            const janelasCount = Math.max(1, Math.round((gap - 15) / 50))
            totalJanelasProfessores += janelasCount
            professoresComJanelaSet.add(pId)
          }
        }
      }
    }
  }

  // 2. Verificar ambientes (capacidade simultânea & indisponibilidade)
  const aulasPorAmbDia = new Map<string, AulaAlocada[]>()
  for (const aula of aulasInput) {
    if (!aula.ambienteId) continue
    const amb = ambMap.get(aula.ambienteId)
    if (!amb) continue
    if (isAmbienteIndisponivel(amb, aula.dia, aula.inicio, aula.fim)) {
      violacoesAmbiente++
      pushConflito(aula.id, {
        tipo: 'capacidade_ambiente',
        severidade: 'erro',
        mensagem: `Ambiente "${amb.nome}" está bloqueado neste horário.`,
      })
    }
    const key = `${aula.ambienteId}__${aula.dia}`
    const arr = aulasPorAmbDia.get(key) || []
    arr.push(aula)
    aulasPorAmbDia.set(key, arr)
  }

  for (const [key, list] of aulasPorAmbDia.entries()) {
    const [ambId] = key.split('__')
    const amb = ambMap.get(ambId)
    const cap = Math.max(1, amb?.capacidadeSimultanea || 1)
    for (const aula of list) {
      const concurrent = list.filter(other =>
        intervalsOverlap(aula.inicioMin, aula.fimMin, other.inicioMin, other.fimMin)
      )
      if (concurrent.length > cap) {
        violacoesAmbiente++
        pushConflito(aula.id, {
          tipo: 'capacidade_ambiente',
          severidade: 'erro',
          mensagem: `Ambiente "${amb?.nome}" excedeu capacidade (${concurrent.length}/${cap} turmas simultâneas).`,
        })
      }
    }
  }

  // 3. Verificar distribuição por Turma + Disciplina + Dia (aulas triplas, separadas, geminadas)
  let aulasTriplas = 0
  let geminadasAtendidas = 0
  let geminadasPrevistas = 0

  const aulasPorTurmaDiscDia = new Map<string, AulaAlocada[]>()
  for (const aula of aulasInput) {
    const key = `${aula.turmaId}__${aula.disciplinaId}__${aula.dia}`
    const arr = aulasPorTurmaDiscDia.get(key) || []
    arr.push(aula)
    aulasPorTurmaDiscDia.set(key, arr)
  }

  for (const [, list] of aulasPorTurmaDiscDia.entries()) {
    const sorted = [...list].sort((a, b) => a.ordem - b.ordem)
    const aloc = alocMap.get(sorted[0].alocacaoId)
    if (sorted.length >= 3) {
      aulasTriplas++
      if (projeto.parametros.eliminarAulasTriplas) {
        violacoesDistribuicao++
        pushConflito(sorted[2].id, {
          tipo: 'distribuicao_disciplina',
          severidade: 'aviso',
          mensagem: `${sorted[2].disciplinaNome} com ${sorted.length} aulas no mesmo dia (aula tripla).`,
        })
      }
    }
    if (aloc?.distribuicao === 'separadas' && sorted.length > 1) {
      violacoesDistribuicao++
      pushConflito(sorted[1].id, {
        tipo: 'distribuicao_disciplina',
        severidade: 'aviso',
        mensagem: `${sorted[1].disciplinaNome} configurada como "1 aula por dia", mas possui ${sorted.length} aulas neste dia.`,
      })
    }
    if (aloc?.distribuicao === 'max_2_dia' && sorted.length > 2) {
      violacoesDistribuicao++
      pushConflito(sorted[2].id, {
        tipo: 'distribuicao_disciplina',
        severidade: 'aviso',
        mensagem: `${sorted[2].disciplinaNome} excede o limite de 2 aulas por dia.`,
      })
    }

    // Contar pares geminados
    const mod = modeloMap.get(turmaMap.get(sorted[0].turmaId)?.modeloHorarioId || '')
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const hasIntervaloBetween = mod
        ? mod.faixas.some(
            f => f.tipo === 'intervalo' && parseTimeToMinutes(f.inicio) >= a.fimMin && parseTimeToMinutes(f.fim) <= b.inicioMin
          )
        : false
      if (b.ordem === a.ordem + 1 && (!hasIntervaloBetween || projeto.parametros.permitirGeminadaAposIntervalo)) {
        geminadasAtendidas++
        i++
      }
    }
  }

  for (const aloc of projeto.alocacoes) {
    if (!turmaMap.has(aloc.turmaId) || aloc.aulasSemana <= 0) continue
    if (aloc.distribuicao === 'geminadas' || aloc.distribuicao === 'obrigatorio_geminada') {
      geminadasPrevistas += Math.floor(aloc.aulasSemana / 2)
    }
  }

  // 4. Preferências atendidas
  let totalComPreferencia = 0
  let preferenciasAtendidas = 0
  for (const aula of aulasInput) {
    for (const pId of aula.professoresIds) {
      const prof = profMap.get(pId)
      if (!prof) continue
      const hasAnyPref = Object.values(prof.disponibilidade || {}).some(v => v === 'preferencial')
      if (hasAnyPref) {
        totalComPreferencia++
        if (getProfessorDisponibilidadeNoHorario(prof, aula.dia, aula.inicio, aula.fim) === 'preferencial') {
          preferenciasAtendidas++
        }
      }
    }
  }

  const totalAulasPrevistas = projeto.alocacoes
    .filter(a => turmaMap.has(a.turmaId) && a.aulasSemana > 0)
    .reduce((acc, a) => acc + a.aulasSemana, 0)

  const totalAulasAlocadas = aulasInput.length
  const aulasNaoAlocadas = Math.max(0, totalAulasPrevistas - totalAulasAlocadas)

  const aulasComConflitos: AulaAlocada[] = aulasInput.map(a => ({
    ...a,
    conflitos: conflitosPorAula.get(a.id) || [],
  }))

  // Score 0..100
  let score = 100
  score -= choquesProfessor * 15
  score -= violacoesDisponibilidade * 8
  score -= violacoesDeslocamento * 8
  score -= violacoesAmbiente * 8
  score -= aulasNaoAlocadas * 6
  score -= totalJanelasProfessores * (projeto.parametros.eliminarJanelas ? 2.5 : 0.5)
  score -= aulasTriplas * (projeto.parametros.eliminarAulasTriplas ? 3 : 0.5)
  score -= trocasSedeNoDia * (projeto.parametros.minimizarTrocaSede ? 1.5 : 0.3)

  const metricas: MetricasHorario = {
    totalAulasPrevistas,
    totalAulasAlocadas,
    aulasNaoAlocadas,
    choquesProfessor,
    violacoesDisponibilidade,
    violacoesDeslocamento,
    violacoesAmbiente,
    violacoesDistribuicao,
    totalJanelasProfessores,
    professoresComJanela: professoresComJanelaSet.size,
    trocasSedeNoDia,
    aulasTriplas,
    geminadasAtendidas,
    geminadasPrevistas,
    preferenciasAtendidasPct: totalComPreferencia > 0 ? Math.round((preferenciasAtendidas / totalComPreferencia) * 100) : 100,
    scoreGeral: Math.max(0, Math.min(100, Math.round(score))),
  }

  return { aulasComConflitos, metricas }
}

// ─── Avaliador Rápido de Slot Candidato para Drag/Click-Swap na UI ───────────

export interface SlotAvaliacaoUI {
  status: 'valido' | 'aviso' | 'conflito' | 'ocupado'
  motivos: string[]
}

export function avaliarSlotParaAula(
  projeto: HorarioProjeto,
  aulasAtuais: AulaAlocada[],
  aulaMovida: AulaAlocada,
  targetDia: DiaSemanaId,
  targetFaixa: FaixaHorario
): SlotAvaliacaoUI {
  if (targetFaixa.tipo !== 'aula') {
    return { status: 'conflito', motivos: ['Intervalo / Recreio'] }
  }

  const profMap = new Map(projeto.professores.map(p => [p.id, p]))
  const ambMap = new Map(projeto.ambientes.map(a => [a.id, a]))
  const turmaMap = new Map(projeto.turmas.map(t => [t.id, t]))

  const inicioMin = parseTimeToMinutes(targetFaixa.inicio)
  const fimMin = parseTimeToMinutes(targetFaixa.fim)
  const motivos: string[] = []
  let hasErro = false
  let hasAviso = false

  // Se já existe uma aula no destino (troca), simulamos removendo ambas e colocando aulaMovida no destino
  const aulaNoDestino = aulasAtuais.find(
    a => a.turmaId === aulaMovida.turmaId && a.dia === targetDia && a.faixaId === targetFaixa.id && a.id !== aulaMovida.id
  )
  if (aulaNoDestino?.fixa) {
    return { status: 'conflito', motivos: ['Aula de destino está travada (🔒)'] }
  }

  const outrasAulas = aulasAtuais.filter(a => a.id !== aulaMovida.id && a.id !== aulaNoDestino?.id)

  // Checar professores da aulaMovida no slot de destino
  for (const pId of aulaMovida.professoresIds) {
    const prof = profMap.get(pId)
    if (prof) {
      const disp = getProfessorDisponibilidadeNoHorario(prof, targetDia, targetFaixa.inicio, targetFaixa.fim)
      if (disp === 'indisponivel') {
        hasErro = true
        motivos.push(`${prof.nome} indisponível neste horário`)
      }
      if (prof.sedesPermitidas.length > 0 && !prof.sedesPermitidas.includes(aulaMovida.unidadeId)) {
        hasErro = true
        motivos.push(`${prof.nome} não atua nesta sede`)
      }
    }

    const doProfNoDia = outrasAulas.filter(a => a.dia === targetDia && a.professoresIds.includes(pId))
    for (const other of doProfNoDia) {
      if (intervalsOverlap(inicioMin, fimMin, other.inicioMin, other.fimMin)) {
        hasErro = true
        const tNome = turmaMap.get(other.turmaId)?.nome || other.turmaId
        motivos.push(`Choque: ${prof?.nome || 'Professor'} já está em ${tNome} (${other.inicio}–${other.fim})`)
      } else if (other.unidadeId && aulaMovida.unidadeId && other.unidadeId !== aulaMovida.unidadeId) {
        const gap = other.inicioMin >= fimMin ? other.inicioMin - fimMin : inicioMin - other.fimMin
        const needed = getTravelTimeMinutes(projeto, aulaMovida.unidadeId, other.unidadeId, prof)
        if (gap < needed) {
          hasErro = true
          motivos.push(`Deslocamento insuficiente entre sedes (${gap}min < ${needed}min)`)
        }
      }
    }

    if (prof && prof.maxAulasPorDia > 0 && doProfNoDia.length + 1 > prof.maxAulasPorDia) {
      hasAviso = true
      motivos.push(`${prof.nome} atingirá ${doProfNoDia.length + 1} aulas no dia (máx. ${prof.maxAulasPorDia})`)
    }
  }

  // Checar ambiente
  if (aulaMovida.ambienteId) {
    const amb = ambMap.get(aulaMovida.ambienteId)
    if (amb) {
      if (isAmbienteIndisponivel(amb, targetDia, targetFaixa.inicio, targetFaixa.fim)) {
        hasErro = true
        motivos.push(`Ambiente "${amb.nome}" indisponível`)
      }
      const concurrent = outrasAulas.filter(
        a =>
          a.dia === targetDia &&
          a.ambienteId === amb.id &&
          intervalsOverlap(inicioMin, fimMin, a.inicioMin, a.fimMin)
      ).length
      if (concurrent + 1 > Math.max(1, amb.capacidadeSimultanea || 1)) {
        hasErro = true
        motivos.push(`Ambiente "${amb.nome}" já ocupado`)
      }
    }
  }

  // Se houver troca (aulaNoDestino voltaria para o slot de aulaMovida), checar também a volta!
  if (aulaNoDestino) {
    for (const pId of aulaNoDestino.professoresIds) {
      const prof = profMap.get(pId)
      if (prof) {
        const disp = getProfessorDisponibilidadeNoHorario(prof, aulaMovida.dia, aulaMovida.inicio, aulaMovida.fim)
        if (disp === 'indisponivel') {
          hasErro = true
          motivos.push(`Na troca, ${prof.nome} (${aulaNoDestino.disciplinaNome}) ficaria em horário indisponível`)
        }
      }
      const conflitoVolta = outrasAulas.find(
        a =>
          a.dia === aulaMovida.dia &&
          a.professoresIds.includes(pId) &&
          intervalsOverlap(aulaMovida.inicioMin, aulaMovida.fimMin, a.inicioMin, a.fimMin)
      )
      if (conflitoVolta) {
        hasErro = true
        const tNome = turmaMap.get(conflitoVolta.turmaId)?.nome || conflitoVolta.turmaId
        motivos.push(`Na troca, ${prof?.nome || 'Professor'} colide com ${tNome}`)
      }
    }
  }

  if (hasErro) return { status: 'conflito', motivos }
  if (hasAviso) return { status: 'aviso', motivos }
  return {
    status: aulaNoDestino ? 'ocupado' : 'valido',
    motivos: aulaNoDestino ? [`Trocar com ${aulaNoDestino.disciplinaNome}`] : ['Horário livre e sem choques'],
  }
}

// ─── Motor Matemático de Geração Automática (2 Fases: MRV+LCV + Simulated Annealing) ──

interface SchedulingUnit {
  unitId: string
  alocacao: AlocacaoCurricular
  turma: TurmaHorarioConfig
  disciplinaNome: string
  disciplinaSigla: string
  cor: string
  ambienteId?: string
  ambienteNome?: string
  size: 1 | 2 // 1 = aula simples, 2 = par geminado
  syncKey?: string
}

interface CandidateSlot {
  dia: DiaSemanaId
  faixas: FaixaHorario[] // 1 faixa se size=1, 2 faixas consecutivas se size=2
  inicioMin: number
  fimMin: number
  isPreferencial: boolean
  isPrimeirosHorarios: boolean
}

export interface SolverProgress {
  fase: 'preparando' | 'construtivo' | 'otimizacao' | 'finalizando'
  progressoPct: number
  mensagem: string
  melhorScore: number
  aulasAlocadas: number
  totalAulas: number
  janelas: number
  choques: number
}

export async function executarGeradorHorarioAsync(
  projeto: HorarioProjeto,
  aulasExistentes: AulaAlocada[],
  options?: {
    signal?: AbortSignal
    onProgress?: (p: SolverProgress) => void
  }
): Promise<{
  aulas: AulaAlocada[]
  naoAlocadas: CenarioHorario['naoAlocadas']
  metricas: MetricasHorario
}> {
  const onProgress = options?.onProgress
  const signal = options?.signal

  const yieldToMain = () => new Promise<void>(resolve => setTimeout(resolve, 0))

  onProgress?.({
    fase: 'preparando',
    progressoPct: 5,
    mensagem: 'Indexando turmas, restrições, ambientes e deslocamentos...',
    melhorScore: 0,
    aulasAlocadas: 0,
    totalAulas: 0,
    janelas: 0,
    choques: 0,
  })
  await yieldToMain()

  const modeloMap = new Map(projeto.modelosHorario.map(m => [m.id, m]))
  const profMap = new Map(projeto.professores.map(p => [p.id, p]))
  const discMap = new Map(projeto.disciplinas.map(d => [d.id, d]))
  const ambMap = new Map(projeto.ambientes.map(a => [a.id, a]))
  const turmasAtivas = projeto.turmas.filter(t => t.ativa && modeloMap.has(t.modeloHorarioId))
  const turmaMap = new Map(turmasAtivas.map(t => [t.id, t]))

  // Preservar apenas aulas fixadas (pin) válidas
  const pinnedAulas = aulasExistentes.filter(a => a.fixa && turmaMap.has(a.turmaId))
  const pinnedCountByAloc = new Map<string, number>()
  for (const p of pinnedAulas) {
    pinnedCountByAloc.set(p.alocacaoId, (pinnedCountByAloc.get(p.alocacaoId) || 0) + 1)
  }

  // Pré-computar slots válidos por modeloHorario
  const slotsPorTurmaSize1 = new Map<string, CandidateSlot[]>()
  const slotsPorTurmaSize2 = new Map<string, CandidateSlot[]>()

  for (const turma of turmasAtivas) {
    const mod = modeloMap.get(turma.modeloHorarioId)!
    const sortedFaixas = [...mod.faixas].sort((a, b) => a.ordem - b.ordem)
    const s1: CandidateSlot[] = []
    const s2: CandidateSlot[] = []

    for (const dia of mod.diasAtivos) {
      const aulaFaixas = sortedFaixas.filter(f => f.tipo === 'aula')
      for (let idx = 0; idx < aulaFaixas.length; idx++) {
        const f = aulaFaixas[idx]
        s1.push({
          dia,
          faixas: [f],
          inicioMin: parseTimeToMinutes(f.inicio),
          fimMin: parseTimeToMinutes(f.fim),
          isPreferencial: false,
          isPrimeirosHorarios: idx < 2,
        })

        if (idx + 1 < aulaFaixas.length) {
          const next = aulaFaixas[idx + 1]
          const fEnd = parseTimeToMinutes(f.fim)
          const nStart = parseTimeToMinutes(next.inicio)
          const hasBreakBetween = sortedFaixas.some(
            br => br.tipo === 'intervalo' && parseTimeToMinutes(br.inicio) >= fEnd && parseTimeToMinutes(br.fim) <= nStart
          )
          if (!hasBreakBetween || projeto.parametros.permitirGeminadaAposIntervalo) {
            s2.push({
              dia,
              faixas: [f, next],
              inicioMin: parseTimeToMinutes(f.inicio),
              fimMin: parseTimeToMinutes(next.fim),
              isPreferencial: false,
              isPrimeirosHorarios: idx < 2,
            })
          }
        }
      }
    }
    slotsPorTurmaSize1.set(turma.id, s1)
    slotsPorTurmaSize2.set(turma.id, s2)
  }

  // Decompor alocações em SchedulingUnits
  const units: SchedulingUnit[] = []
  let unitSeq = 1
  for (const aloc of projeto.alocacoes) {
    const turma = turmaMap.get(aloc.turmaId)
    if (!turma || aloc.aulasSemana <= 0) continue
    const alreadyPinned = pinnedCountByAloc.get(aloc.id) || 0
    const remaining = Math.max(0, aloc.aulasSemana - alreadyPinned)
    if (remaining === 0) continue

    const disc = discMap.get(aloc.disciplinaId)
    const discNome = disc?.nome || 'Disciplina'
    const discSigla = disc?.sigla || discNome.slice(0, 3).toUpperCase()
    const cor = aloc.cor || disc?.cor || '#3b82f6'
    const resolvedAmbId = aloc.ambienteId || disc?.ambientePadraoId || turma.salaBaseId
    const resolvedAmbNome = resolvedAmbId ? ambMap.get(resolvedAmbId)?.nome : undefined

    let toAllocate = remaining
    const canDouble =
      (aloc.distribuicao === 'obrigatorio_geminada' || aloc.distribuicao === 'geminadas') &&
      (slotsPorTurmaSize2.get(turma.id)?.length || 0) > 0

    if (canDouble) {
      while (toAllocate >= 2) {
        units.push({
          unitId: `U${unitSeq++}`,
          alocacao: aloc,
          turma,
          disciplinaNome: discNome,
          disciplinaSigla: discSigla,
          cor,
          ambienteId: resolvedAmbId,
          ambienteNome: resolvedAmbNome,
          size: 2,
          syncKey: aloc.syncGroupId,
        })
        toAllocate -= 2
      }
    }
    while (toAllocate > 0) {
      units.push({
        unitId: `U${unitSeq++}`,
        alocacao: aloc,
        turma,
        disciplinaNome: discNome,
        disciplinaSigla: discSigla,
        cor,
        ambienteId: resolvedAmbId,
        ambienteNome: resolvedAmbNome,
        size: 1,
        syncKey: aloc.syncGroupId,
      })
      toAllocate -= 1
    }
  }

  const totalUnitsLessons = pinnedAulas.length + units.reduce((acc, u) => acc + u.size, 0)

  // Função auxiliar de checagem de restrição forte (hard) para alocar uma unit em um slot
  const checkSlotValidity = (
    unit: SchedulingUnit,
    slot: CandidateSlot,
    placed: AulaAlocada[],
    allowSoftBreaks: boolean
  ): { valid: boolean; penalty: number } => {
    const turmaId = unit.turma.id
    let penalty = 0

    // 1. Turma ocupada em qualquer faixa do slot?
    for (const f of slot.faixas) {
      if (placed.some(a => a.turmaId === turmaId && a.dia === slot.dia && a.faixaId === f.id)) {
        return { valid: false, penalty: 999999 }
      }
    }

    // 2. Distribuição na turma+disciplina no dia
    const sameDiscDay = placed.filter(
      a => a.turmaId === turmaId && a.disciplinaId === unit.alocacao.disciplinaId && a.dia === slot.dia
    )
    const afterCount = sameDiscDay.length + unit.size

    if (unit.alocacao.distribuicao === 'separadas' && afterCount > 1) {
      if (!allowSoftBreaks) return { valid: false, penalty: 999999 }
      penalty += 5000
    }
    if (
      (unit.alocacao.distribuicao === 'max_2_dia' || projeto.parametros.eliminarAulasTriplas) &&
      afterCount > 2
    ) {
      if (!allowSoftBreaks) return { valid: false, penalty: 999999 }
      penalty += 4000
    }
    if (unit.alocacao.distribuicao === 'dias_alternados') {
      const adjDay = placed.some(
        a =>
          a.turmaId === turmaId &&
          a.disciplinaId === unit.alocacao.disciplinaId &&
          Math.abs(a.dia - slot.dia) === 1
      )
      if (adjDay) penalty += 300
    }

    // Evitar 2 aulas da mesma disciplina separadas no mesmo dia se poderiam ficar geminadas
    if (sameDiscDay.length > 0 && unit.size === 1) {
      const slotOrdem = slot.faixas[0].ordem
      const touchesExisting = sameDiscDay.some(a => Math.abs(a.ordem - slotOrdem) === 1)
      if (!touchesExisting) penalty += 180
      else if (unit.alocacao.distribuicao === 'geminadas') penalty -= 60
    }

    // 3. Ambiente
    if (unit.ambienteId) {
      const amb = ambMap.get(unit.ambienteId)
      if (amb) {
        for (const f of slot.faixas) {
          if (isAmbienteIndisponivel(amb, slot.dia, f.inicio, f.fim)) {
            if (!allowSoftBreaks) return { valid: false, penalty: 999999 }
            penalty += 8000
          }
          const fStart = parseTimeToMinutes(f.inicio)
          const fEnd = parseTimeToMinutes(f.fim)
          const concurrent = placed.filter(
            a => a.dia === slot.dia && a.ambienteId === amb.id && intervalsOverlap(fStart, fEnd, a.inicioMin, a.fimMin)
          ).length
          if (concurrent + 1 > Math.max(1, amb.capacidadeSimultanea || 1)) {
            if (!allowSoftBreaks) return { valid: false, penalty: 999999 }
            penalty += 9000
          }
        }
      }
    }

    // 4. Professores (todos os professores da aula, suportando Aula em Dupla!)
    for (const pId of unit.alocacao.professoresIds) {
      const prof = profMap.get(pId)
      if (prof && prof.sedesPermitidas.length > 0 && !prof.sedesPermitidas.includes(unit.turma.unidadeId)) {
        if (!allowSoftBreaks) return { valid: false, penalty: 999999 }
        penalty += 9000
      }

      for (const f of slot.faixas) {
        const disp = prof ? getProfessorDisponibilidadeNoHorario(prof, slot.dia, f.inicio, f.fim) : 'disponivel'
        if (disp === 'indisponivel') {
          if (!allowSoftBreaks) return { valid: false, penalty: 999999 }
          penalty += 8000
        } else if (disp === 'preferencial' && projeto.parametros.respeitarPreferenciasProfessor) {
          penalty -= Math.round(80 * (projeto.parametros.pesoPreferencias / 100))
        }
      }

      const profDayAulas = placed.filter(a => a.dia === slot.dia && a.professoresIds.includes(pId))

      // Limite diário
      if (prof && prof.maxAulasPorDia > 0 && profDayAulas.length + unit.size > prof.maxAulasPorDia) {
        if (!allowSoftBreaks) return { valid: false, penalty: 999999 }
        penalty += 4500
      }

      // Choque simultâneo + Deslocamento entre sedes
      for (const other of profDayAulas) {
        if (intervalsOverlap(slot.inicioMin, slot.fimMin, other.inicioMin, other.fimMin)) {
          if (!allowSoftBreaks) return { valid: false, penalty: 999999 }
          penalty += 15000
        } else if (other.unidadeId && unit.turma.unidadeId && other.unidadeId !== unit.turma.unidadeId) {
          const gap = other.inicioMin >= slot.fimMin ? other.inicioMin - slot.fimMin : slot.inicioMin - other.fimMin
          const needed = getTravelTimeMinutes(projeto, unit.turma.unidadeId, other.unidadeId, prof)
          if (gap < needed) {
            if (!allowSoftBreaks) return { valid: false, penalty: 999999 }
            penalty += 9000
          } else if (projeto.parametros.minimizarTrocaSede) {
            penalty += 220
          }
        }
      }

      // Heurística de janelas em tempo real: recompensar adjacência no mesmo turno, penalizar buraco
      if (projeto.parametros.eliminarJanelas && profDayAulas.length > 0) {
        const pesoJanela = (projeto.parametros.pesoJanelas || 80) / 100
        const sameShiftAulas = profDayAulas.filter(
          a => getTurnoFaixaMacro(a.inicioMin) === getTurnoFaixaMacro(slot.inicioMin)
        )
        if (sameShiftAulas.length > 0) {
          const isAdjacent = sameShiftAulas.some(
            a => Math.abs(a.fimMin - slot.inicioMin) <= 25 || Math.abs(slot.fimMin - a.inicioMin) <= 25
          )
          if (isAdjacent) {
            penalty -= Math.round(140 * pesoJanela)
          } else {
            penalty += Math.round(280 * pesoJanela)
          }
        }
      }

      // Concentrar dias do professor
      if (projeto.parametros.concentrarDiasProfessor) {
        const alreadyTeachesThisDay = profDayAulas.length > 0
        if (!alreadyTeachesThisDay) penalty += 70
      }
    }

    // Preferência cognitiva (disciplinas pesadas nos primeiros horários)
    if (projeto.parametros.preferirPesadasPrimeirosHorarios) {
      const disc = discMap.get(unit.alocacao.disciplinaId)
      if (disc?.pesoCognitivo === 'alto' && !slot.isPrimeirosHorarios) penalty += 45
      if (disc?.evitarUltimosHorarios && slot.faixas[0].ordem >= 5) penalty += 55
    }

    return { valid: true, penalty }
  }

  const createAulasFromUnitSlot = (unit: SchedulingUnit, slot: CandidateSlot): AulaAlocada[] => {
    const baseId = `AU-${unit.unitId}-${Date.now().toString(36).slice(-3)}-${Math.random().toString(36).slice(2, 5)}`
    return slot.faixas.map((f, idx) => ({
      id: `${baseId}-${idx}`,
      alocacaoId: unit.alocacao.id,
      turmaId: unit.turma.id,
      unidadeId: unit.turma.unidadeId,
      dia: slot.dia,
      faixaId: f.id,
      ordem: f.ordem,
      inicio: f.inicio,
      fim: f.fim,
      inicioMin: parseTimeToMinutes(f.inicio),
      fimMin: parseTimeToMinutes(f.fim),
      disciplinaId: unit.alocacao.disciplinaId,
      disciplinaNome: unit.disciplinaNome,
      disciplinaSigla: unit.disciplinaSigla,
      professoresIds: [...unit.alocacao.professoresIds],
      ambienteId: unit.ambienteId,
      ambienteNome: unit.ambienteNome,
      cor: unit.cor,
      fixa: false,
      geminadaComId: slot.faixas.length === 2 ? `${baseId}-${idx === 0 ? 1 : 0}` : undefined,
      syncGroupId: unit.syncKey,
    }))
  }

  // Ordenar unidades por dificuldade (MRV estático + Co-docência + Ambientes + Geminadas + Restrições)
  const computeDifficulty = (u: SchedulingUnit): number => {
    let score = 0
    if (u.syncKey) score += 2000
    if (u.alocacao.professoresIds.length > 1) score += 1200 // Aula em Dupla
    if (u.size === 2) score += 800 // Geminada
    if (u.ambienteId) {
      const amb = ambMap.get(u.ambienteId)
      if (amb && amb.tipo !== 'sala_comum') score += 600
    }
    if (u.alocacao.distribuicao === 'separadas') score += 350
    for (const pId of u.alocacao.professoresIds) {
      const prof = profMap.get(pId)
      if (!prof) continue
      const blockedCount = Object.values(prof.disponibilidade || {}).filter(v => v === 'indisponivel').length
      score += blockedCount * 12
    }
    return score
  }

  // Número de restarts conforme esforço
  const restarts =
    projeto.parametros.esforcoOtimizacao === 'rapido'
      ? 8
      : projeto.parametros.esforcoOtimizacao === 'profundo'
      ? 32
      : 18

  let bestSolution: AulaAlocada[] = [...pinnedAulas]
  let bestScore = -1
  let bestUnplacedUnits: SchedulingUnit[] = [...units]

  // ── FASE 1: Multi-Restart MRV + LCV Constructive Solver ──
  for (let r = 0; r < restarts; r++) {
    if (signal?.aborted) break

    const placed: AulaAlocada[] = [...pinnedAulas]
    const unplaced: SchedulingUnit[] = []

    // Embaralhar levemente empates entre restarts para explorar soluções diferentes
    const orderedUnits = [...units].sort((a, b) => {
      const diff = computeDifficulty(b) - computeDifficulty(a)
      if (Math.abs(diff) > 150) return diff
      return (Math.random() - 0.5) * 120
    })

    // Agrupar unidades sincronizadas por syncKey
    const handledUnitIds = new Set<string>()

    for (const unit of orderedUnits) {
      if (handledUnitIds.has(unit.unitId)) continue

      // Se fizer parte de um syncGroup, tenta alocar todas do mesmo grupo no mesmo dia/ordem
      if (unit.syncKey) {
        const groupUnits = orderedUnits.filter(u => u.syncKey === unit.syncKey && !handledUnitIds.has(u.unitId))
        const firstSlots = (unit.size === 2 ? slotsPorTurmaSize2 : slotsPorTurmaSize1).get(unit.turma.id) || []
        let bestSyncCombo: { assignments: Array<{ u: SchedulingUnit; s: CandidateSlot }>; totalPen: number } | null = null

        for (const baseSlot of firstSlots) {
          let totalPen = 0
          let comboValid = true
          const combo: Array<{ u: SchedulingUnit; s: CandidateSlot }> = []

          for (const gu of groupUnits) {
            const gPool = (gu.size === 2 ? slotsPorTurmaSize2 : slotsPorTurmaSize1).get(gu.turma.id) || []
            const matchSlot = gPool.find(
              gs => gs.dia === baseSlot.dia && intervalsOverlap(gs.inicioMin, gs.fimMin, baseSlot.inicioMin, baseSlot.fimMin)
            )
            if (!matchSlot) {
              comboValid = false
              break
            }
            const chk = checkSlotValidity(gu, matchSlot, placed, false)
            if (!chk.valid) {
              comboValid = false
              break
            }
            totalPen += chk.penalty
            combo.push({ u: gu, s: matchSlot })
          }

          if (comboValid) {
            const noisyPen = totalPen + Math.random() * 25
            if (!bestSyncCombo || noisyPen < bestSyncCombo.totalPen) {
              bestSyncCombo = { assignments: combo, totalPen: noisyPen }
            }
          }
        }

        if (bestSyncCombo) {
          for (const { u, s } of bestSyncCombo.assignments) {
            placed.push(...createAulasFromUnitSlot(u, s))
            handledUnitIds.add(u.unitId)
          }
          continue
        }
      }

      const pool = (unit.size === 2 ? slotsPorTurmaSize2 : slotsPorTurmaSize1).get(unit.turma.id) || []
      let chosenSlot: CandidateSlot | null = null
      let chosenPen = Infinity

      for (const s of pool) {
        const chk = checkSlotValidity(unit, s, placed, false)
        if (!chk.valid) continue
        const noise = r === 0 ? 0 : Math.random() * 35
        if (chk.penalty + noise < chosenPen) {
          chosenPen = chk.penalty + noise
          chosenSlot = s
        }
      }

      // Se size=2 não coube como geminada e NÃO é obrigatorio_geminada, tentar dividir em 2x size=1
      if (!chosenSlot && unit.size === 2 && unit.alocacao.distribuicao !== 'obrigatorio_geminada') {
        const s1Pool = slotsPorTurmaSize1.get(unit.turma.id) || []
        const singleUnit: SchedulingUnit = { ...unit, size: 1 }
        let countPlaced = 0
        for (let k = 0; k < 2; k++) {
          let bestS: CandidateSlot | null = null
          let bestP = Infinity
          for (const s of s1Pool) {
            const chk = checkSlotValidity(singleUnit, s, placed, false)
            if (!chk.valid) continue
            const noise = Math.random() * 25
            if (chk.penalty + noise < bestP) {
              bestP = chk.penalty + noise
              bestS = s
            }
          }
          if (bestS) {
            placed.push(...createAulasFromUnitSlot(singleUnit, bestS))
            countPlaced++
          }
        }
        if (countPlaced < 2) {
          for (let m = countPlaced; m < 2; m++) unplaced.push({ ...singleUnit, unitId: `${unit.unitId}-s${m}` })
        }
        handledUnitIds.add(unit.unitId)
        continue
      }

      if (chosenSlot) {
        placed.push(...createAulasFromUnitSlot(unit, chosenSlot))
      } else {
        unplaced.push(unit)
      }
      handledUnitIds.add(unit.unitId)
    }

    // Reparo por Ejeção/Deslocamento (1-step Swap Insertion): tenta encaixar aulas restantes movendo uma aula já alocada na mesma turma para um espaço livre
    if (unplaced.length > 0) {
      const stillUnplaced: SchedulingUnit[] = []
      for (const unit of unplaced) {
        if (unit.size !== 1) {
          stillUnplaced.push(unit)
          continue
        }
        const turmaSlots = slotsPorTurmaSize1.get(unit.turma.id) || []
        let inserted = false

        for (const s of turmaSlots) {
          const occupantIdx = placed.findIndex(
            a => a.turmaId === unit.turma.id && a.dia === s.dia && a.faixaId === s.faixas[0].id
          )
          if (occupantIdx === -1) continue
          const occupant = placed[occupantIdx]
          if (occupant.fixa || occupant.geminadaComId || occupant.syncGroupId) continue

          // Verificar se 'unit' seria válido no slot 's' sem o ocupante
          const placedWithoutOcc = placed.filter((_, idx) => idx !== occupantIdx)
          const chkUnit = checkSlotValidity(unit, s, placedWithoutOcc, false)
          if (!chkUnit.valid) continue

          // Procurar um slot livre 's2' para o ocupante
          const occAloc = projeto.alocacoes.find(al => al.id === occupant.alocacaoId)
          if (!occAloc) continue
          const occUnit: SchedulingUnit = {
            unitId: `REJ-${occupant.id}`,
            alocacao: occAloc,
            turma: unit.turma,
            disciplinaNome: occupant.disciplinaNome,
            disciplinaSigla: occupant.disciplinaSigla,
            cor: occupant.cor,
            ambienteId: occupant.ambienteId,
            ambienteNome: occupant.ambienteNome,
            size: 1,
          }

          const freeTarget = turmaSlots.find(s2 => {
            if (s2.dia === s.dia && s2.faixas[0].id === s.faixas[0].id) return false
            return checkSlotValidity(occUnit, s2, placedWithoutOcc, false).valid
          })

          if (freeTarget) {
            placed.splice(occupantIdx, 1)
            placed.push(...createAulasFromUnitSlot(unit, s))
            placed.push({
              ...occupant,
              dia: freeTarget.dia,
              faixaId: freeTarget.faixas[0].id,
              ordem: freeTarget.faixas[0].ordem,
              inicio: freeTarget.faixas[0].inicio,
              fim: freeTarget.faixas[0].fim,
              inicioMin: freeTarget.inicioMin,
              fimMin: freeTarget.fimMin,
            })
            inserted = true
            break
          }
        }

        if (!inserted) stillUnplaced.push(unit)
      }
      unplaced.length = 0
      unplaced.push(...stillUnplaced)
    }

    // Se modo flexível ativado e sobraram aulas, tenta alocar com marcação de menor conflito (WebHorário style)
    const remainingAfterFlexible: SchedulingUnit[] = []
    if (projeto.parametros.modoFlexivelComMarcacao && unplaced.length > 0) {
      for (const unit of unplaced) {
        const pool = (unit.size === 2 ? slotsPorTurmaSize2 : slotsPorTurmaSize1).get(unit.turma.id) || []
        let bestS: CandidateSlot | null = null
        let bestP = Infinity
        for (const s of pool) {
          const chk = checkSlotValidity(unit, s, placed, true)
          if (!chk.valid) continue
          if (chk.penalty < bestP) {
            bestP = chk.penalty
            bestS = s
          }
        }
        if (bestS) {
          placed.push(...createAulasFromUnitSlot(unit, bestS))
        } else {
          remainingAfterFlexible.push(unit)
        }
      }
    } else {
      remainingAfterFlexible.push(...unplaced)
    }

    const { metricas } = avaliarGradeCompleta(projeto, placed)
    const compositeScore =
      metricas.totalAulasAlocadas * 1000 +
      metricas.scoreGeral * 10 -
      remainingAfterFlexible.length * 2000

    if (compositeScore > bestScore) {
      bestScore = compositeScore
      bestSolution = placed
      bestUnplacedUnits = remainingAfterFlexible
    }

    if (r % 2 === 0) {
      const evalBest = avaliarGradeCompleta(projeto, bestSolution).metricas
      onProgress?.({
        fase: 'construtivo',
        progressoPct: Math.min(55, 10 + Math.round(((r + 1) / restarts) * 45)),
        mensagem: `Explorando arranjo ${r + 1}/${restarts} — ${evalBest.totalAulasAlocadas}/${totalUnitsLessons} aulas encaixadas...`,
        melhorScore: evalBest.scoreGeral,
        aulasAlocadas: evalBest.totalAulasAlocadas,
        totalAulas: totalUnitsLessons,
        janelas: evalBest.totalJanelasProfessores,
        choques: evalBest.choquesProfessor,
      })
      await yieldToMain()
    }
  }

  // ── FASE 2: Otimização Local (Eliminação de Janelas, Trocas de Turma e Preferências) ──
  const saIterations =
    projeto.parametros.esforcoOtimizacao === 'rapido'
      ? 250
      : projeto.parametros.esforcoOtimizacao === 'profundo'
      ? 1200
      : 600

  let current = [...bestSolution]
  let currentEval = avaliarGradeCompleta(projeto, current)
  let bestOptAulas = currentEval.aulasComConflitos
  let bestOptMetricas = currentEval.metricas

  // Helper rápido de custo para busca local
  const computeLocalObjective = (m: MetricasHorario) =>
    m.scoreGeral * 100 -
    m.choquesProfessor * 5000 -
    m.violacoesDisponibilidade * 2500 -
    m.violacoesDeslocamento * 2500 -
    m.violacoesAmbiente * 2500 -
    m.totalJanelasProfessores * (projeto.parametros.eliminarJanelas ? 180 : 20) -
    m.aulasTriplas * (projeto.parametros.eliminarAulasTriplas ? 150 : 15) +
    m.preferenciasAtendidasPct * 2

  let currentObj = computeLocalObjective(currentEval.metricas)
  let bestObj = currentObj

  const nonPinnedIndices = (): number[] => {
    const res: number[] = []
    for (let i = 0; i < current.length; i++) {
      if (!current[i].fixa && !current[i].geminadaComId && !current[i].syncGroupId) res.push(i)
    }
    return res
  }

  for (let iter = 0; iter < saIterations; iter++) {
    if (signal?.aborted) break

    const movable = nonPinnedIndices()
    if (movable.length < 2) break

    // Selecionar aula A (priorizando aulas que causam janela ou conflito em 50% das iterações!)
    let idxA = movable[Math.floor(Math.random() * movable.length)]
    if (Math.random() < 0.55) {
      const problematic = movable.filter(i => (current[i].conflitos?.length || 0) > 0)
      if (problematic.length > 0) {
        idxA = problematic[Math.floor(Math.random() * problematic.length)]
      }
    }

    const aulaA = current[idxA]
    const turmaSlots = slotsPorTurmaSize1.get(aulaA.turmaId) || []
    if (turmaSlots.length === 0) continue

    const targetSlot = turmaSlots[Math.floor(Math.random() * turmaSlots.length)]
    const targetFaixa = targetSlot.faixas[0]
    if (aulaA.dia === targetSlot.dia && aulaA.faixaId === targetFaixa.id) continue

    const idxB = current.findIndex(
      a => a.turmaId === aulaA.turmaId && a.dia === targetSlot.dia && a.faixaId === targetFaixa.id
    )

    if (idxB !== -1 && (current[idxB].fixa || current[idxB].geminadaComId || current[idxB].syncGroupId)) {
      continue
    }

    // Avaliar se a movimentação ou troca é segura (não piora choques fortes)
    const aval = avaliarSlotParaAula(projeto, current, aulaA, targetSlot.dia, targetFaixa)
    if (aval.status === 'conflito' && !projeto.parametros.modoFlexivelComMarcacao) continue

    const candidate = [...current]
    candidate[idxA] = {
      ...aulaA,
      dia: targetSlot.dia,
      faixaId: targetFaixa.id,
      ordem: targetFaixa.ordem,
      inicio: targetFaixa.inicio,
      fim: targetFaixa.fim,
      inicioMin: parseTimeToMinutes(targetFaixa.inicio),
      fimMin: parseTimeToMinutes(targetFaixa.fim),
    }
    if (idxB !== -1) {
      const aulaB = current[idxB]
      candidate[idxB] = {
        ...aulaB,
        dia: aulaA.dia,
        faixaId: aulaA.faixaId,
        ordem: aulaA.ordem,
        inicio: aulaA.inicio,
        fim: aulaA.fim,
        inicioMin: aulaA.inicioMin,
        fimMin: aulaA.fimMin,
      }
    }

    const nextEval = avaliarGradeCompleta(projeto, candidate)
    const nextObj = computeLocalObjective(nextEval.metricas)

    // Simulated Annealing acceptance
    const temp = Math.max(1, 120 * (1 - iter / saIterations))
    const delta = nextObj - currentObj
    if (delta >= 0 || Math.exp(delta / temp) > Math.random()) {
      current = nextEval.aulasComConflitos
      currentObj = nextObj
      if (nextObj > bestObj) {
        bestObj = nextObj
        bestOptAulas = nextEval.aulasComConflitos
        bestOptMetricas = nextEval.metricas
      }
    }

    if (iter % 60 === 0) {
      onProgress?.({
        fase: 'otimizacao',
        progressoPct: Math.min(96, 55 + Math.round(((iter + 1) / saIterations) * 41)),
        mensagem: `Eliminando janelas e otimizando preferências (${iter + 1}/${saIterations})...`,
        melhorScore: bestOptMetricas.scoreGeral,
        aulasAlocadas: bestOptMetricas.totalAulasAlocadas,
        totalAulas: totalUnitsLessons,
        janelas: bestOptMetricas.totalJanelasProfessores,
        choques: bestOptMetricas.choquesProfessor,
      })
      await yieldToMain()
    }
  }

  // Consolidar aulas não alocadas
  const naoAlocadasMap = new Map<
    string,
    { alocacaoId: string; turmaId: string; disciplinaNome: string; quantidadeFaltante: number; motivo: string }
  >()
  for (const u of bestUnplacedUnits) {
    const existing = naoAlocadasMap.get(u.alocacao.id)
    if (existing) {
      existing.quantidadeFaltante += u.size
    } else {
      naoAlocadasMap.set(u.alocacao.id, {
        alocacaoId: u.alocacao.id,
        turmaId: u.turma.id,
        disciplinaNome: u.disciplinaNome,
        quantidadeFaltante: u.size,
        motivo:
          u.alocacao.professoresIds.length === 0
            ? 'Sem professor atribuído'
            : 'Sem combinação livre sem choque de professor, disponibilidade ou ambiente',
      })
    }
  }

  onProgress?.({
    fase: 'finalizando',
    progressoPct: 100,
    mensagem: 'Grade concluída com sucesso!',
    melhorScore: bestOptMetricas.scoreGeral,
    aulasAlocadas: bestOptMetricas.totalAulasAlocadas,
    totalAulas: totalUnitsLessons,
    janelas: bestOptMetricas.totalJanelasProfessores,
    choques: bestOptMetricas.choquesProfessor,
  })

  return {
    aulas: bestOptAulas,
    naoAlocadas: Array.from(naoAlocadasMap.values()),
    metricas: bestOptMetricas,
  }
}

// ─── Relatório de Carga Horária (Professores & Turmas — WebHorário style) ───

export interface CargaProfessorRow {
  professorId: string
  nome: string
  cor: string
  aulasPrevistas: number
  aulasAlocadas: number
  diasTrabalhados: number
  janelasSemana: number
  trocasSede: number
  turmasDetalhes: Array<{ turmaNome: string; disciplinaNome: string; aulas: number }>
}

export interface CargaTurmaRow {
  turmaId: string
  turmaNome: string
  sedeNome: string
  turno: string
  aulasPrevistas: number
  aulasAlocadas: number
  capacidadeGrade: number
  disciplinas: Array<{
    disciplinaNome: string
    professoresNomes: string
    previstas: number
    alocadas: number
  }>
}

export function gerarRelatorioCargaHoraria(
  projeto: HorarioProjeto,
  aulas: AulaAlocada[]
): {
  porProfessor: CargaProfessorRow[]
  porTurma: CargaTurmaRow[]
} {
  const profMap = new Map(projeto.professores.map(p => [p.id, p]))
  const discMap = new Map(projeto.disciplinas.map(d => [d.id, d]))
  const sedeMap = new Map(projeto.sedes.map(s => [s.id, s]))
  const modeloMap = new Map(projeto.modelosHorario.map(m => [m.id, m]))
  const turmasAtivas = projeto.turmas.filter(t => t.ativa)
  const turmaMap = new Map(turmasAtivas.map(t => [t.id, t]))

  const porProfessor: CargaProfessorRow[] = projeto.professores
    .map(prof => {
      const alocs = projeto.alocacoes.filter(a => a.aulasSemana > 0 && turmaMap.has(a.turmaId) && a.professoresIds.includes(prof.id))
      const aulasPrevistas = alocs.reduce((acc, a) => acc + a.aulasSemana, 0)
      const aulasProf = aulas.filter(a => a.professoresIds.includes(prof.id))
      const diasSet = new Set(aulasProf.map(a => a.dia))

      // Janelas e trocas de sede
      let janelasSemana = 0
      let trocasSede = 0
      for (const dia of diasSet) {
        const dayList = aulasProf.filter(a => a.dia === dia).sort((a, b) => a.inicioMin - b.inicioMin)
        for (let i = 1; i < dayList.length; i++) {
          const prev = dayList[i - 1]
          const cur = dayList[i]
          if (prev.unidadeId !== cur.unidadeId) trocasSede++
          const sameShift = getTurnoFaixaMacro(prev.fimMin) === getTurnoFaixaMacro(cur.inicioMin)
          const gap = cur.inicioMin - prev.fimMin
          if (sameShift && gap > 25) {
            janelasSemana += Math.max(1, Math.round((gap - 15) / 50))
          }
        }
      }

      const detalhesMap = new Map<string, { turmaNome: string; disciplinaNome: string; aulas: number }>()
      for (const a of aulasProf) {
        const tNome = turmaMap.get(a.turmaId)?.nome || a.turmaId
        const k = `${a.turmaId}__${a.disciplinaId}`
        const cur = detalhesMap.get(k) || { turmaNome: tNome, disciplinaNome: a.disciplinaNome, aulas: 0 }
        cur.aulas++
        detalhesMap.set(k, cur)
      }

      return {
        professorId: prof.id,
        nome: prof.nome,
        cor: prof.cor,
        aulasPrevistas,
        aulasAlocadas: aulasProf.length,
        diasTrabalhados: diasSet.size,
        janelasSemana,
        trocasSede,
        turmasDetalhes: Array.from(detalhesMap.values()),
      }
    })
    .filter(r => r.aulasPrevistas > 0 || r.aulasAlocadas > 0)
    .sort((a, b) => b.aulasAlocadas - a.aulasAlocadas)

  const porTurma: CargaTurmaRow[] = turmasAtivas.map(turma => {
    const mod = modeloMap.get(turma.modeloHorarioId)
    const capacidadeGrade = mod ? mod.diasAtivos.length * mod.faixas.filter(f => f.tipo === 'aula').length : 0
    const alocs = projeto.alocacoes.filter(a => a.turmaId === turma.id && a.aulasSemana > 0)
    const aulasTurma = aulas.filter(a => a.turmaId === turma.id)

    const disciplinas = alocs.map(al => {
      const d = discMap.get(al.disciplinaId)
      const profs = al.professoresIds.map(id => profMap.get(id)?.nome || 'Professor').join(' + ')
      const alocadas = aulasTurma.filter(a => a.alocacaoId === al.id).length
      return {
        disciplinaNome: d?.nome || 'Disciplina',
        professoresNomes: profs || 'Sem professor',
        previstas: al.aulasSemana,
        alocadas,
      }
    })

    return {
      turmaId: turma.id,
      turmaNome: turma.nome,
      sedeNome: sedeMap.get(turma.unidadeId)?.nome || 'Sede Principal',
      turno: turma.turno,
      aulasPrevistas: alocs.reduce((acc, a) => acc + a.aulasSemana, 0),
      aulasAlocadas: aulasTurma.length,
      capacidadeGrade,
      disciplinas,
    }
  })

  return { porProfessor, porTurma }
}
