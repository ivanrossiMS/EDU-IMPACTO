import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { ZodAlunoResponsavel } from '@/lib/server/zodSchemas'

export const dynamic = 'force-dynamic'

// ─── GET: vínculos de um aluno ────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const { searchParams } = new URL(request.url)
    const alunoId = searchParams.get('aluno_id')
    if (!alunoId) return NextResponse.json({ error: 'aluno_id obrigatório' }, { status: 400 })

    const { data, error } = await supabase
      .from('aluno_responsavel')
      .select('*, responsavel:responsaveis(*)')
      .eq('aluno_id', alunoId)
      .order('created_at')

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── POST: criar ou atualizar vínculo ────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const body = await request.json()

    // Suporte a array (múltiplos vínculos de uma vez)
    const items = Array.isArray(body) ? body : [body]

    const results = []
    for (const item of items) {
      const validated = ZodAlunoResponsavel.parse(item)
      const { data, error } = await supabase
        .from('aluno_responsavel')
        .upsert(validated, { onConflict: 'aluno_id,responsavel_id' })
        .select()
        .single()
      if (error) throw new Error(error.message)
      results.push(data)
    }

    return NextResponse.json(results.length === 1 ? results[0] : results, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.errors || e.message }, { status: 400 })
  }
}

// ─── DELETE: remove vínculo por id ou por aluno_id+responsavel_id ────────────
export async function DELETE(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const alunoId = searchParams.get('aluno_id')
    const responsavelId = searchParams.get('responsavel_id')

    let query = supabase.from('aluno_responsavel').delete()
    if (id) query = query.eq('id', id) as any
    else if (alunoId && responsavelId) {
      query = query.eq('aluno_id', alunoId).eq('responsavel_id', responsavelId) as any
    } else {
      return NextResponse.json({ error: 'Informe id ou aluno_id+responsavel_id' }, { status: 400 })
    }

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
