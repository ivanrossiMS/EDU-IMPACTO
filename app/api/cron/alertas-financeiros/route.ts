/**
 * app/api/cron/alertas-financeiros/route.ts
 *
 * Robô Automatizado de Notificação de Parcela Vencida (3 dias após vencimento).
 *
 * Regras de Negócio:
 * 1. Condicional à chave global: Executa APENAS se `ad_config.valor.notificacoes.pushFinanceiro === true`.
 * 2. Filtro de Vencimento: Identifica faturas pendentes cujo vencimento ocorreu há 3 dias (janela 3 a 7 dias).
 * 3. Destinatário Estrito: Notifica EXCLUSIVAMENTE o Responsável Financeiro (`resp_financeiro: true`).
 * 4. Anti-Duplicidade Atômica: Cada parcela é notificada exatamente UMA vez na vida (gravado em `agenda_push_logs`).
 * 5. Destino de Toque: Abre diretamente `/agenda-digital/{alunoId}/financeiro`.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getOrFetchYearCache } from '@/lib/isaacCache'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // até 60 segundos para processar lote

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url: any, options: any) => fetch(url, { ...options, cache: 'no-store' }) }
    }
  )
}

/**
 * Retorna uma data no fuso de São Paulo (America/Sao_Paulo) no formato YYYY-MM-DD
 */
function getSaoPauloDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Subtrai dias de uma data
 */
function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

async function verifyCallerAuth(request: Request): Promise<{ authorized: boolean; reason?: string }> {
  // 1. Autorização por CRON_SECRET (Vercel Cron ou webhook agendado)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { authorized: true }
  }

  // 2. Chamadas em ambiente de desenvolvimento local
  const host = request.headers.get('host') || ''
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return { authorized: true }
  }

  // 3. Usuários administrativos autenticados no ERP / Agenda Digital
  const { user, errorResponse } = await requireAuth()
  if (!errorResponse && user) {
    const supabase = getSupabaseAdmin()
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('perfil, cargo')
      .eq('id', user.id)
      .maybeSingle()

    const ALLOWED_ROLES = [
      'Direção', 'Diretor Geral', 'Administrador', 'Administrador Master',
      'Admin', 'Financeiro', 'Secretaria'
    ]
    const perfil = dbUser?.perfil || (user.user_metadata?.perfil as string) || ''
    const cargo = dbUser?.cargo || (user.user_metadata?.cargo as string) || ''

    if (ALLOWED_ROLES.includes(perfil) || ALLOWED_ROLES.includes(cargo)) {
      return { authorized: true }
    }
  }

  return { authorized: false, reason: 'Unauthorized: Requer token de cron ou perfil administrativo.' }
}

