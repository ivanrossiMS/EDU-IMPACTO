'use client'

import React from 'react'
import {
  LayoutDashboard,
  Calculator,
  FileText,
  FileSpreadsheet,
  UserX,
  Settings,
  ShieldAlert,
  Wallet
} from 'lucide-react'

export type TabId =
  | 'dashboard'
  | 'meus_emprestimos'
  | 'simular'
  | 'emprestimos'
  | 'ficha_colaborador'
  | 'folha'
  | 'rescisao'
  | 'configuracoes'
  | 'auditoria'

interface CredImpactoTabsProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  viewMode: 'admin' | 'colaborador'
  pendingRequestsCount?: number
}

export function CredImpactoTabs({
  activeTab,
  onTabChange,
  viewMode,
  pendingRequestsCount = 0
}: CredImpactoTabsProps) {
  const tabs =
    viewMode === 'colaborador'
      ? [
          { id: 'meus_emprestimos' as TabId, label: 'Meus Empréstimos', icon: Wallet },
          { id: 'simular' as TabId, label: 'Simular & Solicitar', icon: Calculator }
        ]
      : [
          { id: 'dashboard' as TabId, label: 'Visão Geral', icon: LayoutDashboard },
          {
            id: 'emprestimos' as TabId,
            label: 'Empréstimos',
            icon: FileText,
            badge: pendingRequestsCount > 0 ? String(pendingRequestsCount) : undefined
          },
          { id: 'ficha_colaborador' as TabId, label: 'Ficha por Colaborador', icon: UserX },
          { id: 'folha' as TabId, label: 'Conciliação em Folha', icon: FileSpreadsheet },
          { id: 'rescisao' as TabId, label: 'Rescisão CLT', icon: UserX },
          { id: 'simular' as TabId, label: 'Simulador', icon: Calculator },
          { id: 'configuracoes' as TabId, label: 'Parâmetros', icon: Settings },
          { id: 'auditoria' as TabId, label: 'Auditoria', icon: ShieldAlert }
        ]

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-100/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl mb-6 scrollbar-none shadow-inner">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              isActive
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm shadow-slate-200/60 dark:shadow-black/40 border border-slate-200/70 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
            }`}
          >
            <Icon size={14} className={isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
