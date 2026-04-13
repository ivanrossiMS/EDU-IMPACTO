import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { APIListQuerySchema, ZodMovimentacao } from '@/lib/server/zodSchemas'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const search = searchParams.get('search')
    const caixaId = searchParams.get('caixaId')

    const qParams = {
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: search || undefined
    }
    const { page, limit, search: parsedSearch } = APIListQuerySchema.parse(qParams)
    const supabase = await createProtectedClient()

    let query = supabase.from('movimentacoes').select('*', { count: 'exact' }).order('data', { ascending: false }).order('created_at', { ascending: false })

    if (tipo && tipo !== 'todos') query = query.eq('tipo', tipo)
    if (caixaId) query = query.or(`dados->>caixaId.eq.${caixaId},dados->>caixa_id.eq.${caixaId},caixa_id.eq.${caixaId}`)
    if (parsedSearch) query = query.or(`descricao.ilike.%${parsedSearch}%,dados->>operador.ilike.%${parsedSearch}%`)

    // Range Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, count, error } = await query
    if (error) throw new Error(error.message)

    const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
    
    return NextResponse.json({
        data: result,
        meta: { total: count || 0, page, limit }
    }, { 
        headers: { 'Cache-Control': 'no-store, max-age=0' } 
    })

  } catch (err: any) {
    let errorMsg = err.message
    if (err.errors && Array.isArray(err.errors)) {
      errorMsg = err.errors.map((x: any) => `${x.path?.join('.') || 'Campo'}: ${x.message}`).join(' | ')
    }
    return NextResponse.json({ error: errorMsg }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })

      const rows = body.map(m => buildRowAuth(m))
      const validRows = rows.map(r => ZodMovimentacao.parse(r))
      const dbRows = validRows.map(r => toDbRow(r))

      const incomingIds = dbRows.map(r => r.id)

      // Upsert
      const { error: upsertErr } = await supabase.from('movimentacoes').upsert(dbRows)
      if (upsertErr) throw new Error(upsertErr.message)

      // Lógica de Sincronismo Lote Automático
      const { data: existingRows } = await supabase
        .from('movimentacoes')
        .select('id, dados')
        .in('dados->>origem', ['baixa_aluno', 'baixa_pagar', 'baixa_receber'])

      const toDelete = (existingRows || [])
        .map(r => r.id)
        .filter(id => !incomingIds.includes(String(id)))

      if (toDelete.length > 0) {
        await supabase.from('movimentacoes').delete().in('id', toDelete)
      }

      return NextResponse.json({ ok: true, count: validRows.length, deleted: toDelete.length })
    }

    // POST Único Seguro
    const rawRow = buildRowAuth(body)
    const validRow = ZodMovimentacao.parse(rawRow)
    const dbRow = toDbRow(validRow)

    const { data, error } = await supabase.from('movimentacoes').upsert(dbRow).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    let errorMsg = e.message
    if (e.errors && Array.isArray(e.errors)) {
      errorMsg = e.errors.map((x: any) => `${x.path?.join('.') || 'Campo'}: ${x.message}`).join(' | ')
    }
    return NextResponse.json({ error: errorMsg }, { status: 400 })
  }
}

/**
 * PATCH
 * Purge retroativo de Estornos Revertidos na Database
 */
export async function PATCH(request: Request) {
  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ ok: true, deleted: 0 })

    const supabase = await createProtectedClient()
    const { error } = await supabase.from('movimentacoes').delete().in('id', ids)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, deleted: ids.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        let id = searchParams.get('id')
        
        if (!id) {
          const body = await request.json().catch(() => ({}))
          id = body.id || (typeof body === 'string' ? body : null)
        }

        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

        const supabase = await createProtectedClient()
        const { error } = await supabase.from('movimentacoes').delete().eq('id', id)
        if (error) throw new Error(error.message)

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 })
    }
}

function buildRowAuth(m: any) {
  const { id, caixaId, tipo, descricao, valor, data, hora, operador, planoContasId, compensadoBanco, dados, ...rest } = m
  return {
    id: id || crypto.randomUUID(),
    caixa_id: caixaId || m.caixa_id,
    tipo: tipo || 'entrada', 
    descricao: descricao || '',
    valor: Number(valor) || 0, 
    data: data || new Date().toISOString().split('T')[0],
    hora: hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    operador: operador || 'Sistema',
    plano_contas_id: planoContasId || m.plano_contas_id || null,
    compensado_banco: compensadoBanco || m.compensado_banco || 'Não se Aplica',
    dados: { ...(dados || {}), ...rest },
  }
}

function toDbRow(parsed: any) {
  // Extract columns that ACTUALLY exist in Postgres from the Zod parsed object
  const {
    id, tipo, descricao, valor, data, plano_contas_id, dados,
    ...rest // rest includes everything else like caixa_id, hora, operador, etc.
  } = parsed

  return {
    id, tipo, descricao, valor, data, plano_contas_id,
    dados: { ...(dados || {}), ...rest }
  }
}
