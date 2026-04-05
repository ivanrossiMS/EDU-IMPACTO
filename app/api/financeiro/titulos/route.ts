import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const alunoId = searchParams.get('alunoId')
  const q = searchParams.get('q')

  let query = supabaseServer.from('titulos').select('*').order('vencimento')

  if (status && status !== 'Todos') query = query.eq('status', status)
  if (alunoId) query = query.eq('aluno_id', alunoId)
  if (q) query = query.or(`aluno.ilike.%${q}%,descricao.ilike.%${q}%,codigo.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data || []).map(row => ({
    ...row,
    ...(row.dados_bancarios || {}),
    // map snake_case back to camelCase for frontend
    alunoId: row.aluno_id,
    eventoId: row.evento_id,
    eventoDescricao: row.evento_descricao,
    dataNascimento: row.data_nascimento,
  }))
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      id, codigo, aluno, alunoId, responsavel, descricao, valor,
      vencimento, pagamento, status, metodo, parcela, turma, ano,
      eventoId, eventoDescricao, ...dadosBancarios
    } = body

    const row = {
      id: id || `TIT${Date.now()}`,
      codigo: codigo || `TIT-${Math.floor(Math.random() * 90000) + 10000}`,
      aluno: aluno || '',
      aluno_id: alunoId || '',
      responsavel: responsavel || '',
      descricao: descricao || '',
      valor: valor || 0,
      vencimento: vencimento || '',
      pagamento: pagamento || null,
      status: status || 'pendente',
      metodo: metodo || null,
      parcela: parcela || '',
      turma: turma || '',
      ano: ano || new Date().getFullYear(),
      evento_id: eventoId || '',
      evento_descricao: eventoDescricao || '',
      dados_bancarios: dadosBancarios,
    }

    const { data, error } = await supabaseServer.from('titulos').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
