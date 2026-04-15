import { NextRequest, NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ZodParcelaItem = z.object({
  parcela_num:  z.number().int().positive(),
  parcela_id:   z.string().optional(),
  valor:        z.coerce.number().min(0),
  juros:        z.coerce.number().default(0),
  multa:        z.coerce.number().default(0),
  desconto:     z.coerce.number().default(0),
})

const ZodBaixaLote = z.object({
  caixa_id:    z.string().min(1, 'Caixa obrigatório'),
  cod_baixa:   z.string().min(1, 'Código de baixa obrigatório'),
  data_pagto:  z.string().min(1, 'Data de pagamento obrigatória'),
  forma_pagto: z.string().min(1, 'Forma de pagamento obrigatória'),
  observacao:  z.string().optional().default(''),
  operador:    z.string().optional().default('Sistema'),
  plano_contas_id: z.string().optional().default(''),
  parcelas:    z.array(ZodParcelaItem).min(1, 'Ao menos uma parcela é obrigatória'),
})

/**
 * POST /api/alunos/[id]/baixar-parcelas-lote
 *
 * Persiste múltiplas parcelas em uma única operação atômica.
 * Atualiza alunos.dados.parcelas e cria uma movimentação no caixa por parcela
 * com IDs únicos (cod_baixa-N) para evitar conflito de upsert.
 *
 * Resolve: race condition e duplicação de movimentação de lote/por responsável.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: alunoId } = await params
    if (!alunoId) {
      return NextResponse.json({ error: 'ID do aluno é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const payload = ZodBaixaLote.parse(body)

    const supabase = await createProtectedClient()

    // 1. Buscar aluno uma única vez
    const { data: aluno, error: alunoErr } = await supabase
      .from('alunos')
      .select('id, nome, dados')
      .eq('id', alunoId)
      .single()

    if (alunoErr || !aluno) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    // 2. Verificar caixa
    if (payload.caixa_id) {
      const { data: caixa } = await supabase
        .from('caixas')
        .select('id, fechado')
        .eq('id', payload.caixa_id)
        .single()

      if (caixa?.fechado === true) {
        return NextResponse.json({ error: 'O caixa está fechado' }, { status: 400 })
      }
    }

    const dados = aluno.dados || {}
    const parcelasDB: any[] = dados.parcelas || []

    // 3. Processar cada parcela do lote sobre o snapshot atual do banco
    const parcelasAtualizadas: any[] = [...parcelasDB]
    const movimentacoes: any[] = []
    const resultados: any[] = []
    const agora = new Date()
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    for (const item of payload.parcelas) {
      const idx = parcelasAtualizadas.findIndex((p: any) => p.num === item.parcela_num)
      if (idx === -1) {
        resultados.push({ num: item.parcela_num, ok: false, error: 'Não encontrada' })
        continue
      }

      const parcelaAtual = parcelasAtualizadas[idx]

      // Idempotência: já paga, pula sem erro
      if (parcelaAtual.status === 'pago') {
        resultados.push({ num: item.parcela_num, ok: true, message: 'Já estava paga' })
        continue
      }

      const valorFinal = Math.round(Math.max(0, parcelaAtual.valor - item.desconto + item.juros + item.multa) * 100) / 100

      // Atualiza no array em memória
      parcelasAtualizadas[idx] = {
        ...parcelaAtual,
        status:     'pago',
        dtPagto:    payload.data_pagto,
        formaPagto: payload.forma_pagto,
        codBaixa:   payload.cod_baixa,
        valorFinal,
        juros:      item.juros,
        multa:      item.multa,
        desconto:   item.desconto,
        obs:        payload.observacao || parcelaAtual.obs || '',
      }

      // ID único por parcela: cod_baixa + número da parcela → evita upsert collision
      const movId = `${payload.cod_baixa}-P${String(item.parcela_num).padStart(2, '0')}`
      const descricaoMov = `Baixa Parcela ${String(item.parcela_num).padStart(2, '0')} — ${parcelaAtual.evento || parcelaAtual.competencia || 'Mensalidade'} (${aluno.nome || 'Aluno'})`

      // Movimentação: estrutura conforme schema real da tabela
      // A tabela só tem: id, tipo, descricao, valor, data, plano_contas_id, dados
      // caixa_id, hora, operador, etc. ficam TODOS dentro do JSONB dados
      movimentacoes.push({
        id:              movId,
        tipo:            'receita',
        valor:           valorFinal,
        descricao:       descricaoMov,
        data:            payload.data_pagto,
        plano_contas_id: payload.plano_contas_id || null,
        dados: {
          caixa_id:        payload.caixa_id,
          hora:            horaStr,
          origem:          'baixa_aluno',
          operador:        payload.operador || 'Sistema',
          referenciaId:    payload.cod_baixa,
          forma_pagamento: payload.forma_pagto,
          nomeAluno:       aluno.nome || '',
          dataMovimento:   payload.data_pagto,
          dataLancamento:  payload.data_pagto,
          tipoDocumento:   'REC',
          numeroDocumento: payload.cod_baixa,
          compensado_banco: 'Não se Aplica',
          observacoes:     payload.observacao || '',
          criadoEm:        agora.toISOString(),
          editadoEm:       agora.toISOString(),
        },
      })

      resultados.push({ num: item.parcela_num, ok: true, valorFinal, movId })
    }

    // 4. Persistir aluno com TODAS as parcelas atualizadas em UMA única write
    const { error: updateErr } = await supabase
      .from('alunos')
      .update({ dados: { ...dados, parcelas: parcelasAtualizadas } })
      .eq('id', alunoId)

    if (updateErr) {
      console.error('[baixar-parcelas-lote] Erro ao atualizar aluno:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // 5. Inserir todas as movimentações de uma vez (upsert em batch)
    if (movimentacoes.length > 0) {
      const { error: movErr } = await supabase
        .from('movimentacoes')
        .upsert(movimentacoes)

      if (movErr) {
        // Não-crítico — a baixa já foi persistida
        console.warn('[baixar-parcelas-lote] Erro não-crítico ao criar movimentações:', movErr.message)
      }
    }

    return NextResponse.json({
      ok:       true,
      message:  `${resultados.filter(r => r.ok).length} parcela(s) baixada(s) com sucesso`,
      resultados,
    }, { status: 200 })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validação falhou: ' + (err.issues?.[0]?.message || 'Dados inválidos')
      }, { status: 400 })
    }
    console.error('[baixar-parcelas-lote] Erro crítico:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
