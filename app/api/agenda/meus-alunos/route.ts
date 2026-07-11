import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // ── CORREÇÃO IDOR: Identidade derivada 100% da sessão autenticada ──────────
    // NUNCA aceitar respId / email / nome da URL — um atacante poderia passar
    // dados de outra família e acessar alunos indevidos.
    //
    // Fluxo seguro:
    // 1. Extrair responsavel_id dos metadados do JWT (gravado no login)
    // 2. Se não houver, buscar na tabela responsaveis pelo user.id
    // 3. Retornar apenas os alunos vinculados a esse responsável autenticado
    // ──────────────────────────────────────────────────────────────────────────

    const perfil = user.user_metadata?.perfil || ''
    const cargo  = user.user_metadata?.cargo  || ''
    const isFamilyOrStudent =
      perfil === 'Família'     ||
      perfil === 'Responsável' ||
      perfil === 'Aluno'       ||
      cargo  === 'Responsável' ||
      cargo  === 'Aluno'

    // ─── Admins/Colaboradores: acesso por aluno_id explícito (opcional) ────────
    // Não aceitamos respId/email/nome da URL nem para admins.
    const url = new URL(request.url)
    const queryAlunoId = url.searchParams.get('aluno_id') || ''

    if (!isFamilyOrStudent && queryAlunoId) {
      const { data: aluno } = await supabase
        .from('alunos')
        .select('id,nome,turma,status,foto,serie,unidade,matricula,dados')
        .eq('id', queryAlunoId)
        .maybeSingle()

      if (!aluno) return NextResponse.json([])

      const turmaIds = [aluno.turma].filter(Boolean)
      const fetchTurmas = turmaIds.length > 0
        ? supabase.from('turmas').select('id,nome,ano,codigo').in('id', turmaIds)
        : Promise.resolve({ data: [] })
      const { data: turmasData } = await fetchTurmas
      const turmasMap: Record<string, { nome: string; ano: number }> = {}
      ;(turmasData || []).forEach((t: any) => {
        turmasMap[t.id] = { nome: t.nome, ano: t.ano || new Date().getFullYear() }
      })
      const turmaInfo = turmasMap[aluno.turma] || { nome: aluno.turma || 'S/T', ano: new Date().getFullYear() }
      return NextResponse.json([{
        ...aluno,
        pendenciasAtrasadas: 0,
        turmaNome: turmaInfo.nome,
        anoLetivo: turmaInfo.ano
      }])
    }

    // ─── Família/Responsável/Colaborador: resolve pelo user.id da sessão ─────────
    // Qualquer usuário (inclusive Colaboradores) pode ter filhos cadastrados.
    // Opcionalmente, eles acessam "meus-alunos" sem `queryAlunoId`.
    // 1. Tenta responsavel_id do JWT (gravado no login)
    let responsavelId: string | null = user.user_metadata?.responsavel_id
      ? String(user.user_metadata.responsavel_id)
      : null

    // 2. Fallback: busca na tabela responsaveis pelo email ou nome
    if (!responsavelId) {
      let orConditions = []
      if (user.email) {
        orConditions.push(`email.eq.${user.email}`)
      }
      const nomeUser = user.user_metadata?.nome
      if (nomeUser) {
        const safeNome = nomeUser.replace(/"/g, '')
        orConditions.push(`nome.ilike."%${safeNome}%"`)
      }

      if (orConditions.length > 0) {
        const { data: respRow } = await supabase
          .from('responsaveis')
          .select('id')
          .or(orConditions.join(','))
          .limit(1)
          .maybeSingle()
        if (respRow?.id) responsavelId = String(respRow.id)
      }
    }

    const linkedAlunoIds = new Set<string>()

    if (responsavelId) {
      const { data: links } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id')
        .eq('responsavel_id', responsavelId)

      if (links) {
        links.forEach((l: any) => { if (l.aluno_id) linkedAlunoIds.add(String(l.aluno_id)) })
      }
    }

    // 3. Fallback: aluno com user_id = user.id (perfil Aluno com login direto)
    if (linkedAlunoIds.size === 0) {
      const { data: alunoRow } = await supabase
        .from('alunos')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (alunoRow?.id) linkedAlunoIds.add(String(alunoRow.id))
    }

    if (linkedAlunoIds.size === 0) {
      return NextResponse.json([])
    }

    const idsArray = Array.from(linkedAlunoIds)

    // ─── Fetch alunos ─────────────────────────────────────────────────────────
    const { data: alunos } = await supabase
      .from('alunos')
      .select('id,nome,turma,status,foto,serie,unidade,matricula,dados')
      .in('id', idsArray)

    if (!alunos || alunos.length === 0) {
      return NextResponse.json([])
    }

    const ativosIds       = alunos.map((a: any) => a.id)
    const ativosMatriculas = alunos.map((a: any) => a.matricula).filter(Boolean)
    const ativosNomes     = alunos.map((a: any) => a.nome).filter(Boolean)
    const turmaIds        = [...new Set(alunos.map((a: any) => a.turma).filter(Boolean))]

    const orConditions: string[] = []
    if (ativosIds.length > 0) orConditions.push(`alunoId.in.(${ativosIds.join(',')})`)
    if (ativosMatriculas.length > 0) {
      orConditions.push(`alunoId.in.(${ativosMatriculas.join(',')})`)
      const safeMats = ativosMatriculas.map((m: any) => `"${String(m).replace(/"/g, '')}"`).join(',')
      if (safeMats) orConditions.push(`aluno.in.(${safeMats})`)
    }
    if (ativosNomes.length > 0) {
      const safeNomes = ativosNomes.map((n: any) => `"${n.replace(/"/g, '')}"`).join(',')
      if (safeNomes) orConditions.push(`aluno.in.(${safeNomes})`)
    }

    const fetchTitulos = (orConditions.length > 0 && ativosIds.length <= 50)
      ? supabase.from('titulos').select('id,status,aluno,alunoId').eq('status', 'atrasado').or(orConditions.join(','))
      : Promise.resolve({ data: [] })

    const fetchTurmas = turmaIds.length > 0
      ? supabase.from('turmas').select('id,nome,ano,codigo').in('id', turmaIds)
      : Promise.resolve({ data: [] })

    const [titulosResult, turmasResult] = await Promise.allSettled([fetchTitulos, fetchTurmas])

    const pendingTitulos = titulosResult.status === 'fulfilled' && titulosResult.value.data ? titulosResult.value.data : []
    const turmasData     = turmasResult.status === 'fulfilled'  && turmasResult.value.data  ? turmasResult.value.data  : []

    const turmasMap: Record<string, { nome: string; ano: number }> = {}
    turmasData.forEach((t: any) => {
      turmasMap[t.id] = { nome: t.nome, ano: t.ano || new Date().getFullYear() }
    })

    const result = alunos.map((a: any) => {
      const pendentesAluno = pendingTitulos.filter((t: any) =>
        t.alunoId === a.id || t.aluno === a.nome || (a.matricula && (t.alunoId === a.matricula || t.aluno === a.matricula))
      )
      const turmaInfo = turmasMap[a.turma] || { nome: a.turma || 'S/T', ano: new Date().getFullYear() }
      return {
        ...a,
        pendenciasAtrasadas: pendentesAluno.length,
        turmaNome: turmaInfo.nome,
        anoLetivo: turmaInfo.ano
      }
    })

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }
    })
  } catch (e: any) {
    console.error('Erro em meus-alunos API:', e)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
