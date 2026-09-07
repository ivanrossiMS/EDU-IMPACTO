import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { syncContratoWithZapSign } from '@/lib/zapsign'

export const dynamic = 'force-dynamic'

const CONFIG_CHAVE = 'cfgZapSignInteg'
const FALLBACK_KEY = 'matriculas_contratos_list'

/**
 * POST /api/matriculas/zapsign/sync-batch
 * Sincroniza em lote todos os contratos com status 'aguardando' ou 'enviado'
 * diretamente com a API do ZapSign, atualizando o banco de dados e fallback.
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
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

    // 2. Buscar lista de contratos (DB ou Fallback)
    let allContratos: any[] = []
    let usedFallback = false

    try {
      const { data, error } = await supabase
        .from('matriculas_contratos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        usedFallback = true
      } else {
        allContratos = data || []
      }
    } catch (e) {
      usedFallback = true
    }

    if (usedFallback) {
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      allContratos = Array.isArray(configData?.valor) ? configData.valor : []
    }

    // 3. Filtrar contratos que estão aguardando e possuem token ZapSign
    const pendentes = allContratos.filter(c =>
      (c.status === 'aguardando' || c.status === 'enviado') && Boolean(c.zapsign_doc_token)
    ).slice(0, 20) // Limite de segurança para 20 mais recentes

    if (pendentes.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum contrato pendente para sincronizar.',
        totalPendentes: 0,
        updatedCount: 0,
      })
    }

    // 4. Executar sincronização concorrente controlada
    const syncResults = await Promise.allSettled(
      pendentes.map(c => syncContratoWithZapSign(c, apiToken, defaultSandbox))
    )

    let updatedCount = 0
    const updatedDocs: any[] = []
    const updatesMap = new Map<string, any>()

    syncResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const { updated, updates } = result.value
        if (updated) {
          updatedCount++
          const original = pendentes[idx]
          updatedDocs.push({
            id: original.id,
            docToken: original.zapsign_doc_token,
            statusAnterior: original.status,
            novoStatus: updates.status,
          })
          updatesMap.set(original.zapsign_doc_token, updates)
        }
      } else {
        console.warn('[ZapSign Batch Sync] Falha ao sincronizar contrato:', pendentes[idx]?.id, result.reason?.message)
      }
    })

    // 5. Persistir atualizações se houve mudanças
    if (updatedCount > 0) {
      // 5a. Persistir no DB se a tabela existir
      if (!usedFallback) {
        for (const [docToken, updates] of updatesMap.entries()) {
          try {
            await supabase
              .from('matriculas_contratos')
              .update(updates)
              .eq('zapsign_doc_token', docToken)
          } catch (e) {
            // continua
          }
        }
      }

      // 5b. Persistir no fallback configuracoes
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      if (Array.isArray(configData?.valor)) {
        const updatedList = configData.valor.map((c: any) => {
          if (c.zapsign_doc_token && updatesMap.has(c.zapsign_doc_token)) {
            return { ...c, ...updatesMap.get(c.zapsign_doc_token) }
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
    }

    return NextResponse.json({
      success: true,
      totalPendentes: pendentes.length,
      updatedCount,
      updatedDocs,
    })
  } catch (err: any) {
    console.error('[ZapSign Batch Sync Error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
