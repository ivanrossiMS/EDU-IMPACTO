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

    let isFamily = user.user_metadata?.perfil === 'Família' || user.user_metadata?.cargo === 'Aluno' || user.user_metadata?.cargo === 'Responsável'
    if (!isFamily) {
      const { data: dbUser } = await supabase.from('system_users').select('perfil, cargo').eq('id', user.id).maybeSingle();
      if (dbUser) {
        isFamily = dbUser.perfil === 'Família' || dbUser.perfil === 'Responsável' || dbUser.cargo === 'Aluno' || dbUser.cargo === 'Responsável'
      }
    }
    const readerId = user.id

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
      const readRecords = ids.map((id: string) => ({
        usuario_id: readerId, 
        perfil: isFamily ? 'aluno' : 'admin', 
        content_type: tipo,
        content_id: id,
        read_at: now
      }));

      // Utiliza insert em vez de upsert para não depender de UNIQUE CONSTRAINT nomeada no PostgREST
      const { error: insertError } = await supabase
        .from('agenda_notification_reads')
        .insert(readRecords);
        
      if (insertError) {
        // Código 23505 é Duplicate Key (ou seja, a pessoa já leu/deu ciência). Podemos ignorar com segurança.
        if (insertError.code !== '23505') {
          throw new Error(`Erro ao inserir read record: ${insertError.message}`);
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
