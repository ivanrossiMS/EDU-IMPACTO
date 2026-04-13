import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '200')
  const modulo = searchParams.get('modulo')

  let query = supabase.from('system_logs').select('*')
    .order('data_hora', { ascending: false }).limit(limit)
  if (modulo) query = query.eq('modulo', modulo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data || []).map(r => ({
    id: r.id, dataHora: r.data_hora,
    usuarioNome: r.usuario_nome, perfil: r.perfil,
    modulo: r.modulo, acao: r.acao,
    registroId: r.registro_id, nomeRelacionado: r.nome_relacionado,
    descricao: r.descricao, status: r.status,
    ip: r.ip, origem: r.origem,
    detalhesAntes: r.detalhes_antes,
    detalhesDepois: r.detalhes_depois,
  })))
}

export async function POST(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    const row = {
      id: body.id || `LOG${Date.now()}`,
      data_hora: body.dataHora || new Date().toISOString(),
      usuario_nome: body.usuarioNome || 'Admin',
      perfil: body.perfil || 'admin',
      modulo: body.modulo || '',
      acao: body.acao || '',
      registro_id: body.registroId || null,
      nome_relacionado: body.nomeRelacionado || null,
      descricao: body.descricao || '',
      status: body.status || 'sucesso',
      ip: body.ip || null,
      origem: body.origem || 'sistema',
      detalhes_antes: body.detalhesAntes || null,
      detalhes_depois: body.detalhesDepois || null,
    }
    const { data, error } = await supabase.from('system_logs').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
