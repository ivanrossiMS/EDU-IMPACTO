import { NextRequest, NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

const ZodPagamentoPayload = z.object({
  parcela_id: z.string().uuid("ID da parcela inválido"),
  caixa_id: z.string().min(1, "Caixa Destino Obrigatório"),
  valor_recebido: z.coerce.number().min(0.01, "O valor deve ser maior que zero"),
  operador: z.string().min(1, "Operador financeiro Ausente"),
  forma_pagamento: z.string().min(1, "Forma de pagamento não declarada (Ex: Dinheiro)"),
  plano_contas_id: z.string().nullable().optional().default(''),
  descricao: z.string().nullable().optional().default('Recebimento de Mensalidade/Parcela'),
  // Campos de enriquecimento do recibo (opcionais)
  aluno_id: z.string().optional().default(''),
  aluno_nome: z.string().optional().default(''),
  aluno_turma: z.string().optional().default(''),
  responsavel_nome: z.string().optional().default(''),
  payer_document: z.string().optional().default(''),
  unidade_nome: z.string().optional().default(''),
  event_description: z.string().optional().default(''),
})

// ─── Funções de geração do recibo ─────────────────────────────────
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

function maskDocument(doc: string | null | undefined): string {
  if (!doc) return ''
  const clean = (doc || '').replace(/\D/g, '')
  if (clean.length === 11) return `***.***.${ clean.slice(6, 9)}-**`
  if (clean.length === 14) return `**.***.${ clean.slice(5, 8)}/${clean.slice(8, 12)}-**`
  return doc.slice(0, 3) + '***'
}

async function getNextReceiptNumber(supabase: any): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('financial_receipts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)
    .lt('created_at', `${year + 1}-01-01`)
  const seq = ((count || 0) + 1).toString().padStart(5, '0')
  return `REC-${year}-${seq}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = ZodPagamentoPayload.parse(body)

    const supabase = await createProtectedClient()

    // Buscar dados da parcela para enriquecer o recibo
    const { data: parcela } = await supabase
      .from('titulos')
      .select('id, aluno, aluno_id, responsavel, descricao, valor, pagamento, metodo, parcela, turma, evento_descricao')
      .eq('id', payload.parcela_id)
      .maybeSingle()

    // ─── Executar a baixa via ACID transaction ───────────────────────
    const { data: transacao, error } = await supabase.rpc('fn_realizar_baixa', {
      p_parcela_id: payload.parcela_id,
      p_caixa_id: payload.caixa_id,
      p_valor_recebido: payload.valor_recebido,
      p_operador: payload.operador,
      p_forma_pagamento: payload.forma_pagamento,
      p_plano_contas_id: payload.plano_contas_id,
      p_descricao: payload.descricao
    })

    if (error) {
      console.error("[PgSQL ACID Exception]", error)
      return NextResponse.json({ error: error.message || 'Falha Transacional no PostgreSQL' }, { status: 400 })
    }

    // ─── Gerar recibo diretamente no banco (síncrono, sem HTTP interno) ──
    // Usar try/catch isolado: falha no recibo NÃO must reverter a baixa.
    let receiptData: any = null
    try {
      // Verificar se já existe recibo para esta baixa
      const { data: existente } = await supabase
        .from('financial_receipts')
        .select('id, receipt_number, validation_token')
        .eq('baixa_id', payload.parcela_id)
        .eq('receipt_status', 'valido')
        .maybeSingle()

      if (!existente) {
        const today = new Date().toISOString().slice(0, 10)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
        const receiptNumber = await getNextReceiptNumber(supabase)
        const token = generateToken()
        const publicUrl = `${baseUrl}/recibo/validar/${token}`

        const alunoNome = payload.aluno_nome || parcela?.aluno || ''
        const responsavelNome = payload.responsavel_nome || parcela?.responsavel || ''
        const eventDesc = payload.event_description || (parcela as any)?.evento_descricao || parcela?.descricao || payload.descricao || ''

        const { data: inserted, error: insertErr } = await supabase
          .from('financial_receipts')
          .insert({
            receipt_number: receiptNumber,
            receipt_version: 1,
            receipt_status: 'valido',
            validation_token: token,
            validation_hash: 'pending',
            public_validation_url: publicUrl,
            baixa_id: payload.parcela_id,
            event_id: '',
            aluno_id: payload.aluno_id || parcela?.aluno_id || '',
            unidade_id: '',
            caixa_id: payload.caixa_id,
            payment_date: today,
            original_amount: parcela?.valor ?? payload.valor_recebido,
            discount_amount: 0,
            interest_amount: 0,
            penalty_amount: 0,
            paid_amount: payload.valor_recebido,
            payment_method: payload.forma_pagamento,
            payer_name: responsavelNome,
            payer_document: maskDocument(payload.payer_document),
            aluno_nome: alunoNome,
            aluno_turma: payload.aluno_turma || (parcela as any)?.turma || (parcela as any)?.parcela || '',
            responsavel_nome: responsavelNome,
            unidade_nome: payload.unidade_nome || '',
            event_description: eventDesc,
            notes: '',
            is_active: true,
            created_by: payload.operador,
          })
          .select('id, receipt_number, validation_token, public_validation_url')
          .single()

        if (inserted && !insertErr) {
          const hash = generateHash({
            id: inserted.id,
            validation_token: token,
            baixa_id: payload.parcela_id,
            paid_amount: payload.valor_recebido,
            payment_date: today,
          })
          await supabase
            .from('financial_receipts')
            .update({ validation_hash: hash })
            .eq('id', inserted.id)

          receiptData = { ...inserted, validation_hash: hash }
        } else if (insertErr) {
          console.error('[RECIBO AUTO] Erro ao criar recibo:', insertErr.message)
        }
      } else {
        receiptData = existente
      }
    } catch (receiptErr: any) {
      // Falha no recibo é não-crítica — não quebra a baixa
      console.warn('[RECIBO AUTO] Exceção não-crítica:', receiptErr.message)
    }

    return NextResponse.json({
      ok: true,
      transacao,
      recibo: receiptData,
    }, { status: 201 })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validação Bloqueada: " + (err.issues?.[0]?.message || 'Dados inválidos') }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
