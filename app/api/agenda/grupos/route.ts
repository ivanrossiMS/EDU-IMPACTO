import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createProtectedClient()
    
    const { data, error } = await supabase
      .from('agenda_grupos')
      .select('*')
      
    if (error) throw new Error(error.message)
    
    const result = (data || []).map(row => ({ id: row.id, ...(row.dados || {}) }))
    
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
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
      const rows = body.map(buildRow)
      
      const incomingIds = rows.map(r => r.id).filter(Boolean)
      
      if (incomingIds.length > 0) {
        const { error: delError } = await supabase
          .from('agenda_grupos')
          .delete()
          .not('id', 'in', `(${incomingIds.join(',')})`)
          
        if (delError) console.error('Error deleting stale records:', delError)
      } else {
        const { error: delError } = await supabase
          .from('agenda_grupos')
          .delete()
          .not('id', 'is', null)
          
        if (delError) console.error('Error deleting all records:', delError)
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('agenda_grupos').upsert(rows)
        if (error) throw new Error(error.message)
      }
      
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)
    const { data, error } = await supabase.from('agenda_grupos').upsert(row).select().single()
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
