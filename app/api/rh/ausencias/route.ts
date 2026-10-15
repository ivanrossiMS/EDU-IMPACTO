import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const { data, error } = await supabase.from('ausencias').select('*')
    if (error) throw new Error(error.message)
    
    // Extract everything from jsonb 'dados' to keep interface flat
    const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
    
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=59' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      const { data: existing } = await supabase.from('ausencias').select('id')
      const existingIds = (existing || []).map((r: any) => r.id)
      if (body.length === 0) {
        if (existingIds.length > 0) {
          await supabase.from('ausencias').delete().in('id', existingIds)
        }
        return NextResponse.json({ ok: true, count: 0 })
      }
      const rows = body.map(buildRowAuth)
      const incomingIds = new Set(rows.map((r: any) => r.id))
      const toDelete = existingIds.filter((id: string) => !incomingIds.has(id))
      if (toDelete.length > 0) {
        await supabase.from('ausencias').delete().in('id', toDelete)
      }
      const { error } = await supabase.from('ausencias').upsert(rows)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('ausencias').upsert(row).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  const { id, funcionario_id, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    funcionario_id: funcionario_id || body.funcionarioId || '',
    dados: rest,
  }
}
