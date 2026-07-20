import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const { data, error } = await supabase
      .from('gp_atendimentos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    
    const mapped = data.map((d: any) => ({
      ...d,
      tipo: d.categoria,
      solicitante: d.dados?.solicitante || ''
    }))

    return NextResponse.json(mapped)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const body = await request.json()
    const id = crypto.randomUUID()

    const payload = {
      id,
      funcionario_id: body.funcionario_id,
      categoria: body.tipo || 'Dúvida',
      descricao: body.descricao || '',
      status: body.status || 'novo',
      created_at: body.created_at || new Date().toISOString(),
      dados: { solicitante: body.solicitante || '' }
    }

    const { error } = await supabase
      .from('gp_atendimentos')
      .insert(payload)

    if (error) throw error
    return NextResponse.json({ success: true, id })
  } catch (err: any) {
    const errorDetails = typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err)
    return NextResponse.json({ error: err?.message || 'Unknown error', details: errorDetails }, { status: 400 })
  }
}
