import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { dbGetProvaById, dbSaveProva, dbGetTentativasByProvaId } from '@/lib/provas-online/db'
import { selectTentativaByPolicy } from '@/lib/provas-online/engine'

export const dynamic = 'force-dynamic'

async function resolveTurmaStudents(adminClient: any, turmaId: string, submittedAttempts: any[]) {
  const tokens = new Set<string>()
  if (turmaId) tokens.add(turmaId.trim())

  try {
    const { data: allTurmas } = await adminClient.from('turmas').select('id, codigo, nome')
    for (const t of allTurmas || []) {
      const vals = [t.id, t.codigo, t.nome].filter(Boolean).map((v: any) => String(v).trim())
      if (vals.some(v => v.toLowerCase() === turmaId.trim().toLowerCase())) {
        vals.forEach(v => tokens.add(v))
      }
    }
  } catch {}

  const tokenArr = Array.from(tokens)
  let classStudents: any[] = []
  if (tokenArr.length > 0) {
    const { data } = await adminClient
      .from('alunos')
      .select('id, nome, matricula, turma')
      .in('turma', tokenArr)
    classStudents = data || []
  }

  // Also ensure any student who submitted an attempt for this turma (or exam) is included
  const existingIds = new Set(classStudents.map((s: any) => s.id))
  for (const att of submittedAttempts) {
    if (att.alunoId && !existingIds.has(att.alunoId)) {
      if (!turmaId || !att.turmaId || tokenArr.some(tk => tk.toLowerCase() === String(att.turmaId).trim().toLowerCase())) {
        classStudents.push({
          id: att.alunoId,
          nome: att.alunoNome || 'Estudante',
          matricula: att.alunoMatricula || '',
          turma: att.turmaId || turmaId
        })
        existingIds.add(att.alunoId)
      }
    }
  }

  return classStudents.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
}

function buildIntegrationRows(
  prova: any,
  classStudents: any[],
  submitted: any[],
  existingLancamentos: any[],
  escalaAlvo: number,
  peso: number,
  tratarAusencias: string = 'em_branco'
) {
  const valorOriginal = Number(prova.valorTotal || 10)

  return classStudents.map((aluno: any) => {
    const studentAttempts = submitted.filter(t => t.alunoId === aluno.id)
    const chosenAttempt = selectTentativaByPolicy(prova, studentAttempts)
    const hasAttempt = Boolean(chosenAttempt)
    const notaExame = chosenAttempt ? Number(chosenAttempt.notaFinal || 0) : 0

    let notaConvertida: number | null = null
    if (hasAttempt) {
      notaConvertida = valorOriginal > 0
        ? Math.round(((notaExame / valorOriginal) * escalaAlvo * peso) * 100) / 100
        : notaExame
    } else if (tratarAusencias === 'zero') {
      notaConvertida = 0
    }

    let notaAtualNoDiario: any = null
    if (existingLancamentos && existingLancamentos.length > 0) {
      for (const lanc of existingLancamentos) {
        const alunoLanc = (lanc.academico_notas_aluno || []).find((a: any) => a.aluno_id === aluno.id)
        if (alunoLanc) {
          notaAtualNoDiario = alunoLanc.media_parcial
          break
        }
      }
    }

    return {
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      alunoMatricula: aluno.matricula,
      turma: aluno.turma,
      tentativasRealizadas: studentAttempts.length,
      notaExameOriginal: hasAttempt ? notaExame : (tratarAusencias === 'zero' ? 0 : null),
      valorMaximoOriginal: valorOriginal,
      notaConvertida,
      notaConvertidaDiario: notaConvertida,
      notaLancada: notaConvertida,
      notaAtualNoDiario,
      temDivergencia: notaAtualNoDiario !== null && notaConvertida !== null && Number(notaAtualNoDiario) !== notaConvertida
    }
  })
}

/**
 * GET: Previews grade integration before committing.
 * Calculates scaled grades, checks existing grades, flags divergences.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const { id: provaId } = await params
  const prova = await dbGetProvaById(provaId)
  if (!prova) {
    return NextResponse.json({ error: 'Prova não encontrada' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const turmaId = searchParams.get('turmaId') || prova.turmas[0] || ''
  const escalaAlvo = Number(searchParams.get('escala') || 10.0)
  const peso = Number(searchParams.get('peso') || 1.0)
  const avaliacaoNome = searchParams.get('avaliacaoNome') || `Prova Online: ${prova.titulo}`
  const tratarAusencias = searchParams.get('tratarAusencias') || 'em_branco'

  const adminClient = getAdminClient()

  // 1. Fetch attempts for this exam
  const tentativas = await dbGetTentativasByProvaId(provaId)
  const submitted = tentativas.filter(t => t.status === 'entregue' || t.status === 'expirada')

  // 2. Fetch students in the class (resolving turma ID/Code/Name tokens + submitted attempts)
  const classStudents = await resolveTurmaStudents(adminClient, turmaId, submitted)

  // 3. Check existing launches in academico_notas_lancamento
  const { data: existingLancamentos } = await adminClient
    .from('academico_notas_lancamento')
    .select(`
      id, turma_id, disciplina, bimestre,
      academico_notas_aluno (
        id, aluno_id, media_parcial,
        academico_notas_valor (
          detalhe_id, valor
        )
      )
    `)
    .eq('turma_id', turmaId)
    .eq('disciplina', prova.disciplina)
    .eq('bimestre', prova.bimestre)

  // 4. Calculate student grade according to politicaTentativas
  const previewRows = buildIntegrationRows(
    prova,
    classStudents,
    submitted,
    existingLancamentos || [],
    escalaAlvo,
    peso,
    tratarAusencias
  )

  return NextResponse.json({
    ok: true,
    prova: {
      id: prova.id,
      titulo: prova.titulo,
      disciplina: prova.disciplina,
      bimestre: prova.bimestre,
      valorTotal: prova.valorTotal,
      politicaTentativas: prova.politicaTentativas,
      integracaoNotas: prova.integracaoNotas
    },
    parametrosIntegracao: {
      turmaId,
      disciplina: prova.disciplina,
      bimestre: prova.bimestre,
      escalaAlvo,
      peso,
      avaliacaoNome
    },
    jaLancado: Boolean(prova.integracaoNotas?.lancado),
    temLancamentoExistenteNoDiario: (existingLancamentos || []).length > 0,
    previewAlunos: previewRows,
    preview: previewRows,
    linhas: previewRows
  })
}

/**
 * POST: Commits the integrated grades to the official Notas tables.
 */
