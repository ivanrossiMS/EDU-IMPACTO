import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton';

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

  const cookieStore = await cookies();
  const INFINITE_SESSION_SECONDS = 3153600000;
  const expiresDate = new Date(Date.now() + INFINITE_SESSION_SECONDS * 1000);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { 
            cookiesToSet.forEach(({ name, value, options }) => {
              if (options?.maxAge === 0 || value === '') {
                cookieStore.set(name, '', { ...options, maxAge: 0, path: '/' })
                return
              }
              cookieStore.set(name, value, {
                ...options,
                path: options?.path || '/',
                sameSite: options?.sameSite || 'lax',
                maxAge: INFINITE_SESSION_SECONDS,
                expires: expiresDate,
              })
            }) 
          } catch {}
        },
      },
    }
  );

  let user = null;
  try {
    const res = await supabase.auth.getUser();
    user = res.data?.user || null;
  } catch (err) {
    // Refresh token not found ou sessão expirada
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', ip }, { status: 401 });
  }

  // Fetch the latest profile data from system_users to ensure it is always up to date
  const supabaseAdmin = getAdminClient();
  let dbUser = null;
  try {
    const { data } = await supabaseAdmin
      .from('system_users')
      .select('*')
      .or(`id.eq.${user.id},auth_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();
    dbUser = data;
  } catch (e) {
    if (user.email) {
      const { data } = await supabaseAdmin
        .from('system_users')
        .select('*')
        .ilike('email', user.email)
        .maybeSingle();
      dbUser = data;
    }
  }

  // Combine top-level auth data (id, email) with user_metadata and database fields
  const userData = {
    ...user.user_metadata,
    id: user.id,
    email: user.email,
    foto: dbUser?.foto || dbUser?.dados?.foto || user.user_metadata?.foto || null,
    perfil: dbUser?.perfil || user.user_metadata?.perfil,
    cargo: dbUser?.cargo || user.user_metadata?.cargo,
    status: dbUser?.status || 'ativo',
    colaborador_id: dbUser?.id || user.user_metadata?.colaborador_id || '',
    system_user_id: dbUser?.id || user.user_metadata?.system_user_id || '',
    hasDualRole: Boolean(user.user_metadata?.hasDualRole || dbUser?.dados?.responsavel_id || user.user_metadata?.responsavel_id),
    responsavel_id: dbUser?.dados?.responsavel_id || user.user_metadata?.responsavel_id || '',
    aluno_id: dbUser?.dados?.aluno_id || user.user_metadata?.aluno_id || '',
  };

  return NextResponse.json({ user: userData, ip }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}

