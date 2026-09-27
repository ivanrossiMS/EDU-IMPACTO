import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { EnqueteData } from '@/lib/enquetes/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { comunicadoId, encerrada } = body

    if (!comunicadoId) {
      return NextResponse.json({ error: 'comunicadoId é obrigatório' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    const { data: comRow, error: fetchErr } = await adminClient
      .from('comunicados')
      .select('*')
      .eq('id', comunicadoId)
      .maybeSingle()

    if (fetchErr || !comRow) {
      return NextResponse.json({ error: 'Comunicado não encontrado' }, { status: 404 })
    }

    const dados = comRow.dados || {}
    const enquete: EnqueteData | null = dados.enquete || comRow.enquete || null

    if (!enquete) {
      return NextResponse.json({ error: 'Enquete não encontrada neste comunicado' }, { status: 404 })
    }

    const updatedEnquete: EnqueteData = {
      ...enquete,
      encerrada: Boolean(encerrada),
      atualizadoEm: new Date().toISOString()
    }

    const updatedDados = {
      ...dados,
      enquete: updatedEnquete
    }

    const { error: updateErr } = await adminClient
      .from('comunicados')
      .update({ dados: updatedDados })
      .eq('id', comunicadoId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    try {
      await adminClient.from('enquetes').upsert({
        id: updatedEnquete.id,
        titulo: updatedEnquete.pergunta,
        dados: updatedEnquete
      })
    } catch (_) {}

    return NextResponse.json({
      ok: true,
      enquete: updatedEnquete
    })
  } catch (err: any) {
    console.error('Erro ao atualizar status da enquete:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao alterar status da enquete' }, { status: 500 })
  }
}
