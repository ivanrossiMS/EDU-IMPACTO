'use client'

import { useApp } from '@/lib/context'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useData } from '@/lib/dataContext'
import { Bell, Search, Brain, ChevronDown, Menu, Settings, LogOut, User, Sun, Moon, Command, X, DollarSign, Users, FileText, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const QUICK_LINKS = [
  { label: 'Alunos', sub: 'Acadêmico', href: '/academico/alunos', icon: <Users size={14} color="#60a5fa" /> },
  { label: 'Contas a Receber', sub: 'Financeiro', href: '/financeiro/receber', icon: <DollarSign size={14} color="#34d399" /> },
  { label: 'DRE Gerencial', sub: 'Financeiro', href: '/financeiro/dre', icon: <DollarSign size={14} color="#34d399" /> },
  { label: 'Censo Escolar', sub: 'Relatórios', href: '/relatorios/censo', icon: <FileText size={14} color="#f59e0b" /> },
  { label: 'Copilotos IA', sub: 'Inteligência', href: '/ia/copilotos', icon: <Brain size={14} color="#a78bfa" /> },
  { label: 'Folha de Pagamento', sub: 'RH', href: '/rh/folha', icon: <DollarSign size={14} color="#f59e0b" /> },
]

/** Hook que fecha dropdown ao clicar fora ou pressionar ESC */
function useDropdown(initial = false) {
  const [open, setOpen] = useState(initial)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false)
        return
      }
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [open])

  return { open, setOpen, ref }
}

