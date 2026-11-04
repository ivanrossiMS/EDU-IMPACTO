import { NextResponse } from 'next/server'
import { requireStaff, requireAdminOrDirecao, clearAuthGuardCache } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient, invalidateAuthUsersCache } from '@/lib/server/supabaseAdminSingleton'
import { invalidateColaboradoresCache } from '@/lib/server/colaboradoresCache'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireStaff(req)
  if (errorResponse) return errorResponse
  const { errorResponse: adminErr } = await requireAdminOrDirecao(req)
  if (adminErr) return adminErr

  const supabaseAdmin = getAdminClient()
  const body = await req.json()
  const { id } = await context.params
  
  const prepare = (b: any) => { 
     const out = { ...b }; 
     if ('ultimoAcesso' in out) { out.ultimoacesso = out.ultimoAcesso; delete out.ultimoAcesso; }
     return out;
  }
  
  const fixedBody = prepare(body)
  const { data: oldUser } = await supabaseAdmin.from('system_users').select('id, auth_id, email, nome, cargo, perfil').eq('id', id).maybeSingle()

  const { data, error } = await supabaseAdmin.from('system_users').update(fixedBody).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateColaboradoresCache()
  clearAuthGuardCache()
  invalidateAuthUsersCache()

  const oldEmail = (oldUser?.email || '').trim().toLowerCase()
  const newEmail = (data?.email || fixedBody.email || '').trim().toLowerCase()
  const emailChanged = Boolean(oldEmail && newEmail && oldEmail !== newEmail)
  const authId = oldUser?.auth_id || oldUser?.id || id
  const isAuthUuid = Boolean(authId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authId))

  if (emailChanged) {
    // 1. Atualizar e-mail no Supabase Auth mantendo a mesma conta
    if (isAuthUuid) {
      const { data: authRes } = await supabaseAdmin.auth.admin.getUserById(authId).catch(() => ({ data: { user: null } }))
      const existingMeta = authRes?.user?.user_metadata || {}
      await supabaseAdmin.auth.admin.updateUserById(authId, {
        email: newEmail,
        email_confirm: true,
        user_metadata: {
          ...existingMeta,
          nome: fixedBody.nome ?? oldUser?.nome ?? existingMeta.nome,
          cargo: fixedBody.cargo ?? oldUser?.cargo ?? existingMeta.cargo,
          perfil: fixedBody.perfil ?? oldUser?.perfil ?? existingMeta.perfil
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
  } else {
    if (isAuthUuid && (fixedBody.nome !== undefined || fixedBody.cargo !== undefined || fixedBody.perfil !== undefined)) {
      const { data: authRes } = await supabaseAdmin.auth.admin.getUserById(authId).catch(() => ({ data: { user: null } }))
      const existingMeta = authRes?.user?.user_metadata || {}
      await supabaseAdmin.auth.admin.updateUserById(authId, {
        user_metadata: {
          ...existingMeta,
          ...(fixedBody.nome !== undefined ? { nome: fixedBody.nome } : {}),
          ...(fixedBody.cargo !== undefined ? { cargo: fixedBody.cargo } : {}),
          ...(fixedBody.perfil !== undefined ? { perfil: fixedBody.perfil } : {})
        }
      }).catch((err: any) => console.error('[PUT usuario] Erro ao atualizar Auth metadata:', err?.message))
    }

    if (data?.email && (fixedBody.status !== undefined || fixedBody.perfil !== undefined || fixedBody.nome !== undefined || fixedBody.cargo !== undefined)) {
      await supabaseAdmin.from('funcionarios').update({
        ...(fixedBody.status !== undefined ? { status: fixedBody.status } : {}),
        ...(fixedBody.nome ? { nome: fixedBody.nome } : {}),
        ...(fixedBody.cargo ? { cargo: fixedBody.cargo } : {}),
        ...(fixedBody.perfil !== undefined ? { perfil_sistema: fixedBody.perfil } : {})
      }).ilike('email', data.email)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireStaff(req)
  if (errorResponse) return errorResponse
  const { errorResponse: adminErr } = await requireAdminOrDirecao(req)
  if (adminErr) return adminErr

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

  invalidateColaboradoresCache()
  clearAuthGuardCache()
  invalidateAuthUsersCache()

  const supabaseAdmin = getAdminClient()
  
  // Verifica se o usuário também é Responsável ou Aluno (para não excluir a conta de acesso da família)
  let isResponsavelOrAluno = false
  if (userRow?.email) {
    const emailLower = userRow.email.trim().toLowerCase()
    const { data: respCheck } = await supabaseAdmin.from('responsaveis').select('id').ilike('email', emailLower).limit(1)
    const { data: alunoCheck } = await supabaseAdmin.from('alunos').select('id').ilike('email', emailLower).limit(1)
    isResponsavelOrAluno = Boolean((respCheck && respCheck.length > 0) || (alunoCheck && alunoCheck.length > 0))
  }

  if (id.length > 10) {
    if (isResponsavelOrAluno) {
      // Preserva a conta no Auth (usada como Responsável/Aluno), apenas remove acesso de colaborador
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: {
          colaborador_id: null,
          system_user_id: null,
          hasDualRole: false,
          perfil: 'Família',
          cargo: 'Responsável'
        }
      }).catch((e: any) => console.error(e))
    } else {
      await supabaseAdmin.auth.admin.deleteUser(id).catch((e: any) => console.error(e))
    }
  }

  if (userRow?.email) {
    // Não deletar o funcionário do RH! Apenas remover o perfil de acesso ao sistema
    await supabaseAdmin.from('funcionarios').update({ perfil_sistema: '' }).ilike('email', userRow.email)
  }

  return NextResponse.json({ success: true })
}

