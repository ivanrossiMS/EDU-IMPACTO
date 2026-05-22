'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { useData } from './dataContext'
import { useSupabaseArray } from './useSupabaseCollection'

export interface ADComunicado {
  id: string
  titulo: string
  conteudo: string
  tipo: 'texto' | 'formulário' | 'cobrança' | 'enquete' | 'compromisso' | 'relatório' | 'arquivo'
  autor: string
  autorCargo: string
  autorId?: string
  turmas: string[]
  alunosIds: string[]
  prioridade: 'normal' | 'alta' | 'urgente'
  fixado: boolean
  exigeCiencia: boolean
  permiteResposta: boolean
  dataEnvio: string
  dataAgendamento: string | null
  anexos: any[]
  leituras: Record<string, string>
  ciencias: Record<string, string>
  status: 'rascunho' | 'agendado' | 'enviado'
}

export type ADChat = { id: number | string, name: string, status: string, preview: string, time: string, unread: number, tag: string, date?: string, startDate?: string, startTime?: string }
export type ADMessage = { id: number | string, text: string, sender: 'them' | 'us', time: string, date?: string, author?: string, authorRole?: string }
export type ADMedia = { type: 'image' | 'video', url: string }
export type ADComment = { id: string, author: string, text: string, time: string }
export type ADChatGroup = { id: string, nome: string, cor?: string, colaboradoresIds: string[], alunosIds: string[] }
export type ADMomento = { id: number | string, author: string, targetClasses: string[], media: ADMedia[], desc: string, status: 'pending' | 'approved' | 'rejected', time: string, reason?: string, likes: string[], comments: ADComment[] }

export interface ADConfig {
  permissoes: { 
    chat: boolean
    comentariosMural: boolean
    visualizarAniversariantes?: boolean
    visualizarRelatorios?: boolean
    confirmarPresencaEventos?: boolean
    visualizarFinanceiro?: boolean
    visualizarNotas?: boolean
    visualizarFrequencia?: boolean
    visualizarOcorrencias?: boolean
    chamadaAlunoPortaria?: boolean
  }
  horarios: { inicio: string; fim: string; msgAusencia: string }
  notificacoes: { 
    pushComunicados: boolean
    pushMomentos: boolean
    pushFinanceiro: boolean
    pushCalendario: boolean
    pushMensagemChat: boolean
    pushRelatorios?: boolean
    pushAlteracaoCalendario?: boolean
  }
}

interface ADContextState {
  comunicados: ADComunicado[]
  setComunicados: (updater: (prev: ADComunicado[]) => ADComunicado[]) => void
  chatsList: ADChat[]
  setChatsList: React.Dispatch<React.SetStateAction<ADChat[]>>
  chatGroups: ADChatGroup[]
  setChatGroups: React.Dispatch<React.SetStateAction<ADChatGroup[]>>
  messages: Record<string, ADMessage[]>
  setMessages: React.Dispatch<React.SetStateAction<Record<string, ADMessage[]>>>
  momentosFeed: ADMomento[]
  setMomentosFeed: React.Dispatch<React.SetStateAction<ADMomento[]>>
  bannerUrl: string | null
  setBannerUrl: (url: string | null) => void
  adConfig: ADConfig
  setAdConfig: React.Dispatch<React.SetStateAction<ADConfig>>
  adAlert: (message: string, title?: string) => void
  adConfirm: (message: string, title?: string, onConfirm?: () => void) => void
  adLoading: boolean
  setAdLoading: React.Dispatch<React.SetStateAction<boolean>>
}

const AgendaDigitalContext = createContext<ADContextState>({
  comunicados: [],
  setComunicados: () => {},
  chatsList: [],
  setChatsList: () => {},
  chatGroups: [],
  setChatGroups: () => {},
  messages: {},
  setMessages: () => {},
  momentosFeed: [],
  setMomentosFeed: () => {},
  bannerUrl: null,
  setBannerUrl: () => {},
  adConfig: {
    permissoes: { chat: true, comentariosMural: false, visualizarAniversariantes: true, visualizarRelatorios: true, confirmarPresencaEventos: true, visualizarFinanceiro: true, visualizarNotas: true, visualizarFrequencia: true, visualizarOcorrencias: true, chamadaAlunoPortaria: true },
    horarios: { inicio: '07:00', fim: '18:00', msgAusencia: 'Fora do horário amigão' },
    notificacoes: { pushComunicados: true, pushMomentos: true, pushFinanceiro: true, pushCalendario: true, pushMensagemChat: true, pushRelatorios: true, pushAlteracaoCalendario: true }
  },
  setAdConfig: () => {},
  adAlert: () => {},
  adConfirm: () => {},
  adLoading: false,
  setAdLoading: () => {}
})

// Dados de semente para demonstração
const now = new Date()
const subDays = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString()

const MOCK_COMUNICADOS: ADComunicado[] = []
const MOCK_CHATS: ADChat[] = []
const MOCK_MESSAGES: Record<string, ADMessage[]> = {}
const MOCK_MOMENTOS: ADMomento[] = []

