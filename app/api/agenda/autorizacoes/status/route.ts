import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { AutorizacaoData } from '@/lib/autorizacoes/types'

export const dynamic = 'force-dynamic'

const ADMIN_ROLES = [
  'administrador',
  'admin',
  'administrador master',
  'master',
  'diretor geral',
  'diretora geral',
  'diretor',
  'diretora',
  'direcao',
  'diretoria',
  'coordenador',
  'coordenadora',
  'coordenador(a) pedagogico(a)',
  'gestor',
  'auxiliar administrativo',
]

function normalizeText(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function cleanStaffKey(id: any): string {
  return String(id || '')
    .replace(/^(?:f_|func_)/i, '')
    .trim()
    .toLowerCase()
}

function isAdminRoleText(perfil?: string, cargo?: string): boolean {
  const pNorm = normalizeText(perfil)
  const cNorm = normalizeText(cargo)
  return ADMIN_ROLES.some(
    r =>
      pNorm === r ||
      cNorm === r ||
      pNorm.includes('administrador') ||
      cNorm.includes('administrador master') ||
      pNorm.includes('diretor geral') ||
      cNorm.includes('diretor geral') ||
      pNorm.includes('coordenad') ||
      cNorm.includes('coordenad')
  )
}

function isValidYmdDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function isDeadlineInPast(dataLimite: string): boolean {
  const match = dataLimite.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return true
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10) - 1
  const day = parseInt(match[3], 10)
  // Consider end-of-day with -5h timezone tolerance so "today" in Brazil (UTC-3/-4/-5) is never rejected on UTC servers
  const endOfDayUtcMs = Date.UTC(year, month, day, 23, 59, 59, 999) + 5 * 60 * 60 * 1000
  return Date.now() > endOfDayUtcMs
}

export async function POST(request: Request) {
  const { user, dbUser, perfil, cargo, errorResponse } = await requireStaff(request)
  if (errorResponse || !user || !dbUser) {
    return errorResponse || NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { comunicadoId, encerrada } = body
    const hasDataLimite = Object.prototype.hasOwnProperty.call(body, 'dataLimite')

    if (!comunicadoId) {
      return NextResponse.json({ error: 'comunicadoId é obrigatório' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    const { data: comRow, error: fetchErr } = await adminClient
      .from('comunicados')
      .select('*')
      .eq('id', comunicadoId)
      .maybeSingle()

    if (fetchErr || !comRow) {
      return NextResponse.json({ error: 'Comunicado não encontrado' }, { status: 404 })
    }

    const dados =
      typeof comRow.dados === 'string'
        ? (() => {
            try {
              return JSON.parse(comRow.dados)
            } catch {
              return {}
            }
          })()
        : comRow.dados || {}

    const autorizacao: AutorizacaoData | null = dados.autorizacao || comRow.autorizacao || null

    if (!autorizacao) {
      return NextResponse.json({ error: 'Autorização não encontrada neste comunicado' }, { status: 404 })
    }

    // Restringir alteração a administradores ou à pessoa que enviou o comunicado
    const isAdmin = isAdminRoleText(dbUser.perfil || perfil, dbUser.cargo || cargo)
    if (!isAdmin) {
      const userCandidateIds = new Set<string>(
        [
          String(user.id || ''),
          String(dbUser.id || ''),
          String(dbUser.auth_id || ''),
          String(dbUser.dados?.id || ''),
          String(dbUser.dados?.auth_id || ''),
          String(dbUser.dados?.colaborador_id || ''),
          String(dbUser.dados?.uid_legacy || ''),
          String(user.user_metadata?.id || ''),
          String(user.user_metadata?.colaborador_id || ''),
          String(user.user_metadata?.system_user_id || ''),
          String(user.user_metadata?.uid_legacy || ''),
        ]
          .filter(Boolean)
          .map(s => cleanStaffKey(s))
      )

      const userCandidateNames = new Set<string>(
        [dbUser.nome, user.user_metadata?.nome, user.user_metadata?.name]
          .filter(Boolean)
          .map(n => normalizeText(String(n)))
      )

      const comAutorId = cleanStaffKey(dados?.autorId || dados?.autor_id || autorizacao?.criadoPor?.id || '')
      const comAutorNome = normalizeText(comRow?.autor || dados?.autorNome || dados?.autor || autorizacao?.criadoPor?.nome)

      const isAuthor = Boolean(
        (comAutorId && userCandidateIds.has(comAutorId)) ||
          (comAutorNome && userCandidateNames.has(comAutorNome))
      )

      if (!isAuthor) {
        return NextResponse.json(
          { error: 'Acesso negado: apenas quem enviou o comunicado ou um administrador pode alterar o prazo desta autorização.' },
          { status: 403 }
        )
      }
    }

    let nextDataLimite: string | null = autorizacao.dataLimite ?? null
    if (hasDataLimite) {
      const rawLimite = body.dataLimite
      if (rawLimite === null || rawLimite === undefined || String(rawLimite).trim() === '') {
        nextDataLimite = null
      } else {
        const trimmed = String(rawLimite).trim()
        if (!isValidYmdDate(trimmed)) {
          return NextResponse.json(
            { error: 'Data do prazo inválida. Use o formato YYYY-MM-DD.' },
            { status: 400 }
          )
        }
        if (isDeadlineInPast(trimmed)) {
          return NextResponse.json(
            { error: 'A data do prazo não pode estar no passado. Escolha a data de hoje ou uma data futura.' },
            { status: 400 }
          )
        }
        nextDataLimite = trimmed
      }
    }

    const nextEncerrada = typeof encerrada === 'boolean' ? encerrada : Boolean(autorizacao.encerrada)

    if (!nextEncerrada && nextDataLimite && isDeadlineInPast(nextDataLimite)) {
      return NextResponse.json(
        { error: 'O prazo anterior já expirou. Defina uma nova data de prazo ou remova o prazo para reabrir.' },
        { status: 400 }
      )
    }

    const updatedAutorizacao: AutorizacaoData = {
      ...autorizacao,
      encerrada: nextEncerrada,
      dataLimite: nextDataLimite,
      atualizadoEm: new Date().toISOString()
    }

    const updatedDados = {
      ...dados,
      autorizacao: updatedAutorizacao
    }

    const { error: updateErr } = await adminClient
      .from('comunicados')
      .update({ dados: updatedDados })
      .eq('id', comunicadoId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      autorizacao: updatedAutorizacao
    })
  } catch (err: any) {
    console.error('Erro ao atualizar status da autorização:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao alterar status da autorização' }, { status: 500 })
  }
}
