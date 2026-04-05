import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Monitor TV · IMPACTO EDU',
  description: 'Painel de chamadas em tempo real para TV da portaria escolar.',
}

// Fullscreen TV layout — no sidebar, no topbar
export default function MonitorTVLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
