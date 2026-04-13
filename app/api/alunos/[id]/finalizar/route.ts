import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

// PATCH /api/alunos/[id]/finalizar — Finaliza cadastro, muda status para 'matriculado'
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createProtectedClient()
    const { id } = await params

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    // Verifica se o aluno existe
    const { data: aluno, error: findErr } = await supabase
      .from('alunos')
      .select('id, status, nome')
      .eq('id', id)
      .maybeSingle()

    if (findErr) throw new Error(findErr.message)
    if (!aluno) return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })

    // Se já matriculado, não faz nada (idempotente)
    if (aluno.status === 'matriculado') {
      return NextResponse.json({ ok: true, id, status: 'matriculado', message: 'Aluno já matriculado.' })
    }

    // Atualiza status para matriculado
    const { data: updated, error: updErr } = await supabase
      .from('alunos')
      .update({
        status: 'matriculado',
        ultimo_step: 5,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status, nome, matricula')
      .single()

    if (updErr) throw new Error(updErr.message)

    return NextResponse.json({ ok: true, ...updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
