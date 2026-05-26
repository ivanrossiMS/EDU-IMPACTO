'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { SelectedStudentProvider } from '@/lib/selectedStudentContext';

import { useData } from '@/lib/dataContext'
import { useSaida } from '@/lib/saidaContext'
import { useApp } from '@/lib/context'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { getInitials } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useParams } from 'next/navigation'
import React, { use, useState, useEffect } from 'react'
import { 
  Bell, MessageSquare, Image as ImageIcon, Calendar, 
  BarChart2, AlertTriangle, GraduationCap, DollarSign, UserCog, Users, X, LogOut,
  Megaphone, Loader2, CheckCircle2, Building, ShieldCheck
} from 'lucide-react'

function abbreviateName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.slice(1, -1).map(p => {
    if (['de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase())) return p;
    return p.charAt(0).toUpperCase() + '.';
  }).join(' ');
  return `${first} ${middle} ${last}`;
}

function StudentCallButton({ aluno, currentUser }: { aluno: any, currentUser: any }) {
  const { activeCalls, callStudent, cancelCall } = useSaida()
  const [localConfirmed, setLocalConfirmed] = useState(false)
  const call = activeCalls.find(c => c.studentId === aluno.id && c.status !== 'cancelled')

  useEffect(() => {
    if (call?.status === 'confirmed') {
      setLocalConfirmed(true)
      const timer = setTimeout(() => setLocalConfirmed(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [call?.status])

  const isActive = call && (call.status === 'waiting' || call.status === 'called')
  const isBlocked = call?.status === 'blocked'
  const isConfirmed = call?.status === 'confirmed' || localConfirmed

  const handleCall = () => {
    if (isActive || isConfirmed) return
    const gName = currentUser.nome || 'Responsável'
    const gId = currentUser.id || 'usr-fam'
    callStudent(aluno.id, aluno.nome, aluno.turma || '', gId, gName, 'manual', undefined, aluno.foto)
  }

  const baseBtnStyle: React.CSSProperties = {
    height: 56,
    borderRadius: 24,
    fontWeight: 800,
    fontSize: 16,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    whiteSpace: 'nowrap',
    width: '100%',
    padding: '0 24px',
    fontFamily: 'Outfit, Inter, sans-serif',
  }

  if (!call && !localConfirmed) {
    return (
      <button 
        className="ad-premium-cta-btn"
        onClick={handleCall}
        style={{
          ...baseBtnStyle,
          background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
          color: 'white',
          boxShadow: '0 12px 28px rgba(99,102,241,0.25)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 16px 36px rgba(99,102,241,0.35)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 12px 28px rgba(99,102,241,0.25)'
        }}
      >
        <Megaphone size={18} style={{ strokeWidth: 2.2 }} />
        <span className="ad-call-btn-label">Chamar Aluno</span>
        <span className="ad-call-btn-arrow" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', opacity: 0.8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </span>
      </button>
    )
  }

  const formatTime = (isoStr?: string) => {
    if (!isoStr) return ''
    try {
      return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  if (isActive) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          ...baseBtnStyle,
          background: 'linear-gradient(45deg, #f59e0b, #fbbf24, #f59e0b)',
          backgroundSize: '200% 200%',
          border: 'none',
          color: 'white',
          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
          cursor: 'default',
          animation: 'shimmerYellow 2s linear infinite',
          padding: '0 16px',
        }}>
          <Loader2 size={20} className="spin-anim" style={{ flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, overflow: 'hidden' }}>
            <span className="ad-call-btn-label" style={{ lineHeight: 1.2 }}>Chamando Aluno</span>
            <span style={{ fontSize: 10, opacity: 0.9, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left' }}>
              por {call?.guardianName} às {formatTime(call?.calledAt)}
            </span>
          </div>
        </div>
        <button 
          onClick={() => cancelCall(call.id)}
          title="Cancelar chamada"
          style={{
            width: 56, height: 56, borderRadius: 24, cursor: 'pointer',
            background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
        >
          <X size={24} />
        </button>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin-anim { 100% { transform: rotate(360deg); } }
          .spin-anim { animation: spin-anim 1s linear infinite; }
          @keyframes shimmerYellow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}} />
      </div>
    )
  }

  if (isBlocked) {
    return (
      <div style={{
        ...baseBtnStyle,
        background: 'rgba(239, 68, 68, 0.08)',
        border: '2px solid rgba(239, 68, 68, 0.3)',
        color: '#ef4444',
        cursor: 'default'
      }}>
        <AlertTriangle size={18} />
        <span className="ad-call-btn-label">Acesso Bloqueado</span>
      </div>
    )
  }

  return (
    <div style={{
      ...baseBtnStyle,
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      boxShadow: '0 12px 28px rgba(16,185,129,0.25)',
      animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      padding: '0 16px',
    }}>
      <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, overflow: 'hidden' }}>
        <span className="ad-call-btn-label" style={{ lineHeight: 1.2 }}>Saída Confirmada!</span>
        <span style={{ fontSize: 10, opacity: 0.9, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left' }}>
          Retirado {call?.guardianName ? `por ${call.guardianName} ` : ''}às {call?.confirmedAt ? formatTime(call.confirmedAt) : formatTime(new Date().toISOString())}
        </span>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes popIn { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}} />
    </div>
  )
}

export default function AgendaDigitalFamilyLayout({ 
  children,
  params 
}: { 
  children: React.ReactNode, 
  params: Promise<{ slug: string }>
}) {
  const [profileData, setProfileData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const { turmas = [] } = useData();
  const { adConfig, setAdLoading } = useAgendaDigital();
  const { currentUser, hydrated, setCurrentUser } = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const paramsHook = useParams<{ slug: string }>()
  const resolvedParams = paramsHook || (params as any)

  const respId = (currentUser as any)?.responsavel_id || (currentUser as any)?.dados?.responsavel_id || (currentUser as any)?.user_metadata?.responsavel_id || currentUser?.id || ''
  const isAlunoLogado = currentUser?.cargo === 'Aluno'

  useEffect(() => {
     if (!hydrated || !currentUser) return
     if (!resolvedParams?.slug) return

     if (isAlunoLogado) {
        const directId = (currentUser as any).aluno_id || (currentUser as any).user_metadata?.aluno_id
        if (directId && String(resolvedParams.slug) !== String(directId)) {
          const currentPath = pathname || ''
          const newPath = currentPath.replace(`/agenda-digital/${resolvedParams.slug}`, `/agenda-digital/${directId}`)
          router.replace(newPath)
          return
        }
     }

     setIsLoading(true)
     const loadProfile = async () => {
        try {
           const res = await fetch(`/api/agenda/perfil-acesso?slug=${resolvedParams.slug}&responsavel_id=${respId}&is_aluno_profile=${isAlunoLogado}`)
           const data = await res.json()
           if (res.ok) {
              setProfileData(data)
           } else {
              console.error(data.error)
           }
        } catch(e) {
           console.error(e)
        } finally {
           setIsLoading(false)
        }
     }
     loadProfile()
  }, [hydrated, currentUser, resolvedParams?.slug, respId, isAlunoLogado, pathname, router])

  useEffect(() => {
    if (setAdLoading) setAdLoading(isLoading);
    return () => { if (setAdLoading) setAdLoading(false); }
  }, [isLoading, setAdLoading]);

  const aluno = profileData?.aluno || null
  const vinculo = profileData?.vinculo || null
  const meusAlunos = profileData?.meusAlunos || []

  const cleanTurma = (() => {
    if (!aluno) return 'S/T'
    // 1. Tenta usar o nome já resolvido pela API de perfil
    if (aluno.turma_nome && aluno.turma_nome !== aluno.turma) {
      return aluno.turma_nome.split('-')[0].trim()
    }
    // 2. Fallback para o turmas em cache
    const turmaObj = (turmas || []).find(t => String(t.id) === String(aluno.turma) || String(t.codigo) === String(aluno.turma) || String(t.nome) === String(aluno.turma))
    const nomeTurma = turmaObj?.nome || aluno.turma_nome || aluno.turma || 'S/T'
    return nomeTurma.split('-')[0].trim()
  })()

  const cleanTurno = (() => {
    if (!aluno) return 'Vespertino'
    if (aluno.turno_nome) return aluno.turno_nome
    if (aluno.turno && aluno.turno.trim() !== '') return aluno.turno
    const turmaObj = (turmas || []).find(t => String(t.id) === String(aluno.turma) || String(t.codigo) === String(aluno.turma) || String(t.nome) === String(aluno.turma))
    return turmaObj?.turno || 'Vespertino'
  })()

  const userAccessRole = React.useMemo(() => {
    if (currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Gestor' || currentUser?.perfil === 'Direção' || currentUser?.perfil === 'Secretaria') {
      return { isFin: true, isPed: true, parentesco: currentUser.perfil }
    }
    if (!vinculo) return { isFin: false, isPed: false, parentesco: 'Responsável' }
    return {
      isFin: !!vinculo.resp_financeiro,
      isPed: !!vinculo.resp_pedagogico,
      parentesco: vinculo.parentesco || 'Responsável'
    }
  }, [vinculo, currentUser])
  const navItems = [
    { label: 'Comunicados', href: `/agenda-digital/${aluno?.id}/comunicados`, icon: <Bell size={18} /> },
    { label: 'Mensagens', href: `/agenda-digital/${aluno?.id}/conversas`, icon: <MessageSquare size={18} /> },
    { label: 'Fotos/Vídeos', href: `/agenda-digital/${aluno?.id}/momentos`, icon: <ImageIcon size={18} /> },
    { label: 'Calendário', href: `/agenda-digital/${aluno?.id}/calendario`, icon: <Calendar size={18} /> },
    { label: 'Financeiro', href: `/agenda-digital/${aluno?.id}/financeiro`, icon: <DollarSign size={18} /> },
    { label: 'Frequência', href: `/agenda-digital/${aluno?.id}/frequencia`, icon: <BarChart2 size={18} /> },
    { label: 'Ocorrências', href: `/agenda-digital/${aluno?.id}/ocorrencias`, icon: <AlertTriangle size={18} /> },
    { label: 'Notas', href: `/agenda-digital/${aluno?.id}/notas`, icon: <GraduationCap size={18} /> },
    { label: 'Meu Perfil', href: `/agenda-digital/${aluno?.id}/perfil`, icon: <UserCog size={18} /> },
  ]

  const filteredNavItems = navItems.filter(item => {
    if (item.label === 'Frequência' && adConfig?.permissoes?.visualizarFrequencia === false) return false
    if (item.label === 'Ocorrências' && adConfig?.permissoes?.visualizarOcorrencias === false) return false
    if (item.label === 'Notas' && adConfig?.permissoes?.visualizarNotas === false) return false
    if (item.label === 'Financeiro' && adConfig?.permissoes?.visualizarFinanceiro === false) return false
    return true
  })

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        width: '100%',
        gap: '24px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin-gradient {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse-glow {
            0%, 100% { opacity: 0.7; transform: scale(0.96); filter: drop-shadow(0 0 12px rgba(0, 210, 255, 0.3)); }
            50% { opacity: 1; transform: scale(1.04); filter: drop-shadow(0 0 25px rgba(121, 40, 202, 0.6)); }
          }
          .loader-ring {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            padding: 4px;
            background: linear-gradient(135deg, #00D2FF, #7928CA, #FF0080);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            animation: spin-gradient 1.2s linear infinite;
          }
          .pulse-logo {
            animation: pulse-glow 2s ease-in-out infinite;
          }
        `}} />
        
        <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Animated gradient spinning loader ring */}
          <div className="loader-ring" style={{ position: 'absolute' }} />
          
          {/* Pulsing inner glow logo / icon */}
          <div className="pulse-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D2FF' }}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <path d="M10 32L18 8L26 32" stroke="#FF0080" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M24 32L32 8L40 32" stroke="#00D2FF" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        
        <p style={{
          fontSize: '15px',
          fontWeight: 600,
          background: 'linear-gradient(135deg, #ffffff, rgba(255,255,255,0.7))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          margin: 0
        }}>
          Carregando Agenda...
        </p>
      </div>
    )
  }

  if (!aluno) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        width: '100%',
        gap: '24px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin-gradient {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .loader-ring {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            padding: 4px;
            background: linear-gradient(135deg, #00D2FF, #7928CA, #FF0080);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            animation: spin-gradient 1.2s linear infinite;
          }
        `}} />
        
        <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loader-ring" style={{ position: 'absolute' }} />
        </div>
        
        <p style={{
          fontSize: '15px',
          fontWeight: 600,
          background: 'linear-gradient(135deg, #ffffff, rgba(255,255,255,0.7))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          margin: 0
        }}>
          Carregando Agenda...
        </p>
      </div>
    )
  }

  return (
    <>
    <AnimatePresence>
{/* Student Switcher Overlay */}
    {switcherOpen && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0,
        width: '100vw', bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSwitcherOpen(false)}>
        <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="ad-modal-container" style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800 }}>Trocar de Aluno</h3>
            <button onClick={() => setSwitcherOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {meusAlunos.map((a: any) => (
              <div key={a.id} className="ad-switcher-item" onClick={() => {
                const newPath = pathname.replace(aluno.id, a.id)
                router.push(newPath)
                setSwitcherOpen(false)
              }} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 12, border: `1px solid ${a.id === aluno.id ? 'hsl(var(--primary))' : 'hsl(var(--border-subtle))'}`, background: a.id === aluno.id ? 'rgba(99,102,241,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                 <div className="avatar" style={{ width: 48, height: 48, fontSize: 18, background: 'var(--gradient-purple)', color: 'white' }}>
                    {getInitials(a.nome)}
                  </div>
                  <div>
                    <div className="ad-switcher-item-name" style={{ fontWeight: 700, color: 'hsl(var(--text-main))' }}>{a.nome}</div>
                    {(() => {
                      const turmaObj = turmas.find(t => String(t.id) === String(a.turma) || String(t.codigo) === String(a.turma) || String(t.nome) === String(a.turma))
                      const nomeTurma = turmaObj?.nome || a.turma || 'S/T'
                      return (
                        <div className="ad-switcher-item-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Turma {nomeTurma}</div>
                      )
                    })()}
                  </div>
              </div>
            ))}
          </div>
        </motion.div>
      
</motion.div>
)}</AnimatePresence>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ad-main-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0px;
          align-items: start;
          position: relative;
          z-index: 2;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.9); }
          50% { opacity: 0.95; transform: scale(1.15); }
        }
        @keyframes floatPlanet1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-10px, -15px) rotate(12deg); }
        }
        @keyframes floatPlanet2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(12px, 10px) rotate(-8deg); }
        }

        .ad-premium-card-wrapper {
          margin-top: -16px;
          position: relative;
          z-index: 1;
          width: 100%;
        }

        .ad-premium-card {
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 12px 40px rgba(15, 12, 36, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.04);
          padding: 24px 32px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 24px;
          align-items: center;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .ad-premium-card:hover {
          transform: translateY(-5px) scale(1.005);
          box-shadow: 0 30px 60px rgba(99, 102, 241, 0.12), 0 10px 20px rgba(0, 0, 0, 0.04);
          border-color: rgba(99, 102, 241, 0.2);
        }

        @keyframes neonSlide {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .ad-premium-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #3b82f6, #6366f1);
          background-size: 200% 100%;
          animation: neonSlide 3s linear infinite;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.6), inset 0 0 8px rgba(99, 102, 241, 0.4);
        }

        .ad-mini-cards-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }

        .ad-mini-card {
          background: #f8fafc;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ad-mini-card:hover {
          background: #ffffff;
          border-color: rgba(99,102,241,0.22);
          box-shadow: 0 8px 20px rgba(99,102,241,0.06);
          transform: translateY(-2px);
        }

        .ad-right-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ad-btn-side {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          height: 30px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          justify-content: center;
          font-family: 'Outfit', sans-serif;
        }

        .ad-btn-side:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }

        .ad-btn-side.logout {
          border-color: #fecaca;
          color: #ef4444;
        }

        .ad-btn-side.logout:hover {
          background: #fef2f2;
          border-color: #fca5a5;
          color: #dc2626;
        }

        @media (max-width: 1200px) {
          .ad-premium-card {
            grid-template-columns: 1fr;
            gap: 28px;
          }
          .ad-middle-section {
            border-left: none !important;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
            padding-left: 0 !important;
            padding-top: 28px;
          }
        }
        
        @media (max-width: 640px) {
          .ad-premium-card-wrapper {
            margin-top: 0 !important;
          }
          .ad-premium-card {
            padding: 16px 12px !important;
            border-radius: 20px !important;
            gap: 16px !important;
            position: relative !important;
            overflow: visible !important;
          }
          .ad-premium-hero {
            padding: 32px 16px 90px 16px;
            border-radius: 24px;
          }
          .ad-premium-card-avatar {
            width: 86px !important;
            height: 86px !important;
            border-radius: 20px !important;
          }
          .ad-premium-student-name {
            font-size: 16px !important;
            white-space: nowrap !important;
            max-width: 100% !important;
            display: flex !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
            gap: 8px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .ad-premium-card-header-flex {
            gap: 12px !important;
          }
          .ad-badge-fin, .ad-badge-ped {
            display: none !important;
          }
          .ad-mini-cards-grid {
            display: flex !important;
            flex-wrap: nowrap !important;
            gap: 4px !important;
            overflow-x: auto !important;
            padding-bottom: 2px !important;
          }
          .ad-mini-card {
            display: flex !important;
            flex-direction: column !important;
            padding: 6px !important;
            gap: 2px !important;
            align-items: center !important;
            flex: 1 !important;
            min-width: 0 !important;
            overflow: hidden !important;
          }
          .ad-mini-card-icon-desktop {
            display: none !important;
          }
          .ad-mini-card-icon-mobile {
            display: inline-flex !important;
          }
          .ad-mini-card-label {
            font-size: 10px !important;
            margin-bottom: 0 !important;
            width: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
          }
          .ad-mini-card-value {
            width: 100% !important;
            font-size: 10px !important;
            text-align: center !important;
            justify-content: center !important;
          }
          .ad-badge-parentesco {
            display: none !important;
          }
          .ad-right-section {
            position: absolute !important;
            top: -46px !important;
            right: 8px !important;
            min-width: 0 !important;
            width: auto !important;
            margin-top: 0 !important;
            z-index: 100 !important;
            height: auto !important;
            justify-content: flex-start !important;
          }
          .ad-premium-cta-btn, .ad-right-section > div > div {
            height: 34px !important;
            font-size: 11px !important;
            padding: 0 12px !important;
            border-radius: 12px !important;
          }
          .ad-call-btn-arrow {
            display: none !important;
          }
          .ad-com-actions-deprecated {
            display: none !important;
          }
          .ad-text-hide-mobile {
            display: none !important;
          }
          .ad-call-btn-label {
            font-size: 10px !important;
            white-space: nowrap !important;
          }
          .ad-premium-student-name {
            padding-right: 0px !important;
            font-size: 18px !important;
          }
          .ad-mini-cards-grid {
            flex-wrap: nowrap !important;
            gap: 4px !important;
            justify-content: space-between !important;
            width: 100% !important;
            margin-top: 4px !important;
          }
          .ad-mini-card {
            padding: 6px !important;
            gap: 4px !important;
            border-radius: 8px !important;
            flex: 1 !important;
            min-width: 0 !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
          }
          .ad-mini-card > div:first-child {
            width: 20px !important;
            height: 20px !important;
          }
          .ad-mini-card > div:first-child svg {
            width: 10px !important;
            height: 10px !important;
          }
          .ad-mini-card-label {
            font-size: 7px !important;
            margin-bottom: 0 !important;
          }
          .ad-mini-card-value {
            font-size: 9px !important;
            flex-direction: column !important;
            gap: 2px !important;
          }
          .ad-mini-card-value span {
            font-size: 7px !important;
            padding: 1px 4px !important;
          }
        }
        .ad-student-banner {
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 16px;
          padding: 24px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }
        .ad-banner-actions {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .ad-mobile-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ad-desktop-sidebar {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ad-mobile-nav-bar {
          display: none;
        }

        /* iOS App Store Compliance for Agenda Digital */
        .ad-mobile-nav-bar, .ad-premium-card, .ad-switcher-item, .ad-btn-side, .ad-mini-card, .ad-mobile-nav-item {
          user-select: none !important;
          -webkit-user-select: none !important;
          -webkit-touch-callout: none !important;
        }

        /* Somente Modificacoes Mobile, intocavel no Desktop */
        @media (max-width: 768px) {
          .ad-desktop-sidebar {
            display: none !important;
          }
          .ad-mobile-nav-bar {
            display: flex !important;
            background: linear-gradient(135deg, #07060f 0%, #15092a 50%, #020106 100%) !important;
            background-size: 200% 200% !important;
            animation: gradientShiftNav 6s ease infinite !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
            box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
          }
          
          .ad-mobile-nav-bar::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #00d2ff, #a855f7, #ff0080, #00d2ff);
            background-size: 200% 100%;
            animation: neonSlide 3s linear infinite;
            box-shadow: 0 0 12px rgba(0, 210, 255, 0.8), 0 0 4px rgba(255, 0, 128, 0.5);
            z-index: 10000;
          }

          @keyframes gradientShiftNav {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .ad-content-page-area {
            padding-bottom: 80px !important;
            width: 100% !important;
            max-width: 100vw !important;
            min-width: 0 !important;
            overflow-x: hidden !important;
            box-sizing: border-box !important;
          }
          .ad-main-grid {
            grid-template-columns: 1fr !important;
            gap: 0px !important;
            width: 100% !important;
            max-width: 100vw !important;
            min-width: 0 !important;
            overflow-x: hidden !important;
          }
          .ad-premium-card-wrapper {
            width: 100% !important;
            max-width: 100vw !important;
            min-width: 0 !important;
            overflow-x: hidden !important;
          }
          .ad-banner {
            height: 250px !important;
          }
          .agenda-digital-wrapper {
            padding-bottom: 80px !important;
            background: #ffffff !important;
            width: 100% !important;
            max-width: 100vw !important;
            min-width: 0 !important;
            overflow-x: hidden !important;
          }
          .ad-student-banner {
            flex-direction: column !important;
            align-items: center !important;
            padding: 0 16px 0 16px !important;
            gap: 4px !important;
            border: none !important;
            border-radius: 0 !important;
            border-bottom: none !important;
            background: transparent !important;
            margin-top: 0 !important;
            box-shadow: none !important;
            position: relative;
            z-index: 20;
          }
          @keyframes popUpPulseAvatar {
            0% { transform: scale(0.5) translateY(20px); opacity: 0; box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
            70% { transform: scale(1.05) translateY(-2px); opacity: 1; }
            100% { transform: scale(1) translateY(0); opacity: 1; box-shadow: 0 0 0 12px rgba(79, 70, 229, 0); }
          }
          @keyframes premiumFloat {
            0% { transform: translateY(0px); box-shadow: 0 4px 12px rgba(0,0,0,0.1), 0 0 0 0 rgba(79, 70, 229, 0.3); }
            50% { transform: translateY(-4px); box-shadow: 0 8px 16px rgba(0,0,0,0.15), 0 0 0 8px rgba(79, 70, 229, 0); }
            100% { transform: translateY(0px); box-shadow: 0 4px 12px rgba(0,0,0,0.1), 0 0 0 0 rgba(79, 70, 229, 0); }
          }
          .ad-banner-avatar-wrapper {
            margin-top: -40px !important;
            border: 3px solid #ffffff !important;
            width: 64px !important;
            height: 64px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
            background: #ffffff !important;
            animation: popUpPulseAvatar 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, premiumFloat 4s ease-in-out infinite 0.8s !important;
          }
          .ad-banner-left {
            width: 100% !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            gap: 4px !important;
          }
          .ad-student-name {
            font-size: 16px !important;
            line-height: 1.2 !important;
            white-space: normal !important;
            font-weight: 800 !important;
          }
          .ad-student-details {
            font-size: 11px !important;
            line-height: 1.2 !important;
          }
          .ad-banner-actions {
            width: 100% !important;
            flex-direction: column !important;
            align-items: center !important;
            border: 1px solid rgba(0,0,0,0.06) !important;
            border-radius: 12px !important;
            background: linear-gradient(180deg, #ffffff, rgba(99,102,241,0.04)) !important;
            padding: 12px 14px !important;
            margin-top: 4px !important;
            gap: 10px !important;
            text-align: center !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.03) !important;
          }
          .ad-banner-actions .btn {
            height: 26px !important;
            min-height: 26px !important;
            font-size: 10px !important;
            border-radius: 6px !important;
            padding: 0 12px !important;
          }
          .ad-banner-actions .btn svg {
            width: 14px !important;
            height: 14px !important;
          }
          .ad-banner-actions-right {
            align-items: center !important;
            text-align: center !important;
          }
          .ad-banner-actions-right > div:first-child {
            font-size: 8px !important;
            margin-bottom: 0 !important;
            letter-spacing: 0.5px !important;
          }
          .ad-banner-actions-right > div:nth-child(2) {
            font-size: 11px !important;
            margin-bottom: 4px !important;
          }
          .ad-banner-actions-right span {
            font-size: 9px !important;
            padding: 2px 6px !important;
          }
          .ad-banner-btn-group {
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 10px !important;
            margin-top: 0 !important;
            width: 100% !important;
          }
          .ad-banner-btn-group button {
            height: 24px !important;
            min-height: 24px !important;
            font-size: 10px !important;
            padding: 0 8px !important;
            flex: 1;
            border-radius: 6px !important;
          }
          .ad-banner-btn-group button svg {
            width: 12px !important;
            height: 12px !important;
          }
          .ad-chamar-btn {
            height: 38px !important;
            min-height: 38px !important;
            font-size: 13px !important;
            padding: 0 16px !important;
            white-space: normal !important;
            text-align: center !important;
            line-height: 1.2 !important;
            border-radius: 12px !important;
          }
          .ad-chamar-btn svg {
            width: 16px !important;
            height: 16px !important;
          }
          .ad-page-header h2 {
            font-size: 18px !important;
            margin-bottom: 0px !important;
          }
          .ad-page-header .form-input, .ad-page-header .btn {
            height: 40px !important;
            min-height: 40px !important;
            font-size: 14px !important;
            padding: 0 14px !important;
          }
          .ad-page-header .form-input {
            width: 200px !important;
            padding-left: 36px !important;
          }
          .ad-modal-container {
            padding: 20px !important;
            border-radius: 16px !important;
            width: 95% !important;
          }
          .ad-modal-container h2, .ad-modal-container h3 {
            font-size: 18px !important;
            margin-bottom: 12px !important;
            line-height: 1.2 !important;
          }
          .ad-modal-container h4 {
            font-size: 11px !important;
            margin-bottom: 10px !important;
          }
          .ad-modal-container .ad-body-text {
            font-size: 13px !important;
            line-height: 1.5 !important;
          }
          .ad-switcher-item {
            padding: 12px !important;
            gap: 12px !important;
          }
          .ad-switcher-item .avatar {
            width: 36px !important;
            height: 36px !important;
            font-size: 14px !important;
          }
          .ad-switcher-item-name {
            font-size: 14px !important;
          }
          .ad-switcher-item-desc {
            font-size: 11px !important;
          }
          .ad-attachment-item {
            padding: 10px 12px !important;
          }
          .ad-attachment-item .avatar {
            width: 32px !important;
            height: 32px !important;
          }
          .ad-attachment-item .avatar svg {
            width: 16px !important;
            height: 16px !important;
          }
          .ad-modal-container .btn {
            font-size: 11px !important;
            padding: 6px 12px !important;
            height: 32px !important;
          }
          .ad-event-datebox {
            width: 70px !important;
            padding: 12px 8px !important;
          }
          .ad-event-month {
            font-size: 11px !important;
          }
          .ad-event-day {
            font-size: 24px !important;
          }
          .ad-event-details {
            padding: 12px 14px !important;
          }
          .ad-event-title {
            font-size: 14px !important;
            line-height: 1.2 !important;
          }
          .ad-event-type {
            font-size: 9px !important;
            padding: 2px 6px !important;
          }
          .ad-event-meta {
            gap: 12px !important;
            font-size: 11px !important;
            margin-top: 8px !important;
          }
          .ad-event-meta svg {
            width: 12px !important;
            height: 12px !important;
          }
          .ad-event-header-row {
            gap: 8px !important;
          }
          .ad-calendar-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
            margin-bottom: 16px !important;
            padding-left: 12px !important;
          }
          .ad-calendar-header h2 {
            font-size: 28px !important;
            line-height: 1.2 !important;
          }
          .ad-calendar-badge {
            font-size: 13px !important;
            padding: 4px 12px !important;
            border-radius: 12px !important;
          }
          .ad-chat-container {
            height: calc(100vh - 120px) !important;
            flex-direction: column !important;
            position: relative !important;
          }
          .ad-chat-sidebar {
            width: 100% !important;
            border-right: none !important;
            padding: 0 !important;
          }
          .ad-chat-main {
            width: 100% !important;
            border-right: none !important;
          }
          .ad-chat-sidebar.mobile-hidden, .ad-chat-main.mobile-hidden {
            display: none !important;
          }
          .mobile-back-btn {
            display: flex !important;
          }
          .ad-chat-sidebar > div:first-child {
            padding: 16px !important;
          }
          .ad-chat-sidebar h2 {
            font-size: 20px !important;
          }
          .ad-chat-sidebar .form-input {
            height: 36px !important;
          }
          .ad-nova-conversa-wrapper {
            padding: 16px !important;
          }
          .ad-nova-conversa-header {
            padding: 0px !important;
            margin-bottom: 20px !important;
          }
          .ad-nova-conversa-titlebox h2 {
            font-size: 20px !important;
          }
          .ad-chat-header {
            padding: 12px 16px !important;
          }
          .ad-chat-header .ad-chat-header-avatar {
            width: 40px !important;
            height: 40px !important;
            font-size: 16px !important;
          }
          .ad-chat-header h2, .ad-chat-header div[style*="fontWeight: 800"] {
            font-size: 16px !important;
          }
          .ad-chat-bubble {
            padding: 12px 16px !important;
          }
          .ad-chat-bubble-text {
            font-size: 14px !important;
          }
          .ad-chat-input-area {
            padding: 12px 16px !important;
          }
          .ad-chat-input-area .form-input {
            height: 44px !important;
            font-size: 14px !important;
          }
          .ad-chat-input-area .btn {
            width: 44px !important;
            height: 44px !important;
          }
          .ad-frequencia-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            padding-left: 12px !important;
          }
          .ad-freq-card {
            padding: 16px !important;
          }
          .ad-freq-label {
            font-size: 11px !important;
            margin-bottom: 4px !important;
          }
          .ad-freq-number {
            font-size: 32px !important;
          }
          .ad-freq-desc {
            font-size: 11px !important;
            margin-top: 0px !important;
          }
          .ad-freq-chart-card {
            padding: 16px !important;
            margin-bottom: 20px !important;
          }
          .ad-freq-hist-header {
            padding: 16px !important;
          }
          .ad-freq-hist-item {
            padding: 12px 16px !important;
            flex-wrap: wrap !important;
            gap: 12px !important;
          }
          .ad-freq-hist-item .avatar {
            padding: 6px !important;
          }
          .ad-freq-hist-item .avatar svg {
            width: 16px !important;
            height: 16px !important;
          }
          .ad-freq-hist-title {
            font-size: 14px !important;
          }
          .ad-freq-hist-desc {
            font-size: 11px !important;
          }
          .ad-ocorrencias-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            padding-left: 12px !important;
          }
          .ad-oco-list {
            gap: 16px !important;
          }
          .ad-oco-card {
            padding: 16px !important;
            gap: 12px !important;
          }
          .ad-oco-icon {
            width: 36px !important;
            height: 36px !important;
          }
          .ad-oco-icon svg {
            width: 18px !important;
            height: 18px !important;
          }
          .ad-oco-title-box {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 4px !important;
          }
          .ad-oco-title {
            font-size: 15px !important;
            line-height: 1.3 !important;
          }
          .ad-oco-desc {
            font-size: 13px !important;
          }
          .ad-oco-assinatura-box {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            padding: 12px !important;
          }
          .ad-oco-assinatura-btn {
            width: 100% !important;
          }
          .ad-notas-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            padding-left: 12px !important;
            margin-bottom: 16px !important;
          }
          .ad-notas-media-number {
            font-size: 36px !important; /* Was 48px */
          }
          .ad-notas-grid {
            grid-template-columns: 1fr !important;
            width: 100% !important;
            min-width: 0 !important;
            gap: 12px !important;
            margin-bottom: 16px !important;
          }
          .ad-notas-global-card, .ad-notas-avalia-card, .ad-notas-table-card {
            padding: 12px !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
          }
          .ad-notas-ava-item {
            padding: 10px !important;
            gap: 8px !important;
          }
          .ad-notas-ava-date {
            width: 36px !important;
            height: 36px !important;
          }
          .ad-notas-ava-date span:first-child {
            font-size: 10px !important;
          }
          .ad-notas-ava-date span:last-child {
            font-size: 15px !important;
          }
          .ad-notas-ava-title {
            font-size: 13px !important;
          }
          .ad-notas-ava-desc {
            font-size: 11px !important;
          }
          .ad-notas-ava-badge {
            font-size: 9px !important;
            padding: 2px 4px !important;
            height: auto !important;
            align-self: flex-start !important;
          }
          .ad-notas-table-title {
            padding: 12px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .ad-notas-table-title h3 {
            font-size: 14px !important;
          }
          .ad-notas-table-title select {
            width: 100% !important;
          }
          .ad-notas-table-wrapper {
            max-width: 100vw !important;
            width: 100% !important;
            display: block !important;
          }
          .ad-notas-avalia-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            margin-bottom: 12px !important;
          }
          .ad-notas-avalia-header h3 {
            font-size: 15px !important;
          }
          .ad-notas-th {
            padding: 8px 12px !important;
            font-size: 10px !important;
            white-space: nowrap !important;
          }
          .ad-notas-td {
            padding: 10px 12px !important;
          }
          .ad-notas-td-title {
            font-size: 13px !important;
            white-space: nowrap !important;
          }
          .ad-notas-td-grade {
            width: 32px !important;
            height: 32px !important;
            font-size: 13px !important;
            border-radius: 8px !important;
          }
          .ad-notas-prog-box {
            gap: 8px !important;
          }
          .ad-notas-status {
            font-size: 10px !important;
            width: auto !important;
          }
          /* FINANCEIRO */
          .ad-fin-hero {
            padding: 20px !important;
          }
          .ad-fin-hero-title {
            font-size: 18px !important;
          }
          .ad-fin-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .ad-fin-tabs-wrapper {
            flex-direction: column !important;
            align-items: flex-start !important;
            margin-bottom: 16px !important;
          }
          .ad-fin-tabs {
            gap: 16px !important;
            overflow-x: auto !important;
            max-width: 100% !important;
            padding-bottom: 4px !important;
          }
          .ad-fin-tabs::-webkit-scrollbar {
            display: none !important;
          }
          .ad-fin-card {
            padding: 16px !important;
          }
          .ad-fin-card-header {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .ad-fin-card-title-box {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
          }
          /* PERFIL */
          .ad-perfil-grid {
            grid-template-columns: 1fr !important;
          }
          .ad-perfil-card {
            padding: 16px !important;
          }
          .ad-perfil-card-header {
            margin-bottom: 12px !important;
          }
          .ad-perfil-resp-card {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .ad-perfil-resp-info {
            width: 100% !important;
          }
          .ad-mobile-nav {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            flex-direction: row !important;
            justify-content: flex-start !important;
            overflow-x: auto !important;
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(10px) !important;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.06) !important;
            border-top: 1px solid rgba(0,0,0,0.05) !important;
            padding: 8px 16px 24px 16px !important;
            margin: 0 !important;
            height: 76px !important;
            z-index: 9999 !important;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          .ad-mobile-nav::-webkit-scrollbar {
            display: none;
          }
          .ad-mobile-nav-item {
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 4px !important;
            padding: 4px !important;
            font-size: 10px !important;
            font-weight: 600 !important;
            background: transparent !important;
            min-width: 72px !important;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
          }
          .ad-mobile-nav-item svg {
            width: 24px !important;
            height: 24px !important;
            stroke-width: 1.5 !important;
          }
          .ad-page-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            padding: 0 16px !important;
            margin-top: 0px !important;
          }
          .agenda-digital-content {
             margin-top: 8px !important;
          }
          .ad-page-header > div {
            width: 100% !important;
          }
          .ad-page-header input {
            width: 100% !important;
          }
          .ad-modal-container {
            padding: 24px !important;
            border-radius: 16px !important;
            width: 95% !important;
          }
          .ad-feed-list {
            display: flex !important;
            flex-direction: column !important;
            gap: 0 !important;
            padding: 0 !important;
          }
          .ad-feed-card {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            border-bottom: 1px solid hsl(var(--border-subtle)) !important;
            background: transparent !important;
            padding: 16px !important;
            margin: 0 !important;
          }
          .ad-card-flex-row {
            flex-direction: row !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 12px !important;
          }
        }
      `}} />
      {/* Dynamic Header floating profile card */}
      <div className="ad-premium-card-wrapper">
        <div className="ad-premium-card">
          {/* AREA 1: PERFIL ALUNO (À esquerda) */}
          <div className="ad-premium-card-header-flex" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            <div className="ad-premium-card-avatar" style={{ 
              width: 96, 
              height: 96, 
              borderRadius: 24, 
              background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', 
              boxShadow: '0 8px 24px rgba(168,85,247,0.3)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white', 
              fontWeight: 900, 
              fontSize: 30, 
              fontFamily: 'Outfit, sans-serif',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden'
            }}>
              {aluno?.foto ? (
                 <Image src={aluno.foto} alt={aluno.nome} width={96} height={96} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                 getInitials(aluno.nome)
              )}
              {/* Soft gradient glass reflection gloss */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0,
        width: '100vw', height: '50%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(255,255,255,0))' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1, maxWidth: '100%' }}>
              <h2 className="ad-premium-student-name" style={{ fontSize: 21, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <span style={{ whiteSpace: 'nowrap', minWidth: 0 }}>{abbreviateName(aluno.nome)}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#6366f1" style={{ flexShrink: 0 }}><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </h2>

              {/* Row of 3 mini cards */}
              <div className="ad-mini-cards-grid" style={{ marginTop: 0 }}>
                {/* Mini Card 1: Turma */}
                <div className="ad-mini-card">
                  <div className="ad-mini-card-icon-desktop" style={{ color: '#6366f1', background: 'rgba(99,102,241,0.08)', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GraduationCap size={14} />
                  </div>
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <div className="ad-mini-card-label" style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="ad-mini-card-icon-mobile" style={{ display: 'none', color: '#6366f1' }}><GraduationCap size={10} /></span>
                      Turma
                    </div>
                    <div className="ad-mini-card-value" style={{ fontSize: 12, color: '#1e293b', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cleanTurma}
                    </div>
                  </div>
                </div>

                {/* Mini Card 2: Turno */}
                <div className="ad-mini-card">
                  <div className="ad-mini-card-icon-desktop" style={{ color: '#a855f7', background: 'rgba(168,85,247,0.08)', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar size={14} />
                  </div>
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <div className="ad-mini-card-label" style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="ad-mini-card-icon-mobile" style={{ display: 'none', color: '#a855f7' }}><Calendar size={10} /></span>
                      Turno
                    </div>
                    <div className="ad-mini-card-value" style={{ fontSize: 12, color: '#1e293b', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cleanTurno}
                    </div>
                  </div>
                </div>

                {/* Mini Card 3: Responsável */}
                {currentUser?.cargo !== 'Aluno' && (
                  <div className="ad-mini-card">
                    <div className="ad-mini-card-icon-desktop" style={{ color: '#10b981', background: 'rgba(16,185,129,0.08)', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={14} />
                    </div>
                    <div style={{ minWidth: 0, width: '100%' }}>
                      <div className="ad-mini-card-label" style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="ad-mini-card-icon-mobile" style={{ display: 'none', color: '#10b981' }}><Users size={10} /></span>
                        Responsável
                      </div>
                      <div className="ad-mini-card-value" style={{ fontSize: 12, color: '#1e293b', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100px' }}>
                          {abbreviateName(currentUser?.nome || (aluno as any).responsavel || 'Responsável')}
                        </span>
                        <span className="ad-badge-parentesco" style={{ fontSize: 8, background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: 8, flexShrink: 0, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(59,130,246,0.3)' }}>{userAccessRole.parentesco}</span>
                        {userAccessRole.isFin && (
                          <span className="ad-badge-fin" style={{ fontSize: 8, background: '#10b981', color: '#fff', padding: '2px 6px', borderRadius: 8, flexShrink: 0, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}>Financeiro</span>
                        )}
                        {userAccessRole.isPed && (
                          <span className="ad-badge-ped" style={{ fontSize: 8, background: '#4f46e5', color: '#fff', padding: '2px 6px', borderRadius: 8, flexShrink: 0, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(79,70,229,0.3)' }}>Pedagógico</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AREA 3: AÇÕES LATERAIS (À direita) - Botão Portaria */}
          <div className="ad-right-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minWidth: '180px' }}>
            {currentUser && currentUser.cargo !== 'Aluno' && adConfig?.permissoes?.chamadaAlunoPortaria !== false && (
              <div style={{ width: '100%' }}>
                <StudentCallButton aluno={aluno} currentUser={currentUser} />
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Main Grid containing Page Content */}
      <div className="ad-main-grid" style={{ marginTop: 24 }}>

        {/* Page Content Area */}
        <div className="ad-content-page-area" style={{ flex: 1, minWidth: 0 }}>
          <SelectedStudentProvider value={{ aluno, vinculo, userAccessRole }}>
            {children}
          </SelectedStudentProvider>
        </div>
      </div>

      {/* Mobile Bottom Navigation (Ultra Modern Neon) */}
      <div className="ad-mobile-nav-bar hide-scrollbar" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: 72,
        zIndex: 9999,
        padding: '0 4px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', minWidth: 'min-content', margin: '0 auto', height: '100%' }}>
          {filteredNavItems.map((item, idx) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={idx} href={item.href} style={{ textDecoration: 'none' }}>
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, 
                    width: 72, height: 56, borderRadius: 16, flexShrink: 0,
                    background: isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    border: isActive ? '1px solid rgba(0, 210, 255, 0.3)' : '1px solid transparent',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.4)',
                    boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.2), 0 0 10px rgba(0, 210, 255, 0.1)' : 'none',
                    transition: 'all 0.3s'
                  }}
                >
                  <div style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isActive ? '#00D2FF' : 'inherit',
                    filter: isActive ? 'drop-shadow(0 0 8px #00D2FF)' : 'none'
                  }}>
                    {React.cloneElement(item.icon, { size: 20, color: 'currentColor' })}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{item.label}</span>
                </motion.div>
              </Link>
            )
          })}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
    </>
  )
}
