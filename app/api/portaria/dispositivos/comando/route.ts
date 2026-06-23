import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function isLocalIp(ip: string) {
  return /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|localhost)/.test(ip)
}

/**
 * POST /api/portaria/dispositivos/comando
 * Executa comandos remotos e diagnósticos em tempo real no hardware iDFace.
 * Body: { dispositivo_id: string, comando: string, webhookUrl?: string }
 */
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await req.json().catch(() => ({}))
    const { dispositivo_id, comando } = body
    let targetDeviceId = dispositivo_id

    if (!targetDeviceId) {
      return NextResponse.json({ error: 'dispositivo_id é obrigatório.' }, { status: 400 })
    }

    if (!comando) {
      return NextResponse.json({ error: 'comando é obrigatório.' }, { status: 400 })
    }

    // 1. Buscar detalhes do dispositivo
    const { data: device, error: devErr } = await supabase
      .from('portaria_dispositivos')
      .select('*')
      .eq('id', targetDeviceId)
      .single()

    if (devErr || !device) {
      return NextResponse.json({ error: 'Dispositivo iDFace não encontrado.' }, { status: 404 })
    }

    if (!device.ip) {
      return NextResponse.json({ error: 'Endereço IP do dispositivo não configurado.' }, { status: 400 })
    }

    const isLocal = isLocalIp(device.ip)

    // Se a catraca está na rede local, comandos remotos não funcionam pela nuvem (Netlify).
    if (isLocal) {
      if (comando === 'ping') {
        // Ping passivo: checa apenas se mandou evento recente (últimos 15 min)
        const lastComm = device.ultima_comunicacao ? new Date(device.ultima_comunicacao) : null
        const now = new Date()
        
        if (lastComm && (now.getTime() - lastComm.getTime() < 15 * 60 * 1000)) {
          return NextResponse.json({ 
            success: true, 
            result: { online: true, info: { serial: device.id, msg: 'Ping Passivo: Catraca enviou sinal há pouco tempo' } } 
          })
        } else {
          return NextResponse.json({ 
            error: 'Sem comunicação nos últimos 15 min. Impossível verificar status em tempo real pois o IP é Local (192.168.x.x).' 
          }, { status: 400 })
        }
      } else {
        // Outros comandos
        return NextResponse.json({ 
          error: 'IP Privado detectado. A nuvem não pode enviar comandos para a rede local da escola. Use o script Sincronizar_Catraca.py para configurações.' 
        }, { status: 400 })
      }
    }

    // 2. Inicializar cliente iDFace (somente para IPs Públicos)
    const client = new ControliDClient({
      ip: device.ip,
      port: device.porta || 443,
      login: (device.configuracao as any)?.login || 'admin',
      password: (device.configuracao as any)?.password || 'admin',
    })

    let result: any = null

    // 3. Executar o comando correspondente
    switch (comando) {
      case 'abrir_catraca':
        result = await client.openDoor()
        break

      case 'reiniciar':
        result = await client.reboot()
        break

      case 'sync_relogio':
        result = await client.setSystemTime(new Date())
        break

      case 'config_webhook': {
        // Resolve a URL de webhook do ERP automaticamente
        let host = req.headers.get('host') || 'localhost:3000'
        
        // Se estiver rodando localmente (localhost), pegar o IP real da máquina na rede para que a catraca consiga acessar
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
          const { networkInterfaces } = require('os')
          const nets = networkInterfaces()
          let localIp = 'localhost'
          for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
              if (net.family === 'IPv4' && !net.internal) {
                localIp = net.address
                break
              }
            }
            if (localIp !== 'localhost') break
          }
          host = host.replace(/localhost|127\.0\.0\.1/, localIp)
        }

        const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : (req.headers.get('x-forwarded-proto') || 'http')
        let baseAppUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
        baseAppUrl = baseAppUrl.replace(/\/$/, '')
        const defaultWebhook = `${baseAppUrl}/api/portaria/webhook`
        const baseWebhook = body.webhookUrl || defaultWebhook
        
        // Buscar se existe token de segurança configurado
        const { data: configRes } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'portaria_config')
          .maybeSingle()
        
        const token = configRes?.valor?.token_seguranca_webhook || ''
        const finalWebhook = token ? `${baseWebhook}?token=${token}` : baseWebhook
        
        result = await client.setMonitorConfig(finalWebhook)
        break
      }

      case 'ping': {
        const info = await client.getDeviceInfo()
        result = { online: info.online, info }

        if (info.online && info.serial) {
          const currentConfig = (device.configuracao as any) || {}
          const newConfig = { ...currentConfig, serial: info.serial }

          // Se o ID atual for UUID (ex: tem hífen), tentar migrar para o serial físico
          if (device.id.includes('-')) {
            try {
              const { error: updateIdErr } = await supabase
                .from('portaria_dispositivos')
                .update({
                  id: info.serial,
                  configuracao: newConfig,
                  status: 'online',
                  ultima_comunicacao: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', device.id)

              if (!updateIdErr) {
                console.log(`[iDFace Comando Ping] ID atualizado com sucesso de ${device.id} para ${info.serial}`)
                targetDeviceId = info.serial
              } else {
                console.warn('[iDFace Comando Ping] Falha ao migrar ID de dispositivo, salvando apenas na config:', updateIdErr.message)
                await supabase
                  .from('portaria_dispositivos')
                  .update({
                    configuracao: newConfig,
                    status: 'online',
                    ultima_comunicacao: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', device.id)
              }
            } catch (err: any) {
              console.warn('[iDFace Comando Ping] Exceção ao migrar ID:', err.message)
            }
          } else {
            await supabase
              .from('portaria_dispositivos')
              .update({
                configuracao: newConfig,
                status: 'online',
                ultima_comunicacao: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', device.id)
          }
        }
        break
      }

      default:
        return NextResponse.json({ error: `Comando '${comando}' inválido ou não suportado.` }, { status: 400 })
    }

    // 4. Se a ação funcionou, atualiza o status do dispositivo como online no banco de dados
    await supabase.from('portaria_dispositivos').update({
      status: 'online',
      ultima_comunicacao: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', targetDeviceId)

    return NextResponse.json({ success: true, result })
  } catch (err: any) {
    console.error('[iDFace Command Error]', err.message)
    return NextResponse.json({ error: `Erro ao executar comando: ${err.message}` }, { status: 500 })
  }
}
