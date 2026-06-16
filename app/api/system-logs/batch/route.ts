import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Inicializa Supabase Admin para gravar logs independentemente do RLS ou auth state
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(req: Request) {
  try {
    const logs = await req.json()
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    // Process logs to map to correct schema
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
      usuario_nome: l.usuarioNome || l.usuario_id || '',
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

    const { error } = await supabaseAdmin
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
