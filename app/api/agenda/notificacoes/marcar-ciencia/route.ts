import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = supabaseServer;
    const body = await request.json()
    const { tipo, id, alunoId } = body

    let isFamily = user.user_metadata?.perfil === 'Família' || user.user_metadata?.cargo === 'Aluno' || user.user_metadata?.cargo === 'Responsável'
    if (!isFamily) {
      const { data: dbUser } = await supabase.from('system_users').select('perfil, cargo').eq('id', user.id).maybeSingle();
      if (dbUser) {
        isFamily = dbUser.perfil === 'Família' || dbUser.perfil === 'Responsável' || dbUser.cargo === 'Aluno' || dbUser.cargo === 'Responsável'
      }
    }
    const readerId = isFamily ? alunoId : user.id

    if (!tipo || !id || !readerId) {
      return NextResponse.json({ error: 'Parâmetros incompletos' }, { status: 400 })
    }

    const now = new Date().toISOString()
    
    try {
      const cienciaRecord = {
        usuario_id: readerId, 
        perfil: isFamily ? 'aluno' : 'admin', 
        content_type: tipo,
        content_id: id,
        ciente_em: now
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

    return NextResponse.json({ ok: true, count: 1 })
  } catch (err: any) {
    console.error("Erro em marcar-ciencia:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
