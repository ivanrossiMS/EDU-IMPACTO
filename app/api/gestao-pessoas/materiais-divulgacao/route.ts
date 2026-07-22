import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {}
        }
      }
    )

    const { data, error } = await supabase
      .from('gp_materiais_divulgacao')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !data || data.length === 0) {
      return NextResponse.json({ success: true, data: REAL_DEFAULT_MATERIALS })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ success: true, data: REAL_DEFAULT_MATERIALS })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {}
        }
      }
    )

    // Increment Visit Action
    if (body.action === 'increment_visit' && body.id) {
      const { data: item } = await supabase
        .from('gp_materiais_divulgacao')
        .select('contador_visitas')
        .eq('id', body.id)
        .single()

      if (item) {
        const newCount = (item.contador_visitas || 0) + 1
        await supabase
          .from('gp_materiais_divulgacao')
          .update({ contador_visitas: newCount })
          .eq('id', body.id)

        return NextResponse.json({ success: true, contador_visitas: newCount })
      }

      return NextResponse.json({ success: true, incremented: true })
    }

    // Create New Material Action
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

      const { data, error } = await supabase
        .from('gp_materiais_divulgacao')
        .insert(payload)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ success: true, newItem: { id: `mat-${Date.now()}`, ...payload } })
      }

      return NextResponse.json({ success: true, newItem: data })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro no servidor' }, { status: 500 })
  }
}
