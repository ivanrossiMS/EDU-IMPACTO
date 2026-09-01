import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'saida_anuncios_historico')
      .maybeSingle()

    if (error) {
      console.error('[saida_anuncios_historico GET] Erro:', error)
      return NextResponse.json([])
    }

    const result = data?.valor && Array.isArray(data.valor) ? data.valor : []
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    })
  } catch (err: any) {
    console.error('[saida_anuncios_historico GET] Exceção:', err)
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = getAdminClient()

    const listToSave = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [body]

    const { data, error } = await supabase
      .from('configuracoes')
      .upsert({
        chave: 'saida_anuncios_historico',
        valor: listToSave.slice(0, 5), // Manter apenas os 5 mais recentes
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[saida_anuncios_historico POST] Erro ao salvar:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(listToSave, { status: 200 })
  } catch (err: any) {
    console.error('[saida_anuncios_historico POST] Exceção:', err)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
