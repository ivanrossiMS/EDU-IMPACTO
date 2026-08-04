import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

function extractSerieKey(str: string): string {
  if (!str) return ''
  const norm = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  
  const anoMatch = norm.match(/(\d+)\s*(?:º|ª|o|a)?\s*(?:ano|serie|ano\/serie)?/)
  if (anoMatch && anoMatch[1]) {
    return anoMatch[1]
  }

  const numMatch = norm.match(/(\d+)/)
  if (numMatch) {
    return numMatch[1]
  }

  return norm
}

/**
 * Sincroniza automaticamente os alunos que possuem vínculo marcado como INTEGRAL/INTERMEDIÁRIO
 * no ano letivo e série correspondentes para a turma recém-criada/editada de turno Integral/Intermediário.
 */
async function syncIntegralIntermediarioAlunos(supabase: any, turmaObj: any) {
  if (!turmaObj) return 0
  
  const turno = (turmaObj.turno || '').trim().toLowerCase()
  const isIntegralInter = turno.includes('integral') || turno.includes('intermediar')

  if (!isIntegralInter) return 0

  // Pre-fetch todas as turmas para resolver IDs em h.serieTurma
  const { data: allTurmas } = await supabase
    .from('turmas')
    .select('id, nome, serie, ano, turno, dados')

  const turmasMap = new Map<string, any>()
  if (allTurmas) {
    allTurmas.forEach((t: any) => {
      if (t.id !== undefined && t.id !== null) {
        turmasMap.set(String(t.id), t)
      }
      if (t.codigo) {
        turmasMap.set(String(t.codigo), t)
      }
      if (t.nome) {
        turmasMap.set(String(t.nome).trim(), t)
        turmasMap.set(String(t.nome).trim().toLowerCase(), t)
      }
    })
  }

  const normalizeSegmento = (str: string): string => {
    if (!str) return ''
    const norm = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    if (norm.includes('infantil')) return 'infantil'
    if (norm.includes('fundamental 1') || norm.includes('fundamental i') || norm.includes('anos iniciais')) return 'fundamental_1'
    if (norm.includes('fundamental 2') || norm.includes('fundamental ii') || norm.includes('anos finais')) return 'fundamental_2'
    if (norm.includes('medio')) return 'medio'
    return norm.replace(/[^a-z0-9]/g, '')
  }

  const getVinculoFullKey = (h: any, aluno: any, targetId?: string): { segmentoKey: string; serieKey: string } => {
    let segmentoKey = ''
    let serieKey = ''

    const rawRef = String(h?.serieTurma || h?.turmaId || '').trim()
    if (rawRef && (turmasMap.has(rawRef) || turmasMap.has(rawRef.toLowerCase()))) {
      const tObj = turmasMap.get(rawRef) || turmasMap.get(rawRef.toLowerCase())
      if (!targetId || String(tObj?.id) !== String(targetId)) {
        const segStr = tObj?.dados?.segmento || tObj?.segmento || ''
        if (segStr) segmentoKey = normalizeSegmento(segStr)
        const serStr = tObj?.serie || tObj?.nome || ''
        if (serStr) serieKey = extractSerieKey(serStr)
      }
    }

    if (!segmentoKey && h?.segmento) {
      segmentoKey = normalizeSegmento(h.segmento)
    }

    if (!serieKey && h?.serie) {
      const str = String(h.serie).trim()
      serieKey = extractSerieKey(str)
    }

    if (!segmentoKey || !serieKey) {
      const mainRef = String(aluno?.turma || '').trim()
      if (mainRef && (turmasMap.has(mainRef) || turmasMap.has(mainRef.toLowerCase()))) {
        const tObj = turmasMap.get(mainRef) || turmasMap.get(mainRef.toLowerCase())
        if (!targetId || String(tObj?.id) !== String(targetId)) {
          if (!segmentoKey) {
            const segStr = tObj?.dados?.segmento || tObj?.segmento || ''
            if (segStr) segmentoKey = normalizeSegmento(segStr)
          }
          if (!serieKey) {
            const serStr = tObj?.serie || tObj?.nome || ''
            if (serStr) serieKey = extractSerieKey(serStr)
          }
        }
      }
    }

    if (!segmentoKey) {
      segmentoKey = normalizeSegmento(aluno?.dados?.segmento || aluno?.segmento || '')
    }
    if (!serieKey) {
      serieKey = extractSerieKey(aluno?.serie || aluno?.turma_nome || '')
    }

    return { segmentoKey, serieKey }
  }

  const anoTurma = String(turmaObj.ano || '')
  const targetSegmentoKey = normalizeSegmento(turmaObj.dados?.segmento || turmaObj.segmento || '')
  const targetSerieKey = extractSerieKey(turmaObj.serie || turmaObj.nome || '')
  const turmaId = String(turmaObj.id)

  // Busca todos os alunos cadastrados no sistema
  const { data: todosAlunos, error } = await supabase
    .from('alunos')
    .select('id, nome, turma, serie, dados')
    .or('status.neq.inativo,status.is.null')

  if (error || !todosAlunos || todosAlunos.length === 0) return 0

  let syncedCount = 0

  for (const aluno of todosAlunos) {
    const dados = aluno.dados || {}
    const hList: any[] = Array.isArray(dados.historicoTurmas) ? dados.historicoTurmas : []
    
    let hasMatchingVinculo = false
    let vinculoIndexToUpdate = -1
    let needsCleanup = false
    let cleanedHList = [...hList]

    const getActiveVinculos = (a: any): any[] => {
      const d = a?.dados || {}
      const list: any[] = Array.isArray(d.historicoTurmas) ? d.historicoTurmas : []
      if (list.length === 0) return []
      const explicitActive = list.filter((h: any) => {
        const st = String(h?.status || '').toLowerCase()
        return st.includes('matriculado') || st.includes('cursando')
      })
      if (explicitActive.length > 0) return explicitActive
      const lastItem = list[list.length - 1]
      const lastSt = String(lastItem?.status || '').toLowerCase()
      if (lastSt.includes('historico') || lastSt.includes('anterior') || lastSt.includes('inativo') || lastSt.includes('cancelado')) return []
      return [lastItem]
    }

    const activeVinculos = getActiveVinculos(aluno)

    // 1. Procurar nos vínculos ativos em historicoTurmas
    for (let i = 0; i < hList.length; i++) {
      const h = hList[i]
      const isCursando = activeVinculos.includes(h)
      if (!isCursando) continue

      const hAno = String(h.anoLetivo || h.ano_letivo || '')
      const hModalidade = (h.modalidade || h.tipoVinculo || '').toUpperCase()
      const { segmentoKey, serieKey } = getVinculoFullKey(h, aluno)

      const isSameAno = !anoTurma || !hAno || hAno === anoTurma
      const isIntegralModal = hModalidade.includes('INTEGRAL') || hModalidade.includes('INTERMEDIAR')
      
      const isSameSegmento = !targetSegmentoKey || !segmentoKey || targetSegmentoKey === segmentoKey
      const isSameSerie = targetSerieKey && serieKey && targetSerieKey === serieKey

      if (isSameAno && isIntegralModal && isSameSegmento && isSameSerie) {
        hasMatchingVinculo = true
        vinculoIndexToUpdate = i
        break
      }

      // Se h.serieTurma estava apontando para ESTA turmaID mas a série/segmento do aluno NÃO corresponde
      if (String(h.serieTurma) === turmaId || String(h.turmaId) === turmaId) {
        if (!isSameSegmento || !isSameSerie) {
          needsCleanup = true
          cleanedHList[i] = {
            ...cleanedHList[i],
            serieTurma: '',
            turmaId: ''
          }
        }
      }
    }

    // 2. Fallback se não tinha em historicoTurmas mas possui turma_nome contendo INTEGRAL/INTERMEDIÁRIO
    if (!hasMatchingVinculo) {
      const aAno = String(aluno.anoLetivo || aluno.ano_letivo || dados.anoLetivo || '')
      const aTurmaNome = (aluno.turma_nome || aluno.turma || '').toUpperCase()
      const { segmentoKey, serieKey } = getVinculoFullKey({}, aluno)
      
      const isSameAno = !anoTurma || !aAno || aAno === anoTurma
      const isIntegralModal = aTurmaNome.includes('INTEGRAL') && aTurmaNome.includes('INTERMEDIAR')
      const isSameSegmento = !targetSegmentoKey || !segmentoKey || targetSegmentoKey === segmentoKey
      const isSameSerie = targetSerieKey && serieKey && targetSerieKey === serieKey

      if (isSameAno && isIntegralModal && isSameSegmento && isSameSerie) {
        hasMatchingVinculo = true
      }
    }

    if (hasMatchingVinculo) {
      syncedCount++

      let updatedHList = [...hList]
      if (vinculoIndexToUpdate >= 0) {
        updatedHList[vinculoIndexToUpdate] = {
          ...updatedHList[vinculoIndexToUpdate],
          serieTurma: turmaId,
          turmaId: turmaId,
          modalidade: 'INTEGRAL/INTERMEDIÁRIO'
        }
      } else {
        updatedHList.push({
          id: `HIST-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          anoLetivo: anoTurma || new Date().getFullYear().toString(),
          segmento: turmaObj.dados?.segmento || '',
          serieTurma: turmaId,
          turmaId: turmaId,
          modalidade: 'INTEGRAL/INTERMEDIÁRIO',
          status: 'Matriculado'
        })
      }

      const isLastVinculo = vinculoIndexToUpdate === hList.length - 1 || vinculoIndexToUpdate === -1
      const updatePayload: any = {
        dados: {
          ...dados,
          historicoTurmas: updatedHList
        }
      }

      if (isLastVinculo || !aluno.turma) {
        updatePayload.turma = turmaId
      }

      await supabase
        .from('alunos')
        .update(updatePayload)
        .eq('id', aluno.id)
    }
  }

  if (syncedCount > 0) {
    await supabase
      .from('turmas')
      .update({ matriculados: syncedCount })
      .eq('id', turmaId)
  }

  return syncedCount
}

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

    if (segmento) {
      query = query.filter('dados->>segmento', 'eq', segmento)
    }

    let queryExec = query.order('nome')
    if (!all) {
      queryExec = queryExec.range(from, to)
    }

    const { data, error, count } = await queryExec

    if (error) throw error

    // Calcular matriculados em tempo real incluindo historicoTurmas e vínculo Integral/Intermediário
    if (data && data.length > 0) {
      const { data: alunosData } = await supabase
        .from('alunos')
        .select('id, turma, serie, dados')
        .or('status.neq.inativo,status.is.null')

      const { data: allTurmas } = await supabase
        .from('turmas')
        .select('id, nome, serie, ano, turno, dados')

      const turmasMap = new Map<string, any>()
      if (allTurmas) {
        allTurmas.forEach((t: any) => {
          if (t.id !== undefined && t.id !== null) {
            turmasMap.set(String(t.id), t)
          }
          if (t.codigo) {
            turmasMap.set(String(t.codigo), t)
          }
          if (t.nome) {
            turmasMap.set(String(t.nome).trim(), t)
            turmasMap.set(String(t.nome).trim().toLowerCase(), t)
          }
        })
      }

      const normalizeSegmento = (str: string): string => {
        if (!str) return ''
        const norm = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        if (norm.includes('infantil')) return 'infantil'
        if (norm.includes('fundamental 1') || norm.includes('fundamental i') || norm.includes('anos iniciais')) return 'fundamental_1'
        if (norm.includes('fundamental 2') || norm.includes('fundamental ii') || norm.includes('anos finais')) return 'fundamental_2'
        if (norm.includes('medio')) return 'medio'
        return norm.replace(/[^a-z0-9]/g, '')
      }

      const getVinculoFullKey = (h: any, aluno: any, targetId?: string): { segmentoKey: string; serieKey: string } => {
        let segmentoKey = ''
        let serieKey = ''

        const rawRef = String(h?.serieTurma || h?.turmaId || '').trim()
        if (rawRef && (turmasMap.has(rawRef) || turmasMap.has(rawRef.toLowerCase()))) {
          const tObj = turmasMap.get(rawRef) || turmasMap.get(rawRef.toLowerCase())
          if (!targetId || String(tObj?.id) !== String(targetId)) {
            const segStr = tObj?.dados?.segmento || tObj?.segmento || ''
            if (segStr) segmentoKey = normalizeSegmento(segStr)
            const serStr = tObj?.serie || tObj?.nome || ''
            if (serStr) serieKey = extractSerieKey(serStr)
          }
        }

        if (!segmentoKey && h?.segmento) {
          segmentoKey = normalizeSegmento(h.segmento)
        }

        if (!serieKey && h?.serie) {
          const str = String(h.serie).trim()
          serieKey = extractSerieKey(str)
        }

        if (!segmentoKey || !serieKey) {
          const mainRef = String(aluno?.turma || '').trim()
          if (mainRef && (turmasMap.has(mainRef) || turmasMap.has(mainRef.toLowerCase()))) {
            const tObj = turmasMap.get(mainRef) || turmasMap.get(mainRef.toLowerCase())
            if (!targetId || String(tObj?.id) !== String(targetId)) {
              if (!segmentoKey) {
                const segStr = tObj?.dados?.segmento || tObj?.segmento || ''
                if (segStr) segmentoKey = normalizeSegmento(segStr)
              }
              if (!serieKey) {
                const serStr = tObj?.serie || tObj?.nome || ''
                if (serStr) serieKey = extractSerieKey(serStr)
              }
            }
          }
        }

        if (!segmentoKey) {
          segmentoKey = normalizeSegmento(aluno?.dados?.segmento || aluno?.segmento || '')
        }
        if (!serieKey) {
          serieKey = extractSerieKey(aluno?.serie || aluno?.turma_nome || '')
        }

        return { segmentoKey, serieKey }
      }

      data.forEach((t: any) => {
        const isIntegralTurma = (t.turno || '').toLowerCase().includes('integral') || (t.turno || '').toLowerCase().includes('intermediar')
        const anoTurma = String(t.ano || '')
        const targetSegmentoKey = normalizeSegmento(t.dados?.segmento || t.segmento || '')
        const targetSerieKey = extractSerieKey(t.serie || t.nome || '')
        const turmaId = String(t.id)

        const getActiveVinculos = (aluno: any): any[] => {
          const dados = aluno?.dados || {}
          const hList: any[] = Array.isArray(dados.historicoTurmas)
            ? dados.historicoTurmas
            : (Array.isArray(aluno?.historicoTurmas) ? aluno.historicoTurmas : [])

          if (hList.length === 0) return []

          const explicitActive = hList.filter((h: any) => {
            const st = String(h?.status || '').toLowerCase()
            return st.includes('matriculado') || st.includes('cursando')
          })

          if (explicitActive.length > 0) {
            return explicitActive
          }

          const lastIndex = hList.length - 1
          const lastItem = hList[lastIndex]
          const lastSt = String(lastItem?.status || '').toLowerCase()

          if (lastSt.includes('historico') || lastSt.includes('anterior') || lastSt.includes('inativo') || lastSt.includes('cancelado')) {
            return []
          }

          return [lastItem]
        }

        const countAlunos = (alunosData || []).filter((a: any) => {
          const aTurma = String(a.turma || '').trim()
          if (aTurma === turmaId || aTurma.toLowerCase() === String(t.nome || '').trim().toLowerCase() || (t.codigo && aTurma === String(t.codigo))) return true

          const activeVinculos = getActiveVinculos(a)

          for (const h of activeVinculos) {
            if (String(h.serieTurma) === turmaId || String(h.turmaId) === turmaId || (t.codigo && String(h.serieTurma) === String(t.codigo))) {
              return true
            }

            if (isIntegralTurma) {
              const hAno = String(h.anoLetivo || h.ano_letivo || '')
              const hModalidade = (h.modalidade || h.tipoVinculo || '').toUpperCase()

              const isSameAno = !anoTurma || !hAno || hAno === anoTurma
              const isIntegralModal = hModalidade.includes('INTEGRAL') || hModalidade.includes('INTERMEDIAR')

              if (isSameAno && isIntegralModal) {
                const { segmentoKey, serieKey } = getVinculoFullKey(h, a, turmaId)
                const isSameSegmento = !targetSegmentoKey || !segmentoKey || targetSegmentoKey === segmentoKey
                const isSameSerie = targetSerieKey && serieKey && targetSerieKey === serieKey

                if (isSameSegmento && isSameSerie) {
                  return true
                }
              }
            }
          }

          return false
        }).length

        t.matriculados = countAlunos
      })
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
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
      id = Math.floor(1000 + Math.random() * 9000).toString()
      const { data } = await supabase.from('turmas').select('id').eq('id', id)
      if (!data || data.length === 0) exists = false
      attempts++
    }
    
    if (exists) {
      throw new Error('Não foi possível gerar um ID único para a turma')
    }
    
    const newTurma = {
      id,
      codigo: id,
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

    const createdTurma = data?.[0] || newTurma

    // Auto-sincronizar alunos com vínculo INTEGRAL/INTERMEDIÁRIO
    const syncedAlunos = await syncIntegralIntermediarioAlunos(supabase, createdTurma)

    return NextResponse.json({ success: true, data: { ...createdTurma, matriculados: syncedAlunos }, syncedAlunos })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

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

    const resultTurma = data?.[0] || { ...updatedTurma, id }

    // Auto-sincronizar alunos com vínculo INTEGRAL/INTERMEDIÁRIO
    const syncedAlunos = await syncIntegralIntermediarioAlunos(supabase, resultTurma)

    return NextResponse.json({ success: true, data: { ...resultTurma, matriculados: syncedAlunos }, syncedAlunos })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

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
