'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

export default function StudentChatPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const alunoId = params?.slug || ''

  useEffect(() => {
    const qp = searchParams?.toString() || ''
    const target = `/agenda-digital/${alunoId}/comunicados${qp ? `?${qp}` : ''}`
    router.replace(target)
  }, [alunoId, router, searchParams])

  return null
}
