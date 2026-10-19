// ==============================================================================
// Serviço Central de Notificações Push do Módulo CredImpacto
// Dispara Push via OneSignal (Mobile/WebPWA) + Banner Realtime + Histórico In-App
// Suporta Admin/Financeiro e Colaboradores em todos os status do ciclo de vida
// ==============================================================================

import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { sendPushNotification } from '@/lib/server/pushService'
import { getInstitutionalMasterAdminIds } from '@/lib/server/notificationHelper'
import { isCredImpactoAdmin } from './authHelper'
import {
  dbGetConfiguracao,
  dbRegistrarNotificacaoPush,
  DEFAULT_PUSH_CONFIG
} from './db'
import { formatBrl } from './engine'
import {
  CredImpactoEmprestimo,
  CredImpactoNotificationItem,
  CredImpactoPushConfig,
  CredImpactoPushEventType
} from '@/types/credimpacto'

export interface PushTargetResolution {
  userIds: string[]
  subscriptionIds: string[]
  resolvedUsers: Array<{
    id: string
    auth_id?: string
    nome: string
    email?: string
    cpf?: string
  }>
  deviceCount: number
}

function cleanCpfDigits(cpf?: string | null): string {
  return String(cpf || '').replace(/\D/g, '')
}

/**
 * Consulta o OneSignal User Model API para encontrar subscription_ids ativos
 * associados a qualquer um dos identificadores (external_id, colaborador_id, email)
 */
export async function fetchUserOneSignalSubscriptions(
  identifiers: string[]
): Promise<Array<{ id: string; type: string; enabled: boolean }>> {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''
  if (!appId || !apiKey) return []

  const activeSubs: Array<{ id: string; type: string; enabled: boolean }> = []
  const seenSubIds = new Set<string>()
  const uniqueIdents = Array.from(
    new Set(identifiers.map((s) => String(s || '').trim()).filter(Boolean))
  )

  for (const ident of uniqueIdents) {
    // 1. Tentar por external_id
    try {
      const res = await fetch(
        `https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(ident)}`,
        {
          headers: { Authorization: `Basic ${apiKey}` },
          cache: 'no-store'
        }
      )
      if (res.ok) {
        const data = await res.json()
        const subs = Array.isArray(data.subscriptions) ? data.subscriptions : []
        for (const s of subs) {
          if (s.id && !seenSubIds.has(s.id) && s.enabled !== false && s.notification_types !== -99) {
            seenSubIds.add(s.id)
            activeSubs.push({ id: s.id, type: s.type || 'Push', enabled: true })
          }
        }
        if (activeSubs.length > 0) return activeSubs
      }
    } catch {}

    // 2. Tentar por alias colaborador_id
    try {
      const colabRes = await fetch(
        `https://onesignal.com/api/v1/apps/${appId}/users/by/colaborador_id/${encodeURIComponent(ident)}`,
        {
          headers: { Authorization: `Basic ${apiKey}` },
          cache: 'no-store'
        }
      )
      if (colabRes.ok) {
        const data = await colabRes.json()
        const subs = Array.isArray(data.subscriptions) ? data.subscriptions : []
        for (const s of subs) {
          if (s.id && !seenSubIds.has(s.id) && s.enabled !== false && s.notification_types !== -99) {
            seenSubIds.add(s.id)
            activeSubs.push({ id: s.id, type: s.type || 'Push', enabled: true })
          }
        }
        if (activeSubs.length > 0) return activeSubs
      }
    } catch {}

    // 3. Tentar por alias email
    if (ident.includes('@')) {
      try {
        const emailRes = await fetch(
          `https://onesignal.com/api/v1/apps/${appId}/users/by/email/${encodeURIComponent(ident.toLowerCase().trim())}`,
          {
            headers: { Authorization: `Basic ${apiKey}` },
            cache: 'no-store'
          }
        )
        if (emailRes.ok) {
          const data = await emailRes.json()
          const subs = Array.isArray(data.subscriptions) ? data.subscriptions : []
          for (const s of subs) {
            if (s.id && !seenSubIds.has(s.id) && s.enabled !== false && s.notification_types !== -99) {
              seenSubIds.add(s.id)
              activeSubs.push({ id: s.id, type: s.type || 'Push', enabled: true })
            }
          }
          if (activeSubs.length > 0) return activeSubs
        }
      } catch {}
    }
  }

  return activeSubs
}

/**
 * Resolve todos os identificadores (IDs, Auth IDs, E-mails e Subscriptions OneSignal)
 * de um Colaborador específico (por ID, CPF, E-mail ou Nome).
 */