async function runOverdueFinancialAlertsRoutine(options: { forceSimulate?: boolean } = {}) {
  const supabase = getSupabaseAdmin()
  const logPrefix = '[Cron Alerta Financeiro]'
  const now = new Date()

  console.log(`${logPrefix} Iniciando rotina de verificação de parcelas vencidas há 3 dias...`)

  // ─── 1. Checagem da Chave Global nas Configurações ────────────────────────────
  const { data: configRow, error: configErr } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'ad_config')
    .maybeSingle()

  if (configErr) {
    console.error(`${logPrefix} Erro ao buscar ad_config:`, configErr.message)
  }

  const isFinancialPushEnabled = Boolean(configRow?.valor?.notificacoes?.pushFinanceiro)

  if (!isFinancialPushEnabled && !options.forceSimulate) {
    console.log(`${logPrefix} Alertas Financeiros DESATIVADOS globalmente (pushFinanceiro = false). Abortando.`)
    return {
      success: true,
      skipped: true,
      reason: 'disabled_by_admin_config',
      message: 'O envio de alertas financeiros está desativado no painel de Ajustes.',
      timestamp: now.toISOString(),
    }
  }

  // ─── 2. Definição da Janela de Vencimento de 3 Dias ───────────────────────────
  // Fuso horário oficial de São Paulo
  const todayStr = getSaoPauloDateStr(now)
  const exact3DaysAgoStr = getSaoPauloDateStr(subtractDays(now, 3))
  const maxLag7DaysAgoStr = getSaoPauloDateStr(subtractDays(now, 7))

  console.log(`${logPrefix} Data referência: ${todayStr} | Alvo: vencidos entre ${maxLag7DaysAgoStr} e ${exact3DaysAgoStr}`)

  // ─── 3. Carregar faturas do ano corrente via Isaac Cache ───────────────────────
  const currentYear = todayStr.split('-')[0]
  let isaacItems: any[] = []
  try {
    const yearCache = await getOrFetchYearCache(currentYear)
    isaacItems = yearCache.items || []
    console.log(`${logPrefix} Total de faturas em cache no Isaac (${currentYear}): ${isaacItems.length}`)
  } catch (isaacErr: any) {
    console.error(`${logPrefix} Erro ao consultar cache do Isaac:`, isaacErr.message)
  }

  // ─── 4. Filtrar parcelas em atraso na janela de 3 a 7 dias ───────────────────
  interface OverdueCandidate {
    id: string
    source: 'isaac' | 'titulos'
    alunoId: string
    alunoNome: string
    vencimento: string
    valor: number
    descricao: string
    guardianExternalId?: string
  }

  const candidates: OverdueCandidate[] = []

  // 4.1 Faturas do Isaac
  for (const item of isaacItems) {
    const status = String(item.status || '').toUpperCase()
    // Apenas faturas não pagas e não canceladas
    if (status !== 'OPEN' && status !== 'OVERDUE') continue
    if (item.paid_date) continue

    const dueDateStr = item.due_date ? String(item.due_date).split('T')[0] : ''
    if (!dueDateStr) continue

    // Checar se está dentro da janela de 3 a 7 dias de atraso
    if (dueDateStr <= exact3DaysAgoStr && dueDateStr >= maxLag7DaysAgoStr) {
      const studentExtId = item.student?.external_id ? String(item.student.external_id).trim() : ''
      if (!studentExtId) continue

      candidates.push({
        id: String(item.id),
        source: 'isaac',
        alunoId: studentExtId,
        alunoNome: item.student?.name || 'Aluno',
        vencimento: dueDateStr,
        valor: Number(item.payable_amount || item.base_amount || 0) / 100,
        descricao: item.description || 'Mensalidade Escolar',
        guardianExternalId: item.guardian?.external_id ? String(item.guardian.external_id).trim() : undefined,
      })
    }
  }

  // 4.2 Também buscar em titulos (ERP local) caso haja títulos pendentes
  try {
    const { data: erpTitulos } = await supabase
      .from('titulos')
      .select('id, aluno, aluno_id, status, vencimento, valor, descricao')
      .neq('status', 'pago')
      .lte('vencimento', exact3DaysAgoStr)
      .gte('vencimento', maxLag7DaysAgoStr)

    if (erpTitulos && erpTitulos.length > 0) {
      for (const t of erpTitulos) {
        if (!t.aluno_id) continue
        const tId = String(t.id)
        // Evita duplicar se por acaso o ID do ERP for idêntico ao do Isaac
        if (!candidates.some(c => c.id === tId)) {
          candidates.push({
            id: tId,
            source: 'titulos',
            alunoId: String(t.aluno_id).trim(),
            alunoNome: t.aluno || 'Aluno',
            vencimento: String(t.vencimento).split('T')[0],
            valor: Number(t.valor || 0),
            descricao: t.descricao || 'Mensalidade',
          })
        }
      }
    }
  } catch (erpErr: any) {
    console.warn(`${logPrefix} Aviso ao consultar tabela titulos:`, erpErr.message)
  }

  console.log(`${logPrefix} Candidatos a notificação de 3 dias de atraso encontrados: ${candidates.length}`)

  if (candidates.length === 0) {
    return {
      success: true,
      timestamp: now.toISOString(),
      pushFinanceiro: isFinancialPushEnabled,
      candidatosTotal: 0,
      enviados: 0,
      jaEnviados: 0,
      mensagem: 'Nenhuma parcela pendente completou 3 dias de vencimento hoje.',
    }
  }

  // ─── 5. Deduplicação Atômica: Checar agenda_push_logs ─────────────────────────
  const dedupItemIds = candidates.map(c => `fin_overdue_3d_${c.id}`)
  const { data: existingLogs } = await supabase
    .from('agenda_push_logs')
    .select('item_id')
    .eq('type', 'cobrancas')
    .in('item_id', dedupItemIds)

  const alreadySentSet = new Set<string>((existingLogs || []).map((l: any) => String(l.item_id)))
  const pendingCandidates = candidates.filter(c => !alreadySentSet.has(`fin_overdue_3d_${c.id}`))

  console.log(`${logPrefix} Já notificados anteriormente: ${alreadySentSet.size} | Pendentes de envio: ${pendingCandidates.length}`)

  if (pendingCandidates.length === 0) {
    return {
      success: true,
      timestamp: now.toISOString(),
      pushFinanceiro: isFinancialPushEnabled,
      candidatosTotal: candidates.length,
      enviados: 0,
      jaEnviados: alreadySentSet.size,
      mensagem: 'Todas as parcelas da janela já foram notificadas anteriormente.',
    }
  }

  // ─── 6. Resolução dos Responsáveis Financeiros (`resp_financeiro: true`) ───────
  const distinctAlunoIds = Array.from(new Set(pendingCandidates.map(c => c.alunoId)))

  // Buscar todos os vínculos de aluno_responsavel para esses alunos
  const { data: vinculos } = await supabase
    .from('aluno_responsavel')
    .select('aluno_id, responsavel_id, resp_financeiro')
    .in('aluno_id', distinctAlunoIds)

  // Mapear alunoId -> array de responsaveis_id financeiros
  const financialGuardiansMap = new Map<string, string[]>()
  for (const v of vinculos || []) {
    if (v.resp_financeiro && v.responsavel_id) {
      const aId = String(v.aluno_id).trim()
      const rId = String(v.responsavel_id).trim()
      const current = financialGuardiansMap.get(aId) || []
      if (!current.includes(rId)) current.push(rId)
      financialGuardiansMap.set(aId, current)
    }
  }

  // Coletar todos os IDs de responsáveis financeiros para buscar emails/auth_ids
  const allFinancialRespIds = new Set<string>()
  for (const rIds of financialGuardiansMap.values()) {
    rIds.forEach(id => allFinancialRespIds.add(id))
  }
  // Também adicionar guardianExternalId de quem não tem vínculo cadastrado
  for (const c of pendingCandidates) {
    if ((!financialGuardiansMap.get(c.alunoId) || financialGuardiansMap.get(c.alunoId)!.length === 0) && c.guardianExternalId) {
      allFinancialRespIds.add(c.guardianExternalId)
    }
  }

  // Buscar dados de contato (email, telefone) e contas de usuário
  const [respsRes, sysUsersRes] = await Promise.all([
    allFinancialRespIds.size > 0
      ? supabase
          .from('responsaveis')
          .select('id, nome, email, telefone')
          .in('id', Array.from(allFinancialRespIds))
      : { data: [] },
    supabase
      .from('system_users')
      .select('id, auth_id, email, dados')
      .limit(2000),
  ])

  const respsList = respsRes.data || []
  const sysUsersList = sysUsersRes.data || []

  // ─── 7. Execução dos Disparos de Notificação Push ────────────────────────────
  let sentCount = 0
  let skippedNoGuardianCount = 0
  const dispatchResults: any[] = []

  for (const item of pendingCandidates) {
    // 7.1 Identificar os IDs dos responsáveis financeiros deste aluno
    let targetRespIds = financialGuardiansMap.get(item.alunoId) || []

    // Fallback caso não haja vínculo explícito: usa o contratante do Isaac
    if (targetRespIds.length === 0 && item.guardianExternalId) {
      targetRespIds = [item.guardianExternalId]
    }

    if (targetRespIds.length === 0) {
      console.warn(`${logPrefix} Aluno ${item.alunoNome} (${item.alunoId}) não possui Responsável Financeiro cadastrado. Pulando.`)
      skippedNoGuardianCount++
      continue
    }

    // 7.2 Montar lista expandida de identificadores para o OneSignal (User Model)
    const targetUserIdsSet = new Set<string>()

    for (const rId of targetRespIds) {
      const rIdStr = String(rId).trim()
      targetUserIdsSet.add(rIdStr)
      targetUserIdsSet.add(rIdStr.replace(/^0+/, ''))

      // Busca dados cadastrais do responsável
      const rInfo = respsList.find((r: any) => String(r.id).trim() === rIdStr)
      if (rInfo?.email) {
        targetUserIdsSet.add(String(rInfo.email).toLowerCase().trim())
      }

      // Cruza com system_users para pegar auth_id / system_user_id
      const uMatch = sysUsersList.find((u: any) => {
        const uRespId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
        const uEmail = (u.email || '').toLowerCase().trim()
        const rEmail = (rInfo?.email || '').toLowerCase().trim()
        return (uRespId && (uRespId === rIdStr || uRespId.replace(/^0+/, '') === rIdStr.replace(/^0+/, ''))) ||
               (rEmail && uEmail === rEmail)
      })

      if (uMatch) {
        if (uMatch.id) targetUserIdsSet.add(String(uMatch.id))
        if (uMatch.auth_id) targetUserIdsSet.add(String(uMatch.auth_id))
        if (uMatch.email) targetUserIdsSet.add(String(uMatch.email).toLowerCase().trim())
      }
    }

    const targetUserIds = Array.from(targetUserIdsSet).filter(Boolean)
    if (targetUserIds.length === 0) {
      skippedNoGuardianCount++
      continue
    }

    const nomeAmigavel = formatFriendlyStudentName(item.alunoNome)
    const dedupKey = `fin_overdue_3d_${item.id}`

    console.log(`${logPrefix} Disparando push de fatura vencida para responsável financeiro de ${nomeAmigavel} (Aluno ID: ${item.alunoId}, Parcela: ${item.id})`)

    try {
      const pushResult = await sendAgendaPushNotification({
        type: 'cobrancas',
        itemId: dedupKey,
        title: '⏰ Lembrete: Mensalidade Vencida',
        message: `A fatura de ${nomeAmigavel} venceu há 3 dias. Acesse o app para consultar o código Pix ou 2ª via.`,
        targetUrl: `/agenda-digital/${item.alunoId}/financeiro`,
        targetUserIds: targetUserIds,
        metadata: {
          aluno_id: item.alunoId,
          parcela_id: item.id,
          dias_atraso: 3,
          tipo: 'parcela_vencida_3d',
          valor: item.valor,
          vencimento: item.vencimento,
        },
      })

      if (pushResult.success && !pushResult.skipped) {
        sentCount++
      }

      dispatchResults.push({
        parcelaId: item.id,
        aluno: nomeAmigavel,
        vencimento: item.vencimento,
        destinatariosCount: targetUserIds.length,
        status: pushResult.skipped ? `skipped (${pushResult.reason})` : (pushResult.success ? 'sent' : 'failed'),
      })
    } catch (pushErr: any) {
      console.error(`${logPrefix} Falha ao disparar push para parcela ${item.id}:`, pushErr.message)
    }
  }

  const finalSummary = {
    success: true,
    timestamp: now.toISOString(),
    pushFinanceiro: isFinancialPushEnabled,
    totalCandidatos: candidates.length,
    jaEnviados: alreadySentSet.size,
    pendentesProcessados: pendingCandidates.length,
    enviadosComSucesso: sentCount,
    ignoradosSemResponsavel: skippedNoGuardianCount,
    detalhes: dispatchResults.slice(0, 50),
  }

  console.log(`${logPrefix} Rotina concluída com sucesso:`, JSON.stringify({
    enviados: sentCount,
    jaEnviados: alreadySentSet.size,
    total: candidates.length,
  }))

  return finalSummary
}

export async function GET(request: Request) {
  const auth = await verifyCallerAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runOverdueFinancialAlertsRoutine()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Cron Alertas Financeiros GET Fatal Error]:', error)
    return NextResponse.json({ error: error.message || 'Erro interno ao processar cron.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyCallerAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {}

  try {
    const result = await runOverdueFinancialAlertsRoutine({ forceSimulate: body.forceSimulate === true })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Cron Alertas Financeiros POST Fatal Error]:', error)
    return NextResponse.json({ error: error.message || 'Erro interno ao processar rotina.' }, { status: 500 })
  }
}
