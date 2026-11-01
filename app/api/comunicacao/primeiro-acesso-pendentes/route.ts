import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import {
  getAdminClient,
  getAllAuthUsersCached,
  findAuthUserByEmail,
} from '@/lib/server/supabaseAdminSingleton'
import {
  DEFAULT_APP_STORE_URL,
  DEFAULT_GOOGLE_PLAY_URL,
  enviarEmailConvitePrimeiroAcessoApp,
  getSmtpConfig,
  type AlunoVinculadoConvite,
} from '@/lib/server/emailService'
import { isNonDeliverableTestEmail, isValidEmailSyntax } from '@/lib/utils/emailValidation'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CONFIG_LINKS_KEY = 'cfgLinksAppStores'
const CONFIG_HISTORY_KEY = 'cfgHistoricoConvite1Acesso'

export interface PendingInviteRecipient {
  id: string
  nome: string
  email: string
  categoria: 'responsavel' | 'aluno' | 'colaborador'
  cargoLabel: string
  cpf?: string
  telefone?: string
  alunosVinculados: AlunoVinculadoConvite[]
  turmas: string[]
  ultimoConviteEnviadoEm?: string | null
  totalConvitesEnviados?: number
}

export interface MissingEmailPendingUser {
  id: string
  nome: string
  categoria: 'responsavel' | 'aluno' | 'colaborador'
  detalhe: string
}

async function fetchAllRows(supabase: any, table: string, cols: string) {
  let all: any[] = []
  let fromLoop = 0
  let toLoop = 999
  let hasMore = true
  let selectCols = cols
  while (hasMore) {
    const { data, error } = await supabase.from(table).select(selectCols).range(fromLoop, toLoop)
    if (error) {
      console.error(`[Convite1Acesso] Erro ao buscar tabela "${table}" com colunas (${selectCols}):`, error.message)
      if (selectCols !== '*') {
        selectCols = '*'
        continue
      }
      hasMore = false
    } else if (!data || data.length === 0) {
      hasMore = false
    } else {
      all = [...all, ...data]
      if (data.length < 1000) hasMore = false
      else {
        fromLoop += 1000
        toLoop += 1000
      }
    }
  }
  return all
}

function resolveBaseOrigin(request: Request, clientOrigin?: string): string {
  const candidates = [
    clientOrigin,
    request.headers.get('origin'),
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[]

  for (const c of candidates) {
    try {
      const u = new URL(c.trim())
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u.origin
      }
    } catch {}
  }

  try {
    return new URL(request.url).origin
  } catch {
    return 'https://impacto-edu.net'
  }
}

