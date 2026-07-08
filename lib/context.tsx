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

// Async setting loader to support Capacitor Preferences
export async function loadSettingAsync<T>(key: string, fallback: T): Promise<T> {
  if (typeof window === 'undefined') return fallback
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key })
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

  // Hydrate from localStorage after mount
  useEffect(() => {
    async function hydrate() {
      const savedTheme = await loadSettingAsync<Theme>('edu-theme', 'light')
      const savedSidebarTheme = await loadSettingAsync<Theme>('edu-sidebar-theme', 'dark')
      const savedModules = await loadSettingAsync<Record<string, boolean>>('edu-active-modules', DEFAULT_MODULES)
      const savedUnit = await loadSettingAsync<string>('edu-active-unit', 'Unidade Centro')
      const savedPerfil = await loadSettingAsync<string>('edu-current-perfil', 'Diretor Geral')
      const savedUser = await loadSettingAsync<CurrentUser | null>('edu-current-user', null)

      setThemeState(savedTheme)
      setSidebarThemeState(savedSidebarTheme)
      setActiveModulesState({ ...DEFAULT_MODULES, ...savedModules })
      setActiveUnitState(savedUnit)
      // Only hydrate user if explicitly saved — never default to a perfil
      if (savedUser) {
        setCurrentUserPerfilState(savedPerfil || savedUser.perfil || '')
        
        // Tentar carregar a foto de chaves isoladas (mais persistente)
        try {
          const isolatedPhoto = await loadSettingAsync<string | null>(`edu-user-photo-${savedUser.id}`, null)
          const extraData = await loadSettingAsync<any>(`edu-profile-extra-${savedUser.id}`, null)
          
          if (isolatedPhoto) {
            savedUser.foto = isolatedPhoto
          } else if (extraData && extraData.foto) {
            savedUser.foto = extraData.foto
          }
        } catch (e) {}

        setCurrentUserState(savedUser)
      } else {
        // No saved user = logged out — clear any stale perfil
        setCurrentUserPerfilState('')
        removeSettingAsync('edu-current-perfil')
      }
      document.documentElement.setAttribute('data-theme', savedTheme)
      setHydrated(true)
    }

    hydrate()
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
      // Logout: wipe ALL user-related keys from localStorage
      const USER_KEYS = [
        'edu-current-user',
        'edu-current-perfil',
        'edu-user-passwords',  // legacy local passwords — nuke on every logout
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
