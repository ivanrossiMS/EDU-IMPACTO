import { createClient } from '@supabase/supabase-js'

/**
 * Server-side client for API routes that still use supabaseServer import.
 * ⚠️ This bypasses RLS — being deprecated in favor of createProtectedClient().
 * 
 * Routes that perform user-context writes should migrate to:
 *   import { createProtectedClient } from '@/lib/server/supabaseServerFactory'
 * 
 * Routes that do system-level ops (backfill, webhooks) should use:
 *   import { createAdminClient } from '@/lib/server/supabaseServerFactory'
 */
function cleanEnvKey(key?: string): string {
  if (!key) return ''
  return key.trim().replace(/^['"]|['"]$/g, '')
}

const url = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_URL) || 'https://lrpwerkkqrjkcauofhph.supabase.co'
const serviceRole = cleanEnvKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
const anonKey = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHdlcmtrcXJqa2NhdW9maHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDAzMjYsImV4cCI6MjA5MDk3NjMyNn0.1-_0vMiLn0Y9piS90150Ur7qx8ic1Kz64RuhiaVGLhg'
const key = serviceRole || anonKey || defaultAnonKey

export const supabaseServer = createClient(
  url,
  key,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
)
