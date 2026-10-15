import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()
  const { data, error } = await supabase
    .from('tarefas')
    .select('*')
    .order('prazo')
    .limit(1000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(r => ({ ...r, ...(r.dados || {}) })))
}

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()
  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      if (body.length === 0) {
        await supabase.from('tarefas').delete().neq('id', '0')
        return NextResponse.json([], { status: 200 })
      }

      const rows = body.map((item: any) => {
        const { id, titulo, descricao, responsavel, prazo, status, prioridade, ...rest } = item
        return {
          id: id || `TAR${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          titulo: titulo || '',
          descricao: descricao || '',
          responsavel: responsavel || '',
          prazo: prazo || '',
          status: status || 'pendente',
          prioridade: prioridade || 'media',
          dados: rest,
        }
      })

      const incomingIds = new Set(rows.map(r => String(r.id)))
      const { data: existingRows } = await supabase.from('tarefas').select('id').limit(1000)
      const toDelete = (existingRows || [])
        .map((r: any) => String(r.id))
        .filter((id: string) => !incomingIds.has(id))

      if (toDelete.length > 0) {
        await supabase.from('tarefas').delete().in('id', toDelete)
      }

      const { data, error } = await supabase.from('tarefas').upsert(rows).select()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(data, { status: 201 })
    } else {
      const { id, titulo, descricao, responsavel, prazo, status, prioridade, ...rest } = body
      const row = {
        id: id || `TAR${Date.now()}`,
        titulo: titulo || '',
        descricao: descricao || '',
        responsavel: responsavel || '',
        prazo: prazo || '',
        status: status || 'pendente',
        prioridade: prioridade || 'media',
        dados: rest,
      }
      const { data, error } = await supabase.from('tarefas').upsert(row).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(data, { status: 201 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
