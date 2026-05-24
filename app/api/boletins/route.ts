import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const turma_id = searchParams.get('turma_id')
    const aluno_id = searchParams.get('aluno_id')
    
    let query = supabase.from('boletins').select('*')
    
    if (turma_id) {
      query = query.eq('turma_id', turma_id)
    }
    
    if (aluno_id) {
      const alunoStr = String(aluno_id)
      const alunoSemZero = alunoStr.replace(/^0+/, '')
      if (alunoStr !== alunoSemZero) {
        query = query.or(`aluno_id.eq.${alunoStr},aluno_id.eq.${alunoSemZero}`)
      } else {
        query = query.eq('aluno_id', aluno_id)
      }
    }

    const { data, error } = await query
    
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const id = `BL-${Math.random().toString(36).substring(2, 11)}`
    
    const { data, error } = await supabase
      .from('boletins')
      .insert({ id, ...body })
      .select()
      
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    
    const { error } = await supabase
      .from('boletins')
      .delete()
      .eq('id', id)
      
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
