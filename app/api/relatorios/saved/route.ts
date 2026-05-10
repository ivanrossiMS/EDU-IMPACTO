import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabase.from('saved_reports').select('*').order('updated_at', { ascending: false }).limit(100)
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, user_id, nome, descricao, tipo_relatorio, subtipo, configuracao, filtros, favorito, compartilhado } = body

    if (id) {
      const { error } = await supabase.from('saved_reports').update({
        nome, descricao, tipo_relatorio, subtipo, configuracao, filtros, favorito, compartilhado, updated_at: new Date().toISOString()
      }).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('saved_reports').insert({
        user_id, nome, descricao, tipo_relatorio, subtipo, configuracao, filtros, favorito, compartilhado
      })
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await supabase.from('saved_reports').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
