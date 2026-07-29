import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const from = (page - 1) * limit
    const to = from + limit - 1

    try {
      const { data, error, count } = await supabase
        .from('dre_uploads')
        .select('id, nome_arquivo, tipo_arquivo, periodo_descricao, periodo_inicio, periodo_fim, empresa, total_receitas, total_despesas, resultado_liquido, criado_em', { count: 'exact' })
        .order('criado_em', { ascending: false })
        .range(from, to)

      if (error) {
        console.warn('[DRE Histórico GET] Tabela dre_uploads não disponível:', error.message)
        return NextResponse.json({ data: [], total: 0, page, limit })
      }

      return NextResponse.json({ data: data || [], total: count || 0, page, limit })
    } catch (dbErr: any) {
      console.warn('[DRE Histórico GET] Exceção:', dbErr)
      return NextResponse.json({ data: [], total: 0, page, limit })
    }
  } catch (err: any) {
    console.error('[DRE Histórico GET] Erro de rotas:', err)
    return NextResponse.json({ data: [], total: 0, page: 1, limit: 50 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('dre_uploads')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DRE Histórico DELETE]', err)
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
  }
}

// Renomear arquivo no Supabase
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { id, novoNome } = await request.json()

    if (!id || !novoNome) {
      return NextResponse.json({ error: 'ID e Novo Nome são obrigatórios.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('dre_uploads')
      .update({ nome_arquivo: novoNome })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DRE Histórico PUT]', err)
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Ação: Salvar DRE explicitamente
    if (body.action === 'save') {
      const { nomeArquivo, dadosDRE, tipoArquivo = 'pdf' } = body
      const { data: userData } = await supabase.auth.getUser()

      const payload: any = {
        nome_arquivo: nomeArquivo || 'DRE - Relatório Analítico',
        tipo_arquivo: tipoArquivo,
        dados_dre: dadosDRE,
        periodo_descricao: dadosDRE?.periodo?.descricao || 'Análise Anual',
        empresa: dadosDRE?.empresa || 'Colégio Impacto',
        total_receitas: dadosDRE?.receitas?.total_geral || 0,
        total_despesas: dadosDRE?.despesas?.total_geral || 0,
        resultado_liquido: dadosDRE?.resultado_operacional || 0
      }

      if (userData?.user?.id) {
        payload.usuario_id = userData.user.id
      }

      const { data, error } = await supabase
        .from('dre_uploads')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        console.warn('Erro ao salvar DRE no Supabase:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, id: data.id })
    }

    // Ação Padrão: Carregar um DRE específico pelo ID
    const { id } = body
    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dre_uploads')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[DRE Histórico POST]', err)
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
  }
}
