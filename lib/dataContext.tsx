'use client'

import { createContext, useContext, useCallback, useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { useSupabaseArray, invalidateAllCache } from './useSupabaseCollection'
import { useConfigDb, invalidateConfigCache } from './useConfigDb'

// ─── Data version — bump to force-clear all stored data ───────────
const DATA_VERSION = '17'

// ─── Types ────────────────────────────────────────────────────────
export interface Aluno {
  id: string; nome: string; matricula: string; codigo?: string; turma: string; serie: string
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
  nfEmitida?: boolean; nfId?: string
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
  
  // NOVO: Integração DRE Executiva
  centroCustoId?: string
}


export interface ContaPagar {
  id: string; descricao: string; categoria: string; valor: number
  vencimento: string; status: 'pago' | 'pendente'; fornecedor: string
  numeroDocumento?: string
  planoContasId?: string
  codigo?: string // Adicionado para consistência visual nas contas a pagar
  
  // NOVO: Centro de Custo Enxuto e Rateio Opcional
  centroCustoId?: string
  usaRateio?: boolean
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

export interface Perfil {
  id: string; nome: string; cor: string
  permissoes: string[]; descricao: string
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
  matriculaAtiva: boolean // true = matrícula em curso, false = encerrada/histórico
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

export type GrupoDRECodigo =
  | 'RECEITA_BRUTA'
  | 'DEDUCAO_RECEITA'
  | 'RECEITA_LIQUIDA'
  | 'CUSTO_SERVICO'
  | 'LUCRO_BRUTO'
  | 'DESP_ADMINISTRATIVA'
  | 'DESP_COMERCIAL'
  | 'RESULTADO_OPERACIONAL'
  | 'RESULTADO_FINANCEIRO'
  | 'RESULTADO_ANTES_IMPOSTOS'
  | 'IMPOSTOS'
  | 'LUCRO_LIQUIDO'
  | 'INVESTIMENTOS'
  | 'SEM_CLASSIFICACAO'

export interface ConfigPlanoContas {
  id: string
  codPlano: string               // ex: '1', '1.1', '1.1.1'
  descricao: string
  tipo: 'analitico' | 'sintetico' | 'detalhe'
  grupoConta: 'receitas' | 'despesas' | 'investimentos'
  parentId: string               // '' = raiz
  situacao: 'ativo' | 'inativo'
  createdAt: string
  // ── Integração DRE ──────────────────────────────────────
  grupoDRE?: GrupoDRECodigo      // qual grupo da DRE essa conta alimenta
  exibirDRE?: boolean            // aparece no relatório DRE?
  naturezaDRE?: 'credora' | 'devedora' | 'neutra' // como soma no cálculo
  ordemDRE?: number              // posição dentro do grupo
}

export interface ConfigGrupoDRE {
  id: string
  codigo: GrupoDRECodigo
  nome: string
  nomeCurto?: string
  tipo: 'receita' | 'deducao' | 'custo' | 'despesa' | 'resultado' | 'imposto' | 'informativo'
  natureza: 'credora' | 'devedora' | 'calculado'
  formula?: string               // ex: 'RECEITA_BRUTA - DEDUCAO_RECEITA'
  ordem: number
  exibir: boolean
  nivel: 'grupo' | 'subtotal' | 'total'
  corDestaque?: string
  createdAt: string
}

export interface DREConfig {
  id: string
  regimeApuracao: 'caixa' | 'competencia'
  exibirZerados: boolean
  exibirContasInativas: boolean
  periodosFechados: string[]     // YYYY-MM fechados
  updatedAt: string
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
  centroCustoId?: string
  centroCustoDesc?: string
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
  centroCustoId?: string
  centroCustoDesc?: string
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
  planoContasId?: string
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

// ─── CENSO ESCOLAR ────────────────────────────────────────────────
export interface CensoConfig {
  anoCensitario: number
  etapaAtiva: '1-matricula' | '2-situacao'
  layoutVersion: string
  responsavel: string
  escopo: 'total' | 'parcial'
  unidadeId?: string // Selecionada na UI
  updatedAt: string
}

export type CensoPendenciaTipo = 'critica' | 'alta' | 'media' | 'baixa' | 'informativa'
export type CensoPendenciaStatus = 'aberta' | 'em_tratamento' | 'corrigida' | 'ignorada' | 'reaberta'
export type CensoPendenciaCategoria = 'aluno' | 'turma' | 'escola' | 'profissional'

export interface CensoPendencia {
  id: string
  tipo: CensoPendenciaTipo
  categoria: CensoPendenciaCategoria
  nivel: number           // 1=obrigatoriedade, 2=consistência, 3=regra negócio
  registroId: string
  registroNome: string
  campo: string
  valorAtual: string
  valorEsperado: string
  descricao: string
  sugestao: string
  status: CensoPendenciaStatus
  responsavel?: string
  justificativaIgnore?: string
  comentarios?: string[]
  criadoEm: string
  resolvidoEm?: string
  revalidadoEm?: string
  anoCensitario: number
  etapa: string
}

export interface CensoExport {
  id: string
  anoCensitario: number
  etapa: string
  layoutVersion: string
  dataGeracao: string
  usuarioGerou: string
  totalRegistros: number
  totalAlunos: number
  totalTurmas: number
  totalProfissionais: number
  hash: string
  nomeArquivo: string
  conteudo?: string     // base64 do arquivo gerado
  status: 'gerado' | 'baixado' | 'enviado' | 'rejeitado'
  pendenciasNaMomento: number
  observacoes?: string
}

export interface CensoAuditLog {
  id: string
  dataHora: string
  usuario: string
  perfil: string
  acao: string
  modulo: string
  tela?: string
  registroId?: string
  registroNome?: string
  valorAnterior?: string
  valorNovo?: string
  justificativa?: string
  ip?: string
  anoCensitario?: number
  etapa?: string
}

export interface CensoChecklistItem {
  id: string
  descricao: string
  concluido: boolean
  obrigatorio: boolean
  ordem: number
}

export interface CensoOperacaoEnvio {
  id: string
  exportId: string
  anoCensitario: number
  etapa: string
  dataOperacao: string
  usuario: string
  checklist: Record<string, boolean>
  protocolo?: string
  resultado: 'enviado' | 'rejeitado' | 'pendente' | 'aguardando' | 'enviado_com_alerta'
  observacoes?: string
  comprovante?: string
  linkEducacenso?: string
}

export interface CensoAlunoData {
  alunoId: string
  sexo: '1' | '2'                    // 1=Masculino 2=Feminino (código INEP)
  corRaca: '0'|'1'|'2'|'3'|'4'|'5'  // 0=NID 1=Branca 2=Preta 3=Parda 4=Amarela 5=Indígena
  nacionalidade: '1'|'2'|'3'         // 1=Brasileira 2=Naturalizada 3=Estrangeira
  naturalidadeUF: string              // UF de nascimento
  naturalidadeMunicipio: string
  deficiencia: boolean
  tiposDeficiencia: string[]          // Ex: ['01','02'] → códigos INEP
  tipoAtendimento: '1'|'2'|'3'|'4'|'5'|'6'  // 1=Regular 4=AEE 5=AEE+Regular
  etapaModalidade: string             // Ex: 'EI','EF1','EF2','EM','EJA'
  situacaoCenso: '1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'  // situação final Etapa 2
  dataMatricula: string               // YYYY-MM-DD
  tipoMatricula: '1'|'2'|'3'         // 1=Regular 2=Rematrícula 3=Novo
  updatedAt: string
}

export interface CensoTurmaData {
  turmaId: string
  etapaModalidade: string             // Código INEP da etapa
  codigoINEP: string                  // Código da turma no Educacenso
  tipoAtendimento: '0'|'1'|'2'|'3'|'4'|'5'|'6'
  tipoMediacaoDidatica: '1'|'2'|'3'  // 1=Presencial 2=Semipresencial 3=EAD
  localizacaoDiferenciada: '0'|'1'|'2'|'3'  // 0=Não 1=Área de Assentamento etc.
  updatedAt: string
}

export interface CensoProfissionalData {
  funcionarioId: string
  cpf: string
  funcaoDocente: string               // Código da função INEP
  escolaridade: '1'|'2'|'3'|'4'|'5'|'6'|'7'  // Nível INEP
  turmasVinculadas: {
    turmaId: string
    turmaNome: string
    disciplinaId: string
    disciplinaNome: string
    cargaHoraria: number
  }[]
  updatedAt: string
}

// ─── Tabelas de Referência INEP (exportadas para uso em toda a aplicação) ──
export const INEP_ETAPAS: { codigo: string; nome: string; grupo: string }[] = [
  { codigo: 'EI01', nome: 'Creche', grupo: 'Educação Infantil' },
  { codigo: 'EI02', nome: 'Pré-Escola', grupo: 'Educação Infantil' },
  { codigo: 'EF01', nome: '1º Ano EF', grupo: 'EF Anos Iniciais' },
  { codigo: 'EF02', nome: '2º Ano EF', grupo: 'EF Anos Iniciais' },
  { codigo: 'EF03', nome: '3º Ano EF', grupo: 'EF Anos Iniciais' },
  { codigo: 'EF04', nome: '4º Ano EF', grupo: 'EF Anos Iniciais' },
  { codigo: 'EF05', nome: '5º Ano EF', grupo: 'EF Anos Iniciais' },
  { codigo: 'EF06', nome: '6º Ano EF', grupo: 'EF Anos Finais' },
  { codigo: 'EF07', nome: '7º Ano EF', grupo: 'EF Anos Finais' },
  { codigo: 'EF08', nome: '8º Ano EF', grupo: 'EF Anos Finais' },
  { codigo: 'EF09', nome: '9º Ano EF', grupo: 'EF Anos Finais' },
  { codigo: 'EM01', nome: '1ª Série EM', grupo: 'Ensino Médio' },
  { codigo: 'EM02', nome: '2ª Série EM', grupo: 'Ensino Médio' },
  { codigo: 'EM03', nome: '3ª Série EM', grupo: 'Ensino Médio' },
  { codigo: 'EJA01', nome: 'EJA EF Fase Inicial', grupo: 'EJA' },
  { codigo: 'EJA02', nome: 'EJA EF Fase Final', grupo: 'EJA' },
  { codigo: 'EJA03', nome: 'EJA EM', grupo: 'EJA' },
]

export const INEP_SITUACOES_CENSO: { codigo: string; nome: string }[] = [
  { codigo: '1', nome: 'Aprovado' },
  { codigo: '2', nome: 'Reprovado' },
  { codigo: '3', nome: 'Transferido' },
  { codigo: '4', nome: 'Deixou de frequentar (Abandono)' },
  { codigo: '5', nome: 'Falecido' },
  { codigo: '6', nome: 'Aprovado pelo Conselho' },
  { codigo: '7', nome: 'Reprovado por Falta' },
  { codigo: '8', nome: 'Ainda matriculado' },
  { codigo: '9', nome: 'Cursando (EJA)' },
]

export const INEP_FUNCOES_DOCENTES: { codigo: string; nome: string }[] = [
  { codigo: '1', nome: 'Docente' },
  { codigo: '2', nome: 'Docente – Atividade Complementar' },
  { codigo: '3', nome: 'Docente – AEE' },
  { codigo: '67', nome: 'Auxiliar / Assistente Educacional' },
  { codigo: '68', nome: 'Profissional de Apoio Escolar' },
]

export const INEP_COR_RACA: { codigo: string; nome: string }[] = [
  { codigo: '0', nome: 'Não declarado' },
  { codigo: '1', nome: 'Branca' },
  { codigo: '2', nome: 'Preta' },
  { codigo: '3', nome: 'Parda' },
  { codigo: '4', nome: 'Amarela' },
  { codigo: '5', nome: 'Indígena' },
]

export const INEP_DEFICIENCIAS: { codigo: string; nome: string }[] = [
  { codigo: '01', nome: 'Cegueira' },
  { codigo: '02', nome: 'Baixa Visão' },
  { codigo: '03', nome: 'Surdez' },
  { codigo: '04', nome: 'Deficiência Auditiva' },
  { codigo: '05', nome: 'Surdocegueira' },
  { codigo: '06', nome: 'Deficiência Física' },
  { codigo: '07', nome: 'Deficiência Intelectual' },
  { codigo: '08', nome: 'Deficiência Múltipla' },
  { codigo: '09', nome: 'Autismo Infantil (TEA)' },
  { codigo: '10', nome: 'Síndrome de Asperger' },
  { codigo: '11', nome: 'Síndrome de Rett' },
  { codigo: '12', nome: 'Transtorno Desintegrativo da Infância' },
  { codigo: '13', nome: 'Altas Habilidades / Superdotação' },
]

export const INEP_TIPO_ATENDIMENTO: { codigo: string; nome: string }[] = [
  { codigo: '1', nome: 'Escolarização (Classe Comum)' },
  { codigo: '2', nome: 'Escolarização (Classe Especial EE)' },
  { codigo: '3', nome: 'Atividade Complementar' },
  { codigo: '4', nome: 'AEE' },
  { codigo: '5', nome: 'Escolarização e AEE na mesma escola' },
  { codigo: '6', nome: 'Escolarização e AEE em escola diferente' },
]

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
  perfis: 'edu-sys-perfis',
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
  cfgGruposDRE: 'edu-cfg-grupos-dre',
  dreConfig: 'edu-cfg-dre-config',
  // Operações
  cfgCalendarioLetivo: 'edu-cfg-calendario-letivo',
  movimentacoesManuais: 'edu-op-movimentacoes',
  caixasAbertos: 'edu-op-caixas',
  fornecedoresCad: 'edu-op-fornecedores',
  advertencias: 'edu-rh-advertencias',
  adiantamentos: 'edu-rh-adiantamentos',
  systemLogs: 'edu-data-system-logs',
  // Censo Escolar
  censoConfig: 'edu-censo-config',
  censoPendencias: 'edu-censo-pendencias',
  censoExports: 'edu-censo-exports',
  censoAuditLogs: 'edu-censo-audit-logs',
  censoOperacoes: 'edu-censo-operacoes',
  // Dados de Enriquecimento Censitário (camada separada do ERP)
  censoAlunosData: 'edu-censo-alunos-data',
  censoTurmasData: 'edu-censo-turmas-data',
  censoProfsData: 'edu-censo-profs-data',
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

// ─── Grupos DRE Padrão ───────────────────────────────────────────
const GRUPOS_DRE_DEFAULT: ConfigGrupoDRE[] = [
  { id: 'GD01', codigo: 'RECEITA_BRUTA',          nome: 'Receita Bruta',                 nomeCurto: 'Rec. Bruta',     tipo: 'receita',     natureza: 'credora',   ordem: 1,  nivel: 'grupo',    exibir: true, corDestaque: '#10b981', createdAt: new Date().toISOString() },
  { id: 'GD02', codigo: 'DEDUCAO_RECEITA',         nome: 'Deduções da Receita',           nomeCurto: 'Deduções',       tipo: 'deducao',     natureza: 'devedora',  ordem: 2,  nivel: 'grupo',    exibir: true, corDestaque: '#f59e0b', createdAt: new Date().toISOString() },
  { id: 'GD03', codigo: 'RECEITA_LIQUIDA',         nome: 'Receita Líquida',               nomeCurto: 'Rec. Líquida',   tipo: 'resultado',   natureza: 'calculado', formula: 'RECEITA_BRUTA - DEDUCAO_RECEITA',          ordem: 3,  nivel: 'subtotal', exibir: true, corDestaque: '#3b82f6', createdAt: new Date().toISOString() },
  { id: 'GD04', codigo: 'CUSTO_SERVICO',           nome: 'Custos dos Serviços Prestados', nomeCurto: 'Custos Diretos', tipo: 'custo',       natureza: 'devedora',  ordem: 4,  nivel: 'grupo',    exibir: true, corDestaque: '#ef4444', createdAt: new Date().toISOString() },
  { id: 'GD05', codigo: 'LUCRO_BRUTO',             nome: 'Lucro Bruto',                   nomeCurto: 'Lucro Bruto',    tipo: 'resultado',   natureza: 'calculado', formula: 'RECEITA_LIQUIDA - CUSTO_SERVICO',           ordem: 5,  nivel: 'subtotal', exibir: true, corDestaque: '#10b981', createdAt: new Date().toISOString() },
  { id: 'GD06', codigo: 'DESP_ADMINISTRATIVA',     nome: 'Despesas Administrativas',      nomeCurto: 'Desp. Admin.',   tipo: 'despesa',     natureza: 'devedora',  ordem: 6,  nivel: 'grupo',    exibir: true, corDestaque: '#ef4444', createdAt: new Date().toISOString() },
  { id: 'GD07', codigo: 'DESP_COMERCIAL',          nome: 'Despesas Comerciais / Marketing', nomeCurto: 'Marketing',    tipo: 'despesa',     natureza: 'devedora',  ordem: 7,  nivel: 'grupo',    exibir: true, corDestaque: '#ef4444', createdAt: new Date().toISOString() },
  { id: 'GD08', codigo: 'RESULTADO_OPERACIONAL',   nome: 'Resultado Operacional',         nomeCurto: 'EBITDA',         tipo: 'resultado',   natureza: 'calculado', formula: 'LUCRO_BRUTO - DESP_ADMINISTRATIVA - DESP_COMERCIAL', ordem: 8, nivel: 'subtotal', exibir: true, corDestaque: '#3b82f6', createdAt: new Date().toISOString() },
  { id: 'GD09', codigo: 'RESULTADO_FINANCEIRO',    nome: 'Resultado Financeiro',          nomeCurto: 'Res. Financeiro',tipo: 'resultado',   natureza: 'calculado', formula: 'RECEITAS_FINANCEIRAS - DESPESAS_FINANCEIRAS', ordem: 9, nivel: 'grupo',    exibir: true, corDestaque: '#8b5cf6', createdAt: new Date().toISOString() },
  { id: 'GD10', codigo: 'RESULTADO_ANTES_IMPOSTOS',nome: 'Resultado Antes dos Impostos',  nomeCurto: 'LAIR',           tipo: 'resultado',   natureza: 'calculado', formula: 'RESULTADO_OPERACIONAL + RESULTADO_FINANCEIRO', ordem: 10, nivel: 'subtotal', exibir: true, corDestaque: '#3b82f6', createdAt: new Date().toISOString() },
  { id: 'GD11', codigo: 'IMPOSTOS',                nome: 'Impostos e Tributos',           nomeCurto: 'Impostos',       tipo: 'imposto',     natureza: 'devedora',  ordem: 11, nivel: 'grupo',    exibir: true, corDestaque: '#ef4444', createdAt: new Date().toISOString() },
  { id: 'GD12', codigo: 'LUCRO_LIQUIDO',           nome: 'Lucro Líquido do Exercício',    nomeCurto: 'Lucro Líquido',  tipo: 'resultado',   natureza: 'calculado', formula: 'RESULTADO_ANTES_IMPOSTOS - IMPOSTOS',         ordem: 12, nivel: 'total',    exibir: true, corDestaque: '#10b981', createdAt: new Date().toISOString() },
  { id: 'GD13', codigo: 'INVESTIMENTOS',           nome: 'Investimentos (Patrimônio)',    nomeCurto: 'Investimentos',  tipo: 'informativo', natureza: 'devedora',  ordem: 13, nivel: 'grupo',    exibir: true, corDestaque: '#f59e0b', createdAt: new Date().toISOString() },
  { id: 'GD14', codigo: 'SEM_CLASSIFICACAO',       nome: 'Não Classificados (Legado)',    nomeCurto: 'Sem Classif.',   tipo: 'informativo', natureza: 'neutra',    ordem: 14, nivel: 'grupo',    exibir: true, corDestaque: '#6b7280', createdAt: new Date().toISOString() },
] as unknown as ConfigGrupoDRE[]

const DRE_CONFIG_DEFAULT: DREConfig = {
  id: 'DRE_CFG_1',
  regimeApuracao: 'caixa',
  exibirZerados: false,
  exibirContasInativas: false,
  periodosFechados: [],
  updatedAt: new Date().toISOString(),
}

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
  { id: 'S1',  codigo: 'APR', nome: 'Aprovado',            tipo: 'Historico',   situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S2',  codigo: 'APP', nome: 'Aprovado com P/P',   tipo: 'Historico',   situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S3',  codigo: 'CON', nome: 'Concluído',           tipo: 'Historico',   situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S4',  codigo: 'CUR', nome: 'Cursando',            tipo: 'Ativo',       situacao: 'ativo',   matriculaAtiva: true,  createdAt: new Date().toISOString() },
  { id: 'S5',  codigo: 'DES', nome: 'Desistente',          tipo: 'Inativo',     situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S6',  codigo: 'CAN', nome: 'Matrícula cancelada', tipo: 'Cancelado',   situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S7',  codigo: 'TRA', nome: 'Matrícula trancada',  tipo: 'Inativo',     situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S8',  codigo: 'REM', nome: 'Remanejado',          tipo: 'Transferido', situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S9',  codigo: 'REP', nome: 'Reprovado',           tipo: 'Historico',   situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S10', codigo: 'RPF', nome: 'Reprovado por falta', tipo: 'Historico',   situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S11', codigo: 'TRF', nome: 'Transferido',         tipo: 'Transferido', situacao: 'ativo',   matriculaAtiva: false, createdAt: new Date().toISOString() },
  { id: 'S12', codigo: 'PC',  nome: 'Prog. Continuada',    tipo: 'Ativo',       situacao: 'ativo',   matriculaAtiva: true,  createdAt: new Date().toISOString() },
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

export interface UnidadeFiscal {
  id: string
  nome: string
  cnpj: string
  inscricaoMunicipal: string
  cnae: string
  municipio: string
  codigoMunicipio?: string    // Código IBGE do município
  uf?: string
  ambiente: 'homologacao' | 'producao'
  serieNF: string
  aliquota: number
  tributacao: string
  situacao: 'ativo' | 'inativo'
  createdAt: string
  // ── Provedor NFS-e ──────────────────────────────────────────────────────────
  provedor?: 'nfeio' | 'enotas' | 'tecnospeed' | 'abrasf' | 'mock'
  apiKey?: string             // API Key do provedor intermediário
  apiSecret?: string          // Secret (eNotas, Tecnospeed)
  companyId?: string          // Company ID no provedor (NFE.io usa CNPJ ou ID)
  urlWebservice?: string      // URL do webservice SOAP (modo direto ABRASF)
  // ── Numeração RPS ───────────────────────────────────────────────────────────
  proximoRps?: number         // Próximo número de RPS a emitir
  serieRps?: string           // Série do RPS (ex: "A")
  // ── Email prestador ─────────────────────────────────────────────────────────
  email?: string
  telefone?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
}

export interface NotaFiscal {
  id: string
  unidadeId: string
  numero: string              // Número oficial da NFS-e (retornado pela prefeitura)
  rpsNumero?: string          // Número do RPS enviado
  rpsSerie?: string           // Série do RPS
  aluno: string
  responsavel: string
  tomadorCpfCnpj?: string     // CPF/CNPJ do tomador
  valor: number
  competencia: string
  dataEmissao: string
  status: 'emitida' | 'pendente' | 'processando' | 'cancelada' | 'erro'
  chave?: string              // Chave de autenticação da NFS-e
  chaveNFSe?: string          // Código de verificação da prefeitura
  protocolo?: string          // Protocolo de transmissão
  tituloId?: string
  // ── Resposta da API ─────────────────────────────────────────────────────────
  provedorId?: string         // ID interno do registro no provedor intermediário
  xmlRps?: string             // XML do RPS enviado
  xmlRetorno?: string         // XML de retorno da prefeitura
  erroDescricao?: string      // Descrição do erro se status=erro
  erroCorrecao?: string       // Sugestão de correção
  linkVisualizacao?: string   // URL para visualizar NFS-e no portal da prefeitura
  linkDownloadPdf?: string    // URL para download do PDF oficial
}

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
  cfgGruposDRE: ConfigGrupoDRE[]; setCfgGruposDRE: Setter<ConfigGrupoDRE[]>
  dreConfig: DREConfig; setDreConfig: Setter<DREConfig>
  cfgCalendarioLetivo: ConfigCalendarioLetivo[]; setCfgCalendarioLetivo: Setter<ConfigCalendarioLetivo[]>
  // Operações Financeiras
  movimentacoesManuais: MovimentacaoManual[]; setMovimentacoesManuais: Setter<MovimentacaoManual[]>
  caixasAbertos: CaixaAberta[]; setCaixasAbertos: Setter<CaixaAberta[]>
  fornecedoresCad: FornecedorCad[]; setFornecedoresCad: Setter<FornecedorCad[]>
  unidadesFiscais: UnidadeFiscal[]; setUnidadesFiscais: Setter<UnidadeFiscal[]>
  notasFiscais: NotaFiscal[]; setNotasFiscais: Setter<NotaFiscal[]>
  // RH
  advertencias: Advertencia[]; setAdvertencias: Setter<Advertencia[]>
  adiantamentos: Adiantamento[]; setAdiantamentos: Setter<Adiantamento[]>
  systemLogs: SystemLog[]; setSystemLogs: Setter<SystemLog[]>
  logSystemAction: (modulo: string, acao: string, descricao: string, payload?: Partial<SystemLog>) => void
  wipeAll: () => void
  // Censo Escolar
  censoConfig: CensoConfig; setCensoConfig: (v: CensoConfig) => void
  censoPendencias: CensoPendencia[]; setCensoPendencias: Setter<CensoPendencia[]>
  censoExports: CensoExport[]; setCensoExports: Setter<CensoExport[]>
  censoAuditLogs: CensoAuditLog[]; setCensoAuditLogs: Setter<CensoAuditLog[]>
  censoOperacoes: CensoOperacaoEnvio[]; setCensoOperacoes: Setter<CensoOperacaoEnvio[]>
  logCensoAction: (acao: string, modulo: string, payload?: Partial<CensoAuditLog>) => void
  // Enriquecimento Censitário
  censoAlunosData: CensoAlunoData[]; setCensoAlunosData: Setter<CensoAlunoData[]>
  censoTurmasData: CensoTurmaData[]; setCensoTurmasData: Setter<CensoTurmaData[]>
  censoProfsData: CensoProfissionalData[]; setCensoProfsData: Setter<CensoProfissionalData[]>
  perfis: Perfil[]; setPerfis: Setter<Perfil[]>
}

export const DEFAULT_PERFIS: Perfil[] = [
  { id: 'P1', nome: 'Diretor Geral', cor: '#ef4444', descricao: 'Acesso total ao sistema', permissoes: ['principal','agenda-digital','academico','financeiro','rh','crm','portaria','administrativo','bi','relatorios','multiUnidades','configuracoes','/dashboard','/alertas','/tarefas','/calendario','/agenda-digital','/academico/alunos','/academico/alunos/ficha','/academico/responsaveis','/academico/transferencias','/crm/rematricula','/academico/turmas','/academico/grade','/academico/ensalamento','/academico/frequencia','/academico/notas','/academico/ocorrencias','/academico/conselho','/secretaria/documentos','/secretaria','/financeiro/receber','/financeiro/inadimplencia','/financeiro/renegociacao','/financeiro/pagar','/financeiro/movimentacoes','/financeiro/boletos','/financeiro/nf','/financeiro/banking','/financeiro/dre','/financeiro/custos','/rh/funcionarios','/rh/folha','/rh/adiantamentos','/rh/ponto','/rh/ferias','/rh/advertencias','/crm/leads','/crm/agendamentos','/crm/retencao','/painel-tablet','/saida-alunos/monitor','/saida-alunos/chamadas','/saida-alunos/relatorios','/saida-alunos/configuracoes','/administrativo/fornecedores','/administrativo/caixa','/administrativo/patrimonio','/administrativo/almoxarifado','/administrativo/pedidos-livros','/administrativo/manutencao','/configuracoes/pedagogico/turnos','/configuracoes/pedagogico/situacao-aluno','/configuracoes/pedagogico/grupo-alunos','/configuracoes/pedagogico/disciplinas','/configuracoes/pedagogico/niveis-ensino','/configuracoes/pedagogico/tipo-ocorrencias','/configuracoes/pedagogico/esquema-avaliacao','/configuracoes/pedagogico/horario','/configuracoes/pedagogico/config-notas','/configuracoes/pedagogico/documentos','/configuracoes/financeiro/centro-custo','/configuracoes/financeiro/cartoes','/configuracoes/financeiro/eventos','/configuracoes/financeiro/grupo-desconto','/configuracoes/financeiro/metodos-pagamento','/configuracoes/financeiro/padrao-pagamento','/configuracoes/financeiro/plano-contas','/configuracoes/financeiro/tipo-documentos','/configuracoes/financeiro/dre-config','/bi','/ia/copilotos','/ia/insights','/relatorios/censo','/relatorios/mec','/configuracoes/unidades','/configuracoes/usuarios','/configuracoes/integracoes','/configuracoes','/configuracoes/logs','/ajuda'] },
  { id: 'P2', nome: 'Coordenador', cor: '#f59e0b', descricao: 'Área pedagógica e RH', permissoes: ['dashboard','/dashboard','/alertas','/tarefas','/calendario','principal','academico','/academico/alunos','/academico/alunos/ficha','/academico/responsaveis','/academico/transferencias','/academico/turmas','/academico/grade','/academico/ensalamento','/academico/frequencia','/academico/notas','/academico/ocorrencias','/academico/conselho','/secretaria/documentos','/secretaria','rh','/rh/funcionarios','/rh/folha','/rh/adiantamentos','/rh/ponto','/rh/ferias','/rh/advertencias'] },
  { id: 'P3', nome: 'Secretária', cor: '#3b82f6', descricao: 'Secretaria e acadêmico', permissoes: ['dashboard','/dashboard','/alertas','/tarefas','/calendario','principal','academico','/academico/alunos','/academico/alunos/ficha','/academico/responsaveis','/academico/transferencias','/academico/turmas','/academico/grade','/academico/ensalamento','/academico/frequencia','/academico/notas','/academico/ocorrencias','/academico/conselho','/secretaria/documentos','/secretaria'] },
  { id: 'P4', nome: 'Professor', cor: '#10b981', descricao: 'Diário, notas e frequência', permissoes: ['dashboard','/dashboard','/alertas','/tarefas','/calendario','principal','academico','/academico/frequencia','/academico/notas','/academico/ocorrencias','/academico/grade'] },
  { id: 'P5', nome: 'Financeiro', cor: '#8b5cf6', descricao: 'Módulo financeiro e relatórios', permissoes: ['dashboard','/dashboard','/alertas','/tarefas','/calendario','principal','financeiro','/financeiro/receber','/financeiro/inadimplencia','/financeiro/renegociacao','/financeiro/pagar','/financeiro/movimentacoes','/financeiro/boletos','/financeiro/nf','/financeiro/banking','/financeiro/dre','/financeiro/custos','relatorios','/bi','/relatorios/censo','/relatorios/mec'] },
  { id: 'P6', nome: 'Portaria & Segurança', cor: '#64748b', descricao: 'Controle de acesso e saída', permissoes: ['dashboard','/dashboard','/alertas','/tarefas','/calendario','principal','portaria','/painel-tablet','/saida-alunos/monitor','/saida-alunos/chamadas','/saida-alunos/relatorios','/saida-alunos/configuracoes'] },
]

const NOOP = () => {}
const DataContext = createContext<DataState>({
  // Arrays  — safe empty defaults to prevent .filter()/.map() crashes during initial render
  alunos: [], setAlunos: NOOP,
  turmas: [], setTurmas: NOOP,
  funcionarios: [], setFuncionarios: NOOP,
  leads: [], setLeads: NOOP,
  titulos: [], setTitulos: NOOP,
  contasPagar: [], setContasPagar: NOOP,
  agendamentos: [], setAgendamentos: NOOP,
  comunicados: [], setComunicados: NOOP,
  tarefas: [], setTarefas: NOOP,
  mantenedores: [], setMantenedores: NOOP,
  eventosAgenda: [], setEventosAgenda: NOOP,
  rotinaItems: [], setRotinaItems: NOOP,
  autorizacoes: [], setAutorizacoes: NOOP,
  momentos: [], setMomentos: NOOP,
  enquetes: [], setEnquetes: NOOP,
  ocorrencias: [], setOcorrencias: NOOP,
  transferencias: [], setTransferencias: NOOP,
  frequencias: [], setFrequencias: NOOP,
  lancamentosNota: [], setLancamentosNota: NOOP,
  cfgTurnos: [], setCfgTurnos: NOOP,
  cfgSituacaoAluno: [], setCfgSituacaoAluno: NOOP,
  cfgGruposAlunos: [], setCfgGruposAlunos: NOOP,
  cfgDisciplinas: [], setCfgDisciplinas: NOOP,
  cfgNiveisEnsino: [], setCfgNiveisEnsino: NOOP,
  cfgTiposOcorrencia: [], setCfgTiposOcorrencia: NOOP,
  cfgEsquemasAvaliacao: [], setCfgEsquemasAvaliacao: NOOP,
  cfgCentrosCusto: [], setCfgCentrosCusto: NOOP,
  cfgMetodosPagamento: [], setCfgMetodosPagamento: NOOP,
  cfgCartoes: [], setCfgCartoes: NOOP,
  cfgEventos: [], setCfgEventos: NOOP,
  cfgGruposDesconto: [], setCfgGruposDesconto: NOOP,
  cfgPadroesPagamento: [], setCfgPadroesPagamento: NOOP,
  cfgPlanoContas: [], setCfgPlanoContas: NOOP,
  cfgTiposDocumento: [], setCfgTiposDocumento: NOOP,
  cfgConvenios: [], setCfgConvenios: NOOP,
  cfgGruposDRE: [], setCfgGruposDRE: NOOP,
  cfgCalendarioLetivo: [], setCfgCalendarioLetivo: NOOP,
  movimentacoesManuais: [], setMovimentacoesManuais: NOOP,
  caixasAbertos: [], setCaixasAbertos: NOOP,
  fornecedoresCad: [], setFornecedoresCad: NOOP,
  unidadesFiscais: [], setUnidadesFiscais: NOOP,
  notasFiscais: [], setNotasFiscais: NOOP,
  advertencias: [], setAdvertencias: NOOP,
  adiantamentos: [], setAdiantamentos: NOOP,
  systemLogs: [], setSystemLogs: NOOP,
  perfis: [], setPerfis: NOOP,
  censoAuditLogs: [], setCensoAuditLogs: NOOP,
  censoOperacoes: [], setCensoOperacoes: NOOP,
  censoAlunosData: [], setCensoAlunosData: NOOP,
  censoTurmasData: [], setCensoTurmasData: NOOP,
  censoProfsData: [], setCensoProfsData: NOOP,
  censoPendencias: [], setCensoPendencias: NOOP,
  censoExports: [], setCensoExports: NOOP,
  // Non-arrays with safe defaults
  dreConfig: {} as any, setDreConfig: NOOP,
  censoConfig: {} as any, setCensoConfig: NOOP,
  logSystemAction: NOOP,
  logCensoAction: NOOP,
  wipeAll: NOOP,
} as unknown as DataState)

import { ADIANTAMENTOS } from './data'

export function DataProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem(KEYS.version)
    if (stored !== DATA_VERSION) {
      // Preserve only user session — NOT perfis (needs reset to new DEFAULT_PERFIS with correct keys)
      const currentUser = localStorage.getItem('edu-current-user')
      localStorage.clear()
      localStorage.setItem(KEYS.version, DATA_VERSION)
      if (currentUser) localStorage.setItem('edu-current-user', currentUser)
      window.location.reload()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // ── DADOS PRIMÁRIOS — persistidos no Supabase ──────────────────────
  const [alunos, setAlunos] = useSupabaseArray<Aluno>('alunos')
  const [turmas, setTurmas] = useSupabaseArray<Turma>('turmas')
  const [funcionarios, setFuncionarios] = useSupabaseArray<Funcionario>('rh/funcionarios')
  const [leads, setLeads] = useSupabaseArray<Lead>('leads')
  const [titulos, setTitulos] = useSupabaseArray<Titulo>('titulos')
  const [contasPagar, setContasPagar] = useSupabaseArray<ContaPagar>('contas-pagar')
  const [agendamentos, setAgendamentos] = useSupabaseArray<Agendamento>('agendamentos')
  const [comunicados, setComunicados] = useSupabaseArray<Comunicado>('comunicados')
  const [tarefas, setTarefas] = useSupabaseArray<Tarefa>('tarefas')
  const [mantenedores, setMantenedores] = useSupabaseArray<Mantenedor>('configuracoes/mantenedores')
  const [eventosAgenda, setEventosAgenda] = useLocalStorage<EventoAgenda[]>(KEYS.eventosAgenda, [])
  const [rotinaItems, setRotinaItems] = useLocalStorage<RotinaItem[]>(KEYS.rotinaItems, [])
  const [autorizacoes, setAutorizacoes] = useLocalStorage<AutorizacaoDigital[]>(KEYS.autorizacoes, [])
  const [momentos, setMomentos] = useLocalStorage<MomentoItem[]>(KEYS.momentos, [])
  const [enquetes, setEnquetes] = useLocalStorage<Enquete[]>(KEYS.enquetes, [])
  const [ocorrencias, setOcorrencias] = useSupabaseArray<Ocorrencia>('ocorrencias')
  const [transferencias, setTransferencias] = useLocalStorage<Transferencia[]>(KEYS.transferencias, [])
  const [frequencias, setFrequencias] = useSupabaseArray<RegistroFrequencia>('academico/frequencias')
  const [lancamentosNota, setLancamentosNota] = useSupabaseArray<LancamentoNota>('academico/notas')
  // Config Pedagógico
  // ── CONFIGURAÇÕES PEDAGÓGICAS — persistidas em Supabase (tabela configuracoes) ──
  const { data: cfgTurnos, setData: setCfgTurnos } = useConfigDb<ConfigTurno>('cfgTurnos')
  const { data: cfgSituacaoAluno, setData: setCfgSituacaoAluno } = useConfigDb<ConfigSituacaoAluno>('cfgSituacaoAluno')
  const { data: cfgGruposAlunos, setData: setCfgGruposAlunos } = useConfigDb<ConfigGrupoAluno>('cfgGruposAlunos')
  const { data: cfgDisciplinas, setData: setCfgDisciplinas } = useConfigDb<ConfigDisciplina>('cfgDisciplinas')
  const { data: cfgNiveisEnsino, setData: setCfgNiveisEnsino } = useConfigDb<ConfigNivelEnsino>('cfgNiveisEnsino')
  const { data: cfgTiposOcorrencia, setData: setCfgTiposOcorrencia } = useConfigDb<ConfigTipoOcorrencia>('cfgTiposOcorrencia')
  const { data: cfgEsquemasAvaliacao, setData: setCfgEsquemasAvaliacao } = useConfigDb<ConfigEsquemaAvaliacao>('cfgEsquemasAvaliacao')
  // ── CONFIGURAÇÕES FINANCEIRAS — persistidas em Supabase (tabela configuracoes) ──
  const { data: cfgCentrosCusto, setData: setCfgCentrosCusto } = useConfigDb<ConfigCentroCusto>('cfgCentrosCusto')
  const { data: cfgMetodosPagamento, setData: setCfgMetodosPagamento } = useConfigDb<MetodoPagamento>('cfgMetodosPagamento')
  const { data: cfgCartoes, setData: setCfgCartoes } = useConfigDb<ConfigCartao>('cfgCartoes')
  const { data: cfgEventos, setData: setCfgEventos } = useConfigDb<ConfigEvento>('cfgEventos')
  const { data: cfgGruposDesconto, setData: setCfgGruposDesconto } = useConfigDb<ConfigGrupoDesconto>('cfgGruposDesconto')
  const { data: cfgPadroesPagamento, setData: setCfgPadroesPagamento } = useConfigDb<ConfigPadraoPagamento>('cfgPadroesPagamento')
  const { data: cfgPlanoContas, setData: setCfgPlanoContas } = useConfigDb<ConfigPlanoContas>('cfgPlanoContas')
  const { data: cfgTiposDocumento, setData: setCfgTiposDocumento } = useConfigDb<ConfigTipoDocumento>('cfgTiposDocumento')
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
  const { data: cfgConvenios, setData: setCfgConvenios } = useConfigDb<ConfigConvenio>('cfgConvenios')

  const { data: cfgCalendarioLetivo, setData: setCfgCalendarioLetivo } = useConfigDb<ConfigCalendarioLetivo>('cfgCalendarioLetivo')
  const { data: cfgGruposDRE, setData: setCfgGruposDRE } = useConfigDb<ConfigGrupoDRE>('cfgGruposDRE')
  const [dreConfig, setDreConfig] = useLocalStorage<DREConfig>(KEYS.dreConfig, DRE_CONFIG_DEFAULT)
  // ── OPERAÇÕES FINANCEIRAS — persistidas no Supabase ────────────────
  const [movimentacoesManuais, setMovimentacoesManuais] = useSupabaseArray<MovimentacaoManual>('financeiro/movimentacoes')
  const [caixasAbertos, setCaixasAbertos] = useLocalStorage<CaixaAberta[]>(KEYS.caixasAbertos, [])
  const [fornecedoresCad, setFornecedoresCad] = useSupabaseArray<FornecedorCad>('fornecedores')
  const [unidadesFiscais, setUnidadesFiscais] = useLocalStorage<UnidadeFiscal[]>('edu-cfg-unidades-fiscais', [])
  const [notasFiscais, setNotasFiscais] = useLocalStorage<NotaFiscal[]>('edu-op-notas-fiscais', [])
  const [advertencias, setAdvertencias] = useLocalStorage<Advertencia[]>(KEYS.advertencias, [])
  const [adiantamentos, setAdiantamentos] = useLocalStorage<Adiantamento[]>(KEYS.adiantamentos, ADIANTAMENTOS)

  // ── SYSTEM LOGS — persistidos no Supabase ──────────────────────────
  const [systemLogs, setSystemLogs] = useSupabaseArray<SystemLog>('system-logs')

  const [perfis, setPerfisRaw] = useLocalStorage<Perfil[]>('edu-perfis', DEFAULT_PERFIS)

  // Censo Escolar
  const CENSO_CONFIG_DEFAULT: CensoConfig = {
    anoCensitario: new Date().getFullYear(),
    etapaAtiva: '1-matricula',
    layoutVersion: '2024',
    responsavel: '',
    escopo: 'total',
    updatedAt: new Date().toISOString(),
  }
  const [censoConfig, setCensoConfigRaw] = useLocalStorage<CensoConfig>(KEYS.censoConfig, CENSO_CONFIG_DEFAULT)
  const setCensoConfig = useCallback((v: CensoConfig) => setCensoConfigRaw(v), [setCensoConfigRaw])
  const [censoPendencias, setCensoPendencias] = useLocalStorage<CensoPendencia[]>(KEYS.censoPendencias, [])
  const [censoExports, setCensoExports] = useLocalStorage<CensoExport[]>(KEYS.censoExports, [])
  const [censoAuditLogs, setCensoAuditLogs] = useLocalStorage<CensoAuditLog[]>(KEYS.censoAuditLogs, [])
  const [censoOperacoes, setCensoOperacoes] = useLocalStorage<CensoOperacaoEnvio[]>(KEYS.censoOperacoes, [])
  // Enriquecimento Censitário
  const [censoAlunosData, setCensoAlunosData] = useLocalStorage<CensoAlunoData[]>(KEYS.censoAlunosData, [])
  const [censoTurmasData, setCensoTurmasData] = useLocalStorage<CensoTurmaData[]>(KEYS.censoTurmasData, [])
  const [censoProfsData, setCensoProfsData] = useLocalStorage<CensoProfissionalData[]>(KEYS.censoProfsData, [])

  const logCensoAction = useCallback((acao: string, modulo: string, payload?: Partial<CensoAuditLog>) => {
    let userName = 'Admin Local'
    let userPerfil = 'Administrador'
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(window.localStorage.getItem('edu-current-user') || 'null')
        if (u && u.nome) { userName = u.nome; userPerfil = u.perfil || 'Usuário' }
      } catch (e) {}
    }
    const log: CensoAuditLog = {
      id: `CENSO-LOG-${Date.now()}`,
      dataHora: new Date().toISOString(),
      usuario: userName,
      perfil: userPerfil,
      acao,
      modulo,
      ...payload,
    }
    setCensoAuditLogs(prev => [log, ...prev].slice(0, 500))
  }, [setCensoAuditLogs])

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
    // Persist log to Supabase asynchronously (fire and forget)
    fetch('/api/system-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([newLog]),
    }).catch(() => { /* silently ignore log write errors */ })
  }, [setSystemLogs])

  const createTrackedSetter = useCallback(<T extends Record<string, any>>(
    modulo: string,
    entidadeContexto: string,
    rawSetter: Setter<T[]>
  ): Setter<T[]> => {
    return (newVal: T[] | ((prev: T[]) => T[])) => {
      rawSetter(prevArray => {
        const nextArray = typeof newVal === 'function' ? (newVal as any)(prevArray) : newVal
        // Skip expensive logging if arrays are same reference (optimistic update)
        if (prevArray === nextArray) return nextArray

        // Lightweight batch log — fire-and-forget, does not block state update
        if (Array.isArray(prevArray) && Array.isArray(nextArray)) {
          // Defer log computation to next microtask to unblock render
          Promise.resolve().then(() => {
            const newLogs: SystemLog[] = []
            const mapPrev = new Map(prevArray.map(i => [i.id || String(i), i]))
            const mapNext = new Map(nextArray.map(i => [i.id || String(i), i]))

            const sanitizeLogData = (data: any) => {
              try {
                return JSON.parse(JSON.stringify(data, (key, value) => {
                  if (typeof value === 'string') {
                    if (value.startsWith('data:')) return '[DADO/IMAGEM OMITIDO]'
                    if (value.length > 5000) return value.slice(0, 5000) + '... [TRUNCADO PELO SISTEMA DE LOG]'
                  }
                  return value
                }))
              } catch { return { error: 'data_too_complex' } }
            }

            let userName = 'Admin Local'
            let userPerfil = 'Administrador'
            if (typeof window !== 'undefined') {
              try {
                const u = JSON.parse(window.localStorage.getItem('edu-current-user') || 'null')
                if (u && u.nome) { userName = u.nome; userPerfil = u.perfil || 'Usuário' }
              } catch {}
            }

            for (const [id, nextItem] of mapNext.entries()) {
              if (!id || typeof nextItem !== 'object') continue
              const prevItem = mapPrev.get(id)
              const nomeRel = nextItem.nome || nextItem.titulo || nextItem.codigo || nextItem.descricao || nextItem.razaoSocial || `ID: ${id}`
              if (!prevItem) {
                newLogs.push({ dataHora: new Date().toISOString(), usuarioNome: userName, perfil: userPerfil, modulo, acao: 'Cadastro', descricao: `Novo registro (${entidadeContexto})`, status: 'sucesso', origem: 'sistema', registroId: String(id), nomeRelacionado: nomeRel, detalhesDepois: sanitizeLogData(nextItem) } as SystemLog)
              } else {
                // Fast shallow check before JSON comparison
                const hasChange = Object.keys(nextItem).some(k => nextItem[k] !== (prevItem as any)[k])
                if (hasChange) {
                  newLogs.push({ dataHora: new Date().toISOString(), usuarioNome: userName, perfil: userPerfil, modulo, acao: 'Edição', descricao: `Alteração (${entidadeContexto})`, status: 'sucesso', origem: 'sistema', registroId: String(id), nomeRelacionado: nomeRel, detalhesAntes: sanitizeLogData(prevItem), detalhesDepois: sanitizeLogData(nextItem) } as SystemLog)
                }
              }
            }

            for (const [id, prevItem] of mapPrev.entries()) {
              if (!id || typeof prevItem !== 'object') continue
              if (!mapNext.has(id)) {
                const nomeRel = (prevItem as any).nome || (prevItem as any).titulo || (prevItem as any).codigo || `ID: ${id}`
                newLogs.push({ dataHora: new Date().toISOString(), usuarioNome: userName, perfil: userPerfil, modulo, acao: 'Exclusão', descricao: `Removido (${entidadeContexto})`, status: 'sucesso', origem: 'sistema', registroId: String(id), nomeRelacionado: nomeRel, detalhesAntes: sanitizeLogData(prevItem) } as SystemLog)
              }
            }

            if (newLogs.length > 0) {
              setSystemLogs(prev => {
                const ts = Date.now()
                const withIds = newLogs.map((l, i) => ({ ...l, id: `LOG-${ts}-${i}` }))
                return [...withIds, ...prev].slice(0, 300)
              })
            }
          })
        }

        return nextArray
      })
    }
  }, [setSystemLogs])

  const wipeAll = useCallback(() => {
    invalidateAllCache()
    invalidateConfigCache()
    setAlunos([]); setTurmas([]); setFuncionarios([]); setLeads([])
    setTitulos([]); setContasPagar([]); setAgendamentos([])
    setComunicados([]); setTarefas([]); setMantenedores([])
    setEventosAgenda([]); setRotinaItems([]); setAutorizacoes([])
    setMomentos([]); setEnquetes([])
    setOcorrencias([]); setTransferencias([]); setFrequencias([]); setLancamentosNota([])
    setCfgDisciplinas(DISCIPLINAS_DEFAULT); setCfgNiveisEnsino(NIVEIS_DEFAULT); setCfgTiposOcorrencia(TIPOS_OCORRENCIA_DEFAULT); setCfgEsquemasAvaliacao([]); setCfgTurnos(TURNOS_DEFAULT); setCfgSituacaoAluno(SITUACOES_DEFAULT); setCfgGruposAlunos(GRUPOS_ALUNOS_DEFAULT);
    setCfgCentrosCusto([]); setCfgMetodosPagamento([]); setCfgCartoes([]); setCfgEventos([]); setCfgGruposDesconto([])
    setCfgPadroesPagamento([]); setCfgPlanoContas([]); setCfgTiposDocumento([]); setCfgConvenios([])
    setCfgGruposDRE(GRUPOS_DRE_DEFAULT); setDreConfig(DRE_CONFIG_DEFAULT)
    setMovimentacoesManuais([]); setCaixasAbertos([]); setFornecedoresCad([])
    setUnidadesFiscais([]); setNotasFiscais([])
    setAdvertencias([]); setAdiantamentos([]); setSystemLogs([])
    setCensoPendencias([]); setCensoExports([]); setCensoAuditLogs([]); setCensoOperacoes([])
    setCensoAlunosData([]); setCensoTurmasData([]); setCensoProfsData([])
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
      cfgGruposDRE, setCfgGruposDRE: createTrackedSetter('Configurações', 'Grupos DRE', setCfgGruposDRE),
      dreConfig, setDreConfig,
      movimentacoesManuais, setMovimentacoesManuais: createTrackedSetter('Financeiro', 'Movimentações Manuais', setMovimentacoesManuais),
      caixasAbertos, setCaixasAbertos: createTrackedSetter('Financeiro', 'Caixas', setCaixasAbertos),
      fornecedoresCad, setFornecedoresCad: createTrackedSetter('Operacional', 'Fornecedores', setFornecedoresCad),
      unidadesFiscais, setUnidadesFiscais,
      notasFiscais, setNotasFiscais,
      advertencias, setAdvertencias: createTrackedSetter('RH', 'Advertências', setAdvertencias),
      adiantamentos, setAdiantamentos: createTrackedSetter('RH', 'Adiantamentos', setAdiantamentos),
      systemLogs, setSystemLogs, logSystemAction,
      wipeAll,
      // Censo Escolar
      censoConfig, setCensoConfig,
      censoPendencias, setCensoPendencias,
      censoExports, setCensoExports,
      censoAuditLogs, setCensoAuditLogs,
      censoOperacoes, setCensoOperacoes,
      logCensoAction,
      // Enriquecimento Censitário
      censoAlunosData, setCensoAlunosData,
      censoTurmasData, setCensoTurmasData,
      censoProfsData, setCensoProfsData,
      perfis: (perfis && perfis.length > 0) ? perfis : DEFAULT_PERFIS,
      setPerfis: (val: any) => {
        const resolved = (perfis && perfis.length > 0) ? perfis : DEFAULT_PERFIS
        const next = typeof val === 'function' ? (val as (p: typeof resolved) => typeof resolved)(resolved) : val
        setPerfisRaw(next)
      },
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() { return useContext(DataContext) }

export function newId(prefix = 'ID'): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 10).toUpperCase()}`
}

// ─── IDs Financeiros de Eventos e Parcelas ───────────────────────────────────
// Formato: XXXXXX-NN
//   XXXXXX = 6 caracteres alfanuméricos aleatórios uppercase (ex: K4XJ2M)
//   NN     = número da parcela zero-padded 2 dígitos (01, 02 ... 12)
// Exemplo de parcelaId completo: K4XJ2M-01, K4XJ2M-02
//
// UNICIDADE garantida por:
//   - geração aleatória (36^6 ≈ 2 bilhões de combinações possíveis)
//   - verificação de colisão contra todos os IDs existentes passados pelo chamador

// Charset sem caracteres ambíguos (sem 0/O, 1/l/I)
const EVENTO_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function gerarCodigoAleatorio(len = 6): string {
  return Array.from({ length: len }, () =>
    EVENTO_CHARSET[Math.floor(Math.random() * EVENTO_CHARSET.length)]
  ).join('')
}

/**
 * Gera um novo ID único de evento financeiro — formato aleatório de 6 chars.
 * 
 * @param idsExistentes - Array de eventoIds já em uso (para verificação de colisão)
 * @returns string de 6 chars uppercase, ex: 'K4XJ2M'
 */
export function newEventoId(idsExistentes: string[] = []): string {
  const existingSet = new Set(idsExistentes.map(id => {
    // Extrai apenas a parte do evento (antes do '-')
    const base = id?.split('-')[0] || id
    return base?.toUpperCase()
  }).filter(Boolean))

  let id: string
  let tentativas = 0
  do {
    id = gerarCodigoAleatorio(6)
    tentativas++
    if (tentativas > 1000) {
      // Fallback extremamente improvável: adiciona chars extras para unicidade garantida
      id = gerarCodigoAleatorio(6) + gerarCodigoAleatorio(2)
      break
    }
  } while (existingSet.has(id))

  return id
}

/**
 * Gera o ID composto de uma parcela: 'XXXXXX-NN'
 * 
 * @param eventoId - ID do evento ex: 'K4XJ2M'
 * @param numParcela - Número da parcela (1-based)
 * @returns ex: 'K4XJ2M-01', 'K4XJ2M-12'
 */
export function newParcelaId(eventoId: string, numParcela: number): string {
  return `${eventoId}-${String(numParcela).padStart(2, '0')}`
}
