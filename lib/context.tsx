'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'

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

// Async setting loader to support Capacitor Preferences with 300ms timeout protection
export async function loadSettingAsync<T>(key: string, fallback: T): Promise<T> {
  if (typeof window === 'undefined') return fallback
  try {
    if (Capacitor.isNativePlatform()) {
      const getPromise = Preferences.get({ key })
      const timeoutPromise = new Promise<{ value: string | null }>(res => setTimeout(() => res({ value: null }), 300))
      const { value } = await Promise.race([getPromise, timeoutPromise])
      if (value !== null) return JSON.parse(value) as T
    }
    const v = window.localStorage.getItem(key)
    return v !== null ? (JSON.parse(v) as T) : fallback
  } catch { return fallback }
}

// saveSetting now saves to both localStorage and Capacitor Preferences
export function saveSetting(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try { 
    const str = JSON.stringify(value)
    window.localStorage.setItem(key, str) 
    if (Capacitor.isNativePlatform()) {
      Preferences.set({ key, value: str }).catch(() => {})
    }
  } catch { /* ignore */ }
}

export async function removeSettingAsync(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key }).catch(() => {})
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
        const syncUser = window.localStorage.getItem('edu-current-user')
        const syncTheme = window.localStorage.getItem('edu-theme')
        const syncSidebarTheme = window.localStorage.getItem('edu-sidebar-theme')
        const syncUnit = window.localStorage.getItem('edu-active-unit')
        const syncPerfil = window.localStorage.getItem('edu-current-perfil')
        const syncModules = window.localStorage.getItem('edu-active-modules')

        if (syncTheme) setThemeState(JSON.parse(syncTheme))
        if (syncSidebarTheme) setSidebarThemeState(JSON.parse(syncSidebarTheme))
        if (syncUnit) setActiveUnitState(JSON.parse(syncUnit))
        if (syncModules) setActiveModulesState(prev => ({ ...DEFAULT_MODULES, ...JSON.parse(syncModules) }))
        if (syncPerfil) setCurrentUserPerfilState(JSON.parse(syncPerfil))
        if (syncUser) {
          const parsedUser = JSON.parse(syncUser) as CurrentUser
          // Tenta carregar foto isolada sincronamente
          const syncPhoto = parsedUser.id ? window.localStorage.getItem(`edu-user-photo-${parsedUser.id}`) : null
          if (syncPhoto) parsedUser.foto = JSON.parse(syncPhoto)
          setCurrentUserState(parsedUser)
          // Marca como hidratado imediatamente se temos o usuário — evita waterfall
          if (isMounted) setHydrated(true)
        }
        if (syncTheme) document.documentElement.setAttribute('data-theme', JSON.parse(syncTheme))
      }
    } catch { /* localStorage pode estar bloqueado em alguns contextos */ }

    // PERFORMANCE: Fallback de 150ms (era 800ms) — Capacitor Preferences responde em <100ms
    // em dispositivos modernos. O valor alto anterior bloqueava o resume do app desnecessariamente.
    const fallbackTimer = setTimeout(() => {
      if (isMounted) setHydrated(true)
    }, 150)

    async function hydrate() {
      try {
        const [savedTheme, savedSidebarTheme, savedModules, savedUnit, savedPerfil, savedUser] = await Promise.all([
          loadSettingAsync<Theme>('edu-theme', 'light'),
          loadSettingAsync<Theme>('edu-sidebar-theme', 'dark'),
          loadSettingAsync<Record<string, boolean>>('edu-active-modules', DEFAULT_MODULES),
          loadSettingAsync<string>('edu-active-unit', 'Unidade Centro'),
          loadSettingAsync<string>('edu-current-perfil', 'Diretor Geral'),
          loadSettingAsync<CurrentUser | null>('edu-current-user', null),
        ])

        if (!isMounted) return

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
          } catch (e) {}
          setCurrentUserState(savedUser)
        } else {
          setCurrentUserPerfilState('')
          removeSettingAsync('edu-current-perfil')
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
        }
        
        return merged
      })
      setCurrentUserPerfilState(user.perfil)
      saveSetting('edu-current-perfil', user.perfil)
    } else {
      setCurrentUserState(null)
      // Logout: wipe ALL user-related keys from localStorage & Capacitor Preferences
      const USER_KEYS = [
        'edu-current-user',
        'edu-current-perfil',
        'edu-user-passwords',  // legacy local passwords — nuke on every logout
        'edu_has_seen_splash',  // reset splash flag so next open shows it correctly
      ]
      USER_KEYS.forEach(k => removeSettingAsync(k))
      if (Capacitor.isNativePlatform()) {
        Preferences.clear().catch(() => {})
      }
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
