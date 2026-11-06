import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getStudentTargetsForComunicados } from '@/lib/server/notificationHelper'
import {
  getAlunoTurmaCursando,
  getAlunoNomesTurmasEGrupos,
  compareTurmasBySerie
} from '@/lib/studentTurmaUtils'

function normalizeId(raw: any): string {
  return String(raw || '')
    .replace(/^(a_|_ALU|ALU)/i, '')
    .trim()
}

function isStudentActive(a: any): boolean {
  const st = String(a?.status || a?.dados?.status || a?.situacao || a?.dados?.situacao || 'ativo')
    .trim()
    .toLowerCase()
  return !['inativo', 'cancelado', 'transferido', 'trancado', 'desistente', 'excluido', 'excluído'].includes(st)
}

function isReadableTurmaName(val: any): boolean {
  if (!val) return false
  const s = String(val).trim()
  if (!s) return false
  if (/^\d+$/.test(s)) return false
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)) return false
  if (s.toLowerCase().startsWith('sync-')) return false
  return true
}

function buildTurmaNameMap(turmasRows: any[], gruposRows: any[] = []): Map<string, string> {
  const map = new Map<string, string>()

  const addKey = (key: any, nome: string) => {
    if (key == null || !nome) return
    const k = String(key).trim()
    if (!k) return
    map.set(k, nome)
    map.set(k.toLowerCase(), nome)
    const stripped = k.replace(/^(t_|turma_|sync-)/i, '').trim()
    if (stripped && stripped !== k) {
      map.set(stripped, nome)
      map.set(stripped.toLowerCase(), nome)
    }
  }

  for (const t of turmasRows || []) {
    if (!t) continue
    const tNome = String(t.nome || t.dados?.nome || t.dados?.turma || '').trim()
    if (!tNome) continue
    addKey(t.id, tNome)
    addKey(t.codigo, tNome)
    addKey(t.dados?.codigo, tNome)
    addKey(t.dados?.id, tNome)
    addKey(t.dados?.turma_id, tNome)
    addKey(t.dados?.codigoTurma, tNome)
    addKey(tNome, tNome)
  }

  for (const g of gruposRows || []) {
    if (!g) continue
    const gNome = String(g.nome || g.dados?.nome || '').trim()
    if (!gNome) continue
    if (!map.has(String(g.id || '').trim())) {
      addKey(g.id, gNome)
    }
    const syncId = g.syncId || g.dados?.syncId
    if (syncId && !map.has(String(syncId).trim())) {
      addKey(syncId, gNome)
    }
  }

  return map
}

function extractStudentTurma(
  a: any,
  turmaMap?: Map<string, string>,
  allTurmas: any[] = [],
  allGrupos: any[] = []
): string {
  const lookupInMap = (raw: any): string => {
    if (!raw || !turmaMap) return ''
    const str = String(raw).trim()
    if (!str) return ''
    return (
      turmaMap.get(str) ||
      turmaMap.get(str.toLowerCase()) ||
      turmaMap.get(str.replace(/^(t_|turma_|sync-)/i, '').trim()) ||
      ''
    )
  }

  // 1. Priorizar resolução direta via tabela de turmas (ID ou código -> Nome da turma)
  const directCandidates = [
    a?.turma,
    a?.dados?.turma,
    getAlunoTurmaCursando(a),
    a?.turma_id,
    a?.dados?.turma_id
  ]
  for (const c of directCandidates) {
    const mapped = lookupInMap(c)
    if (mapped) return mapped
  }

  // 2. Verificar campos explícitos de nome de turma (caso já sejam nomes legíveis)
  const nameCandidates = [
    a?.turma_nome,
    a?.dados?.turma_nome,
    a?.dados?.turmaNome,
    getAlunoTurmaCursando(a),
    a?.turma,
    a?.dados?.turma
  ]
  for (const c of nameCandidates) {
    const mapped = lookupInMap(c)
    if (mapped) return mapped
    if (isReadableTurmaName(c)) return String(c).trim()
  }

  // 3. Resolver via utilitário unificado de turmas e grupos
  if (allTurmas.length > 0 || allGrupos.length > 0) {
    const names = getAlunoNomesTurmasEGrupos(a, allTurmas, allGrupos)
    if (names.length > 0 && names[0]) return names[0]
  }

  // 4. Verificar histórico de turmas do aluno
  const hist = a?.historicoTurmas || a?.dados?.historicoTurmas
  if (Array.isArray(hist)) {
    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i]
      if (!h) continue
      const raw = h.serieTurma || h.turma || h.turmaId || h.turma_id || h.nome
      const mapped = lookupInMap(raw)
      if (mapped) return mapped
      if (isReadableTurmaName(raw)) return String(raw).trim()
    }
  }

  // 5. Fallback para série legível
  if (isReadableTurmaName(a?.serie || a?.dados?.serie)) {
    return String(a?.serie || a?.dados?.serie).trim()
  }

  return String(a?.turma || a?.dados?.turma || '').trim()
}