export async function resolveColaboradorPushTargets(params: {
  colaboradorId?: string | null
  colaboradorEmail?: string | null
  colaboradorCpf?: string | null
  colaboradorNome?: string | null
}): Promise<PushTargetResolution> {
  const sb = getAdminClient()
  const targetUserIds = new Set<string>()
  const resolvedUsers: PushTargetResolution['resolvedUsers'] = []
  const seenUserKeys = new Set<string>()

  const rawId = String(params.colaboradorId || '').trim()
  const rawEmail = String(params.colaboradorEmail || '').toLowerCase().trim()
  const rawCpfDigits = cleanCpfDigits(params.colaboradorCpf)
  const rawNome = String(params.colaboradorNome || '').trim().toLowerCase()

  if (rawId) targetUserIds.add(rawId)
  if (rawEmail && rawEmail.includes('@')) targetUserIds.add(rawEmail)

  try {
    const [{ data: sysUsers }, { data: funcUsers }] = await Promise.all([
      sb
        .from('system_users')
        .select('id, auth_id, colaborador_id, nome, email, cpf, ativo')
        .neq('ativo', false),
      sb
        .from('funcionarios')
        .select('id, auth_id, nome, email, cpf, ativo')
        .neq('ativo', false)
    ])

    const matchRecord = (r: any): boolean => {
      const rId = String(r.id || '').trim()
      const rAuthId = String(r.auth_id || '').trim()
      const rColabId = String(r.colaborador_id || '').trim()
      const rEmail = String(r.email || '').toLowerCase().trim()
      const rCpf = cleanCpfDigits(r.cpf)
      const rNome = String(r.nome || '').trim().toLowerCase()

      if (rawId && (rId === rawId || rAuthId === rawId || rColabId === rawId)) return true
      if (rawEmail && rEmail && rEmail === rawEmail) return true
      if (rawCpfDigits && rawCpfDigits.length === 11 && rawCpfDigits !== '00000000000' && rCpf === rawCpfDigits) {
        return true
      }
      if (!rawId && !rawEmail && !rawCpfDigits && rawNome && rNome === rawNome) {
        return true
      }
      return false
    }

    const allCandidates: any[] = [...(sysUsers || []), ...(funcUsers || [])]
    for (const r of allCandidates) {
      if (matchRecord(r)) {
        if (r.id) targetUserIds.add(String(r.id).trim())
        if (r.auth_id) targetUserIds.add(String(r.auth_id).trim())
        if (r.colaborador_id) targetUserIds.add(String(r.colaborador_id).trim())
        if (r.email && String(r.email).includes('@')) {
          targetUserIds.add(String(r.email).toLowerCase().trim())
        }

        const key = String(r.id || r.auth_id || r.email)
        if (!seenUserKeys.has(key)) {
          seenUserKeys.add(key)
          resolvedUsers.push({
            id: String(r.id),
            auth_id: r.auth_id ? String(r.auth_id) : undefined,
            nome: r.nome || params.colaboradorNome || 'Colaborador',
            email: r.email ? String(r.email).toLowerCase().trim() : undefined,
            cpf: r.cpf ? String(r.cpf) : undefined
          })
        }
      }
    }

    // Se encontramos colaborador_id ou email nos registros iniciais, fazemos segunda passagem cruzada
    // para garantir que tanto o registro de funcionarios quanto o de system_users sejam vinculados
    if (targetUserIds.size > 0) {
      for (const r of allCandidates) {
        const rId = String(r.id || '').trim()
        const rAuthId = String(r.auth_id || '').trim()
        const rColabId = String(r.colaborador_id || '').trim()
        const rEmail = String(r.email || '').toLowerCase().trim()
        if (
          (rId && targetUserIds.has(rId)) ||
          (rAuthId && targetUserIds.has(rAuthId)) ||
          (rColabId && targetUserIds.has(rColabId)) ||
          (rEmail && targetUserIds.has(rEmail))
        ) {
          if (rId) targetUserIds.add(rId)
          if (rAuthId) targetUserIds.add(rAuthId)
          if (rColabId) targetUserIds.add(rColabId)
          if (rEmail && rEmail.includes('@')) targetUserIds.add(rEmail)
        }
      }
    }
  } catch (err) {
    console.warn('[CredImpacto Push] Erro ao resolver colaborador:', err)
  }

  const userIdsArray = Array.from(targetUserIds).filter(Boolean)
  const subs = await fetchUserOneSignalSubscriptions(userIdsArray)
  const subscriptionIds = Array.from(new Set(subs.map((s) => s.id)))

  return {
    userIds: userIdsArray,
    subscriptionIds,
    resolvedUsers,
    deviceCount: subscriptionIds.length
  }
}

/**
 * Resolve todos os Administradores / Diretores / Gestores Financeiros do CredImpacto
 */
export async function resolveCredImpactoAdminPushTargets(): Promise<PushTargetResolution> {
  const sb = getAdminClient()
  const targetUserIds = new Set<string>()
  const resolvedUsers: PushTargetResolution['resolvedUsers'] = []
  const seenUserKeys = new Set<string>()

  try {
    const masterIds = await getInstitutionalMasterAdminIds()
    masterIds.forEach((id) => {
      if (id) targetUserIds.add(String(id).trim())
    })
  } catch {}

  try {
    const [{ data: sysUsers }, { data: funcUsers }] = await Promise.all([
      sb
        .from('system_users')
        .select('id, auth_id, colaborador_id, nome, email, perfil, cargo, ativo')
        .neq('ativo', false),
      sb
        .from('funcionarios')
        .select('id, auth_id, nome, email, perfil, cargo, funcao, ativo')
        .neq('ativo', false)
    ])

    for (const u of sysUsers || []) {
      if (isCredImpactoAdmin(u.perfil, u.cargo)) {
        if (u.id) targetUserIds.add(String(u.id).trim())
        if (u.auth_id) targetUserIds.add(String(u.auth_id).trim())
        if (u.colaborador_id) targetUserIds.add(String(u.colaborador_id).trim())
        if (u.email && String(u.email).includes('@')) {
          targetUserIds.add(String(u.email).toLowerCase().trim())
        }
        const key = String(u.id || u.email)
        if (!seenUserKeys.has(key)) {
          seenUserKeys.add(key)
          resolvedUsers.push({
            id: String(u.id),
            auth_id: u.auth_id ? String(u.auth_id) : undefined,
            nome: u.nome || 'Administrador',
            email: u.email ? String(u.email).toLowerCase().trim() : undefined
          })
        }
      }
    }

    for (const f of funcUsers || []) {
      const cargo = [f.cargo, f.funcao].filter(Boolean).join(' ')
      if (isCredImpactoAdmin(f.perfil, cargo)) {
        if (f.id) targetUserIds.add(String(f.id).trim())
        if (f.auth_id) targetUserIds.add(String(f.auth_id).trim())
        if (f.email && String(f.email).includes('@')) {
          targetUserIds.add(String(f.email).toLowerCase().trim())
        }
        const key = String(f.id || f.email)
        if (!seenUserKeys.has(key)) {
          seenUserKeys.add(key)
          resolvedUsers.push({
            id: String(f.id),
            auth_id: f.auth_id ? String(f.auth_id) : undefined,
            nome: f.nome || 'Administrador',
            email: f.email ? String(f.email).toLowerCase().trim() : undefined
          })
        }
      }
    }
  } catch (err) {
    console.warn('[CredImpacto Push] Erro ao resolver administradores:', err)
  }

  const userIdsArray = Array.from(targetUserIds).filter(Boolean)
  const subs = await fetchUserOneSignalSubscriptions(userIdsArray)
  const subscriptionIds = Array.from(new Set(subs.map((s) => s.id)))

  return {
    userIds: userIdsArray,
    subscriptionIds,
    resolvedUsers,
    deviceCount: subscriptionIds.length
  }
}

