export async function sendPushNotification(params: {
  title: string
  body: string
  targetUserIds: string[]
  url?: string
  data?: any
  sendAfter?: string
}) {
  try {
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || ''
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || ''

    // Se as chaves não estiverem configuradas, apenas logamos o payload (Mock Mode)
    // Isso garante que o sistema não quebre, mas fique 100% pronto para produção.
    const isMockMode = !ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY

    const payload = {
      app_id: ONESIGNAL_APP_ID || 'MOCK_APP_ID',
      include_external_user_ids: params.targetUserIds, // IDs dos responsáveis no seu banco de dados
      channel_for_external_user_ids: 'push',
      headings: { en: params.title, pt: params.title },
      contents: { en: params.body, pt: params.body },
      url: params.url, // Deep link que abre quando clica na notificação
      data: params.data,
      ...(params.sendAfter && { send_after: params.sendAfter })
    }

    if (isMockMode) {
      console.log('🔔 [MOCK PUSH NOTIFICATION] Disparo simulado (chaves não configuradas):')
      console.log(JSON.stringify(payload, null, 2))
      return { success: true, mock: true, payload }
    }

    // Disparo REAL para a API do OneSignal
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('❌ Erro no disparo do Push (OneSignal):', errBody)
      return { success: false, error: errBody }
    }

    const data = await response.json()
    console.log('✅ Push disparado com sucesso!', data)
    return { success: true, data }

  } catch (err: any) {
    console.error('❌ Erro crítico ao tentar disparar Push Notification:', err)
    return { success: false, error: err.message }
  }
}
