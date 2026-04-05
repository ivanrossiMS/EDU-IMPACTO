import type { Metadata } from 'next'
import { DataProvider } from '@/lib/dataContext'

export const metadata: Metadata = {
  title: 'Painel Tablet · Portaria · IMPACTO EDU',
  description: 'Painel de controle de saída de alunos para tablet da portaria escolar.',
}

// Standalone tablet layout — no sidebar, no topbar
// DataProvider is required so the page can read alunos/saude.autorizados
export default function PainelTabletLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      {children}
    </DataProvider>
  )
}
