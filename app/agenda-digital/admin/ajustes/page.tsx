'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Shield,
  Bell,
  Smartphone,
  Palette,
  Save,
  CheckCircle2,
  Upload,
  MessageCircle,
  MessageSquare,
  Radio,
  ArrowRight,
  Sparkles,
  Trash2,
  RefreshCw,
  Monitor,
  Eye,
  Lock,
  Unlock,
  Heart,
  CreditCard,
  GraduationCap,
  CalendarCheck,
  AlertTriangle,
  DoorOpen,
  Calendar,
  Image as ImageIcon,
  Link2,
  Pin,
  FileCheck2,
  Reply,
  Check,
  Wand2,
  Sliders
} from 'lucide-react'
import { toast } from 'sonner'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { AdminWhatsAppContactsManager } from '@/components/AdminWhatsAppContactsManager'
import { AdminChatSettingsManager } from '@/components/AdminChatSettingsManager'

const MESH_THEMES = [
  {
    id: 'padrao',
    name: 'Impacto Original',
    desc: 'Roxo lavanda & azul céu suave',
    primary: '#4f46e5',
    previewBg: 'linear-gradient(135deg, #e9d5ff 0%, #bae6fd 100%)',
    dot: '#6366f1'
  },
  {
    id: 'oceano',
    name: 'Oceano Institucional',
    desc: 'Azul royal & brisa ciano',
    primary: '#2563eb',
    previewBg: 'linear-gradient(135deg, #bfdbfe 0%, #a5f3fc 100%)',
    dot: '#2563eb'
  },
  {
    id: 'esmeralda',
    name: 'Esmeralda Acadêmico',
    desc: 'Verde esmeralda & menta fresca',
    primary: '#059669',
    previewBg: 'linear-gradient(135deg, #a7f3d0 0%, #99f6e4 100%)',
    dot: '#10b981'
  },
  {
    id: 'cosmos',
    name: 'Cosmos Criativo',
    desc: 'Violeta profundo & rosa suave',
    primary: '#7c3aed',
    previewBg: 'linear-gradient(135deg, #ddd6fe 0%, #fbcfe8 100%)',
    dot: '#8b5cf6'
  },
  {
    id: 'solar',
    name: 'Âmbar Solar',
    desc: 'Dourado acolhedor & pêssego',
    primary: '#ea580c',
    previewBg: 'linear-gradient(135deg, #fde68a 0%, #fed7aa 100%)',
    dot: '#f59e0b'
  },
  {
    id: 'neutro',
    name: 'Minimalista Clean',
    desc: 'Cinza ardósia & branco puro',
    primary: '#334155',
    previewBg: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)',
    dot: '#475569'
  }
] as const

const GREETING_TEMPLATES = [
  {
    id: 'institucional',
    label: 'Acolhimento Institucional',
    titulo: 'Bem-vindo(a) à nossa escola! 🚀',
    mensagem:
      'Olá, {nome_responsavel}!\n\nDamos as boas-vindas a {nome_aluno} na turma {turma} e desejamos uma trajetória escolar em {ano_letivo} repleta de aprendizado, desenvolvimento e grandes conquistas.\n\nPor aqui na Agenda Digital você acompanha comunicados, momentos especiais, calendário e atendimento direto com nossa equipe!'
  },
  {
    id: 'infantil',
    label: 'Educação Infantil & Berçário',
    titulo: 'Que alegria receber {nome_aluno} em nossa família! 💜',
    mensagem:
      'Olá, {nome_responsavel}!\n\nÉ com imenso carinho que acolhemos {nome_aluno} ({turma}). Preparamos cada detalhe para que esta fase seja mágica, segura e cheia de descobertas.\n\nFique de olho nos "Momentos" do aplicativo para acompanhar de perto a rotina e os sorrisos do dia a dia!'
  },
  {
    id: 'fundamental',
    label: 'Ensino Fundamental & Médio',
    titulo: 'Boas-vindas ao Ano Letivo {ano_letivo} — Colégio Impacto',
    mensagem:
      'Prezado(a) {nome_responsavel},\n\nSeja muito bem-vindo(a) à Agenda Digital oficial do(a) estudante {nome_aluno} ({turma}).\n\nUtilize este canal para consultar boletins, frequência, comunicados da coordenação e falar diretamente com nossos setores escolares.'
  }
]

