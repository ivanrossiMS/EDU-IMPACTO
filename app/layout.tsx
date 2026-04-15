import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/lib/context'


export const metadata: Metadata = {
  title: 'IMPACTO EDU — Sistema de Gestão Escolar',
  description: 'Plataforma enterprise de gestão escolar completa — acadêmico, financeiro, RH, CRM, comunicação, BI e IA.',
}

import { ReactQueryProvider } from '@/components/ReactQueryProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
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