function getPrimaryResponsavelObj(a: any): any | null {
  const d = a?.dados || {}
  const list = Array.isArray(a?.responsaveis)
    ? a.responsaveis
    : Array.isArray(d?.responsaveis)
      ? d.responsaveis
      : []
  if (list.length === 0) return null
  return (
    list.find((r: any) => r && (r.isFinanceiro || r.respFinanceiro)) ||
    list.find((r: any) => r && (r.isPedagogico || r.respPedagogico)) ||
    list.find((r: any) => r && r.nome) ||
    list[0] ||
    null
  )
}

function extractStudentPhone(a: any): string {
  const d = a?.dados || {}
  const respObj = getPrimaryResponsavelObj(a)
  const candidates = [
    respObj?.telefone,
    respObj?.celular,
    respObj?.whatsapp,
    respObj?.dados?.celular,
    respObj?.dados?.telefone,
    respObj?.dados?.whatsapp,
    d.telResponsavelFinanceiro,
    d.tel_responsavel_financeiro,
    d.whatsappResponsavel,
    d.telefoneResponsavel,
    d.celularResponsavel,
    d.responsavel_telefone,
    d.responsavelTelefone,
    d.mae_telefone,
    d.maeTelefone,
    d.pai_telefone,
    d.paiTelefone,
    d.whatsapp,
    d.celular,
    d.telefone,
    a?.telefone
  ]
  for (const c of candidates) {
    if (c && String(c).replace(/\D/g, '').length >= 10) {
      return String(c).trim()
    }
  }
  return ''
}

function extractStudentResponsavel(a: any): string {
  const d = a?.dados || {}
  const respObj = getPrimaryResponsavelObj(a)
  return String(
    respObj?.nome ||
      a?.responsavel_financeiro ||
      a?.responsavelFinanceiro ||
      d.nomeResponsavel ||
      d.responsavelFinanceiro ||
      d.responsavel_financeiro ||
      d.responsavel_nome ||
      d.responsavelNome ||
      d.responsavel ||
      d.mae_nome ||
      d.maeNome ||
      d.mae ||
      d.pai_nome ||
      d.paiNome ||
      d.pai ||
      ''
  ).trim()
}

function extractStudentResponsavelCpf(a: any): string {
  const d = a?.dados || {}
  const respObj = getPrimaryResponsavelObj(a)
  return String(
    respObj?.cpf ||
      respObj?.dados?.cpf ||
      a?.cpfResponsavelFinanceiro ||
      d.cpfResponsavelFinanceiro ||
      d.cpf_responsavel_financeiro ||
      d.cpfResponsavel ||
      d.responsavel_cpf ||
      d.cpf_responsavel ||
      ''
  ).trim()
}

function extractStudentResponsavelEmail(a: any): string {
  const d = a?.dados || {}
  const respObj = getPrimaryResponsavelObj(a)
  return String(
    respObj?.email ||
      respObj?.dados?.email ||
      a?.emailResponsavelFinanceiro ||
      d.emailResponsavelFinanceiro ||
      d.emailResponsavel ||
      d.responsavel_email ||
      a?.email ||
      d.email ||
      ''
  ).trim()
}

function extractStudentResponsavelParentesco(a: any): string {
  const d = a?.dados || {}
  const respObj = getPrimaryResponsavelObj(a)
  const raw = String(
    respObj?.parentesco ||
      a?.parentescoResponsavelFinanceiro ||
      d.parentescoResponsavelFinanceiro ||
      d.parentesco ||
      ''
  ).trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  if (lower === 'mae' || lower === 'mãe') return 'Mãe'
  if (lower === 'pai') return 'Pai'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function extractStudentFoto(a: any): string | null {
  const d = a?.dados || {}
  const f = a?.foto || a?.foto_url || a?.fotoUrl || d.foto || d.avatarUrl || d.fotoUrl || null
  return f ? String(f) : null
}

async function fetchAllDestinatarios() {
  const allRows: any[] = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('agenda_cobrancas_destinatarios')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Erro ao buscar lote de agenda_cobrancas_destinatarios:', error)
      break
    }
    if (!data || data.length === 0) break

    allRows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
    if (from >= 25000) break
  }

  return allRows
}