/**
 * Emite um broadcast Realtime no canal 'credimpacto_realtime_room' (evento CREDIMPACTO_PUSH_BANNER)
 * para exibir o banner nativo interativo com som/vibração no navegador/app de quem estiver online
 */
async function broadcastCredImpactoPushBanner(payload: {
  id: string
  eventType: CredImpactoPushEventType
  recipientRole: 'admin' | 'colaborador' | 'ambos'
  targetUserIds: string[]
  targetColaboradorCpf?: string
  targetColaboradorEmail?: string
  emprestimoId?: string
  codigoOperacao?: string
  title: string
  message: string
  targetUrl: string
}): Promise<void> {
  try {
    const sb = getAdminClient()
    const eventPayload = {
      ...payload,
      timestamp: new Date().toISOString()
    }
    for (const roomName of ['credimpacto_push_global_room', 'credimpacto_realtime_room']) {
      try {
        const channel = sb.channel(roomName)
        if (typeof (channel as any).httpSend === 'function') {
          await (channel as any).httpSend('CREDIMPACTO_PUSH_BANNER', eventPayload)
        } else {
          await channel.send({
            type: 'broadcast',
            event: 'CREDIMPACTO_PUSH_BANNER',
            payload: eventPayload
          })
        }
        await sb.removeChannel(channel).catch(() => {})
      } catch {}
    }
  } catch (err) {
    console.warn('[CredImpacto Push Banner Realtime Error]', err)
  }
}

/**
 * Registra log diagnóstico na tabela agenda_push_logs (best-effort)
 */
async function logCredImpactoPushDiagnostic(params: {
  itemId: string
  title: string
  message: string
  targetUserIds: string[]
  status: 'sent' | 'failed'
  onesignalId?: string
  recipients?: number
  errorDetails?: any
  metadata?: Record<string, any>
}) {
  try {
    const sb = getAdminClient()
    await sb.from('agenda_push_logs').insert({
      notification_type: 'aviso_geral',
      item_id: params.itemId,
      title: params.title,
      message: params.message,
      target_user_ids: params.targetUserIds,
      onesignal_id: params.onesignalId || null,
      recipients_count: params.recipients || 0,
      status: params.status,
      error_details: params.errorDetails ? JSON.stringify(params.errorDetails) : null,
      metadata: {
        module: 'credimpacto',
        ...(params.metadata || {})
      }
    })
  } catch {}
}

/**
 * Constrói os textos padronizados de Título, Mensagem e Deep-Link para qualquer status/evento
 */
