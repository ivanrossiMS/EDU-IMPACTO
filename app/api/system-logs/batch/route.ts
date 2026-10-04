import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  getAuditSettings,
  isProfileEligibleForAudit,
  computeSmartDiff,
} from '@/lib/server/auditLogger'

export async function POST(req: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // 1. Verifica se a auditoria está pausada
    const settings = await getAuditSettings()
    if (settings.paused) {
      return NextResponse.json({ success: true, count: 0, skipped: true, reason: 'audit_paused' })
    }

    const supabase = getAdminClient()

    // 2. Buscar perfil real do usuário na tabela system_users
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('nome, perfil, cargo')
      .eq('id', user.id)
      .maybeSingle()

    const sessionUserNome = dbUser?.nome || user.user_metadata?.nome || user.email || 'Colaborador'
    const sessionPerfil = dbUser?.perfil || dbUser?.cargo || user.user_metadata?.perfil || 'Colaborador'

    // 3. Regra de Negócio Crucial: Alunos e Famílias NUNCA geram logs
    if (!isProfileEligibleForAudit(sessionPerfil)) {
      return NextResponse.json({ success: true, count: 0, skipped: true, reason: 'profile_not_tracked' })
    }

    const logs = await req.json()
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    // Limitar 100 registros por batch
    if (logs.length > 100) {
      return NextResponse.json(
        { error: 'Limite de 100 registros por batch excedido.' },
        { status: 400 }
      )
    }

    const processedLogs = []

    for (const l of logs) {
      // Rejeita telemetria e web vitals
      if (l.modulo === 'Performance' || l.acao === 'WEB_VITALS') {
        continue
      }

      const { antesDiff, depoisDiff } = computeSmartDiff(
        l.detalhesAntes || l.detalhes,
        l.detalhesDepois
      )

      processedLogs.push({
        id: l.id || `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        data_hora: l.dataHora || l.created_at || new Date().toISOString(),
        usuario_nome: sessionUserNome,
        perfil: sessionPerfil,
        modulo: l.modulo || 'Geral',
        acao: l.acao || 'Ação',
        descricao: l.descricao || '',
        status: l.status || 'sucesso',
        origem: l.origem || 'sistema',
        registro_id: l.registroId ? String(l.registroId) : null,
        nome_relacionado: l.nomeRelacionado || null,
        detalhes_antes: antesDiff,
        detalhes_depois: depoisDiff,
      })
    }

    if (processedLogs.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

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
