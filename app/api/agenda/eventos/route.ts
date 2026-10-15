import { NextResponse } from 'next/server'
import { requireAuth, requireStaff, resolveUserRole } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getStudentTargetsForComunicados } from '@/lib/server/notificationHelper'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'
import { getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'
import { isTurmaOrGroupMatch } from '@/lib/studentTurmaUtils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, isStaff, isFamilyOrStudent: resolvedIsFamily, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse || NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const offsetParam = url.searchParams.get('offset')
    const alunoId = url.searchParams.get('aluno_id')
    const idParam = url.searchParams.get('id')
    
    let query = supabase.from('eventos_agenda').select('*')

    if (idParam) {
      query = query.eq('id', idParam)
    }

    if (limitParam) {
      const limit = parseInt(limitParam)
      const offset = offsetParam ? parseInt(offsetParam) : 0
      query = query.range(offset, offset + limit - 1)
    } else {
      query = query.limit(1000)
    }

    query = query.order('data', { ascending: false })

    const { data, error } = await query
    if (error) throw new Error(error.message)

    let rows = data || []

    // Filtragem Segura no Backend para contas exclusivas de Família/Aluno (!isStaff)
    const isRestrictedFamilyOrStudent = !isStaff && resolvedIsFamily
    if (isRestrictedFamilyOrStudent && !idParam) {
      const norm = (s: any) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

      const [{ allTurmas, allGrupos }] = await Promise.all([
        getCachedTurmasAndGrupos()
      ])

      const candidateStudentIds = new Set<string>()
      const candidateRespIds = new Set<string>()
      const familyNamesNorm = new Set<string>()

      if (alunoId) candidateStudentIds.add(String(alunoId).trim())
      if (user.user_metadata?.aluno_id) candidateStudentIds.add(String(user.user_metadata.aluno_id).trim())
      if (user.user_metadata?.nome) familyNamesNorm.add(norm(user.user_metadata.nome))

      if (user.id) candidateRespIds.add(String(user.id).trim())
      if (user.user_metadata?.responsavel_id) candidateRespIds.add(String(user.user_metadata.responsavel_id).trim())
      if (user.user_metadata?.uid_legacy) candidateRespIds.add(String(user.user_metadata.uid_legacy).trim())

      const respOrConds: string[] = []
      if (user.id) {
        respOrConds.push(`dados->>auth_id.eq.${user.id}`)
        respOrConds.push(`dados->>user_id.eq.${user.id}`)
      }
      const userEmail = String(user.email || '').trim().toLowerCase()
      if (userEmail) {
        respOrConds.push(`email.ilike.${userEmail}`)
      }
      const nomeUser = user.user_metadata?.nome
      if (nomeUser) {
        const safeNome = String(nomeUser).replace(/["%,]/g, '').trim()
        if (safeNome.length >= 3) {
          respOrConds.push(`nome.ilike."%${safeNome}%"`)
        }
      }

      const sysConds: string[] = []
      if (user.id) sysConds.push(`id.eq.${user.id}`, `auth_id.eq.${user.id}`)
      if (userEmail) sysConds.push(`email.ilike.${userEmail}`)

      const [respRowsRes, sysDataRes] = await Promise.all([
        respOrConds.length > 0
          ? supabase.from('responsaveis').select('id, nome').or(respOrConds.join(',')).limit(10)
          : Promise.resolve({ data: [] }),
        sysConds.length > 0
          ? supabase.from('system_users').select('id, nome, dados').or(sysConds.join(',')).limit(5)
          : Promise.resolve({ data: [] })
      ])

      if (respRowsRes.data) {
        for (const r of respRowsRes.data as any[]) {
          if (r.id) candidateRespIds.add(String(r.id).trim())
          if (r.nome) familyNamesNorm.add(norm(r.nome))
        }
      }
      if (sysDataRes.data) {
        for (const s of sysDataRes.data as any[]) {
          const rId = s.dados?.responsavel_id || s.dados?.responsavelId
          if (rId) candidateRespIds.add(String(rId).trim())
          if (s.nome) familyNamesNorm.add(norm(s.nome))
        }
      }

      if (candidateRespIds.size > 0) {
        const { data: vincsByResp } = await supabase
          .from('aluno_responsavel')
          .select('aluno_id')
          .in('responsavel_id', Array.from(candidateRespIds))
        if (vincsByResp) {
          for (const v of vincsByResp as any[]) {
            if (v.aluno_id) candidateStudentIds.add(String(v.aluno_id).trim())
          }
        }
      }

      let studentsList: any[] = []
      if (candidateStudentIds.size > 0) {
        const { data: alunosRows } = await supabase
          .from('alunos')
          .select('id, nome, turma, serie, turno, status, dados')
          .in('id', Array.from(candidateStudentIds))
        if (alunosRows && alunosRows.length > 0) {
          studentsList = alunosRows.map((a: any) => {
            if (a.nome) familyNamesNorm.add(norm(a.nome))
            const tObj = (allTurmas || []).find((t: any) =>
              t && (String(t.id) === String(a.turma) || String(t.codigo) === String(a.turma) || t.nome === a.turma)
            )
            return {
              ...a,
              turma_nome: tObj?.nome || a.turma_nome || a.turma || '',
              turno_nome: tObj?.turno || a.turno_nome || a.turno || ''
            }
          })
        }
      }

      rows = rows.filter((row: any) => {
        const rawDados = row.dados && typeof row.dados === 'object' ? row.dados : {}
        const visUser = rawDados.visibilidadeUsuario || row.visibilidadeUsuario
        if (visUser && norm(visUser) !== 'todos') {
          const visNorm = norm(visUser)
          for (const fn of familyNamesNorm) {
            if (fn && (visNorm === fn || visNorm.includes(fn) || fn.includes(visNorm))) {
              return true
            }
          }
          return false
        }

        let targets: any = row.turmas || []
        if (typeof targets === 'string') {
          try { targets = JSON.parse(targets) } catch { targets = [targets] }
        }
        if (!Array.isArray(targets)) targets = []

        if (targets.length === 0) return true

        const isGlobal = targets.some((t: any) => {
          const tl = norm(t)
          return tl === 'todos' || tl === 'toda a escola' || tl === 'todas'
        })
        if (isGlobal) return true

        if (studentsList.length > 0) {
          return studentsList.some(student =>
            targets.some((t: any) => isTurmaOrGroupMatch(t, student, allTurmas || [], allGrupos || []))
          )
        }

        // Fallback se nenhum aluno foi resolvido ainda: permitir eventos universais do ano (ex: TODOS:2026)
        return targets.some((t: any) => String(t || '').trim().toLowerCase().startsWith('todos:'))
      })
    }

    const result = rows.map(row => {
      const rawDados = (row.dados && typeof row.dados === 'object') ? { ...row.dados } : {}
      delete rawDados.dados
      return {
        ...rawDados,
        ...row,
        dados: rawDados,
        horaInicio: row.hora_inicio || rawDados.horaInicio || rawDados.hora_inicio || '',
        horaFim: row.hora_fim || rawDados.horaFim || rawDados.hora_fim || '',
        criadoPor: row.criado_por || rawDados.criadoPor || rawDados.criado_por || '',
      }
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

async function dispatchPushNotifications(supabase: any, row: any) {
  const rowDados = row.dados || {}
  const turmasList = Array.isArray(row.turmas) ? row.turmas : (Array.isArray(rowDados.turmas) ? rowDados.turmas : [])
  const isTodos = turmasList.length === 0 || turmasList.some((t: any) => typeof t === 'string' && (t.toLowerCase().includes('todos') || t.toLowerCase().includes('toda a escola')))

  const targetParams = {
    turmas: turmasList,
    targetClasses: turmasList,
    grupos: rowDados.grupos || rowDados.targetGrupos || [],
    colaboradoresIds: rowDados.colaboradoresIds || rowDados.funcionariosIds || [],
    funcionariosIds: rowDados.funcionariosIds || rowDados.colaboradoresIds || [],
    alunosIds: rowDados.alunosIds || rowDados.targetStudents || [],
    destino: isTodos ? 'todos' : (rowDados.destino || 'selecionados')
  }

  const { students, directColaboradores } = await getStudentTargetsForComunicados(targetParams)
  
  // Handle visibilidadeUsuario
  const visibilidadeUsuario = row.dados?.visibilidadeUsuario || row.visibilidadeUsuario;
  if (visibilidadeUsuario && visibilidadeUsuario !== 'Todos') {
    const { data: sysUser } = await supabase.from('system_users').select('id').ilike('nome', visibilidadeUsuario).maybeSingle();
    if (sysUser?.id) {
      directColaboradores.push(String(sysUser.id));
    } else {
      const { data: respUser } = await supabase.from('responsaveis').select('id').ilike('nome', visibilidadeUsuario).maybeSingle();
      if (respUser?.id) {
        directColaboradores.push(String(respUser.id));
      } else {
        const { data: alunoUser } = await supabase.from('alunos').select('id, nome').ilike('nome', visibilidadeUsuario).maybeSingle();
        if (alunoUser?.id) {
           const { data: vincs } = await supabase.from('aluno_responsavel').select('responsavel_id').eq('aluno_id', alunoUser.id);
           const responsaveis_ids = [String(alunoUser.id)];
           vincs?.forEach((v: any) => responsaveis_ids.push(String(v.responsavel_id)));
           students.push({
             aluno_id: String(alunoUser.id),
             aluno_nome: alunoUser.nome || 'Aluno',
             responsaveis_ids
           });
        }
      }
    }
  }

  // Common date calculation for reminder (horário local de MS: GMT-0400)
  let sendAfterStr = null;
  let shouldSendReminder = false;
  if (row.data) {
    const eventDate = new Date(`${row.data}T12:00:00Z`);
    eventDate.setUTCDate(eventDate.getUTCDate() - 1);
    sendAfterStr = `${eventDate.toISOString().split('T')[0]} 20:00:00 GMT-0400`;
    const sendAfterDate = new Date(`${eventDate.toISOString().split('T')[0]}T20:00:00-04:00`);
    shouldSendReminder = sendAfterDate > new Date();
  }

  // 1. Dispatch for students (personalizado com o nome do aluno)
  if (students.length > 0) {
    const studentPushPromises: Promise<any>[] = [];
    for (const student of students) {
      if (student.responsaveis_ids && student.responsaveis_ids.length > 0) {
        const nomeAluno = formatFriendlyStudentName(student.aluno_nome);

        // Notificação Imediata
        studentPushPromises.push(
          sendAgendaPushNotification({
            type: 'calendario',
            itemId: `${row.id}-${student.aluno_id}`,
            title: '📅 Novo Evento!',
            message: `Novo evento no calendário para a turma de ${nomeAluno}: ${row.titulo}. Confira os detalhes!`,
            targetUserIds: student.responsaveis_ids,
            targetUrl: `/agenda-digital/${student.aluno_id}/calendario?id=${row.id}`,
            metadata: { aluno_id: student.aluno_id, perfil_destino: 'familia', item_id: String(row.id), rota: 'calendario', data: row.data, targetUrl: `/agenda-digital/${student.aluno_id}/calendario?id=${row.id}` }
          }).catch(err => console.error('Evento Push Error:', err))
        );

        // Lembrete Agendado na Véspera
        if (shouldSendReminder && sendAfterStr) {
          studentPushPromises.push(
            sendAgendaPushNotification({
              type: 'calendario',
              itemId: `${row.id}-${student.aluno_id}-reminder`,
              title: '⏰ Lembrete: Amanhã!',
              message: `Lembrete para ${nomeAluno}: amanhã temos o evento ${row.titulo}. Não se esqueça!`,
              targetUserIds: student.responsaveis_ids,
              targetUrl: `/agenda-digital/${student.aluno_id}/calendario?id=${row.id}`,
              metadata: {
                aluno_id: student.aluno_id,
                perfil_destino: 'familia',
                item_id: String(row.id),
                rota: 'calendario',
                data: row.data,
                targetUrl: `/agenda-digital/${student.aluno_id}/calendario?id=${row.id}`,
                is_reminder: true,
                send_after: sendAfterStr,
              },
              sendAfter: sendAfterStr
            }).catch(err => console.error('Evento Reminder Error:', err))
          );
        }
      }
    }
    await Promise.allSettled(studentPushPromises);
  }

  // 2. Dispatch for direct colaboradores / untargeted responsaveis
  if (directColaboradores && directColaboradores.length > 0) {
    await sendAgendaPushNotification({
      type: 'calendario',
      itemId: String(row.id),
      title: '📅 Novo Evento!',
      message: `O evento "${row.titulo}" foi adicionado à sua agenda.`,
      targetUserIds: directColaboradores,
      targetUrl: `/agenda-digital/colaborador/calendario?id=${row.id}`,
      metadata: { perfil_destino: 'colaborador', item_id: String(row.id), rota: 'calendario', data: row.data, targetUrl: `/agenda-digital/colaborador/calendario?id=${row.id}` }
    }).catch(err => console.error('Evento Push Error:', err))

    if (shouldSendReminder && sendAfterStr) {
      await sendAgendaPushNotification({
        type: 'calendario',
        itemId: `${row.id}-reminder`,
        title: '⏰ Lembrete: Amanhã!',
        message: `Amanhã temos o evento: ${row.titulo}. Não se esqueça!`,
        targetUserIds: directColaboradores,
        targetUrl: `/agenda-digital/colaborador/calendario?id=${row.id}`,
        metadata: {
          perfil_destino: 'colaborador',
          item_id: String(row.id),
          rota: 'calendario',
          data: row.data,
          targetUrl: `/agenda-digital/colaborador/calendario?id=${row.id}`,
          is_reminder: true,
          send_after: sendAfterStr,
        },
        sendAfter: sendAfterStr
      }).catch(err => console.error('Evento Reminder Error:', err))
    }
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(buildRowAuth)

      // Identificar apenas eventos novos ou modificados para evitar timeout em salvamentos de lote
      const { data: existingRows } = await supabase
        .from('eventos_agenda')
        .select('id, titulo, data, turmas')
        .in('id', rows.map(r => r.id))

      const existingMap = new Map((existingRows || []).map((e: any) => [e.id, e]))
      const changedRows = rows.filter(r => {
        const prev = existingMap.get(r.id)
        if (!prev) return true // Novo evento
        if (prev.titulo !== r.titulo || prev.data !== r.data) return true // Título ou data mudou
        if (JSON.stringify(prev.turmas || []) !== JSON.stringify(r.turmas || [])) return true // Turmas mudaram
        return false
      })

      const { error } = await supabase.from('eventos_agenda').upsert(rows)
      if (error) throw new Error(error.message)
      
      // Disparar Push apenas para eventos que foram criados ou alterados
      for (const row of changedRows) {
        await dispatchPushNotifications(supabase, row);
      }

      return NextResponse.json({ ok: true, count: rows.length, updatedCount: changedRows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('eventos_agenda').upsert(row).select().single()
    if (error) throw new Error(error.message)

    // Disparar Push (Background)
    await dispatchPushNotifications(supabase, data);

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  return POST(request)
}

function buildRowAuth(body: any) {
  const {
    id, titulo, descricao, tipo, data,
    horaInicio, hora_inicio,
    horaFim, hora_fim,
    turmas, local, cor, recorrente,
    criadoPor, criado_por,
    unidade, created_at, updated_at,
    dados,
    ...rest
  } = body
  const baseDados = (dados && typeof dados === 'object') ? { ...dados } : {}
  delete baseDados.dados
  return {
    id: id || crypto.randomUUID(),
    titulo: titulo || 'Evento sem título',
    descricao: descricao || '',
    tipo: tipo || 'evento',
    data: data || '',
    hora_inicio: horaInicio ?? hora_inicio ?? '',
    hora_fim: horaFim ?? hora_fim ?? '',
    turmas: Array.isArray(turmas) ? turmas : [],
    local: local || '',
    cor: cor || '#f59e0b',
    recorrente: recorrente || false,
    criado_por: criadoPor ?? criado_por ?? '',
    unidade: unidade || '',
    dados: { ...baseDados, ...rest },
  }
}

export async function DELETE(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(request.url)
    let id = url.searchParams.get('id')

    if (!id) {
      try {
        const body = await request.json()
        if (body?.id) id = body.id
      } catch (e) {
        // Sem corpo JSON
      }
    }

    if (!id || !String(id).trim()) {
      return NextResponse.json(
        { error: 'O parâmetro id é obrigatório para exclusão de evento.' },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('eventos_agenda').delete().eq('id', String(id).trim())
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, id: String(id).trim() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

