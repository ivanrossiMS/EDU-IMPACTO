'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'

export default function ShaiRedirectPage() {
  const router = useRouter()
  const { currentUser, hydrated } = useApp()

  useEffect(() => {
    if (!hydrated) return

    const isAdmin = 
      currentUser?.cargo === 'Administrador Master' || 
      currentUser?.perfil === 'Administrador' || 
      currentUser?.perfil === 'Diretor Geral' ||
      currentUser?.cargo === 'Diretor Geral' ||
      currentUser?.perfil === 'Administrador Master' ||
      currentUser?.cargo === 'Administrador'

    if (isAdmin) {
      router.replace('/gestao-pessoas/shai')
    } else {
      router.replace('/gestao-pessoas')
    }
  }, [router, currentUser, hydrated])

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
