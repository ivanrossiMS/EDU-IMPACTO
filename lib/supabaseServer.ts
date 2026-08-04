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
import { getValidSupabaseKey } from '@/lib/server/supabaseAdminSingleton'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^['"]|['"]$/g, '') || 'https://lrpwerkkqrjkcauofhph.supabase.co'
const key = getValidSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

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
