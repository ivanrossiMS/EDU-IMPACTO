import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url);
  const comunicadoId = searchParams.get('comunicado_id');
  const remetenteId = searchParams.get('remetente_id'); // If parent is viewing, they pass their ID to only see their chat
  const isAdmin = searchParams.get('admin') === 'true'; // Admin passes admin=true

  if (!comunicadoId) {
    return NextResponse.json({ error: 'comunicado_id is required' }, { status: 400 });
  }

  let query = supabase
    .from('comunicados_respostas')
    .select('*')
    .eq('comunicado_id', comunicadoId)
    .order('created_at', { ascending: true });

  // Privacy rule: if not admin, only fetch messages where remetente_id matches the student/parent
  if (!isAdmin && remetenteId) {
    query = query.eq('remetente_id', remetenteId);
  }

  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.comunicado_id || !body.remetente_id || !body.conteudo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const row = {
      comunicado_id: body.comunicado_id,
      remetente_id: body.remetente_id,
      remetente_nome: body.remetente_nome || 'Usuário',
      conteudo: body.conteudo,
      anexos: Array.isArray(body.anexos) ? body.anexos : [],
      is_admin: Boolean(body.is_admin)
    };

    const { data, error } = await supabase
      .from('comunicados_respostas')
      .insert(row)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
