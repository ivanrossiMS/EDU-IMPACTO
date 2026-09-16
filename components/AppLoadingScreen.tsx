'use client'

import React, { useEffect, useState, useRef } from 'react'
import { IMPACTO_NEON_LOGO_DATA_URI } from '@/components/ui/impactoNeonLogoBase64'

export interface AppLoadingScreenProps {
  statusText?: string
  subtitle?: string
  showFooter?: boolean
  style?: React.CSSProperties
  isReady?: boolean
  onFinish?: () => void
  onRetry?: () => void
  timeoutMs?: number
}

// Posições e tempos das partículas neon espalhadas pelo fundo (fiel à referência)
const NEON_DOTS = [
  { top: '10%', left: '22%', size: 2.5, color: '#38bdf8', opacity: 0.85, delay: '0s', dur: '3.2s' },
  { top: '8%',  left: '58%', size: 2,   color: '#60a5fa', opacity: 0.7,  delay: '1.4s', dur: '4.0s' },
  { top: '14%', left: '82%', size: 2.5, color: '#c084fc', opacity: 0.8,  delay: '0.6s', dur: '3.6s' },
  { top: '22%', left: '15%', size: 2,   color: '#38bdf8', opacity: 0.6,  delay: '2.1s', dur: '4.4s' },
  { top: '25%', left: '91%', size: 3,   color: '#38bdf8', opacity: 0.9,  delay: '1.8s', dur: '3.5s', glint: true },
  { top: '35%', left: '18%', size: 2.5, color: '#c084fc', opacity: 0.65, delay: '0.9s', dur: '3.8s' },
  { top: '42%', left: '86%', size: 2,   color: '#60a5fa', opacity: 0.7,  delay: '2.7s', dur: '4.2s' },
  { top: '54%', left: '12%', size: 3,   color: '#38bdf8', opacity: 0.85, delay: '0.4s', dur: '3.4s', glint: true },
  { top: '60%', left: '88%', size: 2.5, color: '#c084fc', opacity: 0.7,  delay: '1.6s', dur: '4.1s' },
  { top: '70%', left: '24%', size: 2,   color: '#60a5fa', opacity: 0.6,  delay: '2.3s', dur: '3.7s' },
  { top: '76%', left: '78%', size: 3,   color: '#38bdf8', opacity: 0.9,  delay: '1.1s', dur: '3.9s', glint: true },
  { top: '82%', left: '14%', size: 2.5, color: '#c084fc', opacity: 0.7,  delay: '0.8s', dur: '4.3s' },
  { top: '88%', left: '84%', size: 2,   color: '#60a5fa', opacity: 0.65, delay: '2.5s', dur: '3.5s' },
  { top: '92%', left: '32%', size: 2.5, color: '#38bdf8', opacity: 0.8,  delay: '1.9s', dur: '4.5s' },
]

