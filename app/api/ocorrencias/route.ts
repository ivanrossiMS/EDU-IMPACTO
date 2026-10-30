import { NextResponse, after } from 'next/server'
import { resolveUserRole, getAuthorizedAlunoIdsForUser } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets, getInstitutionalMasterAdminIds } from '@/lib/server/notificationHelper'
import { getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const alunoId = searchParams.get('aluno_id')
  const alunoIds = searchParams.get('aluno_ids')
  const turmaId = searchParams.get('turma_id') || searchParams.get('turma')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : (alunoId ? 500 : 1000)

  const allowedAlunoIds = !isStaff ? await getAuthorizedAlunoIdsForUser(user) : null
  const isAllowedStudent = (idVal: string) => {
    if (isStaff) return true
    if (!allowedAlunoIds) return false
    const clean = String(idVal).replace(/^a_?/, '').trim()
    const unpadded = clean.replace(/^0+/, '')
    return allowedAlunoIds.has(clean) || (Boolean(unpadded) && allowedAlunoIds.has(unpadded))
  }

  if (!isStaff && (!allowedAlunoIds || allowedAlunoIds.size === 0)) {
    return NextResponse.json([])
  }

  let query = supabase.from('ocorrencias').select('*')
  
  const accessStartDate = (alunoId || alunoIds) ? null : await getLoggedUserAccessStartDate(false, user)
  if (accessStartDate && !alunoId && !alunoIds) {
    query = query.gte('created_at', accessStartDate.toISOString())
  }

  query = query.order('created_at', { ascending: false })
  if (alunoId) {
    if (!isStaff && !isAllowedStudent(alunoId)) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }
    query = query.or(`aluno_id.eq.${alunoId},dados->>aluno_id.eq.${alunoId},dados->>alunoId.eq.${alunoId}`)
  } else if (alunoIds) {
    let ids = alunoIds.split(',').map(id => id.trim()).filter(Boolean)
    if (!isStaff) {
      ids = ids.filter(isAllowedStudent)
      if (ids.length === 0) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
      }
    }
    const inList = `(${ids.join(',')})`
    query = query.or(`aluno_id.in.${inList},dados->>aluno_id.in.${inList},dados->>alunoId.in.${inList}`)
  } else if (!isStaff && allowedAlunoIds) {
    const ids = Array.from(allowedAlunoIds)
    const inList = `(${ids.join(',')})`
    query = query.or(`aluno_id.in.${inList},dados->>aluno_id.in.${inList},dados->>alunoId.in.${inList}`)
  } else if (turmaId) {
    const rawTokens = turmaId.split(',').map(id => id.trim()).filter(Boolean)
    if (rawTokens.length > 0) {
      const { supabaseServer } = await import('@/lib/supabaseServer')
      const { data: matchedTurmas } = await supabaseServer
        .from('turmas')
        .select('id, nome')
        .or(`id.in.(${rawTokens.join(',')}),nome.in.(${rawTokens.map(n => `"${n.replace(/"/g, '')}"`).join(',')})`)

      const allTokens = new Set<string>(rawTokens)
      if (matchedTurmas) {
        matchedTurmas.forEach(t => {
          if (t.id) allTokens.add(String(t.id))
          if (t.nome) allTokens.add(String(t.nome))
        })
      }
      const tokenList = Array.from(allTokens)
      const inList = `(${tokenList.map(t => `"${t.replace(/"/g, '')}"`).join(',')})`
      query = query.or(`dados->>turma.in.${inList},turma.in.${inList}`)
    }
  }

  query = query.limit(limit)

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ocorrencias = data || [];
  
  // Buscar nomes das turmas via cache em memória (TTL 60s) com fallback para supabaseServer
  const turmaIds = [...new Set(ocorrencias.map(o => o.dados?.turma).filter(Boolean))];
  let turmasDict: Record<string, string> = {};
  if (turmaIds.length > 0) {
    const { allTurmas } = await getCachedTurmasAndGrupos();
    (allTurmas || []).forEach(t => {
      if (t?.id && t?.nome) turmasDict[t.id] = t.nome;
    });
    const missingIds = turmaIds.filter(id => !turmasDict[id]);
    if (missingIds.length > 0) {
      const { supabaseServer } = await import('@/lib/supabaseServer');
      const { data: turmasData } = await supabaseServer
        .from('turmas')
        .select('id, nome')
        .in('id', missingIds);
        
      if (turmasData) {
        turmasData.forEach(t => {
          turmasDict[t.id] = t.nome;
        });
      }
    }
  }

  return NextResponse.json(ocorrencias.map(row => {
    const turmaId = row.dados?.turma;
    const resolvedAlunoId = String(row.aluno_id || row.dados?.alunoId || row.dados?.aluno_id || '').replace(/^a_?/, '').trim();
    return { 
      ...row, 
      ...(row.dados || {}),
      alunoId: resolvedAlunoId,
      aluno_id: resolvedAlunoId,
      turmaNome: turmaId && turmasDict[turmaId] ? turmasDict[turmaId] : turmaId
    };
  }))
}

