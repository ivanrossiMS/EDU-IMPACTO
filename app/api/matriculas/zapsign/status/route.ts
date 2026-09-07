import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { syncContratoWithZapSign } from '@/lib/zapsign'

export const dynamic = 'force-dynamic'

const CONFIG_CHAVE = 'cfgZapSignInteg'
const FALLBACK_KEY = 'matriculas_contratos_list'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { docToken, contratoId } = body

    if (!docToken && !contratoId) {
      return NextResponse.json(
        { error: 'docToken ou contratoId é obrigatório para verificar o status.' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    // 1. Obter token e config do ZapSign
    const { data: configRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', CONFIG_CHAVE)
      .maybeSingle()

    const config = configRow?.valor || {}
    const apiToken = config.apiToken || process.env.ZAPSIGN_API_TOKEN
    const defaultSandbox = Boolean(config.sandbox)

    if (!apiToken) {
      return NextResponse.json(
        { error: 'Token da API do ZapSign não configurado.' },
        { status: 422 }
      )
    }

    // 2. Localizar o contrato pelo ID ou token
    let targetDocToken = docToken
    let localContrato: any = null

    try {
      let query = supabase.from('matriculas_contratos').select('*')
      if (contratoId) query = query.eq('id', contratoId)
      else if (docToken) query = query.eq('zapsign_doc_token', docToken)

      const { data } = await query.maybeSingle()
      if (data) {
        localContrato = data
        targetDocToken = data.zapsign_doc_token
      }
    } catch (e) {
      // continua para checagem em fallback
    }

    if (!localContrato) {
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      if (Array.isArray(configData?.valor)) {
        localContrato = configData.valor.find((c: any) =>
          (contratoId && c.id === contratoId) || (docToken && c.zapsign_doc_token === docToken)
        )
        if (localContrato) {
          targetDocToken = localContrato.zapsign_doc_token
        }
      }
    }

    if (!targetDocToken) {
      return NextResponse.json(
        { error: 'Contrato não possui token do ZapSign associado.' },
        { status: 404 }
      )
    }

    // 3. Sincronizar com a API do ZapSign
    const { updates, contratoAtualizado, zapDoc } = await syncContratoWithZapSign(
      localContrato || { zapsign_doc_token: targetDocToken },
      apiToken,
      defaultSandbox
    )

    // 4. Salvar atualização no DB
    try {
      await supabase
        .from('matriculas_contratos')
        .update(updates)
        .eq('zapsign_doc_token', targetDocToken)
    } catch (e) {
      // continua
    }

    // Atualiza também no fallback
    const { data: configData } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', FALLBACK_KEY)
      .maybeSingle()

    if (Array.isArray(configData?.valor)) {
      const updatedList = configData.valor.map((c: any) => {
        if (c.zapsign_doc_token === targetDocToken || (localContrato?.id && c.id === localContrato.id)) {
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

    return NextResponse.json({
      success: true,
      docToken: targetDocToken,
      statusAnterior: localContrato?.status,
      statusAtual: updates.status,
      signedFileUrl: updates.signed_file_url,
      zapDoc,
    })
  } catch (err: any) {
    console.error('[ZapSign Status Error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
