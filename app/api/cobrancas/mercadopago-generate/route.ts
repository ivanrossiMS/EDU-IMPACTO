import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/server/authGuard'

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body = await request.json()
    const { cobranca_destinatario_id, cobranca_id } = body

    if (!cobranca_destinatario_id || !cobranca_id) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 })
    }

    const nome = user.user_metadata?.name || user.email?.split('@')[0] || 'Cliente'
    const email = user.email || 'email@naocadastrado.com'

    // 1. Buscar dados da cobrança original no Supabase
    const { data: cobranca, error: errCob } = await supabase
      .from('agenda_cobrancas')
      .select('*')
      .eq('id', cobranca_id)
      .single()

    if (errCob || !cobranca) {
      return NextResponse.json({ error: 'Cobrança não encontrada no banco de dados' }, { status: 404 })
    }

    // 2. Criar a Preferência no Mercado Pago (Checkout Pro)
    const expirationDate = new Date(cobranca.vencimento);
    expirationDate.setDate(expirationDate.getDate() + 5); // Adiciona 5 dias de tolerância após vencimento

    const mpPayload = {
      items: [
        {
          title: cobranca.titulo,
          quantity: 1,
          unit_price: Number(cobranca.valor),
          currency_id: 'BRL',
          description: `Cobrança via Edu Impacto - ${cobranca.titulo}`
        }
      ],
      payer: {
        email: email,
        name: nome
      },
      external_reference: cobranca_destinatario_id, // Usamos para linkar no Webhook
      statement_descriptor: 'EDU IMPACTO',
      notification_url: 'https://resilient-cuchufli-2b4125.netlify.app/api/webhooks/mercadopago',
      expires: true,
      expiration_date_to: expirationDate.toISOString()
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mpPayload)
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Erro no Mercado Pago:', mpData);
      return NextResponse.json({ error: 'Falha ao criar cobrança no Mercado Pago' }, { status: 500 });
    }

    // 3. Salvar os IDs no Supabase (Reaproveitando colunas antigas para evitar migrations)
    const { error: errUpdate } = await supabase
      .from('agenda_cobrancas_destinatarios')
      .update({
        asaas_customer_id: mpData.client_id || 'MP_CLIENT', // Apenas para preencher algo
        asaas_payment_id: mpData.id, // ID da preference no MP
        url_pagamento: mpData.init_point, // Link de pagamento real
        pagador_usuario_id: user.id,
        pagador_usuario_nome: nome
      })
      .eq('id', cobranca_destinatario_id)

    if (errUpdate) {
      console.error('Erro ao salvar no Supabase:', errUpdate)
      return NextResponse.json({ error: 'Cobrança gerada, mas erro ao salvar no Supabase' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      invoiceUrl: mpData.init_point, // O frontend já espera "invoiceUrl"
      pix: null // MP Checkout Pro gerencia o Pix internamente na tela deles
    })

  } catch (error: any) {
    console.error('MercadoPago API Route Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
