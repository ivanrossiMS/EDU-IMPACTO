import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/titulos — lista todos os títulos
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const aluno = searchParams.get('aluno')

  let query = supabaseServer.from('titulos').select('*').order('vencimento')
  if (status && status !== 'todos') query = query.eq('status', status)
  if (aluno) query = query.eq('aluno', aluno)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
  return NextResponse.json(result)
}

// POST /api/titulos — recebe array completo (bulk upsert) ou objeto único
export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      // Bulk upsert — substitui todos os títulos
      if (body.length === 0) {
        // Não trunca tudo automaticamente — retorna OK sem alterar
        return NextResponse.json({ ok: true, count: 0 })
      }
      const rows = body.map(t => buildRow(t))
      const { error } = await supabaseServer.from('titulos').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }

    // Single upsert
    const row = buildRow(body)
    const { data, error } = await supabaseServer
      .from('titulos').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRow(t: any) {
  const { id, aluno, responsavel, descricao, valor, vencimento, pagamento,
    status, metodo, parcela, eventoId, eventoDescricao, centroCustoId, ...rest } = t
  return {
    id: id || `TIT-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    aluno: aluno || '',
    responsavel: responsavel || '',
    descricao: descricao || '',
    valor: Number(valor) || 0,
    vencimento: vencimento || '',
    pagamento: pagamento || null,
    status: status || 'pendente',
    metodo: metodo || null,
    parcela: parcela || '',
    evento_id: eventoId || null,
    evento_descricao: eventoDescricao || null,
    centro_custo_id: centroCustoId || null,
    dados: rest,
    updated_at: new Date().toISOString(),
  }
}
