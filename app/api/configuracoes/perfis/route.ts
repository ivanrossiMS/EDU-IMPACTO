import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('system_perfis')
      .select('*')
      .order('nome')
    
    // Se a tabela ainda não existir no Supabase, retornamos 400 para que o frontend não limpe o localStorage
    if (error && error.code === '42P01') {
      console.warn("Tabela system_perfis não existe no Supabase (GET). Usando fallback local.")
      return NextResponse.json({ error: 'Tabela não existe' }, { status: 400 })
    }
    if (error) {
      console.error("[PERFIS GET ERROR]", error);
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const result = (data || []).map(row => ({
      ...row,
      permissoes: row.permissoes ?? [],
    }))
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(m => buildRow(m))
      const { error } = await supabaseServer.from('system_perfis').upsert(rows)
      if (error && error.code === '42P01') {
         // Fallback alertando necessidade de rodar migration
         console.warn("Tabela system_perfis não existe no Supabase. Crie-a para persistência permanente.")
         return NextResponse.json({ ok: false, error: 'Tabela não existe' }, { status: 400 })
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }
    
    const row = buildRow(body)
    const { data, error } = await supabaseServer
      .from('system_perfis').upsert(row).select().single()
      
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, permissoes: data.permissoes ?? [] }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRow(m: any) {
  const { id, nome, cor, descricao, permissoes, ...rest } = m
  return {
    id: id || `PERF-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    nome: nome || '',
    cor: cor || '#3b82f6',
    descricao: descricao || '',
    permissoes: permissoes || [],
    updated_at: new Date().toISOString(),
  }
}
