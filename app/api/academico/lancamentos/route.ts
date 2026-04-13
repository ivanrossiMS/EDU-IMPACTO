import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const turmaId = searchParams.get('turmaId')
  const bimestre = searchParams.get('bimestre')

  let query = supabase.from('lancamentos_nota').select('*').order('created_at', { ascending: false })
  if (turmaId) query = query.eq('turma_id', turmaId)
  if (bimestre) query = query.eq('bimestre', parseInt(bimestre))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data || []).map(r => ({
    ...r, turmaId: r.turma_id, criadoPor: r.criado_por,
  })))
}

export async function POST(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    const { id, turmaId, disciplina, bimestre, notas, criadoPor } = body
    const row = {
      id: id || `LN${Date.now()}`,
      turma_id: turmaId || '',
      disciplina: disciplina || '',
      bimestre: bimestre || 1,
      notas: notas || [],
      criado_por: criadoPor || '',
    }
    const { data, error } = await supabase.from('lancamentos_nota').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
