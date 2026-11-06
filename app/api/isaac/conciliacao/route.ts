/**
 * app/api/isaac/conciliacao/route.ts
 *
 * Motor de Conciliação e Auditoria Financeira/Acadêmica: Gestão Escolar (ERP) ↔ Isaac Escola.
 *
 * Funcionalidades:
 * 1. Lista todos os alunos presentes no Isaac para o ano letivo selecionado (reference_year).
 * 2. Cruza em tempo real com a base de alunos, turmas, responsáveis e negociações da Gestão Escolar (ERP).
 * 3. Agrupa as cobranças de cada aluno por Produto (Mensalidade, Matrícula, Material Didático, Integral, Outros).
 * 4. Audita parcelas existentes vs. parcelas/meses faltantes (JAN–DEZ ou sequência X/Y) para cada produto do aluno.
 * 5. Consolida indicadores executivos por turma, série, segmento e status de conciliação.
 */

import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'
import { formatIsaacAmount, getEffectiveAmount, type IsaacInstallment } from '@/lib/isaac'
import { getOrFetchYearCache } from '@/lib/isaacCache'
import { getAlunoVinculosAtivos, isAlunoIntegralIntermediario } from '@/lib/studentTurmaUtils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Tipos de Domínio da Conciliação ─────────────────────────────────────────

export type ProdutoCategoria = 'MENSALIDADE' | 'MATRICULA' | 'MATERIAL' | 'INTEGRAL' | 'OUTROS'

export type MesGridStatus =
  | 'PAID'
  | 'OPEN'
  | 'OVERDUE'
  | 'RENEGOTIATED'
  | 'CANCELED_ONLY'
  | 'COVERED_BY_ENROLLMENT'
  | 'MISSING'

export interface MesAuditItem {
  mes: number // 1..12
  sigla: string // JAN..DEZ
  nome: string // Janeiro..Dezembro
  status: MesGridStatus
  quantidadeAtivas: number
  quantidadeCanceladas: number
  valorTotalCentavos: number
  valorFormatado: string
  parcelasIds: string[]
}

export interface ProdutoAlunoAudit {
  key: string
  categoria: ProdutoCategoria
  nome: string
  productIds: string[]
  contractIds: string[]
  totalParcelasBruto: number
  parcelasAtivas: number
  parcelasPagas: number
  parcelasAbertas: number
  parcelasVencidas: number
  parcelasCanceladas: number
  parcelasRenegociadas: number
  parcelasEsperadasPadrao: number
  temParcelasFaltantes: boolean
  mesesPresentes: number[]
  mesesCanceladosSemSubstituta: number[]
  // 3 modos de cálculo de meses faltantes para resposta em 0ms no frontend
  mesesFaltantesComMatricula: number[] // Jan coberto por Matrícula + Fev..Dez
  mesesFaltantes12Estrito: number[]    // Jan..Dez estrito no produto
  mesesFaltantes11FevDez: number[]     // Fev..Dez (11 mensalidades)
  numerosParcelasFaltantes: string[]   // ex: ["3/6", "5/6"] quando numerado
  resumoFaltantes: string
  valorContratadoCentavos: number
  valorContratadoFormatado: string
  valorPagoCentavos: number
  valorPagoFormatado: string
  valorAbertoCentavos: number
  valorAbertoFormatado: string
  valorVencidoCentavos: number
  valorVencidoFormatado: string
  mesesGrid: MesAuditItem[]
}

export interface ParcelaConciliacaoDTO {
  id: string
  externalId: string
  contractId: string
  productId: string
  produtoKey: string
  produtoCategoria: ProdutoCategoria
  produtoNome: string
  descricao: string
  tipoOriginal: string
  status: 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELED' | 'AGGLUTINATED' | 'RENEGOTIATED'
  statusOriginal: string
  mesCompetencia: number | null
  mesSigla: string
  numeroParcela: number | null
  totalParcelasDeclarado: number | null
  vencimento: string
  dataPagamento: string | null
  competencia: string
  anoReferencia: string
  valorBaseCentavos: number
  valorBaseFormatado: string
  valorEfetivoCentavos: number
  valorEfetivoFormatado: string
  valorPagoCentavos: number
  valorPagoFormatado: string
  descontoCentavos: number
  descontoFormatado: string
  multaJurosCentavos: number
  multaJurosFormatado: string
  responsavelNome: string
  responsavelCpf: string
  responsavelExternalId: string
  pixCode: string | null
  boletoUrl: string | null
  checkoutUrl: string | null
}

export type ConciliacaoStatus =
  | 'CONCILIADO'       // Presente e ativo na Gestão Escolar no ano + possui parcelas ativas no Isaac
  | 'APENAS_ERP'       // Matriculado na Gestão Escolar no ano, mas SEM parcelas ativas no Isaac
  | 'APENAS_ISAAC'     // Possui parcelas ativas no Isaac no ano, mas sem matrícula ativa/enturmação no ano no ERP
  | 'INATIVO_COM_ISAAC'// Aluno marcado como Inativo/Transferido/Cancelado no ERP, mas ainda com cobranças no Isaac

export interface AlunoConciliacaoItem {
  key: string
  // Identificação Consolidada
  nome: string
  erpId: string | null
  erpMatricula: string | null
  isaacStudentId: string | null
  isaacExternalId: string | null
  foto: string | null
  // Vínculo & Conciliação
  conciliacaoStatus: ConciliacaoStatus
  matchMetodo: 'EXACT_ID' | 'NAME_MATCH' | 'ONLY_ERP' | 'ONLY_ISAAC'
  alertaDivergenciaId: boolean
  // Dados Acadêmicos (Gestão Escolar)
  estaNoErp: boolean
  matriculadoNoAnoErp: boolean
  statusErp: string
  turmaNome: string
  serieNome: string
  segmentoNome: string
  turnoNome: string
  unidadeNome: string
  isIntegralErp: boolean
  // Dados no Isaac
  estaNoIsaac: boolean
  possuiParcelasAtivasIsaac: boolean
  possuiApenasCanceladasIsaac: boolean
  // Responsável Financeiro Consolidado
  responsavelNome: string
  responsavelCpf: string
  responsavelTelefone: string
  responsavelEmail: string
  responsavelIdErp: string | null
  // Negociação / Contrato Digital no Ano
  negociacao: {
    protocolo: string
    modalidadeIsaac: 'no_isaac' | 'fora_isaac' | 'hibrido'
    status: string
    resumoValores: string
    qtdParcelasMensalidade?: number
    parcelasMatricula?: number
    parcelasMaterial?: number
  } | null
  contratoDigitalStatus: string | null
  // Resumo de Parcelas e Produtos no Isaac
  totalParcelasAtivas: number
  totalParcelasPagas: number
  totalParcelasAbertas: number
  totalParcelasVencidas: number
  totalParcelasCanceladas: number
  totalParcelasRenegociadas: number
  valorTotalContratadoCentavos: number
  valorTotalContratadoFormatado: string
  valorTotalPagoCentavos: number
  valorTotalPagoFormatado: string
  valorTotalAbertoCentavos: number
  valorTotalAbertoFormatado: string
  valorTotalVencidoCentavos: number
  valorTotalVencidoFormatado: string
  isAdimplenteIsaac: boolean
  // Auditoria de Produtos e Faltantes
  produtos: ProdutoAlunoAudit[]
  categoriasProdutos: ProdutoCategoria[]
  temMensalidade: boolean
  temMatricula: boolean
  temMaterial: boolean
  temIntegral: boolean
  temParcelasFaltantes12ComMat: boolean
  temParcelasFaltantes12Estrito: boolean
  temParcelasFaltantes11FevDez: boolean
  temProdutoFaltante: boolean
  resumoAuditoriaParcelas: string
  // Grade consolidada de 12 meses do aluno (Anuidade: Matrícula + Mensalidade)
  anuidadeMesesGrid: MesAuditItem[]
  // Lista de parcelas individuais
  parcelas: ParcelaConciliacaoDTO[]
}

// ─── Constantes & Helpers ────────────────────────────────────────────────────

const MESES_INFO = [
  { mes: 1, sigla: 'JAN', nome: 'Janeiro' },
  { mes: 2, sigla: 'FEV', nome: 'Fevereiro' },
  { mes: 3, sigla: 'MAR', nome: 'Março' },
  { mes: 4, sigla: 'ABR', nome: 'Abril' },
  { mes: 5, sigla: 'MAI', nome: 'Maio' },
  { mes: 6, sigla: 'JUN', nome: 'Junho' },
  { mes: 7, sigla: 'JUL', nome: 'Julho' },
  { mes: 8, sigla: 'AGO', nome: 'Agosto' },
  { mes: 9, sigla: 'SET', nome: 'Setembro' },
  { mes: 10, sigla: 'OUT', nome: 'Outubro' },
  { mes: 11, sigla: 'NOV', nome: 'Novembro' },
  { mes: 12, sigla: 'DEZ', nome: 'Dezembro' },
]

