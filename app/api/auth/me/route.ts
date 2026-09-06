import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton';

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { 
            cookiesToSet.forEach(({ name, value, options }) => {
              const expires = new Date();
              expires.setFullYear(expires.getFullYear() + 1);
              cookieStore.set(name, value, { ...options, maxAge: options.maxAge || 315360000, expires })
            }) 
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', ip }, { status: 401 });
  }

  // Fetch the latest profile data from system_users to ensure it is always up to date
  const supabaseAdmin = getAdminClient();
  let { data: dbUser } = await supabaseAdmin
    .from('system_users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!dbUser && user.email) {
    const { data: dbUserByEmail } = await supabaseAdmin
      .from('system_users')
      .select('*')
      .eq('email', user.email.toLowerCase().trim())
      .limit(1)
      .maybeSingle();
    if (dbUserByEmail) dbUser = dbUserByEmail;
  }

  // Cross-check responsaveis to ensure dual role and responsavel_id are always resolved
  let responsavel_id = dbUser?.dados?.responsavel_id || user.user_metadata?.responsavel_id || '';
  let colaborador_id = dbUser?.id || user.user_metadata?.colaborador_id || '';
  let hasDualRole = !!user.user_metadata?.hasDualRole;

  if (user.email) {
    const { data: respRow } = await supabaseAdmin
      .from('responsaveis')
      .select('id')
      .eq('email', user.email.toLowerCase().trim())
      .limit(1)
      .maybeSingle();

    if (respRow?.id) {
      responsavel_id = String(respRow.id);
      if (dbUser) hasDualRole = true;
    }
  }

  if (responsavel_id && colaborador_id) {
    hasDualRole = true;
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
    responsavel_id,
    colaborador_id,
    hasDualRole,
    aluno_id: dbUser?.dados?.aluno_id || user.user_metadata?.aluno_id || '',
  };

  return NextResponse.json({ user: userData, ip }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}

