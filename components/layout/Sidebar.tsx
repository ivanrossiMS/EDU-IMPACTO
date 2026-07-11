'use client'
import { performLogout } from "@/lib/auth/logout";

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, ChevronDown, ChevronRight,
  DollarSign, CreditCard, TrendingDown, Receipt, PiggyBank, Building2, CandlestickChart,
  UserCheck, Users2, Calendar, ClipboardCheck, Star, Megaphone, MessageSquare, Bell,
  BarChart3, Brain, Zap, Settings, Shield, HelpCircle, Package, Wrench, Bus, UtensilsCrossed,
  FileText, Archive, Library, Search, ChevronLeft, Layers, TargetIcon, UserPlus, PanelLeft,
  Home, LineChart, BookMarked, Database, Globe, Webhook, FolderOpen,
  BookOpenCheck, CalendarDays, FlaskConical, HardHat, ClipboardPenLine, Clock3, Banknote, Wallet, AlertTriangle, DoorOpen, Scan, Monitor, ListChecks, BookHeart, ShieldCheck, LogOut, Handshake,
  UserCircle, Laptop, ShieldAlert, History, Landmark, Coins, CreditCard as CardIcon, FileSpreadsheet, Building, Tablet, FileStack,
  Sun, Moon
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserAvatar } from '@/components/UserAvatar'
import { NotificationPopover } from '@/components/layout/NotificationPopover'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface NavItem {
  label: string
  href?: string
  icon?: React.ReactNode
  badge?: string
  badgeColor?: string
  target?: string
  children?: NavItem[]
}

interface NavGroup {
  title: string
  collapsible?: boolean
  items: NavItem[]
  href?: string
  icon?: React.ReactNode
  target?: string
}