export function AgendaDigitalProvider({ children }: { children: React.ReactNode }) {
  const [comunicados, setComunicadosState] = useSupabaseArray<ADComunicado>('comunicados')
  const [chatsList, setChatsList] = useSupabaseArray<ADChat>('agenda/chats')
  const [chatGroups, setChatGroups] = useSupabaseArray<ADChatGroup>('agenda/grupos')
  const [messagesArray, setMessagesArray] = useSupabaseArray<any>('agenda/mensagens')
  const [momentosFeed, setMomentosFeed] = useSupabaseArray<ADMomento>('agenda/momentos')

  const messages = React.useMemo(() => {
    const record: Record<string, ADMessage[]> = {}
    if (messagesArray) {
      messagesArray.forEach((item: any) => {
        record[item.id] = item.messages || []
      })
    }
    return record
  }, [messagesArray])

  const setMessages = React.useCallback((updater: any) => {
    setMessagesArray((prev: any[]) => {
      const record: Record<string, ADMessage[]> = {}
      if (prev) {
        prev.forEach((item: any) => {
          record[item.id] = item.messages || []
        })
      }
      const nextRecord = typeof updater === 'function' ? updater(record) : updater
      
      // Converte de volta para array para salvar no banco
      return Object.entries(nextRecord).map(([id, msgs]) => ({ id, messages: msgs })) as any[]
    })
  }, [setMessagesArray])

  const [adLoading, setAdLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [bannerUrl, setBannerUrlState] = useState<string | null>(null)
  const [adConfig, setAdConfig] = useState<ADConfig>({
    permissoes: { chat: true, comentariosMural: false, visualizarAniversariantes: true, visualizarRelatorios: true, confirmarPresencaEventos: true, visualizarFinanceiro: true, visualizarNotas: true, visualizarFrequencia: true, visualizarOcorrencias: true, chamadaAlunoPortaria: true },
    horarios: { inicio: '07:00', fim: '18:00', msgAusencia: 'Olá!\nNosso horário de atendimento encerrou.' },
    notificacoes: { pushComunicados: true, pushMomentos: true, pushFinanceiro: false, pushCalendario: true, pushMensagemChat: true, pushRelatorios: true, pushAlteracaoCalendario: true }
  })

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/configuracoes?chaves=ad_banner,ad_config')
        if (res.ok) {
          const db = await res.json()
          if (db.ad_banner) setBannerUrlState(db.ad_banner)
          if (db.ad_config) setAdConfig(db.ad_config)
        }
      } catch(e) {
        console.error('Erro ao carregar configurações da agenda:', e)
      }
      setIsLoaded(true)
    }
    loadConfig()
  }, [])

  // Auto-Publish Cron Client-Side
  useEffect(() => {
    const interval = setInterval(() => {
      setComunicadosState((prev: ADComunicado[]) => {
        if (!prev || !prev.length) return prev;
        let hasChanges = false;
        const now = new Date();
        const updated = prev.map(c => {
          if (c.status === 'agendado' && c.dataAgendamento) {
            const agendaData = new Date(c.dataAgendamento);
            if (agendaData <= now) {
              hasChanges = true;
              return { ...c, status: 'enviado', dataEnvio: c.dataAgendamento };
            }
          }
          return c;
        });
        return hasChanges ? updated : prev;
      });
    }, 60000); // Verifica a cada 60 segundos
    return () => clearInterval(interval);
  }, [setComunicadosState]);

  const setComunicados = useCallback((updater: (prev: ADComunicado[]) => ADComunicado[]) => {
    setComunicadosState(updater)
  }, [])

  const [modalState, setModalState] = useState<{ isOpen: boolean, type: 'alert' | 'confirm', title: string, message: string, onConfirm?: () => void }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: ''
  })

  const adAlert = useCallback((message: string, title: string = 'Aviso') => {
    setModalState({ isOpen: true, type: 'alert', title, message })
  }, [])

  const adConfirm = useCallback((message: string, title: string = 'Confirmação', onConfirm?: () => void) => {
    setModalState({ isOpen: true, type: 'confirm', title, message, onConfirm })
  }, [])

  return (
    <AgendaDigitalContext.Provider value={{
      comunicados: comunicados || [],
      setComunicados,
      chatsList: chatsList || [],
      setChatsList,
      chatGroups: chatGroups || [],
      setChatGroups,
      messages: messages || {},
      setMessages,
      momentosFeed: momentosFeed || [],
      setMomentosFeed,
      bannerUrl,
      setBannerUrl: setBannerUrlState,
      adConfig: adConfig || {},
      setAdConfig,
      adAlert,
      adConfirm,
      adLoading,
      setAdLoading
    }}>
      {children}
      
      {modalState.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 400, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px 0', color: '#111827' }}>{modalState.title}</h3>
            <p style={{ margin: '0 0 24px 0', color: '#4b5563', fontSize: 15, lineHeight: 1.5 }}>{modalState.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              {modalState.type === 'confirm' && (
                <button 
                  onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                  style={{ padding: '8px 16px', borderRadius: 20, background: '#f3f4f6', border: 0, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              )}
              <button 
                onClick={() => {
                  if (modalState.type === 'confirm' && modalState.onConfirm) modalState.onConfirm()
                  setModalState(prev => ({ ...prev, isOpen: false }))
                }}
                style={{ padding: '8px 16px', borderRadius: 20, background: modalState.type === 'confirm' ? '#ef4444' : '#4f46e5', border: 0, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
              >
                {modalState.type === 'confirm' ? 'Confirmar' : 'Entendi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AgendaDigitalContext.Provider>
  )
}

export function useAgendaDigital() {
  return useContext(AgendaDigitalContext)
}
