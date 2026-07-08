import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // requireAuth já validou o usuário

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ foto: null }, { status: 400 })
    }

    // Now, we MUST use the Service Role Key to fetch data from auth.admin
    const supabaseAdmin = getAdminClient();
    let authFoto = null;
    // Somente faz a busca no auth se o id parecer um UUID, para evitar erro do SDK
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
      if (!error && data?.user) {
        authFoto = data.user.user_metadata?.foto || data.user.user_metadata?.fotoUrl || null
      }
    }
    
    if (authFoto) return NextResponse.json({ foto: authFoto })

    // Se não encontrou no auth (ou não tem foto), busca na tabela alunos (caso seja ID de aluno)
    const { data: alunoData, error: alunoError } = await supabaseAdmin
      .from('alunos')
      .select('foto')
      .eq('id', id)
      .maybeSingle()
      
    if (!alunoError && alunoData?.foto) {
      return NextResponse.json({ foto: alunoData.foto })
    }

    // Retorna 200 com foto: null em vez de 404 para evitar loops de requisição no cliente
    return NextResponse.json({ foto: null })
  } catch (err) {
    return NextResponse.json({ foto: null }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // requireAuth já validou o usuário

    const { userId, fotoUrl } = await request.json()
    if (!userId || !fotoUrl) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios: userId, fotoUrl' }, { status: 400 })
    }

    const loggedUser = user
    if (loggedUser.id !== userId) {
      return NextResponse.json({ error: 'Proibido atualizar dados de outro usuário' }, { status: 403 })
    }

    const supabaseAdmin = getAdminClient();

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

