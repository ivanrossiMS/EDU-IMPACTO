import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export async function POST(request: Request) {
  const { errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ data: {} })
    }

    const supabaseAdmin = getAdminClient()

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
