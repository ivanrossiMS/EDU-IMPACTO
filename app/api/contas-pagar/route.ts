import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabaseServer.from('contas_pagar').select('*').order('vencimento')
  if (status && status !== 'todos') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(c => buildRow(c))
      const { error } = await supabaseServer.from('contas_pagar').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)
    const { data, error } = await supabaseServer
      .from('contas_pagar').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRow(c: any) {
  const { id, descricao, categoria, valor, vencimento, status,
    fornecedor, numeroDocumento, planoContasId, centroCustoId, codigo, usaRateio, ...rest } = c
  return {
    id: id || `CP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    descricao: descricao || '', categoria: categoria || '',
    valor: Number(valor) || 0, vencimento: vencimento || '',
    status: status || 'pendente', fornecedor: fornecedor || '',
    numero_documento: numeroDocumento || null,
    plano_contas_id: planoContasId || null,
    centro_custo_id: centroCustoId || null,
    codigo: codigo || null, usa_rateio: usaRateio || false,
    dados: rest, updated_at: new Date().toISOString(),
  }
}
