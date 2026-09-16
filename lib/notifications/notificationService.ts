/**
 * notificationService.ts — Serviço central de notificações push do Impacto Edu.
 *
 * Princípios Fundamentais:
 * 1. FONTE ÚNICA DE VERDADE para permissão de notificações e subscrição.
 * 2. NUNCA confunde permissão do SO com subscription do OneSignal ou existência de token APNs.
 * 3. NUNCA invoca requestPermission(true) para evitar o alerta nativo bugado em inglês do OneSignal v5.
 * 4. Reavalia o estado nativo instantaneamente quando o aplicativo retorna do background (Settings -> App).
 * 5. Gerencia ciclo de vida atômico de autenticação (login/logout) sem destruir autorização do aparelho.
 */

import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { openAppSettings } from './nativeSettings'
import {
  OSNotificationPermissionCode,
  NotificationPermissionStatus,
  PushSubscriptionState,
  NotificationDiagnosticState,
} from './types'

type StateListener = (state: NotificationDiagnosticState) => void

class NotificationService {
  private static instance: NotificationService
  private initialized = false
  private initializingPromise: Promise<void> | null = null
  private nativeListenersConfigured = false
  private currentUserId: string | null = null

  private state: NotificationDiagnosticState = {
    platform: 'web',
    isNative: false,
    permissionStatus: 'loading',
    nativePermissionCode: null,
    hasPermissionBool: false,
    canRequest: false,
    subscription: {
      isSubscribed: false,
      subscriptionId: null,
      pushToken: null,
      optedIn: false,
      userId: null,
    },
    oneSignalInitialized: false,
    error: null,
    updatedAt: new Date().toISOString(),
  }

  private listeners: Set<StateListener> = new Set()

