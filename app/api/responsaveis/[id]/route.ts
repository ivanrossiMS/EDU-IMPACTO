import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { ZodResponsavel } from '@/lib/server/zodSchemas'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createProtectedClient()
    const { id } = await params
    const body = await request.json()

    const { nome, cpf, rg, orgEmissor, org_emissor, sexo, dataNasc, data_nasc,
      email, telefone, celular, profissao, parentesco, tipo, naturalidade, uf,
      nacionalidade, estadoCivil, estado_civil, rfid, codigo, obs, endereco, dados, ...rest } = body

    const nomeFinal = (nome || '').trim()
    if (nomeFinal.length < 2) return NextResponse.json({ error: 'Nome inválido' }, { status: 400 })

    // Merge dados extras no JSONB dados existente
    const { data: existing } = await supabase.from('responsaveis').select('dados').eq('id', id).single()
    const mergedDados = { ...(existing?.dados || {}), ...dados, ...rest }

    const row = {
      nome: nomeFinal,
      cpf: (cpf || '').replace(/\D/g, '') || null,
      rg: rg || null,
      org_emissor: orgEmissor || org_emissor || null,
      sexo: sexo || null,
      data_nasc: dataNasc || data_nasc || null,
      email: email || null,
      telefone: telefone || null,
      celular: celular || null,
      profissao: profissao || null,
      parentesco: parentesco || null,
      tipo: tipo || null,
      naturalidade: naturalidade || null,
      uf: uf || null,
      nacionalidade: nacionalidade || 'Brasileira',
      estado_civil: estadoCivil || estado_civil || null,
      rfid: rfid || null,
      codigo: codigo || null,
      obs: obs || null,
      endereco: endereco || {},
      dados: mergedDados,
    }

    const { data, error } = await supabase
      .from('responsaveis').update(row).eq('id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createProtectedClient()
    const { id } = await params

    // Verifica se tem alunos vinculados ainda ativos
    const { count } = await supabase
      .from('aluno_responsavel')
      .select('*', { count: 'exact', head: true })
      .eq('responsavel_id', id)

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Responsável possui alunos vinculados. Remova os vínculos antes de excluir.' },
        { status: 409 }
      )
    }

    const { error } = await supabase.from('responsaveis').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
