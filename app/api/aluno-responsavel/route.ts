import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

/**
 * GET /api/aluno-responsavel?aluno_id=XXXX
 * Endpoint público (sem auth) para carregar responsáveis de um aluno na Agenda Digital.
 * Usa service role key internamente para contornar RLS.
 */
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const alunoId = url.searchParams.get('aluno_id')
    const alunoIdsStr = url.searchParams.get('aluno_ids')

    let alunoIds: string[] = []
    if (alunoIdsStr) {
      alunoIds = alunoIdsStr.split(',').filter(Boolean)
    } else if (alunoId) {
      alunoIds = [alunoId]
    }

    if (alunoIds.length === 0) {
      return NextResponse.json({ error: 'aluno_id ou aluno_ids é obrigatório' }, { status: 400 })
    }

    // Build all possible refs for these students (id, matricula, codigo podem diferir)
    let refs: string[] = [...alunoIds]
    const refsMap: Record<string, string> = {}

    // Try to find the students to get all their refs
    const { data: students } = await supabase
      .from('alunos')
      .select('id, matricula, dados')
      .in('id', alunoIds)

    if (students && students.length > 0) {
      students.forEach(student => {
        const extraRefs = [
          student.id,
          student.matricula,
          student.dados?.codigo,
          student.matricula ? String(student.matricula) : null,
          student.dados?.codigo ? String(student.dados?.codigo) : null,
        ].filter(Boolean)
        
        extraRefs.forEach(r => {
          refsMap[r] = student.id
          if (!refs.includes(r)) refs.push(r)
        })
      })
    }

    // Fetch the links
    const { data: links, error: linksError } = await supabase
      .from('aluno_responsavel')
      .select('*')
      .in('aluno_id', refs)

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 400 })
    }

    if (!links || links.length === 0) {
      if (alunoIdsStr) {
        return NextResponse.json({ responsaveisMap: {} })
      }
      return NextResponse.json({ responsaveis: [] })
    }

    // Fetch the actual responsavel records
    const respIds = links.map((l: any) => l.responsavel_id).filter(Boolean)
    const { data: respData, error: respError } = await supabase
      .from('responsaveis')
      .select('*')
      .in('id', respIds)

    if (respError) {
      return NextResponse.json({ error: respError.message }, { status: 400 })
    }

    // If multiple IDs requested, return a map
    if (alunoIdsStr) {
      const map: Record<string, any[]> = {}
      alunoIds.forEach(id => map[id] = [])
      
      links.forEach((l: any) => {
        const studentId = refsMap[l.aluno_id] || l.aluno_id
        if (!map[studentId]) map[studentId] = []
        
        const resp = (respData || []).find((r: any) => r.id === l.responsavel_id) || {}
        map[studentId].push({
          ...resp,
          parentesco: l.parentesco,
          isFinanceiro: l.resp_financeiro,
          respFinanceiro: l.resp_financeiro,
          isPedagogico: l.resp_pedagogico,
          respPedagogico: l.resp_pedagogico,
          isOutro: l.resp_outro,
        })
      })
      
      // Remove empty entries or duplicates if any
      Object.keys(map).forEach(k => {
        map[k] = map[k].filter((r: any) => r.id)
      })

      return NextResponse.json({ responsaveisMap: map })
    }

    // If single ID requested (legacy logic for the modal)
    const responsaveis = links
      .filter((l: any) => refs.includes(l.aluno_id))
      .map((l: any) => {
        const resp = (respData || []).find((r: any) => r.id === l.responsavel_id) || {}
        return {
          ...resp,
          parentesco: l.parentesco,
          isFinanceiro: l.resp_financeiro,
          respFinanceiro: l.resp_financeiro,
          isPedagogico: l.resp_pedagogico,
          respPedagogico: l.resp_pedagogico,
          isOutro: l.resp_outro,
        }
      })
      .filter((r: any) => r.id)

    return NextResponse.json({ responsaveis })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
