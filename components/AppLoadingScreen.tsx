'use client'

import React from 'react'

interface AppLoadingScreenProps {
  statusText?: string
  subtitle?: string
  showFooter?: boolean
  style?: React.CSSProperties
}

// Estrelas fixas para formar uma constelação elegante idêntica à imagem de referência
const STARS = [
  { top: '12%', left: '18%', size: 2, color: '#e0e7ff', opacity: 0.6, delay: '0s' },
  { top: '8%',  left: '52%', size: 2.5, color: '#38bdf8', opacity: 0.8, delay: '1.2s' },
  { top: '14%', left: '76%', size: 2, color: '#c084fc', opacity: 0.5, delay: '0.6s' },
  { top: '22%', left: '88%', size: 2.5, color: '#38bdf8', opacity: 0.7, delay: '1.8s' },
  { top: '30%', left: '12%', size: 2, color: '#38bdf8', opacity: 0.5, delay: '2.4s' },
  { top: '38%', left: '85%', size: 3, color: '#e0e7ff', opacity: 0.9, delay: '0.9s' },
  { top: '48%', left: '22%', size: 2.5, color: '#a855f7', opacity: 0.6, delay: '1.5s' },
  { top: '56%', left: '84%', size: 2.5, color: '#38bdf8', opacity: 0.75, delay: '0.3s' },
  { top: '64%', left: '15%', size: 3, color: '#38bdf8', opacity: 0.8, delay: '2.1s' },
  { top: '70%', left: '72%', size: 2, color: '#c084fc', opacity: 0.5, delay: '1.1s' },
  { top: '78%', left: '26%', size: 2, color: '#e0e7ff', opacity: 0.6, delay: '2.7s' },
  { top: '86%', left: '86%', size: 2.5, color: '#38bdf8', opacity: 0.65, delay: '0.8s' },
  { top: '82%', left: '12%', size: 2.5, color: '#a855f7', opacity: 0.5, delay: '1.9s' },
  { top: '92%', left: '68%', size: 2, color: '#38bdf8', opacity: 0.7, delay: '2.5s' },
]

