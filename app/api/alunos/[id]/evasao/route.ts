import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { motivoPrincipal, descricaoLivre, anoReferencia } = body
    
    // fetch current dados
    const { data: aluno, error: getErr } = await supabase
      .from('alunos')
      .select('dados')
      .eq('id', params.id)
      .single()

    if (getErr || !aluno) return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })

    const novoDados = {
      ...(aluno.dados || {}),
      evasao: {
        anoReferencia,
        motivoPrincipal,
        descricaoLivre,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: user.id
      }
    }

    const { error: updErr } = await supabase
      .from('alunos')
      .update({ dados: novoDados })
      .eq('id', params.id)

    if (updErr) throw updErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
