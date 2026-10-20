import { Capacitor } from '@capacitor/core'

export type HapticType = 
  | 'impactLight' 
  | 'impactMedium' 
  | 'impactHeavy' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'selection'

let cachedHapticsModule: typeof import('@capacitor/haptics') | null = null
let lastLightHapticAt = 0

// Pré-carrega e registra o plugin Haptics no cliente para resposta instantânea (0ms)
if (typeof window !== 'undefined') {
  import('@capacitor/haptics')
    .then((mod) => {
      cachedHapticsModule = mod
    })
    .catch(() => {
      // Ignora silenciosamente caso o módulo não possa ser carregado
    })
}

/**
 * Dispara uma vibração háptica tátil no dispositivo.
 * Suporta nativamente iOS/Android via Capacitor Haptics (quando disponível)
 * com fallback gracioso para navigator.vibrate em Webview/PWA.
 */
export async function triggerHaptic(type: HapticType = 'impactLight'): Promise<void> {
  if (typeof window === 'undefined') return

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const isLightOrSelection = type === 'impactLight' || type === 'selection'

  // Evita vibração duplicada quando pointerdown global e onClick local disparam no mesmo toque
  if (isLightOrSelection && now - lastLightHapticAt < 120) {
    return
  }
  lastLightHapticAt = now

  try {
    if (Capacitor.isNativePlatform()) {
      const hapticsModule =
        cachedHapticsModule || (await import('@capacitor/haptics').catch(() => null))
      if (hapticsModule) {
        cachedHapticsModule = hapticsModule
        const { Haptics, ImpactStyle, NotificationType } = hapticsModule
        switch (type) {
          case 'impactLight':
          case 'selection':
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
