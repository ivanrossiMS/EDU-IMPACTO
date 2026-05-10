import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '200')
    const aluno_id = url.searchParams.get('aluno_id')
    const dispositivo_id = url.searchParams.get('dispositivo_id')
    const status = url.searchParams.get('status')
    const data_inicio = url.searchParams.get('data_inicio')
    const data_fim = url.searchParams.get('data_fim')

    let query = supabase
      .from('portaria_eventos')
      .select('*')
      .order('data_hora', { ascending: false })
      .limit(limit)

    if (aluno_id) query = query.eq('aluno_id', aluno_id)
    if (dispositivo_id) query = query.eq('dispositivo_id', dispositivo_id)
    if (status) query = query.eq('status', status)
    if (data_inicio) query = query.gte('data_hora', data_inicio)
    if (data_fim) query = query.lte('data_hora', data_fim)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
