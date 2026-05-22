import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  const { data, error } = await supabase
    .from('tarefas').select('*').order('prazo')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(r => ({ ...r, ...(r.dados || {}) })))
}

export async function POST(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    
    if (Array.isArray(body)) {
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
      
      // Delete all tasks first to reflect full state sync
      await supabase.from('tarefas').delete().neq('id', '0')
      
      // Insert the new list
      const { data, error } = await supabase.from('tarefas').insert(rows).select()
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