export async function GET(request: Request) {
  try {
    const { user, isFamilyOrStudent, errorResponse } = await resolveUserRole(request)
    if (errorResponse || !user) return errorResponse!
    if (isFamilyOrStudent) {
      return NextResponse.json({ error: 'Acesso restrito à administração.' }, { status: 403 })
    }

    const reqUrl = new URL(request.url)
    const comunicadoIdParam = (reqUrl.searchParams.get('comunicado_id') || '').trim()

    const [cobrancasRes, destinatariosAll, alunosRes, gruposRes, turmasRes] = await Promise.all([
      comunicadoIdParam
        ? supabase
            .from('agenda_cobrancas')
            .select('*')
            .eq('comunicado_id', comunicadoIdParam)
            .order('created_at', { ascending: true })
        : supabase
            .from('agenda_cobrancas')
            .select('*')
            .order('created_at', { ascending: false }),
      comunicadoIdParam ? Promise.resolve([] as any[]) : fetchAllDestinatarios(),
      supabase
        .from('alunos')
        .select('id, nome, turma, matricula, email, status, dados'),
      supabase
        .from('agenda_grupos')
        .select('id, dados'),
      supabase
        .from('turmas')
        .select('id, nome, codigo, ano, turno, serie, dados')
    ])

    const allTurmas = turmasRes.data || []
    const allGrupos = gruposRes.data || []
    const turmaMap = buildTurmaNameMap(allTurmas, allGrupos)

    const gruposByAlunoId: Record<string, string[]> = {}
    for (const g of allGrupos) {
      const gNome = String(g?.dados?.nome || '').trim()
      const ids = Array.isArray(g?.dados?.alunosIds) ? g.dados.alunosIds : []
      if (!gNome) continue
      for (const rawId of ids) {
        const clean = normalizeId(rawId)
        if (!clean) continue
        if (!gruposByAlunoId[clean]) gruposByAlunoId[clean] = []
        if (!gruposByAlunoId[clean].includes(gNome)) {
          gruposByAlunoId[clean].push(gNome)
        }
      }
    }

    let cobrancas = cobrancasRes.data || []
    let destinatarios = destinatariosAll

    if (comunicadoIdParam) {
      const { data: comRow } = await supabase
        .from('comunicados')
        .select('id, titulo, autor, data, destino, dados, created_at')
        .eq('id', comunicadoIdParam)
        .maybeSingle()

      // Auto-heal: se o comunicado possui cobranças no JSON mas ainda não tem linha em agenda_cobrancas
      if (cobrancas.length === 0 && comRow && comRow.destino !== 'interno') {
        const rawCobs = Array.isArray(comRow.dados?.cobrancas) && comRow.dados.cobrancas.length > 0
          ? comRow.dados.cobrancas
          : comRow.dados?.cobranca && comRow.dados.cobranca.valor
            ? [comRow.dados.cobranca]
            : []

        const createdCobs: any[] = []
        for (const rc of rawCobs) {
          if (!rc || !rc.valor) continue
          const vNum = typeof rc.valor === 'string'
            ? parseFloat(rc.valor.replace(/\./g, '').replace(',', '.'))
            : Number(rc.valor)
          if (isNaN(vNum) || vNum <= 0) continue

          const { data: insCob } = await supabase
            .from('agenda_cobrancas')
            .insert({
              comunicado_id: comunicadoIdParam,
              titulo: rc.titulo || comRow.titulo || 'Cobrança',
              valor: vNum,
              vencimento: rc.vencimento || null
            })
            .select('*')
            .single()

          if (insCob) createdCobs.push(insCob)
        }
        if (createdCobs.length > 0) {
          cobrancas = createdCobs
        }
      }

      if (cobrancas.length > 0) {
        const cobIds = cobrancas.map((c: any) => c.id)
        const { data: destRows } = await supabase
          .from('agenda_cobrancas_destinatarios')
          .select('*')
          .in('cobranca_id', cobIds)
          .order('created_at', { ascending: true })

        destinatarios = destRows || []

        // Auto-sync: se alguma cobrança deste comunicado estiver com 0 destinatários (ou faltando destinatários do comunicado)
        if (comRow && comRow.destino !== 'interno') {
          const needsSync = cobrancas.some(
            (c: any) => !destinatarios.some((d: any) => String(d.cobranca_id) === String(c.id))
          )
          if (needsSync) {
            try {
              const { students } = await getStudentTargetsForComunicados({
                ...(comRow.dados || {}),
                id: comRow.id,
                destino: comRow.destino
              })

              const targetMap = new Map<string, string>()
              for (const s of students || []) {
                const cid = normalizeId(s.aluno_id)
                if (cid && s.aluno_nome) targetMap.set(cid, s.aluno_nome)
              }

              // Fallback direto por turmas/grupos/alunosIds caso getStudentTargetsForComunicados retorne vazio
              if (targetMap.size === 0) {
                const d = comRow.dados || {}
                const rawTurmas: string[] = Array.isArray(d.turmas) ? d.turmas : []
                const rawGrupos: string[] = Array.isArray(d.grupos) ? d.grupos : []
                const rawAlunosIds: string[] = Array.isArray(d.alunosIds) ? d.alunosIds : []
                const isTodos =
                  comRow.destino === 'todos' ||
                  d.destino === 'todos' ||
                  (rawTurmas.length === 0 && rawGrupos.length === 0 && rawAlunosIds.length === 0)

                const turmasNorm = new Set<string>()
                for (const t of [...rawTurmas, ...rawGrupos]) {
                  const s = String(t || '').trim()
                  if (!s) continue
                  turmasNorm.add(s.toLowerCase())
                  const mapped = turmaMap.get(s) || turmaMap.get(s.toLowerCase())
                  if (mapped) {
                    turmasNorm.add(mapped.toLowerCase())
                    turmasNorm.add(mapped.split(' - ')[0].trim().toLowerCase())
                  }
                }
                const alunosNorm = new Set(rawAlunosIds.map(id => normalizeId(id)).filter(Boolean))

                for (const a of alunosRes.data || []) {
                  if (!isStudentActive(a)) continue
                  const cleanId = normalizeId(a.id)
                  const nome = String(a.nome || a.dados?.nome || '').trim()
                  if (!cleanId || !nome) continue

                  const turma = extractStudentTurma(a, turmaMap, allTurmas, allGrupos)
                  const rawTurma = String(a.turma || a.dados?.turma || '').trim()
                  const stuGrupos = gruposByAlunoId[cleanId] || []

                  let match = false
                  if (isTodos) {
                    match = true
                  } else {
                    const turmaBase = turma.split(' - ')[0].trim().toLowerCase()
                    if (
                      (turma && (turmasNorm.has(turma.toLowerCase()) || turmasNorm.has(turmaBase))) ||
                      (rawTurma && turmasNorm.has(rawTurma.toLowerCase())) ||
                      stuGrupos.some(g => turmasNorm.has(g.toLowerCase())) ||
                      alunosNorm.has(cleanId) ||
                      alunosNorm.has(String(a.id))
                    ) {
                      match = true
                    }
                  }
                  if (match) {
                    targetMap.set(cleanId, nome)
                  }
                }
              }

              if (targetMap.size > 0) {
                let insertedAny = false
                for (const cob of cobrancas) {
                  const existingForCob = new Set(
                    destinatarios
                      .filter((d: any) => String(d.cobranca_id) === String(cob.id))
                      .map((d: any) => normalizeId(d.destinatario_id))
                      .filter(Boolean)
                  )
                  const rowsToInsert: any[] = []
                  targetMap.forEach((stuNome, stuId) => {
                    if (!existingForCob.has(stuId)) {
                      rowsToInsert.push({
                        cobranca_id: cob.id,
                        destinatario_id: stuId,
                        destinatario_nome: stuNome,
                        status: 'PENDING'
                      })
                    }
                  })
                  if (rowsToInsert.length > 0) {
                    const { error: insErr } = await supabase
                      .from('agenda_cobrancas_destinatarios')
                      .insert(rowsToInsert)
                    if (!insErr) insertedAny = true
                  }
                }

                if (insertedAny) {
                  const { data: refreshedDests } = await supabase
                    .from('agenda_cobrancas_destinatarios')
                    .select('*')
                    .in('cobranca_id', cobIds)
                    .order('created_at', { ascending: true })
                  if (refreshedDests) {
                    destinatarios = refreshedDests
                  }
                }
              }
            } catch (syncErr) {
              console.warn('Aviso ao sincronizar destinatários da cobrança do comunicado:', syncErr)
            }
          }
        }
      }
    }

    const comunicadoIds = Array.from(
      new Set(cobrancas.map((c: any) => String(c.comunicado_id || '').trim()).filter(Boolean))
    )

    const comunicadosMap: Record<string, any> = {}
    if (comunicadoIds.length > 0) {
      const { data: comRows } = await supabase
        .from('comunicados')
        .select('id, titulo, autor, data, destino, dados, created_at')
        .in('id', comunicadoIds)

      for (const com of comRows || []) {
        const rawTurmas: any[] = Array.isArray(com.dados?.turmas) ? com.dados.turmas : []
        const resolvedTurmas = Array.from(
          new Set(
            rawTurmas
              .map(t => {
                const str = String(t || '').trim()
                return turmaMap.get(str) || turmaMap.get(str.toLowerCase()) || str
              })
              .filter(Boolean)
          )
        )
        comunicadosMap[String(com.id)] = {
          id: com.id,
          titulo: com.titulo || com.dados?.titulo || 'Comunicado',
          autor: com.autor || com.dados?.autor || 'Administração',
          data: com.data || com.dados?.dataEnvio || com.created_at,
          destino: com.destino || com.dados?.destino || 'selecionados',
          turmas: resolvedTurmas,
          grupos: com.dados?.grupos || [],
          alunosIds: com.dados?.alunosIds || []
        }
      }
    }

    const alunosDirectory: Record<string, any> = {}
    const turmasSet = new Set<string>()
    const activeAlunosList: Array<{ id: string; nome: string; turma: string; matricula: string }> = []

    for (const a of alunosRes.data || []) {
      const cleanId = normalizeId(a.id)
      const nome = String(a.nome || a.dados?.nome || '').trim()
      const grupos = gruposByAlunoId[cleanId] || []
      const turma = extractStudentTurma(a, turmaMap, allTurmas, allGrupos) || grupos[0] || ''
      const matricula = String(a.matricula || a.dados?.matricula || '').trim()
      const responsavel = extractStudentResponsavel(a)
      const cpfResponsavel = extractStudentResponsavelCpf(a)
      const parentesco = extractStudentResponsavelParentesco(a)
      const telefone = extractStudentPhone(a)
      const email = extractStudentResponsavelEmail(a)
      const foto = extractStudentFoto(a)
      const ativo = isStudentActive(a)

      if (turma) turmasSet.add(turma)
      if (ativo && cleanId && nome) {
        activeAlunosList.push({ id: cleanId, nome, turma: turma || 'Sem Turma', matricula })
      }

      const entry = {
        id: cleanId,
        rawId: a.id,
        nome,
        turma,
        grupos,
        matricula,
        responsavel,
        cpfResponsavel,
        parentesco,
        telefone,
        email,
        foto,
        ativo
      }

      alunosDirectory[cleanId] = entry
      alunosDirectory[String(a.id)] = entry
      if (nome) {
        alunosDirectory[nome.toLowerCase()] = entry
      }
    }

    // Se filtrado por comunicado_id, anexa agenda_cobrancas_destinatarios dentro de cada cobranca
    const enrichedCobrancas = comunicadoIdParam
      ? cobrancas.map((cob: any) => ({
          ...cob,
          agenda_cobrancas_destinatarios: destinatarios.filter(
            (d: any) => String(d.cobranca_id) === String(cob.id)
          )
        }))
      : cobrancas

    activeAlunosList.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const turmasList = Array.from(turmasSet).sort(compareTurmasBySerie)
    const turmasMapObj = Object.fromEntries(turmaMap.entries())

    return NextResponse.json({
      cobrancas: enrichedCobrancas,
      destinatarios,
      comunicadosMap,
      alunosDirectory,
      turmasList,
      turmasMap: turmasMapObj,
      activeAlunosList
    })
  } catch (error: any) {
    console.error('Erro em GET /api/cobrancas:', error)
    return NextResponse.json({ error: error.message || 'Erro interno ao buscar cobranças' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, dbUser, isFamilyOrStudent, errorResponse } = await resolveUserRole(request)
    if (errorResponse || !user) return errorResponse!
    if (isFamilyOrStudent) {
      return NextResponse.json({ error: 'Acesso restrito à administração.' }, { status: 403 })
    }

    const body = await request.json()
    const titulo = String(body.titulo || '').trim()
    const valorNum = typeof body.valor === 'string'
      ? parseFloat(body.valor.replace(/\./g, '').replace(',', '.'))
      : Number(body.valor)
    const vencimento = String(body.vencimento || '').trim()
    const publico: 'todos' | 'turmas' | 'alunos' = body.publico || 'turmas'
    const turmasSelecionadas: string[] = Array.isArray(body.turmas) ? body.turmas : []
    const alunosSelecionados: string[] = Array.isArray(body.alunosIds) ? body.alunosIds : []
    const criarComunicado = body.criarComunicado !== false
    const descricaoComunicado = String(body.descricao || '').trim()

    if (!titulo || isNaN(valorNum) || valorNum <= 0 || !vencimento) {
      return NextResponse.json(
        { error: 'Preencha o motivo/título, um valor válido maior que zero e a data de vencimento.' },
        { status: 400 }
      )
    }

    const [{ data: allAlunos }, { data: allTurmas }, { data: allGrupos }] = await Promise.all([
      supabase.from('alunos').select('id, nome, turma, status, dados'),
      supabase.from('turmas').select('id, nome, codigo, ano, turno, serie, dados'),
      supabase.from('agenda_grupos').select('id, dados')
    ])

    const turmaMap = buildTurmaNameMap(allTurmas || [], allGrupos || [])
    const targetStudents: Array<{ aluno_id: string; aluno_nome: string; turma: string }> = []
    const seenIds = new Set<string>()
    const selectedTurmasNorm = new Set(turmasSelecionadas.map(t => t.trim().toLowerCase()))
    const selectedAlunosNorm = new Set(alunosSelecionados.map(id => normalizeId(id)))

    for (const a of allAlunos || []) {
      if (!isStudentActive(a)) continue
      const cleanId = normalizeId(a.id)
      const nome = String(a.nome || a.dados?.nome || '').trim()
      const turma = extractStudentTurma(a, turmaMap, allTurmas || [], allGrupos || [])
      const rawTurma = String(a.turma || a.dados?.turma || '').trim()
      if (!cleanId || !nome || seenIds.has(cleanId)) continue

      let match = false
      if (publico === 'todos') {
        match = true
      } else if (publico === 'turmas') {
        const turmaBase = turma.split(' - ')[0].trim().toLowerCase()
        if (
          selectedTurmasNorm.has(turma.toLowerCase()) ||
          selectedTurmasNorm.has(turmaBase) ||
          (rawTurma && selectedTurmasNorm.has(rawTurma.toLowerCase()))
        ) {
          match = true
        }
      } else if (publico === 'alunos') {
        if (selectedAlunosNorm.has(cleanId) || selectedAlunosNorm.has(String(a.id))) {
          match = true
        }
      }

      if (match) {
        seenIds.add(cleanId)
        targetStudents.push({
          aluno_id: cleanId,
          aluno_nome: nome,
          turma
        })
      }
    }

    if (targetStudents.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum aluno ativo encontrado para o filtro de destinatários selecionado.' },
        { status: 400 }
      )
    }

    const comunicadoId = body.comunicado_id
      ? String(body.comunicado_id)
      : `AD-COM-COB-${Date.now()}`

    const autorNome = dbUser?.nome || user.user_metadata?.nome || user.email?.split('@')[0] || 'Financeiro Escolar'
    const autorCargo = dbUser?.cargo || user.user_metadata?.cargo || 'Departamento Financeiro'

    if (criarComunicado && !body.comunicado_id) {
      const vencFmt = new Date(`${vencimento}T12:00:00`).toLocaleDateString('pt-BR')
      const valFmt = valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const htmlConteudo = descricaoComunicado
        ? `<p>${descricaoComunicado.replace(/\n/g, '<br/>')}</p>`
        : `<p>Olá, família! Foi gerada uma cobrança digital referente a <strong>${titulo}</strong> no valor de <strong>R$ ${valFmt}</strong> com vencimento em <strong>${vencFmt}</strong>. Você pode realizar o pagamento via Pix ou Cartão diretamente pelo botão abaixo.</p>`

      const cobObjForCom = {
        id: `cob_${Date.now()}`,
        titulo,
        valor: valorNum,
        vencimento
      }

      const comRow = {
        id: comunicadoId,
        titulo,
        texto: htmlConteudo,
        autor: autorNome,
        data: new Date().toISOString(),
        destino: publico === 'todos' ? 'todos' : 'selecionados',
        fixado: false,
        dados: {
          id: comunicadoId,
          titulo,
          conteudo: htmlConteudo,
          tipo: 'cobrança',
          autor: autorNome,
          autorCargo,
          autorId: user.id,
          turmas: publico === 'turmas' ? turmasSelecionadas : [],
          alunosIds: publico === 'alunos' ? Array.from(selectedAlunosNorm) : [],
          grupos: [],
          prioridade: 'normal',
          exigeCiencia: false,
          permiteResposta: true,
          dataEnvio: new Date().toISOString(),
          anexos: [`Cobrança: ${titulo}|cobranca:${valorNum}|cobranca`],
          cobranca: cobObjForCom,
          cobrancas: [cobObjForCom],
          status: 'enviado',
          leituras: {},
          ciencias: {}
        }
      }

      await supabase.from('comunicados').upsert(comRow)
    }

    const { data: cobrancaSalva, error: cobErr } = await supabase
      .from('agenda_cobrancas')
      .insert({
        comunicado_id: comunicadoId,
        titulo,
        valor: valorNum,
        vencimento
      })
      .select('*')
      .single()

    if (cobErr || !cobrancaSalva) {
      return NextResponse.json(
        { error: cobErr?.message || 'Erro ao criar registro em agenda_cobrancas' },
        { status: 500 }
      )
    }

    const destRows = targetStudents.map(s => ({
      cobranca_id: cobrancaSalva.id,
      destinatario_id: s.aluno_id,
      destinatario_nome: s.aluno_nome,
      status: 'PENDING'
    }))

    const batchSize = 500
    for (let i = 0; i < destRows.length; i += batchSize) {
      const slice = destRows.slice(i, i + batchSize)
      const { error: destErr } = await supabase.from('agenda_cobrancas_destinatarios').insert(slice)
      if (destErr) {
        return NextResponse.json(
          { error: `Cobrança criada, mas falha ao inserir destinatários: ${destErr.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      cobranca: cobrancaSalva,
      totalDestinatarios: destRows.length
    })
  } catch (error: any) {
    console.error('Erro em POST /api/cobrancas:', error)
    return NextResponse.json({ error: error.message || 'Erro interno ao criar cobrança' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, dbUser, isFamilyOrStudent, errorResponse } = await resolveUserRole(request)
    if (errorResponse || !user) return errorResponse!
    if (isFamilyOrStudent) {
      return NextResponse.json({ error: 'Acesso restrito à administração.' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    // 1. Editar Cobrança (título, valor, vencimento)
    if (action === 'update_cobranca') {
      const { id, titulo, valor, vencimento } = body
      if (!id) {
        return NextResponse.json({ error: 'ID da cobrança é obrigatório.' }, { status: 400 })
      }

      const updateData: Record<string, any> = {}
      if (titulo !== undefined) updateData.titulo = String(titulo).trim()
      if (valor !== undefined) {
        const vNum = typeof valor === 'string' ? parseFloat(valor.replace(/\./g, '').replace(',', '.')) : Number(valor)
        if (!isNaN(vNum) && vNum > 0) updateData.valor = vNum
      }
      if (vencimento !== undefined) updateData.vencimento = String(vencimento).trim()

      const { data: updatedCob, error: updErr } = await supabase
        .from('agenda_cobrancas')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single()

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }

      // Sincroniza também os metadados no comunicado vinculado, se existir
      if (updatedCob?.comunicado_id) {
        const { data: comRow } = await supabase
          .from('comunicados')
          .select('id, dados')
          .eq('id', String(updatedCob.comunicado_id))
          .maybeSingle()

        if (comRow && comRow.dados) {
          const d = { ...comRow.dados }
          if (d.cobranca) {
            d.cobranca = {
              ...d.cobranca,
              titulo: updatedCob.titulo,
              valor: updatedCob.valor,
              vencimento: updatedCob.vencimento
            }
          }
          if (Array.isArray(d.cobrancas) && d.cobrancas.length > 0) {
            d.cobrancas = d.cobrancas.map((c: any, idx: number) =>
              idx === 0 || c.id === updatedCob.id
                ? { ...c, titulo: updatedCob.titulo, valor: updatedCob.valor, vencimento: updatedCob.vencimento }
                : c
            )
          }
          await supabase.from('comunicados').update({ dados: d }).eq('id', comRow.id)
        }
      }

      return NextResponse.json({ success: true, cobranca: updatedCob })
    }

    // 2. Dar Baixa Manual / Reverter Status de um Destinatário
    if (action === 'toggle_destinatario_status') {
      const { destinatario_row_id, novo_status, observacao_pagador } = body
      if (!destinatario_row_id) {
        return NextResponse.json({ error: 'ID do destinatário é obrigatório.' }, { status: 400 })
      }

      const { data: existingRow } = await supabase
        .from('agenda_cobrancas_destinatarios')
        .select('*')
        .eq('id', destinatario_row_id)
        .maybeSingle()

      if (!existingRow) {
        return NextResponse.json({ error: 'Registro de destinatário não encontrado.' }, { status: 404 })
      }

      const isCurrentlyPaid = existingRow.status === 'RECEIVED' || existingRow.status === 'CONFIRMED'
      const targetStatus = novo_status || (isCurrentlyPaid ? 'PENDING' : 'RECEIVED')
      const adminName = dbUser?.nome || user.user_metadata?.nome || user.email?.split('@')[0] || 'Admin'

      const updatePayload: Record<string, any> = {
        status: targetStatus
      }

      if ('updated_at' in existingRow) {
        updatePayload.updated_at = new Date().toISOString()
      }

      if (targetStatus === 'RECEIVED' || targetStatus === 'CONFIRMED') {
        if ('pagador_usuario_nome' in existingRow) {
          updatePayload.pagador_usuario_nome =
            observacao_pagador || existingRow.pagador_usuario_nome || `Baixa Manual (${adminName})`
        }
        if ('pagador_usuario_id' in existingRow && !existingRow.pagador_usuario_id) {
          updatePayload.pagador_usuario_id = user.id
        }
      } else {
        if ('pagador_usuario_nome' in existingRow && String(existingRow.pagador_usuario_nome || '').startsWith('Baixa Manual')) {
          updatePayload.pagador_usuario_nome = null
        }
      }

      let { data: updatedDest, error: errUpd } = await supabase
        .from('agenda_cobrancas_destinatarios')
        .update(updatePayload)
        .eq('id', destinatario_row_id)
        .select('*')
        .single()

      if (errUpd) {
        const fallback = await supabase
          .from('agenda_cobrancas_destinatarios')
          .update({ status: targetStatus })
          .eq('id', destinatario_row_id)
          .select('*')
          .single()
        updatedDest = fallback.data
        errUpd = fallback.error
      }

      if (errUpd) {
        return NextResponse.json({ error: errUpd.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, destinatario: updatedDest })
    }

    // 3. Sincronizar / Adicionar Destinatários Faltantes na Cobrança
    if (action === 'sync_destinatarios') {
      const { cobranca_id, turmas, alunosIds } = body
      if (!cobranca_id) {
        return NextResponse.json({ error: 'cobranca_id é obrigatório.' }, { status: 400 })
      }

      const { data: cob } = await supabase
        .from('agenda_cobrancas')
        .select('*')
        .eq('id', cobranca_id)
        .maybeSingle()

      if (!cob) {
        return NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 })
      }

      const { data: existingDests } = await supabase
        .from('agenda_cobrancas_destinatarios')
        .select('id, destinatario_id')
        .eq('cobranca_id', cobranca_id)

      const existingIds = new Set(
        (existingDests || []).map((d: any) => normalizeId(d.destinatario_id)).filter(Boolean)
      )

      const [{ data: allAlunos }, { data: allTurmas }, { data: allGrupos }] = await Promise.all([
        supabase.from('alunos').select('id, nome, turma, status, dados'),
        supabase.from('turmas').select('id, nome, codigo, ano, turno, serie, dados'),
        supabase.from('agenda_grupos').select('id, dados')
      ])

      const turmaMap = buildTurmaNameMap(allTurmas || [], allGrupos || [])

      let targetTurmas: string[] = Array.isArray(turmas) ? turmas : []
      let targetGrupos: string[] = []
      let targetAlunosIds: string[] = Array.isArray(alunosIds) ? alunosIds : []
      let isTodos = false
      let comRowForSync: any = null

      if (targetTurmas.length === 0 && targetAlunosIds.length === 0 && cob.comunicado_id) {
        const { data: com } = await supabase
          .from('comunicados')
          .select('id, destino, dados')
          .eq('id', String(cob.comunicado_id))
          .maybeSingle()

        if (com) {
          comRowForSync = com
          const d = com.dados || {}
          targetTurmas = Array.isArray(d.turmas) ? d.turmas : []
          targetGrupos = Array.isArray(d.grupos) ? d.grupos : []
          targetAlunosIds = Array.isArray(d.alunosIds) ? d.alunosIds : []
          if (
            com.destino === 'todos' ||
            d.destino === 'todos' ||
            (targetTurmas.length === 0 && targetGrupos.length === 0 && targetAlunosIds.length === 0)
          ) {
            isTodos = true
          }
        }
      }

      const toInsert: Array<{ cobranca_id: string; destinatario_id: string; destinatario_nome: string; status: string }> = []

      if (comRowForSync && comRowForSync.destino !== 'interno') {
        try {
          const { students } = await getStudentTargetsForComunicados({
            ...(comRowForSync.dados || {}),
            id: comRowForSync.id,
            destino: comRowForSync.destino
          })
          for (const s of students || []) {
            const cleanId = normalizeId(s.aluno_id)
            const nome = String(s.aluno_nome || '').trim()
            if (cleanId && nome && !existingIds.has(cleanId)) {
              existingIds.add(cleanId)
              toInsert.push({
                cobranca_id,
                destinatario_id: cleanId,
                destinatario_nome: nome,
                status: 'PENDING'
              })
            }
          }
        } catch (_) {}
      }

      const turmasNorm = new Set<string>()
      for (const t of [...targetTurmas, ...targetGrupos]) {
        const raw = String(t || '').trim()
        if (!raw) continue
        turmasNorm.add(raw.toLowerCase())
        const mapped = turmaMap.get(raw) || turmaMap.get(raw.toLowerCase())
        if (mapped) {
          turmasNorm.add(mapped.toLowerCase())
          turmasNorm.add(mapped.split(' - ')[0].trim().toLowerCase())
        }
      }
      const alunosNorm = new Set(targetAlunosIds.map(id => normalizeId(id)))

      for (const a of allAlunos || []) {
        if (!isStudentActive(a)) continue
        const cleanId = normalizeId(a.id)
        const nome = String(a.nome || a.dados?.nome || '').trim()
        const turma = extractStudentTurma(a, turmaMap, allTurmas || [], allGrupos || [])
        const rawTurma = String(a.turma || a.dados?.turma || '').trim()
        if (!cleanId || !nome || existingIds.has(cleanId)) continue

        let match = false
        if (isTodos) {
          match = true
        } else {
          const turmaBase = turma.split(' - ')[0].trim().toLowerCase()
          if (
            (turma && (turmasNorm.has(turma.toLowerCase()) || turmasNorm.has(turmaBase))) ||
            (rawTurma && turmasNorm.has(rawTurma.toLowerCase()))
          ) {
            match = true
          }
          if (alunosNorm.has(cleanId) || alunosNorm.has(String(a.id))) match = true
        }

        if (match) {
          existingIds.add(cleanId)
          toInsert.push({
            cobranca_id,
            destinatario_id: cleanId,
            destinatario_nome: nome,
            status: 'PENDING'
          })
        }
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('agenda_cobrancas_destinatarios').insert(toInsert)
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 400 })
        }
      }

      const { data: updatedDests } = await supabase
        .from('agenda_cobrancas_destinatarios')
        .select('*')
        .eq('cobranca_id', cobranca_id)
        .order('created_at', { ascending: true })

      return NextResponse.json({
        success: true,
        addedCount: toInsert.length,
        destinatarios: updatedDests || []
      })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (error: any) {
    console.error('Erro em PATCH /api/cobrancas:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, isFamilyOrStudent, errorResponse } = await resolveUserRole(request)
    if (errorResponse || !user) return errorResponse!
    if (isFamilyOrStudent) {
      return NextResponse.json({ error: 'Acesso restrito à administração.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID da cobrança é obrigatório.' }, { status: 400 })
    }

    await supabase.from('agenda_cobrancas_destinatarios').delete().eq('cobranca_id', id)
    const { error } = await supabase.from('agenda_cobrancas').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro em DELETE /api/cobrancas:', error)
    return NextResponse.json({ error: error.message || 'Erro ao excluir cobrança' }, { status: 500 })
  }
}
