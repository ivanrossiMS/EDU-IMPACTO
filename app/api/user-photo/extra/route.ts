import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const protectedClient = await createProtectedClient()
    const { data: sessionData } = await protectedClient.auth.getSession()
    if (!sessionData?.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, bio, telefone, unidade } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
    }

    const loggedUser = sessionData.session.user
    if (loggedUser.id !== userId) {
      return NextResponse.json({ error: 'Proibido atualizar dados de outro usuário' }, { status: 403 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: current } = await supabaseAdmin
      .from('system_users')
      .select('dados')
      .eq('id', userId)
      .single()

    const newDados = { 
      ...(current?.dados || {}), 
      bio, 
      telefone, 
      unidade 
    }

    const { error: dbErr } = await supabaseAdmin
      .from('system_users')
      .update({ dados: newDados })
      .eq('id', userId)

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[API user-photo/extra POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
