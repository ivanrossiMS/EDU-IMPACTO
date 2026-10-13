import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

/**
 * Server-side client for API routes that still use supabaseServer import.
 * Reuses the singleton instance from supabaseAdminSingleton.ts.
 */
export const supabaseServer = getAdminClient()
