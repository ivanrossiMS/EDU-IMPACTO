'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type FieldType = 
  | 'texto-curto' | 'texto-longo' | 'unica-escolha' | 'multipla-escolha' 
  | 'sim-nao' | 'numero' | 'moeda' | 'percentual' | 'data' | 'hora' 
  | 'checklist' | 'nota' | 'imagem' | 'arquivo' | 'assinatura' | 'repetidor'

export type ConditionalRule = {
  fieldId: string
  operator: 'equals' | 'not_equals' | 'contains'
  value: string
}

export type ReportField = {
  id: string
  type: FieldType
  label: string
  description?: string
  placeholder?: string
  required: boolean
  options?: string[] // For select/radio/checkbox
  conditionalRule?: ConditionalRule | null
  // View Settings
  readOnly?: boolean
  hidden?: boolean
  showInList?: boolean
}

export type ReportSection = {
  id: string
  title: string
  description?: string
  fields: ReportField[]
}

export type ReportTemplate = {
  id: string
  name: string
  description: string
  category: string
  icon: string
  color: string
  status: 'rascunho' | 'ativo' | 'arquivado'
  permissions: {
    view: string[] // 'todos', 'admin', 'professores'
    fill: string[]
    edit: string[]
    approve: string[]
  }
  version: number
  sections: ReportSection[]
  createdAt: string
  updatedAt: string
  author: string
}

export type ReportRecord = {
  id: string
  templateId: string
  version: number
  studentId?: string
  classId?: string
  author: string
  data: Record<string, any> // map of fieldId -> value
  status: 'pendente' | 'aprovado' | 'revisar'
  createdAt: string
}

interface RelatoriosContextState {
  templates: ReportTemplate[]
  setTemplates: React.Dispatch<React.SetStateAction<ReportTemplate[]>>
  records: ReportRecord[]
  setRecords: React.Dispatch<React.SetStateAction<ReportRecord[]>>
  logs: any[]
  addLog: (action: string, details: string) => void
}

const RelatoriosContext = createContext<RelatoriosContextState | null>(null)

// Seed Data mimicking the User's "Rotina - Meio Período (Fund)" example
const MOCK_TEMPLATES: ReportTemplate[] = [
  {
    id: 'TPL-001',
    name: 'Rotina - Meio Período (Fund)',
    description: 'Relatório diário de rotina para alunos do ensino fundamental.',
    category: 'Rotina Diária',
    icon: 'Sun',
    color: '#3b82f6',
    status: 'ativo',
    permissions: { view: ['todos'], fill: ['todos'], edit: ['admin'], approve: ['admin'] },
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Admin',
    sections: [
      {
        id: 'SEC-001',
        title: 'Informações Básicas',
        fields: [
          { id: 'F-PRESENCA', type: 'unica-escolha', label: 'Presença', required: true, options: ['Presente', 'Ausente'] },
          { id: 'F-MOTIVO', type: 'texto-curto', label: 'Motivo da ausência', required: true, conditionalRule: { fieldId: 'F-PRESENCA', operator: 'equals', value: 'Ausente' } }
        ]
      },
      {
        id: 'SEC-002',
        title: 'Avaliação Comportamental e Alimentar',
        fields: [
          { id: 'F-DISPOSICAO', type: 'multipla-escolha', label: 'Disposição', required: false, options: ['Participativo', 'Agitado', 'Cansado', 'Tímido', 'Alegre'] },
          { id: 'F-LANCHE', type: 'unica-escolha', label: 'Lanche', required: true, options: ['Comeu Tudo', 'Comeu Pouco', 'Não Comeu'] },
          { id: 'F-JUSTIF-LANCHE', type: 'texto-curto', label: 'Justificativa do lanche', required: true, conditionalRule: { fieldId: 'F-LANCHE', operator: 'equals', value: 'Não Comeu' } }
        ]
      },
      {
        id: 'SEC-003',
        title: 'Considerações Finais',
        fields: [
          { id: 'F-DESENV', type: 'texto-longo', label: 'Desenvolvimento em sala', required: true },
          { id: 'F-OBS', type: 'texto-longo', label: 'Observações Extras', required: false }
        ]
      }
    ]
  }
]

export function RelatoriosProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [records, setRecords] = useState<ReportRecord[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const storedTemplates = localStorage.getItem('ad_relatorios_templates')
      if (storedTemplates && JSON.parse(storedTemplates).length > 0) {
        setTemplates(JSON.parse(storedTemplates))
      } else {
        setTemplates(MOCK_TEMPLATES) // Initial Seed
      }

      const storedRecords = localStorage.getItem('ad_relatorios_records')
      if (storedRecords) setRecords(JSON.parse(storedRecords))

      const storedLogs = localStorage.getItem('ad_relatorios_logs')
      if (storedLogs) setLogs(JSON.parse(storedLogs))
    } catch (e) {
      console.error(e)
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('ad_relatorios_templates', JSON.stringify(templates))
      localStorage.setItem('ad_relatorios_records', JSON.stringify(records))
      localStorage.setItem('ad_relatorios_logs', JSON.stringify(logs))
    }
  }, [templates, records, logs, isLoaded])

  const addLog = (action: string, details: string) => {
    setLogs(prev => [{ id: Date.now(), action, details, user: 'Admin', date: new Date().toISOString() }, ...prev])
  }

  return (
    <RelatoriosContext.Provider value={{ templates, setTemplates, records, setRecords, logs, addLog }}>
      {children}
    </RelatoriosContext.Provider>
  )
}

export function useRelatorios() {
  const context = useContext(RelatoriosContext)
  if (!context) throw new Error('useRelatorios must be used within a RelatoriosProvider')
  return context
}
