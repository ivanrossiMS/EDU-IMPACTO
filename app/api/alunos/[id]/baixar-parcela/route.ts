import { NextRequest, NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ZodBaixaParcela = z.object({
  parcela_num:   z.number().int().positive('Número da parcela inválido'),
  parcela_id:    z.string().optional(), // parcelaId (ex: XFPXT3-01)
  caixa_id:      z.string().min(1, 'Caixa é obrigatório'),
  valor:         z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  data_pagto:    z.string().min(1, 'Data de pagamento obrigatória'),
  forma_pagto:   z.string().min(1, 'Forma de pagamento obrigatória'),
  cod_baixa:     z.string().min(1, 'Código de baixa obrigatório'),
  juros:         z.coerce.number().default(0),
  multa:         z.coerce.number().default(0),
  desconto:      z.coerce.number().default(0),
  observacao:    z.string().optional().default(''),
  plano_contas_id: z.string().optional().default(''),
  operador:      z.string().optional().default('Sistema'),
})

/**
 * PATCH /api/alunos/[id]/baixar-parcela
 *
 * Persiste a baixa de uma parcela do JSONB do aluno no banco de dados.
 * Atualiza alunos.dados.parcelas e cria movimentação no caixa.
 *
 * Usado por: Baixa Normal, Baixa em Lote, Baixa por Responsável
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: alunoId } = await params
    if (!alunoId) {
      return NextResponse.json({ error: 'ID do aluno é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const payload = ZodBaixaParcela.parse(body)

    const supabase = await createProtectedClient()

    // 1. Buscar aluno atual
    const { data: aluno, error: alunoErr } = await supabase
      .from('alunos')
      .select('id, nome, dados')
      .eq('id', alunoId)
      .single()

    if (alunoErr || !aluno) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    const dados = aluno.dados || {}
    const parcelas: any[] = dados.parcelas || []

    // 2. Encontrar a parcela pelo número
    const parcelaIdx = parcelas.findIndex(
      (p: any) => p.num === payload.parcela_num
    )

    if (parcelaIdx === -1) {
      return NextResponse.json({ error: `Parcela ${payload.parcela_num} não encontrada` }, { status: 404 })
    }

    const parcelaAtual = parcelas[parcelaIdx]

    // 3. Verificar se já está paga (idempotência)
    if (parcelaAtual.status === 'pago') {
      return NextResponse.json({
        ok: true,
        message: 'Parcela já estava paga — idempotência garantida',
        parcela: parcelaAtual
      })
    }

    // 4. Verificar caixa (não-bloqueante — o frontend já tem validação)
    // Só bloqueia se o caixa existir E estiver explicitamente fechado
    if (payload.caixa_id) {
      const { data: caixa } = await supabase
        .from('caixas')
        .select('id, fechado')
        .eq('id', payload.caixa_id)
        .single()

      if (caixa?.fechado === true) {
        return NextResponse.json({ error: 'O caixa está fechado e não pode receber movimentações' }, { status: 400 })
      }
    }

    // 5. Calcular valor final real
    const valorFinal = Math.max(0, parcelaAtual.valor - payload.desconto + payload.juros + payload.multa)

    // 6. Atualizar a parcela no array JSONB
    const novasParcelas = parcelas.map((p: any, idx: number) => {
      if (idx !== parcelaIdx) return p
      return {
        ...p,
        status:      'pago',
        dtPagto:     payload.data_pagto,
        formaPagto:  payload.forma_pagto,
        codBaixa:    payload.cod_baixa,
        valorFinal:  valorFinal,
        juros:       payload.juros,
        multa:       payload.multa,
        desconto:    payload.desconto,
        obs:         payload.observacao || p.obs || '',
      }
    })

    // 7. Persistir no banco
    const { error: updateErr } = await supabase
      .from('alunos')
      .update({ dados: { ...dados, parcelas: novasParcelas } })
      .eq('id', alunoId)

    if (updateErr) {
      console.error('[baixar-parcela] Erro ao atualizar aluno:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // 8. Criar movimentação no caixa (lastro fiscal)
    const parcelaAtualizada = novasParcelas[parcelaIdx]
    const movId = payload.cod_baixa // usa o mesmo código como ID da movimentação

    const descricaoMov = `Baixa Parcela ${String(payload.parcela_num).padStart(2, '0')} — ${parcelaAtual.evento || parcelaAtual.competencia || 'Mensalidade'} (${aluno.nome || 'Aluno'})`

    const agora = new Date()
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const { error: movErr } = await supabase
      .from('movimentacoes')
      .upsert({
        id:      movId,
        tipo:    'receita',
        valor:   valorFinal,
        descricao: descricaoMov,
        data:    payload.data_pagto,
        plano_contas_id: payload.plano_contas_id || null,
        dados: {
          hora:            horaStr,
          origem:          'baixa_aluno',
          caixa_id:        payload.caixa_id,
          operador:        payload.operador || 'Sistema',
          referenciaId:    payload.cod_baixa,
          forma_pagamento: payload.forma_pagto,
          nomeAluno:       aluno.nome || '',
          dataMovimento:   payload.data_pagto,
          dataLancamento:  payload.data_pagto,
          tipoDocumento:   'REC',
          numeroDocumento: payload.cod_baixa,
          plano_contas_id: payload.plano_contas_id || null,
          compensado_banco: 'Não se Aplica',
          observacoes:     payload.observacao || '',
          criadoEm:        agora.toISOString(),
          editadoEm:       agora.toISOString(),
        }
      })

    if (movErr) {
      // Movimentação é não-crítica — não reverte a baixa
      console.warn('[baixar-parcela] Erro não-crítico ao criar movimentação:', movErr.message)
    }

    return NextResponse.json({
      ok:      true,
      message: `Parcela ${payload.parcela_num} baixada com sucesso`,
      parcela: parcelaAtualizada,
      movimentacao_id: movId,
    }, { status: 200 })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validação falhou: ' + (err.issues?.[0]?.message || 'Dados inválidos')
      }, { status: 400 })
    }
    console.error('[baixar-parcela] Erro crítico:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
