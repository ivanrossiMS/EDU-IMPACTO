import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await request.json().catch(() => ({}))
  const { redacaoIds } = body

  let query = supabase.from('redacao_upload_requisicoes').select('*')
  if (redacaoIds && Array.isArray(redacaoIds) && redacaoIds.length > 0) {
    query = query.in('id_redacao_upload', redacaoIds)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