export const ALL_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    collapsible: false,
    items: [
      { label: 'DASHBOARD', href: '/dashboard', icon: <Home size={16} />, badge: 'LIVE', badgeColor: 'pink' },
      { label: 'MINHAS TAREFAS', href: '/tarefas', icon: <ClipboardCheck size={16} /> },
      { label: 'CALENDÁRIO', href: '/calendario', icon: <Calendar size={16} /> },
    ],
  },
  {
    title: 'ACADÊMICO',
    collapsible: true,
    items: [
      { label: 'ALUNOS', href: '/academico/alunos', icon: <Users size={16} /> },
      { label: 'RESPONSÁVEIS', href: '/academico/responsaveis', icon: <Users2 size={16} /> },
      { label: 'TURMAS', href: '/academico/turmas', icon: <Layers size={16} /> },
      {
        label: 'DIÁRIO DIGITAL', icon: <BookOpen size={16} />,
        children: [
          { label: 'FREQUÊNCIA', href: '/academico/frequencia', icon: <ClipboardList size={11} /> },
          { label: 'NOTAS E BOLETIM', href: '/academico/notas', icon: <Star size={11} /> },
          { label: 'CONTEÚDOS E TAREFAS', href: '/academico/conteudos', icon: <BookMarked size={11} /> },
          { label: 'OCORRÊNCIAS', href: '/academico/ocorrencias', icon: <ShieldAlert size={11} /> },
        ],
      },
    ],
  },
  {
    title: 'FINANCEIRO',
    collapsible: true,
    items: [
      { label: 'CONTAS A RECEBER', href: '/financeiro/receber', icon: <CreditCard size={16} /> },
      { label: 'RENEGOCIAÇÃO', href: '/financeiro/renegociacao', icon: <Handshake size={16} /> },
    ],
  },
  {
    title: 'RH',
    collapsible: true,
    items: [
      { label: 'FUNCIONÁRIOS', href: '/rh/funcionarios', icon: <Users2 size={16} /> },
      { label: 'FOLHA DE PGTO', href: '/rh/folha', icon: <DollarSign size={16} /> },
      { label: 'ADIANTAMENTOS', href: '/rh/adiantamentos', icon: <Banknote size={16} /> },
      { label: 'FÉRIAS E AFAST.', href: '/rh/ferias', icon: <CalendarDays size={16} /> },
      { label: 'ADVERTÊNCIAS', href: '/rh/advertencias', icon: <AlertTriangle size={16} /> },
    ],
  },
  {
    title: 'PORTARIA',
    collapsible: true,
    items: [
      {
        label: 'ENTRADA IDFACE', icon: <Scan size={16} />,
        children: [
          { label: 'DASHBOARD', href: '/portaria', icon: <LayoutDashboard size={11} /> },
          { label: 'MONITOR ENTRADAS', href: '/portaria/entradas', icon: <Monitor size={11} /> },
          { label: 'ALUNOS LIBERADOS', href: '/portaria/alunos-liberados', icon: <UserCheck size={11} /> },
          { label: 'LOGS DE ACESSO', href: '/portaria/logs', icon: <ListChecks size={11} /> },
          { label: 'RELATÓRIOS', href: '/portaria/relatorios', icon: <FileSpreadsheet size={11} /> },
          { label: 'DISPOSITIVOS', href: '/portaria/dispositivos', icon: <Laptop size={11} /> },
          { label: 'CONFIGURAÇÕES', href: '/portaria/configuracoes', icon: <Settings size={11} /> },
        ],
      },
      {
        label: 'SAÍDA DE ALUNOS', icon: <DoorOpen size={16} />,
        children: [
          { label: 'CHAMADAS', href: '/saida-alunos/chamadas', icon: <LogOut size={11} /> },
          { label: 'PAINEL-TABLET', href: '/painel-tablet', icon: <Tablet size={11} /> },
          { label: 'MONITOR TV (VERTICAL)', href: '/monitor-tv', icon: <Monitor size={11} />, target: '_blank' },
          { label: 'RELATÓRIOS', href: '/saida-alunos/relatorios', icon: <FileText size={11} /> },
          { label: 'CONFIGURAÇÕES', href: '/saida-alunos/configuracoes', icon: <Settings size={11} /> },
        ],
      },
    ],
  },
  {
    title: 'ADMINISTRATIVO',
    collapsible: true,
    items: [
      { label: 'DOCS ESCOLARES', href: '/secretaria/documentos', icon: <FileStack size={16} /> },
      { label: 'PEDIDO LIVROS/APOST', href: '/administrativo/pedidos-livros', icon: <Library size={16} /> },
      { label: 'MANUTENÇÃO PREDIAL', href: '/administrativo/manutencao', icon: <Wrench size={16} /> },
    ],
  },
  {
    title: 'CONFIGURACOES',
    collapsible: true,
    items: [
      { label: 'USUARIOS E ACESSOS', href: '/configuracoes/usuarios', icon: <Shield size={16} /> },
      { label: 'CONFIG DO SISTEMA', href: '/configuracoes', icon: <Settings size={16} /> },
      { label: 'MULTI-UNIDADES', href: '/configuracoes/unidades', icon: <Building size={16} /> },
      {
        label: 'CONFIG. FINANCEIRO', icon: <Landmark size={16} />,
        children: [
          { label: 'PLANO DE CONTAS', href: '/configuracoes/financeiro/plano-contas', icon: <CandlestickChart size={11} /> },
          { label: 'CARTÕES', href: '/configuracoes/financeiro/cartoes', icon: <CardIcon size={11} /> },
          { label: 'MÉTODOS DE PAGAMENTOS', href: '/configuracoes/financeiro/metodos-pagamento', icon: <Coins size={11} /> },
          { label: 'TIPO DE DOCUMENTOS', href: '/configuracoes/financeiro/tipo-documentos', icon: <FileSpreadsheet size={11} /> },
          { label: 'GRUPO DESCONTO', href: '/configuracoes/financeiro/grupo-desconto', icon: <TrendingDown size={11} /> },
          { label: 'PADRÃO PAGAMENTO', href: '/configuracoes/financeiro/padrao-pagamento', icon: <CreditCard size={11} /> },
          { label: 'EVENTOS', href: '/configuracoes/financeiro/eventos', icon: <Zap size={11} /> },
        ],
      },
      {
        label: 'CONFIG. PEDAGÓGICO', icon: <GraduationCap size={16} />,
        children: [
          { label: 'ANO LETIVO', href: '/configuracoes/pedagogico/ano-letivo', icon: <CalendarDays size={11} /> },
          { label: 'SÉRIES', href: '/configuracoes/pedagogico/series', icon: <Layers size={11} /> },
          { label: 'NÍVEIS DE ENSINO', href: '/configuracoes/pedagogico/niveis-ensino', icon: <TargetIcon size={11} /> },
          { label: 'DISCIPLINAS', href: '/configuracoes/pedagogico/disciplinas', icon: <BookOpen size={11} /> },
          { label: 'HORÁRIOS', href: '/configuracoes/pedagogico/horario', icon: <Clock3 size={11} /> },
          { label: 'TIPOS DE DOCUMENTOS', href: '/configuracoes/pedagogico/documentos', icon: <FileText size={11} /> },
          { label: 'GRUPO ALUNOS', href: '/configuracoes/pedagogico/grupo-alunos', icon: <Users size={11} /> },
          { label: 'SITUAÇÃO DO ALUNO', href: '/configuracoes/pedagogico/situacao-aluno', icon: <ShieldCheck size={11} /> },
          { label: 'TIPO DE OCORRÊNCIAS', href: '/configuracoes/pedagogico/tipo-ocorrencias', icon: <AlertTriangle size={11} /> },
        ],
      },
    ],
  },

]

