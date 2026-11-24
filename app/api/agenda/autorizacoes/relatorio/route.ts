import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { supabaseServer } from '@/lib/supabaseServer'
import {
  getCachedTurmasAndGrupos,
  getCachedEquipes,
  getCachedActiveAlunos,
} from '@/lib/server/turmasGruposCache'
import {
  isAlunoCursandoTurma,
  canStudentReceiveTurmaContent,
  getAlunoTurmaCursando,
  compareTurmasBySerie,
} from '@/lib/studentTurmaUtils'
import { isCobrancaPaidStatus } from '@/lib/cobrancasUtils'
import { isValidStudentPhoto } from '@/lib/utils'
import { AutorizacaoData, AutorizacaoResposta, AutorizacaoOpcaoStat } from '@/lib/autorizacoes/types'
import {
  isAutorizacaoClosed,
  formatTimeRemaining,
  formatDateTimeBR,
  formatDataEventoBR,
  getAutorizacaoTermoPlainText,
} from '@/lib/autorizacoes/autorizacaoUtils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizeText(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function cleanStudentKey(val: any): string {
  return String(val || '')
    .replace(/^(?:a_|_ALU|ALU|_)/i, '')
    .trim()
}

function stripLeadingZeros(val: string): string {
  const s = val.replace(/^0+/, '')
  return s || val
}

function cleanStaffKey(val: any): string {
  return String(val || '')
    .replace(/^(?:f_|func_)/i, '')
    .trim()
    .toLowerCase()
}

function parseJsonField<T = any>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T
    } catch {
      return fallback
    }
  }
  return val as T
}

function formatPhone(raw?: string | null): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return digits.length >= 8 ? String(raw).trim() : null
}

async function fetchInChunks<T>(
  table: string,
  select: string,
  column: string,
  values: string[],
  chunkSize = 150
): Promise<T[]> {
  if (!values || values.length === 0) return []
  const unique = Array.from(new Set(values.filter(Boolean)))
  const results: T[] = []
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabaseServer.from(table).select(select).in(column, chunk)
    if (!error && Array.isArray(data)) {
      results.push(...(data as T[]))
    }
  }
  return results
}

function extractFallbackStudentGuardian(a: any): {
  nome: string | null
  parentesco: string | null
  telefone: string | null
} {
  const d = a?.dados || {}
  const list = Array.isArray(a?.responsaveis)
    ? a.responsaveis
    : Array.isArray(d?.responsaveis)
      ? d.responsaveis
      : []
  const primary =
    list.find((r: any) => r && (r.isPedagogico || r.respPedagogico)) ||
    list.find((r: any) => r && (r.isFinanceiro || r.respFinanceiro)) ||
    list.find((r: any) => r && r.nome) ||
    list[0] ||
    null

  const nome =
    String(
      primary?.nome ||
        d.nomeResponsavel ||
        d.responsavel_nome ||
        d.responsavelNome ||
        d.responsavel ||
        d.mae_nome ||
        d.maeNome ||
        d.mae ||
        d.pai_nome ||
        d.paiNome ||
        d.pai ||
        a?.responsavel_pedagogico ||
        a?.responsavel_financeiro ||
        a?.responsavel ||
        ''
    ).trim() || null

  const parentesco =
    String(primary?.parentesco || d.parentesco || '').trim() || (nome ? 'Responsável' : null)

  const phoneCandidates = [
    primary?.celular,
    primary?.telefone,
    primary?.whatsapp,
    primary?.dados?.celular,
    primary?.dados?.telefone,
    d.whatsappResponsavel,
    d.celularResponsavel,
    d.telefoneResponsavel,
    d.telResponsavelFinanceiro,
    d.mae_telefone,
    d.maeTelefone,
    d.pai_telefone,
    d.paiTelefone,
    d.celular,
    d.telefone,
    a?.telefone,
  ]
  let telefone: string | null = null
  for (const c of phoneCandidates) {
    const formatted = formatPhone(c)
    if (formatted) {
      telefone = formatted
      break
    }
  }

  return { nome, parentesco, telefone }
}

function extractExplicitStudentIdsFromComunicado(comId: string, com: any, dados: any): Set<string> {
  const result = new Set<string>()
  const addId = (raw: any) => {
    const c = cleanStudentKey(raw)
    if (c) result.add(c)
  }

  const arr1 = Array.isArray(dados?.alunosIds)
    ? dados.alunosIds
    : Array.isArray(com?.alunosIds)
      ? com.alunosIds
      : []
  arr1.forEach(addId)

  const arr2 = Array.isArray(dados?.targetStudents) ? dados.targetStudents : []
  arr2.forEach(addId)

  const arr3 = Array.isArray(dados?.stu_target_ids)
    ? dados.stu_target_ids
    : Array.isArray(com?.stu_target_ids)
      ? com.stu_target_ids
      : []
  arr3.forEach(addId)

  if (comId.startsWith('AD-COM-REL-STU-')) {
    const m = comId.match(/AD-COM-REL-STU-\d+-([^-]+)-/)
    if (m && m[1]) addId(m[1])
  }

  return result
}

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

