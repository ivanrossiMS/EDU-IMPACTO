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

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  if (!roleCtx.isStaff || !isHrOrAdmin(roleCtx.perfil, roleCtx.cargo)) {
    return NextResponse.json({ error: 'Apenas Administradores, Diretores ou RH podem excluir denúncias.' }, { status: 403 })
  }

  try {
    const supabase = await createProtectedClient()
    const { error } = await supabase
      .from('gp_denuncias')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  if (!roleCtx.isStaff || !isHrOrAdmin(roleCtx.perfil, roleCtx.cargo)) {
    return NextResponse.json({ error: 'Apenas Administradores, Diretores ou RH podem alterar o status de denúncias.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()
    const { error } = await supabase
      .from('gp_denuncias')
      .update({ status: body.status, atualizado_em: new Date().toISOString() })
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
