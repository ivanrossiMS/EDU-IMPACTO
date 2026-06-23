/**
 * POST /api/portaria/configurar-monitor
 * Configura TODOS os dispositivos iDFace para enviar push events (Monitor)
 * para o webhook do Netlify automaticamente.
 *
 * Deve ser chamado UMA VEZ após o deploy, ou sempre que um novo dispositivo for adicionado.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // URL base do sistema (Netlify ou outra)
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `https://${req.headers.get('host')}`

    const webhookUrl = `${appUrl}/api/portaria/webhook`

    // Busca todos os dispositivos cadastrados
    const { data: devices, error: devErr } = await supabase
      .from('portaria_dispositivos')
      .select('*')

    if (devErr || !devices || devices.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum dispositivo encontrado.' },
        { status: 404 }
      )
    }

    const results: any[] = []

    for (const device of devices) {
      if (!device.ip) {
        results.push({ id: device.id, nome: device.nome, status: 'ignorado', motivo: 'Sem IP configurado' })
        continue
      }

      const cfg = (device.configuracao as any) || {}
      const client = new ControliDClient({
        ip: device.ip,
        port: device.porta || 80,
        login: cfg.login || 'admin',
        password: cfg.password || cfg.senha || 'admin',
      })

      try {
        await client.setMonitorConfig(webhookUrl)
        results.push({ id: device.id, nome: device.nome, status: 'ok', webhookUrl })

        // Salva a URL configurada no registro do dispositivo
        await supabase
          .from('portaria_dispositivos')
          .update({
            configuracao: {
              ...cfg,
              monitor_webhook_url: webhookUrl,
              monitor_configurado_em: new Date().toISOString(),
            },
          })
          .eq('id', device.id)
      } catch (err: any) {
        results.push({ id: device.id, nome: device.nome, status: 'erro', motivo: err.message })
      }
    }

    const ok = results.filter(r => r.status === 'ok').length
    const erros = results.filter(r => r.status === 'erro').length

    return NextResponse.json({
      ok: true,
      webhookUrl,
      resumo: `${ok} configurado(s) com sucesso, ${erros} erro(s)`,
      dispositivos: results,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
