export type DiaSemanaId = 1 | 2 | 3 | 4 | 5 | 6

export const DIAS_SEMANA_LABELS: Record<DiaSemanaId, { curto: string; completo: string }> = {
  1: { curto: 'SEG', completo: 'Segunda-feira' },
  2: { curto: 'TER', completo: 'Terça-feira' },
  3: { curto: 'QUA', completo: 'Quarta-feira' },
  4: { curto: 'QUI', completo: 'Quinta-feira' },
  5: { curto: 'SEX', completo: 'Sexta-feira' },
  6: { curto: 'SÁB', completo: 'Sábado' },
}

export interface CampusSede {
  id: string
  nome: string
  codigo?: string
  cor: string
  endereco?: string
}

export interface FaixaHorario {
  id: string
  ordem: number // 1ª, 2ª, 3ª...
  inicio: string // "07:00"
  fim: string // "07:50"
  tipo: 'aula' | 'intervalo'
  label?: string // "1ª Aula" ou "Recreio"
}

export interface ModeloHorario {
  id: string
  nome: string // ex: "Ensino Médio Manhã (07:00 - 12:20)"
  turno: string // "Matutino" | "Vespertino" | "Noturno" | "Integral"
  diasAtivos: DiaSemanaId[] // [1,2,3,4,5]
  faixas: FaixaHorario[]
}

export type TipoAmbiente =
  | 'sala_comum'
  | 'quadra'
  | 'laboratorio'
  | 'informatica'
  | 'auditorio'
  | 'artes'
  | 'outro'

export interface AmbienteRecurso {
  id: string
  nome: string // ex: "Quadra Poliesportiva", "Lab. Química"
  tipo: TipoAmbiente
  unidadeId: string
  capacidadeSimultanea: number // ex: 1 turma (Lab) ou 2 turmas (Quadra dividida)
  indisponivel?: Record<string, boolean> // key: `${dia}_${inicio}_${fim}` ou `${dia}_${faixaIdx}`
}

export type StatusDisponibilidade = 'disponivel' | 'preferencial' | 'indisponivel'

export interface ProfessorHorarioConfig {
  id: string
  nome: string
  apelido?: string
  cor: string
  email?: string
  telefone?: string
  sedePrincipalId?: string
  sedesPermitidas: string[] // vazio = todas
  maxAulasPorDia: number
  maxAulasSemana: number
  maxJanelasDia: number
  maxDiasSemana: number
  tempoDeslocamentoMin: number // tempo mínimo para trocar de sede no mesmo dia
  evitarTrocaSedeMesmoTurno: boolean
  /** Mapa de disponibilidade por dia e faixa de horário do turno ou horário real: key `${dia}_${hhmm}` */
  disponibilidade: Record<string, StatusDisponibilidade>
  observacoes?: string
}

export interface DisciplinaHorarioConfig {
  id: string
  nome: string
  sigla: string
  cor: string
  ambientePadraoId?: string // ex: Ed. Física -> Quadra
  pesoCognitivo?: 'alto' | 'medio' | 'baixo' // para preferir primeiros horários
  evitarUltimosHorarios?: boolean
}

export interface TurmaHorarioConfig {
  id: string
  nome: string
  serie?: string
  segmento?: string
  turno: string
  unidadeId: string
  modeloHorarioId: string
  salaBaseId?: string
  cor?: string
  ativa: boolean
}

export type TipoDistribuicao =
  | 'livre'
  | 'geminadas'
  | 'obrigatorio_geminada'
  | 'separadas' // máx 1 aula por dia
  | 'max_2_dia' // máx 2 aulas por dia (elimina triplas)
  | 'dias_alternados'

export interface AlocacaoCurricular {
  id: string
  turmaId: string
  disciplinaId: string
  professoresIds: string[] // 1 professor ou 2+ professores (Aula em Dupla / Co-docência)
  aulasSemana: number
  distribuicao: TipoDistribuicao
  ambienteId?: string // sobrescreve o padrão da disciplina se definido
  syncGroupId?: string // aulas sincronizadas entre turmas (divisão de classes / eletivas)
  cor?: string
}

