import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ZodEstorno = z.object({
  aluno_id:        z.string().min(1, 'ID do aluno obrigatório'),
  parcela_nums:    z.array(z.number().int().positive()).min(1, 'Ao menos uma parcela'),
  cod_baixa_codes: z.array(z.string().regex(/^[A-Za-z0-9_-]{2,80}$/, 'Código de baixa inválido')).min(1, 'Ao menos um código de baixa'),
  motivo:          z.string().optional(),
  parcela_id:      z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, 'ID de parcela inválido').optional(),
})

/**
 * POST /api/financeiro/estornar-baixa
 *
 * Estorna baixas de um aluno de forma atômica:
 *  1. Marca as parcelas como 'pendente' no JSONB alunos.dados (cascateia por codBaixa)
 *  2. Deleta as movimentações do caixa cujo ID começa com o código de baixa (padrão CODXXX-PNN)
 *  3. Marca recibos associados em financial_receipts como 'estornado'
 */
export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { aluno_id, parcela_nums, cod_baixa_codes, motivo: motivoRaw, parcela_id } = ZodEstorno.parse(body)
    const motivo = motivoRaw || 'Estorno de baixa financeira'

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

    if (cod_baixa_codes.length > 0) {
      // Cria uma string de OR: "id.eq.COD1,id.like.COD1-%,id.eq.COD2,id.like.COD2-%..."
      const orClauses = cod_baixa_codes.map((code: string) => `id.eq.${code},id.like.${code}-%`).join(',')
      
      const { data: movsExatos, error: selectErr } = await supabase
        .from('movimentacoes')
        .select('id')
        .or(orClauses)

      if (!selectErr && movsExatos && movsExatos.length > 0) {
        const ids = movsExatos.map((m: any) => m.id)
        const { error: delErr } = await supabase
          .from('movimentacoes')
          .delete()
          .in('id', ids)

        if (delErr) {
          console.warn(`[estornar-baixa] Erro ao deletar movimentações:`, delErr.message)
        } else {
          movimentacoesDeleted = ids.length
        }
      }
    }

    // ── 5. Atualizar recibos financeiros (financial_receipts) ─────────────────
    const reversedAt = new Date().toISOString()
    try {
      const receiptOrParts = [
        ...cod_baixa_codes.map((code: string) => `baixa_id.eq.${code},baixa_id.like.${code}-%`),
        ...(parcela_id ? [`parcela_id.eq.${parcela_id}`, `baixa_id.eq.${parcela_id}`] : []),
      ].join(',')

      if (receiptOrParts) {
        const { error: recErr } = await supabase
          .from('financial_receipts')
          .update({
            status: 'estornado',
            receipt_status: 'estornado',
            is_active: false,
            reversal_reason: motivo,
            reversed_at: reversedAt,
            updated_at: reversedAt,
          })
          .or(receiptOrParts)

        if (recErr) {
          const fallbackOr = cod_baixa_codes.map((code: string) => `baixa_id.eq.${code},baixa_id.like.${code}-%`).join(',')
          if (fallbackOr) {
            await supabase
              .from('financial_receipts')
              .update({
                receipt_status: 'estornado',
                is_active: false,
                cancellation_reason: motivo,
                reversed_at: reversedAt,
                updated_at: reversedAt,
              })
              .or(fallbackOr)
          }
        }
      }
    } catch (recEx) {
      console.warn('[estornar-baixa] Aviso ao atualizar financial_receipts:', recEx)
    }

    // ── 6. Sincronizar overrides e movimentações manuais de caixa ────────────
    try {
      const { data: cfgRows } = await supabase
        .from('configuracoes_sistema')
        .select('chave, dados')
        .in('chave', ['fin_movimentacoes_caixa_v1', 'fin_movimentacoes_overrides_v1', 'cfgMovimentacoesManuais'])

      const mapCfg = new Map<string, any>()
      ;(cfgRows || []).forEach((r: any) => mapCfg.set(r.chave, r.dados))

      const movsCaixa = Array.isArray(mapCfg.get('fin_movimentacoes_caixa_v1'))
        ? mapCfg.get('fin_movimentacoes_caixa_v1')
        : []
      const filteredCaixa = movsCaixa.filter((m: any) => {
        if (parcela_id && (m.id === parcela_id || m.id === `REC-${parcela_id}`)) return false
        return !cod_baixa_codes.some((code: string) => String(m.id || '').startsWith(code))
      })
      if (filteredCaixa.length !== movsCaixa.length) {
        await supabase
          .from('configuracoes_sistema')
          .upsert({ chave: 'fin_movimentacoes_caixa_v1', dados: filteredCaixa }, { onConflict: 'chave' })
      }

      const cfgManuais = Array.isArray(mapCfg.get('cfgMovimentacoesManuais'))
        ? mapCfg.get('cfgMovimentacoesManuais')
        : []
      const filteredManuais = cfgManuais.filter((m: any) => {
        if (parcela_id && (m.id === parcela_id || m.id === `REC-${parcela_id}`)) return false
        return !cod_baixa_codes.some((code: string) => String(m.id || '').startsWith(code))
      })
      if (filteredManuais.length !== cfgManuais.length) {
        await supabase
          .from('configuracoes_sistema')
          .upsert({ chave: 'cfgMovimentacoesManuais', dados: filteredManuais }, { onConflict: 'chave' })
      }

      if (parcela_id) {
        const overrides = (mapCfg.get('fin_movimentacoes_overrides_v1') && typeof mapCfg.get('fin_movimentacoes_overrides_v1') === 'object')
          ? { ...mapCfg.get('fin_movimentacoes_overrides_v1') }
          : {}
        overrides[`REC-${parcela_id}`] = { ...(overrides[`REC-${parcela_id}`] || {}), estornado: true, estornadoEm: reversedAt, motivoEstorno: motivo }
        overrides[parcela_id] = { ...(overrides[parcela_id] || {}), estornado: true, estornadoEm: reversedAt, motivoEstorno: motivo }
        await supabase
          .from('configuracoes_sistema')
          .upsert({ chave: 'fin_movimentacoes_overrides_v1', dados: overrides }, { onConflict: 'chave' })
      }
    } catch (syncEx) {
      console.warn('[estornar-baixa] Aviso ao sincronizar configuracoes_sistema:', syncEx)
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
