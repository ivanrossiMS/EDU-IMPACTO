import { NextResponse } from 'next/server'
import { resolveUserRole, requireStaff, getAuthorizedAlunoIdsForUser, getAuthorizedResponsavelIdsForUser } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sanitizeAutorizacaoForViewer } from '@/lib/autorizacoes/autorizacaoUtils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 1000) : 300
    const supabase = await createProtectedClient()
    const { data, error } = await supabase
      .from('autorizacoes')
      .select('id, dados, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)

    let allowedIds = new Set<string>()
    if (!isStaff) {
      const [alunoIds, respIds] = await Promise.all([
        getAuthorizedAlunoIdsForUser(user),
        getAuthorizedResponsavelIdsForUser(user)
      ])
      allowedIds = new Set<string>([
        String(user.id),
        ...Array.from(alunoIds),
        ...Array.from(respIds)
      ])
    }

    const result = (data || []).map(row => {
      const rawDados = row.dados || {}
      const sanitized = isStaff ? rawDados : (sanitizeAutorizacaoForViewer(rawDados, allowedIds) || rawDados)
      return { ...row, ...sanitized, dados: sanitized }
    })
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
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
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(buildRowAuth)
      const { error } = await supabase.from('autorizacoes').upsert(rows)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('autorizacoes').upsert(row).select().single()
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

