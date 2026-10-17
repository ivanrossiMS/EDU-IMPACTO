import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { AutorizacaoData, AutorizacaoResposta } from '@/lib/autorizacoes/types'
import { 
  getAutorizacaoVoterKey, 
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

    if (requestedUserId && !isStaff) {
      const allowedIds = new Set<string>(
        [
          String(user.id),
          dbUser?.id ? String(dbUser.id) : null,
          dbUser?.auth_id ? String(dbUser.auth_id) : null,
          user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : null,
          user.user_metadata?.uid_legacy ? String(user.user_metadata.uid_legacy) : null,
        ].filter(Boolean) as string[]
      )

      if (!allowedIds.has(String(requestedUserId))) {
        const userEmail = (user.email || dbUser?.email || '').trim().toLowerCase()
        const orFilters = [
          `id.eq.${user.id}`,
          `dados->>auth_id.eq.${user.id}`,
          `dados->>user_id.eq.${user.id}`,
        ]
        if (userEmail) orFilters.push(`email.ilike.${userEmail}`)
        const { data: respRows } = await adminClient
          .from('responsaveis')
          .select('id, dados')
          .or(orFilters.join(','))
        for (const r of respRows || []) {
          if (r.id) allowedIds.add(String(r.id))
          if (r.dados?.auth_id) allowedIds.add(String(r.dados.auth_id))
          if (r.dados?.user_id) allowedIds.add(String(r.dados.user_id))
        }
      }

      if (!allowedIds.has(String(requestedUserId))) {
        return NextResponse.json(
          { error: 'Acesso negado: usuarioId não pertence ao responsável autenticado.' },
          { status: 403 }
        )
      }
    }

    const effectiveUserId = requestedUserId || user.id
    const effectiveUserName = usuarioNome || dbUser?.nome || user.user_metadata?.nome || user.email || 'Responsável'
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

    const voterKey = getAutorizacaoVoterKey(effectiveUserId, alunoId)
    const existingResposta = autorizacao.respostas?.[voterKey]

    if (existingResposta && autorizacao.permitirAlterarResposta === false) {
      return NextResponse.json({
        error: 'Você já registrou a sua resposta e esta autorização não permite alteração posterior.'
      }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const signatureToken = generateDigitalSignatureHash({
      autorizacaoId: autorizacao.id,
      usuarioId: effectiveUserId,
      alunoId: alunoId || undefined,
      opcaoId: matchedOpcao.id,
      timestamp: nowIso
    })

    const newResposta: AutorizacaoResposta = {
      usuarioId: effectiveUserId,
      usuarioNome: effectiveUserName,
      usuarioFoto: effectiveUserFoto,
      usuarioTipo: effectiveUserTipo,
      alunoId: alunoId || undefined,
      alunoNome: alunoNome || undefined,
      alunoTurma: alunoTurma || undefined,
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
        alunoNome: alunoNome || undefined
      }
    }

    const updatedRespostas = {
      ...(autorizacao.respostas || {}),
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

    // Tenta atualizar também na tabela autorizacoes se existir
    try {
      await adminClient.from('autorizacoes').upsert({
        id: updatedAutorizacao.id,
        dados: updatedAutorizacao
      })
    } catch (_) {}

    const responseAutorizacao = isStaff
      ? updatedAutorizacao
      : (sanitizeAutorizacaoForViewer(updatedAutorizacao, [effectiveUserId, String(user.id), String(alunoId || ''), voterKey]) || updatedAutorizacao)

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
