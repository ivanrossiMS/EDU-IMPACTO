import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export async function POST(req: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()

    const logs = await req.json()
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    // ── Segurança: limitar 100 registros por batch ────────────────────────────
    if (logs.length > 100) {
      return NextResponse.json(
        { error: 'Limite de 100 registros por batch excedido.' },
        { status: 400 }
      )
    }

    // Buscar nome real do usuário — não aceitar do payload (evita forjamento)
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('nome')
      .eq('id', user.id)
      .maybeSingle()
    const sessionUserNome = dbUser?.nome || user.email || user.id

    const sanitize = (obj: any) => {
       if (!obj || typeof obj !== 'object') return obj;
       const copy = { ...obj };
       if (copy.foto) copy.foto = '[BASE64_OMITIDO]';
       if (copy.arquivoBase64) copy.arquivoBase64 = '[BASE64_OMITIDO]';
       return copy;
    }

    const processedLogs = logs.map((l: any) => ({
      id: l.id || `LOG-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      data_hora: l.dataHora || l.created_at || new Date().toISOString(),
      // ── Segurança: usuario_nome SEMPRE da sessão — nunca do payload ──────────
      usuario_nome: sessionUserNome,
      perfil: l.perfil || '',
      modulo: l.modulo || '',
      acao: l.acao || '',
      descricao: l.descricao || '',
      status: l.status || 'sucesso',
      origem: l.origem || 'sistema',
      registro_id: l.registroId || null,
      nome_relacionado: l.nomeRelacionado || null,
      detalhes_antes: sanitize(l.detalhesAntes || l.detalhes),
      detalhes_depois: sanitize(l.detalhesDepois),
    }))

    // Usa cliente protegido (RLS) em vez de AdminClient para batch público
    const { error } = await supabase
      .from('system_logs')
      .insert(processedLogs)

    if (error) {
      console.error('[SystemLogsBatch] Error inserting logs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: processedLogs.length })
  } catch (err: any) {
    console.error('[SystemLogsBatch] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

