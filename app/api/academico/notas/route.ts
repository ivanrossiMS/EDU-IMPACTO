import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const turmaId = searchParams.get('turma_id')

  let query = supabase.from('academico_notas_lancamento').select(`
    id, turma_id, disciplina, bimestre, esquema_id, criado_por, created_at,
    academico_notas_aluno (
      id, aluno_id, media_parcial, faltas, situacao,
      academico_notas_valor (
        detalhe_id, valor
      )
    )
  `).order('created_at', { ascending: false })

  if (turmaId) query = query.eq('turma_id', turmaId)

  const { data, error } = await query
  if (error) {
    console.error('GET /api/academico/notas query error:', error);
    // Fallback temporário para tabela antiga caso a migração ainda não tenha rodado
    const fallback = await supabase.from('lancamentos_nota').select('*').order('created_at', { ascending: false })
    if (fallback.data && !fallback.error) {
      return NextResponse.json((fallback.data || []).map(row => ({ ...row, ...(row.dados || {}) })))
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Converter formato relacional para o JSON Document esperado pelo Frontend
  const formattedData = (data || []).map((lanc: any) => {
    return {
      id: lanc.id,
      turmaId: lanc.turma_id,
      disciplina: lanc.disciplina,
      bimestre: lanc.bimestre,
      esquemaId: lanc.esquema_id,
      criadoPor: lanc.criado_por,
      createdAt: lanc.created_at,
      notas: (lanc.academico_notas_aluno || []).map((a: any) => {
        const valores: Record<string, any> = {}
        ;(a.academico_notas_valor || []).forEach((v: any) => {
          valores[v.detalhe_id] = isNaN(Number(v.valor)) ? v.valor : Number(v.valor)
        })
        return {
          alunoId: a.aluno_id,
          mediaParcial: a.media_parcial,
          faltas: a.faltas || 0,
          situacao: a.situacao,
          valores
        }
      })
    }
  })

  return NextResponse.json(formattedData)
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    const payload = Array.isArray(body) ? body : [body]
    
    // LOG TUDO PARA DEBUG!
    try {
      require('fs').writeFileSync('/tmp/notas_log.json', JSON.stringify({ payload, timestamp: new Date().toISOString() }, null, 2));
    } catch (err) {}

    if (payload.length === 0) return NextResponse.json({ ok: true, count: 0 })

    const { error: errRpc } = await supabase.rpc('salvar_notas_em_lote', { p_dados: payload })
    
    if (errRpc) {
      console.error('Erro na RPC salvar_notas_em_lote:', errRpc)
      // Se a RPC falhar, isso indica erro nos dados ou que a migração não rodou.
      throw errRpc
    }

    return NextResponse.json({ ok: true, count: payload.length }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/academico/notas error:', e);
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('academico_notas_lancamento').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
