import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAdminClient()
    const { id } = await params
    
    // Fetch pesquisa sem respostas (apenas título, descrição e perguntas para renderizar o form público)
    const { data: pesquisa, error } = await supabase
      .from('gp_pesquisas')
      .select('id, titulo, descricao, status, tipo, perguntas')
      .eq('id', id)
      .single()
      
    if (error) throw error

    return NextResponse.json(pesquisa)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
