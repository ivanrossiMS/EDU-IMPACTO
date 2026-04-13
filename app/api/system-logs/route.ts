import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const modulo = searchParams.get('modulo')
  const limit = parseInt(searchParams.get('limit') || '200')

  let query = supabase.from('system_logs')
    .select('*').order('data_hora', { ascending: false }).limit(limit)
  if (modulo) query = query.eq('modulo', modulo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Map snake_case back to camelCase for frontend
  return NextResponse.json((data || []).map(row => ({
    id: row.id,
    dataHora: row.data_hora,
    usuarioNome: row.usuario_nome,
    perfil: row.perfil,
    modulo: row.modulo,
    acao: row.acao,
    descricao: row.descricao,
    status: row.status,
    origem: row.origem,
    registroId: row.registro_id,
    nomeRelacionado: row.nome_relacionado,
    detalhesAntes: row.detalhes_antes,
    detalhesDepois: row.detalhes_depois,
  })))
}

export async function POST(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    const logs = Array.isArray(body) ? body : [body]
    const sanitize = (obj: any) => {
       if (!obj || typeof obj !== 'object') return obj;
       const copy = { ...obj };
       if (copy.foto) copy.foto = '[BASE64_OMITIDO]';
       if (copy.arquivoBase64) copy.arquivoBase64 = '[BASE64_OMITIDO]';
       return copy;
    }

    const rows = logs.map(l => ({
      id: l.id || `LOG-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      data_hora: l.dataHora || new Date().toISOString(),
      usuario_nome: l.usuarioNome || '',
      perfil: l.perfil || '',
      modulo: l.modulo || '',
      acao: l.acao || '',
      descricao: l.descricao || '',
      status: l.status || 'sucesso',
      origem: l.origem || 'sistema',
      registro_id: l.registroId || null,
      nome_relacionado: l.nomeRelacionado || null,
      detalhes_antes: sanitize(l.detalhesAntes),
      detalhes_depois: sanitize(l.detalhesDepois),
    }))
    const { error } = await supabase.from('system_logs').upsert(rows)
    if (error) {
      console.error('[API system-logs] Upsert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, count: rows.length })
  } catch (e: any) {
    console.error('[API system-logs] Unknown Catch error:', e.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET /api/system-logs?limit=500 — also accepts DELETE for cleanup
export async function DELETE(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const olderThanDays = parseInt(searchParams.get('olderThanDays') || '90')
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)
  const { error } = await supabase.from('system_logs')
    .delete().lt('data_hora', cutoff.toISOString())
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
