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
    const { data: existing, error: fetchErr } = await supabaseServer.from('alunos').select('*').eq('id', id).single()
    if (fetchErr) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 })

    const { nome, matricula, turma, serie, turno, status,
      email, cpf, dataNascimento, responsavel, responsavelFinanceiro,
      responsavelPedagogico, telefone, inadimplente, risco_evasao,
      media, frequencia, obs, unidade, foto, ...rest } = body

    const row = {
      nome: nome !== undefined ? nome : existing.nome,
      matricula: matricula !== undefined ? matricula : existing.matricula,
      turma: turma !== undefined ? turma : existing.turma,
      serie: serie !== undefined ? serie : existing.serie,
      turno: turno !== undefined ? turno : existing.turno,
      status: status !== undefined ? status : existing.status,
      email: email !== undefined ? email : existing.email,
      cpf: cpf !== undefined ? cpf : existing.cpf,
      data_nascimento: dataNascimento !== undefined ? dataNascimento : existing.data_nascimento,
      responsavel: responsavel !== undefined ? responsavel : existing.responsavel,
      responsavel_financeiro: responsavelFinanceiro !== undefined ? responsavelFinanceiro : existing.responsavel_financeiro,
      responsavel_pedagogico: responsavelPedagogico !== undefined ? responsavelPedagogico : existing.responsavel_pedagogico,
      telefone: telefone !== undefined ? telefone : existing.telefone,
      inadimplente: inadimplente !== undefined ? inadimplente : existing.inadimplente,
      risco_evasao: risco_evasao !== undefined ? risco_evasao : existing.risco_evasao,
      media: media !== undefined ? media : existing.media,
      frequencia: frequencia !== undefined ? frequencia : existing.frequencia,
      obs: obs !== undefined ? obs : existing.obs,
      unidade: unidade !== undefined ? unidade : existing.unidade,
      foto: foto !== undefined ? foto : existing.foto,
      dados: { ...(existing.dados || {}), ...rest },
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
  
  // Limpeza profunda em múltiplas tabelas para evitar travamento de RLS / FK Constraints Rejects
  const tables = ['titulos', 'ocorrencias', 'frequencias', 'agendamentos', 'contas_receber', 'matriculas']
  await Promise.all(tables.map(async t => {
    try { await supabaseServer.from(t).delete().eq('alunoId', id) } catch(e) {}
    try { await supabaseServer.from(t).delete().eq('aluno_id', id) } catch(e) {}
  }))
  
  // Exclusão principal forçando o retorno da row afetada
  const { data, error } = await supabaseServer.from('alunos').delete().eq('id', id).select()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  
  if (!data || data.length === 0) {
     return NextResponse.json({ error: "Aluno possui dependências blindadas ou já foi deletado do sistema." }, { status: 403 })
  }
  
  return NextResponse.json({ ok: true })
}
