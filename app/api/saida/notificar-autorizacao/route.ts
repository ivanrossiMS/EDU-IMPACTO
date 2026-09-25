import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { test, userIds, callId, studentName, studentClass, authorizedPerson, targetTime } = body

    const supabaseService = getAdminClient()

    // 1. Obter a lista de IDs de colaboradores selecionados
    let targetIds: string[] = []
    if (Array.isArray(userIds) && userIds.length > 0) {
      targetIds = userIds.filter(Boolean)
    } else {
      const { data: configRow } = await supabaseService
        .from('saida_config')
        .select('dados')
        .eq('id', 'default')
        .maybeSingle()
      const configDados = (configRow?.dados && typeof configRow.dados === 'object') ? configRow.dados : {}
      targetIds = Array.isArray(configDados.specialAuthNotificationUserIds)
        ? configDados.specialAuthNotificationUserIds.filter(Boolean)
        : []
    }

    if (targetIds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Nenhum colaborador foi selecionado para receber notificações.'
      }, { status: 400 })
    }

    // 2. Buscar dados dos colaboradores
    const { data: targetUsers, error: usersErr } = await supabaseService
      .from('system_users')
      .select('id, auth_id, nome, email, perfil, cargo')
      .in('id', targetIds)

    if (usersErr || !targetUsers || targetUsers.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Nenhum dos colaboradores selecionados foi encontrado no banco de dados.'
      }, { status: 404 })
    }

    // 3. Montar lista de identificadores para o OneSignal
    const pushTargets = new Set<string>()
    targetUsers.forEach(u => {
      if (u.id) pushTargets.add(String(u.id))
      if (u.auth_id) pushTargets.add(String(u.auth_id))
      if (u.email) pushTargets.add(String(u.email).toLowerCase().trim())
    })

    const isTest = Boolean(test)
    const title = isTest
      ? '🔔 Teste de Notificação: Autorização Especial'
      : '📝 Nova Autorização Especial do Dia'

    const message = isTest
      ? `Notificação de teste recebida com sucesso! Você está configurado(a) para receber alertas da Portaria.`
      : `${studentName || 'Aluno'}${studentClass ? ` (${studentClass})` : ''} liberado(a) para ${authorizedPerson || 'Pessoa Autorizada'}${targetTime && targetTime !== 'Indefinido' ? ` às ${targetTime}` : ''}.`

    const pushItemId = `manual_special_auth_${Date.now()}`

    // 4. Enviar push notification
    const pushResult = await sendAgendaPushNotification({
      type: 'saida',
      itemId: pushItemId,
      title,
      message,
      targetUserIds: Array.from(pushTargets),
      targetUrl: '/saida-alunos/chamadas',
      metadata: {
        tipo: 'autorizacao_especial',
        is_test: isTest,
        targetUrl: '/saida-alunos/chamadas',
        perfil_destino: 'colaborador'
      }
    })

    return NextResponse.json({
      ok: true,
      isTest,
      notifiedCount: targetUsers.length,
      users: targetUsers.map(u => ({ id: u.id, nome: u.nome, email: u.email })),
      pushResult
    })
  } catch (err: any) {
    console.error('[API Notificar Autorizacao] Erro:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
