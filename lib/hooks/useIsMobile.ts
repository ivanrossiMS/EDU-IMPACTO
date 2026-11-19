'use client'
import { useEffect, useState } from 'react'

type Listener = (matches: boolean) => void
const breakpointListeners = new Map<number, { listeners: Set<Listener>; cleanup?: () => void }>()

function subscribeBreakpoint(breakpoint: number, listener: Listener): () => void {
  if (typeof window === 'undefined') return () => {}
  let entry = breakpointListeners.get(breakpoint)
  if (!entry) {
    const listeners = new Set<Listener>()
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const notify = () => {
      const matches = window.innerWidth < breakpoint
      listeners.forEach(fn => fn(matches))
    }
    const debouncedNotify = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(notify, 120)
    }
    window.addEventListener('resize', debouncedNotify)
    window.addEventListener('orientationchange', notify)
    entry = {
      listeners,
      cleanup: () => {
        if (timeoutId) clearTimeout(timeoutId)
        window.removeEventListener('resize', debouncedNotify)
        window.removeEventListener('orientationchange', notify)
        breakpointListeners.delete(breakpoint)
      },
    }
    breakpointListeners.set(breakpoint, entry)
  }
  entry.listeners.add(listener)
  listener(window.innerWidth < breakpoint)
  return () => {
    const current = breakpointListeners.get(breakpoint)
    if (!current) return
    current.listeners.delete(listener)
    if (current.listeners.size === 0) {
      current.cleanup?.()
    }
  }
}

/** Returns true when viewport width < breakpoint (default 768px). Updates on resize. */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    return subscribeBreakpoint(breakpoint, setIsMobile)
  }, [breakpoint])

  return isMobile
}
