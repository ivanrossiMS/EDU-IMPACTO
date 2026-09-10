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
        {/* 1. Halo circular suave de iluminação */}
        <div className={styles.halo} />

        {/* 2. Órbita magnética externa (sentido horário, 1.45s) */}
        <div className={styles.orbitOuter} />

        {/* 3. Órbita magnética interna (sentido anti-horário, 0.92s) */}
        <div className={styles.orbitInner} />

        {/* 4. Partículas neon orbitais */}
        <div className={styles.particleLayer}>
          <span className={`${styles.particle} ${styles.dot1}`} />
          <span className={`${styles.particle} ${styles.dot2}`} />
          <span className={`${styles.particle} ${styles.dot3}`} />
          <span className={`${styles.particle} ${styles.dot4}`} />
          <span className={`${styles.particle} ${styles.dot5}`} />
          <span className={`${styles.particle} ${styles.dot6}`} />
        </div>

        {/* 5. Logo oficial 70 x 70 px (cantos 20px) com pulso 0.97 a 1.035 e inclinação ±1° */}
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