export function buildCredImpactoPushTemplate(
  eventType: CredImpactoPushEventType,
  loan?: Partial<CredImpactoEmprestimo> | null,
  extra?: {
    valor?: number
    parcelas?: number
    valorParcela?: number
    parcelaNumero?: number
    competencia?: string
    motivo?: string
    chavePix?: string
    codigoVerificacao?: string
    valorQuitacao?: number
    economiaQuitacao?: number
    valorCompensadoTrct?: number
    saldoRemanescente?: number
    autorNome?: string
    customTitle?: string
    customMessage?: string
  }
): {
  admin?: { title: string; message: string; targetUrl: string }
  colaborador?: { title: string; message: string; targetUrl: string }
} {
  const codigo = loan?.codigoOperacao || 'CREDIMPACTO'
  const loanId = loan?.id || ''
  const colabNome = loan?.colaboradorNome || 'Colaborador'
  const colabPrimeiroNome = colabNome.split(' ')[0] || 'Colaborador'
  const valor =
    extra?.valor ??
    (loan?.valorAprovado && loan.valorAprovado > 0 ? loan.valorAprovado : loan?.valorSolicitado) ??
    0
  const parcelas = extra?.parcelas ?? loan?.quantidadeParcelas ?? 1
  const valorFmt = formatBrl(valor)
  const valorParcela =
    extra?.valorParcela ??
    loan?.parcelas?.[0]?.valorTotal ??
    (parcelas > 0 ? valor / parcelas : valor)
  const valorParcelaFmt = formatBrl(valorParcela)

  const colabUrl = loanId
    ? `/credimpacto?tab=meus_emprestimos&loanId=${encodeURIComponent(loanId)}`
    : '/credimpacto?tab=meus_emprestimos'
  const adminAnaliseUrl = loanId
    ? `/credimpacto?tab=analise&loanId=${encodeURIComponent(loanId)}`
    : '/credimpacto?tab=analise'
  const adminLiberacoesUrl = loanId
    ? `/credimpacto?tab=liberacoes&loanId=${encodeURIComponent(loanId)}`
    : '/credimpacto?tab=liberacoes'
  const adminDashboardUrl = loanId
    ? `/credimpacto?tab=dashboard&loanId=${encodeURIComponent(loanId)}`
    : '/credimpacto?tab=dashboard'

  switch (eventType) {
    case 'simulacao_realizada':
      return {
        admin: {
          title: `📊 Nova Simulação no CredImpacto`,
          message: `${colabNome} realizou uma simulação de ${valorFmt} em ${parcelas}x (${valorParcelaFmt}/mês).`,
          targetUrl: '/credimpacto?tab=dashboard'
        },
        colaborador: {
          title: `📊 Simulação CredImpacto (${valorFmt})`,
          message: `Olá, ${colabPrimeiroNome}! Sua simulação de ${valorFmt} em ${parcelas}x de ${valorParcelaFmt} está disponível no portal CredImpacto.`,
          targetUrl: '/credimpacto?tab=simular'
        }
      }

    case 'solicitacao_nova':
      return {
        admin: {
          title: `🚨 Nova Solicitação CredImpacto (${codigo})`,
          message: `${colabNome} solicitou ${valorFmt} em ${parcelas}x (${valorParcelaFmt}/mês). Toque para analisar a proposta.`,
          targetUrl: adminAnaliseUrl
        },
        colaborador: {
          title: `📨 Solicitação Recebida (${codigo})`,
          message: `Olá, ${colabPrimeiroNome}! Sua solicitação de ${valorFmt} em ${parcelas}x foi enviada para análise do setor financeiro.`,
          targetUrl: colabUrl
        }
      }

    case 'concessao_escola': {
      const st = loan?.status || 'aguardando_liberacao'
      if (st === 'aguardando_assinatura') {
        return {
          colaborador: {
            title: `✍️ Empréstimo Concedido — Assine o Contrato (${codigo})`,
            message: `Olá, ${colabPrimeiroNome}! Um empréstimo de ${valorFmt} em ${parcelas}x foi cadastrado para você. Toque para assinar digitalmente!`,
            targetUrl: `${colabUrl}&action=assinar`
          }
        }
      }
      if (st === 'ativo') {
        return {
          colaborador: {
            title: `💸 Empréstimo Concedido e Liberado! (${codigo})`,
            message: `Olá, ${colabPrimeiroNome}! Seu empréstimo de ${valorFmt} em ${parcelas}x foi concedido e ativado. Confira seu contrato e cronograma.`,
            targetUrl: colabUrl
          }
        }
      }
      return {
        colaborador: {
          title: `✅ Empréstimo Concedido e Aprovado (${codigo})`,
          message: `Olá, ${colabPrimeiroNome}! Seu empréstimo de ${valorFmt} em ${parcelas}x foi aprovado e encaminhado para liberação PIX/TED.`,
          targetUrl: colabUrl
        },
        admin: {
          title: `🏦 Fila de Liberação TED/PIX (${codigo})`,
          message: `Concessão de ${valorFmt} (${parcelas}x) para ${colabNome} aguarda transferência na Tesouraria.`,
          targetUrl: adminLiberacoesUrl
        }
      }
    }

    case 'em_analise':
      return {
        colaborador: {
          title: `🔍 Solicitação em Análise (${codigo})`,
          message: `Olá, ${colabPrimeiroNome}! Sua proposta de ${valorFmt} em ${parcelas}x está sendo analisada pelo setor financeiro.`,
          targetUrl: colabUrl
        }
      }

    case 'aprovado_aguardando_assinatura':
      return {
        colaborador: {
          title: `🎉 Empréstimo Aprovado! Assine seu Contrato (${codigo})`,
          message: `Boa notícia, ${colabPrimeiroNome}! Seu empréstimo de ${valorFmt} em ${parcelas}x foi aprovado. Acesse para assinar eletronicamente e liberar o PIX.`,
          targetUrl: `${colabUrl}&action=assinar`
        }
      }

    case 'aprovado_aguardando_liberacao':
      return {
        colaborador: {
          title: `✅ Empréstimo Aprovado! (${codigo})`,
          message: `Parabéns, ${colabPrimeiroNome}! Seu empréstimo de ${valorFmt} em ${parcelas}x foi aprovado e já está na fila de transferência PIX/TED.`,
          targetUrl: colabUrl
        },
        admin: {
          title: `🏦 Novo Contrato para Liberação PIX/TED (${codigo})`,
          message: `Operação de ${colabNome} (${valorFmt} em ${parcelas}x) aprovada e pronta para transferência.`,
          targetUrl: adminLiberacoesUrl
        }
      }

    case 'aprovado_ativo':
      return {
        colaborador: {
          title: `💸 Empréstimo Aprovado e Ativo! (${codigo})`,
          message: `Olá, ${colabPrimeiroNome}! Seu empréstimo de ${valorFmt} em ${parcelas}x foi aprovado e os recursos foram liberados. Confira seu contrato.`,
          targetUrl: colabUrl
        }
      }

    case 'recusado': {
      const motivo = extra?.motivo || loan?.motivoRecusa || 'Consulte os detalhes no portal.'
      return {
        colaborador: {
          title: `⚠️ Atualização da Solicitação (${codigo})`,
          message: `Olá, ${colabPrimeiroNome}. Sua solicitação de ${valorFmt} não pôde ser aprovada neste momento. Motivo: ${motivo}`,
          targetUrl: colabUrl
        }
      }
    }

    case 'contraproposta_enviada': {
      const vProp = extra?.valor ?? loan?.contraproposta?.valorProposto ?? valor
      const pProp = extra?.parcelas ?? loan?.contraproposta?.quantidadeParcelas ?? parcelas
      const vpProp = extra?.valorParcela ?? valorParcela
      const just = extra?.motivo || loan?.contraproposta?.motivo || ''
      return {
        colaborador: {
          title: `💡 Nova Contraproposta Disponível (${codigo})`,
          message: `Olá, ${colabPrimeiroNome}! O financeiro enviou uma contraproposta de ${formatBrl(vProp)} em ${pProp}x de ${formatBrl(vpProp)}.${just ? ` (${just})` : ''} Toque para responder!`,
          targetUrl: `${colabUrl}&action=contraproposta`
        }
      }
    }

    case 'contraproposta_aceita':
      return {
        admin: {
          title: `🤝 Contraproposta Aceita! (${codigo})`,
          message: `${colabNome} aceitou a contraproposta de ${valorFmt} em ${parcelas}x! O contrato aguarda assinatura digital.`,
          targetUrl: adminAnaliseUrl
        },
        colaborador: {
          title: `✍️ Contraproposta Aceita! Assine o Contrato (${codigo})`,
          message: `Você aceitou a proposta de ${valorFmt} em ${parcelas}x. Agora assine digitalmente o contrato para liberar o depósito!`,
          targetUrl: `${colabUrl}&action=assinar`
        }
      }

    case 'contraproposta_recusada':
      return {
        admin: {
          title: `❌ Contraproposta Recusada (${codigo})`,
          message: `${colabNome} recusou a contraproposta da operação ${codigo}. A solicitação foi encerrada.`,
          targetUrl: adminDashboardUrl
        }
      }

    case 'contrato_assinado': {
      const pix = extra?.chavePix || loan?.dadosBancarios?.chavePix || loan?.colaboradorCpf || 'Cadastrado'
      const codVerif = extra?.codigoVerificacao || loan?.codigoVerificacaoAssinatura || ''
      return {
        admin: {
          title: `✍️ Contrato Assinado! Liberar PIX/TED (${codigo})`,
          message: `${colabNome} assinou o contrato de ${valorFmt} (${parcelas}x). PIX: ${pix}. Pronto para transferência na Tesouraria!`,
          targetUrl: adminLiberacoesUrl
        },
        colaborador: {
          title: `🔐 Assinatura Eletrônica Confirmada (${codigo})`,
          message: `Seu contrato de ${valorFmt} foi assinado com sucesso${codVerif ? ` (Cód: ${codVerif})` : ''}! Aguardando liberação PIX/TED pela Tesouraria.`,
          targetUrl: colabUrl
        }
      }
    }

    case 'recursos_liberados': {
      const pix = loan?.dadosBancarios?.chavePix || loan?.colaboradorCpf || 'sua conta'
      return {
        colaborador: {
          title: `💸 Dinheiro na Conta! Recursos Liberados (${codigo})`,
          message: `Olá, ${colabPrimeiroNome}! A transferência de ${valorFmt} foi realizada para ${pix}. Seu comprovante e cronograma já estão disponíveis!`,
          targetUrl: colabUrl
        },
        admin: {
          title: `✅ Liberação TED/PIX Confirmada (${codigo})`,
          message: `Transferência de ${valorFmt} para ${colabNome} registrada com sucesso${extra?.autorNome ? ` por ${extra.autorNome}` : ''}.`,
          targetUrl: adminLiberacoesUrl
        }
      }
    }

    case 'parcela_conciliada': {
      const num = extra?.parcelaNumero ?? 1
      const comp = extra?.competencia ? ` (${extra.competencia})` : ''
      const vPago = formatBrl(extra?.valor ?? valorParcela)
      const isQuitado = loan?.status === 'quitado'
      return {
        colaborador: {
          title: isQuitado
            ? `🏆 Última Parcela Baixada — Empréstimo Quitado! (${codigo})`
            : `🧾 Parcela ${String(num).padStart(2, '0')}/${String(parcelas).padStart(2, '0')} Quitada (${codigo})`,
          message: isQuitado
            ? `Parabéns, ${colabPrimeiroNome}! A parcela ${num}/${parcelas}${comp} (${vPago}) foi baixada e seu contrato ${codigo} está 100% quitado!`
            : `A parcela ${num}/${parcelas}${comp} no valor de ${vPago} foi baixada com sucesso no seu contrato ${codigo}.`,
          targetUrl: colabUrl
        }
      }
    }

    case 'parcela_estornada': {
      const num = extra?.parcelaNumero ?? 1
      const comp = extra?.competencia ? ` (${extra.competencia})` : ''
      const just = extra?.motivo ? ` Motivo: ${extra.motivo}.` : ''
      return {
        colaborador: {
          title: `🔄 Estorno de Baixa de Parcela (${codigo})`,
          message: `A baixa da parcela ${num}/${parcelas}${comp} da operação ${codigo} foi estornada pelo setor financeiro.${just}`,
          targetUrl: colabUrl
        }
      }
    }

    case 'lembrete_parcela': {
      const pendentes = (loan?.parcelas || []).filter(
        (p) => p.status === 'prevista' || p.status === 'exportada_folha' || p.status === 'atrasada'
      )
      const prox = pendentes[0]
      const num = extra?.parcelaNumero ?? prox?.numero ?? 1
      const comp = extra?.competencia ?? prox?.competencia ?? ''
      const vParc = formatBrl(extra?.valor ?? prox?.valorTotal ?? valorParcela)
      return {
        colaborador: {
          title: `📅 Lembrete de Parcela CredImpacto (${codigo})`,
          message: `Olá, ${colabPrimeiroNome}! Lembrete referente à parcela ${num}/${parcelas}${comp ? ` (Comp: ${comp})` : ''} no valor de ${vParc} da operação ${codigo}.`,
          targetUrl: colabUrl
        }
      }
    }

    case 'quitacao_solicitada': {
      const vQuit = formatBrl(extra?.valorQuitacao ?? loan?.saldoDevedorAtual ?? valor)
      const econ = extra?.economiaQuitacao ? ` (Economia de juros: ${formatBrl(extra.economiaQuitacao)})` : ''
      return {
        admin: {
          title: `💰 Solicitação de Quitação Antecipada (${codigo})`,
          message: `${colabNome} solicitou a quitação antecipada do contrato ${codigo} pelo valor líquido de ${vQuit}${econ}.`,
          targetUrl: adminDashboardUrl
        },
        colaborador: {
          title: `📨 Pedido de Quitação Enviado (${codigo})`,
          message: `Notificamos o setor financeiro sobre seu interesse em quitar antecipadamente o contrato ${codigo} por ${vQuit}.`,
          targetUrl: colabUrl
        }
      }
    }

    case 'quitacao_confirmada': {
      const vQuit = formatBrl(extra?.valorQuitacao ?? loan?.saldoDevedorAtual ?? valor)
      const econ = extra?.economiaQuitacao && extra.economiaQuitacao > 0
        ? ` Você economizou ${formatBrl(extra.economiaQuitacao)} em juros futuros!`
        : ''
      return {
        colaborador: {
          title: `🎉 Empréstimo 100% Quitado! (${codigo})`,
          message: `Parabéns, ${colabPrimeiroNome}! Sua quitação antecipada de ${vQuit} foi confirmada.${econ} Todas as parcelas futuras foram encerradas.`,
          targetUrl: colabUrl
        },
        admin: {
          title: `🏆 Quitação Antecipada Confirmada (${codigo})`,
          message: `O contrato ${codigo} de ${colabNome} foi 100% liquidado antecipadamente (${vQuit}).`,
          targetUrl: adminDashboardUrl
        }
      }
    }

    case 'rescisao_homologada': {
      const compTrct = formatBrl(extra?.valorCompensadoTrct ?? 0)
      const rem = extra?.saldoRemanescente ?? 0
      return {
        colaborador: {
          title: `📋 Compensação Rescisória CredImpacto (${codigo})`,
          message: `Foi registrada a compensação legal de ${compTrct} no TRCT referente ao contrato ${codigo}.${rem > 0 ? ` Saldo remanescente para acordo: ${formatBrl(rem)}.` : ' Contrato 100% quitado!'}`,
          targetUrl: colabUrl
        },
        admin: {
          title: `📋 Rescisão CLT Homologada (${codigo})`,
          message: `Compensação TRCT de ${compTrct} aplicada para ${colabNome}.${rem > 0 ? ` Saldo remanescente: ${formatBrl(rem)}.` : ' Contrato quitado.'}`,
          targetUrl: '/credimpacto?tab=rescisao'
        }
      }
    }

    case 'cancelado_pelo_colaborador':
      return {
        admin: {
          title: `🚫 Solicitação Cancelada pelo Colaborador (${codigo})`,
          message: `${colabNome} cancelou a solicitação ${codigo} (${valorFmt}).${extra?.motivo ? ` Motivo: ${extra.motivo}` : ''}`,
          targetUrl: adminDashboardUrl
        }
      }

    case 'cancelado_pelo_admin':
      return {
        colaborador: {
          title: `🚫 Operação Cancelada (${codigo})`,
          message: `Olá, ${colabPrimeiroNome}. A operação ${codigo} foi cancelada pela administração.${extra?.motivo ? ` Motivo: ${extra.motivo}` : ''}`,
          targetUrl: colabUrl
        }
      }

    case 'chave_pix_atualizada': {
      const pix = extra?.chavePix || loan?.dadosBancarios?.chavePix || ''
      return {
        admin: {
          title: `🔑 Chave PIX Atualizada (${codigo})`,
          message: `${colabNome} cadastrou/atualizou a Chave PIX (${pix}) para liberação da operação ${codigo}.`,
          targetUrl: adminLiberacoesUrl
        }
      }
    }

    case 'aviso_personalizado':
      return {
        colaborador: {
          title: extra?.customTitle || `🔔 Aviso CredImpacto (${codigo})`,
          message:
            extra?.customMessage ||
            `Olá, ${colabPrimeiroNome}! Há uma nova atualização sobre sua operação ${codigo} (${valorFmt}) no portal CredImpacto.`,
          targetUrl: colabUrl
        },
        admin: {
          title: extra?.customTitle || `🔔 Aviso CredImpacto (${codigo})`,
          message:
            extra?.customMessage ||
            `Atualização referente à operação ${codigo} de ${colabNome} (${valorFmt}).`,
          targetUrl: adminDashboardUrl
        }
      }

    case 'teste_push':
      return {
        admin: {
          title: extra?.customTitle || `🔔 Teste de Push CredImpacto (Admin)`,
          message:
            extra?.customMessage ||
            `Notificação Push do módulo CredImpacto recebida com sucesso! Seu aparelho está pronto para receber alertas em tempo real.`,
          targetUrl: '/credimpacto?tab=dashboard'
        },
        colaborador: {
          title: extra?.customTitle || `🔔 Teste de Push CredImpacto`,
          message:
            extra?.customMessage ||
            `Notificação Push do módulo CredImpacto recebida com sucesso! Você receberá avisos sobre suas solicitações, aprovações e parcelas.`,
          targetUrl: '/credimpacto?tab=meus_emprestimos'
        }
      }
  }
}

