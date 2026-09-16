'use client'

import React, { useState, useEffect } from 'react'
import { ImpactoCinematicSplash } from '@/components/splash/ImpactoCinematicSplash'

export default function SplashPreviewPage() {
  const [mode, setMode] = useState<'demo' | 'app' | 'manual'>('manual')
  const [key, setKey] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [triggerConvergence, setTriggerConvergence] = useState(false)
  const [preventExit, setPreventExit] = useState(true)
  const [showComparison, setShowComparison] = useState(false)
  const [lastEvent, setLastEvent] = useState<string>('Exibição contínua sem redirecionamento')

  const handleRestart = () => {
    setIsReady(false)
    setTriggerConvergence(false)
    setKey(k => k + 1)
    setLastEvent('Animação reiniciada (Mantendo visível)')
  }

  // Simulação no modo 'app' se o usuário selecionar esse modo
  useEffect(() => {
    if (mode !== 'app') return

    setIsReady(false)
    setTriggerConvergence(false)
    setLastEvent('Modo App: Simulando carregamento de 2s...')

    const t = setTimeout(() => {
      setIsReady(true)
      setLastEvent('App pronto! Convergência iniciada (sem redirecionar).')
    }, 2000)

    return () => clearTimeout(t)
  }, [mode, key])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#020408',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Barra Superior de Controles e Inspeção ── */}
      <header
        style={{
          height: '56px',
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 100000000,
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em', color: '#38bdf8' }}>
            IMPACTO EDU
          </span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: 'rgba(56, 189, 248, 0.18)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            Cinematic Preview
          </span>
        </div>

        {/* Controles de Modo e Ações */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Seletor de Modo */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => { setMode('manual'); handleRestart(); }}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mode === 'manual' ? '#0284c7' : 'transparent',
                color: mode === 'manual' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.2s',
              }}
            >
              Inspeção Contínua
            </button>

            <button
              onClick={() => { setMode('demo'); handleRestart(); }}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mode === 'demo' ? '#0284c7' : 'transparent',
                color: mode === 'demo' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.2s',
              }}
            >
              Modo Demo (Acelerado ~3.5s)
            </button>

            <button
              onClick={() => { setMode('app'); handleRestart(); }}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mode === 'app' ? '#0284c7' : 'transparent',
                color: mode === 'app' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.2s',
              }}
            >
              Modo Real (Simulado)
            </button>
          </div>

          {/* Botão para disparar a convergência manualmente */}
          <button
            onClick={() => {
              setTriggerConvergence(true)
              setLastEvent('Convergência disparada manualmente!')
            }}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              backgroundColor: 'rgba(168, 85, 247, 0.18)',
              color: '#e9d5ff',
              cursor: 'pointer',
            }}
          >
            Disparar Convergência ⚡
          </button>

          {/* Toggle de Bloqueio de Saída */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer', marginLeft: '4px' }}>
            <input
              type="checkbox"
              checked={preventExit}
              onChange={e => setPreventExit(e.target.checked)}
              style={{ accentColor: '#38bdf8' }}
            />
            Impedir Saída (Sem Fechar)
          </label>

          {/* Botão Comparar com Referência */}
          <button
            onClick={() => setShowComparison(prev => !prev)}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              backgroundColor: showComparison ? '#475569' : 'rgba(30, 41, 59, 0.6)',
              color: '#f8fafc',
            }}
          >
            {showComparison ? 'Ocultar Referência' : 'Comparar Referência'}
          </button>

          {/* Botão Reiniciar */}
          <button
            onClick={handleRestart}
            style={{
              padding: '5px 14px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#38bdf8',
              color: '#0f172a',
            }}
          >
            Reiniciar ⟲
          </button>
        </div>
      </header>

      {/* ── Status Bar Discreta ── */}
      <div
        style={{
          padding: '4px 16px',
          fontSize: '11px',
          color: '#94a3b8',
          backgroundColor: '#020617',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 99999999,
        }}
      >
        <span>Status: <strong style={{ color: '#38bdf8' }}>{lastEvent}</strong></span>
        <span>Aviso: O redirecionamento automático está desativado no Preview</span>
      </div>

      {/* ── Área Principal de Exibição ── */}
      <main
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: '#020409',
        }}
      >
        {/* Painel de Comparação lado a lado (quando ativado) */}
        {showComparison && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '16px',
              bottom: '12px',
              width: 'clamp(260px, 32vw, 420px)',
              zIndex: 100000000,
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              backgroundColor: '#000000',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '8px 12px', backgroundColor: '#0f172a', fontSize: '11px', fontWeight: 600, color: '#38bdf8', display: 'flex', justifyContent: 'space-between' }}>
              <span>Frame de Referência (720 × 1280)</span>
              <span style={{ color: '#94a3b8' }}>Visual Oficial</span>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <img
                src="/reference-frame.png"
                alt="Referência Oficial"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            </div>
          </div>
        )}

        {/* Animação Cinematográfica Recriada */}
        <ImpactoCinematicSplash
          key={key}
          mode={mode}
          isReady={isReady}
          preventExit={preventExit}
          triggerConvergence={triggerConvergence}
          onDemoFinish={() => setLastEvent('Modo Demo concluído (Animação mantida aberta)')}
          onReadyComplete={() => setLastEvent('Convergência concluída! (Mantendo aberta conforme configurado)')}
        />
      </main>
    </div>
  )
}
