import { NextResponse } from 'next/server'
import { requireStaff, clearAuthGuardCache } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { getAdminClient, getAllAuthUsersCached, invalidateAuthUsersCache } from '@/lib/server/supabaseAdminSingleton'
import {
  isStudentInactiveStatus,
  isStudentAccessBlocked,
  isResponsavelAccessBlocked,
  checkResponsavelHasActiveStudent,
  syncStudentAndGuardiansAccess,
} from '@/lib/server/studentStatusHelper'
import { invalidateAlunosCache } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { type, id, status } = body || {}

    if (!type || !id || !['aluno', 'responsavel'].includes(type)) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }

    const cleanId = String(id).trim()

    if (type === 'aluno') {
      const { data: student } = await supabase
        .from('alunos')
        .select('*')
        .or(`id.eq.${cleanId},matricula.eq.${cleanId}`)
        .limit(1)
        .maybeSingle()

      if (!student) {
        return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 })
      }

      const currentlyBlocked = isStudentAccessBlocked(student)
      const nextStatus: 'ATIVO' | 'INATIVO' = status
        ? String(status).toUpperCase() === 'INATIVO'
          ? 'INATIVO'
          : 'ATIVO'
        : currentlyBlocked
          ? 'ATIVO'
          : 'INATIVO'

      if (nextStatus === 'ATIVO' && isStudentInactiveStatus(student)) {
        return NextResponse.json(
          {
            error:
              'Não é possível ativar o acesso de um aluno com matrícula inativa. Reative primeiro a matrícula em Acadêmico > Alunos.',
          },
          { status: 400 }
        )
      }

      const updatedDados = {
        ...(student.dados || {}),
        acesso_inativo: nextStatus === 'INATIVO',
        acesso_bloqueado: nextStatus === 'INATIVO',
        auth_status: nextStatus,
      }

      const { error: updErr } = await supabase
        .from('alunos')
        .update({ dados: updatedDados })
        .eq('id', student.id)

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }

      await syncStudentAndGuardiansAccess(String(student.id))
      invalidateAlunosCache()
      clearAuthGuardCache()

      return NextResponse.json({
        ok: true,
        status: nextStatus,
        message: `Acesso do aluno ${student.nome} alterado para ${nextStatus}.`,
      })
    }

    // type === 'responsavel'
    const { data: resp } = await supabase
      .from('responsaveis')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle()

    if (!resp) {
      return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 404 })
    }

    const { hasActiveStudent } = await checkResponsavelHasActiveStudent(String(resp.id), {
      requireFinOrPed: true,
    })

    const currentlyBlocked = !hasActiveStudent || isResponsavelAccessBlocked(resp)
    const nextStatus: 'ATIVO' | 'INATIVO' = status
      ? String(status).toUpperCase() === 'INATIVO'
        ? 'INATIVO'
        : 'ATIVO'
      : currentlyBlocked
        ? 'ATIVO'
        : 'INATIVO'

    if (nextStatus === 'ATIVO' && !hasActiveStudent) {
      return NextResponse.json(
        {
          error:
            'Não é possível ativar o acesso deste responsável pois não há alunos ativos vinculados a ele.',
        },
        { status: 400 }
      )
    }

    const updatedDados = {
      ...(resp.dados || {}),
      acesso_inativo: nextStatus === 'INATIVO',
      acesso_bloqueado: nextStatus === 'INATIVO',
      auth_status: nextStatus,
    }

    const { error: updErr } = await supabase
      .from('responsaveis')
      .update({ dados: updatedDados })
      .eq('id', resp.id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    const admin = getAdminClient()
    if (admin) {
      const authUsers = await getAllAuthUsersCached()
      const remail = String(resp.email || resp.dados?.email || '').trim().toLowerCase()
      const { data: sysUser } = remail
        ? await supabase
            .from('system_users')
            .select('id, status')
            .ilike('email', remail)
            .maybeSingle()
        : { data: null }
      const isStaff = Boolean(sysUser && String(sysUser.status || 'ativo').toLowerCase() !== 'inativo')

      const matchedAuth = authUsers.filter((u: any) => {
        const ue = String(u.email || '').trim().toLowerCase()
        return (
          (resp.auth_id && u.id === resp.auth_id) ||
          (remail && ue === remail) ||
          String(u.user_metadata?.responsavel_id || '') === String(resp.id)
        )
      })

      for (const au of matchedAuth) {
        if (isStaff) {
          await admin.auth.admin
            .updateUserById(au.id, {
              ban_duration: 'none',
              user_metadata: {
                ...(au.user_metadata || {}),
                hasDualRole: nextStatus === 'ATIVO',
              },
            })
            .catch(() => {})
        } else if (nextStatus === 'INATIVO') {
          await admin.auth.admin
            .updateUserById(au.id, {
              ban_duration: '876000h',
              user_metadata: {
                ...(au.user_metadata || {}),
                status: 'inativo',
                acesso_bloqueado: true,
              },
            })
            .catch(() => {})
          await admin.auth.admin.signOut(au.id, 'global').catch(() => {})
        } else {
          await admin.auth.admin
            .updateUserById(au.id, {
              ban_duration: 'none',
              user_metadata: {
                ...(au.user_metadata || {}),
                status: 'ativo',
                acesso_bloqueado: false,
              },
            })
            .catch(() => {})
        }
      }
      invalidateAuthUsersCache()
    }

    clearAuthGuardCache()

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      message: `Acesso do responsável ${resp.nome} alterado para ${nextStatus}.`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro interno.' }, { status: 500 })
  }
}
