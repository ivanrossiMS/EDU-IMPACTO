import { SaidaProvider } from '@/lib/saidaContext'

export default function SaidaAlunosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SaidaProvider>
      {children}
    </SaidaProvider>
  )
}
