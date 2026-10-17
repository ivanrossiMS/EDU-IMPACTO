import { NextResponse } from 'next/server'
import { requireStaff, resolveUserRole, getAuthorizedAlunoIdsForUser } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  const { user, isStaff } = roleCtx

  const supabase = await createProtectedClient();
  const { id } = await params
  const { data, error } = await supabase.from('titulos').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: error?.message || 'Não encontrado' }, { status: 404 })

  if (!isStaff) {
    const allowedAlunoIds = await getAuthorizedAlunoIdsForUser(user)
    const candidateIds = [
      data.aluno_id,
      data.dados?.alunoId,
      data.dados?.aluno_id,
      data.aluno,
    ].map(v => String(v || '').trim()).filter(Boolean)

    if (!candidateIds.some(cid => allowedAlunoIds.has(cid))) {
      return NextResponse.json({ error: 'Acesso negado a este título.' }, { status: 403 })
    }
  }

  return NextResponse.json({ ...data, ...(data.dados_bancarios || {}) })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
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

    const { data, error } = await supabase.from('titulos').update(row).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados_bancarios || {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { id } = await params
  const { error } = await supabase.from('titulos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
