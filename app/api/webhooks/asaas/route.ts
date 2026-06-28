import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // O Asaas envia os eventos dentro de body.event e os dados em body.payment
    const eventType = body.event
    const payment = body.payment

    if (!eventType || !payment) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const asaasPaymentId = payment.id
    const externalReference = payment.externalReference // Nosso cobranca_destinatario_id

    let newStatus = null

    switch (eventType) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        newStatus = 'RECEIVED'
        break
      case 'PAYMENT_OVERDUE':
        newStatus = 'OVERDUE'
        break
      case 'PAYMENT_DELETED':
        newStatus = 'CANCELLED'
        break
      default:
        // Ignora outros eventos (PAYMENT_CREATED, etc)
        return NextResponse.json({ success: true, message: 'Evento ignorado' })
    }

    if (newStatus) {
      // Atualizar o banco de dados
      const { error } = await supabase
        .from('agenda_cobrancas_destinatarios')
        .update({ status: newStatus })
        .eq('asaas_payment_id', asaasPaymentId)

      if (error) {
        console.error('Webhook: Erro ao atualizar Supabase:', error)
        return NextResponse.json({ error: 'Erro no BD' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Webhook Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
