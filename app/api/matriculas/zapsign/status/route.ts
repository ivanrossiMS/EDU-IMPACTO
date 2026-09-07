import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { consultarDocumentoZapSign } from '@/lib/zapsign'

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
    const isSandbox = Boolean(config.sandbox)

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
      // continua para checagem em fallback se necessário
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

    // 3. Consultar a API da ZapSign
    const zapDoc = await consultarDocumentoZapSign(targetDocToken, apiToken, isSandbox)

    // 4. Mapear signatários e status rigoroso (todos devem assinar)
    const signersList: any[] = Array.isArray(zapDoc.signers) ? zapDoc.signers : []
    const totalSigners = signersList.length || 1

    const assinados = signersList.filter((s: any) =>
      s.status === 'signed' || Boolean(s.signed_at) || (Number(s.times_signed) > 0)
    )
    const numAssinados = assinados.length

    const pendentes = signersList.filter((s: any) =>
      !(s.status === 'signed' || Boolean(s.signed_at) || (Number(s.times_signed) > 0))
    )

    // Só fica como 'assinado' se TODOS os signatários tiverem assinado!
    let novoStatus = 'aguardando'
    if (zapDoc.status === 'refused') {
      novoStatus = 'recusado'
    } else if (zapDoc.status === 'canceled') {
      novoStatus = 'cancelado'
    } else if (totalSigners > 0 && numAssinados >= totalSigners) {
      novoStatus = 'assinado'
    } else {
      novoStatus = 'aguardando'
    }

    const firstSigner = signersList[0]
    const escolaSigner = signersList.length > 1 ? signersList[1] : undefined

    const currentMetadata = (localContrato?.metadata && typeof localContrato.metadata === 'object') ? localContrato.metadata : {}
    const updatedMetadata = {
      ...currentMetadata,
      signers: zapDoc.signers || currentMetadata.signers || [],
      totalSigners,
      numAssinados,
      pendentes: pendentes.map((p: any) => ({
        name: p.name,
        email: p.email,
        phoneNumber: p.phone_number,
        qualification: p.qualification,
      })),
      escolaSignUrl: escolaSigner?.sign_url || currentMetadata.escolaSignUrl || null,
      lastStatusCheck: new Date().toISOString(),
    }

    const updates: any = {
      status: novoStatus,
      zapsign_status: zapDoc.status,
      signed_file_url: zapDoc.signed_file || localContrato?.signed_file_url || null,
      zapsign_sign_url: firstSigner?.sign_url || localContrato?.zapsign_sign_url,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    }

    // 5. Salvar atualização no DB
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
      statusAtual: novoStatus,
      zapDoc,
    })
  } catch (err: any) {
    console.error('[ZapSign Status Error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
