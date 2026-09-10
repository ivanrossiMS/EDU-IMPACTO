'use client'

import React, { useEffect, useState } from 'react'
import styles from './ImpactoLoader.module.css'

export interface ImpactoLoaderProps {
  isLoading?: boolean
  className?: string
  style?: React.CSSProperties
}

export function ImpactoLoader({
  isLoading = true,
  className,
  style,
}: ImpactoLoaderProps) {
  const [shouldRender, setShouldRender] = useState(isLoading)
  const [visible, setVisible] = useState(isLoading)

  useEffect(() => {
    let animFrame: number | null = null
    let timeoutId: NodeJS.Timeout | null = null

    if (isLoading) {
      setShouldRender(true)
      animFrame = requestAnimationFrame(() => {
        setVisible(true)
      })
    } else {
      setVisible(false)
      timeoutId = setTimeout(() => {
        setShouldRender(false)
      }, 200)
    }

    return () => {
      if (animFrame !== null) {
        cancelAnimationFrame(animFrame)
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [isLoading])

  if (!shouldRender) return null

  return (
    <div
      className={`${styles.overlay} ${visible ? styles.visible : styles.hidden} ${className || ''}`}
      style={style}
      aria-hidden="true"
    >
      <div className={styles.container}>
        {/* 1. Aura radial suave de fundo */}
        <div className={styles.aura} />

        {/* 2. Indicador circular fino de conic-gradient ao redor da logo */}
        <div className={styles.circularArc} />

        {/* 3. Pontos neon com órbita assíncrona */}
        <div className={styles.neonOrbit}>
          <span className={`${styles.neonDot} ${styles.dot1}`} />
          <span className={`${styles.neonDot} ${styles.dot2}`} />
          <span className={`${styles.neonDot} ${styles.dot3}`} />
          <span className={`${styles.neonDot} ${styles.dot4}`} />
          <span className={`${styles.neonDot} ${styles.dot5}`} />
          <span className={`${styles.neonDot} ${styles.dot6}`} />
        </div>

        {/* 4. Logo Oficial 100 x 100 px em squircle animado com reflexo luminoso */}
        <div className={styles.logoCard}>
          <img
            src="/logo-impacto.png"
            alt=""
            className={styles.logoImage}
            draggable={false}
          />
          <div className={styles.shineOverlay} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
