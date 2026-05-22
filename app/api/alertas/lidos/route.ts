import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createProtectedClient()
    
    const { data, error } = await supabase
      .from('alertas_lidos')
      .select('alerta_id')
      
    if (error) throw new Error(error.message)
    
    const result = (data || []).map(row => row.alerta_id)
    
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=5' }
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
      const rows = body.map(id => ({ alerta_id: id }))
      
      // Substitui toda a lista de lidos
      const { error: delError } = await supabase
        .from('alertas_lidos')
        .delete()
        .not('id', 'is', null)
        
      if (delError) console.error('Error deleting all alerts:', delError)

      if (rows.length > 0) {
        const { error } = await supabase.from('alertas_lidos').insert(rows)
        if (error) throw new Error(error.message)
      }
      
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const { alerta_id } = body
    if (!alerta_id) throw new Error('alerta_id é obrigatório')

    const { data, error } = await supabase
      .from('alertas_lidos')
      .insert([{ alerta_id }])
      .select()
      .single()
      
    if (error) throw new Error(error.message)

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
