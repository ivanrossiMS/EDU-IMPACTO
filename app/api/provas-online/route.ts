import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { dbGetProvas, dbSaveProva, dbGetTentativasByProvaId, dbGetTentativasStatsByProvaIds } from '@/lib/provas-online/db'
import { sanitizeExamForParticipant, shouldPublishResults } from '@/lib/provas-online/engine'
import { ProvaOnline } from '@/types/provas-online'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const turmaParam = searchParams.get('turma')
    const disciplinaParam = searchParams.get('disciplina')
    const statusParam = searchParams.get('status')
    const periodoParam = searchParams.get('bimestre')
    const anoParam = searchParams.get('anoLetivo') || searchParams.get('ano')
    const requestedAlunoId = searchParams.get('aluno_id') || searchParams.get('slug')

  const adminClient = getAdminClient()

  // 1. Resolve user profile and roles
  const { data: dbUser } = await adminClient
    .from('system_users')
    .select('id, perfil, cargo, nome, email')
    .or(`id.eq.${user.id},auth_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle()

  // Check if user is a Student (or querying for a specific student)
  let dbAluno: any = null
  const targetAlunoId = requestedAlunoId || user.user_metadata?.aluno_id || (dbUser as any)?.dados?.aluno_id
  if (targetAlunoId || user.email) {
    const conds: string[] = []
    if (targetAlunoId) {
      conds.push(`id.eq.${targetAlunoId}`)
      conds.push(`matricula.eq.${targetAlunoId}`)
    }
    if (user.email && !requestedAlunoId) {
      conds.push(`email.ilike.${user.email.trim()}`)
    }
    const { data } = await adminClient
      .from('alunos')
      .select('id, nome, matricula, turma, serie, email, responsavel, dados')
      .or(conds.join(','))
      .limit(1)
      .maybeSingle()
    dbAluno = data
  }

  // Check if user is a Responsavel / Family
  let dbResp: any = null
  const targetRespId = user.user_metadata?.responsavel_id
  if (targetRespId || user.email) {
    const rConds: string[] = []
    if (targetRespId) rConds.push(`id.eq.${targetRespId}`)
    if (user.email) rConds.push(`email.ilike.${user.email.trim()}`)
    const { data } = await adminClient
      .from('responsaveis')
      .select('id, nome, email')
      .or(rConds.join(','))
      .limit(1)
      .maybeSingle()
    dbResp = data
  }

  const perfil = dbUser?.perfil || user.user_metadata?.perfil || (dbResp ? 'Família' : (dbAluno ? 'Aluno' : 'Professor'))
  const cargo = dbUser?.cargo || user.user_metadata?.cargo || (dbAluno ? 'Aluno' : (dbResp ? 'Responsável' : ''))
  const isStudent = cargo === 'Aluno' || perfil === 'Aluno' || Boolean(dbAluno && !dbUser) || Boolean(requestedAlunoId && dbAluno)
  const isResponsible = (cargo === 'Responsável' || perfil === 'Família' || perfil === 'Responsável') && !requestedAlunoId && !isStudent
  const isTeacher = perfil === 'Professor' || cargo === 'PROFESSORA' || cargo === 'Professor'
  const isAdminOrCoord = ['Diretor Geral', 'Direção', 'Administrador', 'Coordenador', 'Coordenadora'].includes(perfil)

  // 2. Fetch all exams
  let allProvas = await dbGetProvas()

  // Auto-update exam status based on server clock:
  // agendada -> em_aplicacao when now >= dataAbertura
  // em_aplicacao -> encerrada when now > dataEncerramento
  const now = Date.now()
  for (const p of allProvas) {
    let updated = false
    const openTime = new Date(p.dataAbertura).getTime()
    const closeTime = new Date(p.dataEncerramento).getTime()

    if (p.status === 'agendada' && now >= openTime && now <= closeTime) {
      p.status = 'em_aplicacao'
      updated = true
    } else if (p.status === 'em_aplicacao' && now > closeTime) {
      p.status = 'encerrada'
      updated = true
    }

    if (updated) {
      void dbSaveProva(p).catch(() => {})
    }
  }

  // 3. Filter by anoLetivo if requested
  if (anoParam && anoParam !== 'todos') {
    allProvas = allProvas.filter(p => {
      const pAno = String(p.anoLetivo || (p.dataAbertura ? new Date(p.dataAbertura).getFullYear() : ''))
      return pAno === String(anoParam)
    })
  }

  // 4. Filter based on user profile and role
  let filteredProvas = allProvas

  if (isStudent && dbAluno) {
    // Aluno vê provas destinadas à sua turma/série ou a ele especificamente
    const alunoId = dbAluno.id

    // Resolve comprehensive turma representations (ID, Code, Name)
    const studentTurmaIdentifiers: string[] = []
    const studentSeriesList: string[] = []
    if (dbAluno.serie) studentSeriesList.push(String(dbAluno.serie).trim().toLowerCase())

    const studentTurmaRaw = String(dbAluno.turma || '').trim().toLowerCase()
    if (studentTurmaRaw) {
      studentTurmaIdentifiers.push(studentTurmaRaw)
    }

    // Also check student's active turma from dados.historicoTurmas if present
    const historicoList = Array.isArray(dbAluno.dados?.historicoTurmas) ? dbAluno.dados.historicoTurmas : []
    for (const h of historicoList) {
      if (h.serieTurma) studentTurmaIdentifiers.push(String(h.serieTurma).trim().toLowerCase())
      if (h.turma) studentTurmaIdentifiers.push(String(h.turma).trim().toLowerCase())
      if (h.serie) studentSeriesList.push(String(h.serie).trim().toLowerCase())
    }

    // Fetch turmas table to cross-reference ID, Código, Nome and Série safely
    try {
      const { data: allTurmasDb } = await adminClient
        .from('turmas')
        .select('id, codigo, nome, serie')

      for (const t of allTurmasDb || []) {
        const tId = String(t.id || '').trim().toLowerCase()
        const tCodigo = String(t.codigo || '').trim().toLowerCase()
        const tNome = String(t.nome || '').trim().toLowerCase()

        const isMatch = studentTurmaIdentifiers.some(st => st === tId || st === tCodigo || st === tNome)
        if (isMatch) {
          if (tId) studentTurmaIdentifiers.push(tId)
          if (tCodigo) studentTurmaIdentifiers.push(tCodigo)
          if (tNome) studentTurmaIdentifiers.push(tNome)
          if (t.serie) {
            studentSeriesList.push(String(t.serie).trim().toLowerCase())
            if (!dbAluno.serie) dbAluno.serie = t.serie
          }
        }
      }
    } catch (err) {
      console.error('[provas-online] Erro ao buscar turmas no banco:', err)
    }

    filteredProvas = filteredProvas.filter(p => {
      // Provas em rascunho nunca aparecem para alunos
      if (p.status === 'rascunho') return false

      // Se requer aprovação e ainda não foi aprovada, não exibe
      if (p.aprovacaoRequerida && p.statusAprovacao !== 'aprovada') return false

      // 1. Se o aluno está explicitamente listado em alunosEspecificos:
      const isInAlunosEspecificos = Boolean(
        p.alunosEspecificos && p.alunosEspecificos.length > 0 && (
          p.alunosEspecificos.includes(alunoId) ||
          p.alunosEspecificos.includes(dbAluno.id) ||
          (dbAluno.matricula && p.alunosEspecificos.includes(dbAluno.matricula))
        )
      )

      // Se a prova foi definida no MODO ESPECÍFICO (somente alunos selecionados manualmente)
      if (p.alunosModo === 'especificos') {
        return isInAlunosEspecificos
      }

      // Se o aluno está na lista de alunos da prova (modo todos ou pré-computado), libera
      if (isInAlunosEspecificos) {
        return true
      }

      // 2. Se a prova NÃO define turmas nem séries nem alunos específicos, não foi vinculada ao aluno
      const pTurmas = Array.isArray(p.turmas) ? p.turmas : []
      const pSeries = Array.isArray(p.series) ? p.series : []
      if (pTurmas.length === 0 && pSeries.length === 0) {
        return false
      }

      // 3. Verifica correspondência exata de turma (por ID, código ou nome)
      const matchesTurma = pTurmas.length > 0 && pTurmas.some(t => {
        const tNorm = String(t || '').trim().toLowerCase()
        if (!tNorm) return false
        return studentTurmaIdentifiers.some(st => st === tNorm)
      })

      // 4. Verifica correspondência exata de série
      const matchesSerie = pSeries.length > 0 && pSeries.some(s => {
        const sNorm = String(s || '').trim().toLowerCase()
        if (!sNorm) return false
        return studentSeriesList.some(st => st === sNorm)
      })

      return matchesTurma || matchesSerie
    })

    // Fetch attempts for this student to attach attempt status
    const studentProvasWithAttempt = await Promise.all(
      filteredProvas.map(async prova => {
        const tentativas = await dbGetTentativasByProvaId(prova.id)
        const myTentativas = tentativas
          .filter(t => t.alunoId === alunoId || (dbAluno.matricula && t.alunoMatricula === dbAluno.matricula))
          .sort((a, b) => new Date(b.iniciadaEm || b.createdAt || 0).getTime() - new Date(a.iniciadaEm || a.createdAt || 0).getTime())

        const activeTentativa = myTentativas.find(t => t.status === 'em_andamento' || t.status === 'suspensa')
        const submittedTentativas = myTentativas.filter(t => t.status === 'entregue' || t.status === 'expirada')
        const canView = shouldPublishResults(prova, tentativas)

        const sanitized = sanitizeExamForParticipant(prova, canView)
        return {
          ...sanitized,
          studentInfo: {
            tentativasRealizadas: myTentativas.length,
            tentativasPermitidas: prova.quantidadeTentativas || 1,
            tentativaAtivaId: activeTentativa?.id || null,
            statusTentativaAtiva: activeTentativa?.status || null,
            ultimaTentativa: myTentativas[0] || null,
            submetida: submittedTentativas.length > 0,
            resultadoLiberado: canView
          }
        }
      })
    )

    return NextResponse.json(studentProvasWithAttempt)
  }

  if (isResponsible && dbResp) {
    // Responsável vê as provas já entregues/publicadas dos seus filhos
    // Buscar filhos vinculados ao responsável
    const { data: links } = await adminClient
      .from('aluno_responsavel')
      .select('aluno_id')
      .eq('responsavel_id', dbResp.id)

    const alunoIds = (links || []).map((l: any) => l.aluno_id)

    const respProvas = await Promise.all(
      filteredProvas
        .filter(p => p.status === 'publicada' || p.status === 'encerrada')
        .map(async prova => {
          const tentativas = await dbGetTentativasByProvaId(prova.id)
          const filhosTentativas = tentativas.filter(t => alunoIds.includes(t.alunoId))
          if (filhosTentativas.length === 0) return null

          const canView = shouldPublishResults(prova, tentativas)
          const sanitized = sanitizeExamForParticipant(prova, canView)
          return {
            ...sanitized,
            filhosResultados: filhosTentativas.map(t => ({
              alunoId: t.alunoId,
              alunoNome: t.alunoNome,
              notaFinal: t.notaFinal,
              pontuacaoObjetiva: t.pontuacaoObjetiva,
              pontuacaoDissertativa: t.pontuacaoDissertativa,
              entregueEm: t.entregueEm,
              comprovanteCodigo: t.comprovanteCodigo
            }))
          }
        })
    )

    return NextResponse.json(respProvas.filter(Boolean))
  }

  // Teacher / Admin View:
  if (isTeacher && !isAdminOrCoord) {
    const profId = dbUser?.id || user.id
    const profEmail = user.email || ''
    // Professor vê provas criadas por ele
    filteredProvas = filteredProvas.filter(p => p.professorId === profId || p.professorNome?.toLowerCase().includes(dbUser?.nome?.toLowerCase() || ''))
  }

  // Apply URL filters
  if (turmaParam) {
    filteredProvas = filteredProvas.filter(p => p.turmas.some(t => t.toLowerCase() === turmaParam.toLowerCase()))
  }
  if (disciplinaParam) {
    filteredProvas = filteredProvas.filter(p => p.disciplina.toLowerCase() === disciplinaParam.toLowerCase())
  }
  if (statusParam && statusParam !== 'todos') {
    filteredProvas = filteredProvas.filter(p => p.status === statusParam)
  }
  if (periodoParam) {
    filteredProvas = filteredProvas.filter(p => String(p.bimestre) === periodoParam)
  }

  // Attach counts of submissions / in-progress attempts via single ultra-fast batch query
  const provaIds = filteredProvas.map(p => p.id)
  const statsMap = await dbGetTentativasStatsByProvaIds(provaIds)
  const enrichedProvas = filteredProvas.map(p => ({
    ...p,
    stats: statsMap[p.id] || {
      totalTentativas: 0,
      emAndamento: 0,
      entregues: 0,
      correcaoPendente: 0
    }
  }))

    return NextResponse.json(enrichedProvas)
  } catch (err: any) {
    console.error('[GET /api/provas-online error]', err)
    return NextResponse.json({ error: err.message || 'Erro ao carregar provas online' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const adminClient = getAdminClient()

    // Resolve author name and id
    const { data: dbUser } = await adminClient
      .from('system_users')
      .select('id, nome, perfil, cargo')
      .or(`id.eq.${user.id},auth_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle()

    const perfil = dbUser?.perfil || user.user_metadata?.perfil || 'Professor'
    const isAllowed = ['Diretor Geral', 'Direção', 'Administrador', 'Coordenador', 'Coordenadora', 'Professor'].includes(perfil) ||
      ['PROFESSORA', 'Professor'].includes(dbUser?.cargo || '')

    if (!isAllowed) {
      return NextResponse.json({ error: 'Permissão negada. Apenas professores e gestão podem criar provas.' }, { status: 403 })
    }

    const id = body.id || crypto.randomUUID()
    const saved = await dbSaveProva({
      ...body,
      id,
      professorId: body.professorId || dbUser?.id || user.id,
      professorNome: body.professorNome || dbUser?.nome || user.user_metadata?.nome || 'Professor',
      createdAt: body.createdAt || new Date().toISOString()
    })

    return NextResponse.json(saved, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/provas-online error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao salvar prova' }, { status: 400 })
  }
}
