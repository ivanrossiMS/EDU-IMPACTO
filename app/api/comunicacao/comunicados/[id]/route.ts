import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const resolvedParams = await context.params
    const id = resolvedParams?.id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updates = await request.json()
    const supabase = await createProtectedClient()

    const { data: existing, error: fetchError } = await supabase
      .from('comunicados')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const mergedSource = {
      ...existing,
      ...(existing.dados || {}),
      ...updates,
      ...(updates.dados || {}),
    }
    delete mergedSource.dados

    const { id: _id, titulo, texto, autor, data, destino, fixado, created_at, ...rest } = mergedSource
    const row = {
      id,
      titulo: titulo ?? existing.titulo ?? '',
      texto: texto ?? existing.texto ?? '',
      autor: autor ?? existing.autor ?? '',
      data: data ?? existing.data ?? new Date().toISOString().slice(0, 10),
      destino: destino ?? existing.destino ?? 'Todos',
      fixado: fixado ?? existing.fixado ?? false,
      dados: rest,
    }

    const { data: saved, error: saveError } = await supabase
      .from('comunicados')
      .update(row)
      .eq('id', id)
      .select()
      .single()

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 400 })
    }

    return NextResponse.json({ ...saved, ...(saved.dados || {}) })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar comunicado' }, { status: 400 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const resolvedParams = await context.params
    const id = resolvedParams?.id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = await createProtectedClient()
    const { data: deleted, error } = await supabase
      .from('comunicados')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(deleted)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao excluir comunicado' }, { status: 400 })
  }
}
