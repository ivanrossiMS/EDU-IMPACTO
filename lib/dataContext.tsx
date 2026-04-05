'use client'

import { createContext, useContext, useCallback, useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'

// ─── Data version — bump to force-clear all stored data ───────────
const DATA_VERSION = '12'

// ─── Types ────────────────────────────────────────────────────────
export interface Aluno {
  id: string; nome: string; matricula: string; turma: string; serie: string
  turno: string; status: string; email: string; cpf: string; dataNascimento: string
  responsavel: string; telefone: string; inadimplente: boolean
  risco_evasao: 'baixo' | 'medio' | 'alto'; media: number | null
  frequencia: number; obs: string; unidade: string; foto: string | null
  // Responsáveis separados (Financial vs Pedagógico)
  responsavelFinanceiro?: string
  emailResponsavelFinanceiro?: string
  telResponsavelFinanceiro?: string
  responsavelPedagogico?: string
  emailResponsavelPedagogico?: string
  telResponsavelPedagogico?: string
  emailResponsavel?: string
  telResponsavel?: string
  senhaApp?: string
}

export interface Turma {
  id: string; codigo: string; nome: string; serie: string; turno: string; professor: string
  sala: string; capacidade: number; matriculados: number; unidade: string; ano: number
  padraoPagamentoIds?: string[]
}

export interface Funcionario {
  id: string; nome: string; cargo: string; departamento: string; salario: number
  status: string; email: string; admissao: string; unidade: string
}

export interface Lead {
  id: string; nome: string; interesse: string; origem: string
  status: 'novo' | 'contato' | 'visita' | 'proposta' | 'matriculado' | 'perdido'
  responsavel: string; data: string; telefone: string; email: string
  score_ia: number; valor_potencial: number; notas: string
}

export interface Titulo {
  id: string; aluno: string; responsavel: string; descricao: string
  valor: number; vencimento: string; pagamento: string | null
  status: 'pago' | 'pendente' | 'atrasado'; metodo: string | null; parcela: string
  eventoId?: string
  eventoDescricao?: string
  // ── Campos bancários (preenchidos pela API /api/boletos/emitir) ──
  nossoNumero?: string
  nossoNumeroDV?: number
  nossoNumeroFormatado?: string
  codigoBarras44?: string
  linhaDigitavel?: string
  linhaDigitavelFormatada?: string
  fatorVencimento?: string
  numeroDocumento?: string
  dataDocumento?: string
  dataVencimento?: string
  // Pagador/Sacado
  pagadorNome?: string
  pagadorCpfCnpj?: string
  pagadorLogradouro?: string
  pagadorNumero?: string
  pagadorComplemento?: string
  pagadorBairro?: string
  pagadorCidade?: string
  pagadorUF?: string
  pagadorCEP?: string
  // Encargos
  desconto?: number
  abatimento?: number
  percJuros?: number
  percMulta?: number
  dataLimiteDesconto?: string
  especie?: string
  aceite?: string
  instrucao1?: string
  instrucao2?: string
  tipoProtesto?: string
  diasProtesto?: number
  // Status bancário estendido
  statusBancario?: 'rascunho' | 'emitido' | 'enviado_remessa' | 'registrado' | 'liquidado' | 'baixado' | 'vencido' | 'rejeitado'
  convenioId?: string
  remessaArquivo?: string
  retornoOcorrencia?: string
  retornoDescricao?: string
  htmlBoleto?: string
  eventos?: Array<{ id: string; data: string; tipo: string; descricao: string; payload?: string }>
}


export interface ContaPagar {
  id: string; descricao: string; categoria: string; valor: number
  vencimento: string; status: 'pago' | 'pendente'; fornecedor: string
  numeroDocumento?: string
  planoContasId?: string
  codigo?: string // Adicionado para consistência visual nas contas a pagar
}

export interface Mensagem {
  id: string; de: string; para: string; assunto: string; texto: string
  data: string; lida: boolean; tipo: 'direto' | 'comunicado' | 'mural'
}

export interface Comunicado {
  id: string; titulo: string; texto: string; autor: string
  data: string; destino: string; fixado: boolean
}

export interface Tarefa {
  id: string; titulo: string; descricao: string; responsavel: string
  prazo: string; status: 'pendente' | 'em-andamento' | 'concluida'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
}

export interface Agendamento {
  id: string; lead: string; tipo: string; data: string; hora: string
  responsavel: string; status: 'agendado' | 'realizado' | 'cancelado'; notas: string
}

export interface Responsavel {
  nome: string; cpf: string; autorizacao: string; assinatura: string | null
}

export interface Unidade {
  id: string; mantenedorId: string
  codigo: string
  razaoSocial: string; nomeFantasia: string; cnpj: string; inep: string
  codigoMec: string; idCenso: string
  endereco: string; numero: string; complemento: string; bairro: string
  cidade: string; estado: string; cep: string
  telefone: string; email: string
  alunosAtivos: number; capacidade: number
  diretor: Responsavel
  secretario: Responsavel
  cabecalhoDocumentos: string
  cabecalhoLogo?: string
}

export interface Mantenedor {
  id: string; nome: string; razaoSocial: string; cnpj: string
  endereco: string; numero: string; bairro: string
  cidade: string; estado: string; cep: string
  telefone: string; email: string; responsavel: string
  cargo: string; website: string
  logo: string | null
  unidades: Unidade[]
}

// ─── AGENDA ESCOLAR ───────────────────────────────────────────────
export type TipoEvento = 'aula' | 'evento' | 'prova' | 'reuniao' | 'feriado' | 'excursao' | 'entrega' | 'atividade'

export interface EventoAgenda {
  id: string; titulo: string; descricao: string; tipo: TipoEvento
  data: string; horaInicio: string; horaFim: string
  turmas: string[]; local: string; cor: string
  recorrente: boolean; criadoPor: string
  confirmacaoNecessaria: boolean; confirmados: string[]
  unidade: string; createdAt: string
}

export interface RotinaItem {
  id: string; turma: string; diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6
  horaInicio: string; horaFim: string; disciplina: string
  professor: string; sala: string
  tipo: 'aula' | 'intervalo' | 'educacao-fisica' | 'atividade'
  cor: string
}

export interface AutorizacaoResposta {
  alunoId: string; alunoNome: string; responsavel: string
  resposta: 'autorizado' | 'nao-autorizado' | 'pendente'
  dataResposta: string | null; obs: string
}

export interface AutorizacaoDigital {
  id: string; titulo: string; descricao: string
  dataEvento: string; prazoResposta: string; turmas: string[]
  respostas: AutorizacaoResposta[]
  status: 'ativa' | 'encerrada' | 'rascunho'
  criadoPor: string; createdAt: string; obrigatorioDocumento: boolean
}

export interface MomentoReacao { emoji: string; count: number; usuarios: string[] }

export interface MomentoItem {
  id: string; titulo: string; descricao: string; turmas: string[]
  tipo: 'foto' | 'video' | 'album'; url: string; thumbnail: string
  reacoes: MomentoReacao[]; criadoPor: string; createdAt: string; publico: boolean
}

export interface EnqueteOpcao { id: string; texto: string; votos: string[] }

export interface Enquete {
  id: string; pergunta: string; opcoes: EnqueteOpcao[]; turmas: string[]
  prazo: string; status: 'ativa' | 'encerrada'
  tipo: 'publica' | 'anonima'; multiplaEscolha: boolean
  criadoPor: string; createdAt: string
}

// ─── OPERACIONAL ──────────────────────────────────────────────────
export interface Ocorrencia {
  id: string; alunoId: string; alunoNome: string; turma: string
  tipo: string; descricao: string; gravidade: 'leve' | 'media' | 'grave'
  data: string; responsavel: string; ciencia_responsavel: boolean; createdAt: string
}

export interface Transferencia {
  id: string; alunoNome: string; tipo: 'entrada' | 'saida'
  escola: string; motivo: string; data: string
  status: 'pendente' | 'aprovado' | 'enviado' | 'recebido'
  docs: string[]; createdAt: string
}

export interface RegistroFrequencia {
  id: string; turmaId: string; data: string
  registros: { alunoId: string; status: 'P' | 'F' | 'J' | 'A' }[]
  criadoPor: string; createdAt: string
}

export interface LancamentoNota {
  id: string; turmaId: string; disciplina: string; bimestre: number
  notas: { alunoId: string; n1: number; n2: number; n3: number; media: number }[]
  criadoPor: string; createdAt: string
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG. PEDAGÓGICO
// ═══════════════════════════════════════════════════════════════════


export interface ConfigTurno {
  id: string
  codigo: string
  nome: string
  horarioInicio: string
  horarioFim: string
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface ConfigSituacaoAluno {
  id: string
  codigo: string
  nome: string // ex: Cursando, Aprovado
  tipo: 'Ativo' | 'Inativo' | 'Historico' | 'Transferido' | 'Cancelado'
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface ConfigGrupoAluno {
  id: string
  codigo: string
  nome: string // ex: Turma de Reforço, Atletas
  descricao: string
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface ConfigDisciplina {
  id: string
  codigo: string
  nome: string
  cargaHoraria: number          // horas/semana
  niveisEnsino: string[]        // ['EI','EF1','EF2','EM','EJA']
  obrigatoria: boolean
  situacao: 'ativa' | 'inativa'
  createdAt: string
}

export interface SerieEnsino {
  id: string
  codigo: string      // ex: 'EI01', 'EF101', '6ANO'
  nome: string        // '1º Ano', '2º Ano', 'Maternal I', etc.
  ordem: number       // ordem de exibição
  ativo: boolean
}

export interface ConfigNivelEnsino {
  id: string
  codigo: string                // EI, EF1, EF2, EM, EJA
  nome: string
  faixaEtaria: string           // '0-5 anos'
  duracaoAnos: number
  situacao: 'ativo' | 'inativo'
  series: SerieEnsino[]         // séries/anos do segmento
  unidadeIds: string[]          // unidades que oferecem este nível
  createdAt: string
}

export interface ConfigTipoOcorrencia {
  id: string
  codigo: string
  descricao: string
  gravidade: 'leve' | 'media' | 'grave'
  notificarResponsavel: boolean
  pontosEscalonamento: number   // pontos até escalar
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface ComponenteAvaliacao {
  label: string      // 'Prova 1', 'Trabalho', 'Parte. em sala'
  peso: number       // 0-100, soma deve ser 100
}

export interface ConfigEsquemaAvaliacao {
  id: string
  nome: string
  nivelEnsino: string            // código do nível (EF1, EM, etc)
  tipo: 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  composicao: ComponenteAvaliacao[]
  mediaMinima: number            // ex: 6.0
  mediaRecuperacao: number       // ex: 5.0
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG. FINANCEIRO
// ═══════════════════════════════════════════════════════════════════

export interface ConfigCentroCusto {
  id: string
  codigo: string
  descricao: string
  tipo: 'receita' | 'despesa' | 'ambos'
  responsavel: string
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface MetodoPagamento {
  id: string
  codigo: string
  nome: string
  tipo: 'dinheiro' | 'pix' | 'boleto' | 'cartao_credito' | 'cartao_debito' | 'debito_automatico' | 'cheque' | 'transferencia' | 'bolsa' | 'permuta'
  taxaPercentual: number
  diasCompensacao: number
  situacao: 'ativo' | 'inativo'
  obs: string
  createdAt: string
}

export type BandeiraCartao = 'Visa' | 'Mastercard' | 'Elo' | 'Amex' | 'Hipercard' | 'Outro'

export interface ConfigCartao {
  id: string
  codigo: string             // auto CART001…
  nome: string
  tipo: 'credito' | 'debito'
  bandeira: BandeiraCartao
  diasCredito: number            // dias até crédito na conta
  taxaTipo: 'percentual' | 'fixo'
  taxaValor: number              // % ou R$
  maquineta: string
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface ConfigEvento {
  id: string
  codigo: string                 // auto EV001…
  descricao: string
  planoContasId: string
  tipo: 'receita' | 'despesa'
  centroCustoId: string
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface ConfigGrupoDesconto {
  id: string
  codigo: string             // auto GD001…
  nome: string
  descricao: string
  tipo: 'percentual' | 'fixo'
  valor: number
  dataInicio: string
  dataFim: string
  eventoId: string               // evento financeiro vinculado
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface ConfigTipoDocumento {
  id: string
  codigo: string              // auto TD001…
  nome: string                // ex: Boleto Bancário
  descricao: string
  categoria: 'receita' | 'despesa' | 'ambos'  // contexto de uso
  requerNumeracao: boolean    // exige número de documento
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

// ─── CONVÊNIO BANCÁRIO ────────────────────────────────────────────
export type CarteiraItau = '109' | '112' | '175' | '109CN' | 'outro'

export interface ConfigConvenio {
  id: string
  banco: string                // código FEBRABAN ex: '341'
  nomeBanco: string            // ex: 'Itaú'
  agencia: string              // ex: '0001' (sem dígito)
  digitoAgencia?: string       // dígito verificador da agência (opcional — padrão '0')
  conta: string                // ex: '12345'
  digitoConta: string          // dígito verificador da conta
  convenio: string             // Código do Beneficiário (Itaú)
  cedente: string              // Razão Social da escola
  cnpj: string                 // CNPJ do cedente (só dígitos)
  carteira: string             // ex: '109', '112', '175'
  instrucoes: string           // instrução de protesto/devolução
  nossoNumeroInicial: number   // sequencial inicial (ex: 1)
  nossoNumeroSequencial: number // último nosso número gerado (controle de sequência)
  situacao: 'ativo' | 'inativo'
  ambiente: 'producao' | 'homologacao'
  createdAt: string
}


export interface ParcelaPadrao {
  numero: number
  vencimento: string             // YYYY-MM-DD
  valor: number
  desconto: number               // R$
  eventoId?: string
  eventoDescricao?: string
}

export interface ConfigPadraoPagamento {
  id: string
  codigo: string             // auto PP001…
  nome: string
  totalParcelas: number
  anuidade: number               // valor total R$
  ano: number
  diaVencimento: number          // dia do mês (1-31)
  situacao: 'ativo' | 'inativo'
  parcelas: ParcelaPadrao[]
  createdAt: string
}

export interface ConfigPlanoContas {
  id: string
  codPlano: string               // ex: '1', '1.1', '1.1.1'
  descricao: string
  tipo: 'analitico' | 'sintetico' | 'detalhe'
  grupoConta: 'receitas' | 'despesas'
  parentId: string               // '' = raiz
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

// ─── MOVIMENTAÇÕES FINANCEIRAS ─────────────────────────────────────
export type TipoMovimentacao = 'receita' | 'despesa'
export type TipoDocumento = 'NF' | 'NFe' | 'REC' | 'DUP' | 'CHQ' | 'BOL' | 'PIX' | 'TED' | 'DOC' | 'OUTRO'

export interface MovimentacaoManual {
  id: string
  caixaId: string               // ID do caixa aberto
  tipo: TipoMovimentacao
  fornecedorId: string          // '' se receita/sem fornecedor
  fornecedorNome: string
  descricao: string
  dataLancamento: string        // YYYY-MM-DD
  dataMovimento: string         // YYYY-MM-DD (recebimento ou pagamento)
  valor: number
  planoContasId: string
  planoContasDesc: string
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  dataEmissao: string
  compensadoBanco: boolean
  observacoes: string
  criadoEm: string
  editadoEm: string
  /** Origem automática — diferencia de lançamentos manuais */
  origem?: 'baixa_aluno' | 'baixa_pagar' | 'baixa_receber' | 'manual'
  /** Ref. ao documento de origem (codBaixa, id da conta, etc.) */
  referenciaId?: string
}

export interface MovCaixaItem {
  id: string
  tipo: 'entrada' | 'saida' | 'sangria' | 'suprimento'
  descricao: string
  valor: number
  hora: string
  operador: string
  planoContas?: string
  compensadoBanco?: string
  caixaId?: string
  /** Origem automática do lançamento (diferencia de lançamentos manuais) */
  origem?: 'baixa_aluno' | 'baixa_pagar' | 'baixa_receber' | 'manual'
  /** Referência ao documento de origem (ex: codBaixa, id da conta) */
  referenciaId?: string
}

export interface CaixaAberta {
  id: string
  codigo?: string
  nomeCaixa?: string
  dataAbertura: string
  horaAbertura: string
  operador: string
  unidade?: string
  saldoInicial: number
  movimentacoes: MovCaixaItem[]
  fechado: boolean
  horaFechamento?: string
  saldoFinal?: number
  baixaOutroUsuario?: boolean
}


export interface FornecedorCad {
  id: string
  codigo: string
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  cpf: string
  tipo: 'juridico' | 'fisico'
  categoria: string
  email: string
  telefone: string
  celular: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  contato: string
  banco: string
  agencia: string
  conta: string
  situacao: 'ativo' | 'inativo'
  observacoes: string
  createdAt: string
}

export interface ConfigCalendarioLetivo {
  id: string
  ano: number
  totalDiasLetivos: number    // padrão 200 (LDB)
  frequenciaMinima: number    // % padrão 75
  dataInicio: string          // YYYY-MM-DD
  dataFim: string
  observacoes: string
  createdAt: string
}

export interface Advertencia {
  id: string
  funcionarioId: string
  funcionarioNome: string
  cargo: string
  departamento: string
  tipo: 'verbal' | 'escrita' | 'suspensao' | 'demissao_causa'
  motivo: string
  descricao: string
  data: string
  medidaAplicada: string
  testemunhas: string
  responsavelRH: string
  ciente: boolean
  dataCiencia: string | null
  status: 'rascunho' | 'emitida' | 'ciente' | 'encerrada'
  createdAt: string
}

export interface LogAdiantamento {
  id: string
  dataHora: string
  acao: string
  usuario: string
  observacao?: string
}

export interface ParcelaAdiantamento {
  id: string
  numero: number
  valor: number
  vencimento: string
  dataPagamento: string | null
  status: 'pendente' | 'programada' | 'paga' | 'descontada' | 'vencida' | 'renegociada' | 'cancelada'
  formaQuitacao: string
  responsavel: string
  observacao?: string
}

export interface Adiantamento {
  id: string
  funcionarioId: string
  funcionarioNome: string
  matricula: string
  cargo: string
  setor: string
  unidade: string
  salarioAtual: number
  dataSolicitacao: string
  dataLiberacao: string | null
  competenciaRef: string
  valorTotal: number
  quantidadeParcelas: number
  primeiraData: string
  tipoLancamento: 'salarial' | 'extraordinario' | 'emprestimo' | 'outro'
  motivo: string
  formaQuitacao: 'desconto_folha' | 'manual' | 'misto' | 'outro'
  status: 'pendente' | 'aprovado' | 'pago_liberado' | 'em_andamento' | 'parcialmente_quitado' | 'quitado' | 'vencido' | 'cancelado'
  responsavelLancamento: string
  aprovador?: string
  dataAprovacao?: string
  aprovacaoObs?: string
  parcelas: ParcelaAdiantamento[]
  logs: LogAdiantamento[]
  createdAt: string
  updatedAt: string
}

export interface SystemLog {
  id: string
  dataHora: string
  usuarioNome: string
  perfil: string
  modulo: string
  acao: string
  registroId?: string
  nomeRelacionado?: string
  descricao: string
  status: 'sucesso' | 'falha' | 'alerta' | 'bloqueada'
  ip?: string
  origem: 'sistema' | 'app' | 'integracao' | 'api'
  detalhesAntes?: any
  detalhesDepois?: any
}


// ─── localStorage keys ────────────────────────────────────────────
const KEYS = {
  version: 'edu-data-version',
  alunos: 'edu-data-alunos',
  turmas: 'edu-data-turmas',
  funcionarios: 'edu-data-funcionarios',
  leads: 'edu-data-leads',
  titulos: 'edu-data-titulos',
  contasPagar: 'edu-data-contas-pagar',
  agendamentos: 'edu-data-agendamentos',
  comunicados: 'edu-data-comunicados',
  tarefas: 'edu-data-tarefas',
  mantenedores: 'edu-data-mantenedores',
  eventosAgenda: 'edu-data-eventos-agenda',
  rotinaItems: 'edu-data-rotina-items',
  autorizacoes: 'edu-data-autorizacoes',
  momentos: 'edu-data-momentos',
  enquetes: 'edu-data-enquetes',
  ocorrencias: 'edu-data-ocorrencias',
  transferencias: 'edu-data-transferencias',
  frequencias: 'edu-data-frequencias',
  lancamentosNota: 'edu-data-lancamentos-nota',
  // Config Pedagógico
    // Novas Configs
  cfgTurnos: 'edu-cfg-turnos',
  cfgSituacaoAluno: 'edu-cfg-situacao-aluno',
  cfgGruposAlunos: 'edu-cfg-grupos-alunos',
  cfgDisciplinas: 'edu-cfg-disciplinas',
  cfgNiveisEnsino: 'edu-cfg-niveis-ensino',
  cfgTiposOcorrencia: 'edu-cfg-tipos-ocorrencia',
  cfgEsquemasAvaliacao: 'edu-cfg-esquemas-avaliacao',
  // Config Financeiro
  cfgCentrosCusto: 'edu-cfg-centros-custo',
  cfgMetodosPagamento: 'edu-cfg-metodos-pagamento',
  cfgCartoes: 'edu-cfg-cartoes',
  cfgEventos: 'edu-cfg-eventos-fin',
  cfgGruposDesconto: 'edu-cfg-grupos-desconto',
  cfgPadroesPagamento: 'edu-cfg-padroes-pagamento',
  cfgPlanoContas: 'edu-cfg-plano-contas',
  cfgTiposDocumento: 'edu-cfg-tipos-documento',
  cfgConvenios: 'edu-cfg-convenios',
  // Operações
  cfgCalendarioLetivo: 'edu-cfg-calendario-letivo',
  movimentacoesManuais: 'edu-op-movimentacoes',
  caixasAbertos: 'edu-op-caixas',
  fornecedoresCad: 'edu-op-fornecedores',
  advertencias: 'edu-rh-advertencias',
  adiantamentos: 'edu-rh-adiantamentos',
  systemLogs: 'edu-data-system-logs',
}

// ─── Padrões de Níveis de Ensino MEC ─────────────────────────────
const mkSeries = (items: { codigo: string; nome: string }[]): SerieEnsino[] =>
  items.map((item, i) => ({ id: `S${i+1}`, codigo: item.codigo, nome: item.nome, ordem: i + 1, ativo: true }))

const NIVEIS_DEFAULT: ConfigNivelEnsino[] = [
  { id: 'NEI',  codigo: 'EI',  nome: 'Educação Infantil',           faixaEtaria: '0–5 anos',   duracaoAnos: 5, situacao: 'ativo', unidadeIds: [], series: mkSeries([
    { codigo: 'EI01', nome: 'Berçário' }, { codigo: 'EI02', nome: 'Maternal I' }, { codigo: 'EI03', nome: 'Maternal II' }, { codigo: 'EI04', nome: 'Jardim' }, { codigo: 'EI05', nome: 'Pré-Escola' },
  ]), createdAt: new Date().toISOString() },
  { id: 'NEF1', codigo: 'EF1', nome: 'Ensino Fundamental I',         faixaEtaria: '6–10 anos',  duracaoAnos: 5, situacao: 'ativo', unidadeIds: [], series: mkSeries([
    { codigo: 'EF101', nome: '1º Ano' }, { codigo: 'EF102', nome: '2º Ano' }, { codigo: 'EF103', nome: '3º Ano' }, { codigo: 'EF104', nome: '4º Ano' }, { codigo: 'EF105', nome: '5º Ano' },
  ]), createdAt: new Date().toISOString() },
  { id: 'NEF2', codigo: 'EF2', nome: 'Ensino Fundamental II',        faixaEtaria: '11–14 anos', duracaoAnos: 4, situacao: 'ativo', unidadeIds: [], series: mkSeries([
    { codigo: 'EF206', nome: '6º Ano' }, { codigo: 'EF207', nome: '7º Ano' }, { codigo: 'EF208', nome: '8º Ano' }, { codigo: 'EF209', nome: '9º Ano' },
  ]), createdAt: new Date().toISOString() },
  { id: 'NEM',  codigo: 'EM',  nome: 'Ensino Médio',                 faixaEtaria: '15–17 anos', duracaoAnos: 3, situacao: 'ativo', unidadeIds: [], series: mkSeries([
    { codigo: 'EM01', nome: '1ª Série' }, { codigo: 'EM02', nome: '2ª Série' }, { codigo: 'EM03', nome: '3ª Série' },
  ]), createdAt: new Date().toISOString() },
  { id: 'NEJA', codigo: 'EJA', nome: 'Educação de Jovens e Adultos', faixaEtaria: '18+ anos',   duracaoAnos: 3, situacao: 'ativo', unidadeIds: [], series: mkSeries([
    { codigo: 'EJA01', nome: 'Fase I' }, { codigo: 'EJA02', nome: 'Fase II' }, { codigo: 'EJA03', nome: 'Fase III' },
  ]), createdAt: new Date().toISOString() },
]

// ─── Context interface ────────────────────────────────────────────
type Setter<T> = (v: T | ((p: T) => T)) => void


const TURNOS_DEFAULT: ConfigTurno[] = [
  { id: 'T1', codigo: 'MN', nome: 'Manhã', horarioInicio: '07:00', horarioFim: '12:00', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'T2', codigo: 'TD', nome: 'Tarde', horarioInicio: '13:00', horarioFim: '18:00', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'T3', codigo: 'NT', nome: 'Noite', horarioInicio: '19:00', horarioFim: '22:30', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'T4', codigo: 'IN', nome: 'Intermediário', horarioInicio: '10:00', horarioFim: '15:00', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'T5', codigo: 'IG', nome: 'Integral', horarioInicio: '08:00', horarioFim: '17:00', situacao: 'ativo', createdAt: new Date().toISOString() },
]

const SITUACOES_DEFAULT: ConfigSituacaoAluno[] = [
  { id: 'S1', codigo: 'APR', nome: 'Aprovado', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S2', codigo: 'APP', nome: 'Aprovado com P/P', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S3', codigo: 'CON', nome: 'Concluído', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S4', codigo: 'CUR', nome: 'Cursando', tipo: 'Ativo', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S5', codigo: 'DES', nome: 'Desistente', tipo: 'Inativo', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S6', codigo: 'CAN', nome: 'Matrícula cancelada', tipo: 'Cancelado', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S7', codigo: 'TRA', nome: 'Matrícula trancada', tipo: 'Inativo', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S8', codigo: 'REM', nome: 'Remanejado', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S9', codigo: 'REP', nome: 'Reprovado', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S10', codigo: 'RPF', nome: 'Reprovado por falta', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S11', codigo: 'TRF', nome: 'Transferido', tipo: 'Transferido', situacao: 'ativo', createdAt: new Date().toISOString() },
]

const GRUPOS_ALUNOS_DEFAULT: ConfigGrupoAluno[] = [
  { id: 'GA1', codigo: 'REG', nome: 'Alunos Regulares', descricao: 'Alunos pagantes sem nenhum tipo de benefício.', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'GA2', codigo: 'B100', nome: 'Bolsistas 100%', descricao: 'Alunos com bolsa integral.', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'GA3', codigo: 'B50', nome: 'Bolsistas 50%', descricao: 'Alunos com bolsa parcial de 50%.', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'GA4', codigo: 'BOL_ESP', nome: 'Bolsa Atleta', descricao: 'Alunos que possuem bolsa por desempenho esportivo.', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'GA5', codigo: 'FUNC', nome: 'Filhos de Funcionários', descricao: 'Dependentes diretos de colaboradores da escola.', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'GA6', codigo: 'IRM', nome: 'Desconto Irmãos', descricao: 'Alunos que recebem desconto por possuírem familiares matriculados.', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'GA7', codigo: 'CONV', nome: 'Convênios Empresariais', descricao: 'Matrículas oriundas de parcerias com corporações.', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'GA8', prep: 'Especial', codigo: 'AEE', nome: 'Atendimento Educacional Especializado (AEE)', descricao: 'Alunos com necessidades educacionais especiais.', situacao: 'ativo', createdAt: new Date().toISOString() },
].map(({ prep, ...rest }) => rest as ConfigGrupoAluno)

const DISCIPLINAS_DEFAULT: ConfigDisciplina[] = [
  { id: 'D1', codigo: 'MAT001', nome: 'Matemática', cargaHoraria: 5, niveisEnsino: ['EI','EF1','EF2','EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D2', codigo: 'LP001', nome: 'Língua Portuguesa', cargaHoraria: 5, niveisEnsino: ['EI','EF1','EF2','EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D3', codigo: 'CIE001', nome: 'Ciências', cargaHoraria: 3, niveisEnsino: ['EF1','EF2'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D4', codigo: 'HIS001', nome: 'História', cargaHoraria: 3, niveisEnsino: ['EF1','EF2','EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D5', codigo: 'GEO001', nome: 'Geografia', cargaHoraria: 3, niveisEnsino: ['EF1','EF2','EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D6', codigo: 'FIS001', nome: 'Física', cargaHoraria: 3, niveisEnsino: ['EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D7', codigo: 'QUI001', nome: 'Química', cargaHoraria: 3, niveisEnsino: ['EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D8', codigo: 'BIO001', nome: 'Biologia', cargaHoraria: 3, niveisEnsino: ['EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D9', codigo: 'ART001', nome: 'Artes', cargaHoraria: 2, niveisEnsino: ['EI','EF1','EF2','EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D10', codigo: 'EDF001', nome: 'Educação Física', cargaHoraria: 2, niveisEnsino: ['EI','EF1','EF2','EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D11', codigo: 'ING001', nome: 'Inglês', cargaHoraria: 2, niveisEnsino: ['EF2','EM','EJA'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D12', codigo: 'FIL001', nome: 'Filosofia', cargaHoraria: 2, niveisEnsino: ['EM'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D13', codigo: 'SOC001', nome: 'Sociologia', cargaHoraria: 2, niveisEnsino: ['EM'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D14', codigo: 'NTR001', nome: 'Natureza e Sociedade', cargaHoraria: 2, niveisEnsino: ['EI'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
  { id: 'D15', codigo: 'MVT001', nome: 'Movimento', cargaHoraria: 2, niveisEnsino: ['EI'], obrigatoria: true, situacao: 'ativa', createdAt: new Date().toISOString() },
]

const TIPOS_OCORRENCIA_DEFAULT: ConfigTipoOcorrencia[] = [
  { id: 'O1', codigo: 'T001', descricao: 'Atraso', gravidade: 'leve', notificarResponsavel: false, pontosEscalonamento: 1, situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'O2', codigo: 'T002', descricao: 'Fardamento Incompleto', gravidade: 'leve', notificarResponsavel: false, pontosEscalonamento: 1, situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'O3', codigo: 'T003', descricao: 'Tarefa não realizada', gravidade: 'leve', notificarResponsavel: false, pontosEscalonamento: 1, situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'O4', codigo: 'T004', descricao: 'Uso de celular em sala', gravidade: 'media', notificarResponsavel: true, pontosEscalonamento: 2, situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'O5', codigo: 'T005', descricao: 'Indisciplina em sala', gravidade: 'media', notificarResponsavel: true, pontosEscalonamento: 2, situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'O6', codigo: 'T006', descricao: 'Matar aula (Evasão escolar)', gravidade: 'grave', notificarResponsavel: true, pontosEscalonamento: 5, situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'O7', codigo: 'T007', descricao: 'Desrespeito ao professor/funcionário', gravidade: 'grave', notificarResponsavel: true, pontosEscalonamento: 5, situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'O8', codigo: 'T008', descricao: 'Agressão física/verbal entre alunos', gravidade: 'grave', notificarResponsavel: true, pontosEscalonamento: 5, situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'O9', codigo: 'T009', descricao: 'Dano ao patrimônio escolar', gravidade: 'grave', notificarResponsavel: true, pontosEscalonamento: 5, situacao: 'ativo', createdAt: new Date().toISOString() },
]

interface DataState {
  alunos: Aluno[]; setAlunos: Setter<Aluno[]>
  turmas: Turma[]; setTurmas: Setter<Turma[]>
  funcionarios: Funcionario[]; setFuncionarios: Setter<Funcionario[]>
  leads: Lead[]; setLeads: Setter<Lead[]>
  titulos: Titulo[]; setTitulos: Setter<Titulo[]>
  contasPagar: ContaPagar[]; setContasPagar: Setter<ContaPagar[]>
  agendamentos: Agendamento[]; setAgendamentos: Setter<Agendamento[]>
  comunicados: Comunicado[]; setComunicados: Setter<Comunicado[]>
  tarefas: Tarefa[]; setTarefas: Setter<Tarefa[]>
  mantenedores: Mantenedor[]; setMantenedores: Setter<Mantenedor[]>
  eventosAgenda: EventoAgenda[]; setEventosAgenda: Setter<EventoAgenda[]>
  rotinaItems: RotinaItem[]; setRotinaItems: Setter<RotinaItem[]>
  autorizacoes: AutorizacaoDigital[]; setAutorizacoes: Setter<AutorizacaoDigital[]>
  momentos: MomentoItem[]; setMomentos: Setter<MomentoItem[]>
  enquetes: Enquete[]; setEnquetes: Setter<Enquete[]>
  ocorrencias: Ocorrencia[]; setOcorrencias: Setter<Ocorrencia[]>
  transferencias: Transferencia[]; setTransferencias: Setter<Transferencia[]>
  frequencias: RegistroFrequencia[]; setFrequencias: Setter<RegistroFrequencia[]>
  lancamentosNota: LancamentoNota[]; setLancamentosNota: Setter<LancamentoNota[]>
  // Config Pedagógico
  cfgTurnos: ConfigTurno[]; setCfgTurnos: Setter<ConfigTurno[]>
  cfgSituacaoAluno: ConfigSituacaoAluno[]; setCfgSituacaoAluno: Setter<ConfigSituacaoAluno[]>
  cfgGruposAlunos: ConfigGrupoAluno[]; setCfgGruposAlunos: Setter<ConfigGrupoAluno[]>
  cfgDisciplinas: ConfigDisciplina[]; setCfgDisciplinas: Setter<ConfigDisciplina[]>
  cfgNiveisEnsino: ConfigNivelEnsino[]; setCfgNiveisEnsino: Setter<ConfigNivelEnsino[]>
  cfgTiposOcorrencia: ConfigTipoOcorrencia[]; setCfgTiposOcorrencia: Setter<ConfigTipoOcorrencia[]>
  cfgEsquemasAvaliacao: ConfigEsquemaAvaliacao[]; setCfgEsquemasAvaliacao: Setter<ConfigEsquemaAvaliacao[]>
  // Config Financeiro
  cfgCentrosCusto: ConfigCentroCusto[]; setCfgCentrosCusto: Setter<ConfigCentroCusto[]>
  cfgMetodosPagamento: MetodoPagamento[]; setCfgMetodosPagamento: Setter<MetodoPagamento[]>
  cfgCartoes: ConfigCartao[]; setCfgCartoes: Setter<ConfigCartao[]>
  cfgEventos: ConfigEvento[]; setCfgEventos: Setter<ConfigEvento[]>
  cfgGruposDesconto: ConfigGrupoDesconto[]; setCfgGruposDesconto: Setter<ConfigGrupoDesconto[]>
  cfgPadroesPagamento: ConfigPadraoPagamento[]; setCfgPadroesPagamento: Setter<ConfigPadraoPagamento[]>
  cfgPlanoContas: ConfigPlanoContas[]; setCfgPlanoContas: Setter<ConfigPlanoContas[]>
  cfgTiposDocumento: ConfigTipoDocumento[]; setCfgTiposDocumento: Setter<ConfigTipoDocumento[]>
  cfgConvenios: ConfigConvenio[]; setCfgConvenios: Setter<ConfigConvenio[]>
  cfgCalendarioLetivo: ConfigCalendarioLetivo[]; setCfgCalendarioLetivo: Setter<ConfigCalendarioLetivo[]>
  // Operações Financeiras
  movimentacoesManuais: MovimentacaoManual[]; setMovimentacoesManuais: Setter<MovimentacaoManual[]>
  caixasAbertos: CaixaAberta[]; setCaixasAbertos: Setter<CaixaAberta[]>
  fornecedoresCad: FornecedorCad[]; setFornecedoresCad: Setter<FornecedorCad[]>
  // RH
  advertencias: Advertencia[]; setAdvertencias: Setter<Advertencia[]>
  adiantamentos: Adiantamento[]; setAdiantamentos: Setter<Adiantamento[]>
  systemLogs: SystemLog[]; setSystemLogs: Setter<SystemLog[]>
  logSystemAction: (modulo: string, acao: string, descricao: string, payload?: Partial<SystemLog>) => void
  wipeAll: () => void
}

const DataContext = createContext<DataState>({} as DataState)

import { ADIANTAMENTOS } from './data'

export function DataProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem(KEYS.version)
    if (stored !== DATA_VERSION) {
      localStorage.clear()
      localStorage.setItem(KEYS.version, DATA_VERSION)
      // Reload para forçar a re-leitura com dados limpos
      window.location.reload()
    }
    
    // Auto-Sincroniza alunos e turmas legados no LocalStorage com a nova API Mockada de React Query
    const syncLegacy = async () => {
      try {
        const loc = JSON.parse(window.localStorage.getItem(KEYS.alunos) || '[]');
        if (loc.length > 0) {
          const res = await fetch('/api/alunos');
          const serv = await res.json();
          const serverIds = new Set(serv.map((s:any) => s.id));
          loc.filter((a:any) => !serverIds.has(a.id)).forEach((a:any) => {
            fetch('/api/alunos', { method:'POST', body:JSON.stringify(a) }).catch(()=>{})
          })
        }
        const locT = JSON.parse(window.localStorage.getItem(KEYS.turmas) || '[]');
        if (locT.length > 0) {
          const resT = await fetch('/api/turmas');
          const servT = await resT.json();
          const serverIdsT = new Set(servT.map((s:any) => s.id));
          locT.filter((t:any) => !serverIdsT.has(t.id)).forEach((t:any) => {
            fetch('/api/turmas', { method:'POST', body:JSON.stringify(t) }).catch(()=>{})
          })
        }
      } catch(e) {}
    }
    setTimeout(syncLegacy, 2000); // Roda 2 segundos após boot em bg
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [alunos, setAlunos] = useLocalStorage<Aluno[]>(KEYS.alunos, [])
  const [turmas, setTurmas] = useLocalStorage<Turma[]>(KEYS.turmas, [])
  const [funcionarios, setFuncionarios] = useLocalStorage<Funcionario[]>(KEYS.funcionarios, [])
  const [leads, setLeads] = useLocalStorage<Lead[]>(KEYS.leads, [])
  const [titulos, setTitulos] = useLocalStorage<Titulo[]>(KEYS.titulos, [])
  const [contasPagar, setContasPagar] = useLocalStorage<ContaPagar[]>(KEYS.contasPagar, [])
  const [agendamentos, setAgendamentos] = useLocalStorage<Agendamento[]>(KEYS.agendamentos, [])
  const [comunicados, setComunicados] = useLocalStorage<Comunicado[]>(KEYS.comunicados, [])
  const [tarefas, setTarefas] = useLocalStorage<Tarefa[]>(KEYS.tarefas, [])
  const [mantenedores, setMantenedores] = useLocalStorage<Mantenedor[]>(KEYS.mantenedores, [])
  const [eventosAgenda, setEventosAgenda] = useLocalStorage<EventoAgenda[]>(KEYS.eventosAgenda, [])
  const [rotinaItems, setRotinaItems] = useLocalStorage<RotinaItem[]>(KEYS.rotinaItems, [])
  const [autorizacoes, setAutorizacoes] = useLocalStorage<AutorizacaoDigital[]>(KEYS.autorizacoes, [])
  const [momentos, setMomentos] = useLocalStorage<MomentoItem[]>(KEYS.momentos, [])
  const [enquetes, setEnquetes] = useLocalStorage<Enquete[]>(KEYS.enquetes, [])
  const [ocorrencias, setOcorrencias] = useLocalStorage<Ocorrencia[]>(KEYS.ocorrencias, [])
  const [transferencias, setTransferencias] = useLocalStorage<Transferencia[]>(KEYS.transferencias, [])
  const [frequencias, setFrequencias] = useLocalStorage<RegistroFrequencia[]>(KEYS.frequencias, [])
  const [lancamentosNota, setLancamentosNota] = useLocalStorage<LancamentoNota[]>(KEYS.lancamentosNota, [])
  // Config Pedagógico
    const [cfgTurnos, setCfgTurnos] = useLocalStorage<ConfigTurno[]>(KEYS.cfgTurnos, TURNOS_DEFAULT)
  const [cfgSituacaoAluno, setCfgSituacaoAluno] = useLocalStorage<ConfigSituacaoAluno[]>(KEYS.cfgSituacaoAluno, SITUACOES_DEFAULT)
  const [cfgGruposAlunos, setCfgGruposAlunos] = useLocalStorage<ConfigGrupoAluno[]>(KEYS.cfgGruposAlunos, GRUPOS_ALUNOS_DEFAULT)
  const [cfgDisciplinas, setCfgDisciplinas] = useLocalStorage<ConfigDisciplina[]>(KEYS.cfgDisciplinas, DISCIPLINAS_DEFAULT)
  const [cfgNiveisEnsino, setCfgNiveisEnsino] = useLocalStorage<ConfigNivelEnsino[]>(KEYS.cfgNiveisEnsino, NIVEIS_DEFAULT)
  const [cfgTiposOcorrencia, setCfgTiposOcorrencia] = useLocalStorage<ConfigTipoOcorrencia[]>(KEYS.cfgTiposOcorrencia, TIPOS_OCORRENCIA_DEFAULT)
  const [cfgEsquemasAvaliacao, setCfgEsquemasAvaliacao] = useLocalStorage<ConfigEsquemaAvaliacao[]>(KEYS.cfgEsquemasAvaliacao, [])
  // Config Financeiro
  const [cfgCentrosCusto, setCfgCentrosCusto] = useLocalStorage<ConfigCentroCusto[]>(KEYS.cfgCentrosCusto, [])
  const [cfgMetodosPagamento, setCfgMetodosPagamento] = useLocalStorage<MetodoPagamento[]>(KEYS.cfgMetodosPagamento, [])
  const [cfgCartoes, setCfgCartoes] = useLocalStorage<ConfigCartao[]>(KEYS.cfgCartoes, [])
  const [cfgEventos, setCfgEventos] = useLocalStorage<ConfigEvento[]>(KEYS.cfgEventos, [])
  const [cfgGruposDesconto, setCfgGruposDesconto] = useLocalStorage<ConfigGrupoDesconto[]>(KEYS.cfgGruposDesconto, [])
  const [cfgPadroesPagamento, setCfgPadroesPagamento] = useLocalStorage<ConfigPadraoPagamento[]>(KEYS.cfgPadroesPagamento, [])
  const [cfgPlanoContas, setCfgPlanoContas] = useLocalStorage<ConfigPlanoContas[]>(KEYS.cfgPlanoContas, [])
  const [cfgTiposDocumento, setCfgTiposDocumento] = useLocalStorage<ConfigTipoDocumento[]>(KEYS.cfgTiposDocumento, [])
  const CONVENIO_ITAU_SEED: ConfigConvenio[] = [{
    id: 'CONV-ITAU-6492-34022',
    banco: '341', nomeBanco: 'Itaú',
    cedente: 'COLEGIO IMPACTO C ENSINO LTDA',
    cnpj: '04395789000188',
    agencia: '6492',
    conta: '34022', digitoConta: '6',
    // Código Beneficiário = conta + DV (conforme boleto: 6492/34022-6)
    convenio: '34022-6',
    carteira: '109',
    instrucoes: 'nao_protestar',
    nossoNumeroInicial: 1,
    nossoNumeroSequencial: 0,
    situacao: 'ativo',
    ambiente: 'homologacao',
    createdAt: '2026-04-01T00:00:00.000Z',
  }]
  const [cfgConvenios, setCfgConvenios] = useLocalStorage<ConfigConvenio[]>(KEYS.cfgConvenios, CONVENIO_ITAU_SEED)

  const [cfgCalendarioLetivo, setCfgCalendarioLetivo] = useLocalStorage<ConfigCalendarioLetivo[]>(KEYS.cfgCalendarioLetivo, [])
  // Operações Financeiras
  const [movimentacoesManuais, setMovimentacoesManuais] = useLocalStorage<MovimentacaoManual[]>(KEYS.movimentacoesManuais, [])
  const [caixasAbertos, setCaixasAbertos] = useLocalStorage<CaixaAberta[]>(KEYS.caixasAbertos, [])
  const [fornecedoresCad, setFornecedoresCad] = useLocalStorage<FornecedorCad[]>(KEYS.fornecedoresCad, [])
  const [advertencias, setAdvertencias] = useLocalStorage<Advertencia[]>(KEYS.advertencias, [])
  const [adiantamentos, setAdiantamentos] = useLocalStorage<Adiantamento[]>(KEYS.adiantamentos, ADIANTAMENTOS)

  // System Logs Vazio para Produção
  const LOGS_SEED: SystemLog[] = []
  const [systemLogs, setSystemLogs] = useLocalStorage<SystemLog[]>(KEYS.systemLogs, LOGS_SEED)

  const logSystemAction = useCallback((modulo: string, acao: string, descricao: string, payload?: Partial<SystemLog>) => {
    let userName = 'Admin Local';
    let userPerfil = 'Administrador';
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(window.localStorage.getItem('edu-current-user') || 'null');
        if (u && u.nome) {
          userName = u.nome;
          userPerfil = u.perfil || 'Usuário';
        }
      } catch (e) {}
    }

    const newLog: SystemLog = {
      id: `LOG-${Date.now()}`,
      dataHora: new Date().toISOString(),
      usuarioNome: userName,
      perfil: userPerfil,
      modulo,
      acao,
      descricao,
      status: payload?.status || 'sucesso',
      origem: payload?.origem || 'sistema',
      ip: '127.0.0.1',
      ...payload
    }
    setSystemLogs(prev => [newLog, ...prev])
  }, [setSystemLogs])

  const createTrackedSetter = useCallback(<T extends Record<string, any>>(
    modulo: string,
    entidadeContexto: string,
    rawSetter: Setter<T[]>
  ): Setter<T[]> => {
    return (newVal: T[] | ((prev: T[]) => T[])) => {
      rawSetter(prevArray => {
        const nextArray = typeof newVal === 'function' ? (newVal as any)(prevArray) : newVal;
        if (Array.isArray(prevArray) && Array.isArray(nextArray) && prevArray !== nextArray) {
          const newLogs: SystemLog[] = [];
          const mapPrev = new Map(prevArray.map(i => [i.id || String(i), i]));
          const mapNext = new Map(nextArray.map(i => [i.id || String(i), i]));

          const sanitizeLogData = (data: any) => {
            try {
              return JSON.parse(JSON.stringify(data, (key, value) => {
                if (typeof value === 'string' && value.startsWith('data:image')) return '[IMAGEM OMITIDA DO LOG]';
                return value;
              }));
            } catch (e) { return { error: 'data_too_complex' }; }
          };

          let userName = 'Admin Local';
          let userPerfil = 'Administrador';
          if (typeof window !== 'undefined') {
            try {
              const u = JSON.parse(window.localStorage.getItem('edu-current-user') || 'null');
              if (u && u.nome) {
                userName = u.nome;
                userPerfil = u.perfil || 'Usuário';
              }
            } catch (e) {}
          }

          for (const [id, nextItem] of mapNext.entries()) {
            if (!id || typeof nextItem !== 'object') continue;
            const prevItem = mapPrev.get(id);
            const nomeRel = nextItem.nome || nextItem.titulo || nextItem.codigo || nextItem.descricao || nextItem.razaoSocial || `ID: ${id}`;

            if (!prevItem) {
              newLogs.push({
                dataHora: new Date().toISOString(),
                usuarioNome: userName,
                perfil: userPerfil,
                modulo,
                acao: 'Cadastro',
                descricao: `Novo registro salvo (${entidadeContexto})`,
                status: 'sucesso',
                origem: 'sistema',
                registroId: String(id),
                nomeRelacionado: nomeRel,
                detalhesDepois: sanitizeLogData(nextItem),
              } as SystemLog);
            } else {
              const strNext = JSON.stringify(nextItem);
              const strPrev = JSON.stringify(prevItem);
              if (strNext !== strPrev) {
                newLogs.push({
                  dataHora: new Date().toISOString(),
                  usuarioNome: userName,
                  perfil: userPerfil,
                  modulo,
                  acao: 'Edição',
                  descricao: `Alteração de dados (${entidadeContexto})`,
                  status: 'sucesso',
                  origem: 'sistema',
                  registroId: String(id),
                  nomeRelacionado: nomeRel,
                  detalhesAntes: sanitizeLogData(prevItem),
                  detalhesDepois: sanitizeLogData(nextItem),
                } as SystemLog);
              }
            }
          }

          for (const [id, prevItem] of mapPrev.entries()) {
             if (!id || typeof prevItem !== 'object') continue;
             if (!mapNext.has(id)) {
               const nomeRel = prevItem.nome || prevItem.titulo || prevItem.codigo || prevItem.descricao || prevItem.razaoSocial || `ID: ${id}`;
               newLogs.push({
                  dataHora: new Date().toISOString(),
                  usuarioNome: userName,
                  perfil: userPerfil,
                  modulo,
                  acao: 'Exclusão',
                  descricao: `Registro removido (${entidadeContexto})`,
                  status: 'sucesso',
                  origem: 'sistema',
                  registroId: String(id),
                  nomeRelacionado: nomeRel,
                  detalhesAntes: sanitizeLogData(prevItem),
               } as SystemLog);
             }
          }

          if (newLogs.length > 0) {
            setSystemLogs(prev => {
              const timestamp = Date.now();
              const withIds = newLogs.map((l, i) => ({ ...l, id: `LOG-${timestamp}-${i}` }));
              const nextLogs = [...withIds, ...prev];
              return nextLogs.slice(0, 300);
            });
          }
        }
        return nextArray;
      });
    };
  }, [setSystemLogs]);

  const wipeAll = useCallback(() => {
    setAlunos([]); setTurmas([]); setFuncionarios([]); setLeads([])
    setTitulos([]); setContasPagar([]); setAgendamentos([])
    setComunicados([]); setTarefas([]); setMantenedores([])
    setEventosAgenda([]); setRotinaItems([]); setAutorizacoes([])
    setMomentos([]); setEnquetes([])
    setOcorrencias([]); setTransferencias([]); setFrequencias([]); setLancamentosNota([])
    setCfgDisciplinas(DISCIPLINAS_DEFAULT); setCfgNiveisEnsino(NIVEIS_DEFAULT); setCfgTiposOcorrencia(TIPOS_OCORRENCIA_DEFAULT); setCfgEsquemasAvaliacao([]); setCfgTurnos(TURNOS_DEFAULT); setCfgSituacaoAluno(SITUACOES_DEFAULT); setCfgGruposAlunos(GRUPOS_ALUNOS_DEFAULT);
    setCfgCentrosCusto([]); setCfgMetodosPagamento([]); setCfgCartoes([]); setCfgEventos([]); setCfgGruposDesconto([])
    setCfgPadroesPagamento([]); setCfgPlanoContas([]); setCfgTiposDocumento([]); setCfgConvenios([])
    setMovimentacoesManuais([]); setCaixasAbertos([]); setFornecedoresCad([])
    setAdvertencias([]); setAdiantamentos([]); setSystemLogs([]);
  }, [])

  return (
    <DataContext.Provider value={{
      alunos, setAlunos: createTrackedSetter('Acadêmico', 'Alunos', setAlunos),
      turmas, setTurmas: createTrackedSetter('Acadêmico', 'Turmas', setTurmas),
      funcionarios, setFuncionarios: createTrackedSetter('RH', 'Funcionários', setFuncionarios),
      leads, setLeads: createTrackedSetter('Comercial', 'Leads', setLeads),
      titulos, setTitulos: createTrackedSetter('Financeiro', 'Contas a Receber', setTitulos),
      contasPagar, setContasPagar: createTrackedSetter('Financeiro', 'Contas a Pagar', setContasPagar),
      agendamentos, setAgendamentos: createTrackedSetter('Comercial', 'Agendamentos', setAgendamentos),
      comunicados, setComunicados: createTrackedSetter('Comunicação', 'Comunicados', setComunicados),
      tarefas, setTarefas: createTrackedSetter('Operacional', 'Tarefas', setTarefas),
      mantenedores, setMantenedores: createTrackedSetter('Configurações', 'Mantenedores', setMantenedores),
      eventosAgenda, setEventosAgenda: createTrackedSetter('Agenda', 'Eventos', setEventosAgenda),
      rotinaItems, setRotinaItems: createTrackedSetter('Pedagógico', 'Rotina', setRotinaItems),
      autorizacoes, setAutorizacoes: createTrackedSetter('Agenda', 'Autorizações', setAutorizacoes),
      momentos, setMomentos: createTrackedSetter('Agenda', 'Momentos', setMomentos),
      enquetes, setEnquetes: createTrackedSetter('Agenda', 'Enquetes', setEnquetes),
      ocorrencias, setOcorrencias: createTrackedSetter('Operacional', 'Ocorrências', setOcorrencias),
      transferencias, setTransferencias: createTrackedSetter('Acadêmico', 'Transferências', setTransferencias),
      frequencias, setFrequencias: createTrackedSetter('Acadêmico', 'Frequências', setFrequencias),
      lancamentosNota, setLancamentosNota: createTrackedSetter('Acadêmico', 'Notas', setLancamentosNota),
      cfgTurnos, setCfgTurnos: createTrackedSetter('Configurações', 'Turnos', setCfgTurnos),
      cfgSituacaoAluno, setCfgSituacaoAluno: createTrackedSetter('Configurações', 'Situações Aluno', setCfgSituacaoAluno),
      cfgGruposAlunos, setCfgGruposAlunos: createTrackedSetter('Configurações', 'Grupos Alunos', setCfgGruposAlunos),
      cfgDisciplinas, setCfgDisciplinas: createTrackedSetter('Configurações', 'Disciplinas', setCfgDisciplinas),
      cfgNiveisEnsino, setCfgNiveisEnsino: createTrackedSetter('Configurações', 'Níveis de Ensino', setCfgNiveisEnsino),
      cfgTiposOcorrencia, setCfgTiposOcorrencia: createTrackedSetter('Configurações', 'Tipos de Ocorrência', setCfgTiposOcorrencia),
      cfgEsquemasAvaliacao, setCfgEsquemasAvaliacao: createTrackedSetter('Configurações', 'Esquemas de Avaliação', setCfgEsquemasAvaliacao),
      cfgCentrosCusto, setCfgCentrosCusto: createTrackedSetter('Configurações', 'Centros de Custo', setCfgCentrosCusto),
      cfgMetodosPagamento, setCfgMetodosPagamento: createTrackedSetter('Configurações', 'Métodos de Pagamento', setCfgMetodosPagamento),
      cfgCartoes, setCfgCartoes: createTrackedSetter('Configurações', 'Cartões', setCfgCartoes),
      cfgEventos, setCfgEventos: createTrackedSetter('Configurações', 'Eventos Financeiros', setCfgEventos),
      cfgGruposDesconto, setCfgGruposDesconto: createTrackedSetter('Configurações', 'Grupos de Desconto', setCfgGruposDesconto),
      cfgPadroesPagamento, setCfgPadroesPagamento: createTrackedSetter('Configurações', 'Padrões de Pagamento', setCfgPadroesPagamento),
      cfgPlanoContas, setCfgPlanoContas: createTrackedSetter('Configurações', 'Plano de Contas', setCfgPlanoContas),
      cfgTiposDocumento, setCfgTiposDocumento: createTrackedSetter('Configurações', 'Tipos de Documento', setCfgTiposDocumento),
      cfgConvenios, setCfgConvenios: createTrackedSetter('Configurações', 'Convênios Bancários', setCfgConvenios),
      cfgCalendarioLetivo, setCfgCalendarioLetivo: createTrackedSetter('Configurações', 'Calendário Letivo', setCfgCalendarioLetivo),
      movimentacoesManuais, setMovimentacoesManuais: createTrackedSetter('Financeiro', 'Movimentações Manuais', setMovimentacoesManuais),
      caixasAbertos, setCaixasAbertos: createTrackedSetter('Financeiro', 'Caixas', setCaixasAbertos),
      fornecedoresCad, setFornecedoresCad: createTrackedSetter('Configurações', 'Fornecedores', setFornecedoresCad),
      advertencias, setAdvertencias: createTrackedSetter('RH', 'Advertências', setAdvertencias),
      adiantamentos, setAdiantamentos: createTrackedSetter('RH', 'Adiantamentos', setAdiantamentos),
      systemLogs, setSystemLogs, logSystemAction,
      wipeAll
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() { return useContext(DataContext) }

export function newId(prefix = 'ID'): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}
