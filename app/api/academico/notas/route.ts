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

    for (const lanc of payload) {
      try {
        if (!lanc.turmaId || !lanc.disciplina || !lanc.bimestre) {
          console.warn('Pulando lancamento sem campos obrigatorios:', lanc.id);
          continue;
        }

        // 1. Upsert Lançamento
        const { error: err1 } = await supabase.from('academico_notas_lancamento').upsert({
          id: lanc.id || `LN-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          turma_id: lanc.turmaId,
          disciplina: lanc.disciplina,
          bimestre: lanc.bimestre,
          esquema_id: lanc.esquemaId,
          criado_por: lanc.criadoPor || 'Usuário',
          created_at: lanc.createdAt || new Date().toISOString()
        })
        if (err1) throw err1

        // 2. Preparar Alunos e Valores
        const alunosRows: any[] = []
        const valoresRows: any[] = []

        for (const nota of lanc.notas || []) {
          if (!nota.alunoId) continue;

          const alunoPk = `${lanc.id}_${nota.alunoId}`
          alunosRows.push({
            id: alunoPk,
            lancamento_id: lanc.id,
            aluno_id: nota.alunoId,
            media_parcial: nota.mediaParcial,
            faltas: nota.faltas || 0,
            situacao: nota.situacao || ''
          })

          for (const [detalheId, val] of Object.entries(nota.valores || {})) {
            if (val !== null && val !== '' && val !== undefined) {
              valoresRows.push({
                id: `${alunoPk}_${detalheId}`,
                nota_aluno_id: alunoPk,
                detalhe_id: detalheId,
                valor: String(val)
              })
            }
          }
        }

        if (alunosRows.length > 0) {
          const { error: err2 } = await supabase.from('academico_notas_aluno').upsert(alunosRows)
          if (err2) throw err2
        }

        if (valoresRows.length > 0) {
          const { error: err3 } = await supabase.from('academico_notas_valor').upsert(valoresRows)
          if (err3) throw err3
        }
      } catch (innerErr: any) {
        console.error(`Erro ao salvar lancamento ${lanc.id}:`, innerErr);
        try {
          require('fs').appendFileSync('/tmp/notas_error.log', `Erro no lanc ${lanc.id}: ${innerErr.message || JSON.stringify(innerErr)}\n`);
        } catch (err) {}
        // Continua para o próximo sem quebrar todo o batch
      }
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
