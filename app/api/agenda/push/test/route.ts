import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer } from '@/lib/supabaseServer'
import { sendPushNotification } from '@/lib/server/pushService'
import { AgendaPushType } from '@/lib/server/agendaNotifications'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'

export const dynamic = 'force-dynamic'

const ALLOWED_PROFILES = ['Direção', 'Administrador', 'Diretor Geral', 'Administrador Master']

async function verifyAdminAuth(): Promise<
  | { authorized: true; user: any; errorResponse?: never }
  | { authorized: false; errorResponse: NextResponse; user?: never }
> {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse || !user) {
    return {
      authorized: false,
      errorResponse: errorResponse || NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }),
    }
  }

  const supabase = supabaseServer
  const { data: dbUser } = await supabase
    .from('system_users')
    .select('id, perfil, cargo, nome, email')
    .eq('id', user.id)
    .maybeSingle()

  const perfil = dbUser?.perfil || (user.user_metadata?.perfil as string) || ''
  const cargo = dbUser?.cargo || (user.user_metadata?.cargo as string) || ''

  const isAllowed = ALLOWED_PROFILES.includes(perfil) || ALLOWED_PROFILES.includes(cargo)

  if (!isAllowed) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: 'Acesso negado. Apenas administradores e direção podem testar notificações.' },
        { status: 403 }
      ),
    }
  }

  return { authorized: true, user: dbUser || user }
}

/**
 * GET /api/agenda/push/test
 *
 * Query params:
 * - ?aluno_id=... : Retorna aluno, turma, responsáveis vinculados e prontidão de push
 * - ?logs=true : Retorna os últimos 50 logs de disparos de teste
 * - ?config=true : Retorna o status de conexão com o OneSignal
 */
