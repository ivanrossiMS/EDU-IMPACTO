'use client'

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Detecta de forma síncrona no cliente se o ambiente atual é a versão mobile:
 * 1. App nativo Capacitor (Android ou iOS)
 * 2. User Agent de smartphone / tablet móvel
 * 3. Largura de viewport mobile (< 768px)
 */
export function isMobileVersion(): boolean {
  if (typeof window === 'undefined') return false

  // 1. App nativo Capacitor (Android ou iOS)
  try {
    if (Capacitor.isNativePlatform()) return true
  } catch {}

  // 2. User Agent de dispositivo móvel
  try {
    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : ''
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    const isTouchMac = typeof navigator !== 'undefined' && /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1

    if (isMobileUA || isTouchMac) return true
  } catch {}

  // 3. Viewport com largura típica de celular (< 768px)
  try {
    if (window.innerWidth < 768) return true
  } catch {}

  return false
}

/**
 * Hook React seguro contra Hydration Mismatch que monitora
 * se a aplicação está sendo executada na versão mobile ou desktop.
 */
export function useIsMobileVersion(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    const check = () => {
      setIsMobile(isMobileVersion())
    }

    const debouncedCheck = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(check, 100)
    }

    check()
    window.addEventListener('resize', debouncedCheck)
    window.addEventListener('orientationchange', check)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedCheck)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  return isMobile
}
