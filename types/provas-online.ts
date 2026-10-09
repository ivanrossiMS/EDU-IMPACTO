export type FinalidadeProva = 'avaliacao' | 'simulado' | 'diagnostica' | 'recuperacao'

export type StatusProva = 
  | 'rascunho'
  | 'agendada'
  | 'em_aplicacao'
  | 'encerrada'
  | 'em_correcao'
  | 'publicada'
  | 'cancelada'

export type TipoQuestao = 
  | 'multipla_escolha'
  | 'multipla_selecao'
  | 'verdadeiro_falso'
  | 'dissertativa'

export type DificuldadeQuestao = 'facil' | 'media' | 'dificil'

export type PoliticaTentativas = 'maior_nota' | 'ultima_nota' | 'media'

export type PoliticaCalculoParcial = 'proporcional' | 'acertos_menos_erros' | 'estrita'

export type PoliticaDivulgacao = 'apos_encerramento' | 'imediato' | 'manual'

export type StatusTentativa = 
  | 'em_andamento'
  | 'entregue'
  | 'expirada'
  | 'suspensa'
  | 'cancelada'

export type StatusCorrecao = 'pendente' | 'parcial' | 'corrigida'

export interface AlternativaQuestao {
  id: string
  letra: string
  texto: string
  correta: boolean
  ordem: number
}

export interface ItemVerdadeiroFalso {
  id: string
  afirmacao: string
  correta: boolean // true = V, false = F
  ordem: number
}

export interface CriterioAvaliacao {
  id: string
  descricao: string
  pontosMaximos: number
  pesoPontos?: number
}

export interface ConfigPontuacaoParcial {
  permiteParcial: boolean
  tipoCalculo: PoliticaCalculoParcial
  explicacaoCalculo?: string
}

export interface QuestaoProva {
  id: string
  provaId?: string
  bancoQuestaoId?: string
  ordem: number
  tipo: TipoQuestao
  enunciado: string
  pontuacao: number
  valorPontos?: number
  alternativas?: AlternativaQuestao[]
  itensVF?: ItemVerdadeiroFalso[]
  itensVouF?: ItemVerdadeiroFalso[]
  permitePontuacaoParcial?: boolean
  configPontuacaoParcial?: ConfigPontuacaoParcial
  respostaEsperada?: string // Visível apenas para corretores
  criteriosAvaliacao?: CriterioAvaliacao[] // Rubrica de correção para dissertativas
  limitePalavras?: number
  permiteAnexoResolucao?: boolean
  explicacaoResposta?: string // Resolução comentada para o aluno
  anulada?: boolean
  motivoAnulacao?: string
  politicaAnulacao?: 'pontos_para_todos' | 'redistribuir_demais'
  tags?: string[]
  habilidadeBNCC?: string
  dificuldade?: DificuldadeQuestao
  createdAt?: string
}

export interface ItemBancoQuestoes {
  id: string
  disciplina: string
  serie: string
  assunto: string
  conteudo?: string
  habilidadeBNCC?: string
  nivelDificuldade?: DificuldadeQuestao
  dificuldade?: DificuldadeQuestao | string
  tipo: TipoQuestao
  enunciado: string
  pontuacaoSugerida?: number
  valorSugerido?: number
  alternativas?: AlternativaQuestao[]
  itensVF?: ItemVerdadeiroFalso[]
  itensVouF?: ItemVerdadeiroFalso[]
  configPontuacaoParcial?: ConfigPontuacaoParcial
  respostaEsperada?: string
  criteriosAvaliacao?: CriterioAvaliacao[]
  limitePalavras?: number
  permiteAnexoResolucao?: boolean
  explicacaoResposta?: string
  tags?: string[]
  criadoPor?: string
  ativo: boolean
  createdAt: string
  updatedAt?: string
}

export interface ConfigLayoutProva {
  questaoPorPagina: boolean // true = 1 questão por página, false = todas
  navegacaoLivre: boolean // true = pode navegar livremente, false = sequencial
  permitirVoltar: boolean // true = pode retornar a questão anterior
  embaralharQuestoes: boolean
  embaralharAlternativas: boolean
}

export interface ConfigMonitoramentoProva {
  solicitarTelaCheia: boolean
  registrarSaidaTela: boolean
  bloquearColar: boolean
  bloquearPrint?: boolean
  acaoOcorrencia: 'registrar' | 'alertar' | 'suspender' | 'cancelar' | 'advertir_cancelar'
}

export interface ConfigDivulgacaoProva {
  liberarGabarito: PoliticaDivulgacao
  liberarNota: 'apos_correcao' | 'manual'
  liberarComentarios: boolean
  dataDivulgacaoManual?: string
}

export interface IntegracaoNotasProva {
  lancado: boolean
  lancamentoId?: string
  turmaId?: string
  disciplina?: string
  bimestre?: number
  avaliacaoNome?: string
  peso?: number
  escala?: number // Ex: 10
  dataLancamento?: string
  usuarioNome?: string
}

export interface ComprovanteEntrega {
  hash: string
  provaId: string
  alunoId: string
  alunoNome: string
  matricula?: string
  dataHoraEntrega: string
  totalQuestoes: number
  totalRespostasRegistradas: number
  protocolo?: string
}

export interface ProvaOnline {
  id: string
  titulo: string
  descricao?: string
  disciplina: string
  disciplinaNome?: string
  turmas: string[] // IDs ou Nomes das turmas
  series: string[] // Séries atendidas
  anoLetivo: number | string
  bimestre: number
  finalidade: FinalidadeProva
  professorId: string
  professorNome: string
  instrucoes?: string
  materiaisPermitidos?: string
  status: StatusProva
  
