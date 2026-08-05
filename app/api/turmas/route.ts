import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

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

    // Buscar todos os alunos ativos para cálculo dos KPIs gerais (Alunos Matriculados e Alunos Integral/Intermediário)
    const { data: alunosData } = await supabaseServer
      .from('alunos')
      .select('id, turma, status, dados')

    const activeAlunos = (alunosData || []).filter((a: any) => a.status !== 'inativo' && a.status !== 'Inativo')
    const totalAlunosMatriculados = activeAlunos.length

    const isIntegralStudent = (student: any) => {
      const hList = student.dados?.historicoTurmas || []
      const activeHist = Array.isArray(hList) && hList.length > 0 ? hList[hList.length - 1] : null

      return Boolean(
        activeHist?.isIntegralIntermediario ||
        activeHist?.modalidade === 'INTEGRAL/INTERMEDIÁRIO' ||
        activeHist?.modalidade === 'INTEGRAL' ||
        student.dados?.isIntegralIntermediario ||
        student.dados?.modalidade === 'INTEGRAL/INTERMEDIÁRIO' ||
        student.dados?.modalidade === 'INTEGRAL'
      )
    }

    const totalAlunosIntegral = activeAlunos.filter(isIntegralStudent).length

    // Buscar capacidade total de todas as turmas
    const { data: allTurmasCap } = await supabaseServer
      .from('turmas')
      .select('capacidade')

    const capacidadeTotal = (allTurmasCap || []).reduce((acc: number, t: any) => acc + (parseInt(t.capacidade) || 30), 0)
    const vagasOcupadasPercent = capacidadeTotal > 0 ? Math.round((totalAlunosMatriculados / capacidadeTotal) * 100) : 0

    // Calcular matriculados por turma em tempo real para os itens da tabela
    if (data && data.length > 0) {
      data.forEach((t: any) => {
        const isIntegralTurma = (t.turno || '').toLowerCase().includes('integral') ||
                                (t.turno || '').toLowerCase().includes('intermediário') ||
                                (t.nome || '').toLowerCase().includes('integral');

        const countAlunos = activeAlunos.filter((a: any) => {
          if (String(a.turma) === String(t.id) || String(a.turma) === String(t.nome)) return true;

          const hList = a.dados?.historicoTurmas || [];
          if (Array.isArray(hList) && hList.length > 0) {
            const activeVinculo = hList[hList.length - 1];
            if (activeVinculo) {
              if (String(activeVinculo.serieTurma) === String(t.id) || String(activeVinculo.serieTurma) === String(t.nome)) {
                return true;
              }

              if (isIntegralTurma) {
                const anoMatch = !t.ano || !activeVinculo.anoLetivo || String(activeVinculo.anoLetivo) === String(t.ano);
                const serieMatch = !t.serie || !activeVinculo.serie || activeVinculo.serie.toLowerCase() === t.serie.toLowerCase();
                const isIntegralSel = activeVinculo.isIntegralIntermediario === true || activeVinculo.modalidade === 'INTEGRAL/INTERMEDIÁRIO';
                if (anoMatch && serieMatch && isIntegralSel) {
                  return true;
                }
              }
            }
          }
          return false;
        }).length;

        t.matriculados = countAlunos;
      })
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      stats: {
        totalTurmas: count || 0,
        totalAlunosMatriculados,
        totalAlunosIntegral,
        capacidadeTotal,
        vagasOcupadasPercent
      },
      page,
      limit
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
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
      const { data } = await supabaseServer.from('turmas').select('id').eq('id', id)
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

    const { data, error } = await supabaseServer
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
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
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

    const { data, error } = await supabaseServer
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
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID da turma é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('turmas')
      .delete()
      .eq('id', id)
      .select()

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Turma não encontrada ou já excluída.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
