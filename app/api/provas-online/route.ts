import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { dbGetProvas, dbSaveProva, dbGetTentativasByProvaId } from '@/lib/provas-online/db'
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
      .select('id, nome, matricula, turma, serie, email, responsavel')
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
  const isResponsible = (cargo === 'Responsável' || perfil === 'Família' || perfil === 'Responsável') && !requestedAlunoId
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
    if (dbAluno.turma) {
      studentTurmaIdentifiers.push(String(dbAluno.turma).trim().toLowerCase())
    }
    
    // Query turma table to get turma name and code
    if (dbAluno.turma) {
      try {
        const { data: turmaObj } = await adminClient
          .from('turmas')
          .select('id, codigo, nome, serie')
          .or(`id.eq.${dbAluno.turma},codigo.eq.${dbAluno.turma},nome.eq.${dbAluno.turma}`)
          .maybeSingle()
        if (turmaObj) {
          if (turmaObj.nome) studentTurmaIdentifiers.push(turmaObj.nome.trim().toLowerCase())
          if (turmaObj.codigo) studentTurmaIdentifiers.push(String(turmaObj.codigo).trim().toLowerCase())
          if (turmaObj.id) studentTurmaIdentifiers.push(String(turmaObj.id).trim().toLowerCase())
          if (!dbAluno.serie && turmaObj.serie) dbAluno.serie = turmaObj.serie
        }
      } catch (err) {
        console.error('[provas-online] Erro ao buscar turma do aluno:', err)
      }
    }

    filteredProvas = filteredProvas.filter(p => {
      // Provas em rascunho nunca aparecem para alunos
      if (p.status === 'rascunho') return false

      // Se requer aprovação e ainda não foi aprovada, não exibe
      if (p.aprovacaoRequerida && p.statusAprovacao !== 'aprovada') return false

      // 1. Se a prova foi vinculada a alunos específicos:
      // O aluno só deve ver se seu ID ou matrícula estiver explicitamente na lista
      if (p.alunosEspecificos && p.alunosEspecificos.length > 0) {
        const isSelected = p.alunosEspecificos.includes(alunoId) ||
          p.alunosEspecificos.includes(dbAluno.id) ||
          (dbAluno.matricula && p.alunosEspecificos.includes(dbAluno.matricula))
        return Boolean(isSelected)
      }

      // 2. Se a prova NÃO define turmas nem séries nem alunos específicos, não foi vinculada ao aluno
      const pTurmas = Array.isArray(p.turmas) ? p.turmas : []
      const pSeries = Array.isArray(p.series) ? p.series : []
      if (pTurmas.length === 0 && pSeries.length === 0) {
        return false
      }

      // 3. Verifica correspondência exata de turma
      const matchesTurma = pTurmas.length > 0 && pTurmas.some(t => {
        const tNorm = String(t || '').trim().toLowerCase()
        if (!tNorm) return false
        return studentTurmaIdentifiers.some(st => st === tNorm)
      })

      // 4. Verifica correspondência exata de série
      const alunoSerieNorm = String(dbAluno.serie || '').trim().toLowerCase()
      const matchesSerie = pSeries.length > 0 && Boolean(alunoSerieNorm) && pSeries.some(s => {
        const sNorm = String(s || '').trim().toLowerCase()
        return sNorm && sNorm === alunoSerieNorm
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

        const activeTentativa = myTentativas.find(t => t.status === 'em_andamento')
        const submittedTentativas = myTentativas.filter(t => t.status === 'entregue' || t.status === 'expirada')
        const canView = shouldPublishResults(prova, tentativas)

        const sanitized = sanitizeExamForParticipant(prova, canView)
        return {
          ...sanitized,
          studentInfo: {
            tentativasRealizadas: myTentativas.length,
            tentativasPermitidas: prova.quantidadeTentativas || 1,
            tentativaAtivaId: activeTentativa?.id || null,
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

  // Attach counts of submissions / in-progress attempts for teacher/admin dashboard cards
  const enrichedProvas = await Promise.all(
    filteredProvas.map(async p => {
      const tentativas = await dbGetTentativasByProvaId(p.id)
      const emAndamentoCount = tentativas.filter(t => t.status === 'em_andamento').length
      const entreguesCount = tentativas.filter(t => t.status === 'entregue' || t.status === 'expirada').length
      const correcaoPendenteCount = tentativas.filter(t => t.statusCorrecao === 'pendente' || t.statusCorrecao === 'parcial').length
      
      return {
        ...p,
        stats: {
          totalTentativas: tentativas.length,
          emAndamento: emAndamentoCount,
          entregues: entreguesCount,
          correcaoPendente: correcaoPendenteCount
        }
      }
    })
  )

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
