import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Painel Tablet · Portaria · IMPACTO EDU',
  description: 'Painel de controle de saída de alunos para tablet da portaria escolar.',
}

// Standalone tablet layout — no sidebar, no topbar
// DataProvider foi removido para otimizar desempenho já que o painel usa fetches isolados
export default function PainelTabletLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  )
}
