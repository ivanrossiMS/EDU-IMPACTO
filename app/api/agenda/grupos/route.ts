import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { invalidateGruposCache } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    
    const { data, error } = await supabase
      .from('agenda_grupos')
      .select('id, dados')
      
    if (error) throw new Error(error.message)
    
    const result = (data || []).map(row => ({ id: row.id, ...(row.dados || {}) }))
    
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      const rows = body.map(buildRow)
      
      const incomingIds = rows.map(r => r.id).filter(Boolean)
      
      if (incomingIds.length > 0) {
        const { error: delError } = await supabase
          .from('agenda_grupos')
          .delete()
          .not('id', 'in', `(${incomingIds.join(',')})`)
          
        if (delError) console.error('Error deleting stale records:', delError)
      } else {
        const { error: delError } = await supabase
          .from('agenda_grupos')
          .delete()
          .not('id', 'is', null)
          
        if (delError) console.error('Error deleting all records:', delError)
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('agenda_grupos').upsert(rows)
        if (error) throw new Error(error.message)

        // Sincronizar agenda_equipes com os grupos de Equipe Escolar para consistência total
        const equipeRows = rows
          .filter(r => r.dados?.isEquipeEscolar || r.dados?.ano === 'Equipe Escolar')
          .map(r => ({
            id: r.id,
            dados: {
              nome: r.dados?.nome,
              cor: r.dados?.cor,
              icone: r.dados?.icone || 'Users',
              descricao: r.dados?.descricao || '',
              membrosIds: r.dados?.colaboradoresIds || [],
            }
          }))

        if (equipeRows.length > 0) {
          const { error: eqError } = await supabase.from('agenda_equipes').upsert(equipeRows)
          if (eqError) console.error('Error syncing agenda_equipes:', eqError)
        }
      }
      
      invalidateGruposCache()
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)
    const { data, error } = await supabase.from('agenda_grupos').upsert(row).select().single()
    if (error) throw new Error(error.message)

    if (row.dados?.isEquipeEscolar || row.dados?.ano === 'Equipe Escolar') {
      const { error: eqError } = await supabase.from('agenda_equipes').upsert({
        id: row.id,
        dados: {
          nome: row.dados?.nome,
          cor: row.dados?.cor,
          icone: row.dados?.icone || 'Users',
          descricao: row.dados?.descricao || '',
          membrosIds: row.dados?.colaboradoresIds || [],
        }
      })
      if (eqError) console.error('Error syncing single agenda_equipes:', eqError)
    }

    invalidateGruposCache()
    return NextResponse.json({ id: data.id, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRow(body: any) {
  const { id, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    dados: rest,
  }
}
