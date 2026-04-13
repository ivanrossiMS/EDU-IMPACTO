import { NextRequest, NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const GerarReciboSchema = z.object({
  baixa_id: z.string().min(1, 'ID da baixa é obrigatório'),
  caixa_id: z.string().default(''),
  aluno_id: z.string().default(''),
  aluno_nome: z.string().default(''),
  aluno_turma: z.string().default(''),
  responsavel_nome: z.string().default(''),
  payer_name: z.string().default(''),
  payer_document: z.string().default(''),
  unidade_id: z.string().default(''),
  unidade_nome: z.string().default(''),
  event_id: z.string().default(''),
  event_description: z.string().default(''),
  paid_amount: z.coerce.number().min(0),
  original_amount: z.coerce.number().min(0).default(0),
  discount_amount: z.coerce.number().min(0).default(0),
  interest_amount: z.coerce.number().min(0).default(0),
  penalty_amount: z.coerce.number().min(0).default(0),
  payment_method: z.string().default(''),
  payment_date: z.string().default(''),
  notes: z.string().default(''),
  created_by: z.string().default(''),
  // Se for reemissão
  replaces_receipt_id: z.string().uuid().optional().nullable(),
})

function generateToken(): string {
  return randomUUID()
}

function generateHash(data: {
  id: string
  validation_token: string
  baixa_id: string
  paid_amount: number
  payment_date: string | null
}): string {
  const content = `${data.id}|${data.validation_token}|${data.baixa_id}|${data.paid_amount}|${data.payment_date || ''}`
  return createHash('sha256').update(content).digest('hex')
}

async function getNextReceiptNumber(supabase: ReturnType<typeof createClient>): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('financial_receipts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)
    .lt('created_at', `${year + 1}-01-01`)

  const seq = ((count || 0) + 1).toString().padStart(5, '0')
  return `REC-${year}-${seq}`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createProtectedClient()
    const body = await req.json()
    const payload = GerarReciboSchema.parse(body)

    // Verificar se já existe recibo ativo para esta baixa
    const { data: existente } = await supabase
      .from('financial_receipts')
      .select('id, receipt_number, validation_token, receipt_status')
      .eq('baixa_id', payload.baixa_id)
      .eq('receipt_status', 'valido')
      .eq('is_active', true)
      .maybeSingle()

    // Se já existe e não é reemissão, retornar o existente
    if (existente && !payload.replaces_receipt_id) {
      return NextResponse.json({ ok: true, data: existente, existing: true })
    }

    // Gerar número do recibo
    const receiptNumber = await getNextReceiptNumber(supabase as any)

    // Gerar token único
    const token = generateToken()

    // Determinar versão (reemissão incrementa versão)
    let version = 1
    if (payload.replaces_receipt_id) {
      const { data: anterior } = await supabase
        .from('financial_receipts')
        .select('receipt_version')
        .eq('id', payload.replaces_receipt_id)
        .single()
      if (anterior) version = (anterior.receipt_version || 1) + 1
    }

    // URL pública de validação
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/supabase', '') || ''
    const publicUrl = `${baseUrl}/recibo/validar/${token}`

    // Preparar registro (sem hash ainda — precisamos do ID primeiro)
    const receiptInsert: Record<string, any> = {
      receipt_number: receiptNumber,
      receipt_version: version,
      receipt_status: 'valido',
      validation_token: token,
      validation_hash: 'pending', // será atualizado após INSERT
      public_validation_url: publicUrl,
      baixa_id: payload.baixa_id,
      event_id: payload.event_id,
      aluno_id: payload.aluno_id,
      unidade_id: payload.unidade_id,
      caixa_id: payload.caixa_id,
      payment_date: payload.payment_date || null,
      original_amount: payload.original_amount,
      discount_amount: payload.discount_amount,
      interest_amount: payload.interest_amount,
      penalty_amount: payload.penalty_amount,
      paid_amount: payload.paid_amount,
      payment_method: payload.payment_method,
      payer_name: payload.payer_name,
      payer_document: maskDocument(payload.payer_document),
      aluno_nome: payload.aluno_nome,
      aluno_turma: payload.aluno_turma,
      responsavel_nome: payload.responsavel_nome,
      unidade_nome: payload.unidade_nome,
      event_description: payload.event_description,
      notes: payload.notes,
      is_active: true,
      created_by: payload.created_by,
      replaces_receipt_id: payload.replaces_receipt_id || null,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('financial_receipts')
      .insert(receiptInsert)
      .select()
      .single()

    if (insertError || !inserted) {
      console.error('[GERAR RECIBO]', insertError)
      return NextResponse.json({ error: insertError?.message || 'Falha ao gerar recibo' }, { status: 500 })
    }

    // Calcular e persistir hash real com o ID definitivo
    const hash = generateHash({
      id: inserted.id,
      validation_token: token,
      baixa_id: payload.baixa_id,
      paid_amount: payload.paid_amount,
      payment_date: payload.payment_date || null,
    })

    await supabase
      .from('financial_receipts')
      .update({ validation_hash: hash })
      .eq('id', inserted.id)

    // Se for reemissão, marcar o anterior como substituído
    if (payload.replaces_receipt_id) {
      await supabase
        .from('financial_receipts')
        .update({
          receipt_status: 'substituido',
          is_active: false,
          replaced_by_receipt_id: inserted.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.replaces_receipt_id)
    }

    return NextResponse.json({
      ok: true,
      data: { ...inserted, validation_hash: hash },
    }, { status: 201 })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function maskDocument(doc: string | null | undefined): string {
  if (!doc) return ''
  const clean = doc.replace(/\D/g, '')
  if (clean.length === 11) return `***.***.${ clean.slice(6, 9)}-**`
  if (clean.length === 14) return `**.***.${ clean.slice(5, 8)}/${clean.slice(8, 12)}-**`
  return doc.slice(0, 3) + '***'
}
