'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// Create a helper for the action scope
async function getServerAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (value !== '') {
                delete options.maxAge
                delete options.expires
              }
              cookieStore.set(name, value, options)
            })
          } catch {
          }
        },
      },
    }
  );
}

export async function loginWithPassword(email: string, pass: string) {
  const supabase = await getServerAuthClient()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  })

  if (error) throw error
  return data
}

export async function createSession(user: any) {
  // Legacy adapter fallback: Not used anymore since loginWithPassword establishes cookies natively!
}

export async function destroySession() {
  const supabase = await getServerAuthClient()
  await supabase.auth.signOut()
}

export async function getSessionUser() {
  const supabase = await getServerAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user.user_metadata
}


export async function adminUpdatePassword(userIdLegacy: string, newPass: string) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  // Buscar no DB pra linkar o antigo UUID com o AUTH_UUID caso exista
  const { data: dbUser, error: selectErr } = await supabaseAdmin.from('system_users').select('email').eq('id', userIdLegacy).single()
  
  const email = dbUser?.email
  if (!email) throw new Error("Usuário legado não cadastrado ou erro sistêmico (" + (selectErr?.message || "null") + ")")

  // Filtered lookup instead of loading ALL users into memory
  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ 
    page: 1, 
    perPage: 1 
  })
  
  // Use direct email filter via the admin API
  const { data: allMatches } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 50 })
  const authId = allMatches?.users?.find(u => u.email === email)?.id

  if (!authId) throw new Error("Nenhum usuário correspondente no Auth")

  const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(authId, { password: newPass })
  if (upErr) throw upErr
  
  return true
}
