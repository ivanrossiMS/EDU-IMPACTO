import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton';

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

  const authHeader = request.headers.get('authorization');
  const hasBearer = authHeader ? authHeader.toLowerCase().startsWith('bearer ') : false;
  const bearerToken = hasBearer ? authHeader!.substring(7).trim() : null;

  const cookieStore = await cookies();
  const SAFE_SESSION_SECONDS = 31536000; // 1 ano (365 dias)
  const expiresDate = new Date(Date.now() + SAFE_SESSION_SECONDS * 1000);

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
                maxAge: SAFE_SESSION_SECONDS,
                expires: expiresDate,
              })
            }) 
          } catch {}
        },
      },
    }
  );

  let user = null;
  let isNetworkError = false;
  try {
    const res = bearerToken 
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (res.error) {
      const msg = res.error.message?.toLowerCase() || '';
      const name = res.error.name || '';
      const cause = (res.error as any).cause?.message?.toLowerCase() || '';
      if (
        name === 'AuthRetryableFetchError' ||
        msg.includes('fetch failed') ||
        msg.includes('enotfound') ||
        msg.includes('load failed') ||
        msg.includes('timeout') ||
        msg.includes('econnrefused') ||
        cause.includes('enotfound') ||
        cause.includes('fetch failed')
      ) {
        isNetworkError = true;
      }
    }
    user = res.data?.user || null;
  } catch (err: any) {
    const msg = err?.message?.toLowerCase() || '';
    const name = err?.name || '';
    const cause = err?.cause?.message?.toLowerCase() || '';
    if (
      name === 'AuthRetryableFetchError' ||
      msg.includes('fetch failed') ||
      msg.includes('enotfound') ||
      msg.includes('load failed') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      cause.includes('enotfound') ||
      cause.includes('fetch failed')
    ) {
      isNetworkError = true;
    }
  }

  const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
  };

  if (!user) {
    if (isNetworkError) {
      return NextResponse.json(
        { error: 'Serviço de autenticação temporariamente indisponível (falha de rede/DNS)', isNetworkError: true },
        { status: 503, headers: NO_CACHE_HEADERS }
      );
    }
    return NextResponse.json({ error: 'Unauthorized', ip }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  // Fetch latest profile data: check system_users, responsaveis, and alunos
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

  let dbResp: any = null;
  const targetRespId = user.user_metadata?.responsavel_id || dbUser?.dados?.responsavel_id;
  try {
    const respConds: string[] = [];
    if (targetRespId) respConds.push(`id.eq.${targetRespId}`);
    if (user.email) respConds.push(`email.ilike.${user.email.trim()}`);
    if (respConds.length > 0) {
      const { data } = await supabaseAdmin
        .from('responsaveis')
        .select('*')
        .or(respConds.join(','))
        .limit(1)
        .maybeSingle();
      dbResp = data;
    }
  } catch (e) {}

  let dbAluno: any = null;
  const targetAlunoId = user.user_metadata?.aluno_id || dbUser?.dados?.aluno_id;
  try {
    const alunoConds: string[] = [];
    if (targetAlunoId) alunoConds.push(`id.eq.${targetAlunoId}`);
    if (user.email) alunoConds.push(`email.ilike.${user.email.trim()}`);
    if (alunoConds.length > 0) {
      const { data } = await supabaseAdmin
        .from('alunos')
        .select('*')
        .or(alunoConds.join(','))
        .limit(1)
        .maybeSingle();
      dbAluno = data;
    }
  } catch (e) {}

  // Resolve user photo: prioritize user_metadata, then responsaveis, alunos, or system_users
  const resolvedPhoto = 
    user.user_metadata?.foto || 
    user.user_metadata?.fotoUrl || 
    dbResp?.foto || 
    dbResp?.dados?.foto || 
    dbAluno?.foto || 
    dbAluno?.dados?.foto || 
    dbUser?.dados?.foto || 
    dbUser?.foto || 
    null;

  // Auto-sync between user_metadata and database tables
  if (resolvedPhoto && !user.user_metadata?.foto) {
    void supabaseAdmin.auth.admin
      .updateUserById(user.id, { user_metadata: { ...(user.user_metadata || {}), foto: resolvedPhoto } })
      .catch(() => {});
  }

  if (dbUser && resolvedPhoto) {
    if (dbUser.dados?.foto !== resolvedPhoto) {
      const updatedDados = { ...(dbUser.dados || {}), foto: resolvedPhoto };
      void (async () => {
        try {
          await supabaseAdmin
            .from('system_users')
            .update({ 
              dados: updatedDados,
              ...(dbUser.auth_id ? {} : { auth_id: user.id })
            })
            .eq('id', dbUser.id);
        } catch (err: any) {
          console.warn('[Auth /me auto-sync photo to db]', err?.message);
        }
      })();
    }
  }

  // Combine top-level auth data (id, email) with user_metadata and database fields
  const userData = {
    ...user.user_metadata,
    id: user.id,
    email: user.email,
    nome: dbResp?.nome || dbAluno?.nome || dbUser?.nome || user.user_metadata?.nome || user.email?.split('@')[0],
    foto: resolvedPhoto,
    perfil: dbUser?.perfil || (dbResp ? 'Família' : (dbAluno ? 'Família' : user.user_metadata?.perfil)),
    cargo: dbUser?.cargo || (dbResp ? 'Responsável' : (dbAluno ? 'Aluno' : user.user_metadata?.cargo)),
    status: dbUser?.status || (dbAluno?.status ? dbAluno.status : 'ativo'),
    colaborador_id: dbUser?.id || user.user_metadata?.colaborador_id || '',
    system_user_id: dbUser?.id || user.user_metadata?.system_user_id || '',
    hasDualRole: Boolean(user.user_metadata?.hasDualRole || dbUser?.dados?.responsavel_id || user.user_metadata?.responsavel_id || (dbUser && dbResp)),
    responsavel_id: dbResp?.id || dbUser?.dados?.responsavel_id || user.user_metadata?.responsavel_id || '',
    aluno_id: dbAluno?.id || dbUser?.dados?.aluno_id || user.user_metadata?.aluno_id || '',
  };

  return NextResponse.json({ user: userData, ip }, {
    headers: NO_CACHE_HEADERS
  });
}

