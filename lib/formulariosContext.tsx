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
const MOCK_FORMS: FormTemplate[] = [
  {
    id: 'FRM-001',
    name: 'Autorização de Passeio - Museu',
    description: 'Termo legal autorizando o aluno a participar da excursão ao Museu de Ciências na próxima sexta-feira.',
    category: 'Autorizações',
    status: 'ativo',
    requireSignature: true,
    dueDate: '2026-05-15',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Coordenação',
    sections: [
      {
        id: 'SEC-001',
        title: 'Detalhes da Excursão',
        fields: [
          { id: 'F-CIENTE', type: 'multipla-escolha', label: 'Estou ciente das condições:', required: true, options: ['Declaro estar ciente de que o passeio será das 08h às 15h.', 'Declaro estar ciente de que haverá taxa extra de R$ 50.'] },
          { id: 'F-AUTORIZA', type: 'sim-nao', label: 'Você autoriza a ida do aluno?', required: true },
          { id: 'F-MOTIVO', type: 'texto-longo', label: 'Em caso negativo, nos diga o motivo', required: false, conditionalRule: { fieldId: 'F-AUTORIZA', operator: 'equals', value: 'Não' } }
        ]
      },
      {
        id: 'SEC-002',
        title: 'Dados Médicos Emergenciais',
        fields: [
          { id: 'F-ALERGIA', type: 'sim-nao', label: 'Possui alguma alergia alimentar ou medicamentosa?', required: true },
          { id: 'F-QUAL-ALERGIA', type: 'texto-curto', label: 'Qual?', required: true, conditionalRule: { fieldId: 'F-ALERGIA', operator: 'equals', value: 'Sim' } },
          { id: 'F-EMERGENCIA', type: 'texto-curto', label: 'Contato de Emergência (Telefone)', required: true }
        ]
      }
    ]
  }
]

// Mocking the targets (e.g., parents of 3 students)
const MOCK_DISPAROS: FormDisparo[] = [
  { id: 'D-1', formId: 'FRM-001', targetId: 'R-101', targetName: 'João Silva (Pai de Maria)', status: 'respondido', sentAt: new Date().toISOString() },
  { id: 'D-2', formId: 'FRM-001', targetId: 'R-102', targetName: 'Ana Souza (Mãe de Pedro)', status: 'pendente', sentAt: new Date().toISOString() },
  { id: 'D-3', formId: 'FRM-001', targetId: 'R-103', targetName: 'Carlos Lima (Pai de Lucas)', status: 'pendente', sentAt: new Date().toISOString() }
]

const MOCK_SUBMISSIONS: FormSubmission[] = [
  {
    id: 'SUB-1',
    formId: 'FRM-001',
    version: 1,
    disparoId: 'D-1',
    authorName: 'João Silva',
    studentName: 'Maria Silva',
    data: {
      'F-CIENTE': ['Declaro estar ciente de que o passeio será das 08h às 15h.', 'Declaro estar ciente de que haverá taxa extra de R$ 50.'],
      'F-AUTORIZA': 'Sim',
      'F-ALERGIA': 'Não',
      'F-EMERGENCIA': '(11) 99999-1111'
    },
    signatureBase64: 'mock_signature_joao_silva',
    signedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }
]

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
