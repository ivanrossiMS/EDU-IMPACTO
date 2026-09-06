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
  const searchOrs = [`id.eq."${user.id}"`, `dados->>auth_id.eq."${user.id}"`];
  if (user.email) searchOrs.push(`email.eq."${user.email}"`);

  const { data: dbUser } = await supabaseAdmin
    .from('system_users')
    .select('*')
    .or(searchOrs.join(','))
    .limit(1)
    .maybeSingle();

  let resolvedResponsavelId = dbUser?.dados?.responsavel_id || user.user_metadata?.responsavel_id || '';
  let hasDualRole = false;

  if (!resolvedResponsavelId && user.email) {
    const { data: respFound } = await supabaseAdmin
      .from('responsaveis')
      .select('id')
      .ilike('email', user.email)
      .limit(1);
    if (respFound && respFound.length > 0) {
      resolvedResponsavelId = String(respFound[0].id);
      hasDualRole = true;
      // Atualiza system_users.dados em background para persistência
      if (dbUser && !dbUser.dados?.responsavel_id) {
        const updatedDados = { ...(dbUser.dados || {}), responsavel_id: resolvedResponsavelId };
        Promise.resolve(supabaseAdmin.from('system_users').update({ dados: updatedDados }).eq('id', dbUser.id)).catch(() => {});
      }
    }
  } else if (resolvedResponsavelId) {
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
    responsavel_id: resolvedResponsavelId,
    aluno_id: dbUser?.dados?.aluno_id || user.user_metadata?.aluno_id || '',
    system_user_id: dbUser?.id || '',
    hasDualRole: hasDualRole || !!resolvedResponsavelId,
  };

  return NextResponse.json({ user: userData, ip }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}

