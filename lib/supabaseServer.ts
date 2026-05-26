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
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // Use service role key on server so writes succeeded even without a session cookie
  // (many routes run in Next.js Edge/Node context without the user cookie)
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
)
