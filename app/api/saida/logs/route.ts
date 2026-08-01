import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

/**
 * GET /api/saida/logs
 * Retorna o histórico completo de saídas (tabela saida_calls) para backup.
 * Este endpoint é usado exclusivamente pelo sistema de Backup & Exportação.
 */
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10000', 10)

    const supabase = await createProtectedClient()

    const { data, error } = await supabase
      .from('saida_calls')
      .select('id, dados, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)

    // Retorna formato normalizado para backup
    const result = (data || []).map(row => ({ id: row.id, ...(row.dados || {}), created_at: row.created_at }))
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
