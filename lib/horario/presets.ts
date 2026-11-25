import {
  AlocacaoCurricular,
  AmbienteRecurso,
  CampusSede,
  DisciplinaHorarioConfig,
  HorarioProjeto,
  ModeloHorario,
  ParametrosOtimizador,
  ProfessorHorarioConfig,
  TurmaHorarioConfig,
} from './types'

const PALETTE = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899',
  '#06b6d4', '#ef4444', '#6366f1', '#14b8a6', '#f97316',
  '#84cc16', '#a855f7', '#0ea5e9', '#e11d48',
]

export function pickColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items || []) {
    if (!item || !item.id) continue
    const id = String(item.id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ ...item, id })
  }
  return out
}

export function sanitizeProjeto(projeto: HorarioProjeto): HorarioProjeto {
  return {
    ...projeto,
    sedes: dedupeById(projeto.sedes || []),
    modelosHorario: dedupeById(projeto.modelosHorario || []),
    ambientes: dedupeById(projeto.ambientes || []),
    professores: dedupeById(projeto.professores || []),
    disciplinas: dedupeById(projeto.disciplinas || []),
    turmas: dedupeById(projeto.turmas || []),
    alocacoes: dedupeById(projeto.alocacoes || []),
    cenarios: dedupeById(projeto.cenarios || []),
  }
}

export const DEFAULT_PARAMETROS: ParametrosOtimizador = {
  eliminarJanelas: true,
  pesoJanelas: 90,
  eliminarAulasTriplas: true,
  priorizarGeminadas: true,
  permitirGeminadaAposIntervalo: false,
  respeitarPreferenciasProfessor: true,
  pesoPreferencias: 70,
  minimizarTrocaSede: true,
  tempoDeslocamentoPadraoMin: 30,
  concentrarDiasProfessor: false,
  preferirPesadasPrimeirosHorarios: true,
  modoFlexivelComMarcacao: false,
  esforcoOtimizacao: 'equilibrado',
}

export const DEFAULT_MODELOS_HORARIO: ModeloHorario[] = [
  {
    id: 'MOD-MAT-5',
    nome: 'Matutino Padrão (07:00 – 11:30)',
    turno: 'Matutino',
    diasAtivos: [1, 2, 3, 4, 5],
    faixas: [
      { id: 'f1', ordem: 1, inicio: '07:00', fim: '07:50', tipo: 'aula', label: '1ª Aula' },
      { id: 'f2', ordem: 2, inicio: '07:50', fim: '08:40', tipo: 'aula', label: '2ª Aula' },
      { id: 'f3', ordem: 3, inicio: '08:40', fim: '09:30', tipo: 'aula', label: '3ª Aula' },
      { id: 'f-int', ordem: 99, inicio: '09:30', fim: '09:50', tipo: 'intervalo', label: 'Intervalo' },
      { id: 'f4', ordem: 4, inicio: '09:50', fim: '10:40', tipo: 'aula', label: '4ª Aula' },
      { id: 'f5', ordem: 5, inicio: '10:40', fim: '11:30', tipo: 'aula', label: '5ª Aula' },
    ],
  },
  {
    id: 'MOD-MAT-6',
    nome: 'Ensino Médio / 6 Aulas (07:00 – 12:20)',
    turno: 'Matutino',
    diasAtivos: [1, 2, 3, 4, 5],
    faixas: [
      { id: 'm1', ordem: 1, inicio: '07:00', fim: '07:50', tipo: 'aula', label: '1ª Aula' },
      { id: 'm2', ordem: 2, inicio: '07:50', fim: '08:40', tipo: 'aula', label: '2ª Aula' },
      { id: 'm3', ordem: 3, inicio: '08:40', fim: '09:30', tipo: 'aula', label: '3ª Aula' },
      { id: 'm-int', ordem: 99, inicio: '09:30', fim: '09:50', tipo: 'intervalo', label: 'Intervalo' },
      { id: 'm4', ordem: 4, inicio: '09:50', fim: '10:40', tipo: 'aula', label: '4ª Aula' },
      { id: 'm5', ordem: 5, inicio: '10:40', fim: '11:30', tipo: 'aula', label: '5ª Aula' },
      { id: 'm6', ordem: 6, inicio: '11:30', fim: '12:20', tipo: 'aula', label: '6ª Aula' },
    ],
  },
  {
    id: 'MOD-VESP-5',
    nome: 'Vespertino Padrão (13:00 – 17:30)',
    turno: 'Vespertino',
    diasAtivos: [1, 2, 3, 4, 5],
    faixas: [
      { id: 'v1', ordem: 1, inicio: '13:00', fim: '13:50', tipo: 'aula', label: '1ª Aula' },
      { id: 'v2', ordem: 2, inicio: '13:50', fim: '14:40', tipo: 'aula', label: '2ª Aula' },
      { id: 'v3', ordem: 3, inicio: '14:40', fim: '15:30', tipo: 'aula', label: '3ª Aula' },
      { id: 'v-int', ordem: 99, inicio: '15:30', fim: '15:50', tipo: 'intervalo', label: 'Intervalo' },
      { id: 'v4', ordem: 4, inicio: '15:50', fim: '16:40', tipo: 'aula', label: '4ª Aula' },
      { id: 'v5', ordem: 5, inicio: '16:40', fim: '17:30', tipo: 'aula', label: '5ª Aula' },
    ],
  },
]

