import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const entidade_id = searchParams.get('entidade_id')

  try {
    const supabase = await createProtectedClient()
    
    let query = supabase
      .from('gp_assinaturas')
      .select('*, system_users!gp_assinaturas_user_id_fkey(nome, cargo)')
      .order('created_at', { ascending: false })

    if (entidade_id) {
      query = query.eq('entidade_id', entidade_id)
    }

    const { data, error } = await query
    
    // Fallback manual join se o fkey falhar por falta de config no Supabase
    if (error && error.code === 'PGRST200') {
      // Fetch without join
      const { data: rawData, error: rawError } = await supabase
        .from('gp_assinaturas')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (entidade_id) {
        // filter is manual or via query
      }
    }
    
    // To make it simple and bulletproof, fetch users manually if join fails
    const { data: assinaturas, error: assinaturasError } = await supabase
      .from('gp_assinaturas')
      .select('*')
      .eq('entidade_id', entidade_id || '')
      .order('created_at', { ascending: false })
      
    if (assinaturasError) throw assinaturasError
    
    // Fetch user details from Supabase Auth directly to ensure accuracy
    const userIds = [...new Set(assinaturas?.map(a => a.user_id) || [])]
    const supabaseAdmin = getAdminClient()
    const usersMap: any = {}
    
    await Promise.all(userIds.map(async (uid) => {
      try {
        const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(uid)
        if (userAuth?.user) {
          usersMap[uid] = {
             nome: userAuth.user.user_metadata?.nome || userAuth.user.email?.split('@')[0] || 'Usuário Desconhecido',
             cargo: userAuth.user.user_metadata?.cargo || 'Colaborador',
             email: userAuth.user.email || ''
          }
        }
      } catch (err) {
        console.error('Error fetching user', uid, err)
      }
    }))
    
    const enrichedData = assinaturas?.map(a => ({
      ...a,
      user_nome: usersMap[a.user_id]?.nome || 'Usuário Desconhecido',
      user_cargo: usersMap[a.user_id]?.cargo || 'Membro',
      user_email: usersMap[a.user_id]?.email || ''
    }))

    return NextResponse.json(enrichedData || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { senha, entidade_id, entidade_tipo } = body

    if (!senha || !entidade_id || !entidade_tipo) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // 1. Validar a senha autenticando com o supabase anon client
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: user?.email || '',
      password: senha
    })

    if (signInError) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }

    // 2. Registrar assinatura
    const supabase = await createProtectedClient()
    const id = crypto.randomUUID()
    const hash = crypto.createHash('sha256').update(`${id}-${user?.id}-${Date.now()}`).digest('hex')
    
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'IP desconhecido'
    const userAgent = request.headers.get('user-agent') || 'Agent desconhecido'

    const { error } = await supabase
      .from('gp_assinaturas')
      .insert({
        id,
        user_id: user?.id,
        entidade_tipo,
        entidade_id,
        hash_assinatura: hash,
        ip_address: ip,
        user_agent: userAgent
      })

    if (error) throw error
    return NextResponse.json({ success: true, id, hash })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // Verifica se o usuário é administrador ou diretor
  const meta = user?.user_metadata || {};
  const isUserAdmin = meta.perfil?.toLowerCase()?.includes('admin') || 
                      meta.cargo?.toLowerCase()?.includes('admin') || 
                      meta.cargo?.toLowerCase()?.includes('diret') || 
                      meta.perfil === 'direcao';

  if (!isUserAdmin) {
    return NextResponse.json({ error: 'Não autorizado. Apenas administradores podem excluir assinaturas.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const entidade_id = searchParams.get('entidade_id')

  try {
    const supabase = await createProtectedClient()
    
    if (id) {
      const { error } = await supabase
        .from('gp_assinaturas')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Assinatura excluída com sucesso.' })
    } else if (entidade_id) {
      const { error } = await supabase
        .from('gp_assinaturas')
        .delete()
        .eq('entidade_id', entidade_id)
      
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Todas as assinaturas do documento foram excluídas.' })
    } else {
      return NextResponse.json({ error: 'Parâmetro inválido' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
