import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { id } = await context.params
  const { data, error } = await supabase.from('titulos').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ ...data, ...(data.dados || {}) })
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { id: paramId } = await context.params
  try {
    const body = await request.json()
    const {
      id, aluno, responsavel, descricao, valor, vencimento, pagamento,
      status, metodo, parcela, eventoId, eventoDescricao,
      dados, created_at, updated_at, evento_id, evento_descricao,
      ...rest
    } = body

    const { data: existing } = await supabase
      .from('titulos')
      .select('dados')
      .eq('id', paramId)
      .maybeSingle()

    const mergedDados = {
      ...(existing?.dados || {}),
      ...(typeof dados === 'object' && dados !== null ? dados : {}),
      ...rest,
    }

    const row = {
      id: paramId,
      aluno: aluno || '', responsavel: responsavel || '',
      descricao: descricao || '', valor: Number(valor) || 0,
      vencimento: vencimento || '', pagamento: pagamento || null,
      status: status || 'pendente', metodo: metodo || null, parcela: parcela || '',
      evento_id: eventoId || null, evento_descricao: eventoDescricao || null,
      dados: mergedDados,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('titulos').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { id } = await context.params
  const { error } = await supabase.from('titulos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
