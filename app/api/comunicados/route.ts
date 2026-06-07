import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { requireAuth } from '@/lib/server/authGuard'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

function normalizeRow(row: any) {
  const merged = { ...row, ...(row.dados || {}) }
  // Ensure critical fields are always safe types
  merged.leituras = merged.leituras && typeof merged.leituras === 'object' && !Array.isArray(merged.leituras) ? merged.leituras : {}
  merged.ciencias = merged.ciencias && typeof merged.ciencias === 'object' && !Array.isArray(merged.ciencias) ? merged.ciencias : {}
  merged.turmas = Array.isArray(merged.turmas) ? merged.turmas : []
  merged.alunosIds = Array.isArray(merged.alunosIds) ? merged.alunosIds : []
  merged.status = merged.status || 'enviado'
  merged.prioridade = merged.prioridade || 'normal'
  merged.fixado = Boolean(merged.fixado)
  merged.exigeCiencia = Boolean(merged.exigeCiencia)
  merged.permiteResposta = Boolean(merged.permiteResposta)
  merged.anexos = Array.isArray(merged.anexos) ? merged.anexos : []
  // Map DB column names to app field names
  if (!merged.conteudo && merged.texto) merged.conteudo = merged.texto
  if (!merged.dataEnvio && merged.data) merged.dataEnvio = merged.data
  return merged
}
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const authClient = await createProtectedClient();
  const supabase = supabaseServer;
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');
  const turmaId = searchParams.get('turma_id');
  const alunoId = searchParams.get('aluno_id');
  const idParam = searchParams.get('id');
  const sinceParam = searchParams.get('since');
  
  let resolvedTurma = turmaId;
  if (turmaId) {
    const { data: tData } = await supabase.from('turmas').select('nome').eq('id', turmaId).single();
    if (tData && tData.nome) {
      resolvedTurma = tData.nome;
    } else {
      const { data: cData } = await supabase.from('turmas').select('nome').eq('codigo', turmaId).single();
      if (cData && cData.nome) {
        resolvedTurma = cData.nome;
      }
    }
  }

  let query = supabase.from('comunicados').select('*');
  
  const accessStartDate = await getLoggedUserAccessStartDate();
  if (accessStartDate) {
    query = query.gte('data', accessStartDate.toISOString());
  }
  
  if (turmaId || alunoId) {
    const conditions = [`destino.eq.todos`];
    if (turmaId) {
      conditions.push(`dados->turmas.cs.["${resolvedTurma}"]`);
      if (resolvedTurma !== turmaId) {
        conditions.push(`dados->turmas.cs.["${turmaId}"]`);
      }
    }
    if (alunoId) {
      conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);
    }
    query = query.or(conditions.join(','));
  }
  
  if (idParam) {
    query = query.eq('id', idParam);
  }
  
  if (sinceParam) {
    query = query.gt('created_at', sinceParam);
  }
  
  query = query.order('data', { ascending: false });
  
  if (limitParam) {
     const limit = parseInt(limitParam);
     const offset = offsetParam ? parseInt(offsetParam) : 0;
     query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { user: currentUser } } = await authClient.auth.getUser();
  let isFamilyOrStudent = false;
  if (currentUser) {
    const perfil = currentUser.user_metadata?.perfil || '';
    const cargo = currentUser.user_metadata?.cargo || '';
    if (
      perfil === 'Família' || 
      perfil === 'Responsável' || 
      cargo === 'Responsável' || 
      cargo === 'Aluno' || 
      perfil === 'Aluno'
    ) {
      isFamilyOrStudent = true;
    } else {
      const { data: dbUser } = await supabase
        .from('system_users')
        .select('perfil, cargo')
        .eq('id', user.id)
        .maybeSingle();
      
      const dbPerfil = dbUser?.perfil || '';
      const dbCargo = dbUser?.cargo || '';
      if (
        dbPerfil === 'Família' || 
        dbPerfil === 'Responsável' || 
        dbCargo === 'Responsável' || 
        dbCargo === 'Aluno' || 
        dbPerfil === 'Aluno'
      ) {
        isFamilyOrStudent = true;
      }
    }
  }

  const normalized = (data || []).map(normalizeRow);
  const filtered = isFamilyOrStudent
    ? normalized
    : normalized.filter((c: any) => !c.isSaudacao && !c.dados?.isSaudacao && c.titulo !== 'Mensagem de Boas-vindas');

  return NextResponse.json(filtered)
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const authClient = await createProtectedClient();
  const supabase = supabaseServer;
  console.log("==> POST /api/comunicados CALLED!");
  try {
    const body = await request.json()
    console.log("==> POST body length:", Array.isArray(body) ? body.length : 'not array');
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json({ ok: true, count: 0 })
      }
      
      const rows = body.map(c => buildRow(c))
      const { error: upsertError } = await supabase.from('comunicados').upsert(rows)
      if (upsertError) {
        console.error("==> UPSERT ERROR:", upsertError);
        return NextResponse.json({ error: upsertError.message }, { status: 400 })
      }
      console.log("==> UPSERT SUCCESS");
      
      // Disparar Pushes para cada comunicado (em background)
      // Disparar Pushes para cada comunicado
      for (const row of rows) {
        const targetIds = await getResponsavelIdsForTargets(row.dados)
        if (targetIds.length > 0) {
          await sendAgendaPushNotification({
            type: 'comunicados',
            itemId: String(row.id),
            title: `📢 Comunicado: ${row.titulo}`,
            message: `Você tem uma nova mensagem enviada por ${row.autor}.`,
            targetUserIds: targetIds,
            targetUrl: '/agenda-digital/comunicados'
          }).catch(err => console.error("Push Error:", err))
        }
      }
      
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('comunicados').upsert(row).select().single()
    if (error) {
      console.error("UPSERT SINGLE ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    // Disparar Push (em background)
    // Disparar Push
    const targetIds = await getResponsavelIdsForTargets(data.dados);
    if (targetIds.length > 0) {
      await sendAgendaPushNotification({
        type: 'comunicados',
        itemId: String(data.id),
        title: `📢 Comunicado: ${data.titulo}`,
        message: `Você tem uma nova mensagem enviada por ${data.autor}.`,
        targetUserIds: targetIds,
        targetUrl: '/agenda-digital/comunicados'
      }).catch(err => console.error("Push Error:", err))
    }

    return NextResponse.json(normalizeRow(data), { status: 201 })
  } catch (e: any) {
    console.error("POST CATCH ERROR:", e);
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const authClient = await createProtectedClient();
  const supabase = supabaseServer;
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('comunicados').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// Removed deprecated config export

function buildRow(c: any) {
  const source = { ...c, ...(c.dados || {}) }
  delete source.dados
  const { id, titulo, conteudo, texto, autor, dataEnvio, data, destino, fixado, ...rest } = source
  // Ensure safe defaults for JSONB fields stored in dados
  const dados = {
    ...rest,
    status: rest.status || 'enviado',
    prioridade: rest.prioridade || 'normal',
    turmas: Array.isArray(rest.turmas) ? rest.turmas : [],
    turmasIds: Array.isArray(rest.turmasIds) ? rest.turmasIds : [],
    alunosIds: Array.isArray(rest.alunosIds) ? rest.alunosIds : [],
    leituras: (rest.leituras && typeof rest.leituras === 'object' && !Array.isArray(rest.leituras)) ? rest.leituras : {},
    ciencias: (rest.ciencias && typeof rest.ciencias === 'object' && !Array.isArray(rest.ciencias)) ? rest.ciencias : {},
    anexos: Array.isArray(rest.anexos) ? rest.anexos : [],
    exigeCiencia: Boolean(rest.exigeCiencia),
    permiteResposta: Boolean(rest.permiteResposta),
  }
  const merged = {
    id: id || `COM-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    titulo: titulo || '', 
    texto: conteudo || texto || '', 
    autor: autor || '',
    data: dataEnvio || data || new Date().toISOString(),
    destino: destino || ((dados.turmas.length > 0 || dados.alunosIds.length > 0) ? 'selecionados' : 'todos'), 
    fixado: Boolean(fixado),
    dados: {
      ...dados,
      conteudo: conteudo || texto || '',
      dataEnvio: dataEnvio || data || new Date().toISOString()
    },
    updated_at: new Date().toISOString(),
  }
  
  return merged
}
