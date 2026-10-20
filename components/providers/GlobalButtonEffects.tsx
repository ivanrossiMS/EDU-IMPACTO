'use client'

import { useEffect } from 'react'
import { triggerHaptic } from '@/lib/utils/haptics'

const BUTTON_RIPPLE_SELECTOR =
  'button, [role="button"], .btn, input[type="button"], input[type="submit"], input[type="reset"]'

const SEMANTIC_HAPTIC_SELECTOR = [
  'button',
  'a[href]',
  'a',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '.btn',
  '.ad-action-btn',
  '.ad-btn-side',
  '.ad-quick-nav-item',
  '.ad-switcher-item',
  '.portal-modern-card',
  '.ad-nc-tool-btn',
  '.ad-student-logout-btn',
  'summary',
  'select',
  'label',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="color"]',
  'input[type="file"]',
  '[data-haptic]'
].join(', ')

const STOP_BOUNDARY_TAGS = new Set(['BODY', 'HTML', 'MAIN', 'FORM'])

const TEXT_INPUT_TYPES = new Set([
  'text',
  'email',
  'password',
  'search',
  'tel',
  'url',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week'
])

function isDisabledElement(el: HTMLElement): boolean {
  return (
    el.hasAttribute('disabled') ||
    el.getAttribute('aria-disabled') === 'true' ||
    el.classList.contains('disabled') ||
    el.classList.contains('disabled-card') ||
    el.classList.contains('is-card-loading') ||
    el.hasAttribute('data-no-haptic')
  )
}

function isStopPropagationOnly(fn: unknown): boolean {
  if (typeof fn !== 'function') return false
  try {
    const src = Function.prototype.toString.call(fn).replace(/\s+/g, '')
    return /^(\(?[a-zA-Z0-9_$]*\)?=>|function\([a-zA-Z0-9_$]*\))\{?(return)?[a-zA-Z0-9_$]+\.stopPropagation\(\);?\}?$/.test(
      src
    )
  } catch {
    return false
  }
}

function getReactClickProp(el: HTMLElement): { hasClick: boolean; stopOnly: boolean } {
  try {
    const keys = Object.keys(el)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (key.startsWith('__reactProps$')) {
        const props = (el as any)[key]
        if (!props) continue
        if (typeof props.onClick === 'function') {
          if (isStopPropagationOnly(props.onClick)) {
            return { hasClick: false, stopOnly: true }
          }
          return { hasClick: true, stopOnly: false }
        }
        if (typeof props.onMouseDown === 'function') {
          return { hasClick: true, stopOnly: false }
        }
      }
    }
  } catch {
    // Ignora silenciosamente
  }
  return { hasClick: false, stopOnly: false }
}

function isLargeViewportOverlay(el: HTMLElement): boolean {
  try {
    const rect = el.getBoundingClientRect()
    return (
      rect.width >= window.innerWidth * 0.85 &&
      rect.height >= window.innerHeight * 0.75
    )
  } catch {
    return false
  }
}

function findInteractiveHapticElement(target: HTMLElement | null): HTMLElement | null {
  if (!target || typeof window === 'undefined') return null

  // Ignora clique direto em campos de digitação de texto
  const tagName = target.tagName
  if (tagName === 'TEXTAREA' || target.isContentEditable) return null
  if (tagName === 'INPUT') {
    const inputType = ((target as HTMLInputElement).type || 'text').toLowerCase()
    if (TEXT_INPUT_TYPES.has(inputType)) return null
  }

  // 1. Verifica elementos interativos semânticos (botões, links <a>/<Link>, abas, switches, etc.)
  const semantic = target.closest(SEMANTIC_HAPTIC_SELECTOR) as HTMLElement | null
  if (semantic) {
    if (isDisabledElement(semantic)) return null

    if (semantic.tagName === 'LABEL') {
      const hasInteractiveInput = Boolean(
        semantic.querySelector(
          'input[type="file"], input[type="checkbox"], input[type="radio"], input[type="color"], input[type="button"], input[type="submit"]'
        )
      )
      const hasClick = getReactClickProp(semantic).hasClick
      const isPointer =
        semantic.style?.cursor === 'pointer' ||
        semantic.classList.contains('cursor-pointer') ||
        semantic.classList.contains('ad-nc-tool-btn')
      if (!hasInteractiveInput && !hasClick && !isPointer) {
        return null
      }
    }

    return semantic
  }

  // 2. Verifica elementos customizados clicáveis (ex.: cards, filtros, itens de lista, ícones com onClick ou cursor: pointer)
  let current: HTMLElement | null = target
  for (let depth = 0; depth < 6 && current; depth++) {
    if (
      STOP_BOUNDARY_TAGS.has(current.tagName) ||
      current.getAttribute('role') === 'dialog' ||
      current.classList.contains('ad-main-scroll') ||
      current.classList.contains('ad-content-inner') ||
      current.classList.contains('ad-content-page-area') ||
      current.classList.contains('ad-modal-container')
    ) {
      break
    }

    if (isDisabledElement(current)) return null

    const reactClick = getReactClickProp(current)
    if (reactClick.stopOnly) {
      // Atingiu o container interno de um modal (e.stopPropagation): para de subir para não acionar o backdrop
      break
    }

    if (current !== target && isLargeViewportOverlay(current)) {
      break
    }

    if (reactClick.hasClick || typeof current.onclick === 'function') {
      return current
    }

    if (
      current.style?.cursor === 'pointer' ||
      current.classList.contains('cursor-pointer') ||
      (depth === 0 && window.getComputedStyle(current).cursor === 'pointer')
    ) {
      if (!isLargeViewportOverlay(current)) {
        return current
      }
    }

    current = current.parentElement
  }

  return null
}

