import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { data, error } = await supabaseServer.from('contas_pagar').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ ...data, ...(data.dados || {}) })
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const body = await request.json()
    const { descricao, categoria, valor, vencimento, status,
      fornecedor, numeroDocumento, planoContasId, centroCustoId, codigo, usaRateio, ...rest } = body
    const row = {
      id: id, descricao: descricao || '', categoria: categoria || '',
      valor: Number(valor) || 0, vencimento: vencimento || '',
      status: status || 'pendente', fornecedor: fornecedor || '',
      numero_documento: numeroDocumento || null, plano_contas_id: planoContasId || null,
      centro_custo_id: centroCustoId || null, codigo: codigo || null,
      usa_rateio: usaRateio || false, dados: rest, updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabaseServer.from('contas_pagar').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { error } = await supabaseServer.from('contas_pagar').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
