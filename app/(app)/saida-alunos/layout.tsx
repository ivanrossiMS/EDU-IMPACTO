'use client'
import { usePathname } from 'next/navigation'
import { SaidaProvider } from '@/lib/saidaContext'

export default function SaidaAlunosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const fetchCalls = pathname !== '/saida-alunos/anunciar' && pathname !== '/saida-alunos/configuracoes'

  return (
    <SaidaProvider fetchCalls={fetchCalls}>
      {children}
    </SaidaProvider>
  )
}
