'use client'

import React, { useEffect, useState } from 'react'
import Script from 'next/script'
import { Capacitor } from '@capacitor/core'

/**
 * Carrega o OneSignal Web SDK exclusivamente no ambiente de navegador Desktop / Web.
 * Em ambientes nativos (iOS e Android), as notificações push são gerenciadas
 * de forma dedicada pelo @onesignal/capacitor-plugin, eliminando conflitos de service worker
 * e downloads redundantes de 200KB no WebView.
 */
export function OneSignalWebScript() {
  const [isWeb, setIsWeb] = useState(false)

  useEffect(() => {
    try {
      if (!Capacitor.isNativePlatform()) {
        setIsWeb(true)
      }
    } catch {
      setIsWeb(true)
    }
  }, [])

  if (!isWeb) return null

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
    />
  )
}
