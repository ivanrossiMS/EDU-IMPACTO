import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  try {
    const authClient = await createProtectedClient();
    const supabase = supabaseServer;

    const body = await request.json()
    const { tipo, ids, alunoId } = body

    if (!tipo || !ids || !alunoId || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Parâmetros incompletos' }, { status: 400 })
    }

    // Determine the table name based on type
    const tableMap: Record<string, string> = {
      'comunicado': 'comunicados',
      'momento': 'momentos',
      'evento': 'eventos',
      'ocorrencia': 'ocorrencias',
      'nota': 'boletins'
    }

    const table = tableMap[tipo]
    if (!table) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    // Fetch the target rows first to update their JSONB "dados" / "leituras" depending on the table
    const { data: rows, error: selectError } = await supabase.from(table).select('id, dados, leituras').in('id', ids)
    if (selectError) {
      throw new Error(`Select error: ${selectError.message}`)
    }

    const now = new Date().toISOString()
    const updates = rows.map((row: any) => {
      // For "comunicados", they extract "leituras" to root level on normal APIs, but in the DB it's often in "dados".
      // We will update both just to be safe.
      const dados = typeof row.dados === 'object' && row.dados !== null ? { ...row.dados } : {}
      
      const leiturasInDados = typeof dados.leituras === 'object' && dados.leituras !== null ? { ...dados.leituras } : {}
      leiturasInDados[alunoId] = now
      dados.leituras = leiturasInDados

      // If the root level "leituras" exists in the table structure (some tables like comunicados might have it or use "dados")
      let rootLeituras = null
      if (row.leituras !== undefined) {
         rootLeituras = typeof row.leituras === 'object' && row.leituras !== null ? { ...row.leituras } : {}
         rootLeituras[alunoId] = now
      }

      const updateObj: any = {
        id: row.id,
        dados
      }
      
      if (rootLeituras !== null) {
         updateObj.leituras = rootLeituras
      }

      return updateObj
    })

    const { error: upsertError } = await supabase.from(table).upsert(updates)
    if (upsertError) {
      throw new Error(`Upsert error: ${upsertError.message}`)
    }

    return NextResponse.json({ ok: true, count: updates.length })
  } catch (err: any) {
    console.error("Erro em marcar-lido:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
