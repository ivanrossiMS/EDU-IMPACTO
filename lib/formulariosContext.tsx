'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { FieldType, ReportSection, ReportField, ConditionalRule } from './relatoriosContext'

export type FormTemplate = {
  id: string
  name: string
  description: string
  category: string
  status: 'rascunho' | 'ativo' | 'arquivado'
  requireSignature: boolean
  dueDate?: string
  version: number
  sections: ReportSection[]
  createdAt: string
  updatedAt: string
  author: string
}

// Representa uma pessoa para a qual o formulário foi disparado (pai/aluno)
export type FormDisparo = {
  id: string
  formId: string
  targetId: string // id do aluno ou responsável mockado
  targetName: string
  status: 'pendente' | 'respondido' | 'recusado'
  sentAt: string
}

export type FormSubmission = {
  id: string
  formId: string
  version: number
  disparoId?: string
  authorName: string
  studentName?: string
  data: Record<string, any> // map of fieldId -> value
  signatureBase64?: string
  signedAt?: string
  createdAt: string
}

interface FormulariosContextState {
  forms: FormTemplate[]
  setForms: React.Dispatch<React.SetStateAction<FormTemplate[]>>
  submissions: FormSubmission[]
  setSubmissions: React.Dispatch<React.SetStateAction<FormSubmission[]>>
  disparos: FormDisparo[]
  setDisparos: React.Dispatch<React.SetStateAction<FormDisparo[]>>
}

const FormulariosContext = createContext<FormulariosContextState | null>(null)

// Seed Data mimicking an Authorization for School Trip
const MOCK_FORMS: FormTemplate[] = []

// Mocking the targets (e.g., parents of 3 students)
const MOCK_DISPAROS: FormDisparo[] = []

const MOCK_SUBMISSIONS: FormSubmission[] = []

export function FormulariosProvider({ children }: { children: ReactNode }) {
  const [forms, setForms] = useState<FormTemplate[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [disparos, setDisparos] = useState<FormDisparo[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const storedForms = localStorage.getItem('ad_formularios_templates')
      if (storedForms && JSON.parse(storedForms).length > 0) {
        setForms(JSON.parse(storedForms))
      } else {
        setForms(MOCK_FORMS)
      }

      const storedSubs = localStorage.getItem('ad_formularios_submissions')
      if (storedSubs && JSON.parse(storedSubs).length > 0) setSubmissions(JSON.parse(storedSubs))
      else setSubmissions(MOCK_SUBMISSIONS)

      const storedDisp = localStorage.getItem('ad_formularios_disparos')
      if (storedDisp && JSON.parse(storedDisp).length > 0) setDisparos(JSON.parse(storedDisp))
      else setDisparos(MOCK_DISPAROS)

    } catch (e) {
      console.error(e)
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('ad_formularios_templates', JSON.stringify(forms))
      localStorage.setItem('ad_formularios_submissions', JSON.stringify(submissions))
      localStorage.setItem('ad_formularios_disparos', JSON.stringify(disparos))
    }
  }, [forms, submissions, disparos, isLoaded])

  return (
    <FormulariosContext.Provider value={{ forms, setForms, submissions, setSubmissions, disparos, setDisparos }}>
      {children}
    </FormulariosContext.Provider>
  )
}

export function useFormularios() {
  const context = useContext(FormulariosContext)
  if (!context) throw new Error('useFormularios must be used within a FormulariosProvider')
  return context
}
