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

    // ─── Step 3: Fetch alunos + pending titulos in PARALLEL ───────────────────
    const [alunosResult] = await Promise.all([
      supabase
        .from('alunos')
        .select('id,nome,turma,status,foto,serie,unidade,matricula,dados')
        .in('id', idsArray),
    ])

    const alunos = alunosResult.data
    if (!alunos || alunos.length === 0) {
      return NextResponse.json([])
    }

    const alunosAtivos = alunos.filter(a => {
      const s = a.status?.toLowerCase()
      return s === 'matriculado' || s === 'ativo' || s === 'em_cadastro' || s === 'pendente' || !s
    })

    if (alunosAtivos.length === 0) {
      return NextResponse.json([])
    }

    const ativosIds = alunosAtivos.map(a => a.id)
    const ativosMatriculas = alunosAtivos.map(a => a.matricula).filter(Boolean)
    const ativosNomes = alunosAtivos.map(a => a.nome).filter(Boolean)

    // ─── Step 4: Fetch pending titulos (parallel, non-blocking) ──────────────
    let pendingTitulos: any[] = []
    try {
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

      if (orConditions.length > 0) {
        const { data: titulos } = await supabase
          .from('titulos')
          .select('id,status,aluno,alunoId')
          .eq('status', 'atrasado')
          .or(orConditions.join(','))
        pendingTitulos = titulos || []
      }
    } catch (_) {
      // Titulos fetch is non-critical — proceed without pendência counts
    }

    // ─── Step 4.5: Fetch Turma details to get Nome and Ano ────────────────
    const turmaIds = [...new Set(alunosAtivos.map(a => a.turma).filter(Boolean))]
    let turmasMap: Record<string, { nome: string, ano: number }> = {}
    
    if (turmaIds.length > 0) {
      // Sometimes a.turma could be ID or codigo
      const { data: turmasData } = await supabase
        .from('turmas')
        .select('id,nome,ano,codigo')
        .in('id', turmaIds)
      
      if (turmasData) {
        turmasData.forEach((t: any) => {
          turmasMap[t.id] = { nome: t.nome, ano: t.ano || new Date().getFullYear() }
        })
      }
    }

    // ─── Step 5: Build result ─────────────────────────────────────────────────
    const result = alunosAtivos.map(a => {
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
