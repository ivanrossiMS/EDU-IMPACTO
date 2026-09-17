'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import { restoreSessionSecurely, getLogoutBarrier, isUserLoggedOut } from '@/lib/auth/secureSession'
import { supabase } from '@/lib/supabase'

export type Theme = 'dark' | 'light'

export const DEFAULT_MODULES: Record<string, boolean> = {
  academico: true,
  financeiro: true,
  rh: true,
  crm: true,
  administrativo: true,
  bi: true,
  ia: true,
  relatorios: true,
  multiUnidades: true,
  patrimonio: true,
  almoxarifado: true,
}

// Resilient async setting loader supporting Keychain, Capacitor Preferences, and localStorage
export async function loadSettingAsync<T>(key: string, fallback: T): Promise<T> {
  if (typeof window === 'undefined') return fallback
  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Tenta Keychain / Keystore nativo para dados de sessão e usuário
      if (key === 'edu-current-user' || key === 'edu-current-perfil') {
        try {
          const sec = await SecureStoragePlugin.get({ key })
          if (sec?.value) {
            try { return JSON.parse(sec.value) as T } catch { return sec.value as unknown as T }
          }
        } catch {}
      }

      // 2. Capacitor Preferences com timeout robusto de 3500ms para cold boot e reboot
      try {
        const getPromise = Preferences.get({ key })
        const timeoutPromise = new Promise<{ value: string | null }>(res => setTimeout(() => res({ value: null }), 3500))
        const { value } = await Promise.race([getPromise, timeoutPromise])
        if (value !== null && value !== undefined) {
          try { return JSON.parse(value) as T } catch { return value as unknown as T }
        }
      } catch {}
    }

    const v = window.localStorage.getItem(key)
    if (v === null || v === undefined) return fallback
    try {
      return JSON.parse(v) as T
    } catch {
      return v as unknown as T
    }
  } catch { return fallback }
}

// saveSetting saves across localStorage, Capacitor Preferences, and Keychain
export function saveSetting(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try { 
    const str = JSON.stringify(value)
    window.localStorage.setItem(key, str) 
    if (Capacitor.isNativePlatform()) {
      Preferences.set({ key, value: str }).catch(() => {})
      if (key === 'edu-current-user' || key === 'edu-current-perfil') {
        SecureStoragePlugin.set({ key, value: str }).catch(() => {})
      }
    }
  } catch { /* ignore */ }
}

export async function removeSettingAsync(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key }).catch(() => {})
      if (key === 'edu-current-user' || key === 'edu-current-perfil') {
        await SecureStoragePlugin.remove({ key }).catch(() => {})
      }
    }
  } catch { /* ignore */ }
}

export interface CurrentUser {
  id: string
  nome: string
  email: string
  cargo: string
  perfil: string
  foto?: string
  aluno_id?: string
  responsavel_id?: string
  colaborador_id?: string
  system_user_id?: string
  hasDualRole?: boolean
  user_metadata?: Record<string, any>
}

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  activeUnit: string
  setActiveUnit: (unit: string) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  // Theme
  theme: Theme
  setTheme: (t: Theme) => void
  // Sidebar theme (independent)
  sidebarTheme: Theme
  setSidebarTheme: (t: Theme) => void
  // Modules
  activeModules: Record<string, boolean>
  setModuleActive: (key: string, active: boolean) => void
  // Current user perfil (simulated auth)
  currentUserPerfil: string
  setCurrentUserPerfil: (perfil: string) => void
  // Logged-in user completo
  currentUser: CurrentUser | null
  setCurrentUser: (user: CurrentUser | null) => void
  // Whether localStorage has been read (prevents false 'Diretor Geral' default)
  hydrated: boolean
  // Global loading path state
  loadingPath: string | null
  setLoadingPath: (path: string | null) => void
}