  // Aprovação pela coordenação
  aprovacaoRequerida: boolean
  statusAprovacao?: 'pendente' | 'aprovada' | 'rejeitada'
  aprovadoPor?: string
  dataAprovacao?: string
  motivoRejeicao?: string

  // Pontuação e regras
  valorTotal: number
  quantidadeTentativas: number
  politicaTentativas: PoliticaTentativas
  
  // Datas e Duração
  dataAbertura: string // ISO string
  dataHoraInicio?: string
  dataLimiteInicio?: string // ISO string
  dataEncerramento: string // ISO string
  dataHoraFim?: string
  duracaoMinutos: number
  codigoLiberacao?: string // PIN opcional para aplicação presencial
  exigeCodigoAcesso?: boolean
  exigirTelaCheia?: boolean
  bloquearColar?: boolean
  bloquearPrint?: boolean
  bloquearRetorno?: boolean

  // Configurações
  configuracaoLayout: ConfigLayoutProva
  configuracaoMonitoramento: ConfigMonitoramentoProva
  configuracaoDivulgacao: ConfigDivulgacaoProva
  
  // Público Alvo
  alunosModo?: 'todos' | 'especificos'
  alunosEspecificos?: string[] // IDs dos alunos, se restrito
  
  // Questões da prova
  questoes?: QuestaoProva[]

  // Integração com Notas
  integracaoNotas?: IntegracaoNotasProva

  publicadoEm?: string
  createdAt: string
  updatedAt: string
}

export interface RespostaQuestaoTentativa {
  questaoId: string
  tipo?: TipoQuestao
  respostaOpcaoId?: string // Multipla escolha única
  alternativaIdSelecionada?: string
  respostaOpcoesIds?: string[] // Multipla seleção
  alternativasIdsSelecionadas?: string[]
  respostaVF?: Record<string, boolean> // Verdadeiro / Falso (itemId -> bool)
  itensVouF?: { id: string; respostaAluno: boolean }[]
  respostaDissertativa?: string
  textoDissertativo?: string
  anexoUrl?: string
  marcadaParaRevisao?: boolean
  versao: number
  salvoEm: string
  respondidaEm?: string
  
  // Correção
  corrigida?: boolean
  pontuacaoObtida?: number
  pontosAtribuidos?: number
  nota?: number
  comentarioProfessor?: string
  comentarioCorrecao?: string
  correcaoCriterios?: Record<string, number>
  criteriosPontos?: Record<string, number>
  corrigidoPor?: string
  corrigidoEm?: string
  corrigidaEm?: string
  respostaTexto?: string
  [key: string]: any
}

export interface TentativaAluno {
  id: string
  provaId: string
  alunoId: string
  alunoNome: string
  alunoMatricula?: string
  alunoFoto?: string | null
  turmaId: string
  turmaNome?: string
  numeroTentativa: number
  sessionToken: string
  status: StatusTentativa
  
  // Horários e Prazos calculados pelo servidor
  iniciadaEm: string
  prazoLimite: string // Math.min(iniciadaEm + duracao, dataEncerramento) + tempoAdicional
  tempoAdicionalMinutos: number
  motivoTempoAdicional?: string
  autorizadoPor?: string
  entregueEm?: string
  ultimaAtividade: string
  
  // Sorteio/Ordem fixada para esta tentativa
  ordemQuestoes: {
    questaoId: string
    alternativasOrdem?: string[]
  }[]
  ordemQuestoesSorteada?: string[]

  // Respostas salvas
  respostas: Record<string, RespostaQuestaoTentativa>
  questoesRevisao?: string[]
  versaoRespostas: number

  // Notas e Resultados
  pontuacaoObjetiva: number
  pontuacaoDissertativa: number
  notaFinal: number
  statusCorrecao: StatusCorrecao
  comprovanteCodigo: string // Hash/código digital de verificação
  comprovanteEntrega?: ComprovanteEntrega

  // Ocorrências e Suspensão
  motivoSuspensao?: string
  motivoCancelamento?: string

  // Estado de conexão inferido
  statusConexao?: 'online' | 'instavel' | 'offline'

  createdAt: string
  updatedAt: string
}

export interface OcorrenciaMonitoramento {
  id: string
  tentativaId: string
  alunoId: string
  alunoNome: string
  tipo: 
    | 'saida_tela'
    | 'saida_tela_cheia'
    | 'perda_foco'
    | 'tentativa_colar'
    | 'captura_tela'
    | 'desconexao'
    | 'reconexao'
    | 'suspensao'
    | 'retomada'
    | 'encerramento_antecipado'
  descricao: string
  duracaoSegundos?: number
  detalhes?: Record<string, any>
  createdAt: string
}

export interface MensagemProva {
  id: string
  provaId: string
  tentativaId?: string | null // null = broadcast geral para todos
  alunoId?: string | null
  alunoNome?: string | null
  remetenteId: string
  remetenteNome: string
  remetenteCargo: string
  mensagem: string
  tipo: 'geral' | 'individual' | 'alerta'
  lida?: boolean
  createdAt: string
}

export interface ExcecaoAutorizada {
  id: string
  provaId: string
  alunoId: string
  alunoNome?: string
  tipoExcecao: 'tempo_adicional' | 'desbloqueio' | 'reabertura' | 'segunda_chamada' | 'encerramento_antecipado'
  minutosAdicionais?: number
  justificativa: string
  autorizadoPor: string
  dados?: Record<string, any>
  createdAt: string
}
