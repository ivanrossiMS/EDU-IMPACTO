import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'
import {
  dbGetEmprestimoById,
  dbListarNotificacoesPush,
  dbMarcarNotificacoesLidas
} from '@/lib/credimpacto/db'
import {
  fetchUserOneSignalSubscriptions,
  notifyCredImpactoEvent,
  resolveColaboradorPushTargets,
  buildCredImpactoPushTemplate
} from '@/lib/credimpacto/pushNotifications'
import { CredImpactoPushEventType } from '@/types/credimpacto'

export const dynamic = 'force-dynamic'

function cleanCpf(cpf?: string | null): string {
  return String(cpf || '').replace(/\D/g, '')
}

export async function GET(request: Request) {
  const { user: authUser, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const user = await resolveCredImpactoUser(authUser)
    const userColabId = user.funcionarioId || user.systemUserId || user.id
    const url = new URL(request.url)
    const viewMode = url.searchParams.get('viewMode') || (user.isAdminOrFinance ? 'admin' : 'colaborador')
    const checkLoanId = url.searchParams.get('loanId')
    const checkColabId = url.searchParams.get('colaboradorId')
    const checkColabCpf = url.searchParams.get('colaboradorCpf')
    const checkColabEmail = url.searchParams.get('colaboradorEmail')
    const checkDevices = url.searchParams.get('checkDevices') === '1'

    const allNotificacoes = await dbListarNotificacoesPush()

    const userIdentifiers = [
      user.id,
      user.systemUserId,
      user.funcionarioId,
      user.email?.toLowerCase().trim(),
      cleanCpf(user.cpf)
    ].filter(Boolean) as string[]

    const userCleanCpf = cleanCpf(user.cpf)
    const userEmail = (user.email || '').toLowerCase().trim()

    // Filtra notificações relevantes para o usuário atual e modo de visão
    const filteredNotificacoes = allNotificacoes.filter((n) => {
      if (user.isAdminOrFinance && viewMode === 'admin') {
        // No modo Admin, mostra alertas destinados ao Admin e também histórico de envios aos colaboradores
        return true
      }

      // No modo Colaborador, mostra apenas notificações destinadas a este colaborador
      if (n.recipientRole !== 'colaborador' && n.recipientRole !== 'ambos') {
        return false
      }

      const nColabId = String(n.targetColaboradorId || '').trim()
      const nColabEmail = String(n.targetColaboradorEmail || '').toLowerCase().trim()
      const nColabCpf = cleanCpf(n.targetColaboradorCpf)

      if (nColabId && (nColabId === user.id || nColabId === user.systemUserId || nColabId === user.funcionarioId)) return true
      if (nColabEmail && userEmail && nColabEmail === userEmail) return true
      if (nColabCpf && userCleanCpf && nColabCpf.length === 11 && nColabCpf === userCleanCpf) return true

      return false
    })

    // Contagem de não lidas (para o modo atual: se admin, conta as não lidas destinadas a admin)
    const unreadNotificacoes = filteredNotificacoes.filter((n) => {
      if (user.isAdminOrFinance && viewMode === 'admin' && n.recipientRole === 'colaborador') {
        return false
      }
      const reads = Array.isArray(n.readByUserIds) ? n.readByUserIds : []
      return !userIdentifiers.some((uid) => reads.includes(uid))
    })

    // Opcionalmente consulta status de dispositivos OneSignal se solicitado
    let myDeviceStatus: {
      hasActiveDevice: boolean
      deviceCount: number
      devices: Array<{ id: string; type: string }>
    } | null = null

    let colaboradorDeviceStatus: {
      hasActiveDevice: boolean
      deviceCount: number
      devices: Array<{ id: string; type: string }>
      targetCount: number
    } | null = null

    if (checkDevices) {
      const mySubs = await fetchUserOneSignalSubscriptions(
        [user.id, user.systemUserId, user.funcionarioId, user.email].filter(Boolean) as string[]
      )
      myDeviceStatus = {
        hasActiveDevice: mySubs.length > 0,
        deviceCount: mySubs.length,
        devices: mySubs.map((s) => ({ id: s.id, type: s.type }))
      }
    }

    if (checkLoanId || checkColabId || checkColabCpf || checkColabEmail) {
      let targetColab = {
        colaboradorId: checkColabId,
        colaboradorCpf: checkColabCpf,
        colaboradorEmail: checkColabEmail,
        colaboradorNome: ''
      }

      if (checkLoanId) {
        const loan = await dbGetEmprestimoById(checkLoanId)
        if (loan) {
          targetColab = {
            colaboradorId: loan.colaboradorId,
            colaboradorCpf: loan.colaboradorCpf,
            colaboradorEmail: loan.colaboradorEmail || '',
            colaboradorNome: loan.colaboradorNome
          }
        }
      }

      const resolved = await resolveColaboradorPushTargets(targetColab)
      colaboradorDeviceStatus = {
        hasActiveDevice: resolved.deviceCount > 0,
        deviceCount: resolved.deviceCount,
        devices: resolved.subscriptionIds.map((id) => ({ id, type: 'Push' })),
        targetCount: resolved.userIds.length
      }
    }

    return NextResponse.json({
      ok: true,
      notificacoes: filteredNotificacoes.slice(0, 60),
      unreadCount: unreadNotificacoes.length,
      myDeviceStatus,
      colaboradorDeviceStatus
    })
  } catch (err: any) {
    console.error('[API CredImpacto Push GET]', err)
    return NextResponse.json({ error: err.message || 'Erro ao buscar notificações' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user: authUser, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const user = await resolveCredImpactoUser(authUser)
    const userColabId = user.funcionarioId || user.systemUserId || user.id
    const body = await request.json()
    const { acao } = body

    const userIdentifiers = [
      user.id,
      user.systemUserId,
      user.funcionarioId,
      user.email?.toLowerCase().trim(),
      cleanCpf(user.cpf)
    ].filter(Boolean) as string[]

    // 1. MARCAR NOTIFICAÇÕES COMO LIDAS
    if (acao === 'marcar_lida' || acao === 'marcar_todas_lidas') {
      const ids = Array.isArray(body.notificationIds)
        ? body.notificationIds
        : body.notificationId
        ? [body.notificationId]
        : undefined
      const count = await dbMarcarNotificacoesLidas(
        userIdentifiers,
        acao === 'marcar_todas_lidas' ? undefined : ids
      )
      return NextResponse.json({ ok: true, markedCount: count })
    }

    // 2. TESTE DE NOTIFICAÇÃO PUSH (PARA O PRÓPRIO USUÁRIO OU ADMINS)
    if (acao === 'testar') {
      const targetRole: 'admin' | 'colaborador' =
        body.targetRole || (user.isAdminOrFinance ? 'admin' : 'colaborador')

      const res = await notifyCredImpactoEvent({
        eventType: 'teste_push',
        loan: {
          id: '',
          codigoOperacao: 'TESTE-PUSH',
          colaboradorId: userColabId,
          colaboradorNome: user.nome,
          colaboradorCpf: user.cpf,
          colaboradorEmail: user.email
        },
        targetRoles: [targetRole],
        forceManual: true,
        sentByNome: user.nome,
        extra: {
          customTitle: `🔔 Teste de Push CredImpacto (${user.nome.split(' ')[0]})`,
          customMessage: `Notificação Push recebida com sucesso! Seu aparelho está pronto para receber alertas do módulo CredImpacto em tempo real.`
        }
      })

      const detail = targetRole === 'admin' ? res.adminResult : res.colaboradorResult
      return NextResponse.json({
        ok: true,
        result: res,
        devicesReached: detail?.devicesReached ?? 0,
        sent: detail?.sent ?? true
      })
    }

    // 3. NOTIFICAR SIMULAÇÃO (COLABORADOR OU ADMIN)
    if (acao === 'notificar_simulacao') {
      const valor = Number(body.valor || 0)
      const parcelas = Number(body.parcelas || 1)
      const valorParcela = Number(body.valorParcela || (parcelas > 0 ? valor / parcelas : valor))
      const targetRoles: Array<'admin' | 'colaborador'> = Array.isArray(body.targetRoles)
        ? body.targetRoles
        : ['admin', 'colaborador']

      const res = await notifyCredImpactoEvent({
        eventType: 'simulacao_realizada',
        loan: {
          id: '',
          codigoOperacao: 'SIMULAÇÃO',
          colaboradorId: body.colaboradorId || userColabId,
          colaboradorNome: body.colaboradorNome || user.nome,
          colaboradorCpf: body.colaboradorCpf || user.cpf,
          colaboradorEmail: body.colaboradorEmail || user.email,
          valorSolicitado: valor,
          quantidadeParcelas: parcelas
        },
        targetRoles,
        forceManual: Boolean(body.forceManual),
        sentByNome: user.nome,
        extra: {
          valor,
          parcelas,
          valorParcela
        }
      })

      return NextResponse.json({ ok: true, result: res })
    }

    // 4. COLABORADOR SOLICITA QUITAÇÃO ANTECIPADA AO FINANCEIRO
    if (acao === 'solicitar_quitacao') {
      const { emprestimoId, valorQuitacao, economiaQuitacao } = body
      if (!emprestimoId) {
        return NextResponse.json({ error: 'emprestimoId é obrigatório' }, { status: 400 })
      }
      const loan = await dbGetEmprestimoById(emprestimoId)
      if (!loan) {
        return NextResponse.json({ error: 'Operação não encontrada' }, { status: 404 })
      }

      const res = await notifyCredImpactoEvent({
        eventType: 'quitacao_solicitada',
        loan,
        targetRoles: ['admin', 'colaborador'],
        forceManual: true,
        sentByNome: user.nome,
        extra: {
          valorQuitacao: Number(valorQuitacao || loan.saldoDevedorAtual),
          economiaQuitacao: Number(economiaQuitacao || 0)
        }
      })

      return NextResponse.json({ ok: true, result: res })
    }

    // 5. DISPARO / REENVIO MANUAL DE PUSH PARA UMA OPERAÇÃO (EXCLUSIVO ADMIN/FINANCEIRO)
    if (acao === 'notificar_operacao') {
      if (!user.isAdminOrFinance) {
        return NextResponse.json(
          { error: 'Apenas administradores podem disparar notificações manuais para operações.' },
          { status: 403 }
        )
      }

      const {
        emprestimoId,
        eventType = 'aviso_personalizado',
        targetRole = 'colaborador',
        customTitle,
        customMessage
      } = body

      if (!emprestimoId) {
        return NextResponse.json({ error: 'ID do empréstimo é obrigatório' }, { status: 400 })
      }

      const loan = await dbGetEmprestimoById(emprestimoId)
      if (!loan) {
        return NextResponse.json({ error: 'Operação não encontrada' }, { status: 404 })
      }

      const roles: Array<'admin' | 'colaborador'> =
        targetRole === 'ambos' ? ['colaborador', 'admin'] : [targetRole]

      // Se o admin editou o título/mensagem manualmente, usamos 'aviso_personalizado' ou repassamos via extra
      const templates = buildCredImpactoPushTemplate(eventType as CredImpactoPushEventType, loan)
      const defaultColabTpl = templates.colaborador

      const isCustomized =
        Boolean(customTitle && defaultColabTpl && customTitle.trim() !== defaultColabTpl.title.trim()) ||
        Boolean(customMessage && defaultColabTpl && customMessage.trim() !== defaultColabTpl.message.trim())

      const effectiveEventType: CredImpactoPushEventType = isCustomized
        ? 'aviso_personalizado'
        : (eventType as CredImpactoPushEventType)

      const res = await notifyCredImpactoEvent({
        eventType: effectiveEventType,
        loan,
        targetRoles: roles,
        forceManual: true,
        sentByNome: user.nome,
        extra: {
          customTitle: customTitle?.trim() || defaultColabTpl?.title,
          customMessage: customMessage?.trim() || defaultColabTpl?.message
        }
      })

      return NextResponse.json({
        ok: true,
        result: res,
        devicesReached: res.colaboradorResult?.devicesReached ?? 0
      })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (err: any) {
    console.error('[API CredImpacto Push POST]', err)
    return NextResponse.json({ error: err.message || 'Erro ao enviar notificação push' }, { status: 500 })
  }
}