export default function ADAdminAjustes() {
  const { bannerUrl, setBannerUrl, adConfig, setAdConfig, adAlert } = useAgendaDigital()
  const [activeTab, setActiveTab] = useState('permissoes')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saudacaoFileInputRef = useRef<HTMLInputElement>(null)
  const saudacaoTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [localConfig, setLocalConfig] = useState(adConfig)
  const [localBanner, setLocalBanner] = useState(bannerUrl)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [isUploadingSaudacao, setIsUploadingSaudacao] = useState(false)
  const [bannerPreviewMode, setBannerPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [showExternalBannerUrl, setShowExternalBannerUrl] = useState(false)
  const [showExternalSaudacaoUrl, setShowExternalSaudacaoUrl] = useState(false)

  useEffect(() => {
    setLocalConfig(adConfig)
  }, [adConfig])

  useEffect(() => {
    setLocalBanner(bannerUrl)
  }, [bannerUrl])

  // Detecta alterações não salvas
  const hasUnsavedChanges = useMemo(() => {
    try {
      const configChanged = JSON.stringify(localConfig) !== JSON.stringify(adConfig)
      const bannerChanged = (localBanner || '') !== (bannerUrl || '')
      return configChanged || bannerChanged
    } catch {
      return false
    }
  }, [localConfig, adConfig, localBanner, bannerUrl])

  const compressImage = (file: File, maxWidth: number, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = event => {
        const img = new globalThis.Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(img.src)
            return
          }

          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/webp', quality)
          resolve(dataUrl)
        }
        img.onerror = error => reject(error)
      }
      reader.onerror = error => reject(error)
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingBanner(true)
    try {
      const compressedBase64 = await compressImage(file, 1600, 0.75)
      setLocalBanner(compressedBase64)
      setShowExternalBannerUrl(false)
      toast.success('Imagem de capa processada e otimizada em WebP HD!')
    } catch (err) {
      console.error('Erro ao comprimir imagem:', err)
      toast.error('Não foi possível processar a imagem selecionada.')
    } finally {
      setIsUploadingBanner(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSaudacaoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingSaudacao(true)
    try {
      const compressedBase64 = await compressImage(file, 900, 0.78)
      setLocalConfig(p => ({
        ...p,
        saudacao: {
          ...(p.saudacao || { ativa: true, titulo: '', mensagem: '' }),
          imagemUrl: compressedBase64
        }
      }))
      setShowExternalSaudacaoUrl(false)
      toast.success('Arte de boas-vindas anexada e otimizada!')
    } catch (err) {
      console.error('Erro ao comprimir imagem:', err)
      toast.error('Não foi possível processar a imagem de saudação.')
    } finally {
      setIsUploadingSaudacao(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    setAdConfig(localConfig)
    if (localBanner !== undefined) {
      setBannerUrl(localBanner)
    }

    try {
      const resConfig = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'ad_config', valor: localConfig })
      })
      if (!resConfig.ok) {
        const errJson = await resConfig.json().catch(() => ({}))
        throw new Error(errJson.error || 'Erro ao salvar configurações')
      }

      if (localBanner !== undefined) {
        const resBanner = await fetch('/api/configuracoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave: 'ad_banner', valor: localBanner || null })
        })
        if (!resBanner.ok) {
          const errJson = await resBanner.json().catch(() => ({}))
          throw new Error(errJson.error || 'Erro ao salvar banner')
        }
      }
      toast.success('Ajustes e personalização publicados para todos os usuários!')
      adAlert('Configurações e banner salvos com sucesso no sistema global para todos os usuários!', 'Sucesso')
    } catch (e: any) {
      console.error('Erro ao salvar configurações:', e)
      toast.error(`Erro ao publicar na nuvem: ${e.message || ''}`)
      adAlert(`Salvo localmente, mas houve erro ao publicar na nuvem global: ${e.message || ''}`, 'Atenção')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscardChanges = () => {
    setLocalConfig(adConfig)
    setLocalBanner(bannerUrl)
    toast.info('Alterações descartadas.')
  }

  const updatePerm = (key: keyof typeof localConfig.permissoes, val: boolean) => {
    setLocalConfig(p => ({ ...p, permissoes: { ...p.permissoes, [key]: val } }))
  }

  const updateNotif = (key: keyof typeof localConfig.notificacoes, val: boolean) => {
    setLocalConfig(p => ({ ...p, notificacoes: { ...p.notificacoes, [key]: val } }))
  }

  const updatePersonalizacao = (patch: Partial<NonNullable<typeof localConfig.personalizacao>>) => {
    setLocalConfig(p => ({
      ...p,
      personalizacao: {
        temaMesh: 'padrao',
        corPrimaria: '#4f46e5',
        exibirBanner: true,
        ajusteBanner: 'cover',
        alturaBanner: 'padrao',
        ...(p.personalizacao || {}),
        ...patch
      }
    }))
  }

  const updateSaudacao = (patch: Partial<NonNullable<typeof localConfig.saudacao>>) => {
    setLocalConfig(p => ({
      ...p,
      saudacao: {
        ativa: true,
        titulo: 'Bem-vindo à nossa escola!',
        mensagem: '',
        imagemUrl: '',
        fixado: true,
        exigeCiencia: false,
        permiteResposta: true,
        prioridade: 'normal',
        autorCargo: 'Diretor Geral',
        ...(p.saudacao || {}),
        ...patch
      }
    }))
  }

  const insertSaudacaoVar = (variable: string) => {
    const currentMsg = localConfig.saudacao?.mensagem || ''
    const el = saudacaoTextareaRef.current
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = currentMsg.slice(0, start) + variable + currentMsg.slice(end)
      updateSaudacao({ mensagem: next })
      setTimeout(() => {
        el.focus()
        el.setSelectionRange(start + variable.length, start + variable.length)
      }, 10)
    } else {
      updateSaudacao({ mensagem: currentMsg ? `${currentMsg} ${variable}` : variable })
    }
  }

  // Contadores para badges da sidebar
  const activePermsCount = useMemo(() => {
    const p = localConfig.permissoes || ({} as any)
    return [
      p.ambienteSeguroMomentos !== false,
      !!p.comentariosMural,
      !!p.visualizarAniversariantes,
      !!p.visualizarFinanceiro,
      !!p.visualizarNotas,
      !!p.visualizarFrequencia,
      !!p.visualizarOcorrencias,
      !!p.chamadaAlunoPortaria
    ].filter(Boolean).length
  }, [localConfig.permissoes])

  const activeNotifsCount = useMemo(() => {
    const n = localConfig.notificacoes || ({} as any)
    return [
      !!n.pushComunicados,
      !!n.pushMomentos,
      !!n.pushFinanceiro,
      !!n.pushCalendario,
      !!n.pushFrequencia,
      !!n.pushOcorrencias,
      !!n.pushNotas,
      !!n.pushSaidaPortaria,
      !!n.pushAlteracaoCalendario
    ].filter(Boolean).length
  }, [localConfig.notificacoes])

  const whatsappActiveCount = useMemo(() => {
    return (localConfig.contatosWhatsapp || []).filter((c: any) => c.ativo).length
  }, [localConfig.contatosWhatsapp])

  const personalizacao = {
    temaMesh: 'padrao' as const,
    corPrimaria: '#4f46e5',
    exibirBanner: true,
    ajusteBanner: 'cover' as const,
    alturaBanner: 'padrao' as const,
    ...(localConfig.personalizacao || {})
  }

  const saudacao = {
    ativa: false,
    titulo: 'Bem-vindo à nossa escola!',
    mensagem:
      'Damos as boas-vindas a {nome_aluno} e desejamos uma trajetória escolar repleta de aprendizado, desenvolvimento e conquistas.',
    imagemUrl: '',
    fixado: true,
    exigeCiencia: false,
    permiteResposta: true,
    prioridade: 'normal' as const,
    autorCargo: 'Diretor Geral',
    ...(localConfig.saudacao || {})
  }

  const isBannerBase64 = Boolean(localBanner && localBanner.startsWith('data:'))
  const isSaudacaoImgBase64 = Boolean(saudacao.imagemUrl && saudacao.imagemUrl.startsWith('data:'))

  const formatSaudacaoPreview = (str: string) =>
    (str || '')
      .replace(/\{nome_aluno\}/g, 'Lucas Gabriel')
      .replace(/\{nome_responsavel\}/g, 'Mariana Silva')
      .replace(/\{turma\}/g, '6º Ano A')
      .replace(/\{ano_letivo\}/g, new Date().getFullYear().toString())

  const selectedThemeObj = MESH_THEMES.find(t => t.id === personalizacao.temaMesh) || MESH_THEMES[0]

  const navItems = [
    {
      id: 'permissoes',
      label: 'Permissões e Uso',
      sub: 'Acesso das famílias',
      icon: Shield,
      color: '#4f46e5',
      bg: '#eef2ff',
      badge: `${activePermsCount}/8`
    },
    {
      id: 'chat',
      label: 'Chat & Autoatendimento',
      sub: 'Horários e robô',
      icon: MessageSquare,
      color: '#2563eb',
      bg: '#eff6ff',
      badge: localConfig.chatAuto?.horarioAtendimento?.ativo !== false ? 'Ativo' : 'Livre'
    },
    {
      id: 'notificacoes',
      label: 'Notificações Push',
      sub: 'Disparos no celular',
      icon: Bell,
      color: '#7c3aed',
      bg: '#f5f3ff',
      badge: (localConfig.notificacoes as any)?.pausarNotificacoes ? 'Pausado' : `${activeNotifsCount} on`,
      badgeWarn: Boolean((localConfig.notificacoes as any)?.pausarNotificacoes)
    },
    {
      id: 'personalizacao',
      label: 'Personalização (Cores)',
      sub: 'Capa e identidade visual',
      icon: Palette,
      color: '#ec4899',
      bg: '#fdf2f8',
      badge: selectedThemeObj.name.split(' ')[0]
    },
    {
      id: 'saudacao',
      label: 'Mensagem de Saudação',
      sub: 'Boas-vindas automática',
      icon: Smartphone,
      color: '#059669',
      bg: '#ecfdf5',
      badge: saudacao.ativa ? 'Ativa' : 'Inativa',
      badgeSuccess: Boolean(saudacao.ativa)
    },
    {
      id: 'whatsapp',
      label: 'Contatos WhatsApp',
      sub: 'Menu flutuante rápido',
      icon: MessageCircle,
      color: '#10b981',
      bg: '#f0fdf4',
      badge: `${whatsappActiveCount}`
    }
  ]

  return (
    <div
      className="ad-admin-page-container ad-mobile-optimized"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', position: 'relative', paddingBottom: 32 }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .visually-hidden {
          position: absolute;
          clip-path: inset(50%);
          overflow: hidden;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          border: 0;
          white-space: nowrap;
        }
        .ad-ajustes-nav-btn {
          outline: none !important;
          box-shadow: none;
        }
        .ad-ajustes-nav-btn:focus-visible {
          outline: 2px solid #4f46e5 !important;
          outline-offset: 2px;
        }
        .ad-two-col-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.9fr);
          gap: 24px;
          align-items: start;
        }
        .ad-theme-swatches-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
          gap: 12px;
        }
        .ad-perms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 14px;
        }
        .ad-sticky-preview {
          position: sticky;
          top: 20px;
        }
        .ad-mobile-floating-save {
          display: none;
        }
        @media (max-width: 1120px) {
          .ad-two-col-grid {
            grid-template-columns: 1fr;
          }
          .ad-sticky-preview {
            position: static;
          }
        }
        @media (max-width: 768px) {
          .ad-ajustes-top-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 16px !important;
            gap: 14px !important;
            margin-bottom: 14px !important;
          }
          .ad-ajustes-top-actions {
            width: 100% !important;
            display: flex !important;
          }
          .ad-ajustes-top-actions button {
            flex: 1 !important;
            justify-content: center !important;
            min-height: 48px !important;
          }
          .ad-ajustes-layout {
            flex-direction: column !important;
            gap: 14px !important;
          }
          .ad-ajustes-sidebar {
            width: 100% !important;
            flex-direction: row !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            padding: 4px 2px 8px !important;
            gap: 8px !important;
            scrollbar-width: none;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }
          .ad-ajustes-sidebar::-webkit-scrollbar {
            display: none;
          }
          .ad-ajustes-nav-btn {
            flex-shrink: 0 !important;
            width: auto !important;
            min-height: 48px !important;
            padding: 8px 14px !important;
            border-radius: 14px !important;
          }
          .ad-ajustes-nav-sub {
            display: none !important;
          }
          .ad-ajustes-card-header {
            padding: 18px 16px !important;
          }
          .ad-ajustes-card-body {
            padding: 16px !important;
            gap: 18px !important;
          }
          .ad-perms-grid {
            grid-template-columns: 1fr !important;
          }
          .ad-theme-swatches-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .ad-ajustes-content input[type="text"],
          .ad-ajustes-content input[type="url"],
          .ad-ajustes-content select,
          .ad-ajustes-content textarea {
            font-size: 16px !important;
            min-height: 48px !important;
          }
          .ad-upload-actions-row {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .ad-upload-actions-row button,
          .ad-upload-actions-row label {
            width: 100% !important;
            justify-content: center !important;
            min-height: 48px !important;
          }
          .ad-mobile-floating-save {
            display: flex;
            position: fixed;
            left: 12px;
            right: 12px;
            bottom: 16px;
            z-index: 950;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(12px);
            padding: 12px 14px;
            border-radius: 16px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.14);
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
        }
        @media (max-width: 420px) {
          .ad-theme-swatches-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />

      {/* ══════════════════════════════════════════════════════════════════════════
          TOP HEADER BAR
      ══════════════════════════════════════════════════════════════════════════ */}
      <div
        className="ad-ajustes-top-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          marginBottom: 22,
          padding: '18px 24px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(12px)',
          borderRadius: 18,
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 6px 16px rgba(79, 70, 229, 0.25)'
            }}
          >
            <Sliders size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  fontFamily: 'Outfit, sans-serif',
                  margin: 0,
                  color: '#0f172a',
                  letterSpacing: '-0.02em'
                }}
              >
                Ajustes do Aplicativo
              </h2>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: hasUnsavedChanges ? '#fffbeb' : '#f0fdf4',
                  color: hasUnsavedChanges ? '#b45309' : '#15803d',
                  border: `1px solid ${hasUnsavedChanges ? '#fde68a' : '#bbf7d0'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: hasUnsavedChanges ? '#f59e0b' : '#22c55e'
                  }}
                />
                {hasUnsavedChanges ? 'Alterações pendentes' : 'Sincronizado'}
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: 13.5, margin: '2px 0 0 0' }}>
              Configurações globais de permissões, identidade visual, capa e automações da Agenda Digital.
            </p>
          </div>
        </div>

        <div className="ad-ajustes-top-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleDiscardChanges}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <RefreshCw size={14} /> Descartar
            </button>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            style={{
              padding: '11px 22px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 6px 18px rgba(79, 70, 229, 0.28)',
              opacity: isSaving ? 0.75 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            <Save size={16} />
            {isSaving ? 'Publicando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MAIN LAYOUT: SIDEBAR + CONTENT
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="ad-ajustes-layout" style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
        {/* Sidebar Navigation */}
        <nav
          aria-label="Seções de Ajustes"
          className="ad-ajustes-sidebar"
          style={{
            width: 268,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(12px)',
            padding: 10,
            borderRadius: 18,
            border: '1px solid rgba(226, 232, 240, 0.9)',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)'
          }}
        >
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className="ad-ajustes-nav-btn"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '11px 12px',
                  borderRadius: 13,
                  border: isActive ? `1.5px solid ${item.color}33` : '1.5px solid transparent',
                  background: isActive
                    ? `linear-gradient(135deg, ${item.bg} 0%, #ffffff 100%)`
                    : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  boxShadow: isActive ? '0 3px 10px rgba(15, 23, 42, 0.04)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: isActive ? item.color : item.bg,
                      color: isActive ? '#ffffff' : item.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <Icon size={17} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: isActive ? 800 : 600,
                        color: isActive ? '#0f172a' : '#334155',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      className="ad-ajustes-nav-sub"
                      style={{
                        fontSize: 11,
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {item.sub}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 12,
                      flexShrink: 0,
                      background: item.badgeWarn
                        ? '#fef3c7'
                        : item.badgeSuccess
                        ? '#dcfce7'
                        : isActive
                        ? item.color
                        : '#f1f5f9',
                      color: item.badgeWarn
                        ? '#b45309'
                        : item.badgeSuccess
                        ? '#15803d'
                        : isActive
                        ? '#ffffff'
                        : '#64748b'
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Content Area */}
        <div
          className="card ad-ajustes-content"
          style={{
            flex: 1,
            minWidth: 0,
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 30px rgba(15, 23, 42, 0.04)',
            overflow: 'hidden'
          }}
        >
          {/* ════════════════════════════════════════════════════════════════════
              ABA 1: PERMISSÕES E USO
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'permissoes' && (
            <div>
              <div
                className="ad-ajustes-card-header"
                style={{
                  padding: '24px 32px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                  background: 'linear-gradient(180deg, rgba(238, 242, 255, 0.5) 0%, rgba(255, 255, 255, 0) 100%)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: '#4f46e5',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Shield size={18} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                      Permissões das Famílias & Governança
                    </h3>
                  </div>
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13.5 }}>
                    Defina quais módulos, interações e proteções estão ativos no aplicativo dos alunos e responsáveis.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalConfig(p => ({
                        ...p,
                        permissoes: {
                          ...p.permissoes,
                          ambienteSeguroMomentos: true,
                          comentariosMural: true,
                          visualizarAniversariantes: true,
                          visualizarFinanceiro: true,
                          visualizarNotas: true,
                          visualizarFrequencia: true,
                          visualizarOcorrencias: true,
                          chamadaAlunoPortaria: true
                        }
                      }))
                      toast.info('Todas as permissões e proteções foram marcadas.')
                    }}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 10,
                      border: '1px solid #c7d2fe',
                      background: '#eef2ff',
                      color: '#4338ca',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Ativar Todos os Módulos
                  </button>
                </div>
              </div>

              <div className="ad-ajustes-card-body" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Destaque LGPD: Ambiente Seguro nos Momentos */}
                <div
                  style={{
                    borderRadius: 16,
                    padding: 20,
                    border:
                      localConfig.permissoes.ambienteSeguroMomentos !== false
                        ? '1.5px solid #c7d2fe'
                        : '1.5px solid #a7f3d0',
                    background:
                      localConfig.permissoes.ambienteSeguroMomentos !== false
                        ? 'linear-gradient(135deg, rgba(238, 242, 255, 0.7) 0%, rgba(255, 255, 255, 1) 100%)'
                        : 'linear-gradient(135deg, rgba(236, 253, 245, 0.7) 0%, rgba(255, 255, 255, 1) 100%)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: localConfig.permissoes.ambienteSeguroMomentos !== false ? '#4f46e5' : '#10b981',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {localConfig.permissoes.ambienteSeguroMomentos !== false ? <Lock size={20} /> : <Unlock size={20} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a' }}>
                          Ambiente Seguro nos Momentos (Proteção LGPD)
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 10px',
                            borderRadius: 12,
                            background: localConfig.permissoes.ambienteSeguroMomentos !== false ? '#e0e7ff' : '#d1fae5',
                            color: localConfig.permissoes.ambienteSeguroMomentos !== false ? '#3730a3' : '#065f46'
                          }}
                        >
                          {localConfig.permissoes.ambienteSeguroMomentos !== false
                            ? '🛡️ Prints & Downloads Bloqueados'
                            : '🔓 Salvar & Prints Liberados'}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                        {localConfig.permissoes.ambienteSeguroMomentos !== false
                          ? 'Bloqueia capturas de tela (prints), gravações e download direto de fotos e vídeos pelos familiares (em conformidade com a LGPD).'
                          : 'Ambiente seguro desativado: Os familiares têm permissão para salvar fotos, baixar vídeos e realizar capturas de tela das publicações.'}
                      </p>
                    </div>
                  </div>

                  <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, flexShrink: 0, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="visually-hidden"
                      checked={localConfig.permissoes.ambienteSeguroMomentos !== false}
                      onChange={e => updatePerm('ambienteSeguroMomentos', e.target.checked)}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: localConfig.permissoes.ambienteSeguroMomentos !== false ? '#4f46e5' : '#cbd5e1',
                        borderRadius: 26,
                        transition: '.3s'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          height: 20,
                          width: 20,
                          left: 3,
                          bottom: 3,
                          background: 'white',
                          transition: '.3s',
                          borderRadius: '50%',
                          transform: localConfig.permissoes.ambienteSeguroMomentos !== false ? 'translateX(22px)' : 'none',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      />
                    </span>
                  </label>
                </div>

                {/* Grid de Permissões */}
                <div className="ad-perms-grid">
                  {[
                    {
                      key: 'comentariosMural' as const,
                      title: 'Comentários no Mural (Momentos)',
                      desc: 'Habilita comentários dos responsáveis nas fotos e vídeos publicados pela escola.',
                      icon: Heart,
                      color: '#ec4899',
                      bg: '#fdf2f8'
                    },
                    {
                      key: 'visualizarAniversariantes' as const,
                      title: 'Aniversariantes do Mês',
                      desc: 'Exibe o mural comemorativo de aniversariantes da turma na área do aluno.',
                      icon: Sparkles,
                      color: '#f59e0b',
                      bg: '#fffbeb'
                    },
                    {
                      key: 'visualizarNotas' as const,
                      title: 'Boletim Escolar e Notas',
                      desc: 'Exibe notas bimestrais, avaliações parciais e desempenho acadêmico.',
                      icon: GraduationCap,
                      color: '#2563eb',
                      bg: '#eff6ff'
                    },
                    {
                      key: 'visualizarFrequencia' as const,
                      title: 'Frequência Escolar e Atestados',
                      desc: 'Mostra histórico de presença/faltas e permite envio de justificativas médicas.',
                      icon: CalendarCheck,
                      color: '#059669',
                      bg: '#ecfdf5'
                    },
                    {
                      key: 'visualizarOcorrencias' as const,
                      title: 'Ocorrências Disciplinares',
                      desc: 'Exibe registros comportamentais e pedagógicos lançados pela coordenação.',
                      icon: AlertTriangle,
                      color: '#ea580c',
                      bg: '#fff7ed'
                    },
                    {
                      key: 'visualizarFinanceiro' as const,
                      title: 'Painel Financeiro (Boletos e Pix)',
                      desc: 'Permite consultar mensalidades, copiar código Pix e baixar 2ª via de boletos.',
                      icon: CreditCard,
                      color: '#7c3aed',
                      bg: '#f5f3ff'
                    },
                    {
                      key: 'chamadaAlunoPortaria' as const,
                      title: 'Chamada Rápida na Portaria (Saída)',
                      desc: 'Habilita o botão "Estou Chegando" para agilizar a liberação do aluno na saída.',
                      icon: DoorOpen,
                      color: '#0284c7',
                      bg: '#f0f9ff'
                    }
                  ].map(item => {
                    const Icon = item.icon
                    const checked = Boolean(localConfig.permissoes[item.key])
                    return (
                      <div
                        key={item.key}
                        style={{
                          padding: 18,
                          borderRadius: 16,
                          border: checked ? '1.5px solid #e2e8f0' : '1.5px solid #f1f5f9',
                          background: checked ? '#ffffff' : '#f8fafc',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 14,
                          boxShadow: checked ? '0 2px 8px rgba(15, 23, 42, 0.03)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              background: item.bg,
                              color: item.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Icon size={18} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a', marginBottom: 3 }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>{item.desc}</div>
                          </div>
                        </div>

                        <label
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: 44,
                            height: 24,
                            flexShrink: 0,
                            cursor: 'pointer',
                            marginTop: 2
                          }}
                        >
                          <input
                            type="checkbox"
                            className="visually-hidden"
                            checked={checked}
                            onChange={e => updatePerm(item.key, e.target.checked)}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: checked ? '#10b981' : '#cbd5e1',
                              borderRadius: 24,
                              transition: '.3s'
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                height: 18,
                                width: 18,
                                left: 3,
                                bottom: 3,
                                background: 'white',
                                transition: '.3s',
                                borderRadius: '50%',
                                transform: checked ? 'translateX(20px)' : 'none',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                              }}
                            />
                          </span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              ABA 2: CHAT & AUTOATENDIMENTO
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'chat' && (
            <AdminChatSettingsManager
              localConfig={localConfig}
              setLocalConfig={setLocalConfig}
              onSave={async (newConfig: any) => {
                setLocalConfig(newConfig)
                setAdConfig(newConfig)
              }}
            />
          )}

          {/* ════════════════════════════════════════════════════════════════════
              ABA 3: NOTIFICAÇÕES PUSH
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notificacoes' && (
            <div>
              <div
                className="ad-ajustes-card-header"
                style={{
                  padding: '24px 32px',
                  borderBottom: '1px solid #e2e8f0',
                  background: 'linear-gradient(180deg, rgba(245, 243, 255, 0.6) 0%, rgba(255, 255, 255, 0) 100%)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 14
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Bell size={19} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                        Notificações Push em Tempo Real
                      </h3>
                      <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: 13.5 }}>
                        Controle quais eventos escolares disparam alertas instantâneos no celular das famílias.
                      </p>
                    </div>
                  </div>

                  <Link href="/agenda-digital/admin/push-teste" style={{ textDecoration: 'none' }}>
                    <button
                      type="button"
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: 'white',
                        border: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 16px',
                        borderRadius: 12,
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)'
                      }}
                    >
                      <Radio size={15} /> Simulador de Push <ArrowRight size={14} />
                    </button>
                  </Link>
                </div>
              </div>

              <div className="ad-ajustes-card-body" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
                {/* Master Switch: Pausa Global de Notificações */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 20,
                    background: (localConfig.notificacoes as any).pausarNotificacoes
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(239, 68, 68, 0.08) 100%)'
                      : '#f8fafc',
                    border: `1.5px solid ${(localConfig.notificacoes as any).pausarNotificacoes ? '#f59e0b' : '#e2e8f0'}`,
                    borderRadius: 16,
                    gap: 16
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: (localConfig.notificacoes as any).pausarNotificacoes ? '#f59e0b' : '#e0e7ff',
                        color: (localConfig.notificacoes as any).pausarNotificacoes ? 'white' : '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 16,
                        flexShrink: 0
                      }}
                    >
                      ⏸
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        Pausa Global de Notificações Push
                        {(localConfig.notificacoes as any).pausarNotificacoes && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f59e0b', color: 'white', fontWeight: 800 }}>
                            PAUSA ATIVA
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4, lineHeight: 1.45 }}>
                        Quando ativado, suspende temporariamente o envio de pushes aos celulares enquanto a equipe lança dados internos.
                        <strong style={{ display: 'block', marginTop: 2, color: (localConfig.notificacoes as any).pausarNotificacoes ? '#b45309' : '#64748b' }}>
                          ⚠️ Avisos gerados durante a pausa não são reenviados acumuladamente ao despausar.
                        </strong>
                      </div>
                    </div>
                  </div>

                  <label style={{ position: 'relative', display: 'inline-block', width: 50, height: 28, flexShrink: 0, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="visually-hidden"
                      checked={!!(localConfig.notificacoes as any).pausarNotificacoes}
                      onChange={async e => {
                        const willPause = e.target.checked
                        updateNotif('pausarNotificacoes' as any, willPause)
                        try {
                          const res = await fetch('/api/agenda/push/pause', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ paused: willPause })
                          })
                          if (res.ok) {
                            if (willPause) {
                              toast.warning('Notificações push foram PAUSADAS globalmente.')
                            } else {
                              toast.success('Notificações push RETOMADAS com sucesso!')
                            }
                          }
                        } catch {
                          toast.error('Erro ao sincronizar status de pausa.')
                        }
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: (localConfig.notificacoes as any).pausarNotificacoes ? '#f59e0b' : '#cbd5e1',
                        borderRadius: 28,
                        transition: '.3s'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          height: 22,
                          width: 22,
                          left: 3,
                          bottom: 3,
                          background: 'white',
                          transition: '.3s',
                          borderRadius: '50%',
                          transform: (localConfig.notificacoes as any).pausarNotificacoes ? 'translateX(22px)' : 'none',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      />
                    </span>
                  </label>
                </div>

                {/* Grid de Gatilhos de Push */}
                <div className="ad-perms-grid">
                  {[
                    {
                      key: 'pushComunicados' as const,
                      title: 'Novos Comunicados e Circulares',
                      desc: 'Alerta imediato sempre que a escola publicar um comunicado geral, para turma ou individual.',
                      icon: Bell,
                      color: '#4f46e5',
                      bg: '#eef2ff'
                    },
                    {
                      key: 'pushMomentos' as const,
                      title: 'Novas Fotos nos Momentos',
                      desc: 'Aumenta o engajamento avisando quando uma foto ou vídeo da turma é publicado.',
                      icon: Heart,
                      color: '#ec4899',
                      bg: '#fdf2f8'
                    },
                    {
                      key: 'pushFrequencia' as const,
                      title: 'Registro de Frequência / Faltas',
                      desc: 'Notifica o responsável quando a chamada diária é concluída com presença ou ausência.',
                      icon: CalendarCheck,
                      color: '#059669',
                      bg: '#ecfdf5'
                    },
                    {
                      key: 'pushNotas' as const,
                      title: 'Lançamento de Boletim e Notas',
                      desc: 'Avisa os responsáveis quando novas notas ou avaliações forem disponibilizadas.',
                      icon: GraduationCap,
                      color: '#2563eb',
                      bg: '#eff6ff'
                    },
                    {
                      key: 'pushOcorrencias' as const,
                      title: 'Ocorrências Pedagógicas / Disciplinares',
                      desc: 'Envia alerta quando a coordenação registrar uma observação relevante do aluno.',
                      icon: AlertTriangle,
                      color: '#ea580c',
                      bg: '#fff7ed'
                    },
                    {
                      key: 'pushFinanceiro' as const,
                      title: 'Alertas e Lembretes Financeiros',
                      desc: 'Notificações automáticas de vencimento próximo, faturas disponíveis ou cobranças.',
                      icon: CreditCard,
                      color: '#7c3aed',
                      bg: '#f5f3ff'
                    },
                    {
                      key: 'pushCalendario' as const,
                      title: 'Eventos do Calendário (Véspera)',
                      desc: 'Lembrete automático 1 dia antes de provas, reuniões, passeios ou feriados escolares.',
                      icon: Calendar,
                      color: '#0284c7',
                      bg: '#f0f9ff'
                    },
                    {
                      key: 'pushAlteracaoCalendario' as const,
                      title: 'Alterações de Datas no Calendário',
                      desc: 'Alerta em caso de remarcação ou atualização importante em eventos agendados.',
                      icon: RefreshCw,
                      color: '#d97706',
                      bg: '#fffbeb'
                    },
                    {
                      key: 'pushSaidaPortaria' as const,
                      title: 'Chamada de Portaria / Saída',
                      desc: 'Notifica equipe e família em tempo real durante o fluxo de retirada do aluno.',
                      icon: DoorOpen,
                      color: '#0d9488',
                      bg: '#f0fdfa'
                    }
                  ].map(item => {
                    const Icon = item.icon
                    const checked = Boolean(localConfig.notificacoes[item.key])
                    return (
                      <div
                        key={item.key}
                        style={{
                          padding: 18,
                          borderRadius: 16,
                          border: checked ? '1.5px solid #e2e8f0' : '1.5px solid #f1f5f9',
                          background: checked ? '#ffffff' : '#f8fafc',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 14
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              background: item.bg,
                              color: item.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Icon size={18} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a', marginBottom: 3 }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>{item.desc}</div>
                          </div>
                        </div>

                        <label
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: 44,
                            height: 24,
                            flexShrink: 0,
                            cursor: 'pointer',
                            marginTop: 2
                          }}
                        >
                          <input
                            type="checkbox"
                            className="visually-hidden"
                            checked={checked}
                            onChange={e => updateNotif(item.key, e.target.checked)}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: checked ? '#10b981' : '#cbd5e1',
                              borderRadius: 24,
                              transition: '.3s'
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                height: 18,
                                width: 18,
                                left: 3,
                                bottom: 3,
                                background: 'white',
                                transition: '.3s',
                                borderRadius: '50%',
                                transform: checked ? 'translateX(20px)' : 'none',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                              }}
                            />
                          </span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              ABA 4: PERSONALIZAÇÃO (CORES & CAPA) — ULTRA MODERNO
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'personalizacao' && (
            <div>
              <div
                className="ad-ajustes-card-header"
                style={{
                  padding: '24px 32px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                  background: 'linear-gradient(180deg, rgba(253, 242, 248, 0.65) 0%, rgba(255, 255, 255, 0) 100%)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #ec4899 0%, #6366f1 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 6px 14px rgba(236, 72, 153, 0.25)'
                    }}
                  >
                    <Palette size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                      Identidade Visual, Cores & Banner de Capa
                    </h3>
                    <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: 13.5 }}>
                      Personalize a imagem panorâmica do topo, a atmosfera de cores (Mesh) e o destaque visual da Agenda Digital.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 20,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#334155'
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: personalizacao.corPrimaria }} />
                  Tema: {selectedThemeObj.name}
                </div>
              </div>

              <div className="ad-ajustes-card-body" style={{ padding: 28 }}>
                <div className="ad-two-col-grid">
                  {/* COLUNA ESQUERDA: CONTROLES DE CAPA E CORES */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
                    {/* CARD 1: BANNER PRINCIPAL */}
                    <div
                      style={{
                        borderRadius: 18,
                        border: '1.5px solid #e2e8f0',
                        background: '#ffffff',
                        overflow: 'hidden',
                        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.02)'
                      }}
                    >
                      <div
                        style={{
                          padding: '16px 20px',
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 9,
                              background: '#eef2ff',
                              color: '#4f46e5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <ImageIcon size={18} />
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                              Imagem de Capa (Banner Panorâmico)
                            </h4>
                            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                              Exibido no topo de todas as páginas da Agenda Digital (Recomendado: 1600×400px).
                            </p>
                          </div>
                        </div>

                        <label
                          style={{ position: 'relative', display: 'inline-block', width: 46, height: 26, flexShrink: 0, cursor: 'pointer' }}
                          title="Exibir ou ocultar banner no topo"
                        >
                          <input
                            type="checkbox"
                            className="visually-hidden"
                            checked={personalizacao.exibirBanner !== false}
                            onChange={e => updatePersonalizacao({ exibirBanner: e.target.checked })}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: personalizacao.exibirBanner !== false ? '#10b981' : '#cbd5e1',
                              borderRadius: 26,
                              transition: '.3s'
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                height: 20,
                                width: 20,
                                left: 3,
                                bottom: 3,
                                background: 'white',
                                transition: '.3s',
                                borderRadius: '50%',
                                transform: personalizacao.exibirBanner !== false ? 'translateX(20px)' : 'none'
                              }}
                            />
                          </span>
                        </label>
                      </div>

                      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Input oculto acessível para upload */}
                        <input
                          id="ad-banner-upload-input"
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          className="visually-hidden"
                          onChange={handleFileUpload}
                        />

                        {/* Gerenciador Inteligente da Imagem (Sem Base64 poluindo input!) */}
                        {localBanner ? (
                          <div
                            style={{
                              padding: 16,
                              borderRadius: 14,
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  <CheckCircle2 size={18} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>
                                    {isBannerBase64
                                      ? 'Banner enviado do dispositivo (Otimizado em WebP HD)'
                                      : 'Banner vinculado via URL Externa'}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11.5,
                                      color: '#64748b',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: 360
                                    }}
                                  >
                                    {isBannerBase64
                                      ? 'Imagem comprimida automaticamente para carregamento instantâneo'
                                      : localBanner}
                                  </div>
                                </div>
                              </div>

                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: '3px 9px',
                                  borderRadius: 12,
                                  background: '#e0e7ff',
                                  color: '#4338ca'
                                }}
                              >
                                1600×400px • Ativo
                              </span>
                            </div>

                            <div className="ad-upload-actions-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <label
                                htmlFor="ad-banner-upload-input"
                                style={{
                                  padding: '9px 14px',
                                  borderRadius: 10,
                                  background: '#4f46e5',
                                  color: '#ffffff',
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <Upload size={14} /> {isUploadingBanner ? 'Otimizando...' : 'Substituir Imagem'}
                              </label>

                              <button
                                type="button"
                                onClick={() => setShowExternalBannerUrl(v => !v)}
                                style={{
                                  padding: '9px 14px',
                                  borderRadius: 10,
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <Link2 size={14} /> Usar URL Externa
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setLocalBanner(null)
                                  toast.info('Imagem de capa removida. Clique em Salvar Alterações para confirmar.')
                                }}
                                style={{
                                  padding: '9px 14px',
                                  borderRadius: 10,
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  marginLeft: 'auto'
                                }}
                              >
                                <Trash2 size={14} /> Remover Capa
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label
                            htmlFor="ad-banner-upload-input"
                            style={{
                              padding: '28px 20px',
                              borderRadius: 16,
                              border: '2px dashed #c7d2fe',
                              background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              cursor: 'pointer',
                              gap: 8
                            }}
                          >
                            <div
                              style={{
                                width: 46,
                                height: 46,
                                borderRadius: 14,
                                background: '#eef2ff',
                                color: '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Upload size={22} />
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                              Clique para enviar o Banner de Capa do computador
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              PNG, JPG ou WebP • Otimização automática para carregamento rápido (1600×400px)
                            </div>
                          </label>
                        )}

                        {/* Campo opcional de URL Externa (Nunca mostra string data:image/...) */}
                        {(showExternalBannerUrl || (!localBanner && !isBannerBase64)) && (
                          <div>
                            <label
                              htmlFor="ad-banner-external-url"
                              style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}
                            >
                              Ou cole o endereço (URL) direto de uma imagem hospedada:
                            </label>
                            <input
                              id="ad-banner-external-url"
                              type="url"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              placeholder="https://suaescola.com.br/banners/capa-2026.webp"
                              value={isBannerBase64 ? '' : localBanner || ''}
                              onChange={e => setLocalBanner(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: 10,
                                border: '1px solid #cbd5e1',
                                fontSize: 13.5,
                                color: '#0f172a',
                                background: '#f8fafc',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        )}

                        {/* Opções de Enquadramento e Altura */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                          <div>
                            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                              Ajuste da Imagem no Topo:
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {[
                                { id: 'cover', label: 'Preencher (Cover)' },
                                { id: 'contain', label: 'Inteira (Contain)' }
                              ].map(opt => {
                                const active = personalizacao.ajusteBanner === opt.id
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => updatePersonalizacao({ ajusteBanner: opt.id as any })}
                                    style={{
                                      flex: 1,
                                      padding: '8px 10px',
                                      borderRadius: 10,
                                      border: active ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                                      background: active ? '#eef2ff' : '#ffffff',
                                      color: active ? '#4338ca' : '#475569',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          <div>
                            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                              Altura do Banner (Desktop):
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {[
                                { id: 'compacto', label: 'Compacto' },
                                { id: 'padrao', label: 'Padrão' },
                                { id: 'expandido', label: 'Amplo' }
                              ].map(opt => {
                                const active = personalizacao.alturaBanner === opt.id
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => updatePersonalizacao({ alturaBanner: opt.id as any })}
                                    style={{
                                      flex: 1,
                                      padding: '8px 8px',
                                      borderRadius: 10,
                                      border: active ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                                      background: active ? '#eef2ff' : '#ffffff',
                                      color: active ? '#4338ca' : '#475569',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CARD 2: PALETA DE CORES & ATMOSFERA MESH */}
                    <div
                      style={{
                        borderRadius: 18,
                        border: '1.5px solid #e2e8f0',
                        background: '#ffffff',
                        overflow: 'hidden',
                        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.02)'
                      }}
                    >
                      <div
                        style={{
                          padding: '16px 20px',
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 9,
                            background: '#fdf2f8',
                            color: '#db2777',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Wand2 size={18} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                            Paleta de Cores & Atmosfera Visual
                          </h4>
                          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                            Escolha o tema de iluminação de fundo (Mesh Gradient) e a cor de destaque da escola.
                          </p>
                        </div>
                      </div>

                      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div className="ad-theme-swatches-grid">
                          {MESH_THEMES.map(theme => {
                            const isSelected = personalizacao.temaMesh === theme.id
                            return (
                              <button
                                key={theme.id}
                                type="button"
                                onClick={() =>
                                  updatePersonalizacao({
                                    temaMesh: theme.id as any,
                                    corPrimaria: theme.primary
                                  })
                                }
                                style={{
                                  padding: 12,
                                  borderRadius: 14,
                                  border: isSelected ? `2px solid ${theme.primary}` : '1.5px solid #e2e8f0',
                                  background: isSelected ? '#f8fafc' : '#ffffff',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                  transition: 'all 0.15s ease',
                                  boxShadow: isSelected ? `0 4px 14px ${theme.primary}22` : 'none'
                                }}
                              >
                                <div
                                  style={{
                                    height: 38,
                                    width: '100%',
                                    borderRadius: 9,
                                    background: theme.previewBg,
                                    border: '1px solid rgba(15,23,42,0.06)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0 10px',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: '50%',
                                      background: theme.primary,
                                      boxShadow: '0 0 0 2px #ffffff'
                                    }}
                                  />
                                  {isSelected && (
                                    <span
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        background: '#ffffff',
                                        color: theme.primary,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <Check size={13} strokeWidth={3} />
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{theme.name}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>{theme.desc}</div>
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {/* Cor Primária Customizada */}
                        <div
                          style={{
                            padding: '14px 16px',
                            borderRadius: 12,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 12
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Cor Institucional de Destaque</div>
                            <div style={{ fontSize: 11.5, color: '#64748b' }}>
                              Usada em botões principais, selos e indicadores ativos.
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                              type="color"
                              aria-label="Selecionar cor institucional"
                              value={personalizacao.corPrimaria || '#4f46e5'}
                              onChange={e => updatePersonalizacao({ corPrimaria: e.target.value })}
                              style={{
                                width: 38,
                                height: 38,
                                border: 'none',
                                borderRadius: 10,
                                cursor: 'pointer',
                                background: 'transparent',
                                padding: 0
                              }}
                            />
                            <input
                              type="text"
                              aria-label="Código hexadecimal da cor institucional"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              value={personalizacao.corPrimaria || '#4f46e5'}
                              onChange={e => updatePersonalizacao({ corPrimaria: e.target.value })}
                              style={{
                                width: 96,
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid #cbd5e1',
                                fontSize: 13,
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                color: '#0f172a',
                                background: '#ffffff'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* COLUNA DIREITA: SIMULADOR INTERATIVO DESKTOP / MOBILE */}
                  <div className="ad-sticky-preview">
                    <div
                      style={{
                        borderRadius: 18,
                        border: '1.5px solid #e2e8f0',
                        background: '#f8fafc',
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Eye size={15} color={personalizacao.corPrimaria} />
                          <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                            Simulador em Tempo Real
                          </span>
                        </div>

                        <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 10, gap: 2 }}>
                          <button
                            type="button"
                            onClick={() => setBannerPreviewMode('desktop')}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: 'none',
                              background: bannerPreviewMode === 'desktop' ? '#ffffff' : 'transparent',
                              color: bannerPreviewMode === 'desktop' ? '#0f172a' : '#64748b',
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            <Monitor size={13} /> Desktop
                          </button>
                          <button
                            type="button"
                            onClick={() => setBannerPreviewMode('mobile')}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: 'none',
                              background: bannerPreviewMode === 'mobile' ? '#ffffff' : 'transparent',
                              color: bannerPreviewMode === 'mobile' ? '#0f172a' : '#64748b',
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            <Smartphone size={13} /> Mobile
                          </button>
                        </div>
                      </div>

                      {/* Mockup Frame */}
                      <div
                        style={{
                          width: bannerPreviewMode === 'mobile' ? 280 : '100%',
                          margin: '0 auto',
                          borderRadius: bannerPreviewMode === 'mobile' ? 26 : 16,
                          border: bannerPreviewMode === 'mobile' ? '6px solid #0f172a' : '1px solid #cbd5e1',
                          background: selectedThemeObj.previewBg,
                          overflow: 'hidden',
                          boxShadow: '0 14px 32px rgba(15, 23, 42, 0.1)',
                          transition: 'all 0.25s ease'
                        }}
                      >
                        {/* Top Browser / Phone Bar */}
                        <div
                          style={{
                            background: '#0a0f24',
                            padding: '7px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div style={{ display: 'flex', gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                            {bannerPreviewMode === 'mobile' ? 'App da Família' : 'Agenda Digital Web'}
                          </span>
                          <span style={{ width: 20 }} />
                        </div>

                        {/* Banner Preview Area */}
                        {personalizacao.exibirBanner !== false && localBanner ? (
                          <div
                            style={{
                              width: '100%',
                              aspectRatio: '1600 / 400',
                              background: '#0A0F24',
                              overflow: 'hidden'
                            }}
                          >
                            <img
                              src={localBanner}
                              alt="Preview da Capa"
                              style={{
                                display: 'block',
                                width: '100%',
                                height: '100%',
                                objectFit: personalizacao.ajusteBanner || 'cover'
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: '14px',
                              background: '#0A0F24',
                              color: 'rgba(255,255,255,0.65)',
                              fontSize: 11,
                              textAlign: 'center',
                              fontWeight: 600
                            }}
                          >
                            {personalizacao.exibirBanner === false
                              ? 'Banner de capa ocultado nas configurações'
                              : 'Sem imagem de capa definida'}
                          </div>
                        )}

                        {/* Simulated Content Inside Frame */}
                        <div style={{ padding: 14, background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)' }}>
                          <div
                            style={{
                              background: '#ffffff',
                              borderRadius: 12,
                              padding: '10px 12px',
                              border: '1px solid rgba(226,232,240,0.9)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              marginBottom: 10
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  background: personalizacao.corPrimaria,
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  fontWeight: 900
                                }}
                              >
                                AD
                              </div>
                              <div>
                                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>Área da Família</div>
                                <div style={{ fontSize: 9.5, color: '#64748b' }}>Colégio Impacto</div>
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 8,
                                background: personalizacao.corPrimaria,
                                color: '#ffffff'
                              }}
                            >
                              Mural Ativo
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 8
                            }}
                          >
                            <div style={{ background: '#ffffff', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                              <div style={{ width: 28, height: 5, borderRadius: 4, background: personalizacao.corPrimaria, marginBottom: 6 }} />
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0f172a' }}>Comunicados</div>
                              <div style={{ fontSize: 9.5, color: '#64748b' }}>Avisos da turma</div>
                            </div>
                            <div style={{ background: '#ffffff', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                              <div style={{ width: 28, height: 5, borderRadius: 4, background: '#10b981', marginBottom: 6 }} />
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0f172a' }}>Momentos</div>
                              <div style={{ fontSize: 9.5, color: '#64748b' }}>Galeria escolar</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: 11.5, color: '#64748b', textAlign: 'center', lineHeight: 1.4 }}>
                        Alterne entre <strong>Desktop</strong> e <strong>Mobile</strong> acima para conferir o enquadramento da arte em diferentes telas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              ABA 5: MENSAGEM DE SAUDAÇÃO — ULTRA MODERNO & FUNCIONAL
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'saudacao' && (
            <div>
              <div
                className="ad-ajustes-card-header"
                style={{
                  padding: '24px 32px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                  background: 'linear-gradient(180deg, rgba(236, 253, 245, 0.65) 0%, rgba(255, 255, 255, 0) 100%)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 6px 14px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                      Mensagem de Saudação (Boas-Vindas ao Novo Aluno)
                    </h3>
                    <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: 13.5 }}>
                      Gera automaticamente um comunicado especial de boas-vindas assim que um novo aluno é matriculado/cadastrado.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    background: saudacao.ativa ? '#dcfce7' : '#f1f5f9',
                    border: `1px solid ${saudacao.ativa ? '#bbf7d0' : '#e2e8f0'}`,
                    color: saudacao.ativa ? '#166534' : '#64748b',
                    fontSize: 12,
                    fontWeight: 800
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: saudacao.ativa ? '#16a34a' : '#94a3b8' }} />
                  {saudacao.ativa ? 'Disparo Automático Ativo' : 'Disparo Desativado'}
                </div>
              </div>

              <div className="ad-ajustes-card-body" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
                {/* Main Toggle Card */}
                <div
                  style={{
                    padding: '18px 22px',
                    borderRadius: 16,
                    border: saudacao.ativa ? '1.5px solid #a7f3d0' : '1.5px solid #e2e8f0',
                    background: saudacao.ativa
                      ? 'linear-gradient(135deg, rgba(236, 253, 245, 0.7) 0%, #ffffff 100%)'
                      : '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a', marginBottom: 2 }}>
                      Ativar Mensagem de Saudação Automática
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Quando ativado, todo novo aluno cadastrado recebe imediatamente este comunicado em seu mural individual.
                    </div>
                  </div>

                  <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, flexShrink: 0, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="visually-hidden"
                      checked={Boolean(saudacao.ativa)}
                      onChange={e => updateSaudacao({ ativa: e.target.checked })}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: saudacao.ativa ? '#10b981' : '#cbd5e1',
                        borderRadius: 26,
                        transition: '.3s'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          height: 20,
                          width: 20,
                          left: 3,
                          bottom: 3,
                          background: 'white',
                          transition: '.3s',
                          borderRadius: '50%',
                          transform: saudacao.ativa ? 'translateX(22px)' : 'none',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      />
                    </span>
                  </label>
                </div>

                {saudacao.ativa && (
                  <div className="ad-two-col-grid">
                    {/* COLUNA ESQUERDA: EDITOR E ANEXO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                      {/* Modelos Prontos (Templates) */}
                      <div
                        style={{
                          padding: 16,
                          borderRadius: 16,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Wand2 size={14} color="#4f46e5" /> Modelos Prontos de Boas-Vindas (Aplicar com 1 clique):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {GREETING_TEMPLATES.map(tpl => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => {
                                updateSaudacao({ titulo: tpl.titulo, mensagem: tpl.mensagem })
                                toast.success(`Modelo "${tpl.label}" aplicado!`)
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 20,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#334155',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {tpl.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Campos de Texto e Variáveis */}
                      <div
                        style={{
                          padding: 20,
                          borderRadius: 16,
                          border: '1.5px solid #e2e8f0',
                          background: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 16
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                          <div>
                            <label
                              htmlFor="ad-saudacao-titulo"
                              style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}
                            >
                              Título do Comunicado:
                            </label>
                            <input
                              id="ad-saudacao-titulo"
                              type="text"
                              value={saudacao.titulo || ''}
                              onChange={e => updateSaudacao({ titulo: e.target.value })}
                              placeholder="Ex: Bem-vindo à nossa escola!"
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: 10,
                                border: '1px solid #cbd5e1',
                                fontSize: 13.5,
                                fontWeight: 600,
                                color: '#0f172a',
                                background: '#f8fafc',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="ad-saudacao-cargo"
                              style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}
                            >
                              Assinatura / Cargo Remetente:
                            </label>
                            <select
                              id="ad-saudacao-cargo"
                              value={saudacao.autorCargo || 'Diretor Geral'}
                              onChange={e => updateSaudacao({ autorCargo: e.target.value })}
                              style={{
                                width: '100%',
                                height: 41,
                                padding: '0 12px',
                                borderRadius: 10,
                                border: '1px solid #cbd5e1',
                                fontSize: 13.5,
                                fontWeight: 600,
                                color: '#0f172a',
                                background: '#f8fafc',
                                cursor: 'pointer',
                                boxSizing: 'border-box'
                              }}
                            >
                              <option value="Diretor Geral">Diretor Geral</option>
                              <option value="Direção Escolar">Direção Escolar</option>
                              <option value="Coordenação Pedagógica">Coordenação Pedagógica</option>
                              <option value="Secretaria Escolar">Secretaria Escolar</option>
                              <option value="Equipe Colégio Impacto">Equipe Colégio Impacto</option>
                            </select>
                          </div>
                        </div>

                        {/* Corpo da Mensagem + Chips de Variáveis */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label
                              htmlFor="ad-saudacao-mensagem"
                              style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', margin: 0 }}
                            >
                              Corpo da Mensagem de Boas-Vindas:
                            </label>
                            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                              {(saudacao.mensagem || '').length} caracteres
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 700 }}>Inserir variável dinâmica:</span>
                            {[
                              { tag: '{nome_aluno}', desc: 'Nome do aluno' },
                              { tag: '{nome_responsavel}', desc: 'Nome do responsável' },
                              { tag: '{turma}', desc: 'Turma do aluno' },
                              { tag: '{ano_letivo}', desc: 'Ano letivo atual' }
                            ].map(v => (
                              <button
                                key={v.tag}
                                type="button"
                                onClick={() => insertSaudacaoVar(v.tag)}
                                title={`Inserir ${v.desc}`}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  border: '1px solid #bfdbfe',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontSize: 11.5,
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                + {v.tag}
                              </button>
                            ))}
                          </div>

                          <textarea
                            id="ad-saudacao-mensagem"
                            ref={saudacaoTextareaRef}
                            rows={5}
                            value={saudacao.mensagem || ''}
                            onChange={e => updateSaudacao({ mensagem: e.target.value })}
                            placeholder="Escreva a mensagem de acolhimento para o aluno e sua família..."
                            style={{
                              width: '100%',
                              padding: '12px 14px',
                              borderRadius: 12,
                              border: '1px solid #cbd5e1',
                              fontSize: 13.5,
                              color: '#0f172a',
                              background: '#f8fafc',
                              lineHeight: 1.55,
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* Comportamento do Comunicado (Fixar / Ciência / Resposta) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                          {[
                            {
                              key: 'fixado' as const,
                              label: 'Fixar no Topo',
                              sub: 'Destaque no mural',
                              icon: Pin,
                              checked: saudacao.fixado !== false
                            },
                            {
                              key: 'exigeCiencia' as const,
                              label: 'Exigir Ciência',
                              sub: 'Botão de confirmação',
                              icon: FileCheck2,
                              checked: Boolean(saudacao.exigeCiencia)
                            },
                            {
                              key: 'permiteResposta' as const,
                              label: 'Permitir Resposta',
                              sub: 'Família pode responder',
                              icon: Reply,
                              checked: saudacao.permiteResposta !== false
                            }
                          ].map(opt => {
                            const Icon = opt.icon
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => updateSaudacao({ [opt.key]: !opt.checked })}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: 12,
                                  border: opt.checked ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                                  background: opt.checked ? '#ecfdf5' : '#f8fafc',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <Icon size={15} color={opt.checked ? '#059669' : '#64748b'} />
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{opt.label}</div>
                                    <div style={{ fontSize: 10.5, color: '#64748b' }}>{opt.sub}</div>
                                  </div>
                                </div>
                                <div
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    background: opt.checked ? '#10b981' : '#cbd5e1',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  {opt.checked && <Check size={11} strokeWidth={3} />}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Card de Imagem / Cartão de Boas-Vindas (Sem Base64 poluindo input!) */}
                      <div
                        style={{
                          padding: 20,
                          borderRadius: 16,
                          border: '1.5px solid #e2e8f0',
                          background: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14
                        }}
                      >
                        <div>
                          <h4 style={{ margin: '0 0 2px 0', fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
                            Arte / Cartão Visual de Boas-Vindas (Opcional)
                          </h4>
                          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                            Anexe um cartão ilustrado ou flyer institucional que será exibido junto ao comunicado.
                          </p>
                        </div>

                        <input
                          id="ad-saudacao-upload-input"
                          type="file"
                          accept="image/*"
                          ref={saudacaoFileInputRef}
                          className="visually-hidden"
                          onChange={handleSaudacaoFileUpload}
                        />

                        {saudacao.imagemUrl ? (
                          <div
                            style={{
                              padding: 14,
                              borderRadius: 14,
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <img
                                src={saudacao.imagemUrl}
                                alt="Miniatura Saudação"
                                style={{
                                  width: 56,
                                  height: 56,
                                  borderRadius: 10,
                                  objectFit: 'cover',
                                  border: '1px solid #cbd5e1',
                                  flexShrink: 0,
                                  background: '#ffffff'
                                }}
                              />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                                  {isSaudacaoImgBase64
                                    ? 'Cartão de Boas-Vindas Carregado (WebP Otimizado)'
                                    : 'Imagem vinculada por URL Externa'}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11.5,
                                    color: '#64748b',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                >
                                  {isSaudacaoImgBase64
                                    ? 'Anexo pronto para envio automático nos comunicados de matrícula'
                                    : saudacao.imagemUrl}
                                </div>
                              </div>
                            </div>

                            <div className="ad-upload-actions-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <label
                                htmlFor="ad-saudacao-upload-input"
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: 10,
                                  background: '#059669',
                                  color: '#ffffff',
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <Upload size={14} /> {isUploadingSaudacao ? 'Processando...' : 'Trocar Imagem'}
                              </label>

                              <button
                                type="button"
                                onClick={() => setShowExternalSaudacaoUrl(v => !v)}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: 10,
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <Link2 size={14} /> Usar URL Externa
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  updateSaudacao({ imagemUrl: '' })
                                  toast.info('Imagem de saudação removida.')
                                }}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: 10,
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  marginLeft: 'auto'
                                }}
                              >
                                <Trash2 size={14} /> Remover Anexo
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="ad-upload-actions-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <label
                              htmlFor="ad-saudacao-upload-input"
                              style={{
                                flex: 1,
                                padding: '18px 16px',
                                borderRadius: 14,
                                border: '1.5px dashed #a7f3d0',
                                background: '#f0fdf4',
                                color: '#065f46',
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                              }}
                            >
                              <Upload size={17} /> Enviar Imagem do Computador
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowExternalSaudacaoUrl(v => !v)}
                              style={{
                                padding: '18px 16px',
                                borderRadius: 14,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#334155',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6
                              }}
                            >
                              <Link2 size={16} /> Inserir URL
                            </button>
                          </div>
                        )}

                        {showExternalSaudacaoUrl && (
                          <div>
                            <label
                              htmlFor="ad-saudacao-external-url"
                              style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}
                            >
                              URL direta da imagem de boas-vindas:
                            </label>
                            <input
                              id="ad-saudacao-external-url"
                              type="url"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              placeholder="https://suaescola.com.br/boas-vindas.jpg"
                              value={isSaudacaoImgBase64 ? '' : saudacao.imagemUrl || ''}
                              onChange={e => updateSaudacao({ imagemUrl: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: 10,
                                border: '1px solid #cbd5e1',
                                fontSize: 13.5,
                                color: '#0f172a',
                                background: '#f8fafc',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* COLUNA DIREITA: PREVIEW AO VIVO DO COMUNICADO */}
                    <div className="ad-sticky-preview">
                      <div
                        style={{
                          borderRadius: 18,
                          border: '1.5px solid #e2e8f0',
                          background: '#f8fafc',
                          padding: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Eye size={15} color="#059669" />
                            <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                              Simulação no App da Família
                            </span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>Aluno: Lucas Gabriel</span>
                        </div>

                        {/* Simulated Comunicado Card */}
                        <div
                          style={{
                            background: '#ffffff',
                            borderRadius: 18,
                            border: '1px solid #e2e8f0',
                            overflow: 'hidden',
                            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.07)'
                          }}
                        >
                          {/* Card Top Header */}
                          <div
                            style={{
                              padding: '14px 16px',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: 13
                                }}
                              >
                                IR
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                                  {saudacao.autorCargo || 'Diretor Geral'}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Colégio Impacto • Agora mesmo</div>
                              </div>
                            </div>

                            {saudacao.fixado !== false && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: 10,
                                  background: '#eef2ff',
                                  color: '#4f46e5',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Pin size={11} /> Fixado
                              </span>
                            )}
                          </div>

                          {/* Card Body */}
                          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <h5 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                              {formatSaudacaoPreview(saudacao.titulo || 'Bem-vindo à nossa escola!')}
                            </h5>

                            <div
                              style={{
                                fontSize: 13,
                                color: '#334155',
                                lineHeight: 1.55,
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {formatSaudacaoPreview(saudacao.mensagem)}
                            </div>

                            {saudacao.imagemUrl && (
                              <div
                                style={{
                                  marginTop: 4,
                                  borderRadius: 14,
                                  overflow: 'hidden',
                                  border: '1px solid #e2e8f0',
                                  background: '#0f172a',
                                  maxHeight: 340,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <img
                                  src={saudacao.imagemUrl}
                                  alt="Cartão de Boas-Vindas"
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    maxHeight: 340,
                                    objectFit: 'contain'
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Card Footer Actions */}
                          {(saudacao.exigeCiencia || saudacao.permiteResposta !== false) && (
                            <div
                              style={{
                                padding: '10px 16px',
                                background: '#f8fafc',
                                borderTop: '1px solid #f1f5f9',
                                display: 'flex',
                                gap: 8
                              }}
                            >
                              {saudacao.exigeCiencia && (
                                <div
                                  style={{
                                    flex: 1,
                                    padding: '7px 10px',
                                    borderRadius: 8,
                                    background: '#10b981',
                                    color: '#ffffff',
                                    fontSize: 11.5,
                                    fontWeight: 800,
                                    textAlign: 'center'
                                  }}
                                >
                                  ✓ Confirmar Ciência
                                </div>
                              )}
                              {saudacao.permiteResposta !== false && (
                                <div
                                  style={{
                                    flex: 1,
                                    padding: '7px 10px',
                                    borderRadius: 8,
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    color: '#334155',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    textAlign: 'center'
                                  }}
                                >
                                  💬 Responder Escola
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              ABA 6: CONTATOS WHATSAPP
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'whatsapp' && (
            <AdminWhatsAppContactsManager
              localConfig={localConfig}
              setLocalConfig={setLocalConfig}
              onSave={(newConfig: any) => {
                setAdConfig(newConfig)
                fetch('/api/configuracoes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chave: 'ad_config', valor: newConfig })
                }).catch(console.error)
              }}
            />
          )}
        </div>
      </div>

      {/* Barra Flutuante Mobile quando há alterações pendentes */}
      {hasUnsavedChanges && (
        <div className="ad-mobile-floating-save">
          <div style={{ color: '#ffffff', fontSize: 12.5, fontWeight: 700 }}>
            Alterações não salvas
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleDiscardChanges}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'transparent',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700
              }}
            >
              Descartar
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Save size={14} /> {isSaving ? '...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
