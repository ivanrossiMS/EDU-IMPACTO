'use client'

import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Calculator,
  FileText,
  FileSpreadsheet,
  UserX,
  Settings,
  ShieldAlert,
  Wallet,
  Landmark,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  MoreHorizontal,
  X,
  ChevronRight,
  Sparkles,
  LogOut,
  Sun,
  Moon,
  Grid,
  Users,
  BookHeart,
  ClipboardPenLine,
  Laptop,
  ExternalLink,
  Banknote,
  Receipt,
  BarChart3,
  Clock,
  UserCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { formatBrl } from '@/lib/credimpacto/engine'
import { performLogout } from '@/lib/auth/logout'
import { useApp } from '@/lib/context'
import { UserAvatar } from '@/components/UserAvatar'
import { TrocarModuloModal } from '@/components/layout/TrocarModuloModal'

export type TabId =
  | 'dashboard'
  | 'meus_emprestimos'
  | 'emprestimos'
  | 'analise'
  | 'liberacoes'
  | 'parcelas'
  | 'ficha_colaborador'
  | 'folha'
  | 'rescisao'
  | 'simular'
  | 'relatorios'
  | 'configuracoes'
  | 'auditoria'

export interface CredImpactoNavigationProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  viewMode: 'admin' | 'colaborador'
  onToggleViewMode: (mode: 'admin' | 'colaborador') => void
  isAdminOrFinance: boolean
  pendingRequestsCount?: number
  pendingDisbursementCount?: number
  onNewLoanClick: () => void
  onRefresh: () => void
  isRefreshing?: boolean
  totalAtivo?: number
  saldoDevedor?: number
  currentMe?: any
}

interface NavItem {
  id: TabId
  label: string
  desc: string
  icon: any
  badge?: string
  badgeColor?: string
}

interface NavGroup {
  group: string
  items: NavItem[]
}

/**
 * MODAL ULTRA-MODERNO: CENTRAL DE MÓDULOS (TROCAR DE MÓDULO)
 */
export function ModuleSwitchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <TrocarModuloModal isOpen={isOpen} onClose={onClose} />
}

/**
 * SIDEBAR ULTRA-MODERNA DEDICADA DO CREDIMPACTO (DESKTOP)
 * Apresenta acabamento refinado com gradiente escuro profissional,
 * combinando com o design master do Impacto EDU.
 */
