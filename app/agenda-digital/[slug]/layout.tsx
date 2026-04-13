'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useData } from '@/lib/dataContext'
import { useSaida } from '@/lib/saidaContext'
import { useApp } from '@/lib/context'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { use, useState, useEffect } from 'react'
import { 
  Bell, MessageSquare, Image as ImageIcon, Calendar, 
  BarChart2, AlertTriangle, GraduationCap, DollarSign, UserCog, Users, X, LogOut,
  Megaphone, Loader2, CheckCircle2
} from 'lucide-react'

function StudentCallButton({ aluno, currentUser }: { aluno: any, currentUser: any }) {
  const { activeCalls, callStudent, cancelCall } = useSaida()
  const [localConfirmed, setLocalConfirmed] = useState(false)
  const call = activeCalls.find(c => c.studentId === aluno.id && c.status !== 'cancelled')

  // Se o call foi confirmado mas estávamos esperando, segura o confirmed localmente por 5 segundos antes de resetar.
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

  // Se não tem call e nem confirmed, estado default
  if (!call && !localConfirmed) {
    return (
      <button 
        className="ad-chamar-btn"
        onClick={handleCall}
        style={{
          height: 48, padding: '0 24px', borderRadius: 100,
          background: 'var(--gradient-primary)',
          color: 'white', fontWeight: 800, fontSize: 15,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <Megaphone size={18} />
        Chamar Aluno na Portaria
      </button>
    )
  }

  if (isActive) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="ad-chamar-btn" style={{
          height: 48, padding: '0 24px', borderRadius: 100,
          background: 'rgba(245, 158, 11, 0.1)',
          border: '2px solid rgba(245, 158, 11, 0.4)',
          color: '#f59e0b', fontWeight: 800, fontSize: 15,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 0 20px rgba(245,158,11,0.15)',
        }}>
          <Loader2 size={18} className="spin-anim" />
          Aluno chamado
        </div>
        <button 
          onClick={() => cancelCall(call.id)}
          title="Cancelar chamada"
          style={{
            width: 48, height: 48, borderRadius: 24, cursor: 'pointer',
            background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          <X size={20} />
        </button>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin-anim { 100% { transform: rotate(360deg); } }
          .spin-anim { animation: spin-anim 1s linear infinite; }
        `}} />
      </div>
    )
  }

  if (isBlocked) {
    return (
      <div className="ad-chamar-btn" style={{
        height: 48, padding: '0 24px', borderRadius: 100,
        background: 'rgba(239, 68, 68, 0.1)',
        border: '2px solid rgba(239, 68, 68, 0.4)',
        color: '#ef4444', fontWeight: 800, fontSize: 15,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <AlertTriangle size={18} />
        Acesso Bloqueado
      </div>
    )
  }

  return (
    <div className="ad-chamar-btn" style={{
      height: 48, padding: '0 24px', borderRadius: 100,
      background: 'linear-gradient(135deg, #10b981, #059669)',
      color: 'white', fontWeight: 800, fontSize: 15,
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
      animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }}>
      <CheckCircle2 size={20} />
      Saída Confirmada!
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
  const { turmas = [] } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const { currentUser, setCurrentUser } = useApp()
  const pathname = usePathname()
  
  // Resolve (unwrap) o promise params
  const resolvedParams = use(params as Promise<{ slug: string }>)
  
  // Find the student
  const aluno = (alunos || []).find(a => a.id === resolvedParams.slug) || (alunos || [])[0]
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const router = useRouter()

  // Real fetching of family's linked students
  let meusAlunos = (alunos || []).filter(a => {
    const s = a.status?.toLowerCase()
    return s === 'matriculado' || s === 'ativo' || s === 'em_cadastro' || s === 'pendente'
  })

  if (currentUser && (currentUser.perfil === 'Responsável' || currentUser.perfil === 'Família')) {
    const nomeBusca = (currentUser.nome || '').toLowerCase().trim()
    const emailBusca = (currentUser.email || '').toLowerCase().trim()

    meusAlunos = meusAlunos.filter(a => {
      if (a.responsavel && a.responsavel.toLowerCase().trim() === nomeBusca) return true
      if (a.emailResponsavel && emailBusca && a.emailResponsavel.toLowerCase().trim() === emailBusca) return true
      if (a.responsavelFinanceiro && a.responsavelFinanceiro.toLowerCase().trim() === nomeBusca) return true
      if (a.responsavelPedagogico && a.responsavelPedagogico.toLowerCase().trim() === nomeBusca) return true

      // Checa array de responsáveis se existir (novo padrão de matrícula)
      const respArr = (a as any).responsaveis || (a as any)._responsaveis || []
      if (Array.isArray(respArr)) {
        return respArr.some(r => 
          (r.nome && r.nome.toLowerCase().trim() === nomeBusca) ||
          (r.email && emailBusca && r.email.toLowerCase().trim() === emailBusca) ||
          (r.emailResponsavel && emailBusca && r.emailResponsavel.toLowerCase().trim() === emailBusca)
        )
      }

      return false
    })
  } else if (!currentUser || (currentUser.perfil !== 'Família' && currentUser.perfil !== 'Responsável')) {
    meusAlunos = meusAlunos.slice(0, 3) 
  }

  const navItems = [
    { label: 'Comunicados', href: `/agenda-digital/${aluno?.id}/comunicados`, icon: <Bell size={18} /> },
    { label: 'Conversas', href: `/agenda-digital/${aluno?.id}/conversas`, icon: <MessageSquare size={18} /> },
    { label: 'Momentos', href: `/agenda-digital/${aluno?.id}/momentos`, icon: <ImageIcon size={18} /> },
    { label: 'Calendário', href: `/agenda-digital/${aluno?.id}/calendario`, icon: <Calendar size={18} /> },
    { label: 'Frequência', href: `/agenda-digital/${aluno?.id}/frequencia`, icon: <BarChart2 size={18} /> },
    { label: 'Ocorrências', href: `/agenda-digital/${aluno?.id}/ocorrencias`, icon: <AlertTriangle size={18} /> },
    { label: 'Notas', href: `/agenda-digital/${aluno?.id}/notas`, icon: <GraduationCap size={18} /> },
    { label: 'Financeiro', href: `/agenda-digital/${aluno?.id}/financeiro`, icon: <DollarSign size={18} /> },
    { label: 'Meu Perfil', href: `/agenda-digital/${aluno?.id}/perfil`, icon: <UserCog size={18} /> },
  ]

  if (!aluno) return null

  return (
    <>
    {/* Student Switcher Overlay */}
    {switcherOpen && (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSwitcherOpen(false)}>
        <div className="ad-modal-container" style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800 }}>Trocar de Aluno</h3>
            <button onClick={() => setSwitcherOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {meusAlunos.map(a => (
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
                    <div className="ad-switcher-item-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Turma {(a as any).turma}</div>
                  </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ad-main-grid {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 32px;
          align-items: start;
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
        /* Somente Modificacoes Mobile, intocavel no Desktop */
        @media (max-width: 768px) {
          .ad-main-grid {
            grid-template-columns: 1fr !important;
            gap: 0px !important;
          }
          .ad-banner {
            height: 250px !important;
          }
          .agenda-digital-wrapper {
            padding-bottom: 80px !important;
            background: #ffffff !important;
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
      {/* Top Banner specific to the student */}
      <div className="ad-student-banner">
        <div className="ad-banner-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="avatar ad-banner-avatar-wrapper" style={{ width: 64, height: 64, fontSize: 24, background: 'var(--gradient-purple)', color: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', transition: 'transform 0.3s ease' }}
               onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
               onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} >
            {aluno?.foto ? (
               <img src={aluno.foto} alt={aluno.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
               <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getInitials(aluno.nome)}
               </div>
            )}
          </div>
          <div>
            <div className="ad-student-name" style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
              {aluno.nome}
            </div>
            <div className="ad-student-details" style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>
              {(() => {
                const unidadeAluno = turmas.find(t => t.nome === aluno.turma || t.codigo === aluno.turma)?.unidade || (aluno as any).unidade
                return (
                  <>
                    Turma {(aluno as any).turma} {(aluno as any).serie ? `• ${(aluno as any).serie}` : ''} {unidadeAluno && unidadeAluno.trim() ? `• ${unidadeAluno}` : ''}
                  </>
                )
              })()}
            </div>
          </div>
        </div>

        <div className="ad-banner-actions">
          
          {currentUser && currentUser.cargo !== 'Aluno' && (
            <StudentCallButton aluno={aluno} currentUser={currentUser} />
          )}

          {currentUser && (
            <div className="ad-banner-actions-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
               <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'hsl(var(--text-muted))', fontWeight: 700, marginBottom: 2 }}>
                 Logado como
               </div>
               <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-main))', marginBottom: 6 }}>
                 {currentUser.nome}
               </div>
               <div style={{ display: 'flex', gap: 6 }}>
                 {(() => {
                    if (currentUser?.cargo === 'Aluno') {
                      return <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: 'white', letterSpacing: 0.5 }}>ALUNO</span>
                    }

                    const myName = (currentUser?.nome || '').toLowerCase().trim();
                    const myEmail = (currentUser?.email || '').toLowerCase().trim();
                    let isFin = false;
                    let isPed = false;
                    
                    if ((aluno.responsavelFinanceiro || '').toLowerCase().trim() === myName) isFin = true;
                    if ((aluno.responsavelPedagogico || '').toLowerCase().trim() === myName) isPed = true;
                    if (aluno.emailResponsavelFinanceiro === myEmail) isFin = true;
                    
                    const respArr = (aluno as any).responsaveis || (aluno as any)._responsaveis || [];
                    if (Array.isArray(respArr)) {
                       const eu = respArr.find((r: any) => 
                         (r.nome && r.nome.toLowerCase().trim() === myName) || 
                         (r.email && myEmail && r.email.toLowerCase().trim() === myEmail)
                       );
                       if (eu) {
                         if (eu.respFinanceiro || eu.financeiro || eu.tipo === 'Financeiro' || eu.tipo === 'Ambos') isFin = true;
                         if (eu.respPedagogico || eu.pedagogico || eu.tipo === 'Pedagógico' || eu.tipo === 'Ambos') isPed = true;
                       }
                    }

                    if (!isFin && !isPed && (currentUser.perfil === 'Administrador' || currentUser.perfil === 'Gestor')) {
                       isFin = true; isPed = true;
                    }

                    return (
                      <>
                        {isFin ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Resp. Financeiro</span>
                        ) : null}
                        {isPed ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'rgba(56, 189, 248, 0.1)', color: '#0ea5e9' }}>Resp. Pedagógico</span>
                        ) : null}
                        {!isFin && !isPed ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' }}>Acompanhante</span>
                        ) : null}
                      </>
                    )
                 })()}
               </div>
            </div>
          )}
          <div className="ad-banner-btn-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentUser?.cargo !== 'Aluno' && (
              <button onClick={() => setSwitcherOpen(true)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
                <Users size={16} />
                <span style={{ whiteSpace: 'nowrap' }}>Trocar Aluno</span>
              </button>
            )}
            <button 
              onClick={async () => { 
                setCurrentUser(null); 
                await fetch('/api/auth/logout', { method: 'POST' }); 
                window.location.href = '/login'; 
              }} 
              className="btn btn-secondary btn-sm" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#ef4444' }}
            >
              <LogOut size={16} />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area with Navigation */}
      <div className="ad-main-grid">
        {/* Sub-NavigationBar (Desktop Side, Mobile Bottom conceptual) */}
        <nav className="ad-mobile-nav">
          {navItems.map(item => {
            const isActive = pathname.includes(item.href)
            return (
              <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
                <div 
                  className="ad-mobile-nav-item"
                  style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                  color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'background 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'hsl(var(--bg-surface))'
                  e.currentTarget.style.color = 'hsl(var(--primary))'
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                  }
                }}
                >
                  {item.icon}
                  {item.label}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Page Content */}
        <div style={{ minHeight: 400 }}>
          {children}
        </div>
      </div>
    </div>
    </>
  )
}
