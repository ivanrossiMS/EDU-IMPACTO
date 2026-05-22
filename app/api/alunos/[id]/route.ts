import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // The ID could be the aluno's UUID, matricula, or dados.codigo
    // Try to find the student by any of these identifiers
    const { data: byId } = await supabase
      .from('alunos')
      .select('*')
      .eq('id', id)
      .single()

    const student = byId || null

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    // Build all possible refs for this student to match aluno_responsavel
    const studentRefs = [
      student.id,
      student.matricula,
      student.dados?.codigo,
      student.matricula ? String(student.matricula) : null,
      student.dados?.codigo ? String(student.dados?.codigo) : null,
    ].filter(Boolean)

    // Fetch the links for this student
    const { data: links } = await supabase
      .from('aluno_responsavel')
      .select('*')
      .in('aluno_id', studentRefs)

    let responsaveis: any[] = []

    if (links && links.length > 0) {
      const respIds = links.map((l: any) => l.responsavel_id).filter(Boolean)
      if (respIds.length > 0) {
        const { data: respData } = await supabase
          .from('responsaveis')
          .select('*')
          .in('id', respIds)

        responsaveis = (respData || [])
      }
    }

    const linkedResponsaveis = (links || []).filter((l: any) => studentRefs.includes(l.aluno_id))
      .map((l: any) => {
        const resp = responsaveis.find((r: any) => r.id === l.responsavel_id) || {}
        return {
          ...resp,
          parentesco: l.parentesco,
          isFinanceiro: l.resp_financeiro,
          respFinanceiro: l.resp_financeiro,
          isPedagogico: l.resp_pedagogico,
          respPedagogico: l.resp_pedagogico,
          isOutro: l.resp_outro,
          dataNasc: resp.data_nasc,
          diasAcesso: resp.dias_acesso,
        }
      }).filter((r: any) => r.id)

    const fallbackResponsaveis = student.dados?.responsaveis || []

    const formattedStudent = {
      ...student,
      ...(student.dados || {}),
      responsaveis: linkedResponsaveis.length > 0 ? linkedResponsaveis : fallbackResponsaveis,
    }

    return NextResponse.json({ data: formattedStudent })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
