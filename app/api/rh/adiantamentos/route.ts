import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const { data, error } = await supabase.from('adiantamentos').select('*')
    if (error) throw new Error(error.message)
    
    const result = (data || []).map(({ dados, ...row }) => ({ ...row, ...(dados || {}) }))
    
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      // 1. Fetch current IDs
      const { data: current } = await supabase.from('adiantamentos').select('id')
      const currentIds = (current || []).map(r => r.id)
      const incomingIds = body.map(r => r.id).filter(Boolean)
      
      // 2. Identify deletions
      const toDelete = currentIds.filter(id => !incomingIds.includes(id))
      if (toDelete.length > 0) {
        await supabase.from('adiantamentos').delete().in('id', toDelete)
      }

      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      
      const rows = body.map(buildRowAuth)
      const { error } = await supabase.from('adiantamentos').upsert(rows)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('adiantamentos').upsert(row).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  const { id, funcionario_id, funcionario_nome, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    funcionario_id: funcionario_id || body.funcionarioId || '',
    funcionario_nome: funcionario_nome || body.funcionarioNome || body.funcionario || '',
    dados: rest,
  }
}
