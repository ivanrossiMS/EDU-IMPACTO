import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { resolveUserRole, resolveFamilyScope } from '@/lib/server/authGuard'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'
import { invalidateAlunosCache } from '@/lib/server/turmasGruposCache'
import { clearPerfilAcessoCache } from '@/lib/server/perfilAcessoCache'
import { syncStudentToDevices } from '@/lib/portariaSync'
import { resolveStudentAutorizadoSairSozinho } from '@/lib/portariaUtils'
import { sanitizeSignerName, validarCPF } from '@/lib/contracts/sealUtils'
import {
  AutorizacaoSaidaComprovante,
  SCHOOL_TIMEZONE,
  formatDateTimeSchoolBR,
  maskCpfDisplay,
  sanitizeSignatureDataUrl,
  sanitizeSvgSignaturePath,
} from '@/lib/autorizacoes/saidaSozinhoUtils'

export const dynamic = 'force-dynamic'

async function findStudentByRef(supabase: any, rawId: string) {
  const cleanRef = String(rawId || '').trim()
  if (!cleanRef) return null

  const { data: byId } = await supabase
    .from('alunos')
    .select('id, nome, matricula, turma, status, email, dados')
    .eq('id', cleanRef)
    .maybeSingle()

  if (byId) return byId

  const { data: byMat } = await supabase
    .from('alunos')
    .select('id, nome, matricula, turma, status, email, dados')
    .eq('matricula', cleanRef)
    .maybeSingle()

  return byMat || null
}

async function resolveSignerContext(
  supabase: any,
  user: any,
  dbUser: any,
  isStaff: boolean,
  cargo: string,
  perfil: string,
  aluno: any
) {
  if (isStaff && dbUser) {
    return {
      hasAccess: true,
      canAuthorize: true,
      isStudentAccount: false,
      signerId: String(dbUser.id || user.id),
      signerNome: sanitizeSignerName(dbUser.nome || user.user_metadata?.nome || user.email || 'Administração Escolar'),
      signerEmail: String(dbUser.email || user.email || '').trim(),
      signerParentesco: String(dbUser.cargo || dbUser.perfil || 'Equipe Escolar').trim(),
      signerCpf: String(dbUser.dados?.cpf || '').trim(),
    }
  }

  const { alunoIds, responsavelIds } = await resolveFamilyScope(user)
  const hasStudentAccess = alunoIds.has(String(aluno.id).trim())

  const lowerCargo = String(cargo || user?.user_metadata?.cargo || '').trim().toLowerCase()
  const lowerPerfil = String(perfil || user?.user_metadata?.perfil || '').trim().toLowerCase()
  const isStudentAccount =
    responsavelIds.size === 0 &&
    (lowerCargo === 'aluno' || lowerPerfil === 'aluno' || Boolean(user?.user_metadata?.aluno_id))

  if (!hasStudentAccess) {
    return {
      hasAccess: false,
      canAuthorize: false,
      isStudentAccount,
      signerId: String(user.id),
      signerNome: '',
      signerEmail: String(user.email || ''),
      signerParentesco: '',
      signerCpf: '',
    }
  }

  if (isStudentAccount || responsavelIds.size === 0) {
    return {
      hasAccess: true,
      canAuthorize: false,
      isStudentAccount: true,
      signerId: String(user.id),
      signerNome: String(aluno.nome || 'Aluno'),
      signerEmail: String(user.email || ''),
      signerParentesco: 'Aluno',
      signerCpf: '',
    }
  }

  const respIdList = Array.from(responsavelIds)
  const studentRefs = [
    aluno.id,
    aluno.matricula,
    aluno.dados?.codigo,
    aluno.dados?.matricula,
  ]
    .filter(Boolean)
    .map((v: any) => String(v).trim())

  const [respRowsRes, linksRes] = await Promise.all([
    supabase
      .from('responsaveis')
      .select('id, nome, email, proibido, dados')
      .in('id', respIdList),
    supabase
      .from('aluno_responsavel')
      .select('responsavel_id, parentesco, resp_financeiro, resp_pedagogico')
      .in('aluno_id', studentRefs)
      .in('responsavel_id', respIdList),
  ])

  const respRows = respRowsRes.data || []
  const links = linksRes.data || []

  // Priorizar responsável vinculado que corresponde ao e-mail ou metadata do usuário logado
  const metaRespId = String(user?.user_metadata?.responsavel_id || '').trim()
  const userEmail = String(user?.email || '').trim().toLowerCase()

  const activeResps = respRows.filter((r: any) => r && r.proibido !== true && r.dados?.proibido !== true)
  const preferredResp =
    activeResps.find((r: any) => metaRespId && String(r.id).trim() === metaRespId) ||
    activeResps.find((r: any) => userEmail && String(r.email || '').trim().toLowerCase() === userEmail) ||
    activeResps[0] ||
    null

  if (!preferredResp) {
    return {
      hasAccess: true,
      canAuthorize: false,
      isStudentAccount: false,
      signerId: String(user.id),
      signerNome: String(user.user_metadata?.nome || user.email || 'Responsável'),
      signerEmail: String(user.email || ''),
      signerParentesco: 'Responsável',
      signerCpf: '',
    }
  }

  const matchedLink = links.find((l: any) => String(l.responsavel_id).trim() === String(preferredResp.id).trim())

  return {
    hasAccess: true,
    canAuthorize: true,
    isStudentAccount: false,
    signerId: String(preferredResp.id),
    signerNome: sanitizeSignerName(preferredResp.nome || user.user_metadata?.nome || user.email || 'Responsável Legal'),
    signerEmail: String(preferredResp.email || user.email || '').trim(),
    signerParentesco: String(matchedLink?.parentesco || preferredResp.dados?.parentesco || 'Responsável Legal').trim(),
    signerCpf: String(preferredResp.dados?.cpf || '').trim(),
  }
}

