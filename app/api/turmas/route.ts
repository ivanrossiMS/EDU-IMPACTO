import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.toLowerCase()
  const serie = searchParams.get('serie')

  let query = supabase.from('turmas').select('*').order('nome')
  if (q) query = query.or(`nome.ilike.%${q}%,professor.ilike.%${q}%`)
  if (serie && serie !== 'Todos') query = query.eq('serie', serie)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      const incomingIds = body.map(t => t.id).filter(Boolean);

      if (incomingIds.length === 0) {
        await supabase.from('turmas').delete().neq('id', 'impossible-id');
        return NextResponse.json({ ok: true, count: 0 });
      }

      const rows = body.map(t => buildRow(t))
      const { error: upErr } = await supabase.from('turmas').upsert(rows)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

      // Sincronizar exclusões de turmas
      const { error: delErr } = await supabase.from('turmas').delete().not('id', 'in', `(${incomingIds.join(',')})`);
      if (delErr) console.error('Erro ao excluir turmas removidas:', delErr);

      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)
    const { data, error } = await supabase.from('turmas').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRow(body: any) {
  const { id, codigo, nome, serie, turno, professor, sala, capacidade, matriculados, unidade, ano, ...rest } = body
  return {
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
}
