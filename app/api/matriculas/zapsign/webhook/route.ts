import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

const FALLBACK_KEY = 'matriculas_contratos_list'

/**
 * POST /api/matriculas/zapsign/webhook
 * Endpoint público para recepção de webhooks oficiais do ZapSign.
 * Configurar no painel ZapSign: Configurações > Integrações > Webhooks
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json()
    console.log('[ZapSign Webhook] Evento recebido:', payload?.event_type || payload?.status, payload?.token)

    const docToken = payload?.token || payload?.doc_token
    if (!docToken) {
      return NextResponse.json({ message: 'Token não encontrado no payload.' }, { status: 200 })
    }

    const eventType = payload?.event_type || ''
    const docStatus = payload?.status || ''
    const signedFile = payload?.signed_file || null

    let novoStatus: string | null = null

    if (eventType === 'doc_signed' || docStatus === 'signed') {
      novoStatus = 'assinado'
    } else if (eventType === 'doc_refused' || docStatus === 'refused') {
      novoStatus = 'recusado'
    } else if (docStatus === 'canceled') {
      novoStatus = 'cancelado'
    }

    if (!novoStatus) {
      return NextResponse.json({ message: 'Evento ignorado ou sem alteração de status.' }, { status: 200 })
    }

    const supabase = getAdminClient()

    const updates: any = {
      status: novoStatus,
      zapsign_status: docStatus || eventType,
      updated_at: new Date().toISOString(),
    }
    if (signedFile) {
      updates.signed_file_url = signedFile
    }

    // 1. Atualiza na tabela matriculas_contratos
    try {
      await supabase
        .from('matriculas_contratos')
        .update(updates)
        .eq('zapsign_doc_token', docToken)
    } catch (e) {
      // continua
    }

    // 2. Atualiza no fallback
    try {
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      if (Array.isArray(configData?.valor)) {
        const updatedList = configData.valor.map((c: any) => {
          if (c.zapsign_doc_token === docToken) {
            return { ...c, ...updates }
          }
          return c
        })

        await supabase
          .from('configuracoes')
          .upsert({
            chave: FALLBACK_KEY,
            valor: updatedList,
            updated_at: new Date().toISOString()
          }, { onConflict: 'chave' })
      }
    } catch (e) {
      // continua
    }

    return NextResponse.json({
      success: true,
      message: `Status do contrato atualizado para "${novoStatus}".`,
      docToken,
    })
  } catch (err: any) {
    console.error('[ZapSign Webhook Error]:', err)
    // Retorna 200 para evitar retentativas desnecessárias do ZapSign em caso de payload malformado
    return NextResponse.json({ error: err.message }, { status: 200 })
  }
}
