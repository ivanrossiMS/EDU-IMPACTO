import { NextRequest, NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ZodEstorno = z.object({
  aluno_id:        z.string().min(1, 'ID do aluno obrigatório'),
  parcela_nums:    z.array(z.number().int().positive()).min(1, 'Ao menos uma parcela'),
  cod_baixa_codes: z.array(z.string()).min(1, 'Ao menos um código de baixa'),
})

/**
 * POST /api/financeiro/estornar-baixa
 *
 * Estorna baixas de um aluno de forma atômica:
 *  1. Marca as parcelas como 'pendente' no JSONB alunos.dados (cascateia por codBaixa)
 *  2. Deleta as movimentações do caixa cujo ID começa com o código de baixa (padrão CODXXX-PNN)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { aluno_id, parcela_nums, cod_baixa_codes } = ZodEstorno.parse(body)

    const supabase = await createProtectedClient()

    // ── 1. Buscar aluno ───────────────────────────────────────────────────────
    const { data: aluno, error: alunoErr } = await supabase
      .from('alunos')
      .select('id, dados')
      .eq('id', aluno_id)
      .single()

    if (alunoErr || !aluno) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    const dados  = aluno.dados || {}
    const parcelasDB: any[] = dados.parcelas || []

    let parcelasEstornadas = 0

    // ── 2. Reverter parcelas afetadas para 'pendente' ─────────────────────────
    // Cascateia: qualquer parcela cujo codBaixa esteja na lista de estorno
    // (cobre lote BX...LL, responsável BR..., e avulsa BX...)
    const parcelasAtualizadas = parcelasDB.map((p: any) => {
      const estaNoEstorno    = parcela_nums.includes(Number(p.num))
      const codBaixaAfetado  = p.codBaixa && cod_baixa_codes.includes(p.codBaixa)

      if ((estaNoEstorno || codBaixaAfetado) && p.status === 'pago') {
        parcelasEstornadas++
        return {
          ...p,
          status:              'pendente',
          dtPagto:             undefined,
          formaPagto:          undefined,
          codBaixa:            undefined,
          valorFinal:          p.valor,      // restaura valor original
          juros:               0,
          multa:               0,
          desconto:            0,
          comprovante:         undefined,
          formasPagto:         undefined,
          parcelasVinculadas:  undefined,    // ← limpa vínculos antigos
          baixaPorResponsavel: undefined,
          nomeResponsavel:     undefined,
        }
      }
      return p
    })

    // ── 3. Persistir JSONB do aluno ───────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('alunos')
      .update({ dados: { ...dados, parcelas: parcelasAtualizadas } })
      .eq('id', aluno_id)

    if (updateErr) {
      console.error('[estornar-baixa] Erro ao atualizar aluno:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // ── 4. Deletar movimentações pelo padrão de ID ────────────────────────────
    // IDs seguem padrão: codBaixa, codBaixa-PNN, codBaixa-ALUSLUG-PNN
    // Usar LIKE 'codBaixa%' captura TODOS os formatos de forma robusta
    let movimentacoesDeleted = 0

    for (const code of cod_baixa_codes) {
      // Busca por ID usando LIKE: pega codBaixa exato E todos os sufixos (-P01, -SLUG-P01…)
      const { data: movsExatos } = await supabase
        .from('movimentacoes')
        .select('id')
        .or(`id.eq.${code},id.like.${code}-%`)

      if (movsExatos && movsExatos.length > 0) {
        const ids = movsExatos.map((m: any) => m.id)
        const { error: delErr } = await supabase
          .from('movimentacoes')
          .delete()
          .in('id', ids)

        if (delErr) {
          console.warn(`[estornar-baixa] Erro ao deletar movimentações de ${code}:`, delErr.message)
        } else {
          movimentacoesDeleted += ids.length
        }
      }
    }

    return NextResponse.json({
      ok:                      true,
      message:                 `${parcelasEstornadas} parcela(s) estornada(s), ${movimentacoesDeleted} movimentação(ões) removida(s)`,
      parcelas_estornadas:     parcelasEstornadas,
      movimentacoes_deletadas: movimentacoesDeleted,
    })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validação: ' + (err.issues?.[0]?.message || 'Dados inválidos')
      }, { status: 400 })
    }
    console.error('[estornar-baixa] Erro crítico:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