const AppContext = createContext<AppState>({
  sidebarCollapsed: false,
  toggleSidebar: () => {},
  activeUnit: 'Unidade Centro',
  setActiveUnit: () => {},
  searchOpen: false,
  setSearchOpen: () => {},
  theme: 'light',
  setTheme: () => {},
  sidebarTheme: 'dark',
  setSidebarTheme: () => {},
  activeModules: DEFAULT_MODULES,
  setModuleActive: () => {},
  currentUserPerfil: 'Diretor Geral',
  setCurrentUserPerfil: () => {},
  currentUser: null,
  setCurrentUser: () => {},
  hydrated: false,
  loadingPath: null,
  setLoadingPath: () => {},
})

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage on client
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeUnit, setActiveUnitState] = useState('Unidade Centro')
  const [searchOpen, setSearchOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>('light')
  const [sidebarTheme, setSidebarThemeState] = useState<Theme>('dark')
  const [activeModules, setActiveModulesState] = useState<Record<string, boolean>>(DEFAULT_MODULES)
  const [currentUserPerfil, setCurrentUserPerfilState] = useState('')
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [loadingPath, setLoadingPathState] = useState<string | null>(null)

  // Hydrate from localStorage after mount with guaranteed timeout safety
  useEffect(() => {
    let isMounted = true

    // PERFORMANCE: Leitura síncrona do localStorage ANTES do async.
    // Se os dados já estão no localStorage (maioria dos casos), inicializa
    // o estado instantaneamente sem esperar o Capacitor Preferences (que é async).
    // Isso elimina até 600ms de espera no resume do app.
    try {
      if (typeof window !== 'undefined') {
        const hasBarrierSync = window.localStorage.getItem('edu_logout_pending_barrier') || window.localStorage.getItem('edu-logout-pending')
        const syncUser = hasBarrierSync ? null : window.localStorage.getItem('edu-current-user')
        const syncTheme = window.localStorage.getItem('edu-theme')
        const syncSidebarTheme = window.localStorage.getItem('edu-sidebar-theme')
        const syncUnit = window.localStorage.getItem('edu-active-unit')
        const syncPerfil = hasBarrierSync ? null : window.localStorage.getItem('edu-current-perfil')
        const syncModules = window.localStorage.getItem('edu-active-modules')

        if (syncTheme) setThemeState(JSON.parse(syncTheme))
        if (syncSidebarTheme) setSidebarThemeState(JSON.parse(syncSidebarTheme))
        if (syncUnit) setActiveUnitState(JSON.parse(syncUnit))
        if (syncModules) setActiveModulesState(prev => ({ ...DEFAULT_MODULES, ...JSON.parse(syncModules) }))
        if (syncPerfil) setCurrentUserPerfilState(JSON.parse(syncPerfil))
        if (syncUser) {
          const parsedUser = JSON.parse(syncUser) as CurrentUser
          const syncPhoto = parsedUser.id ? window.localStorage.getItem(`edu-user-photo-${parsedUser.id}`) : null
          const syncPhotoResp = (!syncPhoto && parsedUser.responsavel_id) ? window.localStorage.getItem(`edu-user-photo-${parsedUser.responsavel_id}`) : null
          const chosenPhoto = syncPhoto || syncPhotoResp
          if (chosenPhoto) {
            try {
              parsedUser.foto = JSON.parse(chosenPhoto)
            } catch {
              parsedUser.foto = chosenPhoto
            }
          }
          setCurrentUserState(parsedUser)
          // NÃO marca hydrated aqui — aguarda a sessão ser verificada/restaurada em hydrate()
        } else if (hasBarrierSync) {
          setCurrentUserState(null)
          setCurrentUserPerfilState('')
        }
        if (syncTheme) document.documentElement.setAttribute('data-theme', JSON.parse(syncTheme))
      }
    } catch { /* localStorage pode estar bloqueado em alguns contextos */ }

    // Fallback de segurança para garantir hidratação mesmo em falha grave de storage
    const fallbackTimer = setTimeout(() => {
      if (isMounted) setHydrated(true)
    }, 5000)

    async function hydrate() {
      try {
        const barrier = await getLogoutBarrier()
        const isLoggedOut = isUserLoggedOut() || Boolean(barrier)

        if (isLoggedOut) {
          console.log('[Context Hydration] Logout barrier ativo. Não restaurando credenciais antigas.')
          setCurrentUserState(null)
          setCurrentUserPerfilState('')
          await removeSettingAsync('edu-current-user').catch(() => {})
          await removeSettingAsync('edu-current-perfil').catch(() => {})

          let [savedTheme, savedSidebarTheme, savedModules, savedUnit] = await Promise.all([
            loadSettingAsync<Theme>('edu-theme', 'light'),
            loadSettingAsync<Theme>('edu-sidebar-theme', 'dark'),
            loadSettingAsync<Record<string, boolean>>('edu-active-modules', DEFAULT_MODULES),
            loadSettingAsync<string>('edu-active-unit', 'Unidade Centro'),
          ])

          if (!isMounted) return
          setThemeState(savedTheme)
          setSidebarThemeState(savedSidebarTheme)
          setActiveModulesState({ ...DEFAULT_MODULES, ...savedModules })
          setActiveUnitState(savedUnit)
          document.documentElement.setAttribute('data-theme', savedTheme)
          return
        }

        await restoreSessionSecurely(supabase).catch(() => {})

        let [savedTheme, savedSidebarTheme, savedModules, savedUnit, savedPerfil, savedUser] = await Promise.all([
          loadSettingAsync<Theme>('edu-theme', 'light'),
          loadSettingAsync<Theme>('edu-sidebar-theme', 'dark'),
          loadSettingAsync<Record<string, boolean>>('edu-active-modules', DEFAULT_MODULES),
          loadSettingAsync<string>('edu-active-unit', 'Unidade Centro'),
          loadSettingAsync<string>('edu-current-perfil', ''),
          loadSettingAsync<CurrentUser | null>('edu-current-user', null),
        ])

        if (!isMounted) return

        // Se savedUser ainda não foi encontrado mas temos uma sessão ativa no Supabase,
        // reconstrói o usuário a partir dos metadados da sessão para garantir continuidade total
        if (!savedUser) {
          try {
            const { data: sessionData } = await supabase.auth.getSession()
            const u = sessionData?.session?.user
            if (u) {
              const meta = u.user_metadata || {}
              savedUser = {
                id: u.id,
                nome: meta.nome || u.email?.split('@')[0] || 'Usuário',
                email: u.email || '',
                cargo: meta.cargo || 'Colaborador',
                perfil: meta.perfil || 'Usuário',
                foto: meta.foto,
                aluno_id: meta.aluno_id || '',
                responsavel_id: meta.responsavel_id || '',
                colaborador_id: meta.colaborador_id || meta.system_user_id || '',
                system_user_id: meta.system_user_id || meta.colaborador_id || '',
                hasDualRole: Boolean(meta.hasDualRole || meta.responsavel_id),
                user_metadata: meta
              }
              saveSetting('edu-current-user', savedUser)
              saveSetting('edu-current-perfil', savedUser.perfil)
            }
          } catch {}
        }

        setThemeState(savedTheme)
        setSidebarThemeState(savedSidebarTheme)
        setActiveModulesState({ ...DEFAULT_MODULES, ...savedModules })
        setActiveUnitState(savedUnit)

        if (savedUser) {
          setCurrentUserPerfilState(savedPerfil || savedUser.perfil || '')
          try {
            const [isolatedPhoto, extraData] = await Promise.all([
              loadSettingAsync<string | null>(`edu-user-photo-${savedUser.id}`, null),
              loadSettingAsync<any>(`edu-profile-extra-${savedUser.id}`, null),
            ])
            if (isolatedPhoto) savedUser.foto = isolatedPhoto
            else if (extraData && extraData.foto) savedUser.foto = extraData.foto

            if (!savedUser.foto && savedUser.responsavel_id) {
              const altPhotoResp = await loadSettingAsync<string | null>(`edu-user-photo-${savedUser.responsavel_id}`, null)
              if (altPhotoResp) savedUser.foto = altPhotoResp
            }
            if (!savedUser.foto && savedUser.system_user_id) {
              const altPhoto = await loadSettingAsync<string | null>(`edu-user-photo-${savedUser.system_user_id}`, null)
              if (altPhoto) savedUser.foto = altPhoto
            }
            if (!savedUser.foto && savedUser.colaborador_id) {
              const altPhoto2 = await loadSettingAsync<string | null>(`edu-user-photo-${savedUser.colaborador_id}`, null)
              if (altPhoto2) savedUser.foto = altPhoto2
            }
          } catch (e) {}
          setCurrentUserState(savedUser)
        } else {
          setCurrentUserState(null)
          setCurrentUserPerfilState('')
        }
        document.documentElement.setAttribute('data-theme', savedTheme)
      } catch (err) {
        console.error('[Context Hydration Error]', err)
      } finally {
        if (isMounted) {
          clearTimeout(fallbackTimer)
          setHydrated(true)
        }
      }
    }

    hydrate()
    return () => {
      isMounted = false
      clearTimeout(fallbackTimer)
    }
  }, [])

  const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    saveSetting('edu-theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  const setSidebarTheme = useCallback((t: Theme) => {
    setSidebarThemeState(t)
    saveSetting('edu-sidebar-theme', t)
  }, [])

  const setActiveUnit = useCallback((unit: string) => {
    setActiveUnitState(unit)
    saveSetting('edu-active-unit', unit)
  }, [])

  const setModuleActive = useCallback((key: string, active: boolean) => {
    setActiveModulesState(prev => {
      const next = { ...prev, [key]: active }
      saveSetting('edu-active-modules', next)
      return next
    })
  }, [])

  const setCurrentUserPerfil = useCallback((perfil: string) => {
    setCurrentUserPerfilState(perfil)
    saveSetting('edu-current-perfil', perfil)
  }, [])

  const setCurrentUser = useCallback((user: CurrentUser | null) => {
    if (user) {
      setCurrentUserState(prev => {
        // Se for o mesmo usuário, mescla os dados para não perder propriedades como 'foto'
        const merged = prev && prev.id === user.id ? { ...prev, ...user } : user
        saveSetting('edu-current-user', merged)
        
        // Garante que a foto fique isolada para persistência extrema
        if (merged.foto) {
          saveSetting(`edu-user-photo-${merged.id}`, merged.foto)
          if (merged.responsavel_id && merged.responsavel_id !== merged.id) {
            saveSetting(`edu-user-photo-${merged.responsavel_id}`, merged.foto)
          }
          if (merged.system_user_id && merged.system_user_id !== merged.id) {
            saveSetting(`edu-user-photo-${merged.system_user_id}`, merged.foto)
          }
          if (merged.colaborador_id && merged.colaborador_id !== merged.id) {
            saveSetting(`edu-user-photo-${merged.colaborador_id}`, merged.foto)
          }
        }
        
        return merged
      })
      setCurrentUserPerfilState(user.perfil)
      saveSetting('edu-current-perfil', user.perfil)
    } else {
      setCurrentUserState(null)
      // Logout: remove auth-specific keys
      const USER_KEYS = [
        'edu-current-user',
        'edu-current-perfil',
        'edu-user-passwords',
        'edu_has_seen_splash',
      ]
      USER_KEYS.forEach(k => removeSettingAsync(k))
      setCurrentUserPerfilState('')
    }
  }, [])

  return (
    <AppContext.Provider value={{
      sidebarCollapsed, toggleSidebar,
      activeUnit, setActiveUnit,
      searchOpen, setSearchOpen,
      theme, setTheme,
      sidebarTheme, setSidebarTheme,
      activeModules, setModuleActive,
      currentUserPerfil, setCurrentUserPerfil,
      currentUser, setCurrentUser,
      hydrated,
      loadingPath,
      setLoadingPath: setLoadingPathState,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
