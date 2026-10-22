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

    let resolvedRespId = user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : '';
    let resolvedAlunoId = user.user_metadata?.aluno_id ? String(user.user_metadata.aluno_id) : '';
    let isStudentReader =
      user.user_metadata?.perfil === 'Aluno' ||
      user.user_metadata?.cargo === 'Aluno' ||
      (!!resolvedAlunoId && !resolvedRespId && user.user_metadata?.cargo !== 'Responsável');

    let isFamily =
      user.user_metadata?.perfil === 'Família' ||
      user.user_metadata?.perfil === 'Responsável' ||
      isStudentReader ||
      user.user_metadata?.cargo === 'Responsável' ||
      !!resolvedRespId ||
      !!resolvedAlunoId;

    if (!resolvedRespId && !resolvedAlunoId) {
      const { data: dbUser } = await supabase
        .from('system_users')
        .select('perfil, cargo, dados')
        .or(`id.eq."${user.id}",auth_id.eq."${user.id}"`)
        .maybeSingle();

      if (dbUser) {
        if (dbUser.dados?.responsavel_id) resolvedRespId = String(dbUser.dados.responsavel_id);
        if (dbUser.dados?.aluno_id) resolvedAlunoId = String(dbUser.dados.aluno_id);
        if (dbUser.perfil === 'Aluno' || dbUser.cargo === 'Aluno') isStudentReader = true;
        if (
          dbUser.perfil === 'Família' ||
          dbUser.perfil === 'Responsável' ||
          dbUser.cargo === 'Responsável' ||
          isStudentReader ||
          !!resolvedRespId ||
          !!resolvedAlunoId
        ) {
          isFamily = true;
        }
      }

      if (!resolvedRespId && !isStudentReader) {
        const respConds = [`id.eq."${user.id}"`, `dados->>auth_id.eq."${user.id}"`, `dados->>user_id.eq."${user.id}"`];
        if (user.email) respConds.push(`email.ilike."${user.email}"`);
        const { data: respUser } = await supabase
          .from('responsaveis')
          .select('id')
          .or(respConds.join(','))
          .limit(1)
          .maybeSingle();
        if (respUser?.id) {
          resolvedRespId = String(respUser.id);
          isFamily = true;
        } else {
          const alunoConds = [`id.eq."${user.id}"`, `dados->>auth_id.eq."${user.id}"`, `dados->>user_id.eq."${user.id}"`];
          if (user.email) alunoConds.push(`email.ilike."${user.email}"`);
          const { data: alunoUser } = await supabase
            .from('alunos')
            .select('id')
            .or(alunoConds.join(','))
            .limit(1)
            .maybeSingle();
          if (alunoUser?.id) {
            resolvedAlunoId = String(alunoUser.id);
            isStudentReader = true;
            isFamily = true;
          }
        }
      }
    }

    let readerId = String(user.id);
    if (isFamily) {
      if (isStudentReader && (resolvedAlunoId || alunoId)) {
        readerId = String(resolvedAlunoId || alunoId);
      } else if (resolvedRespId) {
        readerId = String(resolvedRespId);
      } else if (resolvedAlunoId) {
        readerId = String(resolvedAlunoId);
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
      const readRecordsMap = new Map<string, any>();
      const addReadRecord = (uid: string, alId: string | null) => {
        if (!uid) return;
        const k = `${uid}|${tipo}`;
        readRecordsMap.set(k, {
          usuario_id: uid,
          perfil: isFamily ? 'aluno' : 'admin',
          content_type: tipo,
          content_id: '', // preenchido por id
          read_at: now,
          aluno_id: alId
        });
      };

      const cleanAlunoId = alunoId ? String(alunoId) : null;
      addReadRecord(readerId, cleanAlunoId);
      if (cleanAlunoId && `${readerId}#${cleanAlunoId}` !== readerId) {
        addReadRecord(`${readerId}#${cleanAlunoId}`, cleanAlunoId);
      }
      if (user.id && String(user.id) !== readerId) {
        addReadRecord(String(user.id), cleanAlunoId);
        if (cleanAlunoId) {
          addReadRecord(`${user.id}#${cleanAlunoId}`, cleanAlunoId);
        }
      }
      if (isStudentReader && cleanAlunoId) {
        addReadRecord(`aluno_${cleanAlunoId}`, cleanAlunoId);
      }

      const readRecords: any[] = [];
      ids.forEach((id: string) => {
        readRecordsMap.forEach((template) => {
          readRecords.push({
            ...template,
            content_id: String(id)
          });
        });
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
              if (user.id && String(user.id) !== readerId) {
                curLeituras[String(user.id)] = now;
              }
              if (cleanAlunoId) {
                curLeituras[`${readerId}_${cleanAlunoId}`] = now;
                if (user.id && String(user.id) !== readerId) {
                  curLeituras[`${user.id}_${cleanAlunoId}`] = now;
                }
                if (isStudentReader) {
                  curLeituras[cleanAlunoId] = now;
                  curLeituras[`aluno_${cleanAlunoId}`] = now;
                  curLeituras[`${cleanAlunoId}_${cleanAlunoId}`] = now;
                } else {
                  // Se o responsável está lendo e havia chave legada [alunoId] poluída sem leitura real do aluno, limpa a poluição
                  if (curLeituras[cleanAlunoId] && !curLeituras[`${cleanAlunoId}_${cleanAlunoId}`] && !curLeituras[`aluno_${cleanAlunoId}`]) {
                    delete curLeituras[cleanAlunoId];
                  }
                }
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
