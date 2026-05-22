import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'
import { POST as webhookPOST } from '../../webhook/route'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/portaria/dispositivos/sync-acessos
 * Sincroniza logs de acesso dos últimos 3 dias da memória física da catraca.
 */
export async function POST(req: NextRequest) {
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

        // Primeiro: buscar todos os logs da catraca
        let allLogs: any[] = []
        for (const device of devices) {
          if (!device.ip) continue;
          
          const loginParams = device.configuracao as any || {};
          try {
            const client = new ControliDClient({
              ip: device.ip,
              port: device.porta || 443,
              login: loginParams.login || 'admin',
              password: loginParams.password || 'admin',
            })
            await client.authenticate()
            
            const baseUrl = device.porta === 80 ? `http://${device.ip}:80` : `https://${device.ip}:${device.porta}`
            const res = await fetch(`${baseUrl}/load_objects.fcgi`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: `session=${(client as any).session}`
              },
              body: JSON.stringify({
                object: "access_logs",
                where: { access_logs: { time: timeFilter } }
              })
            })
            
            if (res.ok) {
              const data = await res.json()
              const logs = data.access_logs || []
              // Add device_id if missing to force it to right device
              allLogs = allLogs.concat(logs.map((l: any) => ({ ...l, device_id: device.id || l.device_id })))
            }
          } catch (err: any) {
            console.error(`Erro conectando ao dispositivo ${device.nome}:`, err.message)
          }
        }

        if (allLogs.length === 0) {
          send({ status: 'completed', total: 0, processed: 0 })
          controller.close()
          return
        }

        // Inicia o processamento com barra de progresso
        send({ status: 'started', total: allLogs.length, processed: 0 })

        let processedCount = 0
        for (const log of allLogs) {
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

          // Disparar via chamada direta do método POST (ignora falhas de fetch na rede local)
          const localReq = new NextRequest(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
          })
          await webhookPOST(localReq).catch((err: any) => {
             console.error('[Sync Acessos] Falha ao processar webhook interno', err)
          })
          
          processedCount++
          
          // Emit progress dynamically (every log, since we want smooth animation)
          send({ status: 'progress', total: allLogs.length, processed: processedCount })
        }

        send({ status: 'completed', total: allLogs.length, processed: processedCount })
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
