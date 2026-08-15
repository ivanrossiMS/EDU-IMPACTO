/**
 * app/api/isaac/declaracao-irpf/route.ts
 *
 * Endpoint que consolida os dados para geração da Declaração de IRPF / Quitação Anual de Mensalidades.
 *
 * Regras de Negócio:
 *  - Considera estritamente parcelas pagas (PAID) do tipo TUITION ou descrição de Mensalidade.
 *  - CNPJ e Razão Social definidos por segmento:
 *      * Nível 1 ao 9º Ano: 04.395.789/0001-88 - Colégio Impacto Centro de Ensino
 *      * Ensino Médio: 04.397.021/0001-43 - Centro de Ensino Impacto
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { isaacRequest, formatIsaacAmount, getEffectiveAmount, IsaacInstallment } from '@/lib/isaac'
import { valorPorExtenso } from '@/lib/numeroPorExtenso'

export const dynamic = 'force-dynamic'

const PER_PAGE = 200
const MAX_PARALLEL = 10

function formatCPF(cpf?: string | null): string {
  if (!cpf) return 'Não informado'
  const digits = String(cpf).replace(/\D/g, '')
  if (digits.length !== 11) return String(cpf)
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function getDataExtenso(date: Date = new Date()): string {
  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`
}

function getCompetenciaNome(comp?: string | null, due?: string): string {
  const mesesNomes = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]

  if (comp) {
    const parts = comp.split('-')
    if (parts.length >= 2) {
      const monthIdx = parseInt(parts[1], 10) - 1
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${mesesNomes[monthIdx]}/${parts[0]}`
      }
    }
  }

  if (due) {
    const d = new Date(due)
    if (!isNaN(d.getTime())) {
      return `${mesesNomes[d.getMonth()]}/${d.getFullYear()}`
    }
  }

  return 'Mensalidade'
}

function formatDateBr(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const clean = dateStr.split('T')[0]
  const [y, m, d] = clean.split('-')
  if (y && m && d) return `${d}/${m}/${y}`
  return dateStr
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()
  const { searchParams } = new URL(request.url)

  const alunoId = searchParams.get('alunoId')
  const alunoNome = searchParams.get('alunoNome')
  const ano = searchParams.get('ano') || new Date().getFullYear().toString()
  const responsavelIdParam = searchParams.get('responsavelId')

  // ── 1. Descobrir o ID do Responsável ───────────────────────────────────────
  let guardianExternalId = responsavelIdParam
  if (!guardianExternalId) {
    const metaRespId = user?.user_metadata?.responsavel_id
    if (metaRespId) guardianExternalId = String(metaRespId)
  }

  let dbResponsavel: any = null

  if (!guardianExternalId) {
    if (!user?.email) {
      return NextResponse.json({ error: 'Email do usuário não encontrado.' }, { status: 400 })
    }

    const { data: resp } = await supabase
      .from('responsaveis')
      .select('*')
      .eq('email', user.email)
      .maybeSingle()

    if (!resp) {
      return NextResponse.json({ error: 'Responsável não encontrado.', notFound: true }, { status: 404 })
    }
    dbResponsavel = resp
    guardianExternalId = String(resp.id)
  } else {
    const { data: resp } = await supabase
      .from('responsaveis')
      .select('*')
      .eq('id', guardianExternalId)
      .maybeSingle()
    dbResponsavel = resp
  }

  // ── 2. Buscar Dados do Aluno no Supabase ────────────────────────────────────
  let dbAluno: any = null
  if (alunoId) {
    const { data: al } = await supabase
      .from('alunos')
      .select('*')
      .eq('id', alunoId)
      .maybeSingle()
    dbAluno = al
  }

  if (!dbAluno && alunoNome) {
    const { data: al } = await supabase
      .from('alunos')
      .select('*')
      .ilike('nome', `%${alunoNome}%`)
      .maybeSingle()
    dbAluno = al
  }

  // ── 3. Buscar todas as parcelas do responsável no Isaac para o ano ─────────
  const firstPage = await isaacRequest<any>(
    `/consolidated-installments?page=1&per_page=${PER_PAGE}&reference_year=${ano}&include_active_receivables=true`
  )
  const totalItems: number = firstPage?.pagination?.total ?? 0
  const firstItems: IsaacInstallment[] = firstPage?.data?.items ?? []
  const totalPages = Math.ceil(totalItems / PER_PAGE)

  const rawItems: IsaacInstallment[] = firstItems.filter(
    (i) => i.guardian?.external_id === guardianExternalId
  )

  if (totalPages > 1) {
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
    for (let i = 0; i < remainingPages.length; i += MAX_PARALLEL) {
      const batch = remainingPages.slice(i, i + MAX_PARALLEL)
      const results = await Promise.allSettled(
        batch.map((page) =>
          isaacRequest<any>(
            `/consolidated-installments?page=${page}&per_page=${PER_PAGE}&reference_year=${ano}&include_active_receivables=true`
          )
        )
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const items: IsaacInstallment[] = result.value?.data?.items ?? []
          const filtered = items.filter((i) => i.guardian?.external_id === guardianExternalId)
          rawItems.push(...filtered)
        }
      }
    }
  }

  // Deduplicação estrita por ID
  const map = new Map<string, IsaacInstallment>()
  for (const it of rawItems) {
    if (it.id && !map.has(it.id)) map.set(it.id, it)
  }
  const allInstallments = Array.from(map.values())

  // ── 4. Filtrar EXCLUSIVAMENTE Mensalidades Escolares Pagas do Aluno ──────────
  const targetStudentId = alunoId ? String(alunoId).trim() : null
  const targetStudentName = (alunoNome || dbAluno?.nome || '').trim().toLowerCase()

  const isExcludedItem = (description?: string | null) => {
    const d = (description || '').toLowerCase()
    return (
      d.includes('livro') ||
      d.includes('apostila') ||
      d.includes('material') ||
      d.includes('materiais') ||
      d.includes('uniforme') ||
      d.includes('taxa') ||
      d.includes('seguro') ||
      d.includes('evento') ||
      d.includes('passeio') ||
      d.includes('agenda')
    )
  }

  const mensalidadesPagas = allInstallments.filter((item) => {
    // 1. Status deve ser estritamente PAID (pago)
    if (item.status !== 'PAID') return false

    // 2. Não pode ser livro, apostila, uniforme, material ou taxa
    if (isExcludedItem(item.description)) return false

    // 3. Deve ser mensalidade escolar
    const desc = (item.description || '').toLowerCase()
    const isTuition = desc.includes('mensalidade') || item.type === 'TUITION'
    if (!isTuition) return false

    // 4. Deve pertencer ao aluno selecionado
    if (targetStudentId && String(item.student?.external_id).trim() === targetStudentId) {
      return true
    }
    if (targetStudentName && (item.student?.name || '').toLowerCase().includes(targetStudentName)) {
      return true
    }
    if (!targetStudentId && !targetStudentName) {
      return true
    }

    return false
  })

  // Ordenar por data de vencimento / competência cronológica
  mensalidadesPagas.sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )

  // ── 5. Calcular Somatória e Dados Financeiros ──────────────────────────────
  let totalPagoCentavos = 0
  const itensFormatados = mensalidadesPagas.map((item, idx) => {
    const valorPagoItem = item.paid_value || getEffectiveAmount(item)
    totalPagoCentavos += valorPagoItem

    return {
      index: idx + 1,
      id: item.id,
      descricao: item.description,
      competencia: getCompetenciaNome(item.competence_date, item.due_date),
      vencimento: formatDateBr(item.due_date),
      dataPagamento: formatDateBr(item.paid_date || item.due_date),
      valorBase: formatIsaacAmount(item.base_amount),
      valorPago: formatIsaacAmount(valorPagoItem),
      valorNumerico: valorPagoItem / 100,
      tipo: item.type,
      alunoNome: item.student?.name || dbAluno?.nome || 'Aluno',
    }
  })

  const totalPagoReais = totalPagoCentavos / 100
  const totalPagoFormatado = `R$ ${totalPagoReais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
  const totalPagoPorExtenso = valorPorExtenso(totalPagoReais)

  // ── 6. Determinar Série / Turma Legível do Aluno ───────────────────────────
  let nomeTurma = ''
  let nomeSerie = ''
  let segmentoTurma = ''

  if (dbAluno?.turma) {
    const { data: tData } = await supabase
      .from('turmas')
      .select('nome, serie, dados')
      .or(`id.eq.${dbAluno.turma},codigo.eq.${dbAluno.turma}`)
      .maybeSingle()

    if (tData) {
      nomeTurma = tData.nome || ''
      nomeSerie = tData.serie || ''
      segmentoTurma = tData.dados?.segmento || ''
    }
  }

  // Fallback: verificar historicoTurmas no json dados do aluno
  if (!nomeSerie && dbAluno?.dados?.historicoTurmas && Array.isArray(dbAluno.dados.historicoTurmas)) {
    const hist = dbAluno.dados.historicoTurmas
    const matchAno = hist.find((h: any) => String(h.anoLetivo) === String(ano)) || hist[hist.length - 1]
    if (matchAno) {
      nomeSerie = matchAno.serie || ''
      segmentoTurma = segmentoTurma || matchAno.segmento || ''
    }
  }

  // Fallback 2: verificar dados diretos
  if (!nomeSerie) {
    nomeSerie = dbAluno?.dados?.serie || dbAluno?.serie || ''
  }

  // Fallback 3: extrair de descrições das parcelas se contiver
  if (!nomeSerie && mensalidadesPagas[0]?.description) {
    const desc = mensalidadesPagas[0].description
    if (/nível\s*(v|iv|iii|ii|i|\d)/i.test(desc)) {
      const m = desc.match(/nível\s*(v|iv|iii|ii|i|\d)/i)
      if (m) nomeSerie = m[0].toUpperCase()
    } else if (/(\d+[ºª]\s*ano|\d+[ºª]\s*série)/i.test(desc)) {
      const m = desc.match(/(\d+[ºª]\s*ano|\d+[ºª]\s*série)/i)
      if (m) nomeSerie = m[0].toUpperCase()
    }
  }

  // Formatação final da Série / Turma
  let serieFormatada = nomeSerie || nomeTurma || 'Ensino Regular'
  if (nomeSerie && nomeTurma && !nomeTurma.toLowerCase().includes(nomeSerie.toLowerCase())) {
    serieFormatada = `${nomeSerie} - ${nomeTurma}`
  }

  // ── 7. Determinar CNPJ e Razão Social da Escola por Segmento ───────────────
  // Regra:
  // - Nível 1 ao 9º Ano (Educação Infantil e Fundamental): 04.395.789/0001-88 - Colégio Impacto Centro de Ensino
  // - Ensino Médio: 04.397.021/0001-43 - Centro de Ensino Impacto
  const turmaText = `${serieFormatada} ${nomeTurma} ${segmentoTurma}`.toUpperCase()
  const descSample = (mensalidadesPagas[0]?.description || '').toUpperCase()
  const combinedText = `${turmaText} ${descSample}`

  const isEnsinoMedio =
    combinedText.includes('MÉDIO') ||
    combinedText.includes('MEDIO') ||
    combinedText.includes('EM') ||
    combinedText.includes('TERCEIRÃO') ||
    combinedText.includes('1ª SÉRIE') ||
    combinedText.includes('2ª SÉRIE') ||
    combinedText.includes('3ª SÉRIE') ||
    combinedText.includes('1º ANO EM') ||
    combinedText.includes('2º ANO EM') ||
    combinedText.includes('3º ANO EM')

  const escolaInfo = isEnsinoMedio
    ? {
        razaoSocial: 'CENTRO DE ENSINO IMPACTO LTDA',
        nomeFantasia: 'Centro de Ensino Impacto',
        cnpj: '04.397.021/0001-43',
        endereco: 'Rua Alagoas, 1081 - Jardim dos Estados',
        cidadeUf: 'Campo Grande - MS',
        cep: '79020-121',
        telefone: '(67) 3025-5585',
        email: 'impacto@colegioimpacto.net',
        site: 'www.colegioimpacto.net',
        segmento: 'Ensino Médio',
      }
    : {
        razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
        nomeFantasia: 'Colégio Impacto Centro de Ensino',
        cnpj: '04.395.789/0001-88',
        endereco: 'Rua Alagoas, 1081 - Jardim dos Estados',
        cidadeUf: 'Campo Grande - MS',
        cep: '79020-121',
        telefone: '(67) 3025-5585',
        email: 'impacto@colegioimpacto.net',
        site: 'www.colegioimpacto.net',
        segmento: segmentoTurma || 'Educação Infantil e Ensino Fundamental',
      }

  // ── 8. Informações do Responsável e Aluno ──────────────────────────────────
  const guardianSample = mensalidadesPagas[0]?.guardian || allInstallments[0]?.guardian
  const studentSample = mensalidadesPagas[0]?.student || allInstallments[0]?.student

  const responsavelInfo = {
    nome: dbResponsavel?.nome || guardianSample?.name || 'Responsável Financeiro',
    cpf: formatCPF(dbResponsavel?.cpf || guardianSample?.tax_id),
    email: dbResponsavel?.email || user?.email || '',
    telefone: dbResponsavel?.telefone || '',
  }

  const alunoInfo = {
    id: dbAluno?.id || studentSample?.external_id || alunoId,
    nome: dbAluno?.nome || studentSample?.name || alunoNome || 'Aluno',
    cpf: formatCPF(dbAluno?.cpf || dbAluno?.dados?.cpf),
    matricula: dbAluno?.matricula || dbAluno?.dados?.codigo || dbAluno?.id || studentSample?.external_id || '—',
    turma: serieFormatada,
    segmento: escolaInfo.segmento,
  }

  // ── 8. Metadados e Código de Autenticidade ─────────────────────────────────
  const hashSeed = `${guardianExternalId}-${alunoInfo.id}-${ano}-${totalPagoCentavos}`
  const authCode = `IMP-IRPF-${ano}-${Buffer.from(hashSeed).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}`

  const now = new Date()
  const dataEmissaoExtenso = getDataExtenso(now)
  const cidadeDataEmissao = `Campo Grande - MS, ${dataEmissaoExtenso}`

  return NextResponse.json({
    escola: escolaInfo,
    responsavel: responsavelInfo,
    aluno: alunoInfo,
    anoCalendario: ano,
    exercicio: String(Number(ano) + 1),
    mensalidades: itensFormatados,
    quantidadeMensalidades: itensFormatados.length,
    totalPago: totalPagoReais,
    totalPagoFormatado,
    totalPagoPorExtenso,
    codigoAutenticidade: authCode,
    dataEmissao: now.toISOString(),
    dataEmissaoExtenso,
    cidadeDataEmissao,
  })
}
