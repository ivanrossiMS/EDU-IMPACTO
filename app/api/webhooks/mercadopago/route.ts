import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'

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

    if (!paymentId) {
      return NextResponse.json({ success: true, message: 'No payment ID found' })
    }

    // 1. Consultar a API do Mercado Pago para ver o status real desse pagamento
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
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
    if (status === 'approved') {
      novoStatus = 'RECEIVED'
    } else if (status === 'rejected' || status === 'cancelled') {
      novoStatus = 'OVERDUE' // Ou algum status de erro/cancelado
    }

    // 2. Atualizar no banco de dados
    const { error: errUpdate } = await supabase
      .from('agenda_cobrancas_destinatarios')
      .update({ 
        status: novoStatus,
        // Também salvamos o ID do pagamento final (já que a geração salvou o ID da "Preference")
        asaas_payment_id: paymentId 
      })
      .eq('id', externalReference)

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
