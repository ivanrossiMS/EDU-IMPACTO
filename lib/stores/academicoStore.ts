import { create } from 'zustand'

interface AcademicoState {
  alunosViewMode: 'lista' | 'grid'
  setAlunosViewMode: (view: 'lista' | 'grid') => void
  turmasViewMode: 'lista' | 'grid'
  setTurmasViewMode: (view: 'lista' | 'grid') => void
  globalSearchAcademico: string
  setGlobalSearchAcademico: (search: string) => void
}

export const useAcademicoStore = create<AcademicoState>((set) => ({
  alunosViewMode: 'lista',
  setAlunosViewMode: (view) => set({ alunosViewMode: view }),
  turmasViewMode: 'grid',
  setTurmasViewMode: (view) => set({ turmasViewMode: view }),
  globalSearchAcademico: '',
  setGlobalSearchAcademico: (search) => set({ globalSearchAcademico: search }),
}))
