'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, MonitorSmartphone, X } from 'lucide-react'

import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useSaida } from '@/lib/saidaContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { SelectedStudentProvider } from '@/lib/selectedStudentContext'
import { getAlunoTurnoDisplay, isAlunoIntegralIntermediario } from '@/lib/studentTurmaUtils'
import { getInitials } from '@/lib/utils'
import { performLogout } from '@/lib/auth/logout'
import { hideSplashScreen } from '@/lib/capacitor/splash'
import { LoadingGlass } from '@/components/LoadingGlass'

import { StudentHeaderCard } from './components/StudentHeaderCard'
import { StudentCallController } from './components/StudentCallController'
import { AgendaNavigationTabBar } from './components/AgendaNavigationTabBar'

// Estilos extraídos do monólito para CSS modularizado e otimizado
import './agenda-layout.css'

function PortalWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

export default function ADInnerLayout({ 
  children,
  params 
}: { 
  children: React.ReactNode, 
  params: any
}) {
  const queryClient = useQueryClient()
  const [profileData, setProfileData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const { turmas = [] } = useData()
  const [grupos = []] = useSupabaseArray<any>('agenda/grupos')
  const { adConfig, setAdLoading } = useAgendaDigital()
  const { currentUser, hydrated, setLoadingPath } = useApp()
  const { activeCalls = [] } = useSaida()
  
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramsHook = useParams<{ slug: string }>()
  const resolvedParams = paramsHook || (params as any)

  const isMirroringAluno = searchParams?.get('espelhar_aluno') === 'true'
  const espelharRespId = searchParams?.get('espelhar_responsavel')
  const espelharColabId = searchParams?.get('espelhar_colaborador')
  const isMirrorModeActive = !!isMirroringAluno || !!espelharRespId || !!espelharColabId

  // Intercepta rotas genéricas de push notification (ex: /agenda-digital/comunicados)
  const isGenericModule = ['comunicados', 'momentos', 'calendario', 'frequencia', 'ocorrencias', 'notas'].includes(resolvedParams?.slug || '')
  
  useEffect(() => {
    if (isGenericModule && typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      sp.set('redirect', resolvedParams.slug)
      router.replace(`/agenda-digital?${sp.toString()}`)
    }
  }, [isGenericModule, resolvedParams?.slug, router])

  if (isGenericModule) {
    return <LoadingGlass />
  }

  const baseRespId = (currentUser as any)?.responsavel_id || (currentUser as any)?.dados?.responsavel_id || (currentUser as any)?.user_metadata?.responsavel_id || currentUser?.id || ''
  const respId = espelharRespId || baseRespId
  const isAlunoLogado = isMirroringAluno || currentUser?.cargo === 'Aluno'
  const isMirrorMode = currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Gestor' || currentUser?.perfil === 'Direção' || currentUser?.perfil === 'Secretaria'

  useEffect(() => {
    if (hydrated) {
      hideSplashScreen(300)
    }
  }, [hydrated])

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
        
        const contentType = res.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          return
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          console.error(data.error)
          return
        }

        const data = await res.json()
        setProfileData(data)
      } catch(e) {
        console.error('Failed to load profile data:', e)
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [hydrated, currentUser, resolvedParams?.slug, respId, isAlunoLogado, pathname, router])

  useEffect(() => {
    if (setAdLoading) setAdLoading(isLoading)
    return () => { if (setAdLoading) setAdLoading(false) }
  }, [isLoading, setAdLoading])

  // Trava scroll do body quando modal estiver aberto
  useEffect(() => {
    if (switcherOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [switcherOpen])

  const aluno = profileData?.aluno || null
  const vinculo = profileData?.vinculo || null
  const meusAlunos = profileData?.meusAlunos || []

  const cleanTurma = useMemo(() => {
    if (!aluno) return 'S/T'
    if (aluno.turma_nome && aluno.turma_nome !== aluno.turma) {
      return aluno.turma_nome.split('-')[0].trim()
    }
    const turmaObj = (turmas || []).find(t => t && (String(t.id) === String(aluno.turma) || String(t.codigo) === String(aluno.turma) || String(t.nome) === String(aluno.turma)))
    const nomeTurma = turmaObj?.nome || aluno.turma_nome || aluno.turma || 'S/T'
    return nomeTurma.split('-')[0].trim()
  }, [aluno, turmas])

  const cleanTurno = getAlunoTurnoDisplay(aluno, turmas, grupos)

  const userAccessRole = useMemo(() => {
    if (!isMirrorModeActive && (currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Gestor' || currentUser?.perfil === 'Direção' || currentUser?.perfil === 'Secretaria')) {
      return { isFin: true, isPed: true, parentesco: currentUser.perfil }
    }
    if (!vinculo) return { isFin: false, isPed: false, parentesco: 'Responsável' }
    return {
      isFin: !!vinculo.resp_financeiro,
      isPed: !!vinculo.resp_pedagogico,
      parentesco: vinculo.parentesco || 'Responsável'
    }
  }, [vinculo, currentUser, isMirrorModeActive])

  const handleLogout = useCallback(async () => {
    setLoadingPath('logout')
    await performLogout()
  }, [setLoadingPath])

  return (
    <>
      {/* Banner de Modo Espelhar (Administração) */}
      {isMirrorModeActive && (
        <div style={{
          position: 'sticky', top: 0, left: 0, right: 0, zIndex: 10000,
          background: 'rgba(239, 68, 68, 0.95)', backdropFilter: 'blur(12px)',
          color: '#fff', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Modo Visualização (Espelhar Agenda)</h4>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>Você está visualizando o aplicativo como outro usuário. Ações que modificam dados estão restritas.</p>
            </div>
          </div>
          <Link 
            href="/agenda-digital/admin/espelhar" 
            style={{
              background: '#fff', color: '#ef4444', padding: '8px 16px', borderRadius: 8, 
              fontSize: 13, fontWeight: 800, textDecoration: 'none', transition: 'all 0.2s', 
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <LogOut size={16} strokeWidth={2.5} />
            Voltar para Espelhar
          </Link>
        </div>
      )}

      {/* Switcher de Aluno Overlay (Famílias com mais de 1 filho) */}
      <PortalWrapper>
        <AnimatePresence>
          {switcherOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 23, 42, 0.85)', zIndex: 9999, 
                display: 'flex', alignItems: 'center', justifyContent: 'center' 
              }} 
              onClick={() => setSwitcherOpen(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.95, opacity: 0, y: 20 }} 
                transition={{ type: "spring", stiffness: 300, damping: 25 }} 
                className="ad-modal-container" 
                style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }} 
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800 }}>Trocar de Aluno</h3>
                  <button onClick={() => setSwitcherOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                    <X size={24} />
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {meusAlunos.map((a: any) => (
                    <div 
                      key={a.id} 
                      className="ad-switcher-item" 
                      onClick={() => {
                        const newPath = pathname.replace(aluno?.id || '', a.id)
                        router.push(newPath)
                        setSwitcherOpen(false)
                      }} 
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 12, 
                        border: `1px solid ${a.id === aluno?.id ? 'hsl(var(--primary))' : 'hsl(var(--border-subtle))'}`, 
                        background: a.id === aluno?.id ? 'rgba(99,102,241,0.05)' : 'transparent', 
                        cursor: 'pointer', transition: 'all 0.2s' 
                      }}
                    >
                      <div className="avatar" style={{ width: 48, height: 48, fontSize: 18, background: 'var(--gradient-purple)', color: 'white' }}>
                        {getInitials(a.nome)}
                      </div>
                      <div>
                        <div className="ad-switcher-item-name" style={{ fontWeight: 700, color: 'hsl(var(--text-main))' }}>{a.nome}</div>
                        <div className="ad-switcher-item-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                          Turma {a.turma_nome || a.turma || 'S/T'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </PortalWrapper>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
        {/* Card Hero Modularizado do Aluno e Chamadas */}
        <div className="ad-premium-card-wrapper">
          <div className="ad-premium-card">
            {/* 1. Cabeçalho de Identificação do Aluno */}
            <StudentHeaderCard
              aluno={aluno}
              cleanTurma={cleanTurma}
              cleanTurno={cleanTurno}
              currentUser={currentUser}
              isMirroringAluno={isMirroringAluno}
              espelharRespId={espelharRespId}
              profileData={profileData}
              userAccessRole={userAccessRole}
              onLogout={handleLogout}
            />

            {/* 2. Controlador de Chamada e Ações Secundárias */}
            <StudentCallController
              aluno={aluno}
              currentUser={currentUser}
              vinculo={vinculo}
              meusAlunos={meusAlunos}
              turmas={turmas}
              adConfig={adConfig}
              isMirrorModeActive={isMirrorModeActive}
              onLogout={handleLogout}
            />
          </div>
        </div>

        {/* 3. Barra de Navegação Rápida (Memoizada) */}
        {aluno?.id && (
          <AgendaNavigationTabBar
            alunoId={aluno.id}
            adConfig={adConfig}
            userAccessRole={userAccessRole}
          />
        )}

        {/* 4. Área de Conteúdo da Página com Contexto de Aluno Selecionado */}
        <div className="ad-main-grid" style={{ marginTop: 12 }}>
          <div className="ad-content-page-area" style={{ flex: 1, minWidth: 0 }}>
            <SelectedStudentProvider value={{ aluno, vinculo, userAccessRole, meusAlunos, isLoadingProfile: isLoading }}>
              {children}
            </SelectedStudentProvider>
          </div>
        </div>
      </div>
    </>
  )
}