/**
 * Verifica nas configurações do CredImpacto se o disparo automático está ativo para o evento
 */
function isEventEnabledInConfig(
  eventType: CredImpactoPushEventType,
  role: 'admin' | 'colaborador',
  pushConfig: CredImpactoPushConfig
): boolean {
  if (!pushConfig.habilitado) return false

  if (role === 'admin') {
    switch (eventType) {
      case 'solicitacao_nova':
      case 'concessao_escola':
        return pushConfig.notificarAdminNovaSolicitacao
      case 'simulacao_realizada':
        return pushConfig.notificarAdminSimulacao
      case 'contraproposta_aceita':
      case 'contraproposta_recusada':
        return pushConfig.notificarAdminContrapropostaRespondida
      case 'contrato_assinado':
      case 'aprovado_aguardando_liberacao':
      case 'recursos_liberados':
        return pushConfig.notificarAdminContratoAssinado
      case 'quitacao_solicitada':
      case 'quitacao_confirmada':
      case 'rescisao_homologada':
        return pushConfig.notificarAdminQuitacaoSolicitada
      case 'cancelado_pelo_colaborador':
        return pushConfig.notificarAdminCancelamentoColaborador
      case 'chave_pix_atualizada':
        return pushConfig.notificarAdminChavePixAtualizada
      default:
        return true
    }
  } else {
    switch (eventType) {
      case 'solicitacao_nova':
      case 'em_analise':
      case 'simulacao_realizada':
        return pushConfig.notificarColaboradorSolicitacaoRecebida
      case 'concessao_escola':
        return pushConfig.notificarColaboradorConcessao
      case 'aprovado_aguardando_assinatura':
      case 'aprovado_aguardando_liberacao':
      case 'aprovado_ativo':
        return pushConfig.notificarColaboradorAprovado
      case 'recusado':
        return pushConfig.notificarColaboradorRecusado
      case 'contraproposta_enviada':
      case 'contraproposta_aceita':
        return pushConfig.notificarColaboradorContraproposta
      case 'contrato_assinado':
        return pushConfig.notificarColaboradorAssinaturaConfirmada
      case 'recursos_liberados':
        return pushConfig.notificarColaboradorLiberado
      case 'parcela_conciliada':
      case 'lembrete_parcela':
        return pushConfig.notificarColaboradorParcelaBaixada
      case 'parcela_estornada':
        return pushConfig.notificarColaboradorParcelaEstornada
      case 'quitacao_solicitada':
      case 'quitacao_confirmada':
        return pushConfig.notificarColaboradorQuitacao
      case 'rescisao_homologada':
        return pushConfig.notificarColaboradorRescisao
      case 'cancelado_pelo_admin':
        return pushConfig.notificarColaboradorCancelado
      default:
        return true
    }
  }
}

