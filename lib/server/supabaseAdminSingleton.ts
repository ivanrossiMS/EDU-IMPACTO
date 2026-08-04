/**
 * supabaseAdminSingleton.ts
 *
 * Singleton lazy-init do cliente Supabase Admin (service role).
 * Reutilizado entre hot paths no mesmo processo Node.js, evitando
 * re-criação desnecessária do cliente a cada request.
 *
 * ⚠️  APENAS para operações sistêmicas (delete cascade, auth admin, backfill).
 * NUNCA use para escrever dados vindos do usuário final (bypassa RLS).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _adminClient: SupabaseClient | null = null

const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHdlcmtrcXJqa2NhdW9maHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDAzMjYsImV4cCI6MjA5MDk3NjMyNn0.1-_0vMiLn0Y9piS90150Ur7qx8ic1Kz64RuhiaVGLhg'

export function getValidSupabaseKey(primaryKey?: string, fallbackKey?: string): string {
  const cleanKey = (k?: string) => k ? k.trim().replace(/^['"]|['"]$/g, '') : ''
  const candidate1 = cleanKey(primaryKey)
  const candidate2 = cleanKey(fallbackKey)

  const isValid = (k: string) => {
    if (!k || k.length < 50) return false
    try {
      const parts = k.split('.')
      if (parts.length !== 3) return false
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
      return payload.ref === 'lrpwerkkqrjkcauofhph'
    } catch {
      return false
    }
  }

  if (isValid(candidate1)) return candidate1
  if (isValid(candidate2)) return candidate2
  return DEFAULT_ANON_KEY
}

export function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^['"]|['"]$/g, '') || 'https://lrpwerkkqrjkcauofhph.supabase.co'
  const key = getValidSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!_adminClient) {
    _adminClient = createClient(
      url,
      key,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }
  return _adminClient
}

/**
 * Helper: busca um usuário do Auth diretamente por email.
 * Substitui o padrão listUsers({ perPage: 1000 }).find() que trafega
 * até 1.000 registros para encontrar 1 usuário.
 */
export async function getAuthUserByEmail(email: string) {
  const admin = getAdminClient()
  // Supabase Admin SDK v2 não tem getUserByEmail direto, mas podemos
  // buscar via system_users (fonte de verdade interna) ou usar filter da listagem
  // com página pequena. A alternativa correta é buscar na tabela system_users primeiro.
  const { data: systemUser } = await admin
    .from('system_users')
    .select('id, email, nome, cargo, perfil, status')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  return systemUser
}

/**
 * Helper: busca um usuário do Supabase Auth por email usando filter.
 * Usa a tabela system_users como fonte primária (O(1) com índice)
 * em vez de carregar todos os usuários do Auth (O(n)).
 */
export async function lookupAuthUserByEmail(email: string) {
  const admin = getAdminClient()
  // Busca na tabela interna — sempre consistente e indexada
  const { data: found } = await admin
    .from('system_users')
    .select('id, email, nome, cargo, perfil, status')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()
  
  if (!found) return null
  
  // Se precisar dos dados completos do Supabase Auth, busca só esse usuário
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(found.id)
    return authUser?.user || null
  } catch {
    return null
  }
}
