import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  dbGetProvaById,
  dbGetTentativasByProvaId,
  isInfraction
} from '@/lib/provas-online/db'
import { selectTentativaByPolicy } from '@/lib/provas-online/engine'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const { id: provaId } = await params
  const prova = await dbGetProvaById(provaId)
  if (!prova) {
    return NextResponse.json({ error: 'Prova não encontrada' }, { status: 404 })
  }

  const adminClient = getAdminClient()

  // 1. Fetch total expected students in the assigned classes
  let alunosQuery = adminClient.from('alunos').select('id, nome, matricula, turma, serie, status')
  if (prova.alunosModo === 'especificos' && prova.alunosEspecificos && prova.alunosEspecificos.length > 0) {
    alunosQuery = alunosQuery.in('id', prova.alunosEspecificos)
  } else if (prova.turmas && prova.turmas.length > 0) {
    const { data: turmasDb } = await adminClient.from('turmas').select('id, codigo, nome')
    const turmaTokens = new Set<string>()
    for (const t of prova.turmas) {
      turmaTokens.add(String(t).trim())
      const match = (turmasDb || []).find(row =>
        String(row.nome).toLowerCase() === String(t).toLowerCase() ||
        String(row.id).toLowerCase() === String(t).toLowerCase() ||
        String(row.codigo).toLowerCase() === String(t).toLowerCase()
      )
      if (match) {
        if (match.id) turmaTokens.add(String(match.id).trim())
        if (match.codigo) turmaTokens.add(String(match.codigo).trim())
        if (match.nome) turmaTokens.add(String(match.nome).trim())
      }
    }
    alunosQuery = alunosQuery.in('turma', Array.from(turmaTokens))
  }

  const { data: expectedStudents } = await alunosQuery
  const validStudents = (expectedStudents || []).filter(
    (a: any) => !a.status || ['ativo', 'matriculado', 'cursando'].includes(a.status.toLowerCase())
  )

  const tentativas = await dbGetTentativasByProvaId(provaId)
  const submittedTentativas = tentativas.filter(t => t.status === 'entregue' || t.status === 'expirada')

  // Ensure any student who actually started/submitted an attempt is included in validStudents
  const existingIds = new Set(validStudents.map((s: any) => s.id))
  for (const t of tentativas) {
    if (t.alunoId && !existingIds.has(t.alunoId)) {
      validStudents.push({
        id: t.alunoId,
        nome: t.alunoNome || 'Estudante',
        matricula: t.alunoMatricula || '',
        turma: t.turmaId || prova.turmas?.[0] || 'Sem Turma',
        serie: '',
        status: 'ativo'
      })
      existingIds.add(t.alunoId)
    }
  }

  // Fetch occurrences / infractions for all attempts
  const tentativaIds = tentativas.map(t => t.id)
  let ocorrenciasDb: any[] = []
  if (tentativaIds.length > 0) {
    try {
      const { data: ocData } = await adminClient
        .from('provas_online_ocorrencias')
        .select('*')
        .in('tentativa_id', tentativaIds)
        .order('created_at', { ascending: false })
      if (ocData) ocorrenciasDb = ocData
    } catch {}

    if (ocorrenciasDb.length === 0) {
      try {
        const { data: recData } = await adminClient
          .from('relatorios_records')
          .select('dados')
          .like('id', `provas_online_ocorrencias:%`)
        if (recData) {
          ocorrenciasDb = recData
            .map((r: any) => r.dados)
            .filter((o: any) => o && tentativaIds.includes(o.tentativaId))
        }
      } catch {}
    }
  }

  // 2. Overview Metrics
  const totalInscritos = validStudents.length || tentativas.length
  const totalParticipantes = new Set(tentativas.map(t => t.alunoId)).size
  const taxaParticipacao = totalInscritos > 0 
    ? Math.round((totalParticipantes / totalInscritos) * 100) 
    : 0

  const notas = submittedTentativas.map(t => Number(t.notaFinal || 0))
  const somaNotas = notas.reduce((acc, n) => acc + n, 0)
  const mediaGeral = notas.length > 0 ? Math.round((somaNotas / notas.length) * 100) / 100 : 0
  const notaMaxima = notas.length > 0 ? Math.max(...notas) : 0
  const notaMinima = notas.length > 0 ? Math.min(...notas) : 0

  // Mediana
  const sortedNotas = [...notas].sort((a, b) => a - b)
  const mediana = sortedNotas.length > 0
    ? (sortedNotas.length % 2 === 0 
        ? Math.round(((sortedNotas[sortedNotas.length / 2 - 1] + sortedNotas[sortedNotas.length / 2]) / 2) * 100) / 100
        : sortedNotas[Math.floor(sortedNotas.length / 2)])
    : 0

  // 3. Distribuição de Notas (Histograma)
  // Faixas: 0-2, 2-4, 4-6, 6-8, 8-10
  const distribuicao = [
    { faixa: '0 - 2.0', quantidade: notas.filter(n => n >= 0 && n < 2).length },
    { faixa: '2.0 - 4.0', quantidade: notas.filter(n => n >= 2 && n < 4).length },
    { faixa: '4.0 - 6.0', quantidade: notas.filter(n => n >= 4 && n < 6).length },
    { faixa: '6.0 - 8.0', quantidade: notas.filter(n => n >= 6 && n < 8).length },
    { faixa: '8.0 - 10.0', quantidade: notas.filter(n => n >= 8 && n <= 10).length }
  ]

  // 4. Análise Item a Item (Questão por Questão) + Índice de Discriminação (TRI / Clássico)
  const questoes = prova.questoes || []
  const sortedAttemptsByScore = [...submittedTentativas].sort(
    (a, b) => Number(b.notaFinal || 0) - Number(a.notaFinal || 0)
  )
  const groupSize = sortedAttemptsByScore.length >= 2
    ? Math.max(1, Math.round(sortedAttemptsByScore.length * 0.27))
    : 0
  const upperGroup = groupSize > 0 ? sortedAttemptsByScore.slice(0, groupSize) : []
  const lowerGroup = groupSize > 0 ? sortedAttemptsByScore.slice(-groupSize) : []

  const isQuestionHit = (q: any, idx: number, t: any): boolean => {
    const resp = t.respostas?.[q.id] || (t.respostas as any)?.[String(idx)]
    if (!resp) return false
    if (q.tipo === 'multipla_escolha') {
      const selectedId = (resp as any).alternativaIdSelecionada || resp.respostaOpcaoId
      const altEscolhida = (q.alternativas || []).find((a: any) => a.id === selectedId)
      return Boolean(altEscolhida?.correta)
    }
    const maxPts = Number(q.pontuacao || 1)
    const threshold = q.tipo === 'dissertativa' ? maxPts * 0.6 : maxPts * 0.7
    return Number(resp.pontuacaoObtida || 0) >= threshold
  }

  const analiseQuestoes = questoes.map((q, idx) => {
    let totalAcertos = 0
    let emBrancoCount = 0
    const contagemAlternativas: Record<string, number> = {}

    // Inicializa alternativas
    ;(q.alternativas || []).forEach(a => {
      contagemAlternativas[a.letra] = 0
    })

    submittedTentativas.forEach(t => {
      const resp = t.respostas?.[q.id] || (t.respostas as any)?.[String(idx)]
      if (!resp) {
        emBrancoCount++
        return
      }

      if (q.tipo === 'multipla_escolha') {
        const selectedId = (resp as any).alternativaIdSelecionada || resp.respostaOpcaoId
        if (!selectedId) {
          emBrancoCount++
          return
        }
        const altEscolhida = (q.alternativas || []).find(a => a.id === selectedId)
        if (altEscolhida) {
          contagemAlternativas[altEscolhida.letra] = (contagemAlternativas[altEscolhida.letra] || 0) + 1
          if (altEscolhida.correta) totalAcertos++
        }
      } else if (q.tipo === 'multipla_selecao') {
        const selectedIds: string[] = (resp as any).alternativasIdsSelecionadas || resp.respostaOpcoesIds || []
        if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
          emBrancoCount++
          return
        }
        selectedIds.forEach(sId => {
          const alt = (q.alternativas || []).find(a => a.id === sId)
          if (alt) {
            contagemAlternativas[alt.letra] = (contagemAlternativas[alt.letra] || 0) + 1
          }
        })
        if (Number(resp.pontuacaoObtida || 0) >= Number(q.pontuacao || 1) * 0.7) {
          totalAcertos++
        }
      } else if (q.tipo === 'verdadeiro_falso') {
        const hasVF = (resp.respostaVF && Object.keys(resp.respostaVF).length > 0) ||
          ((resp as any).itensVouF && (Array.isArray((resp as any).itensVouF) ? (resp as any).itensVouF.length > 0 : Object.keys((resp as any).itensVouF).length > 0))
        if (!hasVF) {
          emBrancoCount++
          return
        }
        if (Number(resp.pontuacaoObtida || 0) >= Number(q.pontuacao || 1) * 0.7) {
          totalAcertos++
        }
      } else if (q.tipo === 'dissertativa') {
        const txt = String(resp.respostaDissertativa || (resp as any).textoDissertativo || (resp as any).respostaTexto || '').trim()
        if (!txt) {
          emBrancoCount++
          return
        }
        if (Number(resp.pontuacaoObtida || 0) >= Number(q.pontuacao || 1) * 0.6) {
          totalAcertos++
        }
      }
    })

    const totalRespostas = submittedTentativas.length
    const taxaAcerto = totalRespostas > 0 ? Math.round((totalAcertos / totalRespostas) * 100) : 0
    const taxaEmBranco = totalRespostas > 0 ? Math.round((emBrancoCount / totalRespostas) * 100) : 0

    // Índice de Discriminação D = P_superior - P_inferior (-1.00 a +1.00)
    let indiceDiscriminacao: number | null = null
    let classificacaoDiscriminacao: 'excelente' | 'boa' | 'regular' | 'fraca' | 'critica_invertida' | 'insuficiente' = 'insuficiente'
    if (groupSize > 0) {
      const upperHits = upperGroup.filter(t => isQuestionHit(q, idx, t)).length
      const lowerHits = lowerGroup.filter(t => isQuestionHit(q, idx, t)).length
      const pUpper = upperHits / groupSize
      const pLower = lowerHits / groupSize
      indiceDiscriminacao = Math.round((pUpper - pLower) * 100) / 100

      if (indiceDiscriminacao < 0) classificacaoDiscriminacao = 'critica_invertida'
      else if (indiceDiscriminacao >= 0.4) classificacaoDiscriminacao = 'excelente'
      else if (indiceDiscriminacao >= 0.3) classificacaoDiscriminacao = 'boa'
      else if (indiceDiscriminacao >= 0.2) classificacaoDiscriminacao = 'regular'
      else classificacaoDiscriminacao = 'fraca'
    }

    // Distratores mais escolhidos
    const alternativasStats = (q.alternativas || []).map(a => {
      const count = contagemAlternativas[a.letra] || 0
      const pct = totalRespostas > 0 ? Math.round((count / totalRespostas) * 100) : 0
      return {
        id: a.id,
        letra: a.letra,
        texto: a.texto,
        correta: a.correta,
        totalEscolhas: count,
        percentual: pct
      }
    })

    const distratores = alternativasStats
      .filter(a => !a.correta && a.totalEscolhas > 0)
      .sort((a, b) => b.totalEscolhas - a.totalEscolhas)
      .slice(0, 3)
      .map(a => ({
        alternativa: a.letra,
        escolhas: `${a.percentual}% (${a.totalEscolhas})`,
        letra: a.letra,
        percentual: a.percentual,
        totalEscolhas: a.totalEscolhas
      }))

    return {
      questaoId: q.id,
      ordem: idx + 1,
      tipo: q.tipo,
      enunciado: q.enunciado,
      habilidadeBNCC: q.habilidadeBNCC,
      dificuldade: q.dificuldade || 'media',
      pontuacao: Number(q.pontuacao || 1),
      valorPontos: Number(q.pontuacao || 1),
      anulada: q.anulada ?? false,
      taxaAcerto,
      totalAcertos,
      totalRespostas,
      emBrancoCount,
      taxaEmBranco,
      indiceDiscriminacao,
      classificacaoDiscriminacao,
      alternativasStats,
      distratores
    }
  })

  // 5. Tempo Médio de Realização
  let somaDuracaoMinutos = 0
  let totalComDuracao = 0

  submittedTentativas.forEach(t => {
    if (t.iniciadaEm && t.entregueEm) {
      const diffMin = (new Date(t.entregueEm).getTime() - new Date(t.iniciadaEm).getTime()) / 60000
      if (diffMin > 0 && diffMin < 600) {
        somaDuracaoMinutos += diffMin
        totalComDuracao++
      }
    }
  })

  const tempoMedioMinutos = totalComDuracao > 0 
    ? Math.round((somaDuracaoMinutos / totalComDuracao) * 10) / 10 
    : 0

  // 6. Desempenho por Turma
  const turmasStats: Record<string, { total: number; entregues: number; somaNotas: number }> = {}
  prova.turmas.forEach(t => {
    turmasStats[t] = { total: 0, entregues: 0, somaNotas: 0 }
  })

  validStudents.forEach((a: any) => {
    const tNome = a.turma || 'Sem Turma'
    if (!turmasStats[tNome]) turmasStats[tNome] = { total: 0, entregues: 0, somaNotas: 0 }
    turmasStats[tNome].total++
  })

  submittedTentativas.forEach(t => {
    const tNome = t.turmaId || 'Sem Turma'
    if (!turmasStats[tNome]) turmasStats[tNome] = { total: 0, entregues: 0, somaNotas: 0 }
    turmasStats[tNome].entregues++
    turmasStats[tNome].somaNotas += Number(t.notaFinal || 0)
  })

  const desempenhoPorTurma = Object.entries(turmasStats).map(([turma, data]) => ({
    turma,
    totalAlunos: data.total,
    entregues: data.entregues,
    taxaParticipacao: data.total > 0 ? Math.round((data.entregues / data.total) * 100) : 0,
    mediaNotas: data.entregues > 0 ? Math.round((data.somaNotas / data.entregues) * 100) / 100 : 0
  }))

  // 7. Lista Nominal de Alunos
  const valorTotalProva = Number(prova.valorTotal || 10)
  const listaAlunos = validStudents.map((aluno: any) => {
    const tList = tentativas.filter(t => t.alunoId === aluno.id)
    const submittedList = submittedTentativas.filter(t => t.alunoId === aluno.id)
    const chosenSubmitted = selectTentativaByPolicy(prova, submittedList)
    const ultima = chosenSubmitted || tList[0] || null

    let situacao = 'ausente'
    if (ultima) situacao = ultima.status

    const studentOcorrencias = ocorrenciasDb
      .filter((o: any) =>
        (ultima && (o.tentativa_id === ultima.id || o.tentativaId === ultima.id)) ||
        o.aluno_id === aluno.id || o.alunoId === aluno.id
      )
      .filter((o: any) => {
        const desc = String(o.descricao || '')
        return !desc.includes('iniciada pelo aluno') && !desc.includes('finalizada e entregue')
      })
      .map((o: any) => ({
        ...o,
        createdAt: o.created_at || o.createdAt,
        created_at: o.created_at || o.createdAt,
        duracaoSegundos: o.duracaoSegundos || o.duracao_segundos,
        duracao_segundos: o.duracaoSegundos || o.duracao_segundos
      }))

    const realInfractions = studentOcorrencias.filter((o: any) => isInfraction(o.tipo, o.descricao))
    const ocorrenciasCount = realInfractions.length

    const notaFinalNum = ultima && ultima.notaFinal !== undefined && ultima.notaFinal !== null ? Number(ultima.notaFinal) : null
    const aproveitamento = notaFinalNum !== null && valorTotalProva > 0 ? Math.round((notaFinalNum / valorTotalProva) * 100) : null

    return {
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      alunoMatricula: aluno.matricula,
      matricula: aluno.matricula,
      turma: aluno.turma,
      situacao,
      status: situacao,
      notaFinal: notaFinalNum,
      notaObjetiva: ultima && ultima.pontuacaoObjetiva !== undefined ? Number(ultima.pontuacaoObjetiva) : null,
      pontuacaoObjetiva: ultima ? ultima.pontuacaoObjetiva : null,
      notaDissertativa: ultima && ultima.pontuacaoDissertativa !== undefined ? Number(ultima.pontuacaoDissertativa) : null,
      pontuacaoDissertativa: ultima ? ultima.pontuacaoDissertativa : null,
      porcentagem: aproveitamento,
      aproveitamento,
      entregueEm: ultima ? ultima.entregueEm : null,
      comprovanteCodigo: ultima ? ultima.comprovanteCodigo : null,
      ocorrenciasCount,
      ocorrencias: studentOcorrencias
    }
  })

  const totalInfractionsAll = listaAlunos.reduce((acc: number, a: any) => acc + (a.ocorrenciasCount || 0), 0)
  const alunosWithInfractions = listaAlunos.filter((a: any) => (a.ocorrenciasCount || 0) > 0).length

  return NextResponse.json({
    prova: {
      id: prova.id,
      titulo: prova.titulo,
      disciplina: prova.disciplina,
      turmas: prova.turmas,
      anoLetivo: prova.anoLetivo,
      bimestre: prova.bimestre,
      duracaoMinutos: prova.duracaoMinutos,
      valorTotal: prova.valorTotal,
      dataAbertura: prova.dataAbertura,
      dataEncerramento: prova.dataEncerramento,
      status: prova.status
    },
    resumo: {
      totalInscritos,
      totalParticipantes,
      totalEntregues: submittedTentativas.length,
      taxaParticipacao,
      mediaGeral,
      mediana,
      notaMaxima,
      notaMinima,
      tempoMedioMinutos,
      totalOcorrencias: totalInfractionsAll,
      alunosComOcorrencia: alunosWithInfractions,
      pendenciasCorrecao: submittedTentativas.filter(t => t.statusCorrecao === 'pendente' || t.statusCorrecao === 'parcial').length
    },
    distribuicao,
    desempenhoPorTurma,
    analiseQuestoes,
    listaAlunos,
    desempenhoAlunos: listaAlunos,
    ocorrencias: ocorrenciasDb
  })
}
