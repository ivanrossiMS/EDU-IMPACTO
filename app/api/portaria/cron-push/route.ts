import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/portaria/cron-push
 * Cron job do Vercel (roda a cada minuto via vercel.json).
 *
 * ⚠️ ARQUITETURA IMPORTANTE:
 * Este cron roda na NUVEM (Vercel/Netlify) e NÃO tem acesso aos IPs locais das catracas
 * (192.168.1.x). Tentar conectar diretamente resulta em timeout garantido.
 *
 * O fluxo correto de sincronização nas catracas é feito por:
 *   1. Push Protocol iDFace: a catraca faz POST no webhook a cada heartbeat e recebe
 *      comandos (add_objects / destroy_objects) na resposta — AUTOMÁTICO.
 *   2. Script Local: Sincronizar_Catraca.py rodando na rede local da escola.
 *
 * Este cron tem as seguintes responsabilidades VÁLIDAS:
 *   a) Monitorar a fila portaria_sync e logar pendências antigas (>30 min sem resolver)
 *   b) Marcar dispositivos como offline se não comunicaram há mais de 10 min
 *   c) Emitir alertas no log para o time de operações
 */
export async function GET(req: Request) {
  // Verificar se é uma chamada autorizada do Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    // Permitir chamadas locais de teste sem secret
    const host = req.headers.get('host') || ''
    if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const now = new Date()

    // ─── 1. Monitorar dispositivos: marcar offline se não comunicaram há >10 min ────
    const offlineThreshold = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    const { data: devices } = await supabase
      .from('portaria_dispositivos')
      .select('id, nome, status, ultima_comunicacao')

    const deviceStatus: any[] = []
    for (const dev of devices || []) {
      const ultimaComm = dev.ultima_comunicacao ? new Date(dev.ultima_comunicacao) : null
      const estaOffline = !ultimaComm || ultimaComm.toISOString() < offlineThreshold

      if (estaOffline && dev.status !== 'offline') {
        await supabase
          .from('portaria_dispositivos')
          .update({ status: 'offline' })
          .eq('id', dev.id)
        console.warn(`[Cron Portaria] Dispositivo "${dev.nome}" marcado como OFFLINE (última comunicação: ${dev.ultima_comunicacao || 'nunca'})`)
        deviceStatus.push({ device: dev.nome, action: 'marcado_offline', ultima_comunicacao: dev.ultima_comunicacao })
      } else {
        deviceStatus.push({ device: dev.nome, status: dev.status, ultima_comunicacao: dev.ultima_comunicacao })
      }
    }

    // ─── 2. Monitorar fila: detectar pendências antigas (>30 min) e logar alertas ───
    const staleThreshold = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
    const { data: stalePending, count: staleCount } = await supabase
      .from('portaria_sync')
      .select('aluno_id, dispositivo_id, updated_at', { count: 'exact' })
      .eq('status', 'pendente')
      .lt('updated_at', staleThreshold)

    if (staleCount && staleCount > 0) {
      console.warn(
        `[Cron Portaria] ⚠️ ${staleCount} sincronização(ões) PENDENTE(S) há mais de 30 minutos. ` +
        `Verifique se as catracas estão enviando heartbeat ao webhook (/api/portaria/webhook) ` +
        `e se o Sincronizar_Catraca.py está rodando na rede local.`
      )
    }

    // ─── 3. Contar total de pendências ativas ───────────────────────────────────────
    const { count: totalPendente } = await supabase
      .from('portaria_sync')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente')

    const summary = {
      status: 'ok',
      timestamp: now.toISOString(),
      dispositivos: deviceStatus,
      fila: {
        pendentes_total: totalPendente ?? 0,
        pendentes_antigos_30min: staleCount ?? 0,
        nota: staleCount && staleCount > 0
          ? 'Execute Sincronizar_Catraca.py na rede local ou verifique o Push Protocol das catracas'
          : 'Fila saudável'
      }
    }

    console.log('[Cron Portaria] Verificação concluída:', JSON.stringify(summary))
    return NextResponse.json(summary)
  } catch (err: any) {
    console.error('[Cron Push Error]', err.message)
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 })
  }
}