/**
 * Constrói um projeto inicial sincronizado com os dados reais do banco do EDU-IMPACTO
 */
export function buildProjetoFromSchoolData(params: {
  anoLetivo: string
  mantenedores: any[]
  turmasRaw: any[]
  funcionariosRaw: any[]
  disciplinasRaw: any[]
}): HorarioProjeto {
  const { anoLetivo, mantenedores, turmasRaw, funcionariosRaw, disciplinasRaw } = params

  // 1. Sedes a partir dos mantenedores -> unidades
  const sedes: CampusSede[] = []
  for (const m of mantenedores || []) {
    for (const u of m?.unidades || []) {
      sedes.push({
        id: String(u.id || u.codigo || u.nomeFantasia),
        nome: u.nomeFantasia || u.razaoSocial || 'Unidade Escolar',
        codigo: u.codigo || '',
        cor: pickColor(u.nomeFantasia || u.id || 'sede'),
        endereco: [u.endereco, u.bairro, u.cidade].filter(Boolean).join(', '),
      })
    }
  }
  if (sedes.length === 0) {
    sedes.push({ id: 'SEDE-1', nome: 'Sede Principal', codigo: '01', cor: '#3b82f6' })
  }

  // 2. Ambientes básicos
  const ambientes: AmbienteRecurso[] = [
    { id: 'AMB-QUADRA-1', nome: 'Quadra Poliesportiva', tipo: 'quadra', unidadeId: sedes[0].id, capacidadeSimultanea: 1 },
    { id: 'AMB-LAB-1', nome: 'Laboratório de Ciências', tipo: 'laboratorio', unidadeId: sedes[0].id, capacidadeSimultanea: 1 },
    { id: 'AMB-INFO-1', nome: 'Sala de Informática', tipo: 'informatica', unidadeId: sedes[0].id, capacidadeSimultanea: 1 },
  ]

  // 3. Disciplinas
  const disciplinas: DisciplinaHorarioConfig[] = (disciplinasRaw || [])
    .filter((d: any) => d && d.nome && d.situacao !== 'inativa')
    .map((d: any) => {
      const nomeLower = String(d.nome).toLowerCase()
      const isQuadra = nomeLower.includes('física') || nomeLower.includes('fisica') || nomeLower.includes('esport')
      const isPesada =
        nomeLower.includes('matem') ||
        nomeLower.includes('portugu') ||
        nomeLower.includes('física') ||
        nomeLower.includes('química')
      return {
        id: String(d.id || d.codigo || d.nome),
        nome: d.nome,
        sigla: (d.nome as string)
          .replace(/língua\s+/i, '')
          .replace(/educação\s+/i, 'Ed. ')
          .slice(0, 4)
          .toUpperCase(),
        cor: pickColor(d.nome),
        ambientePadraoId: isQuadra ? 'AMB-QUADRA-1' : undefined,
        pesoCognitivo: isPesada ? 'alto' : 'medio',
        evitarUltimosHorarios: isPesada,
      }
    })

  // 4. Professores (prioriza cargos docentes; se nenhum cargo explícito, inclui ativos para fácil seleção)
  const activeFuncs = (funcionariosRaw || []).filter(
    (f: any) => f && f.nome && String(f.status || 'ativo').toLowerCase() !== 'inativo'
  )
  const onlyTeachers = activeFuncs.filter((f: any) => {
    const c = `${f.cargo || ''} ${f.departamento || ''} ${f.perfilSistema || ''}`.toLowerCase()
    return c.includes('prof') || c.includes('docen') || c.includes('educad') || c.includes('instrut')
  })
  const profSource = onlyTeachers.length > 0 ? onlyTeachers : activeFuncs.slice(0, 25)

  const professores: ProfessorHorarioConfig[] = profSource.map((f: any) => ({
    id: String(f.id),
    nome: f.nome,
    apelido: String(f.nome).split(' ').slice(0, 2).join(' '),
    cor: pickColor(f.nome),
    email: f.email || '',
    telefone: f.celular || f.telefone || '',
    sedePrincipalId: sedes[0].id,
    sedesPermitidas: [],
    maxAulasPorDia: 6,
    maxAulasSemana: 30,
    maxJanelasDia: 1,
    maxDiasSemana: 5,
    tempoDeslocamentoMin: 30,
    evitarTrocaSedeMesmoTurno: true,
    disponibilidade: {},
  }))

  // 5. Turmas do ano letivo
  const turmasDoAno = (turmasRaw || []).filter(t => {
    if (!t || !t.id) return false
    const tAno = String(t.ano || t.anoLetivo || '')
    return !anoLetivo || !tAno || tAno === String(anoLetivo)
  })

  const turmas: TurmaHorarioConfig[] = turmasDoAno.map((t: any) => {
    const turnoStr = String(t.turno || 'Matutino')
    const isVesp = turnoStr.toLowerCase().includes('vesp') || turnoStr.toLowerCase().includes('tarde')
    const seg = String(t.segmento || t.dados?.segmento || '').toLowerCase()
    const isEM = seg.includes('em') || seg.includes('médio') || seg.includes('medio')
    const modeloHorarioId = isVesp ? 'MOD-VESP-5' : isEM ? 'MOD-MAT-6' : 'MOD-MAT-5'

    const matchedSede =
      sedes.find(s => s.id === t.unidade || s.nome.toLowerCase() === String(t.unidade || '').toLowerCase()) || sedes[0]

    return {
      id: String(t.id),
      nome: t.nome,
      serie: t.serie || '',
      segmento: t.segmento || t.dados?.segmento || '',
      turno: turnoStr,
      unidadeId: matchedSede.id,
      modeloHorarioId,
      cor: pickColor(t.nome),
      ativa: true,
    }
  })

  return sanitizeProjeto({
    id: `PROJ-${anoLetivo || new Date().getFullYear()}`,
    nome: `Grade Oficial ${anoLetivo || new Date().getFullYear()}`,
    anoLetivo: String(anoLetivo || new Date().getFullYear()),
    atualizadoEm: new Date().toISOString(),
    sedes,
    matrizDeslocamento: {},
    modelosHorario: JSON.parse(JSON.stringify(DEFAULT_MODELOS_HORARIO)),
    ambientes,
    professores,
    disciplinas,
    turmas,
    alocacoes: [],
    parametros: { ...DEFAULT_PARAMETROS },
    cenarios: [],
    cenarioAtivoId: null,
  })
}

