import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    
    // Contar Atendimentos em Aberto
    const { count: atendimentosCount, error: errAtd } = await supabase
      .from('gp_atendimentos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'aberto')
      
    // Contar Planos de Ação em Aberto
    const { count: planoAcaoCount, error: errPla } = await supabase
      .from('gp_plano_acao')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'aberta')

    // Contar Checklists em Aberto
    const { count: checklistsCount, error: errChk } = await supabase
      .from('gp_checklists')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'aberto')

    let total = 0
    if (!errAtd) total += (atendimentosCount || 0)
    if (!errPla) total += (planoAcaoCount || 0)
    if (!errChk) total += (checklistsCount || 0)

    return NextResponse.json({ pendencias: total }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59' }
    })
  } catch (err: any) {
    return NextResponse.json({ pendencias: 0, error: err.message }, { status: 400 })
  }
}
