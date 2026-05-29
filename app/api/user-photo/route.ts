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
    
    // 1. Try to fetch from auth.admin (only if valid UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    if (isUuid) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
      if (!error && data?.user) {
        const foto = data.user.user_metadata?.foto || data.user.user_metadata?.fotoUrl
        if (foto) return NextResponse.json({ foto })
      }
    }

    // 2. Check system_users
    const { data: sysUser } = await supabaseAdmin
      .from('system_users')
      .select('dados')
      .or(isUuid ? `id.eq."${id}",auth_id.eq."${id}"` : `id.eq."${id}"`)
      .maybeSingle()
    
    if (sysUser?.dados) {
      const foto = (sysUser.dados as any).foto || (sysUser.dados as any).fotoUrl
      if (foto) return NextResponse.json({ foto })
    }

    // 3. Check alunos
    const { data: aluno } = await supabaseAdmin
      .from('alunos')
      .select('foto, foto_url, dados')
      .eq('id', id)
      .maybeSingle()

    if (aluno) {
      const foto = aluno.foto_url || aluno.foto || (aluno.dados as any)?.foto || (aluno.dados as any)?.fotoUrl
      if (foto) return NextResponse.json({ foto })
    }

    // 4. Check responsaveis
    const { data: resp } = await supabaseAdmin
      .from('responsaveis')
      .select('dados')
      .eq('id', id)
      .maybeSingle()

    if (resp?.dados) {
      const foto = (resp.dados as any).foto || (resp.dados as any).fotoUrl
      if (foto) return NextResponse.json({ foto })
    }

    return NextResponse.json({ foto: null }, { status: 404 })
  } catch (err) {
    console.error('Error fetching user photo:', err);
    return NextResponse.json({ foto: null }, { status: 500 })
  }
}
