'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'

export default function Root() {
  const router = useRouter()
  const { currentUser, hydrated } = useApp()

  useEffect(() => {
    // Wait for AppProvider to hydrate the session from localStorage/Capacitor Preferences
    if (!hydrated) return

    // If no user is logged in, redirect to /login on the client side.
    // This avoids server-side 302 redirects on provisional navigation.
    if (!currentUser) {
      console.log('[Root] Redirecting to /login (client-side)');
      router.replace('/login')
      return
    }

    const perfil = currentUser.perfil || ''
    const cargo = currentUser.cargo || ''
    const isFamilyOrStudent = (
      perfil === 'Família' ||
      perfil === 'Responsável' ||
      perfil === 'Aluno' ||
      cargo === 'Responsável' ||
      cargo === 'Aluno'
    )

    if (isFamilyOrStudent) {
      if (cargo === 'Aluno' && currentUser.aluno_id) {
        router.replace(`/agenda-digital/${currentUser.aluno_id}/comunicados`)
        return
      }
      router.replace('/agenda-digital/selecionar-aluno')
    } else {
      router.replace('/login?step=choose_system')
    }
  }, [hydrated, currentUser, router])

  // Return a blank dark container to look premium and seamless during client-side hydration
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0A0F24',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }} />
  )
}
