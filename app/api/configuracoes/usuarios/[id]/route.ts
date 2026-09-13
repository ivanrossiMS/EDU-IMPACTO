import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()
  const body = await req.json()
  const { id } = await context.params
  
  const prepare = (b: any) => { 
     const out = { ...b }; 
     if ('ultimoAcesso' in out) { out.ultimoacesso = out.ultimoAcesso; delete out.ultimoAcesso; }
     return out;
  }
  
  const fixedBody = prepare(body)
  const { data: oldUser } = await supabase.from('system_users').select('id, auth_id, email, nome').eq('id', id).maybeSingle()

  const { data, error } = await supabase.from('system_users').update(fixedBody).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const supabaseAdmin = getAdminClient()
  const oldEmail = (oldUser?.email || '').trim().toLowerCase()
  const newEmail = (data?.email || fixedBody.email || '').trim().toLowerCase()
  const emailChanged = Boolean(oldEmail && newEmail && oldEmail !== newEmail)

  if (emailChanged) {
    // 1. Atualizar e-mail no Supabase Auth mantendo a mesma conta
    const authId = oldUser?.auth_id || oldUser?.id || id
    if (authId && authId.length > 10) {
      await supabaseAdmin.auth.admin.updateUserById(authId, {
        email: newEmail,
        email_confirm: true,
        user_metadata: {
          nome: fixedBody.nome || oldUser?.nome,
          cargo: fixedBody.cargo,
          perfil: fixedBody.perfil
        }
      }).catch((err: any) => console.error('[PUT usuario] Erro ao atualizar Auth email:', err?.message))
    }

    // 2. Atualizar o funcionário na tabela funcionarios
    if (oldEmail) {
      await supabaseAdmin.from('funcionarios').update({
        email: newEmail,
        ...(fixedBody.status !== undefined ? { status: fixedBody.status } : {}),
        ...(fixedBody.nome ? { nome: fixedBody.nome } : {}),
        ...(fixedBody.cargo ? { cargo: fixedBody.cargo } : {}),
        ...(fixedBody.perfil ? { perfil_sistema: fixedBody.perfil } : {})
      }).ilike('email', oldEmail)
    }
  } else if (data?.email && fixedBody.status !== undefined) {
    await supabaseAdmin.from('funcionarios').update({ status: fixedBody.status }).ilike('email', data.email)
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()
  const { id } = await context.params
  
  const { data: userRow } = await supabase.from('system_users').select('email').eq('id', id).maybeSingle()

  const { error } = await supabase.from('system_users').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Este usuário não pode ser excluído permanentemente porque possui registros vinculados a ele (como turmas, disciplinas, simulados, etc). Por favor, inative o usuário ao invés de excluí-lo.' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const supabaseAdmin = getAdminClient()
  
  if (id.length > 10) {
    await supabaseAdmin.auth.admin.deleteUser(id).catch((e: any) => console.error(e))
  }

  if (userRow?.email) {
    // Não deletar o funcionário do RH! Apenas remover o perfil de acesso ao sistema
    await supabaseAdmin.from('funcionarios').update({ perfil_sistema: '' }).ilike('email', userRow.email)
  }

  return NextResponse.json({ success: true })
}
