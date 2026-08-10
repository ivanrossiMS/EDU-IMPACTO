'use client'

import React from 'react'

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
        background: '#0A0F24',
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 32,
          background: '#ffffff',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        {/* Animated halo */}
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 36,
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(99, 102, 241, 0.1) 60%, rgba(99, 102, 241, 0.8) 100%)',
            WebkitMaskImage: 'radial-gradient(circle at center, transparent 48%, black 50%)',
            maskImage: 'radial-gradient(circle at center, transparent 48%, black 50%)',
            animation: 'impactoSpin 2s linear infinite'
          }}
        />

        {/* Logo Impacto */}
        <img 
          src="/logo-impacto.png" 
          alt="Carregando..." 
          style={{ width: 48, height: 48, objectFit: 'contain', zIndex: 10 }}
        />
      </div>
      <style>{`
        @keyframes impactoSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
