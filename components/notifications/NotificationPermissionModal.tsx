/**
 * NotificationPermissionModal.tsx
 *
 * Modal elegante em português do Impacto Edu para orientar o usuário a ativar
 * as notificações nos Ajustes do aparelho caso tenham sido negadas.
 *
 * - Substitui completamente o alerta em inglês ("Open Settings").
 * - Não é invasivo: permite dispensar com "Agora não".
 * - Fecha automaticamente caso o usuário volte dos Ajustes com as notificações ativadas.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BellRing, Settings2, X } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const DISMISS_SESSION_KEY = 'edu_push_blocked_dismissed_session'

export function NotificationPermissionModal() {
  const { isDenied, isAuthorized, isLoading, openSettings } = usePushNotifications()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isDismissedThisSession = sessionStorage.getItem(DISMISS_SESSION_KEY) === 'true'
    setDismissed(isDismissedThisSession)
  }, [])

  // Se o usuário já autorizou, garante que fique fechado
  useEffect(() => {
    if (isAuthorized) {
      setDismissed(true)
    }
  }, [isAuthorized])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_SESSION_KEY, 'true')
    } catch {}
  }

  const handleOpenSettings = async () => {
    handleDismiss()
    await openSettings()
  }

  // Apenas renderiza se o status for estritamente 'denied', não estiver carregando e não foi dispensado
  const shouldShow = isDenied && !isLoading && !dismissed

  return (
    <AnimatePresence>
      {shouldShow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 24,
              padding: 24,
              color: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.2)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Efeito sutil de iluminação */}
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: -40,
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            {/* Botão fechar discreto */}
            <button
              onClick={handleDismiss}
              aria-label="Fechar"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: 12,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#94a3b8',
                transition: 'all 0.2s',
              }}
            >
              <X size={16} />
            </button>

            {/* Ícone */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.35)',
              }}
            >
              <BellRing size={26} color="#ffffff" />
            </div>

            {/* Título Oficial */}
            <h3
              style={{
                fontSize: 19,
                fontWeight: 700,
                marginBottom: 10,
                color: '#ffffff',
                letterSpacing: '-0.02em',
              }}
            >
              Ativar notificações
            </h3>

            {/* Mensagem Oficial */}
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: '#cbd5e1',
                marginBottom: 24,
              }}
            >
              As notificações do Impacto Edu estão desativadas neste aparelho. Ative-as nos Ajustes para receber comunicados, avisos de entrada e saída e outras informações importantes.
            </p>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleDismiss}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 14,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#e2e8f0',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                Agora não
              </button>

              <button
                onClick={handleOpenSettings}
                style={{
                  flex: 1.5,
                  padding: '12px 18px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <Settings2 size={16} />
                Abrir Ajustes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
