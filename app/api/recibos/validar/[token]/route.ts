import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

// Rota pública — NÃO requer autenticação
// Usada pelo QR Code e página pública de validação
export const dynamic = 'force-dynamic'

// Client Supabase público (somente leitura de dados permitidos)
function getPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const supabase = getPublicSupabase()
  const { token } = await context.params
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const userAgent = req.headers.get('user-agent') || ''

  const logValidation = async (
    receiptId: string | null,
    baixaId: string,
    status: string,
    message: string
  ) => {
    try {
      await supabase.from('receipt_validation_logs').insert({
        receipt_id: receiptId,
        baixa_id: baixaId,
        validation_token: token,
        validation_type: 'token',
        validation_origin: 'publica',
        result_status: status,
        result_message: message,
        ip_address: ip.slice(0, 45),
        user_agent: userAgent.slice(0, 500),
        validated_by_user_id: '',
      })
    } catch (_) {
      // Log failure non-critical
    }
  }

  try {
    // 1. Buscar recibo pelo token
    const { data: receipt, error: receiptError } = await supabase
      .from('financial_receipts')
      .select('*')
      .eq('validation_token', token)
      .single()

    if (receiptError || !receipt) {
      await logValidation(null, '', 'nao_encontrado', 'Token não encontrado no sistema')
      return NextResponse.json({
        status: 'nao_encontrado',
        message: 'Nenhum recibo correspondente foi encontrado na base de dados.',
      }, { status: 404 })
    }

    // 2. Verificar integridade do hash
    const expectedHash = generateHash({
      id: receipt.id,
      validation_token: receipt.validation_token,
      baixa_id: receipt.baixa_id,
      paid_amount: receipt.paid_amount,
      payment_date: receipt.payment_date,
    })

    if (receipt.validation_hash !== expectedHash) {
      await logValidation(receipt.id, receipt.baixa_id, 'invalido', 'Hash de integridade divergente')
      return NextResponse.json({
        status: 'invalido',
        message: 'Este recibo não pôde ser validado. A integridade do documento está comprometida.',
      }, { status: 200 })
    }

    // 3. Verificar status do recibo
    if (receipt.receipt_status === 'cancelado') {
      await logValidation(receipt.id, receipt.baixa_id, 'cancelado', 'Recibo cancelado')
      return NextResponse.json({
        status: 'cancelado',
        message: 'Este recibo foi cancelado e não é mais válido como comprovante.',
        canceled_at: receipt.canceled_at,
        cancellation_reason: receipt.cancellation_reason,
        receipt: buildPublicPayload(receipt),
      }, { status: 200 })
    }

    if (receipt.receipt_status === 'estornado') {
      await logValidation(receipt.id, receipt.baixa_id, 'estornado', 'Recibo estornado')
      return NextResponse.json({
        status: 'estornado',
        message: 'Este pagamento foi estornado. O recibo permanece apenas para histórico.',
        reversed_at: receipt.reversed_at,
        receipt: buildPublicPayload(receipt),
      }, { status: 200 })
    }

    if (receipt.receipt_status === 'substituido') {
      await logValidation(receipt.id, receipt.baixa_id, 'substituido', 'Recibo substituído por nova versão')
      return NextResponse.json({
        status: 'substituido',
        message: 'Este recibo foi substituído por uma nova versão.',
        replaced_by_receipt_id: receipt.replaced_by_receipt_id,
        receipt: buildPublicPayload(receipt),
      }, { status: 200 })
    }

    // 4. Verificar a baixa associada (título)
    const { data: titulo, error: tituloError } = await supabase
      .from('titulos')
      .select('id, status, valor, pagamento, metodo, aluno')
      .eq('id', receipt.baixa_id)
      .single()

    if (tituloError || !titulo) {
      await logValidation(receipt.id, receipt.baixa_id, 'inconsistente', 'Baixa associada não encontrada no sistema')
      return NextResponse.json({
        status: 'inconsistente',
        message: 'O recibo existe, mas a baixa associada não foi localizada.',
        receipt: buildPublicPayload(receipt),
      }, { status: 200 })
    }

    if (titulo.status !== 'pago') {
      await logValidation(receipt.id, receipt.baixa_id, 'inconsistente', `Baixa associada com status '${titulo.status}' (esperado: pago)`)
      return NextResponse.json({
        status: 'inconsistente',
        message: 'O recibo foi localizado, mas o pagamento associado está com status inconsistente.',
        receipt: buildPublicPayload(receipt),
      }, { status: 200 })
    }

    // ✅ Tudo válido!
    await logValidation(receipt.id, receipt.baixa_id, 'valido', 'Recibo validado com sucesso')

    return NextResponse.json({
      status: 'valido',
      message: 'Pagamento confirmado. Este recibo é autêntico e válido.',
      receipt: buildPublicPayload(receipt),
    }, { status: 200 })

  } catch (err: any) {
    console.error('[PUBLIC VALIDATE]', err)
    return NextResponse.json({
      status: 'erro',
      message: 'Não foi possível validar o recibo no momento. Tente novamente em instantes.',
    }, { status: 500 })
  }
}

// Retorna apenas campos seguros para exibição pública
function buildPublicPayload(receipt: any) {
  return {
    receipt_number: receipt.receipt_number,
    receipt_version: receipt.receipt_version,
    receipt_status: receipt.receipt_status,
    issue_date: receipt.issue_date,
    payment_date: receipt.payment_date,
    paid_amount: receipt.paid_amount,
    payment_method: receipt.payment_method,
    aluno_nome: receipt.aluno_nome,
    aluno_turma: receipt.aluno_turma,
    responsavel_nome: receipt.responsavel_nome,
    payer_name: receipt.payer_name,
    // CPF mascarado (ex: ***.***.123-**)
    payer_document: maskDocument(receipt.payer_document),
    unidade_nome: receipt.unidade_nome,
    event_description: receipt.event_description,
    baixa_id: receipt.baixa_id,
  }
}

function maskDocument(doc: string | null): string {
  if (!doc) return '***'
  const clean = doc.replace(/\D/g, '')
  if (clean.length === 11) {
    // CPF
    return `***.***.${ clean.slice(6, 9)}-**`
  }
  if (clean.length === 14) {
    // CNPJ
    return `**.***.${ clean.slice(5, 8)}/${clean.slice(8, 12)}-**`
  }
  return '***'
}
