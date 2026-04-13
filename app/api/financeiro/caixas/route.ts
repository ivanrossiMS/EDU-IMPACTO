import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { APIListQuerySchema, ZodCaixa } from '@/lib/server/zodSchemas'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'aberto' ou 'fechado' ou 'todos'

    const qParams = {
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: searchParams.get('search') || undefined
    }
    const { page, limit, search } = APIListQuerySchema.parse(qParams)
    const supabase = await createProtectedClient()

    let query = supabase.from('caixas').select('*', { count: 'exact' })

    if (status === 'aberto') query = query.eq('fechado', false)
    if (status === 'fechado') query = query.eq('fechado', true)

    const { data, count, error } = await query
    if (error) throw new Error(error.message)

    let result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
    
    // Filtro e Ordenação em Memória (pois as colunas estão no JSONB)
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(c => 
        (c.codigo && c.codigo.toLowerCase().includes(s)) ||
        (c.nome_caixa && c.nome_caixa.toLowerCase().includes(s)) ||
        (c.operador && c.operador.toLowerCase().includes(s))
      )
    }

    result.sort((a, b) => {
      const dateA = new Date(`${a.data_abertura || '0000-00-00'}T${a.hora_abertura || '00:00'}`).getTime()
      const dateB = new Date(`${b.data_abertura || '0000-00-00'}T${b.hora_abertura || '00:00'}`).getTime()
      return dateB - dateA
    })

    // Range Pagination em memória após filtro
    const from = (page - 1) * limit
    const paginatedResult = result.slice(from, from + limit)
    
    return NextResponse.json({
        data: paginatedResult,
        meta: { total: search ? result.length : (count || 0), page, limit }
    }, { 
        headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59' } 
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
      const validRows = rows.map(r => ZodCaixa.parse(r))
      const dbRows = validRows.map(r => toDbRow(r))

      const { error: upsertErr } = await supabase.from('caixas').upsert(dbRows)
      if (upsertErr) throw new Error(upsertErr.message)

      return NextResponse.json({ ok: true, count: validRows.length })
    }

    const rawRow = buildRowAuth(body)
    const validRow = ZodCaixa.parse(rawRow)
    const dbRow = toDbRow(validRow)

    const { data, error } = await supabase.from('caixas').upsert(dbRow).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    let errorMsg = e?.message || 'Erro desconhecido';
    if (e?.errors && Array.isArray(e.errors)) {
      try {
        errorMsg = e.errors.map((x: any) => `${x.path?.join('.') || 'Campo'}: ${x.message}`).join(' | ');
      } catch (mapErr) {
        // Fallback para evitar falhas durante o stringify do ZodError
      }
    }
    return NextResponse.json({ error: String(errorMsg) }, { status: 400 })
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
        const { error } = await supabase.from('caixas').delete().eq('id', id)
        if (error) throw new Error(error.message)

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 })
    }
}

function buildRowAuth(c: any) {
  const { id, codigo, nomeCaixa, dataAbertura, horaAbertura, operador, unidade, saldoInicial, saldoFinal, baixaOutroUsuario, fechado, horaFechamento, dados, ...rest } = c
  return {
    id: id || crypto.randomUUID(),
    codigo: codigo || `CX-${Date.now().toString().slice(-4)}`,
    nome_caixa: nomeCaixa || c.nome_caixa || 'Caixa Local',
    data_abertura: dataAbertura || c.data_abertura || new Date().toISOString().split('T')[0],
    hora_abertura: horaAbertura || c.hora_abertura || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    operador: operador || 'Sistema',
    unidade: unidade || null,
    saldo_inicial: Number(saldoInicial || c.saldo_inicial) || 0,
    saldo_final: saldoFinal || c.saldo_final || null,
    baixa_outro_usuario: baixaOutroUsuario ?? c.baixa_outro_usuario ?? false,
    fechado: fechado ?? c.fechado ?? false,
    hora_fechamento: horaFechamento || c.hora_fechamento || null,
    dados: { ...(dados || {}), ...rest },
  }
}

function toDbRow(parsed: any) {
  const { id, fechado, dados, ...rest } = parsed
  return {
    id,
    fechado: fechado ?? false,
    dados: { ...rest, ...(dados || {}) }
  }
}
