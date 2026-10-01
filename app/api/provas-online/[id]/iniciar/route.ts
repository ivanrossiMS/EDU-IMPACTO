import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  dbGetProvaById,
  dbGetTentativasByProvaId,
  dbSaveTentativa,
  dbRecordOcorrencia
} from '@/lib/provas-online/db'
import {
  checkExamAvailabilityForStudent,
  calculateServerDeadline,
  generateVoucherCode,
  autoGradeTentativa
} from '@/lib/provas-online/engine'
import { TentativaAluno } from '@/types/provas-online'

export const dynamic = 'force-dynamic'

export async function POST(
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

  const { searchParams } = new URL(request.url)
  const body = await request.json().catch(() => ({}))

  const adminClient = getAdminClient()

  // 1. Resolve student record
  const targetAlunoId = body.alunoId || searchParams.get('aluno_id') || searchParams.get('slug') || user.user_metadata?.aluno_id
  let dbAluno: any = null
  if (targetAlunoId || user.email) {
    const conds: string[] = []
    if (targetAlunoId) {
      conds.push(`id.eq.${targetAlunoId}`)
      conds.push(`matricula.eq.${targetAlunoId}`)
    }
    if (user.email && !targetAlunoId) {
      conds.push(`email.ilike.${user.email.trim()}`)
    }
    const { data } = await adminClient
      .from('alunos')
      .select('id, nome, matricula, turma, serie, foto')
      .or(conds.join(','))
      .limit(1)
      .maybeSingle()
    dbAluno = data
  }

  // Check if caller is a parent trying to take test
  const { data: dbUser } = await adminClient
    .from('system_users')
    .select('id, perfil, cargo')
    .or(`id.eq.${user.id},auth_id.eq.${user.id}`)
    .maybeSingle()

  const cargo = dbUser?.cargo || user.user_metadata?.cargo || ''
  const perfil = dbUser?.perfil || user.user_metadata?.perfil || ''

  const isCallerStudent = cargo === 'Aluno' || perfil === 'Aluno' || (user.user_metadata?.userType === 'aluno')
  const isResponsible = cargo === 'Responsável' || perfil === 'Família' || perfil === 'Responsável' || Boolean(user.user_metadata?.responsavel_id)

  if (isResponsible && !isCallerStudent) {
    return NextResponse.json({
      error: 'Acesso negado: Responsáveis têm acesso exclusivamente para acompanhar o progresso e notas. A realização da avaliação deve ser feita exclusivamente na conta do próprio aluno.'
    }, { status: 403 })
  }

  const alunoId = dbAluno?.id || user.user_metadata?.aluno_id || user.id
  const alunoNome = dbAluno?.nome || user.user_metadata?.nome || user.email?.split('@')[0] || 'Aluno'
  const alunoMatricula = dbAluno?.matricula || user.user_metadata?.matricula || ''
  const turmaId = dbAluno?.turma || prova.turmas[0] || ''

  // 2. Fetch existing attempts for this student
  const allTentativas = await dbGetTentativasByProvaId(provaId)
  const myTentativas = allTentativas.filter(t => t.alunoId === alunoId || (alunoMatricula && t.alunoMatricula === alunoMatricula))

  // 3. IDEMPOTENCY CHECK:
  // If student already has an active attempt, return the existing active attempt!
  // Prevents duplicate attempts from multiple clicks, page reloads, or connection retries.
  const existingActive = myTentativas.find(t => t.status === 'em_andamento')
  if (existingActive) {
    const now = Date.now()
    const deadline = new Date(existingActive.prazoLimite).getTime()

    // If deadline has not passed, resume attempt
    if (now <= deadline) {
      // Record resumption occurrence
      void dbRecordOcorrencia({
        id: crypto.randomUUID(),
        tentativaId: existingActive.id,
        alunoId,
        alunoNome,
        tipo: 'retomada',
        descricao: 'Aluno retomou a tentativa ativa em andamento.',
        createdAt: new Date().toISOString()
      }).catch(() => {})

      return NextResponse.json({
        tentativa: existingActive,
        retomada: true,
        message: 'Tentativa em andamento recuperada com sucesso.'
      })
    } else {
      // Deadline expired while away: update status to expirada and auto-grade
      existingActive.status = 'expirada'
      existingActive.entregueEm = new Date(deadline).toISOString()
      const graded = autoGradeTentativa(prova, existingActive)
      existingActive.pontuacaoObjetiva = graded.pontuacaoObjetiva
      existingActive.notaFinal = graded.notaFinal
      existingActive.statusCorrecao = graded.statusCorrecao
      existingActive.comprovanteCodigo = graded.comprovanteCodigo
      existingActive.respostas = graded.respostas
      await dbSaveTentativa(existingActive)
    }
  }

  // 4. Verify release PIN code if in-person proctoring is enabled
  if (prova.codigoLiberacao && String(prova.codigoLiberacao).trim() !== '') {
    const providedCode = String(body.codigoLiberacao || body.codigoAcesso || '').trim().toUpperCase()
    const expectedCode = String(prova.codigoLiberacao).trim().toUpperCase()
    if (!providedCode || providedCode !== expectedCode) {
      return NextResponse.json({
        error: 'Código de liberação presencial incorreto ou não fornecido. Solicite o código ao professor aplicador.'
      }, { status: 401 })
    }
  }

  // 5. Check exam availability (dates, status, attempts count)
  const check = checkExamAvailabilityForStudent(prova, alunoId, myTentativas.length)
  if (!check.canStart) {
    return NextResponse.json({ error: check.reason }, { status: 400 })
  }

  // 6. Build question & choices order for this attempt
  const questoes = prova.questoes || []
  let orderedQuestoes = [...questoes]

  // Embaralhar questões se configurado (mas respeitando dependência de texto base se houver)
  if (prova.configuracaoLayout?.embaralharQuestoes) {
    orderedQuestoes.sort(() => Math.random() - 0.5)
  }

  const ordemQuestoes = orderedQuestoes.map(q => {
    let altOrder: string[] | undefined = undefined
    if (q.alternativas && q.alternativas.length > 0) {
      let alts = [...q.alternativas]
      // Não embaralhar se alguma alternativa for "Todas as anteriores", "A e B", etc.
      const hasDependentAlt = alts.some(a => 
        /todas as anteriores|nenhuma das anteriores|a e b|b e c/i.test(a.texto)
      )
      if (prova.configuracaoLayout?.embaralharAlternativas && !hasDependentAlt) {
        alts.sort(() => Math.random() - 0.5)
      }
      altOrder = alts.map(a => a.id)
    }
    return {
      questaoId: q.id,
      alternativasOrdem: altOrder
    }
  })

  // 7. Calculate server-authoritative timestamps
  const nowIso = new Date().toISOString()
  const prazoLimiteIso = calculateServerDeadline(prova, nowIso, 0)
  const sessionToken = crypto.randomUUID()
  const tentativaId = crypto.randomUUID()
  const comprovanteCodigo = generateVoucherCode(prova.id, alunoId, tentativaId, nowIso)

  const novaTentativa: TentativaAluno = {
    id: tentativaId,
    provaId,
    alunoId,
    alunoNome,
    alunoMatricula,
    alunoFoto: dbAluno?.foto || null,
    turmaId,
    turmaNome: dbAluno?.turma || '',
    numeroTentativa: myTentativas.length + 1,
    sessionToken,
    status: 'em_andamento',
    iniciadaEm: nowIso,
    prazoLimite: prazoLimiteIso,
    tempoAdicionalMinutos: 0,
    ultimaAtividade: nowIso,
    ordemQuestoes,
    ordemQuestoesSorteada: orderedQuestoes.map(q => q.id),
    respostas: {},
    versaoRespostas: 1,
    pontuacaoObjetiva: 0,
    pontuacaoDissertativa: 0,
    notaFinal: 0,
    statusCorrecao: 'pendente',
    comprovanteCodigo,
    createdAt: nowIso,
    updatedAt: nowIso
  }

  const saved = await dbSaveTentativa(novaTentativa)

  // Log start occurrence
  void dbRecordOcorrencia({
    id: crypto.randomUUID(),
    tentativaId,
    alunoId,
    alunoNome,
    tipo: 'reconexao',
    descricao: `Tentativa nº ${novaTentativa.numeroTentativa} iniciada pelo aluno.`,
    createdAt: nowIso
  }).catch(() => {})

  return NextResponse.json({
    tentativa: saved,
    retomada: false,
    message: 'Tentativa iniciada com sucesso. O cronômetro do servidor está ativo.'
  }, { status: 201 })
}
