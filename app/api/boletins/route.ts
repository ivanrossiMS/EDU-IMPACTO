import { NextResponse, after } from 'next/server'
import { resolveUserRole, getAuthorizedAlunoIdsForUser } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets } from '@/lib/server/notificationHelper'
import { getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  try {
    const { searchParams } = new URL(request.url)
    const turma_id = searchParams.get('turma_id') || searchParams.get('turma_ids')
    const aluno_id = searchParams.get('aluno_id')
    const limitParam = searchParams.get('limit')
    const limit = limitParam 
      ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 5000) 
      : (aluno_id ? 100 : 5000)

    const allowedAlunoIds = !isStaff ? await getAuthorizedAlunoIdsForUser(user) : null
    if (!isStaff) {
      if (!allowedAlunoIds || allowedAlunoIds.size === 0) {
        return NextResponse.json({ data: [] })
      }
      if (aluno_id) {
        const clean = String(aluno_id).trim()
        const unpadded = clean.replace(/^0+/, '')
        if (!allowedAlunoIds.has(clean) && (!unpadded || !allowedAlunoIds.has(unpadded))) {
          return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
        }
      }
    }
    
    const accessStartDate = aluno_id ? null : await getLoggedUserAccessStartDate(false, user)

    const buildQuery = () => {
      let q = supabase.from('boletins').select('*').order('created_at', { ascending: false })
      if (accessStartDate && !aluno_id) {
        q = q.gte('created_at', accessStartDate.toISOString())
      }
      if (turma_id) {
        if (turma_id.includes(',')) {
          const ids = turma_id.split(',').map(id => id.trim()).filter(Boolean)
          q = q.in('turma_id', ids)
        } else {
          q = q.eq('turma_id', turma_id)
        }
      }
      if (aluno_id) {
        const alunoStr = String(aluno_id)
        const alunoSemZero = alunoStr.replace(/^0+/, '')
        if (alunoStr !== alunoSemZero) {
          q = q.or(`aluno_id.eq.${alunoStr},aluno_id.eq.${alunoSemZero}`)
        } else {
          q = q.eq('aluno_id', aluno_id)
        }
      } else if (!isStaff && allowedAlunoIds) {
        q = q.in('aluno_id', Array.from(allowedAlunoIds))
      }
      return q
    }

    let boletinsData: any[] = []
    if (limit <= 1000) {
      const { data, error } = await buildQuery().limit(limit)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      boletinsData = data || []
    } else {
      let page = 0
      const pageSize = 1000
      while (boletinsData.length < limit) {
        const from = page * pageSize
        const to = from + Math.min(pageSize, limit - boletinsData.length) - 1
        const { data, error } = await buildQuery().range(from, to)
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        if (!data || data.length === 0) break
        boletinsData = boletinsData.concat(data)
        if (data.length < pageSize) break
        page++
      }
    }
    
    // Buscar nomes das turmas com cache em memória (TTL 60s) para contornar RLS e acelerar resposta
    const turmaIds = [...new Set(boletinsData.map((b: any) => b.turma_id || b.turma).filter(Boolean))]
    let turmasDict: Record<string, string> = {}
    if (turmaIds.length > 0) {
      const { allTurmas } = await getCachedTurmasAndGrupos()
      allTurmas.forEach(t => { if (t?.id && t?.nome) turmasDict[t.id] = t.nome })

      const missingIds = turmaIds.filter(id => !turmasDict[id])
      if (missingIds.length > 0) {
        const { data: fallbackTurmas } = await supabase.from('turmas').select('id, nome').in('id', missingIds)
        if (fallbackTurmas) {
          fallbackTurmas.forEach(t => { turmasDict[t.id] = t.nome })
        }
      }
    }
    
    const enrichedData = boletinsData.map(b => {
      const tId = b.turma_id || b.turma
      return {
        ...b,
        turmaNome: tId && turmasDict[tId] ? turmasDict[tId] : tId
      }
    })

    return NextResponse.json(
      { data: enrichedData },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function normalizeBimestre(raw: any): string {
  const str = String(raw || '').trim()
  const match = str.match(/([1-4])/)
  if (match) return `${match[1]}º Bimestre`
  return str
}

export async function POST(request: Request) {
  const { requireStaff } = await import('@/lib/server/authGuard')
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    
    let targetId = `BL-${Math.random().toString(36).substring(2, 11)}`
    const extraDuplicateIds: string[] = []
    
    const rawAlunoId = body.aluno_id != null ? String(body.aluno_id).trim() : ''
    const aluno_id = rawAlunoId.replace(/^0+/, '') || rawAlunoId
    const turma_id = body.turma_id != null ? String(body.turma_id).trim() : ''
    const parsedDados = typeof body.dados === 'string' ? JSON.parse(body.dados) : (body.dados || {})
    const bimestre = normalizeBimestre(body.bimestre || parsedDados?.bimestre)
    const ano = parsedDados?.ano || body.ano || new Date().getFullYear()
    
    if (aluno_id && bimestre) {
      const alunoIdsToCheck = Array.from(new Set([rawAlunoId, aluno_id].filter(Boolean)))
      const { data: existing } = await supabase
        .from('boletins')
        .select('id, aluno_id, turma_id, bimestre, dados')
        .in('aluno_id', alunoIdsToCheck)
        
      if (existing && existing.length > 0) {
        const matches = existing.filter((e: any) => {
          const d = typeof e.dados === 'string' ? JSON.parse(e.dados) : (e.dados || {})
          const eBim = normalizeBimestre(e.bimestre || d?.bimestre)
          if (eBim !== bimestre) return false
          if (ano && d?.ano && String(d.ano) !== String(ano)) return false
          return true
        })

        if (matches.length > 0) {
          const sameTurmaMatch = matches.find((m: any) => String(m.turma_id) === turma_id)
          const chosen = sameTurmaMatch || matches[0]
          targetId = chosen.id

          for (const m of matches) {
            if (m.id !== targetId) {
              extraDuplicateIds.push(m.id)
            }
          }
        }
      }
    }

    if (extraDuplicateIds.length > 0) {
      await supabase.from('boletins').delete().in('id', extraDuplicateIds)
    }

    const nowIso = new Date().toISOString()
    const normalizedDados = {
      ...parsedDados,
      bimestre,
      ano,
    }
    
    const { data, error } = await supabase
      .from('boletins')
      .upsert({
        ...body,
        id: targetId,
        aluno_id,
        turma_id,
        bimestre,
        dados: normalizedDados,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    
    if (data && data.length > 0) {
      // Disparar push em background para não bloquear o response
      after(async () => {
        const targetIds = await getResponsavelIdsForTargets({ targetStudents: [data[0].aluno_id] })
        if (targetIds.length > 0) {
          const { data: aluno } = await supabase.from('alunos').select('nome').eq('id', data[0].aluno_id).single()
          const nomeAluno = aluno?.nome ? aluno.nome : 'o aluno'
          // Usa janela de 5 minutos no itemId para agrupar salvamentos seguidos do professor,
          // mas permitir novas notificações quando novas notas forem lançadas no mesmo bimestre em outro momento
          const updateBucket = Math.floor(Date.now() / 300000)
          await sendAgendaPushNotification({
            type: 'notas',
            itemId: `${data[0].id}_${updateBucket}`,
            collapseId: `boletim_${data[0].id}`,
            title: '🏆 Novas Notas Lançadas!',
            message: `O boletim de ${nomeAluno} acabou de ser atualizado.`,
            targetUserIds: targetIds,
            targetUrl: `/agenda-digital/${data[0].aluno_id}/notas?id=${data[0].id}`,
            metadata: { aluno_id: String(data[0].aluno_id), item_id: String(data[0].id), rota: 'notas' }
          }).catch(err => console.error('Boletins Push Error:', err))
        }
      })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { requireStaff } = await import('@/lib/server/authGuard')
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const turma_id = searchParams.get('turma_id')
    
    if (id) {
      const { error } = await supabase.from('boletins').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else if (turma_id) {
      const { error } = await supabase.from('boletins').delete().eq('turma_id', turma_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      return NextResponse.json({ error: 'ID ou turma_id é obrigatório' }, { status: 400 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