/**
 * Gera um cenário de demonstração completo e realista (Multi-Sede, Aula em Dupla, Quadra, Restrições, Horários diferentes)
 * para o gestor testar e validar o motor matemático instantaneamente.
 */
export function buildDemoProjeto(anoLetivo = '2026'): HorarioProjeto {
  const sedes: CampusSede[] = [
    { id: 'SEDE-CENTRO', nome: 'Unidade Centro', codigo: '01', cor: '#3b82f6', endereco: 'Av. Principal, 100' },
    { id: 'SEDE-NORTE', nome: 'Unidade Zona Norte', codigo: '02', cor: '#8b5cf6', endereco: 'Rua das Flores, 450' },
  ]

  const modelosHorario: ModeloHorario[] = [
    ...JSON.parse(JSON.stringify(DEFAULT_MODELOS_HORARIO)),
    {
      id: 'MOD-MAT-CEDO',
      nome: 'Fund. I Entrada Especial (07:30 – 12:00)',
      turno: 'Matutino',
      diasAtivos: [1, 2, 3, 4, 5],
      faixas: [
        { id: 'c1', ordem: 1, inicio: '07:30', fim: '08:20', tipo: 'aula', label: '1ª Aula' },
        { id: 'c2', ordem: 2, inicio: '08:20', fim: '09:10', tipo: 'aula', label: '2ª Aula' },
        { id: 'c-int', ordem: 99, inicio: '09:10', fim: '09:30', tipo: 'intervalo', label: 'Recreio' },
        { id: 'c3', ordem: 3, inicio: '09:30', fim: '10:20', tipo: 'aula', label: '3ª Aula' },
        { id: 'c4', ordem: 4, inicio: '10:20', fim: '11:10', tipo: 'aula', label: '4ª Aula' },
        { id: 'c5', ordem: 5, inicio: '11:10', fim: '12:00', tipo: 'aula', label: '5ª Aula' },
      ],
    },
  ]

  const ambientes: AmbienteRecurso[] = [
    { id: 'AMB-QUADRA-C', nome: 'Quadra Poliesportiva (Centro)', tipo: 'quadra', unidadeId: 'SEDE-CENTRO', capacidadeSimultanea: 1 },
    { id: 'AMB-LAB-C', nome: 'Laboratório de Ciências', tipo: 'laboratorio', unidadeId: 'SEDE-CENTRO', capacidadeSimultanea: 1 },
    { id: 'AMB-QUADRA-N', nome: 'Quadra Coberta (Zona Norte)', tipo: 'quadra', unidadeId: 'SEDE-NORTE', capacidadeSimultanea: 2 },
  ]

  const disciplinas: DisciplinaHorarioConfig[] = [
    { id: 'D-MAT', nome: 'Matemática', sigla: 'MAT', cor: '#3b82f6', pesoCognitivo: 'alto', evitarUltimosHorarios: true },
    { id: 'D-POR', nome: 'Língua Portuguesa', sigla: 'POR', cor: '#f59e0b', pesoCognitivo: 'alto', evitarUltimosHorarios: true },
    { id: 'D-HIS', nome: 'História', sigla: 'HIS', cor: '#ec4899', pesoCognitivo: 'medio' },
    { id: 'D-GEO', nome: 'Geografia', sigla: 'GEO', cor: '#10b981', pesoCognitivo: 'medio' },
    { id: 'D-CIE', nome: 'Ciências / Lab', sigla: 'CIE', cor: '#06b6d4', ambientePadraoId: 'AMB-LAB-C', pesoCognitivo: 'medio' },
    { id: 'D-ING', nome: 'Língua Inglesa', sigla: 'ING', cor: '#6366f1', pesoCognitivo: 'medio' },
    { id: 'D-EDF', nome: 'Educação Física', sigla: 'EDF', cor: '#8b5cf6', ambientePadraoId: 'AMB-QUADRA-C', pesoCognitivo: 'baixo' },
    { id: 'D-ART', nome: 'Artes & Projeto', sigla: 'ART', cor: '#f97316', pesoCognitivo: 'baixo' },
  ]

  const professores: ProfessorHorarioConfig[] = [
    {
      id: 'PR-ANA', nome: 'Ana Silva', apelido: 'Ana', cor: '#3b82f6',
      sedePrincipalId: 'SEDE-CENTRO', sedesPermitidas: [], maxAulasPorDia: 5, maxAulasSemana: 24,
      maxJanelasDia: 0, maxDiasSemana: 5, tempoDeslocamentoMin: 30, evitarTrocaSedeMesmoTurno: true,
      disponibilidade: { '1_07:00-07:50': 'indisponivel', '5_11:30-12:20': 'indisponivel', '2_07:00-07:50': 'preferencial' },
    },
    {
      id: 'PR-BRUNO', nome: 'Bruno Mendes', apelido: 'Bruno', cor: '#f59e0b',
      sedePrincipalId: 'SEDE-CENTRO', sedesPermitidas: [], maxAulasPorDia: 5, maxAulasSemana: 24,
      maxJanelasDia: 1, maxDiasSemana: 5, tempoDeslocamentoMin: 30, evitarTrocaSedeMesmoTurno: true,
      disponibilidade: { '3_10:40-11:30': 'indisponivel', '4_10:40-11:30': 'indisponivel' },
    },
    {
      id: 'PR-CARLOS', nome: 'Carlos Ferreira', apelido: 'Carlos', cor: '#ec4899',
      sedePrincipalId: 'SEDE-CENTRO', sedesPermitidas: [], maxAulasPorDia: 5, maxAulasSemana: 20,
      maxJanelasDia: 1, maxDiasSemana: 5, tempoDeslocamentoMin: 30, evitarTrocaSedeMesmoTurno: true,
      disponibilidade: { '1_09:50-10:40': 'preferencial', '2_09:50-10:40': 'preferencial' },
    },
    {
      id: 'PR-DANIELA', nome: 'Daniela Costa', apelido: 'Daniela', cor: '#10b981',
      sedePrincipalId: 'SEDE-CENTRO', sedesPermitidas: [], maxAulasPorDia: 5, maxAulasSemana: 22,
      maxJanelasDia: 1, maxDiasSemana: 5, tempoDeslocamentoMin: 30, evitarTrocaSedeMesmoTurno: true,
      disponibilidade: {},
    },
    {
      id: 'PR-EDUARDO', nome: 'Eduardo Rocha', apelido: 'Eduardo', cor: '#06b6d4',
      sedePrincipalId: 'SEDE-CENTRO', sedesPermitidas: [], maxAulasPorDia: 5, maxAulasSemana: 20,
      maxJanelasDia: 1, maxDiasSemana: 5, tempoDeslocamentoMin: 30, evitarTrocaSedeMesmoTurno: true,
      disponibilidade: { '5_07:00-07:50': 'indisponivel' },
    },
    {
      id: 'PR-FERNANDA', nome: 'Fernanda Lima', apelido: 'Fernanda', cor: '#6366f1',
      sedePrincipalId: 'SEDE-CENTRO', sedesPermitidas: [], maxAulasPorDia: 5, maxAulasSemana: 20,
      maxJanelasDia: 1, maxDiasSemana: 5, tempoDeslocamentoMin: 30, evitarTrocaSedeMesmoTurno: true,
      disponibilidade: {},
    },
    {
      id: 'PR-GABRIEL', nome: 'Gabriel Souza', apelido: 'Gabriel', cor: '#8b5cf6',
      sedePrincipalId: 'SEDE-CENTRO', sedesPermitidas: [], maxAulasPorDia: 4, maxAulasSemana: 16,
      maxJanelasDia: 1, maxDiasSemana: 5, tempoDeslocamentoMin: 35, evitarTrocaSedeMesmoTurno: true,
      disponibilidade: { '4_07:00-07:50': 'indisponivel' },
    },
    {
      id: 'PR-HELENA', nome: 'Helena Martins', apelido: 'Helena', cor: '#14b8a6',
      sedePrincipalId: 'SEDE-NORTE', sedesPermitidas: ['SEDE-NORTE'], maxAulasPorDia: 5, maxAulasSemana: 20,
      maxJanelasDia: 1, maxDiasSemana: 5, tempoDeslocamentoMin: 30, evitarTrocaSedeMesmoTurno: true,
      disponibilidade: {},
    },
  ]

  const turmas: TurmaHorarioConfig[] = [
    { id: 'T-6A', nome: '6º Ano A', serie: '6º Ano', segmento: 'EF2', turno: 'Matutino', unidadeId: 'SEDE-CENTRO', modeloHorarioId: 'MOD-MAT-5', ativa: true, cor: '#3b82f6' },
    { id: 'T-6B', nome: '6º Ano B', serie: '6º Ano', segmento: 'EF2', turno: 'Matutino', unidadeId: 'SEDE-CENTRO', modeloHorarioId: 'MOD-MAT-5', ativa: true, cor: '#8b5cf6' },
    { id: 'T-7A', nome: '7º Ano A', serie: '7º Ano', segmento: 'EF2', turno: 'Matutino', unidadeId: 'SEDE-CENTRO', modeloHorarioId: 'MOD-MAT-5', ativa: true, cor: '#10b981' },
    { id: 'T-5A', nome: '5º Ano A (Norte)', serie: '5º Ano', segmento: 'EF1', turno: 'Matutino', unidadeId: 'SEDE-NORTE', modeloHorarioId: 'MOD-MAT-CEDO', ativa: true, cor: '#f59e0b' },
  ]

  const alocacoes: AlocacaoCurricular[] = [
    // 6º A (25 aulas)
    { id: 'AL-1', turmaId: 'T-6A', disciplinaId: 'D-MAT', professoresIds: ['PR-ANA'], aulasSemana: 5, distribuicao: 'max_2_dia' },
    { id: 'AL-2', turmaId: 'T-6A', disciplinaId: 'D-POR', professoresIds: ['PR-BRUNO'], aulasSemana: 5, distribuicao: 'max_2_dia' },
    { id: 'AL-3', turmaId: 'T-6A', disciplinaId: 'D-HIS', professoresIds: ['PR-CARLOS'], aulasSemana: 3, distribuicao: 'separadas' },
    { id: 'AL-4', turmaId: 'T-6A', disciplinaId: 'D-GEO', professoresIds: ['PR-DANIELA'], aulasSemana: 3, distribuicao: 'separadas' },
    { id: 'AL-5', turmaId: 'T-6A', disciplinaId: 'D-CIE', professoresIds: ['PR-EDUARDO'], aulasSemana: 4, distribuicao: 'geminadas', ambienteId: 'AMB-LAB-C' },
    { id: 'AL-6', turmaId: 'T-6A', disciplinaId: 'D-ING', professoresIds: ['PR-FERNANDA', 'PR-ANA'], aulasSemana: 2, distribuicao: 'separadas' }, // AULA EM DUPLA!
    { id: 'AL-7', turmaId: 'T-6A', disciplinaId: 'D-EDF', professoresIds: ['PR-GABRIEL'], aulasSemana: 2, distribuicao: 'geminadas', ambienteId: 'AMB-QUADRA-C' },
    { id: 'AL-8', turmaId: 'T-6A', disciplinaId: 'D-ART', professoresIds: ['PR-CARLOS'], aulasSemana: 1, distribuicao: 'separadas' },

    // 6º B (25 aulas)
    { id: 'AL-9', turmaId: 'T-6B', disciplinaId: 'D-MAT', professoresIds: ['PR-ANA'], aulasSemana: 5, distribuicao: 'max_2_dia' },
    { id: 'AL-10', turmaId: 'T-6B', disciplinaId: 'D-POR', professoresIds: ['PR-BRUNO'], aulasSemana: 5, distribuicao: 'max_2_dia' },
    { id: 'AL-11', turmaId: 'T-6B', disciplinaId: 'D-HIS', professoresIds: ['PR-CARLOS'], aulasSemana: 3, distribuicao: 'separadas' },
    { id: 'AL-12', turmaId: 'T-6B', disciplinaId: 'D-GEO', professoresIds: ['PR-DANIELA'], aulasSemana: 3, distribuicao: 'separadas' },
    { id: 'AL-13', turmaId: 'T-6B', disciplinaId: 'D-CIE', professoresIds: ['PR-EDUARDO'], aulasSemana: 4, distribuicao: 'geminadas', ambienteId: 'AMB-LAB-C' },
    { id: 'AL-14', turmaId: 'T-6B', disciplinaId: 'D-ING', professoresIds: ['PR-FERNANDA'], aulasSemana: 2, distribuicao: 'separadas' },
    { id: 'AL-15', turmaId: 'T-6B', disciplinaId: 'D-EDF', professoresIds: ['PR-GABRIEL'], aulasSemana: 2, distribuicao: 'geminadas', ambienteId: 'AMB-QUADRA-C' },
    { id: 'AL-16', turmaId: 'T-6B', disciplinaId: 'D-ART', professoresIds: ['PR-DANIELA'], aulasSemana: 1, distribuicao: 'separadas' },

    // 7º A (25 aulas)
    { id: 'AL-17', turmaId: 'T-7A', disciplinaId: 'D-MAT', professoresIds: ['PR-ANA'], aulasSemana: 5, distribuicao: 'max_2_dia' },
    { id: 'AL-18', turmaId: 'T-7A', disciplinaId: 'D-POR', professoresIds: ['PR-BRUNO'], aulasSemana: 5, distribuicao: 'max_2_dia' },
    { id: 'AL-19', turmaId: 'T-7A', disciplinaId: 'D-HIS', professoresIds: ['PR-CARLOS'], aulasSemana: 3, distribuicao: 'separadas' },
    { id: 'AL-20', turmaId: 'T-7A', disciplinaId: 'D-GEO', professoresIds: ['PR-DANIELA'], aulasSemana: 3, distribuicao: 'separadas' },
    { id: 'AL-21', turmaId: 'T-7A', disciplinaId: 'D-CIE', professoresIds: ['PR-EDUARDO'], aulasSemana: 4, distribuicao: 'geminadas', ambienteId: 'AMB-LAB-C' },
    { id: 'AL-22', turmaId: 'T-7A', disciplinaId: 'D-ING', professoresIds: ['PR-FERNANDA'], aulasSemana: 2, distribuicao: 'separadas' },
    { id: 'AL-23', turmaId: 'T-7A', disciplinaId: 'D-EDF', professoresIds: ['PR-GABRIEL'], aulasSemana: 2, distribuicao: 'geminadas', ambienteId: 'AMB-QUADRA-C' },
    { id: 'AL-24', turmaId: 'T-7A', disciplinaId: 'D-ART', professoresIds: ['PR-FERNANDA'], aulasSemana: 1, distribuicao: 'separadas' },

    // 5º A (Sede Norte - Horário 07:30-12:00! Com deslocamento 35m entre sedes para Prof. Gabriel & Fernanda)
    { id: 'AL-25', turmaId: 'T-5A', disciplinaId: 'D-MAT', professoresIds: ['PR-HELENA'], aulasSemana: 5, distribuicao: 'max_2_dia' },
    { id: 'AL-26', turmaId: 'T-5A', disciplinaId: 'D-POR', professoresIds: ['PR-HELENA'], aulasSemana: 5, distribuicao: 'max_2_dia' },
    { id: 'AL-27', turmaId: 'T-5A', disciplinaId: 'D-HIS', professoresIds: ['PR-CARLOS'], aulasSemana: 3, distribuicao: 'separadas' },
    { id: 'AL-28', turmaId: 'T-5A', disciplinaId: 'D-GEO', professoresIds: ['PR-DANIELA'], aulasSemana: 3, distribuicao: 'separadas' },
    { id: 'AL-29', turmaId: 'T-5A', disciplinaId: 'D-CIE', professoresIds: ['PR-HELENA'], aulasSemana: 3, distribuicao: 'separadas' },
    { id: 'AL-30', turmaId: 'T-5A', disciplinaId: 'D-ING', professoresIds: ['PR-FERNANDA'], aulasSemana: 2, distribuicao: 'separadas' },
    { id: 'AL-31', turmaId: 'T-5A', disciplinaId: 'D-EDF', professoresIds: ['PR-GABRIEL'], aulasSemana: 2, distribuicao: 'geminadas', ambienteId: 'AMB-QUADRA-N' },
    { id: 'AL-32', turmaId: 'T-5A', disciplinaId: 'D-ART', professoresIds: ['PR-FERNANDA'], aulasSemana: 2, distribuicao: 'separadas' },
  ]

  return sanitizeProjeto({
    id: `PROJ-DEMO-${anoLetivo}`,
    nome: `Demonstração Multi-Sede (${anoLetivo})`,
    anoLetivo,
    atualizadoEm: new Date().toISOString(),
    sedes,
    matrizDeslocamento: { 'SEDE-CENTRO__SEDE-NORTE': 35 },
    modelosHorario,
    ambientes,
    professores,
    disciplinas,
    turmas,
    alocacoes,
    parametros: { ...DEFAULT_PARAMETROS },
    cenarios: [],
    cenarioAtivoId: null,
  })
}

