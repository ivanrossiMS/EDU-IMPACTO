import { NextResponse } from 'next/server'
import { requireAuth, requireStaff } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    
    const { data, error } = await supabase
      .from('adm_pedidos_livros_manuais')
      .select('*')
      
    if (error) throw new Error(error.message)
    
    const result = (data || []).map(row => ({ id: row.id, ...(row.dados || {}) }))
    
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=5' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    let usuarioNome = 'Sistema'
    if (user) {
      usuarioNome = (user as any).nome || user.user_metadata?.nome || user.user_metadata?.name || user.email || 'Sistema'
    }

    const processItem = (item: any) => {
      const updated = {
        ...item,
        dataLancamento: item.dataLancamento || new Date().toISOString(),
        usuarioLancamento: item.usuarioLancamento || usuarioNome,
      }
      return buildRow(updated)
    }

    if (Array.isArray(body)) {
      const rows = body.map(processItem)
      const incomingIdSet = new Set(rows.map(r => r.id).filter(Boolean))
      const { data: existingRows } = await supabase.from('adm_pedidos_livros_manuais').select('id')
      const toDelete = (existingRows || []).map((r: any) => r.id).filter((id: string) => id && !incomingIdSet.has(id))

      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from('adm_pedidos_livros_manuais')
          .delete()
          .in('id', toDelete)
        if (delError) console.error('Error deleting stale records:', delError)
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('adm_pedidos_livros_manuais').upsert(rows)
        if (error) throw new Error(error.message)
      }
      
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = processItem(body)
    const { data, error } = await supabase.from('adm_pedidos_livros_manuais').upsert(row).select().single()
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
