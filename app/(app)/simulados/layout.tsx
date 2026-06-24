'use client'

import { SidebarSimulados } from '@/components/layout/SidebarSimulados'
import { usePathname } from 'next/navigation'

export default function SimuladosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Se for a rota de impressão (PDF), não renderiza a sidebar nem formatação extra
  const isPrintView = pathname?.includes('/imprimir') || pathname?.includes('/gabarito')

  if (isPrintView) {
    return <>{children}</>
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'hsl(var(--bg-app))' }}>
      <SidebarSimulados />
      <div 
        style={{ 
          flex: 1, 
          height: '100vh', 
          overflowY: 'auto', 
          position: 'relative',
          background: 'hsl(var(--bg-app))'
        }}
        className="no-scrollbar"
      >
        <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', minHeight: '100vh', paddingBottom: 60 }}>
          {children}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  )
}
