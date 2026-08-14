/**
 * app/api/webhooks/isaac/route.ts
 *
 * Endpoint Receptor de Webhooks do Isaac Escola.
 * Notifica atualizações de parcelas e pagamentos em tempo real.
 *
 * Eventos recebidos:
 *  - "consolidated-installment.updated"
 *
 * Configuração no Isaac:
 *  - URL: https://seu-dominio.com.br/api/webhooks/isaac
 *  - Método: POST
 */

import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { isaacRequest, formatIsaacAmount, getEffectiveAmount } from '@/lib/isaac'

export const dynamic = 'force-dynamic'

// Health check para testes e validação da URL pelo time do Isaac
export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'Isaac Escola Webhook Receiver',
    endpoint: '/api/webhooks/isaac',
    timestamp: new Date().toISOString(),
    supportedEvents: ['consolidated-installment.updated'],
  })
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    let body: any = {}

    try {
      body = JSON.parse(rawBody)
    } catch {
      console.warn('[Isaac Webhook] Payload JSON inválido recebido:', rawBody)
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 })
    }

    console.log('[Isaac Webhook] Evento recebido:', {
      id: body.id,
      event: body.event,
      object: body.object,
      createdAt: body.created_at,
    })

    // 1. Identificar o ID da parcela consolidada
    const eventType = body.event || 'consolidated-installment.updated'
    const installmentId =
      body.data?.id ||
      body.object_id ||
      body.id ||
      body.object?.id

    if (!installmentId) {
      console.warn('[Isaac Webhook] Nenhum installmentId identificado no payload:', body)
      return NextResponse.json({ success: true, message: 'Nenhum ID de parcela fornecido' })
    }

    // 2. Buscar o status atualizado da parcela na API do Isaac
    let installmentData: any = null
    try {
      const resp = await isaacRequest<any>(`/consolidated-installments/${installmentId}`)
      installmentData = resp?.data || resp
    } catch (err: any) {
      console.error(`[Isaac Webhook] Erro ao consultar parcela ${installmentId} no Isaac:`, err.message)
    }

    const status = installmentData?.status || body.data?.status
    const studentExternalId = installmentData?.student?.external_id || body.data?.student?.external_id
    const studentName = installmentData?.student?.name || body.data?.student?.name || 'Aluno'
    const guardianName = installmentData?.guardian?.name || body.data?.guardian?.name || 'Responsável'
    const descricao = installmentData?.description || body.data?.description || 'Mensalidade Escolar'
    const paidValue = installmentData?.paid_value || body.data?.paid_value || 0

    console.log(`[Isaac Webhook] Parcela ${installmentId}: Status=${status} | Aluno=${studentName} (${studentExternalId})`)

    // 3. Registrar o evento em system_logs para auditoria da secretaria/financeiro
    try {
      await supabase.from('system_logs').insert({
        data_hora: new Date().toISOString(),
        usuario_nome: 'Sistema (Isaac Webhook)',
        perfil: 'Sistema',
        modulo: 'Financeiro',
        acao: status === 'PAID' ? 'Baixa de Pagamento Isaac' : 'Atualização de Fatura Isaac',
        detalhes: JSON.stringify({
          evento: eventType,
          installmentId,
          status,
          descricao,
          aluno: studentName,
          alunoId: studentExternalId,
          responsavel: guardianName,
          valorPago: paidValue ? formatIsaacAmount(paidValue) : undefined,
          pagoEm: installmentData?.paid_date || new Date().toISOString(),
        }),
      })
    } catch (logErr: any) {
      console.warn('[Isaac Webhook] Falha ao registrar log no Supabase:', logErr.message)
    }

    // 4. Se a parcela foi paga e o aluno estava marcado como inadimplente, verificar se regularizou
    if (status === 'PAID' && studentExternalId) {
      try {
        const { data: alunoRow } = await supabase
          .from('alunos')
          .select('id, nome, inadimplente')
          .eq('id', studentExternalId)
          .maybeSingle()

        if (alunoRow && alunoRow.inadimplente) {
          console.log(`[Isaac Webhook] Aluno ${studentExternalId} recebeu pagamento de parcela. Verificando pendências...`)
          // Se necessário, pode atualizar status de inadimplência
        }
      } catch (alunoErr: any) {
        console.warn('[Isaac Webhook] Erro ao consultar/atualizar aluno:', alunoErr.message)
      }
    }

    // 5. Retornar 200 OK com sucesso para confirmar recebimento ao Isaac
    return NextResponse.json({
      success: true,
      received: true,
      event: eventType,
      installmentId,
      status,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Isaac Webhook Fatal Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