function isAdminRoleText(perfil?: string, cargo?: string): boolean {
  const pNorm = normalizeText(perfil)
  const cNorm = normalizeText(cargo)
  return ADMIN_ROLES.some(
    (r) =>
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

export interface RelatorioAutorizacaoAlunoItem {
  key: string
  alunoId: string
  alunoNome: string
  alunoMatricula: string
  alunoTurma: string
  alunoFoto: string | null
  statusResposta: 'aprova' | 'recusa' | 'neutro' | 'pendente'
  opcaoId: string | null
  opcaoTexto: string | null
  observacoes: string | null
  respondidoEm: string | null
  respondidoEmFormatado: string | null
  assinanteId: string | null
  assinanteNome: string | null
  assinanteCpf: string | null
  protocoloToken: string | null
  responsavelPrincipalNome: string | null
  responsavelPrincipalParentesco: string | null
  responsavelPrincipalTelefone: string | null
  leuComunicado: boolean
  pagamentoStatus: 'pago' | 'pendente' | 'sem_cobranca'
}

export interface RelatorioAutorizacaoTurmaResumo {
  turma: string
  total: number
  respondidos: number
  aprovados: number
  recusados: number
  neutros: number
  pendentes: number
  percentAdesao: number
}

export interface RelatorioAutorizacaoComunicadoItem {
  comunicadoId: string
  comunicadoTitulo: string
  comunicadoAutor: string
  comunicadoAutorCargo: string | null
  comunicadoDataEnvio: string
  comunicadoDataEnvioFormatada: string
  comunicadoStatus: string
  comunicadoDestinoLabel: string
  turmasAlvo: string[]
  canManage: boolean
  lembretesCount: number
  ultimoLembreteEm: string | null
  ultimoLembreteFormatado: string | null
  autorizacao: {
    id: string
    titulo: string
    tipoAutorizacao: string
    termoTexto: string
    termoResumo: string
    localEvento: string | null
    dataEvento: string | null
    dataEventoFormatada: string | null
    valor: string | null
    dataLimite: string | null
    dataLimiteFormatada: string | null
    tempoRestanteLabel: string | null
    encerradaManual: boolean
    isClosed: boolean
    statusPrazo: 'aberta' | 'encerrada_manual' | 'prazo_expirado'
    permitirAlterarResposta: boolean
    exigirObservacoes: boolean
    observacoesLabel: string | null
    exigirCpfResponsavel: boolean
    opcoes: AutorizacaoOpcaoStat[]
  }
  metricas: {
    totalDestinatarios: number
    totalRespondidos: number
    totalPendentes: number
    totalPendentesQueLeram: number
    totalAprovados: number
    totalRecusados: number
    totalNeutros: number
    totalComObservacoes: number
    percentAdesao: number
    percentAprovadosSobreRespondidos: number
    percentAprovadosSobreTotal: number
    hasCobranca: boolean
    totalPagos: number
    totalPagamentoPendente: number
  }
  turmasResumo: RelatorioAutorizacaoTurmaResumo[]
  itensAlunos: RelatorioAutorizacaoAlunoItem[]
}

export async function GET(request: Request) {
  const { user, dbUser, perfil, cargo, errorResponse } = await requireStaff(request)
  if (errorResponse || !user) {
    return errorResponse || NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    // 1. Buscar apenas comunicados que efetivamente possuem objeto `autorizacao` não nulo em `dados`
    const { data: rawComunicados, error: comError } = await supabaseServer
      .from('comunicados')
      .select('id, titulo, autor, data, destino, dados, created_at')
      .not('dados->>autorizacao', 'is', null)
      .order('created_at', { ascending: false })
      .limit(250)

    if (comError) {
      throw new Error(comError.message)
    }

    const validComRows = (rawComunicados || []).filter((row: any) => {
      const d = parseJsonField<Record<string, any>>(row.dados, {})
      const st = String(d.status || 'enviado').toLowerCase().trim()
      if (st === 'rascunho' || st === 'excluido' || st === 'arquivado_lixeira') return false
      const aut: AutorizacaoData | null = d.autorizacao || row.autorizacao || null
      return Boolean(aut && aut.id && Array.isArray(aut.opcoes) && aut.opcoes.length > 0)
    })

    if (validComRows.length === 0) {
      return NextResponse.json(
        {
          comunicados: [],
          turmas: [],
          kpis: {
            totalComunicados: 0,
            comunicadosAbertos: 0,
            comunicadosEncerrados: 0,
            totalDestinatariosGeral: 0,
            totalAssinaturasColetadas: 0,
            totalAprovadosGeral: 0,
            totalRecusadosGeral: 0,
            totalPendentesEmAberto: 0,
            totalComObservacoesGeral: 0,
            taxaAdesaoMedia: 0,
          },
        },
        { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
      )
    }

    const comIds = validComRows.map((r: any) => String(r.id))

    // 2. Carregar dados auxiliares de turmas, alunos ativos, leituras e cobranças em paralelo
    const [{ allTurmas, allGrupos }, allEquipes, cachedActiveAlunos, readRows, cobrancasRows] =
      await Promise.all([
        getCachedTurmasAndGrupos(),
        getCachedEquipes().catch(() => [] as any[]),
        getCachedActiveAlunos(),
        fetchInChunks<{ content_id: string; usuario_id: string | null; aluno_id: string | null }>(
          'agenda_notification_reads',
          'content_id, usuario_id, aluno_id',
          'content_id',
          comIds
        ),
        fetchInChunks<{ id: string; comunicado_id: string; valor: any }>(
          'agenda_cobrancas',
          'id, comunicado_id, valor',
          'comunicado_id',
          comIds
        ),
      ])

    const cobrancaIds = cobrancasRows.map((c) => String(c.id)).filter(Boolean)
    const cobrancaDestRows =
      cobrancaIds.length > 0
        ? await fetchInChunks<{
            cobranca_id: string
            destinatario_id: string | null
            destinatario_nome: string | null
            status: string | null
          }>(
            'agenda_cobrancas_destinatarios',
            'cobranca_id, destinatario_id, destinatario_nome, status',
            'cobranca_id',
            cobrancaIds
          )
        : []

    // Mapear cobranças por comunicado
    const cobrancasByComId = new Map<
      string,
      { byStudentId: Map<string, boolean>; byStudentName: Map<string, boolean> }
    >()
    const cobIdToComId = new Map<string, string>()
    cobrancasRows.forEach((c) => {
      const cid = String(c.comunicado_id || '').trim()
      if (!cid) return
      cobIdToComId.set(String(c.id), cid)
      if (!cobrancasByComId.has(cid)) {
        cobrancasByComId.set(cid, { byStudentId: new Map(), byStudentName: new Map() })
      }
    })
    cobrancaDestRows.forEach((d) => {
      const comId = cobIdToComId.get(String(d.cobranca_id || ''))
      if (!comId) return
      const bucket = cobrancasByComId.get(comId)
      if (!bucket) return
      const paid = isCobrancaPaidStatus(d.status)
      const stuClean = cleanStudentKey(d.destinatario_id)
      if (stuClean) {
        const noZ = stripLeadingZeros(stuClean)
        bucket.byStudentId.set(stuClean, Boolean(bucket.byStudentId.get(stuClean)) || paid)
        bucket.byStudentId.set(noZ, Boolean(bucket.byStudentId.get(noZ)) || paid)
      }
      const nm = normalizeText(d.destinatario_nome)
      if (nm) {
        bucket.byStudentName.set(nm, Boolean(bucket.byStudentName.get(nm)) || paid)
      }
    })

    // Mapear turmas
    const turmaByIdOrName = new Map<string, any>()
    const turmaObjects = (allTurmas || []).map((t: any) => {
      const obj = {
        ...t,
        ...(t.dados || {}),
        id: String(t.id),
        nome: String(t.dados?.nome || t.nome || '').trim(),
        codigo: t.codigo ? String(t.codigo).trim() : t.dados?.codigo ? String(t.dados.codigo).trim() : '',
        ano: t.ano || t.dados?.anoLetivo || '',
      }
      if (obj.id) turmaByIdOrName.set(obj.id.toLowerCase(), obj)
      if (obj.codigo) turmaByIdOrName.set(obj.codigo.toLowerCase(), obj)
      if (obj.nome) turmaByIdOrName.set(normalizeText(obj.nome), obj)
      return obj
    })

    const normalizedGrupos = [
      ...(allGrupos || []).map((g: any) => ({
        ...g,
        ...(g.dados || {}),
        id: String(g.id),
        nome: String(g.dados?.nome || g.nome || ''),
      })),
      ...(allEquipes || []).map((e: any) => ({
        ...e,
        ...(e.dados || {}),
        id: String(e.id),
        nome: String(e.dados?.nome || e.nome || ''),
        isEquipeEscolar: true,
      })),
    ]

    const turmaSyncGroupByKey = new Map<string, any>()
    normalizedGrupos.forEach((g) => {
      const syncId = String(g.syncId || (String(g.id).startsWith('sync-') ? g.id : ''))
      const rawId = syncId ? syncId.replace(/^sync-/, '') : g.id
      if (rawId) turmaSyncGroupByKey.set(String(rawId).toLowerCase(), g)
      if (g.nome) turmaSyncGroupByKey.set(normalizeText(g.nome), g)
    })

    // Indexar alunos ativos + coletar IDs extras citados em respostas ou alunosIds
    const alunosByCleanId = new Map<string, any>()
    const alunosByNoZeroId = new Map<string, any>()
    const registerAluno = (a: any) => {
      if (!a?.id) return
      const clean = cleanStudentKey(a.id)
      if (!clean) return
      if (!alunosByCleanId.has(clean)) {
        alunosByCleanId.set(clean, a)
        alunosByNoZeroId.set(stripLeadingZeros(clean), a)
      }
      if (a.matricula) {
        const mClean = cleanStudentKey(a.matricula)
        if (mClean && !alunosByCleanId.has(mClean)) {
          alunosByCleanId.set(mClean, a)
        }
      }
    }
    cachedActiveAlunos.forEach(registerAluno)

    const extraCandidateStudentIds = new Set<string>()
    for (const row of validComRows) {
      const d = parseJsonField<Record<string, any>>(row.dados, {})
      const explicit = extractExplicitStudentIdsFromComunicado(String(row.id), row, d)
      explicit.forEach((id) => {
        if (!alunosByCleanId.has(id) && !alunosByNoZeroId.has(stripLeadingZeros(id))) {
          extraCandidateStudentIds.add(id)
        }
      })
      const aut: AutorizacaoData | null = d.autorizacao || null
      if (aut?.respostas) {
        Object.values(aut.respostas).forEach((resp) => {
          const aid = cleanStudentKey(resp?.alunoId)
          if (aid && !alunosByCleanId.has(aid) && !alunosByNoZeroId.has(stripLeadingZeros(aid))) {
            extraCandidateStudentIds.add(aid)
          }
        })
      }
    }

    let allAlunos = [...cachedActiveAlunos]
    if (extraCandidateStudentIds.size > 0) {
      const extraFetched = await fetchInChunks<any>(
        'alunos',
        'id, nome, matricula, turma, serie, turno, unidade, status, foto, foto_url, codigo, dados',
        'id',
        Array.from(extraCandidateStudentIds)
      )
      extraFetched.forEach((a) => {
        const clean = cleanStudentKey(a.id)
        if (clean && !alunosByCleanId.has(clean)) {
          registerAluno(a)
          allAlunos.push(a)
        }
      })
    }

    const resolveTurmaLabel = (rawTurma?: string | null, alunoObj?: any): string => {
      const candidate = String(
        rawTurma ||
          (alunoObj ? getAlunoTurmaCursando(alunoObj) || alunoObj.turma || alunoObj.dados?.turma : '') ||
          ''
      ).trim()
      if (!candidate) return 'Sem Turma'
      const matched =
        turmaByIdOrName.get(candidate.toLowerCase()) ||
        turmaByIdOrName.get(normalizeText(candidate)) ||
        turmaByIdOrName.get(candidate.replace(/^(?:t_|turma_|sync-)/i, '').toLowerCase())
      if (matched?.nome) return matched.nome
      if (/^\d+$/.test(candidate)) return `Turma ${candidate}`
      return candidate
    }

    // Permissões do usuário atual
    const isAdminViewer = isAdminRoleText(dbUser?.perfil || perfil, dbUser?.cargo || cargo)
    const viewerStaffKeys = new Set<string>(
      [
        String(user.id || ''),
        String(dbUser?.id || ''),
        String(dbUser?.auth_id || ''),
        String(dbUser?.dados?.colaborador_id || ''),
        String(dbUser?.dados?.uid_legacy || ''),
      ]
        .filter(Boolean)
        .map(cleanStaffKey)
    )
    const viewerNameNorm = normalizeText(dbUser?.nome || user.user_metadata?.nome)

    // Coletar todos os alunos envolvidos em pelo menos 1 comunicado com autorização para buscar responsáveis em lote único
    const perComTargetStudents = new Map<string, Map<string, { aluno: any; turmaNome: string }>>()
    const allInvolvedStudentIds = new Set<string>()

    for (const row of validComRows) {
      const comId = String(row.id)
      const dados = parseJsonField<Record<string, any>>(row.dados, {})
      const dataEnvio = String(dados.dataEnvio || row.data || row.created_at || new Date().toISOString())
      const destinoRaw = String(row.destino || dados.destino || '').trim()
      const destinoNorm = destinoRaw.toLowerCase()

      const targetTurmasRaw: string[] = Array.isArray(dados.turmas) ? [...dados.turmas.map(String)] : []
      const explicitTurmasIds: string[] = Array.isArray(dados.turmasIds) ? dados.turmasIds.map(String) : []
      if (dados.turmaId && !targetTurmasRaw.includes(String(dados.turmaId))) {
        targetTurmasRaw.push(String(dados.turmaId))
      }
      const targetGruposNames: string[] = Array.isArray(dados.grupos) ? dados.grupos.map(String) : []
      const explicitStudentIds = extractExplicitStudentIdsFromComunicado(comId, row, dados)

      const isGlobal =
        destinoNorm === 'todos' ||
        destinoNorm === 'toda a escola' ||
        destinoNorm === 'all' ||
        targetTurmasRaw.some((t) => {
          const tl = t.toLowerCase().trim()
          return tl === 'todos' || tl === 'todas' || tl === 'toda a escola'
        })
      const isInterno = destinoNorm === 'interno' || destinoNorm === 'funcionarios'

      const matchedTargetTurmas = turmaObjects.filter((t) => {
        return (
          targetTurmasRaw.some((tr) => {
            const trNorm = normalizeText(tr)
            return (
              trNorm === normalizeText(t.nome) ||
              String(tr) === t.id ||
              (t.codigo && String(tr) === t.codigo)
            )
          }) || explicitTurmasIds.includes(t.id)
        )
      })

      const matchedGrupos = normalizedGrupos.filter((g) => {
        const gNome = normalizeText(g.nome)
        const gId = String(g.id).toLowerCase()
        return targetGruposNames.some((tg) => {
          const tNorm = normalizeText(tg)
          return tNorm === gNome || tNorm === gId || tNorm === `g_${gId}` || tNorm === `eq_${gId}`
        })
      })

      const grupoAlunosIds = new Set<string>()
      matchedGrupos.forEach((g) => {
        const aIds = parseJsonField<any[]>(g.alunosIds, [])
        aIds.forEach((id) => {
          const c = cleanStudentKey(id)
          if (c) grupoAlunosIds.add(c)
        })
      })

      const resolveTurmaForComStudent = (a: any): string => {
        for (const t of matchedTargetTurmas) {
          if (
            String(a.turma || '') === t.id ||
            normalizeText(a.turma) === normalizeText(t.nome) ||
            isAlunoCursandoTurma(a, t, t.ano) ||
            canStudentReceiveTurmaContent(a, t.nome || t.id, dataEnvio, turmaObjects)
          ) {
            return t.nome
          }
        }
        return resolveTurmaLabel(null, a)
      }

      const studentsMap = new Map<string, { aluno: any; turmaNome: string }>()

      if (!isInterno) {
        if (isGlobal) {
          cachedActiveAlunos.forEach((a) => {
            const plain = cleanStudentKey(a.id)
            if (plain) {
              studentsMap.set(plain, { aluno: a, turmaNome: resolveTurmaForComStudent(a) })
            }
          })
        } else {
          if (matchedTargetTurmas.length > 0 || targetTurmasRaw.length > 0) {
            allAlunos.forEach((a) => {
              const plain = cleanStudentKey(a.id)
              if (!plain) return
              const matchedT = matchedTargetTurmas.find((t) => {
                if (isAlunoCursandoTurma(a, t, t.ano)) return true
                if (String(a.turma || '') === t.id || normalizeText(a.turma) === normalizeText(t.nome)) return true
                return canStudentReceiveTurmaContent(a, t.nome || t.id, dataEnvio, turmaObjects)
              })
              const matchedRaw = !matchedT
                ? targetTurmasRaw.find((tr) => canStudentReceiveTurmaContent(a, tr, dataEnvio, turmaObjects))
                : null

              if (matchedT) {
                studentsMap.set(plain, { aluno: a, turmaNome: matchedT.nome })
              } else if (matchedRaw) {
                studentsMap.set(plain, { aluno: a, turmaNome: resolveTurmaLabel(matchedRaw, a) })
              }
            })

            matchedTargetTurmas.forEach((t) => {
              const syncGrp =
                turmaSyncGroupByKey.get(t.id.toLowerCase()) ||
                turmaSyncGroupByKey.get(normalizeText(t.nome))
              if (syncGrp) {
                const gAIds = parseJsonField<any[]>(syncGrp.alunosIds, [])
                gAIds.forEach((rawId) => {
                  const plain = cleanStudentKey(rawId)
                  if (plain && !studentsMap.has(plain)) {
                    const aObj = alunosByCleanId.get(plain) || alunosByNoZeroId.get(stripLeadingZeros(plain))
                    if (aObj) {
                      studentsMap.set(cleanStudentKey(aObj.id), { aluno: aObj, turmaNome: t.nome })
                    }
                  }
                })
              }
            })
          }

          if (grupoAlunosIds.size > 0) {
            grupoAlunosIds.forEach((gid) => {
              const aObj = alunosByCleanId.get(gid) || alunosByNoZeroId.get(stripLeadingZeros(gid))
              if (aObj) {
                const plain = cleanStudentKey(aObj.id)
                if (!studentsMap.has(plain)) {
                  studentsMap.set(plain, { aluno: aObj, turmaNome: resolveTurmaForComStudent(aObj) })
                }
              }
            })
          }

          if (explicitStudentIds.size > 0) {
            explicitStudentIds.forEach((eid) => {
              const aObj = alunosByCleanId.get(eid) || alunosByNoZeroId.get(stripLeadingZeros(eid))
              if (aObj) {
                const plain = cleanStudentKey(aObj.id)
                if (!studentsMap.has(plain)) {
                  studentsMap.set(plain, { aluno: aObj, turmaNome: resolveTurmaForComStudent(aObj) })
                }
              }
            })
          }
        }
      }

      studentsMap.forEach(({ aluno }) => {
        const plain = cleanStudentKey(aluno.id)
        if (plain) {
          allInvolvedStudentIds.add(plain)
          allInvolvedStudentIds.add(String(aluno.id))
          if (aluno.matricula) allInvolvedStudentIds.add(String(aluno.matricula).trim())
        }
      })

      perComTargetStudents.set(comId, studentsMap)
    }

    // Buscar vínculos de responsáveis em lote único para os alunos envolvidos
    const vinculosRows =
      allInvolvedStudentIds.size > 0
        ? await fetchInChunks<{
            aluno_id: string
            responsavel_id: string
            parentesco: string | null
            resp_pedagogico: boolean | null
            resp_financeiro: boolean | null
          }>(
            'aluno_responsavel',
            'aluno_id, responsavel_id, parentesco, resp_pedagogico, resp_financeiro',
            'aluno_id',
            Array.from(allInvolvedStudentIds)
          )
        : []

    const rawRespIds = Array.from(
      new Set(
        vinculosRows
          .map((v) => String(v.responsavel_id || '').trim())
          .filter(Boolean)
          .flatMap((id) => {
            const noZ = stripLeadingZeros(id)
            const padded = !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : ''
            return [id, noZ, padded].filter(Boolean)
          })
      )
    )

    const responsaveisRows =
      rawRespIds.length > 0
        ? await fetchInChunks<{
            id: string
            nome: string | null
            telefone: string | null
            celular: string | null
            auth_id: string | null
            dados: any
          }>(
            'responsaveis',
            'id, nome, telefone, celular, auth_id, dados',
            'id',
            rawRespIds
          )
        : []

    const respById = new Map<string, any>()
    responsaveisRows.forEach((r) => {
      const k = String(r.id || '').trim().toLowerCase()
      if (k) {
        respById.set(k, r)
        respById.set(stripLeadingZeros(k), r)
      }
    })

    // Mapear responsável principal + todos os tokens de responsáveis por aluno (para leitura e contato)
    const guardianInfoByStudent = new Map<
      string,
      {
        nome: string | null
        parentesco: string | null
        telefone: string | null
        respTokens: Set<string>
      }
    >()

    vinculosRows.forEach((v) => {
      const aRaw = cleanStudentKey(v.aluno_id)
      const aObj = alunosByCleanId.get(aRaw) || alunosByNoZeroId.get(stripLeadingZeros(aRaw))
      const stuKey = aObj ? cleanStudentKey(aObj.id) : aRaw
      if (!stuKey) return

      const rKey = String(v.responsavel_id || '').trim().toLowerCase()
      const respRow = respById.get(rKey) || respById.get(stripLeadingZeros(rKey))

      let entry = guardianInfoByStudent.get(stuKey)
      if (!entry) {
        entry = { nome: null, parentesco: null, telefone: null, respTokens: new Set() }
        guardianInfoByStudent.set(stuKey, entry)
      }

      if (v.responsavel_id) {
        entry.respTokens.add(String(v.responsavel_id).trim().toLowerCase())
        entry.respTokens.add(stripLeadingZeros(String(v.responsavel_id).trim()).toLowerCase())
      }
      if (respRow?.auth_id) entry.respTokens.add(String(respRow.auth_id).trim().toLowerCase())
      if (respRow?.dados?.auth_id) entry.respTokens.add(String(respRow.dados.auth_id).trim().toLowerCase())

      if (respRow) {
        const phone = formatPhone(
          respRow.celular || respRow.telefone || respRow.dados?.celular || respRow.dados?.telefone
        )
        const shouldPromote =
          !entry.nome ||
          (!entry.telefone && Boolean(phone)) ||
          Boolean(v.resp_pedagogico && phone)

        if (shouldPromote) {
          entry.nome = String(respRow.nome || entry.nome || 'Responsável').trim()
          entry.parentesco = String(v.parentesco || entry.parentesco || 'Responsável').trim()
          if (phone) entry.telefone = phone
        }
      }
    })

    // Indexar leituras por comunicado
    const readsByComId = new Map<string, Array<{ usuario_id: string | null; aluno_id: string | null }>>()
    readRows.forEach((r) => {
      const cid = String(r.content_id || '')
      if (!readsByComId.has(cid)) readsByComId.set(cid, [])
      readsByComId.get(cid)!.push(r)
    })

    const hasStudentReadComunicado = (
      comId: string,
      stuCleanId: string,
      legacyLeituras: Record<string, any> | undefined,
      respTokens: Set<string>
    ): boolean => {
      const noZ = stripLeadingZeros(stuCleanId)
      const list = readsByComId.get(comId) || []
      for (const r of list) {
        const rAluno = cleanStudentKey(r.aluno_id)
        if (rAluno && (rAluno === stuCleanId || stripLeadingZeros(rAluno) === noZ)) {
          return true
        }
        const rawUid = String(r.usuario_id || '').trim()
        if (!rawUid) continue
        if (rawUid.includes('#')) {
          const hashStu = cleanStudentKey(rawUid.split('#')[1])
          if (hashStu && (hashStu === stuCleanId || stripLeadingZeros(hashStu) === noZ)) {
            return true
          }
        } else if (!r.aluno_id && respTokens.has(rawUid.toLowerCase())) {
          return true
        }
      }

      if (legacyLeituras && typeof legacyLeituras === 'object') {
        for (const k of Object.keys(legacyLeituras)) {
          if (!legacyLeituras[k]) continue
          if (
            k === stuCleanId ||
            k === noZ ||
            k.endsWith(`_${stuCleanId}`) ||
            k.endsWith(`_${noZ}`)
          ) {
            return true
          }
          if (!k.includes('_') && respTokens.has(k.toLowerCase())) {
            return true
          }
        }
      }
      return false
    }

    // 3. Montar o relatório detalhado separado por cada comunicado
    const allTurmasGlobais = new Set<string>()
    const comunicadosResult: RelatorioAutorizacaoComunicadoItem[] = []

    for (const row of validComRows) {
      const comId = String(row.id)
      const dados = parseJsonField<Record<string, any>>(row.dados, {})
      const aut: AutorizacaoData = dados.autorizacao || (row as any).autorizacao
      const dataEnvio = String(dados.dataEnvio || row.data || row.created_at || new Date().toISOString())
      const comStatus = String(dados.status || 'enviado').toLowerCase().trim()

      const comAutorKey = cleanStaffKey(dados.autorId || dados.autor_id || aut.criadoPor?.id || '')
      const comAutorNomeNorm = normalizeText(row.autor || dados.autorNome || dados.autor || aut.criadoPor?.nome)
      const isAuthor = Boolean(
        (comAutorKey && viewerStaffKeys.has(comAutorKey)) ||
          (viewerNameNorm && comAutorNomeNorm && viewerNameNorm === comAutorNomeNorm)
      )
      const canManage = Boolean(isAdminViewer || isAuthor)

      const cobBucket = cobrancasByComId.get(comId)
      const hasValorTexto = Boolean(aut.valor && String(aut.valor).replace(/\D/g, '') !== '' && parseInt(String(aut.valor).replace(/\D/g, ''), 10) > 0)
      const hasCobranca = Boolean(
        (cobBucket && (cobBucket.byStudentId.size > 0 || cobBucket.byStudentName.size > 0)) ||
          hasValorTexto
      )

      const resolvePayment = (stuClean: string, stuNome: string): 'pago' | 'pendente' | 'sem_cobranca' => {
        if (!hasCobranca) return 'sem_cobranca'
        if (cobBucket) {
          const noZ = stripLeadingZeros(stuClean)
          if (stuClean && cobBucket.byStudentId.has(stuClean)) {
            return cobBucket.byStudentId.get(stuClean) ? 'pago' : 'pendente'
          }
          if (noZ && cobBucket.byStudentId.has(noZ)) {
            return cobBucket.byStudentId.get(noZ) ? 'pago' : 'pendente'
          }
          const nm = normalizeText(stuNome)
          if (nm && cobBucket.byStudentName.has(nm)) {
            return cobBucket.byStudentName.get(nm) ? 'pago' : 'pendente'
          }
        }
        return 'pendente'
      }

      // Mapear respostas assinadas por aluno (deduplicando caso exista chave antiga e nova do mesmo aluno, mantendo a mais recente)
      const rawRespostasMap = aut.respostas || {}
      const respostaByStuKey = new Map<string, AutorizacaoResposta>()
      const orphanRespostas: Array<{ key: string; resp: AutorizacaoResposta }> = []

      Object.entries(rawRespostasMap).forEach(([vKey, resp]) => {
        if (!resp || vKey.startsWith('anon_') || String(resp.usuarioId || '').startsWith('anon_')) return

        let stuClean = cleanStudentKey(resp.alunoId)
        if (!stuClean && vKey.includes('_')) {
          const suffix = cleanStudentKey(vKey.split('_').pop())
          if (suffix && (alunosByCleanId.has(suffix) || alunosByNoZeroId.has(stripLeadingZeros(suffix)))) {
            stuClean = suffix
          }
        }
        if (!stuClean && (alunosByCleanId.has(cleanStudentKey(vKey)) || alunosByNoZeroId.has(stripLeadingZeros(cleanStudentKey(vKey))))) {
          stuClean = cleanStudentKey(vKey)
        }

        if (stuClean) {
          const canonical = alunosByCleanId.get(stuClean)
            ? stuClean
            : alunosByNoZeroId.get(stripLeadingZeros(stuClean))
              ? cleanStudentKey(alunosByNoZeroId.get(stripLeadingZeros(stuClean)).id)
              : stuClean

          const prev = respostaByStuKey.get(canonical)
          if (
            !prev ||
            new Date(resp.respondidoEm || 0).getTime() >= new Date(prev.respondidoEm || 0).getTime()
          ) {
            respostaByStuKey.set(canonical, resp)
          }
        } else {
          orphanRespostas.push({ key: vKey, resp })
        }
      })

      const targetMap = perComTargetStudents.get(comId) || new Map<string, { aluno: any; turmaNome: string }>()

      // Garantir que todo aluno que assinou conste na lista mesmo se mudou de turma ou saiu do filtro original
      respostaByStuKey.forEach((resp, stuCanonical) => {
        if (!targetMap.has(stuCanonical)) {
          const aObj =
            alunosByCleanId.get(stuCanonical) ||
            alunosByNoZeroId.get(stripLeadingZeros(stuCanonical)) ||
            null
          targetMap.set(stuCanonical, {
            aluno: aObj,
            turmaNome: resolveTurmaLabel(resp.alunoTurma, aObj),
          })
        }
      })

      const legacyLeituras = parseJsonField<Record<string, any>>(dados.leituras, {})
      const itensAlunos: RelatorioAutorizacaoAlunoItem[] = []

      targetMap.forEach(({ aluno, turmaNome }, stuKey) => {
        const resp = respostaByStuKey.get(stuKey) || null
        const nomeAluno = String(
          aluno?.nome || aluno?.dados?.nome || resp?.alunoNome || `Aluno #${stuKey}`
        ).trim()
        const matriculaAluno = String(
          aluno?.matricula || aluno?.codigo || aluno?.dados?.codigo || stuKey
        ).trim()
        const displayTurma =
          turmaNome && turmaNome !== 'Sem Turma'
            ? turmaNome
            : resolveTurmaLabel(resp?.alunoTurma, aluno)

        const rawFoto =
          aluno?.foto ||
          aluno?.foto_url ||
          aluno?.dados?.foto ||
          aluno?.dados?.avatarUrl ||
          aluno?.dados?.fotoUrl ||
          null
        const alunoFoto = isValidStudentPhoto(rawFoto) ? rawFoto : null

        const gInfo = guardianInfoByStudent.get(stuKey)
        const fallbackG = aluno ? extractFallbackStudentGuardian(aluno) : { nome: null, parentesco: null, telefone: null }
        const responsavelNome = gInfo?.nome || fallbackG.nome
        const responsavelParentesco = gInfo?.parentesco || fallbackG.parentesco
        const responsavelTelefone = gInfo?.telefone || fallbackG.telefone

        const leuComunicado =
          Boolean(resp) ||
          hasStudentReadComunicado(
            comId,
            stuKey,
            legacyLeituras,
            gInfo?.respTokens || new Set<string>()
          )

        const pagamentoStatus = resolvePayment(stuKey, nomeAluno)

        if (displayTurma && displayTurma !== 'Sem Turma') {
          allTurmasGlobais.add(displayTurma)
        }

        if (resp) {
          const cpf =
            resp.cpfResponsavel ||
            resp.documentoResponsavel ||
            resp.assinaturaDigital?.responsavelCpf ||
            resp.assinaturaDigital?.responsavelDoc ||
            null
          itensAlunos.push({
            key: `stu-${stuKey}`,
            alunoId: String(aluno?.id || stuKey),
            alunoNome: nomeAluno,
            alunoMatricula: matriculaAluno,
            alunoTurma: displayTurma,
            alunoFoto,
            statusResposta: resp.tipoDecisao || 'neutro',
            opcaoId: resp.opcaoId || null,
            opcaoTexto: resp.opcaoTexto || null,
            observacoes: resp.observacoes && String(resp.observacoes).trim() ? String(resp.observacoes).trim() : null,
            respondidoEm: resp.respondidoEm || null,
            respondidoEmFormatado:
              resp.assinaturaDigital?.dataHoraFormatada || formatDateTimeBR(resp.respondidoEm) || null,
            assinanteId: resp.usuarioId || null,
            assinanteNome: String(
              resp.assinaturaDigital?.responsavelNome || resp.usuarioNome || responsavelNome || 'Responsável'
            ).trim(),
            assinanteCpf: cpf ? String(cpf).trim() : null,
            protocoloToken: resp.assinaturaDigital?.token || null,
            responsavelPrincipalNome: responsavelNome,
            responsavelPrincipalParentesco: responsavelParentesco,
            responsavelPrincipalTelefone: responsavelTelefone,
            leuComunicado: true,
            pagamentoStatus,
          })
        } else {
          itensAlunos.push({
            key: `stu-${stuKey}`,
            alunoId: String(aluno?.id || stuKey),
            alunoNome: nomeAluno,
            alunoMatricula: matriculaAluno,
            alunoTurma: displayTurma,
            alunoFoto,
            statusResposta: 'pendente',
            opcaoId: null,
            opcaoTexto: null,
            observacoes: null,
            respondidoEm: null,
            respondidoEmFormatado: null,
            assinanteId: null,
            assinanteNome: null,
            assinanteCpf: null,
            protocoloToken: null,
            responsavelPrincipalNome: responsavelNome,
            responsavelPrincipalParentesco: responsavelParentesco,
            responsavelPrincipalTelefone: responsavelTelefone,
            leuComunicado,
            pagamentoStatus,
          })
        }
      })

      // Incluir eventuais respostas órfãs (sem alunoId identificável) para precisão contábil absoluta
      orphanRespostas.forEach(({ key, resp }, idx) => {
        const displayTurma = resp.alunoTurma ? resolveTurmaLabel(resp.alunoTurma) : 'Sem Turma'
        if (displayTurma && displayTurma !== 'Sem Turma') allTurmasGlobais.add(displayTurma)
        const cpf =
          resp.cpfResponsavel ||
          resp.documentoResponsavel ||
          resp.assinaturaDigital?.responsavelCpf ||
          resp.assinaturaDigital?.responsavelDoc ||
          null
        const nomeAluno = String(resp.alunoNome || `Resposta #${idx + 1}`).trim()
        itensAlunos.push({
          key: `orphan-${key}-${idx}`,
          alunoId: resp.alunoId || '',
          alunoNome: nomeAluno,
          alunoMatricula: '-',
          alunoTurma: displayTurma,
          alunoFoto: null,
          statusResposta: resp.tipoDecisao || 'neutro',
          opcaoId: resp.opcaoId || null,
          opcaoTexto: resp.opcaoTexto || null,
          observacoes: resp.observacoes && String(resp.observacoes).trim() ? String(resp.observacoes).trim() : null,
          respondidoEm: resp.respondidoEm || null,
          respondidoEmFormatado:
            resp.assinaturaDigital?.dataHoraFormatada || formatDateTimeBR(resp.respondidoEm) || null,
          assinanteId: resp.usuarioId || null,
          assinanteNome: String(
            resp.assinaturaDigital?.responsavelNome || resp.usuarioNome || 'Responsável'
          ).trim(),
          assinanteCpf: cpf ? String(cpf).trim() : null,
          protocoloToken: resp.assinaturaDigital?.token || null,
          responsavelPrincipalNome: resp.usuarioNome || null,
          responsavelPrincipalParentesco: 'Responsável',
          responsavelPrincipalTelefone: null,
          leuComunicado: true,
          pagamentoStatus: resolvePayment('', nomeAluno),
        })
      })

      // Ordenar por série/turma e depois alfabeticamente pelo nome do aluno
      itensAlunos.sort((a, b) => {
        const cmpT = compareTurmasBySerie(a.alunoTurma, b.alunoTurma)
        if (cmpT !== 0) return cmpT
        return a.alunoNome.localeCompare(b.alunoNome, 'pt-BR')
      })

      // Métricas e estatísticas por opção e por turma
      const totalDestinatarios = itensAlunos.length
      let totalRespondidos = 0
      let totalPendentes = 0
      let totalPendentesQueLeram = 0
      let totalAprovados = 0
      let totalRecusados = 0
      let totalNeutros = 0
      let totalComObservacoes = 0
      let totalPagos = 0
      let totalPagamentoPendente = 0

      const countsByOpcaoId: Record<string, number> = {}
      ;(aut.opcoes || []).forEach((op) => {
        countsByOpcaoId[op.id] = 0
      })

      const turmasMap = new Map<string, RelatorioAutorizacaoTurmaResumo>()

      itensAlunos.forEach((item) => {
        const tKey = item.alunoTurma || 'Sem Turma'
        let tEntry = turmasMap.get(tKey)
        if (!tEntry) {
          tEntry = {
            turma: tKey,
            total: 0,
            respondidos: 0,
            aprovados: 0,
            recusados: 0,
            neutros: 0,
            pendentes: 0,
            percentAdesao: 0,
          }
          turmasMap.set(tKey, tEntry)
        }
        tEntry.total++

        if (item.pagamentoStatus === 'pago') totalPagos++
        else if (item.pagamentoStatus === 'pendente') totalPagamentoPendente++

        if (item.statusResposta === 'pendente') {
          totalPendentes++
          tEntry.pendentes++
          if (item.leuComunicado) totalPendentesQueLeram++
        } else {
          totalRespondidos++
          tEntry.respondidos++
          if (item.opcaoId && countsByOpcaoId[item.opcaoId] !== undefined) {
            countsByOpcaoId[item.opcaoId]++
          }
          if (item.statusResposta === 'aprova') {
            totalAprovados++
            tEntry.aprovados++
          } else if (item.statusResposta === 'recusa') {
            totalRecusados++
            tEntry.recusados++
          } else {
            totalNeutros++
            tEntry.neutros++
          }
          if (item.observacoes) {
            totalComObservacoes++
          }
        }
      })

      const turmasResumo = Array.from(turmasMap.values())
        .map((t) => ({
          ...t,
          percentAdesao: t.total > 0 ? Math.round((t.respondidos / t.total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => compareTurmasBySerie(a.turma, b.turma))

      const opcoesStats: AutorizacaoOpcaoStat[] = (aut.opcoes || []).map((op) => {
        const count = countsByOpcaoId[op.id] || 0
        const percent = totalRespondidos > 0 ? Math.round((count / totalRespondidos) * 1000) / 10 : 0
        return {
          ...op,
          count,
          percent,
        }
      })

      const percentAdesao =
        totalDestinatarios > 0 ? Math.round((totalRespondidos / totalDestinatarios) * 1000) / 10 : 0
      const percentAprovadosSobreRespondidos =
        totalRespondidos > 0 ? Math.round((totalAprovados / totalRespondidos) * 1000) / 10 : 0
      const percentAprovadosSobreTotal =
        totalDestinatarios > 0 ? Math.round((totalAprovados / totalDestinatarios) * 1000) / 10 : 0

      const closed = isAutorizacaoClosed(aut)
      const encerradaManual = Boolean(aut.encerrada)
      const statusPrazo: 'aberta' | 'encerrada_manual' | 'prazo_expirado' = encerradaManual
        ? 'encerrada_manual'
        : closed
          ? 'prazo_expirado'
          : 'aberta'

      const lembretesHist: any[] = Array.isArray(dados.lembretes_historico) ? dados.lembretes_historico : []
      const ultimoLembreteEm = lembretesHist[0]?.sentAt || null

      const turmasAlvo =
        turmasResumo.length > 0
          ? turmasResumo.map((t) => t.turma)
          : Array.isArray(dados.turmas)
            ? dados.turmas.map((t: any) => resolveTurmaLabel(String(t)))
            : []

      const destinoRaw = String(row.destino || dados.destino || '').trim()
      const destinoNorm = destinoRaw.toLowerCase()
      const comunicadoDestinoLabel =
        destinoNorm === 'todos' || destinoNorm === 'toda a escola'
          ? 'Toda a Escola'
          : turmasAlvo.length === 1
            ? turmasAlvo[0]
            : turmasAlvo.length > 1
              ? `${turmasAlvo.length} turmas`
              : destinoRaw || 'Selecionados'

      const plainTermo = getAutorizacaoTermoPlainText(aut.termoTexto)
      const termoResumo = plainTermo.length > 180 ? `${plainTermo.slice(0, 177)}...` : plainTermo

      comunicadosResult.push({
        comunicadoId: comId,
        comunicadoTitulo: String(row.titulo || aut.titulo || 'Comunicado com Autorização').trim(),
        comunicadoAutor: String(row.autor || dados.autorNome || aut.criadoPor?.nome || 'Equipe Escolar').trim(),
        comunicadoAutorCargo: dados.autorCargo || aut.criadoPor?.cargo || null,
        comunicadoDataEnvio: dataEnvio,
        comunicadoDataEnvioFormatada: formatDateTimeBR(dataEnvio),
        comunicadoStatus: comStatus,
        comunicadoDestinoLabel,
        turmasAlvo,
        canManage,
        lembretesCount: lembretesHist.length,
        ultimoLembreteEm,
        ultimoLembreteFormatado: ultimoLembreteEm ? formatDateTimeBR(ultimoLembreteEm) : null,
        autorizacao: {
          id: aut.id,
          titulo: String(aut.titulo || row.titulo || 'Autorização Digital').trim(),
          tipoAutorizacao: aut.tipoAutorizacao || 'personalizado',
          termoTexto: aut.termoTexto || '',
          termoResumo,
          localEvento: aut.localEvento ? String(aut.localEvento).trim() : null,
          dataEvento: aut.dataEvento || null,
          dataEventoFormatada: aut.dataEvento ? formatDataEventoBR(aut.dataEvento) : null,
          valor: aut.valor ? String(aut.valor).trim() : null,
          dataLimite: aut.dataLimite || null,
          dataLimiteFormatada: aut.dataLimite ? formatDataEventoBR(aut.dataLimite) : null,
          tempoRestanteLabel: !encerradaManual ? formatTimeRemaining(aut.dataLimite) : 'Encerrada manualmente',
          encerradaManual,
          isClosed: closed,
          statusPrazo,
          permitirAlterarResposta: aut.permitirAlterarResposta !== false,
          exigirObservacoes: Boolean(aut.exigirObservacoes),
          observacoesLabel: aut.observacoesLabel || null,
          exigirCpfResponsavel: Boolean(aut.exigirCpfResponsavel ?? aut.exigirDocumentoResponsavel),
          opcoes: opcoesStats,
        },
        metricas: {
          totalDestinatarios,
          totalRespondidos,
          totalPendentes,
          totalPendentesQueLeram,
          totalAprovados,
          totalRecusados,
          totalNeutros,
          totalComObservacoes,
          percentAdesao,
          percentAprovadosSobreRespondidos,
          percentAprovadosSobreTotal,
          hasCobranca,
          totalPagos,
          totalPagamentoPendente,
        },
        turmasResumo,
        itensAlunos,
      })
    }

    // Consolidar KPIs globais
    const totalComunicados = comunicadosResult.length
    const comunicadosAbertos = comunicadosResult.filter((c) => !c.autorizacao.isClosed).length
    const comunicadosEncerrados = totalComunicados - comunicadosAbertos
    const totalDestinatariosGeral = comunicadosResult.reduce((s, c) => s + c.metricas.totalDestinatarios, 0)
    const totalAssinaturasColetadas = comunicadosResult.reduce((s, c) => s + c.metricas.totalRespondidos, 0)
    const totalAprovadosGeral = comunicadosResult.reduce((s, c) => s + c.metricas.totalAprovados, 0)
    const totalRecusadosGeral = comunicadosResult.reduce((s, c) => s + c.metricas.totalRecusados, 0)
    const totalPendentesEmAberto = comunicadosResult
      .filter((c) => !c.autorizacao.isClosed)
      .reduce((s, c) => s + c.metricas.totalPendentes, 0)
    const totalComObservacoesGeral = comunicadosResult.reduce((s, c) => s + c.metricas.totalComObservacoes, 0)

    const taxaAdesaoMedia =
      totalDestinatariosGeral > 0
        ? Math.round((totalAssinaturasColetadas / totalDestinatariosGeral) * 1000) / 10
        : 0

    const sortedTurmas = Array.from(allTurmasGlobais).sort((a, b) => compareTurmasBySerie(a, b))

    return NextResponse.json(
      {
        comunicados: comunicadosResult,
        turmas: sortedTurmas,
        kpis: {
          totalComunicados,
          comunicadosAbertos,
          comunicadosEncerrados,
          totalDestinatariosGeral,
          totalAssinaturasColetadas,
          totalAprovadosGeral,
          totalRecusadosGeral,
          totalPendentesEmAberto,
          totalComObservacoesGeral,
          taxaAdesaoMedia,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    )
  } catch (err: any) {
    console.error('[GET /api/agenda/autorizacoes/relatorio] Erro:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao gerar relatório de autorizações dos comunicados.' },
      { status: 500 }
    )
  }
}
