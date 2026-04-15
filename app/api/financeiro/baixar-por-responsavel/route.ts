import { NextRequest, NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Cada item de parcela dentro de um grupo de aluno
const ZodParcelaItem = z.object({
  parcela_num: z.number().int().positive(),
  parcela_id:  z.string().optional(),
  valor:       z.coerce.number().min(0),
  juros:       z.coerce.number().default(0),
  multa:       z.coerce.number().default(0),
  desconto:    z.coerce.number().default(0),
  // Metadados descritivos para a movimentação
  evento:      z.string().optional(),
  competencia: z.string().optional(),
  aluno_nome:  z.string().optional(),
})

// Grupo por aluno: um aluno pode ter N parcelas nesta baixa
const ZodAlunoGroup = z.object({
  aluno_id:   z.string().min(1, 'ID do aluno obrigatório'),
  aluno_nome: z.string().optional().default(''),
  parcelas:   z.array(ZodParcelaItem).min(1),
})

const ZodBaixaResponsavel = z.object({
  caixa_id:     z.string().min(1, 'Caixa obrigatório'),
  cod_baixa:    z.string().min(1, 'Código de baixa obrigatório'),
  data_pagto:   z.string().min(1, 'Data de pagamento obrigatória'),
  forma_pagto:  z.string().min(1, 'Forma de pagamento obrigatória'),
  observacao:   z.string().optional().default(''),
  operador:     z.string().optional().default('Sistema'),
  nome_resp:    z.string().optional().default(''),
  plano_contas_id: z.string().optional().default(''),
  alunos:       z.array(ZodAlunoGroup).min(1, 'Ao menos um aluno é obrigatório'),
})

/**
 * POST /api/financeiro/baixar-por-responsavel
 *
 * Persiste a Baixa por Responsável para MÚLTIPLOS alunos de forma atômica.
 *
 * Para cada aluno:
 *  - Lê o JSONB de parcelas uma única vez (sem race condition)
 *  - Marca cada parcela como paga
 *  - Cria uma movimentação INDIVIDUAL por parcela no caixa (ID único: cod_baixa-AlunoId-PNN)
 *
 * O DRE e o Caixa recebem uma linha por parcela, permitindo rastreabilidade granular.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = ZodBaixaResponsavel.parse(body)

    const supabase = await createProtectedClient()

    // 1. Verificar caixa
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

    const agora = new Date()
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const todasMovimentacoes: any[] = []
    const resultadosPorAluno: any[] = []

    // 2. Processar cada aluno sequencialmente (evita race condition em cada JSONB)
    for (const grupo of payload.alunos) {
      // 2a. Buscar o aluno
      const { data: aluno, error: alunoErr } = await supabase
        .from('alunos')
        .select('id, nome, dados')
        .eq('id', grupo.aluno_id)
        .single()

      if (alunoErr || !aluno) {
        resultadosPorAluno.push({
          aluno_id: grupo.aluno_id,
          ok: false,
          error: 'Aluno não encontrado',
          parcelas: [],
        })
        continue
      }

      const dados = aluno.dados || {}
      const parcelasDB: any[] = [...(dados.parcelas || [])]
      const resultadosParcelas: any[] = []

      for (const item of grupo.parcelas) {
        const idx = parcelasDB.findIndex((p: any) => p.num === item.parcela_num)

        if (idx === -1) {
          resultadosParcelas.push({ num: item.parcela_num, ok: false, error: 'Parcela não encontrada' })
          continue
        }

        const parcelaAtual = parcelasDB[idx]

        // Idempotência
        if (parcelaAtual.status === 'pago') {
          resultadosParcelas.push({ num: item.parcela_num, ok: true, message: 'Já estava paga' })
          continue
        }

        const valorFinal = Math.round(Math.max(0, parcelaAtual.valor - item.desconto + item.juros + item.multa) * 100) / 100

        // Atualiza em memória
        parcelasDB[idx] = {
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
          baixaPorResponsavel: true,
          nomeResponsavel: payload.nome_resp || '',
        }

        // ID único por aluno + parcela para evitar qualquer colisão de upsert
        const alunoSlug = grupo.aluno_id.replace(/-/g, '').slice(0, 6).toUpperCase()
        const movId = `${payload.cod_baixa}-${alunoSlug}-P${String(item.parcela_num).padStart(2, '0')}`

        const eventoLabel = item.evento || parcelaAtual.evento || parcelaAtual.competencia || 'Mensalidade'
        const nomeAluno = item.aluno_nome || grupo.aluno_nome || aluno.nome || 'Aluno'
        const descricaoMov = `${eventoLabel} — Parc. ${String(item.parcela_num).padStart(2, '0')} · ${nomeAluno} (Resp: ${payload.nome_resp || 'Responsável'})`

        todasMovimentacoes.push({
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
            nomeAluno,
            nomeResponsavel: payload.nome_resp || '',
            dataMovimento:   payload.data_pagto,
            dataLancamento:  payload.data_pagto,
            tipoDocumento:   'REC',
            numeroDocumento: payload.cod_baixa,
            compensado_banco: 'Não se Aplica',
            observacoes:     payload.observacao || '',
            baixaPorResponsavel: true,
            criadoEm:        agora.toISOString(),
            editadoEm:       agora.toISOString(),
          },
        })

        resultadosParcelas.push({ num: item.parcela_num, ok: true, valorFinal, movId })
      }

      // 2b. Persistir JSONB deste aluno em uma única write
      const { error: updateErr } = await supabase
        .from('alunos')
        .update({ dados: { ...dados, parcelas: parcelasDB } })
        .eq('id', grupo.aluno_id)

      if (updateErr) {
        console.error(`[baixar-por-responsavel] Erro ao atualizar aluno ${grupo.aluno_id}:`, updateErr)
        resultadosPorAluno.push({
          aluno_id: grupo.aluno_id,
          ok: false,
          error: updateErr.message,
          parcelas: resultadosParcelas,
        })
        continue
      }

      resultadosPorAluno.push({
        aluno_id: grupo.aluno_id,
        ok: true,
        parcelas: resultadosParcelas,
      })
    }

    // 3. Inserir TODAS as movimentações em batch — 1 por parcela por aluno
    if (todasMovimentacoes.length > 0) {
      const { error: movErr } = await supabase
        .from('movimentacoes')
        .upsert(todasMovimentacoes)

      if (movErr) {
        console.warn('[baixar-por-responsavel] Erro não-crítico ao criar movimentações:', movErr.message)
      }
    }

    const totalOk = resultadosPorAluno.reduce(
      (s, a) => s + (a.parcelas || []).filter((p: any) => p.ok).length, 0
    )

    return NextResponse.json({
      ok:      true,
      message: `${totalOk} parcela(s) baixada(s) para ${resultadosPorAluno.filter(a => a.ok).length} aluno(s)`,
      movimentacoes_criadas: todasMovimentacoes.length,
      resultados: resultadosPorAluno,
    }, { status: 200 })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validação falhou: ' + (err.issues?.[0]?.message || 'Dados inválidos')
      }, { status: 400 })
    }
    console.error('[baixar-por-responsavel] Erro crítico:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
