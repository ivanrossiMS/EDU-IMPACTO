import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await request.json()
    const { descricao, categoria, valor, vencimento, status, fornecedor, numeroDocumento, planoContasId, dataPagamento, valorPago, desconto, juros, multa, obs, caixaId, tipoDocBaixa, planoContasBaixa, composicaoBaixa, ...rest } = body
    
    // We update explicit columns if they are present in body, or merge into `dados` JSONB
    const row: any = {}
    if (descricao !== undefined) row.descricao = descricao
    if (categoria !== undefined) row.categoria = categoria
    if (valor !== undefined) row.valor = valor
    if (vencimento !== undefined) row.vencimento = vencimento
    if (status !== undefined) row.status = status
    if (fornecedor !== undefined) row.fornecedor = fornecedor
    if (numeroDocumento !== undefined) row.numero_documento = numeroDocumento
    if (planoContasId !== undefined) row.plano_contas_id = planoContasId
    
    // The rest falls into "dados" field dynamically. We fetch the old one to preserve.
    const { data: oldData } = await supabaseServer.from('contas_pagar').select('dados').eq('id', id).single()
    const currentDados = oldData?.dados || {}
    
    row.dados = {
      ...currentDados,
      ...rest,
    }

    if (dataPagamento !== undefined) row.dados.dataPagamento = dataPagamento
    if (valorPago !== undefined) row.dados.valorPago = valorPago
    if (desconto !== undefined) row.dados.desconto = desconto
    if (juros !== undefined) row.dados.juros = juros
    if (multa !== undefined) row.dados.multa = multa
    if (obs !== undefined) row.dados.obs = obs
    if (caixaId !== undefined) row.dados.caixaId = caixaId
    if (tipoDocBaixa !== undefined) row.dados.tipoDocBaixa = tipoDocBaixa
    if (planoContasBaixa !== undefined) row.dados.planoContasBaixa = planoContasBaixa
    if (composicaoBaixa !== undefined) row.dados.composicaoBaixa = composicaoBaixa
    
    row.updated_at = new Date().toISOString()

    const { data, error } = await supabaseServer.from('contas_pagar').update(row).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabaseServer.from('contas_pagar').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
