import { NextResponse } from 'next/server'
import {
  requireStaff,
  resolveUserRole,
  getAuthorizedResponsavelIdsForUser,
} from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  try {
    const supabase = await createProtectedClient()
    const { data, error } = await supabase.from('saida_guardians').select('id, dados').limit(500)
    if (error) throw new Error(error.message)
    let result = (data || []).map(row => ({ id: row.id, ...(row.dados || {}) }))
    if (!isStaff) {
      const allowedRespIds = await getAuthorizedResponsavelIdsForUser(user)
      result = result.filter((g: any) => allowedRespIds.has(String(g.id)))
    }
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse || !user) return errorResponse!

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(buildRow)
      const { error } = await supabase.from('saida_guardians').upsert(rows)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)
    const { data, error } = await supabase.from('saida_guardians').upsert(row).select().single()
    if (error) throw new Error(error.message)

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
