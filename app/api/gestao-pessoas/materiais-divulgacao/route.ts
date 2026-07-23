import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Fallback client for anonymous/system ops
function getSystemClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  )
}

// Get the authenticated client or system client
async function getClient() {
  try {
    return await createProtectedClient()
  } catch (e) {
    return getSystemClient()
  }
}

// Only real materials created in the application
const REAL_DEFAULT_MATERIALS = [
  {
    id: 'mat-guia-seguranca',
    titulo: 'Guia de Segurança Digital para Pais e Responsáveis',
    descricao: 'E-book e guia prático interativo sobre Controle Parental, tempo de tela, redes sociais e segurança no celular para famílias do Colégio Impacto.',
    categoria: 'Guias & E-books',
    link: '/guia-seguranca',
    imagem_url: '/guia-seguranca/family_digital_safety.jpg',
    contador_visitas: 0,
    tags: ['Segurança Digital', 'Controle Parental', 'Família', 'E-book'],
    autor: 'Equipe Pedagógica – Colégio Impacto',
    data_publicacao: '2026-07-22T08:00:00.000Z',
    destaque: true
  }
]

export async function GET() {
  try {
    const supabase = getSystemClient()
    const { data, error } = await supabase
      .from('gp_materiais_divulgacao')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: true, data: REAL_DEFAULT_MATERIALS }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      })
    }

    return NextResponse.json({ success: true, data: data || [] }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    })
  } catch (err: any) {
    return NextResponse.json({ success: true, data: REAL_DEFAULT_MATERIALS }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const systemSupabase = getSystemClient()

    // 1. Increment Visit Action (Public access, no admin auth required)
    if (body.action === 'increment_visit' && body.id) {
      const { data: item } = await systemSupabase
        .from('gp_materiais_divulgacao')
        .select('contador_visitas')
        .eq('id', body.id)
        .single()

      if (item) {
        const newCount = (item.contador_visitas || 0) + 1
        await systemSupabase
          .from('gp_materiais_divulgacao')
          .update({ contador_visitas: newCount })
          .eq('id', body.id)

        return NextResponse.json({ success: true, contador_visitas: newCount })
      } else {
        return NextResponse.json({ success: true, message: 'Material não encontrado no banco (provavelmente deletado)' })
      }
    }

    // 2. Authentication & Authorization Check for Administrative Actions (create, update, delete)
    const authClient = await createProtectedClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
    }

    // Query system_users table for reliable role check
    const { data: dbUser } = await systemSupabase
      .from('system_users')
      .select('cargo, perfil')
      .eq('id', user.id)
      .maybeSingle()

    const cargo = dbUser?.cargo || user.user_metadata?.cargo || ''
    const perfil = dbUser?.perfil || user.user_metadata?.perfil || ''
    const isAdmin = cargo === 'Administrador Master' || perfil === 'Administrador'

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 403 })
    }

    // 3. Create New Material Action
    if (body.action === 'create') {
      const payload = {
        titulo: body.titulo,
        descricao: body.descricao || '',
        categoria: body.categoria || 'Guias & E-books',
        link: body.link,
        imagem_url: body.imagem_url || null,
        autor: body.autor || 'Equipe Pedagógica',
        tags: body.tags || ['Divulgação'],
        contador_visitas: 0,
        ativo: true
      }

      const insertPayload = {
        id: body.id || `mat-${Date.now()}`,
        ...payload
      }
      const { data, error } = await systemSupabase
        .from('gp_materiais_divulgacao')
        .insert(insertPayload)
        .select()
        .single()

      if (error) {
        console.error('Supabase insert error:', error)
        return NextResponse.json({ success: false, error: error.message })
      }

      return NextResponse.json({ success: true, newItem: data })
    }

    // 4. Update Material Action
    if (body.action === 'update' && body.id) {
      const payload = {
        titulo: body.titulo,
        descricao: body.descricao || '',
        categoria: body.categoria || 'Guias & E-books',
        link: body.link,
        imagem_url: body.imagem_url || null,
        autor: body.autor || 'Equipe Pedagógica',
        tags: body.tags || ['Divulgação']
      }

      const { data, error } = await systemSupabase
        .from('gp_materiais_divulgacao')
        .update(payload)
        .eq('id', body.id)
        .select()
        .single()

      if (error) {
        console.error('Supabase update error:', error)
        return NextResponse.json({ success: false, error: error.message })
      }

      return NextResponse.json({ success: true, updatedItem: data })
    }

    // 5. Delete Material Action
    if (body.action === 'delete' && body.id) {
      const { error } = await systemSupabase
        .from('gp_materiais_divulgacao')
        .delete()
        .eq('id', body.id)

      if (error) {
        console.error('Supabase delete error:', error)
        return NextResponse.json({ success: false, error: error.message })
      }

      return NextResponse.json({ success: true, deletedId: body.id })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro no servidor' }, { status: 500 })
  }
}
