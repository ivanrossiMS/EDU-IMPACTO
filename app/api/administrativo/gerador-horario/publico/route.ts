import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

const PUBLIC_KEY_PREFIX = 'gerador_horario_publico_v1_'
const LATEST_PUBLIC_KEY = 'gerador_horario_publico_latest_v1'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ano = searchParams.get('ano')
    const chave = ano ? `${PUBLIC_KEY_PREFIX}${ano}` : LATEST_PUBLIC_KEY

    const supabase = getAdminClient()
    let { data, error } = await supabase
      .from('configuracoes')
      .select('valor, updated_at')
      .eq('chave', chave)
      .maybeSingle()

    if (!data?.valor && ano) {
      const fallback = await supabase
        .from('configuracoes')
        .select('valor, updated_at')
        .eq('chave', LATEST_PUBLIC_KEY)
        .maybeSingle()
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { horario: data?.valor || null },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao carregar horário público' }, { status: 500 })
  }
}
