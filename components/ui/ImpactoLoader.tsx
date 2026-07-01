'use client'

import React from 'react'
import { motion } from 'framer-motion'

export function ImpactoLoader() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.1)', // Overlay de vidro muito leve
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        style={{
          width: 100,
          height: 100,
          borderRadius: 32,
          background: '#ffffff',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'relative'
        }}
      >
        {/* Spinner Halo ao redor do Logo */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 36,
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(99, 102, 241, 0.1) 60%, rgba(99, 102, 241, 0.8) 100%)',
            WebkitMaskImage: 'radial-gradient(circle at center, transparent 48%, black 50%)',
            maskImage: 'radial-gradient(circle at center, transparent 48%, black 50%)'
          }}
        />

        {/* Imagem do Logo Pulsando */}
        <motion.img 
          src="/logo-impacto.png" 
          alt="Carregando..." 
          style={{ width: 48, height: 48, objectFit: 'contain', zIndex: 10 }}
          animate={{ 
            scale: [0.9, 1.1, 0.9],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  )
}
