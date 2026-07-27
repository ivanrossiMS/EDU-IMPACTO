import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

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
    ].filter(Boolean).map(r => String(r).trim())

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

    const linkedResponsaveis = (links || []).filter((l: any) => studentRefs.includes(String(l.aluno_id).trim()))
      .map((l: any) => {
        const resp = responsaveis.find((r: any) => String(r.id).trim() === String(l.responsavel_id).trim()) || {}
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

    let finalResponsaveis = linkedResponsaveis.length > 0 ? linkedResponsaveis : fallbackResponsaveis
    if (finalResponsaveis.length === 0) {
      const candidateText = (student.responsavel || student.responsavel_financeiro || student.responsavel_pedagogico || '').trim()
      if (candidateText && candidateText.toLowerCase() !== 'none' && candidateText.toLowerCase() !== 'nenhum') {
        const { data: matchedResp } = await supabase
          .from('responsaveis')
          .select('*')
          .ilike('nome', candidateText)
          .maybeSingle()

        if (matchedResp) {
          finalResponsaveis = [{
            ...matchedResp,
            parentesco: 'mae',
            isFinanceiro: true,
            isPedagogico: true,
            isOutro: false
          }]
        } else {
          finalResponsaveis = [{
            id: '',
            nome: candidateText,
            parentesco: 'mae',
            isFinanceiro: true,
            isPedagogico: true,
            isOutro: false
          }]
        }
      }
    }

    const formattedStudent = {
      ...student,
      ...(student.dados || {}),
      responsaveis: finalResponsaveis,
    }

    return NextResponse.json({ data: formattedStudent })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json()
    
    const { email, telefone } = body

    const updates: any = {}
    if (email !== undefined) updates.email = email
    if (telefone !== undefined) updates.telefone = telefone

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum dado para atualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('alunos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
