'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

const MESSAGES = [
  "Inicializando sistema...",
  "Carregando ambiente...",
  "Sincronizando dados...",
  "Preparando experiência...",
  "Quase pronto..."
]

const MODULES = [
  "Conectando servidores...",
  "Verificando segurança...",
  "Carregando módulos...",
  "Otimizando desempenho..."
]

export function PremiumLoader() {
  const [progress, setProgress] = useState(0)
  const [msgIndex, setMsgIndex] = useState(0)
  const [modulesLoaded, setModulesLoaded] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    let currentProgress = 0
    const interval = setInterval(() => {
      currentProgress += Math.random() * 2.5
      if (currentProgress >= 100) {
        currentProgress = 100
        clearInterval(interval)
        setIsFinished(true)
      }
      setProgress(Math.floor(currentProgress))
    }, 40)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const newMsgIndex = Math.min(Math.floor((progress / 100) * MESSAGES.length), MESSAGES.length - 1)
    if (newMsgIndex !== msgIndex) setMsgIndex(newMsgIndex)

    const newModIndex = Math.min(Math.floor((progress / 100) * (MODULES.length + 1)), MODULES.length)
    if (newModIndex !== modulesLoaded) setModulesLoaded(newModIndex)
  }, [progress, msgIndex, modulesLoaded])

  const radius = 64
  const strokeWidth = 4
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(circle at center, #020b2d 0%, #010411 100%)',
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      <style>{`
        .bg-grid {
          background-size: 40px 40px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          mask-image: linear-gradient(to bottom, transparent, black 50%, transparent);
          -webkit-mask-image: radial-gradient(circle at center, black 30%, transparent 80%);
        }

        .line-glow {
          position: absolute;
          height: 1px;
          width: 100vw;
          background: linear-gradient(90deg, transparent, rgba(0, 102, 255, 0.5), transparent);
          animation: scanline 8s linear infinite;
          opacity: 0.5;
        }

        @keyframes scanline {
          0% { transform: translateY(-50vh); }
          100% { transform: translateY(50vh); }
        }

        .nebula {
          position: absolute;
          width: 100vw;
          height: 100vh;
          background: 
            radial-gradient(circle at 20% 30%, rgba(0, 102, 255, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(124, 58, 237, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(0, 229, 255, 0.1) 0%, transparent 50%);
          filter: blur(60px);
          animation: breathe 10s ease-in-out infinite alternate;
        }

        @keyframes breathe {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.1); opacity: 1; }
        }

        .glass-panel-custom {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 32px rgba(0, 102, 255, 0.05);
        }

        .halo {
          position: absolute;
          inset: -20px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0%, rgba(0, 229, 255, 0.2) 20%, transparent 40%, rgba(124, 58, 237, 0.2) 60%, transparent 80%);
          animation: spin-halo 4s linear infinite;
          filter: blur(10px);
        }

        .scanner {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, transparent, rgba(0, 229, 255, 0.3) 50%, transparent);
          height: 10px;
          width: 100%;
          animation: scan-logo 2.5s ease-in-out infinite alternate;
          filter: blur(2px);
          border-radius: 50%;
        }

        @keyframes scan-logo {
          0% { transform: translateY(-20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(120px); opacity: 0; }
        }

        @keyframes spin-halo {
          to { transform: rotate(360deg); }
        }
        
        .pulse-energy {
          animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 102, 255, 0); }
          50% { box-shadow: 0 0 20px 2px rgba(0, 102, 255, 0.3); }
        }
      `}</style>

      {/* ===== BACKGROUND ===== */}
      <div className="absolute inset-0 pointer-events-none nebula" />
      <div className="absolute inset-0 pointer-events-none bg-grid" />
      <div className="line-glow" style={{ animationDelay: '0s' }} />
      <div className="line-glow" style={{ animationDelay: '-4s' }} />

      {/* ===== CENTRO ===== */}
      <motion.div 
        className="relative flex flex-col items-center"
        animate={isFinished ? { scale: 1.1, opacity: 0, filter: 'blur(10px)' } : {}}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        
        {/* Logo Container */}
        <div className="relative flex items-center justify-center w-36 h-36 mb-12">
          {/* Halos & Rings */}
          <div className="halo" />
          <motion.div 
            animate={{ rotate: -360 }} 
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[-10px] rounded-full border border-dashed border-white/10"
          />
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[-25px] rounded-full border border-white/5"
          />
          
          {/* Progress Ring */}
          <svg className="absolute inset-[-16px] w-[176px] h-[176px] -rotate-90 pointer-events-none drop-shadow-[0_0_12px_rgba(0,102,255,0.4)]">
            <circle
              cx="88" cy="88" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={strokeWidth}
            />
            <motion.circle
              cx="88" cy="88" r={radius}
              fill="none"
              stroke="url(#gradient-ring)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="gradient-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="50%" stopColor="#0066FF" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
            </defs>
          </svg>

          {/* Logo Glass Container */}
          <div className="relative z-10 w-28 h-28 rounded-3xl glass-panel-custom flex flex-col items-center justify-center overflow-hidden pulse-energy">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
            <div className="scanner" />
            <motion.img 
              src="/logo-impacto.png" 
              alt="Impacto Edu" 
              className="w-16 h-16 object-contain relative z-10 rounded-2xl"
              animate={{ 
                y: [-4, 4, -4],
                scale: [0.95, 1.05, 0.95],
                filter: [
                  'drop-shadow(0 0 8px rgba(0, 229, 255, 0.3))',
                  'drop-shadow(0 0 16px rgba(0, 229, 255, 0.8))',
                  'drop-shadow(0 0 8px rgba(0, 229, 255, 0.3))'
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* Percentual Flutuante (estilo futurista) */}
          <div className="absolute -right-12 -top-4 glass-panel-custom px-3 py-1 rounded-full border border-white/10">
            <span className="text-[11px] font-bold tracking-wider text-cyan-300 drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]">
              {progress.toString().padStart(2, '0')}%
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-black tracking-[0.2em] text-white/90 drop-shadow-md">
            IMPACTO EDU
          </h1>
          <p className="text-[10px] font-medium tracking-[0.3em] text-white/40 mt-2 uppercase">
            Educação que transforma
          </p>
        </div>

        {/* Rotating Messages */}
        <div className="h-8 relative w-64 flex justify-center items-center mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIndex}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.4 }}
              className="absolute text-[13px] font-semibold text-blue-200/80 tracking-wide text-center"
            >
              {MESSAGES[msgIndex]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Módulos Carregando (Checklist) */}
        <div className="flex flex-col gap-3 w-64">
          {MODULES.map((mod, i) => {
            const isActive = i <= modulesLoaded
            return (
              <div key={mod} className="flex items-center gap-3">
                <motion.div
                  initial={false}
                  animate={{
                    color: isActive ? '#00E5FF' : '#475569',
                    scale: isActive ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <CheckCircle2 size={14} className={isActive ? 'drop-shadow-[0_0_5px_rgba(0,229,255,0.6)]' : 'opacity-40'} />
                </motion.div>
                <motion.span
                  initial={false}
                  animate={{
                    color: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                    x: isActive ? 0 : -5
                  }}
                  className="text-[11px] font-medium tracking-wide uppercase"
                >
                  {mod}
                </motion.span>
              </div>
            )
          })}
        </div>

      </motion.div>

      {/* Explosão de luz no 100% */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center"
          >
            <div className="w-[800px] h-[800px] bg-cyan-400/20 rounded-full blur-[100px]" />
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
