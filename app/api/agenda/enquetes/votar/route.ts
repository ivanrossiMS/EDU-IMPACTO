import { NextResponse } from 'next/server'
import { resolveUserRole, getAuthorizedAlunoIdsForUser, getAuthorizedResponsavelIdsForUser } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { EnqueteData, EnqueteVoto } from '@/lib/enquetes/types'
import { getVoterKey, getUserVote, isEnqueteClosed, sanitizeEnqueteForViewer } from '@/lib/enquetes/enqueteUtils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, dbUser, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse || NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      comunicadoId,
      opcoesIds,
      usuarioId: requestedUserId,
      usuarioNome,
      usuarioFoto,
      usuarioTipo,
      alunoId,
      alunoNome
    } = body

    if (!comunicadoId) {
      return NextResponse.json({ error: 'comunicadoId é obrigatório' }, { status: 400 })
    }

    if (!Array.isArray(opcoesIds) || opcoesIds.length === 0) {
      return NextResponse.json({ error: 'Nenhuma opção selecionada' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    const cleanAlunoIdFromBody = alunoId ? String(alunoId).trim().replace(/^(a_|_ALU|_)/i, '').trim() : ''
    const cleanReqUserId = requestedUserId ? String(requestedUserId).trim().replace(/^(a_|_ALU|f_|_)/i, '').trim() : ''

    const [authorizedAlunoIds, authorizedRespIds] = !isStaff
      ? await Promise.all([
          getAuthorizedAlunoIdsForUser(user),
          getAuthorizedResponsavelIdsForUser(user)
        ])
      : [new Set<string>(), new Set<string>()]

    const allowedIds = new Set<string>(
      [
        String(user.id),
        dbUser?.id ? String(dbUser.id) : null,
        dbUser?.auth_id ? String(dbUser.auth_id) : null,
        user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : null,
        user.user_metadata?.aluno_id ? String(user.user_metadata.aluno_id) : null,
        user.user_metadata?.uid_legacy ? String(user.user_metadata.uid_legacy) : null,
        user.user_metadata?.slug ? String(user.user_metadata.slug) : null,
        ...Array.from(authorizedAlunoIds),
        ...Array.from(authorizedRespIds),
      ]
        .filter(Boolean)
        .map(id => String(id).trim())
    )

    let matchedRespName: string | null = null
    if (!isStaff && (!allowedIds.has(String(requestedUserId || '').trim()) || !usuarioNome || usuarioNome === 'Participante' || usuarioNome === 'Familiar / Aluno')) {
      const safeUid = String(user.id).replace(/"/g, '')
      const userEmail = (user.email || dbUser?.email || '').trim().toLowerCase().replace(/"/g, '')
      const orFilters = [
        `id.eq."${safeUid}"`,
        `auth_id.eq."${safeUid}"`,
        `dados->>auth_id.eq."${safeUid}"`,
        `dados->>user_id.eq."${safeUid}"`,
      ]
      if (user.user_metadata?.responsavel_id) {
        orFilters.push(`id.eq."${String(user.user_metadata.responsavel_id).replace(/"/g, '')}"`)
      }
      if (userEmail) orFilters.push(`email.ilike."${userEmail}"`)
      const { data: respRows } = await adminClient
        .from('responsaveis')
        .select('id, auth_id, nome, dados')
        .or(orFilters.join(','))
      for (const r of respRows || []) {
        if (r.id) {
          allowedIds.add(String(r.id).trim())
          authorizedRespIds.add(String(r.id).trim())
        }
        if (r.auth_id) allowedIds.add(String(r.auth_id).trim())
        if (r.dados?.auth_id) allowedIds.add(String(r.dados.auth_id).trim())
        if (r.dados?.user_id) allowedIds.add(String(r.dados.user_id).trim())
        if (!matchedRespName && r.nome) matchedRespName = String(r.nome).trim()
        const vincs = r.dados?.alunosVinculados || r.dados?.alunos_vinculados
        if (Array.isArray(vincs)) {
          vincs.forEach((aid: any) => {
            const cleanAid = String(typeof aid === 'object' ? aid?.id || aid?.aluno_id : aid || '').trim()
            if (cleanAid) {
              allowedIds.add(cleanAid)
              authorizedAlunoIds.add(cleanAid)
            }
          })
        }
      }
    }

    if (requestedUserId && !isStaff) {
      const reqTrimmed = String(requestedUserId).trim()
      if (!allowedIds.has(reqTrimmed) && (!cleanReqUserId || !allowedIds.has(cleanReqUserId))) {
        return NextResponse.json(
          { error: 'Acesso negado: usuarioId não pertence ao usuário autenticado.' },
          { status: 403 }
        )
      }
    }

    let cleanAlunoId = cleanAlunoIdFromBody
    if (!cleanAlunoId && cleanReqUserId && authorizedAlunoIds.has(cleanReqUserId) && !authorizedRespIds.has(cleanReqUserId)) {
      cleanAlunoId = cleanReqUserId
    }
    if (!cleanAlunoId && !isStaff && authorizedAlunoIds.size === 1) {
      cleanAlunoId = Array.from(authorizedAlunoIds)[0]
    }

    const primaryUserId =
      (user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id).trim() : '') ||
      Array.from(authorizedRespIds)[0] ||
      String(user.id)

    const effectiveUserId =
      requestedUserId && (!cleanAlunoId || cleanReqUserId !== cleanAlunoId) && !authorizedAlunoIds.has(cleanReqUserId)
        ? String(requestedUserId).trim()
        : primaryUserId

    const effectiveUserName = usuarioNome || matchedRespName || dbUser?.nome || user.user_metadata?.nome || user.email || 'Usuário'
    const effectiveUserFoto = usuarioFoto || user.user_metadata?.foto || null
    const effectiveUserTipo = usuarioTipo || (user.user_metadata?.perfil === 'Família' ? 'responsavel' : 'colaborador')

    const { data: comRow, error: fetchErr } = await adminClient
      .from('comunicados')
      .select('*')
      .eq('id', comunicadoId)
      .maybeSingle()

    if (fetchErr || !comRow) {
      return NextResponse.json({ error: 'Comunicado não encontrado' }, { status: 404 })
    }

    const dados = comRow.dados || {}
    const enquete: EnqueteData | null = dados.enquete || comRow.enquete || null

    if (!enquete) {
      return NextResponse.json({ error: 'Este comunicado não possui uma enquete vinculada' }, { status: 404 })
    }

    if (isEnqueteClosed(enquete)) {
      return NextResponse.json({ error: 'Esta enquete já foi encerrada.' }, { status: 400 })
    }

    // Validar opções
    const validOpcaoIds = (enquete.opcoes || []).map(o => o.id)
    const allValid = opcoesIds.every(id => validOpcaoIds.includes(id))
    if (!allValid) {
      return NextResponse.json({ error: 'Opção inválida selecionada' }, { status: 400 })
    }

    if (enquete.tipo === 'unica' && opcoesIds.length > 1) {
      return NextResponse.json({ error: 'Esta enquete aceita apenas uma única opção' }, { status: 400 })
    }

    if (enquete.tipo === 'multipla' && enquete.maxEscolhas && opcoesIds.length > enquete.maxEscolhas) {
      return NextResponse.json({
        error: `Você pode selecionar no máximo ${enquete.maxEscolhas} opções`
      }, { status: 400 })
    }

    const voterKey = getVoterKey(effectiveUserId, cleanAlunoId || alunoId)
    const existingVote = getUserVote(enquete, effectiveUserId, cleanAlunoId || alunoId)

    if (existingVote && !enquete.permitirAlterarVoto) {
      return NextResponse.json({
        error: 'Você já registrou seu voto e esta enquete não permite alteração de resposta.'
      }, { status: 400 })
    }

    const newVote: EnqueteVoto = {
      usuarioId: effectiveUserId,
      usuarioNome: effectiveUserName,
      usuarioFoto: effectiveUserFoto,
      usuarioTipo: effectiveUserTipo,
      alunoId: cleanAlunoId || alunoId || undefined,
      alunoNome: alunoNome || undefined,
      opcoesIds: opcoesIds,
      votadoEm: new Date().toISOString()
    }

    const baseVotos = { ...(enquete.votos || {}) }
    if (cleanAlunoId) {
      for (const [k, v] of Object.entries(baseVotos)) {
        if (!v) continue
        const vAlunoClean = String(v.alunoId || '').trim().replace(/^(a_|_ALU|_)/i, '').trim()
        if (
          (vAlunoClean && vAlunoClean === cleanAlunoId) ||
          (!vAlunoClean && (k === cleanAlunoId || k.endsWith(`_${cleanAlunoId}`)))
        ) {
          delete baseVotos[k]
        }
      }
    }

    const updatedVotos = {
      ...baseVotos,
      [voterKey]: newVote
    }

    // Recalcular contagem em cada opção
    const updatedOpcoes = (enquete.opcoes || []).map(op => {
      const count = Object.values(updatedVotos).filter(v => v.opcoesIds.includes(op.id)).length
      return {
        ...op,
        votosCount: count
      }
    })

    const updatedEnquete: EnqueteData = {
      ...enquete,
      opcoes: updatedOpcoes,
      votos: updatedVotos,
      totalVotos: Object.keys(updatedVotos).length,
      atualizadoEm: new Date().toISOString()
    }

    const updatedDados = {
      ...dados,
      enquete: updatedEnquete
    }

    // Salva no banco de dados principal de comunicados
    const { error: updateErr } = await adminClient
      .from('comunicados')
      .update({ dados: updatedDados })
      .eq('id', comunicadoId)

    if (updateErr) {
      console.error('Erro ao atualizar enquete no comunicado:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    const viewerAllowedIds = [
      effectiveUserId,
      String(user.id),
      String(requestedUserId || ''),
      String(cleanAlunoId || alunoId || ''),
      voterKey,
      ...Array.from(allowedIds)
    ].filter(Boolean)

    const responseEnquete = isStaff
      ? updatedEnquete
      : (sanitizeEnqueteForViewer(updatedEnquete, viewerAllowedIds) || updatedEnquete)

    return NextResponse.json({
      ok: true,
      enquete: responseEnquete,
      userVote: newVote
    })
  } catch (err: any) {
    console.error('Erro ao votar na enquete:', err)
    return NextResponse.json({ error: err?.message || 'Erro interno ao registrar voto' }, { status: 500 })
  }
}
