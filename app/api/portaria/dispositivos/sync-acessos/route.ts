import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'
import { POST as webhookPOST } from '../../webhook/route'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/portaria/dispositivos/sync-acessos
 * Sincroniza logs de acesso da memória física da catraca para o ERP.
 * 
 * Comportamento:
 * - Busca TODOS os logs da catraca no período solicitado
 * - Mostra o total encontrado na catraca
 * - Insere APENAS os registros que ainda NÃO existem no sistema (dedup por eventId determinístico)
 * - Retorna ao final: total na catraca, já existentes, novos inseridos
 */
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(req.url)
  const dispositivoId = searchParams.get('id')
  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')

  // Ler as datas do corpo da requisição
  const body = await req.json().catch(() => ({}))
  const startDateStr = body.startDate
  const endDateStr = body.endDate

  let timeFilter: any = {}
  if (startDateStr && endDateStr) {
    const startT = Math.floor(new Date(`${startDateStr}T00:00:00-03:00`).getTime() / 1000)
    const endT = Math.floor(new Date(`${endDateStr}T23:59:59-03:00`).getTime() / 1000)
    timeFilter = { ">=": startT, "<=": endT }
  } else {
    const timestamp = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60)
    timeFilter = { ">": timestamp }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + '\n'))
      }

      try {
        const { data: configRes } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'portaria_config')
          .maybeSingle()

        const config = configRes?.valor || {}
        const configuredToken = config.token_seguranca_webhook || ''
        const webhookUrl = `${protocol}://${host}/api/portaria/webhook${configuredToken ? '?token=' + configuredToken : ''}`

        let query = supabase.from('portaria_dispositivos').select('*').eq('status', 'online')
        if (dispositivoId) {
          query = query.eq('id', dispositivoId)
        }
        const { data: devices, error: devErr } = await query

        if (devErr || !devices || devices.length === 0) {
          send({ status: 'error', error: 'Nenhum dispositivo online encontrado.' })
          controller.close()
          return
        }

        const isLocalIp = (ip: string) => /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|localhost)/.test(ip)
        
        const allLocal = devices.every(d => d.ip && isLocalIp(d.ip))
        const hasLocal = devices.some(d => d.ip && isLocalIp(d.ip))
        const forceLocal = body.forceLocal === true
        
        if (!forceLocal) {
          if (dispositivoId && hasLocal) {
            send({ status: 'error', error: 'IP Privado detectado. A nuvem não pode baixar logs da rede local da escola. Use a opção 1 do Sincronizar_Catraca.sh (ou .py) no computador da portaria, ou marque a opção "Estou na rede local".' })
            controller.close()
            return
          } else if (allLocal) {
            send({ status: 'error', error: 'IPs Privados detectados nas catracas. A nuvem não pode baixar logs da rede local da escola. Use a opção 1 do Sincronizar_Catraca.sh (ou .py) no computador da portaria, ou marque a opção "Estou na rede local".' })
            controller.close()
            return
          }
        }

        // ── ETAPA 1: Buscar todos os logs da catraca ──────────────────────────────
        send({ status: 'fetching', message: 'Buscando registros na memória da catraca...' })

        let allLogs: any[] = []
        let deviceErrors: string[] = []
        for (const device of devices) {
          const targetIp = device.configuracao?.url_externa || device.configuracao?.ip_externo || device.ip
          const targetPort = device.configuracao?.porta_externa || device.porta || 443
          if (!targetIp) continue;

          const loginParams = device.configuracao as any || {};
          try {
            const client = new ControliDClient({
              ip: targetIp,
              port: targetPort,
              login: loginParams.login || 'admin',
              password: loginParams.password || 'admin',
            })
            await client.authenticate()

            const protocol = targetPort === 80 ? 'http' : 'https'
            const cleanIp = targetIp.replace(/^https?:\/\//i, '')
            const baseUrl = `${protocol}://${cleanIp}:${targetPort}`
            
            let lastId = 0
            let keepFetching = true
            let deviceLogs: any[] = []
            
            while (keepFetching) {
              const res = await fetch(`${baseUrl}/load_objects.fcgi`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Cookie: `session=${(client as any).session}`
                },
                body: JSON.stringify({
                  object: "access_logs",
                  where: { access_logs: { time: timeFilter, id: { ">": lastId } } },
                  limit: 1000
                })
              })

              if (res.ok) {
                const data = await res.json()
                const logs = data.access_logs || []
                
                if (logs.length > 0) {
                  deviceLogs = deviceLogs.concat(logs)
                  lastId = Math.max(...logs.map((l: any) => l.id))
                }
                
                if (logs.length < 1000) {
                  keepFetching = false
                }
              } else {
                console.error(`Erro buscando logs do dispositivo ${device.nome}: ${res.status}`)
                keepFetching = false
              }
            }

            // Aplicar o filtro de data localmente para garantir que o limitador funcionou perfeitamente
            if (startDateStr && endDateStr) {
               const startT = Math.floor(new Date(`${startDateStr}T00:00:00-03:00`).getTime() / 1000)
               const endT = Math.floor(new Date(`${endDateStr}T23:59:59-03:00`).getTime() / 1000)
               deviceLogs = deviceLogs.filter((l: any) => l.time >= startT && l.time <= endT)
            }

            allLogs = allLogs.concat(deviceLogs.map((l: any) => ({ ...l, device_id: device.id || l.device_id })))
          } catch (err: any) {
            console.error(`Erro conectando ao dispositivo ${device.nome}:`, err.message)
            deviceErrors.push(`Dispositivo "${device.nome}" (${targetIp}): ${err.message}`)
          }
        }

        const totalFromDevice = allLogs.length

        if (totalFromDevice === 0) {
          if (deviceErrors.length > 0) {
            const isCloudHost = !host.includes('localhost') && !host.includes('127.0.0.1') && !host.includes('192.168.') && !host.includes('10.')
            const hasLocalIps = devices.some(d => d.ip && isLocalIp(d.ip))
            
            if (isCloudHost && hasLocalIps) {
              send({
                status: 'error',
                error: `O servidor online (${host}) não consegue conectar aos IPs locais privados (${devices.map(d => `${d.nome} [${d.ip}]`).join(', ')}). A nuvem não tem acesso direto à rede local da escola. Para sincronizar estando no site online: utilize o script local 'Sincronizar_Catraca.py' no computador da escola ou configure um IP Público/DDNS.`
              })
            } else {
              send({
                status: 'error',
                error: `Falha de comunicação com as catracas: ${deviceErrors.join('; ')}`
              })
            }
            controller.close()
            return
          }

          send({ status: 'completed', total: 0, alreadyExisting: 0, newInserted: 0 })
          controller.close()
          return
        }

        // ── ETAPA 2: Calcular os IDs determinísticos de cada log ─────────────────
        // O mesmo algoritmo usado no webhook para gerar eventId
        type LogWithEventId = { log: any; eventId: string }
        const logsWithIds: LogWithEventId[] = allLogs.map((log) => {
          // Resolver dispositivo serial para o ID
          const deviceSerial = log.device_id || ''
          // Construir eventId determinístico igual ao webhook
          let eventId = ''
          if (log.id) {
            // Precisamos do dispositivoId resolvido — usaremos device_id direto aqui
            eventId = `idface-${deviceSerial}-${log.id}`
          } else {
            // Sem ID do log, não temos como deduplicar — será gerado uuid no webhook
            // Vamos usar um hash do conteúdo para evitar duplicados
            eventId = `idface-${deviceSerial}-${log.user_id || ''}-${log.time || ''}`
          }
          return { log, eventId }
        })

        // ── ETAPA 3: Verificar quais IDs já existem no Supabase ──────────────────
        send({ status: 'checking', total: totalFromDevice, message: 'Verificando registros já existentes no sistema...' })

        const eventIds = logsWithIds.map(x => x.eventId).filter(id => !id.includes('undefined') && id.length > 10)

        // Buscar em lotes de 500 para evitar limite de URL
        const BATCH_SIZE = 500
        const existingIds = new Set<string>()
        for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
          const chunk = eventIds.slice(i, i + BATCH_SIZE)
          const { data: existing } = await supabase
            .from('portaria_eventos')
            .select('id')
            .in('id', chunk)
          if (existing) {
            existing.forEach(r => existingIds.add(r.id))
          }
        }

        const alreadyExisting = existingIds.size
        const newLogs = logsWithIds.filter(x => !existingIds.has(x.eventId))
        const toInsert = newLogs.length

        // Emitir o resumo pré-processamento para a UI
        send({
          status: 'started',
          total: totalFromDevice,
          alreadyExisting,
          toInsert,
          processed: 0
        })

        if (toInsert === 0) {
          // Nenhum registro novo — tudo já existe
          send({
            status: 'completed',
            total: totalFromDevice,
            alreadyExisting,
            newInserted: 0
          })
          controller.close()
          return
        }

        // ── ETAPA 4: Inserir apenas os registros novos via webhook ───────────────
        let newInserted = 0
        for (const { log } of newLogs) {
          const webhookPayload = {
            object_changes: [
              {
                object: "access_logs",
                type: "inserted",
                values: log
              }
            ],
            device_id: log.device_id
          }

          const localReq = new NextRequest(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
          })
          await webhookPOST(localReq).catch((err: any) => {
            console.error('[Sync Acessos] Falha ao processar webhook interno', err)
          })

          newInserted++

          send({
            status: 'progress',
            total: totalFromDevice,
            alreadyExisting,
            toInsert,
            processed: newInserted
          })
        }

        send({
          status: 'completed',
          total: totalFromDevice,
          alreadyExisting,
          newInserted
        })
        controller.close()
      } catch (err: any) {
        send({ status: 'error', error: err.message })
        controller.close()
      }
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  })
}
