import type { ConfigCaixa, ConfigPlanoContas, ConfigCentroCusto, ConfigTipoDocumento } from '@/lib/dataContext'
import type { ContaPagarRecord, FornecedorEscolar, RateioCentroCustoItem } from '@/app/(app)/financeiro/pagar/types'
import type { MovimentacaoCaixaRecord, ComposicaoPagamentoItem } from '@/app/api/financeiro/movimentacoes/route'

export type { MovimentacaoCaixaRecord, ComposicaoPagamentoItem, RateioCentroCustoItem }

export type CategoriaMovimentacaoKey = 'compromisso' | 'transf_valores' | 'rec_aluno' | 'mov_receita'

export interface UnifiedMovimentacaoItem {
  id: string
  sourceId: string
  isAutomaticOrigin: boolean
  codigoLcto: number
  caixaId: string
  caixaCodigo: string
  caixaDescricao: string
  dataLcto: string // YYYY-MM-DD
  emissaoDocto: string // YYYY-MM-DD
  tipoOperacao: 'Pagamento' | 'Recebimento'
  tipoTransacao: 'Normal' | 'Transferência' | 'Estorno' | 'Ajuste'
  categoriaOrigem: CategoriaMovimentacaoKey
  fornecedorId: string
  fornecedorNome: string
  fornecedorSubtitulo?: string
  hasAlunoVinculado?: boolean
  alunoNome?: string
  responsavelNome?: string
  descricao: string
  valor: number
  desconto: number
  juros: number
  multa: number
  valorLiquido: number
  saldoAposLancamento?: number
  contaPlanoId: string
  contaPlanoCodigo: string
  contaPlanoLabel: string
  centroCusto: string
  rateio: RateioCentroCustoItem[]
  tipoDocumento: string
  numeroDocumento: string
  tipoRecurso: string
  composicaoPagamento: ComposicaoPagamentoItem[]
  compensadoBanco: 'Sim' | 'Não'
  observacao: string
  operador: string
  parcelaInfo?: string
  unidade?: string
  createdAtMs?: number
  rawSource?: any
  historico: {
    id: string
    data: string
    acao: string
    usuario: string
    detalhes?: string
  }[]
}

export const CATEGORIA_LEGEND_META: Record<
  CategoriaMovimentacaoKey,
  {
    label: string
    shortLabel: string
    bgBadge: string
    textColor: string
    rowTextColor: string
    borderColor: string
    softBg: string
    stripeColor: string
    pillBg: string
    pillColor: string
    pillBorder: string
    description: string
  }
> = {
  compromisso: {
    label: 'Conta a Pagar (Compromisso)',
    shortLabel: 'Compromisso',
    bgBadge: '#991b1b',
    textColor: '#ffffff',
    rowTextColor: '#881337',
    borderColor: '#fecdd3',
    softBg: '#fff1f2',
    stripeColor: '#e11d48',
    pillBg: '#fff1f2',
    pillColor: '#be123c',
    pillBorder: '#fda4af',
    description: 'Baixas e liquidações de Contas a Pagar / Obrigações com Fornecedores',
  },
  rec_aluno: {
    label: 'Recebimento (Contas a Receber)',
    shortLabel: 'Rec. Aluno',
    bgBadge: '#d97706',
    textColor: '#ffffff',
    rowTextColor: '#065f46',
    borderColor: '#a7f3d0',
    softBg: '#ecfdf5',
    stripeColor: '#10b981',
    pillBg: '#ecfdf5',
    pillColor: '#047857',
    pillBorder: '#6ee7b7',
    description: 'Recebimentos de Contas a Receber (Mensalidades, Matrículas, Acordos e Receitas)',
  },
  transf_valores: {
    label: 'Transferência entre Caixas',
    shortLabel: 'Transf. Caixa',
    bgBadge: '#0284c7',
    textColor: '#ffffff',
    rowTextColor: '#0c4a6e',
    borderColor: '#bae6fd',
    softBg: '#f0f9ff',
    stripeColor: '#0284c7',
    pillBg: '#f0f9ff',
    pillColor: '#0369a1',
    pillBorder: '#7dd3fc',
    description: 'Transferências de numerário ou saldo bancário entre Caixas',
  },
  mov_receita: {
    label: 'Lançamento Direto no Caixa',
    shortLabel: 'Lcto. Caixa',
    bgBadge: '#4f46e5',
    textColor: '#ffffff',
    rowTextColor: '#1e293b',
    borderColor: '#c7d2fe',
    softBg: '#f8fafc',
    stripeColor: '#6366f1',
    pillBg: '#eef2ff',
    pillColor: '#4338ca',
    pillBorder: '#a5b4fc',
    description: 'Movimentações avulsas lançadas diretamente no Caixa (Suprimentos, Despesas e Receitas Diretas)',
  },
}

export function getCategoriaShortLabel(
  item: Pick<UnifiedMovimentacaoItem, 'categoriaOrigem' | 'hasAlunoVinculado'>
): string {
  if (item.categoriaOrigem === 'rec_aluno') {
    return item.hasAlunoVinculado ? 'Rec. Aluno' : 'Recebimento'
  }
  return CATEGORIA_LEGEND_META[item.categoriaOrigem]?.shortLabel || 'Lcto'
}

