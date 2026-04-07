import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseServer
    .from('mantenedores').select('*').order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result = (data || []).map(row => ({
    ...row,
    unidades: row.unidades ?? [],
    ...(row.dados || {}),
  }))
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(m => buildRow(m))
      const { error } = await supabaseServer.from('mantenedores').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabaseServer
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
