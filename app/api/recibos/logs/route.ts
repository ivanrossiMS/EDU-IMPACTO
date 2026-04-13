import { NextRequest, NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createProtectedClient()
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    const origin = searchParams.get('origin') || null
    const status = searchParams.get('status') || null
    const receiptId = searchParams.get('receipt_id') || null

    let query = supabase
      .from('receipt_validation_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (origin) query = query.eq('validation_origin', origin)
    if (status) query = query.eq('result_status', status)
    if (receiptId) query = query.eq('receipt_id', receiptId)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
