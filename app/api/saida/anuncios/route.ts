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

    // 1. Buscar frases salvas em configuracoes
    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'saida_anuncios')
      .maybeSingle()

    if (error) {
      console.error('[saida_anuncios GET] Erro ao buscar:', error)
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache'
        }
      })
    }

    // Se o registro existe no banco de dados, retorna o valor gravado exatamente (mesmo que seja [])
    if (data && data.valor !== undefined && data.valor !== null && Array.isArray(data.valor)) {
      return NextResponse.json(data.valor, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache'
        }
      })
    }

    // Se não existir registro no banco de dados, retorna array vazio (não recriar itens apagados)
    return NextResponse.json([], {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    })
  } catch (err: any) {
    console.error('[saida_anuncios GET] Exceção:', err)
    return NextResponse.json([], {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    })
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
        chave: 'saida_anuncios',
        valor: listToSave,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[saida_anuncios POST] Erro ao salvar no banco:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(listToSave, { status: 200 })
  } catch (err: any) {
    console.error('[saida_anuncios POST] Exceção:', err)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
