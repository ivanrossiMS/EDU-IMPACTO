'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, ChevronDown,
  DollarSign, CreditCard, TrendingDown, Handshake, BarChart3,
  UserCheck, Users2, Calendar, ClipboardCheck, Star, Megaphone,
  Zap, Settings, Shield, Wrench, Search, Layers, TargetIcon,
  CalendarDays, Banknote, AlertTriangle, DoorOpen, Scan,
  Monitor, ListChecks, ShieldCheck, LogOut, UserCircle, Laptop,
  ShieldAlert, History, Landmark, Coins, FileSpreadsheet, Building, Building2,
  Tablet, FileStack, FileCheck2, Calculator, Library, Check, X, Clock3, FileText
} from 'lucide-react'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { performLogout } from '@/lib/auth/logout'
import { UserAvatar } from '@/components/UserAvatar'
import { NotificationPopover } from '@/components/layout/NotificationPopover'
import { TrocarModuloModal } from '@/components/layout/TrocarModuloModal'

// Interface para itens do menu
export interface DesktopNavItem {
  id: string
  label: string
  href: string
  icon?: React.ReactNode
  badge?: string
  badgeColor?: 'pink' | 'green' | 'purple' | 'cyan'
  target?: string
  section?: string
}

// Interface para os módulos do header
export interface DesktopNavModule {
  id: string
  label: string
  href?: string
  icon: React.ReactNode
  hasSubmenu: boolean
  columns?: number
  items?: DesktopNavItem[]
  sections?: {
    title?: string
    icon?: React.ReactNode
    items: DesktopNavItem[]
  }[]
  matchPaths: (pathname: string) => boolean
}