export function AppLoadingScreen({
  statusText,
  subtitle = 'Conectando escola e família',
  showFooter = false,
  style = {},
  isReady = false,
  onFinish,
  onRetry,
  timeoutMs = 8000,
}: AppLoadingScreenProps) {
  // Estados da máquina de animação:
  // 'entering' -> 'loading' -> 'converging' -> 'pulse' -> 'exiting' -> unmounted
  const [animPhase, setAnimPhase] = useState<'entering' | 'loading' | 'converging' | 'pulse' | 'exiting'>('entering')
  const [showTimeoutNotice, setShowTimeoutNotice] = useState(false)
  const finishCalledRef = useRef(false)

  // 1. Transição de entrada
  useEffect(() => {
    const t = setTimeout(() => {
      setAnimPhase(prev => (prev === 'entering' ? 'loading' : prev))
    }, 450)
    return () => clearTimeout(t)
  }, [])

  // 2. Timer de segurança / recuperação de falha
  useEffect(() => {
    if (isReady) return
    const timeoutTimer = setTimeout(() => {
      setShowTimeoutNotice(true)
    }, timeoutMs)
    return () => clearTimeout(timeoutTimer)
  }, [isReady, timeoutMs])

  // 3. Resposta ao sinal real de prontidão (Convergência dos ícones)
  useEffect(() => {
    if (!isReady) return

    // Fecha aviso de timeout se estava aberto
    setShowTimeoutNotice(false)

    // Fase 1: Ícones orbitais convergem para o centro da logo (400ms)
    setAnimPhase('converging')

    const pulseTimer = setTimeout(() => {
      // Fase 2: Pulso suave de luz expandindo do centro (260ms)
      setAnimPhase('pulse')

      const exitTimer = setTimeout(() => {
        // Fase 3: Fade-out suave da tela inteira (280ms)
        setAnimPhase('exiting')

        const finishTimer = setTimeout(() => {
          if (!finishCalledRef.current) {
            finishCalledRef.current = true
            onFinish?.()
          }
        }, 280)
        return () => clearTimeout(finishTimer)
      }, 260)
      return () => clearTimeout(exitTimer)
    }, 400)

    return () => clearTimeout(pulseTimer)
  }, [isReady, onFinish])

  const isConverging = animPhase === 'converging' || animPhase === 'pulse' || animPhase === 'exiting'
  const isPulse = animPhase === 'pulse' || animPhase === 'exiting'
  const isExiting = animPhase === 'exiting'

  return (
    <div
      role="status"
      aria-label="Carregando aplicativo Impacto EDU"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#071536',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: 'none',
        WebkitUserSelect: 'none',
        zIndex: 99999999,
        overflow: 'hidden',
        padding: 'max(24px, env(safe-area-inset-top, 24px)) 24px max(24px, env(safe-area-inset-bottom, 24px))',
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: isExiting ? 'none' : 'auto',
        ...style,
      }}
    >
      {/* ── 1. Fundo com gradiente radial sutil e vinheta cinematográfica ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 42%, #0d2258 0%, #08173e 50%, #050d24 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Brilho atmosférico central suave atrás da logo */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(168, 85, 247, 0.12) 40%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      {/* ── 2. Grade de circuitos de precisão vetorial (SVG) ── */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="circuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.14" />
            <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.12" />
          </linearGradient>

          <linearGradient id="pulseSignalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Linhas principais do circuito (baixo contraste, estética tecnológica refinada) */}
        <g stroke="url(#circuitGrad)" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke">
          {/* Trilha Superior Esquerda */}
          <path d="M 40,0 L 40,160 L 85,205 L 85,320" />
          <path d="M 85,205 L 140,205" />
          
          {/* Trilha Superior Direita */}
          <path d="M 320,0 L 320,120 L 280,160 L 280,260" />
          
          {/* Trilha Meio Esquerda com ramificação 45º */}
          <path d="M 0,380 L 70,380 L 110,420 L 110,540" />

          {/* Trilha Meio Direita */}
          <path d="M 360,340 L 300,340 L 260,380 L 260,500 L 300,540" />

          {/* Trilha Inferior Esquerda */}
          <path d="M 60,600 L 60,720 L 110,770 L 110,900" />
          
          {/* Trilha Inferior Direita */}
          <path d="M 330,620 L 330,740 L 290,780 L 290,900" />
        </g>

        {/* Sinais luminosos percorrendo os circuitos */}
        <g stroke="#38bdf8" strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path
            d="M 40,0 L 40,160 L 85,205 L 85,320"
            className="circuit-pulse-1"
          />
          <path
            d="M 320,0 L 320,120 L 280,160 L 280,260"
            className="circuit-pulse-2"
          />
          <path
            d="M 0,380 L 70,380 L 110,420 L 110,540"
            className="circuit-pulse-3"
          />
          <path
            d="M 360,340 L 300,340 L 260,380 L 260,500"
            className="circuit-pulse-4"
          />
        </g>

        {/* Nós e micro-chips em cruzamentos do circuito (fiel à imagem) */}
        {/* Nó superior esquerdo */}
        <g transform="translate(77, 197)" stroke="rgba(56, 189, 248, 0.28)" fill="none" strokeWidth="1">
          <rect x="0" y="0" width="16" height="16" rx="4" />
          <circle cx="8" cy="8" r="2" fill="#38bdf8" fillOpacity="0.4" />
        </g>

        {/* Nó inferior direito */}
        <g transform="translate(282, 772)" stroke="rgba(56, 189, 248, 0.28)" fill="none" strokeWidth="1">
          <rect x="0" y="0" width="16" height="16" rx="4" />
          <circle cx="8" cy="8" r="2" fill="#38bdf8" fillOpacity="0.4" />
        </g>

        {/* Micro-chip de canto inferior esquerdo */}
        <g transform="translate(48, 708)" stroke="rgba(192, 132, 252, 0.25)" fill="none" strokeWidth="1">
          <rect x="0" y="0" width="24" height="24" rx="5" />
          <path d="M 4,0 L 4,-4 M 12,0 L 12,-4 M 20,0 L 20,-4" />
          <path d="M 4,24 L 4,28 M 12,24 L 12,28 M 20,24 L 20,28" />
          <circle cx="12" cy="12" r="2.5" fill="#c084fc" fillOpacity="0.5" />
        </g>

        {/* Micro-chip de canto inferior direito */}
        <g transform="translate(318, 608)" stroke="rgba(56, 189, 248, 0.25)" fill="none" strokeWidth="1">
          <rect x="0" y="0" width="24" height="24" rx="5" />
          <path d="M 0,6 L -4,6 M 0,12 L -4,12 M 0,18 L -4,18" />
          <path d="M 24,6 L 28,6 M 24,12 L 28,12 M 24,18 L 28,18" />
          <circle cx="12" cy="12" r="2.5" fill="#38bdf8" fillOpacity="0.5" />
        </g>

        {/* Marcas d'água escolares fantasma no fundo (traço ultra sutil) */}
        {/* Livro aberto sutil na direita superior */}
        <g transform="translate(270, 115) scale(0.65)" stroke="rgba(56, 189, 248, 0.07)" fill="none" strokeWidth="1.2">
          <path d="M 2 4 C 10 2, 18 4, 24 8 C 30 4, 38 2, 46 4 L 46 32 C 38 30, 30 32, 24 36 C 18 32, 10 30, 2 32 Z" />
          <line x1="24" y1="8" x2="24" y2="36" />
        </g>

        {/* Livro aberto sutil na direita média */}
        <g transform="translate(315, 450) scale(0.55)" stroke="rgba(56, 189, 248, 0.06)" fill="none" strokeWidth="1.2">
          <path d="M 2 4 C 10 2, 18 4, 24 8 C 30 4, 38 2, 46 4 L 46 32 C 38 30, 30 32, 24 36 C 18 32, 10 30, 2 32 Z" />
          <line x1="24" y1="8" x2="24" y2="36" />
        </g>
      </svg>

      {/* ── 3. Partículas / Pontos Neon Flutuantes ── */}
      {NEON_DOTS.map((dot, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            top: dot.top,
            left: dot.left,
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            borderRadius: '50%',
            backgroundColor: dot.color,
            boxShadow: `0 0 ${dot.size * 3}px ${dot.color}, 0 0 ${dot.size * 6}px ${dot.color}`,
            opacity: dot.opacity,
            animation: `neonTwinkle ${dot.dur} ease-in-out infinite`,
            animationDelay: dot.delay,
            pointerEvents: 'none',
          }}
        >
          {/* Brilho em cruz de 4 pontas para as estrelas principais */}
          {dot.glint && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: `${dot.size * 5}px`,
                height: `${dot.size * 5}px`,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: '50%',
                  width: '1px',
                  transform: 'translateX(-50%)',
                  background: `linear-gradient(to bottom, transparent, ${dot.color}, transparent)`,
                  opacity: 0.75,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '50%',
                  height: '1px',
                  transform: 'translateY(-50%)',
                  background: `linear-gradient(to right, transparent, ${dot.color}, transparent)`,
                  opacity: 0.75,
                }}
              />
            </div>
          )}
        </div>
      ))}

      {/* ── 4. Bloco Central: Logo e Órbita de Ícones Escolares ── */}
      <div
        style={{
          position: 'relative',
          width: '230px',
          height: '230px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '28px',
        }}
      >
        {/* Anel orbital elíptico sutil (visível ao fundo) */}
        <div
          style={{
            position: 'absolute',
            width: '204px',
            height: '166px',
            borderRadius: '50%',
            border: '1px solid rgba(56, 189, 248, 0.22)',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.08)',
            pointerEvents: 'none',
            opacity: isConverging ? 0 : 1,
            transition: 'opacity 0.35s ease',
          }}
        />

        {/* Órbita ativa contínua que carrega os 3 ícones escolares */}
        <div
          className="orbit-track"
          style={{
            position: 'absolute',
            width: '204px',
            height: '166px',
            pointerEvents: 'none',
            animation: 'orbitRotate 14s linear infinite',
          }}
        >
          {/* ÍCONE 1: LÁPIS (posição inicial topo-esquerda, ~300º) */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'rotate(-60deg)',
            }}
          >
            <div
              className={`school-icon-wrapper ${isConverging ? 'converging' : ''}`}
              style={{
                transform: isConverging
                  ? 'translate(0px, 0px) scale(0.2)'
                  : 'translate(0px, -83px) scale(1)',
                opacity: isConverging ? 0 : 1,
                transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.38s ease',
              }}
            >
              {/* O contra-giro mantém o ícone legível e perfeitamente orientado */}
              <div style={{ animation: 'counterRotate 14s linear infinite' }}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#bae6fd"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))',
                  }}
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </div>
            </div>
          </div>

          {/* ÍCONE 2: LIVRO ABERTO (posição inicial direita, ~60º) */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'rotate(60deg)',
            }}
          >
            <div
              className={`school-icon-wrapper ${isConverging ? 'converging' : ''}`}
              style={{
                transform: isConverging
                  ? 'translate(0px, 0px) scale(0.2)'
                  : 'translate(0px, -83px) scale(1)',
                opacity: isConverging ? 0 : 1,
                transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.38s ease',
              }}
            >
              <div style={{ animation: 'counterRotate 14s linear infinite' }}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#bae6fd"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))',
                  }}
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* ÍCONE 3: CAPELO DE GRADUAÇÃO (posição inicial base-centro, ~180º) */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'rotate(180deg)',
            }}
          >
            <div
              className={`school-icon-wrapper ${isConverging ? 'converging' : ''}`}
              style={{
                transform: isConverging
                  ? 'translate(0px, 0px) scale(0.2)'
                  : 'translate(0px, -83px) scale(1)',
                opacity: isConverging ? 0 : 1,
                transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.38s ease',
              }}
            >
              <div style={{ animation: 'counterRotate 14s linear infinite' }}>
                <svg
                  width="25"
                  height="25"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#bae6fd"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))',
                  }}
                >
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Halo de luz suave atrás da logo oficial */}
        <div
          style={{
            position: 'absolute',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.32) 0%, rgba(192, 132, 252, 0.2) 45%, transparent 72%)',
            filter: 'blur(16px)',
            pointerEvents: 'none',
            transform: isConverging ? 'scale(1.2)' : 'scale(1)',
            transition: 'transform 0.4s ease',
          }}
        />

        {/* Pulso de luz final expansivo (disparado ao convergir na prontidão) */}
        {isPulse && (
          <div
            style={{
              position: 'absolute',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              border: '2px solid rgba(56, 189, 248, 0.9)',
              boxShadow: '0 0 28px rgba(56, 189, 248, 0.85), inset 0 0 20px rgba(192, 132, 252, 0.6)',
              animation: 'finishPulse 0.35s cubic-bezier(0.1, 0.8, 0.2, 1) forwards',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}

        {/* ── CARD CENTRAL DA LOGO OFICIAL ── */}
        <div
          style={{
            position: 'relative',
            width: '84px',
            height: '84px',
            borderRadius: '22px',
            backgroundColor: '#ffffff',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55), 0 0 24px rgba(56, 189, 248, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            zIndex: 5,
            animation: 'logoEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            transform: isPulse ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.25s ease',
          }}
        >
          <img
            src={IMPACTO_NEON_LOGO_DATA_URI}
            alt="Impacto EDU"
            width={84}
            height={84}
            decoding="sync"
            loading="eager"
            fetchPriority="high"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
            draggable={false}
          />

          {/* Brilho metálico diagonal sofisticado (Sheen Pass) */}
          <div
            style={{
              position: 'absolute',
              top: '-60%',
              left: '-60%',
              width: '220%',
              height: '220%',
              background: 'linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.3) 48%, rgba(56, 189, 248, 0.35) 52%, transparent 60%)',
              pointerEvents: 'none',
              animation: 'sheenSlide 4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            }}
          />
        </div>
      </div>

      {/* ── 5. Tipografia e Identidade Visual Fiel à Referência ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 6,
          animation: 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
        }}
      >
        {/* Título: I M P A C T O */}
        <h1
          style={{
            margin: 0,
            fontSize: '25px',
            fontWeight: 700,
            letterSpacing: '0.42em',
            textIndent: '0.42em',
            color: '#ffffff',
            lineHeight: 1.1,
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.5)',
          }}
        >
          IMPACTO
        </h1>

        {/* Sub-rótulo: E D U */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.44em',
            textIndent: '0.44em',
            color: '#93c5fd',
            marginTop: '8px',
            lineHeight: 1,
            textShadow: '0 0 12px rgba(147, 197, 253, 0.4)',
          }}
        >
          EDU
        </div>

        {/* Subtítulo: Conectando escola e família */}
        <div
          style={{
            fontSize: '13.5px',
            fontWeight: 400,
            letterSpacing: '0.02em',
            color: 'rgba(255, 255, 255, 0.62)',
            marginTop: '16px',
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* ── 6. Barra de Progresso Indeterminada e Texto CARREGANDO ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '36px',
          zIndex: 6,
          animation: 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both',
        }}
      >
        {/* Trilho da barra de progresso indeterminada */}
        <div
          style={{
            width: '160px',
            height: '2px',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            borderRadius: '999px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '64px',
              background: 'linear-gradient(90deg, transparent 0%, #38bdf8 50%, #c084fc 80%, transparent 100%)',
              borderRadius: '999px',
              boxShadow: '0 0 8px rgba(56, 189, 248, 0.7)',
              animation: 'indeterminateTrack 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            }}
          />
        </div>

        {/* Texto: CARREGANDO ou status customizado */}
        <span
          style={{
            fontSize: '9.5px',
            fontWeight: 600,
            letterSpacing: '0.36em',
            textIndent: '0.36em',
            color: 'rgba(255, 255, 255, 0.44)',
            textTransform: 'uppercase',
            marginTop: '12px',
          }}
        >
          {statusText ? statusText.toUpperCase() : 'CARREGANDO'}
        </span>
      </div>

      {/* Rodapé opcional (ativo apenas quando explicitamente solicitado via showFooter) */}
      {showFooter && (
        <div
          style={{
            position: 'absolute',
            bottom: 'max(20px, env(safe-area-inset-bottom, 16px))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: 'rgba(255, 255, 255, 0.35)',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span>AMBIENTE PROTEGIDO</span>
        </div>
      )}

      {/* ── 7. Tratamento gracioso de timeout / rede lenta (Resiliência) ── */}
      {showTimeoutNotice && (
        <div
          style={{
            position: 'absolute',
            bottom: 'max(32px, env(safe-area-inset-bottom, 24px))',
            left: '24px',
            right: '24px',
            maxWidth: '360px',
            margin: '0 auto',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '16px',
            padding: '16px 20px',
            textAlign: 'center',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
            animation: 'fadeUp 0.3s ease-out both',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px', lineHeight: 1.4 }}>
            A conexão está demorando mais do que o esperado.
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                if (onRetry) {
                  onRetry()
                } else {
                  window.location.reload()
                }
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              }}
            >
              Tentar novamente
            </button>
            <button
              onClick={() => {
                window.location.replace('/login')
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Ir para o Login
            </button>
          </div>
        </div>
      )}

      {/* ── 8. CSS Keyframes de alta performance (Transform e Opacity) ── */}
      <style>{`
        @keyframes orbitRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes counterRotate {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes logoEntrance {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes sheenSlide {
          0% {
            transform: translateX(-120%) rotate(25deg);
            opacity: 0;
          }
          12% {
            opacity: 0.9;
          }
          32% {
            transform: translateX(120%) rotate(25deg);
            opacity: 0;
          }
          100% {
            transform: translateX(120%) rotate(25deg);
            opacity: 0;
          }
        }

        @keyframes finishPulse {
          0% {
            transform: scale(0.8);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }

        @keyframes indeterminateTrack {
          0% {
            left: -64px;
          }
          100% {
            left: 160px;
          }
        }

        @keyframes neonTwinkle {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.9);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.25);
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Animação dos sinais percorrendo as trilhas de circuito */
        .circuit-pulse-1 {
          stroke-dasharray: 25 240;
          animation: circuitRun 4.5s linear infinite;
        }
        .circuit-pulse-2 {
          stroke-dasharray: 25 220;
          animation: circuitRun 5.2s linear infinite 1.2s;
        }
        .circuit-pulse-3 {
          stroke-dasharray: 20 200;
          animation: circuitRun 4.8s linear infinite 2.1s;
        }
        .circuit-pulse-4 {
          stroke-dasharray: 20 200;
          animation: circuitRun 5.5s linear infinite 0.7s;
        }

        @keyframes circuitRun {
          0% {
            stroke-dashoffset: 240;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        /* Respeito a usuários com preferência por movimento reduzido */
        @media (prefers-reduced-motion: reduce) {
          .orbit-track {
            animation: none !important;
          }
          .circuit-pulse-1, .circuit-pulse-2, .circuit-pulse-3, .circuit-pulse-4 {
            animation: none !important;
            opacity: 0.4;
          }
          div[style*="neonTwinkle"] {
            animation: none !important;
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  )
}
