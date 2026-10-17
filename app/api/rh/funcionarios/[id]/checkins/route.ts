import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient, getAllAuthUsersCached } from '@/lib/server/supabaseAdminSingleton'

export async function GET(request: Request, context: any) {
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse || !roleCtx.user) return roleCtx.errorResponse || NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Using await on params to avoid next.js 15 sync access errors
  const params = await context.params;
  const funcionarioId = params.id;

  const supabase = getAdminClient()

  try {
    // 1. Fetch funcionario email
    const { data: func, error: funcError } = await supabase
      .from('funcionarios')
      .select('id, email')
      .eq('id', funcionarioId)
      .single()
      
    if (funcError || !func?.email) {
       return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    const p = String(roleCtx.perfil || '').toLowerCase()
    const c = String(roleCtx.cargo || '').toLowerCase()
    const isHrOrAdmin = roleCtx.isStaff && (
      p.includes('admin') || p.includes('master') || p.includes('diret') || p.includes('rh') || p.includes('psic') || p.includes('gestao de pessoas') || p.includes('gestão de pessoas') ||
      c.includes('rh') || c.includes('psic') || c.includes('recursos humanos') || c.includes('diret') || c.includes('gestao de pessoas') || c.includes('gestão de pessoas')
    )
    const callerEmail = String(roleCtx.user.email || roleCtx.dbUser?.email || '').trim().toLowerCase()
    const isSelf =
      String(roleCtx.user.id) === String(funcionarioId) ||
      (callerEmail && callerEmail === func.email.trim().toLowerCase())

    if (!isHrOrAdmin && !isSelf) {
      return NextResponse.json({ error: 'Acesso restrito ao próprio colaborador, RH ou Diretoria.' }, { status: 403 })
    }

    // 2. Fetch all system_users matching the email (case insensitive)
    const { data: sysUsers } = await supabase
      .from('system_users')
      .select('id, auth_id')
      .ilike('email', func.email)

    let checkinsData = [];
    const validIds = new Set<string>();
    sysUsers?.forEach(u => {
      if (u.id) validIds.add(String(u.id))
      if (u.auth_id) validIds.add(String(u.auth_id))
    })

    // 2.5 Query cached auth.users to get the uid_legacy if it exists
    try {
      const authUsers = await getAllAuthUsersCached();
      const matchedAuthUsers = authUsers.filter(u => u.email?.toLowerCase() === func.email.toLowerCase());
      for (const u of matchedAuthUsers) {
        validIds.add(u.id);
        if (u.user_metadata?.uid_legacy) {
          validIds.add(String(u.user_metadata.uid_legacy));
        }
      }
    } catch (err) {
      console.log('Error fetching auth users:', err);
    }

    if (validIds.size > 0) {
      // 3. Fetch checkins using all possible IDs
      const { data: checkins, error: checkinsError } = await supabase
        .from('colaborador_checkin')
        .select('*')
        .in('usuario_id', Array.from(validIds))
        .order('data_checkin', { ascending: false })

      if (checkinsError && checkinsError.code !== '42P01') {
        throw checkinsError
      }
      checkinsData = checkins || [];
    } else {
      // If sysUser not found by email, it might be that the user logs in with a different email
      // Let's try to query ALL checkins and see if we can find them in the logs for debugging
      console.log('[Checkins API] No system user found for email:', func.email);
    }

    return NextResponse.json(checkinsData)
  } catch (err: any) {
    console.error('Erro ao buscar histórico de checkin:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