export function DesktopTopNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentUser, currentUserPerfil } = useApp()
  const { cfgCalendarioLetivo = [], perfis = [] } = useData() as any

  const anoVigente = cfgCalendarioLetivo?.find((c: any) => c.isVigente)?.ano || '2026'

  // Estados locais
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isAnoLetivoOpen, setIsAnoLetivoOpen] = useState(false)
  const [isTrocarModuloOpen, setIsTrocarModuloOpen] = useState(false)

  // Estado da Busca
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  // ── 1. Resolução de Permissões ───────────────────────────────────────────
  const { isAgendaBlocked, isGestaoPessoasBlocked, isCredImpactoBlocked, isGestaoEscolarBlocked, userPerms, isPrivilegedAdmin } = useMemo(() => {
    const normalize = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    const activePerfilName = currentUserPerfil || currentUser?.perfil || currentUser?.cargo || ''
    const userPerfilObj = (perfis || []).find((p: any) => 
      p.nome === activePerfilName || 
      normalize(p.nome) === normalize(activePerfilName) ||
      (currentUser?.perfil && (p.nome === currentUser.perfil || normalize(p.nome) === normalize(currentUser.perfil))) ||
      (currentUser?.cargo && (p.nome === currentUser.cargo || normalize(p.nome) === normalize(currentUser.cargo)))
    )

    const normalizedPerfil = normalize(activePerfilName)
    const isPrivileged = normalizedPerfil.includes('diretor') || normalizedPerfil.includes('master') || normalizedPerfil.includes('administrador') || normalizedPerfil === 'admin'

    return {
      isAgendaBlocked: !!userPerfilObj?.bloqueadoAgendaDigital,
      isGestaoPessoasBlocked: !!userPerfilObj?.bloqueadoGestaoPessoas,
      isCredImpactoBlocked: !!userPerfilObj?.bloqueadoCredImpacto,
      isGestaoEscolarBlocked: !!userPerfilObj?.bloqueadoGestaoEscolar,
      userPerms: (userPerfilObj?.permissoes || []) as string[],
      isPrivilegedAdmin: isPrivileged
    }
  }, [currentUserPerfil, currentUser, perfis])

  // Checagem de rota individual
  const isRouteAllowed = (href: string) => {
    if (!href || href === '#') return false
    if (href === '/dashboard' || href === '/tarefas' || href === '/calendario' || href === '/meu-perfil') return true
    if (isGestaoEscolarBlocked) return false
    if (href.startsWith('/rh') && isGestaoPessoasBlocked) return false
    if (href.startsWith('/agenda-digital') && isAgendaBlocked) return false
    if (href.startsWith('/credimpacto') && isCredImpactoBlocked) return false

    // Se possui permissões explícitas no perfil
    if (!isPrivilegedAdmin && userPerms && userPerms.length > 0) {
      return userPerms.some(perm => href === perm || href.startsWith(perm + '/'))
    }
    return true
  }

  // ── 2. Configuração dos 8 Módulos Horizontais ────────────────────────────
  const NAV_MODULES: DesktopNavModule[] = useMemo(() => [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard size={16} />,
      hasSubmenu: false,
      matchPaths: (path) => path === '/dashboard' || path === '/'
    },
    {
      id: 'matriculas',
      label: 'Matrículas',
      icon: <FileCheck2 size={16} />,
      hasSubmenu: true,
      columns: 1,
      items: [
        { id: 'mat-dig', label: 'Matrícula Digital', href: '/matriculas/digital', icon: <FileCheck2 size={15} />, badge: 'NOVO', badgeColor: 'green' },
        { id: 'mat-val', label: 'Valores', href: '/matriculas/valores', icon: <Calculator size={15} />, badge: '2027', badgeColor: 'green' }
      ],
      matchPaths: (path) => path.startsWith('/matriculas')
    },
    {
      id: 'academico',
      label: 'Acadêmico',
      icon: <GraduationCap size={16} />,
      hasSubmenu: true,
      columns: 2,
      sections: [
        {
          title: 'Diretórios',
          items: [
            { id: 'acad-alunos', label: 'Alunos', href: '/academico/alunos', icon: <Users size={15} /> },
            { id: 'acad-resp', label: 'Responsáveis', href: '/academico/responsaveis', icon: <Users2 size={15} /> },
            { id: 'acad-turmas', label: 'Turmas', href: '/academico/turmas', icon: <Layers size={15} /> }
          ]
        },
        {
          title: 'Diário Digital',
          icon: <BookOpen size={14} />,
          items: [
            { id: 'acad-freq', label: 'Frequência', href: '/academico/frequencia', icon: <ClipboardList size={14} /> },
            { id: 'acad-notas', label: 'Notas e Boletim', href: '/academico/notas', icon: <Star size={14} /> },
            { id: 'acad-cont', label: 'Conteúdos e Tarefas', href: '/academico/conteudos', icon: <BookOpen size={14} /> },
            { id: 'acad-ocorr', label: 'Ocorrências', href: '/academico/ocorrencias', icon: <ShieldAlert size={14} /> }
          ]
        }
      ],
      matchPaths: (path) => path.startsWith('/academico')
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: <BarChart3 size={16} />,
      hasSubmenu: true,
      columns: 1,
      items: [
        { id: 'fin-rec', label: 'Contas a Receber', href: '/financeiro/receber', icon: <CreditCard size={15} /> },
        { id: 'fin-reneg', label: 'Renegociação', href: '/financeiro/renegociacao', icon: <Handshake size={15} /> },
        { id: 'fin-dre', label: 'DRE', href: '/financeiro/dre', icon: <BarChart3 size={15} />, badge: 'IA', badgeColor: 'purple' }
      ],
      matchPaths: (path) => path.startsWith('/financeiro')
    },
    {
      id: 'rh',
      label: 'RH',
      icon: <Users2 size={16} />,
      hasSubmenu: true,
      columns: 1,
      items: [
        { id: 'rh-func', label: 'Funcionários', href: '/rh/funcionarios', icon: <Users2 size={15} /> },
        { id: 'rh-folha', label: 'Folha de Pgto', href: '/rh/folha', icon: <DollarSign size={15} /> },
        { id: 'rh-adiant', label: 'Adiantamentos', href: '/rh/adiantamentos', icon: <Banknote size={15} /> },
        { id: 'rh-ferias', label: 'Férias e Afast.', href: '/rh/ferias', icon: <CalendarDays size={15} /> },
        { id: 'rh-advert', label: 'Advertências', href: '/rh/advertencias', icon: <AlertTriangle size={15} /> }
      ],
      matchPaths: (path) => path.startsWith('/rh')
    },
    {
      id: 'portaria',
      label: 'Portaria',
      icon: <DoorOpen size={16} />,
      hasSubmenu: true,
      columns: 2,
      sections: [
        {
          title: 'Entrada IDFace',
          icon: <Scan size={14} />,
          items: [
            { id: 'port-dash', label: 'Dashboard', href: '/portaria', icon: <LayoutDashboard size={14} /> },
            { id: 'port-lib', label: 'Alunos Liberados', href: '/portaria/alunos-liberados', icon: <UserCheck size={14} /> },
            { id: 'port-logs', label: 'Logs de Acesso', href: '/portaria/logs', icon: <ListChecks size={14} /> },
            { id: 'port-rel', label: 'Relatórios', href: '/portaria/relatorios', icon: <FileSpreadsheet size={14} /> },
            { id: 'port-disp', label: 'Dispositivos', href: '/portaria/dispositivos', icon: <Laptop size={14} /> },
            { id: 'port-cfg', label: 'Configurações', href: '/portaria/configuracoes', icon: <Settings size={14} /> }
          ]
        },
        {
          title: 'Saída de Alunos',
          icon: <DoorOpen size={14} />,
          items: [
            { id: 'said-cham', label: 'Chamadas', href: '/saida-alunos/chamadas', icon: <LogOut size={14} /> },
            { id: 'said-anunc', label: 'Anunciar', href: '/saida-alunos/anunciar', icon: <Megaphone size={14} /> },
            { id: 'said-tab', label: 'Painel-Tablet', href: '/painel-tablet', icon: <Tablet size={14} /> },
            { id: 'said-tv', label: 'Monitor TV', href: '/monitor-tv', icon: <Monitor size={14} />, target: '_blank' },
            { id: 'said-rel', label: 'Relatórios', href: '/saida-alunos/relatorios', icon: <FileText size={14} /> },
            { id: 'said-cfg', label: 'Configurações', href: '/saida-alunos/configuracoes', icon: <Settings size={14} /> }
          ]
        }
      ],
      matchPaths: (path) => path.startsWith('/portaria') || path.startsWith('/saida-alunos') || path === '/painel-tablet' || path === '/monitor-tv'
    },
    {
      id: 'administrativo',
      label: 'Administrativo',
      icon: <Building2 size={16} />,
      hasSubmenu: true,
      columns: 1,
      items: [
        { id: 'adm-irpf', label: 'Declaração IRPF', href: '/administrativo/declaracao-irpf', icon: <FileCheck2 size={15} /> },
        { id: 'adm-docs', label: 'Docs Escolares', href: '/secretaria/documentos', icon: <FileStack size={15} /> },
        { id: 'adm-livros', label: 'Pedido Livros/Apost.', href: '/administrativo/pedidos-livros', icon: <Library size={15} /> },
        { id: 'adm-manut', label: 'Manutenção Predial', href: '/administrativo/manutencao', icon: <Wrench size={15} /> }
      ],
      matchPaths: (path) => path.startsWith('/administrativo') || path.startsWith('/secretaria')
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: <Settings size={16} />,
      hasSubmenu: true,
      columns: 3,
      sections: [
        {
          title: 'Sistema & Acessos',
          icon: <Shield size={14} />,
          items: [
            { id: 'cfg-users', label: 'Usuários e Acessos', href: '/configuracoes/usuarios', icon: <Shield size={14} /> },
            { id: 'cfg-sys', label: 'Config. do Sistema', href: '/configuracoes', icon: <Settings size={14} /> },
            { id: 'cfg-unit', label: 'Multi-Unidades', href: '/configuracoes/unidades', icon: <Building size={14} /> },
            { id: 'cfg-priv', label: 'Privacidade', href: '/privacidade', icon: <ShieldCheck size={14} /> },
            { id: 'cfg-logs', label: 'Auditoria e Logs', href: '/configuracoes/logs', icon: <History size={14} /> }
          ]
        },
        {
          title: 'Config. Financeiro',
          icon: <Landmark size={14} />,
          items: [
            { id: 'cfg-pc', label: 'Plano de Contas', href: '/configuracoes/financeiro/plano-contas', icon: <Landmark size={14} /> },
            { id: 'cfg-card', label: 'Cartões', href: '/configuracoes/financeiro/cartoes', icon: <CreditCard size={14} /> },
            { id: 'cfg-met', label: 'Métodos Pagamento', href: '/configuracoes/financeiro/metodos-pagamento', icon: <Coins size={14} /> },
            { id: 'cfg-tdoc', label: 'Tipo de Documentos', href: '/configuracoes/financeiro/tipo-documentos', icon: <FileSpreadsheet size={14} /> },
            { id: 'cfg-gdesc', label: 'Grupo Desconto', href: '/configuracoes/financeiro/grupo-desconto', icon: <TrendingDown size={14} /> },
            { id: 'cfg-ppag', label: 'Padrão Pagamento', href: '/configuracoes/financeiro/padrao-pagamento', icon: <CreditCard size={14} /> },
            { id: 'cfg-ev', label: 'Eventos', href: '/configuracoes/financeiro/eventos', icon: <Zap size={14} /> }
          ]
        },
        {
          title: 'Config. Pedagógico',
          icon: <GraduationCap size={14} />,
          items: [
            { id: 'cfg-ano', label: 'Ano Letivo', href: '/configuracoes/pedagogico/ano-letivo', icon: <CalendarDays size={14} /> },
            { id: 'cfg-ser', label: 'Séries', href: '/configuracoes/pedagogico/series', icon: <Layers size={14} /> },
            { id: 'cfg-niv', label: 'Níveis de Ensino', href: '/configuracoes/pedagogico/niveis-ensino', icon: <TargetIcon size={14} /> },
            { id: 'cfg-disc', label: 'Disciplinas', href: '/configuracoes/pedagogico/disciplinas', icon: <BookOpen size={14} /> },
            { id: 'cfg-hor', label: 'Horários', href: '/configuracoes/pedagogico/horario', icon: <Clock3 size={14} /> },
            { id: 'cfg-docs', label: 'Tipos de Documentos', href: '/configuracoes/pedagogico/documentos', icon: <FileText size={14} /> },
            { id: 'cfg-galun', label: 'Grupo Alunos', href: '/configuracoes/pedagogico/grupo-alunos', icon: <Users size={14} /> },
            { id: 'cfg-sital', label: 'Situação do Aluno', href: '/configuracoes/pedagogico/situacao-aluno', icon: <ShieldCheck size={14} /> },
            { id: 'cfg-tocor', label: 'Tipo de Ocorrências', href: '/configuracoes/pedagogico/tipo-ocorrencias', icon: <AlertTriangle size={14} /> }
          ]
        }
      ],
      matchPaths: (path) => path.startsWith('/configuracoes') || path.startsWith('/privacidade')
    }
  ], [])

  // Filtragem dos módulos conforme permissões do usuário
  const filteredModules = useMemo(() => {
    return NAV_MODULES.map(module => {
      // Dashboard sempre liberado
      if (module.id === 'dashboard') return module

      // Filtra itens diretos
      if (module.items) {
        const allowedItems = module.items.filter(item => isRouteAllowed(item.href))
        if (allowedItems.length === 0) return null
        return { ...module, items: allowedItems }
      }

      // Filtra seções
      if (module.sections) {
        const allowedSections = module.sections.map(section => ({
          ...section,
          items: section.items.filter(item => isRouteAllowed(item.href))
        })).filter(section => section.items.length > 0)

        if (allowedSections.length === 0) return null
        return { ...module, sections: allowedSections }
      }

      return module
    }).filter(Boolean) as DesktopNavModule[]
  }, [NAV_MODULES, isRouteAllowed])

  // ── 3. Base para Busca Rápida no Sistema ─────────────────────────────────
  const allSearchableDestinations = useMemo(() => {
    const list: { title: string; href: string; group: string; icon: React.ReactNode; target?: string }[] = []

    // Adiciona atalhos principais
    list.push({ title: 'Dashboard - Visão Geral', href: '/dashboard', group: 'Principal', icon: <LayoutDashboard size={15} /> })
    list.push({ title: 'Minhas Tarefas', href: '/tarefas', group: 'Principal', icon: <ClipboardCheck size={15} /> })
    list.push({ title: 'Calendário Escolar', href: '/calendario', group: 'Principal', icon: <Calendar size={15} /> })
    list.push({ title: 'Meu Perfil', href: '/meu-perfil', group: 'Conta', icon: <UserCircle size={15} /> })

    // Adiciona todos os destinos dos módulos permitidos
    filteredModules.forEach(mod => {
      if (mod.items) {
        mod.items.forEach(item => {
          list.push({
            title: item.label,
            href: item.href,
            group: mod.label,
            icon: item.icon,
            target: item.target
          })
        })
      }
      if (mod.sections) {
        mod.sections.forEach(sec => {
          sec.items.forEach(item => {
            list.push({
              title: item.label,
              href: item.href,
              group: `${mod.label} › ${sec.title}`,
              icon: item.icon,
              target: item.target
            })
          })
        })
      }
    })

    return list
  }, [filteredModules])

  // Resultados filtrados da busca
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    return allSearchableDestinations.filter(item => {
      const titleNorm = item.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      const groupNorm = item.group.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      return titleNorm.includes(q) || groupNorm.includes(q)
    }).slice(0, 8)
  }, [searchQuery, allSearchableDestinations])

  // ── 4. Tratamento de Cliques Externos e Teclado ───────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC fecha todos os menus abertos
      if (e.key === 'Escape') {
        setActiveDropdown(null)
        setIsProfileOpen(false)
        setIsAnoLetivoOpen(false)
        setIsSearchFocused(false)
        setSearchQuery('')
      }

      // Atalho global ⌘K ou / para focar a busca
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isSearchFocused && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        searchInputRef.current?.focus()
        setIsSearchFocused(true)
      }

      // Navegação por setas na busca
      if (isSearchFocused && searchResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSearchSelectedIndex(prev => (prev + 1) % searchResults.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSearchSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const selected = searchResults[searchSelectedIndex]
          if (selected) {
            router.push(selected.href)
            setIsSearchFocused(false)
            setSearchQuery('')
          }
        }
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
        setIsProfileOpen(false)
        setIsAnoLetivoOpen(false)
        setIsSearchFocused(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSearchFocused, searchResults, searchSelectedIndex, router])

  // Fecha dropdowns ao mudar de página
  useEffect(() => {
    setActiveDropdown(null)
    setIsProfileOpen(false)
    setIsAnoLetivoOpen(false)
    setIsSearchFocused(false)
    setSearchQuery('')
  }, [pathname])

  const toggleDropdown = (id: string) => {
    setActiveDropdown(current => current === id ? null : id)
    setIsProfileOpen(false)
    setIsAnoLetivoOpen(false)
  }

  return (
    <>
      <header
        ref={headerRef}
        className="desktop-top-nav w-full sticky top-0 z-50 transition-all select-none"
        style={{
          background: 'linear-gradient(110deg, #10152F 0%, #3730A3 38%, #4338CA 58%, #00616B 100%)',
          boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.45), 0 2px 6px -1px rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
        }}
      >
        {/* ══════════ PRIMEIRA LINHA (~70px) ══════════ */}
        <div className="h-[70px] min-h-[70px] px-6 xl:px-8 max-w-[1920px] mx-auto flex items-center justify-between border-b border-white/10 gap-4">
          
          {/* ── Esquerda: Logo Oficial Colégio Impacto ── */}
          <Link
            href="/dashboard"
            className="flex items-center gap-3.5 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-xl p-1 -ml-1 transition-transform active:scale-95"
            title="Ir para o Dashboard"
          >
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md border border-white/20 shrink-0 group-hover:scale-105 transition-transform">
              <img
                src="/app-icon.png"
                alt="Colégio Impacto"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-bold text-white/70 tracking-[0.2em] uppercase">Colégio</span>
              <span className="text-xl font-black text-white tracking-[0.03em] -mt-0.5">IMPACTO</span>
            </div>
          </Link>

          {/* ── Centro: Campo "Buscar no sistema..." Funcional ── */}
          <div className="relative flex-1 max-w-[360px] xl:max-w-[420px] 2xl:max-w-[480px]">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3.5 text-white/60 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSearchSelectedIndex(0)
                  if (!isSearchFocused) setIsSearchFocused(true)
                }}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Buscar no sistema..."
                className="w-full h-10 pl-10 pr-14 text-sm text-white placeholder-white/55 font-medium rounded-xl transition-all outline-none"
                style={{
                  background: 'rgba(255, 255, 255, 0.10)',
                  border: isSearchFocused ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.18)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: isSearchFocused ? '0 0 0 3px rgba(255, 255, 255, 0.15)' : 'none'
                }}
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 text-white/60 hover:text-white rounded-md"
                >
                  <X size={14} />
                </button>
              ) : (
                <div className="absolute right-3 flex items-center gap-1 pointer-events-none">
                  <span className="text-[10px] font-mono font-semibold text-white/50 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
                    ⌘K
                  </span>
                </div>
              )}
            </div>

            {/* Painel Flutuante de Resultados da Busca */}
            <AnimatePresence>
              {isSearchFocused && searchQuery.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute left-0 right-0 top-[calc(100%+8px)] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden z-50 p-2"
                  style={{ maxHeight: '360px', overflowY: 'auto' }}
                >
                  {searchResults.length > 0 ? (
                    <div className="space-y-1">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Páginas e Módulos Encontrados ({searchResults.length})
                      </div>
                      {searchResults.map((res, idx) => {
                        const isSelected = idx === searchSelectedIndex
                        return (
                          <Link
                            key={res.href + idx}
                            href={res.href}
                            target={res.target}
                            onClick={() => {
                              setIsSearchFocused(false)
                              setSearchQuery('')
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                              isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-100/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                {res.icon}
                              </span>
                              <div className="flex flex-col text-left truncate">
                                <span className="truncate">{res.title}</span>
                                <span className="text-[10px] text-slate-400 font-normal truncate">{res.group}</span>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">↵</span>
                          </Link>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Nenhum destino encontrado para &ldquo;<strong>{searchQuery}</strong>&rdquo;.
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Direita: Ano Letivo, Notificações, Divisor, Perfil ── */}
          <div className="flex items-center gap-3 shrink-0">
            
            {/* Seletor de Ano Letivo */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsAnoLetivoOpen(prev => !prev)
                  setIsProfileOpen(false)
                  setActiveDropdown(null)
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-white transition-all cursor-pointer border focus:outline-none"
                style={{
                  background: isAnoLetivoOpen ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'rgba(255, 255, 255, 0.15)'
                }}
                title="Alterar ou visualizar Ano Letivo vigente"
              >
                <CalendarDays size={14} className="text-white/80" />
                <span className="text-[11px] font-medium text-white/70">Ano letivo</span>
                <span className="text-xs font-bold text-white">{anoVigente}</span>
                <ChevronDown size={13} className={`text-white/70 transition-transform ${isAnoLetivoOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isAnoLetivoOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute right-0 top-[calc(100%+8px)] w-48 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200/90 p-1.5 z-50"
                  >
                    <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Anos Letivos Cadastrados
                    </div>
                    {cfgCalendarioLetivo && cfgCalendarioLetivo.length > 0 ? (
                      cfgCalendarioLetivo.map((cal: any) => (
                        <div
                          key={cal.id || cal.ano}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer"
                          onClick={() => {
                            setIsAnoLetivoOpen(false)
                            router.push('/configuracoes/pedagogico/ano-letivo')
                          }}
                        >
                          <span className={cal.isVigente ? 'font-bold text-indigo-600' : 'text-slate-700'}>
                            {cal.ano}
                          </span>
                          {cal.isVigente && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                              Vigente
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      ['2027', '2026', '2025'].map((ano) => (
                        <div
                          key={ano}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer"
                          onClick={() => setIsAnoLetivoOpen(false)}
                        >
                          <span className={ano === anoVigente ? 'font-bold text-indigo-600' : 'text-slate-700'}>
                            {ano}
                          </span>
                          {ano === anoVigente && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                              Vigente
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notificações (Reaproveitamento com side="bottom") */}
            <div className="shrink-0 flex items-center">
              <NotificationPopover side="bottom" align="end" sideOffset={14} />
            </div>

            {/* Divisor vertical discreto */}
            <div className="w-[1px] h-6 bg-white/20 mx-1" />

            {/* Perfil do Usuário com Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(prev => !prev)
                  setActiveDropdown(null)
                  setIsAnoLetivoOpen(false)
                }}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-all cursor-pointer border focus:outline-none"
                style={{
                  background: isProfileOpen ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                  borderColor: isProfileOpen ? 'rgba(255, 255, 255, 0.2)' : 'transparent'
                }}
                title="Menu de perfil e opções"
              >
                <div className="relative shrink-0">
                  <UserAvatar
                    key={currentUser?.foto || 'default'}
                    userId={currentUser?.id}
                    name={currentUser?.nome || 'Usuário'}
                    fotoUrl={currentUser?.foto}
                    size={38}
                    style={{
                      borderRadius: '50%',
                      border: '2px solid rgba(255, 255, 255, 0.35)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                    }}
                  />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#10152F]" />
                </div>

                <div className="flex flex-col text-left max-w-[130px] xl:max-w-[160px] truncate leading-tight">
                  <span className="text-xs xl:text-sm font-bold text-white truncate">
                    {currentUser?.nome || 'Usuário'}
                  </span>
                  <span className="text-[10px] xl:text-[11px] font-medium text-white/70 truncate">
                    {currentUser?.cargo || currentUser?.perfil || 'Colaborador'}
                  </span>
                </div>

                <ChevronDown size={14} className={`text-white/70 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menu do Perfil */}
              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute right-0 top-[calc(100%+8px)] w-60 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 overflow-hidden"
                  >
                    {/* Header do Card com detalhes */}
                    <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-3">
                      <UserAvatar
                        userId={currentUser?.id}
                        name={currentUser?.nome || 'Usuário'}
                        fotoUrl={currentUser?.foto}
                        size={40}
                        style={{ borderRadius: '50%' }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {currentUser?.nome || 'Usuário'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium truncate">
                          {currentUser?.cargo || currentUser?.perfil || 'Colaborador'}
                        </span>
                      </div>
                    </div>

                    <div className="p-1 space-y-0.5">
                      {/* 1. Meu Perfil */}
                      <Link
                        href="/meu-perfil"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                      >
                        <UserCircle size={16} className="text-purple-600" />
                        <span>Meu perfil</span>
                      </Link>

                      {/* 2. Trocar Módulo */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false)
                          setIsTrocarModuloOpen(true)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 transition-colors cursor-pointer text-left"
                      >
                        <LayoutDashboard size={16} className="text-cyan-600" />
                        <span>Trocar módulo</span>
                      </button>

                      <div className="h-[1px] bg-slate-100 my-1" />

                      {/* 3. Sair */}
                      <button
                        type="button"
                        onClick={async () => {
                          setIsProfileOpen(false)
                          try {
                            await performLogout()
                          } catch {
                            window.location.replace('/login')
                          }
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
                      >
                        <LogOut size={16} className="text-rose-600" />
                        <span>Sair</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* ══════════ SEGUNDA LINHA: NAVEGAÇÃO HORIZONTAL (~52px) ══════════ */}
        <div className="h-[52px] min-h-[52px] px-6 xl:px-8 max-w-[1920px] mx-auto flex items-center overflow-visible">
          <nav className="flex items-center gap-1 xl:gap-2 w-full">
            {filteredModules.map((module) => {
              const isActive = module.matchPaths(pathname)
              const isOpen = activeDropdown === module.id

              // Item sem submenu (ex: Dashboard)
              if (!module.hasSubmenu && module.href) {
                return (
                  <Link
                    key={module.id}
                    href={module.href}
                    className={`relative flex items-center gap-2 px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all focus:outline-none ${
                      isActive
                        ? 'text-white'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                    style={
                      isActive
                        ? {
                            background: 'rgba(255, 255, 255, 0.16)',
                            border: '1px solid rgba(255, 255, 255, 0.22)',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                          }
                        : { border: '1px solid transparent' }
                    }
                  >
                    <span className="shrink-0">{module.icon}</span>
                    <span>{module.label}</span>

                    {/* Destaque inferior ciano conforme a referência */}
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-[#00d2ff] rounded-full"
                        style={{ boxShadow: '0 0 8px #00d2ff' }}
                      />
                    )}
                  </Link>
                )
              }

              // Item com submenu (Matrículas, Acadêmico, etc.)
              return (
                <div key={module.id} className="relative">
                  <button
                    type="button"
                    onClick={() => toggleDropdown(module.id)}
                    className={`relative flex items-center gap-2 px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all cursor-pointer focus:outline-none ${
                      isActive
                        ? 'text-white'
                        : isOpen
                        ? 'text-white bg-white/15'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                    style={
                      isActive
                        ? {
                            background: 'rgba(255, 255, 255, 0.16)',
                            border: '1px solid rgba(255, 255, 255, 0.22)',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                          }
                        : { border: '1px solid transparent' }
                    }
                  >
                    <span className="shrink-0">{module.icon}</span>
                    <span>{module.label}</span>
                    <ChevronDown size={13} className={`text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />

                    {/* Destaque inferior ciano para o módulo ativo */}
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-[#00d2ff] rounded-full"
                        style={{ boxShadow: '0 0 8px #00d2ff' }}
                      />
                    )}
                  </button>

                  {/* Painel Flutuante do Submenu */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute top-[calc(100%+6px)] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 p-4 z-50 ${
                          module.id === 'configuracoes' || module.id === 'administrativo' ? 'right-0' : 'left-0'
                        }`}
                        style={{
                          width: module.columns === 3 ? '680px' : module.columns === 2 ? '460px' : '260px',
                          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.25), 0 8px 18px -4px rgba(0, 0, 0, 0.12)'
                        }}
                      >
                        {/* Renderização de itens simples em 1 coluna */}
                        {module.items && (
                          <div className="space-y-1">
                            {module.items.map(item => {
                              const isCurrentRoute = pathname === item.href
                              return (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  target={item.target}
                                  onClick={() => setActiveDropdown(null)}
                                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                    isCurrentRoute
                                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                                      : 'text-slate-700 hover:bg-slate-100/90'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className={isCurrentRoute ? 'text-indigo-600' : 'text-slate-500'}>
                                      {item.icon}
                                    </span>
                                    <span>{item.label}</span>
                                  </div>
                                  {item.badge && (
                                    <span
                                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                        item.badgeColor === 'green'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : item.badgeColor === 'purple'
                                          ? 'bg-purple-100 text-purple-700'
                                          : 'bg-indigo-100 text-indigo-700'
                                      }`}
                                    >
                                      {item.badge}
                                    </span>
                                  )}
                                </Link>
                              )
                            })}
                          </div>
                        )}

                        {/* Renderização de seções organizadas em colunas */}
                        {module.sections && (
                          <div className={`grid gap-4 ${module.columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {module.sections.map((sec, secIdx) => (
                              <div key={sec.title || secIdx} className="space-y-1">
                                {sec.title && (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                    {sec.icon && <span className="text-slate-400">{sec.icon}</span>}
                                    <span>{sec.title}</span>
                                  </div>
                                )}
                                {sec.items.map(item => {
                                  const isCurrentRoute = pathname === item.href
                                  return (
                                    <Link
                                      key={item.id}
                                      href={item.href}
                                      target={item.target}
                                      onClick={() => setActiveDropdown(null)}
                                      className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                        isCurrentRoute
                                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                                          : 'text-slate-700 hover:bg-slate-100/90'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={isCurrentRoute ? 'text-indigo-600' : 'text-slate-500'}>
                                          {item.icon}
                                        </span>
                                        <span>{item.label}</span>
                                      </div>
                                      {item.badge && (
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                          {item.badge}
                                        </span>
                                      )}
                                    </Link>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Modal para Trocar de Módulo */}
      <TrocarModuloModal
        isOpen={isTrocarModuloOpen}
        onClose={() => setIsTrocarModuloOpen(false)}
      />
    </>
  )
}
