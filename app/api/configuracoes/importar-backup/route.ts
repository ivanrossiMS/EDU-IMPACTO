import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Mapeamento de Endpoint/SheetName para a tabela real no Supabase
 */
function resolveTableName(endpointOrSheet: string): string {
  const e = (endpointOrSheet || '').toLowerCase().trim()

  if (e.includes('aluno')) return 'alunos'
  if (e.includes('turma')) return 'turmas'
  if (e.includes('ocorrencia')) return 'ocorrencias'
  if (e.includes('frequencia')) return 'frequencias'
  if (e.includes('nota')) return 'notas'
  if (e.includes('titulo') || e.includes('receber')) return 'titulos'
  if (e.includes('contas-pagar') || e.includes('pagar')) return 'contas_pagar'
  if (e.includes('funcionario')) return 'funcionarios'
  if (e.includes('adiantamento')) return 'adiantamentos'
  if (e.includes('advertencia')) return 'advertencias'
  if (e.includes('ausencia')) return 'ausencias'
  if (e.includes('lead')) return 'leads'
  if (e.includes('comunicado')) return 'comunicados'
  if (e.includes('tarefa')) return 'tarefas'
  if (e.includes('agenda') || e.includes('evento')) return 'eventos_agenda'
  if (e.includes('guardian') || e.includes('saida-responsav')) return 'guardians'
  if (e.includes('call') || e.includes('saida-chamada')) return 'calls'
  if (e.includes('saida') || e.includes('historico')) return 'saida_logs'
  if (e.includes('mantenedor') || e.includes('unidade')) return 'mantenedores'
  if (e.includes('log') || e.includes('auditoria')) return 'system_logs'

  // Fallback: limpa barras e hífens
  return e.replace(/[^a-z0-9_]/g, '_')
}

export async function POST(req: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body = await req.json()
    const { tabelas, mode = 'upsert' } = body

    if (!tabelas || typeof tabelas !== 'object') {
      return NextResponse.json({ success: false, error: 'Objeto de tabelas inválido ou ausente.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const results: Record<string, { total: number; restored: number; status: 'ok' | 'error'; message?: string }> = {}

    let totalRestoredCount = 0
    let totalTablesProcessed = 0

    const entries = Object.entries(tabelas)

    for (const [sheetName, tableData] of entries as [string, any][]) {
      const records = Array.isArray(tableData?.registros) ? tableData.registros : Array.isArray(tableData) ? tableData : []
      const tableName = resolveTableName(tableData?.endpoint || sheetName)

      if (records.length === 0) {
        results[sheetName] = { total: 0, restored: 0, status: 'ok', message: 'Nenhum registro para restaurar.' }
        continue
      }

      totalTablesProcessed++
      let tableRestored = 0

      // Processar em lotes de 200 registros por lote
      const BATCH_SIZE = 200
      let hasError = false
      let lastErrMsg = ''

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE).map((record: any) => {
          // Remove campos nulos/undefined se necessário ou limpa dados incompletos
          const clean: any = { ...record }
          // Garante id se não existir
          if (!clean.id && clean.codigo) clean.id = clean.codigo
          return clean
        })

        try {
          let error: any = null
          if (mode === 'insert_only') {
            const { error: insErr } = await supabase.from(tableName).insert(batch)
            error = insErr
          } else {
            // Upsert por id
            const { error: upErr } = await supabase.from(tableName).upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
            error = upErr
          }

          if (error) {
            console.warn(`[Importar Backup] Aviso ao restaurar tabela '${tableName}':`, error.message)
            hasError = true
            lastErrMsg = error.message
          } else {
            tableRestored += batch.length
          }
        } catch (e: any) {
          hasError = true
          lastErrMsg = e.message
        }
      }

      totalRestoredCount += tableRestored
      results[sheetName] = {
        total: records.length,
        restored: tableRestored,
        status: hasError && tableRestored === 0 ? 'error' : 'ok',
        message: hasError ? `Parcial: ${lastErrMsg}` : 'Restaurado com sucesso'
      }
    }

    return NextResponse.json({
      success: true,
      message: `Importação concluída! ${totalRestoredCount} registros processados em ${totalTablesProcessed} tabelas.`,
      totalRestored: totalRestoredCount,
      totalTables: totalTablesProcessed,
      details: results,
      timestamp: new Date().toISOString()
    })

  } catch (err: any) {
    console.error('[Importar Backup API] Erro catastrófico:', err)
    return NextResponse.json({ success: false, error: err.message || 'Erro interno ao importar backup.' }, { status: 500 })
  }
}
