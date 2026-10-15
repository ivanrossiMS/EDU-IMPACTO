import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { EnqueteData, EnqueteVoto } from '@/lib/enquetes/types'
import { getVoterKey, isEnqueteClosed } from '@/lib/enquetes/enqueteUtils'

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

    if (requestedUserId && !isStaff) {
      const allowedIds = new Set<string>(
        [
          String(user.id),
          dbUser?.id ? String(dbUser.id) : null,
          dbUser?.auth_id ? String(dbUser.auth_id) : null,
          user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : null,
          user.user_metadata?.aluno_id ? String(user.user_metadata.aluno_id) : null,
          user.user_metadata?.uid_legacy ? String(user.user_metadata.uid_legacy) : null,
        ].filter(Boolean) as string[]
      )

      if (!allowedIds.has(String(requestedUserId))) {
        const userEmail = (user.email || dbUser?.email || '').trim().toLowerCase()
        const orFilters = [`id.eq.${user.id}`, `auth_id.eq.${user.id}`]
        if (userEmail) orFilters.push(`email.ilike.${userEmail}`)
        const { data: respRows } = await adminClient
          .from('responsaveis')
          .select('id, auth_id')
          .or(orFilters.join(','))
        for (const r of respRows || []) {
          if (r.id) allowedIds.add(String(r.id))
          if (r.auth_id) allowedIds.add(String(r.auth_id))
        }
      }

      if (!allowedIds.has(String(requestedUserId))) {
        return NextResponse.json(
          { error: 'Acesso negado: usuarioId não pertence ao usuário autenticado.' },
          { status: 403 }
        )
      }
    }

    const effectiveUserId = requestedUserId || user.id
    const effectiveUserName = usuarioNome || dbUser?.nome || user.user_metadata?.nome || user.email || 'Usuário'
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

    const voterKey = getVoterKey(effectiveUserId, alunoId)
    const existingVote = enquete.votos?.[voterKey]

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
      alunoId: alunoId || undefined,
      alunoNome: alunoNome || undefined,
      opcoesIds: opcoesIds,
      votadoEm: new Date().toISOString()
    }

    const updatedVotos = {
      ...(enquete.votos || {}),
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

    // Tenta atualizar também na tabela enquetes caso exista
    try {
      await adminClient.from('enquetes').upsert({
        id: updatedEnquete.id,
        titulo: updatedEnquete.pergunta,
        dados: updatedEnquete
      })
    } catch (_) {}

    return NextResponse.json({
      ok: true,
      enquete: updatedEnquete,
      userVote: newVote
    })
  } catch (err: any) {
    console.error('Erro ao votar na enquete:', err)
    return NextResponse.json({ error: err?.message || 'Erro interno ao registrar voto' }, { status: 500 })
  }
}
