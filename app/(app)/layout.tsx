'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { RouteGuard } from '@/components/layout/RouteGuard'
import { useApp } from '@/lib/context'
import { DataProvider } from '@/lib/dataContext'
import { DialogProvider } from '@/lib/dialogContext'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSessionUser } from '@/app/actions/authActions'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, setCurrentUser } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Valida a Sessão Real no Servidor preveindo Spoofing de LocalStorage
      const serverUser: any = await getSessionUser();
      
      if (!serverUser) {
         setCurrentUser(null)
         window.location.href = '/login'
         return
      }

      const p = serverUser.perfil
      const cargo = serverUser.cargo

      // Garante que o localStorage reflita a verdade pura vinda do token Criptografado
      setCurrentUser(serverUser)

      // ─────────────────────────────────────────────────────────────────
      // 2. Políticas OBRIGATÓRIAS de RBAC (Autorização de Nível de Objeto)
      // ─────────────────────────────────────────────────────────────────

      // Família, Aluno e Responsável devem acessar EXCLUSIVAMENTE a Agenda Digital
      if (p === 'Família' || cargo === 'Aluno' || cargo === 'Responsável' || p === 'Aluno') {
         if (!pathname.startsWith('/agenda-digital')) {
            router.replace('/agenda-digital')
            return
         }
      }

      if (p === 'Professor') {
         if (!pathname.startsWith('/professor') && !pathname.startsWith('/academico') && !pathname.startsWith('/dashboard') && !pathname.startsWith('/agenda-digital')) {
            router.replace('/dashboard')
            return
         }
      }

      // Previne que visitantes acessem áreas restritas da Diretoria/Financeiro (Exemplo de proteção de diretório)
      if (['Financeiro', 'Tesouraria'].includes(p) && pathname.startsWith('/academico')) {
         router.replace('/financeiro')
         return
      }

      if (['Secretaria', 'Acadêmico'].includes(p) && pathname.startsWith('/financeiro')) {
         router.replace('/academico')
         return
      }

      // Se passou em todas as verificações do Perímetro, Renderiza o conteúdo Sigiloso
      setAuthorized(true)
    };

    checkAuth();
  }, [pathname, router, setCurrentUser])

  // Retorno Seguro Sem Esqueleto (Prevenindo Skeleton Flash / CSR Leak)
  if (!authorized) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(160deg,#08101e 0%,#090d1f 50%,#0a0e1c 100%)', color: 'rgba(255,255,255,0.2)' }}>
        <div style={{width: 30, height: 30, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite'}} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <DataProvider>
      <DialogProvider>
        <div className="app-wrapper">
          <Sidebar />
          <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Topbar />
            <RouteGuard>
              <main className="page-content">
                {children}
              </main>
            </RouteGuard>
          </div>
        </div>
      </DialogProvider>
    </DataProvider>
  )
}
