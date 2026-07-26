import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const userId = user.user_metadata?.uid_legacy || user.id
  const supabase = getAdminClient()

  try {
    // 1. Busca a configuração do Check-in de Bem-Estar (silencioso caso a tabela não exista)
    let isAtivo = true
    let frequenciaDias = 7

    try {
      const { data: config, error: configError } = await supabase
        .from('gp_checkin_config')
        .select('ativo, frequencia_dias')
        .eq('id', 'default')
        .maybeSingle()

      if (!configError && config) {
        isAtivo = config.ativo ?? true
        frequenciaDias = config.frequencia_dias ?? 7
      }
    } catch {
      // Ignora erro de schema cache se a tabela não existir ainda
    }

    // Se estiver desativado explicitamente, não exibe o modal
    if (!isAtivo) {
      return NextResponse.json({ needsCheckin: false, reason: 'disabled' })
    }

    // 2. Verifica se o colaborador realizou o check-in nos últimos X dias
    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() - frequenciaDias)

    const { data: checkins, error } = await supabase
      .from('colaborador_checkin')
      .select('id, data_checkin')
      .eq('usuario_id', userId)
      .gte('data_checkin', dataLimite.toISOString())
      .order('data_checkin', { ascending: false })
      .limit(1)

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return NextResponse.json({ needsCheckin: false })
      }
      throw error
    }

    const hasRecentCheckin = checkins && checkins.length > 0
    return NextResponse.json({ needsCheckin: !hasRecentCheckin, frequenciaDias })
  } catch (err: any) {
    console.error('Erro ao buscar status do checkin:', err)
    return NextResponse.json({ needsCheckin: false }) // Fallback para não travar o login do usuário
  }
}
