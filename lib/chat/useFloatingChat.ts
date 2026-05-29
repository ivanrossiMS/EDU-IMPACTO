'use client'

// lib/chat/useFloatingChat.ts
// Global Zustand store for the floating chat panel state
// Persists `isOpen` preference in localStorage

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type PanelTab = 'recent' | 'unread' | 'sent'

interface FloatingChatState {
  // State
  isOpen: boolean
  activeConversationId: string | null
  panelTab: PanelTab

  // Actions
  open: () => void
  close: () => void
  toggle: () => void
  openConversation: (id: string) => void
  closeConversation: () => void
  setPanelTab: (tab: PanelTab) => void
}

export const useFloatingChat = create<FloatingChatState>()(
  persist(
    (set) => ({
      isOpen: false,
      activeConversationId: null,
      panelTab: 'recent',

      open: () => set({ isOpen: true }),

      close: () =>
        set({ isOpen: false, activeConversationId: null }),

      toggle: () =>
        set((state) => ({
          isOpen: !state.isOpen,
          // Close active conversation when closing panel
          activeConversationId: state.isOpen ? null : state.activeConversationId,
        })),

      openConversation: (id: string) =>
        set({ isOpen: true, activeConversationId: id }),

      closeConversation: () =>
        set({ activeConversationId: null }),

      setPanelTab: (tab: PanelTab) => set({ panelTab: tab }),
    }),
    {
      name: 'edu-floating-chat',
      storage: createJSONStorage(() => {
        // SSR-safe localStorage access
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }
        }
        return localStorage
      }),
      // Only persist the panel open state, not the active conversation
      partialize: (state) => ({ isOpen: state.isOpen, panelTab: state.panelTab }),
    },
  ),
)
