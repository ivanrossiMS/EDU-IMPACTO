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
    .from('boletins')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
  }

  const payload: Record<string, any> = {
    aluno_id: updates.aluno_id ?? updates.alunoId ?? existing.aluno_id,
    turma_id: updates.turma_id ?? updates.turmaId ?? existing.turma_id,
    ano: updates.ano ?? existing.ano,
    bimestre: updates.bimestre ?? existing.bimestre,
    disciplina: updates.disciplina ?? existing.disciplina,
    av1: updates.av1 !== undefined ? updates.av1 : existing.av1,
    av2: updates.av2 !== undefined ? updates.av2 : existing.av2,
    rec: updates.rec !== undefined ? updates.rec : existing.rec,
    media: updates.media !== undefined ? updates.media : existing.media,
    faltas: updates.faltas !== undefined ? updates.faltas : existing.faltas,
    status: updates.status ?? existing.status,
  }

  const { data, error } = await supabase
    .from('boletins')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const { error } = await supabase.from('boletins').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, id })
}
