import { NextResponse } from 'next/server'
import { requireAuth, requireStaff } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getCachedEquipes, invalidateEquipesCache } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const data = await getCachedEquipes()
    const result = (data || []).map((row: any) => ({ id: row.id, ...(row.dados || {}) }))
    
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' }
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
      if (body.length === 0) {
        return NextResponse.json({ ok: true, count: 0 })
      }
      const rows = body.map(buildRow)
      
      const incomingIds = rows.map(r => r.id).filter(Boolean)
      
      if (incomingIds.length > 0) {
        const { error: delError } = await supabase
          .from('agenda_equipes')
          .delete()
          .not('id', 'in', `(${incomingIds.join(',')})`)
          
        if (delError) console.error('Error deleting stale records:', delError)
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('agenda_equipes').upsert(rows)
        if (error) throw new Error(error.message)
      }
      
      invalidateEquipesCache()
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)
    const { data, error } = await supabase.from('agenda_equipes').upsert(row).select().single()
    if (error) throw new Error(error.message)

    invalidateEquipesCache()
    return NextResponse.json({ id: data.id, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRow(body: any) {
  const { id, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    dados: rest,
  }
}
