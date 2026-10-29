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
import { SelectedStudentProvider } from '@/lib/selectedStudentContext'
import { getAlunoTurnoDisplay, isAlunoIntegralIntermediario } from '@/lib/studentTurmaUtils'
import { getInitials } from '@/lib/utils'
import { performLogout } from '@/lib/auth/logout'
import { hideSplashScreen } from '@/lib/capacitor/splash'
import { LoadingGlass } from '@/components/LoadingGlass'

import { apiFetch } from '@/lib/api/apiClient'

import { StudentHeaderCard } from './components/StudentHeaderCard'
import { StudentCallController } from './components/StudentCallController'
import { AgendaNavigationTabBar } from './components/AgendaNavigationTabBar'

// Estilos extraídos do monólito para CSS modularizado e otimizado
import './agenda-layout.css'

const clientProfileCache = new Map<string, { data: any; ts: number }>()
const CLIENT_PROFILE_CACHE_TTL_MS = 60_000

function getInitialSeededProfile(slug?: string, userId?: string): any | null {
  if (!slug || typeof window === 'undefined') return null
  const slugStr = String(slug).trim()
  for (const [k, v] of clientProfileCache.entries()) {
    if (k.startsWith(`${slugStr}_`) && Date.now() - v.ts < CLIENT_PROFILE_CACHE_TTL_MS) {
      return v.data
    }
  }
  try {
    const keysToTry = userId ? [`edu-meus-alunos-${userId}`] : []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('edu-meus-alunos-') && !keysToTry.includes(k)) {
        keysToTry.push(k)
      }
    }
    for (const key of keysToTry) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.alunos) ? parsed.alunos : [])
      const match = list.find((a: any) =>
        a && (
          String(a.id) === slugStr ||
          String(a.matricula || '') === slugStr ||
          String(a.codigo || a.dados?.codigo || '') === slugStr
        )
      )
      if (match) {
        return {
          aluno: match,
          vinculo: match.vinculo || {
            parentesco: match.parentesco || 'Responsável',
            resp_pedagogico: match.resp_pedagogico !== false,
            resp_financeiro: Boolean(match.resp_financeiro),
          },
          meusAlunos: list,
          _seeded: true,
        }
      }
    }
  } catch (e) {}
  return null
}

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
  const { turmas = [] } = useData()
  const { adConfig, setAdLoading, chatGroups: grupos = [] } = useAgendaDigital()
  const { currentUser, hydrated, setLoadingPath } = useApp()
  const { activeCalls = [] } = useSaida()
  
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramsHook = useParams<{ slug: string }>()
  const resolvedParams = paramsHook || (params as any)

  const [profileData, setProfileData] = useState<any>(() =>
    getInitialSeededProfile(resolvedParams?.slug, currentUser?.id)
  )
  const [isLoading, setIsLoading] = useState<boolean>(() => !profileData)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const isMirrorMode =
    currentUser?.perfil === 'Administrador' ||
    currentUser?.perfil === 'Administrador Master' ||
    currentUser?.perfil === 'Gestor' ||
    currentUser?.perfil === 'Direção' ||
    currentUser?.perfil === 'Diretor Geral' ||
    currentUser?.perfil === 'Coordenador' ||
    currentUser?.perfil === 'Secretaria' ||
    currentUser?.cargo === 'Administrador Master' ||
    currentUser?.cargo === 'Diretor Geral'

  const isMirroringAluno = isMirrorMode && searchParams?.get('espelhar_aluno') === 'true'
  const espelharRespId = isMirrorMode ? searchParams?.get('espelhar_responsavel') : null
  const espelharColabId = isMirrorMode ? searchParams?.get('espelhar_colaborador') : null
  const isMirrorModeActive = isMirrorMode && (!!isMirroringAluno || !!espelharRespId || !!espelharColabId)

  // Intercepta rotas genéricas de push notification (ex: /agenda-digital/comunicados)
  const isGenericModule = ['comunicados', 'momentos', 'calendario', 'frequencia', 'ocorrencias', 'notas', 'provas-online'].includes(resolvedParams?.slug || '')
  
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
  const isAlunoLogado = Boolean(
    isMirroringAluno ||
    currentUser?.cargo === 'Aluno' ||
    currentUser?.perfil === 'Aluno' ||
    (currentUser as any)?.userType === 'aluno' ||
    ((currentUser as any)?.aluno_id && currentUser?.cargo !== 'Responsável' && !(currentUser as any)?.responsavel_id)
  )

  useEffect(() => {
    if (hydrated) {
      hideSplashScreen(300)
    }
  }, [hydrated])

  const loadedProfileKeyRef = React.useRef<string>('')

  useEffect(() => {
    if (!hydrated || !currentUser || !resolvedParams?.slug) return
    if (isAlunoLogado) {
      const directId = (currentUser as any).aluno_id || (currentUser as any).user_metadata?.aluno_id
      if (directId && String(resolvedParams.slug) !== String(directId)) {
        const currentPath = pathname || ''
        const newPath = currentPath.replace(`/agenda-digital/${resolvedParams.slug}`, `/agenda-digital/${directId}`)
        router.replace(newPath)
      }
    }
  }, [hydrated, currentUser, resolvedParams?.slug, isAlunoLogado, pathname, router])

  useEffect(() => {
    if (!hydrated || !currentUser) return
    if (!resolvedParams?.slug) return

    if (isAlunoLogado) {
      const directId = (currentUser as any).aluno_id || (currentUser as any).user_metadata?.aluno_id
      if (directId && String(resolvedParams.slug) !== String(directId)) {
        return
      }
    }

    const profileKey = `${resolvedParams.slug}_${respId}_${isAlunoLogado}_${isMirrorModeActive}`
    if (loadedProfileKeyRef.current === profileKey && profileData && !profileData._seeded) {
      setIsLoading(false)
      return
    }

    const cachedEntry = clientProfileCache.get(profileKey)
    if (cachedEntry && Date.now() - cachedEntry.ts < CLIENT_PROFILE_CACHE_TTL_MS) {
      loadedProfileKeyRef.current = profileKey
      setProfileData(cachedEntry.data)
      setIsLoading(false)
      return
    }

    const seeded = getInitialSeededProfile(resolvedParams.slug, currentUser?.id)
    if (seeded && (!profileData || String(profileData?.aluno?.id) !== String(seeded.aluno?.id))) {
      setProfileData(seeded)
      setIsLoading(false)
    } else if (!profileData) {
      setIsLoading(true)
    }

    const loadProfile = async () => {
      try {
        const res = await apiFetch(`/api/agenda/perfil-acesso?slug=${resolvedParams.slug}&responsavel_id=${respId}&is_aluno_profile=${isAlunoLogado}`)
        
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
        if (!isMirrorMode && !isMirrorModeActive && !isAlunoLogado) {
          const allowedList: any[] = Array.isArray(data?.meusAlunos) ? data.meusAlunos : []
          const slugStr = String(resolvedParams.slug).trim()
          if (allowedList.length > 0) {
            const belongsToGuardian = allowedList.some((a: any) =>
              String(a.id) === slugStr ||
              String(a.matricula || '') === slugStr ||
              String(a.codigo || a.dados?.codigo || '') === slugStr
            )
            if (!belongsToGuardian) {
              router.replace('/agenda-digital/selecionar-aluno')
              return
            }
          } else {
            // Double check via /api/agenda/meus-alunos if perfil-acesso returned empty meusAlunos
            const checkRes = await apiFetch(`/api/agenda/meus-alunos?responsavel_id=${encodeURIComponent(respId)}`).catch(() => null)
            if (checkRes && checkRes.ok) {
              const checkData = await checkRes.json().catch(() => null)
              const childrenList = Array.isArray(checkData?.alunos) ? checkData.alunos : (Array.isArray(checkData) ? checkData : [])
              if (childrenList.length > 0) {
                const belongs = childrenList.some((a: any) =>
                  String(a.id) === slugStr ||
                  String(a.matricula || '') === slugStr ||
                  String(a.codigo || a.dados?.codigo || '') === slugStr
                )
                if (!belongs) {
                  router.replace('/agenda-digital/selecionar-aluno')
                  return
                }
              }
            }
          }
        }
        loadedProfileKeyRef.current = profileKey
        clientProfileCache.set(profileKey, { data, ts: Date.now() })
        setProfileData(data)
      } catch(e) {
        console.error('Failed to load profile data:', e)
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()

    const handlePullRefresh = () => {
      clientProfileCache.delete(profileKey)
      loadProfile()
    }
    window.addEventListener('ad:pull-to-refresh', handlePullRefresh)
    return () => {
      window.removeEventListener('ad:pull-to-refresh', handlePullRefresh)
    }
  }, [hydrated, currentUser?.id, resolvedParams?.slug, respId, isAlunoLogado, isMirrorMode, isMirrorModeActive, router])

  useEffect(() => {
    if (setAdLoading) setAdLoading(false)
  }, [setAdLoading])

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
  const isBlockedAgenda = Boolean(
    aluno?.bloqueadoAgenda ||
    aluno?.bloqueadoAgendaDigital ||
    aluno?.dados?.bloqueadoAgenda ||
    aluno?.dados?.bloqueadoAgendaDigital
  )

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

  if (isBlockedAgenda && !isMirrorMode && !isMirrorModeActive) {
    return (
      <div style={{ minHeight: '75vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 440, width: '100%', padding: 32, borderRadius: 24, textAlign: 'center', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <X size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Acesso Temporariamente Suspenso</h2>
          <p style={{ fontSize: 14, color: 'hsl(var(--text-muted))', lineHeight: 1.6, marginBottom: 24 }}>
            O acesso à Agenda Digital para <strong>{aluno?.nome || 'este aluno'}</strong> encontra-se temporariamente bloqueado. Entre em contato com a secretaria escolar para regularização.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {meusAlunos.length > 1 && (
              <Link href="/agenda-digital/selecionar-aluno" className="btn btn-secondary">
                Trocar de Aluno
              </Link>
            )}
            <button className="btn btn-primary" onClick={handleLogout}>
              <LogOut size={16} style={{ marginRight: 6 }} /> Sair
            </button>
          </div>
        </div>
      </div>
    )
  }

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
                        const newPath = (pathname || '').replace(/^\/agenda-digital\/[^/]+/, `/agenda-digital/${a.id}`)
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
              isAlunoAccess={isAlunoLogado}
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
              isAlunoAccess={isAlunoLogado}
            />
          </div>
        </div>

        {/* 3. Barra de Navegação Rápida (Memoizada) */}
        {(aluno?.id || resolvedParams?.slug) && (
          <AgendaNavigationTabBar
            alunoId={aluno?.id || resolvedParams?.slug}
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