const DEMO_SEDE_IDS = new Set(['SEDE-CENTRO', 'SEDE-NORTE'])
const DEMO_MODELO_IDS = new Set(['MOD-MAT-CEDO'])
const DEMO_AMB_IDS = new Set(['AMB-QUADRA-C', 'AMB-LAB-C', 'AMB-QUADRA-N'])
const DEMO_DISC_IDS = new Set(['D-MAT', 'D-POR', 'D-HIS', 'D-GEO', 'D-CIE', 'D-ING', 'D-EDF', 'D-ART'])
const DEMO_PROF_IDS = new Set(['PR-ANA', 'PR-BRUNO', 'PR-CARLOS', 'PR-DANIELA', 'PR-EDUARDO', 'PR-FERNANDA', 'PR-GABRIEL', 'PR-HELENA'])
const DEMO_TURMA_IDS = new Set(['T-6A', 'T-6B', 'T-7A', 'T-5A'])

export function hasDemoDataInProjeto(projeto: HorarioProjeto | null | undefined): boolean {
  if (!projeto) return false
  if (String(projeto.id || '').startsWith('PROJ-DEMO-')) return true
  return (
    projeto.sedes.some(s => DEMO_SEDE_IDS.has(s.id)) ||
    projeto.turmas.some(t => DEMO_TURMA_IDS.has(t.id)) ||
    projeto.professores.some(p => DEMO_PROF_IDS.has(p.id)) ||
    projeto.disciplinas.some(d => DEMO_DISC_IDS.has(d.id))
  )
}

