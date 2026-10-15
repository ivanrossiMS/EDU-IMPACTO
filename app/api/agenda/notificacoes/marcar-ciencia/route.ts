import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = supabaseServer;
    const body = await request.json()
    const { tipo, id, alunoId } = body

    const metaPerfil = String(user.user_metadata?.perfil || '').trim()
    const metaCargo = String(user.user_metadata?.cargo || '').trim()

    if (
      metaPerfil.toLowerCase() === 'aluno' ||
      metaCargo.toLowerCase() === 'aluno' ||
      (Boolean(user.user_metadata?.aluno_id) && !user.user_metadata?.responsavel_id && metaCargo !== 'Responsável')
    ) {
      return NextResponse.json(
        { error: 'Apenas responsáveis podem assinar ciência de comunicados e ocorrências.' },
        { status: 403 }
      )
    }

    let isFamily = metaPerfil === 'Família' || metaCargo === 'Responsável' || !!user.user_metadata?.responsavel_id;
    if (!isFamily) {
      const { data: dbUser } = await supabase.from('system_users').select('perfil, cargo').eq('id', user.id).maybeSingle();
      if (dbUser) {
        if (String(dbUser.perfil || '').toLowerCase() === 'aluno' || String(dbUser.cargo || '').toLowerCase() === 'aluno') {
          return NextResponse.json(
            { error: 'Apenas responsáveis podem assinar ciência de comunicados e ocorrências.' },
            { status: 403 }
          )
        }
        isFamily = dbUser.perfil === 'Família' || dbUser.perfil === 'Responsável' || dbUser.cargo === 'Responsável'
      } else {
        const respConds = [`id.eq.${user.id}`, `dados->>auth_id.eq.${user.id}`, `dados->>user_id.eq.${user.id}`]
        if (user.email) respConds.push(`email.ilike.${user.email.trim().toLowerCase()}`)
        const { data: respUser } = await supabase.from('responsaveis').select('id').or(respConds.join(',')).limit(1).maybeSingle();
        if (respUser) {
          isFamily = true;
        } else {
          const { data: alunoUser } = await supabase.from('alunos').select('id').eq('id', user.id).maybeSingle();
          if (alunoUser) {
            return NextResponse.json(
              { error: 'Apenas responsáveis podem assinar ciência de comunicados e ocorrências.' },
              { status: 403 }
            )
          }
        }
      }
    }
    let readerId = user.id
    if (isFamily) {
      if (user.user_metadata?.responsavel_id) {
        readerId = String(user.user_metadata.responsavel_id);
      }
    }

    if (!tipo || !id || !readerId) {
      return NextResponse.json({ error: 'Parâmetros incompletos' }, { status: 400 })
    }

    const now = new Date().toISOString()
    
    try {
      const cienciaRecord = {
        usuario_id: isFamily && alunoId ? `${readerId}#${alunoId}` : readerId, 
        perfil: isFamily ? 'aluno' : 'admin', 
        content_type: tipo,
        content_id: id,
        ciente_em: now,
        aluno_id: isFamily && alunoId ? String(alunoId) : null
      };

      const { error: insertError } = await supabase
        .from('agenda_ciencias')
        .insert(cienciaRecord);
        
      if (insertError) {
        // Código 23505 é Duplicate Key (ou seja, a pessoa já leu/deu ciência). Podemos ignorar com segurança.
        if (insertError.code !== '23505') {
          throw new Error(`Erro ao inserir ciencia record: ${insertError.message}`);
        }
      }
    } catch (e: any) {
      console.error("Erro ao registrar ciência na tabela nova:", e);
      return NextResponse.json({ error: e.message }, { status: 500 })
    }

    const responseKey = isFamily && alunoId ? `${readerId}_${alunoId}` : String(readerId);

    return NextResponse.json({ ok: true, count: 1, key: responseKey })
  } catch (err: any) {
    console.error("Erro em marcar-ciencia:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
