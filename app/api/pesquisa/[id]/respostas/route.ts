import { NextResponse } from 'next/server'
import { getAuthenticatedUser, createAdminClient } from '@/lib/server/supabaseServerFactory'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: pesquisa_id } = await params
    const body = await req.json()
    const { email, password, respostas_json } = body

    // 1. Tenta obter o usuário da sessão atual
    let userId: string | null = null
    let userName: string = 'Desconhecido'
    let userRole: string = 'Colaborador'
    let userEmail: string = ''

    const sessionUser = await getAuthenticatedUser()

    const adminClient = createAdminClient()

    if (sessionUser) {
      userId = sessionUser.id
      userEmail = sessionUser.email!
      
      const { data: profile } = await adminClient
        .from('system_users')
        .select('nome, cargo')
        .eq('id', userId)
        .single()
        
      userName = profile?.nome || sessionUser.user_metadata?.nome || userEmail
      userRole = profile?.cargo || 'Colaborador'
    } else {
      // 2. Se não há sessão, valida credenciais enviadas
      if (!email || !password) {
        return NextResponse.json({ error: 'Você precisa inserir seu e-mail e senha para assinar a pesquisa.' }, { status: 401 })
      }

      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email,
        password,
      })

      if (authError || !authData.user) {
        return NextResponse.json({ error: 'Credenciais incorretas. Assinatura inválida.' }, { status: 401 })
      }

      userId = authData.user.id
      userEmail = authData.user.email!

      const { data: profile } = await adminClient
        .from('system_users')
        .select('nome, cargo')
        .eq('id', userId)
        .single()
        
      userName = profile?.nome || authData.user.user_metadata?.nome || userEmail
      userRole = profile?.cargo || 'Colaborador'
    }

    if (!userId) {
      return NextResponse.json({ error: 'Não foi possível validar sua identidade.' }, { status: 401 })
    }

    // IP Address extraction for signature metadata
    let ip = req.headers.get('x-forwarded-for') || req.headers.get('remote-addr') || '0.0.0.0'
    ip = ip.split(',')[0].trim()

    // Insert answer using admin client since public user might not have insert rights via RLS initially
    const { data, error } = await adminClient
      .from('gp_pesquisa_respostas')
      .insert([{
        pesquisa_id,
        usuario_id: userId,
        usuario_nome: userName,
        usuario_cargo: userRole,
        respostas_json,
        ip_assinatura: ip
      }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Você já respondeu a esta pesquisa.' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Submit error:', error)
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 })
  }
}
