'use client'

import { useState, useEffect, memo } from 'react'
import { BookOpen, Shield, Users, Database, TrendingUp, LayoutDashboard, Cpu, Network, LockKeyhole, Globe } from 'lucide-react'

// Sub-component for an Icon Node (Vértice do circuito)
export function Node({ x, y, Icon, delay, className = "" }: { x: string, y: string, Icon: any, delay: number, className?: string }) {
  return (
    <div 
      className={`absolute flex items-center justify-center ${className}`} 
      style={{ top: y, left: x, transform: 'translate(-50%, -50%)' }}
    >
      {/* Ponto luminoso pulsante */}
      <div 
        className="absolute w-1.5 h-1.5 bg-blue-400/80 rounded-full animate-pulse"
        style={{ animationDelay: `${delay}s`, animationDuration: '3s' }}
      />
      {/* Anel de expansão sutil */}
      <div 
        className="absolute w-8 h-8 border border-blue-500/10 rounded-full animate-ping"
        style={{ animationDelay: `${delay}s`, animationDuration: '4s' }}
      />
      {/* Ícone Outline Enterprise (Opacidade muito leve) */}
      <div className="absolute w-16 h-16 flex items-center justify-center opacity-[0.05]">
        <Icon size={28} className="text-blue-100" strokeWidth={1} />
      </div>
    </div>
  )
}

// Sub-component for Floating Particles
export function Particle({ x, y, size, delay, opacity = 0.4, className = "" }: { x: string, y: string, size: number, delay: number, opacity?: number, className?: string }) {
  return (
    <div 
      className={`absolute rounded-full bg-blue-300 shadow-[0_0_8px_rgba(96,165,250,0.6)] animate-pulse ${className}`}
      style={{ 
        top: y, left: x, 
        width: size, height: size, 
        opacity,
        animationDelay: `${delay}s`,
        animationDuration: '4s'
      }}
    />
  )
}

