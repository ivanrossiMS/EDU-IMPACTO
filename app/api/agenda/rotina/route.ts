import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const { data, error } = await supabase.from('rotina_items').select('*')
    if (error) throw new Error(error.message)
    const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
    return NextResponse.json(result, {
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
      const rows = body.map(buildRowAuth)
      const { error } = await supabase.from('rotina_items').upsert(rows)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('rotina_items').upsert(row).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  const { id, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    dados: rest,
  }
}
