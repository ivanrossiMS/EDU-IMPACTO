'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ShaiRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/gestao-pessoas/shai')
  }, [router])

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