export function Topbar() {
  const { sidebarCollapsed, toggleSidebar, theme, setTheme, currentUserPerfil, setCurrentUserPerfil, currentUser, setCurrentUser } = useApp()
  const router = useRouter()
  
  const { ocorrencias = [], titulos = [], tarefas = [] } = useData()
  // Dados do usuário logado — fallback seguro
  const displayNome = currentUser?.nome ?? 'Usuário'
  const displayCargo = currentUser?.cargo ?? currentUserPerfil
  const displayPerfil = currentUser?.perfil ?? currentUserPerfil
  const displayInitials = displayNome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  const [userProfilePic, setUserProfilePic] = useState<string>('')
  
  useEffect(() => {
    if (!currentUser) return;
    const checkPic = () => {
       try {
         const d = JSON.parse(localStorage.getItem(`edu-profile-extra-${currentUser.id}`) ?? 'null')
         setUserProfilePic(d?.foto || '')
       } catch {}
    }
    checkPic()
    const ival = setInterval(checkPic, 1500)
    return () => clearInterval(ival)
  }, [currentUser])

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const notifDropdown = useDropdown()
  const userDropdown = useDropdown()
  const iaDropdown = useDropdown()

  // Guard: only render dynamic data after client mount (avoids SSR hydration mismatch)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ── Notificações geradas de dados reais ──────────────────────────
  const alertas = [
    ...ocorrencias.filter(o => o.gravidade === 'grave' && !o.ciencia_responsavel).slice(0, 2).map(o => ({
      id: `oc-${o.id}`, lida: false,
      titulo: `Ocorrência grave: ${o.alunoNome}`,
      descricao: o.tipo,
      tempo: o.data,
      href: '/academico/ocorrencias',
    })),
    ...titulos.filter(t => t.status === 'atrasado').slice(0, 2).map(t => ({
      id: `tit-${t.id}`, lida: false,
      titulo: `Título atrasado: ${t.descricao}`,
      descricao: `R$ ${t.valor.toFixed(2)} — ${t.aluno ?? ''}`,
      tempo: t.vencimento,
      href: '/financeiro/inadimplencia',
    })),
    ...tarefas.filter(t => t.prioridade === 'urgente' && t.status !== 'concluida').slice(0, 1).map(t => ({
      id: `tar-${t.id}`, lida: false,
      titulo: `Tarefa urgente: ${t.titulo}`,
      descricao: t.responsavel ?? '',
      tempo: t.prazo ?? '',
      href: '/tarefas',
    })),
  ]

  const unreadCount = alertas.filter(n => !n.lida).length

  // ── Search ───────────────────────────────────────────────────────
  const filteredResults = searchQuery.length > 0
    ? QUICK_LINKS.filter(r =>
      r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sub.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : QUICK_LINKS

  // Fechar search com ESC
  useEffect(() => {
    if (!searchOpen) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [searchOpen])

  // Atalho Cmd/Ctrl + K para abrir search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [])

  const PERFIS = ['Diretor Geral', 'Diretor Pedagógico', 'Coordenador', 'Secretário', 'Professor']

  return (
    <>
      <header className="topbar">
        {/* Left — toggle sidebar */}
        <button onClick={toggleSidebar} className="btn btn-ghost btn-icon" title="Alternar menu">
          <Menu size={18} />
        </button>

        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="btn btn-secondary"
          style={{ gap: 8, paddingLeft: 12, color: 'hsl(var(--text-muted))', fontSize: 13, minWidth: 220, justifyContent: 'flex-start' }}
        >
          <Search size={14} />
          Buscar no sistema...
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 3, alignItems: 'center', fontSize: 11, opacity: 0.6 }}>
            <Command size={11} />K
          </span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn btn-ghost btn-icon"
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* IA Button */}
        <div style={{ position: 'relative' }} ref={iaDropdown.ref}>
          <button
            onClick={() => iaDropdown.setOpen(o => !o)}
            className="btn ia-chip"
            style={{ gap: 6, cursor: 'pointer', border: 'none' }}
          >
            <Brain size={14} />
            Copiloto IA
            <ChevronDown size={12} style={{ transform: iaDropdown.open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>
          {iaDropdown.open && (
            <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: '110%', minWidth: 220, zIndex: 200 }}>
              <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-disabled))', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Assistentes</div>
              {[
                { icon: '🎯', label: 'Copiloto da Direção', sub: 'Visão estratégica' },
                { icon: '💰', label: 'Copiloto Financeiro', sub: 'DRE, fluxo, alertas' },
                { icon: '📚', label: 'Copiloto Pedagógico', sub: 'Desempenho, notas' },
                { icon: '👥', label: 'Copiloto de RH', sub: 'Equipe, folha, ponto' },
                { icon: '📣', label: 'Copiloto de CRM', sub: 'Leads, retenção' },
              ].map(a => (
                <Link key={a.label} href="/ia/copilotos" onClick={() => iaDropdown.setOpen(false)}>
                  <div className="dropdown-item" style={{ gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{a.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--text-primary))' }}>{a.label}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.sub}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div style={{ position: 'relative' }} ref={notifDropdown.ref}>
          <button
            onClick={() => notifDropdown.setOpen(o => !o)}
            className="btn btn-ghost btn-icon"
            style={{ position: 'relative' }}
            title="Notificações"
          >
            <Bell size={18} />
            {mounted && unreadCount > 0 && (
              <span className="notif-dot" style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '2px solid hsl(var(--bg-base))', fontSize: 0 }} />
            )}
          </button>
          {notifDropdown.open && (
            <div style={{ position: 'absolute', right: 0, top: '110%', width: 340, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', zIndex: 200 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Notificações</span>
                {unreadCount > 0
                  ? <span className="badge badge-danger">{unreadCount} novas</span>
                  : <span className="badge badge-success">Sem alertas</span>
                }
              </div>
              <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                {alertas.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                    <CheckCircle size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                    <div style={{ fontSize: 13 }}>Nenhum alerta no momento</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Sistema operando normalmente</div>
                  </div>
                ) : alertas.map(n => (
                  <Link key={n.id} href={n.href} onClick={() => notifDropdown.setOpen(false)}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 12, cursor: 'pointer', background: n.lida ? 'transparent' : 'rgba(59,130,246,0.04)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-hover))')}
                      onMouseLeave={e => (e.currentTarget.style.background = n.lida ? 'transparent' : 'rgba(59,130,246,0.04)')}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.lida ? 'transparent' : '#3b82f6', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{n.titulo}</div>
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{n.descricao}</div>
                        {n.tempo && <div style={{ fontSize: 11, color: 'hsl(var(--text-disabled))', marginTop: 4 }}>{n.tempo}</div>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div style={{ padding: '10px 16px', textAlign: 'center', borderTop: '1px solid hsl(var(--border-subtle))' }}>
                <Link href="/alertas" className="btn btn-ghost btn-sm" style={{ fontSize: 12, width: '100%', justifyContent: 'center' }} onClick={() => notifDropdown.setOpen(false)}>
                  Ver central de alertas
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div style={{ position: 'relative' }} ref={userDropdown.ref}>
          <button
            onClick={() => userDropdown.setOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 10, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {userProfilePic ? (
               // eslint-disable-next-line @next/next/no-img-element
               <img src={userProfilePic} alt={displayNome} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
            ) : (
               <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: 'var(--gradient-purple)', flexShrink: 0 }}>{displayInitials || '?'}</div>
            )}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{displayNome}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{displayPerfil}</div>
            </div>
            <ChevronDown size={13} color="hsl(var(--text-muted))" style={{ transform: userDropdown.open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>
          {userDropdown.open && (
            <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 200, minWidth: 220 }}>
              {/* Perfil info */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{displayNome}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{currentUser?.email ?? ''}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{displayPerfil}</div>
              </div>

              <Link href="/meu-perfil" onClick={() => userDropdown.setOpen(false)}>
                <div className="dropdown-item"><User size={14} />Meu Perfil</div>
              </Link>

              {/* Alternar tema */}
              <div
                className="dropdown-item"
                onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }}
                style={{ cursor: 'pointer' }}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
              </div>

              <div style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />
              <div className="dropdown-item danger" style={{ cursor: 'pointer' }} onClick={() => {
                userDropdown.setOpen(false)
                setCurrentUser(null)
                localStorage.removeItem('edu-current-user')
                router.push('/login')
              }}>
                <LogOut size={14} />Sair
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Search Modal */}
      {searchOpen && (
        <div
          className="modal-overlay"
          onClick={handleSearchClose}
          style={{ alignItems: 'flex-start', paddingTop: '10vh' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 580 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <Search size={18} color="hsl(var(--text-muted))" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar módulos, relatórios, ações..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: 'hsl(var(--text-primary))' }}
              />
              <button onClick={handleSearchClose} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>
            <div style={{ padding: '8px', maxHeight: 400, overflowY: 'auto' }}>
              {filteredResults.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                  Nenhum resultado encontrado para "{searchQuery}"
                </div>
              ) : (
                <>
                  {searchQuery === '' && (
                    <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-disabled))', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Acesso rápido
                    </div>
                  )}
                  {filteredResults.map(r => (
                    <Link key={r.href + r.label} href={r.href} onClick={handleSearchClose}>
                      <div className="dropdown-item" style={{ borderRadius: 8, gap: 12, padding: '10px 12px' }}>
                        <div style={{ width: 28, height: 28, background: 'hsl(var(--bg-overlay))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {r.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--text-primary))' }}>{r.label}</div>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{r.sub}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 16, fontSize: 11, color: 'hsl(var(--text-disabled))' }}>
              <span>↑↓ navegar</span><span>↵ abrir</span><span>ESC fechar</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
