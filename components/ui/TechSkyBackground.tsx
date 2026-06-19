'use client';

import React, { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const TechSkyBackground = memo(() => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <div className="tech-sky-bg" aria-hidden="true">
      <style dangerouslySetInnerHTML={{__html: `
        .tech-sky-bg {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          z-index: -9999;
          pointer-events: none;
          background: linear-gradient(135deg, #FFFFFF 0%, #F5F9FF 50%, #F7F2FF 100%);
        }

        /* 1. Tech Grid */
        .tech-sky-grid {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background-image: 
            linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          transform: perspective(1000px) rotateX(60deg) translateY(-100px) translateZ(-200px);
          transform-origin: center top;
          opacity: 0.8;
          animation: gridMove 20s linear infinite;
        }

        @keyframes gridMove {
          0% { transform: perspective(1000px) rotateX(60deg) translateY(0) translateZ(-200px); }
          100% { transform: perspective(1000px) rotateX(60deg) translateY(60px) translateZ(-200px); }
        }

        /* 2. Aurora Blobs */
        .aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.6;
          mix-blend-mode: multiply;
          will-change: transform;
        }

        .aurora-1 {
          top: -10%; left: -10%;
          width: 60vw; height: 60vw;
          background: radial-gradient(circle, #EAF4FF 0%, rgba(234, 244, 255, 0) 70%);
          animation: auroraMove1 30s ease-in-out infinite alternate;
        }

        .aurora-2 {
          bottom: -20%; right: -10%;
          width: 70vw; height: 50vw;
          background: radial-gradient(circle, #F7F2FF 0%, rgba(247, 242, 255, 0) 70%);
          animation: auroraMove2 40s ease-in-out infinite alternate;
        }

        .aurora-3 {
          top: 30%; left: 40%;
          width: 50vw; height: 50vw;
          background: radial-gradient(circle, #F5F9FF 0%, rgba(245, 249, 255, 0) 70%);
          animation: auroraMove3 35s ease-in-out infinite alternate;
        }

        @keyframes auroraMove1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(10vw, 15vh) scale(1.1); }
        }
        @keyframes auroraMove2 {
          0% { transform: translate(0, 0) scale(1.1); }
          100% { transform: translate(-15vw, -10vh) scale(1); }
        }
        @keyframes auroraMove3 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-10vw, 20vh) scale(1.2); }
        }

        /* 3. Orbital Circles */
        .orbit-container {
          position: absolute;
          top: 50%; left: 50%;
          width: 100vw; height: 100vw;
          max-width: 1200px; max-height: 1200px;
          transform: translate(-50%, -50%);
        }

        .orbit-ring {
          position: absolute;
          top: 50%; left: 50%;
          border-radius: 50%;
          border: 1px solid rgba(59, 130, 246, 0.05);
          transform: translate(-50%, -50%);
          will-change: transform;
        }

        .orbit-1 { width: 40%; height: 40%; animation: spinRight 40s linear infinite; }
        .orbit-2 { width: 70%; height: 70%; border-style: dashed; animation: spinLeft 60s linear infinite; }
        .orbit-3 { width: 100%; height: 100%; animation: spinRight 90s linear infinite; opacity: 0.5; }

        @keyframes spinRight { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes spinLeft { 100% { transform: translate(-50%, -50%) rotate(-360deg); } }

        /* 4. Tech Lines (Neural Arcs) */
        .tech-arc {
          position: absolute;
          border-radius: 50%;
          border: 1px solid transparent;
          will-change: transform, opacity;
        }
        
        .arc-1 {
          top: 10%; left: 20%; width: 40vw; height: 40vw;
          border-top-color: rgba(139, 92, 246, 0.15);
          transform: rotate(20deg);
        }
        .arc-2 {
          top: 40%; right: 10%; width: 50vw; height: 30vw;
          border-bottom-color: rgba(59, 130, 246, 0.15);
          transform: rotate(-15deg);
        }
        .arc-3 {
          bottom: 10%; left: -10%; width: 60vw; height: 40vw;
          border-right-color: rgba(168, 85, 247, 0.1);
          transform: rotate(45deg);
        }

        /* 5. Energy Nodes (Points on arcs/orbits) */
        .energy-node {
          position: absolute;
          width: 4px; height: 4px;
          background: #3B82F6;
          border-radius: 50%;
          box-shadow: 0 0 12px 3px rgba(59, 130, 246, 0.4);
          animation: pulseNode 3s infinite alternate;
        }

        .node-1 { top: 15%; left: 35%; animation-delay: 0s; }
        .node-2 { top: 45%; right: 25%; background: #8B5CF6; box-shadow: 0 0 12px 3px rgba(139, 92, 246, 0.4); animation-delay: 1s; }
        .node-3 { bottom: 25%; left: 15%; animation-delay: 2s; }

        @keyframes pulseNode {
          0% { opacity: 0.4; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1.5); }
        }

        /* 6. Particles & Micro-Stars */
        .particle-layer {
          position: absolute;
          inset: 0;
        }

        .particle {
          position: absolute;
          background: #8B5CF6;
          border-radius: 50%;
          opacity: 0.3;
          will-change: transform;
        }

        /* Generate multiple particles with CSS */
        ${Array.from({ length: 40 }).map((_, i) => {
          // Deterministic pseudo-random values based on index to avoid hydration mismatch
          const seed1 = Math.sin(i * 12.9898) * 43758.5453;
          const seed2 = Math.cos(i * 78.233) * 43758.5453;
          const r1 = seed1 - Math.floor(seed1); // 0 to 1
          const r2 = Math.abs(seed2 - Math.floor(seed2)); // 0 to 1
          
          const size = r1 * 4 + 1;
          const left = r2 * 100;
          const top = ((r1 + r2) % 1) * 100;
          const duration = r1 * 20 + 20;
          const delay = r2 * -40;
          const isStar = ((r1 * 10) % 1) > 0.6;
          
          if (isStar) {
            // Micro-star (twinkle)
            return `
              .p-${i} {
                width: ${size * 0.5}px; height: ${size * 0.5}px;
                left: ${left}%; top: ${top}%;
                background: #3B82F6;
                box-shadow: 0 0 ${size * 2}px rgba(59, 130, 246, 0.8);
                animation: twinkle ${(r1 * 3) + 2}s infinite alternate ${delay}s;
              }
            `;
          } else {
            // Floating particle (vertical parallax)
            return `
              .p-${i} {
                width: ${size}px; height: ${size}px;
                left: ${left}%;
                top: ${top}%;
                animation: floatUp ${duration}s linear infinite ${delay}s;
              }
            `;
          }
        }).join('\n')}

        @keyframes twinkle {
          0% { opacity: 0.1; transform: scale(0.5); }
          100% { opacity: 0.8; transform: scale(1.2); }
        }

        @keyframes floatUp {
          0% { transform: translateY(100vh); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-20vh); opacity: 0; }
        }

        /* Add a very subtle vignette to focus center */
        .tech-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 40%, rgba(255, 255, 255, 0.4) 100%);
          pointer-events: none;
        }
      `}} />

      {/* DOM Elements */}
      <div className="tech-sky-grid" />
      
      <div className="aurora-blob aurora-1" />
      <div className="aurora-blob aurora-2" />
      <div className="aurora-blob aurora-3" />

      <div className="orbit-container">
        <div className="orbit-ring orbit-1" />
        <div className="orbit-ring orbit-2" />
        <div className="orbit-ring orbit-3" />
      </div>

      <div className="tech-arc arc-1" />
      <div className="tech-arc arc-2" />
      <div className="tech-arc arc-3" />

      <div className="energy-node node-1" />
      <div className="energy-node node-2" />
      <div className="energy-node node-3" />

      <div className="particle-layer">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className={`particle p-${i}`} />
        ))}
      </div>

      <div className="tech-vignette" />
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
});
