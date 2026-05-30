'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { compressImage } from '@/lib/mediaCompressor'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { 
  LayoutDashboard, 
  BookOpen, 
  Users,
  Bell,
  MessageCircle,
  Inbox,
  Image as ImageIcon,
  Calendar,
  FileText, 
  DollarSign, 
  ClipboardList, 
  Settings, 
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  LogOut,
  Sparkles,
  Sun,
  Moon,
  MessageSquare,
  BarChart2,
  AlertTriangle,
  GraduationCap,
  UserCog,
  Camera,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useApp } from '@/lib/context'
import { UserAvatar } from '@/components/UserAvatar'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/agenda-digital/admin' },
  { id: 'turmas', label: 'Turmas', icon: BookOpen, href: '/agenda-digital/admin/turmas' },
  { id: 'pessoas', label: 'Usuários', icon: Users, href: '/agenda-digital/admin/pessoas' },
  { id: 'comunicados', label: 'Comunicados', icon: Bell, href: '/agenda-digital/admin/comunicados' },

  { id: 'momentos', label: 'Fotos/Vídeos', icon: ImageIcon, href: '/agenda-digital/admin/momentos' },
  { id: 'calendario', label: 'Calendário', icon: Calendar, href: '/agenda-digital/admin/calendario' },
  { id: 'relatorios', label: 'Relatórios/Formulários', icon: FileText, href: '/agenda-digital/admin/relatorios' },
  { id: 'cobrancas', label: 'Cobranças', icon: DollarSign, href: '/agenda-digital/admin/cobrancas' },
  { id: 'ajustes', label: 'Ajustes', icon: Settings, href: '/agenda-digital/admin/ajustes' },
]

