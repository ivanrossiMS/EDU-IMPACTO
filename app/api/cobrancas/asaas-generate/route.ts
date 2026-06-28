import { NextResponse } from 'next/server'
import { asaasRequest } from '@/lib/asaas'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/server/authGuard'

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body = await request.json()
    const { cobranca_destinatario_id, cobranca_id, cpf, payment_method } = body

    if (!cobranca_destinatario_id || !cobranca_id || !cpf) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 })
    }

    const nome = user.user_metadata?.name || user.email?.split('@')[0] || 'Cliente'
    const email = user.email || 'email@naocadastrado.com'
    const billingType = payment_method || 'UNDEFINED'

    // 1. Buscar dados da cobrança original no Supabase
    const { data: cobranca, error: errCob } = await supabase
      .from('agenda_cobrancas')
      .select('*')
      .eq('id', cobranca_id)
      .single()

    if (errCob || !cobranca) {
      return NextResponse.json({ error: 'Cobrança não encontrada no banco de dados' }, { status: 404 })
    }

    // 3. Buscar ou criar o cliente no Asaas
    let asaasCustomerId = '';
    
    // Primeiro, busca se o cliente já existe pelo CPF
    const existingCustomers = await asaasRequest(`/customers?cpfCnpj=${cpf}`, 'GET');
    
    if (existingCustomers && existingCustomers.data && existingCustomers.data.length > 0) {
      asaasCustomerId = existingCustomers.data[0].id;
    } else {
      // Se não existe, cria um novo
      const newCustomer = await asaasRequest('/customers', 'POST', {
        name: nome,
        cpfCnpj: cpf,
        email: email
      });
      asaasCustomerId = newCustomer.id;
    }

    // 4. Criar a cobrança no Asaas
    // billingType 'UNDEFINED' permite o cliente escolher na fatura do Asaas
    const payload = {
      customer: asaasCustomerId,
      billingType: billingType,
      value: cobranca.valor,
      dueDate: cobranca.vencimento,
      description: cobranca.titulo,
      externalReference: cobranca_destinatario_id, // Usamos isso para conciliar depois
    }

    const charge = await asaasRequest('/payments', 'POST', payload)

    // 5. Salvar os IDs no Supabase
    const { error: errUpdate } = await supabase
      .from('agenda_cobrancas_destinatarios')
      .update({
        asaas_customer_id: asaasCustomerId,
        asaas_payment_id: charge.id,
        url_pagamento: charge.invoiceUrl,
        pagador_usuario_id: user.id,
        pagador_usuario_nome: nome
      })
      .eq('id', cobranca_destinatario_id)

    if (errUpdate) {
      console.error('Erro ao salvar no Supabase:', errUpdate)
      return NextResponse.json({ error: 'Cobrança gerada, mas erro ao salvar no Supabase' }, { status: 500 })
    }

    // Se for PIX, já podemos devolver o Copia e Cola / QR Code para facilitar
    let pixData = null
    if (payment_method === 'PIX') {
      pixData = await asaasRequest(`/payments/${charge.id}/pixQrCode`)
    }

    return NextResponse.json({ 
      success: true, 
      invoiceUrl: charge.invoiceUrl,
      pix: pixData
    })

  } catch (error: any) {
    console.error('Asaas API Route Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
