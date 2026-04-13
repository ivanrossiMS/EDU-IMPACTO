import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createProtectedClient();
  const { data, error } = await supabase
    .from('mantenedores').select('*').order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result = (data || []).map(row => ({
    ...row,
    unidades: row.unidades ?? [],
    ...(row.dados || {}),
  }))
  return NextResponse.json({ data: result })
}

export async function POST(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      const incomingIds = body.map(m => m.id).filter(Boolean);

      if (incomingIds.length === 0) {
        // Se a lista veio vazia, deletar todos os registros porque o frontend limpou
        await supabase.from('mantenedores').delete().neq('id', 'impossible-id');
        return NextResponse.json({ ok: true, count: 0 });
      }

      const rows = body.map(m => buildRow(m))
      const { error } = await supabase.from('mantenedores').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Remover do banco os que não vieram na listagem final (sincronização de exclusões)
      const { error: delErr } = await supabase.from('mantenedores').delete().not('id', 'in', `(${incomingIds.join(',')})`);
      if (delErr) console.error('Erro ao excluir mantenedores removidos:', delErr);

      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase
      .from('mantenedores').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, unidades: data.unidades ?? [], ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRow(m: any) {
  const {
    id, nome, razaoSocial, cnpj, responsavel, cargo,
    telefone, email, endereco, cidade, estado, cep,
    unidades, ...rest
  } = m
  return {
    id: id || `MAN-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    nome: nome || '',
    razao_social: razaoSocial || '',
    cnpj: cnpj || '',
    responsavel: responsavel || '',
    cargo: cargo || '',
    telefone: telefone || '',
    email: email || '',
    endereco: endereco || '',
    cidade: cidade || '',
    estado: estado || '',
    cep: cep || '',
    unidades: unidades ?? [],
    dados: rest,
    updated_at: new Date().toISOString(),
  }
}
