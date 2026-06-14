import { createClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const capacitorStorage = {
  getItem: async (key: string) => {
    const { value } = await Preferences.get({ key })
    return value
  },
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value })
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key })
  },
}

// Check if running on web vs native via capacitor (or just use capacitor storage if window exists)
const isBrowser = typeof window !== 'undefined'
const isCapacitor = isBrowser && !!(window as any).Capacitor

// Client-side (browser) — use in components with anon key (respects RLS by cookie)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isCapacitor ? capacitorStorage : (isBrowser ? window.localStorage : undefined),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})
