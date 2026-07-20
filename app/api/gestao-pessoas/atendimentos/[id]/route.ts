import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const body = await request.json()
    const payload: any = {}
    if (body.tipo) payload.categoria = body.tipo
    if (body.descricao) payload.descricao = body.descricao
    if (body.status) payload.status = body.status
    if (body.funcionario_id) payload.funcionario_id = body.funcionario_id
    if (body.solicitante) payload.dados = { solicitante: body.solicitante }
    if (body.created_at) payload.created_at = body.created_at

    const { error } = await supabase
      .from('gp_atendimentos')
      .update(payload)
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const { error } = await supabase
      .from('gp_atendimentos')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
