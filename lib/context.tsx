'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { destroySession } from '@/app/actions/authActions'

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

// localStorage helpers
function loadSetting<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const v = localStorage.getItem(key)
    return v !== null ? (JSON.parse(v) as T) : fallback
  } catch { return fallback }
}
function saveSetting(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export interface CurrentUser {
  id: string
  nome: string
  email: string
  cargo: string
  perfil: string
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
})

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage on client
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeUnit, setActiveUnitState] = useState('Unidade Centro')
  const [searchOpen, setSearchOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>('light')
  const [sidebarTheme, setSidebarThemeState] = useState<Theme>('dark')
  const [activeModules, setActiveModulesState] = useState<Record<string, boolean>>(DEFAULT_MODULES)
  const [currentUserPerfil, setCurrentUserPerfilState] = useState('Diretor Geral')
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage after mount
  useEffect(() => {
    const savedTheme = loadSetting<Theme>('edu-theme', 'light')
    const savedSidebarTheme = loadSetting<Theme>('edu-sidebar-theme', 'dark')
    const savedModules = loadSetting<Record<string, boolean>>('edu-active-modules', DEFAULT_MODULES)
    const savedUnit = loadSetting<string>('edu-active-unit', 'Unidade Centro')
    const savedPerfil = loadSetting<string>('edu-current-perfil', 'Diretor Geral')
    const savedUser = loadSetting<CurrentUser | null>('edu-current-user', null)

    setThemeState(savedTheme)
    setSidebarThemeState(savedSidebarTheme)
    setActiveModulesState({ ...DEFAULT_MODULES, ...savedModules })
    setActiveUnitState(savedUnit)
    setCurrentUserPerfilState(savedPerfil)
    setCurrentUserState(savedUser)
    document.documentElement.setAttribute('data-theme', savedTheme)
    setHydrated(true)
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
    setCurrentUserState(user)
    saveSetting('edu-current-user', user)
    if (user?.perfil) {
      setCurrentUserPerfilState(user.perfil)
      saveSetting('edu-current-perfil', user.perfil)
      // O cookie agora é gerado e protegido no log in pela Server Action 'createSession'.
    } else {
      // Limpa a sessão chamando a Server Action
      destroySession().catch(e => console.error('Logout error', e))
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
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
