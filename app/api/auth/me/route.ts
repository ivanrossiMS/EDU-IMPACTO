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
  const { data: dbUser } = await supabaseAdmin
    .from('system_users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // Combine top-level auth data (id, email) with user_metadata and database fields
  const userData = {
    ...user.user_metadata,
    id: user.id,
    email: user.email,
    foto: dbUser?.foto || dbUser?.dados?.foto || user.user_metadata?.foto || null,
    perfil: dbUser?.perfil || user.user_metadata?.perfil,
    cargo: dbUser?.cargo || user.user_metadata?.cargo,
    status: dbUser?.status || 'ativo',
  };

  return NextResponse.json({ user: userData, ip }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}

