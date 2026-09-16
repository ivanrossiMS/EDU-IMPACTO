/**
 * usePushNotifications.ts — Hook centralizado para gerenciar estado reativo de notificações push.
 *
 * Utiliza o NotificationService como fonte única de verdade.
 * Não duplica listeners nativos e realiza cleanup adequado.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { notificationService } from '@/lib/notifications/notificationService'
import { NotificationDiagnosticState } from '@/lib/notifications/types'

export function usePushNotifications() {
  const [state, setState] = useState<NotificationDiagnosticState>(() =>
    notificationService.getDiagnosticState()
  )

  useEffect(() => {
    // Inscreve-se nas notificações do serviço
    const unsubscribe = notificationService.subscribe(newState => {
      setState(newState)
    })

    // Garante que o estado seja consultado na montagem
    notificationService.refresh().catch(() => {})

    return () => {
      unsubscribe()
    }
  }, [])

  const requestPermission = useCallback(async () => {
    return await notificationService.requestNotificationPermission()
  }, [])

  const openSettings = useCallback(async () => {
    return await notificationService.openNotificationSettings()
  }, [])

  const refresh = useCallback(async () => {
    return await notificationService.refresh()
  }, [])

  return {
    permissionStatus: state.permissionStatus,
    isAuthorized: state.permissionStatus === 'authorized' || state.permissionStatus === 'provisional',
    isDenied: state.permissionStatus === 'denied',
    isNotDetermined: state.permissionStatus === 'notDetermined',
    isLoading: state.permissionStatus === 'loading',
    canRequest: state.canRequest,
    subscription: state.subscription,
    diagnostic: state,
    requestPermission,
    openSettings,
    refresh,
  }
}
