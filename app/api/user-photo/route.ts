import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export async function GET(request: Request) {
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
