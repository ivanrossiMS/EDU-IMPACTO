import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('portaria_dispositivos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const id = body.id || crypto.randomUUID()

    const record = {
      id,
      nome: body.nome || 'Novo Dispositivo',
      ip: body.ip || '',
      porta: body.porta || 443,
      unidade: body.unidade || '',
      modelo: body.modelo || 'iDFace',
      status: 'offline',
      configuracao: body.configuracao || {},
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('portaria_dispositivos')
      .upsert(record, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const { error } = await supabase.from('portaria_dispositivos').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
