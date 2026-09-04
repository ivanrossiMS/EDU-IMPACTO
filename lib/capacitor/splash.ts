import { Capacitor } from '@capacitor/core'

let isHidden = false

export async function hideSplashScreen(fadeOutDuration = 350): Promise<void> {
  if (typeof window === 'undefined' || isHidden) return
  if (!Capacitor.isNativePlatform()) return

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide({ fadeOutDuration })
    isHidden = true
  } catch (err) {
    // Falha silenciosa em ambientes onde o plugin não responde
    console.debug('[SplashScreen] hideSplashScreen error:', err)
  }
}
