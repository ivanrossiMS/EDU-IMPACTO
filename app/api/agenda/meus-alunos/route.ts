import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { isAlunoIntegralIntermediario } from '@/lib/studentTurmaUtils'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    // ── CORREÇÃO IDOR: Identidade derivada 100% da sessão autenticada ──────────
    // NUNCA aceitar respId / email / nome da URL — um atacante poderia passar
    // dados de outra família e acessar alunos indevidos.
    //
    // Fluxo seguro e de alta performance:
    // 1. FAST-PATH: Extrair responsavel_id ou aluno_id dos metadados do JWT (gravado no login)
    //    e buscar alunos via PostgREST Resource Embedding em 1 única ida ao banco (sub-100ms).
    // 2. SLOW-PATH (Fallback): Se não houver no JWT, busca concorrente em paralelo.
    // 3. Retornar apenas os alunos vinculados a esse responsável autenticado.
    // ──────────────────────────────────────────────────────────────────────────

    const perfil = user.user_metadata?.perfil || ''
    const cargo  = user.user_metadata?.cargo  || ''
    const hasDualRole = Boolean(user.user_metadata?.hasDualRole || user.user_metadata?.responsavel_id)
    const isFamilyOrStudent =
      perfil === 'Família'     ||
      perfil === 'Responsável' ||
      perfil === 'Aluno'       ||
      cargo  === 'Responsável' ||
      cargo  === 'Aluno'       ||
      hasDualRole

    // ─── Admins/Colaboradores: acesso por aluno_id explícito (opcional) ────────
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
      const { data: turmasData } = turmaIds.length > 0
        ? await supabase.from('turmas').select('id,nome,ano,codigo').in('id', turmaIds)
        : { data: [] }
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

    let alunosRaw: any[] = []

    // ─── FAST-PATH 1: Perfil Aluno direto (aluno_id presente na sessão) ───────
    const directAlunoId = user.user_metadata?.aluno_id
    if ((cargo === 'Aluno' || perfil === 'Aluno') && directAlunoId) {
      const { data: directAluno } = await supabase
        .from('alunos')
        .select('id,nome,turma,status,foto,serie,unidade,matricula,dados')
        .eq('id', directAlunoId)
        .maybeSingle()
      if (directAluno) {
        alunosRaw = [directAluno]
      }
    }

    // ─── FAST-PATH 2: Responsável com responsavel_id nos metadados do JWT ─────
    // PostgREST Resource Embedding: busca vínculo e dados do aluno em 1 única query
    const metaRespId = user.user_metadata?.responsavel_id
    if (alunosRaw.length === 0 && metaRespId) {
      const { data: links } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, alunos(id,nome,turma,status,foto,serie,unidade,matricula,dados)')
        .eq('responsavel_id', String(metaRespId))

      if (links && links.length > 0) {
        alunosRaw = links
          .map((l: any) => (Array.isArray(l.alunos) ? l.alunos[0] : l.alunos))
          .filter(Boolean)
      }
    }

    // ─── SLOW-PATH (Fallback): Executa apenas se o usuário não tiver ID no JWT ─
    if (alunosRaw.length === 0) {
      const candidateRespIds = new Set<string>()
      if (metaRespId) candidateRespIds.add(String(metaRespId))
      if (user.id) candidateRespIds.add(String(user.id))

      const respOrConds: string[] = []
      if (user.id) {
        respOrConds.push(`dados->>auth_id.eq.${user.id}`)
        respOrConds.push(`dados->>user_id.eq.${user.id}`)
      }
      if (user.email) {
        const em = user.email.toLowerCase().trim()
        respOrConds.push(`email.ilike.${em}`)
      }
      const nomeUser = user.user_metadata?.nome
      if (nomeUser) {
        const safeNome = nomeUser.replace(/["%,]/g, '').trim()
        if (safeNome.length >= 3) {
          respOrConds.push(`nome.ilike."%${safeNome}%"`)
        }
      }

      const sysConds: string[] = []
      if (user.id) sysConds.push(`id.eq.${user.id}`, `auth_id.eq.${user.id}`)
      if (user.email) sysConds.push(`email.ilike.${user.email.toLowerCase().trim()}`)

      // Paraleliza busca de possíveis IDs do responsável em responsaveis e system_users
      const [respRowsRes, sysDataRes] = await Promise.all([
        respOrConds.length > 0
          ? supabase.from('responsaveis').select('id').or(respOrConds.join(',')).limit(10)
          : Promise.resolve({ data: [] }),
        sysConds.length > 0
          ? supabase.from('system_users').select('id, dados').or(sysConds.join(',')).limit(5)
          : Promise.resolve({ data: [] })
      ])

      if (respRowsRes.data) {
        respRowsRes.data.forEach((r: any) => { if (r.id) candidateRespIds.add(String(r.id)) })
      }
      if (sysDataRes.data) {
        sysDataRes.data.forEach((s: any) => {
          const rId = s.dados?.responsavel_id || s.dados?.responsavelId
          if (rId) candidateRespIds.add(String(rId))
        })
      }

      if (candidateRespIds.size > 0) {
        const respIdList = Array.from(candidateRespIds)
        const { data: links } = await supabase
          .from('aluno_responsavel')
          .select('aluno_id, alunos(id,nome,turma,status,foto,serie,unidade,matricula,dados)')
          .in('responsavel_id', respIdList)

        if (links && links.length > 0) {
          alunosRaw = links
            .map((l: any) => (Array.isArray(l.alunos) ? l.alunos[0] : l.alunos))
            .filter(Boolean)
        }
      }

      // Se ainda não encontrou, checa se é login de aluno direto via dados->auth_id
      if (alunosRaw.length === 0 && user.id) {
        const { data: alunoRow } = await supabase
          .from('alunos')
          .select('id,nome,turma,status,foto,serie,unidade,matricula,dados')
          .or(`dados->>auth_id.eq.${user.id},dados->>user_id.eq.${user.id}`)
          .maybeSingle()
        if (alunoRow) {
          alunosRaw = [alunoRow]
        }
      }
    }

    if (!alunosRaw || alunosRaw.length === 0) {
      return NextResponse.json([])
    }

    // Deduplica alunos caso existam múltiplos vínculos repetidos
    const seenAlunos = new Set<string>()
    const alunos = alunosRaw.filter((a: any) => {
      const idStr = String(a.id)
      if (seenAlunos.has(idStr)) return false
      seenAlunos.add(idStr)
      return true
    })

    const turmaIds = [...new Set(alunos.map((a: any) => a.turma).filter(Boolean))]

    // Busca turmas e títulos atrasados em paralelo
    const [turmasResult, titulosResult] = await Promise.allSettled([
      turmaIds.length > 0
        ? supabase.from('turmas').select('id,nome,ano,codigo').in('id', turmaIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('titulos')
        .select('id,status,aluno,dados')
        .eq('status', 'atrasado')
        .limit(100)
    ])

    const turmasData     = turmasResult.status === 'fulfilled'  && turmasResult.value.data  ? turmasResult.value.data  : []
    const pendingTitulos = titulosResult.status === 'fulfilled' && titulosResult.value.data ? titulosResult.value.data : []

    const turmasMap: Record<string, { nome: string; ano: number }> = {}
    turmasData.forEach((t: any) => {
      turmasMap[t.id] = { nome: t.nome, ano: t.ano || new Date().getFullYear() }
    })

    const result = alunos.map((a: any) => {
      const pendentesAluno = pendingTitulos.filter((t: any) => {
        const tAlunoId = t.dados?.alunoId || t.dados?.aluno_id || t.alunoId || t.aluno
        return (
          tAlunoId === a.id ||
          t.aluno === a.nome ||
          (a.matricula && (tAlunoId === a.matricula || t.aluno === a.matricula))
        )
      })
      const turmaInfo = turmasMap[a.turma] || { nome: a.turma || 'S/T', ano: new Date().getFullYear() }
      const isIntegral = isAlunoIntegralIntermediario(a, turmasData || [])

      let finalTurmaNome = turmaInfo.nome
      if (isIntegral && finalTurmaNome && !finalTurmaNome.toUpperCase().includes('INTEGRAL') && !finalTurmaNome.toUpperCase().includes('INTERMEDIÁRIO')) {
        finalTurmaNome = `${finalTurmaNome} - INTEGRAL/INTERMEDIÁRIO`
      }

      return {
        ...a,
        isIntegralIntermediario: isIntegral,
        modalidade: isIntegral ? 'INTEGRAL/INTERMEDIÁRIO' : (a.modalidade || a.dados?.modalidade || ''),
        turno_nome: isIntegral ? 'Integral/Intermediário' : (a.turno_nome || a.turno || ''),
        pendenciasAtrasadas: pendentesAluno.length,
        turmaNome: finalTurmaNome,
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
