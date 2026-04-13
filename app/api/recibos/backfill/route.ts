import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

// ─── Usa o cliente anon key (mesmo acesso do titulos/route.ts) ────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function generateToken(): string {
  return randomUUID()
}

function generateHash(data: {
  id: string; validation_token: string; baixa_id: string
  paid_amount: number; payment_date: string | null
}): string {
  const content = `${data.id}|${data.validation_token}|${data.baixa_id}|${data.paid_amount}|${data.payment_date || ''}`
  return createHash('sha256').update(content).digest('hex')
}

/**
 * POST /api/recibos/backfill
 *
 * Importa TODOS os títulos com status='pago' que ainda não têm
 * um recibo em financial_receipts.
 *
 * Schema real de titulos:
 *   id, codigo, aluno, aluno_id, responsavel, descricao, valor,
 *   vencimento, pagamento, status, metodo, parcela, turma, ano,
 *   evento_id, evento_descricao, dados_bancarios
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || ''

  try {
    // ─── 1. Buscar IDs que já têm recibo ───────────────────────────
    const { data: existentes, error: existErr } = await supabase
      .from('financial_receipts')
      .select('baixa_id')

    if (existErr) {
      return NextResponse.json({
        error: `Tabela financial_receipts não acessível: ${existErr.message}. Execute a migration SQL primeiro.`,
        migration_needed: true,
      }, { status: 500 })
    }

    const existentesSet = new Set<string>((existentes || []).map((r: any) => r.baixa_id as string))

    // ─── 2. Buscar TODOS os titulos pagos ─────────────────────────
    // Aceita variantes de status: 'pago', 'Pago', 'PAGO', 'liquidado'
    // E também titulos onde pagamento date foi preenchido (indicando quitação real)
    const { data: titulos, error: titulosErr, count: titulosCount } = await supabase
      .from('titulos')
      .select(
        'id, aluno, aluno_id, responsavel, descricao, valor, pagamento, metodo, parcela, turma, evento_descricao',
        { count: 'exact' }
      )
      .or('status.eq.pago,status.eq.Pago,status.eq.PAGO,status.eq.liquidado')
      .order('pagamento', { ascending: true })

    if (titulosErr) {
      return NextResponse.json({
        error: `Erro ao buscar títulos: ${titulosErr.message}`,
      }, { status: 500 })
    }

    const candidatos = (titulos || []).filter((t: any) => !existentesSet.has(t.id))

    if (candidatos.length === 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: existentesSet.size,
        total_pagos: titulosCount || 0,
        message: 'Todos os pagamentos já possuem recibo registrado.',
      })
    }

    // ─── 3. Inserir recibos em lotes ──────────────────────────────
    let created = 0
    let errors = 0
    const errorDetails: string[] = []

    // Obter contagem atual para numeração sequencial
    const { count: countAtual } = await supabase
      .from('financial_receipts')
      .select('id', { count: 'exact', head: true })

    let seqOffset = (countAtual || 0)
    const year = new Date().getFullYear()

    for (const titulo of candidatos) {
      try {
        seqOffset++
        const seq = seqOffset.toString().padStart(5, '0')
        const receiptNumber = `REC-${year}-${seq}`
        const token = generateToken()

        const paymentDate = titulo.pagamento
          ? (typeof titulo.pagamento === 'string' && titulo.pagamento.length >= 10
            ? titulo.pagamento.slice(0, 10)
            : new Date(titulo.pagamento).toISOString().slice(0, 10))
          : new Date().toISOString().slice(0, 10)

        const publicUrl = `${baseUrl}/recibo/validar/${token}`

        const { data: inserted, error: insertErr } = await supabase
          .from('financial_receipts')
          .insert({
            receipt_number: receiptNumber,
            receipt_version: 1,
            receipt_status: 'valido',
            validation_token: token,
            validation_hash: 'pending',
            public_validation_url: publicUrl,
            baixa_id: titulo.id,
            event_id: titulo.evento_id || '',
            aluno_id: titulo.aluno_id || '',
            unidade_id: '',
            caixa_id: '',
            payment_date: paymentDate,
            original_amount: Number(titulo.valor) || 0,
            discount_amount: 0,
            interest_amount: 0,
            penalty_amount: 0,
            paid_amount: Number(titulo.valor) || 0,
            payment_method: titulo.metodo || '',
            payer_name: titulo.responsavel || '',
            payer_document: '',
            aluno_nome: titulo.aluno || '',
            aluno_turma: titulo.turma || titulo.parcela || '',
            responsavel_nome: titulo.responsavel || '',
            unidade_nome: '',
            event_description: titulo.evento_descricao || titulo.descricao || '',
            notes: 'Importado via backfill automático',
            is_active: true,
            created_by: 'backfill-sistema',
          })
          .select('id')
          .single()

        if (insertErr || !inserted) {
          errors++
          errorDetails.push(`${titulo.id}: ${insertErr?.message || 'sem resposta'}`)
          seqOffset-- // Reverter offset se falhou
          continue
        }

        // Atualizar hash real
        const hash = generateHash({
          id: inserted.id,
          validation_token: token,
          baixa_id: titulo.id,
          paid_amount: Number(titulo.valor) || 0,
          payment_date: paymentDate,
        })

        await supabase
          .from('financial_receipts')
          .update({ validation_hash: hash })
          .eq('id', inserted.id)

        created++
      } catch (err: any) {
        errors++
        errorDetails.push(`${titulo.id}: ${err.message}`)
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      skipped: existentesSet.size,
      errors,
      total_candidatos: candidatos.length,
      total_pagos: titulosCount || 0,
      message: created > 0
        ? `${created} recibo(s) criado(s) com sucesso!`
        : `0 recibos criados. ${errors > 0 ? `${errors} erro(s) ocorreram.` : ''}`,
      ...(errorDetails.length > 0 && { errorDetails: errorDetails.slice(0, 5) }),
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
