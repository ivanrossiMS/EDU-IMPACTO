import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'
import { clearPerfilAcessoCache } from '../perfil-acesso/route'
import { sendPushNotification } from '@/lib/server/pushService'

export const dynamic = 'force-dynamic'

interface AuditLogEntry {
  id: string
  aluno_id: string
  aluno_nome?: string
  responsavel_id: string
  responsavel_nome?: string
  autorizado_por_id: string
  autorizado_por_nome: string
  autorizado_por_email?: string
  acao: 'AUTORIZAR_FINANCEIRO' | 'REVOGAR_FINANCEIRO'
  data_hora: string
  ip?: string
  user_agent?: string
  motivo?: string
}

const ADMIN_ROLES = [
  'Direção',
  'Diretor Geral',
  'Administrador',
  'Administrador Master',
  'Admin',
  'Financeiro',
  'Secretaria',
  'Gestor'
]

async function resolveCallerResp(supabase: any, user: any) {
  const metaRespId = user?.user_metadata?.responsavel_id || (user as any)?.responsavel_id
  let callerRespId = metaRespId ? String(metaRespId).trim() : null
  let callerNome = user?.user_metadata?.nome || user?.user_metadata?.name || user?.email || 'Responsável Financeiro'
  let callerEmail = user?.email || ''

  if (callerRespId) {
    const { data: resp } = await supabase
      .from('responsaveis')
      .select('id, nome, email')
      .eq('id', callerRespId)
      .maybeSingle()
    if (resp?.nome) callerNome = resp.nome
    if (resp?.email) callerEmail = resp.email
  } else if (user?.email) {
    const { data: resp } = await supabase
      .from('responsaveis')
      .select('id, nome, email')
      .ilike('email', user.email.trim())
      .maybeSingle()
    if (resp?.id) {
      callerRespId = String(resp.id)
      callerNome = resp.nome || callerNome
      callerEmail = resp.email || callerEmail
    }
  }

  return { callerRespId, callerNome, callerEmail }
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const alunoId = url.searchParams.get('aluno_id')
    const targetRespId = url.searchParams.get('responsavel_id')

    if (!alunoId) {
      return NextResponse.json({ error: 'aluno_id é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { callerRespId, callerNome } = await resolveCallerResp(supabase, user)

    const userRole = user?.user_metadata?.perfil || user?.user_metadata?.cargo || ''
    const isStaff = ADMIN_ROLES.includes(userRole)

    // 1. Buscar dados do aluno
    const { data: aluno, error: alunoError } = await supabase
      .from('alunos')
      .select('id, nome, responsavel, responsavel_financeiro, responsavel_pedagogico')
      .eq('id', alunoId)
      .maybeSingle()

    if (alunoError || !aluno) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    // 2. Buscar vínculos do aluno
    const { data: links, error: linksError } = await supabase
      .from('aluno_responsavel')
      .select('id, responsavel_id, parentesco, resp_financeiro, resp_pedagogico, created_at, updated_at')
      .eq('aluno_id', alunoId)

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 500 })
    }

    // 3. Buscar dados cadastrais dos responsáveis vinculados
    const respIds = (links || []).map((l: any) => l.responsavel_id).filter(Boolean)
    let responsaveisDb: any[] = []
    if (respIds.length > 0) {
      const { data: respData } = await supabase
        .from('responsaveis')
        .select('id, nome, email, telefone, dados')
        .in('id', respIds)
      responsaveisDb = respData || []
    }

    // 4. Determinar se o usuário chamador tem permissão para gerenciar autorizações
    const titularNome = (aluno.responsavel_financeiro || aluno.responsavel || '').trim()
    const isCallerTitular = Boolean(
      (titularNome && callerNome && titularNome.toLowerCase() === callerNome.toLowerCase()) ||
      (links || []).some((l: any) => l.responsavel_id === callerRespId && l.resp_financeiro === true)
    )
    const canManage = isStaff || isCallerTitular

    // 5. Buscar logs de auditoria de autorizações financeiras para este aluno
    const { data: logsData } = await supabase
      .from('logs_auditoria')
      .select('*')
      .eq('tabela_nome', 'autorizacao_financeira')
      .like('registro_id', `${alunoId}_%`)
      .order('data_hora', { ascending: false })
      .limit(50)

    const auditHistory = (logsData || []).map((log: any) => {
      const extra = log.dados_novos || {}
      return {
        id: log.id,
        aluno_id: extra.aluno_id || alunoId,
        aluno_nome: extra.aluno_nome || aluno.nome,
        responsavel_id: extra.responsavel_id,
        responsavel_nome: extra.responsavel_nome,
        autorizado_por_id: extra.autorizado_por_id,
        autorizado_por_nome: extra.autorizado_por_nome,
        acao: log.acao,
        data_hora: log.data_hora || extra.data_hora,
        ip: extra.ip,
        motivo: extra.motivo
      }
    })

    // Mapear cada responsável com seu estado e último registro de auditoria
    const responsaveisMapped = (links || []).map((link: any) => {
      const resp = responsaveisDb.find((r: any) => String(r.id).trim() === String(link.responsavel_id).trim()) || {}
      const respNome = resp.nome || ''
      const isTitular = Boolean(
        titularNome && respNome && titularNome.toLowerCase() === respNome.toLowerCase()
      )

      // Último log de autorização para esse responsável específico neste aluno
      const latestAudit = auditHistory.find((h: any) => String(h.responsavel_id).trim() === String(link.responsavel_id).trim())

      return {
        id: link.responsavel_id,
        nome: respNome,
        parentesco: link.parentesco || 'Responsável',
        email: resp.email || '',
        telefone: resp.telefone || '',
        respFinanceiro: Boolean(link.resp_financeiro),
        respPedagogico: Boolean(link.resp_pedagogico),
        isTitular,
        latestAudit: latestAudit || null
      }
    })

    // 6. Se fornecido um targetRespId, verificar se existem outros alunos compartilhados
    let outrosAlunosEmComum: any[] = []
    if (targetRespId && callerRespId) {
      const { data: callerLinks } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, resp_financeiro')
        .eq('responsavel_id', callerRespId)
        .eq('resp_financeiro', true)

      const myFinStudentIds = (callerLinks || [])
        .map((l: any) => String(l.aluno_id).trim())
        .filter((id: string) => id !== String(alunoId).trim())

      if (myFinStudentIds.length > 0) {
        const { data: targetOtherLinks } = await supabase
          .from('aluno_responsavel')
          .select('aluno_id, resp_financeiro')
          .eq('responsavel_id', targetRespId)
          .in('aluno_id', myFinStudentIds)

        const commonIds = (targetOtherLinks || []).map((l: any) => l.aluno_id)
        if (commonIds.length > 0) {
          const { data: students } = await supabase
            .from('alunos')
            .select('id, nome, turma')
            .in('id', commonIds)
          outrosAlunosEmComum = students || []
        }
      }
    }

    return NextResponse.json({
      aluno: {
        id: aluno.id,
        nome: aluno.nome,
        responsavel_financeiro: aluno.responsavel_financeiro
      },
      titularNome,
      canManage,
      responsaveis: responsaveisMapped,
      historico: auditHistory,
      outrosAlunosEmComum
    })

  } catch (err: any) {
    console.error('[AutorizacoesFinanceiras GET Error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { alunoId, responsavelId, acao, motivo, aplicarTodosAlunos } = body

    if (!alunoId || !responsavelId || !acao) {
      return NextResponse.json({ error: 'alunoId, responsavelId e acao são obrigatórios' }, { status: 400 })
    }

    if (acao !== 'AUTORIZAR' && acao !== 'REVOGAR') {
      return NextResponse.json({ error: 'Ação inválida. Use AUTORIZAR ou REVOGAR.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { callerRespId, callerNome, callerEmail } = await resolveCallerResp(supabase, user)

    const userRole = user?.user_metadata?.perfil || user?.user_metadata?.cargo || ''
    const isStaff = ADMIN_ROLES.includes(userRole)

    // 1. Buscar aluno e validar autoridade
    const { data: aluno, error: alunoError } = await supabase
      .from('alunos')
      .select('id, nome, responsavel, responsavel_financeiro')
      .eq('id', alunoId)
      .maybeSingle()

    if (alunoError || !aluno) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    const titularNome = (aluno.responsavel_financeiro || aluno.responsavel || '').trim()
    const isCallerTitularName = titularNome && callerNome && titularNome.toLowerCase() === callerNome.toLowerCase()

    // Checar vínculo do chamador no aluno_responsavel
    let isCallerFinResp = false
    if (callerRespId) {
      const { data: myLink } = await supabase
        .from('aluno_responsavel')
        .select('resp_financeiro')
        .eq('aluno_id', alunoId)
        .eq('responsavel_id', callerRespId)
        .maybeSingle()
      if (myLink?.resp_financeiro) isCallerFinResp = true
    }

    const hasAuthority = isStaff || isCallerTitularName || isCallerFinResp
    if (!hasAuthority) {
      return NextResponse.json(
        { error: 'Acesso negado: Apenas o responsável financeiro titular ou a administração pode conceder ou revogar autorizações financeiras.' },
        { status: 403 }
      )
    }

    // 2. Buscar responsável alvo
    const { data: targetResp, error: targetRespError } = await supabase
      .from('responsaveis')
      .select('id, nome, email, telefone')
      .eq('id', responsavelId)
      .maybeSingle()

    if (targetRespError || !targetResp) {
      return NextResponse.json({ error: 'Responsável alvo não encontrado' }, { status: 404 })
    }

    // 3. Blindagem: Não permitir revogar o titular do contrato!
    const isTargetTitular = titularNome && targetResp.nome && titularNome.toLowerCase() === targetResp.nome.toLowerCase()
    if (isTargetTitular && acao === 'REVOGAR') {
      return NextResponse.json(
        { error: 'O responsável financeiro titular do contrato não pode ter seu acesso financeiro revogado.' },
        { status: 400 }
      )
    }

    // 4. Montar lista de alunos a aplicar (este aluno + outros comuns se selecionado)
    const targetStudents: { id: string; nome: string }[] = [{ id: aluno.id, nome: aluno.nome }]

    if (aplicarTodosAlunos && callerRespId) {
      const { data: callerLinks } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, resp_financeiro')
        .eq('responsavel_id', callerRespId)
        .eq('resp_financeiro', true)

      const otherFinIds = (callerLinks || [])
        .map((l: any) => String(l.aluno_id).trim())
        .filter((id: string) => id !== String(alunoId).trim())

      if (otherFinIds.length > 0) {
        const { data: targetOtherLinks } = await supabase
          .from('aluno_responsavel')
          .select('aluno_id')
          .eq('responsavel_id', responsavelId)
          .in('aluno_id', otherFinIds)

        const commonIds = (targetOtherLinks || []).map((l: any) => l.aluno_id)
        if (commonIds.length > 0) {
          const { data: otherStudents } = await supabase
            .from('alunos')
            .select('id, nome')
            .in('id', commonIds)
          if (otherStudents) {
            otherStudents.forEach((s: any) => {
              if (!targetStudents.some(ts => ts.id === s.id)) {
                targetStudents.push(s)
              }
            })
          }
        }
      }
    }

    // 5. Executar as alterações em aluno_responsavel e registrar auditoria
    const isAutorizar = acao === 'AUTORIZAR'
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || 'Browser'
    const nowIso = new Date().toISOString()

    for (const student of targetStudents) {
      // Atualiza resp_financeiro no vínculo
      const { error: updateError } = await supabase
        .from('aluno_responsavel')
        .update({
          resp_financeiro: isAutorizar,
          updated_at: nowIso
        })
        .eq('aluno_id', student.id)
        .eq('responsavel_id', responsavelId)

      if (updateError) {
        console.error(`[AutorizacoesFinanceiras Update Error] Student ${student.id}:`, updateError)
        continue
      }

      // Invalida cache de perfil de acesso para que a alteração seja imediata
      clearPerfilAcessoCache(student.id)

      // Registrar auditoria completa na tabela logs_auditoria
      const auditPayload = {
        aluno_id: student.id,
        aluno_nome: student.nome,
        responsavel_id: responsavelId,
        responsavel_nome: targetResp.nome,
        autorizado_por_id: callerRespId || user.id,
        autorizado_por_nome: callerNome,
        autorizado_por_email: callerEmail,
        acao: isAutorizar ? 'AUTORIZAR_FINANCEIRO' : 'REVOGAR_FINANCEIRO',
        data_hora: nowIso,
        ip: clientIp,
        user_agent: userAgent,
        motivo: motivo || (isAutorizar ? 'Autorizado pelo titular na Agenda Digital' : 'Acesso revogado pelo titular na Agenda Digital')
      }

      await supabase.from('logs_auditoria').insert({
        tabela_nome: 'autorizacao_financeira',
        registro_id: `${student.id}_${responsavelId}`,
        acao: isAutorizar ? 'AUTORIZAR_FINANCEIRO' : 'REVOGAR_FINANCEIRO',
        dados_novos: auditPayload,
        usuario_id: user.id,
        data_hora: nowIso
      })

      // Tenta registrar também na tabela dedicada se existir
      try {
        await supabase.from('autorizacoes_financeiras_logs').insert({
          aluno_id: student.id,
          aluno_nome: student.nome,
          responsavel_autorizado_id: responsavelId,
          responsavel_autorizado_nome: targetResp.nome,
          responsavel_concessor_id: callerRespId || user.id,
          responsavel_concessor_nome: callerNome,
          responsavel_concessor_email: callerEmail,
          acao: isAutorizar ? 'AUTORIZAR' : 'REVOGAR',
          motivo: auditPayload.motivo,
          ip_address: clientIp,
          user_agent: userAgent,
          created_at: nowIso
        })
      } catch (_) {
        // Tabela opcional migrada
      }
    }

    // 6. Notificação Push assíncrona ao responsável que recebeu a autorização
    if (isAutorizar) {
      sendPushNotification({
        title: 'Área Financeira Liberada',
        body: `${callerNome} autorizou você a acessar o setor financeiro de ${aluno.nome}.`,
        targetUserIds: [responsavelId],
        url: `/agenda-digital/${alunoId}/financeiro`
      }).catch((pushErr) => {
        console.warn('[Push Notification Error]:', pushErr)
      })
    }

    return NextResponse.json({
      success: true,
      acao,
      updatedStudentsCount: targetStudents.length,
      message: isAutorizar
        ? `Acesso financeiro concedido com sucesso para ${targetResp.nome}!`
        : `Acesso financeiro de ${targetResp.nome} revogado com sucesso.`
    })

  } catch (err: any) {
    console.error('[AutorizacoesFinanceiras POST Error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
