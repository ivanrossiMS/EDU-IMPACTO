import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseServerFactory'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const supabase = await createProtectedClient()
    
    // Fetch pesquisas and aggregate answers
    const { data: pesquisas, error } = await supabase
      .from('gp_pesquisas')
      .select('*, gp_pesquisa_respostas(id, nota)')
      .order('criado_em', { ascending: false })
      
    if (error) throw error

    // Formatar os dados para o frontend
    const formatted = pesquisas.map((p: any) => {
      const respostas = p.gp_pesquisa_respostas || []
      return {
        id: p.id,
        titulo: p.titulo,
        data_fim: p.data_fim,
        status: p.status,
        respostasCount: respostas.length,
        respostas: respostas
      }
    })

    return NextResponse.json(formatted)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const supabase = await createProtectedClient()
    
    const body = await req.json()
    const { titulo, descricao, tipo, data_fim, perguntas } = body

    if (!titulo || !data_fim) {
      return NextResponse.json({ error: 'Título e data limite são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('gp_pesquisas')
      .insert([{ titulo, descricao, tipo, data_fim, perguntas: perguntas || [], status: 'ativa' }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}