export function CredImpactoSidebar({
  activeTab,
  onTabChange,
  viewMode,
  onToggleViewMode,
  isAdminOrFinance,
  pendingRequestsCount = 0,
  pendingDisbursementCount = 0,
  onNewLoanClick,
  onRefresh,
  isRefreshing = false,
  totalAtivo = 0,
  saldoDevedor = 0,
  currentMe
}: CredImpactoNavigationProps) {
  const { currentUser, theme, setTheme, setLoadingPath } = useApp()
  const router = useRouter()
  const [showSwitchModuleModal, setShowSwitchModuleModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (confirm('Deseja realmente encerrar a sessão no Impacto EDU?')) {
      try {
        setIsLoggingOut(true)
        setLoadingPath('logout')
        await performLogout(currentUser?.id || currentMe?.id)
      } catch (err) {
        window.location.replace('/login')
      }
    }
  }

  // Menus do Colaborador
  const colabNavItems: NavItem[] = [
    { id: 'meus_emprestimos' as TabId, label: 'Meu Espaço', desc: '', icon: Wallet }
  ]

  // Menus Completos do Administrador organizados por grupo funcional
  const adminNavGroups: NavGroup[] = [
    {
      group: 'Visão Geral & Operações',
      items: [
        { id: 'dashboard' as TabId, label: 'Visão Geral', desc: '', icon: LayoutDashboard },
        {
          id: 'analise' as TabId,
          label: 'Fila de Aprovação',
          desc: '',
          icon: ShieldCheck,
          badge: pendingRequestsCount > 0 ? String(pendingRequestsCount) : undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        },
        {
          id: 'liberacoes' as TabId,
          label: 'Liberações TED',
          desc: '',
          icon: Banknote,
          badge: pendingDisbursementCount > 0 ? String(pendingDisbursementCount) : undefined,
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
        }
      ]
    },
    {
      group: 'Controle Financeiro & Folha',
      items: [
        { id: 'parcelas' as TabId, label: 'Controle de Parcelas', desc: '', icon: Receipt },
        { id: 'ficha_colaborador' as TabId, label: 'Ficha por Colaborador', desc: '', icon: UserCheck },
        { id: 'folha' as TabId, label: 'Conciliação em Folha', desc: '', icon: FileSpreadsheet },
        { id: 'rescisao' as TabId, label: 'Rescisão CLT', desc: '', icon: UserX }
      ]
    },
    {
      group: 'Concessão & Inteligência',
      items: [
        { id: 'simular' as TabId, label: 'Conceder pela Escola', desc: '', icon: Calculator },
        { id: 'relatorios' as TabId, label: 'Relatórios & DRE', desc: '', icon: BarChart3 }
      ]
    },
    {
      group: 'Governança & Compliance',
      items: [
        { id: 'configuracoes' as TabId, label: 'Parâmetros & Regras', desc: '', icon: Settings },
        { id: 'auditoria' as TabId, label: 'Auditoria & Logs', desc: '', icon: ShieldAlert }
      ]
    }
  ]

  const userName = currentUser?.nome || currentMe?.nome || 'Colaborador'
  const userCargo = currentMe?.cargo || currentUser?.cargo || currentMe?.perfil || currentUser?.perfil || 'Colaborador'
  const userUnidade = currentMe?.unidade || currentUser?.unidade || ''

  return (
    <>
      <aside className="hidden md:flex flex-col w-72 shrink-0 h-screen sticky top-0 relative overflow-hidden bg-gradient-to-b from-[#090d16] via-[#081522] to-[#041d18] text-white border-r border-emerald-500/20 z-30 select-none shadow-[4px_0_35px_rgba(0,0,0,0.6)] credimpacto-sidebar">
        {/* AMBIENT GLOWS & SPECULAR ACCENTS */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent pointer-events-none" />
        <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-emerald-950/30 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-emerald-500/30 via-teal-500/15 to-emerald-500/30 pointer-events-none z-10" />

        {/* BRAND HEADER DO MÓDULO */}
        <div className="relative p-4 pb-3.5 border-b border-white/10 bg-white/[0.02] backdrop-blur-md space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 shrink-0 ring-1 ring-emerald-400/30">
              <Landmark size={20} className="relative z-10 drop-shadow-sm" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold tracking-tight text-white !text-white" style={{ color: '#ffffff' }}>CredImpacto</h2>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xs">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-emerald-400/80 truncate font-medium">Crédito & Consignado</p>
            </div>
          </div>

          {/* BOTAO DE AÇÃO PRINCIPAL ULTRA MODERNO: SIMULAR (MAIOR E DESTACADO) */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-2xl blur-md opacity-50 group-hover:opacity-85 transition duration-300 pointer-events-none" />
            <button
              onClick={onNewLoanClick}
              className="relative w-full overflow-hidden py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-400 text-white shadow-[0_6px_25px_rgba(16,185,129,0.45)] hover:shadow-[0_8px_32px_rgba(16,185,129,0.65)] ring-1 ring-white/40 hover:ring-white/60 flex items-center justify-center gap-3 transition-all duration-300 transform active:scale-98 select-none"
            >
              {/* Efeito de brilho specular no topo */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />
              
              {/* Ícone com badge translúcido */}
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 group-hover:rotate-90 group-hover:scale-110 transition-all duration-300 shadow-xs border border-white/30">
                <Plus size={20} strokeWidth={3} className="drop-shadow-sm" />
              </div>
              
              <div className="flex flex-col items-start leading-none">
                <span className="tracking-wide text-base font-black drop-shadow-sm">Simular</span>
                <span className="text-[10px] text-emerald-100/90 font-medium mt-0.5">Novo Empréstimo</span>
              </div>
            </button>
          </div>
        </div>

        {/* LISTA DE PÁGINAS / MENUS COM SCROLL INDEPENDENTE */}
        <nav className="relative flex-1 p-3 space-y-3 overflow-y-auto no-scrollbar">
          {viewMode === 'colaborador' ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 px-3 pt-1 pb-1">
                Área do Colaborador
              </div>
              {colabNavItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id

                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full text-left flex items-center justify-between py-2.5 px-3 rounded-xl transition-all group ${
                      isActive
                        ? 'bg-emerald-500/20 text-white font-semibold border border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                        : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                          isActive
                            ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xs'
                            : 'text-slate-400 group-hover:text-emerald-300'
                        }`}
                      >
                        <Icon size={15} />
                      </div>
                      <span className="text-xs truncate tracking-tight">{item.label}</span>
                    </div>
                  </button>
                )
              })}

              <div className="pt-2 border-t border-white/10 space-y-1">
                <button
                  onClick={() => setShowSwitchModuleModal(true)}
                  className="w-full text-left flex items-center justify-between py-2.5 px-3 rounded-xl transition-all text-slate-300 hover:bg-white/[0.06] hover:text-white group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-emerald-300">
                      <Grid size={15} />
                    </div>
                    <span className="text-xs truncate tracking-tight">Trocar Módulo</span>
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full text-left flex items-center justify-between py-2.5 px-3 rounded-xl transition-all text-rose-300 hover:bg-rose-500/10 group disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-rose-400">
                      <LogOut size={15} className={isLoggingOut ? 'animate-spin' : ''} />
                    </div>
                    <span className="text-xs truncate tracking-tight">{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            adminNavGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400/80 px-3 pt-1.5 pb-1">
                  {group.group}
                </div>

                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full text-left flex items-center justify-between py-2 px-3 rounded-xl transition-all group ${
                        isActive
                          ? 'bg-emerald-500/20 text-white font-semibold border border-emerald-500/35 shadow-xs shadow-emerald-950/40'
                          : 'text-slate-300/90 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                            isActive
                              ? 'bg-emerald-500/25 text-emerald-300'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        >
                          <Icon size={15} />
                        </div>
                        <span className="text-xs truncate tracking-tight">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeColor || 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </nav>

        {/* FOOTER DO SIDEBAR: KPI + PROFILE + TROCAR MÓDULO + LOGOUT */}
        <div className="relative p-3 border-t border-white/10 space-y-2.5 bg-gradient-to-b from-transparent to-[#041a15] shrink-0">
          {/* WIDGET RESUMO FINANCEIRO */}
          <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 shadow-inner backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
              <span>{viewMode === 'admin' ? 'Total Concedido' : 'Meu Saldo Restante'}</span>
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="hover:text-emerald-300 transition-colors p-0.5 rounded"
                title="Atualizar dados"
              >
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-emerald-400' : ''} />
              </button>
            </div>
            <div className="text-sm font-black text-white font-mono mt-0.5">
              {formatBrl(viewMode === 'admin' ? totalAtivo : saldoDevedor)}
            </div>
          </div>

          {/* USER PROFILE CARD */}
          <div 
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              padding: '12px 12px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {/* Top row: Avatar + Name/Role + Notification */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                justifyContent: 'flex-start'
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <UserAvatar 
                  key={currentUser?.foto || 'default'}
                  userId={currentUser?.id || currentMe?.id} 
                  name={userName} 
                  fotoUrl={currentUser?.foto}
                  size={40} 
                  style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)' }} 
                />
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: '#10b981', border: '2px solid #060814', boxShadow: '0 0 8px #10b981' }} />
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                  {userName}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userCargo}
                </div>
              </div>
            </div>

            {/* Bottom Actions Row: Meu Perfil, Trocar Módulo, Sair - DENTRO DO CARD */}
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: 4, 
                background: 'rgba(0, 0, 0, 0.22)',
                padding: '3px',
                borderRadius: 12,
                border: '1px solid rgba(255, 255, 255, 0.04)'
              }}
            >
              {/* 1. Meu Perfil */}
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(168, 85, 247, 0.16)', color: '#ffffff' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  router.push('/meu-perfil');
                }}
                title="Meu Perfil"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '6px 4px',
                  borderRadius: 9,
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  transition: 'all 0.15s ease'
                }}
              >
                <UserCircle size={14} color="#a855f7" style={{ filter: 'drop-shadow(0 0 5px rgba(168, 85, 247, 0.4))', flexShrink: 0 }} />
                <span>Perfil</span>
              </motion.button>

              {/* 2. Trocar Módulo */}
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(6, 182, 212, 0.16)', color: '#ffffff' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowSwitchModuleModal(true)}
                title="Trocar Módulo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '6px 4px',
                  borderRadius: 9,
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  transition: 'all 0.15s ease'
                }}
              >
                <LayoutDashboard size={14} color="#06b6d4" style={{ filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.4))', flexShrink: 0 }} />
                <span>Módulos</span>
              </motion.button>

              {/* 3. Sair */}
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(244, 63, 94, 0.16)', color: '#ffffff' }}
                whileTap={{ scale: 0.97 }}
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Sair do sistema"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '6px 4px',
                  borderRadius: 9,
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  transition: 'all 0.15s ease',
                  opacity: isLoggingOut ? 0.5 : 1
                }}
              >
                <LogOut size={14} color="#f43f5e" style={{ filter: 'drop-shadow(0 0 5px rgba(244, 63, 94, 0.4))', flexShrink: 0 }} />
                <span>{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
              </motion.button>
            </div>
          </div>
        </div>
      </aside>

      {/* MODAL DE TROCAR MÓDULO */}
      <ModuleSwitchModal
        isOpen={showSwitchModuleModal}
        onClose={() => setShowSwitchModuleModal(false)}
      />
    </>
  )
}

/**
 * RODAPÉ ULTRA-MODERNO (DOCK MOBILE < 768px)
 * Com gradiente escuro profissional, reflexo especular
 * e botões ergonomicamente posicionados para uso em smartphone.
 */
export function CredImpactoBottomBar({
  activeTab,
  onTabChange,
  viewMode,
  onToggleViewMode,
  isAdminOrFinance,
  pendingRequestsCount = 0,
  pendingDisbursementCount = 0,
  onNewLoanClick,
  currentMe
}: CredImpactoNavigationProps) {
  const { currentUser, setLoadingPath } = useApp()
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showSwitchModuleModal, setShowSwitchModuleModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (confirm('Deseja realmente encerrar a sessão no Impacto EDU?')) {
      try {
        setIsLoggingOut(true)
        setLoadingPath('logout')
        await performLogout(currentUser?.id || currentMe?.id)
      } catch (err) {
        window.location.replace('/login')
      }
    }
  }

  // Itens para o Colaborador
  if (viewMode === 'colaborador') {
    return (
      <>
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-[#090d16]/98 via-[#081522]/98 to-[#041d18]/98 backdrop-blur-2xl border-t border-emerald-500/25 shadow-[0_-10px_35px_rgba(0,0,0,0.7)] px-2 py-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] text-white">
          {/* Top specular glow line */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent pointer-events-none" />

          <div className="relative grid grid-cols-4 items-end max-w-md mx-auto w-full">
            {/* 1. Meu Espaço */}
            <button
              onClick={() => onTabChange('meus_emprestimos')}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
                activeTab === 'meus_emprestimos'
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${activeTab === 'meus_emprestimos' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : ''}`}>
                <Wallet size={18} />
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-full">Meu Espaço</span>
            </button>

            {/* 2. BOTÃO MAIOR CENTRAL: SIMULAR (ULTRA MODERNO) */}
            <div className="flex flex-col items-center justify-center">
              <button
                onClick={onNewLoanClick}
                className="relative flex flex-col items-center justify-center -mt-5 group active:scale-95 transition-all select-none"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition duration-300 pointer-events-none" />
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-[0_6px_20px_rgba(16,185,129,0.5)] ring-4 ring-[#081522] border border-emerald-300/40 group-hover:scale-105 transition-transform">
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-white/50 rounded-t-2xl" />
                  <Plus size={22} strokeWidth={2.8} className="drop-shadow-sm group-hover:rotate-90 transition-transform duration-300" />
                </div>
                <span className="text-[10px] font-extrabold text-emerald-400 mt-0.5 tracking-tight drop-shadow-xs">Simular</span>
              </button>
            </div>

            {/* 3. Trocar Módulo */}
            <button
              onClick={() => setShowSwitchModuleModal(true)}
              className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-300 hover:text-white transition-all active:scale-95"
            >
              <div className="p-1.5 rounded-xl bg-white/10 text-emerald-400">
                <Grid size={18} />
              </div>
              <span className="text-[10px] mt-0.5 font-medium truncate max-w-full">Módulos</span>
            </button>

            {/* 4. Sair */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-rose-400 hover:text-rose-300 transition-all active:scale-95 disabled:opacity-50"
            >
              <div className="p-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <LogOut size={18} className={isLoggingOut ? 'animate-spin' : ''} />
              </div>
              <span className="text-[10px] mt-0.5 font-medium truncate max-w-full">{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
            </button>
          </div>
        </nav>

        <ModuleSwitchModal
          isOpen={showSwitchModuleModal}
          onClose={() => setShowSwitchModuleModal(false)}
        />
      </>
    )
  }

  // Itens para o Administrador no Mobile
  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-[#090d16]/98 via-[#081522]/98 to-[#041d18]/98 backdrop-blur-2xl border-t border-emerald-500/25 shadow-[0_-10px_35px_rgba(0,0,0,0.7)] px-1.5 py-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] text-white">
        {/* Top specular glow line */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent pointer-events-none" />

        <div className="relative grid grid-cols-5 items-end max-w-lg mx-auto w-full">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              activeTab === 'dashboard'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${activeTab === 'dashboard' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : ''}`}>
              <LayoutDashboard size={17} />
            </div>
            <span className="text-[10px] mt-0.5 truncate max-w-full">Painel</span>
          </button>

          <button
            onClick={() => onTabChange('analise')}
            className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              activeTab === 'analise'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${activeTab === 'analise' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : ''}`}>
              <ShieldCheck size={17} />
            </div>
            <span className="text-[10px] mt-0.5 truncate max-w-full">Fila</span>
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center shadow-xs">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Botão Central Maior: Simular (Ultra Moderno) */}
          <div className="flex flex-col items-center justify-center">
            <button
              onClick={onNewLoanClick}
              className="relative flex flex-col items-center justify-center -mt-5 group active:scale-95 transition-all select-none"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition duration-300 pointer-events-none" />
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-[0_6px_20px_rgba(16,185,129,0.5)] ring-4 ring-[#081522] border border-emerald-300/40 group-hover:scale-105 transition-transform">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-white/50 rounded-t-2xl" />
                <Plus size={22} strokeWidth={2.8} className="drop-shadow-sm group-hover:rotate-90 transition-transform duration-300" />
              </div>
              <span className="text-[10px] font-extrabold text-emerald-400 mt-0.5 tracking-tight drop-shadow-xs">Simular</span>
            </button>
          </div>

          <button
            onClick={() => onTabChange('parcelas')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              activeTab === 'parcelas'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${activeTab === 'parcelas' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : ''}`}>
              <Receipt size={17} />
            </div>
            <span className="text-[10px] mt-0.5 truncate max-w-full">Parcelas</span>
          </button>

          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              ['liberacoes', 'ficha_colaborador', 'folha', 'rescisao', 'simular', 'relatorios', 'configuracoes', 'auditoria'].includes(activeTab)
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400'
            }`}
          >
            <div className="p-1.5 rounded-xl bg-white/10">
              <MoreHorizontal size={18} />
            </div>
            <span className="text-[10px] mt-0.5">Mais</span>
          </button>
        </div>
      </nav>

      {/* DRAWER / BOTTOM SHEET DO MENU "MAIS" PARA ADMIN */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative overflow-hidden bg-gradient-to-b from-[#090d16] via-[#081522] to-[#041d18] border border-emerald-500/30 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom backdrop-blur-2xl text-white">
            {/* Specular top glow line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />

            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white !text-white" style={{ color: '#ffffff' }}>Mais Módulos & Páginas • CredImpacto</h3>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs max-h-[60vh] overflow-y-auto pr-1">
              {/* Ficha por Colaborador */}
              <button
                onClick={() => {
                  onTabChange('ficha_colaborador')
                  setShowMoreMenu(false)
                }}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                  activeTab === 'ficha_colaborador'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                    : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <UserCheck size={18} className="text-emerald-400" />
                  <span className="font-semibold text-xs">Ficha por Colaborador (Extrato)</span>
                </div>
                <ChevronRight size={15} className="text-slate-400" />
              </button>

              {/* Liberações TED */}
              <button
                onClick={() => {
                  onTabChange('liberacoes')
                  setShowMoreMenu(false)
                }}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                  activeTab === 'liberacoes'
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-bold'
                    : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Banknote size={18} className="text-cyan-400" />
                  <span className="font-semibold text-xs">Liberações TED (Tesouraria)</span>
                </div>
                {pendingDisbursementCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {pendingDisbursementCount}
                  </span>
                )}
              </button>

              {/* Conciliação em Folha */}
              <button
                onClick={() => {
                  onTabChange('folha')
                  setShowMoreMenu(false)
                }}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                  activeTab === 'folha'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                    : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={18} className="text-emerald-400" />
                  <span className="font-semibold text-xs">Conciliação em Folha</span>
                </div>
                <ChevronRight size={15} className="text-slate-400" />
              </button>

              {/* Rescisão CLT */}
              <button
                onClick={() => {
                  onTabChange('rescisao')
                  setShowMoreMenu(false)
                }}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                  activeTab === 'rescisao'
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold'
                    : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <UserX size={18} className="text-purple-400" />
                  <span className="font-semibold text-xs">Rescisão CLT & Desligamento</span>
                </div>
                <ChevronRight size={15} className="text-slate-400" />
              </button>

              {/* Relatórios & DRE */}
              <button
                onClick={() => {
                  onTabChange('relatorios')
                  setShowMoreMenu(false)
                }}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                  activeTab === 'relatorios'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                    : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 size={18} className="text-emerald-400" />
                  <span className="font-semibold text-xs">Relatórios & DRE Contábil</span>
                </div>
                <ChevronRight size={15} className="text-slate-400" />
              </button>

              {/* Conceder pela Escola */}
              <button
                onClick={() => {
                  onTabChange('simular')
                  setShowMoreMenu(false)
                }}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                  activeTab === 'simular'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                    : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Calculator size={18} className="text-emerald-400" />
                  <span className="font-semibold text-xs">Conceder Empréstimo</span>
                </div>
                <ChevronRight size={15} className="text-slate-400" />
              </button>

              {/* Parâmetros & Regras */}
              <button
                onClick={() => {
                  onTabChange('configuracoes')
                  setShowMoreMenu(false)
                }}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                  activeTab === 'configuracoes'
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-bold'
                    : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings size={18} className="text-cyan-400" />
                  <span className="font-semibold text-xs">Parâmetros & Regras</span>
                </div>
                <ChevronRight size={15} className="text-slate-400" />
              </button>

              {/* Auditoria & Logs */}
              <button
                onClick={() => {
                  onTabChange('auditoria')
                  setShowMoreMenu(false)
                }}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                  activeTab === 'auditoria'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                    : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldAlert size={18} className="text-amber-400" />
                  <span className="font-semibold text-xs">Auditoria & Logs</span>
                </div>
                <ChevronRight size={15} className="text-slate-400" />
              </button>
            </div>

            <div className="pt-2 border-t border-white/10">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShowMoreMenu(false)
                    setShowSwitchModuleModal(true)
                  }}
                  className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all border border-white/10"
                >
                  <Grid size={15} className="text-emerald-400" />
                  <span>Trocar Módulo</span>
                </button>

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-all border border-rose-500/40"
                >
                  <LogOut size={15} />
                  <span>{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TROCAR MÓDULO */}
      <ModuleSwitchModal
        isOpen={showSwitchModuleModal}
        onClose={() => setShowSwitchModuleModal(false)}
      />
    </>
  )
}
