'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import styles from './ImpactoCinematicSplash.module.css'

export interface ImpactoCinematicSplashProps {
  /**
   * 'demo' roda a sequência acelerada de exibição de teste.
   * 'app' coordena a prontidão real da aplicação.
   * 'manual' mantém a tela em exibição contínua sem disparar saída automática.
   */
  mode?: 'demo' | 'app' | 'manual'
  /**
   * No modo 'app', sinaliza que os dados/autenticação/rota estão prontos.
   */
  isReady?: boolean
  /**
   * Impede o desaparecimento (opacity: 0) e redirecionamento, mantendo a tela visível na composição final.
   */
  preventExit?: boolean
  /**
   * Força o disparo manual da convergência dos ícones para a logo.
   */
  triggerConvergence?: boolean
  /**
   * Disparado quando a convergência e finalização terminam no modo 'app'.
   */
  onReadyComplete?: () => void
  /**
   * Disparado ao final da animação no modo 'demo'.
   */
  onDemoFinish?: () => void
  /**
   * Texto de rodapé (padrão: 'Conectando escola e família')
   */
  subtitle?: string
  /**
   * Sobrescreve estilos do container externo
   */
  style?: React.CSSProperties
  className?: string
}

// 8 partículas delicadas distribuídas para profundidade cósmica sutil por toda a viewport
const PARTICLES = [
  { top: '14%', left: '18%', size: 1.8, opacity: 0.45, delay: '0s' },
  { top: '22%', left: '82%', size: 2.2, opacity: 0.6, delay: '1.2s' },
  { top: '36%', left: '12%', size: 1.5, opacity: 0.4, delay: '0.6s' },
  { top: '44%', left: '88%', size: 2.0, opacity: 0.65, delay: '1.8s' },
  { top: '60%', left: '20%', size: 1.8, opacity: 0.5, delay: '2.4s' },
  { top: '66%', left: '80%', size: 2.4, opacity: 0.6, delay: '0.9s' },
  { top: '80%', left: '15%', size: 1.6, opacity: 0.38, delay: '1.5s' },
  { top: '86%', left: '85%', size: 2.0, opacity: 0.55, delay: '2.1s' },
]

