import React from 'react';
import { motion } from 'framer-motion';

export interface ComunicadoSkeletonProps {
  count?: number;
  title?: string;
  subtitle?: string;
  showHeaderBadge?: boolean;
}

export function ComunicadoSkeleton({ 
  count = 3,
  title = "Carregando comunicados institucionais...",
  subtitle = "Sincronizando avisos e comunicados em tempo real",
  showHeaderBadge = true
}: ComunicadoSkeletonProps) {
  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ultraShimmerSweep {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes cyberLaserPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.2), 0 0 12px rgba(0, 210, 255, 0.6), 0 0 20px rgba(117, 81, 255, 0.4);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 0 0 6px rgba(0, 210, 255, 0.35), 0 0 22px rgba(0, 210, 255, 0.9), 0 0 32px rgba(255, 0, 128, 0.6);
          }
        }
        @keyframes spinMicro {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes laserFlowLinear {
          0% { background-position: 0% 0%; }
          100% { background-position: 0% 200%; }
        }
        @keyframes orbitSpinCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbitSpinCCW {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes cyberCorePulse {
          0%, 100% {
            transform: scale(0.85);
            opacity: 0.85;
            filter: drop-shadow(0 0 6px #00d2ff);
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
            filter: drop-shadow(0 0 14px #7551FF) drop-shadow(0 0 20px #00d2ff);
          }
        }
        @keyframes auraGlow {
          0%, 100% {
            transform: scale(0.92);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.12);
            opacity: 0.75;
          }
        }
        .ultra-shimmer {
          background: linear-gradient(90deg, rgba(226, 232, 240, 0.5) 0%, rgba(255, 255, 255, 0.95) 50%, rgba(226, 232, 240, 0.5) 100%) !important;
          background-size: 200% 100% !important;
          animation: ultraShimmerSweep 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
        }
      `}} />

      {/* Top Ultra-Modern Loading Icon */}
      {showHeaderBadge && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '8px 0 22px 0',
            position: 'relative'
          }}
        >
          {/* Subtle Cyber Atmospheric Aura */}
          <div style={{
            position: 'absolute',
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 210, 255, 0.28) 0%, rgba(117, 81, 255, 0.22) 50%, transparent 75%)',
            filter: 'blur(12px)',
            animation: 'auraGlow 2.4s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          {/* Frosted Glass Floating Orb */}
          <div style={{
            position: 'relative',
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(243, 244, 255, 0.88) 100%)',
            border: '1.5px solid rgba(99, 102, 241, 0.22)',
            boxShadow: '0 10px 28px -4px rgba(67, 24, 255, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
            zIndex: 1
          }}
          >
            {/* Outer Spinning Dual-Tone Ring */}
            <div style={{
              position: 'absolute',
              inset: 7,
              borderRadius: '50%',
              border: '2.5px solid rgba(99, 102, 241, 0.14)',
              borderTopColor: '#00d2ff',
              borderRightColor: '#7551FF',
              animation: 'orbitSpinCW 1.1s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite'
            }} />

            {/* Middle Counter-Rotating Neon Dashed Ring */}
            <div style={{
              position: 'absolute',
              inset: 12,
              borderRadius: '50%',
              border: '2px dashed rgba(236, 72, 153, 0.65)',
              borderBottomColor: '#00d2ff',
              animation: 'orbitSpinCCW 1.6s linear infinite'
            }} />

            {/* Inner Cyber Pulsing Core */}
            <div style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00d2ff 0%, #7551FF 100%)',
              animation: 'cyberCorePulse 1.8s ease-in-out infinite'
            }} />
          </div>
        </motion.div>
      )}

      {/* Skeleton Feed Cards */}
      {Array.from({ length: count }).map((_, idx) => {
        const isLast = idx === count - 1;
        const titleWidths = ['68%', '52%', '62%', '45%'];
        const titleWidth = titleWidths[idx % titleWidths.length];

        return (
          <motion.div 
            key={idx} 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.35 }}
            style={{ 
              display: 'flex', 
              position: 'relative', 
              paddingBottom: !isLast ? 10 : 0, 
              width: '100%' 
            }}
          >
            {/* Timeline Connector Laser Line */}
            {!isLast && (
              <div 
                className="ad-com-timeline-line" 
                style={{ 
                  position: 'absolute', 
                  top: 48, 
                  bottom: -6, 
                  left: 88, 
                  width: 2, 
                  backgroundImage: 'linear-gradient(to bottom, rgba(0, 210, 255, 0.15), #00d2ff, #7551FF, rgba(255, 0, 128, 0.15))',
                  backgroundSize: '100% 200%',
                  animation: 'laserFlowLinear 2.5s ease-in-out infinite',
                  zIndex: 0,
                  borderRadius: 2
                }} 
              />
            )}

            {/* Timeline Node - Desktop */}
            <div 
              className="ad-desktop-only ad-com-timeline-node" 
              style={{ 
                marginRight: 16, 
                zIndex: 1,
                display: 'flex',
                alignItems: 'flex-start',
                paddingTop: 24,
                width: 88,
                position: 'relative'
              }} 
            >
              <div className="ad-com-date-box" style={{ width: 72, textAlign: 'right', paddingRight: 16 }}>
                <div 
                  className="ultra-shimmer" 
                  style={{ 
                    width: 44, 
                    height: 24, 
                    borderRadius: 8, 
                    marginLeft: 'auto', 
                    marginBottom: 6 
                  }} 
                />
                <div 
                  className="ultra-shimmer" 
                  style={{ 
                    width: 32, 
                    height: 12, 
                    borderRadius: 4, 
                    marginLeft: 'auto', 
                    marginBottom: 4 
                  }} 
                />
                <div 
                  className="ultra-shimmer" 
                  style={{ 
                    width: 36, 
                    height: 10, 
                    borderRadius: 4, 
                    marginLeft: 'auto' 
                  }} 
                />
              </div>

              {/* Pulsing Cyber Glowing Dot on Line */}
              <div 
                className="ad-com-timeline-dot" 
                style={{ 
                  position: 'absolute',
                  right: -7,
                  top: 28,
                  width: 14, 
                  height: 14, 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #00d2ff, #7551FF)', 
                  border: '3px solid #f8fafc',
                  animation: 'cyberLaserPulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  zIndex: 2 
                }} 
              />
            </div>

            {/* Timeline Node - Mobile */}
            <div 
              className="ad-mobile-only ad-com-timeline-node" 
              style={{ 
                marginRight: 8, 
                zIndex: 1,
                display: 'flex',
                alignItems: 'flex-start',
                paddingTop: 16,
                width: 36,
                position: 'relative'
              }} 
            >
              <div className="ad-com-date-box" style={{ width: 36, textAlign: 'right', paddingRight: 8 }}>
                <div 
                  className="ultra-shimmer" 
                  style={{ 
                    width: 22, 
                    height: 14, 
                    borderRadius: 4, 
                    marginLeft: 'auto', 
                    marginBottom: 4 
                  }} 
                />
                <div 
                  className="ultra-shimmer" 
                  style={{ 
                    width: 18, 
                    height: 8, 
                    borderRadius: 2, 
                    marginLeft: 'auto' 
                  }} 
                />
              </div>
              <div 
                className="ad-com-timeline-dot" 
                style={{ 
                  position: 'absolute',
                  right: -4,
                  top: 20,
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #00d2ff, #7551FF)', 
                  border: '2px solid #f8fafc',
                  animation: 'cyberLaserPulse 1.8s infinite',
                  zIndex: 2 
                }} 
              />
            </div>

            {/* Glassmorphic Feed Card Skeleton */}
            <div 
              className="card ad-feed-card" 
              style={{ 
                flex: 1, 
                padding: '24px 28px', 
                borderRadius: 24, 
                background: 'rgba(255, 255, 255, 0.82)', 
                border: '1px solid rgba(99, 102, 241, 0.16)', 
                boxShadow: '0 12px 32px -8px rgba(99, 102, 241, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(16px)',
                display: 'flex', 
                flexDirection: 'column',
                gap: 16,
                position: 'relative',
                overflow: 'hidden'
              }} 
            >
              {/* Top Row: Avatar + Title + Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1, minWidth: 0 }}>
                  {/* Avatar Skeleton */}
                  <div 
                    className="ultra-shimmer" 
                    style={{ 
                      width: 62, 
                      height: 62, 
                      borderRadius: 18, 
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.08)'
                    }} 
                  />
                  
                  {/* Text Column */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div 
                      className="ultra-shimmer" 
                      style={{ 
                        width: titleWidth, 
                        height: 20, 
                        borderRadius: 8, 
                        marginBottom: 10 
                      }} 
                    />
                    <div 
                      className="ultra-shimmer" 
                      style={{ 
                        width: '35%', 
                        minWidth: 100, 
                        height: 14, 
                        borderRadius: 6 
                      }} 
                    />
                  </div>
                </div>

                {/* Right side: Badge placeholder + Action button */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                  <div 
                    className="ultra-shimmer" 
                    style={{ 
                      width: 64, 
                      height: 22, 
                      borderRadius: 11 
                    }} 
                  />
                  <div 
                    className="ultra-shimmer" 
                    style={{ 
                      width: 34, 
                      height: 34, 
                      borderRadius: '50%' 
                    }} 
                  />
                </div>
              </div>

              {/* Bottom Subtle Laser Reflection Accent */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 28,
                right: 28,
                height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(0, 210, 255, 0.25), rgba(117, 81, 255, 0.25), transparent)',
                borderRadius: 1
              }} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