export async function GET(req: Request) {
  const { errorResponse } = await requireStaff(req)
  if (errorResponse) return errorResponse

  try {
    const supabaseAdmin = getAdminClient()
    const url = new URL(req.url)

    // Modo leve: apenas histórico de convites enviados (para exibir datas nas tabelas de Usuários/Responsáveis/Alunos)
    if (url.searchParams.get('historyOnly') === 'true') {
      const { data: histRow } = await supabaseAdmin
        .from('configuracoes')
        .select('valor')
        .eq('chave', CONFIG_HISTORY_KEY)
        .maybeSingle()

      const history: Record<string, { sentAt: string; count: number }> =
        histRow?.valor && typeof histRow.valor === 'object' ? histRow.valor : {}

      return NextResponse.json({
        ok: true,
        history,
      })
    }

    const [
      sysUsers,
      allAuthUsers,
      alunosData,
      turmasData,
      respData,
      linksData,
      configsData,
    ] = await Promise.all([
      fetchAllRows(supabaseAdmin, 'system_users', 'id, auth_id, nome, email, cargo, perfil, status'),
      getAllAuthUsersCached(),
      fetchAllRows(supabaseAdmin, 'alunos', 'id, nome, email, matricula, turma, status, dados'),
      fetchAllRows(supabaseAdmin, 'turmas', 'id, nome, codigo'),
      fetchAllRows(supabaseAdmin, 'responsaveis', 'id, nome, email, celular, telefone, auth_id, dados'),
      fetchAllRows(supabaseAdmin, 'aluno_responsavel', 'aluno_id, responsavel_id, resp_financeiro, resp_pedagogico'),
      supabaseAdmin
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [CONFIG_LINKS_KEY, CONFIG_HISTORY_KEY]),
    ])

    // 1. Mapa de configurações salvas (links das lojas e histórico de envios)
    let storeLinks = {
      googlePlayUrl: DEFAULT_GOOGLE_PLAY_URL,
      appStoreUrl: DEFAULT_APP_STORE_URL,
    }
    let inviteHistory: Record<string, { sentAt: string; count: number }> = {}

    const configRows = Array.isArray(configsData?.data) ? configsData.data : []
    for (const row of configRows) {
      if (row.chave === CONFIG_LINKS_KEY && row.valor && typeof row.valor === 'object') {
        if (row.valor.googlePlayUrl) storeLinks.googlePlayUrl = String(row.valor.googlePlayUrl).trim()
        if (row.valor.appStoreUrl) storeLinks.appStoreUrl = String(row.valor.appStoreUrl).trim()
      }
      if (row.chave === CONFIG_HISTORY_KEY && row.valor && typeof row.valor === 'object') {
        inviteHistory = row.valor
      }
    }

    // 2. Mapa de Turmas (id -> nome legível)
    const turmaMap = new Map<string, string>()
    for (const t of turmasData || []) {
      const label = String(t.nome || t.codigo || t.id).split('-')[0].trim()
      if (t.id) turmaMap.set(String(t.id), label)
      if (t.codigo) turmaMap.set(String(t.codigo), label)
      if (t.nome) turmaMap.set(String(t.nome), label)
    }

    // 3. Mapa de Alunos (id / matricula / codigo -> dados do aluno e turma)
    const alunoById = new Map<string, { id: string; nome: string; turma: string; email: string; matricula: string; status: string }>()
    const alunoByAnyRef = new Map<string, { id: string; nome: string; turma: string; email: string; matricula: string; status: string }>()
    for (const a of alunosData || []) {
      const rawTurma = a.turma || a.dados?.turma || ''
      const turmaNome = turmaMap.get(String(rawTurma)) || String(rawTurma || '')
      const rawEmail = (a.email || a.dados?.email || '').trim().toLowerCase()
      const info = {
        id: String(a.id),
        nome: a.nome || 'Estudante',
        turma: turmaNome,
        email: rawEmail,
        matricula: String(a.matricula || a.dados?.codigo || a.id),
        status: String(a.status || 'ativo').toLowerCase(),
      }
      alunoById.set(String(a.id), info)

      const candidateKeys = [
        a.id,
        a.matricula,
        a.dados?.codigo,
        a.dados?.codigoAluno,
        a.dados?.id,
      ]
      for (const k of candidateKeys) {
        if (k !== undefined && k !== null && String(k).trim() !== '') {
          const cleanKey = String(k).trim().toLowerCase()
          alunoByAnyRef.set(cleanKey, info)
          const unpadded = cleanKey.replace(/^0+/, '')
          if (unpadded) alunoByAnyRef.set(unpadded, info)
        }
      }
    }

    // 4. Mapa de Autenticação do Supabase Auth (quem JÁ fez login vs quem NUNCA acessou)
    const authByEmail = new Map<string, any>()
    const authById = new Map<string, any>()
    for (const au of allAuthUsers || []) {
      if (au.id) authById.set(String(au.id), au)
      if (au.email) authByEmail.set(au.email.trim().toLowerCase(), au)
    }

    const hasUserEverSignedIn = (email?: string, authId?: string | null, virtualEmail?: string): boolean => {
      if (authId) {
        const byId = authById.get(String(authId))
        if (byId?.last_sign_in_at) return true
      }
      if (email) {
        const byEmail = authByEmail.get(email.trim().toLowerCase())
        if (byEmail?.last_sign_in_at) return true
      }
      if (virtualEmail) {
        const byVirt = authByEmail.get(virtualEmail.trim().toLowerCase())
        if (byVirt?.last_sign_in_at) return true
      }
      return false
    }

    const isDeliverableRealEmail = (email: string): boolean => {
      if (!email) return false
      const clean = email.trim().toLowerCase()
      if (clean.endsWith('@impactoedu.local')) return false
      if (!isValidEmailSyntax(clean)) return false
      if (isNonDeliverableTestEmail(clean)) return false
      return true
    }

    // ── A. Processar RESPONSÁVEIS ──────────────────────────────────────────
    const respLinksMap = new Map<string, AlunoVinculadoConvite[]>()
    for (const l of linksData || []) {
      if (l.resp_financeiro !== true && l.resp_pedagogico !== true) continue
      const rId = String(l.responsavel_id || '').trim()
      if (!rId) continue
      const rawAlunoRef = String(l.aluno_id || '').trim().toLowerCase()
      const unpaddedRef = rawAlunoRef.replace(/^0+/, '')
      const alunoInfo =
        alunoByAnyRef.get(rawAlunoRef) ||
        (unpaddedRef ? alunoByAnyRef.get(unpaddedRef) : undefined)
      if (!respLinksMap.has(rId)) {
        respLinksMap.set(rId, [])
      }
      if (alunoInfo) {
        const list = respLinksMap.get(rId)!
        if (!list.some(x => x.nome === alunoInfo.nome)) {
          list.push({ nome: alunoInfo.nome, turma: alunoInfo.turma || undefined })
        }
      }
    }

    let respTotal = 0
    let respAtivos = 0
    let respPendentesTotal = 0
    let respSemEmail = 0

    const respByEmail = new Map<string, PendingInviteRecipient>()
    const missingEmailUsers: MissingEmailPendingUser[] = []

    for (const r of respData || []) {
      const rId = String(r.id || '').trim()
      if (!respLinksMap.has(rId)) continue // Apenas responsáveis ativos (Financeiro ou Pedagógico)

      respTotal++
      const d = r.dados || {}
      const email = String(r.email || d.email || '').trim().toLowerCase()
      const alreadyAccessed = hasUserEverSignedIn(email, r.auth_id || d.auth_id)

      if (alreadyAccessed) {
        respAtivos++
        continue
      }

      // Nunca acessou!
      respPendentesTotal++
      const alunosVinc = respLinksMap.get(rId) || []

      if (!isDeliverableRealEmail(email)) {
        respSemEmail++
        if (missingEmailUsers.length < 1000) {
          missingEmailUsers.push({
            id: `resp-${rId}`,
            nome: r.nome || 'Responsável sem nome',
            categoria: 'responsavel',
            detalhe:
              alunosVinc.length > 0
                ? `Resp. por: ${alunosVinc.map(a => a.nome).join(', ')}`
                : 'Sem e-mail válido cadastrado',
          })
        }
        continue
      }

      const existing = respByEmail.get(email)
      if (existing) {
        // Mescla alunos vinculados caso o mesmo e-mail apareça em mais de um registro de responsável
        for (const al of alunosVinc) {
          if (!existing.alunosVinculados.some(x => x.nome === al.nome)) {
            existing.alunosVinculados.push(al)
          }
          if (al.turma && !existing.turmas.includes(al.turma)) {
            existing.turmas.push(al.turma)
          }
        }
      } else {
        const hist = inviteHistory[email]
        const turmasList = Array.from(
          new Set(alunosVinc.map(a => a.turma).filter(Boolean) as string[])
        )
        const cpfVal = String(d.cpf || r.cpf || '').trim()
        const telVal = String(r.celular || r.telefone || d.celular || d.telefone || '').trim()
        respByEmail.set(email, {
          id: `resp-${rId}`,
          nome: (r.nome || 'Responsável').trim(),
          email,
          categoria: 'responsavel',
          cargoLabel: 'Responsável / Família',
          cpf: cpfVal || undefined,
          telefone: telVal || undefined,
          alunosVinculados: [...alunosVinc],
          turmas: turmasList,
          ultimoConviteEnviadoEm: hist?.sentAt || null,
          totalConvitesEnviados: hist?.count || 0,
        })
      }
    }

    // ── B. Processar ALUNOS ────────────────────────────────────────────────
    let alunosTotal = 0
    let alunosAtivos = 0
    let alunosPendentesTotal = 0
    let alunosSemEmail = 0

    const alunosByEmail = new Map<string, PendingInviteRecipient>()

    for (const a of alunosData || []) {
      alunosTotal++
      const alunoInfo = alunoById.get(String(a.id))!
      const email = alunoInfo.email
      const virtualEmail = `aluno.${alunoInfo.matricula}@impactoedu.local`.toLowerCase()

      const alreadyAccessed = hasUserEverSignedIn(email, null, virtualEmail)
      if (alreadyAccessed) {
        alunosAtivos++
        continue
      }

      alunosPendentesTotal++

      if (!isDeliverableRealEmail(email)) {
        alunosSemEmail++
        if (missingEmailUsers.length < 150) {
          missingEmailUsers.push({
            id: `aluno-${a.id}`,
            nome: alunoInfo.nome,
            categoria: 'aluno',
            detalhe: alunoInfo.turma ? `Turma: ${alunoInfo.turma}` : 'Sem e-mail cadastrado',
          })
        }
        continue
      }

      if (!alunosByEmail.has(email)) {
        const hist = inviteHistory[email]
        alunosByEmail.set(email, {
          id: `aluno-${a.id}`,
          nome: alunoInfo.nome,
          email,
          categoria: 'aluno',
          cargoLabel: alunoInfo.turma ? `Aluno • ${alunoInfo.turma}` : 'Aluno',
          alunosVinculados: [{ nome: alunoInfo.nome, turma: alunoInfo.turma || undefined }],
          turmas: alunoInfo.turma ? [alunoInfo.turma] : [],
          ultimoConviteEnviadoEm: hist?.sentAt || null,
          totalConvitesEnviados: hist?.count || 0,
        })
      }
    }

    // ── C. Processar COLABORADORES (system_users) ──────────────────────────
    let colabTotal = 0
    let colabAtivos = 0
    let colabPendentesTotal = 0
    let colabSemEmail = 0

    const colabByEmail = new Map<string, PendingInviteRecipient>()

    for (const u of sysUsers || []) {
      colabTotal++
      const email = (u.email || '').trim().toLowerCase()
      const alreadyAccessed = hasUserEverSignedIn(email, u.auth_id || u.id)

      if (alreadyAccessed) {
        colabAtivos++
        continue
      }

      if (u.status === 'inativo') {
        continue
      }

      colabPendentesTotal++

      if (!isDeliverableRealEmail(email)) {
        colabSemEmail++
        continue
      }

      if (!colabByEmail.has(email)) {
        const hist = inviteHistory[email]
        colabByEmail.set(email, {
          id: `colab-${u.id}`,
          nome: (u.nome || 'Colaborador').trim(),
          email,
          categoria: 'colaborador',
          cargoLabel: u.cargo || u.perfil || 'Colaborador',
          alunosVinculados: [],
          turmas: [],
          ultimoConviteEnviadoEm: hist?.sentAt || null,
          totalConvitesEnviados: hist?.count || 0,
        })
      }
    }

    const respList = Array.from(respByEmail.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    )
    const alunosList = Array.from(alunosByEmail.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    )
    const colabList = Array.from(colabByEmail.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    )

    const allRecipients = [...respList, ...alunosList, ...colabList]

    const allTurmasSet = new Set<string>()
    for (const r of allRecipients) {
      for (const t of r.turmas) {
        if (t) allTurmasSet.add(t)
      }
    }
    const distinctTurmas = Array.from(allTurmasSet).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    return NextResponse.json({
      summary: {
        responsaveis: {
          total: respTotal,
          ativos: respAtivos,
          pendentesTotal: respPendentesTotal,
          elegiveisComEmail: respList.length,
          semEmail: respSemEmail,
          jaConvidados: respList.filter(r => Boolean(r.ultimoConviteEnviadoEm)).length,
        },
        alunos: {
          total: alunosTotal,
          ativos: alunosAtivos,
          pendentesTotal: alunosPendentesTotal,
          elegiveisComEmail: alunosList.length,
          semEmail: alunosSemEmail,
          jaConvidados: alunosList.filter(r => Boolean(r.ultimoConviteEnviadoEm)).length,
        },
        colaboradores: {
          total: colabTotal,
          ativos: colabAtivos,
          pendentesTotal: colabPendentesTotal,
          elegiveisComEmail: colabList.length,
          semEmail: colabSemEmail,
          jaConvidados: colabList.filter(r => Boolean(r.ultimoConviteEnviadoEm)).length,
        },
      },
      recipients: allRecipients,
      missingEmailUsers,
      turmas: distinctTurmas,
      storeLinks,
    })
  } catch (err: any) {
    console.error('[GET /api/comunicacao/primeiro-acesso-pendentes]', err)
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar usuários sem primeiro acesso.' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const { errorResponse } = await requireStaff(req)
  if (errorResponse) return errorResponse

  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'send_batch'
    const supabaseAdmin = getAdminClient()

    const googlePlayUrl = (body.googlePlayUrl || DEFAULT_GOOGLE_PLAY_URL).trim()
    const appStoreUrl = (body.appStoreUrl || DEFAULT_APP_STORE_URL).trim()
    const baseOrigin = resolveBaseOrigin(req, body.origin)

    // ── 1. Salvar Links das Lojas ──────────────────────────────────────────
    if (action === 'save_links') {
      await supabaseAdmin.from('configuracoes').upsert(
        {
          chave: CONFIG_LINKS_KEY,
          valor: { googlePlayUrl, appStoreUrl, updatedAt: new Date().toISOString() },
        },
        { onConflict: 'chave' }
      )
      return NextResponse.json({
        ok: true,
        storeLinks: { googlePlayUrl, appStoreUrl },
      })
    }

    // ── 2. Disparar E-mail de Teste (para homologação visual do gestor) ────
    if (action === 'send_test') {
      const testEmail = String(body.testEmail || '').trim().toLowerCase()
      const testNome = String(body.testNome || 'Responsável Demonstração').trim()

      if (!testEmail || !isValidEmailSyntax(testEmail)) {
        return NextResponse.json(
          { error: 'Informe um endereço de e-mail válido para receber o teste.' },
          { status: 400 }
        )
      }

      const firstAccessUrl = `${baseOrigin}/login?step=first_access_verify&email=${encodeURIComponent(
        testEmail
      )}`

      const res = await enviarEmailConvitePrimeiroAcessoApp({
        destinatario: testEmail,
        nomeDestinatario: testNome,
        categoria: 'responsavel',
        alunosVinculados:
          Array.isArray(body.alunosVinculados) && body.alunosVinculados.length > 0
            ? body.alunosVinculados
            : [{ nome: 'Estudante Exemplo', turma: 'Ensino Fundamental' }],
        firstAccessUrl,
        googlePlayUrl,
        appStoreUrl,
        useFreshConnection: true,
      })

      if (!res.success) {
        return NextResponse.json(
          { error: res.error || 'Falha ao enviar e-mail de teste.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        simulated: res.simulated,
        messageId: res.messageId,
      })
    }

    // ── 3. Disparo em Lote para Usuários Sem Primeiro Acesso ──────────────
    const batch: PendingInviteRecipient[] = Array.isArray(body.recipients) ? body.recipients : []
    if (batch.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum destinatário informado no lote de envio.' },
        { status: 400 }
      )
    }

    // Limita tamanho máximo do lote por requisição para evitar timeout HTTP
    const safeBatch = batch.slice(0, 15)

    // Carrega configuração SMTP e usuários Auth para dupla checagem de segurança
    const [smtpCfg, allAuthUsers, histRow] = await Promise.all([
      getSmtpConfig(),
      getAllAuthUsersCached(),
      supabaseAdmin
        .from('configuracoes')
        .select('valor')
        .eq('chave', CONFIG_HISTORY_KEY)
        .maybeSingle(),
    ])

    const authByEmail = new Map<string, any>()
    for (const au of allAuthUsers || []) {
      if (au.email) authByEmail.set(au.email.trim().toLowerCase(), au)
    }

    const currentHistory: Record<string, { sentAt: string; count: number }> =
      histRow?.data?.valor && typeof histRow.data.valor === 'object'
        ? { ...histRow.data.valor }
        : {}

    const results: Array<{
      id: string
      email: string
      nome: string
      status:
        | 'sent'
        | 'simulated'
        | 'skipped_already_accessed'
        | 'skipped_invalid_email'
        | 'rate_limited'
        | 'failed'
      sentAt?: string
      count?: number
      messageId?: string
      error?: string
    }> = []

    let historyModified = false
    let batchRateLimited = false

    for (let i = 0; i < safeBatch.length; i++) {
      const item = safeBatch[i]
      const cleanEmail = String(item.email || '').trim().toLowerCase()

      if (!cleanEmail || !isValidEmailSyntax(cleanEmail) || cleanEmail.endsWith('@impactoedu.local')) {
        results.push({
          id: item.id,
          email: cleanEmail,
          nome: item.nome,
          status: 'skipped_invalid_email',
          error: 'E-mail inválido ou interno.',
        })
        continue
      }

      // TRAVA DE SEGURANÇA DUPLA NO SERVIDOR:
      // Verifica novamente se o usuário já realizou o 1º acesso antes de disparar o e-mail
      const authUser = authByEmail.get(cleanEmail) || (await findAuthUserByEmail(cleanEmail))
      if (authUser?.last_sign_in_at) {
        results.push({
          id: item.id,
          email: cleanEmail,
          nome: item.nome,
          status: 'skipped_already_accessed',
          error: 'Usuário já realizou o primeiro acesso.',
        })
        continue
      }

      const firstAccessUrl = `${baseOrigin}/login?step=first_access_verify&email=${encodeURIComponent(
        cleanEmail
      )}`

      const sendRes = await enviarEmailConvitePrimeiroAcessoApp({
        destinatario: cleanEmail,
        nomeDestinatario: item.nome || 'Responsável',
        categoria: item.categoria || 'responsavel',
        alunosVinculados: item.alunosVinculados || [],
        firstAccessUrl,
        googlePlayUrl,
        appStoreUrl,
        smtpConfigOverride: smtpCfg,
        useFreshConnection: false, // Reutiliza pool na mesma rajada para performance
        failFastOnRateLimit: true,
      })

      if (sendRes.success) {
        const nowIso = new Date().toISOString()
        const prev = currentHistory[cleanEmail]
        const nextCount = (prev?.count || 0) + 1
        currentHistory[cleanEmail] = {
          sentAt: nowIso,
          count: nextCount,
        }
        historyModified = true

        results.push({
          id: item.id,
          email: cleanEmail,
          nome: item.nome,
          status: sendRes.simulated ? 'simulated' : 'sent',
          sentAt: nowIso,
          count: nextCount,
          messageId: sendRes.messageId,
        })
      } else if (sendRes.rateLimited) {
        // Servidor SMTP da Locaweb informou limite de velocidade (452 4.7.1: too many messages).
        // Interrompe imediatamente o lote para não queimar os demais destinatários e permitir Auto-Cooldown!
        batchRateLimited = true
        results.push({
          id: item.id,
          email: cleanEmail,
          nome: item.nome,
          status: 'rate_limited',
          error: sendRes.error || 'Limite temporário de envio SMTP atingido (452 4.7.1).',
        })
        break
      } else {
        results.push({
          id: item.id,
          email: cleanEmail,
          nome: item.nome,
          status: 'failed',
          error: sendRes.error || 'Falha no envio SMTP.',
        })
      }

      // Pausa suave entre mensagens do lote para respeitar políticas anti-spam da Locaweb
      if (i < safeBatch.length - 1) {
        await new Promise(r => setTimeout(r, 850))
      }
    }

    if (historyModified) {
      const { error: histErr } = await supabaseAdmin
        .from('configuracoes')
        .upsert(
          {
            chave: CONFIG_HISTORY_KEY,
            valor: currentHistory,
          },
          { onConflict: 'chave' }
        )
      if (histErr) {
        console.warn('[Convite1Acesso] Falha ao atualizar histórico de envios:', histErr)
      }
    }

    return NextResponse.json({
      ok: true,
      rateLimited: batchRateLimited,
      results,
      sentCount: results.filter(r => r.status === 'sent' || r.status === 'simulated').length,
      skippedCount: results.filter(r => r.status.startsWith('skipped_')).length,
      failedCount: results.filter(r => r.status === 'failed').length,
    })
  } catch (err: any) {
    console.error('[POST /api/comunicacao/primeiro-acesso-pendentes]', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar disparos de convite.' },
      { status: 500 }
    )
  }
}