function NavItemComp({ item, collapsed, depth = 0 }: { item: NavItem; collapsed: boolean; depth?: number }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some(c => c.href === pathname || c.children?.some(cc => cc.href === pathname))
  })

  const isActive = item.href ? (item.href === pathname) : false
  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    return (
      <div style={{ marginBottom: 2 }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '8px 20px',
            background: 'transparent',
            border: 'none',
            color: open ? 'white' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.3s'
          }}
        >
          <span style={{ color: open ? '#ec4899' : 'inherit', filter: open ? 'drop-shadow(0 0 8px #ec4899)' : 'none', display: 'flex', alignItems: 'center' }}>{item.icon}</span>
          {!collapsed && (
            <>
              <span style={{ flex: 1, fontWeight: 600, fontSize: depth > 0 ? 11 : 12 }}>{item.label}</span>
              <ChevronDown size={14} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.3s' }} />
            </>
          )}
        </button>
        <AnimatePresence>
          {open && !collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', paddingLeft: 46, position: 'relative' }}
            >
              {item.children!.map((child, idx) => (
                <div key={child.label} style={{ position: 'relative' }}>
                   {/* Conector em L (Vertical + Horizontal) */}
                   <div style={{ 
                     position: 'absolute', 
                     left: -16, 
                     top: idx === 0 ? -12 : -20, 
                     width: 16, 
                     height: idx === 0 ? 30 : 38,
                     borderLeft: '1.5px solid rgba(255,255,255,0.1)',
                     borderBottom: '1.5px solid rgba(255,255,255,0.1)',
                     borderRadius: '0 0 0 6px',
                     pointerEvents: 'none'
                   }} />
                   <NavItemComp item={child} collapsed={false} depth={depth + 1} />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <Link href={item.href || '#'} style={{ textDecoration: 'none' }} target={item.target}>
      <motion.div
        whileHover={{ x: 4, background: 'rgba(255,255,255,0.03)' }}
        style={{
          padding: collapsed ? '12px' : '8px 20px',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
          background: isActive ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0)',
          border: isActive ? '1px solid rgba(121, 40, 202, 0.5)' : '1px solid transparent',
          color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
          transition: 'all 0.3s',
          boxShadow: isActive ? '0 0 20px rgba(121, 40, 202, 0.2)' : 'none'
        }}
      >
        <div style={{ color: isActive ? '#ec4899' : 'inherit', filter: isActive ? 'drop-shadow(0 0 8px #ec4899)' : 'none', display: 'flex', alignItems: 'center' }}>
          {item.icon}
        </div>
        {!collapsed && (
          <>
            <span style={{ flex: 1, fontWeight: isActive ? 700 : 500, fontSize: depth > 0 ? 11 : 12 }}>{item.label}</span>
            {item.badge && (
              <div style={{ 
                background: item.badgeColor === 'pink' ? 'linear-gradient(135deg, #7928ca, #FF0080)' : 'rgba(0, 210, 255, 0.1)', 
                color: item.badgeColor === 'pink' ? 'white' : '#00d2ff',
                border: item.badgeColor === 'pink' ? 'none' : '1px solid rgba(0, 210, 255, 0.3)',
                padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800,
                boxShadow: item.badgeColor === 'pink' ? '0 0 10px rgba(255, 0, 128, 0.4)' : 'none'
              }}>
                {item.badge}
              </div>
            )}
            {depth === 0 && !item.badge && <ChevronRight size={14} style={{ opacity: 0.3 }} />}
          </>
        )}
      </motion.div>
    </Link>
  )
}

function NavGroupComp({ group, collapsed, onToggle, open }: { group: NavGroup; collapsed: boolean; onToggle: () => void; open: boolean }) {
  const pathname = usePathname()
  const isActive = group.items.some(i => i.href === pathname || i.children?.some(c => c.href === pathname))

  if (group.href) {
    return (
      <div style={{ marginTop: 0, marginBottom: 0 }}>
        <NavItemComp item={{ label: group.title, href: group.href, icon: group.icon, target: group.target }} collapsed={collapsed} />
      </div>
    )
  }

  if (!group.collapsible) {
    return (
      <div style={{ marginBottom: 4 }}>
        {!collapsed && <div style={{ padding: '0 24px', fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>{group.title}</div>}
        {group.items.map(item => <NavItemComp key={item.label} item={item} collapsed={collapsed} />)}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 4 }}>
      {!collapsed && (
        <button
          onClick={onToggle}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '6px 24px',
            background: 'transparent', border: 'none', color: isActive || open ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.3s'
          }}
        >
          <span style={{ flex: 1, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{group.title}</span>
          <ChevronDown size={12} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.3s' }} />
        </button>
      )}
      <AnimatePresence>
        {(open || collapsed) && (
          <motion.div 
            initial={collapsed ? {} : { height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            style={{ overflow: 'hidden', paddingLeft: collapsed ? 0 : 30, position: 'relative' }}
          >
            {group.items.map((item, idx) => (
              <div key={item.label} style={{ position: 'relative' }}>
                 {/* Conector em L (Vertical + Horizontal) */}
                 {!collapsed && open && (
                   <div style={{ 
                     position: 'absolute', 
                     left: -16, 
                     top: idx === 0 ? -12 : -20, 
                     width: 16, 
                     height: idx === 0 ? 30 : 38,
                     borderLeft: '1.5px solid rgba(255,255,255,0.1)',
                     borderBottom: '1.5px solid rgba(255,255,255,0.1)',
                     borderRadius: '0 0 0 6px',
                     pointerEvents: 'none'
                   }} />
                 )}
                 <NavItemComp item={item} collapsed={collapsed} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Sidebar() {
  const router = useRouter()
  const { sidebarCollapsed: collapsed, toggleSidebar, currentUserPerfil, currentUser, hydrated, theme, setTheme, setCurrentUser } = useApp()
  const isMobile = useIsMobile()
  const effectiveCollapsed = isMobile ? false : collapsed
  
  const { cfgCalendarioLetivo = [], perfis } = useData()
  const anoVigente = cfgCalendarioLetivo?.find((c: any) => c.isVigente)?.ano || '2026'
  const [openGroup, setOpenGroup] = useState<string | null>('ACADÊMICO')
  const [showTopMenu, setShowTopMenu] = useState(false)
  const pathname = usePathname()

  const menuRef = useRef<HTMLDivElement>(null)
  const profileCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTopMenu(false)
      }
    }
    if (showTopMenu) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showTopMenu])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        profileCardRef.current &&
        !profileCardRef.current.contains(event.target as Node)
      ) {
        setShowTopMenu(false)
      }
    }
    if (showTopMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTopMenu])

  if (!hydrated) return null

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobile && !collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={toggleSidebar}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 90
          }}
        />
      )}

      <motion.aside
        initial={false}
        animate={{ 
          width: isMobile ? 285 : (collapsed ? 90 : 285),
          x: isMobile ? (collapsed ? '-100%' : '0%') : '0%'
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          height: '100vh',
          background: 'linear-gradient(165deg, #0f1129 0%, #060814 100%)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100, // Acima do backdrop (90)
          overflow: 'hidden',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0
        }}
      >
      {/* Background Glows */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at 0% 50%, rgba(0, 210, 255, 0.08) 0%, transparent 50%), radial-gradient(circle at 100% 20%, rgba(121, 40, 202, 0.08) 0%, transparent 50%)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header / Logo */}
        <div style={{ padding: '40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!effectiveCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #FF0080, #7928CA)', borderRadius: 12, opacity: 0.2, filter: 'blur(8px)' }} />
                 <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                    <path d="M8 32L16 8L24 32" stroke="#FF0080" strokeWidth="4" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 5px #FF0080)' }} />
                    <path d="M22 32L30 8L38 32" stroke="#00D2FF" strokeWidth="4" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 5px #00D2FF)' }} />
                 </svg>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Colégio</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'white', letterSpacing: '0.02em', marginTop: -2 }}>IMPACTO</div>
              </div>
            </motion.div>
          )}
          {(!isMobile) && (
            <button onClick={toggleSidebar} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
              <motion.div animate={{ rotate: effectiveCollapsed ? 180 : 0 }}><ChevronLeft size={16} /></motion.div>
            </button>
          )}
        </div>

        {/* Ano Letivo Widget */}
        {!effectiveCollapsed && (
          <div style={{ padding: '0 24px 16px' }}>
            <div style={{ padding: '8px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
               <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarDays size={14} color="#ef4444" />
               </div>
               <div>
                 <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vigente</div>
                 <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{anoVigente}</div>
               </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ flex: 1, padding: '0 16px', overflowY: 'auto' }} className="no-scrollbar">
          {(() => {
            const userPerfilObj = (perfis || []).find((p: any) => p.nome === currentUserPerfil)
            const isAgendaBlocked = !!userPerfilObj?.bloqueadoAgendaDigital
            const isGestaoPessoasBlocked = !!userPerfilObj?.bloqueadoGestaoPessoas

            const filteredGroups = ALL_NAV_GROUPS.map(group => {
              if (group.title === 'PRINCIPAL') {
                return {
                  ...group,
                  items: group.items.filter(item => {
                    if (item.label === 'AGENDA DIGITAL' && isAgendaBlocked) return false
                    return true
                  })
                }
              }
              return group
            }).filter(group => {
              if (group.title === 'RH' && isGestaoPessoasBlocked) return false
              return true
            })

            return filteredGroups.map((group, i) => (
              <NavGroupComp 
                key={group.title + i} 
                group={group} 
                collapsed={effectiveCollapsed} 
                open={openGroup === group.title} 
                onToggle={() => setOpenGroup(openGroup === group.title ? null : group.title)} 
              />
            ))
          })()}
        </div>

        {/* Profile Footer */}
        <div style={{ padding: '8px 12px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', position: 'relative' }}>
          <AnimatePresence>
            {showTopMenu && (
              <motion.div
                ref={menuRef}
                initial={{ y: 15, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 15, opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 10px)',
                  left: 10,
                  right: 10,
                  background: 'linear-gradient(180deg, rgba(15, 17, 41, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 16,
                  padding: '6px',
                  boxShadow: '0 -10px 25px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                {/* Option 1: Meu Perfil */}
                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTopMenu(false);
                    router.push('/meu-perfil');
                    if (isMobile) toggleSidebar();
                  }}
                  style={{
                    width: '100%',
                    padding: effectiveCollapsed ? '10px' : '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                    gap: 12,
                    color: 'rgba(255, 255, 255, 0.8)',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                >
                  <UserCircle size={18} color="#7928ca" style={{ filter: 'drop-shadow(0 0 5px rgba(121, 40, 202, 0.5))', flexShrink: 0 }} />
                  {!effectiveCollapsed && (
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>Meu Perfil</span>
                  )}
                </motion.button>

                {/* Option: Trocar Módulo */}
                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 210, 255, 0.04)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTopMenu(false);
                    window.location.href = '/login?step=choose_system';
                  }}
                  style={{
                    width: '100%',
                    padding: effectiveCollapsed ? '10px' : '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                    gap: 12,
                    color: '#00D2FF',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                >
                  <LayoutDashboard size={18} color="#00D2FF" style={{ filter: 'drop-shadow(0 0 5px rgba(0, 210, 255, 0.5))', flexShrink: 0 }} />
                  {!effectiveCollapsed && (
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>Trocar Módulo</span>
                  )}
                </motion.button>

                {/* Option 2: Sair */}
                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(239, 68, 68, 0.04)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setShowTopMenu(false);
                    try {
                      await performLogout();
                      setCurrentUser(null);
                      window.location.href = '/login';
                    } catch (err) {
                      window.location.href = '/login';
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: effectiveCollapsed ? '10px' : '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                    gap: 12,
                    color: '#ef4444',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                >
                  <LogOut size={18} color="#ef4444" style={{ filter: 'drop-shadow(0 0 5px rgba(239, 68, 68, 0.5))', flexShrink: 0 }} />
                  {!effectiveCollapsed && (
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>Sair</span>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ MÓDULOS ═══ */}
          <div style={{ padding: '0 8px', marginBottom: 16 }}>
            <AnimatePresence>
              {!effectiveCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', marginBottom: 12, paddingLeft: 4, overflow: 'hidden' }}
                >
                  MÓDULOS
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ display: 'flex', flexDirection: effectiveCollapsed ? 'column' : 'row', gap: 8, justifyContent: 'space-between' }}>
              
              {/* Agenda Digital */}
              <Link href="/agenda-digital" target="_blank" style={{ flex: 1, textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title="Agenda Digital">
                <motion.div 
                  whileHover={{ scale: 1.05, filter: 'brightness(1.1)' }} 
                  whileTap={{ scale: 0.95 }}
                  style={{ 
                    width: effectiveCollapsed ? 40 : 44,
                    height: effectiveCollapsed ? 40 : 44, 
                    borderRadius: 14, 
                    background: 'linear-gradient(135deg, #a855f7, #7e22ce)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)', 
                    border: '1px solid rgba(255,255,255,0.1)' 
                  }}
                >
                  <BookHeart size={effectiveCollapsed ? 20 : 18} color="#fff" />
                </motion.div>
                {!effectiveCollapsed && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.1 }}>Agenda<br/>Digital</span>
                )}
              </Link>

              {/* Gestão de Pessoas */}
              <Link href="/gestao-pessoas" style={{ flex: 1, textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title="Gestão de Pessoas">
                <motion.div 
                  whileHover={{ scale: 1.05, filter: 'brightness(1.1)' }} 
                  whileTap={{ scale: 0.95 }}
                  style={{ 
                    width: effectiveCollapsed ? 40 : 44,
                    height: effectiveCollapsed ? 40 : 44, 
                    borderRadius: 14, 
                    background: 'linear-gradient(135deg, #10b981, #047857)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', 
                    border: '1px solid rgba(255,255,255,0.1)' 
                  }}
                >
                  <Users size={effectiveCollapsed ? 20 : 18} color="#fff" />
                </motion.div>
                {!effectiveCollapsed && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.1 }}>Gestão de<br/>Pessoas</span>
                )}
              </Link>

              {/* SIMULADOS */}
              <Link href="/simulados" style={{ flex: 1, textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title="PROVAS/SIMULADOS">
                <motion.div 
                  whileHover={{ scale: 1.05, filter: 'brightness(1.1)' }} 
                  whileTap={{ scale: 0.95 }}
                  style={{ 
                    width: effectiveCollapsed ? 40 : 44,
                    height: effectiveCollapsed ? 40 : 44, 
                    borderRadius: 14, 
                    background: 'linear-gradient(135deg, #f43f5e, #be123c)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)', 
                    border: '1px solid rgba(255,255,255,0.1)' 
                  }}
                >
                  <ClipboardPenLine size={effectiveCollapsed ? 20 : 18} color="#fff" />
                </motion.div>
                {!effectiveCollapsed && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.1 }}>Simulados<br/>e Provas</span>
                )}
              </Link>

            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <motion.div 
              ref={profileCardRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowTopMenu(prev => !prev);
              }}
              whileHover={{ background: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.2)' }}
              style={{ padding: '10px', borderRadius: 20, background: 'rgba(255, 255, 255, 0.04)', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(255, 255, 255, 0.12)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ position: 'relative' }}>
                <UserAvatar 
                  key={currentUser?.foto || 'default'}
                  userId={currentUser?.id} 
                  name={currentUser?.nome || 'Usuário'} 
                  fotoUrl={currentUser?.foto}
                  size={40} 
                  style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }} 
                />
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: 6, background: '#10b981', border: '2px solid #060814', boxShadow: '0 0 8px #10b981' }} />
              </div>
              {!effectiveCollapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.nome || 'Usuário'}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{currentUser?.cargo || 'Colaborador'}</div>
                  </div>
                  
                  {/* Inline Actions */}
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
                      <motion.button 
                        whileHover={{ background: 'rgba(255,255,255,0.15)', scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); setTheme(theme === 'dark' ? 'light' : 'dark') }}
                        style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        {theme === 'dark' ? <Sun size={17} color="#fbbf24" style={{ filter: 'drop-shadow(0 0 5px rgba(251, 191, 36, 0.4))' }} /> : <Moon size={17} color="#60a5fa" style={{ filter: 'drop-shadow(0 0 5px rgba(96, 165, 250, 0.4))' }} />}
                      </motion.button>
                      
                      <NotificationPopover />
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </motion.aside>
    </>
  )
}
