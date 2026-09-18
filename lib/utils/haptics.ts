import { Capacitor } from '@capacitor/core'

export type HapticType = 
  | 'impactLight' 
  | 'impactMedium' 
  | 'impactHeavy' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'selection'

/**
 * Dispara uma vibração háptica tátil no dispositivo.
 * Suporta nativamente iOS/Android via Capacitor Haptics (quando disponível)
 * com fallback gracioso para navigator.vibrate em Webview/PWA.
 */
export async function triggerHaptic(type: HapticType = 'impactLight'): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics')) {
      const hapticsModule = await import('@capacitor/haptics').catch(() => null)
      if (hapticsModule) {
        const { Haptics, ImpactStyle, NotificationType } = hapticsModule
        switch (type) {
          case 'impactLight':
            await Haptics.impact({ style: ImpactStyle.Light })
            return
          case 'impactMedium':
            await Haptics.impact({ style: ImpactStyle.Medium })
            return
          case 'impactHeavy':
            await Haptics.impact({ style: ImpactStyle.Heavy })
            return
          case 'success':
            await Haptics.notification({ type: NotificationType.Success })
            return
          case 'warning':
            await Haptics.notification({ type: NotificationType.Warning })
            return
          case 'error':
            await Haptics.notification({ type: NotificationType.Error })
            return
          case 'selection':
            await Haptics.selectionStart()
            await Haptics.selectionChanged()
            return
        }
      }
    }
  } catch {
    // Ignora erro silenciosamente e segue para fallback
  }

  // Fallback para Web/PWA em dispositivos móveis compatíveis
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      switch (type) {
        case 'impactLight':
        case 'selection':
          navigator.vibrate(12)
          break
        case 'impactMedium':
          navigator.vibrate(25)
          break
        case 'impactHeavy':
          navigator.vibrate(40)
          break
        case 'success':
          navigator.vibrate([15, 35, 20])
          break
        case 'warning':
          navigator.vibrate([30, 25, 30])
          break
        case 'error':
          navigator.vibrate([50, 40, 50])
          break
      }
    }
  } catch {
    // Silencia qualquer restrição de sandbox do navegador
  }
}
