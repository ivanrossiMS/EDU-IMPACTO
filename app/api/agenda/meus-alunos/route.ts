import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const respId = url.searchParams.get('respId') || ''
    const email = (url.searchParams.get('email') || '').toLowerCase().trim()
    const nome = (url.searchParams.get('nome') || '').toLowerCase().trim()

    if (!respId && !email && !nome) {
      return NextResponse.json([])
    }

    let matchedRespIds = new Set<string>()

    // 1. Resolve Responsável IDs
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

    // 2. Encontra aluno_ids vinculados a esses responsáveis
    const { data: links } = await supabase
      .from('aluno_responsavel')
      .select('aluno_id')
      .in('responsavel_id', Array.from(matchedRespIds))

    const linkedAlunoIds = new Set<string>()
    if (links) {
      links.forEach((l: any) => {
        if (l.aluno_id) linkedAlunoIds.add(String(l.aluno_id))
      })
    }

    if (linkedAlunoIds.size === 0) {
      // Fallback para campos textuais diretos na tabela de alunos, caso não tenha vínculo formal
      let fallbackQuery = supabase.from('alunos').select('id,nome,turma,status,foto,serie,unidade,dados')
      
      if (email && nome) {
        fallbackQuery = fallbackQuery.or(`responsavel.ilike.${nome},responsavel_financeiro.ilike.${nome},emailResponsavel.ilike.${email},email_responsavel.ilike.${email}`)
      } else if (nome) {
        fallbackQuery = fallbackQuery.or(`responsavel.ilike.${nome},responsavel_financeiro.ilike.${nome}`)
      } else if (email) {
        fallbackQuery = fallbackQuery.or(`emailResponsavel.ilike.${email},email_responsavel.ilike.${email}`)
      }

      const { data: fallbackAlunos } = await fallbackQuery
      
      if (!fallbackAlunos || fallbackAlunos.length === 0) {
        return NextResponse.json([])
      }
      
      fallbackAlunos.forEach(a => linkedAlunoIds.add(String(a.id)))
    }

    // 3. Busca os alunos oficiais
    const idsArray = Array.from(linkedAlunoIds)
    const { data: alunos } = await supabase
      .from('alunos')
      .select('id,nome,turma,status,foto,serie,unidade,matricula,dados')
      .in('id', idsArray)

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
    
    // Concatena as strings para busca de títulos (pois títulos usa `aluno` (nome) ou `alunoId`)
    const searchRefs = [...ativosIds, ...ativosMatriculas, ...ativosNomes]

    // 4. Busca títulos pendentes (atrasados) apenas destes alunos (Otimizado com OR)
    let pendingTitulos: any[] = []
    
    if (ativosIds.length > 0 || ativosNomes.length > 0 || ativosMatriculas.length > 0) {
      let titulosQuery = supabase
        .from('titulos')
        .select('id,status,aluno,alunoId')
        .eq('status', 'atrasado')
        
      const orConditions = []
      if (ativosIds.length > 0) {
        orConditions.push(`alunoId.in.(${ativosIds.join(',')})`)
      }
      // Evita problemas com nomes que tem vírgula
      const safeNomes = ativosNomes.map(n => `"${n.replace(/"/g, '')}"`).join(',')
      if (safeNomes) {
        orConditions.push(`aluno.in.(${safeNomes})`)
      }
      if (ativosMatriculas.length > 0) {
        orConditions.push(`alunoId.in.(${ativosMatriculas.join(',')})`)
        const safeMats = ativosMatriculas.map(m => `"${String(m).replace(/"/g, '')}"`).join(',')
        if (safeMats) {
          orConditions.push(`aluno.in.(${safeMats})`)
        }
      }
      
      if (orConditions.length > 0) {
        titulosQuery = titulosQuery.or(orConditions.join(','))
      }
      
      const { data: titulos } = await titulosQuery
      pendingTitulos = titulos || []
    }

    // Formatar retorno
    const result = alunosAtivos.map(a => {
      const pendentesAluno = pendingTitulos.filter((t: any) => 
        t.alunoId === a.id || t.aluno === a.nome || (a.matricula && (t.alunoId === a.matricula || t.aluno === a.matricula))
      )
      
      return {
        ...a,
        pendenciasAtrasadas: pendentesAluno.length
      }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Erro em meus-alunos API:', e)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
