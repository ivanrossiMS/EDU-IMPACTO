import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.toLowerCase()
  const serie = searchParams.get('serie')

  let query = supabaseServer.from('turmas').select('*').order('nome')
  if (q) query = query.or(`nome.ilike.%${q}%,professor.ilike.%${q}%`)
  if (serie && serie !== 'Todos') query = query.eq('serie', serie)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, codigo, nome, serie, turno, professor, sala, capacidade, matriculados, unidade, ano, ...rest } = body

    const row = {
      id: id || `T${Date.now()}`,
      codigo: codigo || '',
      nome,
      serie: serie || '',
      turno: turno || '',
      professor: professor || '',
      sala: sala || '',
      capacidade: capacidade || 30,
      matriculados: matriculados || 0,
      unidade: unidade || '',
      ano: ano || new Date().getFullYear(),
      dados: rest,
    }

    const { data, error } = await supabaseServer.from('turmas').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
