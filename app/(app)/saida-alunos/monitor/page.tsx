'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Redirects to the standalone monitor TV page (no sidebar).
// useRef guard prevents React Strict Mode from opening the window twice.
export default function MonitorRedirect() {
  const router = useRouter()
  const opened = useRef(false)

  useEffect(() => {
    if (opened.current) return
    opened.current = true
    window.open('/monitor-tv', '_blank', 'noopener')
    router.back()
  }, [router])

  return null
}
