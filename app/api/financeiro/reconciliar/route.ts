import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/financeiro/reconciliar
 *
 * Reconcilia a tabela `movimentacoes` com os dados reais de parcelas dos alunos.
 * Usa MÚLTIPLAS fontes de verdade para identificar codBaixas válidos.
 */
export async function POST() {
  const supabase = await createProtectedClient();
  try {
    const codBaixasPagos = new Set<string>()

    // Fonte 1: Alunos → dados.parcelas ou parcelas raiz
    const { data: alunos } = await supabase.from('alunos').select('id, dados')
    for (const aluno of (alunos || [])) {
      const dados = aluno.dados || {}
      // Tentar em dados.parcelas e dados.financeiro.parcelas
      const parcelas: any[] = dados.parcelas || dados.financeiro?.parcelas || []
      for (const p of parcelas) {
        if (p.status === 'pago' && p.codBaixa) {
          const cb: string = p.codBaixa
          codBaixasPagos.add(cb)
          // Adicionar variantes de sufixo para baixas em lote (codBaixa-0, -1, etc)
          for (let i = 0; i <= 9; i++) codBaixasPagos.add(`${cb}-${i}`)
        }
      }
    }

    // Fonte 2: Títulos pagos no banco (podem ter nossoNumero ou codBaixa)
    const { data: titulos } = await supabase
      .from('titulos')
      .select('id, dados')
      .eq('status', 'pago')
    for (const t of (titulos || [])) {
      const dados = t.dados || {}
      ;[dados.codBaixa, dados.referenciaId, dados.nossoNumero].forEach((cb: string) => {
        if (cb) { codBaixasPagos.add(cb); for (let i=0;i<=9;i++) codBaixasPagos.add(`${cb}-${i}`) }
      })
    }

    // Fonte 3: Qualquer movimentacao que foi gerada pelo proprio sistema e esta no banco
    // Considera que referenciaId==id é válido se a parcela do aluno ainda está paga
    const { data: movs } = await supabase.from('movimentacoes').select('*')
    const todasMovs = (movs || []).map(m => ({ ...m, ...(m.dados || {}) }))

    const movsBaixa = todasMovs.filter((m: any) =>
      ['baixa_aluno', 'baixa_pagar', 'baixa_receber'].includes(m.origem)
    )

    const orphanIds: string[] = []
    const keptIds: string[] = []

    for (const m of movsBaixa) {
      const ref: string = m.referenciaId || m.id || ''
      // Extrair base da ref (ex: "BX123456-0" → "BX123456")
      const baseRef = ref.replace(/-\d+$/, '')
      const isValid = codBaixasPagos.has(ref) ||
        codBaixasPagos.has(baseRef) ||
        [...codBaixasPagos].some(c => c === ref || c === baseRef || ref.startsWith(c + '-'))

      if (isValid) {
        keptIds.push(m.id)
      } else {
        orphanIds.push(m.id)
      }
    }

    // Deletar órfãs em lotes de 100
    let totalDeleted = 0
    const BATCH = 100
    for (let i = 0; i < orphanIds.length; i += BATCH) {
      const batch = orphanIds.slice(i, i + BATCH)
      const { error: delErr } = await supabase.from('movimentacoes').delete().in('id', batch)
      if (!delErr) totalDeleted += batch.length
      else console.error('Batch delete error:', delErr.message)
    }

    return NextResponse.json({
      ok: true,
      deleted: totalDeleted,
      kept: keptIds.length,
      orphans: orphanIds,
      totalBaixas: movsBaixa.length,
      codBaixasPagos: codBaixasPagos.size,
    })
  } catch (e: any) {
    console.error('/api/financeiro/reconciliar error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


/**
 * DELETE /api/financeiro/reconciliar
 * Opção nuclear: apaga TODAS as movimentacoes de baixa automática.
 * Use somente se a reconciliação normal falhar.
 */
export async function DELETE() {
  const supabase = await createProtectedClient();
  try {
    // Busca todas as movimentacoes com origem de baixa automática
    const { data: movs } = await supabase
      .from('movimentacoes')
      .select('id, dados')

    const idsParaDeletar = (movs || [])
      .filter((m: any) => {
        const origem = m.dados?.origem || ''
        return ['baixa_aluno', 'baixa_pagar', 'baixa_receber'].includes(origem)
      })
      .map((m: any) => m.id)

    if (idsParaDeletar.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0, message: 'Nada para deletar' })
    }

    const BATCH = 100
    let totalDeleted = 0
    for (let i = 0; i < idsParaDeletar.length; i += BATCH) {
      const batch = idsParaDeletar.slice(i, i + BATCH)
      const { error } = await supabase.from('movimentacoes').delete().in('id', batch)
      if (!error) totalDeleted += batch.length
    }

    return NextResponse.json({ ok: true, deleted: totalDeleted })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
