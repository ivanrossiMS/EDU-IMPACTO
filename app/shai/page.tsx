'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { getCachedPerfis, resolveUserPerfil, isPlataformaShaiBlocked } from '@/lib/auth/moduleRouting'

export default function ShaiRedirectPage() {
  const router = useRouter()
  const { currentUser, currentUserPerfil, hydrated } = useApp()

  useEffect(() => {
    if (!hydrated) return

    const cachedPerfis = getCachedPerfis()
    const userPerfilObj = resolveUserPerfil(cachedPerfis, currentUserPerfil, currentUser)
    if (isPlataformaShaiBlocked(userPerfilObj)) {
      router.replace('/gestao-pessoas')
    } else {
      router.replace('/gestao-pessoas/shai')
    }
  }, [router, currentUser, currentUserPerfil, hydrated])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      color: '#64748b'
    }}>
      Redirecionando para a Plataforma SHAI...
    </div>
  )
}
