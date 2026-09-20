'use client'
import { useEffect, useState } from 'react'

/** Returns true when viewport width < 768px (mobile). Updates on resize. */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const check = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    const debouncedCheck = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(check, 120)
    }

    check()
    window.addEventListener('resize', debouncedCheck)
    window.addEventListener('orientationchange', check)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedCheck)
      window.removeEventListener('orientationchange', check)
    }
  }, [breakpoint])

  return isMobile
}
