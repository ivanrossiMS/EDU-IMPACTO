import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url);
  const comunicadoId = searchParams.get('comunicado_id');
  const comunicadoIds = searchParams.get('comunicado_ids');
  const remetenteId = searchParams.get('remetente_id'); // If parent is viewing, they pass their ID to only see their chat
  
  // SECURITY FIX: Verificar no servidor se o usuário é admin (não confiar no ?admin=true do cliente)
  const perfil = user.user_metadata?.perfil || ''
  const cargo = user.user_metadata?.cargo || ''
  const adminPerfis = ['Diretor Geral', 'Administrador', 'Admin', 'Colaborador', 'Professor', 'Coordenador']
  const familyPerfis = ['Família', 'Responsável', 'Aluno']
  const isFamilyOrStudent = familyPerfis.includes(perfil) || familyPerfis.includes(cargo)
  const isAdmin = !isFamilyOrStudent && (adminPerfis.includes(perfil) || adminPerfis.includes(cargo) || (!perfil && !cargo))

  if (!comunicadoId && !comunicadoIds) {
    return NextResponse.json({ error: 'comunicado_id or comunicado_ids is required' }, { status: 400 });
  }

  let query = supabase
    .from('comunicados_respostas')
    .select('*')
    .order('created_at', { ascending: true });

  if (comunicadoIds) {
    const idsArray = comunicadoIds.split(',').slice(0, 50); // Limitar a 50 IDs
    query = query.in('comunicado_id', idsArray);
  } else if (comunicadoId) {
    query = query.eq('comunicado_id', comunicadoId);
  }

  // Privacy rule: se não é admin, filtrar apenas mensagens do próprio usuário
  if (!isAdmin && remetenteId) {
    query = query.eq('remetente_id', remetenteId);
  } else if (!isAdmin && !remetenteId) {
    // Sem remetente_id e sem admin: filtrar pelo ID do usuário autenticado
    const userSlug = user.user_metadata?.aluno_id || user.user_metadata?.responsavel_id || user.id
    query = query.eq('remetente_id', String(userSlug));
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

    // SECURITY FIX: Determinar is_admin via perfil do servidor, não pelo body do cliente
    const senderPerfil = user.user_metadata?.perfil || ''
    const senderCargo = user.user_metadata?.cargo || ''
    const familyPerfisPost = ['Família', 'Responsável', 'Aluno']
    const serverIsAdmin = !familyPerfisPost.includes(senderPerfil) && !familyPerfisPost.includes(senderCargo)

    const row = {
      comunicado_id: body.comunicado_id,
      remetente_id: body.remetente_id,
      remetente_nome: body.remetente_nome || 'Usuário',
      conteudo: body.conteudo,
      anexos: Array.isArray(body.anexos) ? body.anexos : [],
      is_admin: serverIsAdmin  // Determinado pelo servidor, não pelo cliente
    };

    const { data, error } = await supabase
      .from('comunicados_respostas')
      .insert(row)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ── Notificações Push e In-App bidirecionais ──
    try {
      const msgTexto = body.conteudo.length > 50 ? body.conteudo.substring(0, 50) + '...' : body.conteudo;
      const remetenteNome = body.remetente_nome || (body.is_admin ? 'A Escola' : 'Usuário');

      if (!body.is_admin) {
        // Responsável/Aluno respondeu -> Notifica a Escola (Autor original do comunicado)
        const { data: comData } = await supabase
          .from('comunicados')
          .select('titulo, dados')
          .eq('id', body.comunicado_id)
          .single();
        
        if (comData && comData.dados && comData.dados.autorId) {
          const targetUserId = comData.dados.autorId;
          
          try {
            await supabase.from('notificacoes').insert({
              user_id: targetUserId,
              titulo: `Nova resposta: ${comData.titulo}`,
              mensagem: `${remetenteNome} comentou: "${msgTexto}"`,
              link: `/agenda-digital/comunicados`,
              lida: false,
              tipo: 'comunicado',
              created_at: new Date().toISOString()
            });
          } catch (err) {
            console.error("Notificacao DB erro:", err);
          }

          try {
            await sendAgendaPushNotification({
              type: 'comunicados',
              itemId: String(data.id), // ID único do comentário evita deduplicação indevida
              title: `💬 Resposta de ${remetenteNome}`,
              message: `No comunicado "${comData.titulo}": ${msgTexto}`,
              targetUserIds: [targetUserId],
              targetUrl: `/agenda-digital/comunicados`
            });
          } catch (err) {
            console.error("Push erro:", err);
          }
        }
      } else {
        // Escola respondeu -> Notifica o Pai/Aluno dono da thread (remetente_id da thread)
        const targetUserId = body.remetente_id; 
        if (targetUserId) {
          const { data: comData } = await supabase
            .from('comunicados')
            .select('titulo')
            .eq('id', body.comunicado_id)
            .single();
            
          const tituloCom = comData ? comData.titulo : 'Comunicado';

          try {
            await supabase.from('notificacoes').insert({
              user_id: targetUserId,
              titulo: `Nova resposta da Escola`,
              mensagem: `Resposta no comunicado "${tituloCom}": "${msgTexto}"`,
              link: `/agenda-digital/comunicados`,
              lida: false,
              tipo: 'comunicado',
              created_at: new Date().toISOString()
            });
          } catch (err) {
            console.error("Notificacao DB erro:", err);
          }

          try {
            await sendAgendaPushNotification({
              type: 'comunicados',
              itemId: String(data.id),
              title: `🏫 Nova mensagem da Escola`,
              message: `Sobre "${tituloCom}": ${msgTexto}`,
              targetUserIds: [targetUserId],
              targetUrl: `/agenda-digital/comunicados`
            });
          } catch (err) {
            console.error("Push erro:", err);
          }
        }
      }
    } catch (notifError) {
      console.error("Erro geral nas notificações de resposta:", notifError);
      // Nao damos throw para nao quebrar a insercao original da mensagem
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
