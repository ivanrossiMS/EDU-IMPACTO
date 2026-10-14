'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { LoadingGlass } from '@/components/LoadingGlass'
import { 
  UserCog, Phone, Mail, ShieldAlert, GraduationCap, MapPin, 
  Edit3, ShieldCheck, Contact, Camera, 
  AlertTriangle, Fingerprint, CalendarDays, Loader2,
  DollarSign, Lock, Clock, History, CheckCircle2, KeyRound, Eye, EyeOff, Check
} from 'lucide-react'
import { getInitials, formatDate } from '@/lib/utils'
import { useApiQuery } from '@/hooks/useApi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { useApp } from '@/lib/context'
import { apiFetch } from '@/lib/api/apiClient'
import {
  AutorizacaoFinanceiraModal,
  TargetResponsavel
} from '@/app/agenda-digital/components/AutorizacaoFinanceiraModal'

export default function ADPerfilPage() {
  const queryClient = useQueryClient()
  const { currentUser, setCurrentUser } = useApp()
  const { aluno: basicAluno, userAccessRole } = useSelectedStudent()
  const slug = basicAluno?.id
  
  const { data: responseData, isLoading, error, refetch } = useApiQuery<any>(
    ['aluno', slug], 
    slug ? `/api/alunos/${slug}` : '',
    undefined,
    { enabled: !!slug }
  )
  const aluno = responseData?.data || null

  // Autorizações financeiras e histórico de auditoria
  const { data: authData, refetch: refetchAuth } = useQuery({
    queryKey: ['agenda', 'autorizacoes-financeiras', slug],
    queryFn: async () => {
      if (!slug) return null
      const res = await apiFetch(`/api/agenda/autorizacoes-financeiras?aluno_id=${slug}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!slug
  })

  // Modal de autorização financeira
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [selectedTargetResp, setSelectedTargetResp] = useState<TargetResponsavel | null>(null)
  const [authModalMode, setAuthModalMode] = useState<'AUTORIZAR' | 'REVOGAR' | 'HISTORICO'>('AUTORIZAR')

  // Bloqueio rigoroso de rolagem vertical no fundo quando o modal estiver aberto
  useEffect(() => {
    if (authModalOpen) {
      const prevBody = document.body.style.overflow
      const prevHtml = document.documentElement.style.overflow
      const prevOverscroll = document.body.style.overscrollBehavior

      document.body.style.overflow = 'hidden'
      document.body.style.overscrollBehavior = 'none'
      document.documentElement.style.overflow = 'hidden'

      return () => {
        document.body.style.overflow = prevBody
        document.body.style.overscrollBehavior = prevOverscroll
        document.documentElement.style.overflow = prevHtml
      }
    }
  }, [authModalOpen])

  const isCallerStaff = currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Gestor' || currentUser?.perfil === 'Direção' || currentUser?.perfil === 'Secretaria'
  const canManageFinancial = Boolean(authData?.canManage ?? (isCallerStaff || userAccessRole?.isFin))
  const titularNome = authData?.titularNome || aluno?.responsavel_financeiro || aluno?.responsavel || 'Responsável Financeiro'
  const currentLoggedUserName = currentUser?.nome || currentUser?.user_metadata?.nome || currentUser?.email || 'Você'

  const handleToggleFinancialAccess = (targetResp: TargetResponsavel) => {
    if (!canManageFinancial) {
      toast.error(`Apenas o responsável financeiro titular (${titularNome}) pode conceder ou alterar autorizações.`)
      return
    }

    setSelectedTargetResp(targetResp)
    setAuthModalMode(targetResp.respFinanceiro ? 'REVOGAR' : 'AUTORIZAR')
    setAuthModalOpen(true)
  }

  const handleOpenHistoryModal = (targetResp: TargetResponsavel) => {
    setSelectedTargetResp(targetResp)
    setAuthModalMode('HISTORICO')
    setAuthModalOpen(true)
  }

  const handleConfirmAuthorization = async ({
    acao,
    responsavelId,
    alunoId,
    aplicarTodos
  }: {
    acao: 'AUTORIZAR' | 'REVOGAR'
    responsavelId: string
    alunoId: string
    aplicarTodos: boolean
  }) => {
    const res = await apiFetch('/api/agenda/autorizacoes-financeiras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alunoId,
        responsavelId,
        acao,
        aplicarTodosAlunos: aplicarTodos
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao processar autorização')
    }

    toast.success(
      acao === 'AUTORIZAR'
        ? `Acesso financeiro concedido para ${selectedTargetResp?.nome || 'o responsável'}!`
        : `Acesso financeiro de ${selectedTargetResp?.nome || 'o responsável'} foi revogado.`
    )

    await Promise.all([
      refetch(),
      refetchAuth(),
      queryClient.invalidateQueries({ queryKey: ['aluno', slug] }),
      queryClient.invalidateQueries({ queryKey: ['agenda', 'perfil-acesso'] })
    ])
  }

  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedRespId, setSelectedRespId] = useState<string | null>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedRespId) return

    setUploadingAvatarId(selectedRespId)
    try {
      const uploadRes = await uploadFileToSupabase({
        bucket: 'comunicados-midia',
        folder: 'avatars',
        file,
        usageType: 'fixed'
      })

      if (!uploadRes.ok || !uploadRes.url) {
        throw new Error(uploadRes.error || 'Erro ao enviar a imagem')
      }

      const targetResp = responsaveisList.find((r: any) => r.id === selectedRespId)
      
      const apiRes = await apiFetch('/api/responsaveis/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          responsavelId: selectedRespId, 
          email: targetResp?.email,
          avatarUrl: uploadRes.url 
        })
      })

      if (!apiRes.ok) {
        const errData = await apiRes.json().catch(() => ({}))
        console.error('[Avatar Sync Error]', errData)
        throw new Error(errData.error || errData.full || 'Falha ao vincular avatar ao perfil')
      }

      refetch() 
      
      const isCurrentLoggedInUser = currentUser && (
        (targetResp?.email && currentUser.email && targetResp.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) ||
        (currentUser.responsavel_id && String(currentUser.responsavel_id) === String(selectedRespId)) ||
        (targetResp?.nome && currentUser.nome && targetResp.nome.toLowerCase().trim() === currentUser.nome.toLowerCase().trim())
      );

      if (isCurrentLoggedInUser) {
        const updatedUser = { ...currentUser, foto: uploadRes.url }
        setCurrentUser(updatedUser)
      }
      
      if (typeof window !== 'undefined') {
        try {
          if (selectedRespId) localStorage.setItem(`edu-user-photo-${selectedRespId}`, uploadRes.url)
          if (currentUser?.id && isCurrentLoggedInUser) localStorage.setItem(`edu-user-photo-${currentUser.id}`, uploadRes.url)
        } catch (_) {}
      }

    } catch (err: any) {
      alert('Erro ao atualizar avatar: ' + err.message)
    } finally {
      setUploadingAvatarId(null)
      setSelectedRespId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const [activeTab, setActiveTab] = useState<'geral' | 'responsaveis' | 'senha'>('geral')

  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [isEditingPhone, setIsEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Estados para alteração de senha (sem requisitos mínimos)
  const [pwForm, setPwForm] = useState({ atual: '', nova: '', confirmar: '' })
  const [showPw, setShowPw] = useState({ atual: false, nova: false, confirmar: false })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [isChangingPw, setIsChangingPw] = useState(false)

  const searchParams = useSearchParams()
  const espelharRespId = searchParams?.get('espelhar_responsavel');
  const espelharAluno = searchParams?.get('espelhar_aluno') === 'true';
  const isMirroring = !!(espelharRespId || espelharAluno);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isChangingPw || isMirroring) return
    setPwError('')
    setPwSuccess(false)

    if (!pwForm.atual) {
      setPwError('Informe sua senha atual.')
      return
    }
    if (!pwForm.nova) {
      setPwError('Informe a nova senha.')
      return
    }
    if (pwForm.nova !== pwForm.confirmar) {
      setPwError('A confirmação de senha não coincide com a nova senha.')
      return
    }
    if (pwForm.atual === pwForm.nova) {
      setPwError('A nova senha deve ser diferente da senha atual.')
      return
    }

    setIsChangingPw(true)
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwForm.atual,
          newPassword: pwForm.nova,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg = data.error || 'Não foi possível alterar a senha. Verifique sua senha atual.'
        setPwError(msg)
        toast.error(msg)
        return
      }

      if (typeof window !== 'undefined' && currentUser?.id) {
        try {
          const all = JSON.parse(localStorage.getItem('edu-user-passwords') ?? '{}')
          all[currentUser.id] = pwForm.nova
          localStorage.setItem('edu-user-passwords', JSON.stringify(all))
        } catch {}
      }

      setPwSuccess(true)
      setPwForm({ atual: '', nova: '', confirmar: '' })
      toast.success('Senha alterada com sucesso!')
      setTimeout(() => setPwSuccess(false), 6000)
    } catch (err: any) {
      const msg = err?.message || 'Erro de conexão ao tentar alterar a senha.'
      setPwError(msg)
      toast.error(msg)
    } finally {
      setIsChangingPw(false)
    }
  }

  // Atualizar o state do input se o aluno carregar depois do hook inicial
  useEffect(() => {
    if (aluno) {
      setEmailInput(aluno.email || '')
      setPhoneInput(aluno.telefone || '')
    }
  }, [aluno?.email, aluno?.telefone])

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 16, color: '#ef4444', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
        Erro ao carregar perfil: {(error as Error).message}
      </p>
      <button
        onClick={() => refetch()}
        style={{
          padding: '8px 20px',
          borderRadius: 8,
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14
        }}
      >
        Tentar novamente
      </button>
    </div>
  )

  if (isLoading || !aluno) return (
    <div className="flex items-center justify-center h-full text-slate-500 font-medium p-8">
      <LoadingGlass />
    </div>
  )

  const handleSaveField = async (field: 'email' | 'telefone', value: string) => {
    try {
      setIsSaving(true)
      const res = await apiFetch(`/api/alunos/${aluno.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      
      aluno[field] = value
      
      if (field === 'email') setIsEditingEmail(false)
      if (field === 'telefone') setIsEditingPhone(false)
      toast.success('Informação atualizada com sucesso!')
    } catch (err) {
      alert('Erro ao atualizar: ' + (err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const responsaveisList = (aluno as any).responsaveis || (aluno as any)._responsaveis || [
    { nome: aluno.responsavel || 'Responsável Financeiro', parentesco: 'Responsável', telefone: aluno.telefone, email: aluno.email, tipo: 'Ambos' }
  ]
  const saude = (aluno as any).saude || {}

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  } as const

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 26 } }
  } as const

  const tabsConfig = [
    {
      id: 'geral' as const,
      label: 'Dados Gerais',
      icon: <Contact size={16} strokeWidth={2.3} />,
    },
    {
      id: 'responsaveis' as const,
      label: 'Responsáveis',
      icon: <ShieldCheck size={16} strokeWidth={2.3} />,
    },
    {
      id: 'senha' as const,
      label: 'Alterar Senha',
      icon: <KeyRound size={16} strokeWidth={2.3} />,
    },
  ]

  const alunoNascimento = (aluno.dataNascimento || aluno.data_nascimento)
    ? formatDate(aluno.dataNascimento || aluno.data_nascimento)
    : 'Não informado'
  const alunoMatricula = aluno.matricula || aluno.dados?.codigo || aluno.codigo || String(aluno.id).slice(0, 8)
  const alunoTurma = aluno.turma || aluno.serie || aluno.dados?.turma || 'Regular'

  return (
    <div className="ad-perfil-root" style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 88, fontFamily: 'Outfit, Inter, sans-serif' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .avatar-edit-overlay:hover {
          opacity: 1 !important;
        }

        /* ── Segmented Control Dock Ultra Moderno ── */
        .ad-perfil-tabs-bar {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          padding: 6px;
          margin-bottom: 20px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 20px;
          box-shadow: 0 10px 30px -8px rgba(79, 70, 229, 0.08), 0 2px 8px rgba(15, 23, 42, 0.03);
        }

        .ad-perfil-tab-btn {
          position: relative;
          min-width: 0;
          padding: 11px 12px;
          border-radius: 14px;
          border: 1px solid transparent;
          background: transparent;
          color: #475569;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: 'Outfit', Inter, sans-serif;
          font-size: 13px;
          font-weight: 800;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .ad-perfil-tab-btn:hover:not(.active) {
          background: #f8fafc;
          color: #0f172a;
        }

        .ad-perfil-tab-btn.active {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 60%, #7c3aed 100%);
          color: #ffffff;
          box-shadow: 0 8px 20px -4px rgba(79, 70, 229, 0.42);
        }

        .ad-perfil-tab-icon {
          width: 28px;
          height: 28px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: #eef2ff;
          color: #4f46e5;
          transition: all 0.2s ease;
        }

        .ad-perfil-tab-btn.active .ad-perfil-tab-icon {
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
        }

        .ad-perfil-tab-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.15;
        }

        /* ── Card Principal de Seção ── */
        .ad-perfil-section-card {
          background: rgba(255, 255, 255, 0.96);
          border-radius: 26px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          padding: 26px;
          box-shadow: 0 16px 40px -12px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(15, 23, 42, 0.02);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── Bento Grid (Dados Gerais) ── */
        .ad-bento-top-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .ad-bento-contact-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .ad-resp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .ad-pw-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .ad-pw-input-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 14px;
          padding: 0 8px 0 14px;
          min-height: 48px;
          transition: all 0.2s ease;
        }

        .ad-pw-input-wrapper:focus-within {
          background: #ffffff;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3.5px rgba(79, 70, 229, 0.12);
        }

        .ad-pw-input-wrapper.has-error {
          border-color: #ef4444;
          background: #fef2f2;
        }

        .ad-pw-input-wrapper.has-success {
          border-color: #10b981;
        }

        input.ad-pw-input {
          flex: 1;
          min-width: 0;
          width: 100%;
          border: none !important;
          outline: none !important;
          background: transparent !important;
          box-shadow: none !important;
          font-family: 'Outfit', Inter, sans-serif;
          font-size: 15px !important;
          font-weight: 600;
          color: #0f172a !important;
          padding: 12px 4px !important;
        }

        input.ad-pw-input::placeholder {
          color: #94a3b8 !important;
          font-weight: 500;
        }

        @media (max-width: 680px) {
          .ad-perfil-tabs-bar {
            gap: 5px;
            padding: 5px;
            border-radius: 18px;
            margin-bottom: 16px;
          }

          .ad-perfil-tab-btn {
            flex-direction: column;
            gap: 5px;
            padding: 10px 4px;
            border-radius: 14px;
            font-size: 11px;
          }

          .ad-perfil-tab-icon {
            width: 28px;
            height: 28px;
            border-radius: 9px;
          }

          .ad-perfil-section-card {
            padding: 18px 16px !important;
            border-radius: 22px !important;
            gap: 16px !important;
          }

          .ad-bento-top-grid {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .ad-bento-top-grid > div:last-child {
            grid-column: 1 / -1;
          }

          .ad-bento-contact-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .ad-pw-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          input.ad-pw-input {
            font-size: 16px !important;
          }

          .ad-pw-submit-btn {
            width: 100%;
          }
        }
      `}} />

      {/* Segmented Control Dock Ultra Moderno */}
      <div
        className="ad-perfil-tabs-bar"
        role="tablist"
        aria-label="Seções do perfil"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 6,
          padding: 6,
          marginBottom: 18,
          background: 'rgba(255, 255, 255, 0.92)',
          borderRadius: 20,
          border: '1px solid rgba(226, 232, 240, 0.95)',
          boxShadow: '0 10px 30px -8px rgba(79, 70, 229, 0.08), 0 2px 8px rgba(15, 23, 42, 0.03)',
        }}
      >
        {tabsConfig.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`ad-perfil-tab-btn ${isActive ? 'active' : ''}`}
              style={{
                borderRadius: 14,
                border: 'none',
                background: isActive
                  ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 60%, #7c3aed 100%)'
                  : 'transparent',
                color: isActive ? '#ffffff' : '#475569',
                boxShadow: isActive ? '0 8px 20px -4px rgba(79, 70, 229, 0.42)' : 'none',
                cursor: 'pointer',
              }}
            >
              <span
                className="ad-perfil-tab-icon"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: isActive ? 'rgba(255, 255, 255, 0.22)' : '#eef2ff',
                  color: isActive ? '#ffffff' : '#4f46e5',
                }}
              >
                {tab.icon}
              </span>
              <span className="ad-perfil-tab-label">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Contents */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: DADOS GERAIS */}
          {activeTab === 'geral' && (
            <motion.div key="geral" variants={itemVariants} exit={{ opacity: 0, y: -14 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div
                className="ad-perfil-section-card"
                style={{
                  background: '#ffffff',
                  borderRadius: 24,
                  border: '1px solid rgba(226, 232, 240, 0.95)',
                  padding: 22,
                  boxShadow: '0 16px 40px -12px rgba(15, 23, 42, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 14, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                        border: '1px solid #c7d2fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4f46e5',
                        flexShrink: 0,
                      }}
                    >
                      <UserCog size={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                        Informações do Aluno
                      </h3>
                      <p style={{ margin: '3px 0 0 0', fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                        Dados cadastrais, contatos e endereço residencial
                      </p>
                    </div>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 11px',
                      borderRadius: 999,
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#047857',
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.03em',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                    CADASTRO ATIVO
                  </span>
                </div>

                {/* Bento Row 1: Dados rápidos */}
                <div className="ad-bento-top-grid">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '13px 14px',
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '1px solid #e2e8f0',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        background: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <CalendarDays size={17} strokeWidth={2.2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 2 }}>
                        Nascimento
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{alunoNascimento}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '13px 14px',
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '1px solid #e2e8f0',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        background: '#f5f3ff',
                        color: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Fingerprint size={17} strokeWidth={2.2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 2 }}>
                        Matrícula
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>#{alunoMatricula}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '13px 14px',
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '1px solid #e2e8f0',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        background: '#ecfdf5',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <GraduationCap size={17} strokeWidth={2.2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 2 }}>
                        Turma / Série
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {alunoTurma}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bento Row 2: E-mail & Telefone editáveis */}
                <div className="ad-bento-contact-grid">
                  {/* E-mail do Aluno */}
                  <div
                    style={{
                      background: '#ffffff',
                      padding: 16,
                      borderRadius: 18,
                      border: isEditingEmail ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                      boxShadow: isEditingEmail ? '0 0 0 3px rgba(79, 70, 229, 0.1)' : '0 2px 8px rgba(15, 23, 42, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: '#eef2ff',
                            color: '#4f46e5',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Mail size={14} strokeWidth={2.3} />
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                          E-mail do Aluno
                        </span>
                      </div>

                      {!isEditingEmail && !isMirroring && (
                        <button
                          type="button"
                          onClick={() => { setIsEditingEmail(true); setEmailInput(aluno.email || '') }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 10px',
                            borderRadius: 999,
                            background: '#eef2ff',
                            border: '1px solid #e0e7ff',
                            color: '#4f46e5',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          <Edit3 size={12} /> Editar
                        </button>
                      )}
                    </div>

                    {isEditingEmail ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                        <input 
                          value={emailInput} 
                          onChange={e => setEmailInput(e.target.value)} 
                          placeholder="aluno@email.com"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleSaveField('email', emailInput)}
                            disabled={isSaving}
                            style={{
                              flex: 1,
                              padding: '9px 12px',
                              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: 10,
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {isSaving ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingEmail(false)}
                            disabled={isSaving}
                            style={{
                              flex: 1,
                              padding: '9px 12px',
                              background: '#f1f5f9',
                              color: '#475569',
                              border: 'none',
                              borderRadius: 10,
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: aluno.email ? '#0f172a' : '#94a3b8', wordBreak: 'break-all', paddingLeft: 2 }}>
                        {aluno.email || 'Não cadastrado'}
                      </div>
                    )}
                  </div>

                  {/* Telefone / Celular */}
                  <div
                    style={{
                      background: '#ffffff',
                      padding: 16,
                      borderRadius: 18,
                      border: isEditingPhone ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                      boxShadow: isEditingPhone ? '0 0 0 3px rgba(79, 70, 229, 0.1)' : '0 2px 8px rgba(15, 23, 42, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: '#ecfdf5',
                            color: '#059669',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Phone size={14} strokeWidth={2.3} />
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                          Telefone / Celular
                        </span>
                      </div>

                      {!isEditingPhone && !isMirroring && (
                        <button
                          type="button"
                          onClick={() => { setIsEditingPhone(true); setPhoneInput(aluno.telefone || '') }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 10px',
                            borderRadius: 999,
                            background: '#eef2ff',
                            border: '1px solid #e0e7ff',
                            color: '#4f46e5',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          <Edit3 size={12} /> Editar
                        </button>
                      )}
                    </div>

                    {isEditingPhone ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                        <input 
                          value={phoneInput} 
                          onChange={e => setPhoneInput(e.target.value)} 
                          placeholder="(00) 00000-0000"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleSaveField('telefone', phoneInput)}
                            disabled={isSaving}
                            style={{
                              flex: 1,
                              padding: '9px 12px',
                              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: 10,
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {isSaving ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingPhone(false)}
                            disabled={isSaving}
                            style={{
                              flex: 1,
                              padding: '9px 12px',
                              background: '#f1f5f9',
                              color: '#475569',
                              border: 'none',
                              borderRadius: 10,
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: aluno.telefone ? '#0f172a' : '#94a3b8', paddingLeft: 2 }}>
                        {aluno.telefone || 'Não cadastrado'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bento Row 3: Endereço Residencial */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '15px 16px',
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: '#fff7ed',
                      color: '#ea580c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MapPin size={18} strokeWidth={2.2} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 3 }}>
                      Endereço Residencial
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: aluno.endereco ? '#0f172a' : '#64748b', lineHeight: 1.4 }}>
                      {aluno.endereco
                        ? `${aluno.endereco}, ${aluno.numero || 'S/N'} — ${aluno.bairro || 'Bairro'}, ${aluno.cidade || 'Cidade'}`
                        : 'Endereço não cadastrado no sistema.'}
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 2: RESPONSAVEIS & AUTORIZADOS */}
          {activeTab === 'responsaveis' && (
            <motion.div key="responsaveis" variants={itemVariants} exit={{ opacity: 0, y: -14 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div
                className="ad-perfil-section-card"
                style={{
                  background: '#ffffff',
                  borderRadius: 24,
                  border: '1px solid rgba(226, 232, 240, 0.95)',
                  padding: 22,
                  boxShadow: '0 16px 40px -12px rgba(15, 23, 42, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                      border: '1px solid #fcd34d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#d97706',
                      flexShrink: 0,
                    }}
                  >
                    <ShieldAlert size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                      Contatos e Autorizados
                    </h3>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 3 }}>
                      Pessoas responsáveis, permissões financeiras e autorizados a retirar o aluno
                    </div>
                  </div>
                </div>

                {/* Responsaveis Grid */}
                <div className="ad-resp-grid">
                  {responsaveisList.map((resp: any, i: number) => {
                    const authResp = (authData?.responsaveis || []).find((ar: any) => String(ar.id).trim() === String(resp.id).trim())
                    const isFin = Boolean(resp.respFinanceiro || resp.financeiro || authResp?.respFinanceiro || resp.tipo === 'Financeiro' || resp.tipo === 'Ambos')
                    const isPed = Boolean(resp.respPedagogico || resp.pedagogico || authResp?.respPedagogico || resp.tipo === 'Pedagógico' || resp.tipo === 'Ambos')
                    const latestAudit = authResp?.latestAudit || null
                    const isTitular = Boolean(authResp?.isTitular || (titularNome && resp.nome && titularNome.toLowerCase().trim() === resp.nome.toLowerCase().trim()))
                    
                    const isSameUser = !isMirroring && ((resp.email && currentUser?.email && resp.email.toLowerCase() === currentUser.email.toLowerCase()) || 
                                       (resp.nome && currentUser?.nome && resp.nome.toLowerCase() === currentUser.nome.toLowerCase()));
                    const displayFoto = isSameUser ? (currentUser?.foto || resp.foto || resp.dados?.foto) : (resp.foto || resp.dados?.foto);
                    
                    return (
                      <div
                        key={i}
                        style={{
                          padding: 18,
                          borderRadius: 20,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                          boxShadow: '0 4px 16px -6px rgba(15, 23, 42, 0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ position: 'relative' }}>
                              <div 
                                onClick={() => {
                                  if (resp.id && isSameUser) {
                                    setSelectedRespId(resp.id)
                                    fileInputRef.current?.click()
                                  }
                                }}
                                style={{ 
                                  width: 58, height: 58, borderRadius: 18, 
                                  background: 'linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                  fontWeight: 800, color: '#4338ca', fontSize: 18,
                                  position: 'relative', overflow: 'hidden', cursor: resp.id && isSameUser ? 'pointer' : 'default',
                                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.1)'
                                }}
                              >
                                {uploadingAvatarId === resp.id ? (
                                  <Loader2 size={22} className="animate-spin" color="#4338ca" />
                                ) : displayFoto ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={displayFoto} alt={resp.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  getInitials(resp.nome)
                                )}
                                
                                {resp.id && !uploadingAvatarId && isSameUser && (
                                  <div className="avatar-edit-overlay" style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: 0, transition: 'opacity 0.2s'
                                  }}>
                                    <Camera size={18} color="white" />
                                  </div>
                                )}
                              </div>

                              {resp.id && !uploadingAvatarId && isSameUser && (
                                <div 
                                  style={{
                                    position: 'absolute',
                                    bottom: -3,
                                    right: -3,
                                    background: '#4f46e5',
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px solid #ffffff',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                    pointerEvents: 'none',
                                    zIndex: 2
                                  }}
                                >
                                  <Camera size={11} color="#ffffff" strokeWidth={2.5} />
                                </div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', textTransform: 'capitalize' }}>{resp.nome}</div>
                              <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{resp.parentesco || 'Responsável'}</div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {isTitular && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                              TITULAR FINANCEIRO
                            </span>
                          )}
                          {!isTitular && isFin && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: '#dcfce7', color: '#166534' }}>
                              FINANCEIRO
                            </span>
                          )}
                          {isPed && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: '#e0e7ff', color: '#3730a3' }}>
                              PEDAGÓGICO
                            </span>
                          )}
                          {!isFin && !isPed && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }}>
                              AUTORIZADO
                            </span>
                          )}
                        </div>

                        {(resp.telefone || resp.email) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                            {resp.telefone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', fontWeight: 600 }}><Phone size={14} color="#64748b" /> {resp.telefone}</div>}
                            {resp.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', fontWeight: 600, wordBreak: 'break-all' }}><Mail size={14} color="#64748b" style={{ flexShrink: 0 }} /> {resp.email}</div>}
                          </div>
                        )}

                        {/* Bloco de Gestão de Acesso Financeiro (Liga / Desliga) */}
                        {isTitular ? (
                          <div
                            style={{
                              marginTop: 'auto',
                              padding: '12px 14px',
                              borderRadius: 14,
                              background: 'rgba(79, 70, 229, 0.05)',
                              border: '1px solid rgba(79, 70, 229, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10
                            }}
                          >
                            <ShieldCheck size={18} color="#4f46e5" style={{ flexShrink: 0 }} />
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#3730a3', lineHeight: 1.4 }}>
                              Responsável titular cadastrado no contrato financeiro escolar
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              marginTop: 'auto',
                              padding: '14px 16px',
                              borderRadius: 16,
                              background: isFin ? 'rgba(22, 163, 74, 0.05)' : '#f8fafc',
                              border: `1.5px solid ${isFin ? 'rgba(22, 163, 74, 0.25)' : '#e2e8f0'}`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: isFin ? '#dcfce7' : '#e2e8f0',
                                    color: isFin ? '#16a34a' : '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  <DollarSign size={18} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                                    Acesso ao Financeiro
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: isFin ? '#15803d' : '#64748b' }}>
                                    {isFin ? 'Autorizado para visualizar faturas e Pix' : 'Acesso bloqueado a este responsável'}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleFinancialAccess({
                                    id: resp.id,
                                    nome: resp.nome,
                                    parentesco: resp.parentesco,
                                    email: resp.email,
                                    telefone: resp.telefone,
                                    foto: resp.foto || resp.dados?.foto,
                                    respFinanceiro: isFin,
                                    respPedagogico: isPed,
                                    isTitular: false,
                                    latestAudit
                                  })
                                }
                                disabled={!canManageFinancial}
                                title={
                                  canManageFinancial
                                    ? isFin
                                      ? 'Clique para desativar o acesso financeiro'
                                      : 'Clique para autorizar o acesso financeiro'
                                    : `Apenas o titular (${titularNome}) pode alterar esta autorização`
                                }
                                style={{
                                  position: 'relative',
                                  width: 50,
                                  height: 28,
                                  borderRadius: 100,
                                  border: 'none',
                                  background: isFin ? '#16a34a' : '#cbd5e1',
                                  cursor: canManageFinancial ? 'pointer' : 'not-allowed',
                                  opacity: canManageFinancial ? 1 : 0.65,
                                  transition: 'background-color 0.25s, box-shadow 0.25s',
                                  outline: 'none',
                                  padding: 0,
                                  flexShrink: 0,
                                  boxShadow: isFin ? '0 2px 10px rgba(22, 163, 74, 0.35)' : 'none'
                                }}
                              >
                                <motion.div
                                  layout
                                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                                  style={{
                                    position: 'absolute',
                                    top: 3,
                                    left: isFin ? 25 : 3,
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    background: '#ffffff',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {!canManageFinancial ? (
                                    <Lock size={10} color="#94a3b8" />
                                  ) : isFin ? (
                                    <CheckCircle2 size={12} color="#16a34a" />
                                  ) : null}
                                </motion.div>
                              </button>
                            </div>

                            {latestAudit ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingTop: 8,
                                  borderTop: `1px dashed ${isFin ? 'rgba(22, 163, 74, 0.25)' : '#e2e8f0'}`,
                                  fontSize: 11,
                                  color: '#64748b'
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Clock size={12} />
                                  {latestAudit.acao === 'AUTORIZAR_FINANCEIRO' ? 'Autorizado por' : 'Revogado por'}{' '}
                                  <strong style={{ color: '#334155' }}>{latestAudit.autorizado_por_nome}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenHistoryModal({
                                      id: resp.id,
                                      nome: resp.nome,
                                      parentesco: resp.parentesco,
                                      email: resp.email,
                                      telefone: resp.telefone,
                                      foto: resp.foto || resp.dados?.foto,
                                      respFinanceiro: isFin,
                                      respPedagogico: isPed,
                                      isTitular: false,
                                      latestAudit
                                    })
                                  }
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#4f46e5',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: 11,
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                >
                                  <History size={12} /> Histórico
                                </button>
                              </div>
                            ) : (
                              !canManageFinancial && (
                                <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                                  Apenas o titular ({titularNome}) pode autorizar.
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  
                  {saude.autorizados?.map((aut: any, idx: number) => (
                    <div key={`aut-${idx}`} style={{ padding: 18, borderRadius: 20, border: '1px dashed #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#64748b', fontSize: 16 }}>
                          {getInitials(aut.nome)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#334155', textTransform: 'capitalize' }}>{aut.nome}</div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{aut.parentesco || 'Terceiro Autorizado'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }}>APENAS RETIRADA</span>
                      </div>
                      {aut.telefone && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px dashed #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', fontWeight: 600 }}><Phone size={14} color="#94a3b8" /> {aut.telefone}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Saída Info */}
              <div style={{ padding: '18px 20px', borderRadius: 22, background: saude.autorizaSaida ? '#f0fdf4' : '#fef2f2', border: `1px solid ${saude.autorizaSaida ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 15, background: saude.autorizaSaida ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: saude.autorizaSaida ? '#166534' : '#991b1b', flexShrink: 0 }}>
                  {saude.autorizaSaida ? <ShieldCheck size={23} /> : <AlertTriangle size={23} />}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: saude.autorizaSaida ? '#166534' : '#991b1b', marginBottom: 3 }}>
                    {saude.autorizaSaida ? 'Saída Independente Autorizada' : 'Saída Restrita'}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: saude.autorizaSaida ? '#15803d' : '#b91c1c', fontWeight: 500, lineHeight: 1.4 }}>
                    {saude.autorizaSaida ? 'O aluno tem permissão para sair sozinho das dependências da escola.' : 'O aluno NÃO pode sair sozinho. Requer acompanhante autorizado para a retirada.'}
                  </p>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 3: ALTERAR SENHA (SEM REQUISITOS MÍNIMOS) */}
          {activeTab === 'senha' && (
            <motion.div key="senha" variants={itemVariants} exit={{ opacity: 0, y: -14 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                className="ad-perfil-section-card"
                style={{
                  background: '#ffffff',
                  borderRadius: 24,
                  border: '1px solid rgba(226, 232, 240, 0.95)',
                  padding: 22,
                  boxShadow: '0 16px 40px -12px rgba(15, 23, 42, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                        border: '1px solid #c7d2fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4f46e5',
                        flexShrink: 0,
                      }}
                    >
                      <KeyRound size={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                        Alteração de Senha
                      </h3>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 3 }}>
                        Crie sua nova senha livremente, sem requisitos mínimos de caracteres
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '6px 12px',
                      borderRadius: 999,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#334155',
                    }}
                  >
                    <Lock size={12} color="#4f46e5" />
                    <span>Conta: <strong style={{ color: '#0f172a' }}>{currentLoggedUserName}</strong></span>
                  </div>
                </div>

                {isMirroring ? (
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: 16,
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#92400e',
                      fontSize: 13.5,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0 }} />
                    <div>
                      A alteração de senha está desativada durante o modo de espelhamento administrativo.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {pwSuccess && (
                      <div
                        style={{
                          padding: '14px 16px',
                          borderRadius: 14,
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          color: '#166534',
                          fontSize: 13.5,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                        <span>Sua senha foi alterada com sucesso!</span>
                      </div>
                    )}

                    {pwError && (
                      <div
                        style={{
                          padding: '14px 16px',
                          borderRadius: 14,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#b91c1c',
                          fontSize: 13.5,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                        <span>{pwError}</span>
                      </div>
                    )}

                    {/* Campo: Senha Atual */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label
                        htmlFor="ad-pw-atual"
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: '#475569',
                          marginBottom: 6,
                        }}
                      >
                        Senha Atual
                      </label>
                      <div
                        className="ad-pw-input-wrapper"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          background: '#f8fafc',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: 14,
                          padding: '0 8px 0 14px',
                          minHeight: 48,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
                          <Lock size={16} />
                        </span>
                        <input
                          id="ad-pw-atual"
                          type={showPw.atual ? 'text' : 'password'}
                          value={pwForm.atual}
                          onChange={e => {
                            setPwForm(prev => ({ ...prev, atual: e.target.value }))
                            if (pwError) setPwError('')
                          }}
                          placeholder="Digite sua senha atual"
                          autoComplete="current-password"
                          className="ad-pw-input"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: 15,
                            fontWeight: 600,
                            color: '#0f172a',
                            padding: '12px 4px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(prev => ({ ...prev, atual: !prev.atual }))}
                          aria-label={showPw.atual ? 'Ocultar senha atual' : 'Mostrar senha atual'}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            border: 'none',
                            background: 'transparent',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {showPw.atual ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    {/* Grid: Nova Senha & Confirmar Nova Senha */}
                    <div className="ad-pw-grid">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label
                          htmlFor="ad-pw-nova"
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: '#475569',
                            marginBottom: 6,
                          }}
                        >
                          Nova Senha
                        </label>
                        <div
                          className="ad-pw-input-wrapper"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: 14,
                            padding: '0 8px 0 14px',
                            minHeight: 48,
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
                            <KeyRound size={16} />
                          </span>
                          <input
                            id="ad-pw-nova"
                            type={showPw.nova ? 'text' : 'password'}
                            value={pwForm.nova}
                            onChange={e => {
                              setPwForm(prev => ({ ...prev, nova: e.target.value }))
                              if (pwError) setPwError('')
                            }}
                            placeholder="Digite a nova senha"
                            autoComplete="new-password"
                            className="ad-pw-input"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: 15,
                              fontWeight: 600,
                              color: '#0f172a',
                              padding: '12px 4px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw(prev => ({ ...prev, nova: !prev.nova }))}
                            aria-label={showPw.nova ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              border: 'none',
                              background: 'transparent',
                              color: '#64748b',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {showPw.nova ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label
                          htmlFor="ad-pw-confirmar"
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: '#475569',
                            marginBottom: 6,
                          }}
                        >
                          Confirmar Nova Senha
                        </label>
                        <div
                          className={`ad-pw-input-wrapper ${pwForm.confirmar && pwForm.confirmar !== pwForm.nova ? 'has-error' : pwForm.confirmar && pwForm.confirmar === pwForm.nova ? 'has-success' : ''}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: pwForm.confirmar && pwForm.confirmar !== pwForm.nova ? '#fef2f2' : '#f8fafc',
                            border: `1.5px solid ${pwForm.confirmar && pwForm.confirmar !== pwForm.nova ? '#ef4444' : pwForm.confirmar && pwForm.confirmar === pwForm.nova ? '#10b981' : '#cbd5e1'}`,
                            borderRadius: 14,
                            padding: '0 8px 0 14px',
                            minHeight: 48,
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
                            <KeyRound size={16} />
                          </span>
                          <input
                            id="ad-pw-confirmar"
                            type={showPw.confirmar ? 'text' : 'password'}
                            value={pwForm.confirmar}
                            onChange={e => {
                              setPwForm(prev => ({ ...prev, confirmar: e.target.value }))
                              if (pwError) setPwError('')
                            }}
                            placeholder="Repita a nova senha"
                            autoComplete="new-password"
                            className="ad-pw-input"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: 15,
                              fontWeight: 600,
                              color: '#0f172a',
                              padding: '12px 4px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw(prev => ({ ...prev, confirmar: !prev.confirmar }))}
                            aria-label={showPw.confirmar ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              border: 'none',
                              background: 'transparent',
                              color: '#64748b',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {showPw.confirmar ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                        {pwForm.confirmar && pwForm.nova !== pwForm.confirmar && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <AlertTriangle size={13} /> As senhas não coincidem
                          </div>
                        )}
                        {pwForm.confirmar && pwForm.nova && pwForm.nova === pwForm.confirmar && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Check size={14} strokeWidth={2.5} /> As senhas coincidem
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                      <button
                        type="submit"
                        disabled={isChangingPw || !pwForm.atual || !pwForm.nova || !pwForm.confirmar}
                        className="ad-pw-submit-btn"
                        style={{
                          height: 48,
                          padding: '0 24px',
                          borderRadius: 14,
                          border: 'none',
                          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                          color: '#ffffff',
                          fontFamily: 'Outfit, Inter, sans-serif',
                          fontSize: 14.5,
                          fontWeight: 800,
                          cursor: isChangingPw || !pwForm.atual || !pwForm.nova || !pwForm.confirmar ? 'not-allowed' : 'pointer',
                          opacity: isChangingPw || !pwForm.atual || !pwForm.nova || !pwForm.confirmar ? 0.55 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          boxShadow: isChangingPw || !pwForm.atual || !pwForm.nova || !pwForm.confirmar ? 'none' : '0 8px 20px rgba(79, 70, 229, 0.25)',
                        }}
                      >
                        {isChangingPw ? (
                          <>
                            <Loader2 size={17} className="animate-spin" />
                            <span>Alterando Senha...</span>
                          </>
                        ) : (
                          <>
                            <KeyRound size={17} />
                            <span>Salvar Nova Senha</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      {/* Hidden File Input for Avatar Upload */}
      <input 
        type="file" 
        accept="image/jpeg, image/png, image/webp" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleAvatarChange} 
      />

      {/* Modal de Autorização Financeira com Registro de Auditoria */}
      <AnimatePresence>
        {authModalOpen && (
          <AutorizacaoFinanceiraModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            targetResponsavel={selectedTargetResp}
            aluno={{ id: aluno.id, nome: aluno.nome }}
            titularNome={titularNome}
            currentLoggedUserName={currentLoggedUserName}
            outrosAlunos={authData?.outrosAlunosEmComum || []}
            historico={authData?.historico || []}
            initialMode={authModalMode}
            onConfirm={handleConfirmAuthorization}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
