import { NextResponse } from 'next/server'
import { resolveUserRole, getAuthorizedAlunoIdsForUser, getAuthorizedResponsavelIdsForUser } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'
import { AutorizacaoData, AutorizacaoResposta } from '@/lib/autorizacoes/types'
import { 
  getAutorizacaoVoterKey, 
  getUserAutorizacaoResposta,
  isAutorizacaoClosed, 
  generateDigitalSignatureHash,
  formatDateTimeBR,
  validarCPF,
  formatarCPF,
  sanitizeAutorizacaoForViewer
} from '@/lib/autorizacoes/autorizacaoUtils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, dbUser, isStaff, perfil, cargo, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse || NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      comunicadoId,
      autorizacaoId,
      opcaoId,
      usuarioId: requestedUserId,
      usuarioNome,
      usuarioFoto,
      usuarioTipo,
      alunoId,
      alunoNome,
      alunoTurma,
      observacoes,
      cpfResponsavel,
      documentoResponsavel
    } = body

    const adminClient = getAdminClient()

    // Bloquear perfil Aluno de assinar autorizações familiares
    const lowerPerfil = String(perfil || user.user_metadata?.perfil || '').toLowerCase().trim()
    const lowerCargo = String(cargo || user.user_metadata?.cargo || '').toLowerCase().trim()
    const isDirectAluno =
      lowerPerfil === 'aluno' ||
      lowerCargo === 'aluno' ||
      String(usuarioTipo || '').toLowerCase().trim() === 'aluno' ||
      (!isStaff && Boolean(user.user_metadata?.aluno_id) && !user.user_metadata?.responsavel_id && lowerCargo !== 'responsável' && lowerCargo !== 'responsavel')

    if (isDirectAluno) {
      return NextResponse.json(
        { error: 'Apenas responsáveis podem assinar autorizações escolares.' },
        { status: 403 }
      )
    }

    if (!isStaff && !user.user_metadata?.responsavel_id) {
      const respConds = [`id.eq.${user.id}`, `dados->>auth_id.eq.${user.id}`, `dados->>user_id.eq.${user.id}`]
      if (user.email) respConds.push(`email.ilike.${user.email.trim().toLowerCase()}`)
      const { data: alunoRow } = await adminClient.from('alunos').select('id').eq('id', user.id).maybeSingle()
      const { data: respRow } = await adminClient.from('responsaveis').select('id').or(respConds.join(',')).limit(1).maybeSingle()
      if (alunoRow && !respRow) {
        return NextResponse.json(
          { error: 'Apenas responsáveis podem assinar autorizações escolares.' },
          { status: 403 }
        )
      }
    }

    if (!comunicadoId) {
      return NextResponse.json({ error: 'comunicadoId é obrigatório' }, { status: 400 })
    }

    if (!opcaoId) {
      return NextResponse.json({ error: 'Nenhuma opção de autorização foi selecionada' }, { status: 400 })
    }

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
    if (!isStaff && (!allowedIds.has(String(requestedUserId || '').trim()) || !usuarioNome || usuarioNome === 'Responsável' || usuarioNome === 'Familiar / Aluno')) {
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
          { error: 'Acesso negado: usuarioId não pertence ao responsável autenticado.' },
          { status: 403 }
        )
      }
    }

    if (cleanAlunoIdFromBody && !isStaff) {
      if (!allowedIds.has(cleanAlunoIdFromBody) && !allowedIds.has(String(alunoId).trim())) {
        return NextResponse.json(
          { error: 'Acesso negado: alunoId não pertence ao responsável autenticado.' },
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

    const primaryGuardianId =
      (user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id).trim() : '') ||
      Array.from(authorizedRespIds)[0] ||
      String(user.id)

    const effectiveUserId =
      requestedUserId && (!cleanAlunoId || cleanReqUserId !== cleanAlunoId) && !authorizedAlunoIds.has(cleanReqUserId)
        ? String(requestedUserId).trim()
        : primaryGuardianId

    let resolvedAlunoNome = alunoNome ? String(alunoNome).trim() : ''
    let resolvedAlunoTurma = alunoTurma ? String(alunoTurma).trim() : ''

    let turmaNameByIdOrCode = new Map<string, string>()
    try {
      const { allTurmas } = await getCachedTurmasAndGrupos()
      for (const t of allTurmas || []) {
        const tNome = String(t?.nome || t?.dados?.nome || '').trim()
        if (!tNome) continue
        if (t.id) turmaNameByIdOrCode.set(String(t.id).trim(), tNome)
        if (t.codigo) turmaNameByIdOrCode.set(String(t.codigo).trim(), tNome)
        if (t.dados?.codigo) turmaNameByIdOrCode.set(String(t.dados.codigo).trim(), tNome)
      }
    } catch (_) {}

    if (resolvedAlunoTurma && turmaNameByIdOrCode.has(resolvedAlunoTurma)) {
      resolvedAlunoTurma = turmaNameByIdOrCode.get(resolvedAlunoTurma)!
    }

    if (cleanAlunoId && (!resolvedAlunoNome || !resolvedAlunoTurma || resolvedAlunoNome === 'Aluno' || /^\d+$/.test(resolvedAlunoTurma))) {
      try {
        const { data: stRow } = await adminClient
          .from('alunos')
          .select('id, nome, turma, dados')
          .eq('id', cleanAlunoId)
          .maybeSingle()
        if (stRow) {
          if (!resolvedAlunoNome || resolvedAlunoNome === 'Aluno') {
            resolvedAlunoNome = String(stRow.nome || stRow.dados?.nome || '').trim()
          }
          if (!resolvedAlunoTurma || /^\d+$/.test(resolvedAlunoTurma)) {
            const rawTurma = String(stRow.dados?.turma_nome || stRow.turma || stRow.dados?.turma || resolvedAlunoTurma || '').trim()
            if (rawTurma) {
              const cachedName = turmaNameByIdOrCode.get(rawTurma)
              if (cachedName) {
                resolvedAlunoTurma = cachedName
              } else {
                const { data: tRow } = await adminClient
                  .from('turmas')
                  .select('nome')
                  .or(`id.eq."${rawTurma.replace(/"/g, '')}",codigo.eq."${rawTurma.replace(/"/g, '')}"`)
                  .limit(1)
                  .maybeSingle()
                resolvedAlunoTurma = tRow?.nome ? String(tRow.nome).trim() : rawTurma
              }
            }
          }
        }
      } catch (_) {}
    }

    const isGenericUserName =
      !usuarioNome ||
      usuarioNome === 'Responsável' ||
      usuarioNome === 'Familiar / Aluno' ||
      (resolvedAlunoNome && String(usuarioNome).trim().toLowerCase() === resolvedAlunoNome.toLowerCase())

    const effectiveUserName =
      (!isGenericUserName ? String(usuarioNome).trim() : '') ||
      matchedRespName ||
      dbUser?.nome ||
      user.user_metadata?.nome ||
      String(usuarioNome || '').trim() ||
      user.email ||
      'Responsável'
    const effectiveUserFoto = usuarioFoto || user.user_metadata?.foto || null
    const effectiveUserTipo = usuarioTipo || (user.user_metadata?.perfil === 'Família' ? 'responsavel' : 'responsavel')

    const { data: comRow, error: fetchErr } = await adminClient
      .from('comunicados')
      .select('*')
      .eq('id', comunicadoId)
      .maybeSingle()

    if (fetchErr || !comRow) {
      return NextResponse.json({ error: 'Comunicado não encontrado' }, { status: 404 })
    }

    const dados = comRow.dados || {}
    const autorizacao: AutorizacaoData | null = dados.autorizacao || comRow.autorizacao || null

    if (!autorizacao) {
      return NextResponse.json({ error: 'Este comunicado não possui uma autorização vinculada' }, { status: 404 })
    }

    if (isAutorizacaoClosed(autorizacao)) {
      return NextResponse.json({ error: 'O prazo para responder esta autorização já foi encerrado.' }, { status: 400 })
    }

    const matchedOpcao = (autorizacao.opcoes || []).find(o => o.id === opcaoId)
    if (!matchedOpcao) {
      return NextResponse.json({ error: 'Opção de resposta inválida' }, { status: 400 })
    }

    // Validação estrita de CPF
    const rawCpf = cpfResponsavel || documentoResponsavel
    const isCpfRequired = !!(autorizacao.exigirCpfResponsavel ?? autorizacao.exigirDocumentoResponsavel)

    if (isCpfRequired) {
      if (!rawCpf || !String(rawCpf).trim()) {
        return NextResponse.json({ error: 'O CPF do responsável é obrigatório para assinar esta autorização.' }, { status: 400 })
      }
      if (!validarCPF(String(rawCpf))) {
        return NextResponse.json({ error: 'O CPF informado é inválido. Certifique-se de preencher os 11 dígitos corretos.' }, { status: 400 })
      }
    }

    const formattedCpf = rawCpf && String(rawCpf).trim() ? formatarCPF(String(rawCpf)) : undefined

    const voterKey = getAutorizacaoVoterKey(effectiveUserId, cleanAlunoId || alunoId)
    const existingResposta = getUserAutorizacaoResposta(autorizacao, effectiveUserId, cleanAlunoId || alunoId)

    if (existingResposta && autorizacao.permitirAlterarResposta === false) {
      return NextResponse.json({
        error: 'Você já registrou a sua resposta e esta autorização não permite alteração posterior.'
      }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const signatureToken = generateDigitalSignatureHash({
      autorizacaoId: autorizacao.id,
      usuarioId: effectiveUserId,
      alunoId: cleanAlunoId || alunoId || undefined,
      opcaoId: matchedOpcao.id,
      timestamp: nowIso
    })

    const newResposta: AutorizacaoResposta = {
      usuarioId: effectiveUserId,
      usuarioNome: effectiveUserName,
      usuarioFoto: effectiveUserFoto,
      usuarioTipo: effectiveUserTipo,
      alunoId: cleanAlunoId || alunoId || undefined,
      alunoNome: resolvedAlunoNome || alunoNome || undefined,
      alunoTurma: resolvedAlunoTurma || alunoTurma || undefined,
      opcaoId: matchedOpcao.id,
      opcaoTexto: matchedOpcao.texto,
      tipoDecisao: matchedOpcao.tipo,
      observacoes: observacoes ? String(observacoes).trim() : undefined,
      cpfResponsavel: formattedCpf,
      documentoResponsavel: formattedCpf,
      respondidoEm: nowIso,
      assinaturaDigital: {
        token: signatureToken,
        dataHoraFormatada: formatDateTimeBR(nowIso),
        responsavelNome: effectiveUserName,
        responsavelCpf: formattedCpf,
        responsavelDoc: formattedCpf,
        alunoNome: resolvedAlunoNome || alunoNome || undefined
      }
    }

    const baseRespostas = { ...(autorizacao.respostas || {}) }
    for (const [k, r] of Object.entries(baseRespostas)) {
      if (!r) continue
      const rAlunoClean = String(r.alunoId || '').trim().replace(/^(a_|_ALU|_)/i, '').trim()
      if (
        cleanAlunoId &&
        ((rAlunoClean && rAlunoClean === cleanAlunoId) ||
          (!rAlunoClean && (k === cleanAlunoId || k.endsWith(`_${cleanAlunoId}`))))
      ) {
        delete baseRespostas[k]
        continue
      }
      if (r.alunoTurma && turmaNameByIdOrCode.has(String(r.alunoTurma).trim())) {
        baseRespostas[k] = {
          ...r,
          alunoTurma: turmaNameByIdOrCode.get(String(r.alunoTurma).trim())
        }
      }
    }

    const updatedRespostas = {
      ...baseRespostas,
      [voterKey]: newResposta
    }

    // Recalcula contagem por opção
    const updatedOpcoes = (autorizacao.opcoes || []).map(op => {
      const count = Object.values(updatedRespostas).filter(r => r.opcaoId === op.id).length
      return {
        ...op,
        respostasCount: count
      }
    })

    const updatedAutorizacao: AutorizacaoData = {
      ...autorizacao,
      opcoes: updatedOpcoes,
      respostas: updatedRespostas,
      totalRespostas: Object.keys(updatedRespostas).length,
      atualizadoEm: nowIso
    }

    const updatedDados = {
      ...dados,
      autorizacao: updatedAutorizacao
    }

    // Salva no banco de dados principal de comunicados
    const { error: updateErr } = await adminClient
      .from('comunicados')
      .update({ dados: updatedDados })
      .eq('id', comunicadoId)

    if (updateErr) {
      console.error('Erro ao atualizar autorização no comunicado:', updateErr)
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

    const responseAutorizacao = isStaff
      ? updatedAutorizacao
      : (sanitizeAutorizacaoForViewer(updatedAutorizacao, viewerAllowedIds) || updatedAutorizacao)

    return NextResponse.json({
      ok: true,
      autorizacao: responseAutorizacao,
      userResposta: newResposta
    })
  } catch (err: any) {
    console.error('Erro ao responder autorização:', err)
    return NextResponse.json({ error: err?.message || 'Erro interno ao registrar autorização' }, { status: 500 })
  }
}
