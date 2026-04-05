import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')

  let query = supabaseServer.from('contas_pagar').select('*').order('vencimento')
  if (status && status !== 'Todos') query = query.eq('status', status)
  if (q) query = query.or(`descricao.ilike.%${q}%,fornecedor.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data || []).map(row => ({
    ...row,
    ...(row.dados || {}),
    numeroDocumento: row.numero_documento,
    planoContasId: row.plano_contas_id,
  }))
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, codigo, descricao, categoria, valor, vencimento, status, fornecedor, numeroDocumento, planoContasId, ...rest } = body

    const row = {
      id: id || `CP${Date.now()}`,
      codigo: codigo || '',
      descricao: descricao || '',
      categoria: categoria || '',
      valor: valor || 0,
      vencimento: vencimento || '',
      status: status || 'pendente',
      fornecedor: fornecedor || '',
      numero_documento: numeroDocumento || '',
      plano_contas_id: planoContasId || '',
      dados: rest,
    }

    const { data, error } = await supabaseServer.from('contas_pagar').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  // Bulk update or single update via query param ?id=
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  try {
    const body = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { descricao, categoria, valor, vencimento, status, fornecedor, numeroDocumento, planoContasId, ...rest } = body
    const row = {
      descricao: descricao || '', categoria: categoria || '',
      valor: valor || 0, vencimento: vencimento || '',
      status: status || 'pendente', fornecedor: fornecedor || '',
      numero_documento: numeroDocumento || '', plano_contas_id: planoContasId || '',
      dados: rest, updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseServer.from('contas_pagar').update(row).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
