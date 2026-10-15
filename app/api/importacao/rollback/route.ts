import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const { batchId } = await request.json()

    if (!batchId) {
      return NextResponse.json({ error: 'batchId é obrigatório' }, { status: 400 })
    }

    // 1. Buscar metadados do lote na tabela configuracoes
    const { data: configData, error: configError } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', `import_batch_${batchId}`)
      .maybeSingle()

    if (configError || !configData) {
      return NextResponse.json({ error: 'Lote de importação não encontrado ou expirado' }, { status: 404 })
    }

    const batch = configData.valor as {
      id: string
      status: string
      alunoIdsCriados: string[]
      alunoIdsAtualizados: string[]
      respIdsCriados: string[]
      vinculoIdsCriados: string[]
      alunosInativados: string[]
      previousSnapshots?: Record<string, any>
    }

    if (batch.status === 'revertido') {
      return NextResponse.json({ error: 'Este lote já foi revertido anteriormente' }, { status: 400 })
    }

    let revertedAlunos = 0
    let revertedResps = 0
    let revertedInativados = 0

    // 2. Remover vínculos de responsáveis criados neste lote
    if (batch.vinculoIdsCriados && batch.vinculoIdsCriados.length > 0) {
      await supabase
        .from('aluno_responsavel')
        .delete()
        .in('id', batch.vinculoIdsCriados)
    }

    // 3. Remover alunos que foram inseridos como novos neste lote
    if (batch.alunoIdsCriados && batch.alunoIdsCriados.length > 0) {
      const { error: delAlunosError } = await supabase
        .from('alunos')
        .delete()
        .in('id', batch.alunoIdsCriados)

      if (!delAlunosError) {
        revertedAlunos += batch.alunoIdsCriados.length
      }
    }

    // 4. Reativar alunos que haviam sido inativados pelo checkbox "inativar ausentes"
    if (batch.alunosInativados && batch.alunosInativados.length > 0) {
      const { error: reactivateError } = await supabase
        .from('alunos')
        .update({ status: 'matriculado' })
        .in('id', batch.alunosInativados)

      if (!reactivateError) {
        revertedInativados += batch.alunosInativados.length
      }
    }

    // 5. Restaurar dados anteriores dos alunos atualizados (se houver snapshot)
    if (batch.previousSnapshots) {
      for (const [alunoId, snapshot] of Object.entries(batch.previousSnapshots)) {
        await supabase
          .from('alunos')
          .update(snapshot)
          .eq('id', alunoId)
      }
    }

    // 6. Remover responsáveis criados que não tenham outros vínculos restantes
    if (batch.respIdsCriados && batch.respIdsCriados.length > 0) {
      for (const respId of batch.respIdsCriados) {
        const { count } = await supabase
          .from('aluno_responsavel')
          .select('id', { count: 'exact', head: true })
          .eq('responsavel_id', respId)

        if (count === 0) {
          await supabase.from('responsaveis').delete().eq('id', respId)
          revertedResps++
        }
      }
    }

    // 7. Atualizar status do lote para 'revertido'
    batch.status = 'revertido'
    await supabase
      .from('configuracoes')
      .update({ valor: batch, updated_at: new Date().toISOString() })
      .eq('chave', `import_batch_${batchId}`)

    // 8. Atualizar índice de lotes
    const { data: indexConfig } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'import_batches_list')
      .maybeSingle()

    if (indexConfig?.valor && Array.isArray(indexConfig.valor)) {
      const updatedList = indexConfig.valor.map((item: any) =>
        item.id === batchId ? { ...item, status: 'revertido' } : item
      )
      await supabase
        .from('configuracoes')
        .update({ valor: updatedList, updated_at: new Date().toISOString() })
        .eq('chave', 'import_batches_list')
    }

    return NextResponse.json({
      success: true,
      message: `Lote ${batchId} revertido com sucesso!`,
      details: {
        alunosRemovidos: revertedAlunos,
        alunosReativados: revertedInativados,
        responsaveisRemovidos: revertedResps
      }
    })
  } catch (e: any) {
    console.error('[POST /api/importacao/rollback]', e)
    return NextResponse.json({ error: e.message || 'Erro ao reverter importação' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'import_batches_list')
      .maybeSingle()

    const list = Array.isArray(data?.valor) ? data.valor : []
    return NextResponse.json({ batches: list })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
