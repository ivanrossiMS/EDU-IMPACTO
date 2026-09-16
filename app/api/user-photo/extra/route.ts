import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // requireAuth já validou o usuário

    const { userId, bio, telefone, unidade } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
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

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: current } = await supabaseAdmin
      .from('system_users')
      .select('id, dados')
      .or(`id.eq.${userId},auth_id.eq.${userId},auth_id.eq.${loggedUser.id},email.eq.${loggedUser.email}`)
      .maybeSingle();

    if (current) {
      const newDados = { 
        ...(current.dados || {}), 
        bio, 
        telefone, 
        unidade 
      };

      const { error: dbErr } = await supabaseAdmin
        .from('system_users')
        .update({ dados: newDados })
        .eq('id', current.id);

      if (dbErr) {
        return NextResponse.json({ error: dbErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[API user-photo/extra POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
