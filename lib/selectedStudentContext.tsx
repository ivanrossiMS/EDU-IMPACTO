'use client'
import React, { createContext, useContext } from 'react'

export interface SelectedStudentContextData {
  aluno: any | null
  vinculo: any | null
  userAccessRole: { isFin: boolean; isPed: boolean; parentesco: string }
  meusAlunos?: any[]
}

const SelectedStudentContext = createContext<SelectedStudentContextData>({
  aluno: null,
  vinculo: null,
  userAccessRole: { isFin: false, isPed: false, parentesco: 'Responsável' },
  meusAlunos: []
})

export function SelectedStudentProvider({ 
  children, value 
}: { 
  children: React.ReactNode, 
  value: SelectedStudentContextData 
}) {
  return (
    <SelectedStudentContext.Provider value={value}>
      {children}
    </SelectedStudentContext.Provider>
  )
}

export function useSelectedStudent() {
  return useContext(SelectedStudentContext)
}
