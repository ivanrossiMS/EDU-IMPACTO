import { createClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'

import { Capacitor } from '@capacitor/core'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

// We must store the client in a global variable in the browser to prevent Next.js Fast Refresh 
// from creating multiple instances and fighting for the lock:sb-<project>-auth-token Web Lock.
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
