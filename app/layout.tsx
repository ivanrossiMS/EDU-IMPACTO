import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/lib/context'
import { ReactQueryProvider } from '@/components/ReactQueryProvider'
import { GlobalAccessGuard } from '@/components/layout/GlobalAccessGuard'
import { Suspense } from 'react'


export const metadata: Metadata = {
  title: 'IMPACTO EDU — Sistema de Gestão Escolar',
  description: 'Plataforma enterprise de gestão escolar completa — acadêmico, financeiro, RH, CRM, comunicação, BI e IA.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0d1117'
}

import { GlobalNavigationLoader } from '@/components/layout/GlobalNavigationLoader'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  
  return (
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Preconnect para carregamento não-bloqueante das fontes */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <GlobalNavigationLoader />
        </Suspense>
        <ReactQueryProvider>
          <AppProvider>
            <GlobalAccessGuard>
              {children}
            </GlobalAccessGuard>
          </AppProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}

