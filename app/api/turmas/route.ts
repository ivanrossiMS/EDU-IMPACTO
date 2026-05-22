import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const url = new URL(request.url)
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    const all = url.searchParams.get('all') === 'true' || (!pageParam && !limitParam)

    const page = parseInt(pageParam || '1')
    const limit = parseInt(limitParam || '10')
    const search = url.searchParams.get('search') || ''
    const ano = url.searchParams.get('ano') || ''
    const segmento = url.searchParams.get('segmento') || ''

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('turmas')
      .select('*', { count: 'exact' })

    if (search) {
      query = query.or(`nome.ilike.%${search}%,codigo.ilike.%${search}%`)
    }

    if (ano) {
      query = query.eq('ano', parseInt(ano))
    }

    // Como segmento é guardado em dados->segmento, precisamos filtrar via JSONB
    if (segmento) {
      query = query.filter('dados->>segmento', 'eq', segmento)
    }

    let queryExec = query.order('nome')
    if (!all) {
      queryExec = queryExec.range(from, to)
    }

    const { data, error, count } = await queryExec

    if (error) throw error

    // Calcular matriculados em tempo real
    if (data && data.length > 0) {
      const turmasIds = data.map(t => t.id)
      
      // Busca alunos que pertencem a essas turmas
      // Usamos o cliente protegido (supabase) pois se o usuário pode ver os alunos no modal,
      // ele também poderá vê-los aqui!
      const { data: alunosData } = await supabase
        .from('alunos')
        .select('id, turma')
        .in('turma', turmasIds)
        
      // Mapeia a contagem para cada turma
      data.forEach((t: any) => {
        const countAlunos = (alunosData || []).filter((a: any) => {
          return String(a.turma) === String(t.id)
        }).length
        
        t.matriculados = countAlunos
      })
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      limit
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const body = await request.json()
    const { nome, serie, segmento, turno, sala, capacidade, professor, unidade, ano } = body

    if (!nome) {
      return NextResponse.json({ error: 'Nome da turma é obrigatório' }, { status: 400 })
    }

    let id = ''
    let exists = true
    let attempts = 0
    while (exists && attempts < 10) {
      id = Math.floor(1000 + Math.random() * 9000).toString() // 4 dígitos
      const { data } = await supabase.from('turmas').select('id').eq('id', id)
      if (!data || data.length === 0) exists = false
      attempts++
    }
    
    if (exists) {
      throw new Error('Não foi possível gerar um ID único para a turma')
    }
    
    const newTurma = {
      id,
      codigo: id, // Usando o mesmo ID como código
      nome,
      serie: serie || '',
      turno: turno || '',
      professor: professor || '',
      sala: sala || '',
      capacidade: parseInt(capacidade) || 30,
      matriculados: 0,
      unidade: unidade || '',
      ano: parseInt(ano) || new Date().getFullYear(),
      dados: {
        status: 'ativa',
        segmento: segmento || '',
        dataMatricula: new Date().toISOString().split('T')[0]
      }
    }

    const { data, error } = await supabase
      .from('turmas')
      .insert(newTurma)
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, data: data?.[0] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const body = await request.json()
    const { id, nome, serie, segmento, turno, sala, capacidade, professor, unidade, ano } = body

    if (!id) {
      return NextResponse.json({ error: 'ID da turma é obrigatório' }, { status: 400 })
    }

    const updatedTurma = {
      nome,
      serie,
      turno,
      professor,
      sala,
      capacidade: parseInt(capacidade),
      unidade,
      ano: parseInt(ano),
      dados: {
        segmento: segmento || ''
      }
    }

    const { data, error } = await supabase
      .from('turmas')
      .update(updatedTurma)
      .eq('id', id)
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, data: data?.[0] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID da turma é obrigatório' }, { status: 400 })
    }

    const { error } = await supabase
      .from('turmas')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
