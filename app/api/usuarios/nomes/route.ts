import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ data: {} })
    }

    // Usar supabaseAdmin para ignorar RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('system_users')
      .select('id, nome')
      .in('id', ids)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const map: Record<string, string> = {}
    data?.forEach((u: any) => {
      map[u.id] = u.nome
    })

    return NextResponse.json({ data: map })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