export function normalizeText(str: string | undefined | null): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function formatCurrencyBRL(val: number | undefined | null): string {
  const n = Number(val || 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function getLocalISODate(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toISODate(raw: string | undefined | null): string {
  if (!raw) return ''
  const s = String(raw).trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  }
  return s
}

export function formatDateBR(iso: string | undefined | null): string {
  if (!iso) return '—'
  const clean = toISODate(iso)
  const parts = clean.split('-')
  if (parts.length !== 3) return String(iso)
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/**
 * Detecta se um código parece um ID interno aleatório (ex: "PCMNNY4KLOW16", "EVMNTFR2H...")
 */
function isRandomHashId(val: string | undefined | null): boolean {
  if (!val) return true
  const s = String(val).trim()
  if (!s) return true
  // Códigos contábeis reais têm formato "10.01.01", "50.01.06", "1.1.02", ou números curtos
  if (/^\d+(\.\d+)+$/.test(s)) return false
  if (/^\d{1,5}$/.test(s)) return false
  // Se tiver mais de 7 caracteres alfanuméricos misturados sem espaço, é hash interno
  if (/^[A-Z0-9_-]{7,}$/i.test(s) && /[A-Z]/i.test(s) && /\d/.test(s)) return true
  return false
}

/**
 * Formata parcela de forma limpa (ignora hashes aleatórios como "EVMNTFR2H...")
 */
function formatCleanParcela(rawParcela: any, idxFallback = 1, totalFallback = 1): string {
  const s = String(rawParcela || '').trim()
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) {
    const [a, b] = s.split('/')
    return `${a.padStart(2, '0')}/${b.padStart(2, '0')}`
  }
  if (/^\d{1,2}$/.test(s)) {
    return `${s.padStart(2, '0')}/${String(Math.max(Number(s), totalFallback)).padStart(2, '0')}`
  }
  return `${String(idxFallback).padStart(2, '0')}/${String(totalFallback).padStart(2, '0')}`
}

/**
 * Verifica se o usuário logado possui perfil de Administrador.
 * Somente Administradores podem visualizar a aba "Todos os Caixas".
 */
export function isUsuarioAdministrador(
  currentUser:
    | {
        id?: string
        nome?: string
        email?: string
        cargo?: string
        perfil?: string
        user_metadata?: Record<string, any>
      }
    | null
    | undefined,
  currentUserPerfil?: string
): boolean {
  if (!currentUser && !currentUserPerfil) return false
  const roleCandidates = [
    currentUser?.perfil,
    currentUser?.cargo,
    currentUserPerfil,
    currentUser?.user_metadata?.perfil,
    currentUser?.user_metadata?.cargo,
    currentUser?.user_metadata?.role,
  ]
    .map((v) => normalizeText(v))
    .filter(Boolean)

  for (const r of roleCandidates) {
    if (
      r === 'admin' ||
      r.includes('administrador') ||
      r.includes('diretor') ||
      r.includes('master') ||
      r.includes('mantenedor') ||
      r.includes('financeiro') ||
      r.includes('tesouraria') ||
      r.includes('gestor')
    ) {
      return true
    }
  }
  return false
}

/**
 * Verifica estritamente se o caixa foi designado ao usuário logado (campo `operador` / `operadorId`).
 * Não considera `abertoPor` nem `descricao`, garantindo que "Meus Caixas" mostre apenas
 * os caixas cujo operador designado é o próprio usuário.
 */
export function isCaixaDoUsuario(
  cx: ConfigCaixa | null | undefined,
  currentUser:
    | {
        id?: string
        nome?: string
        email?: string
        cargo?: string
        perfil?: string
        colaborador_id?: string
        system_user_id?: string
      }
    | null
    | undefined
): boolean {
  if (!cx || !currentUser) return false

  // 1. Vínculo direto por ID do operador designado (quando presente)
  const opId = String(cx.operadorId || '').trim()
  if (opId) {
    const userIds = [currentUser.id, currentUser.colaborador_id, currentUser.system_user_id]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
    if (userIds.includes(opId)) return true
  }

  // 2. Vínculo estrito pelo nome do Operador designado no caixa (`cx.operador`)
  const opCleanName = normalizeText(String(cx.operador || '').replace(/^\d+\s*-\s*/, ''))
  if (!opCleanName) return false

  const userNomeNorm = normalizeText(currentUser.nome)
  if (userNomeNorm) {
    if (opCleanName === userNomeNorm) return true

    const opTokens = opCleanName.split(/\s+/).filter(Boolean)
    const userTokens = userNomeNorm.split(/\s+/).filter(Boolean)
    if (opTokens.length > 0 && userTokens.length > 0) {
      const allUserInOp =
        userTokens.every((t) => opTokens.includes(t)) && userTokens.some((t) => t.length >= 3)
      const allOpInUser =
        opTokens.every((t) => userTokens.includes(t)) && opTokens.some((t) => t.length >= 3)
      if (allUserInOp || allOpInUser) return true
    }
  }

  const userEmailPrefix = normalizeText(currentUser.email?.split('@')[0])
  if (!userNomeNorm && userEmailPrefix && userEmailPrefix.length >= 3) {
    if (opCleanName === userEmailPrefix) return true
  }

  return false
}

export function matchReferenciaComCaixa(
  refCaixa: string | undefined | null,
  cx: ConfigCaixa,
  isCaixaPadraoUnicoDoUsuario = false
): boolean {
  const ref = normalizeText(refCaixa)
  if (!ref) {
    return isCaixaPadraoUnicoDoUsuario
  }
  const cxId = normalizeText(cx.id)
  const cxCod = normalizeText(cx.codigo)
  const cxDesc = normalizeText(cx.descricao)
  const cxCombo = normalizeText(`${cx.codigo} - ${cx.descricao}`)
  const cxCombo2 = normalizeText(`caixa ${cx.codigo}`)

  if (ref === cxId || ref === cxCod || ref === cxDesc || ref === cxCombo) return true
  if (
    cxCod &&
    (ref === `cx-${cxCod}` ||
      ref.startsWith(`${cxCod} -`) ||
      ref.startsWith(`${cxCod}-`) ||
      ref.startsWith(`caixa ${cxCod} `) ||
      ref === `caixa ${cxCod}`)
  ) {
    return true
  }
  if (cxDesc && cxDesc.length >= 4 && ref.includes(cxDesc)) return true
  if (cxCombo2 && ref.includes(cxCombo2)) return true

  return false
}

/**
 * Resolve o código contábil e a descrição legível da Conta Plano buscando de `cfgPlanoContas` (/configuracoes/financeiro/plano-contas)
 */
export function resolveContaPlanoDisplay(
  planoContasId: string | undefined,
  categoriaFallback: string | undefined,
  planoContasList: ConfigPlanoContas[],
  tipoOperacao: 'Pagamento' | 'Recebimento'
): { id: string; codigo: string; label: string } {
  const ativos = (Array.isArray(planoContasList) ? planoContasList : []).filter(
    (p) => p && typeof p === 'object' && p.situacao !== 'inativo'
  )

  const getCod = (p: any): string =>
    String(p?.codPlano || p?.codigo || p?.contaPlano || '').trim()

  const isReceitaGroup = (p: any): boolean =>
    p?.grupoConta === 'receitas' ||
    p?.natureza === 'Receita' ||
    p?.tipo === 'Receita'

  const defaultForOperacao = () => {
    const targetGroup = tipoOperacao === 'Recebimento' ? 'receitas' : 'despesas'
    const candidates = ativos.filter((p) =>
      targetGroup === 'receitas' ? isReceitaGroup(p) : !isReceitaGroup(p)
    )
    const analytical = candidates.find((p) => p.tipo === 'analitico' || p.tipo === 'detalhe')
    const chosen = analytical || candidates[0] || ativos[0]
    if (chosen) {
      const cod = getCod(chosen)
      const cleanCod = cod && !isRandomHashId(cod) ? cod : tipoOperacao === 'Recebimento' ? '00.01' : '01.01'
      return {
        id: chosen.id,
        codigo: cleanCod,
        label: `${cleanCod} • ${chosen.descricao}`,
      }
    }
    return tipoOperacao === 'Recebimento'
      ? { id: '00.01', codigo: '00.01', label: '00.01 • Receitas Escolares' }
      : { id: '01.01', codigo: '01.01', label: '01.01 • Despesas Operacionais' }
  }

  const rawId = String(planoContasId || '').trim()

  if (rawId) {
    const found = (Array.isArray(planoContasList) ? planoContasList : []).find((p) => {
      if (!p) return false
      const cod = getCod(p)
      return (
        String(p.id) === rawId ||
        (cod && String(cod) === rawId) ||
        normalizeText(`${cod} - ${p.descricao}`) === normalizeText(rawId) ||
        normalizeText(`${cod} • ${p.descricao}`) === normalizeText(rawId) ||
        normalizeText(p.descricao) === normalizeText(rawId)
      )
    })
    if (found) {
      const rawCod = getCod(found)
      const cleanCod =
        rawCod && !isRandomHashId(rawCod)
          ? rawCod
          : isReceitaGroup(found) || tipoOperacao === 'Recebimento'
            ? '00.01'
            : '01.01'
      return {
        id: found.id,
        codigo: cleanCod,
        label: `${cleanCod} • ${found.descricao}`,
      }
    }

    // Se já vier no formato "01.01 • Descrição" ou "01.01 - Descrição"
    const sep = rawId.includes(' • ') ? ' • ' : rawId.includes(' - ') ? ' - ' : null
    if (sep) {
      const [left, ...rest] = rawId.split(sep)
      const right = rest.join(sep).trim()
      const byRight = ativos.find((p) => normalizeText(p.descricao) === normalizeText(right))
      if (byRight) {
        const c = getCod(byRight) || left.trim()
        return {
          id: byRight.id,
          codigo: c,
          label: `${c} • ${byRight.descricao}`,
        }
      }
      const cleanCod = isRandomHashId(left) ? defaultForOperacao().codigo : left.trim()
      return {
        id: cleanCod,
        codigo: cleanCod,
        label: `${cleanCod} • ${right || 'Conta Operacional'}`,
      }
    }
  }

  if (categoriaFallback) {
    let cleanCat = String(categoriaFallback).trim()
    const sep = cleanCat.includes(' • ') ? ' • ' : cleanCat.includes(' - ') ? ' - ' : null
    if (sep) {
      const [firstPart, ...rest] = cleanCat.split(sep)
      const matchedByIdOrCod = (Array.isArray(planoContasList) ? planoContasList : []).find(
        (p) => p && (String(p.id) === firstPart.trim() || getCod(p) === firstPart.trim())
      )
      if (matchedByIdOrCod) {
        const c = getCod(matchedByIdOrCod) || (tipoOperacao === 'Recebimento' ? '00.01' : '01.01')
        return {
          id: matchedByIdOrCod.id,
          codigo: c,
          label: `${c} • ${matchedByIdOrCod.descricao}`,
        }
      }
      if (isRandomHashId(firstPart)) {
        cleanCat = rest.join(sep).trim()
      }
    }

    const catNorm = normalizeText(cleanCat)
    const targetCandidates = ativos.filter((p) =>
      tipoOperacao === 'Recebimento' ? isReceitaGroup(p) : !isReceitaGroup(p)
    )
    const searchPool = targetCandidates.length > 0 ? targetCandidates : ativos
    const byCat = searchPool.find(
      (p) =>
        normalizeText(p.descricao) === catNorm ||
        normalizeText(p.descricao).includes(catNorm) ||
        (catNorm.length >= 4 && catNorm.includes(normalizeText(p.descricao)))
    )
    if (byCat) {
      const rawCod = getCod(byCat)
      const cleanCod =
        rawCod && !isRandomHashId(rawCod)
          ? rawCod
          : tipoOperacao === 'Recebimento'
            ? '00.01'
            : '01.01'
      return {
        id: byCat.id,
        codigo: cleanCod,
        label: `${cleanCod} • ${byCat.descricao}`,
      }
    }

    const def = defaultForOperacao()
    return {
      id: def.id,
      codigo: def.codigo,
      label: `${def.codigo} • ${cleanCat}`,
    }
  }

  return defaultForOperacao()
}

function deterministicCodeFromId(id: string, index: number, base = 86000): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 500
  }
  return base + hash + (index % 95)
}

