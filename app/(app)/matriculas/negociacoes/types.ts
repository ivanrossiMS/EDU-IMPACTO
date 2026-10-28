import type {
  NegociacaoMatriculaRecord,
  NegociacaoAlunoItem,
  HistoricoNegociacaoItem,
} from '@/app/api/matriculas/negociacoes/route'

export type {
  NegociacaoMatriculaRecord,
  NegociacaoAlunoItem,
  HistoricoNegociacaoItem,
}

export interface ResponsavelOption {
  id: string
  tipo: string
  nome: string
  telefone: string
  cpf?: string
}

export interface StudentSearchResult {
  id: string
  rawId?: string
  nomeAluno: string
  turma: string
  origem: 'aluno' | 'responsavel'
  responsaveis: ResponsavelOption[]
  irmaos?: { id: string; nome: string; turma: string }[]
}

export interface SeriePricing2027 {
  id: string
  nome: string
  segmento: string
  mensalidadeBase: number
  anuidadeBase: number
  taxaMaterial: number
  taxaMaterialDesc: string
}

export const SERIES_2027: SeriePricing2027[] = [
  {
    id: 'integral',
    nome: 'Período Integral',
    segmento: 'Período Estendido',
    mensalidadeBase: 2195.0,
    anuidadeBase: 26340.0,
    taxaMaterial: 480.0,
    taxaMaterialDesc: 'Taxa de Material (anual)',
  },
  {
    id: 'intermediario',
    nome: 'Período Intermediário',
    segmento: 'Período Estendido',
    mensalidadeBase: 1895.0,
    anuidadeBase: 22740.0,
    taxaMaterial: 480.0,
    taxaMaterialDesc: 'Taxa de Material (anual)',
  },
  {
    id: 'villa-baby-n1',
    nome: 'Nível 1 / Nível 2 (Villa Baby)',
    segmento: 'Villa Baby',
    mensalidadeBase: 1395.0,
    anuidadeBase: 16740.0,
    taxaMaterial: 480.0,
    taxaMaterialDesc: 'Taxa N1 (R$ 480) ou Livros N2 (R$ 600)',
  },
  {
    id: 'ed-infantil',
    nome: 'Nível 3 ao Nível 5 (Ed. Infantil)',
    segmento: 'Educação Infantil',
    mensalidadeBase: 1230.0,
    anuidadeBase: 14760.0,
    taxaMaterial: 1365.0,
    taxaMaterialDesc: 'Livros didáticos + LIV (Nível 3 ao Nível 5)',
  },
  {
    id: 'fund-1',
    nome: '1º ao 5º ano (Fundamental I)',
    segmento: 'Fundamental I',
    mensalidadeBase: 1230.0,
    anuidadeBase: 14760.0,
    taxaMaterial: 1665.0,
    taxaMaterialDesc: 'Livros didáticos + LIV (1º ao 5º ano)',
  },
  {
    id: 'fund-2',
    nome: '6º ao 9º ano (Fundamental II)',
    segmento: 'Fundamental II',
    mensalidadeBase: 1330.0,
    anuidadeBase: 15960.0,
    taxaMaterial: 1985.0,
    taxaMaterialDesc: 'Apostilas pH (6º ao 9º ano)',
  },
  {
    id: 'em-1-2',
    nome: '1ª e 2ª séries (Ensino Médio)',
    segmento: 'Ensino Médio',
    mensalidadeBase: 1545.0,
    anuidadeBase: 18540.0,
    taxaMaterial: 2150.0,
    taxaMaterialDesc: 'Apostilas pH (Ensino Médio)',
  },
  {
    id: 'em-3',
    nome: '3ª série / Terceirão (Ensino Médio)',
    segmento: 'Ensino Médio',
    mensalidadeBase: 1625.0,
    anuidadeBase: 19500.0,
    taxaMaterial: 2150.0,
    taxaMaterialDesc: 'Apostilas pH (Ensino Médio)',
  },
]

