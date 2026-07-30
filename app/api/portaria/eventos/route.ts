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
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    const todayStr = formatter.format(new Date())

    if (dataInicioVal && !dataInicioVal.match(/^\d{4}-\d{2}-\d{2}/)) {
      dataInicioVal = todayStr + (dataInicioVal.startsWith('T') ? dataInicioVal : 'T' + dataInicioVal)
    }
    if (dataFimVal && !dataFimVal.match(/^\d{4}-\d{2}-\d{2}/)) {
      dataFimVal = todayStr + (dataFimVal.startsWith('T') ? dataFimVal : 'T' + dataFimVal)
    }

    const matricula = url.searchParams.get('matricula')

    let query = supabase
      .from('portaria_eventos')
      .select('id, data_hora, user_id_equipamento, aluno_id, aluno_nome, dispositivo_nome, status, confianca, payload_raw')
      .order('data_hora', { ascending: false })
      .limit(limit)

    if (aluno_id || matricula) {
      const searchTarget = (aluno_id || matricula || '').trim()

      if (searchTarget) {
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(searchTarget)
        let alunoObj: { id: string; matricula: string } | null = null

        if (isUuid) {
          const { data } = await supabase
            .from('alunos')
            .select('id, matricula')
            .eq('id', searchTarget)
            .maybeSingle()
          alunoObj = data
        } else {
          const { data } = await supabase
            .from('alunos')
            .select('id, matricula')
            .eq('matricula', searchTarget)
            .maybeSingle()
          alunoObj = data
        }

        const targets = new Set<string>()
        targets.add(searchTarget)
        if (alunoObj?.id) targets.add(String(alunoObj.id))
        if (alunoObj?.matricula) targets.add(String(alunoObj.matricula))

        const orConditions: string[] = []
        targets.forEach(t => {
          if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(t)) {
            orConditions.push(`aluno_id.eq.${t}`)
          } else {
            orConditions.push(`user_id_equipamento.eq.${t}`)
            orConditions.push(`aluno_id.eq.${t}`)
          }
        })

        if (orConditions.length > 0) {
          query = query.or(orConditions.join(','))
        }
      }
    }

    if (dispositivo_id) query = query.eq('dispositivo_id', dispositivo_id)
    if (status) query = query.eq('status', status)
    if (dataInicioVal) query = query.gte('data_hora', dataInicioVal)
    if (dataFimVal) query = query.lte('data_hora', dataFimVal)

    const { data, error } = await query
    if (error) throw error

    let mergedData = data || []
    if (data && data.length > 0) {
      // Helper para buscar 100% dos registros burlando o limite max_rows (1000) do PostgREST
      const fetchAllPages = async (table: string, selectFields: string) => {
        let allData: any[] = []
        let from = 0
        const step = 1000
        while (true) {
          const { data, error } = await supabase
            .from(table)
            .select(selectFields)
            .range(from, from + step - 1)
          if (error) {
            console.error(`[FetchAllPages Error in ${table}]`, error)
            break
          }
          if (!data || data.length === 0) break
          allData = allData.concat(data)
          if (data.length < step) break
          from += step
        }
        return allData
      }

      // Buscar todos os alunos, responsáveis e vínculos sem limite de 1000
      const [studentsData, responsaveisData, linksData] = await Promise.all([
        fetchAllPages('alunos', 'id, nome, matricula, foto, turma, turno, status, dados'),
        fetchAllPages('responsaveis', 'id, nome, codigo, rfid, dados'),
        fetchAllPages('aluno_responsavel', 'aluno_id, responsavel_id, parentesco'),
      ])

      if (studentsData.length > 0) {
        const studentByIdMap: Record<string, any> = {}
        const studentByCleanCodeMap: Record<string, any> = {}
        const studentByNumericMap: Record<number, any> = {}

        const registerStudent = (s: any, rawVal: any) => {
          if (!rawVal) return
          const str = String(rawVal).trim()
          if (!str) return
          
          studentByCleanCodeMap[str] = s
          studentByCleanCodeMap[str.toLowerCase()] = s
          
          const cleanZero = str.replace(/^0+/, '')
          if (cleanZero) studentByCleanCodeMap[cleanZero] = s
          
          const num = parseInt(str.replace(/\D/g, ''), 10)
          if (!isNaN(num) && num > 0) {
            studentByNumericMap[num] = s
            studentByCleanCodeMap[String(num)] = s
          }
        }

        studentsData.forEach((s: any) => {
          studentByIdMap[String(s.id).trim()] = s
          registerStudent(s, s.id)
          registerStudent(s, s.matricula)
          if (s.dados) {
            registerStudent(s, s.dados.codigo)
            registerStudent(s, s.dados.matricula)
            registerStudent(s, s.dados.codigoAluno)
            registerStudent(s, s.dados.id)
          }
        })

        // Indexar também responsáveis associando-os ao aluno correspondente
        if (responsaveisData.length > 0 && linksData.length > 0) {
          const respToAlunoMap: Record<string, any> = {}
          linksData.forEach((l: any) => {
            const st = studentByIdMap[String(l.aluno_id).trim()]
            if (st) {
              respToAlunoMap[String(l.responsavel_id).trim()] = st
            }
          })

          responsaveisData.forEach((r: any) => {
            const linkedStudent = respToAlunoMap[String(r.id).trim()]
            if (linkedStudent) {
              registerStudent(linkedStudent, r.id)
              registerStudent(linkedStudent, r.codigo)
              registerStudent(linkedStudent, r.rfid)
              if (r.dados) {
                registerStudent(linkedStudent, r.dados.codigo)
                registerStudent(linkedStudent, r.dados.id)
              }
            }
          })
        }

        // Buscar nomes das turmas
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

        const dbUpdatesToRun: any[] = []

        const extractRealUserId = (e: any): string => {
          const payload = e.payload_raw || {}
          if (payload.object_changes && Array.isArray(payload.object_changes) && payload.object_changes.length > 0) {
            const val = payload.object_changes[0]?.values
            if (val) {
              if (val.user_id !== undefined && val.user_id !== null) return String(val.user_id).trim()
              if (val.userId !== undefined && val.userId !== null) return String(val.userId).trim()
              if (val.id_usuario !== undefined && val.id_usuario !== null) return String(val.id_usuario).trim()
            }
          }
          if (payload.user_id !== undefined && payload.user_id !== null) return String(payload.user_id).trim()
          if (payload.userId !== undefined && payload.userId !== null) return String(payload.userId).trim()
          if (payload.user_id_equipamento !== undefined && payload.user_id_equipamento !== null) return String(payload.user_id_equipamento).trim()
          return e.user_id_equipamento ? String(e.user_id_equipamento).trim() : ''
        }

        mergedData = data.map((e: any) => {
          const realEqId = extractRealUserId(e)
          let student = e.aluno_id ? studentByIdMap[String(e.aluno_id).trim()] : null
          
          // Tentar encontrar por código real extraído do evento/payload
          if (!student && realEqId) {
            const rawEq = realEqId
            const cleanEqZero = rawEq.replace(/^0+/, '')
            const numEq = parseInt(rawEq.replace(/\D/g, ''), 10)

            student =
              studentByCleanCodeMap[rawEq] ||
              studentByCleanCodeMap[rawEq.toLowerCase()] ||
              (cleanEqZero ? studentByCleanCodeMap[cleanEqZero] : null) ||
              (!isNaN(numEq) ? studentByNumericMap[numEq] : null) ||
              null
          }

          let currentStatus = e.status

          if (student) {
            const turmaName = student.turma ? turmaMap[String(student.turma)] : null
            const turmaFormatada = student.turma ? (turmaName ? `${student.turma} - ${turmaName}` : String(student.turma)) : null
            
            const statusLower = (student.status || '').toLowerCase()
            const isInactive = statusLower === 'inativo' || statusLower === 'cancelado' || statusLower === 'transferido'
            
            // Se o evento era uma inconsistência por aluno não encontrado, mas agora encontramos o aluno ativo:
            if ((currentStatus === 'inconsistencia' || !e.aluno_nome || e.aluno_nome === 'Usuário Não Cadastrado') && !isInactive) {
              currentStatus = 'sucesso'
            }

            // Agendar reparo persistente no banco de dados
            if (!e.aluno_id || e.aluno_id !== student.id || !e.aluno_nome || e.aluno_nome !== student.nome || e.status !== currentStatus || (realEqId && e.user_id_equipamento !== realEqId)) {
              dbUpdatesToRun.push({
                id: e.id,
                aluno_id: student.id,
                aluno_nome: student.nome,
                user_id_equipamento: realEqId || e.user_id_equipamento,
                status: currentStatus,
              })
            }

            return {
              ...e,
              user_id_equipamento: realEqId || e.user_id_equipamento,
              aluno_id: student.id,
              aluno_nome: student.nome,
              aluno_foto: student.foto || null,
              aluno_turma: turmaFormatada || null,
              aluno_turno: student.turno || null,
              status: currentStatus,
            }
          }

          return e
        })

        // Persistir atualizações no Supabase em segundo plano
        if (dbUpdatesToRun.length > 0) {
          Promise.allSettled(
            dbUpdatesToRun.map(u =>
              supabase.from('portaria_eventos').update({
                aluno_id: u.aluno_id,
                aluno_nome: u.aluno_nome,
                user_id_equipamento: u.user_id_equipamento,
                status: u.status,
              }).eq('id', u.id)
            )
          ).catch(err => console.error('[Portaria Eventos Repair Error]', err))
        }
      }
    }

    return NextResponse.json({ data: mergedData })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
