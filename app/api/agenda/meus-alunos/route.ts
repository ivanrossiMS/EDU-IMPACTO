import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const respId = url.searchParams.get('respId') || ''
    const email = (url.searchParams.get('email') || '').toLowerCase().trim()
    const nome = (url.searchParams.get('nome') || '').toLowerCase().trim()

    if (!respId && !email && !nome) {
      return NextResponse.json([])
    }

    let matchedRespIds = new Set<string>()

    // ─── Step 1: Resolve Responsável IDs ──────────────────────────────────────
    if (respId) {
      matchedRespIds.add(respId)
    } else if (email || nome) {
      let query = supabase.from('responsaveis').select('id')
      if (email && nome) {
        query = query.or(`email.ilike.${email},nome.ilike.${nome}`)
      } else if (email) {
        query = query.ilike('email', email)
      } else if (nome) {
        query = query.ilike('nome', nome)
      }
      const { data: foundResps } = await query
      if (foundResps && foundResps.length > 0) {
        foundResps.forEach((r: any) => matchedRespIds.add(String(r.id)))
      }
    }

    if (matchedRespIds.size === 0) {
      return NextResponse.json([])
    }

    // ─── Step 2: Get linked aluno_ids (single query) ──────────────────────────
    const { data: links } = await supabase
      .from('aluno_responsavel')
      .select('aluno_id')
      .in('responsavel_id', Array.from(matchedRespIds))

    const linkedAlunoIds = new Set<string>()
    if (links) {
      links.forEach((l: any) => { if (l.aluno_id) linkedAlunoIds.add(String(l.aluno_id)) })
    }

    if (linkedAlunoIds.size === 0) {
      // Fallback via text fields on alunos table if no formal link exists
      if (nome) {
        const { data: fallbackAlunos } = await supabase
          .from('alunos')
          .select('id,nome,turma,status,foto,serie,unidade,matricula,dados')
          .or(`responsavel.ilike.%${nome}%,responsavel_financeiro.ilike.%${nome}%`)
        
        if (!fallbackAlunos || fallbackAlunos.length === 0) {
          return NextResponse.json([])
        }
        fallbackAlunos.forEach(a => linkedAlunoIds.add(String(a.id)))
      } else {
        return NextResponse.json([])
      }
    }

    const idsArray = Array.from(linkedAlunoIds)

    // ─── Step 3: Fetch alunos ───────────────────
    const { data: alunos } = await supabase
        .from('alunos')
        .select('id,nome,turma,status,foto,serie,unidade,matricula,dados')
        .in('id', idsArray);

    if (!alunos || alunos.length === 0) {
      return NextResponse.json([])
    }

    const ativosIds = alunos.map(a => a.id)
    const ativosMatriculas = alunos.map(a => a.matricula).filter(Boolean)
    const ativosNomes = alunos.map(a => a.nome).filter(Boolean)
    const turmaIds = [...new Set(alunos.map(a => a.turma).filter(Boolean))]

    // ─── Step 4: Fetch pending titulos & turmas in PARALLEL (non-blocking) ──────────────
    const orConditions: string[] = []
    if (ativosIds.length > 0) orConditions.push(`alunoId.in.(${ativosIds.join(',')})`)
    if (ativosMatriculas.length > 0) {
      orConditions.push(`alunoId.in.(${ativosMatriculas.join(',')})`)
      const safeMats = ativosMatriculas.map(m => `"${String(m).replace(/"/g, '')}"`).join(',')
      if (safeMats) orConditions.push(`aluno.in.(${safeMats})`)
    }
    if (ativosNomes.length > 0) {
      const safeNomes = ativosNomes.map(n => `"${n.replace(/"/g, '')}"`).join(',')
      if (safeNomes) orConditions.push(`aluno.in.(${safeNomes})`)
    }

    const fetchTitulos = (orConditions.length > 0 && ativosIds.length <= 50) 
      ? supabase.from('titulos').select('id,status,aluno,alunoId').eq('status', 'atrasado').or(orConditions.join(','))
      : Promise.resolve({ data: [] });

    const fetchTurmas = turmaIds.length > 0
      ? supabase.from('turmas').select('id,nome,ano,codigo').in('id', turmaIds)
      : Promise.resolve({ data: [] });

    const [titulosResult, turmasResult] = await Promise.allSettled([fetchTitulos, fetchTurmas]);

    const pendingTitulos = titulosResult.status === 'fulfilled' && titulosResult.value.data ? titulosResult.value.data : [];
    const turmasData = turmasResult.status === 'fulfilled' && turmasResult.value.data ? turmasResult.value.data : [];

    // ─── Step 4.5: Map Turma details ────────────────
    let turmasMap: Record<string, { nome: string, ano: number }> = {}
    turmasData.forEach((t: any) => {
      turmasMap[t.id] = { nome: t.nome, ano: t.ano || new Date().getFullYear() }
    })

    // ─── Step 5: Build result ─────────────────────────────────────────────────
    const result = alunos.map(a => {
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

    // Short cache: 30s browser cache to prevent redundant requests on back-navigation
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      }
    })
  } catch (e: any) {
    console.error('Erro em meus-alunos API:', e)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