export async function GET(request: Request) {
  const { user, dbUser, isStaff, perfil, cargo, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  try {
    const url = new URL(request.url)
    const alunoId = url.searchParams.get('aluno_id')
    if (!alunoId) {
      return NextResponse.json({ error: 'aluno_id é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const aluno = await findStudentByRef(supabase, alunoId)
    if (!aluno) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    const ctx = await resolveSignerContext(supabase, user, dbUser, isStaff, cargo, perfil, aluno)
    if (!ctx.hasAccess) {
      return NextResponse.json({ error: 'Acesso negado aos dados deste aluno.' }, { status: 403 })
    }

    const { data: logsData } = await supabase
      .from('logs_auditoria')
      .select('id, acao, dados_novos, data_hora')
      .eq('tabela_nome', 'autorizacao_sair_sozinho')
      .eq('registro_id', String(aluno.id))
      .order('data_hora', { ascending: false })
      .limit(30)

    const historico: AutorizacaoSaidaComprovante[] = (logsData || [])
      .map((row: any) => {
        const d = row.dados_novos || {}
        if (!d.protocolo) return null
        return {
          ...d,
          dataHoraIso: d.dataHoraIso || row.data_hora,
          dataHoraFormatada: d.dataHoraFormatada || formatDateTimeSchoolBR(d.dataHoraIso || row.data_hora),
        } as AutorizacaoSaidaComprovante
      })
      .filter(Boolean) as AutorizacaoSaidaComprovante[]

    const autorizadoSairSozinho = resolveStudentAutorizadoSairSozinho(aluno, aluno.dados)
    const rawSavedComp = aluno.dados?.autorizacaoSairSozinhoComprovante || null

    let comprovanteAtual: AutorizacaoSaidaComprovante | null = null
    const latestMatchingLog = historico.find(h => Boolean(h.autorizado) === autorizadoSairSozinho)

    if (rawSavedComp && Boolean(rawSavedComp.autorizado) === autorizadoSairSozinho) {
      comprovanteAtual = {
        ...rawSavedComp,
        assinaturaBase64:
          rawSavedComp.assinaturaBase64 ||
          (latestMatchingLog && latestMatchingLog.protocolo === rawSavedComp.protocolo
            ? latestMatchingLog.assinaturaBase64 || null
            : null),
      }
    } else if (latestMatchingLog && historico[0]?.protocolo === latestMatchingLog.protocolo) {
      comprovanteAtual = latestMatchingLog
    }

    return NextResponse.json(
      {
        aluno: {
          id: aluno.id,
          nome: aluno.nome,
          matricula: aluno.matricula || aluno.dados?.codigo || '',
          turma: aluno.turma || '',
        },
        autorizadoSairSozinho,
        canAuthorize: ctx.canAuthorize,
        isStudentAccount: ctx.isStudentAccount,
        currentSigner: {
          id: ctx.signerId,
          nome: ctx.signerNome,
          email: ctx.signerEmail,
          parentesco: ctx.signerParentesco,
          cpfMascarado: maskCpfDisplay(ctx.signerCpf),
        },
        comprovanteAtual,
        historico,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (err: any) {
    console.error('[AutorizacaoSaida GET Error]:', err)
    return NextResponse.json({ error: err.message || 'Erro ao consultar autorização de saída' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, dbUser, isStaff, perfil, cargo, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  try {
    const body = await request.json()
    const {
      alunoId,
      autorizar,
      tipoAssinatura = 'caligrafica',
      assinaturaTexto,
      assinaturaSvgPath,
      assinaturaBase64,
      estiloCaligrafico = 'classica',
      cpfResponsavel,
      observacoes,
      aceitouTermo,
    } = body

    if (!alunoId || typeof autorizar !== 'boolean') {
      return NextResponse.json({ error: 'alunoId e autorizar (boolean) são obrigatórios.' }, { status: 400 })
    }

    if (aceitouTermo !== true) {
      return NextResponse.json(
        { error: 'É obrigatório marcar a declaração de ciência e responsabilidade para assinar.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const aluno = await findStudentByRef(supabase, String(alunoId))
    if (!aluno) {
      return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 })
    }

    const ctx = await resolveSignerContext(supabase, user, dbUser, isStaff, cargo, perfil, aluno)
    if (!ctx.hasAccess || !ctx.canAuthorize) {
      return NextResponse.json(
        {
          error: ctx.isStudentAccount
            ? 'Apenas responsáveis legais podem autorizar ou desautorizar a saída desacompanhada.'
            : 'Você não possui permissão para alterar a autorização de saída deste aluno.',
        },
        { status: 403 }
      )
    }

    const cpfDigits = String(cpfResponsavel || '').replace(/\D/g, '')
    if (cpfDigits.length !== 11 || !validarCPF(cpfDigits)) {
      return NextResponse.json(
        { error: 'O CPF do responsável é obrigatório e deve ser válido (11 dígitos) para assinar.' },
        { status: 400 }
      )
    }

    const effectiveCpf = cpfDigits
    const effectiveTipo = tipoAssinatura === 'manual' ? 'manual' : 'caligrafica'
    const cleanSvgPath = effectiveTipo === 'manual' ? sanitizeSvgSignaturePath(assinaturaSvgPath) : null
    const cleanBase64 = sanitizeSignatureDataUrl(assinaturaBase64)
    const cleanAssinaturaTexto = sanitizeSignerName(assinaturaTexto || ctx.signerNome)

    if (effectiveTipo === 'manual') {
      if (!cleanSvgPath && !cleanBase64) {
        return NextResponse.json({ error: 'Desenhe sua assinatura no quadro antes de confirmar.' }, { status: 400 })
      }
    } else {
      if (!cleanAssinaturaTexto || cleanAssinaturaTexto.length < 2) {
        return NextResponse.json({ error: 'Informe o nome completo para a assinatura digital.' }, { status: 400 })
      }
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const dataHoraFormatada = formatDateTimeSchoolBR(nowIso)
    const acao: AutorizacaoSaidaComprovante['acao'] = autorizar
      ? 'AUTORIZAR_SAIDA_SOZINHO'
      : 'DESAUTORIZAR_SAIDA_SOZINHO'

    const previousAutorizado = resolveStudentAutorizadoSairSozinho(aluno, aluno.dados)
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE })
      .format(now)
      .replace(/-/g, '')

    const hashInput = [
      String(aluno.id),
      ctx.signerId,
      acao,
      nowIso,
      cleanAssinaturaTexto,
      cleanSvgPath || '',
      effectiveCpf || '',
    ].join('|')
    const hashVerificacao = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 16).toUpperCase()
    const protocolo = `IMP-SAIDA-${ymd}-${hashVerificacao.slice(0, 6)}`

    const cleanObs = typeof observacoes === 'string' ? observacoes.trim().slice(0, 400) : ''
    const termoAceite = autorizar
      ? 'Autorizo o(a) aluno(a) acima identificado(a) a deixar as dependências do Colégio Impacto desacompanhado(a) de responsável ao término de suas atividades escolares, assumindo integral responsabilidade.'
      : 'Revogo a autorização de saída desacompanhada, determinando que o(a) aluno(a) só poderá deixar a escola acompanhado(a) por responsável ou pessoa previamente autorizada.'

    const comprovanteLeve: AutorizacaoSaidaComprovante = {
      protocolo,
      hashVerificacao,
      acao,
      autorizado: autorizar,
      dataHoraIso: nowIso,
      dataHoraFormatada,
      alunoId: String(aluno.id),
      alunoNome: String(aluno.nome || ''),
      alunoMatricula: String(aluno.matricula || aluno.dados?.codigo || ''),
      assinanteId: ctx.signerId,
      assinanteNome: ctx.signerNome,
      assinanteParentesco: ctx.signerParentesco,
      assinanteEmail: ctx.signerEmail,
      assinanteCpfMascarado: maskCpfDisplay(effectiveCpf),
      tipoAssinatura: effectiveTipo,
      estiloCaligrafico: effectiveTipo === 'caligrafica' ? String(estiloCaligrafico || 'classica') : undefined,
      assinaturaTexto: cleanAssinaturaTexto,
      assinaturaSvgPath: cleanSvgPath,
      observacoes: cleanObs || undefined,
      origem: 'agenda_digital',
      termoAceite,
      previousAutorizado,
    }

    const comprovanteCompleto: AutorizacaoSaidaComprovante = {
      ...comprovanteLeve,
      assinaturaBase64: cleanBase64,
    }

    const existingDados = (aluno.dados && typeof aluno.dados === 'object') ? aluno.dados : {}
    const existingSaude = (existingDados.saude && typeof existingDados.saude === 'object') ? existingDados.saude : {}

    const nextDados = {
      ...existingDados,
      autorizadoSairSozinho: autorizar,
      saude: {
        ...existingSaude,
        autorizaSaida: autorizar,
      },
      autorizacaoSairSozinhoComprovante: comprovanteLeve,
    }

    const { error: updateErr } = await supabase
      .from('alunos')
      .update({
        dados: nextDados,
        updated_at: nowIso,
      })
      .eq('id', aluno.id)

    if (updateErr) {
      throw new Error(updateErr.message)
    }

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || 'Browser'

    await supabase.from('logs_auditoria').insert({
      tabela_nome: 'autorizacao_sair_sozinho',
      registro_id: String(aluno.id),
      acao,
      dados_novos: {
        ...comprovanteCompleto,
        ip: clientIp,
        user_agent: userAgent,
      },
      usuario_id: user.id,
      data_hora: nowIso,
    })

    invalidateAlunosCache()
    clearPerfilAcessoCache(String(aluno.id))
    if (aluno.matricula && String(aluno.matricula) !== String(aluno.id)) {
      clearPerfilAcessoCache(String(aluno.matricula))
    }

    syncStudentToDevices(String(aluno.id), 'update').catch((err) => {
      console.error('[AutorizacaoSaida Portaria Sync Error]:', err?.message || err)
    })

    return NextResponse.json({
      success: true,
      autorizadoSairSozinho: autorizar,
      comprovante: comprovanteCompleto,
      aluno: {
        id: aluno.id,
        nome: aluno.nome,
        matricula: aluno.matricula || existingDados.codigo || '',
      },
    })
  } catch (err: any) {
    console.error('[AutorizacaoSaida POST Error]:', err)
    return NextResponse.json({ error: err.message || 'Erro ao registrar autorização de saída' }, { status: 500 })
  }
}
