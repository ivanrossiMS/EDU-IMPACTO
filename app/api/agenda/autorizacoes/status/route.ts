import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { AutorizacaoData } from '@/lib/autorizacoes/types'

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
    const autorizacao: AutorizacaoData | null = dados.autorizacao || comRow.autorizacao || null

    if (!autorizacao) {
      return NextResponse.json({ error: 'Autorização não encontrada neste comunicado' }, { status: 404 })
    }

    const updatedAutorizacao: AutorizacaoData = {
      ...autorizacao,
      encerrada: Boolean(encerrada),
      atualizadoEm: new Date().toISOString()
    }

    const updatedDados = {
      ...dados,
      autorizacao: updatedAutorizacao
    }

    const { error: updateErr } = await adminClient
      .from('comunicados')
      .update({ dados: updatedDados })
      .eq('id', comunicadoId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    try {
      await adminClient.from('autorizacoes').upsert({
        id: updatedAutorizacao.id,
        dados: updatedAutorizacao
      })
    } catch (_) {}

    return NextResponse.json({
      ok: true,
      autorizacao: updatedAutorizacao
    })
  } catch (err: any) {
    console.error('Erro ao atualizar status da autorização:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao alterar status da autorização' }, { status: 500 })
  }
}
