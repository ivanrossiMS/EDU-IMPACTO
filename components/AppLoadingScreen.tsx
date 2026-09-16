'use client'

import React from 'react'
import {
  ImpactoCinematicSplash,
  type ImpactoCinematicSplashProps,
} from '@/components/splash/ImpactoCinematicSplash'

export interface AppLoadingScreenProps extends ImpactoCinematicSplashProps {
  statusText?: string
  showFooter?: boolean
}

/**
 * AppLoadingScreen oficial do Impacto EDU.
 * Utiliza o novo motor de renderização cinematográfico com fidelidade geométrica,
 * tipográfica e temporal à identidade visual do aplicativo.
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
