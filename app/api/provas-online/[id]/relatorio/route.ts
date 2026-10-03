import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  dbGetProvaById,
  dbGetTentativasByProvaId
} from '@/lib/provas-online/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  const { id: provaId } = await params
  const prova = await dbGetProvaById(provaId)
  if (!prova) {
    return NextResponse.json({ error: 'Prova não encontrada' }, { status: 404 })
  }

  const adminClient = getAdminClient()

  // 1. Fetch total expected students in the assigned classes
  let alunosQuery = adminClient.from('alunos').select('id, nome, matricula, turma, serie, status')
  if (prova.alunosEspecificos && prova.alunosEspecificos.length > 0) {
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

  // 4. Análise Item a Item (Questão por Questão)
  const questoes = prova.questoes || []
  const analiseQuestoes = questoes.map((q, idx) => {
    let totalAcertos = 0
    const contagemAlternativas: Record<string, number> = {}

    // Inicializa alternativas
    ;(q.alternativas || []).forEach(a => {
      contagemAlternativas[a.letra] = 0
    })

    submittedTentativas.forEach(t => {
      const resp = t.respostas?.[q.id]
      if (!resp) return

      if (q.tipo === 'multipla_escolha') {
        const altEscolhida = (q.alternativas || []).find(a => a.id === resp.respostaOpcaoId)
        if (altEscolhida) {
          contagemAlternativas[altEscolhida.letra] = (contagemAlternativas[altEscolhida.letra] || 0) + 1
          if (altEscolhida.correta) totalAcertos++
        }
      } else if (q.tipo === 'multipla_selecao' || q.tipo === 'verdadeiro_falso') {
        if (Number(resp.pontuacaoObtida || 0) >= Number(q.pontuacao || 1) * 0.7) {
          totalAcertos++
        }
      } else if (q.tipo === 'dissertativa') {
        if (Number(resp.pontuacaoObtida || 0) >= Number(q.pontuacao || 1) * 0.6) {
          totalAcertos++
        }
      }
    })

    const totalRespostas = submittedTentativas.length
    const taxaAcerto = totalRespostas > 0 ? Math.round((totalAcertos / totalRespostas) * 100) : 0

    // Distratores mais escolhidos
    const alternativasStats = (q.alternativas || []).map(a => {
      const count = contagemAlternativas[a.letra] || 0
      const pct = totalRespostas > 0 ? Math.round((count / totalRespostas) * 100) : 0
      return {
        letra: a.letra,
        texto: a.texto,
        correta: a.correta,
        totalEscolhas: count,
        percentual: pct
      }
    })

    return {
      questaoId: q.id,
      ordem: idx + 1,
      tipo: q.tipo,
      enunciado: q.enunciado,
      habilidadeBNCC: q.habilidadeBNCC,
      dificuldade: q.dificuldade || 'media',
      pontuacao: q.pontuacao,
      anulada: q.anulada ?? false,
      taxaAcerto,
      totalAcertos,
      totalRespostas,
      alternativasStats
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
    const ultima = submittedList[0] || tList[0] || null

    let situacao = 'ausente'
    if (ultima) situacao = ultima.status

    const studentOcorrencias = ocorrenciasDb.filter((o: any) =>
      (ultima && (o.tentativa_id === ultima.id || o.tentativaId === ultima.id)) ||
      o.aluno_id === aluno.id || o.alunoId === aluno.id
    )

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
      ocorrenciasCount: studentOcorrencias.length,
      ocorrencias: studentOcorrencias
    }
  })

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
      totalOcorrencias: ocorrenciasDb.length,
      alunosComOcorrencia: listaAlunos.filter(a => a.ocorrenciasCount > 0).length,
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
