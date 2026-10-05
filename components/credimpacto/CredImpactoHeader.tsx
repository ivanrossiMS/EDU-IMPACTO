'use client'

import React from 'react'
import { Landmark, Plus, ShieldCheck, UserCheck, RefreshCw, ChevronRight } from 'lucide-react'
import { TabId } from './CredImpactoNavigation'

interface CredImpactoHeaderProps {
  isAdminOrFinance: boolean
  viewMode: 'admin' | 'colaborador'
  onToggleViewMode: (mode: 'admin' | 'colaborador') => void
  onNewLoanClick: () => void
  onRefresh: () => void
  isRefreshing?: boolean
  activeTab?: TabId
  currentMe?: any
}

const TAB_TITLES: Record<TabId, { title: string; subtitle: string; adminOnly?: boolean }> = {
  dashboard: {
    title: 'Visão Geral & Indicadores',
    subtitle: 'Acompanhamento executivo de contratos, volume emprestado, recebimentos e inadimplência'
  },
  emprestimos: {
    title: 'Todas as Operações',
    subtitle: 'Listagem completa e detalhada da carteira de empréstimos concedidos'
  },
  analise: {
    title: 'Fila de Aprovação de Crédito',
    subtitle: 'Análise de solicitações recebidas, emissão de contrapropostas e aprovações formais'
  },
  liberacoes: {
    title: 'Liberações de Recursos (Tesouraria & TED)',
    subtitle: 'Contratos assinados aguardando transferência bancária e comprovante'
  },
  parcelas: {
    title: 'Controle de Parcelas & Cronograma',
    subtitle: 'Acompanhamento de todas as parcelas por competência, vencimento e quitação'
  },
  folha: {
    title: 'Conciliação em Folha',
    subtitle: 'Relação mensal de parcelas para desconto em folha e comprovação de baixa'
  },
  rescisao: {
    title: 'Rescisão & Desligamento CLT',
    subtitle: 'Apuração e retenção de saldo devedor na rescisão conforme limites legais da CLT'
  },
  simular: {
    title: 'Simulador de empréstimo',
    subtitle: 'Configure as condições e confira sua proposta.'
  },
  relatorios: {
    title: 'Relatórios Financeiros & Extratos Contábeis',
    subtitle: 'Extrato contábil consolidado, receita de juros (DRE) e distribuição da carteira'
  },
  configuracoes: {
    title: 'Parâmetros & Políticas',
    subtitle: 'Configurações de juros, métodos de cálculo, prazos e textos legais'
  },
  auditoria: {
    title: 'Auditoria & Logs',
    subtitle: 'Rastreabilidade jurídica e logs imutáveis de todas as operações financeiras'
  },
  meus_emprestimos: {
    title: 'Meu Espaço • Operações',
    subtitle: 'Consulte seus empréstimos, autorizações assinadas, parcelas e saldo devedor'
  }
}

export function CredImpactoHeader({
  isAdminOrFinance,
  viewMode,
  onToggleViewMode,
  onNewLoanClick,
  onRefresh,
  isRefreshing,
  activeTab = 'dashboard'
}: CredImpactoHeaderProps) {
  const currentTabInfo = TAB_TITLES[activeTab] || {
    title: 'CredImpacto',
    subtitle: 'Módulo de empréstimos escolares e consignados'
  }

  return (
    <header className="pb-5 border-b border-slate-200/80 dark:border-slate-800 mb-6">
      {/* HEADER DESKTOP (md:flex) - Focado na página ativa sem duplicar a sidebar */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div>
          {/* Breadcrumb ultra moderno */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-semibold mb-1">
            <span>CredImpacto</span>
            <ChevronRight size={12} />
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
              {viewMode === 'admin' ? 'Painel Gestão' : 'Meu Espaço'}
            </span>
            <ChevronRight size={12} />
            <span className="text-slate-700 dark:text-slate-300">
              {currentTabInfo.title}
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {currentTabInfo.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            {currentTabInfo.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
            <span>Atualizar</span>
          </button>

          {activeTab !== 'simular' && (
            <button
              onClick={onNewLoanClick}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Plus size={15} />
              <span>{isAdminOrFinance && viewMode === 'admin' ? 'Novo Empréstimo' : 'Nova Solicitação'}</span>
            </button>
          )}
        </div>
      </div>

      {/* HEADER MOBILE (< md) - Auto-suficiente para quando a sidebar desktop estiver oculta */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-600/20 text-white shrink-0">
              <Landmark size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-black text-slate-900 dark:text-white">CredImpacto</h1>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">{currentTabInfo.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              title="Atualizar"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
