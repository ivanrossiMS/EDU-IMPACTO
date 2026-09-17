/**
 * types.ts — Tipagens centrais para o sistema de notificações push do Impacto Edu.
 *
 * Separa estritamente:
 * 1. Permissão nativa do SO (UNAuthorizationStatus / Android POST_NOTIFICATIONS)
 * 2. Inscrição/Subscription OneSignal (optedIn / optOut)
 * 3. Token APNs / FCM
 * 4. Subscription ID do OneSignal
 * 5. Identidade do Usuário (external_id, aliases, tags)
 */

/**
 * Códigos nativos de autorização do iOS (UNAuthorizationStatus)
 * e mapeamento no OneSignal Native Plugin.
 */
export const OSNotificationPermissionCode = {
  NotDetermined: 0,
  Denied: 1,
  Authorized: 2,
  Provisional: 3,
  Ephemeral: 4,
} as const

export type OSNotificationPermissionCode =
  (typeof OSNotificationPermissionCode)[keyof typeof OSNotificationPermissionCode]

/**
 * Status semântico de alto nível para consumo pela aplicação.
 */
export type NotificationPermissionStatus =
  | 'loading'         // Determinando estado inicial (nunca assumir bloqueio)
  | 'authorized'      // Permissão concedida pelo usuário / sistema
  | 'denied'          // Usuário recusou explicitamente nos Ajustes / prompt
  | 'notDetermined'   // Usuário ainda não respondeu ao prompt do SO
  | 'provisional'     // Notificações silenciosas / resumo do iOS
  | 'unsupported'     // Ambiente não suporta push (ex: navegador web antigo)
  | 'error'           // Falha ao consultar o status nativo

/**
 * Estado detalhado da subscrição de push do OneSignal no dispositivo.
 */
export interface PushSubscriptionState {
  isSubscribed: boolean
  subscriptionId: string | null
  pushToken: string | null
  optedIn: boolean
  userId: string | null
}

/**
 * Diagnóstico consolidado e sanitizado para suporte e logs em produção.
 */
export interface NotificationDiagnosticState {
  platform: 'ios' | 'android' | 'web'
  isNative: boolean
  permissionStatus: NotificationPermissionStatus
  nativePermissionCode: number | null
  hasPermissionBool: boolean
  canRequest: boolean
  subscription: PushSubscriptionState
  oneSignalInitialized: boolean
  error: string | null
  updatedAt: string
}

export interface DiagnosticLogEntry {
  id: string
  timestamp: string
  action: string
  status: 'ok' | 'error' | 'pending' | 'info'
  details?: any
  error?: string | null
}

export interface DetailedDeviceDiagnostic {
  appInfo: {
    name: string
    id: string
    version: string
    build: string
  }
  platform: 'ios' | 'android' | 'web'
  isNative: boolean
  oneSignalAppId: string
  subscriptionId: string | null
  oneSignalId: string | null
  externalId: string | null
  currentUser: {
    id: string | null
    email: string | null
    nome: string | null
    perfil: string | null
    cargo: string | null
    responsavelId: string | null
    alunoId: string | null
  } | null
  identityMatch: {
    isMatched: boolean
    details: string
  }
  permission: {
    permissionStatus: NotificationPermissionStatus
    nativePermissionCode: number | null
    nativePermissionLabel: string
    hasPermission: boolean
    canRequestPermission: boolean
    webPermission?: string
  }
  pushSubscription: {
    optedIn: boolean
    hasToken: boolean
    tokenMasked: string | null
    tokenLength: number
    tokenType: 'APNs' | 'FCM' | 'WebPush' | 'None'
  }
  auditLogs: DiagnosticLogEntry[]
  queryErrors: Array<{ field: string; error: string }>
  timestamp: string
}