export async function POST(
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

  const body = await request.json()
  const turmaId = body.turmaId || prova.turmas[0] || ''
  const escalaAlvo = Number(body.escalaAlvo || 10)
  const peso = Number(body.peso || 1)
  const avaliacaoNome = body.avaliacaoNome || `Prova Online: ${prova.titulo}`
  const tratarAusencias = body.tratarAusencias || 'em_branco'

  const adminClient = getAdminClient()
  const { data: dbUser } = await adminClient
    .from('system_users')
    .select('id, nome, perfil')
    .or(`id.eq.${user.id},auth_id.eq.${user.id}`)
    .maybeSingle()

  const authorName = dbUser?.nome || user.user_metadata?.nome || 'Professor'

  try {
    let rowsToCommit = body.notasAlunos
    if (!Array.isArray(rowsToCommit) || rowsToCommit.length === 0) {
      const tentativas = await dbGetTentativasByProvaId(provaId)
      const submitted = tentativas.filter(t => t.status === 'entregue' || t.status === 'expirada')
      const classStudents = await resolveTurmaStudents(adminClient, turmaId, submitted)
      rowsToCommit = buildIntegrationRows(
        prova,
        classStudents,
        submitted,
        [],
        escalaAlvo,
        peso,
        tratarAusencias
      )
    }

    const lancamentoId = `lanc-prova-${provaId.slice(0, 8)}-${turmaId}`
    const nowIso = new Date().toISOString()

    // 1. Inserir ou atualizar na tabela oficial academico_notas_lancamento
    const { error: lancErr } = await adminClient
      .from('academico_notas_lancamento')
      .upsert({
        id: lancamentoId,
        turma_id: turmaId,
        disciplina: prova.disciplina,
        bimestre: prova.bimestre,
        esquema_id: 'prova_online',
        criado_por: authorName,
        created_at: nowIso
      })

    if (lancErr) {
      console.warn('[Integrar Notas] Tabela relacional com erro, salvando no fallback lancamentos_nota:', lancErr.message)
    }

    // 2. Inserir notas por aluno
    let countSalvos = 0
    for (const item of (rowsToCommit || [])) {
      const finalScore = item.notaConvertida ?? item.notaLancada ?? item.notaConvertidaDiario
      if (finalScore === null || finalScore === undefined) continue

      const notaAlunoId = `naluno-${lancamentoId}-${item.alunoId}`

      // Salva em academico_notas_aluno
      try {
        await adminClient.from('academico_notas_aluno').upsert({
          id: notaAlunoId,
          lancamento_id: lancamentoId,
          aluno_id: item.alunoId,
          media_parcial: Number(finalScore),
          faltas: 0,
          situacao: Number(finalScore) >= 6.0 ? 'Aprovado' : 'Em recuperação'
        })
      } catch {}

      // Salva valor no detalhe
      try {
        await adminClient.from('academico_notas_valor').upsert({
          id: `nval-${notaAlunoId}-det1`,
          nota_aluno_id: notaAlunoId,
          detalhe_id: 'avaliacao_online',
          valor: String(finalScore)
        })
      } catch {}

      // Salva também na tabela legada/unificada lancamentos_nota para compatibilidade total
      try {
        await adminClient.from('lancamentos_nota').upsert({
          id: `ln-${provaId}-${item.alunoId}`,
          aluno_id: item.alunoId,
          turma_id: turmaId,
          disciplina: prova.disciplina,
          periodo: `${prova.bimestre}º Bimestre`,
          nota: Number(finalScore),
          dados: {
            origem: 'prova_online',
            provaId: prova.id,
            provaTitulo: prova.titulo,
            avaliacaoNome,
            notaExameOriginal: item.notaExameOriginal,
            escalaAlvo: escalaAlvo || 10,
            peso: peso || 1,
            lancadoPor: authorName,
            dataLancamento: nowIso
          },
          created_at: nowIso
        })
      } catch {}

      countSalvos++
    }

    // 3. Marca na prova como integrada
    prova.integracaoNotas = {
      lancado: true,
      lancamentoId,
      turmaId,
      disciplina: prova.disciplina,
      bimestre: prova.bimestre,
      avaliacaoNome: avaliacaoNome || `Prova Online: ${prova.titulo}`,
      peso: Number(peso || 1),
      escala: Number(escalaAlvo || 10),
      dataLancamento: nowIso,
      usuarioNome: authorName
    }
    await dbSaveProva(prova)

    return NextResponse.json({
      ok: true,
      countSalvos,
      notasLancadas: countSalvos,
      lancamentoId,
      message: `${countSalvos} notas integradas com sucesso ao Diário e Boletim da turma ${turmaId}.`
    })
  } catch (err: any) {
    console.error('POST /api/provas-online/[id]/integrar-notas error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao integrar notas' }, { status: 400 })
  }
}
