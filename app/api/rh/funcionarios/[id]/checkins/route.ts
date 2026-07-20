import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export async function GET(request: Request, context: any) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // Using await on params to avoid next.js 15 sync access errors
  const params = await context.params;
  const funcionarioId = params.id;

  const supabase = getAdminClient()

  try {
    // 1. Fetch funcionario email
    const { data: func, error: funcError } = await supabase
      .from('funcionarios')
      .select('email')
      .eq('id', funcionarioId)
      .single()
      
    if (funcError || !func?.email) {
       return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    // 2. Fetch all system_users matching the email (case insensitive)
    const { data: sysUsers, error: sysError } = await supabase
      .from('system_users')
      .select('id')
      .ilike('email', func.email)

    let checkinsData = [];
    const validIds = new Set(sysUsers?.map(u => String(u.id)) || []);

    // 2.5 Query auth.users to get the uid_legacy if it exists
    try {
      // Supabase defaults to 50 users, we need all of them to match by email
      const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (authUsers?.users) {
         const matchedAuthUsers = authUsers.users.filter(u => u.email?.toLowerCase() === func.email.toLowerCase());
         for (const u of matchedAuthUsers) {
            validIds.add(u.id);
            if (u.user_metadata?.uid_legacy) {
               validIds.add(String(u.user_metadata.uid_legacy));
            }
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