  private constructor() {
    if (typeof window !== 'undefined') {
      const isNative = Capacitor.isNativePlatform()
      const rawPlat = isNative ? Capacitor.getPlatform() : 'web'
      this.state.isNative = isNative
      this.state.platform = rawPlat === 'ios' ? 'ios' : rawPlat === 'android' ? 'android' : 'web'
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * Inicializa o SDK de notificações de forma idempotente (apenas 1 vez).
   */
  public async initialize(customAppId?: string): Promise<void> {
    if (typeof window === 'undefined') return
    if (this.initialized) return

    if (this.initializingPromise) {
      return this.initializingPromise
    }

    this.initializingPromise = this._doInitialize(customAppId)
    try {
      await this.initializingPromise
      this.initialized = true
      this.state.oneSignalInitialized = true
      this.notifyListeners()
    } finally {
      this.initializingPromise = null
    }
  }

  private async _doInitialize(customAppId?: string): Promise<void> {
    const appId = customAppId || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '1d652b2a-7b06-4b07-984f-f47e0a4b37fc'
    if (!appId) {
      console.warn('⚠️ [NotificationService] App ID do OneSignal não configurado.')
      this.state.permissionStatus = 'unsupported'
      this.state.error = 'App ID not configured'
      this.notifyListeners()
      return
    }

    const isNative = Capacitor.isNativePlatform()
    this.state.isNative = isNative

    if (isNative) {
      try {
        console.log('📱 [NotificationService] Inicializando OneSignal nativo...')
        const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
        
        await OneSignalNative.initialize(appId)
        ;(window as any).__OS_NATIVE_READY__ = true
        ;(window as any).__OS_INIT__ = true

        // Configura listeners de ciclo de vida e mudanças de estado
        this.setupNativeListeners(OneSignalNative)

        // Atualiza estado imediatamente após inicialização sem solicitar permissão
        await this.refresh()

        console.log('✅ [NotificationService] OneSignal nativo inicializado com sucesso!')
      } catch (err: any) {
        console.error('❌ [NotificationService] Erro ao inicializar OneSignal nativo:', err)
        this.state.error = err?.message || 'Failed to initialize native push'
        this.notifyListeners()
      }
    } else {
      // ── Web Push ──────────────────────────────────────────────────────────
      try {
        window.OneSignalDeferred = window.OneSignalDeferred || []
        window.OneSignalDeferred.push(async (OneSignal: any) => {
          try {
            if (!OneSignal) return
            await OneSignal.init({
              appId,
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerParam: { scope: '/' },
            })
            ;(window as any).__OS_INIT__ = true

            // Listeners para mudanças de permissão e subscrição na Web
            if (OneSignal.Notifications?.addEventListener) {
              OneSignal.Notifications.addEventListener('permissionChange', () => {
                this.refresh().catch(() => {})
              })
            }
            const pushSub = OneSignal.User?.PushSubscription || OneSignal.User?.pushSubscription
            if (pushSub?.addEventListener) {
              pushSub.addEventListener('change', () => {
                this.refresh().catch(() => {})
              })
            }

            await this.refresh()
            console.log('🔔 [NotificationService] OneSignal Web inicializado!')
          } catch (webErr: any) {
            const msg = webErr?.message || ''
            if (!msg.includes('already initialized')) {
              console.warn('[NotificationService] Erro inicialização web:', webErr)
              this.state.error = msg
              this.notifyListeners()
            }
          }
        })
      } catch (e: any) {
        console.error('[NotificationService] Erro ao enfileirar inicialização web:', e)
      }
    }
  }

  /**
   * Configura listeners nativos para o ciclo de vida do app e mudanças de permissão.
   */
  private setupNativeListeners(OneSignalNative: any) {
    if (this.nativeListenersConfigured) return
    this.nativeListenersConfigured = true

    try {
      // 1. Mudança de permissão detectada pelo OneSignal
      OneSignalNative.Notifications.addEventListener('permissionChange', (hasPerm: boolean) => {
        console.log('📱 [NotificationService] Evento permissionChange recebido:', hasPerm)
        this.refresh().catch(() => {})
      })

      // 2. Mudança de Push Subscription (token, id, opt-in)
      if (OneSignalNative.User?.pushSubscription?.addEventListener) {
        OneSignalNative.User.pushSubscription.addEventListener('change', (event: any) => {
          console.log('📱 [NotificationService] Mudança na subscrição push:', event)
          this.refresh().catch(() => {})
        })
      }

      // 3. Ciclo de Vida do App (CRÍTICO: Settings -> App)
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('📱 [NotificationService] App voltou para FOREGROUND — revalidando permissões nativas...')
          this.refresh().catch(() => {})
        }
      }).catch(() => {})

      App.addListener('resume', () => {
        console.log('📱 [NotificationService] Evento resume disparado — revalidando permissões nativas...')
        this.refresh().catch(() => {})
      }).catch(() => {})
    } catch (listenerErr) {
      console.warn('[NotificationService] Erro ao registrar listeners nativos:', listenerErr)
    }
  }

  /**
   * Revalida completamente o estado de permissões do SO e da subscrição OneSignal.
   * Chamado na inicialização, ao voltar do background ou após o usuário responder prompts.
   */
  public async refresh(): Promise<NotificationDiagnosticState> {
    if (typeof window === 'undefined') return this.state

    const isNative = Capacitor.isNativePlatform()

    if (isNative) {
      // Garante que o SDK nativo foi inicializado antes de interrogar métodos de permissão
      if (!this.initialized) {
        if (this.initializingPromise) {
          try {
            await this.initializingPromise
          } catch {}
        } else {
          try {
            await this.initialize()
          } catch {}
        }
      }

      // Se mesmo após a tentativa de inicialização o SDK nativo não estiver pronto,
      // não chama métodos nativos do OneSignal para evitar IllegalStateException
      if (!this.initialized) {
        console.warn('⚠️ [NotificationService] OneSignal nativo ainda não pronto, adiando refresh nativo.')
        return this.state
      }

      try {
        const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')

        // 1. Consulta estrita de permissão nativa do sistema com proteção individual
        let hasPerm = false
        try {
          hasPerm = await OneSignalNative.Notifications.hasPermission()
        } catch (e) {
          console.warn('[NotificationService] hasPermission fallback:', e)
        }

        let canRequest = false
        try {
          canRequest = await OneSignalNative.Notifications.canRequestPermission()
        } catch (e) {
          console.warn('[NotificationService] canRequestPermission fallback:', e)
        }

        let nativeCode: number | null = null
        try {
          const resCode = await OneSignalNative.Notifications.permissionNative()
          nativeCode = typeof resCode === 'number' ? resCode : null
        } catch {}

        // Mapeia código iOS para status semântico
        let permStatus: NotificationPermissionStatus = 'loading'

        if (this.state.platform === 'ios') {
          if (nativeCode === OSNotificationPermissionCode.Authorized) {
            permStatus = 'authorized'
          } else if (nativeCode === OSNotificationPermissionCode.Denied) {
            permStatus = 'denied'
          } else if (nativeCode === OSNotificationPermissionCode.Provisional) {
            permStatus = 'provisional'
          } else if (nativeCode === OSNotificationPermissionCode.Ephemeral) {
            permStatus = 'authorized'
          } else if (nativeCode === OSNotificationPermissionCode.NotDetermined) {
            permStatus = 'notDetermined'
          } else {
            // Fallback de segurança caso permissionNative() não responda
            permStatus = hasPerm ? 'authorized' : canRequest ? 'notDetermined' : 'denied'
          }
        } else {
          // Android
          if (hasPerm) {
            permStatus = 'authorized'
          } else if (canRequest) {
            permStatus = 'notDetermined'
          } else {
            permStatus = 'denied'
          }
        }

        // 2. Consulta independente da Push Subscription OneSignal
        const subId = await OneSignalNative.User.pushSubscription.getIdAsync().catch(() => null)
        const subToken = await OneSignalNative.User.pushSubscription.getTokenAsync().catch(() => null)
        const optedIn = await OneSignalNative.User.pushSubscription.getOptedInAsync().catch(() => false)
        const osId = await OneSignalNative.User.getOnesignalId().catch(() => null)
        const extId = await OneSignalNative.User.getExternalId().catch(() => null)

        // Se o SO autorizou mas o OneSignal estiver com optOut, ativa optIn automaticamente
        if ((permStatus === 'authorized' || permStatus === 'provisional') && !optedIn) {
          try {
            console.log('📱 [NotificationService] SO autorizado, garantindo optIn no OneSignal...')
            await OneSignalNative.User.pushSubscription.optIn()
          } catch {}
        }

        this.state = {
          ...this.state,
          permissionStatus: permStatus,
          nativePermissionCode: nativeCode,
          hasPermissionBool: hasPerm,
          canRequest,
          subscription: {
            isSubscribed: Boolean(subId && subToken && optedIn),
            subscriptionId: subId,
            pushToken: subToken,
            optedIn: Boolean(optedIn),
            userId: extId || osId,
          },
          error: null,
          updatedAt: new Date().toISOString(),
        }

        this.printDiagnosticLog()
        this.notifyListeners()
        return this.state
      } catch (err: any) {
        console.error('❌ [NotificationService] Erro ao revalidar estado nativo:', err)
        this.state.error = err?.message || 'Failed to refresh state'
        this.notifyListeners()
        return this.state
      }
    }

    // ── Web Fallback ────────────────────────────────────────────────────────
    if (!('Notification' in window)) {
      this.state.permissionStatus = 'unsupported'
      this.notifyListeners()
      return this.state
    }

    const webPerm = Notification.permission
    let permStatus: NotificationPermissionStatus = 'notDetermined'
    if (webPerm === 'granted') permStatus = 'authorized'
    else if (webPerm === 'denied') permStatus = 'denied'

    const OS = (window as any).OneSignal
    const pushSub = OS?.User?.PushSubscription || OS?.User?.pushSubscription
    const subId = pushSub?.id || null
    const optedIn = pushSub?.optedIn ?? (webPerm === 'granted')
    const extId = OS?.User?.externalId || (window as any).__OS_USER_ID__ || null

    this.state = {
      ...this.state,
      permissionStatus: permStatus,
      hasPermissionBool: webPerm === 'granted',
      canRequest: webPerm === 'default',
      subscription: {
        isSubscribed: Boolean(optedIn && webPerm === 'granted'),
        subscriptionId: subId,
        pushToken: pushSub?.token || null,
        optedIn: Boolean(optedIn),
        userId: extId,
      },
      error: null,
      updatedAt: new Date().toISOString(),
    }

    this.printDiagnosticLog()
    this.notifyListeners()
    return this.state
  }

  /**
   * Solicita permissão ao sistema operacional.
   *
   * REGRA CRÍTICA: fallbackToSettings é SEMPRE FALSE.
   * Isso impede que o OneSignal dispare o alerta nativo bugado em inglês
   * ("Open Settings / You currently have notifications turned off...").
   */
  public async requestNotificationPermission(): Promise<boolean> {
    const isNative = Capacitor.isNativePlatform()

    if (isNative) {
      try {
        console.log('📱 [NotificationService] Solicitando permissão nativa (fallbackToSettings: false)...')
        const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')

        // Executa com fallbackToSettings = false
        const accepted = await OneSignalNative.Notifications.requestPermission(false)
        console.log('📱 [NotificationService] Resultado do prompt do SO:', accepted)

        if (accepted && OneSignalNative.User?.pushSubscription?.optIn) {
          await OneSignalNative.User.pushSubscription.optIn().catch(() => {})
        }

        await this.refresh()
        return accepted
      } catch (err: any) {
        console.error('❌ [NotificationService] Erro ao solicitar permissão nativa:', err)
        await this.refresh()
        return false
      }
    }

    // Web
    if ('Notification' in window) {
      try {
        const OS = (window as any).OneSignal
        if (OS?.Notifications?.requestPermission) {
          await OS.Notifications.requestPermission()
          const optInFn = OS.User?.PushSubscription?.optIn || OS.User?.pushSubscription?.optIn
          if (typeof optInFn === 'function') {
            await optInFn.call(OS.User?.PushSubscription || OS.User?.pushSubscription).catch(() => {})
          }
        } else {
          await Notification.requestPermission()
        }
        await this.refresh()
        return Notification.permission === 'granted'
      } catch (err) {
        console.warn('[NotificationService] Falha ao solicitar permissão web:', err)
      }
    }

    return false
  }

  /**
   * Abre a tela de Ajustes do aplicativo no iPhone ou configurações no Android
   * utilizando a ponte nativa confiável.
   */
  public async openNotificationSettings(): Promise<boolean> {
    console.log('⚙️ [NotificationService] Abrindo Ajustes do aplicativo...')
    return await openAppSettings()
  }

  /**
   * Sincroniza o usuário autenticado com o OneSignal (External ID, Aliases e Tags).
   */
  public async syncUser(
    user: any,
    extraData?: {
      meusAlunos?: any[] | null
      alunoId?: string | null
      turmaNome?: string | null
      alunoObj?: any
      extraStaffIds?: string[] | null
      hasDualAccess?: boolean
    }
  ): Promise<void> {
    if (!user?.id) return

    const userId = String(user.id)
    const isNative = Capacitor.isNativePlatform()

    try {
      // Tags de segmentação
      const masterRoles = ['administrador master', 'administrador', 'admin', 'diretor geral', 'diretora geral', 'master']
      const cargoLower = String(user.cargo || '').toLowerCase().trim()
      const perfilLower = String(user.perfil || '').toLowerCase().trim()
      const isMaster = masterRoles.includes(cargoLower) || masterRoles.includes(perfilLower)

      const tags: Record<string, string> = {
        perfil: user.perfil || '',
        cargo: user.cargo || '',
        isMasterAdmin: isMaster ? 'true' : 'false',
        acesso: isMaster ? 'institucional' : (user.perfil || 'padrao'),
      }
      if (user.aluno_id) tags['aluno_id'] = String(user.aluno_id)
      if (extraData?.alunoId) tags['aluno_id'] = String(extraData.alunoId)
      if (extraData?.turmaNome) tags['turma'] = String(extraData.turmaNome)
      if (extraData?.alunoObj?.id) tags['aluno_db_id'] = String(extraData.alunoObj.id)
      if (user.responsavel_id) tags['responsavel_id'] = String(user.responsavel_id)
      if (extraData?.hasDualAccess) tags['has_dual_role'] = 'true'

      if (Array.isArray(extraData?.meusAlunos)) {
        extraData.meusAlunos.forEach(s => {
          if (s?.id) tags[`aluno_${s.id}`] = 'true'
          if (s?.turmaNome || s?.turma) tags[`turma_${s.id}`] = String(s.turmaNome || s.turma)
        })
      }

      // Aliases para permitir envio flexível pelo backend (por ID de responsável, aluno, email, etc.)
      const aliasesToRegister: Array<{ label: string; id: string }> = []
      const rId = user.responsavel_id || user.user_metadata?.responsavel_id || user.responsavelId
      if (rId) {
        aliasesToRegister.push({ label: 'responsavel_id', id: String(rId) })
      }
      if (user.aluno_id) {
        aliasesToRegister.push({ label: 'aluno_id', id: String(user.aluno_id) })
      }
      if (extraData?.alunoId && String(extraData.alunoId) !== String(user.aluno_id)) {
        aliasesToRegister.push({ label: 'aluno_id', id: String(extraData.alunoId) })
      }
      if (Array.isArray(extraData?.meusAlunos)) {
        extraData.meusAlunos.forEach(s => {
          if (s?.id) {
            aliasesToRegister.push({ label: 'aluno_id', id: String(s.id) })
            const cleanId = String(s.id).replace(/^(a_|_ALU)/, '')
            if (cleanId !== String(s.id)) {
              aliasesToRegister.push({ label: 'aluno_id', id: cleanId })
            }
          }
        })
      }
      const staffIds = extraData?.extraStaffIds || []
      const colabId =
        user.colaborador_id ||
        user.system_user_id ||
        user.user_metadata?.colaborador_id ||
        user.user_metadata?.system_user_id ||
        staffIds[0]
      if (colabId) {
        aliasesToRegister.push({ label: 'colaborador_id', id: String(colabId) })
        aliasesToRegister.push({ label: 'system_user_id', id: String(colabId) })
      }
      const cod = user.codigo || user.user_metadata?.codigo
      if (cod) {
        aliasesToRegister.push({ label: 'codigo', id: String(cod) })
      }
      if (user.email) {
        aliasesToRegister.push({ label: 'email', id: String(user.email).toLowerCase().trim() })
      }

      if (isNative) {
        const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')

        if (this.currentUserId !== userId) {
          await OneSignalNative.login(userId)
          this.currentUserId = userId
          console.log(`✅ [NotificationService] Usuário associado ao OneSignal Nativo (External ID: ${userId})`)
        }

        if (OneSignalNative.User?.pushSubscription?.optIn) {
          await OneSignalNative.User.pushSubscription.optIn().catch(() => {})
        }

        if (OneSignalNative.User?.addAlias) {
          for (const alias of aliasesToRegister) {
            OneSignalNative.User.addAlias(alias.label, alias.id).catch(() => {})
          }
        }

        if (OneSignalNative.User?.addTags) {
          await OneSignalNative.User.addTags(tags).catch(() => {})
        }
      } else {
        // Web User Sync
        const performWebSync = async (OS: any) => {
          if (!OS || typeof OS.login !== 'function') return

          if (this.currentUserId !== userId) {
            await OS.login(userId).catch(() => {})
            this.currentUserId = userId
            console.log(`✅ [NotificationService] Usuário associado ao OneSignal Web (External ID: ${userId})`)
          }

          const optInFn = OS.User?.PushSubscription?.optIn || OS.User?.pushSubscription?.optIn
          if (typeof optInFn === 'function') {
            await optInFn.call(OS.User?.PushSubscription || OS.User?.pushSubscription).catch(() => {})
          }

          if (OS.User?.addAlias) {
            for (const alias of aliasesToRegister) {
              await OS.User.addAlias(alias.label, alias.id).catch(() => {})
            }
          }

          if (OS.User?.addTags) {
            await OS.User.addTags(tags).catch(() => {})
          }
        }

        const OS = (window as any).OneSignal
        if (OS && typeof OS.login === 'function') {
          await performWebSync(OS)
        } else if (typeof window !== 'undefined') {
          window.OneSignalDeferred = window.OneSignalDeferred || []
          window.OneSignalDeferred.push(async (OneSignal: any) => {
            await performWebSync(OneSignal)
          })
        }
      }

      await this.refresh()
    } catch (err) {
      console.warn('⚠️ [NotificationService] Falha ao sincronizar usuário com OneSignal:', err)
    }
  }

  /**
   * Desassocia o usuário no logout do app sem destruir o registro nativo do aparelho.
   */
  public async clearUser(): Promise<void> {
    this.currentUserId = null
    const isNative = Capacitor.isNativePlatform()

    try {
      if (isNative) {
        const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
        if (typeof OneSignalNative.logout === 'function') {
          await OneSignalNative.logout()
          console.log('🚪 [NotificationService] Usuário deslogado do OneSignal.')
        }
      } else {
        const OS = (window as any).OneSignal
        if (OS && typeof OS.logout === 'function') {
          await OS.logout().catch(() => {})
        }
      }
    } catch (err) {
      console.warn('[NotificationService] Erro no logout do OneSignal:', err)
    } finally {
      await this.refresh().catch(() => {})
    }
  }

  /**
   * Log estruturado de diagnóstico para produção (Sanitizado: sem credenciais/chaves privadas).
   */
  private printDiagnosticLog(): void {
    console.log('[Push Debug]', {
      platform: this.state.platform,
      isNative: this.state.isNative,
      permissionStatus: this.state.permissionStatus,
      nativePermissionCode: this.state.nativePermissionCode,
      hasPermissionBool: this.state.hasPermissionBool,
      canRequest: this.state.canRequest,
      subscriptionOptedIn: this.state.subscription.optedIn,
      hasSubscriptionId: Boolean(this.state.subscription.subscriptionId),
      hasPushToken: Boolean(this.state.subscription.pushToken),
      oneSignalUserId: this.state.subscription.userId,
      initializationComplete: this.state.oneSignalInitialized,
      error: this.state.error,
      updatedAt: this.state.updatedAt,
    })
  }

  public getDiagnosticState(): NotificationDiagnosticState {
    return { ...this.state }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    listener({ ...this.state })
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    const copy = { ...this.state }
    this.listeners.forEach(listener => {
      try {
        listener(copy)
      } catch (err) {
        console.error('[NotificationService] Erro no listener:', err)
      }
    })
  }
}

export const notificationService = NotificationService.getInstance()
