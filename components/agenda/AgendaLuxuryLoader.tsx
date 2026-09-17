'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import styles from './AgendaLuxuryLoader.module.css'
import { IMPACTO_LOGO_DATA_URI } from '@/components/ui/impactoLogoBase64'

export interface AgendaLuxuryLoaderProps {
  isLoading?: boolean
  statusText?: string
  minDisplayTimeMs?: number
  onFinished?: () => void
  preventExit?: boolean
  className?: string
  style?: React.CSSProperties
}


export function AgendaLuxuryLoader({
  isLoading = true,
  statusText = 'Carregando página e dados...',
  minDisplayTimeMs = 650,
  onFinished,
  preventExit = false,
  className,
  style,
}: AgendaLuxuryLoaderProps) {
  const [shouldRender, setShouldRender] = useState(isLoading)
  const [visible, setVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const mountTimestampRef = useRef<number>(Date.now())
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const minTimerRef = useRef<NodeJS.Timeout | null>(null)
  const onFinishedRef = useRef(onFinished)

  useEffect(() => {
    onFinishedRef.current = onFinished
  }, [onFinished])

  // Clear timers on unmount
  const clearTimers = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
    if (minTimerRef.current) {
      clearTimeout(minTimerRef.current)
      minTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  // Triggers exit transition
  const triggerExit = useCallback(() => {
    if (preventExit) return

    setIsExiting(true)
    exitTimerRef.current = setTimeout(() => {
      setShouldRender(false)
      setIsExiting(false)
      setVisible(false)
      onFinishedRef.current?.()
    }, 360) // Matches CSS transition duration
  }, [preventExit])

  useEffect(() => {
    if (isLoading) {
      clearTimers()
      mountTimestampRef.current = Date.now()
      setShouldRender(true)
      setIsExiting(false)
      
      // RequestAnimationFrame to guarantee CSS opacity transition triggers
      const raf = requestAnimationFrame(() => {
        setVisible(true)
      })
      return () => cancelAnimationFrame(raf)
    } else {
      if (!shouldRender) return

      const elapsed = Date.now() - mountTimestampRef.current
      const remainingTime = Math.max(0, minDisplayTimeMs - elapsed)

      if (remainingTime > 0) {
        minTimerRef.current = setTimeout(() => {
          triggerExit()
        }, remainingTime)
      } else {
        triggerExit()
      }
    }
  }, [isLoading, minDisplayTimeMs, shouldRender, clearTimers, triggerExit])

  if (!shouldRender) return null

  return (
    <div
      className={`${styles.overlay} ${visible ? styles.visible : ''} ${isExiting ? styles.exiting : ''} ${className || ''}`}
      style={style}
      role="status"
      aria-label="Carregando Agenda Digital"
    >

      {/* ── 2. Palco Central ── */}
      <div className={styles.stage}>
        {/* ── 3. Emblema da Logo com Órbitas a Laser ── */}
        <div className={styles.emblemWrapper}>
          {/* Halo difuso de luz */}
          <div className={styles.emblemHalo} />

          {/* Órbita Giroscópica Externa (1.5px) */}
          <div className={styles.orbitOuter} />

          {/* Órbita Giroscópica Interna (1.2px) */}
          <div className={styles.orbitInner} />

          {/* Satélites de micro-cintilação */}
          <div className={styles.satelliteLayer}>
            <span className={styles.satellite1} />
            <span className={styles.satellite2} />
          </div>

          {/* Squircle da Logo Oficial em Vidro Chanfrado */}
          <div className={styles.logoCard}>
            <img
              src={IMPACTO_LOGO_DATA_URI}
              alt="Colégio Impacto"
              className={styles.logoImage}
              width={70}
              height={70}
              decoding="sync"
              loading="eager"
              fetchPriority="high"
              draggable={false}
            />
            {/* Shimmer diagonal cristalino */}
            <div className={styles.shimmerSweep} aria-hidden="true" />
          </div>
        </div>

        {/* ── 4. Tipografia e Identidade Visual ── */}
        <div className={styles.titleWrapper}>
          <h2 className={styles.brandTitle}>IMPACTO</h2>
          <div className={styles.brandSubtitle}>
            <span>AGENDA DIGITAL</span>
          </div>
        </div>

        {/* ── 5. Barra Líquida Fina de Carregamento ── */}
        <div className={styles.progressTrack} aria-hidden="true">
          <div className={styles.progressBarFluid} />
        </div>

        {/* ── 6. Micro-texto de Status Dinâmico ── */}
        <div className={styles.statusText} aria-live="polite">
          {statusText}
        </div>
      </div>
    </div>
  )
}