export async function GET(request: Request) {
  const auth = await verifyAdminAuth()
  if (!auth.authorized) return auth.errorResponse!

  const { searchParams } = new URL(request.url)
  const alunoId = searchParams.get('aluno_id')
  const wantLogs = searchParams.get('logs') === 'true'
  const wantConfig = searchParams.get('config') === 'true'
  const supabase = supabaseServer

  try {
    // 1. Status de configuração do OneSignal
    if (wantConfig) {
      const hasAppId = Boolean(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_APP_ID.length > 8)
      const hasRestKey = Boolean(process.env.ONESIGNAL_REST_API_KEY && process.env.ONESIGNAL_REST_API_KEY.length > 8)
      const isMockMode = !hasAppId || !hasRestKey

      return NextResponse.json({
        hasAppId,
        hasRestKey,
        isMockMode,
        appIdPreview: hasAppId ? `${process.env.ONESIGNAL_APP_ID!.slice(0, 8)}...` : null,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://resilient-cuchufli-2b4125.netlify.app',
      })
    }

    // 2. Histórico de logs
    if (wantLogs) {
      const { data: logs, error: logsErr } = await supabase
        .from('agenda_push_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60)

      if (logsErr) {
        return NextResponse.json({ error: logsErr.message }, { status: 400 })
      }

      return NextResponse.json({ logs: logs || [] })
    }

    // 3. Inspeção do Aluno e Responsáveis
    if (alunoId) {
      const cleanAlunoId = alunoId.trim()

      // Buscar aluno
      const { data: aluno, error: alunoErr } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, status, foto, dados, responsavel, responsavel_financeiro, responsavel_pedagogico')
        .or(`id.eq.${cleanAlunoId},matricula.eq.${cleanAlunoId}`)
        .maybeSingle()

      if (alunoErr || !aluno) {
        return NextResponse.json({ error: 'Aluno não encontrado no banco de dados.' }, { status: 404 })
      }

      // Buscar turma para nome amigável
      let turmaNome = aluno.turma || 'Ensino Regular'
      if (aluno.turma) {
        const { data: turmaData } = await supabase
          .from('turmas')
          .select('nome, codigo')
          .eq('id', aluno.turma)
          .maybeSingle()
        if (turmaData?.nome) turmaNome = turmaData.nome
      }

      // Buscar vínculos em aluno_responsavel
      const searchAlunoIds = Array.from(new Set([
        String(aluno.id),
        String(aluno.id).replace(/^0+/, ''),
        aluno.matricula ? String(aluno.matricula) : '',
        aluno.matricula ? String(aluno.matricula).replace(/^0+/, '') : '',
        !isNaN(Number(aluno.id)) ? String(Number(aluno.id)).padStart(6, '0') : ''
      ].filter(Boolean)))

      const { data: vinculos } = await supabase
        .from('aluno_responsavel')
        .select('*')
        .in('aluno_id', searchAlunoIds)

      const respIds = (vinculos || []).map((v: any) => String(v.responsavel_id)).filter(Boolean)
      const expandedRespIds = Array.from(new Set([
        ...respIds,
        ...respIds.map(id => id.replace(/^0+/, '')),
        ...respIds.map(id => !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')
      ].filter(Boolean)))

      // Buscar dados de responsaveis (atenção: tabela não tem coluna cpf)
      let responsaveisList: any[] = []
      let resps: any[] = []
      if (expandedRespIds.length > 0) {
        const { data: rData, error: rErr } = await supabase
          .from('responsaveis')
          .select('id, nome, email, telefone, celular, dados')
          .in('id', expandedRespIds)

        if (rData) resps = rData
        if (rErr) console.warn('[API Push Test] Erro ao buscar responsaveis:', rErr.message)
      }

      // Buscar se existem contas em system_users para esses responsáveis
      const { data: sysUsers } = await supabase
        .from('system_users')
        .select('id, auth_id, email, nome, ultimo_acesso, created_at, dados')
        .limit(2000)

      responsaveisList = (vinculos || []).map((v: any) => {
        const vIdStr = String(v.responsavel_id).trim()
        const vIdClean = vIdStr.replace(/^0+/, '')
        const rInfo: any = (resps || []).find((r: any) => {
          const rIdStr = String(r.id).trim()
          return rIdStr === vIdStr || rIdStr.replace(/^0+/, '') === vIdClean
        }) || {}
        const rEmail = (rInfo.email || '').toLowerCase().trim()

        // Match no system_users por responsavel_id, email ou auth_id
        const sysUser = (sysUsers || []).find((u: any) => {
          const uRespId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
          const uEmail = (u.email || '').toLowerCase().trim()
          return (uRespId && (uRespId === vIdStr || uRespId.replace(/^0+/, '') === vIdClean)) || (rEmail && uEmail === rEmail)
        })

        // NUNCA exibir ID puro — resolver nome real ou papel
        let resolvedNome = (rInfo.nome || '').trim()
        if (!resolvedNome && sysUser?.nome) resolvedNome = sysUser.nome.trim()
        if (!resolvedNome && sysUser?.dados?.nome) resolvedNome = String(sysUser.dados.nome).trim()
        if (!resolvedNome && v.resp_financeiro && (aluno as any).responsavel_financeiro) {
          resolvedNome = String((aluno as any).responsavel_financeiro).trim()
        }
        if (!resolvedNome && (v.parentesco === 'mae' || !v.parentesco) && (aluno as any).responsavel) {
          resolvedNome = String((aluno as any).responsavel).trim()
        }
        if (!resolvedNome && (aluno as any).responsavel_pedagogico) {
          resolvedNome = String((aluno as any).responsavel_pedagogico).trim()
        }
        if (!resolvedNome && (aluno.dados?.mae_nome || aluno.dados?.responsavel)) {
          resolvedNome = String(aluno.dados?.mae_nome || aluno.dados?.responsavel).trim()
        }
        if (!resolvedNome) {
          resolvedNome = v.parentesco ? `Responsável (${v.parentesco})` : 'Responsável Legal'
        }

        return {
          responsavel_id: vIdStr,
          nome: resolvedNome,
          email: rInfo.email || sysUser?.email || null,
          telefone: rInfo.telefone || rInfo.celular || null,
          parentesco: v.parentesco || (v.resp_financeiro ? 'Financeiro' : 'Responsável'),
          isFinanceiro: Boolean(v.resp_financeiro),
          isPedagogico: Boolean(v.resp_pedagogico),
          isOutro: Boolean(v.resp_outro),
          systemUserId: sysUser?.id || null,
          authId: sysUser?.auth_id || null,
          temContaAtiva: Boolean(sysUser),
          ultimoAcesso: sysUser?.ultimo_acesso || null,
        }
      })

      // Se não havia vínculos em aluno_responsavel, mas o aluno possui responsavel cadastrado na tabela alunos
      if (responsaveisList.length === 0) {
        if ((aluno as any).responsavel) {
          responsaveisList.push({
            responsavel_id: `resp-cad-${aluno.id}`,
            nome: String((aluno as any).responsavel).trim(),
            email: aluno.dados?.email_responsavel || null,
            telefone: aluno.dados?.telefone_responsavel || null,
            parentesco: 'Responsável Pedagógico',
            isFinanceiro: false,
            isPedagogico: true,
            isOutro: false,
            systemUserId: null,
            authId: null,
            temContaAtiva: false,
            ultimoAcesso: null,
          })
        }
        if ((aluno as any).responsavel_financeiro && (aluno as any).responsavel_financeiro !== (aluno as any).responsavel) {
          responsaveisList.push({
            responsavel_id: `resp-fin-${aluno.id}`,
            nome: String((aluno as any).responsavel_financeiro).trim(),
            email: aluno.dados?.email_financeiro || null,
            telefone: aluno.dados?.telefone_financeiro || null,
            parentesco: 'Responsável Financeiro',
            isFinanceiro: true,
            isPedagogico: false,
            isOutro: false,
            systemUserId: null,
            authId: null,
            temContaAtiva: false,
            ultimoAcesso: null,
          })
        }
      }

      // Buscar logs recentes específicos deste aluno
      const { data: recentLogs } = await supabase
        .from('agenda_push_logs')
        .select('*')
        .or(`item_id.ilike.%${aluno.id}%,target_url.ilike.%${aluno.id}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      return NextResponse.json({
        aluno: {
          id: String(aluno.id),
          nome: aluno.nome,
          matricula: aluno.matricula || aluno.id,
          turma: turmaNome,
          turmaId: aluno.turma,
          status: aluno.status,
          foto: aluno.foto || aluno.dados?.foto || null,
        },
        responsaveis: responsaveisList,
        recentLogs: recentLogs || [],
      })
    }

    return NextResponse.json({ message: 'Parâmetro aluno_id, logs ou config não especificado.' }, { status: 400 })
  } catch (err: any) {
    console.error('[API Push Test GET] Erro:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao consultar dados.' }, { status: 500 })
  }
}

/**
 * POST /api/agenda/push/test
 *
 * Dispara notificação push de teste para o aluno e seus responsáveis.
 */
export async function POST(request: Request) {
  const auth = await verifyAdminAuth()
  if (!auth.authorized) return auth.errorResponse!

  const supabase = supabaseServer

  try {
    const body = await request.json()
    const {
      alunoId,
      responsavelIds = [],
      includeAlunoDirect = false,
      type = 'test',
      title,
      message,
      targetUrl,
      metadata = {},
      bypassDedup = true,
      ignoreGlobalConfig = true,
    } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'O título da notificação é obrigatório.' }, { status: 400 })
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'A mensagem da notificação é obrigatória.' }, { status: 400 })
    }

    let studentData: any = null
    const targetUserIdsSet = new Set<string>()
    const targetDetails: any[] = []

    // 1. Resolução do Aluno se fornecido
    if (alunoId) {
      const { data: st } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, status, responsavel, responsavel_financeiro, responsavel_pedagogico, dados')
        .or(`id.eq.${String(alunoId).trim()},matricula.eq.${String(alunoId).trim()}`)
        .maybeSingle()

      if (st) {
        studentData = st

        // Incluir o ID do aluno se marcado ou se responsável virtual
        if (includeAlunoDirect) {
          targetUserIdsSet.add(String(st.id))
          if (st.matricula) targetUserIdsSet.add(String(st.matricula))
          targetDetails.push({
            tipo: 'aluno',
            id: String(st.id),
            nome: st.nome,
            descricao: `Acesso do Aluno (${st.matricula || st.id})`,
          })
        }
      }

      // Se responsavelIds não foi passado explicitamente, buscar todos os vinculados
      let respIdsToQuery = Array.isArray(responsavelIds) && responsavelIds.length > 0
        ? responsavelIds.map(String)
        : []

      if (respIdsToQuery.length === 0) {
        const searchAlunoIds = Array.from(new Set([
          String(st?.id || alunoId),
          String(st?.id || alunoId).replace(/^0+/, ''),
          st?.matricula ? String(st.matricula) : '',
        ].filter(Boolean)))

        const { data: vinculos } = await supabase
          .from('aluno_responsavel')
          .select('responsavel_id, parentesco, resp_financeiro, resp_pedagogico')
          .in('aluno_id', searchAlunoIds)

        if (vinculos && vinculos.length > 0) {
          respIdsToQuery = vinculos.map((v: any) => String(v.responsavel_id)).filter(Boolean)
        }
      }

      // Buscar detalhes e contas dos responsáveis selecionados
      if (respIdsToQuery.length > 0) {
        const expandedRespIds = Array.from(new Set([
          ...respIdsToQuery,
          ...respIdsToQuery.map(id => id.replace(/^0+/, '')),
          ...respIdsToQuery.map(id => !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')
        ].filter(Boolean)))

        const { data: resps } = await supabase
          .from('responsaveis')
          .select('id, nome, email, telefone')
          .in('id', expandedRespIds)

        const { data: sysUsers } = await supabase
          .from('system_users')
          .select('id, auth_id, email, nome, dados')
          .limit(2000)

        respIdsToQuery.forEach(rId => {
          const rIdStr = String(rId).trim()
          const rIdClean = rIdStr.replace(/^0+/, '')
          targetUserIdsSet.add(rIdStr)

          const rInfo = (resps || []).find((r: any) => {
            const rid = String(r.id).trim()
            return rid === rIdStr || rid.replace(/^0+/, '') === rIdClean
          })
          const rEmail = (rInfo?.email || '').toLowerCase().trim()

          // Adicionar system_user id e auth_id se existirem
          const matchedUser = (sysUsers || []).find((u: any) => {
            const uRespId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
            const uEmail = (u.email || '').toLowerCase().trim()
            return (uRespId && (uRespId === rIdStr || uRespId.replace(/^0+/, '') === rIdClean)) ||
                   (rEmail && uEmail === rEmail)
          })

          if (matchedUser) {
            if (matchedUser.id) targetUserIdsSet.add(String(matchedUser.id))
            if (matchedUser.auth_id) targetUserIdsSet.add(String(matchedUser.auth_id))
          }

          if (rEmail) {
            targetUserIdsSet.add(rEmail)
          }

          // Resolver nome amigável real — NUNCA mostrar #ID
          let resolvedNome = (rInfo?.nome || '').trim()
          if (!resolvedNome && matchedUser?.nome) resolvedNome = matchedUser.nome.trim()
          if (!resolvedNome && matchedUser?.dados?.nome) resolvedNome = String(matchedUser.dados.nome).trim()
          if (!resolvedNome && st?.responsavel_financeiro && rIdStr.includes('fin')) {
            resolvedNome = String(st.responsavel_financeiro).trim()
          }
          if (!resolvedNome && st?.responsavel) {
            resolvedNome = String(st.responsavel).trim()
          }
          if (!resolvedNome && st?.responsavel_pedagogico) {
            resolvedNome = String(st.responsavel_pedagogico).trim()
          }
          if (!resolvedNome) {
            resolvedNome = 'Responsável Legal'
          }

          targetDetails.push({
            tipo: 'responsavel',
            id: rIdStr,
            nome: resolvedNome,
            email: rInfo?.email || matchedUser?.email || null,
            authId: matchedUser?.auth_id || null,
            systemUserId: matchedUser?.id || null,
          })
        })
      }
    } else if (Array.isArray(responsavelIds) && responsavelIds.length > 0) {
      responsavelIds.forEach(id => targetUserIdsSet.add(String(id).trim()))
    }

    // Se nenhum destinatário for encontrado, adicionar o ID do admin para teste de envio
    if (targetUserIdsSet.size === 0) {
      const adminId = String(auth.user.id)
      targetUserIdsSet.add(adminId)
      targetDetails.push({
        tipo: 'admin_fallback',
        id: adminId,
        nome: (auth.user as any).nome || 'Administrador (Auto-teste)',
        descricao: 'Nenhum responsável encontrado para o aluno; teste redirecionado para o seu usuário.',
      })
    }

    const cleanTargetIds = Array.from(targetUserIdsSet).filter(Boolean)

    // Formatar texto com formatFriendlyStudentName exatamente como a Agenda Digital real
    const rawNomeAluno = studentData?.nome || 'Aluno'
    const nomeAluno = studentData?.nome ? formatFriendlyStudentName(studentData.nome) : 'Aluno'
    const matriculaAluno = studentData?.matricula || ''
    const turmaAluno = studentData?.turma || ''
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const finalTitle = title
      .replace(/{aluno}/gi, nomeAluno)
      .replace(/{turma}/gi, turmaAluno)
      .replace(/{hora}/gi, agoraHora)

    const finalMessage = message
      .replace(/{aluno}/gi, nomeAluno)
      .replace(/{turma}/gi, turmaAluno)
      .replace(/{matricula}/gi, matriculaAluno)
      .replace(/{hora}/gi, agoraHora)

    // Gerar item_id único para testes (evita bloqueio pela deduplicação)
    const uniqueTestId = bypassDedup
      ? `test-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      : `test-${type}-${alunoId || 'general'}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resilient-cuchufli-2b4125.netlify.app'
    let resolvedTargetUrl = targetUrl || `/agenda-digital${studentData?.id ? `/${studentData.id}` : ''}`
    if (studentData?.id) {
      resolvedTargetUrl = resolvedTargetUrl.replace(/{alunoId}/gi, String(studentData.id))
    }
    const finalTargetUrl = resolvedTargetUrl.startsWith('http')
      ? resolvedTargetUrl
      : `${appUrl}${resolvedTargetUrl.startsWith('/') ? '' : '/'}${resolvedTargetUrl}`

    console.log(`🧪 [API Push Test] Disparando push de teste [${type}] para ${cleanTargetIds.length} alvo(s)...`, {
      aluno: nomeAluno,
      targetCount: cleanTargetIds.length,
      item_id: uniqueTestId,
    })

    // Disparar via OneSignal
    const pushResult = await sendPushNotification({
      title: finalTitle,
      body: finalMessage,
      targetUserIds: cleanTargetIds,
      url: finalTargetUrl,
      data: {
        type: type as AgendaPushType,
        item_id: uniqueTestId,
        is_test: true,
        aluno_id: studentData?.id || alunoId || null,
        aluno_nome: nomeAluno,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    })

    // Gravar log na tabela agenda_push_logs
    const logStatus = pushResult.success ? 'sent' : 'failed'
    const logErrorMsg = pushResult.mock
      ? 'Modo Mock: OneSignal não possui credenciais configuradas neste ambiente (push simulado com sucesso).'
      : (pushResult.success ? null : (pushResult.error || 'Erro desconhecido ao enviar'))

    const { data: savedLog, error: logSaveError } = await supabase
      .from('agenda_push_logs')
      .insert({
        user_id: auth.user.id,
        type: type,
        item_id: uniqueTestId,
        title: finalTitle,
        message: finalMessage,
        target_url: finalTargetUrl,
        target_count: cleanTargetIds.length,
        status: logStatus,
        error_message: logErrorMsg,
        onesignal_response: pushResult.data ? JSON.stringify(pushResult.data) : null,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (logSaveError) {
      console.warn('[API Push Test] Falha ao gravar log no banco:', logSaveError.message)
    }

    // Avaliação de diagnóstico
    let warning: string | null = null
    if (pushResult.mock) {
      warning = 'O sistema está em Modo Mock (variáveis ONESIGNAL_APP_ID e/ou ONESIGNAL_REST_API_KEY não configuradas no servidor). A notificação foi simulada com sucesso.'
    } else if (pushResult.recipients === 0) {
      warning = 'A notificação foi aceita pelo OneSignal, porém retornou 0 destinatários inscritos ativos. Isso geralmente ocorre se o responsável ainda não abriu o aplicativo no celular para aceitar as permissões de notificação push.'
    }

    return NextResponse.json({
      ok: pushResult.success,
      notificationId: pushResult.data?.id || null,
      recipients: pushResult.recipients ?? 0,
      mock: Boolean(pushResult.mock),
      status: logStatus,
      targetCount: cleanTargetIds.length,
      targetUserIds: cleanTargetIds,
      targetDetails,
      warning,
      error: pushResult.error || null,
      logId: savedLog?.id || null,
      itemId: uniqueTestId,
      fullUrl: finalTargetUrl,
      title: finalTitle,
      message: finalMessage,
    })
  } catch (err: any) {
    console.error('[API Push Test POST] Erro crítico:', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar envio de teste.' }, { status: 500 })
  }
}