export const MATERIAIS_2027 = [
  { id: 'mat-n1', nome: 'Taxa de Material (Nível 1 - Villa Baby)', valor: 480.0 },
  { id: 'mat-n2', nome: 'Livros Didáticos (Nível 2 - Villa Baby)', valor: 600.0 },
  { id: 'mat-n3-n5', nome: 'Livros Didáticos + LIV (Nível 3 ao Nível 5)', valor: 1365.0 },
  { id: 'mat-fund1', nome: 'Livros Didáticos + LIV (1º ao 5º ano - Fund. I)', valor: 1665.0 },
  { id: 'mat-fund2', nome: 'Apostilas pH (6º ao 9º ano - Fund. II)', valor: 1985.0 },
  { id: 'mat-medio', nome: 'Apostilas pH (1ª a 3ª série - Ensino Médio)', valor: 2150.0 },
]

export const MODALIDADE_ISAAC_CONFIG = {
  no_isaac: {
    label: 'No isaac',
    shortLabel: 'NO ISAAC',
    desc: 'Cobrança e faturamento processados na plataforma isaac',
    bg: '#f5f3ff',
    border: '#c4b5fd',
    color: '#6d28d9',
    dotColor: '#7c3aed',
  },
  fora_isaac: {
    label: 'Fora do isaac (Na Escola)',
    shortLabel: 'FORA DO ISAAC',
    desc: 'Pagamento direto na secretaria/escola (Cartão, PIX, Dinheiro ou Boleto Interno)',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    color: '#047857',
    dotColor: '#10b981',
  },
  hibrido: {
    label: 'Híbrido (Escola + isaac)',
    shortLabel: 'HÍBRIDO (ESCOLA + ISAAC)',
    desc: 'Parte paga direto na escola (Fora do isaac) e parte lançada No isaac',
    bg: '#eff6ff',
    border: '#93c5fd',
    color: '#1d4ed8',
    dotColor: '#2563eb',
  },
} as const

export const STATUS_NEGOCIACAO_CONFIG = {
  autorizado: {
    label: 'Autorizado · Aguardando Lançamento',
    shortLabel: 'Aguardando Lançamento',
    bg: '#fffbeb',
    border: '#fde68a',
    color: '#b45309',
    dot: '#f59e0b',
  },
  lancado: {
    label: 'Lançado no isaac / Sistema',
    shortLabel: 'Lançado no Sistema',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    color: '#6d28d9',
    dot: '#7c3aed',
  },
  concluido: {
    label: 'Concluído · Matrícula Efetivada',
    shortLabel: 'Matrícula Concluída',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    color: '#047857',
    dot: '#10b981',
  },
  cancelado: {
    label: 'Cancelado / Expirado',
    shortLabel: 'Cancelado',
    bg: '#fef2f2',
    border: '#fecaca',
    color: '#b91c1c',
    dot: '#ef4444',
  },
} as const

export const FORMAS_PAGAMENTO = [
  'Cartão de Crédito',
  'PIX / À Vista',
  'Cartão de Débito',
  'Boleto / Fatura isaac',
  'Entrada (PIX/Dinheiro) + Cartão',
  'Dinheiro na Secretaria',
  'Transferência / TED',
  'Isento / Bonificado pela Direção',
]

export const CONDICOES_MENSALIDADE = [
  'Desconto válido para pagamento até o vencimento (Pontualidade)',
  'Desconto fixo incondicional autorizado pela Direção',
  'Desconto Convênio Corporativo / Servidor Público',
  'Desconto Familiar / Irmãos',
  'Bolsa Parcial Autorizada pela Direção',
]

export const MEIOS_AUTORIZACAO = [
  'Presencial na Direção',
  'Reunião com os Responsáveis',
  'Autorização via WhatsApp / Telefone',
  'Despacho Interno p/ Secretaria',
]