export function ADSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser, setCurrentUser, theme, setTheme } = useApp()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { comunicados = [], chatsList = [], momentosFeed = [], messages = {} } = useAgendaDigital()
  const [equipes] = useSupabaseArray<any>('agenda/equipes')

  // Extrair ID do aluno da rota (ex: /agenda-digital/4697/...)
  const segments = pathname.split('/')
  const isSlugPath = segments[1] === 'agenda-digital' && segments[2] && segments[2] !== 'admin' && segments[2] !== 'selecionar-aluno'
  const alunoId = isSlugPath ? segments[2] : ''

  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'

  const [unreadStats, setUnreadStats] = useState({ unreadMural: 0, unreadChat: 0, unreadMomentos: 0, unreadCalendario: 0, unreadOcorrencias: 0, unreadNotas: 0 })
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    
    setIsUploadingPhoto(true)
    try {
      const fileToUpload = await compressImage(file, {
        maxWidth: 300,
        maxHeight: 300,
        quality: 0.85,
        format: 'image/webp'
      });

      const uploadRes = await uploadFileToSupabase({
        bucket: 'comunicados-midia',
        folder: 'avatars',
        file: fileToUpload,
        usageType: 'fixed'
      })

      if (!uploadRes.ok || !uploadRes.url) {
        throw new Error(uploadRes.error || 'Falha no envio da foto.')
      }

      const fotoUrl = uploadRes.url
      
      const updateReq = await fetch('/api/user-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: currentUser.id, fotoUrl })
      })

      if (!updateReq.ok) {
        const updateErr = await updateReq.json().catch(() => ({}))
        throw new Error(updateErr.error || 'Erro ao salvar a foto de perfil.')
      }

      localStorage.setItem(`edu-user-photo-${currentUser.id}`, fotoUrl)
      setCurrentUser({ ...currentUser, foto: fotoUrl })
      
    } catch (err: any) {
      alert('Erro ao atualizar foto: ' + err.message)
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // usando useEffect do top-level (já deve estar importado ou usamos o top level)
  useEffect(() => {
    if (!isFamily || !alunoId || alunoId === 'colaborador') return
    let isMounted = true
    const fetchUnread = async () => {
      try {
        const res = await fetch(`/api/agenda/notificacoes/unread?aluno_id=${alunoId}`)
        const contentType = res.headers.get("content-type");
        if (res.ok && isMounted && contentType?.includes("application/json")) {
          const data = await res.json()
          setUnreadStats(data)
        }
      } catch (e) {}
    }
    fetchUnread()

    const handleUpdate = () => {
      fetchUnread()
    }
    window.addEventListener('agenda-digital:unread-updated', handleUpdate)

    const interval = setInterval(fetchUnread, 30000)
    return () => { 
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('agenda-digital:unread-updated', handleUpdate)
    }
  }, [isFamily, alunoId])

  const getBadgeValue = (id: string) => {
    if (id === 'comunicados') {
      return (comunicados || []).filter(c => c.status === 'rascunho' || c.status === 'agendado').length || undefined
    }

    if (id === 'momentos') {
      return (momentosFeed || []).filter(m => m.status === 'pending').length || undefined
    }
    return undefined
  }

  const isMobile = useIsMobile()

  if (isMobile) {
    let mobileTabs: any[] = []
    
    // On student/family slug paths, always show only family tabs — never admin tabs
    if (!isFamily && !isSlugPath && alunoId !== "colaborador" && !alunoId) {
      mobileTabs = [
        { id: 'dashboard', label: 'Início', icon: LayoutDashboard, href: '/agenda-digital/admin' },
        { id: 'turmas', label: 'Turmas', icon: BookOpen, href: '/agenda-digital/admin/turmas' },
        { id: 'pessoas', label: 'Usuários', icon: Users, href: '/agenda-digital/admin/pessoas' },
        { id: 'comunicados', label: 'comunicados', icon: Bell, href: '/agenda-digital/admin/comunicados' },

        { id: 'momentos', label: 'fotos/vídeos', icon: ImageIcon, href: '/agenda-digital/admin/momentos' },
        { id: 'calendario', label: 'Agenda', icon: Calendar, href: '/agenda-digital/admin/calendario' },
        { id: 'relatorios', label: 'Relatórios', icon: FileText, href: '/agenda-digital/admin/relatorios' },
        { id: 'cobrancas', label: 'Cobranças', icon: DollarSign, href: '/agenda-digital/admin/cobrancas' },
        { id: 'ajustes', label: 'Ajustes', icon: Settings, href: '/agenda-digital/admin/ajustes' }
      ]
    } else if (alunoId) {
      mobileTabs = [
        { id: 'comunicados', label: 'comunicados', icon: Bell, href: `/agenda-digital/${alunoId}/comunicados`, badgeVal: unreadStats.unreadMural || undefined },

        { id: 'momentos', label: 'fotos/vídeos', icon: ImageIcon, href: `/agenda-digital/${alunoId}/momentos`, badgeVal: unreadStats.unreadMomentos || undefined },
        { id: 'calendario', label: 'Agenda', icon: Calendar, href: `/agenda-digital/${alunoId}/calendario`, badgeVal: unreadStats.unreadCalendario || undefined },
        { id: 'financeiro', label: 'Financ', icon: DollarSign, href: `/agenda-digital/${alunoId}/financeiro` },
        { id: 'frequencia', label: 'Frequência', icon: BarChart2, href: `/agenda-digital/${alunoId}/frequencia` },
        { id: 'ocorrencias', label: 'Ocorrências', icon: AlertTriangle, href: `/agenda-digital/${alunoId}/ocorrencias`, badgeVal: unreadStats.unreadOcorrencias || undefined },
        { id: 'notas', label: 'Notas', icon: GraduationCap, href: `/agenda-digital/${alunoId}/notas`, badgeVal: unreadStats.unreadNotas || undefined },
        { id: 'perfil', label: 'Perfil', icon: UserCog, href: `/agenda-digital/${alunoId}/perfil` },
      ].filter(item => {
        if (alunoId === 'colaborador') {
          return ['comunicados', 'fotos/vídeos', 'Agenda', 'Perfil'].includes(item.label)
        }
        return true
      })
    }

    return (
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(10, 12, 26, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        zIndex: 9999,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
      }}>
        {/* Borda Neon Animada */}
        <div className="animated-neon-border" />
        
        
        <div className="no-scrollbar" style={{ 
           display: 'flex', 
           alignItems: 'center', 
           overflowX: 'auto', 
           padding: '12px 16px 8px',
           gap: 4,
           scrollSnapType: 'x mandatory'
        }}>
          {mobileTabs.map((item, idx) => {
            const isActive = pathname === item.href || (item.href !== '/agenda-digital' && pathname.startsWith(item.href))
            const badge = item.badgeVal !== undefined ? item.badgeVal : getBadgeValue(item.id)
            
            return (
              <Link key={idx} href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 76, scrollSnapAlign: 'start' }}>
                <motion.div 
                  whileTap={{ scale: 0.9 }}
                  style={{
                    position: 'relative',
                    width: 48, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 16,
                    background: isActive ? 'rgba(0, 210, 255, 0.15)' : 'transparent',
                    color: isActive ? '#00D2FF' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.3s',
                    boxShadow: isActive ? '0 0 15px rgba(0,210,255,0.2)' : 'none'
                  }}
                >
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} style={{ filter: isActive ? 'drop-shadow(0 0 8px rgba(0, 210, 255, 0.5))' : 'none' }} />
                  {badge && (
                    <div style={{ 
                      position: 'absolute', top: -6, right: 0, 
                      background: 'linear-gradient(135deg, #FF0080, #7928ca)', 
                      color: 'white', fontSize: 10, fontWeight: 800, 
                      padding: '0 5px', borderRadius: 10, 
                      border: '2px solid #0a0c1a', minWidth: 16, textAlign: 'center',
                      boxShadow: '0 0 8px rgba(255,0,128,0.5)'
                    }}>
                      {badge}
                    </div>
                  )}
                </motion.div>
                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? 'white' : 'rgba(255,255,255,0.4)', transition: 'all 0.3s', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

          @keyframes border-sweep {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animated-neon-border {
            position: absolute;
            top: -2px;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #FF0080, #7928CA, #00D2FF, #7928CA, #FF0080);
            background-size: 200% 200%;
            animation: border-sweep 3s linear infinite;
            box-shadow: 0 0 12px rgba(255, 0, 128, 0.6), 0 0 15px rgba(0, 210, 255, 0.5);
            z-index: 10;
          }
        `}} />
      </div>
    )
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 90 : 280 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      style={{
        height: '100vh',
        background: 'linear-gradient(165deg, #0f1129 0%, #060814 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 50,
        overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      {/* GLOW ATMOSPHERE - Matching the image's nebula/cosmic feel */}
      <div style={{ position: 'absolute', top: '-10%', left: '-20%', width: '100%', height: '60%', background: 'radial-gradient(circle, rgba(121, 40, 202, 0.15) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-20%', width: '100%', height: '60%', background: 'radial-gradient(circle, rgba(0, 210, 255, 0.1) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', top: '30%', left: '40%', width: '80%', height: '50%', background: 'radial-gradient(circle, rgba(255, 0, 128, 0.05) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(60px)' }} />
      
      {/* VERY SUBTLE EDGE NEON LIGHT */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 1.5, background: 'linear-gradient(to bottom, transparent, #FF0080, #7928CA, #00D2FF, transparent)', opacity: 0.4 }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header / Logo */}
          <div style={{ padding: '40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14 }}
              >
                <div style={{ position: 'relative', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   {/* Background Glow for Logo */}
                   <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #FF0080, #7928CA)', borderRadius: 14, opacity: 0.3, filter: 'blur(12px)' }} />
                   <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <path d="M10 32L18 8L26 32" stroke="#FF0080" strokeWidth="4.5" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px #FF0080)' }} />
                      <path d="M24 32L32 8L40 32" stroke="#00D2FF" strokeWidth="4.5" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px #00D2FF)' }} />
                   </svg>
                </div>
                <div>
                   <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Colégio</div>
                   <div style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: '0.01em', marginTop: -2 }}>IMPACTO</div>
                </div>
              </motion.div>
            )}
            
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{ 
                width: 40, height: 40, borderRadius: '50%', 
                background: 'rgba(255, 255, 255, 0.08)', 
                border: '1px solid rgba(255, 255, 255, 0.15)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                color: 'white', transition: 'all 0.3s',
                boxShadow: '0 0 20px rgba(0,210,255,0.15)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
            >
              <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }}>
                <ChevronLeft size={20} />
              </motion.div>
            </button>
          </div>

          {/* Navigation */}
          <div style={{ flex: 1, padding: '0 16px', overflowY: 'auto', overflowX: 'hidden' }} className="no-scrollbar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Seção ERP/Admin — hidden on student slug paths; only shown on /agenda-digital/admin/* */}
              {!isFamily && !isSlugPath && alunoId !== "colaborador" && menuItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/agenda-digital' && pathname.startsWith(item.href))
                return (
                  <Link key={item.id} href={item.href} style={{ textDecoration: 'none' }}>
                    <motion.div
                      whileHover={{ x: 6, background: 'rgba(255,255,255,0.04)' }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        padding: isCollapsed ? '12px' : '12px 20px',
                        borderRadius: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        position: 'relative',
                        background: isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                        border: isActive ? '1px solid rgba(121, 40, 202, 0.5)' : '1px solid transparent',
                        color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isActive ? '0 8px 32px rgba(0,0,0,0.3), 0 0 15px rgba(121, 40, 202, 0.2)' : 'none'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isActive ? '#FF0080' : 'inherit',
                        filter: isActive ? 'drop-shadow(0 0 10px #FF0080)' : 'none',
                        position: 'relative'
                      }}>
                        <item.icon size={18} strokeWidth={2} />
                        {/* Dot badge when collapsed */}
                        {getBadgeValue(item.id) && isCollapsed && (
                          <motion.div 
                            style={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #FF0080, #7928ca)',
                            border: '1.5px solid #0f1129',
                            boxShadow: '0 0 6px rgba(255,0,128,0.7)'
                          }} />
                        )}
                      </div>
                      
                      {!isCollapsed && (
                        <span style={{ 
                          fontWeight: 400, 
                          fontSize: 13, 
                          letterSpacing: '0.01em',
                          textTransform: 'uppercase'
                        }}>
                          {item.label}
                        </span>
                      )}

                      {getBadgeValue(item.id) && !isCollapsed && (
                        <motion.div 
                          initial={{ scale: 1 }}
                          style={{ 
                          marginLeft: 'auto', 
                          background: 'linear-gradient(135deg, #7928ca, #FF0080)', 
                          color: 'white', 
                          padding: '2px 10px', 
                          borderRadius: 12, 
                          fontSize: 12, 
                          fontWeight: 800,
                          boxShadow: '0 0 12px rgba(255, 0, 128, 0.5)'
                        }}>
                          {getBadgeValue(item.id)}
                        </motion.div>
                      )}

                      {isActive && !isCollapsed && (
                        <div style={{ marginLeft: getBadgeValue(item.id) ? 8 : 'auto', opacity: 0.4 }}>
                           <ChevronRight size={18} />
                        </div>
                      )}
                    </motion.div>
                  </Link>
                )
              })}

              {/* Nova Seção: Agenda Digital / Portal do Responsável */}
              {alunoId && (
                <>
                  {!isFamily && <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />}
                  {!isCollapsed ? (
                    <div style={{ 
                      fontSize: 10, 
                      fontWeight: 800, 
                      color: 'rgba(255,255,255,0.3)', 
                      letterSpacing: '0.15em', 
                      textTransform: 'uppercase',
                      padding: '8px 20px 4px 20px'
                    }}>
                      Agenda Digital
                    </div>
                  ) : (
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
                  )}

                  {[
                    { 
                      label: 'Comunicados', 
                      href: `/agenda-digital/${alunoId}/comunicados`, 
                      icon: Bell,
                      badge: unreadStats.unreadMural || undefined
                    },

                    { label: 'Fotos/Vídeos', href: `/agenda-digital/${alunoId}/momentos`, icon: ImageIcon, badge: unreadStats.unreadMomentos || undefined },
                    { label: 'Calendário', href: `/agenda-digital/${alunoId}/calendario`, icon: Calendar, badge: unreadStats.unreadCalendario || undefined },
                    { label: 'Financeiro', href: `/agenda-digital/${alunoId}/financeiro`, icon: DollarSign },
                    { label: 'Frequência', href: `/agenda-digital/${alunoId}/frequencia`, icon: BarChart2 },
                    { label: 'Ocorrências', href: `/agenda-digital/${alunoId}/ocorrencias`, icon: AlertTriangle, badge: unreadStats.unreadOcorrencias || undefined },
                    { label: 'Notas', href: `/agenda-digital/${alunoId}/notas`, icon: GraduationCap, badge: unreadStats.unreadNotas || undefined },
                    { label: 'Meu Perfil', href: `/agenda-digital/${alunoId}/perfil`, icon: UserCog },
                  ].filter(item => {
                    if (alunoId === 'colaborador') {
                      return ['Comunicados', 'Fotos/Vídeos', 'Calendário', 'Meu Perfil'].includes(item.label)
                    }
                    return true
                  }).map((item, idx) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                      <Link key={idx} href={item.href} style={{ textDecoration: 'none' }}>
                        <motion.div
                          whileHover={{ x: 6, background: 'rgba(255,255,255,0.04)' }}
                          whileTap={{ scale: 0.98 }}
                          style={{
                            padding: isCollapsed ? '12px' : '12px 20px',
                            borderRadius: 20,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            position: 'relative',
                            background: isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                            border: isActive ? '1px solid rgba(0, 210, 255, 0.5)' : '1px solid transparent',
                            color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: isActive ? '0 8px 32px rgba(0,0,0,0.3), 0 0 15px rgba(0, 210, 255, 0.2)' : 'none'
                          }}
                        >
                          <div style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: isActive ? '#00D2FF' : 'inherit',
                            filter: isActive ? 'drop-shadow(0 0 10px #00D2FF)' : 'none',
                            position: 'relative'
                          }}>
                            <item.icon size={18} strokeWidth={2} />
                            {item.badge && isCollapsed && (
                              <motion.div 
                                style={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #FF0080, #7928ca)',
                                border: '1.5px solid #0f1129',
                                boxShadow: '0 0 6px rgba(255,0,128,0.7)'
                              }} />
                            )}
                          </div>
                          
                          {!isCollapsed && (
                            <span style={{ 
                              fontWeight: 400, 
                              fontSize: 13, 
                              letterSpacing: '0.01em',
                              textTransform: 'uppercase'
                            }}>
                              {item.label}
                            </span>
                          )}

                          {item.badge && !isCollapsed && (
                            <div 
                              style={{ 
                              marginLeft: 'auto', 
                              background: 'linear-gradient(135deg, #7928ca, #00D2FF)', 
                              color: 'white', 
                              padding: '2px 10px', 
                              borderRadius: 12, 
                              fontSize: 12, 
                              fontWeight: 800,
                              boxShadow: '0 0 12px rgba(0, 210, 255, 0.5)'
                            }}>
                              {item.badge}
                            </div>
                          )}

                          {isActive && !isCollapsed && (
                            <div style={{ marginLeft: item.badge ? 8 : 'auto', opacity: 0.4 }}>
                               <ChevronRight size={18} />
                            </div>
                          )}
                        </motion.div>
                      </Link>
                    )
                  })}
                </>
              )}
            </div>
          {/* User Profile / Ações Rápidas Footer */}
          <div style={{ padding: '24px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
            {!isCollapsed ? (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 16,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <div style={{ position: 'relative', width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 21 }}>
                    <UserAvatar 
                      userId={currentUser?.id} 
                      name={currentUser?.nome || 'Usuário'} 
                      fotoUrl={currentUser?.foto}
                      size={54}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', opacity: isUploadingPhoto ? 0.5 : 1 }}
                    />
                    {isUploadingPhoto && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 className="animate-spin" size={14} color="#fff" />
                      </div>
                    )}
                    <label style={{ position: 'absolute', inset: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', opacity: 0, transition: 'opacity 0.2s', borderRadius: '50%' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                      <Camera size={14} color="#fff" />
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={isUploadingPhoto} onChange={handlePhotoUpload} />
                    </label>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.nome || 'Usuário'}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {currentUser?.cargo === 'Aluno' ? 'ALUNO' : (currentUser?.perfil || 'Conta')}
                    </div>
                  </div>
                </div>

                {!isCollapsed && (
                  <button 
                    onClick={async () => {
                      if (typeof window === 'undefined') return;
                      
                      try {
                        const nativePerm = Notification.permission;
                        
                        // 1. Tenta usar OneSignal (se estiver carregado e sem erro de Timeout)
                        const OS = (window as any).OneSignal;
                        if (OS && OS.Notifications) {
                          await OS.Notifications.requestPermission();
                          return;
                        }

                        // 2. Fallback Híbrido: Se OneSignal travou no localhost (Timeout), usa Nativo
                        if (nativePerm === 'default') {
                          await Notification.requestPermission();
                        } else if (nativePerm === 'granted') {
                          alert('✅ Permissão já concedida pelo navegador! Como você está rodando no seu computador (localhost), o OneSignal bloqueia a conexão por segurança (Timeout), mas em produção as mensagens chegarão normalmente!');
                        } else {
                          alert('❌ O Chrome está bloqueando notificações. Clique no cadeado da URL para liberar.');
                        }
                      } catch (e) {
                        console.error('Erro ao pedir permissão de notificação:', e);
                      }
                    }}
                    style={{
                      width: '100%', height: 32, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#60a5fa', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.2s', marginBottom: 8
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)' }}
                  >
                    <Bell size={14} /> Ativar Notificações
                  </button>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  {currentUser?.cargo !== 'Aluno' && (
                    <button 
                      onClick={() => router.push(currentUser?.perfil !== 'Família' && currentUser?.perfil !== 'Responsável' && currentUser?.cargo !== 'Responsável' ? '/login?step=choose_agenda_role' : '/agenda-digital/selecionar-aluno')}
                      style={{
                        flex: 1, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    >
                      <Users size={14} /> Trocar
                    </button>
                  )}
                  <button 
                    onClick={async () => { 
                      localStorage.removeItem('edu-current-user');
                      localStorage.removeItem('edu-current-perfil');
                      await fetch('/api/auth/logout', { method: 'POST' }); 
                      window.location.href = '/login'; 
                    }}
                    style={{
                      flex: 1, height: 32, borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)' }}
                  >
                    <LogOut size={14} /> Sair
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 24 }}>
                  <UserAvatar 
                    userId={currentUser?.id} 
                    name={currentUser?.nome || 'Usuário'} 
                    fotoUrl={currentUser?.foto}
                    size={60}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', opacity: isUploadingPhoto ? 0.5 : 1 }}
                  />
                  {isUploadingPhoto && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 className="animate-spin" size={16} color="#fff" />
                    </div>
                  )}
                  <label style={{ position: 'absolute', inset: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', opacity: 0, transition: 'opacity 0.2s', borderRadius: '50%' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                    <Camera size={16} color="#fff" />
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={isUploadingPhoto} onChange={handlePhotoUpload} />
                  </label>
                </div>
                {currentUser?.cargo !== 'Aluno' && (
                  <button 
                    onClick={() => router.push(currentUser?.perfil !== 'Família' && currentUser?.perfil !== 'Responsável' && currentUser?.cargo !== 'Responsável' ? '/login?step=choose_agenda_role' : '/agenda-digital/selecionar-aluno')}
                    style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}
                  >
                    <Users size={18} />
                  </button>
                )}
                <button 
                  onClick={async () => { 
                    localStorage.removeItem('edu-current-user');
                    localStorage.removeItem('edu-current-perfil');
                    await fetch('/api/auth/logout', { method: 'POST' }); 
                    window.location.href = '/login'; 
                  }}
                  style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer' }}
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>
          </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </motion.aside>
  )
}
