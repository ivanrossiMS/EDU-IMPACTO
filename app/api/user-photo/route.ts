import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // requireAuth já validou o usuário

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ foto: null }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient();
    let authFoto = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 1. Se for UUID, busca no Supabase Auth
    if (isUuid) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
      if (!error && data?.user) {
        authFoto = data.user.user_metadata?.foto || data.user.user_metadata?.fotoUrl || null;
      }
    }
    
    if (authFoto) return NextResponse.json({ foto: authFoto });

    // 2. Busca na tabela system_users (por id, auth_id ou email)
    const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const sysUserFilter = isIdUuid
      ? `id.eq.${id},auth_id.eq.${id},email.eq.${id}`
      : `id.eq.${id},email.eq.${id}`;
    const { data: sysUser } = await supabaseAdmin
      .from('system_users')
      .select('dados')
      .or(sysUserFilter)
      .maybeSingle();

    if (sysUser?.dados?.foto) {
      return NextResponse.json({ foto: sysUser.dados.foto });
    }

    // 3. Se não encontrou, busca na tabela alunos (caso seja ID de aluno)
    const { data: alunoData } = await supabaseAdmin
      .from('alunos')
      .select('foto')
      .eq('id', id)
      .maybeSingle();
      
    if (alunoData?.foto) {
      return NextResponse.json({ foto: alunoData.foto });
    }

    // 4. Busca na tabela responsaveis
    const { data: respData } = await supabaseAdmin
      .from('responsaveis')
      .select('dados')
      .eq('id', id)
      .maybeSingle();

    if (respData?.dados?.foto) {
      return NextResponse.json({ foto: respData.dados.foto });
    }

    // Retorna 200 com foto: null em vez de 404 para evitar loops de requisição no cliente
    return NextResponse.json({ foto: null });
  } catch (err) {
    return NextResponse.json({ foto: null }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  try {
    const { userId, fotoUrl } = await request.json();
    if (!userId || !fotoUrl) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios: userId, fotoUrl' }, { status: 400 });
    }

    const loggedUser = user;
    const isMasterAdmin = ['Diretor Geral', 'Administrador', 'Administrador Master'].includes(
      loggedUser.user_metadata?.perfil || loggedUser.user_metadata?.cargo || ''
    );
    const isSelf = loggedUser.id === userId ||
      loggedUser.email?.toLowerCase() === userId.toLowerCase() ||
      loggedUser.user_metadata?.system_user_id === userId ||
      loggedUser.user_metadata?.colaborador_id === userId;

    if (!isSelf && !isMasterAdmin) {
      return NextResponse.json({ error: 'Proibido atualizar dados de outro usuário' }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();

    // 1. Localizar registro correspondente em system_users (por id, auth_id ou email)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    const postFilter = isUuid
      ? `id.eq.${userId},auth_id.eq.${userId},auth_id.eq.${loggedUser.id},email.eq.${loggedUser.email}`
      : `id.eq.${userId},auth_id.eq.${loggedUser.id},email.eq.${loggedUser.email}`;

    const { data: currentSysUser } = await supabaseAdmin
      .from('system_users')
      .select('id, auth_id, email, dados')
      .or(postFilter)
      .maybeSingle();

    // 2. Determinar o authId correto para atualizar auth metadata
    const targetAuthId = isUuid ? userId : (currentSysUser?.auth_id || loggedUser.id);

    if (targetAuthId) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(targetAuthId, {
        user_metadata: { foto: fotoUrl }
      });
      if (authErr) console.warn('[API user-photo POST] Auth update warning:', authErr.message);
    }

    // 3. Atualizar tabela system_users (sempre salvar em dados.foto)
    if (currentSysUser) {
      const newDados = { ...(currentSysUser.dados || {}), foto: fotoUrl };
      const { error: updateSysErr } = await supabaseAdmin
        .from('system_users')
        .update({ 
          dados: newDados,
          ...(targetAuthId && !currentSysUser.auth_id ? { auth_id: targetAuthId } : {})
        })
        .eq('id', currentSysUser.id);

      if (updateSysErr) {
        console.warn('[API user-photo POST] system_users update error:', updateSysErr.message);
      }
    }

    // 4. Se for responsável, sincroniza também em responsaveis
    try {
      await supabaseAdmin
        .from('responsaveis')
        .update({ dados: { foto: fotoUrl } })
        .or(`id.eq.${userId},email.eq.${loggedUser.email}`);
    } catch {}

    return NextResponse.json({ ok: true, fotoUrl });
  } catch (err: any) {
    console.error('[API user-photo POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}

