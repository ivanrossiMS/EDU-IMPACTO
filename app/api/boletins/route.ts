import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const turma_id = searchParams.get('turma_id')
    const aluno_id = searchParams.get('aluno_id')
    
    let query = supabase.from('boletins').select('*')
    
    const accessStartDate = await getLoggedUserAccessStartDate()
    if (accessStartDate) {
      query = query.gte('created_at', accessStartDate.toISOString())
    }
    
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
    
    const boletinsData = data || []
    
    // Buscar nomes das turmas com supabaseServer para contornar RLS de Família
    const turmaIds = [...new Set(boletinsData.map((b: any) => b.turma_id || b.turma).filter(Boolean))]
    let turmasDict: Record<string, string> = {}
    if (turmaIds.length > 0) {
      const { data: turmasData } = await supabase.from('turmas').select('id, nome').in('id', turmaIds)
      if (turmasData) {
        turmasData.forEach(t => { turmasDict[t.id] = t.nome })
      }
    }
    
    const enrichedData = boletinsData.map(b => {
      const tId = b.turma_id || b.turma
      return {
        ...b,
        turmaNome: tId && turmasDict[tId] ? turmasDict[tId] : tId
      }
    })

    return NextResponse.json({ data: enrichedData })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const id = `BL-${Math.random().toString(36).substring(2, 11)}`
    
    const { data, error } = await supabase
      .from('boletins')
      .insert({ id, ...body })
      .select()
      
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    
    if (data && data.length > 0) {
      const targetIds = await getResponsavelIdsForTargets({ targetStudents: [data[0].aluno_id] })
      if (targetIds.length > 0) {
        const { data: aluno } = await supabase.from('alunos').select('nome').eq('id', data[0].aluno_id).single()
        const nomeAluno = aluno?.nome ? aluno.nome : 'o aluno'
        sendAgendaPushNotification({
          type: 'notas',
          itemId: String(data[0].id),
          title: '🏆 Novas Notas Lançadas!',
          message: `O boletim de ${nomeAluno} acabou de ser atualizado.`,
          targetUserIds: targetIds,
          targetUrl: `/agenda-digital/notas`
        }).catch(err => console.error('Boletins Push Error:', err))
      }
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

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
