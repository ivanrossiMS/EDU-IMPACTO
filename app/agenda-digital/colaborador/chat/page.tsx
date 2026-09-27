'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ColaboradorChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const qp = searchParams?.toString() || ''
    const target = `/agenda-digital/colaborador/comunicados${qp ? `?${qp}` : ''}`
    router.replace(target)
  }, [router, searchParams])

  return null
}