function normalizeName(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeId(raw?: string | number | null): string {
  if (raw === null || raw === undefined) return ''
  const s = String(raw)
    .trim()
    .replace(/^(a_|_ALU|ALU)/i, '')
    .trim()
  return s.replace(/^0+/, '') || s
}

function cleanDigits(val?: string | null): string {
  if (!val) return ''
  return String(val).replace(/\D/g, '')
}

function formatCPF(cpf?: string | null): string {
  const d = cleanDigits(cpf)
  if (d.length !== 11) return cpf ? String(cpf).trim() : ''
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function isStudentStatusInactive(status?: string | null): boolean {
  const s = String(status || 'ativo').trim().toLowerCase()
  return ['inativo', 'inativa', 'cancelado', 'cancelada', 'transferido', 'transferida', 'evadido', 'evadida', 'desistente', 'trancado', 'excluido', 'excluído'].includes(s)
}

function extractMonthFromInstallment(item: IsaacInstallment, targetYear: string): number | null {
  const desc = (item.description || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // 1. Verificar competence_date (ex: "2026-03-01")
  if (item.competence_date) {
    const parts = String(item.competence_date).split('T')[0].split('-')
    if (parts.length >= 2) {
      const y = parts[0]
      const m = parseInt(parts[1], 10)
      if (m >= 1 && m <= 12) {
        if (y === targetYear) return m
        // Se for matrícula paga antecipadamente no fim do ano anterior para o ano alvo
        if (item.type === 'ENROLLMENT' && Number(y) === Number(targetYear) - 1) {
          return 1
        }
      }
    }
  }

  // 2. Verificar nome de mês explícito na descrição
  const monthPatterns: Array<[RegExp, number]> = [
    [/\b(janeiro|jan)\b/, 1],
    [/\b(fevereiro|fev)\b/, 2],
    [/\b(marco|mar)\b/, 3],
    [/\b(abril|abr)\b/, 4],
    [/\b(maio|mai)\b/, 5],
    [/\b(junho|jun)\b/, 6],
    [/\b(julho|jul)\b/, 7],
    [/\b(agosto|ago)\b/, 8],
    [/\b(setembro|set)\b/, 9],
    [/\b(outubro|out)\b/, 10],
    [/\b(novembro|nov)\b/, 11],
    [/\b(dezembro|dez)\b/, 12],
  ]
  for (const [regex, m] of monthPatterns) {
    if (regex.test(desc)) return m
  }

  // 3. Verificar due_date (ex: "2026-04-10")
  if (item.due_date) {
    const parts = String(item.due_date).split('T')[0].split('-')
    if (parts.length >= 2) {
      const y = parts[0]
      const m = parseInt(parts[1], 10)
      if (m >= 1 && m <= 12) {
        if (y === targetYear) return m
        if (Number(y) === Number(targetYear) - 1 && (item.type === 'ENROLLMENT' || desc.includes('matricula') || desc.includes('rematricula'))) {
          return 1
        }
        return m
      }
    }
  }

  return null
}

function extractInstallmentSequence(description?: string | null): { current: number; total: number } | null {
  if (!description) return null
  // Procura padrões como "Parcela 2/6", "03/12", "2 de 10", "(1/8)"
  // Evita datas como 10/03/2026 ou 03/2026
  const cleaned = String(description).replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '').replace(/\b\d{1,2}\/202\d\b/g, '')
  const matchSlash = cleaned.match(/(?:parcela\s*|parc\.?\s*|\(|\b)(\d{1,2})\s*(?:\/|\s+de\s+)\s*(\d{1,2})(?:\)|\b)/i)
  if (matchSlash) {
    const cur = parseInt(matchSlash[1], 10)
    const tot = parseInt(matchSlash[2], 10)
    if (cur >= 1 && tot >= 1 && cur <= tot && tot <= 24) {
      return { current: cur, total: tot }
    }
  }
  return null
}

function cleanProductTitle(rawDesc?: string | null): string {
  if (!rawDesc) return ''
  let s = String(rawDesc).trim()
  // Remove sufixos específicos da parcela como "- Parcela 1/12", "(02/11)", "Parcela 01 de 12", "- Fev/2026"
  s = s
    .replace(/\s*[-–—]?\s*(?:parcela|parc\.?)\s*\d{1,2}\s*(?:\/|\s+de\s+)\s*\d{1,2}\b/gi, '')
    .replace(/\s*\(\s*\d{1,2}\s*(?:\/|\s+de\s+)\s*\d{1,2}\s*\)/gi, '')
    .replace(
      /\s*[-–—]\s*(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:[cç]o)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\s*(?:\/\s*202\d)?$/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()
  return s || String(rawDesc).trim()
}

function classifyProduct(item: IsaacInstallment): {
  key: string
  categoria: ProdutoCategoria
  nome: string
  hasMensalidadeWord: boolean
  hasIntegralWord: boolean
  isGenericTuitionFallback: boolean
} {
  const rawDesc = String(item.description || '').trim()
  const cleanTitle = cleanProductTitle(rawDesc)
  const descNorm = normalizeName(rawDesc)
  const titleKey =
    normalizeName(cleanTitle)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
      .slice(0, 48) || 'DEFAULT'
  const rawType = String(item.type || '').toUpperCase()

  const hasEntradaMatriculaWord =
    /\b(entrada mensalidade|entrada de mensalidade|entrada anuidade|entrada de anuidade|matricula|rematricula|taxa de matricula|1a parcela da anuidade|primeira parcela da anuidade)\b/.test(
      descNorm
    )

  // 1. Matrícula / Rematrícula / Entrada Mensalidade (checado primeiro para que "Entrada Mensalidade - ... - Integral" seja sempre MATRICULA)
  if (rawType === 'ENROLLMENT' || hasEntradaMatriculaWord) {
    return {
      key: `MATRICULA_${titleKey}`,
      categoria: 'MATRICULA',
      nome: cleanTitle || 'Matrícula / Entrada Mensalidade',
      hasMensalidadeWord: false,
      hasIntegralWord: /\b(integral|intermediario|periodo estendido|contraturno|semi integral)\b/.test(descNorm),
      isGenericTuitionFallback: false,
    }
  }

  // 2. Material Didático / Apostilas / Livros / Sistema de Ensino
  if (
    rawType === 'MATERIAL' ||
    /\b(material|materiais|apostila|apostilas|livro|livros|sistema de ensino|bernoulli|sae|positivo|anglo|literatura|plataforma|didatico|colecao)\b/.test(
      descNorm
    )
  ) {
    return {
      key: `MATERIAL_${titleKey}`,
      categoria: 'MATERIAL',
      nome: cleanTitle || 'Material Didático / Sistema de Ensino',
      hasMensalidadeWord: false,
      hasIntegralWord: false,
      isGenericTuitionFallback: false,
    }
  }

  // 3. Outros Produtos Explícitos (checado ANTES de rawType === 'TUITION' pois o Isaac envia type=TUITION em acordos/taxas/serviços)
  if (/\b(renegociacao|acordo|confissao)\b/.test(descNorm)) {
    return {
      key: `OUTROS_ACORDO_${titleKey}`,
      categoria: 'OUTROS',
      nome: cleanTitle || 'Acordo / Renegociação',
      hasMensalidadeWord: false,
      hasIntegralWord: false,
      isGenericTuitionFallback: false,
    }
  }

  if (
    /\b(uniforme|uniformes|evento|eventos|passeio|excursao|seguro|transporte|cantina|alimentacao|almoco|lanche|bilingue|extracurricular|esporte|futsal|ballet|judo|natacao|robotica|musica|teatro|multa|segunda via|2a via|cracha|carteirinha|agenda|formatura|colonia|oficina|simulad|olimpiada)\b/.test(
      descNorm
    ) ||
    (/\btaxa\b/.test(descNorm) && !/\b(mensalidade|anuidade|escolaridade)\b/.test(descNorm))
  ) {
    return {
      key: `OUTROS_${titleKey}`,
      categoria: 'OUTROS',
      nome: cleanTitle || 'Outros Serviços / Taxas',
      hasMensalidadeWord: false,
      hasIntegralWord: false,
      isGenericTuitionFallback: false,
    }
  }

  const hasMensalidadeWord = /\b(mensalidade|mensalidades|anuidade|escolaridade)\b/.test(descNorm)
  const hasIntegralWord = /\b(integral|intermediario|periodo estendido|contraturno|semi integral|ampliacao)\b/.test(
    descNorm
  )

  // 4. Mensalidade Escolar (cada produto distinto mantém sua própria chave e grade separada)
  if (hasMensalidadeWord) {
    return {
      key: `${hasIntegralWord ? 'MENSALIDADE_INT' : 'MENSALIDADE_REG'}_${titleKey}`,
      categoria: 'MENSALIDADE',
      nome: cleanTitle || (hasIntegralWord ? 'Mensalidade - Integral' : 'Mensalidade Escolar'),
      hasMensalidadeWord: true,
      hasIntegralWord,
      isGenericTuitionFallback: false,
    }
  }

  // 5. Período Integral / Intermediário / Estendido (sem a palavra "Mensalidade" no título)
  if (hasIntegralWord) {
    return {
      key: `INTEGRAL_${titleKey}`,
      categoria: 'INTEGRAL',
      nome: cleanTitle || 'Período Integral / Estendido',
      hasMensalidadeWord: false,
      hasIntegralWord: true,
      isGenericTuitionFallback: false,
    }
  }

  // 6. Fallback para itens sem palavras-chave explícitas
  if (rawType === 'OTHER') {
    return {
      key: `OUTROS_${titleKey}`,
      categoria: 'OUTROS',
      nome: cleanTitle || 'Outros / Taxas',
      hasMensalidadeWord: false,
      hasIntegralWord: false,
      isGenericTuitionFallback: false,
    }
  }

  return {
    key: `TUITION_FALLBACK_${titleKey}`,
    categoria: 'MENSALIDADE',
    nome: cleanTitle || 'Mensalidade / Escolaridade',
    hasMensalidadeWord: false,
    hasIntegralWord: false,
    isGenericTuitionFallback: true,
  }
}

// ─── Cache Rápido da Base ERP para Conciliação (TTL 45s) ─────────────────────

interface ErpSnapshot {
  alunos: any[]
  alunoRespLinks: any[]
  responsaveis: any[]
  negociacoes: any[]
  matriculasDigitais: any[]
  fetchedAt: number
}

let erpSnapshotCache: ErpSnapshot | null = null
const ERP_CACHE_TTL_MS = 45 * 1000

async function getErpSnapshot(forceRefresh = false): Promise<ErpSnapshot> {
  const now = Date.now()
  if (!forceRefresh && erpSnapshotCache && now - erpSnapshotCache.fetchedAt < ERP_CACHE_TTL_MS) {
    return erpSnapshotCache
  }

  const supabase = getAdminClient()

  // Busca paginada de alunos para garantir 100% dos registros mesmo acima de 1000 linhas
  const fetchAllAlunos = async () => {
    const all: any[] = []
    const pageSize = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('alunos')
        .select(
          'id, nome, matricula, turma, serie, turno, unidade, status, email, telefone, responsavel, responsavel_financeiro, responsavel_pedagogico, inadimplente, foto, foto_url, dados, created_at'
        )
        .range(from, from + pageSize - 1)
      if (error || !data || data.length === 0) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
    return all
  }

  const fetchAllLinks = async () => {
    const all: any[] = []
    const pageSize = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, responsavel_id, parentesco, resp_financeiro, resp_pedagogico')
        .range(from, from + pageSize - 1)
      if (error || !data || data.length === 0) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
    return all
  }

  const fetchAllResponsaveis = async () => {
    const all: any[] = []
    const pageSize = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('responsaveis')
        .select('id, nome, email, telefone, dados')
        .range(from, from + pageSize - 1)
      if (error || !data || data.length === 0) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
    return all
  }

  const fetchNegociacoes = async () => {
    try {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'matriculas_negociacoes_v1')
        .maybeSingle()
      return Array.isArray(data?.valor) ? data.valor : []
    } catch {
      return []
    }
  }

  const fetchMatriculasDigitais = async () => {
    try {
      const { data } = await supabase
        .from('matriculas_digitais')
        .select('id, protocolo, aluno_id, aluno_nome, ano_letivo, status')
        .limit(3000)
      return data || []
    } catch {
      return []
    }
  }

  const [alunos, alunoRespLinks, responsaveis, negociacoes, matriculasDigitais] = await Promise.all([
    fetchAllAlunos(),
    fetchAllLinks(),
    fetchAllResponsaveis(),
    fetchNegociacoes(),
    fetchMatriculasDigitais(),
  ])

  erpSnapshotCache = {
    alunos,
    alunoRespLinks,
    responsaveis,
    negociacoes,
    matriculasDigitais,
    fetchedAt: Date.now(),
  }

  return erpSnapshotCache
}

// ─── Handler Principal GET /api/isaac/conciliacao ────────────────────────────

export async function GET(request: Request) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!
  if (!isStaff) {
    return NextResponse.json(
      { error: 'Acesso restrito a colaboradores autorizados da Gestão Escolar.' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const ano = (searchParams.get('ano') || '2026').trim()
  const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('force') === 'true'

  const startTime = Date.now()

  try {
    // 1. Carregar dados do Isaac e do ERP em paralelo
    let isaacItems: IsaacInstallment[] = []
    let isaacFetchedAt = Date.now()
    let isaacConnected = true
    let isaacError: string | null = null

    const [erpSnapshot, turmasGrupos] = await Promise.all([
      getErpSnapshot(forceRefresh),
      getCachedTurmasAndGrupos(),
      (async () => {
        try {
          const yearCache = await getOrFetchYearCache(ano, { forceRefresh })
          isaacItems = yearCache.items || []
          isaacFetchedAt = yearCache.fetchedAt
        } catch (err: any) {
          console.error(`[ConciliacaoIsaac] Aviso ao consultar Isaac para o ano ${ano}:`, err.message)
          isaacConnected = false
          isaacError = err.message || 'Erro ao conectar na API do Isaac Escola.'
        }
      })(),
    ])

    const allTurmas = turmasGrupos.allTurmas || []

    // 2. Mapear Turmas para resolução instantânea de nome, série, segmento e ano
    const turmaLookup = new Map<string, any>()
    for (const t of allTurmas) {
      if (!t) continue
      const keys = [t.id, t.codigo, t.nome, t.dados?.codigo, t.dados?.id]
        .filter(Boolean)
        .map((k: any) => String(k).trim())
      for (const k of keys) {
        turmaLookup.set(k, t)
        turmaLookup.set(k.toLowerCase(), t)
        const stripped = k.replace(/^(t_|turma_|sync-)/i, '').trim()
        if (stripped) {
          turmaLookup.set(stripped, t)
          turmaLookup.set(stripped.toLowerCase(), t)
        }
      }
    }

    // 3. Mapear Responsáveis do ERP por aluno_id
    const respMapById = new Map<string, any>()
    for (const r of erpSnapshot.responsaveis) {
      if (r?.id) respMapById.set(String(r.id).trim(), r)
    }

    const linksByStudentRef = new Map<string, any[]>()
    for (const l of erpSnapshot.alunoRespLinks) {
      const aId = String(l.aluno_id || '').trim()
      if (!aId) continue
      const normAId = normalizeId(aId)
      const list1 = linksByStudentRef.get(aId) || []
      list1.push(l)
      linksByStudentRef.set(aId, list1)
      if (normAId && normAId !== aId) {
        const list2 = linksByStudentRef.get(normAId) || []
        list2.push(l)
        linksByStudentRef.set(normAId, list2)
      }
    }

    // 4. Mapear Negociações e Contratos Digitais do Ano Selecionado
    const negByStudentId = new Map<string, any>()
    const negByStudentName = new Map<string, any>()
    for (const neg of erpSnapshot.negociacoes) {
      if (!neg || String(neg.anoLetivo || '').trim() !== ano) continue
      if (neg.status === 'cancelado') continue
      if (neg.alunoIdErp) {
        negByStudentId.set(normalizeId(neg.alunoIdErp), neg)
      }
      if (Array.isArray(neg.alunos)) {
        for (const al of neg.alunos) {
          if (al?.id) negByStudentId.set(normalizeId(al.id), neg)
          if (al?.nome) negByStudentName.set(normalizeName(al.nome), neg)
        }
      }
      if (neg.alunoNome) {
        negByStudentName.set(normalizeName(neg.alunoNome), neg)
      }
    }

    const matDigitalByStudentId = new Map<string, string>()
    const matDigitalByStudentName = new Map<string, string>()
    for (const md of erpSnapshot.matriculasDigitais) {
      if (!md || String(md.ano_letivo || '').trim() !== ano) continue
      if (md.status === 'cancelado' || md.status === 'recusado') continue
      if (md.aluno_id) matDigitalByStudentId.set(normalizeId(md.aluno_id), md.status)
      if (md.aluno_nome) matDigitalByStudentName.set(normalizeName(md.aluno_nome), md.status)
    }

    // 5. Indexar Alunos do ERP para Match Rápido (por ID/Matrícula e por Nome Normalizado)
    interface ProcessedErpStudent {
      raw: any
      erpId: string
      erpMatricula: string
      nome: string
      nomeNorm: string
      foto: string | null
      statusErp: string
      isInactive: boolean
      matriculadoNoAno: boolean
      turmaNome: string
      serieNome: string
      segmentoNome: string
      turnoNome: string
      unidadeNome: string
      isIntegralErp: boolean
      responsavelNome: string
      responsavelCpf: string
      responsavelTelefone: string
      responsavelEmail: string
      responsavelIdErp: string | null
      allRefIds: string[]
    }

    const erpStudentsList: ProcessedErpStudent[] = []
    const erpByRefId = new Map<string, ProcessedErpStudent>()
    const erpByNameNorm = new Map<string, ProcessedErpStudent[]>()

    // Verificar se existem alunos com vínculo explícito para este ano no ERP
    let totalWithExplicitYearInErp = 0
    for (const s of erpSnapshot.alunos) {
      const hist = s.historicoTurmas || s.dados?.historicoTurmas
      if (Array.isArray(hist) && hist.some((h: any) => String(h?.anoLetivo || h?.ano || '').trim() === ano)) {
        totalWithExplicitYearInErp++
      } else {
        const sAno = String(s.anoLetivo || s.ano_letivo || s.dados?.anoLetivo || s.dados?.ano_letivo || '').trim()
        if (sAno === ano) totalWithExplicitYearInErp++
      }
    }

    for (const s of erpSnapshot.alunos) {
      if (!s) continue
      const d = s.dados || {}
      const erpId = String(s.id || '').trim()
      const erpMatricula = String(s.matricula || d.matricula || d.codigo || s.id || '').trim()
      const nome = String(s.nome || '').trim()
      if (!nome) continue
      const nomeNorm = normalizeName(nome)
      const statusErp = String(s.status || d.status || 'Ativo').trim()
      const isInactive = isStudentStatusInactive(statusErp)

      // Resolver vínculo no ano selecionado (com fallback para o vínculo ativo atual no ERP)
      const hist: any[] = Array.isArray(s.historicoTurmas)
        ? s.historicoTurmas
        : Array.isArray(d.historicoTurmas)
          ? d.historicoTurmas
          : []

      const histForYear = hist.filter(
        (h: any) => h && String(h.anoLetivo || h.ano || '').trim() === ano && h.status !== 'Inativo' && h.status !== 'Transferido'
      )
      const activeVinculoYear = histForYear.length > 0 ? histForYear[histForYear.length - 1] : null

      const activeHistAll = hist.filter(
        (h: any) => h && h.status !== 'Inativo' && h.status !== 'Transferido' && h.status !== 'Anterior'
      )
      const latestActiveVinculo =
        activeVinculoYear ||
        (activeHistAll.length > 0 ? activeHistAll[activeHistAll.length - 1] : hist.length > 0 ? hist[hist.length - 1] : null)

      const negForYear =
        negByStudentId.get(normalizeId(erpId)) ||
        negByStudentId.has(normalizeId(erpMatricula))
          ? negByStudentId.get(normalizeId(erpId)) || negByStudentId.get(normalizeId(erpMatricula))
          : negByStudentName.get(nomeNorm) || null

      const rawTurmaCandidate = activeVinculoYear
        ? String(activeVinculoYear.serieTurma || activeVinculoYear.turma || activeVinculoYear.turmaId || '').trim()
        : String(
            s.turma ||
              d.turma ||
              latestActiveVinculo?.serieTurma ||
              latestActiveVinculo?.turma ||
              latestActiveVinculo?.turmaId ||
              negForYear?.serieTurma ||
              ''
          ).trim()

      const matchedTurmaObj = rawTurmaCandidate
        ? turmaLookup.get(rawTurmaCandidate) || turmaLookup.get(rawTurmaCandidate.toLowerCase())
        : null

      const turmaAno = matchedTurmaObj?.ano ? String(matchedTurmaObj.ano).trim() : ''
      const studentRootAno = String(s.anoLetivo || s.ano_letivo || d.anoLetivo || d.ano_letivo || '').trim()

      const hasNegInYear =
        negByStudentId.has(normalizeId(erpId)) ||
        negByStudentId.has(normalizeId(erpMatricula)) ||
        negByStudentName.has(nomeNorm)
      const hasMatDigitalInYear =
        matDigitalByStudentId.has(normalizeId(erpId)) ||
        matDigitalByStudentId.has(normalizeId(erpMatricula)) ||
        matDigitalByStudentName.has(nomeNorm)

      // Critério de aluno na Gestão Escolar (ERP) para o ano letivo:
      // Para anos vigentes/futuros (2026, 2027+), todo aluno ATIVO no ERP pertence à base da Gestão Escolar,
      // permitindo visualizar todos os alunos que estão no ERP mas ainda não possuem cobranças no Isaac.
      const anoNum = Number(ano) || 2026
      let matriculadoNoAno = false
      if (!isInactive) {
        if (anoNum >= 2026) {
          matriculadoNoAno = true
        } else if (activeVinculoYear) {
          matriculadoNoAno = true
        } else if (turmaAno === ano || studentRootAno === ano) {
          matriculadoNoAno = true
        } else if (hasNegInYear || hasMatDigitalInYear) {
          matriculadoNoAno = true
        }
      }

      // Resolução de nomes legíveis de turma, série, segmento e turno
      let turmaNome =
        matchedTurmaObj?.nome ||
        activeVinculoYear?.serieTurma ||
        activeVinculoYear?.turma ||
        latestActiveVinculo?.serieTurma ||
        latestActiveVinculo?.turma ||
        negForYear?.serieTurma ||
        ''
      if (!turmaNome && rawTurmaCandidate && !/^\d+$/.test(rawTurmaCandidate)) {
        turmaNome = rawTurmaCandidate
      }
      if (!turmaNome) turmaNome = 'Sem Turma Definida'

      const serieNome =
        activeVinculoYear?.serie ||
        latestActiveVinculo?.serie ||
        matchedTurmaObj?.serie ||
        matchedTurmaObj?.dados?.serie ||
        s.serie ||
        d.serie ||
        turmaNome

      const segmentoNome =
        activeVinculoYear?.segmento ||
        latestActiveVinculo?.segmento ||
        matchedTurmaObj?.dados?.segmento ||
        s.segmento ||
        d.segmento ||
        (turmaNome.toUpperCase().includes('MÉDIO') || turmaNome.toUpperCase().includes('MEDIO') || turmaNome.toUpperCase().includes('SÉRIE')
          ? 'Ensino Médio'
          : turmaNome.toUpperCase().includes('NÍVEL') || turmaNome.toUpperCase().includes('INFANTIL') || turmaNome.toUpperCase().includes('MATERNAL') || turmaNome.toUpperCase().includes('BERÇÁRIO')
            ? 'Educação Infantil'
            : 'Ensino Fundamental')

      const turnoNome =
        activeVinculoYear?.turno ||
        latestActiveVinculo?.turno ||
        matchedTurmaObj?.turno ||
        matchedTurmaObj?.dados?.turno ||
        s.turno ||
        d.turno ||
        'Regular'

      const unidadeNome =
        activeVinculoYear?.unidade ||
        latestActiveVinculo?.unidade ||
        matchedTurmaObj?.dados?.unidade ||
        s.unidade ||
        d.unidade ||
        'Unidade Principal'

      const isIntegralErp = isAlunoIntegralIntermediario(s, allTurmas, [], ano)

      // Resolver Responsável Financeiro no ERP
      const refCandidates = Array.from(
        new Set([erpId, erpMatricula, d.codigo, d.id, d.matricula].filter(Boolean).map((x: any) => String(x).trim()))
      )
      const studentLinks: any[] = []
      for (const ref of refCandidates) {
        const l1 = linksByStudentRef.get(ref) || []
        const l2 = linksByStudentRef.get(normalizeId(ref)) || []
        studentLinks.push(...l1, ...l2)
      }

      const finLink = studentLinks.find((l) => l.resp_financeiro === true) || studentLinks[0]
      const respObj = finLink?.responsavel_id ? respMapById.get(String(finLink.responsavel_id).trim()) : null

      const responsavelNome =
        respObj?.nome ||
        s.responsavel_financeiro ||
        d.responsavelFinanceiro ||
        d.responsavel_financeiro ||
        s.responsavel ||
        d.responsavel ||
        ''

      const responsavelCpf = formatCPF(
        respObj?.dados?.cpf ||
          respObj?.cpf ||
          d.cpf_responsavel ||
          d.cpfResponsavel ||
          ''
      )

      const responsavelTelefone = String(
        respObj?.telefone ||
          d.celular_responsavel ||
          d.telResponsavel ||
          s.telefone ||
          d.telefone ||
          ''
      ).trim()

      const responsavelEmail = String(
        respObj?.email ||
          d.email_responsavel ||
          d.emailResponsavel ||
          s.email ||
          d.email ||
          ''
      ).trim()

      const rawFoto = s.foto || s.foto_url || d.foto || d.avatarUrl || d.fotoUrl || null
      const foto = typeof rawFoto === 'string' && rawFoto.length > 5 && !rawFoto.includes('undefined') ? rawFoto : null

      const processed: ProcessedErpStudent = {
        raw: s,
        erpId,
        erpMatricula,
        nome,
        nomeNorm,
        foto,
        statusErp,
        isInactive,
        matriculadoNoAno,
        turmaNome,
        serieNome,
        segmentoNome,
        turnoNome,
        unidadeNome,
        isIntegralErp,
        responsavelNome,
        responsavelCpf,
        responsavelTelefone,
        responsavelEmail,
        responsavelIdErp: respObj?.id ? String(respObj.id) : finLink?.responsavel_id ? String(finLink.responsavel_id) : null,
        allRefIds: refCandidates,
      }

      erpStudentsList.push(processed)

      for (const ref of refCandidates) {
        erpByRefId.set(ref, processed)
        const normRef = normalizeId(ref)
        if (normRef) erpByRefId.set(normRef, processed)
      }

      if (nomeNorm) {
        const list = erpByNameNorm.get(nomeNorm) || []
        list.push(processed)
        erpByNameNorm.set(nomeNorm, list)
      }
    }

    // 6. Agrupar Parcelas do Isaac por Aluno
    interface IsaacStudentBucket {
      bucketKey: string
      isaacStudentId: string | null
      isaacExternalId: string | null
      isaacStudentName: string
      installments: IsaacInstallment[]
      matchedErp: ProcessedErpStudent | null
      matchMetodo: 'EXACT_ID' | 'NAME_MATCH' | 'ONLY_ISAAC'
    }

    const isaacBucketsByKey = new Map<string, IsaacStudentBucket>()
    const matchedErpIdsSet = new Set<string>()

    for (const item of isaacItems) {
      if (!item) continue
      const rawExtId = String(item.student?.external_id || '').trim()
      const normExtId = normalizeId(rawExtId)
      const isaacStudentId = String(item.student?.id || '').trim() || null
      const isaacStudentName = String(item.student?.name || 'Aluno sem Nome no Isaac').trim()
      const isaacNameNorm = normalizeName(isaacStudentName)

      // Tentar localizar o aluno correspondente no ERP
      let matchedErp: ProcessedErpStudent | null = null
      let matchMetodo: 'EXACT_ID' | 'NAME_MATCH' | 'ONLY_ISAAC' = 'ONLY_ISAAC'

      if (rawExtId) {
        matchedErp = erpByRefId.get(rawExtId) || (normExtId ? erpByRefId.get(normExtId) : null) || null
        if (matchedErp) {
          matchMetodo = 'EXACT_ID'
        }
      }

      if (!matchedErp && isaacNameNorm) {
        const candidates = erpByNameNorm.get(isaacNameNorm) || []
        if (candidates.length === 1) {
          matchedErp = candidates[0]
          matchMetodo = 'NAME_MATCH'
        } else if (candidates.length > 1) {
          // Prioriza o ativo/matriculado no ano
          matchedErp = candidates.find((c) => c.matriculadoNoAno) || candidates.find((c) => !c.isInactive) || candidates[0]
          matchMetodo = 'NAME_MATCH'
        }
      }

      // Chave unificada do bucket para nunca duplicar o mesmo aluno
      const bucketKey = matchedErp
        ? `ERP_${matchedErp.erpId}`
        : normExtId
          ? `ISAAC_EXT_${normExtId}`
          : isaacNameNorm
            ? `ISAAC_NAME_${isaacNameNorm}`
            : `ISAAC_ID_${isaacStudentId || item.id}`

      if (matchedErp) {
        matchedErpIdsSet.add(matchedErp.erpId)
      }

      let bucket = isaacBucketsByKey.get(bucketKey)
      if (!bucket) {
        bucket = {
          bucketKey,
          isaacStudentId,
          isaacExternalId: rawExtId || null,
          isaacStudentName,
          installments: [],
          matchedErp,
          matchMetodo,
        }
        isaacBucketsByKey.set(bucketKey, bucket)
      } else {
        if (!bucket.isaacExternalId && rawExtId) bucket.isaacExternalId = rawExtId
        if (!bucket.isaacStudentId && isaacStudentId) bucket.isaacStudentId = isaacStudentId
        if (matchMetodo === 'EXACT_ID') bucket.matchMetodo = 'EXACT_ID'
      }

      bucket.installments.push(item)
    }

    // 7. Construir Lista Consolidada de Alunos (Isaac + ERP do Ano)
    const now = new Date()
    const consolidatedStudents: AlunoConciliacaoItem[] = []

    // Helper para processar um bucket (ou aluno apenas no ERP)
    const buildStudentConciliacaoItem = (
      erpStudent: ProcessedErpStudent | null,
      isaacBucket: IsaacStudentBucket | null
    ): AlunoConciliacaoItem => {
      const rawInstallments = isaacBucket?.installments || []

      // Deduplicar parcelas por id
      const uniqueInstMap = new Map<string, IsaacInstallment>()
      for (const inst of rawInstallments) {
        if (inst?.id && !uniqueInstMap.has(inst.id)) {
          uniqueInstMap.set(inst.id, inst)
        }
      }
      const installments = Array.from(uniqueInstMap.values())

      // Ordenar parcelas cronologicamente por vencimento
      installments.sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())

      // Mapear DTO de cada parcela e agrupar por produto
      interface RawProdGroup {
        key: string
        categoria: ProdutoCategoria
        nome: string
        hasMensalidadeWord: boolean
        hasIntegralWord: boolean
        isGenericTuitionFallback: boolean
        items: ParcelaConciliacaoDTO[]
        productIds: Set<string>
        contractIds: Set<string>
      }

      const produtosRawMap = new Map<string, RawProdGroup>()

      const parcelasDTO: ParcelaConciliacaoDTO[] = installments.map((inst) => {
        const prodInfo = classifyProduct(inst)
        const mesCompetencia = extractMonthFromInstallment(inst, ano)
        const mesObj = mesCompetencia ? MESES_INFO[mesCompetencia - 1] : null
        const seqInfo = extractInstallmentSequence(inst.description)

        const isOverdue =
          inst.status === 'OVERDUE' ||
          (inst.status === 'OPEN' && Boolean(inst.due_date) && new Date(inst.due_date + 'T23:59:59') < now)

        const effectiveStatus: ParcelaConciliacaoDTO['status'] = isOverdue ? 'OVERDUE' : inst.status
        const valorEfetivoCentavos = getEffectiveAmount(inst)
        const valorPagoCentavos = inst.paid_value || (inst.status === 'PAID' ? valorEfetivoCentavos : 0)
        const descontoCentavos = (inst.discounts || []).reduce((acc, d) => acc + (d.amount || 0), 0)
        const multaJurosCentavos = (inst.late_payment_fee_paid || 0) + (inst.late_payment_interest_paid || 0)
        const firstRec = inst.active_receivables?.[0] || null

        const dto: ParcelaConciliacaoDTO = {
          id: inst.id,
          externalId: inst.external_id || '',
          contractId: inst.contract_id || '',
          productId: inst.product?.external_id || inst.product?.id || '',
          produtoKey: prodInfo.key,
          produtoCategoria: prodInfo.categoria,
          produtoNome: prodInfo.nome,
          descricao: inst.description || prodInfo.nome,
          tipoOriginal: inst.type || 'TUITION',
          status: effectiveStatus,
          statusOriginal: inst.status,
          mesCompetencia,
          mesSigla: mesObj ? mesObj.sigla : '—',
          numeroParcela: seqInfo ? seqInfo.current : mesCompetencia,
          totalParcelasDeclarado: seqInfo ? seqInfo.total : null,
          vencimento: inst.due_date || '',
          dataPagamento: inst.paid_date || null,
          competencia: inst.competence_date || '',
          anoReferencia: inst.reference_year || ano,
          valorBaseCentavos: inst.base_amount || 0,
          valorBaseFormatado: formatIsaacAmount(inst.base_amount || 0),
          valorEfetivoCentavos,
          valorEfetivoFormatado: formatIsaacAmount(valorEfetivoCentavos),
          valorPagoCentavos,
          valorPagoFormatado: formatIsaacAmount(valorPagoCentavos),
          descontoCentavos,
          descontoFormatado: formatIsaacAmount(descontoCentavos),
          multaJurosCentavos,
          multaJurosFormatado: formatIsaacAmount(multaJurosCentavos),
          responsavelNome: inst.guardian?.name || '',
          responsavelCpf: formatCPF(inst.guardian?.tax_id),
          responsavelExternalId: inst.guardian?.external_id || '',
          pixCode: firstRec?.pix_qr_code || null,
          boletoUrl: firstRec?.bank_slip_url || null,
          checkoutUrl: firstRec?.checkout_url || null,
        }

        let prodGroup = produtosRawMap.get(prodInfo.key)
        if (!prodGroup) {
          prodGroup = {
            key: prodInfo.key,
            categoria: prodInfo.categoria,
            nome: prodInfo.nome,
            hasMensalidadeWord: prodInfo.hasMensalidadeWord,
            hasIntegralWord: prodInfo.hasIntegralWord,
            isGenericTuitionFallback: prodInfo.isGenericTuitionFallback,
            items: [],
            productIds: new Set<string>(),
            contractIds: new Set<string>(),
          }
          produtosRawMap.set(prodInfo.key, prodGroup)
        }
        prodGroup.items.push(dto)
        if (dto.productId) prodGroup.productIds.add(dto.productId)
        if (dto.contractId) prodGroup.contractIds.add(dto.contractId)

        return dto
      })

      // ── Reconciliação inteligente de categorias de produtos do aluno ─────────
      // 1. Se o aluno já possui Mensalidade ou Integral explícito, qualquer item que caiu em TUITION_FALLBACK
      //    (sem a palavra "Mensalidade" na descrição) é na verdade um serviço/taxa extra (OUTROS).
      const hasExplicitTuitionOrIntegral = Array.from(produtosRawMap.values()).some(
        (g) => (g.categoria === 'MENSALIDADE' || g.categoria === 'INTEGRAL') && !g.isGenericTuitionFallback
      )
      if (hasExplicitTuitionOrIntegral) {
        for (const g of produtosRawMap.values()) {
          if (g.isGenericTuitionFallback) {
            g.categoria = 'OUTROS'
          }
        }
      }

      // 2. Manter cada produto separado (sem mesclar produtos diferentes na mesma grade)
      //    Se o aluno possui simultaneamente uma Mensalidade Regular E um produto com "Integral" nos mesmos meses,
      //    classifica o contraturno como INTEGRAL para que ambos apareçam identificados e com grades independentes.
      const allGroups = Array.from(produtosRawMap.values())
      const regMensGroups = allGroups.filter((g) => g.categoria === 'MENSALIDADE' && !g.hasIntegralWord)
      const intMensGroups = allGroups.filter((g) => g.categoria === 'MENSALIDADE' && g.hasIntegralWord)
      const pureIntGroups = allGroups.filter((g) => g.categoria === 'INTEGRAL')

      if (regMensGroups.length > 0 && intMensGroups.length > 0) {
        const regActiveMonths = new Set<number>()
        regMensGroups.forEach((rg) => {
          rg.items.forEach((i) => {
            if (i.status !== 'CANCELED' && i.mesCompetencia) regActiveMonths.add(i.mesCompetencia)
          })
        })
        for (const ig of intMensGroups) {
          let overlap = 0
          ig.items.forEach((i) => {
            if (i.status !== 'CANCELED' && i.mesCompetencia && regActiveMonths.has(i.mesCompetencia)) {
              overlap++
            }
          })
          // Se sobrepõe nos mesmos meses, é o produto de Período Integral / Contraturno (mantido separado com sua própria grade)
          if (overlap > 1) {
            ig.categoria = 'INTEGRAL'
          }
        }
      } else if (regMensGroups.length === 0 && intMensGroups.length === 0 && pureIntGroups.length > 0) {
        // Se o aluno não possui nenhum grupo com a palavra "Mensalidade", promove o primeiro grupo INTEGRAL para MENSALIDADE
        pureIntGroups[0].categoria = 'MENSALIDADE'
      }

      // Sincronizar categoria e nome resolvidos de volta em cada ParcelaConciliacaoDTO
      for (const grp of produtosRawMap.values()) {
        for (const itemDto of grp.items) {
          itemDto.produtoKey = grp.key
          itemDto.produtoCategoria = grp.categoria
          itemDto.produtoNome = grp.nome
        }
      }

      // Verificar se o aluno possui Matrícula (ENROLLMENT / Entrada Mensalidade) ativa no ano
      const hasActiveMatricula = Array.from(produtosRawMap.values()).some(
        (g) => g.categoria === 'MATRICULA' && g.items.some((i) => i.status !== 'CANCELED')
      )

      // Localizar Negociação Autorizada se existir
      const nomeNorm = erpStudent?.nomeNorm || normalizeName(isaacBucket?.isaacStudentName)
      const negObj =
        (erpStudent?.erpId ? negByStudentId.get(normalizeId(erpStudent.erpId)) : null) ||
        (erpStudent?.erpMatricula ? negByStudentId.get(normalizeId(erpStudent.erpMatricula)) : null) ||
        (isaacBucket?.isaacExternalId ? negByStudentId.get(normalizeId(isaacBucket.isaacExternalId)) : null) ||
        (nomeNorm ? negByStudentName.get(nomeNorm) : null) ||
        null

      // Construir auditoria detalhada para cada Produto do aluno
      const produtosAudit: ProdutoAlunoAudit[] = []
      const orderPriority: Record<ProdutoCategoria, number> = {
        MATRICULA: 1,
        MENSALIDADE: 2,
        INTEGRAL: 3,
        MATERIAL: 4,
        OUTROS: 5,
      }

      const sortedProductGroups = Array.from(produtosRawMap.values()).sort(
        (a, b) => (orderPriority[a.categoria] || 9) - (orderPriority[b.categoria] || 9)
      )

      for (const grp of sortedProductGroups) {
        const activeItems = grp.items.filter((i) => i.status !== 'CANCELED')
        const paidItems = activeItems.filter((i) => i.status === 'PAID')
        const openItems = activeItems.filter((i) => i.status === 'OPEN')
        const overdueItems = activeItems.filter((i) => i.status === 'OVERDUE')
        const canceledItems = grp.items.filter((i) => i.status === 'CANCELED')
        const renegItems = activeItems.filter((i) => i.status === 'RENEGOTIATED' || i.status === 'AGGLUTINATED')

        const valorContratadoCentavos = activeItems.reduce(
          (acc, i) => acc + (i.status === 'PAID' ? i.valorPagoCentavos || i.valorEfetivoCentavos : i.valorEfetivoCentavos),
          0
        )
        const valorPagoCentavos = paidItems.reduce((acc, i) => acc + (i.valorPagoCentavos || i.valorEfetivoCentavos), 0)
        const valorAbertoCentavos = [...openItems, ...overdueItems].reduce((acc, i) => acc + i.valorEfetivoCentavos, 0)
        const valorVencidoCentavos = overdueItems.reduce((acc, i) => acc + i.valorEfetivoCentavos, 0)

        // Construir Grade dos 12 Meses para este Produto
        const mesesGrid: MesAuditItem[] = MESES_INFO.map((mInfo) => {
          const itemsInMonth = grp.items.filter((i) => i.mesCompetencia === mInfo.mes)
          const activeInMonth = itemsInMonth.filter((i) => i.status !== 'CANCELED')
          const canceledInMonth = itemsInMonth.filter((i) => i.status === 'CANCELED')

          let status: MesGridStatus = 'MISSING'
          if (activeInMonth.length > 0) {
            if (activeInMonth.some((i) => i.status === 'OVERDUE')) status = 'OVERDUE'
            else if (activeInMonth.some((i) => i.status === 'OPEN')) status = 'OPEN'
            else if (activeInMonth.some((i) => i.status === 'PAID')) status = 'PAID'
            else status = 'RENEGOTIATED'
          } else if (canceledInMonth.length > 0) {
            status = 'CANCELED_ONLY'
          }

          const valCentavos = activeInMonth.reduce(
            (acc, i) => acc + (i.status === 'PAID' ? i.valorPagoCentavos || i.valorEfetivoCentavos : i.valorEfetivoCentavos),
            0
          )

          return {
            mes: mInfo.mes,
            sigla: mInfo.sigla,
            nome: mInfo.nome,
            status,
            quantidadeAtivas: activeInMonth.length,
            quantidadeCanceladas: canceledInMonth.length,
            valorTotalCentavos: valCentavos,
            valorFormatado: valCentavos > 0 ? formatIsaacAmount(valCentavos) : '—',
            parcelasIds: itemsInMonth.map((i) => i.id),
          }
        })

        const mesesPresentes = mesesGrid
          .filter((m) => m.quantidadeAtivas > 0)
          .map((m) => m.mes)

        const mesesCanceladosSemSubstituta = mesesGrid
          .filter((m) => m.status === 'CANCELED_ONLY')
          .map((m) => m.mes)

        // Cálculo de parcelas/meses faltantes conforme a categoria do produto
        let mesesFaltantesComMatricula: number[] = []
        let mesesFaltantes12Estrito: number[] = []
        let mesesFaltantes11FevDez: number[] = []
        const numerosParcelasFaltantes: string[] = []
        let parcelasEsperadasPadrao = activeItems.length
        let temParcelasFaltantes = false
        let resumoFaltantes = 'Grade Completa'

        if (grp.categoria === 'MENSALIDADE') {
          // No Colégio Impacto, o produto Mensalidade no Isaac possui 11 parcelas (FEV a DEZ),
          // sendo JAN a Matrícula/Entrada (que pode ser cobrada no Isaac ou paga diretamente na escola).
          const hasJanInMensalidade = mesesGrid[0].quantidadeAtivas > 0 || mesesGrid[0].quantidadeCanceladas > 0
          const baseExpected = hasJanInMensalidade ? 12 : 11
          parcelasEsperadasPadrao = Math.max(baseExpected, activeItems.length)

          // Regra Estrita 12 Meses: exige JAN (Matrícula ou Mensalidade no Isaac) + FEV a DEZ
          mesesFaltantes12Estrito = mesesGrid
            .filter((m) => {
              if (m.quantidadeAtivas > 0) return false
              if (m.mes === 1 && hasActiveMatricula) return false
              return true
            })
            .map((m) => m.mes)

          // Regra 11 Mensalidades (FEV a DEZ): verifica estritamente de Fevereiro a Dezembro
          mesesFaltantes11FevDez = mesesGrid
            .filter((m) => m.mes >= 2 && m.quantidadeAtivas === 0)
            .map((m) => m.mes)

          // Regra Padrão Impacto (COM_MATRICULA):
          // Audita FEV a DEZ (11 mensalidades) + alerta JAN apenas se havia cobrança em JAN que foi cancelada sem substituta
          mesesFaltantesComMatricula = mesesGrid
            .filter((m) => {
              if (m.quantidadeAtivas > 0) return false
              if (m.mes === 1) {
                return m.status === 'CANCELED_ONLY' && !hasActiveMatricula
              }
              return true
            })
            .map((m) => m.mes)

          temParcelasFaltantes = mesesFaltantesComMatricula.length > 0
          if (temParcelasFaltantes) {
            const siglas = mesesFaltantesComMatricula.map((m) => MESES_INFO[m - 1].sigla).join(', ')
            const allCanceled =
              mesesCanceladosSemSubstituta.length > 0 &&
              mesesFaltantesComMatricula.every((m) => mesesCanceladosSemSubstituta.includes(m))
            resumoFaltantes = allCanceled
              ? `${mesesFaltantesComMatricula.length} parc. cancelada(s): ${siglas}`
              : `Faltam ${mesesFaltantesComMatricula.length} mês(es): ${siglas}`
          }
        } else if (grp.categoria === 'INTEGRAL') {
          // Integral normalmente vai de FEV (2) a DEZ (12), ou pode ser um contrato parcial se tiver total declarado
          const declaredTotals = grp.items
            .map((i) => i.totalParcelasDeclarado)
            .filter((t): t is number => typeof t === 'number' && t > 0)
          const maxDeclaredTotal = declaredTotals.length > 0 ? Math.max(...declaredTotals) : null

          if (maxDeclaredTotal && maxDeclaredTotal < 11) {
            parcelasEsperadasPadrao = Math.max(maxDeclaredTotal, activeItems.length)
            const diff = Math.max(0, parcelasEsperadasPadrao - activeItems.length)
            temParcelasFaltantes = diff > 0 || mesesCanceladosSemSubstituta.length > 0
            if (mesesCanceladosSemSubstituta.length > 0) {
              mesesFaltantesComMatricula = mesesCanceladosSemSubstituta
              mesesFaltantes12Estrito = mesesCanceladosSemSubstituta
              mesesFaltantes11FevDez = mesesCanceladosSemSubstituta
              const siglas = mesesCanceladosSemSubstituta.map((m) => MESES_INFO[m - 1].sigla).join(', ')
              resumoFaltantes = `${mesesCanceladosSemSubstituta.length} parc. cancelada(s) no Integral: ${siglas}`
            }
          } else {
            const baseExp = mesesGrid[0].quantidadeAtivas > 0 ? 12 : 11
            parcelasEsperadasPadrao = Math.max(baseExp, activeItems.length)
            const missingIntegral = mesesGrid
              .filter((m) => m.mes >= 2 && m.quantidadeAtivas === 0)
              .map((m) => m.mes)
            mesesFaltantesComMatricula = missingIntegral
            mesesFaltantes12Estrito = missingIntegral
            mesesFaltantes11FevDez = missingIntegral
            temParcelasFaltantes = missingIntegral.length > 0
            if (temParcelasFaltantes) {
              const siglas = missingIntegral.map((m) => MESES_INFO[m - 1].sigla).join(', ')
              const allCanceled =
                mesesCanceladosSemSubstituta.length > 0 &&
                missingIntegral.every((m) => mesesCanceladosSemSubstituta.includes(m))
              resumoFaltantes = allCanceled
                ? `${missingIntegral.length} parc. cancelada(s) no Integral: ${siglas}`
                : `Faltam ${missingIntegral.length} mês(es) no Integral: ${siglas}`
            }
          }
        } else if (grp.categoria === 'MATERIAL' || grp.categoria === 'MATRICULA' || grp.categoria === 'OUTROS') {
          // Verificar se há numeração X/Y declarada nas descrições ou na negociação
          const declaredTotals = grp.items
            .map((i) => i.totalParcelasDeclarado)
            .filter((t): t is number => typeof t === 'number' && t > 0)
          const maxDeclaredTotal = declaredTotals.length > 0 ? Math.max(...declaredTotals) : null

          const negExpected =
            grp.categoria === 'MATERIAL' && negObj?.parcelasMaterial
              ? Number(negObj.parcelasMaterial)
              : grp.categoria === 'MATRICULA' && negObj?.parcelasMatricula
                ? Number(negObj.parcelasMatricula)
                : null

          const mesesComQualquerLancamento = mesesGrid.filter(
            (m) => m.quantidadeAtivas > 0 || m.quantidadeCanceladas > 0
          ).length
          const expectedCount =
            maxDeclaredTotal ||
            negExpected ||
            (grp.categoria === 'MATRICULA' ? 1 : Math.max(activeItems.length, mesesComQualquerLancamento))
          parcelasEsperadasPadrao = Math.max(expectedCount, activeItems.length, 1)

          if (mesesCanceladosSemSubstituta.length > 0) {
            mesesFaltantesComMatricula = mesesCanceladosSemSubstituta
            mesesFaltantes12Estrito = mesesCanceladosSemSubstituta
            mesesFaltantes11FevDez = mesesCanceladosSemSubstituta
          }

          if (maxDeclaredTotal && maxDeclaredTotal > 1) {
            const presentSeqs = new Set(
              activeItems.map((i) => i.numeroParcela).filter((n): n is number => typeof n === 'number')
            )
            for (let s = 1; s <= maxDeclaredTotal; s++) {
              if (!presentSeqs.has(s)) {
                numerosParcelasFaltantes.push(`${s}/${maxDeclaredTotal}`)
              }
            }
          }

          if (numerosParcelasFaltantes.length > 0) {
            temParcelasFaltantes = true
            resumoFaltantes = `Faltam parcela(s): ${numerosParcelasFaltantes.join(', ')}`
          } else if (activeItems.length < expectedCount) {
            parcelasEsperadasPadrao = Math.max(expectedCount, 1)
            temParcelasFaltantes = true
            const diff = parcelasEsperadasPadrao - activeItems.length
            resumoFaltantes =
              activeItems.length === 0
                ? `Todas as parcelas deste produto foram canceladas (0/${parcelasEsperadasPadrao})`
                : `Faltam ${diff} de ${parcelasEsperadasPadrao} parcela(s)`
          } else if (mesesCanceladosSemSubstituta.length > 0) {
            temParcelasFaltantes = true
            const siglas = mesesCanceladosSemSubstituta.map((m) => MESES_INFO[m - 1].sigla).join(', ')
            resumoFaltantes = `Parcela cancelada sem substituta em: ${siglas}`
          }
        }

        produtosAudit.push({
          key: grp.key,
          categoria: grp.categoria,
          nome: grp.nome,
          productIds: Array.from(grp.productIds),
          contractIds: Array.from(grp.contractIds),
          totalParcelasBruto: grp.items.length,
          parcelasAtivas: activeItems.length,
          parcelasPagas: paidItems.length,
          parcelasAbertas: openItems.length,
          parcelasVencidas: overdueItems.length,
          parcelasCanceladas: canceledItems.length,
          parcelasRenegociadas: renegItems.length,
          parcelasEsperadasPadrao,
          temParcelasFaltantes,
          mesesPresentes,
          mesesCanceladosSemSubstituta,
          mesesFaltantesComMatricula,
          mesesFaltantes12Estrito,
          mesesFaltantes11FevDez,
          numerosParcelasFaltantes,
          resumoFaltantes,
          valorContratadoCentavos,
          valorContratadoFormatado: formatIsaacAmount(valorContratadoCentavos),
          valorPagoCentavos,
          valorPagoFormatado: formatIsaacAmount(valorPagoCentavos),
          valorAbertoCentavos,
          valorAbertoFormatado: formatIsaacAmount(valorAbertoCentavos),
          valorVencidoCentavos,
          valorVencidoFormatado: formatIsaacAmount(valorVencidoCentavos),
          mesesGrid,
        })
      }

      // Grade consolidada de 12 meses da Anuidade (Matrícula + Mensalidade + Integral)
      const anuidadeItems = parcelasDTO.filter(
        (i) =>
          i.produtoCategoria === 'MENSALIDADE' ||
          i.produtoCategoria === 'MATRICULA' ||
          i.produtoCategoria === 'INTEGRAL'
      )
      const anuidadeMesesGrid: MesAuditItem[] = MESES_INFO.map((mInfo) => {
        const inMonth = anuidadeItems.filter((i) => i.mesCompetencia === mInfo.mes)
        const activeInMonth = inMonth.filter((i) => i.status !== 'CANCELED')
        const canceledInMonth = inMonth.filter((i) => i.status === 'CANCELED')

        let status: MesGridStatus = 'MISSING'
        if (activeInMonth.length > 0) {
          if (activeInMonth.some((i) => i.status === 'OVERDUE')) status = 'OVERDUE'
          else if (activeInMonth.some((i) => i.status === 'OPEN')) status = 'OPEN'
          else if (activeInMonth.some((i) => i.status === 'PAID')) status = 'PAID'
          else status = 'RENEGOTIATED'
        } else if (canceledInMonth.length > 0) {
          status = 'CANCELED_ONLY'
        } else if (mInfo.mes === 1 && hasActiveMatricula) {
          status = 'COVERED_BY_ENROLLMENT'
        }

        const valCentavos = activeInMonth.reduce(
          (acc, i) => acc + (i.status === 'PAID' ? i.valorPagoCentavos || i.valorEfetivoCentavos : i.valorEfetivoCentavos),
          0
        )

        return {
          mes: mInfo.mes,
          sigla: mInfo.sigla,
          nome: mInfo.nome,
          status,
          quantidadeAtivas: activeInMonth.length,
          quantidadeCanceladas: canceledInMonth.length,
          valorTotalCentavos: valCentavos,
          valorFormatado: valCentavos > 0 ? formatIsaacAmount(valCentavos) : '—',
          parcelasIds: inMonth.map((i) => i.id),
        }
      })

      // Totais Gerais do Aluno no Isaac
      const activeParcelas = parcelasDTO.filter((p) => p.status !== 'CANCELED')
      const paidParcelas = activeParcelas.filter((p) => p.status === 'PAID')
      const openParcelas = activeParcelas.filter((p) => p.status === 'OPEN')
      const overdueParcelas = activeParcelas.filter((p) => p.status === 'OVERDUE')
      const canceledParcelas = parcelasDTO.filter((p) => p.status === 'CANCELED')
      const renegParcelas = activeParcelas.filter((p) => p.status === 'RENEGOTIATED' || p.status === 'AGGLUTINATED')

      const valorTotalContratadoCentavos = activeParcelas.reduce(
        (acc, p) => acc + (p.status === 'PAID' ? p.valorPagoCentavos || p.valorEfetivoCentavos : p.valorEfetivoCentavos),
        0
      )
      const valorTotalPagoCentavos = paidParcelas.reduce(
        (acc, p) => acc + (p.valorPagoCentavos || p.valorEfetivoCentavos),
        0
      )
      const valorTotalAbertoCentavos = [...openParcelas, ...overdueParcelas].reduce(
        (acc, p) => acc + p.valorEfetivoCentavos,
        0
      )
      const valorTotalVencidoCentavos = overdueParcelas.reduce((acc, p) => acc + p.valorEfetivoCentavos, 0)

      const possuiParcelasAtivasIsaac = activeParcelas.length > 0
      const possuiApenasCanceladasIsaac = parcelasDTO.length > 0 && activeParcelas.length === 0
      const estaNoErp = Boolean(erpStudent)
      const matriculadoNoAnoErp = Boolean(
        erpStudent && !erpStudent.isInactive && (erpStudent.matriculadoNoAno || possuiParcelasAtivasIsaac)
      )

      // Determinar Status de Conciliação
      let conciliacaoStatus: ConciliacaoStatus = 'CONCILIADO'
      if (possuiParcelasAtivasIsaac) {
        if (!estaNoErp) {
          conciliacaoStatus = 'APENAS_ISAAC'
        } else if (erpStudent?.isInactive) {
          conciliacaoStatus = 'INATIVO_COM_ISAAC'
        } else {
          conciliacaoStatus = 'CONCILIADO'
        }
      } else {
        conciliacaoStatus = 'APENAS_ERP'
      }

      const matchMetodo: AlunoConciliacaoItem['matchMetodo'] = isaacBucket
        ? erpStudent
          ? isaacBucket.matchMetodo
          : 'ONLY_ISAAC'
        : 'ONLY_ERP'

      // Alerta se foi vinculado apenas pelo nome porque o external_id no Isaac está vazio ou divergente
      const alertaDivergenciaId = matchMetodo === 'NAME_MATCH'

      const categoriasProdutos = Array.from(new Set(produtosAudit.map((p) => p.categoria)))
      const hasAnyIntegralDescription = Array.from(produtosRawMap.values()).some((g) => g.hasIntegralWord)
      const mensalidadeProds = produtosAudit.filter((p) => p.categoria === 'MENSALIDADE')
      const mensalidadeProd = mensalidadeProds[0]
      const outrosProdsComFaltante = produtosAudit.some(
        (p) => p.categoria !== 'MENSALIDADE' && p.temParcelasFaltantes
      )

      const temParcelasFaltantes12ComMat =
        possuiParcelasAtivasIsaac &&
        (mensalidadeProds.length === 0 ||
          mensalidadeProds.some((p) => p.mesesFaltantesComMatricula.length > 0) ||
          outrosProdsComFaltante)

      const temParcelasFaltantes12Estrito =
        possuiParcelasAtivasIsaac &&
        (mensalidadeProds.length === 0 ||
          mensalidadeProds.some((p) => p.mesesFaltantes12Estrito.length > 0) ||
          outrosProdsComFaltante)

      const temParcelasFaltantes11FevDez =
        possuiParcelasAtivasIsaac &&
        (mensalidadeProds.length === 0 ||
          mensalidadeProds.some((p) => p.mesesFaltantes11FevDez.length > 0) ||
          outrosProdsComFaltante)

      // Resumo textual da auditoria de parcelas
      let resumoAuditoriaParcelas = 'Grade Completa'
      if (!possuiParcelasAtivasIsaac) {
        if (possuiApenasCanceladasIsaac) {
          resumoAuditoriaParcelas = 'Todas as parcelas no Isaac estão canceladas'
        } else if (negObj?.modalidadeIsaac === 'fora_isaac') {
          resumoAuditoriaParcelas = 'Negociação Fora do Isaac (Pagamento na Escola)'
        } else {
          resumoAuditoriaParcelas = 'Nenhuma parcela lançada no Isaac para este ano'
        }
      } else if (mensalidadeProds.length === 0) {
        resumoAuditoriaParcelas = 'Possui cobranças no Isaac, mas sem Mensalidade (TUITION) lançada'
      } else if (mensalidadeProds.some((p) => p.mesesFaltantesComMatricula.length > 0)) {
        const firstMissingMens = mensalidadeProds.find((p) => p.mesesFaltantesComMatricula.length > 0)
        resumoAuditoriaParcelas = firstMissingMens?.resumoFaltantes || 'Parcelas faltantes na Mensalidade'
      } else if (outrosProdsComFaltante) {
        const firstMissingProd = produtosAudit.find((p) => p.categoria !== 'MENSALIDADE' && p.temParcelasFaltantes)
        resumoAuditoriaParcelas = firstMissingProd?.resumoFaltantes || 'Parcelas faltantes em produtos extras'
      }

      // Dados do responsável consolidados (prioriza ERP, complementa com Isaac)
      const firstGuardianSample = parcelasDTO.find((p) => p.responsavelNome)
      const responsavelNome = erpStudent?.responsavelNome || firstGuardianSample?.responsavelNome || negObj?.responsavelNome || 'Não informado'
      const responsavelCpf = erpStudent?.responsavelCpf || firstGuardianSample?.responsavelCpf || formatCPF(negObj?.responsavelCpf) || ''
      const responsavelTelefone = erpStudent?.responsavelTelefone || negObj?.responsavelTelefone || ''
      const responsavelEmail = erpStudent?.responsavelEmail || ''

      // Extrair série/turma da descrição da parcela caso o aluno só exista no Isaac
      let turmaNome = erpStudent?.turmaNome || 'Não Enturmado no ERP'
      let serieNome = erpStudent?.serieNome || '—'
      let segmentoNome = erpStudent?.segmentoNome || 'Não Identificado'

      if (!erpStudent && parcelasDTO.length > 0) {
        const sampleDesc = parcelasDTO[0].descricao
        if (/m[eé]dio|s[eé]rie|terceir[aã]o/i.test(sampleDesc)) segmentoNome = 'Ensino Médio'
        else if (/n[ií]vel|infantil|maternal|ber[cç][aá]rio/i.test(sampleDesc)) segmentoNome = 'Educação Infantil'
        else if (/ano|fundamental/i.test(sampleDesc)) segmentoNome = 'Ensino Fundamental'
      }

      const contratoDigitalStatus =
        (erpStudent?.erpId ? matDigitalByStudentId.get(normalizeId(erpStudent.erpId)) : null) ||
        (erpStudent?.erpMatricula ? matDigitalByStudentId.get(normalizeId(erpStudent.erpMatricula)) : null) ||
        (nomeNorm ? matDigitalByStudentName.get(nomeNorm) : null) ||
        null

      return {
        key: isaacBucket?.bucketKey || `ERP_ONLY_${erpStudent?.erpId}`,
        nome: erpStudent?.nome || isaacBucket?.isaacStudentName || 'Aluno',
        erpId: erpStudent?.erpId || null,
        erpMatricula: erpStudent?.erpMatricula || null,
        isaacStudentId: isaacBucket?.isaacStudentId || null,
        isaacExternalId: isaacBucket?.isaacExternalId || null,
        foto: erpStudent?.foto || null,
        conciliacaoStatus,
        matchMetodo,
        alertaDivergenciaId,
        estaNoErp,
        matriculadoNoAnoErp,
        statusErp: erpStudent ? (erpStudent.isInactive ? 'Inativo' : 'Ativo') : 'Não Cadastrado',
        turmaNome,
        serieNome,
        segmentoNome,
        turnoNome: erpStudent?.turnoNome || '—',
        unidadeNome: erpStudent?.unidadeNome || '—',
        isIntegralErp: Boolean(erpStudent?.isIntegralErp),
        estaNoIsaac: parcelasDTO.length > 0,
        possuiParcelasAtivasIsaac,
        possuiApenasCanceladasIsaac,
        responsavelNome,
        responsavelCpf,
        responsavelTelefone,
        responsavelEmail,
        responsavelIdErp: erpStudent?.responsavelIdErp || firstGuardianSample?.responsavelExternalId || null,
        negociacao: negObj
          ? {
              protocolo: negObj.protocolo || '',
              modalidadeIsaac: negObj.modalidadeIsaac || 'no_isaac',
              status: negObj.status || 'autorizado',
              resumoValores: [
                negObj.temMatricula ? `Mat: R$ ${Number(negObj.valorAutorizadoMatricula || 0).toFixed(2)}` : null,
                negObj.temMensalidade ? `Mens: R$ ${Number(negObj.valorAutorizadoMensalidade || 0).toFixed(2)}` : null,
              ]
                .filter(Boolean)
                .join(' • '),
              qtdParcelasMensalidade: negObj.qtdParcelasMensalidade,
              parcelasMatricula: negObj.parcelasMatricula,
              parcelasMaterial: negObj.parcelasMaterial,
            }
          : null,
        contratoDigitalStatus,
        totalParcelasAtivas: activeParcelas.length,
        totalParcelasPagas: paidParcelas.length,
        totalParcelasAbertas: openParcelas.length,
        totalParcelasVencidas: overdueParcelas.length,
        totalParcelasCanceladas: canceledParcelas.length,
        totalParcelasRenegociadas: renegParcelas.length,
        valorTotalContratadoCentavos,
        valorTotalContratadoFormatado: formatIsaacAmount(valorTotalContratadoCentavos),
        valorTotalPagoCentavos,
        valorTotalPagoFormatado: formatIsaacAmount(valorTotalPagoCentavos),
        valorTotalAbertoCentavos,
        valorTotalAbertoFormatado: formatIsaacAmount(valorTotalAbertoCentavos),
        valorTotalVencidoCentavos,
        valorTotalVencidoFormatado: formatIsaacAmount(valorTotalVencidoCentavos),
        isAdimplenteIsaac: overdueParcelas.length === 0,
        produtos: produtosAudit,
        categoriasProdutos,
        temMensalidade: categoriasProdutos.includes('MENSALIDADE'),
        temMatricula: categoriasProdutos.includes('MATRICULA'),
        temMaterial: categoriasProdutos.includes('MATERIAL'),
        temIntegral: categoriasProdutos.includes('INTEGRAL') || hasAnyIntegralDescription,
        temParcelasFaltantes12ComMat,
        temParcelasFaltantes12Estrito,
        temParcelasFaltantes11FevDez,
        temProdutoFaltante: Boolean(
          erpStudent?.isIntegralErp && !categoriasProdutos.includes('INTEGRAL') && !hasAnyIntegralDescription
        ),
        resumoAuditoriaParcelas,
        anuidadeMesesGrid,
        parcelas: parcelasDTO,
      }
    }

    // 7.1 Processar todos os alunos que estão no Isaac no ano selecionado
    for (const bucket of isaacBucketsByKey.values()) {
      const hasActiveInstallments = bucket.installments.some((inst) => inst.status !== 'CANCELED')
      if (
        !hasActiveInstallments &&
        (!bucket.matchedErp || bucket.matchedErp.isInactive || !bucket.matchedErp.matriculadoNoAno)
      ) {
        // Se todas as cobranças no Isaac estão canceladas e o aluno não está ativo no ERP neste ano, ignorar
        continue
      }
      consolidatedStudents.push(buildStudentConciliacaoItem(bucket.matchedErp, bucket))
    }

    // 7.2 Processar os alunos ativos na Gestão Escolar (ERP) que NÃO possuem cobranças no Isaac no ano
    for (const erpStudent of erpStudentsList) {
      if (matchedErpIdsSet.has(erpStudent.erpId)) continue
      if (erpStudent.matriculadoNoAno) {
        consolidatedStudents.push(buildStudentConciliacaoItem(erpStudent, null))
      }
    }

    // Ordenar alfabeticamente por nome
    consolidatedStudents.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    // 8. Calcular Indicadores Executivos (KPIs) e Resumo por Turma
    const alunosNoIsaacAtivos = consolidatedStudents.filter((s) => s.possuiParcelasAtivasIsaac)
    const alunosMatriculadosErpNoAno = consolidatedStudents.filter((s) => s.matriculadoNoAnoErp)
    const alunosConciliados = consolidatedStudents.filter((s) => s.conciliacaoStatus === 'CONCILIADO')
    const alunosApenasErp = consolidatedStudents.filter((s) => s.conciliacaoStatus === 'APENAS_ERP')
    const alunosApenasErpForaIsaac = alunosApenasErp.filter((s) => s.negociacao?.modalidadeIsaac === 'fora_isaac')
    const alunosApenasErpPendentes = alunosApenasErp.filter((s) => s.negociacao?.modalidadeIsaac !== 'fora_isaac')
    const alunosSomenteIsaacSemErp = consolidatedStudents.filter((s) => s.conciliacaoStatus === 'APENAS_ISAAC')
    const alunosInativosErpComIsaac = consolidatedStudents.filter((s) => s.conciliacaoStatus === 'INATIVO_COM_ISAAC')
    const alunosApenasIsaac = consolidatedStudents.filter(
      (s) => s.conciliacaoStatus === 'APENAS_ISAAC' || s.conciliacaoStatus === 'INATIVO_COM_ISAAC'
    )
    const alunosComDivergenciaId = consolidatedStudents.filter((s) => s.alertaDivergenciaId)

    const volumeTotalContratadoCentavos = alunosNoIsaacAtivos.reduce(
      (acc, s) => acc + s.valorTotalContratadoCentavos,
      0
    )
    const volumeTotalPagoCentavos = alunosNoIsaacAtivos.reduce((acc, s) => acc + s.valorTotalPagoCentavos, 0)
    const volumeTotalAbertoCentavos = alunosNoIsaacAtivos.reduce((acc, s) => acc + s.valorTotalAbertoCentavos, 0)
    const volumeTotalVencidoCentavos = alunosNoIsaacAtivos.reduce((acc, s) => acc + s.valorTotalVencidoCentavos, 0)

    const kpis = {
      ano,
      totalAlunosIsaac: alunosNoIsaacAtivos.length,
      totalMatriculadosErp: alunosMatriculadosErpNoAno.length,
      totalConciliados: alunosConciliados.length,
      totalApenasErp: alunosApenasErp.length,
      totalApenasErpForaIsaac: alunosApenasErpForaIsaac.length,
      totalApenasErpPendentes: alunosApenasErpPendentes.length,
      totalApenasIsaac: alunosApenasIsaac.length,
      totalSomenteIsaacSemErp: alunosSomenteIsaacSemErp.length,
      totalInativoErpComIsaac: alunosInativosErpComIsaac.length,
      totalComDivergenciaId: alunosComDivergenciaId.length,
      totalComFaltantes12ComMat: alunosNoIsaacAtivos.filter((s) => s.temParcelasFaltantes12ComMat).length,
      totalComFaltantes12Estrito: alunosNoIsaacAtivos.filter((s) => s.temParcelasFaltantes12Estrito).length,
      totalComFaltantes11FevDez: alunosNoIsaacAtivos.filter((s) => s.temParcelasFaltantes11FevDez).length,
      totalGradeCompleta12ComMat: alunosNoIsaacAtivos.filter((s) => !s.temParcelasFaltantes12ComMat).length,
      totalAdimplentesIsaac: alunosNoIsaacAtivos.filter((s) => s.isAdimplenteIsaac).length,
      totalInadimplentesIsaac: alunosNoIsaacAtivos.filter((s) => !s.isAdimplenteIsaac).length,
      totalParcelasAnoIsaac: isaacItems.length,
      taxaConciliacaoPct:
        alunosMatriculadosErpNoAno.length > 0
          ? Math.round((alunosConciliados.length / alunosMatriculadosErpNoAno.length) * 1000) / 10
          : 100,
      volumeTotalContratadoFormatado: formatIsaacAmount(volumeTotalContratadoCentavos),
      volumeTotalPagoFormatado: formatIsaacAmount(volumeTotalPagoCentavos),
      volumeTotalAbertoFormatado: formatIsaacAmount(volumeTotalAbertoCentavos),
      volumeTotalVencidoFormatado: formatIsaacAmount(volumeTotalVencidoCentavos),
      volumeTotalContratadoCentavos,
      volumeTotalPagoCentavos,
      volumeTotalAbertoCentavos,
      volumeTotalVencidoCentavos,
    }

    // 9. Consolidado por Turma
    const turmasStatsMap = new Map<
      string,
      {
        turmaNome: string
        serieNome: string
        segmentoNome: string
        turnoNome: string
        totalErp: number
        totalNoIsaac: number
        totalConciliados: number
        totalSemIsaac: number
        totalForaIsaac: number
        totalComFaltantes: number
        totalInadimplentes: number
        valorContratadoCentavos: number
        valorPagoCentavos: number
        valorAbertoCentavos: number
        valorVencidoCentavos: number
      }
    >()

    for (const s of consolidatedStudents) {
      const tKey = s.turmaNome || 'Sem Turma Definida'
      let st = turmasStatsMap.get(tKey)
      if (!st) {
        st = {
          turmaNome: tKey,
          serieNome: s.serieNome,
          segmentoNome: s.segmentoNome,
          turnoNome: s.turnoNome,
          totalErp: 0,
          totalNoIsaac: 0,
          totalConciliados: 0,
          totalSemIsaac: 0,
          totalForaIsaac: 0,
          totalComFaltantes: 0,
          totalInadimplentes: 0,
          valorContratadoCentavos: 0,
          valorPagoCentavos: 0,
          valorAbertoCentavos: 0,
          valorVencidoCentavos: 0,
        }
        turmasStatsMap.set(tKey, st)
      }
      if (s.matriculadoNoAnoErp) st.totalErp++
      if (s.possuiParcelasAtivasIsaac) st.totalNoIsaac++
      if (s.conciliacaoStatus === 'CONCILIADO') st.totalConciliados++
      if (s.conciliacaoStatus === 'APENAS_ERP') {
        st.totalSemIsaac++
        if (s.negociacao?.modalidadeIsaac === 'fora_isaac') st.totalForaIsaac++
      }
      if (s.temParcelasFaltantes12ComMat) st.totalComFaltantes++
      if (s.possuiParcelasAtivasIsaac && !s.isAdimplenteIsaac) st.totalInadimplentes++
      st.valorContratadoCentavos += s.valorTotalContratadoCentavos
      st.valorPagoCentavos += s.valorTotalPagoCentavos
      st.valorAbertoCentavos += s.valorTotalAbertoCentavos
      st.valorVencidoCentavos += s.valorTotalVencidoCentavos
    }

    const resumoPorTurma = Array.from(turmasStatsMap.values())
      .map((t) => ({
        ...t,
        taxaConciliacaoPct: t.totalErp > 0 ? Math.round((t.totalConciliados / t.totalErp) * 100) : 100,
        valorContratadoFormatado: formatIsaacAmount(t.valorContratadoCentavos),
        valorPagoFormatado: formatIsaacAmount(t.valorPagoCentavos),
        valorAbertoFormatado: formatIsaacAmount(t.valorAbertoCentavos),
        valorVencidoFormatado: formatIsaacAmount(t.valorVencidoCentavos),
      }))
      .sort((a, b) => a.turmaNome.localeCompare(b.turmaNome, 'pt-BR'))

    return NextResponse.json({
      ano,
      isaacConnected,
      isaacError,
      meta: {
        cacheAgeSeconds: Math.round((Date.now() - isaacFetchedAt) / 1000),
        processingTimeMs: Date.now() - startTime,
        totalRawInstallmentsInIsaac: isaacItems.length,
        fetchedAt: new Date(isaacFetchedAt).toISOString(),
      },
      kpis,
      resumoPorTurma,
      alunos: consolidatedStudents,
    })
  } catch (err: any) {
    console.error('[API /api/isaac/conciliacao] Erro fatal:', err)
    return NextResponse.json(
      { error: err.message || 'Erro interno ao processar conciliação com o Isaac.' },
      { status: 500 }
    )
  }
}
