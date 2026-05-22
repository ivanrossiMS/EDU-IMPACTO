import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/lib/context'
import { ReactQueryProvider } from '@/components/ReactQueryProvider'

export const metadata: Metadata = {
  title: 'IMPACTO EDU — Sistema de Gestão Escolar',
  description: 'Plataforma enterprise de gestão escolar completa — acadêmico, financeiro, RH, CRM, comunicação, BI e IA.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Preconnect para carregamento não-bloqueante das fontes */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0d1117" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <ReactQueryProvider>
          <AppProvider>
            {children}
          </AppProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}

