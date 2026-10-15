import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const updates = await request.json()

  const { data: existing } = await supabase
    .from('ocorrencias')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Ocorrência não encontrada' }, { status: 404 })
  }

  const dados = { ...(existing.dados || {}), ...updates }
  const payload: Record<string, any> = {
    dados,
    aluno_id: updates.aluno_id ?? updates.alunoId ?? existing.aluno_id,
    turma_id: updates.turma_id ?? updates.turma ?? existing.turma_id,
    data: updates.data ?? existing.data,
    tipo: updates.tipo ?? existing.tipo,
    descricao: updates.descricao ?? existing.descricao,
    gravidade: updates.gravidade ?? existing.gravidade,
    responsavel: updates.responsavel ?? existing.responsavel,
  }

  const { data, error } = await supabase
    .from('ocorrencias')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ...(data.dados || {}), ...data })
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const { error } = await supabase.from('ocorrencias').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, id })
}
