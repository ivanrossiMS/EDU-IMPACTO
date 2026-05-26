import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  try {
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        global: {
          fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
        }
      }
    )
    const { data, error } = await adminSupabase.from('saida_config').select('*')
    if (error) {
      console.error('[saida_config GET] Fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Extract everything from jsonb 'dados' to keep interface flat
    const result = (data || []).map(row => ({ id: row.id, ...(row.dados || {}) }))
    console.log('[saida_config GET] returning:', JSON.stringify(result))
    
    return NextResponse.json(result, {
      headers: { 
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    })
  } catch (err) {
    console.error('[saida_config GET] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = await createProtectedClient()
    
    // Verify auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autorizado')

    // Use service role for upsert to bypass RLS for configuration
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(buildRow)
      const { error } = await adminSupabase.from('saida_config').upsert(rows)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)
    console.log('[saida_config POST] Upserting row:', JSON.stringify(row))
    const { data, error } = await adminSupabase.from('saida_config').upsert(row).select().single()
    if (error) {
      console.error('[saida_config POST] Upsert Error:', error)
      throw new Error(error.message)
    }

    console.log('[saida_config POST] Success data:', JSON.stringify(data))
    return NextResponse.json({ id: data.id, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    console.error('[saida_config POST] Catch Error:', err)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRow(body: any) {
  const { id, ...rest } = body
  return {
    id: id || 'default', // Usually there's only one config, or we keyed it by something
    dados: rest,
  }
}
