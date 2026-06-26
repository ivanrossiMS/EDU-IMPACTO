import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    
    // Select apenas os campos básicos e indexados para performance < 100ms
    const { data, error } = await supabase
      .from('alunos')
      .select('id, nome, matricula, turma, status')
      .or('status.neq.inativo,status.is.null')
      .order('nome')

    if (error) {
      console.error('[API alunos/lightweight] erro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Remapear para front-end (garantir campos básicos que o front espera num select)
    const formatted = (data || []).map(aluno => ({
      id: String(aluno.id),
      nome: String(aluno.nome || ''),
      matricula: aluno.matricula || '',
      turma: aluno.turma || '',
      status: aluno.status || 'ativo'
    }))

    return NextResponse.json(formatted)
  } catch (err: any) {
    console.error('[API alunos/lightweight] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
