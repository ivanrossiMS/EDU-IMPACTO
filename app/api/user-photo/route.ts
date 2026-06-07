import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // First, verify the user is logged in using the protected client (local JWT check for performance)
    const protectedClient = await createProtectedClient()
    const { data: sessionData, error: sessionError } = await protectedClient.auth.getSession()
    
    if (sessionError || !sessionData?.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ foto: null }, { status: 400 })
    }

    // Now, we MUST use the Service Role Key to fetch data from auth.admin
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
    
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
    
    if (error || !data?.user) {
      return NextResponse.json({ foto: null }, { status: 404 })
    }

    const foto = data.user.user_metadata?.foto || data.user.user_metadata?.fotoUrl || null
    return NextResponse.json({ foto })
  } catch (err) {
    return NextResponse.json({ foto: null }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const protectedClient = await createProtectedClient()
    const { data: sessionData } = await protectedClient.auth.getSession()
    if (!sessionData?.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, fotoUrl } = await request.json()
    if (!userId || !fotoUrl) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios: userId, fotoUrl' }, { status: 400 })
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

    // 1. Atualizar Auth Metadata
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { foto: fotoUrl }
    })
    if (authErr) console.warn('[API user-photo POST] Auth update warning:', authErr.message)

    // 2. Atualizar tabela system_users
    const { error: dbErr } = await supabaseAdmin
      .from('system_users')
      .update({ foto: fotoUrl })
      .eq('id', userId)
    
    if (dbErr) {
      const { data: current } = await supabaseAdmin
        .from('system_users')
        .select('dados')
        .eq('id', userId)
        .single()
      
      const newDados = { ...(current?.dados || {}), foto: fotoUrl }
      
      await supabaseAdmin
        .from('system_users')
        .update({ dados: newDados })
        .eq('id', userId)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[API user-photo POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

