'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, ChevronDown, ChevronRight, Tag, Percent,
  DollarSign, CreditCard, TrendingDown, Receipt, PiggyBank, Building2, CandlestickChart,
  UserCheck, Users2, Calendar, ClipboardCheck, Star, Megaphone, MessageSquare, Bell,
  BarChart3, Brain, Zap, Settings, Shield, HelpCircle, Package, Wrench, Bus, UtensilsCrossed,
  FileText, Archive, Library, Search, ChevronLeft, Layers, TargetIcon, UserPlus, PanelLeft,
  Home, LineChart, BookMarked, Database, Globe, Webhook, FolderOpen,
  BookOpenCheck, CalendarDays, FlaskConical, HardHat, ClipboardPenLine, Clock3, Banknote, Wallet, AlertTriangle, DoorOpen, Scan, Monitor, ListChecks, BookHeart, ShieldCheck
} from 'lucide-react'

interface NavItem {
  label: string
  href?: string
  icon?: React.ReactNode
  badge?: string
  badgeColor?: string
  target?: string
  children?: NavItem[]
  roles?: string[]
}

interface NavGroup {
  title: string
  moduleKey?: string
  roleKey?: string
  collapsible?: boolean
  defaultOpen?: boolean
  items: NavItem[]
}

const ALL_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    collapsible: false,
    items: [
      { label: 'Hub Executivo', href: '/dashboard', icon: <Home size={16} />, badge: 'AO VIVO', badgeColor: 'cyan' },
      { label: 'Central de Alertas', href: '/alertas', icon: <Bell size={16} /> },
      { label: 'Minhas Tarefas', href: '/tarefas', icon: <ClipboardCheck size={16} /> },
      { label: 'Calendário', href: '/calendario', icon: <Calendar size={16} /> },
      { label: 'Agenda Digital', href: '/agenda-digital', icon: <BookHeart size={16} />, badge: 'NOVO', badgeColor: 'purple', target: '_blank' },
    ],
  },


  {
    title: 'Acadêmico',
    moduleKey: 'academico',
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        label: 'Alunos', icon: <Users size={16} />,
        children: [
          { label: 'Lista de Alunos', href: '/academico/alunos', icon: <Users size={14} /> },
          { label: 'Ficha 360°', href: '/academico/alunos/ficha', icon: <UserCheck size={14} /> },
          { label: 'Responsáveis', href: '/academico/responsaveis', icon: <Users2 size={14} /> },
          { label: 'Transferências', href: '/academico/transferencias', icon: <ChevronRight size={14} /> },
          { label: 'Rematrícula Digital', href: '/crm/rematricula', icon: <UserPlus size={14} /> },
        ],
      },
      {
        label: 'Turmas & Ensalamento', icon: <Layers size={16} />,
        children: [
          { label: 'Turmas', href: '/academico/turmas', icon: <Layers size={14} /> },
          { label: 'Grade Horária', href: '/academico/grade', icon: <Calendar size={14} /> },
          { label: 'Ensalamento', href: '/academico/ensalamento', icon: <Building2 size={14} /> },
        ],
      },
      {
        label: 'Diário Digital', icon: <BookOpen size={16} />,
        children: [
          { label: 'Frequência', href: '/academico/frequencia', icon: <ClipboardList size={14} /> },
          { label: 'Lançamento de Notas', href: '/academico/notas', icon: <Star size={14} /> },
          { label: 'Ocorrências', href: '/academico/ocorrencias', icon: <ClipboardCheck size={14} /> },
        ],
      },
      { label: 'Conselhos de Classe',  href: '/academico/conselho',       icon: <GraduationCap size={16} /> },
      { label: 'Declarações & Docs',    href: '/secretaria/documentos',    icon: <FileText size={16} /> },
      { label: 'Secretaria Escolar',    href: '/secretaria',               icon: <Archive size={16} /> },
    ],
  },
  {
    title: 'Financeiro',
    moduleKey: 'financeiro',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'Contas a Receber', href: '/financeiro/receber', icon: <CreditCard size={16} /> },
      { label: 'Inadimplência', href: '/financeiro/inadimplencia', icon: <TrendingDown size={16} /> },
      { label: 'Renegociação', href: '/financeiro/renegociacao', icon: <Receipt size={16} /> },
      { label: 'Contas a Pagar', href: '/financeiro/pagar', icon: <DollarSign size={16} /> },
      { label: 'Movimentações', href: '/financeiro/movimentacoes', icon: <CandlestickChart size={16} /> },
      { label: 'Boletos & Convênio', href: '/financeiro/boletos', icon: <FileText size={16} /> },

      { label: 'Emissão de NF', href: '/financeiro/nf', icon: <Receipt size={16} /> },
      { label: 'Banking & PIX', href: '/financeiro/banking', icon: <PiggyBank size={16} /> },
      { label: 'DRE Gerencial', href: '/financeiro/dre', icon: <BarChart3 size={16} /> },
      { label: 'Centro de Custos', href: '/financeiro/custos', icon: <LineChart size={16} /> },
    ],
  },
  {
    title: 'Recursos Humanos',
    moduleKey: 'rh',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'Funcionários', href: '/rh/funcionarios', icon: <Users2 size={16} /> },
      { label: 'Folha de Pagamento', href: '/rh/folha', icon: <Banknote size={16} /> },
      { label: 'Adiantamentos', href: '/rh/adiantamentos', icon: <Banknote size={16} />, badge: 'NOVO', badgeColor: 'cyan' },
      { label: 'Ponto Eletrônico', href: '/rh/ponto', icon: <Clock3 size={16} /> },
      { label: 'Férias & Afastamentos', href: '/rh/ferias', icon: <ClipboardList size={16} /> },
      { label: 'Advertências', href: '/rh/advertencias', icon: <AlertTriangle size={16} /> },
    ],
  },
  {
    title: 'CRM & Captação',
    moduleKey: 'crm',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'Funil de Leads', href: '/crm/leads', icon: <TargetIcon size={16} /> },
      { label: 'Agendamentos', href: '/crm/agendamentos', icon: <Calendar size={16} /> },
      { label: 'Retenção & Evasão', href: '/crm/retencao', icon: <TrendingDown size={16} /> },
    ],
  },
  {
    title: 'Portaria',
    moduleKey: 'portaria',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'Painel Tablet',  href: '/painel-tablet',              icon: <Scan size={16} />, badge: 'NOVO', badgeColor: 'cyan', target: '_blank' },
      { label: 'Monitor TV',     href: '/saida-alunos/monitor',        icon: <Monitor size={16} /> },
      { label: 'Chamadas',       href: '/saida-alunos/chamadas',       icon: <DoorOpen size={16} /> },
      { label: 'Relatórios',     href: '/saida-alunos/relatorios',     icon: <ListChecks size={16} /> },
      { label: 'Configurações',  href: '/saida-alunos/configuracoes',  icon: <Settings size={16} /> },
    ],
  },

  {
    title: 'Administrativo',
    moduleKey: 'administrativo',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'Fornecedores',          href: '/administrativo/fornecedores', icon: <Building2 size={16} /> },
      { label: 'Abertura de Caixa',      href: '/administrativo/caixa',       icon: <DollarSign size={16} /> },
      { label: 'Patrimônio',             href: '/administrativo/patrimonio',  icon: <Package size={16} /> },
      { label: 'Almoxarifado',           href: '/administrativo/almoxarifado',icon: <Library size={16} /> },
      { label: 'Pedidos Livros/Apostilas',href: '/administrativo/pedidos-livros',icon: <BookOpenCheck size={16} />, badge: 'NOVO', badgeColor: 'cyan' },
      { label: 'Manutenção Predial',     href: '/administrativo/manutencao',  icon: <HardHat size={16} /> },
      {
        label: 'Config. Pedagógico', icon: <GraduationCap size={16} />,
        children: [
          { label: 'Turmas', href: '/academico/turmas', icon: <Layers size={14} /> },
          { label: 'Turnos', href: '/configuracoes/pedagogico/turnos', icon: <Clock3 size={14} /> },
          { label: 'Situação do Aluno', href: '/configuracoes/pedagogico/situacao-aluno', icon: <UserCheck size={14} /> },
          { label: 'Grupos de Alunos', href: '/configuracoes/pedagogico/grupo-alunos', icon: <Users2 size={14} /> },
          { label: 'Disciplinas', href: '/configuracoes/pedagogico/disciplinas', icon: <BookOpen size={14} /> },
          { label: 'Níveis de Ensino', href: '/configuracoes/pedagogico/niveis-ensino', icon: <GraduationCap size={14} /> },
          { label: 'Tipo de Ocorrências', href: '/configuracoes/pedagogico/tipo-ocorrencias', icon: <ClipboardCheck size={14} /> },
          { label: 'Esquema de Avaliações', href: '/configuracoes/pedagogico/esquema-avaliacao', icon: <Star size={14} /> },
          { label: 'Horário de Aulas', href: '/configuracoes/pedagogico/horario', icon: <CalendarDays size={14} /> },
          { label: 'Config. de Notas', href: '/configuracoes/pedagogico/config-notas', icon: <FlaskConical size={14} /> },
          { label: 'Documentos Escolares', href: '/configuracoes/pedagogico/documentos', icon: <FileText size={14} /> },
        ],
      },
      {
        label: 'Config. Financeiro', icon: <DollarSign size={16} />,
        children: [
          { label: 'Centro de Custo', href: '/configuracoes/financeiro/centro-custo', icon: <Layers size={14} /> },
          { label: 'Cartões', href: '/configuracoes/financeiro/cartoes', icon: <CreditCard size={14} /> },
          { label: 'Eventos Financeiros', href: '/configuracoes/financeiro/eventos', icon: <Tag size={14} /> },
          { label: 'Grupo de Descontos', href: '/configuracoes/financeiro/grupo-desconto', icon: <Percent size={14} /> },
          { label: 'Métodos de Pagamento', href: '/configuracoes/financeiro/metodos-pagamento', icon: <Wallet size={14} /> },
          { label: 'Padrão de Pagamentos', href: '/configuracoes/financeiro/padrao-pagamento', icon: <DollarSign size={14} /> },
          { label: 'Plano de Contas', href: '/configuracoes/financeiro/plano-contas', icon: <FileText size={14} /> },
          { label: 'Tipos de Documentos', href: '/configuracoes/financeiro/tipo-documentos', icon: <FileText size={14} /> },
          { label: 'Configuração da DRE', href: '/configuracoes/financeiro/dre-config', icon: <BarChart3 size={14} />, badge: 'NOVO', badgeColor: 'cyan' },
        ],
      },
    ],
  },

  {
    title: 'Inteligência & BI',
    moduleKey: 'bi',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'Hub BI Executivo', href: '/bi', icon: <BarChart3 size={16} /> },
      { label: 'Copilotos IA', href: '/ia/copilotos', icon: <Brain size={16} />, badge: 'IA', badgeColor: 'purple' },
      { label: 'Insights Automáticos', href: '/ia/insights', icon: <Zap size={16} /> },
    ],
  },
  {
    title: 'Governo',
    moduleKey: 'relatorios',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'Censo Escolar', href: '/relatorios/censo', icon: <Database size={16} /> },
      { label: 'Relatórios MEC/INEP', href: '/relatorios/mec', icon: <FileText size={16} /> },
    ],
  },

  {
    title: 'Multi-Unidades',
    moduleKey: 'multiUnidades',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'Gestão de Unidades', href: '/configuracoes/unidades', icon: <Building2 size={16} /> },
    ],
  },

  {
    title: 'Configurações',
    roleKey: 'Diretor Geral',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'Usuários & Acessos', href: '/configuracoes/usuarios', icon: <Shield size={16} /> },
      { label: 'Integrações & API', href: '/configuracoes/integracoes', icon: <Webhook size={16} /> },
      { label: 'Config. do Sistema', href: '/configuracoes', icon: <Settings size={16} /> },
      { label: 'Controle de Logs', href: '/configuracoes/logs', icon: <ShieldCheck size={16} /> },
      { label: 'Ajuda & Suporte', href: '/ajuda', icon: <HelpCircle size={16} /> },
    ],
  },
]

