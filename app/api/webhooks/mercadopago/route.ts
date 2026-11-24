import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { extractMercadoPagoPaidAt } from '@/lib/server/mercadopagoSync'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    
    // O Mercado Pago envia o ID de várias formas dependendo da versão
    // As mais comuns são na query string (?data.id=123) ou no body
    let paymentId = url.searchParams.get('data.id') || url.searchParams.get('id')
    let type = url.searchParams.get('type')
    let topic = url.searchParams.get('topic')

    const body = await request.json().catch(() => ({}))
    
    // Ou no body
    if (!paymentId && body.data && body.data.id) {
      paymentId = body.data.id
    }
    if (!type && body.type) {
      type = body.type
    }
    if (!topic && body.topic) {
      topic = body.topic
    }
    
    // Ignora eventos que não sejam de pagamento
    if (type !== 'payment' && topic !== 'payment') {
      return NextResponse.json({ success: true, message: 'Ignored non-payment event' })
    }

    if (!paymentId || !/^[0-9a-zA-Z_-]+$/.test(String(paymentId))) {
      return NextResponse.json({ success: true, message: 'No valid payment ID found' })
    }

    // 1. Consultar a API do Mercado Pago para ver o status real desse pagamento
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
      }
    })

    if (!mpResponse.ok) {
      return NextResponse.json({ error: 'Falha ao buscar pagamento no Mercado Pago' }, { status: 404 })
    }

    const paymentData = await mpResponse.json()
    const externalReference = paymentData.external_reference // Esse é o nosso cobranca_destinatario_id
    const status = paymentData.status // 'approved', 'pending', 'rejected', etc

    if (!externalReference) {
      return NextResponse.json({ success: true, message: 'Payment has no external_reference' })
    }

    let novoStatus = 'PENDING'
    let paidAtIso: string | null = null
    let existingDestinatario: any = null

    if (status === 'approved') {
      const { data: destinatario } = await supabase
        .from('agenda_cobrancas_destinatarios')
        .select('*')
        .eq('id', externalReference)
        .maybeSingle()

      if (!destinatario) {
        return NextResponse.json({ error: 'Destinatário não encontrado' }, { status: 404 })
      }
      existingDestinatario = destinatario

      const { data: cobranca } = await supabase
        .from('agenda_cobrancas')
        .select('id, valor')
        .eq('id', destinatario.cobranca_id)
        .maybeSingle()

      if (!cobranca) {
        return NextResponse.json({ error: 'Cobrança vinculada não encontrada' }, { status: 404 })
      }

      const isAmountValid = Number(paymentData.transaction_amount) >= Number(cobranca.valor) - 0.05
      if (!isAmountValid) {
        console.error('[MercadoPago Webhook] Valor pago divergente do valor da cobrança:', {
          transaction_amount: paymentData.transaction_amount,
          cobranca_valor: cobranca.valor,
          externalReference,
        })
        return NextResponse.json({ error: 'Valor pago inferior ao valor da cobrança' }, { status: 400 })
      }

      novoStatus = 'RECEIVED'
      paidAtIso = extractMercadoPagoPaidAt(paymentData) || new Date().toISOString()
    } else if (status === 'rejected' || status === 'cancelled') {
      novoStatus = 'OVERDUE'
    }

    const basePayload: Record<string, any> = {
      status: novoStatus,
      // Também salvamos o ID do pagamento final (já que a geração salvou o ID da "Preference")
      asaas_payment_id: String(paymentId)
    }

    if (novoStatus === 'RECEIVED' && existingDestinatario && !existingDestinatario.pagador_usuario_nome) {
      const payerFullName = [paymentData?.payer?.first_name, paymentData?.payer?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim()
      if (payerFullName) {
        basePayload.pagador_usuario_nome = payerFullName
      }
    }

    const extendedPayload: Record<string, any> = {
      ...basePayload,
      updated_at: new Date().toISOString()
    }
    if (novoStatus === 'RECEIVED' && paidAtIso) {
      extendedPayload.paid_at = existingDestinatario?.paid_at || paidAtIso
    }

    const applyUpdate = async (payload: Record<string, any>) => {
      let query = supabase
        .from('agenda_cobrancas_destinatarios')
        .update(payload)
        .eq('id', externalReference)

      if (novoStatus !== 'RECEIVED') {
        query = query
          .neq('status', 'RECEIVED')
          .neq('status', 'CONFIRMED')
          .neq('status', 'PAID')
          .neq('status', 'PAGO')
      }
      return query
    }

    let { error: errUpdate } = await applyUpdate(extendedPayload)

    // Resiliência caso a coluna paid_at/updated_at ainda não tenha sido aplicada no schema cache
    if (errUpdate && (errUpdate.message?.includes('paid_at') || errUpdate.message?.includes('updated_at') || errUpdate.code === 'PGRST204')) {
      console.warn('Aviso no webhook Mercado Pago (schema sem paid_at/updated_at), aplicando fallback:', errUpdate.message)
      const fallbackRes = await applyUpdate(basePayload)
      errUpdate = fallbackRes.error
    }

    if (errUpdate) {
      console.error('Erro ao atualizar Supabase pelo Webhook:', errUpdate)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('MercadoPago Webhook Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
