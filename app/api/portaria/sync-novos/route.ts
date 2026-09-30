import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

/**
 * Função utilitária para buscar usuários cadastrados em uma catraca com fallback seguro.
 */
async function getCatracaUsers(dev: any): Promise<{ devId: string; users: any[]; online: boolean; error?: string }> {
  if (!dev?.ip) {
    return { devId: dev.id, users: [], online: false, error: 'Dispositivo sem IP' }
  }

  const client = new ControliDClient({
    ip: dev.ip,
    port: dev.porta || 80,
    login: dev.configuracao?.login || 'admin',
    password: dev.configuracao?.password || 'Pass1081$'
  })

  try {
    const res = await client.loadUsers()
    const users = Array.isArray(res) ? res : Array.isArray(res?.users) ? res.users : []
    return { devId: dev.id, users, online: true }
  } catch (err: any) {
    return { devId: dev.id, users: [], online: false, error: err.message }
  }
}

/**
 * GET /api/portaria/sync-novos
 * Analisa as catracas físicas e o ERP para identificar alunos ativos que NÃO existem nas catracas.
 */
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req)
  if (errorResponse) return errorResponse

  try {
    // 1. Buscar todos os dispositivos cadastrados
    const { data: devices, error: devErr } = await supabase
      .from('portaria_dispositivos')
      .select('id, nome, ip, porta, modelo, status, configuracao')

    if (devErr) throw devErr
    if (!devices || devices.length === 0) {
      return NextResponse.json({ error: 'Nenhum leitor iDFace cadastrado.' }, { status: 400 })
    }

    // 2. Buscar todos os alunos ativos no ERP
    const { data: activeStudents, error: alunoErr } = await supabase
      .from('alunos')
      .select('id, nome, matricula, foto, dados, status')
      .or('status.neq.inativo,status.is.null')

    if (alunoErr) throw alunoErr
    const totalAtivosErp = activeStudents?.length || 0

    // 3. Consultar a lista de usuários em todas as catracas em paralelo
    const catracaResults = await Promise.all(devices.map(d => getCatracaUsers(d)))

    // Mapeamento de usuários por dispositivo
    // Se a catraca física não responder (ex: acesso remoto), usa histórico de portaria_sync com fallback
    const { data: syncedHistory } = await supabase
      .from('portaria_sync')
      .select('aluno_id, dispositivo_id')
      .eq('status', 'sincronizado')

    const dbSyncedMap = new Map<string, Set<string>>()
    for (const h of syncedHistory || []) {
      if (!dbSyncedMap.has(h.dispositivo_id)) {
        dbSyncedMap.set(h.dispositivo_id, new Set())
      }
      dbSyncedMap.get(h.dispositivo_id)!.add(String(h.aluno_id))
    }

    const deviceUsersMap = new Map<string, { existingIds: Set<number>; existingRegs: Set<string>; online: boolean }>()

    for (const cr of catracaResults) {
      const existingIds = new Set<number>()
      const existingRegs = new Set<string>()

      if (cr.online && cr.users.length > 0) {
        for (const u of cr.users) {
          if (u.id) existingIds.add(Number(u.id))
          if (u.registration) existingRegs.add(String(u.registration).trim())
        }
      } else {
        // Fallback para histórico do banco se a catraca estiver inacessível no momento
        const fromDb = dbSyncedMap.get(cr.devId) || new Set()
        for (const idStr of fromDb) {
          const num = parseInt(idStr.replace(/\D/g, ''), 10)
          if (!isNaN(num) && num > 0) existingIds.add(num)
          existingRegs.add(idStr)
        }
      }

      deviceUsersMap.set(cr.devId, { existingIds, existingRegs, online: cr.online })
    }

    // 4. Comparar alunos do ERP com as catracas
    const novosAlunos: any[] = []
    let totalOperacoes = 0

    for (const a of activeStudents || []) {
      let numericId: number | null = null
      if (a.matricula) {
        const parsed = parseInt(String(a.matricula).replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) numericId = parsed
      }
      if (!numericId && a.dados?.codigo) {
        const parsed = parseInt(String(a.dados.codigo).replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) numericId = parsed
      }
      if (!numericId) {
        const parsed = parseInt(String(a.id).replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) numericId = parsed
      }

      const missingDevices: any[] = []

      for (const dev of devices) {
        const devInfo = deviceUsersMap.get(dev.id)
        if (!devInfo) continue

        const exists = (numericId && devInfo.existingIds.has(numericId)) ||
                       (a.matricula && devInfo.existingRegs.has(String(a.matricula).trim())) ||
                       (a.id && devInfo.existingRegs.has(String(a.id).trim()))

        if (!exists) {
          missingDevices.push({
            id: dev.id,
            nome: dev.nome,
            ip: dev.ip,
            online: devInfo.online
          })
        }
      }

      if (missingDevices.length > 0) {
        novosAlunos.push({
          id: a.id,
          nome: a.nome,
          matricula: a.matricula || (numericId ? String(numericId) : ''),
          numeric_id: numericId,
          tem_foto: !!(a.foto && typeof a.foto === 'string' && a.foto.length > 50),
          missingDevices
        })
        totalOperacoes += missingDevices.length
      }
    }

    return NextResponse.json({
      novosAlunos,
      totalNovos: novosAlunos.length,
      totalOperacoes,
      totalAtivosErp,
      dispositivosVerificados: devices.map(d => ({
        id: d.id,
        nome: d.nome,
        ip: d.ip,
        online: deviceUsersMap.get(d.id)?.online ?? false,
        totalUsuariosNaCatraca: deviceUsersMap.get(d.id)?.existingIds.size || 0
      }))
    })
  } catch (err: any) {
    console.error('[Sync Novos GET Error]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/portaria/sync-novos
 * Enfileira e transmite diretamente para as catracas APENAS os alunos novos identificados.
 */
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req)
  if (errorResponse) return errorResponse

  try {
    const body = await req.json().catch(() => ({}))
    const selectedAlunoIds: string[] | undefined = body.alunoIds

    // 1. Buscar dispositivos cadastrados
    const { data: devices, error: devErr } = await supabase
      .from('portaria_dispositivos')
      .select('id, nome, ip, porta, modelo, status, configuracao')
    if (devErr) throw devErr
    if (!devices || devices.length === 0) {
      return NextResponse.json({ error: 'Nenhum leitor cadastrado' }, { status: 400 })
    }

    // 2. Buscar alunos ativos no ERP
    let alunosQuery = supabase
      .from('alunos')
      .select('id, nome, matricula, foto, dados, status')
      .or('status.neq.inativo,status.is.null')

    if (selectedAlunoIds && selectedAlunoIds.length > 0) {
      alunosQuery = alunosQuery.in('id', selectedAlunoIds)
    }

    const { data: activeStudents, error: alunoErr } = await alunosQuery
    if (alunoErr) throw alunoErr
    if (!activeStudents || activeStudents.length === 0) {
      return NextResponse.json({ message: 'Nenhum aluno ativo para sincronizar.', count: 0 })
    }

    // 3. Buscar usuários atuais nas catracas físicas
    const catracaResults = await Promise.all(devices.map(d => getCatracaUsers(d)))
    const deviceUsersMap = new Map<string, { existingIds: Set<number>; existingRegs: Set<string>; online: boolean; client: ControliDClient | null }>()

    for (const cr of catracaResults) {
      const dev = devices.find(d => d.id === cr.devId)
      const existingIds = new Set<number>()
      const existingRegs = new Set<string>()

      if (cr.online && cr.users.length > 0) {
        for (const u of cr.users) {
          if (u.id) existingIds.add(Number(u.id))
          if (u.registration) existingRegs.add(String(u.registration).trim())
        }
      }

      let client: ControliDClient | null = null
      if (dev?.ip) {
        client = new ControliDClient({
          ip: dev.ip,
          port: dev.porta || 80,
          login: dev.configuracao?.login || 'admin',
          password: dev.configuracao?.password || 'Pass1081$'
        })
      }

      deviceUsersMap.set(cr.devId, { existingIds, existingRegs, online: cr.online, client })
    }

    // 4. Filtrar estritamente quem NÃO existe nas catracas
    const rowsToSync: any[] = []
    const now = new Date().toISOString()
    const directOperations: Array<{
      aluno: any;
      numericId: number;
      dev: any;
      client: ControliDClient | null;
    }> = []

    for (const a of activeStudents) {
      let numericId: number | null = null
      if (a.matricula) {
        const parsed = parseInt(String(a.matricula).replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) numericId = parsed
      }
      if (!numericId && a.dados?.codigo) {
        const parsed = parseInt(String(a.dados.codigo).replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) numericId = parsed
      }
      if (!numericId) {
        const parsed = parseInt(String(a.id).replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) numericId = parsed
      }

      if (!numericId || numericId <= 0) continue

      for (const dev of devices) {
        const devInfo = deviceUsersMap.get(dev.id)
        if (!devInfo) continue

        const exists = (numericId && devInfo.existingIds.has(numericId)) ||
                       (a.matricula && devInfo.existingRegs.has(String(a.matricula).trim())) ||
                       (a.id && devInfo.existingRegs.has(String(a.id).trim()))

        if (!exists) {
          rowsToSync.push({
            aluno_id: a.id,
            dispositivo_id: dev.id,
            status: 'pendente',
            erro_detalhe: 'Cadastro de aluno novo inexistente na catraca',
            updated_at: now
          })

          directOperations.push({
            aluno: a,
            numericId,
            dev,
            client: devInfo.online ? devInfo.client : null
          })
        }
      }
    }

    if (rowsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Todos os alunos selecionados já estão cadastrados nas catracas físicas. Nenhum aluno novo pendente.',
        novosCadastrados: 0
      })
    }

    // 5. Salva na fila no banco
    const chunkSize = 200
    for (let i = 0; i < rowsToSync.length; i += chunkSize) {
      const chunk = rowsToSync.slice(i, i + chunkSize)
      await supabase.from('portaria_sync').upsert(chunk, { onConflict: 'aluno_id,dispositivo_id' })
    }

    // 6. Transmite em tempo real para os leitores que estiverem online
    let transmittedDirectly = 0
    for (const op of directOperations) {
      if (op.client) {
        try {
          // Cria usuário na catraca física
          await op.client.createUser(
            op.numericId,
            op.aluno.nome?.slice(0, 30) || `Aluno ${op.numericId}`,
            op.aluno.matricula || String(op.numericId)
          )

          // Transmite foto facial se disponível
          if (op.aluno.foto && typeof op.aluno.foto === 'string' && op.aluno.foto.length > 50) {
            try {
              await op.client.setUserImage(op.numericId, op.aluno.foto)
            } catch {}
          }

          // Marca como sincronizado no banco de dados
          await supabase
            .from('portaria_sync')
            .update({
              status: 'sincronizado',
              ultima_sync: new Date().toISOString(),
              foto_enviada: !!op.aluno.foto,
              erro_detalhe: null,
              updated_at: new Date().toISOString()
            })
            .eq('aluno_id', op.aluno.id)
            .eq('dispositivo_id', op.dev.id)

          transmittedDirectly++
        } catch (catErr: any) {
          console.warn(`[Sync Novos] Erro ao cadastrar aluno ${op.aluno.nome} na catraca ${op.dev.nome}: ${catErr.message}`)
        }
      }
    }

    const uniqueStudentsCount = new Set(rowsToSync.map(r => r.aluno_id)).size

    return NextResponse.json({
      success: true,
      message: `${uniqueStudentsCount} aluno(s) novo(s) processado(s) (${transmittedDirectly} gravações físicas diretas concluídas com sucesso)!`,
      novosCadastrados: uniqueStudentsCount,
      totalOperacoes: rowsToSync.length,
      transmittedDirectly
    })
  } catch (err: any) {
    console.error('[Sync Novos POST Error]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
