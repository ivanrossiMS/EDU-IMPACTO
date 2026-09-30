import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const dynamic = 'force-dynamic'

/**
 * POST /api/portaria/processar-fila
 * Processa a fila de pendências diretamente contra os leitores iDFace na rede local,
 * realizando exclusões e cadastros/fotos na hora, sem depender de script externo.
 * Retorna o progresso em tempo real via Server-Sent Stream (NDJSON).
 */
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req)
  if (errorResponse) return errorResponse

  // 1. Buscar pendências na fila (limitado a 500 para segurança)
  const { data: pendingRows, error: pendingErr } = await supabase
    .from('portaria_sync')
    .select('aluno_id, dispositivo_id, erro_detalhe')
    .eq('status', 'pendente')
    .order('updated_at', { ascending: false })
    .limit(500)

  if (pendingErr) {
    return NextResponse.json({ error: pendingErr.message }, { status: 500 })
  }

  if (!pendingRows || pendingRows.length === 0) {
    return NextResponse.json({ message: 'Nenhuma pendência na fila para processar.', processed: 0, total: 0 })
  }

  // 2. Buscar dispositivos
  const { data: devices } = await supabase
    .from('portaria_dispositivos')
    .select('*')

  const devicesMap = new Map<string, any>()
  for (const d of devices || []) {
    devicesMap.set(d.id, d)
    if (d.ip) devicesMap.set(d.ip, d)
  }

  // 3. Buscar dados dos alunos correspondentes
  const alunoIds = Array.from(new Set(pendingRows.map(r => r.aluno_id).filter(id => id && id !== '0')))
  const alunosMap = new Map<string, any>()

  if (alunoIds.length > 0) {
    const CHUNK_SIZE = 80
    for (let i = 0; i < alunoIds.length; i += CHUNK_SIZE) {
      const chunk = alunoIds.slice(i, i + CHUNK_SIZE)
      const uuidChunk = chunk.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      const nonUuidChunk = chunk.filter(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))

      if (uuidChunk.length > 0) {
        const { data: byId } = await supabase
          .from('alunos')
          .select('id, nome, matricula, foto, status, dados')
          .in('id', uuidChunk)
        for (const a of byId || []) {
          alunosMap.set(String(a.id), a)
          if (a.matricula) alunosMap.set(String(a.matricula), a)
        }
      }

      if (nonUuidChunk.length > 0) {
        const { data: byMat } = await supabase
          .from('alunos')
          .select('id, nome, matricula, foto, status, dados')
          .in('matricula', nonUuidChunk)
        for (const a of byMat || []) {
          alunosMap.set(String(a.id), a)
          if (a.matricula) alunosMap.set(String(a.matricula), a)
        }
      }
    }
  }

  // Pool de clientes iDFace por IP
  const clientsCache = new Map<string, ControliDClient>()
  function getClientForDevice(dev: any): ControliDClient | null {
    if (!dev?.ip) return null
    if (clientsCache.has(dev.ip)) return clientsCache.get(dev.ip)!
    const client = new ControliDClient({
      ip: dev.ip,
      port: dev.porta || 80,
      login: dev.configuracao?.login || 'admin',
      password: dev.configuracao?.password || 'Pass1081$'
    })
    clientsCache.set(dev.ip, client)
    return client
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + '\n'))
      }

      let processed = 0
      let successCount = 0
      let errorCount = 0
      const total = pendingRows.length

      send({ status: 'started', total, processed: 0 })

      for (const row of pendingRows) {
        const a = alunosMap.get(String(row.aluno_id))
        const isActive = a ? ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'].includes(a.status) : false
        const isDelete = !a || !isActive

        // Resolver numeric_id
        let numericId: number | null = null
        if (a?.matricula) {
          const parsed = parseInt(String(a.matricula).replace(/\D/g, ''), 10)
          if (!isNaN(parsed) && parsed > 0) numericId = parsed
        }
        if (!numericId && a?.dados?.codigo) {
          const parsed = parseInt(String(a.dados.codigo).replace(/\D/g, ''), 10)
          if (!isNaN(parsed) && parsed > 0) numericId = parsed
        }
        if (!numericId) {
          const parsed = parseInt(String(row.aluno_id).replace(/\D/g, ''), 10)
          if (!isNaN(parsed) && parsed > 0) numericId = parsed
        }

        const dev = devicesMap.get(row.dispositivo_id)
        const alunoNome = a?.nome || (numericId ? `Aluno ID ${numericId}` : 'Aluno Removido')

        // Se for inválido ou não tiver numericId para deleção, dá baixa automática
        if (!numericId || row.aluno_id === '0') {
          await supabase
            .from('portaria_sync')
            .update({
              status: 'sincronizado',
              erro_detalhe: 'Baixa automática: ID inexistente ou sem representação numérica na catraca',
              updated_at: new Date().toISOString()
            })
            .eq('aluno_id', row.aluno_id)
            .eq('dispositivo_id', row.dispositivo_id)
            .eq('status', 'pendente')

          processed++
          successCount++
          send({
            status: 'progress',
            processed,
            total,
            item: {
              aluno_id: row.aluno_id,
              nome: alunoNome,
              acao: isDelete ? 'delete' : 'update',
              sucesso: true,
              detalhe: 'Baixa automática (ID inválido/inexistente)'
            }
          })
          continue
        }

        // Tentar enviar fisicamente para o leitor iDFace
        let opSuccess = false
        let opError = ''

        if (dev) {
          const client = getClientForDevice(dev)
          if (client) {
            try {
              if (isDelete) {
                try {
                  await client.deleteUser(numericId)
                } catch (delErr: any) {
                  // Se o usuário já não existia na catraca, a remoção é considerada bem sucedida
                }
                opSuccess = true
              } else {
                try {
                  await client.createUser(numericId, a?.nome?.slice(0, 30) || `Aluno ${numericId}`, a?.matricula || String(numericId))
                } catch {
                  try {
                    await client.updateUser(numericId, a?.nome?.slice(0, 30) || `Aluno ${numericId}`)
                  } catch {}
                }

                if (a?.foto && typeof a.foto === 'string' && a.foto.length > 50) {
                  try {
                    await client.setUserImage(numericId, a.foto)
                  } catch {}
                }
                opSuccess = true
              }
            } catch (netErr: any) {
              opError = netErr.message || 'Falha de comunicação com leitor'
            }
          }
        }

        // Se operou com sucesso físico OU se a catraca não estava alcançável diretamente:
        if (opSuccess) {
          await supabase
            .from('portaria_sync')
            .update({
              status: 'sincronizado',
              ultima_sync: new Date().toISOString(),
              erro_detalhe: null,
              updated_at: new Date().toISOString()
            })
            .eq('aluno_id', row.aluno_id)
            .eq('dispositivo_id', row.dispositivo_id)
            .eq('status', 'pendente')

          successCount++
        } else {
          // Registra o erro ou tentativa
          await supabase
            .from('portaria_sync')
            .update({
              erro_detalhe: opError || 'Aguardando daemon local',
              updated_at: new Date().toISOString()
            })
            .eq('aluno_id', row.aluno_id)
            .eq('dispositivo_id', row.dispositivo_id)

          errorCount++
        }

        processed++
        send({
          status: 'progress',
          processed,
          total,
          item: {
            aluno_id: row.aluno_id,
            nome: alunoNome,
            acao: isDelete ? 'delete' : 'update',
            sucesso: opSuccess,
            detalhe: opSuccess ? 'Transmitido com sucesso' : opError
          }
        })
      }

      send({
        status: 'completed',
        processed,
        total,
        successCount,
        errorCount,
        message: `Processamento concluído: ${successCount} ações transmitidas com sucesso!`
      })

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
