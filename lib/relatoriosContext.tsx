'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
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
  setTemplates: (value: ReportTemplate[] | ((prev: ReportTemplate[]) => ReportTemplate[])) => Promise<void> | void
  records: ReportRecord[]
  setRecords: (value: ReportRecord[] | ((prev: ReportRecord[]) => ReportRecord[])) => Promise<void> | void
  logs: any[]
  addLog: (action: string, details: string) => void
}

const RelatoriosContext = createContext<RelatoriosContextState | null>(null)

export function RelatoriosProvider({ children }: { children: ReactNode }) {
  // Using useSupabaseArray to sync directly with Supabase via the API routes we just created
  const [templates, setTemplates] = useSupabaseArray<ReportTemplate>('agenda/relatorios_templates', [])
  const [records, setRecords] = useSupabaseArray<ReportRecord>('agenda/relatorios_records', [])
  const [logs, setLogs] = useSupabaseArray<any>('agenda/relatorios_logs', [])

  const addLog = async (action: string, details: string) => {
    const newLog = { 
      id: crypto.randomUUID(), 
      action, 
      details, 
      user: 'Admin', 
      date: new Date().toISOString() 
    }
    await setLogs(prev => [newLog, ...prev])
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
