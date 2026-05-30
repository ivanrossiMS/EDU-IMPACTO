import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const accessStartDate = await getLoggedUserAccessStartDate()
    let query = supabase.from('eventos_agenda').select('*')
    if (accessStartDate) {
      const accessStartDateStr = accessStartDate.toISOString().substring(0, 10)
      query = query.gte('data', accessStartDateStr)
    }
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const result = (data || []).map(row => ({ 
      ...row, 
      horaInicio: row.hora_inicio,
      horaFim: row.hora_fim,
      criadoPor: row.criado_por,
      ...(row.dados || {}) 
    }))
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(buildRowAuth)
      const { error } = await supabase.from('eventos_agenda').upsert(rows)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('eventos_agenda').upsert(row).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  const { id, titulo, descricao, tipo, data, horaInicio, horaFim, turmas, local, cor, recorrente, criadoPor, unidade, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    titulo: titulo || 'Evento sem título',
    descricao: descricao || '',
    tipo: tipo || 'evento',
    data: data || '',
    hora_inicio: horaInicio || '',
    hora_fim: horaFim || '',
    turmas: Array.isArray(turmas) ? turmas : [],
    local: local || '',
    cor: cor || '#f59e0b',
    recorrente: recorrente || false,
    criado_por: criadoPor || '',
    unidade: unidade || '',
    dados: rest,
  }
}
