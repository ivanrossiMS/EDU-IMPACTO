/**
 * app/api/isaac/declaracao-irpf/route.ts
 *
 * Endpoint que consolida os dados para geração da Declaração de IRPF / Quitação Anual de Mensalidades.
 *
 * Regras de Negócio:
 *  - Considera estritamente parcelas pagas (PAID) do tipo TUITION ou descrição de Mensalidade.
 *  - Considera ESTRITAMENTE as mensalidades do aluno selecionado (NUNCA soma dependentes/irmãos juntos).
 *  - CNPJ e Razão Social definidos por segmento:
 *      * Nível 1 ao 9º Ano: 04.395.789/0001-88 - Colégio Impacto Centro de Ensino
 *      * Ensino Médio: 04.397.021/0001-43 - Centro de Ensino Impacto
 *  - Resolução completa de nomes legíveis de turmas e séries (sem exibir códigos numéricos).
 *  - Suporte à busca e seleção tanto por Aluno quanto por Responsável Financeiro.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { isaacRequest, formatIsaacAmount, getEffectiveAmount, IsaacInstallment } from '@/lib/isaac'
import { getOrFetchYearCache } from '@/lib/isaacCache'
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

function cleanDigits(val?: string | null): string {
  if (!val) return ''
  return String(val).replace(/\D/g, '')
}

function normalizeString(str?: string | null): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
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

/**
 * Verifica com rigor absoluto se uma parcela do Isaac pertence ao aluno alvo.
 * Regras:
 * 1. Se ambos têm ID/matrícula (external_id), a igualdade do ID é soberana e definitiva.
 *    Se o ID for diferente, rejeita IMEDIATAMENTE (nunca cai no fallback de nome).
 * 2. Se o registro do Isaac não tiver external_id, exige nome completo idêntico
 *    ou primeiro nome E último sobrenome perfeitamente coincidentes.
 */