export interface AulaConflito {
  tipo:
    | 'choque_professor'
    | 'indisponibilidade_professor'
    | 'deslocamento_sede'
    | 'capacidade_ambiente'
    | 'limite_diario_professor'
    | 'distribuicao_disciplina'
    | 'sincronismo'
  severidade: 'erro' | 'aviso'
  mensagem: string
}

export interface AulaAlocada {
  id: string
  alocacaoId: string
  turmaId: string
  unidadeId: string
  dia: DiaSemanaId
  faixaId: string
  ordem: number
  inicio: string
  fim: string
  inicioMin: number
  fimMin: number
  disciplinaId: string
  disciplinaNome: string
  disciplinaSigla: string
  professoresIds: string[]
  ambienteId?: string
  ambienteNome?: string
  cor: string
  fixa?: boolean // travada manualmente (pin)
  geminadaComId?: string
  syncGroupId?: string
  conflitos?: AulaConflito[]
}

export interface ParametrosOtimizador {
  eliminarJanelas: boolean
  pesoJanelas: number // 0..100
  eliminarAulasTriplas: boolean
  priorizarGeminadas: boolean
  permitirGeminadaAposIntervalo: boolean
  respeitarPreferenciasProfessor: boolean
  pesoPreferencias: number // 0..100
  minimizarTrocaSede: boolean
  tempoDeslocamentoPadraoMin: number
  concentrarDiasProfessor: boolean
  preferirPesadasPrimeirosHorarios: boolean
  modoFlexivelComMarcacao: boolean // Se impossível zerar restrições, aloca marcando conflitos coloridos (estilo WebHorário)
  esforcoOtimizacao: 'rapido' | 'equilibrado' | 'profundo'
}

export interface MetricasHorario {
  totalAulasPrevistas: number
  totalAulasAlocadas: number
  aulasNaoAlocadas: number
  choquesProfessor: number
  violacoesDisponibilidade: number
  violacoesDeslocamento: number
  violacoesAmbiente: number
  violacoesDistribuicao: number
  totalJanelasProfessores: number
  professoresComJanela: number
  trocasSedeNoDia: number
  aulasTriplas: number
  geminadasAtendidas: number
  geminadasPrevistas: number
  preferenciasAtendidasPct: number
  scoreGeral: number // 0..100
}

export interface DiagnosticoItem {
  id: string
  escopo: 'turno' | 'turma' | 'professor' | 'ambiente' | 'curriculo'
  titulo: string
  nivel: 'viavel' | 'atencao' | 'inviavel'
  resumo: string
  detalhe: string
  sugestao?: string
  taxaOcupacaoPct?: number
}

export interface DiagnosticoGeral {
  status: 'viavel' | 'atencao' | 'inviavel'
  scoreViabilidade: number
  itens: DiagnosticoItem[]
  porTurno: Array<{
    turno: string
    nivel: 'viavel' | 'atencao' | 'inviavel'
    demanda: number
    capacidade: number
    mensagem: string
  }>
}

export interface CenarioHorario {
  id: string
  nome: string
  criadoEm: string
  atualizadoEm: string
  aulas: AulaAlocada[]
  naoAlocadas: Array<{
    alocacaoId: string
    turmaId: string
    disciplinaNome: string
    quantidadeFaltante: number
    motivo: string
  }>
  metricas: MetricasHorario
  publicado?: boolean
  publicadoEm?: string
}

export interface HorarioProjeto {
  id: string
  nome: string
  anoLetivo: string
  atualizadoEm: string
  publicadoCenarioId?: string
  publicadoEm?: string
  sedes: CampusSede[]
  matrizDeslocamento: Record<string, number> // key `${sedeA}__${sedeB}` -> minutos
  modelosHorario: ModeloHorario[]
  ambientes: AmbienteRecurso[]
  professores: ProfessorHorarioConfig[]
  disciplinas: DisciplinaHorarioConfig[]
  turmas: TurmaHorarioConfig[]
  alocacoes: AlocacaoCurricular[]
  parametros: ParametrosOtimizador
  cenarios: CenarioHorario[]
  cenarioAtivoId: string | null
}
