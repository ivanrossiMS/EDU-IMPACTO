'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

let globalMounted = false

export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(globalMounted)
  
  useEffect(() => {
    globalMounted = true
    setMounted(true)
  }, [])
  
  if (!mounted) return null
  return createPortal(children, document.body)
}
