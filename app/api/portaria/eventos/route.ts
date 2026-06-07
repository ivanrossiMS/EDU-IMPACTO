import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '200')
    const aluno_id = url.searchParams.get('aluno_id')
    const dispositivo_id = url.searchParams.get('dispositivo_id')
    const status = url.searchParams.get('status')
    const data_inicio = url.searchParams.get('data_inicio')
    const data_fim = url.searchParams.get('data_fim')

    const event_id = url.searchParams.get('id')

    if (event_id) {
      const { data, error } = await supabase
        .from('portaria_eventos')
        .select('id, foto_captura')
        .eq('id', event_id)
      if (error) throw error
      return NextResponse.json({ data })
    }

    // Normalizar datas para evitar erros de sintaxe no banco (ex: T00:00:00)
    let dataInicioVal = data_inicio
    let dataFimVal = data_fim
    const todayStr = new Date().toISOString().slice(0, 10)

    if (dataInicioVal && !dataInicioVal.match(/^\d{4}-\d{2}-\d{2}/)) {
      dataInicioVal = todayStr + (dataInicioVal.startsWith('T') ? dataInicioVal : 'T' + dataInicioVal)
    }
    if (dataFimVal && !dataFimVal.match(/^\d{4}-\d{2}-\d{2}/)) {
      dataFimVal = todayStr + (dataFimVal.startsWith('T') ? dataFimVal : 'T' + dataFimVal)
    }

    let query = supabase
      .from('portaria_eventos')
      .select('id, data_hora, user_id_equipamento, aluno_id, aluno_nome, dispositivo_nome, status, confianca, payload_raw')
      .order('data_hora', { ascending: false })
      .limit(limit)

    if (aluno_id) query = query.eq('aluno_id', aluno_id)
    if (dispositivo_id) query = query.eq('dispositivo_id', dispositivo_id)
    if (status) query = query.eq('status', status)
    if (dataInicioVal) query = query.gte('data_hora', dataInicioVal)
    if (dataFimVal) query = query.lte('data_hora', dataFimVal)

    const { data, error } = await query
    if (error) throw error

    let mergedData = data || []
    if (data && data.length > 0) {
      const uniqueAlunoIds = Array.from(new Set(data.map((e: any) => e.aluno_id).filter(Boolean)))
      if (uniqueAlunoIds.length > 0) {
        const { data: studentsData, error: stdError } = await supabase
          .from('alunos')
          .select('id, foto, turma, turno')
          .in('id', uniqueAlunoIds)

        if (!stdError && studentsData) {
          const uniqueTurmaIds = Array.from(new Set(studentsData.map((s: any) => s.turma).filter(Boolean)))
          
          let turmaMap: Record<string, string> = {}
          if (uniqueTurmaIds.length > 0) {
            const { data: turmasData } = await supabase
              .from('turmas')
              .select('id, nome')
              .in('id', uniqueTurmaIds)
            
            turmasData?.forEach((t: any) => {
              turmaMap[String(t.id)] = t.nome
            })
          }

          const studentMap: Record<string, any> = {}
          studentsData.forEach((s: any) => {
            const turmaName = s.turma ? turmaMap[String(s.turma)] : null
            studentMap[s.id] = {
              ...s,
              turma_formatada: s.turma ? (turmaName ? `${s.turma} - ${turmaName}` : String(s.turma)) : null
            }
          })

          mergedData = data.map((e: any) => {
            const student = e.aluno_id ? studentMap[e.aluno_id] : null
            return {
              ...e,
              aluno_foto: student?.foto || null,
              aluno_turma: student?.turma_formatada || null,
              aluno_turno: student?.turno || null,
            }
          })
        }
      }
    }

    return NextResponse.json({ data: mergedData })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
