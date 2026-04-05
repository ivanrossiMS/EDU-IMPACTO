import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseServer.from('titulos').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ ...data, ...(data.dados_bancarios || {}) })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const {
      codigo, aluno, alunoId, responsavel, descricao, valor,
      vencimento, pagamento, status, metodo, parcela, turma, ano,
      eventoId, eventoDescricao, ...dadosBancarios
    } = body

    const row = {
      codigo: codigo || '', aluno: aluno || '', aluno_id: alunoId || '',
      responsavel: responsavel || '', descricao: descricao || '',
      valor: valor || 0, vencimento: vencimento || '',
      pagamento: pagamento || null, status: status || 'pendente',
      metodo: metodo || null, parcela: parcela || '',
      turma: turma || '', ano: ano || new Date().getFullYear(),
      evento_id: eventoId || '', evento_descricao: eventoDescricao || '',
      dados_bancarios: dadosBancarios,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseServer.from('titulos').update(row).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados_bancarios || {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseServer.from('titulos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