export function stripDemoDataFromProjeto(projeto: HorarioProjeto): HorarioProjeto {
  const nextMatriz: Record<string, number> = {}
  for (const [k, v] of Object.entries(projeto.matrizDeslocamento || {})) {
    const [a, b] = k.split('__')
    if (!DEMO_SEDE_IDS.has(a) && !DEMO_SEDE_IDS.has(b)) {
      nextMatriz[k] = v
    }
  }

  return sanitizeProjeto({
    ...projeto,
    id: String(projeto.id || '').startsWith('PROJ-DEMO-') ? `PROJ-${projeto.anoLetivo}` : projeto.id,
    nome: String(projeto.id || '').startsWith('PROJ-DEMO-') ? `Grade Oficial ${projeto.anoLetivo}` : projeto.nome,
    sedes: projeto.sedes.filter(s => !DEMO_SEDE_IDS.has(s.id)),
    matrizDeslocamento: nextMatriz,
    modelosHorario: projeto.modelosHorario.filter(m => !DEMO_MODELO_IDS.has(m.id)),
    ambientes: projeto.ambientes.filter(a => !DEMO_AMB_IDS.has(a.id)),
    professores: projeto.professores.filter(p => !DEMO_PROF_IDS.has(p.id)),
    disciplinas: projeto.disciplinas.filter(d => !DEMO_DISC_IDS.has(d.id)),
    turmas: projeto.turmas.filter(t => !DEMO_TURMA_IDS.has(t.id)),
    alocacoes: projeto.alocacoes.filter(
      al => !DEMO_TURMA_IDS.has(al.turmaId) && !DEMO_DISC_IDS.has(al.disciplinaId)
    ),
    cenarios: String(projeto.id || '').startsWith('PROJ-DEMO-') ? [] : projeto.cenarios,
    cenarioAtivoId: String(projeto.id || '').startsWith('PROJ-DEMO-') ? null : projeto.cenarioAtivoId,
  })
}