export interface NotifyCredImpactoEventInput {
  eventType: CredImpactoPushEventType
  loan?: Partial<CredImpactoEmprestimo> | null
  targetRoles?: Array<'admin' | 'colaborador'>
  forceManual?: boolean
  sentByNome?: string
  extra?: Parameters<typeof buildCredImpactoPushTemplate>[2]
}

export interface NotifyCredImpactoEventResult {
  ok: boolean
  adminResult?: {
    sent: boolean
    devicesReached: number
    targetCount: number
    onesignalId?: string
    notificationId: string
  }
  colaboradorResult?: {
    sent: boolean
    devicesReached: number
    targetCount: number
    onesignalId?: string
    notificationId: string
  }
}

/**
 * Função principal para disparar Notificações Push no módulo CredImpacto
 * Envia simultaneamente via OneSignal, Realtime Banner e grava na Central de Notificações.
 */
export async function notifyCredImpactoEvent(
  input: NotifyCredImpactoEventInput
): Promise<NotifyCredImpactoEventResult> {
  const { eventType, loan, forceManual = false, sentByNome, extra } = input

  let pushConfig = DEFAULT_PUSH_CONFIG
  try {
    const cfg = await dbGetConfiguracao()
    if (cfg?.pushConfig) {
      pushConfig = { ...DEFAULT_PUSH_CONFIG, ...cfg.pushConfig }
    }
  } catch {}

  const templates = buildCredImpactoPushTemplate(eventType, loan, extra)
  const rolesToNotify = input.targetRoles || (['admin', 'colaborador'] as const)

  const result: NotifyCredImpactoEventResult = { ok: true }

  // 1. Disparo para COLABORADOR
  if (rolesToNotify.includes('colaborador') && templates.colaborador) {
    const allowed = forceManual || isEventEnabledInConfig(eventType, 'colaborador', pushConfig)
    if (allowed) {
      try {
        const colabTargets = await resolveColaboradorPushTargets({
          colaboradorId: loan?.colaboradorId,
          colaboradorEmail: loan?.colaboradorEmail,
          colaboradorCpf: loan?.colaboradorCpf,
          colaboradorNome: loan?.colaboradorNome
        })

        const notifId = `credimpacto_push_colab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const { title, message, targetUrl } = templates.colaborador

        let onesignalSuccess = false
        let onesignalId: string | undefined

        if (colabTargets.userIds.length > 0 || colabTargets.subscriptionIds.length > 0) {
          const pushRes = await sendPushNotification({
            targetUserIds: colabTargets.userIds,
            targetSubscriptionIds: colabTargets.subscriptionIds.length > 0 ? colabTargets.subscriptionIds : undefined,
            title,
            body: message,
            url: targetUrl,
            collapseId: `credimpacto_${eventType}_${loan?.id || Date.now()}`,
            data: {
              type: 'credimpacto',
              module: 'credimpacto',
              eventType,
              recipientRole: 'colaborador',
              itemId: loan?.id || notifId,
              emprestimoId: loan?.id || '',
              codigoOperacao: loan?.codigoOperacao || '',
              statusOperacao: loan?.status || 'simulacao',
              targetUrl
            }
          })
          onesignalSuccess = pushRes.success
          onesignalId = pushRes.notificationId

          await logCredImpactoPushDiagnostic({
            itemId: loan?.id || notifId,
            title,
            message,
            targetUserIds: colabTargets.userIds,
            status: pushRes.success ? 'sent' : 'failed',
            onesignalId: pushRes.notificationId,
            recipients: pushRes.recipients || colabTargets.deviceCount,
            errorDetails: pushRes.error,
            metadata: {
              eventType,
              recipientRole: 'colaborador',
              codigoOperacao: loan?.codigoOperacao,
              colaboradorNome: loan?.colaboradorNome
            }
          })
        }

        // Salvar na Central de Notificações In-App do CredImpacto
        const notifItem: CredImpactoNotificationItem = {
          id: notifId,
          eventType,
          recipientRole: 'colaborador',
          targetColaboradorId: loan?.colaboradorId,
          targetColaboradorCpf: loan?.colaboradorCpf,
          targetColaboradorEmail: loan?.colaboradorEmail,
          targetColaboradorNome: loan?.colaboradorNome,
          emprestimoId: loan?.id,
          codigoOperacao: loan?.codigoOperacao,
          statusOperacao: loan?.status || 'simulacao',
          title,
          message,
          targetUrl,
          createdAt: new Date().toISOString(),
          readByUserIds: [],
          sentByNome,
          onesignalSuccess,
          devicesReached: colabTargets.deviceCount
        }
        await dbRegistrarNotificacaoPush(notifItem)

        // Emitir Banner Realtime Imediato
        await broadcastCredImpactoPushBanner({
          id: notifId,
          eventType,
          recipientRole: 'colaborador',
          targetUserIds: colabTargets.userIds,
          targetColaboradorCpf: loan?.colaboradorCpf,
          targetColaboradorEmail: loan?.colaboradorEmail,
          emprestimoId: loan?.id,
          codigoOperacao: loan?.codigoOperacao,
          title,
          message,
          targetUrl
        })

        result.colaboradorResult = {
          sent: onesignalSuccess || colabTargets.userIds.length > 0,
          devicesReached: colabTargets.deviceCount,
          targetCount: colabTargets.userIds.length,
          onesignalId,
          notificationId: notifId
        }
      } catch (err) {
        console.error('[CredImpacto Push Colaborador Error]', err)
      }
    }
  }

  // 2. Disparo para ADMINISTRADORES / FINANCEIRO
  if (rolesToNotify.includes('admin') && templates.admin) {
    const allowed = forceManual || isEventEnabledInConfig(eventType, 'admin', pushConfig)
    if (allowed) {
      try {
        const adminTargets = await resolveCredImpactoAdminPushTargets()
        const notifId = `credimpacto_push_admin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const { title, message, targetUrl } = templates.admin

        let onesignalSuccess = false
        let onesignalId: string | undefined

        if (adminTargets.userIds.length > 0 || adminTargets.subscriptionIds.length > 0) {
          const pushRes = await sendPushNotification({
            targetUserIds: adminTargets.userIds,
            targetSubscriptionIds: adminTargets.subscriptionIds.length > 0 ? adminTargets.subscriptionIds : undefined,
            title,
            body: message,
            url: targetUrl,
            collapseId: `credimpacto_admin_${eventType}_${loan?.id || Date.now()}`,
            data: {
              type: 'credimpacto',
              module: 'credimpacto',
              eventType,
              recipientRole: 'admin',
              itemId: loan?.id || notifId,
              emprestimoId: loan?.id || '',
              codigoOperacao: loan?.codigoOperacao || '',
              statusOperacao: loan?.status || 'simulacao',
              targetUrl
            }
          })
          onesignalSuccess = pushRes.success
          onesignalId = pushRes.notificationId

          await logCredImpactoPushDiagnostic({
            itemId: loan?.id || notifId,
            title,
            message,
            targetUserIds: adminTargets.userIds,
            status: pushRes.success ? 'sent' : 'failed',
            onesignalId: pushRes.notificationId,
            recipients: pushRes.recipients || adminTargets.deviceCount,
            errorDetails: pushRes.error,
            metadata: {
              eventType,
              recipientRole: 'admin',
              codigoOperacao: loan?.codigoOperacao,
              colaboradorNome: loan?.colaboradorNome
            }
          })
        }

        const notifItem: CredImpactoNotificationItem = {
          id: notifId,
          eventType,
          recipientRole: 'admin',
          targetColaboradorId: loan?.colaboradorId,
          targetColaboradorCpf: loan?.colaboradorCpf,
          targetColaboradorEmail: loan?.colaboradorEmail,
          targetColaboradorNome: loan?.colaboradorNome,
          emprestimoId: loan?.id,
          codigoOperacao: loan?.codigoOperacao,
          statusOperacao: loan?.status || 'simulacao',
          title,
          message,
          targetUrl,
          createdAt: new Date().toISOString(),
          readByUserIds: [],
          sentByNome,
          onesignalSuccess,
          devicesReached: adminTargets.deviceCount
        }
        await dbRegistrarNotificacaoPush(notifItem)

        await broadcastCredImpactoPushBanner({
          id: notifId,
          eventType,
          recipientRole: 'admin',
          targetUserIds: adminTargets.userIds,
          emprestimoId: loan?.id,
          codigoOperacao: loan?.codigoOperacao,
          title,
          message,
          targetUrl
        })

        result.adminResult = {
          sent: onesignalSuccess || adminTargets.userIds.length > 0,
          devicesReached: adminTargets.deviceCount,
          targetCount: adminTargets.userIds.length,
          onesignalId,
          notificationId: notifId
        }
      } catch (err) {
        console.error('[CredImpacto Push Admin Error]', err)
      }
    }
  }

  return result
}
