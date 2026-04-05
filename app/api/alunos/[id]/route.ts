import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseServer.from('alunos').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ ...data, ...(data.dados || {}) })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { nome, matricula, turma, serie, turno, status,
      email, cpf, dataNascimento, responsavel, responsavelFinanceiro,
      responsavelPedagogico, telefone, inadimplente, risco_evasao,
      media, frequencia, obs, unidade, foto, ...rest } = body

    const row = {
      nome, matricula: matricula || '', turma: turma || '',
      serie: serie || '', turno: turno || '', status: status || 'matriculado',
      email: email || '', cpf: cpf || '',
      data_nascimento: dataNascimento || '',
      responsavel: responsavel || '',
      responsavel_financeiro: responsavelFinanceiro || '',
      responsavel_pedagogico: responsavelPedagogico || '',
      telefone: telefone || '',
      inadimplente: inadimplente || false,
      risco_evasao: risco_evasao || 'baixo',
      media: media ?? null, frequencia: frequencia ?? 100,
      obs: obs || '', unidade: unidade || '', foto: foto || null,
      dados: rest,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseServer
      .from('alunos').update(row).eq('id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseServer.from('alunos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
