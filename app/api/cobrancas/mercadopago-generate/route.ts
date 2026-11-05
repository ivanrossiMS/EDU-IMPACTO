import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { resolveUserRole, getAuthorizedAlunoIdsForUser } from '@/lib/server/authGuard'

export async function POST(request: Request) {
  try {
    const { user, dbUser, isFamilyOrStudent, errorResponse } = await resolveUserRole(request)
    if (errorResponse || !user) return errorResponse!

    const body = await request.json()
    const { cobranca_destinatario_id, cobranca_id } = body

    if (!cobranca_destinatario_id || !cobranca_id) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 })
    }

    // Busca destinatário e valida vínculo com cobranca_id para impedir manipulação de preço
    // Nota: na tabela agenda_cobrancas_destinatarios a coluna real do aluno é destinatario_id
    let { data: existingDest } = await supabase
      .from('agenda_cobrancas_destinatarios')
      .select('*')
      .eq('id', cobranca_destinatario_id)
      .maybeSingle()

    if (!existingDest && (body.destinatario_id || body.aluno_id)) {
      const cleanDestId = String(body.destinatario_id || body.aluno_id).replace(/^(a_|_ALU)/, '').trim()
      if (cleanDestId) {
        const { data: fallbackDest } = await supabase
          .from('agenda_cobrancas_destinatarios')
          .select('*')
          .eq('cobranca_id', cobranca_id)
          .in('destinatario_id', [cleanDestId, `a_${cleanDestId}`, `_ALU${cleanDestId}`])
          .limit(1)
          .maybeSingle()
        if (fallbackDest) {
          existingDest = fallbackDest
        }
      }
    }

    if (!existingDest || String(existingDest.cobranca_id) !== String(cobranca_id)) {
      return NextResponse.json(
        { error: 'Destinatário inválido ou não vinculado à cobrança informada' },
        { status: 400 }
      )
    }

    if (existingDest.status === 'RECEIVED' || existingDest.status === 'CONFIRMED' || existingDest.status === 'pago') {
      if (existingDest.url_pagamento) {
        return NextResponse.json({
          success: true,
          invoiceUrl: existingDest.url_pagamento,
          pix: null
        })
      }
      return NextResponse.json({ error: 'Esta cobrança já se encontra quitada' }, { status: 400 })
    }

    const rawTargetAlunoId = String(existingDest.destinatario_id || existingDest.aluno_id || '').trim()
    const cleanTargetAlunoId = rawTargetAlunoId.replace(/^(a_|_ALU)/, '').trim()

    if (isFamilyOrStudent && cleanTargetAlunoId) {
      const authorizedAlunoIds = await getAuthorizedAlunoIdsForUser(user)
      const normalizedAuthorizedIds = new Set(
        Array.from(authorizedAlunoIds).map(id => String(id).replace(/^(a_|_ALU)/, '').trim())
      )

      const userEmail = (user.email || '').trim().toLowerCase()
      const metaAlunoId = String(user.user_metadata?.aluno_id || user.user_metadata?.alunoId || '').replace(/^(a_|_ALU)/, '').trim()
      const metaAlunosIds: string[] = Array.isArray(user.user_metadata?.alunos_ids)
        ? user.user_metadata.alunos_ids.map((id: any) => String(id).replace(/^(a_|_ALU)/, '').trim())
        : []

      let hasAccess =
        normalizedAuthorizedIds.has(cleanTargetAlunoId) ||
        metaAlunoId === cleanTargetAlunoId ||
        metaAlunosIds.includes(cleanTargetAlunoId) ||
        Boolean(existingDest.pagador_usuario_id && String(existingDest.pagador_usuario_id) === String(user.id))

      if (!hasAccess && userEmail) {
        const lookupIds = Array.from(new Set([cleanTargetAlunoId, rawTargetAlunoId].filter(Boolean)))
        const { data: alunoRow } = await supabase
          .from('alunos')
          .select('id, email, dados')
          .in('id', lookupIds)
          .limit(1)
          .maybeSingle()

        if (alunoRow) {
          const d = alunoRow.dados || {}
          const emailsVinculados = [
            alunoRow.email,
            d.email,
            d.emailAluno,
            d.emailResponsavel,
            d.responsavel_email,
            d.responsavelEmail,
            d.mae_email,
            d.pai_email,
          ]
            .filter(Boolean)
            .map((e: string) => String(e).trim().toLowerCase())

          if (emailsVinculados.includes(userEmail)) {
            hasAccess = true
          }
        }
      }

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Acesso negado: você não possui vínculo com o aluno destinatário desta cobrança.' },
          { status: 403 }
        )
      }
    }

    // IDEMPOTÊNCIA: Verifica se já existe preferência de pagamento gerada para este destinatário
    if (existingDest.url_pagamento && existingDest.status !== 'RECEIVED' && existingDest.status !== 'pago') {
      return NextResponse.json({ 
        success: true, 
        invoiceUrl: existingDest.url_pagamento,
        pix: null
      })
    }

    const isGeneratedByAdmin = Boolean(body.from_admin) && !isFamilyOrStudent
    const resolvedUserName =
      dbUser?.nome ||
      user.user_metadata?.nome ||
      user.user_metadata?.name ||
      existingDest.destinatario_nome ||
      user.email?.split('@')[0] ||
      'Cliente'
    const nome = isGeneratedByAdmin
      ? (existingDest.destinatario_nome || resolvedUserName)
      : resolvedUserName

    const rawUserEmail = String(user.email || dbUser?.email || '').trim().toLowerCase()
    const isValidExternalEmail =
      rawUserEmail.includes('@') &&
      !rawUserEmail.endsWith('.local') &&
      /\.[a-z]{2,}$/i.test(rawUserEmail)
    const email = isValidExternalEmail ? rawUserEmail : 'financeiro@impacto-edu.net'

    // 1. Buscar dados da cobrança original no Supabase
    const { data: cobranca, error: errCob } = await supabase
      .from('agenda_cobrancas')
      .select('*')
      .eq('id', existingDest.cobranca_id)
      .single()

    if (errCob || !cobranca) {
      return NextResponse.json({ error: 'Cobrança não encontrada no banco de dados' }, { status: 404 })
    }

    // 2. Criar a Preferência no Mercado Pago (Checkout Pro)
    const expirationDate = new Date(
      typeof cobranca.vencimento === 'string' && !cobranca.vencimento.includes('T')
        ? `${cobranca.vencimento}T23:59:59`
        : cobranca.vencimento
    );
    expirationDate.setDate(expirationDate.getDate() + 5); // Adiciona 5 dias de tolerância após vencimento
    const minFutureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    if (isNaN(expirationDate.getTime()) || expirationDate < minFutureDate) {
      expirationDate.setTime(minFutureDate.getTime());
    }

    const mpPayload = {
      items: [
        {
          title: cobranca.titulo || 'Cobrança Escolar',
          quantity: 1,
          unit_price: Number(Number(cobranca.valor).toFixed(2)),
          currency_id: 'BRL',
          description: `Cobrança via Edu Impacto - ${cobranca.titulo || 'Cobrança Escolar'}`
        }
      ],
      payer: {
        email: email,
        name: nome
      },
      external_reference: String(existingDest.id), // Usamos para linkar no Webhook
      statement_descriptor: 'EDU IMPACTO',
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu.net'}/api/webhooks/mercadopago`,
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

    // 3. Salvar os IDs no Supabase (Reaproveitando colunas existentes de forma resiliente)
    const updatePayload: Record<string, any> = {
      url_pagamento: mpData.init_point // Link de pagamento real
    }
    if ('asaas_customer_id' in existingDest) {
      updatePayload.asaas_customer_id = String(mpData.client_id || 'MP_CLIENT')
    }
    if ('asaas_payment_id' in existingDest) {
      updatePayload.asaas_payment_id = String(mpData.id || '')
    }
    if (!isGeneratedByAdmin) {
      if ('pagador_usuario_id' in existingDest) {
        updatePayload.pagador_usuario_id = user.id
      }
      if ('pagador_usuario_nome' in existingDest) {
        updatePayload.pagador_usuario_nome = nome
      }
    }

    let { error: errUpdate } = await supabase
      .from('agenda_cobrancas_destinatarios')
      .update(updatePayload)
      .eq('id', existingDest.id)

    if (errUpdate) {
      console.warn('Aviso ao salvar campos estendidos em agenda_cobrancas_destinatarios, salvando url_pagamento:', errUpdate)
      const fallbackUpdate = await supabase
        .from('agenda_cobrancas_destinatarios')
        .update({ url_pagamento: mpData.init_point })
        .eq('id', existingDest.id)
      errUpdate = fallbackUpdate.error
    }

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
