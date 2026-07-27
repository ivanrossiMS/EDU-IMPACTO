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
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dispositivoId = searchParams.get('dispositivo_id')
    const limitParam = parseInt(searchParams.get('limit') || '100', 10)

    let query = supabase
      .from('portaria_sync')
      .select('aluno_id, dispositivo_id, status, erro_detalhe, updated_at', { count: 'exact' })
      .eq('status', 'pendente')
      .order('updated_at', { ascending: true })

    if (dispositivoId) {
      query = query.eq('dispositivo_id', dispositivoId)
    }

    const { data: pendingRows, error: pendingErr, count } = await query.limit(limitParam)
    if (pendingErr) throw pendingErr

    if (!pendingRows || pendingRows.length === 0) {
      return NextResponse.json({ pendentes: [], total: count || 0 })
    }

    const alunoIds = Array.from(new Set(pendingRows.map(r => r.aluno_id)))

    // Buscar dados dos alunos correspondentes às pendências (procurando por id ou matricula)
    const filterParts = alunoIds.map(id => `id.eq.${id},matricula.eq.${id}`).join(',')
    const { data: alunos, error: alunosErr } = await supabase
      .from('alunos')
      .select('id, nome, matricula, foto, status')
      .or(filterParts)

    if (alunosErr) throw alunosErr

    const alunosMap = new Map()
    for (const a of alunos || []) {
      alunosMap.set(String(a.id), a)
      if (a.matricula) alunosMap.set(String(a.matricula), a)
    }

    const result = pendingRows.map(row => {
      const a = alunosMap.get(row.aluno_id)
      const isActive = a ? ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'].includes(a.status) : false
      
      let acao = 'update'
      if (!a || !isActive) {
        acao = 'delete'
      }

      const codigo = a?.codigo || a?.matricula || row.aluno_id || ''
      const numericId = parseInt(String(codigo).replace(/\D/g, ''), 10)

      return {
        aluno_id: row.aluno_id,
        dispositivo_id: row.dispositivo_id,
        acao,
        numeric_id: isNaN(numericId) ? null : numericId,
        nome: a?.nome || '',
        matricula: codigo,
        foto: isValidStudentPhoto(a?.foto) ? a?.foto : null,
        status_aluno: a?.status || 'inativo',
        updated_at: row.updated_at
      }
    })

    return NextResponse.json({
      pendentes: result,
      total: count ?? result.length
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
    const body = await req.json()
    const { aluno_id, dispositivo_id, status, erro_detalhe, foto_enviada } = body

    if (!aluno_id || !dispositivo_id || !status) {
      return NextResponse.json({ error: 'aluno_id, dispositivo_id e status são obrigatórios' }, { status: 400 })
    }

    const { error: upsertErr } = await supabase.from('portaria_sync').upsert({
      aluno_id,
      dispositivo_id,
      status,
      ultima_sync: status === 'sincronizado' ? new Date().toISOString() : null,
      foto_enviada: foto_enviada ?? (status === 'sincronizado'),
      erro_detalhe: erro_detalhe || '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'aluno_id,dispositivo_id' })

    if (upsertErr) throw upsertErr

    // Atualizar status do dispositivo para online se enviou com sucesso
    if (status === 'sincronizado') {
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
  const { user, errorResponse } = await requireAuth()
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
      .in('status', ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'])

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
  const { user, errorResponse } = await requireAuth()
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

    // 2. Buscar alunos inativos ou desativados
    const { data: inativos } = await supabase
      .from('alunos')
      .select('id, matricula')
      .not('status', 'in', '("matriculado","cursando","ativo","Cursando","Matriculado","Ativo")')

    // 3. Buscar pendências ou registros no sync de alunos que não existem mais
    const { data: syncRows } = await supabase.from('portaria_sync').select('aluno_id')
    const { data: allAlunos } = await supabase.from('alunos').select('id, matricula')

    const existingStudentIds = new Set<string>()
    for (const a of allAlunos || []) {
      existingStudentIds.add(String(a.id))
      if (a.matricula) existingStudentIds.add(String(a.matricula))
    }

    const targetStudentIds = new Set<string>()
    for (const i of inativos || []) {
      targetStudentIds.add(String(i.id))
      if (i.matricula) targetStudentIds.add(String(i.matricula))
    }

    for (const row of syncRows || []) {
      if (!existingStudentIds.has(String(row.aluno_id))) {
        targetStudentIds.add(String(row.aluno_id))
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
