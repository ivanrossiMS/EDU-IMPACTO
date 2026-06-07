import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
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
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    const { data: { user } } = await supabase.auth.getUser()
    let usuarioNome = 'Sistema'
    if (user) {
      usuarioNome = user.user_metadata?.nome || user.user_metadata?.name || user.email || 'Sistema'
      const { data: dbUser } = await supabase
        .from('system_users')
        .select('nome')
        .eq('id', user.id)
        .maybeSingle()
      if (dbUser?.nome) usuarioNome = dbUser.nome
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
      
      // Smart sync: Delete records not in the incoming array
      const incomingIds = rows.map(r => r.id).filter(Boolean)
      
      if (incomingIds.length > 0) {
        // Delete records not in incomingIds
        const { error: delError } = await supabase
          .from('adm_pedidos_livros_manuais')
          .delete()
          .not('id', 'in', `(${incomingIds.join(',')})`)
          
        if (delError) console.error('Error deleting stale records:', delError)
      } else {
        // If incoming is empty, delete all
        const { error: delError } = await supabase
          .from('adm_pedidos_livros_manuais')
          .delete()
          .not('id', 'is', null)
          
        if (delError) console.error('Error deleting all records:', delError)
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
