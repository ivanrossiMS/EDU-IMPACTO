/**
 * notasEngine.ts
 * Motor central de cálculo do sistema de notas do ERP.
 *
 * Define PARA CADA TipoDadoNota:
 *  - categoria: como o tipo se encaixa no processo pedagógico
 *  - funcao: papel acadêmico no fluxo de avaliação
 *  - entraNoCalculo: se compõe a Média Parcial ou Média Final
 *  - entraNaMedia: se é somado na Média Geral para aprovação
 *  - substituiNota: se pode substituir outra nota quando maior
 *  - exigeNota: se bloqueia lançamento de outros tipos sem ele
 *  - somaFaltas: se deve incrementar o contador de faltas
 *  - maxValor: valor máximo padrão (pode ser sobrescrito pelo esquema)
 *  - minAprovacao: nota mínima de aprovação neste tipo
 *  - formula: função de cálculo → recebe as notas brutas e retorna o resultado
 *  - boletimLabel: etiqueta exibida no boletim escolar
 *  - cor: cor visual para identificação rápida na UI
 *  - icone: emoji representativo
 */

import type { TipoDadoNota, EscopoLancamento, ConfigArredondamento, DetalheEsquemaNota, FormulaNotas } from './dataContext'

export type CategoriaAvaliacao =
  | 'avaliacao'      // Notas de avaliações que compõem a média
  | 'media'          // Médias calculadas (parcial, final, geral)
  | 'recuperacao'    // Recuperação que pode substituir ou somar
  | 'frequencia'     // Controle de frequência/faltas
  | 'conceitual'     // Avaliação qualitativa (sem número)
  | 'especial'       // Tipos de casos especiais (estágio, conselho)
  | 'online'         // Avaliações de plataforma digital
  | 'bonus'          // Pontuação extra, somada à média final sem aumentar o divisor

export interface TipoDadoMeta {
  tipo: TipoDadoNota
  categoria: CategoriaAvaliacao
  funcao: string
  entraNoCalculo: boolean
  entraNaMedia: boolean
  substituiNota: boolean
  exigeNota: boolean
  somaFaltas: boolean
  maxValor: number
  minAprovacao: number
  boletimLabel: string
  cor: string
  corFundo: string
  icone: string
  /** Calcula o valor resultante. Recebe:
   *  valores: notas lançadas para este tipo (array de números)
   *  peso: peso configurado no esquema (default 1)
   *  retorna: null se não há dados suficientes */
  formula: (valores: number[], peso?: number) => number | null
}

// ─── Funções utilitárias de cálculo ──────────────────────────────────────────

/** Média simples */
const mediaSim = (vals: number[]) =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null

/** Maior valor (substituição: recuperação pega a maior) */
const maiorValor = (vals: number[]) =>
  vals.length ? Math.max(...vals) : null

/** Apenas o primeiro valor (nota única) */
const primeiroValor = (vals: number[]) =>
  vals.length ? vals[0] : null

