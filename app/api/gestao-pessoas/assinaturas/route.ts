import { NextResponse } from 'next/server'
import { requireStaff, requireAdminOrDirecao } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const entidade_id = searchParams.get('entidade_id')

  try {
    const supabase = await createProtectedClient()

    let query = supabase
      .from('gp_assinaturas')
      .select('*')
      .order('created_at', { ascending: false })

    if (entidade_id) {
      query = query.eq('entidade_id', entidade_id)
    }

    const { data: assinaturas, error: assinaturasError } = await query
    if (assinaturasError) throw assinaturasError

    const userIds = [...new Set((assinaturas || []).map(a => a.user_id).filter(Boolean))]
    const supabaseAdmin = getAdminClient()
    const usersMap: Record<string, { nome: string; cargo: string; email: string }> = {}

    if (userIds.length > 0) {
      const { data: sysUsers } = await supabaseAdmin
        .from('system_users')
        .select('id, auth_id, nome, cargo, email')
        .or(`id.in.(${userIds.join(',')}),auth_id.in.(${userIds.join(',')})`)

      for (const su of sysUsers || []) {
        const entry = {
          nome: su.nome || su.email?.split('@')[0] || 'Usuário Desconhecido',
          cargo: su.cargo || 'Colaborador',
          email: su.email || ''
        }
        if (su.id) usersMap[su.id] = entry
        if (su.auth_id) usersMap[su.auth_id] = entry
      }

      const missingIds = userIds.filter(uid => !usersMap[uid])
      if (missingIds.length > 0) {
        await Promise.all(missingIds.map(async (uid) => {
          try {
            const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(uid)
            if (userAuth?.user) {
              usersMap[uid] = {
                nome: userAuth.user.user_metadata?.nome || userAuth.user.email?.split('@')[0] || 'Usuário Desconhecido',
                cargo: userAuth.user.user_metadata?.cargo || 'Colaborador',
                email: userAuth.user.email || ''
              }
            }
          } catch (err) {
            console.error('Error fetching user', uid, err)
          }
        }))
      }
    }

    const enrichedData = (assinaturas || []).map(a => ({
      ...a,
      user_nome: a.usuario_nome || usersMap[a.user_id]?.nome || 'Usuário Desconhecido',
      user_cargo: a.usuario_cargo || usersMap[a.user_id]?.cargo || 'Membro',
      user_email: a.usuario_email || usersMap[a.user_id]?.email || ''
    }))

    return NextResponse.json(enrichedData)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { senha, entidade_id, entidade_tipo } = body

    if (!senha || !entidade_id || !entidade_tipo) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // 1. Validar a senha autenticando com o supabase anon client
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const isShortPassword = String(senha).length > 0 && String(senha).length < 6
    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: user?.email || '',
      password: isShortPassword ? `${senha}::imp6` : String(senha)
    })

    if (signInError) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }

    // 2. Registrar assinatura
    const supabase = await createProtectedClient()
    const id = crypto.randomUUID()
    const hash = crypto.createHash('sha256').update(`${id}-${user?.id}-${Date.now()}`).digest('hex')
    
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'IP desconhecido'
    const userAgent = request.headers.get('user-agent') || 'Agent desconhecido'

    const { error } = await supabase
      .from('gp_assinaturas')
      .insert({
        id,
        user_id: user?.id,
        entidade_tipo,
        entidade_id,
        hash_assinatura: hash,
        ip_address: ip,
        user_agent: userAgent
      })

    if (error) throw error
    return NextResponse.json({ success: true, id, hash })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { errorResponse } = await requireAdminOrDirecao(request)
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const entidade_id = searchParams.get('entidade_id')

  try {
    const supabase = await createProtectedClient()
    
    if (id) {
      const { error } = await supabase
        .from('gp_assinaturas')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Assinatura excluída com sucesso.' })
    } else if (entidade_id) {
      const { error } = await supabase
        .from('gp_assinaturas')
        .delete()
        .eq('entidade_id', entidade_id)
      
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Todas as assinaturas do documento foram excluídas.' })
    } else {
      return NextResponse.json({ error: 'Parâmetro inválido' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