export function fmtCurrency(val: number | undefined | null): string {
  const n = Number(val) || 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  const clean = String(dateStr).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function fmtDateTime(isoStr: string | undefined | null): string {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

export function formatPhoneNumber(val: any): string {
  if (!val) return ''
  const digits = String(val).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export function formatCpf(val: any): string {
  if (!val) return ''
  const digits = String(val).replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

export function detectSerieIdFromTurma(turmaOrSerie: string): string | null {
  if (!turmaOrSerie) return null
  const t = turmaOrSerie.toLowerCase()
  if (t.includes('integral')) return 'integral'
  if (t.includes('intermed')) return 'intermediario'
  if (
    t.includes('3ª série') ||
    t.includes('3a serie') ||
    t.includes('terceir') ||
    t.includes('3º em') ||
    t.includes('3º médio') ||
    t.includes('vestibular')
  ) {
    return 'em-3'
  }
  if (
    t.includes('1ª série') ||
    t.includes('1a serie') ||
    t.includes('1º em') ||
    t.includes('1º médio') ||
    t.includes('2ª série') ||
    t.includes('2a serie') ||
    t.includes('2º em') ||
    t.includes('2º médio') ||
    t.includes('médio') ||
    t.includes('medio')
  ) {
    return 'em-1-2'
  }
  if (
    t.includes('6º') ||
    t.includes('7º') ||
    t.includes('8º') ||
    t.includes('9º') ||
    t.includes('6o') ||
    t.includes('7o') ||
    t.includes('8o') ||
    t.includes('9o') ||
    t.includes('fund 2') ||
    t.includes('fundamental 2') ||
    t.includes('fundamental ii')
  ) {
    return 'fund-2'
  }
  if (
    t.includes('1º') ||
    t.includes('2º') ||
    t.includes('3º') ||
    t.includes('4º') ||
    t.includes('5º') ||
    t.includes('1o') ||
    t.includes('2o') ||
    t.includes('3o') ||
    t.includes('4o') ||
    t.includes('5o') ||
    t.includes('fund 1') ||
    t.includes('fundamental 1') ||
    t.includes('fundamental i')
  ) {
    return 'fund-1'
  }
  if (
    t.includes('infantil') ||
    t.includes('n3') ||
    t.includes('n4') ||
    t.includes('n5') ||
    t.includes('nível 3') ||
    t.includes('nível 4') ||
    t.includes('nível 5')
  ) {
    return 'ed-infantil'
  }
  if (
    t.includes('n1') ||
    t.includes('n2') ||
    t.includes('maternal') ||
    t.includes('berçario') ||
    t.includes('bercario') ||
    t.includes('baby') ||
    t.includes('berçário') ||
    t.includes('nível 1') ||
    t.includes('nível 2')
  ) {
    return 'villa-baby-n1'
  }
  return null
}

export function buildResumoNegociacaoTexto(neg: NegociacaoMatriculaRecord): string {
  const modCfg = MODALIDADE_ISAAC_CONFIG[neg.modalidadeIsaac] || MODALIDADE_ISAAC_CONFIG.no_isaac
  const statusCfg = STATUS_NEGOCIACAO_CONFIG[neg.status] || STATUS_NEGOCIACAO_CONFIG.autorizado

  const alunosStr =
    Array.isArray(neg.alunos) && neg.alunos.length > 0
      ? neg.alunos.map(a => `${a.nome}${a.serieTurma ? ` (${a.serieTurma})` : ''}`).join(' | ')
      : `${neg.alunoNome}${neg.serieTurma ? ` (${neg.serieTurma})` : ''}`

  const lines: string[] = [
    `🏫 *COLÉGIO IMPACTO • AUTORIZAÇÃO DE NEGOCIAÇÃO (${neg.anoLetivo})*`,
    `📑 *Protocolo:* ${neg.protocolo} | *Status:* ${statusCfg.shortLabel}`,
    `🏛️ *Autorizado por:* ${neg.autorizadoPor} em ${fmtDate(neg.dataAutorizacao)}`,
    `💳 *Ambiente Geral:* ${modCfg.label}`,
    `────────────────────────────────────`,
    `👤 *Aluno(s):* ${alunosStr || 'Não informado'}`,
    `👥 *Responsável:* ${neg.responsavelNome || 'Não informado'} (${neg.responsavelParentesco || 'Responsável'})`,
  ]

  if (neg.responsavelCpf) lines.push(`🪪 *CPF Resp.:* ${neg.responsavelCpf}`)
  if (neg.responsavelTelefone) lines.push(`📱 *Contato:* ${neg.responsavelTelefone}`)

  lines.push(`────────────────────────────────────`)

  if (neg.temMatricula) {
    const canalMat = neg.canalMatricula === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC (Na Escola)'
    const valorParc =
      neg.parcelasMatricula > 1
        ? ` (${neg.parcelasMatricula}x de ${fmtCurrency(neg.valorAutorizadoMatricula / neg.parcelasMatricula)})`
        : ' (À vista)'
    lines.push(
      `🎒 *MATRÍCULA ${neg.anoLetivo}:* [${canalMat}]`,
      `   • Tabela: ${fmtCurrency(neg.valorTabelaMatricula)} → *Autorizado: ${fmtCurrency(neg.valorAutorizadoMatricula)}* (${neg.descontoMatriculaPct.toFixed(1)}% OFF)`,
      `   • Forma: ${neg.formaPagamentoMatricula}${valorParc}${neg.detalheMatricula ? ` | Obs: ${neg.detalheMatricula}` : ''}`
    )
  }

  if (neg.temMensalidade) {
    const canalMen = neg.canalMensalidade === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC (Na Escola)'
    lines.push(
      `📅 *MENSALIDADES ${neg.anoLetivo} (${neg.qtdParcelasMensalidade}x):* [${canalMen}]`,
      `   • Tabela: ${fmtCurrency(neg.valorTabelaMensalidade)} → *Autorizado: ${fmtCurrency(neg.valorAutorizadoMensalidade)}/mês* (${neg.descontoMensalidadePct.toFixed(1)}% OFF)`,
      `   • Vencimento: Dia ${neg.diaVencimentoMensalidade} | Regra: ${neg.condicaoMensalidade}`
    )
  }

  if (neg.temParcelamentoEspecial) {
    const canalParc = neg.canalParcelamento === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC (Na Escola)'
    const restante = Math.max(0, neg.valorAutorizadoParcelamento - (neg.entradaParcelamento || 0))
    const vParc = neg.qtdParcelasEspecial > 0 ? restante / neg.qtdParcelasEspecial : restante
    lines.push(
      `🤝 *PARCELAMENTO / ACORDO ESPECIAL:* [${canalParc}]`,
      `   • Objeto: ${neg.descricaoParcelamento || 'Acordo autorizado pela Direção'}`,
      `   • Original: ${fmtCurrency(neg.valorOriginalParcelamento)} → *Autorizado: ${fmtCurrency(neg.valorAutorizadoParcelamento)}*`,
      `   • Condição: ${neg.entradaParcelamento > 0 ? `Entrada de ${fmtCurrency(neg.entradaParcelamento)} + ` : ''}${neg.qtdParcelasEspecial}x de ${fmtCurrency(vParc)} (${neg.formaPagamentoParcelamento})`
    )
  }

  if (neg.temMaterial) {
    const canalMatDid = neg.canalMaterial === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC (Na Escola)'
    lines.push(
      `📚 *MATERIAL DIDÁTICO / SERVIÇOS:* [${canalMatDid}]`,
      `   • Item: ${neg.descricaoMaterial || 'Material Didático 2027'}`,
      `   • Autorizado: *${fmtCurrency(neg.valorAutorizadoMaterial)}* em ${neg.parcelasMaterial}x (${neg.formaPagamentoMaterial})`
    )
  }

  if (neg.observacoesDirecao) {
    lines.push(`────────────────────────────────────`, `📌 *Orientação da Direção:* ${neg.observacoesDirecao}`)
  }

  if (neg.observacoesOperacionais) {
    lines.push(`⚙️ *Nota Operacional:* ${neg.observacoesOperacionais}`)
  }

  return lines.join('\n')
}
