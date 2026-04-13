import { NextRequest, NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

// GET — detalhe de um recibo
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createProtectedClient()
    const { data, error } = await supabase
      .from('financial_receipts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Recibo não encontrado' }, { status: 404 })
    }

    // Buscar logs de validação
    const { data: logs } = await supabase
      .from('receipt_validation_logs')
      .select('*')
      .eq('receipt_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ data, logs: logs || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — atualizar status (cancelar / marcar substituído)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createProtectedClient()
    const { id } = await context.params
    const body = await req.json()

    const { action, reason, user_id, user_name } = body

    if (!action) {
      return NextResponse.json({ error: 'Ação não especificada' }, { status: 400 })
    }

    const now = new Date().toISOString()
    let updateData: Record<string, any> = { updated_at: now, updated_by: user_name || '' }

    if (action === 'cancelar') {
      if (!reason) return NextResponse.json({ error: 'Motivo de cancelamento obrigatório' }, { status: 400 })
      updateData = {
        ...updateData,
        receipt_status: 'cancelado',
        is_active: false,
        canceled_at: now,
        canceled_by: user_name || user_id || '',
        cancellation_reason: reason,
      }
    } else if (action === 'estornar') {
      updateData = {
        ...updateData,
        receipt_status: 'estornado',
        is_active: false,
        reversed_at: now,
        reversed_by: user_name || user_id || '',
      }
    } else if (action === 'substituir') {
      const { new_receipt_id } = body
      updateData = {
        ...updateData,
        receipt_status: 'substituido',
        is_active: false,
        replaced_by_receipt_id: new_receipt_id,
      }
    } else {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('financial_receipts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
