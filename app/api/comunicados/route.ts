import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

function normalizeRow(row: any) {
  const merged = { ...row, ...(row.dados || {}) }
  // Ensure critical fields are always safe types
  merged.leituras = merged.leituras && typeof merged.leituras === 'object' && !Array.isArray(merged.leituras) ? merged.leituras : {}
  merged.ciencias = merged.ciencias && typeof merged.ciencias === 'object' && !Array.isArray(merged.ciencias) ? merged.ciencias : {}
  merged.turmas = Array.isArray(merged.turmas) ? merged.turmas : []
  merged.alunosIds = Array.isArray(merged.alunosIds) ? merged.alunosIds : []
  merged.status = merged.status || 'enviado'
  merged.prioridade = merged.prioridade || 'normal'
  merged.fixado = Boolean(merged.fixado)
  merged.exigeCiencia = Boolean(merged.exigeCiencia)
  merged.permiteResposta = Boolean(merged.permiteResposta)
  merged.anexos = Array.isArray(merged.anexos) ? merged.anexos : []
  // Map DB column names to app field names
  if (!merged.conteudo && merged.texto) merged.conteudo = merged.texto
  if (!merged.dataEnvio && merged.data) merged.dataEnvio = merged.data
  return merged
}

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');
  const turmaId = searchParams.get('turma_id');
  const alunoId = searchParams.get('aluno_id');
  
  let query = supabase.from('comunicados').select('*');
  
  if (turmaId || alunoId) {
    const conditions = [`destino.eq."todos"`];
    if (turmaId) {
      conditions.push(`dados->turmas.cs.["${turmaId}"]`);
    }
    if (alunoId) {
      conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
    }
    query = query.or(conditions.join(','));
  }
  
  query = query.order('data', { ascending: false });
  
  if (limitParam) {
     const limit = parseInt(limitParam);
     const offset = offsetParam ? parseInt(offsetParam) : 0;
     query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(normalizeRow))
}

export async function POST(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) {
        // If empty array, delete all
        await supabase.from('comunicados').delete().neq('id', 'internal-root')
        return NextResponse.json({ ok: true, count: 0 })
      }
      
      const rows = body.map(c => buildRow(c))
      const ids = rows.map(r => r.id)
      
      // Full sync: Delete items not in the provided array
      await supabase.from('comunicados').delete().not('id', 'in', `(${ids.map(i => `"${i}"`).join(',')})`)
      
      const { error } = await supabase.from('comunicados').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('comunicados').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(normalizeRow(data), { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('comunicados').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// Removed deprecated config export

function buildRow(c: any) {
  const { id, titulo, conteudo, texto, autor, dataEnvio, data, destino, fixado, ...rest } = c
  // Ensure safe defaults for JSONB fields stored in dados
  const dados = {
    ...rest,
    status: rest.status || 'enviado',
    prioridade: rest.prioridade || 'normal',
    turmas: Array.isArray(rest.turmas) ? rest.turmas : [],
    alunosIds: Array.isArray(rest.alunosIds) ? rest.alunosIds : [],
    leituras: (rest.leituras && typeof rest.leituras === 'object' && !Array.isArray(rest.leituras)) ? rest.leituras : {},
    ciencias: (rest.ciencias && typeof rest.ciencias === 'object' && !Array.isArray(rest.ciencias)) ? rest.ciencias : {},
    anexos: Array.isArray(rest.anexos) ? rest.anexos : [],
    exigeCiencia: Boolean(rest.exigeCiencia),
    permiteResposta: Boolean(rest.permiteResposta),
  }
  return {
    id: id || `COM-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    titulo: titulo || '', 
    texto: conteudo || texto || '', 
    autor: autor || '',
    data: dataEnvio || data || new Date().toISOString(),
    destino: destino || 'todos', 
    fixado: Boolean(fixado),
    dados,
    updated_at: new Date().toISOString(),
  }
}