/**
 * Extrai a lista de nomes de Centros de Custo estritamente configurados em `/configuracoes/financeiro/centro-custo`.
 */
export function extractCentrosCustoOptions(centrosCusto?: any[]): string[] {
  if (!Array.isArray(centrosCusto) || centrosCusto.length === 0) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const c of centrosCusto) {
    if (!c || c.ativo === false || c.situacao === 'inativo') continue
    const nome = String(c.nome || c.descricao || c.label || '').trim()
    const codigo = String(c.codigo || '').trim()
    const label = nome || codigo
    if (!label) continue
    const norm = normalizeText(label)
    if (!seen.has(norm)) {
      seen.add(norm)
      result.push(label)
    }
  }
  return result
}

/**
 * Valida e resolve o Centro de Custo contra os cadastros reais de `/configuracoes/financeiro/centro-custo`.
 * Se não existir na configuração, retorna '' para nunca exibir centros de custo inexistentes.
 */
export function resolveCentroCustoValido(
  rawVal: string | undefined | null,
  centrosCusto?: any[]
): string {
  if (!rawVal || !Array.isArray(centrosCusto) || centrosCusto.length === 0) return ''
  const rawTrim = String(rawVal).trim()
  if (!rawTrim) return ''
  const rawNorm = normalizeText(rawTrim)

  for (const c of centrosCusto) {
    if (!c || c.ativo === false || c.situacao === 'inativo') continue
    const nome = String(c.nome || c.descricao || c.label || '').trim()
    const codigo = String(c.codigo || '').trim()
    const sigla = String(c.sigla || '').trim()
    const id = String(c.id || '').trim()
    const canonical = nome || codigo
    if (!canonical) continue

    const candidates = [
      id,
      nome,
      codigo,
      sigla,
      codigo && nome ? `${codigo} - ${nome}` : '',
      nome && sigla ? `${nome} (${sigla})` : '',
    ].filter(Boolean)

    if (candidates.some((cand) => cand === rawTrim || normalizeText(cand) === rawNorm)) {
      return canonical
    }
  }

  return ''
}

