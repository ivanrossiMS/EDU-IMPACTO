// app/agenda-digital/mensagens/layout.tsx
// Layout simples para a página de mensagens — sem padding/scroll extra (a página gerencia o próprio layout)

export default function MensagensLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ 
      height: '100%', 
      width: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {children}
    </div>
  )
}
