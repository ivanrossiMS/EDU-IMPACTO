import { create } from 'zustand'

interface FinanceiroState {
  titulosViewMode: 'lista' | 'grid'
  setTitulosViewMode: (view: 'lista' | 'grid') => void
  filtroStatusTitulos: string
  setFiltroStatusTitulos: (status: string) => void
}

export const useFinanceiroStore = create<FinanceiroState>((set) => ({
  titulosViewMode: 'lista',
  setTitulosViewMode: (view) => set({ titulosViewMode: view }),
  filtroStatusTitulos: 'Todos',
  setFiltroStatusTitulos: (status) => set({ filtroStatusTitulos: status }),
}))