function parseTimestampSafe(
  primaryIso?: string | null,
  fallbackDate?: string | null,
  fallbackIndexOffset = 0
): number {
  if (primaryIso) {
    const s = String(primaryIso).trim()
    // Datas puras (YYYY-MM-DD) não têm hora específica; ancoramos em 00:00:00Z
    // para que lançamentos do mesmo dia com timestamp real fiquem sempre após elas na fila cronológica.
    const parsed = Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s)
    if (Number.isFinite(parsed) && parsed > 0) return parsed + fallbackIndexOffset
  }
  if (fallbackDate) {
    const clean = toISODate(fallbackDate)
    if (clean) {
      const parsed = Date.parse(`${clean}T00:00:00Z`)
      if (Number.isFinite(parsed) && parsed > 0) return parsed + fallbackIndexOffset
    }
  }
  return fallbackIndexOffset
}

export function unificarMovimentacoesDoCaixa(params: {
  selectedCaixa: ConfigCaixa | null
  allCaixas: ConfigCaixa[]
  movimentacoesManuais: MovimentacaoCaixaRecord[]
  overrides: Record<string, Partial<MovimentacaoCaixaRecord>>
  contasPagarPagas: ContaPagarRecord[]
  titulosPagos: any[]
  planoContas: ConfigPlanoContas[]
  centrosCusto?: any[]
}): UnifiedMovimentacaoItem[] {
  const {
    selectedCaixa,
    allCaixas,
    movimentacoesManuais,
    overrides,
    contasPagarPagas,
    titulosPagos,
    planoContas,
    centrosCusto,
  } = params

  if (!selectedCaixa) return []

  const results: UnifiedMovimentacaoItem[] = []
  const seenSourceIds = new Set<string>()
  const hojeISO = getLocalISODate()

  // Apenas o primeiro caixa da lista assume eventuais baixas legadas sem vínculo de caixa,
  // evitando que o mesmo lançamento apareça duplicado em dois caixas diferentes.
  const primaryOrphanCaixaId = allCaixas[0]?.id || selectedCaixa.id
  const isSelectedPrimaryForOrphans = selectedCaixa.id === primaryOrphanCaixaId

  const algumCaixaCasaReferencia = (refStr: string | undefined | null): ConfigCaixa | undefined => {
    if (!refStr) return undefined
    for (const c of allCaixas) {
      if (matchReferenciaComCaixa(refStr, c, false)) return c
    }
    return undefined
  }

  const totalManuais = movimentacoesManuais.length

  // 1. Movimentações Manuais & Transferências salvas em `fin_movimentacoes_caixa_v1`
  for (let i = 0; i < totalManuais; i++) {
    const m = movimentacoesManuais[i]
    if (!m) continue
    const movId = String(m.id || `MAN-${i + 1}`)
    const ov = (overrides[movId] || (m.id ? overrides[m.id] : undefined) || {}) as any
    if (m.estornado || (m as any).excluido || ov.estornado || ov.excluido) continue

    const matchesSelected =
      m.caixaId === selectedCaixa.id ||
      m.caixaCodigo === selectedCaixa.codigo ||
      matchReferenciaComCaixa(`${m.caixaCodigo} - ${m.caixaDescricao}`, selectedCaixa, false)

    if (!matchesSelected) continue

    if (m.referenciaOrigemId) {
      seenSourceIds.add(m.referenciaOrigemId)
    }

    const contaResolved = resolveContaPlanoDisplay(
      m.contaPlanoId,
      m.contaPlanoLabel,
      planoContas,
      m.tipoOperacao
    )

    const dataLctoResolved = toISODate(m.dataLcto || m.createdAt) || hojeISO
    // Items at index 0 of movimentacoesManuais are the most recently inserted
    const reverseIdx = Math.max(0, totalManuais - i)
    const createdAtMs = parseTimestampSafe(
      m.createdAt || m.updatedAt,
      dataLctoResolved,
      reverseIdx * 10
    )

    const centroCustoValido = resolveCentroCustoValido(ov.centroCusto ?? m.centroCusto, centrosCusto)
    const rawRateio = Array.isArray(ov.rateio) ? ov.rateio : Array.isArray(m.rateio) ? m.rateio : []
    const rateioValido = rawRateio
      .map((r: any) => ({
        ...r,
        centroCusto: resolveCentroCustoValido(r?.centroCusto, centrosCusto),
      }))
      .filter((r: any) => Boolean(r.centroCusto))

    results.push({
      id: movId,
      sourceId: String(m.id || movId),
      isAutomaticOrigin: false,
      codigoLcto: Number(m.codigoLcto) || 88000 + reverseIdx,
      caixaId: selectedCaixa.id,
      caixaCodigo: selectedCaixa.codigo,
      caixaDescricao: selectedCaixa.descricao,
      dataLcto: dataLctoResolved,
      emissaoDocto: toISODate(m.emissaoDocto || m.dataLcto) || dataLctoResolved,
      tipoOperacao: m.tipoOperacao,
      tipoTransacao: m.tipoTransacao || (m.categoriaOrigem === 'transf_valores' ? 'Transferência' : 'Normal'),
      categoriaOrigem: m.categoriaOrigem || 'mov_receita',
      fornecedorId: m.fornecedorId || '1',
      fornecedorNome: m.fornecedorNome || 'Diversos',
      fornecedorSubtitulo:
        m.categoriaOrigem === 'transf_valores' ? 'Transferência entre Caixas' : 'Lançamento Direto no Caixa',
      descricao: m.descricao || 'Movimentação de Caixa',
      valor: Number(m.valor || 0),
      desconto: Number(m.desconto || 0),
      juros: Number(m.juros || 0),
      multa: Number(m.multa || 0),
      valorLiquido: Number(m.valorLiquido ?? m.valor ?? 0),
      contaPlanoId: contaResolved.id,
      contaPlanoCodigo: contaResolved.codigo,
      contaPlanoLabel: contaResolved.label,
      centroCusto: centroCustoValido,
      rateio: rateioValido,
      tipoDocumento: m.tipoDocumento ?? (m.categoriaOrigem === 'transf_valores' ? 'TRF' : ''),
      numeroDocumento: m.numeroDocumento ? String(m.numeroDocumento).trim() : '',
      tipoRecurso: m.tipoRecurso || 'PIX',
      composicaoPagamento: Array.isArray(m.composicaoPagamento) ? m.composicaoPagamento : [],
      compensadoBanco: m.compensadoBanco === 'Não' ? 'Não' : 'Sim',
      observacao: m.observacao || '',
      operador: m.operador || selectedCaixa.operador || 'Sistema',
      createdAtMs,
      rawSource: m,
      historico: Array.isArray(m.historico) ? m.historico : [],
    })
  }

  // 2. Baixas de Contas a Pagar (`Compromisso`)
  for (let i = 0; i < contasPagarPagas.length; i++) {
    const cp = contasPagarPagas[i]
    if (!cp || cp.status !== 'pago' || seenSourceIds.has(cp.id)) continue

    const movId = `CP-${cp.id}`
    const ov = (overrides[movId] || overrides[cp.id] || {}) as any
    if (ov.estornado || ov.excluido) {
      const estMs = ov.estornadoEm ? Date.parse(ov.estornadoEm) : 0
      const upMs = Date.parse((cp as any).updatedAt || '') || 0
      if (!estMs || !upMs || upMs <= estMs + 2000) continue
    }

    const effectiveCaixaRef = ov.caixaId || cp.caixaOrigem || ''
    const matchedCaixa = algumCaixaCasaReferencia(effectiveCaixaRef)
    const matches = matchedCaixa ? matchedCaixa.id === selectedCaixa.id : isSelectedPrimaryForOrphans
    if (!matches) continue

    const contaResolved = resolveContaPlanoDisplay(
      ov.contaPlanoId || cp.planoContasId,
      ov.contaPlanoLabel || cp.categoria,
      planoContas,
      'Pagamento'
    )

    const parcStr = formatCleanParcela(
      cp.parcelaAtual && cp.totalParcelas ? `${cp.parcelaAtual}/${cp.totalParcelas}` : undefined,
      cp.parcelaAtual || 1,
      cp.totalParcelas || 1
    )
    const rawNumDoc = ov.numeroDocumento ?? cp.numeroDocumento ?? cp.notaFiscal ?? ''
    const numDocClean = !isRandomHashId(String(rawNumDoc)) ? String(rawNumDoc).trim() : ''
    const valorPago = Number(cp.valorPago && cp.valorPago > 0 ? cp.valorPago : cp.valor || 0)
    const dataLctoResolved = toISODate(ov.dataLcto || cp.dataPagamento || cp.vencimento) || hojeISO
    const createdAtMs = parseTimestampSafe(
      ov.updatedAt || (cp as any).updatedAt || cp.dataPagamento,
      dataLctoResolved,
      i
    )
    const centroCustoValido = resolveCentroCustoValido(ov.centroCusto ?? cp.centroCusto, centrosCusto)
    const rawRateio = Array.isArray(ov.rateio) ? ov.rateio : Array.isArray(cp.rateio) ? cp.rateio : []
    const rateioValido = rawRateio
      .map((r: any) => ({
        ...r,
        centroCusto: resolveCentroCustoValido(r?.centroCusto, centrosCusto),
      }))
      .filter((r: any) => Boolean(r.centroCusto))

    results.push({
      id: movId,
      sourceId: cp.id,
      isAutomaticOrigin: true,
      codigoLcto: Number(ov.codigoLcto) || deterministicCodeFromId(cp.id, i, 86700),
      caixaId: selectedCaixa.id,
      caixaCodigo: selectedCaixa.codigo,
      caixaDescricao: selectedCaixa.descricao,
      dataLcto: dataLctoResolved,
      emissaoDocto: toISODate(ov.emissaoDocto || (cp as any).dataEmissao || (cp as any).emissao || cp.vencimento),
      tipoOperacao: 'Pagamento',
      tipoTransacao: 'Normal',
      categoriaOrigem: 'compromisso',
      fornecedorId: ov.fornecedorId || cp.fornecedorId || '',
      fornecedorNome: ov.fornecedorNome || cp.fornecedorNome || 'Fornecedor',
      fornecedorSubtitulo: cp.fornecedorDocumento || cp.categoria || 'Contas a Pagar',
      descricao: ov.descricao || cp.descricao || `Pagamento a ${cp.fornecedorNome}`,
      valor: Number(cp.valorBase || valorPago),
      desconto: Number(cp.desconto || 0),
      juros: Number(cp.juros || 0),
      multa: Number(cp.multa || 0),
      valorLiquido: valorPago,
      contaPlanoId: contaResolved.id,
      contaPlanoCodigo: contaResolved.codigo,
      contaPlanoLabel: contaResolved.label,
      centroCusto: centroCustoValido,
      rateio: rateioValido,
      tipoDocumento: ov.tipoDocumento || cp.tipoDocumento || 'Boleto',
      numeroDocumento: numDocClean,
      tipoRecurso: ov.tipoRecurso || cp.formaPagamento || 'Boleto Bancário',
      composicaoPagamento: Array.isArray(ov.composicaoPagamento) ? ov.composicaoPagamento : [],
      compensadoBanco: ov.compensadoBanco || 'Sim',
      observacao: ov.observacao ?? cp.observacoes ?? '',
      operador: selectedCaixa.operador || 'Tesouraria',
      parcelaInfo: parcStr,
      unidade: (cp as any).unidade || (cp as any).unidadeEscolar,
      createdAtMs,
      rawSource: cp,
      historico: [
        ...(Array.isArray(cp.historico) ? cp.historico : []),
        ...(Array.isArray(ov.historico) ? ov.historico : []),
      ],
    })
  }

  // 3. Baixas de Contas a Receber / Mensalidades de Alunos (`Rec. Aluno`)
  for (let i = 0; i < titulosPagos.length; i++) {
    const t = titulosPagos[i]
    if (!t || t.status !== 'pago' || seenSourceIds.has(String(t.id))) continue

    const movId = `REC-${t.id}`
    const ov = (overrides[movId] || overrides[String(t.id)] || {}) as any
    if (ov.estornado || ov.excluido) {
      const estMs = ov.estornadoEm ? Date.parse(ov.estornadoEm) : 0
      const upMs = Date.parse(t.dataBaixa || t.updated_at || '') || 0
      if (!estMs || !upMs || upMs <= estMs + 2000) continue
    }

    const refCaixa = ov.caixaId || t.caixaOrigem || t.caixaId || t.caixa_id || ''
    const matchedCaixa = algumCaixaCasaReferencia(refCaixa)
    const matches = matchedCaixa ? matchedCaixa.id === selectedCaixa.id : isSelectedPrimaryForOrphans
    if (!matches) continue

    const rawAlunoCandidate = String(t.aluno || t.alunoNome || t.nome_aluno || '').trim()
    const hasAluno =
      Boolean(rawAlunoCandidate) &&
      !/^(aluno|aluno matriculado|lancamento avulso|lançamento avulso|sem vinculo de aluno|sem vínculo de aluno|pagador diverso|diversos)$/i.test(
        rawAlunoCandidate
      ) &&
      !/^aluno\s*[•·-]/i.test(rawAlunoCandidate)
    const cleanAluno = hasAluno ? rawAlunoCandidate : ''
    const rawResp = String(t.responsavel || t.responsavelNome || t.pagador || t.pagadorNome || '').trim()
    const cleanTituloDesc = t.descricao && !isRandomHashId(t.descricao) ? String(t.descricao).trim() : ''

    const contaResolved = resolveContaPlanoDisplay(
      ov.contaPlanoId || t.planoContasId || t.plano_contas_id,
      ov.contaPlanoLabel || t.eventoDescricao || t.categoria || (hasAluno ? 'Mensalidades Escolares' : undefined),
      planoContas,
      'Recebimento'
    )

    const rawOvFornecedor = String(ov.fornecedorNome || '').trim()
    const cleanOvFornecedor = rawOvFornecedor
      ? !hasAluno && /^aluno\s*[•·-]\s*/i.test(rawOvFornecedor)
        ? rawOvFornecedor.replace(/^aluno\s*[•·-]\s*/i, '').trim()
        : !hasAluno && /^(aluno|aluno matriculado)$/i.test(rawOvFornecedor)
          ? ''
          : rawOvFornecedor
      : ''

    const displayFavorecido =
      cleanOvFornecedor ||
      (cleanAluno
        ? cleanAluno
        : rawResp
          ? rawResp
          : cleanTituloDesc || t.eventoDescricao || 'Recebimento Avulso')

    const displaySubtitulo = hasAluno
      ? rawResp && rawResp !== displayFavorecido
        ? `Resp.: ${rawResp}`
        : t.turma || 'Contas a Receber'
      : rawResp && rawResp !== displayFavorecido
        ? `Pagador: ${rawResp}`
        : 'Contas a Receber'

    const parcStr = formatCleanParcela(t.parcela, 1, 12)
    const rawCodigo = String(ov.numeroDocumento ?? t.numeroDocumento ?? t.nossoNumero ?? '').trim()
    const docNum = !isRandomHashId(rawCodigo) ? rawCodigo : ''
    const cleanDesc =
      ov.descricao ||
      (cleanTituloDesc
        ? `${cleanTituloDesc} (Parc. ${parcStr})`
        : hasAluno
          ? `Recebimento de Mensalidade Escolar — Parc. ${parcStr}`
          : `Recebimento Contas a Receber — Parc. ${parcStr}`)

    const valorPago = Number(t.valor || 0)
    const dataLctoResolved = toISODate(ov.dataLcto || t.pagamento || t.vencimento) || hojeISO
    const createdAtMs = parseTimestampSafe(
      ov.updatedAt || t.dataBaixa || t.updated_at || t.pagamento,
      dataLctoResolved,
      i
    )
    const centroCustoValido = resolveCentroCustoValido(ov.centroCusto ?? t.centroCusto, centrosCusto)
    const rawRateio = Array.isArray(ov.rateio) ? ov.rateio : []
    const rateioValido = rawRateio
      .map((r: any) => ({
        ...r,
        centroCusto: resolveCentroCustoValido(r?.centroCusto, centrosCusto),
      }))
      .filter((r: any) => Boolean(r.centroCusto))

    results.push({
      id: movId,
      sourceId: String(t.id),
      isAutomaticOrigin: true,
      codigoLcto: Number(ov.codigoLcto) || deterministicCodeFromId(String(t.id), i, 86000),
      caixaId: selectedCaixa.id,
      caixaCodigo: selectedCaixa.codigo,
      caixaDescricao: selectedCaixa.descricao,
      dataLcto: dataLctoResolved,
      emissaoDocto: toISODate(ov.emissaoDocto || t.dataLancamento || t.vencimento),
      tipoOperacao: 'Recebimento',
      tipoTransacao: 'Normal',
      categoriaOrigem: 'rec_aluno',
      fornecedorId: String(t.alunoId || t.aluno_id || ''),
      fornecedorNome: displayFavorecido,
      fornecedorSubtitulo: displaySubtitulo,
      hasAlunoVinculado: hasAluno,
      alunoNome: cleanAluno || undefined,
      responsavelNome: rawResp || undefined,
      descricao: cleanDesc,
      valor: Number(t.valorOriginal || valorPago),
      desconto: Number(t.descontoConcedido || t.desconto || 0),
      juros: Number(t.jurosPago || 0),
      multa: Number(t.multaPaga || 0),
      valorLiquido: valorPago,
      contaPlanoId: contaResolved.id,
      contaPlanoCodigo: contaResolved.codigo,
      contaPlanoLabel: contaResolved.label,
      centroCusto: centroCustoValido,
      rateio: rateioValido,
      tipoDocumento: ov.tipoDocumento || 'Recibo / Boleto',
      numeroDocumento: docNum,
      tipoRecurso: ov.tipoRecurso || t.metodo || 'PIX',
      composicaoPagamento: Array.isArray(ov.composicaoPagamento) ? ov.composicaoPagamento : [],
      compensadoBanco: ov.compensadoBanco || 'Sim',
      observacao: ov.observacao ?? t.obs ?? '',
      operador: t.usuarioBaixa || selectedCaixa.operador || 'Secretaria / Tesouraria',
      parcelaInfo: parcStr,
      unidade: t.unidadeEmpresa || t.unidade,
      createdAtMs,
      rawSource: t,
      historico:
        Array.isArray(ov.historico) && ov.historico.length > 0
          ? ov.historico
          : [
              {
                id: `hist-rec-${t.id}`,
                data: t.pagamento || new Date().toISOString(),
                acao: hasAluno ? 'Recebimento de Título de Aluno' : 'Recebimento de Contas a Receber',
                usuario: selectedCaixa.operador || 'Tesouraria',
                detalhes: `Liquidado via ${t.metodo || 'PIX'} no valor de ${formatCurrencyBRL(valorPago)}.`,
              },
            ],
    })
  }

  // Ordenar cronologicamente por data do lançamento (dataLcto) e depois pelo timestamp de criação/código
  // para calcular `saldoAposLancamento` real do Caixa, garantindo consistência com a Evolução Diária
  // e que novos lançamentos do mesmo dia fiquem sempre no final da fila cronológica (e em 1º lugar ao inverter).
  const chronological = [...results].sort((a, b) => {
    const cmpDate = (a.dataLcto || '').localeCompare(b.dataLcto || '')
    if (cmpDate !== 0) return cmpDate
    const timeA = a.createdAtMs || 0
    const timeB = b.createdAtMs || 0
    if (timeA !== timeB) return timeA - timeB
    return a.codigoLcto - b.codigoLcto
  })

  let runningBalance = Number(selectedCaixa.saldoInicial || 0)
  for (const item of chronological) {
    if (item.tipoOperacao === 'Recebimento') {
      runningBalance = Math.round((runningBalance + item.valorLiquido) * 100) / 100
    } else {
      runningBalance = Math.round((runningBalance - item.valorLiquido) * 100) / 100
    }
    item.saldoAposLancamento = runningBalance
  }

  // Retorna em ordem inversa (novos lançamentos sempre em primeiro e não em último)
  return chronological.reverse()
}

