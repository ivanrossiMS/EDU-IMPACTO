import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const userId = user.id
  const supabase = getAdminClient()

  try {
    // 1. Verifica se tem check-in nos últimos 7 dias
    const setediasAtras = new Date()
    setediasAtras.setDate(setediasAtras.getDate() - 7)

    const { data: checkins, error } = await supabase
      .from('colaborador_checkin')
      .select('id, data_checkin')
      .eq('usuario_id', userId)
      .gte('data_checkin', setediasAtras.toISOString())
      .order('data_checkin', { ascending: false })
      .limit(1)

    if (error) {
      // Se a tabela não existir, retornamos false (silencioso)
      if (error.code === '42P01') {
         return NextResponse.json({ needsCheckin: false })
      }
      throw error
    }

    const hasRecentCheckin = checkins && checkins.length > 0
    return NextResponse.json({ needsCheckin: !hasRecentCheckin })
  } catch (err: any) {
    console.error('Erro ao buscar status do checkin:', err)
    return NextResponse.json({ needsCheckin: false }) // Fallback para não travar o login
  }
}