export function AppLoadingScreen({
  statusText = 'Sincronizando com segurança',
  subtitle = 'Conectando escola e família',
  showFooter = true,
  style = {},
}: AppLoadingScreenProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#050713',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: 'none',
        WebkitUserSelect: 'none',
        zIndex: 999999,
        overflow: 'hidden',
        padding: '24px',
        ...style,
      }}
    >
      {/* ── 1. Luzes de fundo cósmicas e gradientes atmosféricos ── */}
      
      {/* Brilho esférico central violeta/índigo */}
      <div
        style={{
          position: 'absolute',
          top: '32%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.28) 0%, rgba(79, 70, 229, 0.16) 40%, transparent 72%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Brilho oceânico ciano suave na base */}
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(6, 182, 212, 0.18) 0%, rgba(14, 116, 144, 0.1) 45%, transparent 75%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      {/* Linhas de perspectiva sutis subindo do rodapé (Stage effect) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '45%',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(14, 165, 233, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          maskImage: 'linear-gradient(to top, black 20%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 20%, transparent 100%)',
        }}
      />

      {/* ── 2. Partículas / Estrelas Cósmicas ── */}
      {STARS.map((star, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            borderRadius: '50%',
            backgroundColor: star.color,
            boxShadow: `0 0 ${star.size * 3}px ${star.color}`,
            opacity: star.opacity,
            animation: `twinkleStar 3.5s ease-in-out infinite`,
            animationDelay: star.delay,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ── 3. Ícone Central com Anéis Orbitais e Satélites ── */}
      <div
        style={{
          position: 'relative',
          width: '210px',
          height: '210px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '28px',
        }}
      >
        {/* Anel orbital externo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1px solid rgba(139, 92, 246, 0.18)',
            pointerEvents: 'none',
          }}
        />

        {/* Anel orbital interno dinâmico com rotação suave */}
        <div
          style={{
            position: 'absolute',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            border: '1px dashed rgba(56, 189, 248, 0.14)',
            animation: 'orbitSlow 22s linear infinite',
            pointerEvents: 'none',
          }}
        >
          {/* Satélite 1: Nó Lilás Neon (topo-esquerda) */}
          <div
            style={{
              position: 'absolute',
              top: '18px',
              left: '26px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#c084fc',
              boxShadow: '0 0 10px #c084fc, 0 0 20px rgba(192, 132, 252, 0.8)',
            }}
          />

          {/* Satélite 2: Nó Ciano Neon (base-direita) */}
          <div
            style={{
              position: 'absolute',
              bottom: '22px',
              right: '28px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#38bdf8',
              boxShadow: '0 0 10px #38bdf8, 0 0 18px rgba(56, 189, 248, 0.8)',
            }}
          />
        </div>

        {/* Squircle Glassmorphic Card do Ícone */}
        <div
          style={{
            position: 'relative',
            width: '100px',
            height: '100px',
            borderRadius: '28px',
            background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.65) 0%, rgba(15, 23, 42, 0.8) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(147, 51, 234, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.25), inset 0 -2px 10px rgba(124, 58, 237, 0.3), 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 32px rgba(139, 92, 246, 0.28)',
            animation: 'badgePulse 3s ease-in-out infinite',
            zIndex: 2,
          }}
        >
          {/* Capelo SVG com gradiente neon e contorno idêntico à imagem 1 */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            style={{ filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.5))' }}
          >
            <defs>
              <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="45%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
            {/* Chapéu Mortarboard */}
            <path
              d="M22 10L12 5L2 10L12 15L22 10Z"
              stroke="url(#capGrad)"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Base da cabeça */}
            <path
              d="M6 12.5V17C6 17 8.5 19.5 12 19.5C15.5 19.5 18 17 18 17V12.5"
              stroke="url(#capGrad)"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Cordão do Tassel na lateral */}
            <path
              d="M22 10V15.5C22 16.5 21 17 20 17"
              stroke="url(#capGrad)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* ── 4. Tipografia e Identidade Visual ── */}
      
      {/* Rótulo superior: COLÉGIO IMPACTO */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: '#38bdf8',
          textShadow: '0 0 12px rgba(56, 189, 248, 0.45)',
          marginBottom: '8px',
          textAlign: 'center',
        }}
      >
        COLÉGIO IMPACTO
      </div>

      {/* Título Principal: IMPACTO EDU com gradiente em EDU */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontSize: '34px',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          IMPACTO
        </span>
        <span
          style={{
            fontSize: '34px',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            background: 'linear-gradient(90deg, #38bdf8 0%, #60a5fa 40%, #c084fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 16px rgba(168, 85, 247, 0.45))',
          }}
        >
          EDU
        </span>
      </div>

      {/* Subtítulo: Conectando escola e família */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.58)',
          letterSpacing: '0.02em',
          marginBottom: '38px',
          textAlign: 'center',
        }}
      >
        {subtitle}
      </div>

      {/* ── 5. Barra de Progresso e Status ── */}
      
      {/* Barra de progresso linear com brilho e efeito fluido */}
      <div
        style={{
          width: '240px',
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '60%',
            background: 'linear-gradient(90deg, transparent 0%, #6366f1 20%, #38bdf8 65%, #c084fc 95%, transparent 100%)',
            borderRadius: '999px',
            boxShadow: '0 0 12px rgba(56, 189, 248, 0.6)',
            animation: 'shimmerTrack 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
        />
      </div>

      {/* Texto de Status com pontinho ciano pulsante */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '16px',
        }}
      >
        <div
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: '#38bdf8',
            boxShadow: '0 0 8px #38bdf8',
            animation: 'pulseStatusDot 1.6s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.55)',
            letterSpacing: '0.02em',
          }}
        >
          {statusText}
        </span>
      </div>

      {/* ── 6. Rodapé: AMBIENTE PROTEGIDO ── */}
      {showFooter && (
        <div
          style={{
            position: 'absolute',
            bottom: 'max(24px, env(safe-area-inset-bottom, 20px))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: '#64748b',
          }}
        >
          {/* Ícone de Escudo com Check */}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            AMBIENTE PROTEGIDO
          </span>
        </div>
      )}

      {/* ── 7. Animações Keyframe fluidas a 60fps ── */}
      <style>{`
        @keyframes orbitSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes badgePulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 16px rgba(124, 58, 237, 0.3));
          }
          50% {
            transform: scale(1.025);
            filter: drop-shadow(0 0 28px rgba(56, 189, 248, 0.45));
          }
        }
        @keyframes shimmerTrack {
          0% {
            left: -60%;
          }
          100% {
            left: 100%;
          }
        }
        @keyframes twinkleStar {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
          }
        }
        @keyframes pulseStatusDot {
          0%, 100% {
            opacity: 0.5;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
            box-shadow: 0 0 12px #38bdf8;
          }
        }
      `}</style>
    </div>
  )
}