/** Média ponderada: espera pesos embutidos em pares [nota, peso] via index par/ímpar */
const mediaPonderada = (vals: number[], _peso = 1) => {
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// ─── ESCOPO DE LANÇAMENTO ─────────────────────────────────────────────────────

/**
 * Tipos que por natureza pedagógica pertencem ao fechamento anual (resultado final).
 * Usados como padrão de auto-preenchimento no modal de cadastro de detalhes.
 * O usuário sempre pode sobrescrever o valor sugerido.
 */
export const TIPOS_RESULTADO_FINAL: TipoDadoNota[] = [
  'Média Parcial 1',
  'Média Parcial 2',
  'Média Parcial 3',
  'Média Parcial 4',
  'Média Parcial 5',
  'Média Final',
  'Média Geral',
  'Recuperação 5',
  'Nota de Estágio',
  'Conselho de Classe',
]

/**
 * Retorna o escopo padrão sugerido para um TipoDadoNota.
 * Usado no modal para pré-selecionar o campo automaticamente.
 */
export function getEscopoPadrao(tipoDado: TipoDadoNota): EscopoLancamento {
  return TIPOS_RESULTADO_FINAL.includes(tipoDado) ? 'resultado_final' : 'bimestral'
}

// ─── MAPA DE METADADOS ────────────────────────────────────────────────────────

export const TIPOS_META: Record<TipoDadoNota, TipoDadoMeta> = {

  // ── NOTA ─────────────────────────────────────────────────────────────────────
  'Nota': {
    tipo: 'Nota',
    categoria: 'avaliacao',
    funcao: 'Avaliação primária do aluno dentro do bimestre/período. Compõe a Média Parcial conforme peso configurado no Esquema de Notas.',
    entraNoCalculo: true,
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Nota',
    cor: '#3b82f6',
    corFundo: 'rgba(59,130,246,0.10)',
    icone: '📝',
    formula: mediaPonderada,
  },

  // ── PONTO EXTRA (BÔNUS) ──────────────────────────────────────────────────────
  'Ponto Extra': {
    tipo: 'Ponto Extra',
    categoria: 'bonus',
    funcao: 'Pontuação adicional que soma diretamente à Média Parcial sem alterar o divisor (pesos).',
    entraNoCalculo: true,
    entraNaMedia: false,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 0,
    boletimLabel: 'Bônus',
    cor: '#10b981',
    corFundo: 'rgba(16,185,129,0.10)',
    icone: '🌟',
    formula: mediaSim, // soma normal
  },

  'Ponto Bônus': {
    tipo: 'Ponto Bônus',
    categoria: 'bonus',
    funcao: 'Ponto bônus que não é dividido entre as notas e sim um acréscimo na nota final.',
    entraNoCalculo: true,
    entraNaMedia: false,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 0,
    boletimLabel: 'Bônus',
    cor: '#10b981',
    corFundo: 'rgba(16,185,129,0.10)',
    icone: '🎁',
    formula: mediaSim,
  },

  // ── CONCEITO ────────────────────────────────────────────────────────────────
  'Conceito': {
    tipo: 'Conceito',
    categoria: 'conceitual',
    funcao: 'Avaliação qualitativa usada na Educação Infantil e anos iniciais. Valores: A (Atingido/Ótimo), PA (Parcialmente Atingido), NA (Não Atingido). Não gera média numérica — exibe no boletim como conceito.',
    entraNoCalculo: false,
    entraNaMedia: false,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 4, // A=4, PA=2, NA=0
    minAprovacao: 2, // PA ou superior
    boletimLabel: 'Conceito',
    cor: '#8b5cf6',
    corFundo: 'rgba(139,92,246,0.10)',
    icone: '🏅',
    formula: mediaSim, // interno: A=4, PA=2, NA=0
  },

  // ── FALTA ────────────────────────────────────────────────────────────────────
  'Falta': {
    tipo: 'Falta',
    categoria: 'frequencia',
    funcao: 'Registra faltas do aluno no período. Não compõe média de notas. Alimenta o controle de frequência: alunos com frequência abaixo de 75% são reprovados por falta, independentemente das notas.',
    entraNoCalculo: false,
    entraNaMedia: false,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: true,
    maxValor: 999, // sem limite prático
    minAprovacao: 0, // não se aplica
    boletimLabel: 'Faltas',
    cor: '#ef4444',
    corFundo: 'rgba(239,68,68,0.10)',
    icone: '🚫',
    formula: (vals) => vals.reduce((a, b) => a + b, 0) || null, // soma total de faltas
  },

  // ── MÉDIAS PARCIAIS 1-5 ───────────────────────────────────────────────────
  'Média Parcial 1': {
    tipo: 'Média Parcial 1',
    categoria: 'media',
    funcao: 'Média do 1º bimestre/trimestre. Calculada automaticamente a partir das Notas lançadas no período 1 com base no Esquema de Notas ativo. Usada nas fórmulas de Média Final e Média Geral.',
    entraNoCalculo: false, // é resultado, não entrada
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: '1º Bim',
    cor: '#0ea5e9',
    corFundo: 'rgba(14,165,233,0.10)',
    icone: '📊',
    formula: mediaSim,
  },

  'Média Parcial 2': {
    tipo: 'Média Parcial 2',
    categoria: 'media',
    funcao: 'Média do 2º bimestre/trimestre. Calculada automaticamente a partir das Notas lançadas no período 2.',
    entraNoCalculo: false,
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: '2º Bim',
    cor: '#0ea5e9',
    corFundo: 'rgba(14,165,233,0.10)',
    icone: '📊',
    formula: mediaSim,
  },

  'Média Parcial 3': {
    tipo: 'Média Parcial 3',
    categoria: 'media',
    funcao: 'Média do 3º bimestre/trimestre. Calculada automaticamente a partir das Notas lançadas no período 3.',
    entraNoCalculo: false,
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: '3º Bim',
    cor: '#0ea5e9',
    corFundo: 'rgba(14,165,233,0.10)',
    icone: '📊',
    formula: mediaSim,
  },

  'Média Parcial 4': {
    tipo: 'Média Parcial 4',
    categoria: 'media',
    funcao: 'Média do 4º bimestre. Calculada automaticamente a partir das Notas lançadas no período 4.',
    entraNoCalculo: false,
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: '4º Bim',
    cor: '#0ea5e9',
    corFundo: 'rgba(14,165,233,0.10)',
    icone: '📊',
    formula: mediaSim,
  },

  'Média Parcial 5': {
    tipo: 'Média Parcial 5',
    categoria: 'media',
    funcao: 'Média do 5º período (semestres + recuperação intermediária). Calculada automaticamente.',
    entraNoCalculo: false,
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: '5º Per.',
    cor: '#0ea5e9',
    corFundo: 'rgba(14,165,233,0.10)',
    icone: '📊',
    formula: mediaSim,
  },

  // ── RECUPERAÇÕES 1-5 ──────────────────────────────────────────────────────
  'Recuperação 1': {
    tipo: 'Recuperação 1',
    categoria: 'recuperacao',
    funcao: 'Recuperação do 1º bimestre/período. Substitui a Média Parcial 1 caso a nota seja superior. Regra: max(Média Parcial 1, Recuperação 1). Alunos elegíveis: média < 6,0 no período.',
    entraNoCalculo: false,
    entraNaMedia: true, // entra após substituição
    substituiNota: true, // substitui Média Parcial 1
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Rec. 1',
    cor: '#f59e0b',
    corFundo: 'rgba(245,158,11,0.10)',
    icone: '🔄',
    formula: maiorValor, // max(média_parcial, recuperação)
  },

  'Recuperação 2': {
    tipo: 'Recuperação 2',
    categoria: 'recuperacao',
    funcao: 'Recuperação do 2º bimestre/período. Substitui a Média Parcial 2 caso a nota seja superior. Regra: max(Média Parcial 2, Recuperação 2).',
    entraNoCalculo: false,
    entraNaMedia: true,
    substituiNota: true,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Rec. 2',
    cor: '#f59e0b',
    corFundo: 'rgba(245,158,11,0.10)',
    icone: '🔄',
    formula: maiorValor,
  },

  'Recuperação 3': {
    tipo: 'Recuperação 3',
    categoria: 'recuperacao',
    funcao: 'Recuperação do 3º bimestre/período. Substitui a Média Parcial 3 caso a nota seja superior.',
    entraNoCalculo: false,
    entraNaMedia: true,
    substituiNota: true,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Rec. 3',
    cor: '#f59e0b',
    corFundo: 'rgba(245,158,11,0.10)',
    icone: '🔄',
    formula: maiorValor,
  },

  'Recuperação 4': {
    tipo: 'Recuperação 4',
    categoria: 'recuperacao',
    funcao: 'Recuperação do 4º bimestre/período. Substitui a Média Parcial 4 caso a nota seja superior.',
    entraNoCalculo: false,
    entraNaMedia: true,
    substituiNota: true,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Rec. 4',
    cor: '#f59e0b',
    corFundo: 'rgba(245,158,11,0.10)',
    icone: '🔄',
    formula: maiorValor,
  },

  'Recuperação 5': {
    tipo: 'Recuperação 5',
    categoria: 'recuperacao',
    funcao: 'Recuperação Final / Exame Final. Calculada como: (Média Geral + Rec. 5) / 2. Aluno aprovado se resultado ≥ 5,0. Não substitui a Média Geral — gera nova situação no boletim.',
    entraNoCalculo: false,
    entraNaMedia: false, // cria nova coluna: Média Exame
    substituiNota: false,
    exigeNota: true, // exige Média Geral lançada
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 5, // aprovação em exame: 5,0
    boletimLabel: 'Exame Final',
    cor: '#dc2626',
    corFundo: 'rgba(220,38,38,0.10)',
    icone: '🎯',
    formula: (vals) => vals.length >= 2
      ? (vals[0] + vals[1]) / 2  // (media_geral + exame) / 2
      : primeiroValor(vals),
  },

  // ── NOTA DE ESTÁGIO ───────────────────────────────────────────────────────
  'Nota de Estágio': {
    tipo: 'Nota de Estágio',
    categoria: 'especial',
    funcao: 'Avaliação do período de estágio supervisionado (EJA, Técnico, Ensino Médio). Compõe a Média Geral com peso definido no Esquema. Lançada pela coordenação pedagógica com base no relatório do supervisor de campo.',
    entraNoCalculo: true,
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Estágio',
    cor: '#6366f1',
    corFundo: 'rgba(99,102,241,0.10)',
    icone: '🏭',
    formula: mediaSim,
  },

  // ── CONSELHO DE CLASSE ────────────────────────────────────────────────────
  'Conselho de Classe': {
    tipo: 'Conselho de Classe',
    categoria: 'especial',
    funcao: 'Decisão colegiada do Conselho de Classe sobre a situação final do aluno. Pode PROMOVER alunos reprovados por média ou RETER alunos aprovados por média em casos excepcionais. Sobrescreve o resultado automático com justificativa obrigatória. Requer perfil de Coordenador ou Diretor para lançar.',
    entraNoCalculo: false,
    entraNaMedia: false, // não é uma nota — é uma decisão
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 1, // 0 = Mantém resultado / 1 = Altera resultado
    minAprovacao: 0,
    boletimLabel: 'Conselho',
    cor: '#7c3aed',
    corFundo: 'rgba(124,58,237,0.10)',
    icone: '⚖️',
    formula: () => null, // não gera valor numérico
  },

  // ── MÉDIA FINAL ───────────────────────────────────────────────────────────
  'Média Final': {
    tipo: 'Média Final',
    categoria: 'media',
    funcao: 'Média calculada entre as Médias Parciais (e recuperações aplicadas). Fórmula padrão: (MP1 + MP2 + MP3 + MP4) / 4 para sistema bimestral, ou (MP1 + MP2 + MP3) / 3 para trimestral. Configurável no Esquema de Notas com pesos diferenciados por bimestre.',
    entraNoCalculo: false,
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Média Final',
    cor: '#059669',
    corFundo: 'rgba(5,150,105,0.10)',
    icone: '📈',
    formula: mediaSim, // média das parciais
  },

  // ── MÉDIA GERAL ───────────────────────────────────────────────────────────
  'Média Geral': {
    tipo: 'Média Geral',
    categoria: 'media',
    funcao: 'Média anual final do aluno na disciplina. Calculada a partir da Média Final com acréscimo de Nota de Estágio (se houver). Determina o status final: Aprovado (≥6,0), Exame Final (entre 5,0 e 5,9) ou Reprovado (<5,0). Exibida com destaque no boletim.',
    entraNoCalculo: false,
    entraNaMedia: false, // é o resultado final
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Média Anual',
    cor: '#16a34a',
    corFundo: 'rgba(22,163,74,0.10)',
    icone: '🏆',
    formula: mediaSim,
  },

  // ── AVALIAÇÃO ONLINE ──────────────────────────────────────────────────────
  'Avaliação Online': {
    tipo: 'Avaliação Online',
    categoria: 'online',
    funcao: 'Avaliação realizada via plataforma digital (Google Forms, Moodle, plataforma própria). A nota é importada automaticamente via integração ou lançada manualmente. Compõe a Média Parcial com peso configurado no Esquema. Indicada para avaliações formativas e diagnósticas.',
    entraNoCalculo: true,
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Av. Online',
    cor: '#0284c7',
    corFundo: 'rgba(2,132,199,0.10)',
    icone: '💻',
    formula: mediaPonderada,
  },

  // ── AVALIAÇÃO DISSERTATIVA ──────────────────────────────────────────────
  'Avaliação Dissertativa': {
    tipo: 'Avaliação Dissertativa',
    categoria: 'avaliacao',
    funcao: 'Prova ou trabalho dissertativo com correção manual (redação, monografia, TCC, relatório). A nota é lançada pelo professor responsável. Pode ter critérios de avaliação (rubrica) configurados no Esquema. Compõe a Média Parcial com peso configurado.',
    entraNoCalculo: true,
    entraNaMedia: true,
    substituiNota: false,
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Dissertativa',
    cor: '#7c3aed',
    corFundo: 'rgba(124,58,237,0.10)',
    icone: '✍️',
    formula: mediaPonderada,
  },

  // ── RECUPERAÇÃO ONLINE ────────────────────────────────────────────────────
  'Recuperação Online': {
    tipo: 'Recuperação Online',
    categoria: 'recuperacao',
    funcao: 'Avaliação de recuperação realizada via plataforma digital. Funciona como Recuperação paralela — substitui a Avaliação Online correspondente se a nota for superior. Gerada em plataformas como Google Classroom, Moodle ou AVA próprio. Importação automática disponível via integração.',
    entraNoCalculo: false,
    entraNaMedia: true,
    substituiNota: true, // substitui Avaliação Online
    exigeNota: false,
    somaFaltas: false,
    maxValor: 10,
    minAprovacao: 6,
    boletimLabel: 'Rec. Online',
    cor: '#d97706',
    corFundo: 'rgba(217,119,6,0.10)',
    icone: '🔁',
    formula: maiorValor, // max(av_online, rec_online)
  },
}

// ─── FUNÇÕES DE CÁLCULO DO ERP ────────────────────────────────────────────────

/**
 * Determina a situação final do aluno com base na Média Geral,
 * frequência e resultado do Conselho de Classe.
 */
export type SituacaoAluno =
  | 'Aprovado'
  | 'Aprovado em Exame'
  | 'Reprovado por Nota'
  | 'Reprovado por Falta'
  | 'Em Recuperação'
  | 'Em Exame Final'
  | 'Promovido pelo Conselho'
  | 'Retido pelo Conselho'
  | 'Aguardando'

export interface ResultadoAluno {
  situacao: SituacaoAluno
  mediaGeral: number | null
  mediaExame: number | null
  totalFaltas: number
  percentualFrequencia: number
  aprovadoPorNota: boolean
  aprovadoPorFrequencia: boolean
  cor: string
  descricao: string
}

/** Calcula o resultado final de um aluno dado seus valores por tipo */
export function calcularResultadoAluno(opts: {
  mediaGeral: number | null
  exame: number | null        // Recuperação 5
  totalFaltas: number
  totalAulas: number
  conselhoDecisao?: 'Promovido' | 'Retido' | null
  minAprovacao?: number       // padrão 6.0
  minExame?: number           // padrão 5.0
  maxFaltasPct?: number       // padrão 25% = frequência mínima 75%
}): ResultadoAluno {
  const {
    mediaGeral,
    exame,
    totalFaltas,
    totalAulas,
    conselhoDecisao,
    minAprovacao = 6.0,
    minExame = 5.0,
    maxFaltasPct = 25,
  } = opts

  const pctFalta = totalAulas > 0 ? (totalFaltas / totalAulas) * 100 : 0
  const pctFreq = 100 - pctFalta
  const aprovadoFreq = pctFalta <= maxFaltasPct

  // Conselho sobrescreve tudo
  if (conselhoDecisao === 'Promovido') {
    return {
      situacao: 'Promovido pelo Conselho',
      mediaGeral,
      mediaExame: null,
      totalFaltas,
      percentualFrequencia: pctFreq,
      aprovadoPorNota: true,
      aprovadoPorFrequencia: aprovadoFreq,
      cor: '#7c3aed',
      descricao: 'Promovido por decisão do Conselho de Classe',
    }
  }
  if (conselhoDecisao === 'Retido') {
    return {
      situacao: 'Retido pelo Conselho',
      mediaGeral,
      mediaExame: null,
      totalFaltas,
      percentualFrequencia: pctFreq,
      aprovadoPorNota: false,
      aprovadoPorFrequencia: aprovadoFreq,
      cor: '#dc2626',
      descricao: 'Retido por decisão do Conselho de Classe',
    }
  }

  // Reprovado por falta
  if (!aprovadoFreq) {
    return {
      situacao: 'Reprovado por Falta',
      mediaGeral,
      mediaExame: null,
      totalFaltas,
      percentualFrequencia: pctFreq,
      aprovadoPorNota: (mediaGeral ?? 0) >= minAprovacao,
      aprovadoPorFrequencia: false,
      cor: '#ef4444',
      descricao: `Reprovado por frequência: ${pctFreq.toFixed(1)}% (mínimo 75%)`,
    }
  }

  if (mediaGeral === null) {
    return {
      situacao: 'Aguardando',
      mediaGeral: null,
      mediaExame: null,
      totalFaltas,
      percentualFrequencia: pctFreq,
      aprovadoPorNota: false,
      aprovadoPorFrequencia: true,
      cor: '#94a3b8',
      descricao: 'Aguardando lançamento de notas',
    }
  }

  // Aprovado direto
  if (mediaGeral >= minAprovacao) {
    return {
      situacao: 'Aprovado',
      mediaGeral,
      mediaExame: null,
      totalFaltas,
      percentualFrequencia: pctFreq,
      aprovadoPorNota: true,
      aprovadoPorFrequencia: true,
      cor: '#10b981',
      descricao: `Aprovado com média ${mediaGeral.toFixed(1)}`,
    }
  }

  // Zona de exame final (entre 5.0 e 5.9 tipicamente)
  if (mediaGeral >= minExame && mediaGeral < minAprovacao) {
    if (exame !== null) {
      const mediaExame = (mediaGeral + exame) / 2
      const aprovado = mediaExame >= minExame
      return {
        situacao: aprovado ? 'Aprovado em Exame' : 'Reprovado por Nota',
        mediaGeral,
        mediaExame,
        totalFaltas,
        percentualFrequencia: pctFreq,
        aprovadoPorNota: aprovado,
        aprovadoPorFrequencia: true,
        cor: aprovado ? '#059669' : '#ef4444',
        descricao: aprovado
          ? `Aprovado em exame final com média ${mediaExame.toFixed(1)}`
          : `Reprovado em exame final com média ${mediaExame.toFixed(1)}`,
      }
    }
    return {
      situacao: 'Em Exame Final',
      mediaGeral,
      mediaExame: null,
      totalFaltas,
      percentualFrequencia: pctFreq,
      aprovadoPorNota: false,
      aprovadoPorFrequencia: true,
      cor: '#f59e0b',
      descricao: `Em exame final — média parcial ${mediaGeral.toFixed(1)}`,
    }
  }

  // Média < minExame: zona de recuperação paralela
  if (mediaGeral < minExame) {
    return {
      situacao: 'Em Recuperação',
      mediaGeral,
      mediaExame: null,
      totalFaltas,
      percentualFrequencia: pctFreq,
      aprovadoPorNota: false,
      aprovadoPorFrequencia: true,
      cor: '#f97316',
      descricao: `Em recuperação — média ${mediaGeral.toFixed(1)}`,
    }
  }

  return {
    situacao: 'Reprovado por Nota',
    mediaGeral,
    mediaExame: null,
    totalFaltas,
    percentualFrequencia: pctFreq,
    aprovadoPorNota: false,
    aprovadoPorFrequencia: true,
    cor: '#ef4444',
    descricao: `Reprovado por nota — média ${mediaGeral.toFixed(1)}`,
  }
}

/**
 * Aplica a regra de substituição da Recuperação sobre a Média Parcial.
 * Recuperações 1-4: max(média_parcial, recuperacao)
 * Recuperação 5 (Exame Final): (média_geral + exame) / 2
 */
export function aplicarRecuperacao(
  mediaParcial: number,
  notaRecuperacao: number | null
): number {
  if (notaRecuperacao === null) return mediaParcial
  return Math.max(mediaParcial, notaRecuperacao)
}

/**
 * Aplica a substituição do Avaliação Online pela Recuperação Online
 */
export function aplicarRecuperacaoOnline(
  notaOnline: number,
  recuperacaoOnline: number | null
): number {
  if (recuperacaoOnline === null) return notaOnline
  return Math.max(notaOnline, recuperacaoOnline)
}

/**
 * Converte conceito qualitativo em valor numérico para cálculo interno
 */
export const CONCEITO_VALORES: Record<string, number> = {
  'A': 10,   // Atingido plenamente
  'B': 8,    // Atingido com distinção
  'C': 6,    // Atingido
  'PA': 4,   // Parcialmente Atingido
  'NA': 0,   // Não Atingido
}

export function conceitoParaNumero(conceito: string): number {
  return CONCEITO_VALORES[conceito.toUpperCase()] ?? 0
}

/**
 * Retorna quais tipos de dado são lançáveis manualmente (pelo professor)
 * vs. calculados automaticamente pelo sistema
 */
export function isTipoLancavelManualmente(tipo: TipoDadoNota): boolean {
  const calculadosAutomaticamente: TipoDadoNota[] = [
    'Média Parcial 1', 'Média Parcial 2', 'Média Parcial 3',
    'Média Parcial 4', 'Média Parcial 5',
    'Média Final', 'Média Geral',
  ]
  return !calculadosAutomaticamente.includes(tipo)
}

/**
 * Retorna a legenda de situação para exibição no boletim
 */
export const SITUACAO_LABELS: Record<SituacaoAluno, string> = {
  'Aprovado': 'Aprovado',
  'Aprovado em Exame': 'Aprovado (Exame)',
  'Reprovado por Nota': 'Reprovado',
  'Reprovado por Falta': 'Rep. por Falta',
  'Em Recuperação': 'Recuperação',
  'Em Exame Final': 'Exame Final',
  'Promovido pelo Conselho': 'Promovido (CC)',
  'Retido pelo Conselho': 'Retido (CC)',
  'Aguardando': 'Aguardando',
}

/**
 * Extrai o número de casas decimais configurado na fórmula.
 * Ex: '2 Casas' → 2, '1 Casa' → 1, undefined → 1 (padrão)
 */
export function getCasasVirgula(formulaAtiva?: FormulaNotas): number {
  if (!formulaAtiva?.casasVirgula) return 1
  const match = formulaAtiva.casasVirgula.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 1
}

/**
 * Aplica o arredondamento acadêmico configurado na fórmula.
 *
 * Lógica das regras (ConfigArredondamento):
 *   - MODO FRAÇÃO: Se todos os v1 do conjunto são <= 1, as regras são
 *     aplicadas à PARTE DECIMAL do valor (ex: 7.6 → fração = 0.6).
 *     Resultado = parte inteira + res. Ex: regra (>= 0.5 → 1.0) → 7.6 vira 8.0
 *
 *   - MODO ABSOLUTO: Caso algum v1 > 1, as regras são aplicadas ao valor completo.
 *     Resultado = res diretamente. Ex: regra (>= 7.5 <= 7.9 → 8.0) → 7.6 vira 8.0
 *
 * Quando não há regra aplicável, arredonda pelo número de casas configurado.
 */
export function aplicarArredondamentoGeral(
  valor: number,
  cfgArredondamentos: ConfigArredondamento[] | undefined,
  formulaAtiva?: FormulaNotas,
  isMedia: boolean = true
): number {
  // Guard: não arredondar
  if (formulaAtiva && formulaAtiva.usarArredondamento === 'Não Arredondar') return valor
  // Guard: só arredonda médias (não notas individuais)
  if (formulaAtiva && isMedia && formulaAtiva.usarArredondamento === 'Notas') return valor
  // Guard: só arredonda notas individuais (não médias)
  if (formulaAtiva && !isMedia && formulaAtiva.usarArredondamento === 'Médias') return valor
  // 'Notas e Médias' — arredonda ambos (sem guard)

  let result = valor
  let ruleSet: ConfigArredondamento | undefined

  // 1. Procurar regra específica pelo nome informado na fórmula
  if (formulaAtiva?.qualArredondamento && formulaAtiva.qualArredondamento.trim() && cfgArredondamentos?.length) {
    const descFormula = formulaAtiva.qualArredondamento.trim().toLowerCase()
    ruleSet = cfgArredondamentos.find(c => c.descricao.trim().toLowerCase() === descFormula)
  }
  // 2. Fallback: usar o primeiro conjunto de regras cadastrado
  if (!ruleSet && cfgArredondamentos && cfgArredondamentos.length > 0) {
    ruleSet = cfgArredondamentos[0]
  }

  let appliedRule = false

  if (ruleSet && ruleSet.regras && ruleSet.regras.length > 0) {
    // Detectar modo: FRAÇÃO (todos v1 <= 1) vs ABSOLUTO
    const allFractional = ruleSet.regras.every(r => r.v1 <= 1 && (r.v2 === null || r.v2 <= 1))
    // Valor a comparar contra as regras
    const intPart = Math.floor(valor)
    const fracPart = parseFloat((valor - intPart).toFixed(6))
    const compareVal = allFractional ? fracPart : valor

    for (const r of ruleSet.regras) {
      let pass1 = false
      let pass2 = true

      if (r.op1 === '>')  pass1 = compareVal > r.v1
      else if (r.op1 === '>=') pass1 = compareVal >= r.v1
      else if (r.op1 === '<')  pass1 = compareVal < r.v1
      else if (r.op1 === '<=') pass1 = compareVal <= r.v1
      else if (r.op1 === '=')  pass1 = compareVal === r.v1
      else pass1 = true

      if (r.op2 && r.v2 !== null) {
        if (r.op2 === '>')  pass2 = compareVal > r.v2
        else if (r.op2 === '>=') pass2 = compareVal >= r.v2
        else if (r.op2 === '<')  pass2 = compareVal < r.v2
        else if (r.op2 === '<=') pass2 = compareVal <= r.v2
        else if (r.op2 === '=')  pass2 = compareVal === r.v2
      }

      if (pass1 && pass2) {
        // MODO FRAÇÃO: resultado = parte inteira + res (fração do resultado)
        // MODO ABSOLUTO: resultado = res diretamente
        result = allFractional ? intPart + r.res : r.res
        appliedRule = true
        break
      }
    }
  }

  // Se não aplicou regra explícita, arredondar pelas casas configuradas
  if (!appliedRule) {
    const casas = getCasasVirgula(formulaAtiva)
    const factor = Math.pow(10, casas)
    if (formulaAtiva?.desconsiderarDemaisCasas === 'Sim') {
      result = Math.floor(result * factor) / factor
    } else {
      result = Math.round(result * factor) / factor
    }
  }

  return result
}

/**
 * Motor Acadêmico: Calcula a Média Parcial de um aluno num bimestre específico,
 * respeitando os pesos do esquema, e substituindo pela Recuperação se existir.
 */
export function calcularMediaParcialBimestre(
  valoresLancados: Record<string, number | string | null>,
  detalhesEsquema: DetalheEsquemaNota[],
  cfgArredondamentos: ConfigArredondamento[] | undefined,
  formulaAtiva?: FormulaNotas
): { mediaParcial: number | null, faltas: number } {

  // Filtrar APENAS detalhes de escopo bimestral.
  // Detalhes de resultado_final (Média Geral, Conselho, etc.) são processados
  // na aba de fechamento anual e NÃO devem entrar na média parcial bimestral.
  const detalhesBimestrais = detalhesEsquema.filter(
    d => (d.escopoLancamento ?? getEscopoPadrao(d.tipoDado)) === 'bimestral'
  )

  let somaPesos = 0
  let somaNotasPonderadas = 0
  let pontosExtras = 0
  let temAvaliacao = false
  let faltas = 0
  
  let notasRecuperacao: number[] = []

  detalhesBimestrais.forEach(d => {
    const rawVal = valoresLancados[d.id]
    if (rawVal === null || rawVal === undefined || rawVal === '') return

    const meta = TIPOS_META[d.tipoDado]
    
    // 1. Somar Faltas
    if (meta.categoria === 'frequencia') {
      const f = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal), 10)
      if (!isNaN(f)) faltas += f
    }
    
    // 2. Extrair Notas (Avaliação Normal)
    if (meta.categoria === 'avaliacao' || meta.categoria === 'online') {
      let n = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal))
      if (!isNaN(n)) {
        // Se arredondaAntesCalculo = 'Sim', arredonda a nota individual ANTES de pesar
        if (formulaAtiva?.arredondaAntesCalculo === 'Sim') {
          n = aplicarArredondamentoGeral(n, cfgArredondamentos, formulaAtiva, false)
        }
        const pesoUsar = formulaAtiva?.notasPorPeso === 'Não' ? 1 : d.peso
        somaNotasPonderadas += n * pesoUsar
        somaPesos += pesoUsar
        temAvaliacao = true
      }
    }
    
    // 3. Extrair Notas de Recuperação Parcial
    if (meta.categoria === 'recuperacao') {
      let rec = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal))
      if (!isNaN(rec)) {
        // Também arredonda recuperação individual se configurado
        if (formulaAtiva?.arredondaAntesCalculo === 'Sim') {
          rec = aplicarArredondamentoGeral(rec, cfgArredondamentos, formulaAtiva, false)
        }
        notasRecuperacao.push(rec)
      }
    }

    // 4. Extrair Ponto Extra
    if (meta.categoria === 'bonus') {
      const b = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal))
      if (!isNaN(b)) {
        pontosExtras += b
      }
    }
  })

  // Calcula Média Base
  let mediaBase: number | null = null
  if (temAvaliacao && somaPesos > 0) {
    mediaBase = somaNotasPonderadas / somaPesos
  }
  
  // Se não tem média base, a recuperação não tem o que substituir (em regra geral).
  // Porém, o sistema deve registrar a médiaParcial se ela existe.
  if (mediaBase !== null) {
    let mediaFinal = mediaBase
    
    // Substituição por Recuperação guiada por FormulaNotas
    if (notasRecuperacao.length > 0) {
      const maiorRec = Math.max(...notasRecuperacao)
      const regraRec = formulaAtiva?.calculoMediaBimTrimestre || '1'
      
      if (regraRec.startsWith('1')) {
        // 1 - Substitui a média se a rec. for maior
        mediaFinal = Math.max(mediaFinal, maiorRec)
      } else if (regraRec.startsWith('2')) {
        // 2 - Soma a média com a rec. e divide por 2
        mediaFinal = (mediaFinal + maiorRec) / 2
      } else if (regraRec.startsWith('3')) {
        // 3 - Se a nota da Rec. for maior que a bimestral, soma e divide por 2
        if (maiorRec > mediaFinal) {
          mediaFinal = (mediaFinal + maiorRec) / 2
        }
      } else if (regraRec.startsWith('4')) {
        // 4 - Usa somente a nota da recuperação
        mediaFinal = maiorRec
      } else if (regraRec.startsWith('5')) {
        // 5 - Mantém a média bimestral original
        // mediaFinal = mediaFinal
      } else {
        // Fallback default
        mediaFinal = Math.max(mediaFinal, maiorRec)
      }
    }

    // Soma o ponto extra *após* resolver a recuperação
    if (pontosExtras > 0) {
      mediaFinal += pontosExtras
    }

    // Limita ao máximo de 10 (ou ao máximo permitido pela fórmula)
    mediaFinal = Math.min(mediaFinal, 10)
    
    // Arredondamento Acadêmico
    mediaFinal = aplicarArredondamentoGeral(mediaFinal, cfgArredondamentos, formulaAtiva, true)
    return { mediaParcial: mediaFinal, faltas }
  }

  return { mediaParcial: null, faltas }
}
