import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const turmaId = searchParams.get('turmaId')
  const data = searchParams.get('data')

  let query = supabaseServer.from('frequencias').select('*').order('data', { ascending: false })
  if (turmaId) query = query.eq('turma_id', turmaId)
  if (data) query = query.eq('data', data)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((rows || []).map(r => ({
    ...r, turmaId: r.turma_id, criadoPor: r.criado_por,
  })))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, turmaId, data, registros, criadoPor } = body
    const row = {
      id: id || `FR${Date.now()}`,
      turma_id: turmaId || '',
      data: data || '',
      registros: registros || [],
      criado_por: criadoPor || '',
    }
    const { data: saved, error } = await supabaseServer.from('frequencias').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(saved, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
