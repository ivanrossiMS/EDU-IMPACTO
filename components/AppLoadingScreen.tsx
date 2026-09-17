'use client'

import React, { useEffect, useState } from 'react'
import {
  ImpactoCinematicSplash,
  type ImpactoCinematicSplashProps,
} from '@/components/splash/ImpactoCinematicSplash'
import { useIsMobileVersion } from '@/lib/utils/isMobileVersion'

export interface AppLoadingScreenProps extends ImpactoCinematicSplashProps {
  statusText?: string
  showFooter?: boolean
}

/**
 * AppLoadingScreen oficial do Impacto EDU.
 * Utiliza o novo motor de renderização cinematográfico com fidelidade geométrica,
 * tipográfica e temporal à identidade visual do aplicativo.
 * 
 * Regra: Só é exibido na versão mobile (app nativo ou smartphone).
 * No desktop, não renderiza tela de abertura e finaliza a prontidão imediatamente.
 */
export function AppLoadingScreen({
  mode = 'app',
  isReady = false,
  onReadyComplete,
  onDemoFinish,
  subtitle = 'Conectando escola e família',
  style,
  className,
}: AppLoadingScreenProps) {
  const [mounted, setMounted] = useState(false)
  const isMobile = useIsMobileVersion()

  useEffect(() => {
    setMounted(true)
  }, [])

  // No desktop e fora do modo demo, conclui a transição de imediato assim que os dados estiverem prontos
  useEffect(() => {
    if (mounted && !isMobile && mode !== 'demo') {
      if (isReady && onReadyComplete) {
        onReadyComplete()
      }
    }
  }, [mounted, isMobile, mode, isReady, onReadyComplete])

  // No modo demonstração explícito, sempre exibe para testes
  if (mode === 'demo') {
    return (
      <ImpactoCinematicSplash
        mode="demo"
        isReady={isReady}
        onReadyComplete={onReadyComplete}
        onDemoFinish={onDemoFinish}
        subtitle={subtitle}
        style={style}
        className={className}
      />
    )
  }

  // Não renderiza antes da hidratação ou no ambiente desktop
  if (!mounted || !isMobile) {
    return null
  }

  return (
    <ImpactoCinematicSplash
      mode={mode}
      isReady={isReady}
      onReadyComplete={onReadyComplete}
      onDemoFinish={onDemoFinish}
      subtitle={subtitle}
      style={style}
      className={className}
    />
  )
}
