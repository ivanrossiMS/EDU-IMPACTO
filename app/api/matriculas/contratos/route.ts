import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { cancelarDocumentoZapSign } from '@/lib/zapsign'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

const CONFIG_CHAVE = 'cfgZapSignInteg'
const FALLBACK_KEY = 'matriculas_contratos_list'

/**
 * GET /api/matriculas/contratos
 * Lista contratos com filtros e sumário métrico
 */
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'todos'
    const search = url.searchParams.get('search') || ''
    const ano = url.searchParams.get('ano') || ''

    const supabase = getAdminClient()

    let allContratos: any[] = []
    let usedFallback = false

    // Tentativa 1: Tabela dedicada matriculas_contratos
    try {
      const { data, error } = await supabase
        .from('matriculas_contratos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code !== '42P01') {
          console.warn('[Matriculas Contratos] Erro ao consultar tabela:', error.message)
        }
        usedFallback = true
      } else {
        allContratos = data || []
      }
    } catch (e) {
      usedFallback = true
    }

    // Fallback: Armazenamento em configuracoes
    if (usedFallback) {
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      allContratos = Array.isArray(configData?.valor) ? configData.valor : []
    }

    // Métricas para os Cards de KPI calculadas sempre sobre a base COMPLETA
    const total = allContratos.length
    const aguardando = allContratos.filter(c => c.status === 'aguardando' || c.status === 'enviado').length
    const assinados = allContratos.filter(c => c.status === 'assinado').length
    const recusados = allContratos.filter(c => c.status === 'recusado' || c.status === 'cancelado').length
    const taxaAssinatura = total > 0 ? Math.round((assinados / total) * 100) : 0

    // Se parâmetros de filtro foram enviados, filtra a lista para retorno
    let contratos = allContratos
    if (status && status !== 'todos') {
      contratos = contratos.filter(c => c.status === status)
    }
    if (ano) {
      contratos = contratos.filter(c => String(c.ano_letivo) === String(ano))
    }
    if (search) {
      const s = search.toLowerCase()
      contratos = contratos.filter(c =>
        (c.aluno_nome || '').toLowerCase().includes(s) ||
        (c.responsavel_nome || '').toLowerCase().includes(s) ||
        (c.responsavel_cpf || '').includes(s)
      )
    }

    return NextResponse.json({
      contratos,
      metrics: {
        total,
        aguardando,
        assinados,
        recusados,
        taxaAssinatura,
      },
      storageMode: usedFallback ? 'configuracoes_fallback' : 'database_table',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/matriculas/contratos
 * Criação manual de rascunho de contrato
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = getAdminClient()

    const newContract = {
      id: body.id || uuidv4(),
      aluno_id: body.aluno_id || '',
      aluno_nome: body.aluno_nome || 'Estudante',
      aluno_cpf: body.aluno_cpf || '',
      aluno_turma: body.aluno_turma || '',
      aluno_serie: body.aluno_serie || '',
      responsavel_id: body.responsavel_id || null,
      responsavel_nome: body.responsavel_nome || 'Responsável',
      responsavel_cpf: body.responsavel_cpf || '',
      responsavel_email: body.responsavel_email || '',
      responsavel_telefone: body.responsavel_telefone || '',
      responsavel_parentesco: body.responsavel_parentesco || 'Responsável',
      ano_letivo: body.ano_letivo || '2027',
      tipo_documento: body.tipo_documento || 'contrato_servicos',
      valor_anuidade: Number(body.valor_anuidade) || 0,
      valor_mensalidade: Number(body.valor_mensalidade) || 0,
      num_parcelas: Number(body.num_parcelas) || 12,
      desconto_percent: Number(body.desconto_percent) || 0,
      dia_vencimento: Number(body.dia_vencimento) || 10,
      status: body.status || 'rascunho',
      zapsign_doc_token: body.zapsign_doc_token || null,
      zapsign_signer_token: body.zapsign_signer_token || null,
      zapsign_sign_url: body.zapsign_sign_url || null,
      zapsign_auth_mode: body.zapsign_auth_mode || 'tokenWhatsapp',
      zapsign_status: body.zapsign_status || 'novo',
      original_file_url: body.original_file_url || null,
      signed_file_url: body.signed_file_url || null,
      metadata: body.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Tenta inserir na tabela
    let inserted = false
    try {
      const { data, error } = await supabase
        .from('matriculas_contratos')
        .insert(newContract)
        .select()
        .single()

      if (!error && data) {
        inserted = true
        return NextResponse.json({ success: true, contrato: data })
      }
    } catch (e) {
      inserted = false
    }

    // Fallback: inserção na lista de configuracoes
    if (!inserted) {
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      const currentList: any[] = Array.isArray(configData?.valor) ? configData.valor : []
      const updatedList = [newContract, ...currentList]

      await supabase
        .from('configuracoes')
        .upsert({
          chave: FALLBACK_KEY,
          valor: updatedList,
          updated_at: new Date().toISOString()
        }, { onConflict: 'chave' })

      return NextResponse.json({ success: true, contrato: newContract, fallback: true })
    }

    return NextResponse.json({ success: true, contrato: newContract })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/matriculas/contratos?id=...&docToken=...
 * Exclui totalmente o contrato do sistema e cancela/exclui no ZapSign
 */
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const queryDocToken = url.searchParams.get('docToken')
    if (!id && !queryDocToken) {
      return NextResponse.json({ error: 'ID do contrato ou docToken é obrigatório.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Obter config do ZapSign para autenticação
    const { data: configRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', CONFIG_CHAVE)
      .maybeSingle()

    const config = configRow?.valor || {}
    const apiToken = config.apiToken || process.env.ZAPSIGN_API_TOKEN
    const isSandbox = Boolean(config.sandbox)

    // 2. Buscar o contrato para localizar o zapsign_doc_token
    let docTokenToDelete = queryDocToken
    let targetId = id

    try {
      let query = supabase.from('matriculas_contratos').select('*')
      if (id) query = query.eq('id', id)
      else if (queryDocToken) query = query.eq('zapsign_doc_token', queryDocToken)

      const { data } = await query.maybeSingle()
      if (data) {
        if (!docTokenToDelete && data.zapsign_doc_token) {
          docTokenToDelete = data.zapsign_doc_token
        }
        if (!targetId && data.id) {
          targetId = data.id
        }
      }
    } catch (e) {
      // continua para fallback
    }

    // Busca no fallback se ainda não encontrou
    const { data: configData } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', FALLBACK_KEY)
      .maybeSingle()

    const fallbackList: any[] = Array.isArray(configData?.valor) ? configData.valor : []
    const fallbackItem = fallbackList.find((c: any) =>
      (id && c.id === id) || (queryDocToken && c.zapsign_doc_token === queryDocToken)
    )

    if (fallbackItem) {
      if (!docTokenToDelete && fallbackItem.zapsign_doc_token) {
        docTokenToDelete = fallbackItem.zapsign_doc_token
      }
      if (!targetId && fallbackItem.id) {
        targetId = fallbackItem.id
      }
    }

    // 3. Excluir/Cancelar o documento diretamente no ZapSign
    let zapsignDeleted = false
    let zapsignError: string | null = null

    if (docTokenToDelete && apiToken) {
      try {
        await cancelarDocumentoZapSign(docTokenToDelete, apiToken, isSandbox)
        zapsignDeleted = true
      } catch (zapErr: any) {
        console.warn('[ZapSign Cancelar Documento]:', zapErr.message)
        zapsignError = zapErr.message
      }
    }

    // 4. Excluir da tabela principal
    if (targetId) {
      try {
        await supabase
          .from('matriculas_contratos')
          .delete()
          .eq('id', targetId)
      } catch (e) {
        // continua
      }
    } else if (docTokenToDelete) {
      try {
        await supabase
          .from('matriculas_contratos')
          .delete()
          .eq('zapsign_doc_token', docTokenToDelete)
      } catch (e) {
        // continua
      }
    }

    // 5. Excluir da lista de fallback
    if (fallbackList.length > 0) {
      const filtered = fallbackList.filter((c: any) => {
        if (targetId && c.id === targetId) return false
        if (docTokenToDelete && c.zapsign_doc_token === docTokenToDelete) return false
        return true
      })

      await supabase
        .from('configuracoes')
        .upsert({
          chave: FALLBACK_KEY,
          valor: filtered,
          updated_at: new Date().toISOString()
        }, { onConflict: 'chave' })
    }

    return NextResponse.json({
      success: true,
      message: 'Contrato e documento no ZapSign excluídos com sucesso.',
      zapsignDeleted,
      zapsignError,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
