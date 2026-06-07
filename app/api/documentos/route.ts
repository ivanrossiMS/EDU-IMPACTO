import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()
  const { searchParams } = new URL(req.url)
  const aluno_id = searchParams.get('aluno_id')

  try {
    let query = supabase
      .from('documentos_emitidos')
      .select('*')
      .order('data_emissao', { ascending: false })

    if (aluno_id) {
      query = query.eq('aluno_id', aluno_id)
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()
  try {
    const body = await req.json()
    const { aluno_id, documento_tipo, emitido_por } = body

    if (!aluno_id || !documento_tipo) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('documentos_emitidos')
      .insert([{ aluno_id, documento_tipo, emitido_por }])
      .select()

    if (error) throw error
    return NextResponse.json(data[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
