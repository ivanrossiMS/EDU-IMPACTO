import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { APIListQuerySchema, ZodContaPagar } from '@/lib/server/zodSchemas'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search') // support for text filtering

    // 1. Zod Validation for explicit paginations and limits
    const qParams = {
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: search || undefined
    }
    const { page, limit, search: parsedSearch } = APIListQuerySchema.parse(qParams)

    // 2. Auth Protection Hook
    const supabase = await createProtectedClient()

    let query = supabase.from('contas_pagar').select('*', { count: 'exact' }).order('vencimento')

    if (status && status !== 'todos') query = query.eq('status', status)
    if (parsedSearch) query = query.or(`descricao.ilike.%${parsedSearch}%,fornecedor.ilike.%${parsedSearch}%`)

    // 3. Database Range Pagination (.range)
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) throw new Error(error.message)

    // Unpack inner custom JSONB fields if needed for UI mapping
    const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
    
    return NextResponse.json({
        data: result,
        meta: { total: count || 0, page, limit }
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      
      const rows = body.map(c => buildRowAuth(c))
      const validRows = rows.map(r => ZodContaPagar.parse(r))

      const { error } = await supabase.from('contas_pagar').upsert(validRows)
      if (error) throw new Error(error.message)
      
      return NextResponse.json({ ok: true, count: validRows.length })
    }

    const rawRow = buildRowAuth(body)
    const row = ZodContaPagar.parse(rawRow)

    const { data, error } = await supabase.from('contas_pagar').upsert(row).select().single()
    if (error) throw new Error(error.message)
    
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.errors || e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
    try {
        let id;
        try { const body = await request.json(); id = body.id; } catch { 
           const { searchParams } = new URL(request.url); id = searchParams.get('id');
        }
        if (!id) return NextResponse.json({ error: 'ID faltando' }, { status: 400 })
        const supabase = await createProtectedClient()
        const { error } = await supabase.from('contas_pagar').delete().eq('id', id)
        if (error) throw new Error(error.message)

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 })
    }
}

function buildRowAuth(c: any) {
  const { id, descricao, categoria, valor, vencimento, status, fornecedor, numeroDocumento, planoContasId, codigo, usaRateio, ...rest } = c
  return {
    id: id || crypto.randomUUID(), // Usando crypto em vez de Date.now para IDs UUID válidos
    descricao: descricao || '', 
    categoria: categoria || '',
    valor: Number(valor) || 0, 
    vencimento: vencimento || '',
    status: status || 'pendente', 
    fornecedor: fornecedor || '',
    numero_documento: numeroDocumento || null,
    plano_contas_id: planoContasId || null,
    codigo: codigo || null, 
    usa_rateio: usaRateio || false,
    dados: rest, 
    updated_at: new Date().toISOString(),
  }
}
