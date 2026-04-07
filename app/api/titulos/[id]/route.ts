import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseServer.from('titulos').select('*').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ ...data, ...(data.dados || {}) })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { id, aluno, responsavel, descricao, valor, vencimento, pagamento,
      status, metodo, parcela, eventoId, eventoDescricao, centroCustoId, ...rest } = body

    const row = {
      id: params.id,
      aluno: aluno || '', responsavel: responsavel || '',
      descricao: descricao || '', valor: Number(valor) || 0,
      vencimento: vencimento || '', pagamento: pagamento || null,
      status: status || 'pendente', metodo: metodo || null, parcela: parcela || '',
      evento_id: eventoId || null, evento_descricao: eventoDescricao || null,
      centro_custo_id: centroCustoId || null, dados: rest,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabaseServer.from('titulos').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await supabaseServer.from('titulos').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
