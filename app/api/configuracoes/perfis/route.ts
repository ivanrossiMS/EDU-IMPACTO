import { NextResponse } from 'next/server'
import { requireAuth, requireStaff, requireAdminOrDirecao, clearAuthGuardCache } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { clearPerfilAcessoCache } from '@/lib/server/perfilAcessoCache'

export const dynamic = 'force-dynamic'

let perfisMemoryCache: any[] | null = null
let perfisCacheTime = 0
let perfisInflight: Promise<any[]> | null = null

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    if (perfisMemoryCache && (Date.now() - perfisCacheTime < 60_000)) {
      return NextResponse.json(perfisMemoryCache, {
        headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300' }
      })
    }

    if (!perfisInflight) {
      perfisInflight = (async () => {
        const supabase = await createProtectedClient()
        const { data, error } = await supabase.from('perfis').select('*')
        if (error) throw new Error(error.message)
        const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
        perfisMemoryCache = result
        perfisCacheTime = Date.now()
        return result
      })().finally(() => {
        perfisInflight = null
      })
    }

    const result = await perfisInflight
    return NextResponse.json(result, {
      // PERFORMANCE: Perfis mudam raramente — cache de 60s com revalidação silenciosa de 5min.
      // A autenticação (requireAuth) é verificada em cada request independentemente do cache.
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse
  const { errorResponse: adminErr } = await requireAdminOrDirecao(request)
  if (adminErr) return adminErr

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json({ error: 'Operação bloqueada: não é permitido apagar todos os perfis de acesso.' }, { status: 400 })
      }
      const rows = body.map(buildRowAuth)
      const incomingIds = new Set(rows.map(r => String(r.id)))
      const { data: existingRows } = await supabase.from('perfis').select('id')
      const toDelete = (existingRows || [])
        .map((r: any) => String(r.id))
        .filter((id: string) => !incomingIds.has(id))
      if (toDelete.length > 0) {
        await supabase.from('perfis').delete().in('id', toDelete)
      }
      const { error } = await supabase.from('perfis').upsert(rows)
      if (error) throw new Error(error.message)
      perfisMemoryCache = null
      perfisCacheTime = 0
      clearPerfilAcessoCache()
      clearAuthGuardCache()
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('perfis').upsert(row).select().single()
    if (error) throw new Error(error.message)

    perfisMemoryCache = null
    perfisCacheTime = 0
    clearPerfilAcessoCache()
    clearAuthGuardCache()

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
