import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const { id } = await context.params
    const updates = await request.json()
    const supabase = getAdminClient()

    const { data: row } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'cfgDisciplinas')
      .maybeSingle()

    const list: any[] = Array.isArray(row?.valor) ? [...row.valor] : []
    const index = list.findIndex((c: any) => String(c.id) === String(id))
    if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    list[index] = { ...list[index], ...updates }
    const { error } = await supabase
      .from('configuracoes')
      .upsert({ chave: 'cfgDisciplinas', valor: list }, { onConflict: 'chave' })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(list[index])
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar disciplina' }, { status: 400 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const { id } = await context.params
    const supabase = getAdminClient()

    const { data: row } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'cfgDisciplinas')
      .maybeSingle()

    const list: any[] = Array.isArray(row?.valor) ? [...row.valor] : []
    const index = list.findIndex((c: any) => String(c.id) === String(id))
    if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const deleted = list.splice(index, 1)
    const { error } = await supabase
      .from('configuracoes')
      .upsert({ chave: 'cfgDisciplinas', valor: list }, { onConflict: 'chave' })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(deleted)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao excluir disciplina' }, { status: 400 })
  }
}
