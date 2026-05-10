import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { motivoPrincipal, descricaoLivre, anoReferencia } = body
    
    // fetch current dados
    const { data: aluno, error: getErr } = await supabase
      .from('alunos')
      .select('dados')
      .eq('id', id)
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
      .eq('id', id)

    if (updErr) throw updErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