function shouldVibrateOnPointerDown(el: HTMLElement, pointerType: string): boolean {
  if (pointerType !== 'touch') return true

  const tag = el.tagName
  if (
    tag === 'BUTTON' ||
    tag === 'SELECT' ||
    tag === 'SUMMARY' ||
    tag === 'INPUT' ||
    tag === 'LABEL' ||
    el.hasAttribute('data-haptic') ||
    el.classList.contains('btn') ||
    el.classList.contains('ad-action-btn') ||
    el.classList.contains('ad-btn-side') ||
    el.classList.contains('ad-quick-nav-item') ||
    el.classList.contains('ad-nc-tool-btn') ||
    el.classList.contains('ad-student-logout-btn')
  ) {
    return true
  }

  const role = el.getAttribute('role')
  if (
    role === 'button' ||
    role === 'tab' ||
    role === 'switch' ||
    role === 'checkbox' ||
    role === 'radio' ||
    role === 'menuitem' ||
    role === 'option'
  ) {
    return true
  }

  // Links de barras de navegação (mobile bottom bar, sidebar, header) vibram imediatamente ao toque
  if (
    el.closest('.ad-nav-mobile-wrapper, .ad-nav-desktop-wrapper, nav, aside, header')
  ) {
    return true
  }

  // Links ou botões compactos (<= 68px de altura) vibram no pointerdown;
  // cards grandes em listas roláveis aguardam confirmação de tap (click) para não vibrar durante scroll
  try {
    const rect = el.getBoundingClientRect()
    if (rect.height > 0 && rect.height <= 68) {
      return true
    }
  } catch {
    // Ignora
  }

  return false
}

/**
 * GlobalButtonEffects
 * 
 * Fornece microinterações, feedback tátil (haptics) e animações de clique (tactile bounce, ripple wave e glow)
 * para todos os botões, links e elementos interativos do sistema de maneira universal e com alta performance.
 */
export function GlobalButtonEffects() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    let hapticFiredOnPointerDownAt = 0

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

      // Limpa classe após a animação
      setTimeout(() => {
        btn.classList.remove('btn-click-animating')
      }, 400)
    }

    const handlePointerDown = (e: PointerEvent) => {
      // Ignora botão direito ou secundário do mouse
      if (e.pointerType === 'mouse' && e.button !== 0) return

      const target = e.target as HTMLElement | null
      if (!target) return

      // 1. Feedback tátil (Haptics) para botões, links e controles interativos
      const interactiveEl = findInteractiveHapticElement(target)
      if (interactiveEl && shouldVibrateOnPointerDown(interactiveEl, e.pointerType)) {
        hapticFiredOnPointerDownAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
        void triggerHaptic('impactLight')
      } else {
        hapticFiredOnPointerDownAt = 0
      }

      // 2. Animação visual de clique (ripple/bounce) exclusiva para botões elegíveis
      const btn = target.closest(BUTTON_RIPPLE_SELECTOR) as HTMLElement | null
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

      animateButton(btn, e.clientX, e.clientY)
    }

    const handleClick = (e: MouseEvent) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      // Se já vibrou no pointerdown deste mesmo toque, não repete no click
      if (hapticFiredOnPointerDownAt > 0 && now - hapticFiredOnPointerDownAt < 500) {
        hapticFiredOnPointerDownAt = 0
        return
      }
      hapticFiredOnPointerDownAt = 0

      const target = e.target as HTMLElement | null
      if (!target) return

      const interactiveEl = findInteractiveHapticElement(target)
      if (interactiveEl) {
        void triggerHaptic('impactLight')
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const active = document.activeElement as HTMLElement | null
        if (!active) return

        const interactiveEl = findInteractiveHapticElement(active)
        if (interactiveEl) {
          void triggerHaptic('impactLight')
        }

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
    document.addEventListener('click', handleClick, { passive: true, capture: true })
    document.addEventListener('keydown', handleKeyDown, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      document.removeEventListener('click', handleClick, { capture: true })
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return null
}
