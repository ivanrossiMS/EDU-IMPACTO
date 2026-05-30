'use client';

import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  type: 'comunicado' | 'momento' | 'evento' | 'ocorrencia' | 'nota';
  title: string;
  description?: string;
  createdAt: string;
  read: boolean;
  link: string;
}

interface AgendaNotificationState {
  unreadCount: number;
  recentNotifications: NotificationItem[];
  addNotification: (item: NotificationItem) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setInitialData: (count: number, recents: NotificationItem[]) => void;
}

export const useAgendaNotifications = create<AgendaNotificationState>((set) => ({
  unreadCount: 0,
  recentNotifications: [],
  
  addNotification: (item) => set((state) => {
    // Evita duplicatas
    if (state.recentNotifications.some(n => n.id === item.id)) return state;
    
    return {
      unreadCount: state.unreadCount + 1,
      recentNotifications: [item, ...state.recentNotifications].slice(0, 20) // Keep last 20
    };
  }),

  markAsRead: (id) => set((state) => ({
    unreadCount: Math.max(0, state.unreadCount - 1),
    recentNotifications: state.recentNotifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    )
  })),

  markAllAsRead: () => set((state) => ({
    unreadCount: 0,
    recentNotifications: state.recentNotifications.map(n => ({ ...n, read: true }))
  })),

  setInitialData: (count, recents) => set({
    unreadCount: count,
    recentNotifications: recents
  })
}));
