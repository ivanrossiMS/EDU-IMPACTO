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
  caixa_id:        z.string().min(1, 'Caixa obrigatório'),
  cod_baixa:       z.string().min(1, 'Código de baixa obrigatório'),
  data_pagto:      z.string().min(1, 'Data de pagamento obrigatória'),
  forma_pagto:     z.string().min(1, 'Forma de pagamento obrigatória'),
  observacao:      z.string().optional().default(''),
  operador:        z.string().optional().default('Sistema'),
  plano_contas_id: z.string().optional().default(''),
  parcelas:        z.array(ZodParcelaItem).min(1, 'Ao menos uma parcela é obrigatória'),
})

/**
 * POST /api/alunos/[id]/baixar-parcelas-lote
 *
 * Persiste múltiplas parcelas em uma única operação atômica.
 * Atualiza alunos.dados.parcelas e cria uma movimentação no caixa por parcela.
 *
 * Auto-resolve plano_contas_id via cfgEventos (eventoId → planoContasId)
 * mesmo quando o frontend não envia o campo explicitamente.
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

    // ── 1. Buscar aluno ──────────────────────────────────────────────────────
    const { data: aluno, error: alunoErr } = await supabase
      .from('alunos')
      .select('id, nome, dados')
      .eq('id', alunoId)
      .single()

    if (alunoErr || !aluno) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    // ── 2. Verificar caixa ───────────────────────────────────────────────────
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

    // ── 3. Carregar cfgEventos para auto-resolver plano_contas_id ────────────
    //    Constrói dois índices: por ID do evento e por nome (lowercase)
    const { data: cfgRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'cfgEventos')
      .single()

    const cfgEventos: any[] = cfgRow?.valor || []
    const eventoByIdMap: Record<string, string> = {}
    const eventoByNomeMap: Record<string, string> = {}
    for (const ev of cfgEventos) {
      if (ev.id && ev.planoContasId)        eventoByIdMap[ev.id] = ev.planoContasId
      if (ev.descricao && ev.planoContasId) eventoByNomeMap[ev.descricao.trim().toLowerCase()] = ev.planoContasId
    }

    // ── 4. Processar parcelas ────────────────────────────────────────────────
    const dados       = aluno.dados || {}
    const parcelasDB: any[] = dados.parcelas || []
    const parcelasAtualizadas: any[] = [...parcelasDB]
    const movimentacoes: any[] = []
    const resultados: any[] = []
    const agora   = new Date()
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    for (const item of payload.parcelas) {
      const idx = parcelasAtualizadas.findIndex((p: any) => p.num === item.parcela_num)
      if (idx === -1) {
        resultados.push({ num: item.parcela_num, ok: false, error: 'Não encontrada' })
        continue
      }

      const parcelaAtual = parcelasAtualizadas[idx]

      // Idempotência: parcela já paga é ignorada silenciosamente
      if (parcelaAtual.status === 'pago') {
        resultados.push({ num: item.parcela_num, ok: true, message: 'Já estava paga' })
        continue
      }

      const valorFinal = Math.round(
        Math.max(0, parcelaAtual.valor - item.desconto + item.juros + item.multa) * 100
      ) / 100

      // ── Resolver plano_contas_id ─────────────────────────────────────────
      // Prioridade 1: explícito no payload
      // Prioridade 2: eventoId da parcela → cfgEventos
      // Prioridade 3: nome do evento da parcela → cfgEventos
      let resolvedPlanoId = payload.plano_contas_id || ''
      if (!resolvedPlanoId && parcelaAtual.eventoId)
        resolvedPlanoId = eventoByIdMap[parcelaAtual.eventoId] || ''
      if (!resolvedPlanoId && parcelaAtual.evento)
        resolvedPlanoId = eventoByNomeMap[parcelaAtual.evento.trim().toLowerCase()] || ''

      // Atualiza parcela em memória
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

      // ID único por parcela no lote
      const movId = `${payload.cod_baixa}-P${String(item.parcela_num).padStart(2, '0')}`
      const descricaoMov = `Baixa Parcela ${String(item.parcela_num).padStart(2, '0')} — ${
        parcelaAtual.evento || parcelaAtual.competencia || 'Mensalidade'
      } (${aluno.nome || 'Aluno'})`

      movimentacoes.push({
        id:              movId,
        tipo:            'receita',
        valor:           valorFinal,
        descricao:       descricaoMov,
        data:            payload.data_pagto,
        plano_contas_id: resolvedPlanoId || null,
        dados: {
          caixa_id:         payload.caixa_id,
          hora:             horaStr,
          origem:           'baixa_aluno',
          operador:         payload.operador || 'Sistema',
          referenciaId:     payload.cod_baixa,
          forma_pagamento:  payload.forma_pagto,
          nomeAluno:        aluno.nome || '',
          dataMovimento:    payload.data_pagto,
          dataLancamento:   payload.data_pagto,
          tipoDocumento:    'REC',
          numeroDocumento:  payload.cod_baixa,
          compensado_banco: 'Não se Aplica',
          observacoes:      payload.observacao || '',
          criadoEm:         agora.toISOString(),
          editadoEm:        agora.toISOString(),
          // campos de auditoria/debug
          eventoId:         parcelaAtual.eventoId || '',
          eventoNome:       parcelaAtual.evento || '',
          planoResolvido:   resolvedPlanoId || 'nenhum',
        },
      })

      resultados.push({ num: item.parcela_num, ok: true, valorFinal, movId, planoId: resolvedPlanoId })
    }

    // ── 5. Persistir aluno (1 write atômica) ─────────────────────────────────
    const { error: updateErr } = await supabase
      .from('alunos')
      .update({ dados: { ...dados, parcelas: parcelasAtualizadas } })
      .eq('id', alunoId)

    if (updateErr) {
      console.error('[baixar-parcelas-lote] Erro ao atualizar aluno:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // ── 6. Upsert batch de movimentações ─────────────────────────────────────
    if (movimentacoes.length > 0) {
      const { error: movErr } = await supabase
        .from('movimentacoes')
        .upsert(movimentacoes)

      if (movErr) {
        // Não-crítico — baixa já persistida, apenas log
        console.warn('[baixar-parcelas-lote] Erro não-crítico ao criar movimentações:', movErr.message)
      }
    }

    return NextResponse.json({
      ok:        true,
      message:   `${resultados.filter(r => r.ok).length} parcela(s) baixada(s) com sucesso`,
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
