import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')?.toLowerCase()

  let query = supabase.from('fornecedores').select('*').order('nome')
  if (status) query = query.eq('status', status)
  if (q) query = query.or(`nome.ilike.%${q}%,cnpj.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(row => ({ ...row, ...(row.dados || {}) })))
}

export async function POST(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      const incomingIds = body.map(f => f.id).filter(Boolean);

      if (incomingIds.length === 0) {
        // Frontend empty array means delete all
        await supabase.from('fornecedores').delete().neq('id', 'impossible-id');
        return NextResponse.json({ ok: true, count: 0 });
      }

      const rows = body.map(f => buildRow(f))
      const { error: upErr } = await supabase.from('fornecedores').upsert(rows)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

      // Sincronizar exclusões de fornecedores
      const { error: delErr } = await supabase.from('fornecedores').delete().not('id', 'in', `(${incomingIds.join(',')})`);
      if (delErr) console.error('Erro ao excluir fornecedores removidos:', delErr);

      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('fornecedores').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('fornecedores').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

function buildRow(f: any) {
  const { id, nome, cnpj, email, telefone, categoria, status, ...rest } = f
  return {
    id: id || `FOR-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    nome: nome || '', cnpj: cnpj || '', email: email || '',
    telefone: telefone || '', categoria: categoria || '',
    status: status || 'ativo', dados: rest,
    updated_at: new Date().toISOString(),
  }
}
