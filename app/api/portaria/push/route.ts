import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidStudentPhoto } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/portaria/push
 * POST /api/portaria/push
 *
 * Endpoint no formato oficial do ControlID Push Protocol.
 * O iDFace faz requests periódicas (heartbeat) a este endpoint.
 * O servidor responde com UMA transação por request no formato:
 * { "verb": "POST", "endpoint": "add_objects", "body": {...}, "contentType": "application/json" }
 *
 * Ref oficial: https://www.controlid.com.br/documentacao/push-protocol/
 */

async function handlePushRequest(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    // Identificar o dispositivo (serial vem como query param ou header ou body)
    let deviceSerial =
      searchParams.get('device_id') ||
      searchParams.get('deviceId') ||
      searchParams.get('serial') ||
      req.headers.get('x-device-id') ||
      req.headers.get('device-id') ||
      req.headers.get('x-serial') ||
      ''

    // Tentar ler do body se for POST
    if (!deviceSerial && req.method === 'POST') {
      try {
        const body = await req.clone().json().catch(() => ({}))
        deviceSerial = body.device_id || body.serial || body.deviceId || ''
      } catch {}
    }

    // Normalizar serial (suporta tanto / quanto -)
    const serialAlt = deviceSerial.includes('/')
      ? deviceSerial.replace('/', '-')
      : deviceSerial.replace('-', '/')

    // Resolver dispositivo no banco
    let dispositivoId = ''
    if (deviceSerial) {
      const { data: dev } = await supabase
        .from('portaria_dispositivos')
        .select('id, nome')
        .or(`id.eq.${deviceSerial},id.eq.${serialAlt},configuracao->>serial.eq.${deviceSerial},configuracao->>serial.eq.${serialAlt}`)
        .limit(1)
        .maybeSingle()

      if (dev) {
        dispositivoId = dev.id
        // Atualizar última comunicação
        await supabase
          .from('portaria_dispositivos')
          .update({ status: 'online', ultima_comunicacao: new Date().toISOString() })
          .eq('id', dispositivoId)
      }
    }

    // Se não identificou por serial, tentar por IP
    if (!dispositivoId) {
      const xForwardedFor = req.headers.get('x-forwarded-for')
      const clientIp = (xForwardedFor ? xForwardedFor.split(',')[0].trim() : '').replace(/^::ffff:/, '')
      if (clientIp && clientIp !== '127.0.0.1') {
        const { data: devByIp } = await supabase
          .from('portaria_dispositivos')
          .select('id, nome')
          .eq('ip', clientIp)
          .limit(1)
          .maybeSingle()
        if (devByIp) {
          dispositivoId = devByIp.id
          await supabase
            .from('portaria_dispositivos')
            .update({ status: 'online', ultima_comunicacao: new Date().toISOString() })
            .eq('id', dispositivoId)
        }
      }
    }

    // Sem dispositivo identificado → resposta vazia (protocolo Push)
    if (!dispositivoId) {
      return new NextResponse('', { status: 200 })
    }

    // Buscar a PRÓXIMA pendência para este dispositivo (1 por request = protocolo Push)
    const altDevId = dispositivoId.includes('/')
      ? dispositivoId.replace('/', '-')
      : dispositivoId.replace('-', '/')

    const { data: pending } = await supabase
      .from('portaria_sync')
      .select('aluno_id, dispositivo_id, status, erro_detalhe')
      .eq('status', 'pendente')
      .or(`dispositivo_id.eq.${dispositivoId},dispositivo_id.eq.${altDevId}`)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!pending || pending.length === 0) {
      // Sem pendências: resposta vazia (protocolo Push)
      return new NextResponse('', { status: 200 })
    }

    const row = pending[0]

    // Buscar dados do aluno
    const { data: aluno } = await supabase
      .from('alunos')
      .select('id, nome, matricula, codigo, foto, status')
      .or(`id.eq.${row.aluno_id},matricula.eq.${row.aluno_id}`)
      .maybeSingle()

    // Calcular ID numérico para a catraca
    const codigoStr = aluno?.matricula || aluno?.codigo || String(aluno?.id || row.aluno_id)
    const numId = parseInt(String(codigoStr).replace(/\D/g, ''), 10)

    // Marcar como sincronizado
    let upd = supabase
      .from('portaria_sync')
      .update({ status: 'sincronizado', ultima_sync: new Date().toISOString(), erro_detalhe: null, updated_at: new Date().toISOString() })
      .eq('aluno_id', String(row.aluno_id))
    if (row.dispositivo_id) upd = upd.eq('dispositivo_id', String(row.dispositivo_id))
    await upd

    if (isNaN(numId) || numId <= 0) {
      return new NextResponse('', { status: 200 })
    }

    const isActive = aluno && ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'].includes(aluno.status)
    const isDeleteRequest = row.erro_detalhe?.toLowerCase().includes('exclus') || row.erro_detalhe?.toLowerCase().includes('remov')

    if (isDeleteRequest || (!isActive && aluno)) {
      // REMOVER usuário inativo
      return NextResponse.json({
        verb: 'POST',
        endpoint: 'destroy_objects',
        body: { object: 'users', where: { users: { id: numId } } },
        contentType: 'application/json'
      })
    }

    // ADICIONAR/ATUALIZAR usuário ativo
    const nameStr = aluno?.nome ? aluno.nome.substring(0, 30) : `Aluno ${numId}`
    const regStr = String(numId)

    return NextResponse.json({
      verb: 'POST',
      endpoint: 'add_objects',
      body: {
        object: 'users',
        values: [{ id: numId, name: nameStr, registration: regStr }]
      },
      contentType: 'application/json'
    })
  } catch (err: any) {
    console.error('[Push Route Error]', err.message)
    return new NextResponse('', { status: 200 })
  }
}

export async function GET(req: Request) {
  return handlePushRequest(req)
}

export async function POST(req: Request) {
  return handlePushRequest(req)
}