export async function POST(request: Request) {
  const { user, dbUser, cargo, perfil, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  const senderName =
    dbUser?.nome ||
    user.user_metadata?.nome ||
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : 'Colaborador')
  const senderCargo = cargo || perfil || dbUser?.cargo || dbUser?.perfil || (isStaff ? 'Colaborador(a)' : 'Responsável')
  const senderFoto = dbUser?.dados?.foto || dbUser?.dados?.avatar || user.user_metadata?.foto || null
  const effectiveSenderId = dbUser?.id || user.id

  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (!isStaff) {
        return NextResponse.json({ error: 'Acesso negado para lançamento em lote de ocorrências.' }, { status: 403 })
      }
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(o => buildRow(o, senderName, effectiveSenderId))
      const { error } = await supabase.from('ocorrencias').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Disparar push em background para não bloquear o response (batch)
      after(async () => {
        const allPushPromises: Promise<any>[] = []
        const masterAdminIds = await getInstitutionalMasterAdminIds()
        const { supabaseServer } = await import('@/lib/supabaseServer')
        for (const row of rows) {
          const parentIds = await getResponsavelIdsForTargets({ targetStudents: [row.aluno_id] })
          const targetIds = Array.from(new Set([...parentIds, ...masterAdminIds])).filter(Boolean)
          if (targetIds.length > 0) {
            let nomeAluno = (row.dados as any)?.alunoNome || ''
            if (!nomeAluno && row.aluno_id) {
              const { data: aluno } = await supabaseServer.from('alunos').select('nome').eq('id', row.aluno_id).maybeSingle()
              nomeAluno = aluno?.nome || ''
            }
            if (!nomeAluno) nomeAluno = 'o aluno'
            const rowDados = (row.dados || {}) as any
            const rowSenderName =
              (rowDados.responsavel && rowDados.responsavel !== 'Colaborador')
                ? rowDados.responsavel
                : (rowDados.registradoPor || senderName)
            const rowSenderId = rowDados.usuarioId || effectiveSenderId
            allPushPromises.push(
              sendAgendaPushNotification({
                type: 'ocorrencias',
                itemId: String(row.id),
                senderUserId: user.id,
                title: '⚠️ Aviso de Ocorrência',
                message: `Uma nova ocorrência foi registrada para ${nomeAluno}. Acesse para ver os detalhes.`,
                targetUserIds: targetIds,
                targetUrl: `/agenda-digital/${row.aluno_id}/ocorrencias?id=${row.id}`,
                metadata: {
                  aluno_id: String(row.aluno_id),
                  item_id: String(row.id),
                  rota: 'ocorrencias',
                  sender_id: rowSenderId,
                  sender_auth_id: user.id,
                  sender_name: rowSenderName,
                  sender_email: dbUser?.email || user.email || null,
                  sender_cargo: rowDados.autorCargo || senderCargo,
                  sender_foto: rowDados.autorFoto || senderFoto,
                }
              }).catch(err => console.error('Ocorrencia Push Error:', err))
            )
          }
        }
        await Promise.allSettled(allPushPromises)
      })

      return NextResponse.json({ ok: true, count: rows.length })
    }
    const isCienciaAction = Boolean(body.ciencia_responsavel || body.dados?.ciencia_responsavel) && Boolean(body.id)
    if (!isStaff && !isCienciaAction) {
      return NextResponse.json({ error: 'Acesso negado. Apenas colaboradores podem criar ou editar ocorrências.' }, { status: 403 })
    }

    let row = buildRow(body, isStaff ? senderName : undefined, isStaff ? effectiveSenderId : undefined)
    if (!isStaff && isCienciaAction) {
      // Família/Responsável só pode registrar ciência em ocorrência já existente, sem adulterar texto/tipo/status
      const { data: existingOc } = await supabase.from('ocorrencias').select('*').eq('id', body.id).maybeSingle()
      if (!existingOc) {
        return NextResponse.json({ error: 'Ocorrência não encontrada.' }, { status: 404 })
      }
      const allowedAlunoIds = await getAuthorizedAlunoIdsForUser(user)
      const ocAlunoId = String(existingOc.aluno_id || existingOc.dados?.alunoId || existingOc.dados?.aluno_id || '').replace(/^a_?/, '').trim()
      const ocAlunoUnpadded = ocAlunoId.replace(/^0+/, '')
      if (!ocAlunoId || (!allowedAlunoIds.has(ocAlunoId) && (!ocAlunoUnpadded || !allowedAlunoIds.has(ocAlunoUnpadded)))) {
        return NextResponse.json({ error: 'Acesso negado para registrar ciência nesta ocorrência.' }, { status: 403 })
      }
      const existingDados = typeof existingOc.dados === 'object' && existingOc.dados ? existingOc.dados : {}
      const incomingDados = typeof body.dados === 'object' && body.dados ? body.dados : {}
      row = {
        ...existingOc,
        dados: {
          ...existingDados,
          ciencia_responsavel: body.ciencia_responsavel ?? incomingDados.ciencia_responsavel ?? true,
          data_ciencia: body.data_ciencia ?? incomingDados.data_ciencia ?? new Date().toISOString(),
          responsavel_ciencia: body.responsavel_ciencia ?? incomingDados.responsavel_ciencia ?? existingDados.responsavel_ciencia,
        },
      }
    }

    const { data, error } = await supabase.from('ocorrencias').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Disparar push em background para não bloquear o response (single)
    after(async () => {
      const { supabaseServer } = await import('@/lib/supabaseServer')
      // Se for apenas registro de ciência da família, não assusta os pais com novo aviso
      if (isCienciaAction) {
        const masterAdminIds = await getInstitutionalMasterAdminIds()
        if (masterAdminIds.length > 0) {
          let nomeAluno = (data.dados as any)?.alunoNome || ''
          if (!nomeAluno && data.aluno_id) {
            const { data: aluno } = await supabaseServer.from('alunos').select('nome').eq('id', data.aluno_id).maybeSingle()
            nomeAluno = aluno?.nome || ''
          }
          if (!nomeAluno) nomeAluno = 'o aluno'
          await sendAgendaPushNotification({
            type: 'ocorrencias',
            itemId: `ciencia_${data.id}`,
            senderUserId: user.id,
            title: '✍️ Ciência de Ocorrência Confirmada',
            message: `A família de ${nomeAluno} confirmou ciência da ocorrência.`,
            targetUserIds: masterAdminIds,
            targetUrl: `/agenda-digital/admin/ocorrencias?id=${data.id}`,
            metadata: {
              aluno_id: String(data.aluno_id),
              item_id: String(data.id),
              rota: 'ocorrencias',
              action: 'ciencia_confirmada',
              sender_id: user.id,
              sender_name: (data.dados as any)?.responsavel_ciencia || senderName,
              sender_type: 'responsavel',
            }
          }).catch(err => console.error('Ciencia Push Error:', err))
        }
        return
      }

      const parentIds = await getResponsavelIdsForTargets({ targetStudents: [data.aluno_id] })
      const masterAdminIds = await getInstitutionalMasterAdminIds()
      const targetIds = Array.from(new Set([...parentIds, ...masterAdminIds])).filter(Boolean)
      if (targetIds.length > 0) {
        let nomeAluno = (data.dados as any)?.alunoNome || ''
        if (!nomeAluno && data.aluno_id) {
          const { data: aluno } = await supabaseServer.from('alunos').select('nome').eq('id', data.aluno_id).maybeSingle()
          nomeAluno = aluno?.nome || ''
        }
        if (!nomeAluno) nomeAluno = 'o aluno'
        const singleDados = (data.dados || {}) as any
        const singleSenderName =
          (singleDados.responsavel && singleDados.responsavel !== 'Colaborador')
            ? singleDados.responsavel
            : (singleDados.registradoPor || senderName)
        const singleSenderId = singleDados.usuarioId || effectiveSenderId
        await sendAgendaPushNotification({
          type: 'ocorrencias',
          itemId: String(data.id),
          senderUserId: user.id,
          title: '⚠️ Aviso de Ocorrência',
          message: `Uma nova ocorrência foi registrada para ${nomeAluno}. Acesse para ver os detalhes.`,
          targetUserIds: targetIds,
          targetUrl: `/agenda-digital/${data.aluno_id}/ocorrencias?id=${data.id}`,
          metadata: {
            aluno_id: String(data.aluno_id),
            item_id: String(data.id),
            rota: 'ocorrencias',
            sender_id: singleSenderId,
            sender_auth_id: user.id,
            sender_name: singleSenderName,
            sender_email: dbUser?.email || user.email || null,
            sender_cargo: singleDados.autorCargo || senderCargo,
            sender_foto: singleDados.autorFoto || senderFoto,
          }
        }).catch(err => console.error('Ocorrencia Push Error:', err))
      }
    })

    const resolvedId = String(data.aluno_id || (data.dados as any)?.alunoId || '').replace(/^a_?/, '').trim()
    return NextResponse.json({ ...data, ...(data.dados || {}), alunoId: resolvedId, aluno_id: resolvedId }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { requireStaff } = await import('@/lib/server/authGuard')
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('ocorrencias').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

function buildRow(o: any, senderName?: string, senderId?: string) {
  const { id, alunoId, aluno_id, tipoId, tipo_id, descricao, data, status, ...rest } = o
  const resolvedAlunoId = String(alunoId || aluno_id || '').replace(/^a_?/, '').trim()
  const effectiveResponsavel =
    rest.responsavel && rest.responsavel !== 'Colaborador'
      ? rest.responsavel
      : (senderName || rest.responsavel || 'Colaborador')
  return {
    id: id || `OC-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    aluno_id: resolvedAlunoId,
    tipo_id: tipoId || tipo_id || '',
    descricao: descricao || '',
    data: data || new Date().toISOString().split('T')[0],
    status: status || 'aberta',
    dados: {
      ...rest,
      responsavel: effectiveResponsavel,
      registradoPor: rest.registradoPor || effectiveResponsavel,
      ...(senderId && !rest.usuarioId ? { usuarioId: senderId } : {}),
      alunoId: resolvedAlunoId,
      aluno_id: resolvedAlunoId,
    },
  }
}
