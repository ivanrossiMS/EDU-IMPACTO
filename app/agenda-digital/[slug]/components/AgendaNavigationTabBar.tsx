'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Bell, Image as ImageIcon, Calendar, DollarSign, 
  BarChart2, AlertTriangle, GraduationCap, UserCog 
} from 'lucide-react'
import { triggerHaptic } from '@/lib/utils/haptics'

interface AgendaNavigationTabBarProps {
  alunoId: string
  adConfig: any
  userAccessRole: { isFin: boolean; isPed: boolean; parentesco: string }
}

export const AgendaNavigationTabBar = React.memo(function AgendaNavigationTabBar({
  alunoId,
  adConfig,
  userAccessRole
}: AgendaNavigationTabBarProps) {
  const pathname = usePathname()

  const navItems = [
    { label: 'Comunicados', href: `/agenda-digital/${alunoId}/comunicados`, icon: <Bell size={18} /> },
    { label: 'Mídia', href: `/agenda-digital/${alunoId}/momentos`, icon: <ImageIcon size={18} /> },
    { label: 'Calendário', href: `/agenda-digital/${alunoId}/calendario`, icon: <Calendar size={18} /> },
    { label: 'Financeiro', href: `/agenda-digital/${alunoId}/financeiro`, icon: <DollarSign size={18} /> },
    { label: 'Frequência', href: `/agenda-digital/${alunoId}/frequencia`, icon: <BarChart2 size={18} /> },
    { label: 'Ocorrências', href: `/agenda-digital/${alunoId}/ocorrencias`, icon: <AlertTriangle size={18} /> },
    { label: 'Notas', href: `/agenda-digital/${alunoId}/notas`, icon: <GraduationCap size={18} /> },
    { label: 'Meu Perfil', href: `/agenda-digital/${alunoId}/perfil`, icon: <UserCog size={18} /> },
  ]

  const filteredNavItems = navItems.filter(item => {
    if (item.label === 'Frequência' && adConfig?.permissoes?.visualizarFrequencia === false) return false
    if (item.label === 'Ocorrências' && adConfig?.permissoes?.visualizarOcorrencias === false) return false
    if (item.label === 'Notas' && adConfig?.permissoes?.visualizarNotas === false) return false
    if (item.label === 'Financeiro') {
      if (adConfig?.permissoes?.visualizarFinanceiro === false) return false
      if (!userAccessRole?.isFin) return false
    }
    return true
  })

  return (
    <nav className="ad-quick-nav-bar" style={{ display: 'none' }}>
      {filteredNavItems.map(item => {
        const isActive = pathname?.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => triggerHaptic('selection')}
            className={`ad-quick-nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
})
