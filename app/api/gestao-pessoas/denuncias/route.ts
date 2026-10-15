import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

function isHrOrAdmin(perfil?: string | null, cargo?: string | null): boolean {
  const p = String(perfil || '').toLowerCase()
  const c = String(cargo || '').toLowerCase()
  return (
    p.includes('admin') || p.includes('master') || p.includes('diret') || p.includes('rh') || p.includes('psic') ||
    c.includes('rh') || c.includes('recursos humanos') || c.includes('psic') || c.includes('diret')
  )
}

export async function GET(request: Request) {
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  if (!roleCtx.isStaff || !roleCtx.user) {
    return NextResponse.json({ error: 'Acesso restrito a colaboradores.' }, { status: 403 })
  }

  try {
    const supabase = await createProtectedClient()
    let query = supabase
      .from('gp_denuncias')
      .select('*')
      .order('created_at', { ascending: false })

    if (!isHrOrAdmin(roleCtx.perfil, roleCtx.cargo)) {
      query = query.eq('relator_id', roleCtx.user.id)
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  if (!roleCtx.isStaff || !roleCtx.user) {
    return NextResponse.json({ error: 'Acesso restrito a colaboradores.' }, { status: 403 })
  }

  try {
    const supabase = await createProtectedClient()
    const body = await request.json()
    const id = crypto.randomUUID()
    const isAnonimo = Boolean(body.anonimo)

    const { error } = await supabase
      .from('gp_denuncias')
      .insert({
        ...body,
        id,
        relator_id: isAnonimo ? null : (body.relator_id || roleCtx.user.id),
      })

    if (error) throw error
    return NextResponse.json({ success: true, id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
