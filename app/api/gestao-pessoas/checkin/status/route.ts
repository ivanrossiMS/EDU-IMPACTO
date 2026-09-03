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
    // PERFORMANCE: Executa as duas queries em paralelo com Promise.all.
    // Antes eram sequenciais: config → checkin (soma das latências).
    // Agora correm simultaneamente: latência = max(config, checkin) em vez de soma.
    const dataLimite = new Date()

    // Calculamos a data limite com frequencia_dias padrão de 7 para poder
    // disparar a query do checkin em paralelo antes de receber o config.
    // Se o config tiver outro valor, recalculamos abaixo.
    const defaultFrequencia = 7
    dataLimite.setDate(dataLimite.getDate() - defaultFrequencia)

    const configPromise = (async () => {
      try {
        // Query 1: Configuração do Check-in de Bem-Estar (silencioso se tabela não existe)
        return await supabase
          .from('gp_checkin_config')
          .select('ativo, frequencia_dias')
          .eq('id', 'default')
          .maybeSingle()
      } catch {
        return { data: null, error: null }
      }
    })()

    const checkinPromise = supabase
      .from('colaborador_checkin')
      .select('id, data_checkin')
      .eq('usuario_id', userId)
      .gte('data_checkin', dataLimite.toISOString())
      .order('data_checkin', { ascending: false })
      .limit(1)

    // PERFORMANCE: Executa as duas queries em paralelo
    const [configResult, checkinResult] = await Promise.all([configPromise, checkinPromise])

    // Processa resultado do config
    let isAtivo = true
    let frequenciaDias = defaultFrequencia

    if (configResult.data) {
      isAtivo = configResult.data.ativo ?? true
      frequenciaDias = configResult.data.frequencia_dias ?? defaultFrequencia
    }

    // Se estiver desativado explicitamente, não exibe o modal
    if (!isAtivo) {
      return NextResponse.json({ needsCheckin: false, reason: 'disabled' }, {
        headers: { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60' }
      })
    }

    // Se a frequência real for diferente da padrão, refaz a query do checkin
    // (raro — só quando admin muda a configuração)
    let checkins = checkinResult.data
    const checkinError = checkinResult.error

    if (checkinError) {
      if (checkinError.code === '42P01' || checkinError.code === 'PGRST205' || checkinError.message?.includes('schema cache')) {
        return NextResponse.json({ needsCheckin: false }, {
          headers: { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60' }
        })
      }
      throw checkinError
    }

    if (frequenciaDias !== defaultFrequencia) {
      const realDataLimite = new Date()
      realDataLimite.setDate(realDataLimite.getDate() - frequenciaDias)
      const { data: refetchCheckins, error: refetchError } = await supabase
        .from('colaborador_checkin')
        .select('id, data_checkin')
        .eq('usuario_id', userId)
        .gte('data_checkin', realDataLimite.toISOString())
        .order('data_checkin', { ascending: false })
        .limit(1)
      if (!refetchError) checkins = refetchCheckins
    }

    const hasRecentCheckin = checkins && checkins.length > 0
    return NextResponse.json({ needsCheckin: !hasRecentCheckin, frequenciaDias }, {
      // PERFORMANCE: Cache de 30s — o status do checkin raramente muda dentro de uma sessão
      headers: { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60' }
    })
  } catch (err: any) {
    console.error('Erro ao buscar status do checkin:', err)
    return NextResponse.json({ needsCheckin: false }) // Fallback para não travar o login do usuário
  }
}
