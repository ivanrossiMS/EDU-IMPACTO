'use client'

import React from 'react'
import { IMPACTO_NEON_LOGO_DATA_URI } from '@/components/ui/impactoNeonLogoBase64'

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
        zIndex: 99999999,
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
          width: '220px',
          height: '220px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '26px',
        }}
      >
        {/* Anel orbital externo estático com brilho cósmico */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            boxShadow: '0 0 24px rgba(139, 92, 246, 0.08)',
            pointerEvents: 'none',
          }}
        />

        {/* Anel orbital médio dinâmico com rotação horária e satélites neon */}
        <div
          style={{
            position: 'absolute',
            width: '184px',
            height: '184px',
            borderRadius: '50%',
            border: '1px dashed rgba(56, 189, 248, 0.22)',
            animation: 'orbitClockwise 20s linear infinite',
            pointerEvents: 'none',
          }}
        >
          {/* Satélite 1: Nó Lilás Neon (topo-esquerda) */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '24px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#c084fc',
              boxShadow: '0 0 10px #c084fc, 0 0 22px rgba(192, 132, 252, 0.85)',
            }}
          />

          {/* Satélite 2: Nó Ciano Neon (base-direita) */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '26px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#38bdf8',
              boxShadow: '0 0 10px #38bdf8, 0 0 20px rgba(56, 189, 248, 0.85)',
            }}
          />
        </div>

        {/* Anel orbital interno giroscópio (sentido anti-horário) */}
        <div
          style={{
            position: 'absolute',
            width: '146px',
            height: '146px',
            borderRadius: '50%',
            border: '1px dotted rgba(168, 85, 247, 0.28)',
            animation: 'orbitCounter 14s linear infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Halo de iluminação de fundo dual atmosférico (Magenta à esquerda, Ciano à direita) */}
        <div
          style={{
            position: 'absolute',
            width: '124px',
            height: '124px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 50%, rgba(192, 132, 252, 0.38) 0%, rgba(147, 51, 234, 0.18) 45%, transparent 70%)',
            filter: 'blur(20px)',
            pointerEvents: 'none',
            animation: 'neonPulseMagenta 3.2s ease-in-out infinite alternate',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '124px',
            height: '124px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 65% 50%, rgba(56, 189, 248, 0.42) 0%, rgba(6, 182, 212, 0.2) 45%, transparent 70%)',
            filter: 'blur(20px)',
            pointerEvents: 'none',
            animation: 'neonPulseCyan 3.2s ease-in-out infinite alternate',
          }}
        />

        {/* Sombra de chão 3D reflexiva (Stage Floor Contact Glow) */}
        <div
          style={{
            position: 'absolute',
            bottom: '42px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90px',
            height: '14px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.32) 0%, rgba(192, 132, 252, 0.22) 45%, transparent 75%)',
            filter: 'blur(6px)',
            pointerEvents: 'none',
            animation: 'floorShadowPulse 3.2s ease-in-out infinite',
            zIndex: 1,
          }}
        />

        {/* Logo Central Impacto Neon 3D com Levitação Suave e Shimmer */}
        <div
          style={{
            position: 'relative',
            width: '112px',
            height: '112px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            animation: 'emblemLevitate 3.2s ease-in-out infinite',
          }}
        >
          {/* Card do Ícone com Cantos Arredondados e Máscara de Brilho */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '24px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={IMPACTO_NEON_LOGO_DATA_URI}
              alt="Colégio Impacto"
              width={112}
              height={112}
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

            {/* Raio de luz diagonal metálico moderno (Sheen Pass) */}
            <div
              style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: 'linear-gradient(110deg, transparent 38%, rgba(255, 255, 255, 0.22) 46%, rgba(56, 189, 248, 0.3) 50%, rgba(192, 132, 252, 0.25) 54%, transparent 62%)',
                pointerEvents: 'none',
                animation: 'lightSheenPass 3.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
              }}
            />
          </div>
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
        @keyframes orbitClockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbitCounter {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes emblemLevitate {
          0%, 100% {
            transform: translateY(0px) scale(1);
            filter: drop-shadow(-6px 2px 14px rgba(192, 132, 252, 0.45))
                    drop-shadow(6px 2px 14px rgba(56, 189, 248, 0.45))
                    drop-shadow(0 10px 22px rgba(0, 0, 0, 0.65));
          }
          50% {
            transform: translateY(-6px) scale(1.035);
            filter: drop-shadow(-10px 5px 24px rgba(192, 132, 252, 0.72))
                    drop-shadow(10px 5px 24px rgba(56, 189, 248, 0.72))
                    drop-shadow(0 18px 28px rgba(0, 0, 0, 0.75));
          }
        }
        @keyframes lightSheenPass {
          0% {
            transform: translateX(-120%) rotate(25deg);
            opacity: 0;
          }
          15% {
            opacity: 0.85;
          }
          38% {
            transform: translateX(120%) rotate(25deg);
            opacity: 0;
          }
          100% {
            transform: translateX(120%) rotate(25deg);
            opacity: 0;
          }
        }
        @keyframes floorShadowPulse {
          0%, 100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.7;
          }
          50% {
            transform: translateX(-50%) scale(0.8);
            opacity: 0.38;
          }
        }
        @keyframes neonPulseMagenta {
          0%, 100% {
            opacity: 0.5;
            transform: scale(0.94);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.08);
          }
        }
        @keyframes neonPulseCyan {
          0%, 100% {
            opacity: 0.55;
            transform: scale(0.94);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.08);
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
