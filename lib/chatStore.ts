import { create } from 'zustand'

export interface ChatConversationMeta {
  id: string
  type: 'direct' | 'group'
  title: string
  subtitle?: string
  ano_letivo?: string | number | null
  isGroup?: boolean
  turma_id?: string | null
  grupo_id?: string | null
  aluno_id?: string | null
  aluno_nome?: string | null
  aluno_turma?: string | null
  avatarUrl?: string | null
  unreadCount?: number
  context?: 'familia' | 'colaborador'
  hasLeft?: boolean
  leftAt?: string | null
  isReadOnly?: boolean
  isArchived?: boolean
  lastMessageText?: string | null
  lastMessageAt?: string | null
  lastMessageBy?: string | null
  otherParticipant?: {
    id: string
    nome: string
    perfil?: string
    foto?: string | null
  } | null
}

interface ChatStoreState {
  isModalOpen: boolean
  isDrawerOpen: boolean
  activeConversation: ChatConversationMeta | null
  unreadTotal: number
  lastArchiveUpdated: { convId: string; isArchived: boolean } | null
  
  // Actions
  setUnreadTotal: (count: number) => void
  openConversationModal: (conv: ChatConversationMeta) => void
  closeConversationModal: () => void
  openDrawer: () => void
  closeDrawer: () => void
  toggleDrawer: () => void
  notifyArchiveChanged: (convId: string, isArchived: boolean) => void
  updateActiveConversation: (partial: Partial<ChatConversationMeta>) => void
}

export const useChatStore = create<ChatStoreState>((set) => ({
  isModalOpen: false,
  isDrawerOpen: false,
  activeConversation: null,
  unreadTotal: 0,
  lastArchiveUpdated: null,

  setUnreadTotal: (count: number) => set({ unreadTotal: Math.max(0, count) }),

  openConversationModal: (conv: ChatConversationMeta) => {
    set(state => ({
      isModalOpen: true,
      isDrawerOpen: false, // fecha a gaveta ao abrir o modal
      activeConversation: { ...conv, unreadCount: 0 },
      unreadTotal: conv.unreadCount && conv.unreadCount > 0
        ? Math.max(0, state.unreadTotal - conv.unreadCount)
        : state.unreadTotal
    }))
  },

  closeConversationModal: () => {
    set({
      isModalOpen: false,
      isDrawerOpen: true, // Mantém/volta a gaveta do floating icon aberta ao fechar o modal
      activeConversation: null
    })
  },

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set(state => ({ isDrawerOpen: !state.isDrawerOpen })),

  notifyArchiveChanged: (convId: string, isArchived: boolean) => {
    set(state => ({
      lastArchiveUpdated: { convId, isArchived },
      activeConversation: state.activeConversation?.id === convId
        ? { ...state.activeConversation, isArchived }
        : state.activeConversation
    }))
  },

  updateActiveConversation: (partial: Partial<ChatConversationMeta>) => {
    set(state => ({
      activeConversation: state.activeConversation ? { ...state.activeConversation, ...partial } : null
    }))
  }
}))

export function formatTurmaBadge(nome?: string): string {
  if (!nome) return ''
  const trimmed = nome.trim()
  if (trimmed.includes(' - ')) {
    const [main, shift] = trimmed.split(' - ')
    if (shift && shift.toUpperCase().includes('INTEGRAL') && !main.match(/\s[A-Z]$/i)) {
      return `${main} (Int.)`
    }
    return main
  }
  return trimmed
}

