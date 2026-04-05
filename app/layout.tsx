import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/lib/context'
import { SaidaProvider } from '@/lib/saidaContext'
import { QueryProvider } from '@/lib/query-provider'

export const metadata: Metadata = {
  title: 'IMPACTO EDU — Sistema de Gestão Escolar',
  description: 'Plataforma enterprise de gestão escolar completa — acadêmico, financeiro, RH, CRM, comunicação, BI e IA.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <AppProvider>
            <SaidaProvider>
              {children}
            </SaidaProvider>
          </AppProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