export const BackgroundEffects = memo(() => {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  useEffect(() => {
    let ticking = false
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
          ticking = false
        })
        ticking = true
      }
    }
    // Ouve mouse apenas em Desktop para performance e economia de bateria
    if (window.innerWidth > 768) {
      window.addEventListener('mousemove', handleMouseMove)
    }
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Parallax sutil: de -20px a +20px
  const pX = (mousePos.x - 0.5) * 40
  const pY = (mousePos.y - 0.5) * 40

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* 1. Ambient Glows Volumétricos (GPU Accelerated) */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full bg-blue-600/10 blur-[120px] transition-transform duration-1000 ease-out will-change-transform"
        style={{ top: '-20%', left: '-10%', transform: `translate(${pX * 0.4}px, ${pY * 0.4}px) translateZ(0)` }}
      />
      <div 
        className="absolute w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[100px] transition-transform duration-1000 ease-out will-change-transform"
        style={{ bottom: '-15%', right: '-5%', transform: `translate(${pX * -0.3}px, ${pY * -0.3}px) translateZ(0)` }}
      />

      {/* 2. Abstract Geometric Grid Pattern (Fades no centro para limpar área do formulário) */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 25%, rgba(0,0,0,1) 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 25%, rgba(0,0,0,1) 100%)'
        }}
      />

      {/* 3. Tech Circuits SVG Layers */}
      <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="circuit-grad-left" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="circuit-grad-right" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="circuit-grad-mobile" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Desktop Circuits (Com Parallax) */}
        <g className="hidden md:block transition-transform duration-1000 ease-out will-change-transform" style={{ transform: `translate(${pX * 0.15}px, ${pY * 0.15}px) translateZ(0)` }}>
          <path d="M -50 150 L 150 150 L 250 250 L 250 800" fill="none" stroke="url(#circuit-grad-left)" strokeWidth="1" />
          <path d="M -50 350 L 100 350 L 150 400 L 150 650 L 50 750" fill="none" stroke="url(#circuit-grad-left)" strokeWidth="1" />
          <path d="M -50 550 L 80 550 L 180 650 L 300 650" fill="none" stroke="url(#circuit-grad-left)" strokeWidth="1" />
        </g>
        <g className="hidden md:block transition-transform duration-1000 ease-out will-change-transform" style={{ transform: `translate(${pX * -0.15}px, ${pY * -0.15}px) translateZ(0)` }}>
          <path d="M 2000 100 L 1200 100 L 1100 200 L 1100 800" fill="none" stroke="url(#circuit-grad-right)" strokeWidth="1" />
          <path d="M 2000 400 L 1300 400 L 1200 500 L 1200 900" fill="none" stroke="url(#circuit-grad-right)" strokeWidth="1" />
          <path d="M 2000 700 L 1400 700 L 1300 800 L 1300 1000" fill="none" stroke="url(#circuit-grad-right)" strokeWidth="1" />
        </g>

        {/* Mobile Circuits (No Parallax, focados nos extremos top/bottom) */}
        <g className="block md:hidden">
          <path d="M -50 80 L 80 80 L 130 130 L 300 130" fill="none" stroke="url(#circuit-grad-mobile)" strokeWidth="1" />
          <path d="M 500 800 L 350 800 L 300 750 L 50 750" fill="none" stroke="url(#circuit-grad-mobile)" strokeWidth="1" />
        </g>
      </svg>

      {/* 4. Strategic Enterprise Outline Icons (Escondidos no mobile para limpeza absoluta atrás do formulário) */}
      <div className="absolute inset-0 transition-transform duration-1000 ease-out will-change-transform" style={{ transform: `translate(${pX * 0.2}px, ${pY * 0.2}px) translateZ(0)` }}>
        <Node className="hidden md:flex" x="12vw" y="20vh" Icon={BookOpen} delay={0} />
        <Node className="hidden md:flex" x="6vw" y="45vh" Icon={Network} delay={1.2} />
        <Node className="hidden md:flex" x="15vw" y="65vh" Icon={LayoutDashboard} delay={2.5} />
        <Node className="hidden md:flex" x="8vw" y="85vh" Icon={Database} delay={0.8} />

        <Node className="hidden md:flex" x="88vw" y="15vh" Icon={Users} delay={0.5} />
        <Node className="hidden md:flex" x="82vw" y="40vh" Icon={Cpu} delay={1.8} />
        <Node className="hidden md:flex" x="92vw" y="60vh" Icon={Globe} delay={2.1} />
        <Node className="hidden md:flex" x="85vw" y="80vh" Icon={Shield} delay={0.3} />
        <Node className="hidden md:flex" x="95vw" y="90vh" Icon={LockKeyhole} delay={1.5} />
      </div>

      {/* 5. Micro-partículas luminosas */}
      <div className="absolute inset-0 transition-transform duration-1000 ease-out will-change-transform" style={{ transform: `translate(${pX * 0.3}px, ${pY * 0.3}px) translateZ(0)` }}>
         {/* Desktop */}
         <Particle className="hidden md:block" x="25vw" y="25vh" size={3} delay={0} />
         <Particle className="hidden md:block" x="75vw" y="20vh" size={2} opacity={0.3} delay={1} />
         <Particle className="hidden md:block" x="20vw" y="75vh" size={4} opacity={0.2} delay={2} />
         <Particle className="hidden md:block" x="85vw" y="70vh" size={2} delay={0.5} />
         
         {/* Mobile (Apenas cantos extremos) */}
         <Particle className="block md:hidden" x="15vw" y="8vh" size={3} opacity={0.5} delay={0} />
         <Particle className="block md:hidden" x="85vw" y="12vh" size={2} opacity={0.4} delay={1} />
         <Particle className="block md:hidden" x="20vw" y="92vh" size={3} opacity={0.4} delay={2} />
         <Particle className="block md:hidden" x="80vw" y="88vh" size={2} opacity={0.5} delay={0.5} />
      </div>
    </div>
  )
})
