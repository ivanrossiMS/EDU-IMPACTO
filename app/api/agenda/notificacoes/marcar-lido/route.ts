import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const authClient = await createProtectedClient();
    const supabase = supabaseServer;

    const body = await request.json()
    const { tipo, ids, alunoId } = body

    let isFamily = user.user_metadata?.perfil === 'Família' || user.user_metadata?.perfil === 'Responsável' || user.user_metadata?.perfil === 'Aluno' || user.user_metadata?.cargo === 'Aluno' || user.user_metadata?.cargo === 'Responsável' || !!user.user_metadata?.responsavel_id || !!user.user_metadata?.aluno_id;
    if (!isFamily) {
      const { data: dbUser } = await supabase.from('system_users').select('perfil, cargo').eq('id', user.id).maybeSingle();
      if (dbUser) {
        isFamily = dbUser.perfil === 'Família' || dbUser.perfil === 'Responsável' || dbUser.perfil === 'Aluno' || dbUser.cargo === 'Aluno' || dbUser.cargo === 'Responsável'
      } else {
        // Fallback to check if it's in responsaveis or alunos directly
        const { data: respUser } = await supabase.from('responsaveis').select('id').eq('id', user.id).maybeSingle();
        if (respUser) {
          isFamily = true;
        } else {
          const { data: alunoUser } = await supabase.from('alunos').select('id').eq('id', user.id).maybeSingle();
          if (alunoUser) isFamily = true;
        }
      }
    }
    let readerId = user.id
    if (isFamily) {
      if (user.user_metadata?.responsavel_id) {
        readerId = String(user.user_metadata.responsavel_id);
      } else if (user.user_metadata?.aluno_id) {
        readerId = String(user.user_metadata.aluno_id);
      }
    }

    if (!tipo || !ids || !readerId || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Parâmetros incompletos' }, { status: 400 })
    }

    // Determine the table name based on type
    const tableMap: Record<string, string> = {
      'comunicado': 'comunicados',
      'momento': 'momentos',
      'evento': 'eventos_agenda',
      'ocorrencia': 'ocorrencias',
      'nota': 'boletins',
      'frequencia': 'frequencias'
    }

    const table = tableMap[tipo]
    if (!table) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const now = new Date().toISOString()
    
    try {
      const readRecords: any[] = [];
      ids.forEach((id: string) => {
        readRecords.push({
          usuario_id: readerId,
          perfil: isFamily ? 'aluno' : 'admin',
          content_type: tipo,
          content_id: String(id),
          read_at: now,
          aluno_id: alunoId ? String(alunoId) : null
        });
        if (alunoId && `${readerId}#${alunoId}` !== readerId) {
          readRecords.push({
            usuario_id: `${readerId}#${alunoId}`,
            perfil: isFamily ? 'aluno' : 'admin',
            content_type: tipo,
            content_id: String(id),
            read_at: now,
            aluno_id: String(alunoId)
          });
        }
      });

      // Upsert para garantir que read_at seja atualizado para 'now', refletindo abertura recente de conversas
      const { error: upsertError } = await supabase
        .from('agenda_notification_reads')
        .upsert(readRecords, { onConflict: 'usuario_id,content_type,content_id' });
        
      if (upsertError) {
        console.warn('Aviso no upsert de agenda_notification_reads:', upsertError.message);
      }

      // Sincronizar dados.leituras no comunicado caso o tipo seja comunicado
      if (tipo === 'comunicado') {
        for (const id of ids) {
          try {
            const { data: com } = await supabase.from('comunicados').select('id, dados').eq('id', id).maybeSingle();
            if (com && com.dados) {
              const curLeituras = { ...(com.dados.leituras || {}) };
              curLeituras[readerId] = now;
              if (alunoId) {
                curLeituras[String(alunoId)] = now;
                curLeituras[`${readerId}_${alunoId}`] = now;
              }
              await supabase.from('comunicados').update({
                dados: { ...com.dados, leituras: curLeituras }
              }).eq('id', id);
            }
          } catch (syncErr) {
            console.warn('Aviso ao sincronizar leituras em comunicados:', syncErr);
          }
        }
      }
    } catch (e: any) {
      console.error("Erro ao registrar leitura na nova tabela:", e);
      return NextResponse.json({ error: e.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: ids.length })
  } catch (err: any) {
    console.error("Erro em marcar-lido:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
