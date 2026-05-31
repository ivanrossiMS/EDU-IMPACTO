'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BellRing, X } from 'lucide-react'

export function PushPermissionBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    const checkPermission = async () => {
      // 1. Verificamos se há suporte e OneSignal está carregado
      if (!window.OneSignal) return

      // 2. Verifica se o usuário já dispensou (salvo no localStorage)
      const isDismissed = localStorage.getItem('edu_push_dismissed')
      if (isDismissed === 'true') return

      try {
        // Aguarda a inicialização do OneSignal, caso não tenha acontecido
        if (!window.OneSignal.initialized) {
          // A inicialização principal ocorre no AgendaRealtimeProvider
          // Então esperamos silenciosamente...
          return
        }

        // Verifica a permissão atual nativamente
        const permission = Notification.permission
        
        // Se a permissão for default (ainda não perguntou), nós exibimos o banner
        if (permission === 'default') {
          setIsVisible(true)
        }
      } catch (e) {
        console.warn('[Push Banner] Falha ao verificar permissões', e)
      }
    }

    // Atraso intencional para não ser muito agressivo no primeiro render
    const timer = setTimeout(checkPermission, 3000)
    return () => clearTimeout(timer)
  }, [])

  const handleActivate = async () => {
    setIsVisible(false)
    try {
      if (window.OneSignal) {
        await window.OneSignal.Slidedown.promptPush()
      } else {
        // Fallback nativo caso o objeto OneSignal não responda de imediato
        await Notification.requestPermission()
      }
    } catch (e) {
      console.error('[Push Banner] Erro ao solicitar permissão:', e)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('edu_push_dismissed', 'true')
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md"
        >
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
            {/* Background glow para dar ar premium */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 relative z-10">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <BellRing className="w-5 h-5 animate-pulse" />
              </div>
              
              <div className="flex-1 pt-0.5">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">
                  Ativar Notificações
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Fique por dentro! Receba avisos instantâneos sobre comunicados, momentos, faltas e muito mais.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1 relative z-10">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Agora não
              </button>
              <button
                onClick={handleActivate}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all hover:shadow-blue-500/40 active:scale-95"
              >
                Ativar agora
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
