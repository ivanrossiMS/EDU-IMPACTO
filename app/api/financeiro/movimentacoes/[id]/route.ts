import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createProtectedClient();
  try {
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const { error } = await supabase.from('movimentacoes').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
