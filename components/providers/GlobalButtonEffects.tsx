'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * GlobalButtonEffects
 * 
 * Fornece microinterações e animações de clique (tactile bounce, ripple wave e glow)
 * para todos os botões e elementos interativos do sistema de maneira universal e com alta performance.
 */
export function GlobalButtonEffects() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    // Trigger haptic leve de forma segura
    const triggerHaptic = async () => {
      try {
        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics')) {
          const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
          await Haptics.impact({ style: ImpactStyle.Light })
        }
      } catch {
        // Ignora silenciosamente em navegadores sem suporte
      }
    }

    const createRipple = (btn: HTMLElement, clientX: number, clientY: number) => {
      // Se tiver data-no-ripple ou no-click-anim, não adiciona ondulação
      if (
        btn.hasAttribute('data-no-ripple') ||
        btn.classList.contains('no-ripple') ||
        btn.classList.contains('no-click-anim')
      ) {
        return
      }

      const rect = btn.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      // Posição do clique relativo ao botão
      const x = clientX - rect.left
      const y = clientY - rect.top

      // Diâmetro suficiente para cobrir qualquer canto do botão
      const size = Math.max(rect.width, rect.height) * 2.4

      const ripple = document.createElement('span')
      ripple.className = 'global-btn-ripple'
      ripple.style.width = `${size}px`
      ripple.style.height = `${size}px`
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`

      // Assegura que o container tenha contexto de posicionamento sem sobrescrever absolute ou fixed
      const computedPos = window.getComputedStyle(btn).position
      if (computedPos === 'static') {
        btn.classList.add('btn-ripple-container')
      } else {
        btn.style.overflow = 'hidden'
      }

      btn.appendChild(ripple)

      // Remove a ondulação após a conclusão da animação
      setTimeout(() => {
        ripple.remove()
      }, 600)
    }

    const animateButton = (btn: HTMLElement, clientX?: number, clientY?: number) => {
      // Ignora botões com animação desativada ou posicionamento absoluto
      if (
        btn.classList.contains('no-click-anim') ||
        btn.classList.contains('no-ripple') ||
        btn.hasAttribute('data-no-ripple') ||
        window.getComputedStyle(btn).position === 'absolute'
      ) {
        return
      }

      // 1. Aplica classe de animação com reinício de frame
      btn.classList.remove('btn-click-animating')
      // Força reflow para permitir múltiplos cliques consecutivos
      void btn.offsetWidth
      btn.classList.add('btn-click-animating')

      // 2. Ripple
      if (clientX !== undefined && clientY !== undefined) {
        createRipple(btn, clientX, clientY)
      } else {
        // Se ativado por teclado, cria o ripple a partir do centro
        const rect = btn.getBoundingClientRect()
        createRipple(btn, rect.left + rect.width / 2, rect.top + rect.height / 2)
      }

      // 3. Feedback tátil no mobile
      triggerHaptic()

      // Limpa classe após a animação
      setTimeout(() => {
        btn.classList.remove('btn-click-animating')
      }, 400)
    }

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      // Encontra o botão ou elemento com role button mais próximo
      const btn = target.closest(
        'button, [role="button"], .btn, input[type="button"], input[type="submit"], input[type="reset"]'
      ) as HTMLElement | null

      if (!btn) return

      // Ignora botões desabilitados ou que explicitamente optaram por sair
      if (
        btn.hasAttribute('disabled') ||
        btn.getAttribute('aria-disabled') === 'true' ||
        btn.classList.contains('disabled') ||
        btn.classList.contains('no-click-anim') ||
        btn.classList.contains('no-ripple') ||
        btn.hasAttribute('data-no-ripple') ||
        window.getComputedStyle(btn).position === 'absolute'
      ) {
        return
      }

      animateButton(btn, e.clientX, e.clientY)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const active = document.activeElement as HTMLElement | null
        if (!active) return

        const btn = active.closest(
          'button, [role="button"], .btn, input[type="button"], input[type="submit"]'
        ) as HTMLElement | null

        if (!btn) return

        if (
          btn.hasAttribute('disabled') ||
          btn.getAttribute('aria-disabled') === 'true' ||
          btn.classList.contains('disabled') ||
          btn.classList.contains('no-click-anim') ||
          btn.classList.contains('no-ripple') ||
          btn.hasAttribute('data-no-ripple') ||
          window.getComputedStyle(btn).position === 'absolute'
        ) {
          return
        }

        animateButton(btn)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, { passive: true, capture: true })
    document.addEventListener('keydown', handleKeyDown, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return null
}
