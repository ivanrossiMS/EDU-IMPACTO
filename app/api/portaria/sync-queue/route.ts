import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/authGuard'
import { isValidStudentPhoto } from '@/lib/utils'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * GET /api/portaria/sync-queue
 * Retorna as pendências de sincronização para os leitores localmente ou via daemon.
 * Query params: ?dispositivo_id=... &limit=...
 */
async function getRegistradosHoje(sentido: 'entrada' | 'saida' = 'entrada') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    const todayStr = formatter.format(new Date())

    // ── OTIMIZAÇÃO DE ALTA PERFORMANCE ──
    // Busca direta na tabela 'frequencias' indexada por 'data', evitando full table scan
    // na tabela 'portaria_eventos' que contém centenas de milhares de linhas e causava 522.
    const { data: freqHoje } = await supabase
      .from('frequencias')
      .select('aluno_id, dados')
      .eq('data', todayStr)

    const alunoUuids = new Set<string>()
    for (const f of freqHoje || []) {
      if (sentido === 'saida') {
        if (f.dados?.saidaHorario && f.aluno_id) alunoUuids.add(String(f.aluno_id))
      } else {
        if (f.aluno_id) alunoUuids.add(String(f.aluno_id))
      }
    }

    const registeredSet = new Set<string>()

    if (alunoUuids.size > 0) {
      const { data: alunosMatch } = await supabase
        .from('alunos')
        .select('id, matricula, dados')
        .in('id', Array.from(alunoUuids))

      for (const a of alunosMatch || []) {
        if (a.id) registeredSet.add(String(a.id))
        const numMat = parseInt(String(a.matricula || a.dados?.codigo || '').replace(/\D/g, ''), 10)
        if (!isNaN(numMat) && numMat > 0) {
          registeredSet.add(String(numMat))
        }
      }
    }

    return Array.from(registeredSet)
  } catch (err: any) {
    console.error('[getRegistradosHoje Error]', err?.message)
    return []
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dispositivoId = searchParams.get('dispositivo_id')
    const limitParam = parseInt(searchParams.get('limit') || '100', 10)

    let query = supabase
      .from('portaria_sync')
      .select('aluno_id, dispositivo_id, status, erro_detalhe, updated_at', { count: 'exact' })
      .eq('status', 'pendente')
      .order('updated_at', { ascending: false })

    if (dispositivoId) {
      query = query.eq('dispositivo_id', dispositivoId)
    }

    const { data: pendingRows, error: pendingErr, count } = await query.limit(limitParam)
    if (pendingErr) throw pendingErr

    const registrados_entrada_hoje = await getRegistradosHoje('entrada')
    const registrados_saida_hoje = await getRegistradosHoje('saida')
    const registrados_hoje = registrados_entrada_hoje

    const { data: activeDevices } = await supabase
      .from('portaria_dispositivos')
      .select('id, nome, ip, porta, modelo, status, configuracao')

    const dispositivos = (activeDevices || []).map(d => ({
      id: d.id,
      nome: d.nome,
      ip: d.ip,
      porta: d.porta || 80,
      tipo: (d.configuracao as any)?.sentido || (/sa[ií]da/i.test(d.nome || '') || d.ip === '192.168.1.154' ? 'saida' : (d.ip === '192.168.1.150' ? 'ambos' : 'entrada')),
      senha: (d.configuracao as any)?.password || 'Pass1081$'
    }))

    const { data: configRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'portaria_config')
      .maybeSingle()
    const portariaConfig = configRow?.valor || {}
    const permitir_multiplas_entradas = !!portariaConfig.permitir_multiplas_entradas

    if (!pendingRows || pendingRows.length === 0) {
      return NextResponse.json({
        pendentes: [],
        registrados_hoje,
        registrados_entrada_hoje,
        registrados_saida_hoje,
        dispositivos,
        total: count || 0,
        permitir_multiplas_entradas,
        config: {
          permitir_multiplas_entradas
        }
      })
    }

    const rawAlunoIds = Array.from(new Set(pendingRows.map(r => String(r.aluno_id || '').trim())))
    const alunoIds = rawAlunoIds.filter(id => id && id !== '0' && id !== 'null' && id !== 'undefined')

    const alunosMap = new Map<string, any>()

    if (alunoIds.length > 0) {
      // Chunking em lotes de 80 para evitar erro de Header Overflow (UND_ERR_HEADERS_OVERFLOW)
      const CHUNK_SIZE = 80
      for (let i = 0; i < alunoIds.length; i += CHUNK_SIZE) {
        const chunk = alunoIds.slice(i, i + CHUNK_SIZE)
        
        const uuidChunk = chunk.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        const nonUuidChunk = chunk.filter(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))

        if (uuidChunk.length > 0) {
          const { data: byId, error: errId } = await supabase
            .from('alunos')
            .select('id, nome, matricula, foto, status, dados')
            .in('id', uuidChunk)
          if (!errId && byId) {
            for (const a of byId) {
              alunosMap.set(String(a.id), a)
              if (a.matricula) alunosMap.set(String(a.matricula), a)
            }
          }
        }

        if (nonUuidChunk.length > 0) {
          const { data: byMatricula, error: errMat } = await supabase
            .from('alunos')
            .select('id, nome, matricula, foto, status, dados')
            .in('matricula', nonUuidChunk)
          if (!errMat && byMatricula) {
            for (const a of byMatricula) {
              alunosMap.set(String(a.id), a)
              if (a.matricula) alunosMap.set(String(a.matricula), a)
            }
          }
        }
      }
    }

    const invalidIdsToClear: string[] = []
    const validPendentes: any[] = []

    for (const row of pendingRows) {
      const a = alunosMap.get(String(row.aluno_id))
      const isActive = a ? ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'].includes(a.status) : false
      
      let acao = 'update'
      if (!a || !isActive) {
        acao = 'delete'
      }

      // Resolução inteligente do numeric_id:
      let numeric_id: number | null = null
      if (a?.matricula) {
        const parsed = parseInt(String(a.matricula).replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) numeric_id = parsed
      }
      if (!numeric_id && a?.dados?.codigo) {
        const parsed = parseInt(String(a.dados.codigo).replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) numeric_id = parsed
      }
      if (!numeric_id) {
        const parsed = parseInt(String(row.aluno_id).replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) numeric_id = parsed
      }

      // Se for ID '0', nulo ou se for deleção sem ID numérico físico viável na catraca,
      // agenda auto-resolução para não travar a fila de envio indefinidamente
      if (!row.aluno_id || row.aluno_id === '0' || (!numeric_id && acao === 'delete')) {
        invalidIdsToClear.push(String(row.aluno_id))
        continue
      }

      validPendentes.push({
        id: row.aluno_id,
        aluno_id: row.aluno_id,
        dispositivo_id: row.dispositivo_id,
        numeric_id,
        nome: a?.nome || (numeric_id ? `Aluno ${numeric_id}` : 'Aluno Removido'),
        matricula: a?.matricula || (numeric_id ? String(numeric_id) : ''),
        foto: (a && isActive) ? a.foto : null,
        acao,
        erro_detalhe: row.erro_detalhe || null
      })
    }

    // Dá baixa automática imediata nos IDs inválidos/órfãos
    if (invalidIdsToClear.length > 0) {
      const uniqueInvalid = Array.from(new Set(invalidIdsToClear))
      await supabase
        .from('portaria_sync')
        .update({
          status: 'sincronizado',
          erro_detalhe: 'Baixa automática: ID inexistente ou sem representação numérica na catraca',
          updated_at: new Date().toISOString()
        })
        .in('aluno_id', uniqueInvalid)
        .eq('status', 'pendente')
    }

    const realTotal = Math.max(0, (count ?? pendingRows.length) - invalidIdsToClear.length)

    return NextResponse.json({
      pendentes: validPendentes,
      registrados_hoje,
      registrados_entrada_hoje,
      registrados_saida_hoje,
      dispositivos,
      total: realTotal,
      permitir_multiplas_entradas,
      config: {
        permitir_multiplas_entradas
      }
    })
  } catch (err: any) {
    console.error('[Sync Queue GET Error]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/portaria/sync-queue
 * Atualiza o resultado do envio de uma pendência.
 * Body: { aluno_id, dispositivo_id, status: 'sincronizado' | 'erro', erro_detalhe?, foto_enviada? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { aluno_id, dispositivo_id, status, erro_detalhe, foto_enviada } = body

    if (!aluno_id || !status) {
      return NextResponse.json({ error: 'aluno_id e status são obrigatórios' }, { status: 400 })
    }

    let query = supabase
      .from('portaria_sync')
      .update({
        status,
        ultima_sync: status === 'sincronizado' ? new Date().toISOString() : null,
        foto_enviada: foto_enviada ?? (status === 'sincronizado'),
        erro_detalhe: erro_detalhe || null,
        updated_at: new Date().toISOString()
      })
      .eq('aluno_id', String(aluno_id))

    if (dispositivo_id) {
      query = query.eq('dispositivo_id', String(dispositivo_id))
    }

    const { error: upsertErr } = await query
    if (upsertErr) throw upsertErr

    // Atualizar status do dispositivo para online se enviou com sucesso
    if (status === 'sincronizado' && dispositivo_id) {
      await supabase.from('portaria_dispositivos').update({
        status: 'online',
        ultima_comunicacao: new Date().toISOString()
      }).eq('id', dispositivo_id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Sync Queue POST Error]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PUT /api/portaria/sync-queue
 * Força o re-enfileiramento de TODOS os alunos ativos para todos os leitores iDFace.
 */
export async function PUT(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req)
  if (errorResponse) return errorResponse

  try {
    // 1. Buscar todos os dispositivos iDFace
    const { data: devices, error: devErr } = await supabase.from('portaria_dispositivos').select('id')
    if (devErr) throw devErr

    if (!devices || devices.length === 0) {
      return NextResponse.json({ error: 'Nenhum dispositivo cadastrado' }, { status: 400 })
    }

    // 2. Buscar todos os alunos ativos
    const { data: alunos, error: alunosErr } = await supabase
      .from('alunos')
      .select('id')
      .or('status.neq.inativo,status.is.null')

    if (alunosErr) throw alunosErr

    if (!alunos || alunos.length === 0) {
      return NextResponse.json({ message: 'Nenhum aluno ativo encontrado para sincronizar', count: 0 })
    }

    // 3. Gerar entradas de sync em lote
    const rowsToSync: any[] = []
    const now = new Date().toISOString()

    for (const a of alunos) {
      for (const dev of devices) {
        rowsToSync.push({
          aluno_id: a.id,
          dispositivo_id: dev.id,
          status: 'pendente',
          erro_detalhe: 'Sincronização global solicitada pelo administrador',
          updated_at: now
        })
      }
    }

    // Upsert em lotes de 200
    const chunkSize = 200
    for (let i = 0; i < rowsToSync.length; i += chunkSize) {
      const chunk = rowsToSync.slice(i, i + chunkSize)
      const { error: upsertErr } = await supabase.from('portaria_sync').upsert(chunk, { onConflict: 'aluno_id,dispositivo_id' })
      if (upsertErr) console.error('[Sync Queue Enqueue Error]', upsertErr.message)
    }

    return NextResponse.json({
      success: true,
      message: `${alunos.length} alunos enfileirados para ${devices.length} leitores iDFace com sucesso!`,
      total_operacoes: rowsToSync.length
    })
  } catch (err: any) {
    console.error('[Sync Queue PUT Error]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/portaria/sync-queue
 * Enfileira a exclusão de TODOS os alunos inativos, cancelados ou removidos das catracas.
 */
export async function DELETE(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('clear_all') === 'true') {
      const { error: delErr } = await supabase.from('portaria_sync').delete().eq('status', 'pendente')
      if (delErr) throw delErr
      return NextResponse.json({ success: true, message: 'Fila de pendências limpa com sucesso!' })
    }
    // 1. Buscar todos os dispositivos iDFace
    const { data: devices, error: devErr } = await supabase.from('portaria_dispositivos').select('id')
    if (devErr) throw devErr

    if (!devices || devices.length === 0) {
      return NextResponse.json({ error: 'Nenhum dispositivo cadastrado' }, { status: 400 })
    }

    // 2. Buscar TODOS os alunos ativos no ERP (matrículas e IDs)
    const { data: ativos } = await supabase
      .from('alunos')
      .select('id, matricula')
      .or('status.neq.inativo,status.is.null')

    const activeIds = new Set<string>()
    for (const a of ativos || []) {
      if (a.id) activeIds.add(String(a.id))
      if (a.matricula) activeIds.add(String(a.matricula))
      const numMat = parseInt(String(a.matricula || '').replace(/\D/g, ''), 10)
      if (!isNaN(numMat) && numMat > 0) activeIds.add(String(numMat))
    }

    // 3. Buscar TODOS os alunos inativos no ERP
    const { data: inativos } = await supabase
      .from('alunos')
      .select('id, matricula')
      .not('status', 'in', '(matriculado,cursando,ativo,Cursando,Matriculado,Ativo)')

    // 4. Buscar histórico de registros em portaria_sync e portaria_eventos
    const { data: syncRows } = await supabase.from('portaria_sync').select('aluno_id')
    const { data: eventRows } = await supabase.from('portaria_eventos').select('aluno_id, user_id_equipamento').limit(1000)

    const targetStudentIds = new Set<string>()

    // Adicionar inativos explícitos do ERP
    for (const i of inativos || []) {
      if (i.matricula) {
        const num = parseInt(String(i.matricula).replace(/\D/g, ''), 10)
        if (!isNaN(num) && num > 0) targetStudentIds.add(String(num))
      } else if (i.id) {
        targetStudentIds.add(String(i.id))
      }
    }

    // Adicionar IDs presentes no sync que não estão ativos no ERP (apenas números válidos > 0)
    for (const s of syncRows || []) {
      const idStr = String(s.aluno_id || '').trim()
      if (idStr && idStr !== '0' && idStr !== 'null' && idStr !== 'undefined' && !activeIds.has(idStr)) {
        const num = parseInt(idStr.replace(/\D/g, ''), 10)
        if (!isNaN(num) && num > 0) {
          targetStudentIds.add(String(num))
        }
      }
    }

    // Adicionar IDs presentes nos eventos que não estão ativos no ERP (apenas números válidos > 0)
    for (const e of eventRows || []) {
      const raw = e.user_id_equipamento || e.aluno_id
      if (!raw || raw === '0' || raw === 0) continue
      const idStr = String(raw).trim()
      if (idStr && idStr !== '0' && idStr !== 'null' && idStr !== 'undefined' && !activeIds.has(idStr)) {
        const num = parseInt(idStr.replace(/\D/g, ''), 10)
        if (!isNaN(num) && num > 0) {
          targetStudentIds.add(String(num))
        }
      }
    }

    if (targetStudentIds.size === 0) {
      return NextResponse.json({ message: 'Nenhum aluno inativo ou removido encontrado para exclusão', count: 0 })
    }

    // 4. Gerar entradas de exclusão pendente
    const rowsToSync: any[] = []
    const now = new Date().toISOString()

    for (const id of Array.from(targetStudentIds)) {
      for (const dev of devices) {
        rowsToSync.push({
          aluno_id: id,
          dispositivo_id: dev.id,
          status: 'pendente',
          erro_detalhe: 'Exclusão de inativo/removido solicitada pelo administrador',
          updated_at: now
        })
      }
    }

    // Upsert em lotes de 200
    const chunkSize = 200
    for (let i = 0; i < rowsToSync.length; i += chunkSize) {
      const chunk = rowsToSync.slice(i, i + chunkSize)
      const { error: upsertErr } = await supabase.from('portaria_sync').upsert(chunk, { onConflict: 'aluno_id,dispositivo_id' })
      if (upsertErr) console.error('[Purge Queue Enqueue Error]', upsertErr.message)
    }

    return NextResponse.json({
      success: true,
      message: `${targetStudentIds.size} alunos inativos/removidos enfileirados para exclusão das catracas com sucesso!`,
      total_operacoes: rowsToSync.length
    })
  } catch (err: any) {
    console.error('[Sync Queue DELETE Error]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