export interface ResumoSaldoCaixa {
  caixaId: string
  codigo: string
  descricao: string
  situacao: string
  saldoInicial: number
  totalEntradas: number
  totalSaidas: number
  saldoAtual: number
  qtdEntradas: number
  qtdSaidas: number
  qtdLancamentos: number
  naoConciliados: number
  isZerado: boolean
  podeTransferir: boolean
  maxTransferencia: number
  podeFechar: boolean
  motivoBloqueioFechamento: string | null
  motivoBloqueioTransferencia: string | null
  ultimosLancamentos: UnifiedMovimentacaoItem[]
}

/**
 * Calcula de forma unificada e precisa o saldo real, entradas, saídas e travas operacionais
 * de TODOS os caixas do sistema.
 */
export function calcularSaldosPorCaixaMap(params: {
  allCaixas: ConfigCaixa[]
  movimentacoesManuais: MovimentacaoCaixaRecord[]
  overrides: Record<string, Partial<MovimentacaoCaixaRecord>>
  contasPagarPagas: ContaPagarRecord[]
  titulosPagos: any[]
  planoContas: ConfigPlanoContas[]
  centrosCusto?: any[]
}): Record<string, ResumoSaldoCaixa> {
  const map: Record<string, ResumoSaldoCaixa> = {}

  for (const cx of params.allCaixas || []) {
    const items = unificarMovimentacoesDoCaixa({
      selectedCaixa: cx,
      allCaixas: params.allCaixas,
      movimentacoesManuais: params.movimentacoesManuais,
      overrides: params.overrides,
      contasPagarPagas: params.contasPagarPagas,
      titulosPagos: params.titulosPagos,
      planoContas: params.planoContas,
      centrosCusto: params.centrosCusto,
    })

    const saldoInicial = Number(cx.saldoInicial || 0)
    let totalEntradas = 0
    let totalSaidas = 0
    let qtdEntradas = 0
    let qtdSaidas = 0
    let naoConciliados = 0

    for (const item of items) {
      if (item.tipoOperacao === 'Recebimento') {
        totalEntradas = Math.round((totalEntradas + item.valorLiquido) * 100) / 100
        qtdEntradas += 1
      } else {
        totalSaidas = Math.round((totalSaidas + item.valorLiquido) * 100) / 100
        qtdSaidas += 1
      }
      if (item.compensadoBanco === 'Não') {
        naoConciliados += 1
      }
    }

    const saldoAtual = Math.round((saldoInicial + totalEntradas - totalSaidas) * 100) / 100
    const isZerado = Math.abs(saldoAtual) < 0.009
    const isAberto = cx.situacao === 'Aberto'
    const podeTransferir = isAberto && saldoAtual >= 0.01
    const maxTransferencia = podeTransferir ? saldoAtual : 0
    const podeFechar = isAberto && isZerado

    let motivoBloqueioFechamento: string | null = null
    if (!isAberto) {
      motivoBloqueioFechamento = 'Este caixa já se encontra fechado.'
    } else if (saldoAtual >= 0.01) {
      motivoBloqueioFechamento = `O caixa possui saldo positivo de ${formatCurrencyBRL(saldoAtual)}. Transfira o saldo para zerar o caixa (R$ 0,00) antes de fechar.`
    } else if (saldoAtual <= -0.01) {
      motivoBloqueioFechamento = `O caixa está com saldo negativo de ${formatCurrencyBRL(saldoAtual)}. Regularize com entrada de suprimento para zerar (R$ 0,00) antes de fechar.`
    }

    let motivoBloqueioTransferencia: string | null = null
    if (!isAberto) {
      motivoBloqueioTransferencia = 'O caixa está Fechado. Reabra o caixa para realizar transferências.'
    } else if (saldoAtual <= 0.009) {
      motivoBloqueioTransferencia = `Saldo disponível insuficiente (${formatCurrencyBRL(saldoAtual)}). Só é permitido transferir quantidades positivas disponíveis em caixa.`
    }

    const resumo: ResumoSaldoCaixa = {
      caixaId: cx.id,
      codigo: cx.codigo,
      descricao: cx.descricao,
      situacao: cx.situacao,
      saldoInicial,
      totalEntradas,
      totalSaidas,
      saldoAtual,
      qtdEntradas,
      qtdSaidas,
      qtdLancamentos: items.length,
      naoConciliados,
      isZerado,
      podeTransferir,
      maxTransferencia,
      podeFechar,
      motivoBloqueioFechamento,
      motivoBloqueioTransferencia,
      ultimosLancamentos: items.slice(0, 15),
    }

    map[cx.id] = resumo
    if (cx.codigo) {
      map[cx.codigo] = resumo
    }
  }

  return map
}

