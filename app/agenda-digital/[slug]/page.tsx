'use client'
import { useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function GenericSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = use(params)

  useEffect(() => {
    // Prevent 404 on deep links like /agenda-digital/comunicados
    // Layout interceptor handles this, but we need this leaf page to exist so Next.js doesn't 404
    if (resolvedParams?.slug) {
      const sp = new URLSearchParams(searchParams?.toString() || '')
      sp.set('redirect', resolvedParams.slug)
      router.replace(`/agenda-digital?${sp.toString()}`)
    }
  }, [resolvedParams, router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="animate-pulse">Carregando redirecionamento...</div>
    </div>
  )
}