/* ══════════════════════════════════════════
   NAV ITEM COMPONENT (leaf + nested)
══════════════════════════════════════════ */
function NavItemComp({ item, collapsed, depth = 0 }: { item: NavItem; collapsed: boolean; depth?: number }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some(c => c.href === pathname || c.children?.some(cc => cc.href === pathname))
  })

  const isActive = item.href ? (item.href === pathname) : false
  const hasChildren = item.children && item.children.length > 0

  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(open ? undefined : 0)

  useEffect(() => {
    if (!contentRef.current) return
    if (open) {
      setHeight(contentRef.current.scrollHeight)
      const t = setTimeout(() => setHeight(undefined), 300)
      return () => clearTimeout(t)
    } else {
      setHeight(contentRef.current.scrollHeight)
      requestAnimationFrame(() => requestAnimationFrame(() => setHeight(0)))
    }
  }, [open])

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`nav-item w-full text-left ${open ? 'active-parent' : ''}`}
          title={collapsed ? item.label : undefined}
          style={{ position: 'relative' }}
        >
          <span className="nav-icon">{item.icon}</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-sm" style={{ fontSize: 13, fontWeight: open ? 600 : 500 }}>{item.label}</span>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: 4,
                background: open ? 'rgba(59,130,246,0.15)' : 'transparent',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}>
                <ChevronDown size={12} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: open ? '#60a5fa' : 'hsl(var(--text-muted))' }} />
              </span>
            </>
          )}
        </button>
        {!collapsed && (
          <div
            ref={contentRef}
            style={{
              overflow: 'hidden',
              height: height === undefined ? 'auto' : height,
              transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div style={{ paddingLeft: 14, paddingBottom: 2, borderLeft: '1px solid rgba(59,130,246,0.15)', marginLeft: 22, marginTop: 1 }}>
              {item.children!.map(child => (
                <NavItemComp key={child.label} item={child} collapsed={false} depth={depth + 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // External/new-tab link
  if (item.target) {
    return (
      <a
        href={item.href || '#'}
        target={item.target}
        rel="noopener noreferrer"
        className={`nav-item ${isActive ? 'active' : ''}`}
        title={collapsed ? item.label : undefined}
        style={depth > 0 ? { paddingTop: 5, paddingBottom: 5 } : undefined}
      >
        <span className="nav-icon" style={depth > 0 ? { opacity: 0.7 } : undefined}>{item.icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1 text-sm" style={{ fontSize: depth > 0 ? 12 : 13 }}>{item.label}</span>
            {item.badge && (
              <span className={`badge badge-${item.badgeColor || 'neutral'}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                {item.badge}
              </span>
            )}
          </>
        )}
      </a>
    )
  }

  return (
    <Link
      href={item.href || '#'}
      className={`nav-item ${isActive ? 'active' : ''}`}
      title={collapsed ? item.label : undefined}
      style={depth > 0 ? { paddingTop: 5, paddingBottom: 5 } : undefined}
    >
      <span className="nav-icon" style={depth > 0 ? { opacity: 0.7 } : undefined}>{item.icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-sm" style={{ fontSize: depth > 0 ? 12 : 13 }}>{item.label}</span>
          {item.badge && (
            <span className={`badge badge-${item.badgeColor || 'neutral'}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

/* ══════════════════════════════════════════
   COLLAPSIBLE NAV GROUP — com accordion
   openGroupKey + onToggle permitem fechar
   outros grupos quando um novo é aberto
══════════════════════════════════════════ */
function NavGroupComp({
  group,
  collapsed,
  groupKey,
  openGroupKey,
  onToggle,
}: {
  group: { title: string; items: NavItem[]; collapsible: boolean; defaultOpen: boolean }
  collapsed: boolean
  groupKey: string
  openGroupKey: string | null
  onToggle: (key: string) => void
}) {
  const pathname = usePathname()
  const isActiveGroup = group.items.some(item =>
    item.href === pathname ||
    item.children?.some(c => c.href === pathname || c.children?.some(cc => cc.href === pathname))
  )

  // Accordion: aberto se é o grupo ativo OU se o pai disse que está aberto
  const open = openGroupKey === groupKey || isActiveGroup

  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(open ? undefined : 0)

  // Abrir quando navegar para este grupo
  useEffect(() => {
    if (isActiveGroup) onToggle(groupKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!contentRef.current) return
    if (open) {
      setHeight(contentRef.current.scrollHeight)
      const t = setTimeout(() => setHeight(undefined), 300)
      return () => clearTimeout(t)
    } else {
      setHeight(contentRef.current.scrollHeight)
      requestAnimationFrame(() => requestAnimationFrame(() => setHeight(0)))
    }
  }, [open])

  if (!group.collapsible) {
    return (
      <div>
        {!collapsed && <div className="nav-section-label">{group.title}</div>}
        {group.items.map(item => (
          <NavItemComp key={item.label} item={item} collapsed={collapsed} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 4, marginTop: 6 }}>
      {!collapsed ? (
        <button
          onClick={() => onToggle(groupKey)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 14px 5px',
            background: isActiveGroup ? 'rgba(59,130,246,0.05)' : 'none',
            border: 'none',
            borderLeft: isActiveGroup ? '2px solid rgba(59,130,246,0.5)' : '2px solid transparent',
            cursor: 'pointer',
            textAlign: 'left',
            userSelect: 'none',
            transition: 'all 0.15s',
          }}
        >
          <span style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isActiveGroup ? '#93c5fd' : '#94a3b8',
            transition: 'color 0.15s',
          }}>
            {group.title}
          </span>
          <ChevronDown
            size={12}
            style={{
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
              color: isActiveGroup ? '#60a5fa' : 'rgba(148,163,184,0.6)',
              flexShrink: 0,
            }}
          />
        </button>
      ) : (
        <div style={{ padding: '4px 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 1, background: 'rgba(100,116,139,0.3)' }} />
        </div>
      )}
      <div
        ref={contentRef}
        style={{
          overflow: 'hidden',
          height: collapsed ? 'auto' : (height === undefined ? 'auto' : height),
          transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {(open || collapsed) && (
          <div style={{ paddingBottom: 2 }}>
            {group.items.map(item => (
              <NavItemComp key={item.label} item={item} collapsed={collapsed} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   MAIN SIDEBAR COMPONENT
══════════════════════════════════════════ */
export function Sidebar() {
  const { sidebarCollapsed: collapsed, toggleSidebar, activeUnit, setActiveUnit, activeModules, sidebarTheme, currentUserPerfil } = useApp()
  const { mantenedores = [] } = useData()
  const [unitOpen, setUnitOpen] = useState(false)
  const pathname = usePathname()

  // ── Unidades: prioriza mantenedores cadastrados, fallback decente
  const unidades = mantenedores.length > 0
    ? ['Todas as Unidades', ...mantenedores.map(m => m.nome)]
    : ['Todas as Unidades', 'Unidade Centro', 'Unidade Norte', 'Unidade Sul']

  const visibleGroups = ALL_NAV_GROUPS.filter(g => {
    if (g.moduleKey && activeModules[g.moduleKey] === false) return false
    if (g.roleKey && g.roleKey !== currentUserPerfil) return false
    return true
  })

  type MergedGroup = { title: string; items: NavItem[]; collapsible: boolean; defaultOpen: boolean }
  const mergedGroups: MergedGroup[] = []
  for (const g of visibleGroups) {
    const last = mergedGroups[mergedGroups.length - 1]
    if (last && last.title === g.title) {
      last.items = [...last.items, ...g.items]
    } else {
      mergedGroups.push({
        title: g.title,
        items: [...g.items],
        collapsible: g.collapsible ?? false,
        defaultOpen: g.defaultOpen ?? true,
      })
    }
  }

  // ── Accordion: controla qual grupo collapsible está aberto
  const getInitialOpenKey = useCallback(() => {
    for (const g of mergedGroups) {
      if (!g.collapsible) continue
      const isActive = g.items.some(item =>
        item.href === pathname ||
        item.children?.some(c => c.href === pathname || c.children?.some(cc => cc.href === pathname))
      )
      if (isActive || g.defaultOpen) return g.title
    }
    return null
  }, [pathname])

  const [openGroupKey, setOpenGroupKey] = useState<string | null>(getInitialOpenKey)

  // Fechar unit dropdown ao clicar fora
  const unitRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) {
        setUnitOpen(false)
      }
    }
    if (unitOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [unitOpen])

  const handleGroupToggle = useCallback((key: string) => {
    setOpenGroupKey(prev => prev === key ? null : key)
  }, [])

  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''} sidebar-${sidebarTheme}`}
      data-theme={sidebarTheme === 'dark' ? 'dark' : undefined}
    >
      {/* Logo */}
      <div style={{ padding: '16px', borderBottom: '1px solid rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '64px' }}>
        <div style={{ width: 36, height: 36, background: 'var(--gradient-primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 20px rgba(59,130,246,0.3)' }}>
          <GraduationCap size={20} color="#fff" />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }} className="gradient-text">IMPACTO</div>
            <div style={{ fontSize: 10, color: 'rgba(100,116,139,0.8)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>EDU Platform</div>
          </div>
        )}
        <button onClick={toggleSidebar} className="btn btn-ghost btn-icon" style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.7 }}>
          {collapsed ? <PanelLeft size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
        {!collapsed && (
          <div style={{ padding: '4px 16px 10px', borderBottom: '1px solid rgba(59,130,246,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.12)' }}>
              <span style={{ fontSize: 10 }}>📅</span>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Ano Letivo</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit, sans-serif' }}>{new Date().getFullYear()}</span>
            </div>
          </div>
        )}



      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 0 16px' }}>
        {mergedGroups.map((group, i) => (
          <NavGroupComp
            key={group.title + i}
            group={group}
            collapsed={collapsed}
            groupKey={group.title}
            openGroupKey={openGroupKey}
            onToggle={handleGroupToggle}
          />
        ))}
      </div>

    </aside>
  )
}

