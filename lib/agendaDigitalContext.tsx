'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { useData } from './dataContext'

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

export type ADChat = { id: number | string, name: string, status: string, preview: string, time: string, unread: number, tag: string }
export type ADMessage = { id: number | string, text: string, sender: 'them' | 'us', time: string }
export type ADMedia = { type: 'image' | 'video', url: string }
export type ADComment = { id: string, author: string, text: string, time: string }
export type ADMomento = { id: number | string, author: string, targetClasses: string[], media: ADMedia[], desc: string, status: 'pending' | 'approved' | 'rejected', time: string, reason?: string, likes: string[], comments: ADComment[] }

export interface ADConfig {
  permissoes: { chat: boolean; segundaVia: boolean; comentariosMural: boolean }
  horarios: { inicio: string; fim: string; msgAusencia: string }
  notificacoes: { pushComunicados: boolean; pushMomentos: boolean; pushFinanceiro: boolean; pushCalendario: boolean; pushMensagemChat: boolean }
}

interface ADContextState {
  comunicados: ADComunicado[]
  setComunicados: (updater: (prev: ADComunicado[]) => ADComunicado[]) => void
  chatsList: ADChat[]
  setChatsList: React.Dispatch<React.SetStateAction<ADChat[]>>
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
}

const AgendaDigitalContext = createContext<ADContextState>({
  comunicados: [],
  setComunicados: () => {},
  chatsList: [],
  setChatsList: () => {},
  messages: {},
  setMessages: () => {},
  momentosFeed: [],
  setMomentosFeed: () => {},
  bannerUrl: null,
  setBannerUrl: () => {},
  adConfig: {
    permissoes: { chat: true, segundaVia: true, comentariosMural: false },
    horarios: { inicio: '07:00', fim: '18:00', msgAusencia: 'Fora do horário amigão' },
    notificacoes: { pushComunicados: true, pushMomentos: true, pushFinanceiro: true, pushCalendario: true, pushMensagemChat: true }
  },
  setAdConfig: () => {},
  adAlert: () => {},
  adConfirm: () => {}
})

// Dados de semente para demonstração
const now = new Date()
const subDays = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString()

const MOCK_COMUNICADOS: ADComunicado[] = []
const MOCK_CHATS: ADChat[] = []
const MOCK_MESSAGES: Record<string, ADMessage[]> = {}
const MOCK_MOMENTOS: ADMomento[] = []

export function AgendaDigitalProvider({ children }: { children: React.ReactNode }) {
  const [comunicados, setComunicadosState] = useState<ADComunicado[]>(MOCK_COMUNICADOS)
  const [chatsList, setChatsList] = useState<ADChat[]>(MOCK_CHATS)
  const [messages, setMessages] = useState<Record<string, ADMessage[]>>(MOCK_MESSAGES)
  const [momentosFeed, setMomentosFeed] = useState<ADMomento[]>(MOCK_MOMENTOS)

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedChats = localStorage.getItem('ad_chats_v3')
        if (storedChats) setChatsList(JSON.parse(storedChats))
        const storedMsgs = localStorage.getItem('ad_messages_v3')
        if (storedMsgs) setMessages(JSON.parse(storedMsgs))
        const storedMomentos = localStorage.getItem('ad_momentos_v3')
        if (storedMomentos) setMomentosFeed(JSON.parse(storedMomentos))
        const storedComunicados = localStorage.getItem('ad_comunicados_v3')
        if (storedComunicados) setComunicadosState(JSON.parse(storedComunicados))

        // Tenta buscar configurações Globais do Servidor
        try {
          const res = await fetch('/api/configuracoes?chaves=ad_banner,ad_config')
          if (res.ok) {
            const db = await res.json()
            if (db.ad_banner) {
              setBannerUrlState(db.ad_banner)
              localStorage.setItem('ad_banner', db.ad_banner)
            } else {
              const storedBanner = localStorage.getItem('ad_banner')
              if (storedBanner) setBannerUrlState(storedBanner)
              else setBannerUrlState('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=2000')
            }
            if (db.ad_config) {
              setAdConfig(db.ad_config)
              localStorage.setItem('ad_config', JSON.stringify(db.ad_config))
            } else {
              const storedConfig = localStorage.getItem('ad_config')
              if (storedConfig) setAdConfig(JSON.parse(storedConfig))
            }
          }
        } catch(e) {
          // Fallback offline
          const storedBanner = localStorage.getItem('ad_banner')
          if (storedBanner) setBannerUrlState(storedBanner)
          else setBannerUrlState('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=2000')
          
          const storedConfig = localStorage.getItem('ad_config')
          if (storedConfig) setAdConfig(JSON.parse(storedConfig))
        }
      } catch (e) {
        console.error(e)
      }
      setIsLoaded(true)
    }
    loadData()
  }, [])

  useEffect(() => {
    if(chatsList !== MOCK_CHATS) {
      try { localStorage.setItem('ad_chats_v3', JSON.stringify(chatsList)) } catch(e) { console.warn('Quota exceeded', e) }
    }
  }, [chatsList])

  useEffect(() => {
    if(messages !== MOCK_MESSAGES) {
      try { localStorage.setItem('ad_messages_v3', JSON.stringify(messages)) } catch(e) { console.warn('Quota exceeded', e) }
    }
  }, [messages])

  useEffect(() => {
    if(momentosFeed !== MOCK_MOMENTOS) {
      try { localStorage.setItem('ad_momentos_v3', JSON.stringify(momentosFeed)) } catch(e) { console.warn('Quota exceeded for Momentos. Using memory only.') }
    }
  }, [momentosFeed])

  useEffect(() => {
    if(comunicados !== MOCK_COMUNICADOS) {
      try { localStorage.setItem('ad_comunicados_v3', JSON.stringify(comunicados)) } catch(e) { console.warn('Quota exceeded', e) }
    }
  }, [comunicados])

  const [isLoaded, setIsLoaded] = useState(false)

  const [adConfig, setAdConfig] = useState<ADConfig>({
    permissoes: { chat: true, segundaVia: true, comentariosMural: false },
    horarios: { inicio: '07:00', fim: '18:00', msgAusencia: 'Olá!\nNosso horário de atendimento encerrou.' },
    notificacoes: { pushComunicados: true, pushMomentos: true, pushFinanceiro: false, pushCalendario: true, pushMensagemChat: true }
  })
  
  useEffect(() => {
    if (isLoaded) localStorage.setItem('ad_config', JSON.stringify(adConfig))
  }, [adConfig, isLoaded])

  const [bannerUrl, setBannerUrlState] = useState<string | null>(null)
  
  useEffect(() => {
    if (isLoaded && bannerUrl) localStorage.setItem('ad_banner', bannerUrl)
  }, [bannerUrl, isLoaded])

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
      comunicados,
      setComunicados,
      chatsList,
      setChatsList,
      messages,
      setMessages,
      momentosFeed,
      setMomentosFeed,
      bannerUrl,
      setBannerUrl: setBannerUrlState,
      adConfig,
      setAdConfig,
      adAlert,
      adConfirm
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
