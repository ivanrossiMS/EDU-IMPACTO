import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// URL and KEY for Service Role (MUST HAVE THIS TO CREATE USERS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY no env' }, { status: 500 })
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // 1. Fetch all local system_users
    const { data: users, error } = await supabaseAdmin.from('system_users').select('*')
    if (error) throw error

    let criados = 0
    let erros = 0

    // 2. Import into Auth
    for (const u of users || []) {
      const email = u.email?.trim().toLowerCase()
      if (!email) continue
      
      const { data: cUser, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: 'ChangeMe123!', // Standard initial password. The real password is on client storage unfortunately.
        email_confirm: true, // Auto confirmed via UI
        user_metadata: {
          uid_legacy: u.id,
          nome: u.nome,
          perfil: u.perfil,
          cargo: u.cargo
        }
      })

      if (cErr) {
        if (!cErr.message.includes('already exists') && !cErr.message.includes('already regist')) {
          console.error('Erro ao migrar', email, cErr.message)
          erros++
        }
      } else {
        // Optionally bind auth id back to system_users 
        await supabaseAdmin.from('system_users')
          .update({ id: cUser.user.id }) // WARNING: Cascading id changes could break Foreign Keys if they exist currently in other tables (e.g., perfis).
          .eq('id', u.id)
          .catch(() => null)
        
        criados++
      }
    }

    return NextResponse.json({ success: true, message: `Migração concluída: ${criados} criados, ${erros} erros. Senha padrão definida: ChangeMe123!` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
