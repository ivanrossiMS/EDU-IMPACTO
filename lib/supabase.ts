import { createClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'

import { Capacitor } from '@capacitor/core'

const defaultUrl = 'https://lrpwerkkqrjkcauofhph.supabase.co'
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHdlcmtrcXJqa2NhdW9maHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDAzMjYsImV4cCI6MjA5MDk3NjMyNn0.1-_0vMiLn0Y9piS90150Ur7qx8ic1Kz64RuhiaVGLhg'

const cleanStr = (s?: string) => s ? s.trim().replace(/^['"]|['"]$/g, '') : ''

const supabaseUrl = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_URL) || defaultUrl
const supabaseAnonKey = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || defaultAnonKey

// Custom async storage adapter that evaluates native platform at runtime
const customStorage = {
  getItem: async (key: string) => {
    if (typeof window === 'undefined') return null;
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key })
      return value
    }
    return window.localStorage.getItem(key)
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value })
    } else {
      window.localStorage.setItem(key, value)
    }
  },
  removeItem: async (key: string) => {
    if (typeof window === 'undefined') return;
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key })
    } else {
      window.localStorage.removeItem(key)
    }
  },
}

const isBrowser = typeof window !== 'undefined'

// Singleton instance to prevent Next.js Fast Refresh or multiple imports
// from creating multiple instances and fighting for the auth lock.
let client: ReturnType<typeof createClient>

if (isBrowser) {
  if (!(window as any)._supabaseClient) {
    (window as any)._supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      }
    })
  }
  client = (window as any)._supabaseClient
} else {
  // During SSR, we don't have localStorage and we don't want to persist/refresh the session
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: undefined,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  })
}

export const supabase = client

