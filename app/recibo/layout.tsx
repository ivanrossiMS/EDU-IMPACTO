// Layout mínimo para as rotas públicas em /recibo/* (herda html/body de app/layout.tsx)
export default function PublicReciboLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