export function ImpactoCinematicSplash({
  mode = 'app',
  isReady = false,
  preventExit = false,
  triggerConvergence = false,
  onReadyComplete,
  onDemoFinish,
  subtitle = 'Conectando escola e família',
  style,
  className,
}: ImpactoCinematicSplashProps) {
  const [isConverging, setIsConverging] = useState(false)
  const [isPulseActive, setIsPulseActive] = useState(false)
  const [dotsFadeOut, setDotsFadeOut] = useState(false)
  const [isAnimationFinished, setIsAnimationFinished] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const timersRef = useRef<NodeJS.Timeout[]>([])
  const isDataReadyRef = useRef(isReady)
  const isExitingTriggeredRef = useRef(false)

  // Mantém referência atualizada da prontidão dos dados
  useEffect(() => {
    isDataReadyRef.current = isReady
  }, [isReady])

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
    return t
  }, [])

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  // Função interna para efetuar a saída graciosa da tela
  const triggerExitTransition = useCallback(() => {
    if (isExitingTriggeredRef.current || preventExit) return
    isExitingTriggeredRef.current = true
    setIsExiting(true)

    addTimer(() => {
      onReadyComplete?.()
    }, 350)
  }, [preventExit, onReadyComplete, addTimer])

  // ── REAÇÃO A TRIGGER MANUAL DE CONVERGÊNCIA ──
  useEffect(() => {
    if (triggerConvergence && !isConverging) {
      setIsConverging(true)
      addTimer(() => {
        setIsPulseActive(true)
        setDotsFadeOut(true)
      }, 1200)
    }
  }, [triggerConvergence, isConverging, addTimer])

  // ── MODO DEMONSTRAÇÃO (Sequência única acelerada ~3.5s) ──
  useEffect(() => {
    if (mode !== 'demo') return

    clearAllTimers()
    setIsConverging(false)
    setIsPulseActive(false)
    setDotsFadeOut(false)
    setIsAnimationFinished(false)
    setIsExiting(false)
    isExitingTriggeredRef.current = false

    // 1.8s: Início da convergência fluida dos ícones para a logo
    addTimer(() => {
      setIsConverging(true)
    }, 1800)

    // 3.0s: Pulso luminoso delicado na logo e desaparição dos pontos
    addTimer(() => {
      setIsPulseActive(true)
      setDotsFadeOut(true)
    }, 3000)

    // 3.5s: Animação finalizada (composição estática estável)
    addTimer(() => {
      setIsAnimationFinished(true)
      onDemoFinish?.()
      if (!preventExit) {
        triggerExitTransition()
      }
    }, 3500)

    return () => {
      clearAllTimers()
    }
  }, [mode, preventExit, onDemoFinish, triggerExitTransition, addTimer, clearAllTimers])

  // ── MODO REAL / APLICATIVO (Garantia de Animação Completa Sem Reiniciar) ──
  useEffect(() => {
    if (mode !== 'app') return

    clearAllTimers()
    setIsConverging(false)
    setIsPulseActive(false)
    setDotsFadeOut(false)
    setIsAnimationFinished(false)
    setIsExiting(false)
    isExitingTriggeredRef.current = false

    // 1. Verifica preferência de movimento reduzido
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setIsAnimationFinished(true)
      if (isReady && !preventExit) {
        triggerExitTransition()
      }
      return
    }

    // Abertura inicial acelerada
    // 1.8s: Inicia obrigatoriamente a convergência dos ícones
    addTimer(() => {
      setIsConverging(true)
    }, 1800)

    // 3.0s: Pulso de chegada e ocultação dos pontos de status
    addTimer(() => {
      setIsPulseActive(true)
      setDotsFadeOut(true)
    }, 3000)

    // 3.5s: A animação concluiu sua única passagem completa!
    addTimer(() => {
      setIsAnimationFinished(true)
    }, 3500)

    return () => {
      clearAllTimers()
    }
  }, [mode, addTimer, clearAllTimers, isReady, preventExit, triggerExitTransition])

  // Monitora se tanto a animação quanto o carregamento de dados estão concluídos
  useEffect(() => {
    if (mode !== 'app') return

    // Se a animação já completou sua execução única E os dados estão prontos:
    if (isAnimationFinished && isReady) {
      triggerExitTransition()
    }
  }, [mode, isAnimationFinished, isReady, triggerExitTransition])

  // Pausa/retomada em segundo plano
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Aba em segundo plano
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <div
      className={`${styles.rootContainer} ${className || ''}`}
      style={{
        ...style,
        opacity: isExiting && !preventExit ? 0 : 1,
        transition: isExiting && !preventExit ? 'opacity 0.35s ease-out' : undefined,
      }}
      aria-label="Impacto EDU Carregando"
      role="status"
    >
      {/* ── 1. Atmosfera e Iluminação Cósmica Expandida (100% Tela) ── */}
      <div className={styles.backgroundAtmosphere} />
      <div className={styles.ambientSpotlight} />
      <div className={styles.logoBackdropGlow} />

      {/* Duas linhas curvas verticais delicadas com reflexos viajando (SVG nativo responsivo) */}
      <svg
        className={styles.verticalCurvesSvg}
        viewBox="0 0 720 1280"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {/* Gradiente vertical para suavizar extremidades das curvas */}
          <linearGradient id="curveFadeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0" />
            <stop offset="25%" stopColor="#94a3b8" stopOpacity="0.14" />
            <stop offset="50%" stopColor="#cbd5e1" stopOpacity="0.2" />
            <stop offset="75%" stopColor="#94a3b8" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
          </linearGradient>

          {/* Brilho radial para os reflexos que viajam nas curvas */}
          <radialGradient id="glintGlow">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Curva delicada esquerda */}
        <path
          id="leftCurvePath"
          d="M 195 240 Q 240 530 195 820"
          stroke="url(#curveFadeGradient)"
          strokeWidth="1.1"
          fill="none"
        />

        {/* Curva delicada direita */}
        <path
          id="rightCurvePath"
          d="M 525 240 Q 480 530 525 820"
          stroke="url(#curveFadeGradient)"
          strokeWidth="1.1"
          fill="none"
        />

        {/* Reflexo viajando na curva esquerda */}
        <circle r="2.2" fill="url(#glintGlow)">
          <animateMotion
            dur="9s"
            repeatCount="indefinite"
            path="M 195 240 Q 240 530 195 820"
          />
        </circle>

        {/* Reflexo viajando na curva direita */}
        <circle r="2.2" fill="url(#glintGlow)">
          <animateMotion
            dur="11s"
            repeatCount="indefinite"
            path="M 525 820 Q 480 530 525 240"
          />
        </circle>
      </svg>

      {/* Partículas sutis estelares por toda a extensão da tela */}
      {PARTICLES.map((p, idx) => (
        <div
          key={idx}
          className={styles.particle}
          style={{
            top: p.top,
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDelay: p.delay,
          }}
        />
      ))}

      {/* ── 2. Palco de Conteúdo da Interface ── */}
      <div className={styles.stage}>
        {/* Logo e Squircle Central (50% X, 41.4% Y) */}
        <div className={styles.logoWrapper}>
          <div className={styles.logoSquircle}>
            <img
              src="/logo-impacto.png"
              alt="Impacto EDU"
              className={styles.logoImage}
              width={120}
              height={120}
              decoding="sync"
              loading="eager"
              fetchPriority="high"
              draggable={false}
            />
            {/* Shimmer translúcido sutil */}
            <div className={styles.logoShimmer} aria-hidden="true" />
          </div>
        </div>

        {/* Pulso luminoso da logo na chegada dos ícones */}
        <div
          className={`${styles.logoArrivalPulse} ${
            isPulseActive ? styles.logoArrivalPulseActive : ''
          }`}
          aria-hidden="true"
        />

        {/* ── 3. Tipografia Oficial ── */}
        <div className={styles.textGroup}>
          <span className={styles.titleImpacto}>IMPACTO</span>
          <span className={styles.subtitleEdu}>E D U</span>
        </div>

        {/* ── 4. Três Ícones Escolares (Livro, Capelo, Lápis a 72% Y) ── */}
        <div className={styles.iconsRow}>
          {/* 1. Livro (esquerda) */}
          <div
            className={`${styles.iconItem} ${styles.iconItemBook} ${
              isConverging ? styles.convergeBook : ''
            }`}
          >
            <div className={styles.iconInnerFloat1}>
              <IconBook />
            </div>
          </div>

          {/* 2. Capelo (centro) */}
          <div
            className={`${styles.iconItem} ${styles.iconItemCap} ${
              isConverging ? styles.convergeCap : ''
            }`}
          >
            <div className={styles.iconInnerFloat2}>
              <IconCapelo />
            </div>
          </div>

          {/* 3. Lápis (direita) */}
          <div
            className={`${styles.iconItem} ${styles.iconItemPencil} ${
              isConverging ? styles.convergePencil : ''
            }`}
          >
            <div className={styles.iconInnerFloat3}>
              <IconPencil />
            </div>
          </div>
        </div>

        {/* ── 5. Três Pontos de Status (· · ·) ── */}
        <div
          className={`${styles.statusDots} ${
            dotsFadeOut ? styles.statusDotsFadeOut : ''
          }`}
          aria-hidden="true"
        >
          <span className={`${styles.dot} ${styles.dotPulse1}`} />
          <span className={`${styles.dot} ${styles.dotPulse2}`} />
          <span className={`${styles.dot} ${styles.dotPulse3}`} />
        </div>

        {/* ── 6. Frase Inferior (84% Y) ── */}
        <div className={styles.footerPhrase}>{subtitle}</div>
      </div>
    </div>
  )
}

// ── Ícones Vetoriais SVG (Traço fino metálico correspondente ao vídeo) ──

function IconBook() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      {/* Livro aberto simétrico com páginas curvas delicadas */}
      <path d="M12 6.5C9.5 5.2 5.5 5.2 3 6.4V18.2C5.5 17 9.5 17 12 18.2V6.5Z" />
      <path d="M12 6.5C14.5 5.2 18.5 5.2 21 6.4V18.2C18.5 17 14.5 17 12 18.2V6.5Z" />
    </svg>
  )
}

function IconCapelo() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      {/* Capelo / Mortarboard com pingente */}
      <polygon points="12 4.5 22 9.5 12 14.5 2 9.5" />
      <path d="M6 11.5V15.5C6 17.5 8.7 19.2 12 19.2C15.3 19.2 18 17.5 18 15.5V11.5" />
      <path d="M22 9.5V15" />
      <circle cx="22" cy="15.6" r="0.6" fill="currentColor" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      {/* Lápis inclinado a 45º */}
      <path d="M17.8 3.6L20.4 6.2L7.6 19L4 20L5 16.4L17.8 3.6Z" />
      <line x1="15.2" y1="6.2" x2="17.8" y2="8.8" />
    </svg>
  )
}
