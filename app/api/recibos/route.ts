import { NextRequest, NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

// GET — listar recibos com filtros e paginação server-side
export async function GET(req: NextRequest) {
  try {
    const supabase = await createProtectedClient()
    const { searchParams } = new URL(req.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = (page - 1) * limit

    const status = searchParams.get('status') || null
    const search = searchParams.get('search') || null
    const dateFrom = searchParams.get('date_from') || null
    const dateTo = searchParams.get('date_to') || null
    const baixaId = searchParams.get('baixa_id') || null
    const receiptNumber = searchParams.get('receipt_number') || null
    const token = searchParams.get('token') || null
    const paymentMethod = searchParams.get('payment_method') || null
    const unidade = searchParams.get('unidade') || null

    let query = supabase
      .from('financial_receipts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('receipt_status', status)
    if (baixaId) query = query.eq('baixa_id', baixaId)
    if (receiptNumber) query = query.ilike('receipt_number', `%${receiptNumber}%`)
    if (token) query = query.ilike('validation_token', `%${token}%`)
    if (paymentMethod) query = query.eq('payment_method', paymentMethod)
    if (unidade) query = query.ilike('unidade_nome', `%${unidade}%`)
    if (dateFrom) query = query.gte('payment_date', dateFrom)
    if (dateTo) query = query.lte('payment_date', dateTo)
    if (search) {
      query = query.or(
        `aluno_nome.ilike.%${search}%,responsavel_nome.ilike.%${search}%,receipt_number.ilike.%${search}%,baixa_id.ilike.%${search}%,payer_name.ilike.%${search}%,event_description.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[GET /api/recibos]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