function isInstallmentForStudent(
  item: IsaacInstallment,
  target: {
    id?: string | null
    matricula?: string | null
    nome?: string | null
    allRefs?: string[]
  }
): boolean {
  if (!item.student) return false

  const itemExtId = String(item.student.external_id || '').trim()
  const itemName = normalizeString(item.student.name)
  const targetId = target.id ? String(target.id).trim() : null
  const targetMatricula = target.matricula ? String(target.matricula).trim() : null
  const validRefs = new Set(
    [targetId, targetMatricula, ...(target.allRefs || [])].filter(Boolean).map((r) => String(r).trim())
  )

  // 1. Match por external_id / matrícula / id: É SOBERANO
  if (itemExtId && validRefs.size > 0) {
    return validRefs.has(itemExtId)
  }

  // 2. Fallback de nome: executado SOMENTE se o item do Isaac não tiver external_id
  if (itemName && target.nome) {
    const targetNorm = normalizeString(target.nome)

    // Nomes idênticos
    if (itemName === targetNorm) return true

    // Se o item contém o nome alvo completo ou vice-versa
    if (itemName.includes(targetNorm) || targetNorm.includes(itemName)) return true

    // Comparação estrita: primeiro nome E último sobrenome devem ser idênticos
    const itemWords = itemName.split(/\s+/).filter((w) => w.length > 1)
    const targetWords = targetNorm.split(/\s+/).filter((w) => w.length > 1)

    if (itemWords.length >= 2 && targetWords.length >= 2) {
      const firstMatch = itemWords[0] === targetWords[0]
      const lastMatch = itemWords[itemWords.length - 1] === targetWords[targetWords.length - 1]

      if (firstMatch && lastMatch) {
        const commonWords = itemWords.filter((w) => targetWords.includes(w))
        if (commonWords.length >= Math.min(itemWords.length, targetWords.length) - 1) {
          return true
        }
      }
    }
  }

  return false
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
  const responsavelCpfParam = searchParams.get('responsavelCpf')

  // ── 1. Buscar Dados do Aluno no Supabase ────────────────────────────────────
  let dbAluno: any = null
  if (alunoId) {
    const { data: al } = await supabase
      .from('alunos')
      .select('*')
      .or(`id.eq.${alunoId},matricula.eq.${alunoId}`)
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

  // ── 2. Localizar Responsáveis Disponíveis e Titular ────────────────────────
  let dbResponsavel: any = null
  let responsaveisDisponiveis: any[] = []
  let alunosDisponiveis: any[] = []

  // Se o responsavelId ou CPF foi explicitamente passado
  if (responsavelIdParam) {
    const { data: resp } = await supabase
      .from('responsaveis')
      .select('*')
      .eq('id', responsavelIdParam)
      .maybeSingle()
    if (resp) dbResponsavel = resp
  } else if (responsavelCpfParam) {
    const cleanCpf = cleanDigits(responsavelCpfParam)
    const { data: resp } = await supabase
      .from('responsaveis')
      .select('*')
      .or(`cpf.eq.${cleanCpf},cpf.eq.${responsavelCpfParam}`)
      .maybeSingle()
    if (resp) dbResponsavel = resp
  }

  // Se temos um Aluno identificado, buscar todos os seus responsáveis vinculados
  if (dbAluno) {
    const studentRefs = [
      dbAluno.id,
      dbAluno.matricula,
      dbAluno.dados?.codigo,
      dbAluno.dados?.id,
    ]
      .filter(Boolean)
      .map((r: any) => String(r).trim())

    const { data: links } = await supabase
      .from('aluno_responsavel')
      .select('*')
      .in('aluno_id', studentRefs)

    if (links && links.length > 0) {
      const respIds = Array.from(
        new Set(links.map((l: any) => String(l.responsavel_id).trim()).filter(Boolean))
      )
      if (respIds.length > 0) {
        const { data: respList } = await supabase
          .from('responsaveis')
          .select('*')
          .in('id', respIds)

        responsaveisDisponiveis = (respList || []).map((r: any) => {
          const l = links.find((link: any) => String(link.responsavel_id).trim() === String(r.id).trim()) || {}
          return {
            id: String(r.id),
            nome: r.nome || 'Responsável',
            cpf: formatCPF(r.cpf || r.dados?.cpf),
            email: r.email || '',
            telefone: r.telefone || '',
            parentesco: l.parentesco || r.parentesco || 'Responsável',
            isFinanceiro: Boolean(l.resp_financeiro || l.is_financeiro || r.isFinanceiro),
          }
        })
      }
    }

    // Fallback: verificar responsáveis armazenados no JSON de dados do aluno
    if (responsaveisDisponiveis.length === 0 && dbAluno.dados?.responsaveis && Array.isArray(dbAluno.dados.responsaveis)) {
      responsaveisDisponiveis = dbAluno.dados.responsaveis.map((r: any, idx: number) => ({
        id: String(r.id || `json-${idx}`),
        nome: r.nome || 'Responsável',
        cpf: formatCPF(r.cpf),
        email: r.email || '',
        telefone: r.telefone || '',
        parentesco: r.parentesco || 'Responsável',
        isFinanceiro: Boolean(r.isFinanceiro || r.resp_financeiro || idx === 0),
      }))
    }

    // Se nenhum responsável selecionado ainda, pegar o financeiro ou o primeiro disponível
    if (!dbResponsavel) {
      const fin = responsaveisDisponiveis.find((r) => r.isFinanceiro) || responsaveisDisponiveis[0]
      if (fin) {
        const { data: resp } = await supabase
          .from('responsaveis')
          .select('*')
          .eq('id', fin.id)
          .maybeSingle()
        dbResponsavel = resp || fin
      }
    }
  }

  // Se buscamos por Responsável, descobrir os alunos vinculados a ele em aluno_responsavel
  if (dbResponsavel) {
    const { data: links } = await supabase
      .from('aluno_responsavel')
      .select('aluno_id, parentesco, resp_financeiro')
      .eq('responsavel_id', dbResponsavel.id)

    if (links && links.length > 0) {
      const studentRefs = links.map((l: any) => String(l.aluno_id).trim()).filter(Boolean)
      const { data: studentList } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, status, foto, dados')
        .or(`id.in.(${studentRefs.join(',')}),matricula.in.(${studentRefs.join(',')})`)

      alunosDisponiveis = (studentList || []).map((s: any) => ({
        id: String(s.id),
        nome: s.nome,
        matricula: s.matricula || s.id,
        turma: s.turma,
        status: s.status,
        foto: s.foto || s.dados?.foto || s.dados?.avatarUrl || null,
      }))

      if (alunosDisponiveis.length > 0 && !dbAluno) {
        dbAluno = studentList?.[0]
      }
    }
  }

  // Se for usuário responsável logado pelo portal da família (fallback para user.email)
  if (!dbResponsavel && !dbAluno) {
    if (user?.email) {
      const { data: resp } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('email', user.email)
        .maybeSingle()
      if (resp) {
        dbResponsavel = resp
      }
    }
  }

  const guardianExternalId = dbResponsavel ? String(dbResponsavel.id).trim() : responsavelIdParam ? String(responsavelIdParam).trim() : null

  // Descobre todos os IDs de responsáveis legais vinculados ao aluno
  const validFamilyGuardianIds = new Set<string>()
  if (guardianExternalId) validFamilyGuardianIds.add(guardianExternalId)
  for (const r of responsaveisDisponiveis) {
    if (r.id) validFamilyGuardianIds.add(String(r.id).trim())
  }

  // ── 3. Buscar todas as parcelas no Isaac para o ano (via cache em memória) ──
  let allInstallments: IsaacInstallment[] = []

  try {
    const yearEntry = await getOrFetchYearCache(ano)
    allInstallments = yearEntry.items
  } catch (err: any) {
    console.error('[Isaac API Error in IRPF]:', err)
  }

  // Tenta resolver o CPF do responsável:
  // 1. Do banco Supabase (coluna cpf ou dados.cpf)
  // 2. Do parâmetro responsavelCpfParam
  // 3. Do próprio contrato do Isaac onde o guardian.external_id bate com o responsável
  let resolvedGuardianCpf =
    dbResponsavel?.cpf ||
    dbResponsavel?.dados?.cpf ||
    (responsavelCpfParam ? cleanDigits(responsavelCpfParam) : null)

  if (!resolvedGuardianCpf && guardianExternalId) {
    const itemWithTax = allInstallments.find(
      (it) => String(it.guardian?.external_id).trim() === guardianExternalId && it.guardian?.tax_id
    )
    if (itemWithTax?.guardian?.tax_id) {
      resolvedGuardianCpf = cleanDigits(itemWithTax.guardian.tax_id)
    }
  }

  const guardianCpfClean = resolvedGuardianCpf ? cleanDigits(resolvedGuardianCpf) : null

  // Filtrar parcelas que pertencem a este responsável ou à família
  const guardianInstallments = allInstallments.filter((item) => {
    const itemGuardianExt = String(item.guardian?.external_id || '').trim()
    const itemGuardianTax = cleanDigits(item.guardian?.tax_id)

    if (guardianExternalId && itemGuardianExt === guardianExternalId) return true
    if (guardianCpfClean && itemGuardianTax === guardianCpfClean) return true
    if (validFamilyGuardianIds.size > 0 && validFamilyGuardianIds.has(itemGuardianExt)) return true
    return false
  })

  // Enriquecer alunosDisponiveis com quaisquer outros alunos encontrados nas parcelas do Isaac para este responsável
  if (guardianInstallments.length > 0) {
    const mapStudents = new Map<string, any>()
    for (const a of alunosDisponiveis) {
      mapStudents.set(normalizeString(a.nome), a)
    }

    for (const it of guardianInstallments) {
      if (it.student?.name) {
        const key = normalizeString(it.student.name)
        if (!mapStudents.has(key)) {
          const newStudent = {
            id: String(it.student.external_id || it.student.id || `isaac-${key}`),
            nome: it.student.name,
            matricula: it.student.external_id || '—',
            turma: '',
            status: 'ativo',
            foto: null,
          }
          mapStudents.set(key, newStudent)
          alunosDisponiveis.push(newStudent)
        }
      }
    }
  }

  // Se ainda não temos um aluno selecionado, pega o primeiro disponível
  if (!dbAluno && alunosDisponiveis.length > 0) {
    dbAluno = alunosDisponiveis[0]
  }

  // ── 4. Filtrar EXCLUSIVAMENTE Mensalidades Escolares Pagas do Aluno Selecionado ──
  const targetStudentRefs: string[] = [
    dbAluno?.id,
    dbAluno?.matricula,
    dbAluno?.dados?.codigo,
    dbAluno?.dados?.id,
    alunoId,
  ]
    .filter(Boolean)
    .map((r: any) => String(r).trim())

  const targetStudentName = dbAluno?.nome || alunoNome || null

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

  const targetMatcher = {
    id: dbAluno?.id ? String(dbAluno.id).trim() : alunoId ? String(alunoId).trim() : null,
    matricula: dbAluno?.matricula ? String(dbAluno.matricula).trim() : null,
    nome: targetStudentName,
    allRefs: targetStudentRefs,
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

    // 4. REGRA DE OURO 1: DEVE PERTENCER ESTRITAMENTE AO ALUNO SELECIONADO!
    // NUNCA incluir parcelas de outros alunos ou irmãos.
    if (!isInstallmentForStudent(item, targetMatcher)) return false

    // 5. REGRA DE OURO 2: VÍNCULO DO RESPONSÁVEL
    // Se temos um responsável selecionado ou co-responsáveis da família,
    // a parcela DEVE pertencer a um responsável válido daquela família.
    if (guardianExternalId || guardianCpfClean || validFamilyGuardianIds.size > 0) {
      const itemGuardianExt = String(item.guardian?.external_id || '').trim()
      const itemGuardianTax = cleanDigits(item.guardian?.tax_id)

      let matchGuardian = false
      if (guardianExternalId && itemGuardianExt === guardianExternalId) matchGuardian = true
      if (guardianCpfClean && itemGuardianTax === guardianCpfClean) matchGuardian = true
      if (!matchGuardian && validFamilyGuardianIds.size > 0 && itemGuardianExt && validFamilyGuardianIds.has(itemGuardianExt)) {
        matchGuardian = true
      }

      if (!matchGuardian) return false
    }

    return true
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

  // ── 6. Determinar Série / Turma Legível do Aluno (Resolução sem Códigos) ────
  let nomeTurma = ''
  let nomeSerie = ''
  let segmentoTurma = ''

  // Buscar todas as turmas para mapeamento infalível
  const { data: allTurmas } = await supabase
    .from('turmas')
    .select('id, codigo, nome, serie, turno, ano, dados')

  const studentTurmaRaw = String(dbAluno?.turma || '').trim()

  if (studentTurmaRaw && allTurmas && allTurmas.length > 0) {
    const matchedTurma = allTurmas.find(
      (t: any) =>
        String(t.id).trim() === studentTurmaRaw ||
        String(t.codigo).trim() === studentTurmaRaw ||
        String(t.nome).trim().toLowerCase() === studentTurmaRaw.toLowerCase()
    )

    if (matchedTurma) {
      nomeTurma = matchedTurma.nome || ''
      nomeSerie = matchedTurma.serie || ''
      segmentoTurma = matchedTurma.dados?.segmento || ''
    }
  }

  // Fallback: verificar historicoTurmas no json dados do aluno
  if (!nomeSerie && dbAluno?.dados?.historicoTurmas && Array.isArray(dbAluno.dados.historicoTurmas)) {
    const hist = dbAluno.dados.historicoTurmas
    const matchAno = hist.find((h: any) => String(h.anoLetivo) === String(ano)) || hist[hist.length - 1]
    if (matchAno) {
      nomeSerie = matchAno.serie || ''
      if (matchAno.turma) nomeTurma = matchAno.turma
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

  // Se a turma ainda for puramente numérica (código), substituir por nome formatado
  let serieFormatada = ''
  if (nomeTurma) {
    serieFormatada = nomeTurma
  } else if (nomeSerie) {
    serieFormatada = nomeSerie
  } else if (studentTurmaRaw && !/^\d+$/.test(studentTurmaRaw)) {
    serieFormatada = studentTurmaRaw
  } else {
    serieFormatada = 'Ensino Regular'
  }

  // ── 7. Determinar CNPJ e Razão Social da Escola por Segmento ───────────────
  // Regra:
  // - Nível 1 ao 9º Ano (Educação Infantil e Fundamental): 04.395.789/0001-88 - Colégio Impacto Centro de Ensino
  // - Ensino Médio: 04.397.021/0001-43 - Centro de Ensino Impacto
  const turmaText = `${serieFormatada} ${nomeTurma} ${nomeSerie} ${segmentoTurma}`.toUpperCase()
  const descSample = (mensalidadesPagas[0]?.description || '').toUpperCase()
  const combinedText = `${turmaText} ${descSample}`

  const isEnsinoMedio =
    combinedText.includes('MÉDIO') ||
    combinedText.includes('MEDIO') ||
    combinedText.includes('EM') ||
    combinedText.includes('TERCEIRÃO') ||
    combinedText.includes('TERCEIRAO') ||
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
  const matchedGuardianForResp = allInstallments.find(
    (it) =>
      (guardianExternalId && String(it.guardian?.external_id).trim() === guardianExternalId) ||
      (guardianCpfClean && cleanDigits(it.guardian?.tax_id) === guardianCpfClean)
  )?.guardian

  const guardianSample = mensalidadesPagas[0]?.guardian || matchedGuardianForResp || guardianInstallments[0]?.guardian
  const studentSample = mensalidadesPagas[0]?.student

  const responsavelInfo = {
    nome: dbResponsavel?.nome || matchedGuardianForResp?.name || guardianSample?.name || 'Responsável Financeiro',
    cpf: formatCPF(resolvedGuardianCpf || dbResponsavel?.cpf || dbResponsavel?.dados?.cpf || matchedGuardianForResp?.tax_id || guardianSample?.tax_id),
    email: dbResponsavel?.email || (matchedGuardianForResp as any)?.email || '',
    telefone: dbResponsavel?.telefone || (matchedGuardianForResp as any)?.phone || '',
  }

  const alunoInfo = {
    id: dbAluno?.id || studentSample?.external_id || alunoId,
    nome: dbAluno?.nome || studentSample?.name || alunoNome || 'Aluno',
    cpf: formatCPF(dbAluno?.cpf || dbAluno?.dados?.cpf),
    matricula: dbAluno?.matricula || dbAluno?.dados?.codigo || dbAluno?.id || studentSample?.external_id || '—',
    turma: serieFormatada,
    segmento: escolaInfo.segmento,
  }

  // ── 9. Metadados e Código de Autenticidade ─────────────────────────────────
  const hashSeed = `${guardianExternalId || dbResponsavel?.id || 'RESP'}-${alunoInfo.id}-${ano}-${totalPagoCentavos}`
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
    responsaveisDisponiveis,
    alunosDisponiveis,
  })
}
