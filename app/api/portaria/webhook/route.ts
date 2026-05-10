import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/portaria/webhook
 * Endpoint PÚBLICO que recebe eventos push do equipamento iDFace.
 * O iDFace envia POST automáticos quando reconhece uma face.
 * NUNCA retornar erro HTTP (para não perder eventos).
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}))

    const userId = payload.user_id || payload.userId || payload.id || ''
    const eventTime = payload.time || payload.timestamp || new Date().toISOString()
    const eventType = payload.event_type || payload.type || 'entrada'
    const deviceSerial = payload.device_id || payload.serial || ''

    // Tentar resolver o aluno pelo código do equipamento
    let alunoId: string | null = null
    let alunoNome = ''

    if (userId) {
      // Buscar na tabela de sync primeiro
      const { data: syncRecord } = await supabase
        .from('portaria_sync')
        .select('aluno_id')
        .eq('status', 'sincronizado')
        .limit(1)

      // Fallback: buscar direto pelo codigo do aluno
      if (!syncRecord || syncRecord.length === 0) {
        const { data: aluno } = await supabase
          .from('alunos')
          .select('id, nome')
          .or(`codigo.eq.${userId},matricula.eq.${userId}`)
          .limit(1)
          .single()

        if (aluno) {
          alunoId = aluno.id
          alunoNome = aluno.nome
        }
      } else {
        alunoId = syncRecord[0].aluno_id
        // Fetch nome
        const { data: aluno } = await supabase
          .from('alunos')
          .select('nome')
          .eq('id', alunoId)
          .single()
        alunoNome = aluno?.nome || ''
      }
    }

    // Resolver dispositivo
    let dispositivoId = ''
    let dispositivoNome = ''
    if (deviceSerial) {
      const { data: dev } = await supabase
        .from('portaria_dispositivos')
        .select('id, nome')
        .or(`id.eq.${deviceSerial},ip.eq.${deviceSerial}`)
        .limit(1)
        .single()

      if (dev) {
        dispositivoId = dev.id
        dispositivoNome = dev.nome
      }
    }

    // Se o dispositivo não foi identificado, usar o primeiro disponível
    if (!dispositivoId) {
      const { data: firstDev } = await supabase
        .from('portaria_dispositivos')
        .select('id, nome')
        .limit(1)
        .single()

      dispositivoId = firstDev?.id || 'unknown'
      dispositivoNome = firstDev?.nome || 'Desconhecido'
    }

    // Determinar status do evento
    const eventStatus = alunoId ? 'sucesso' : (userId ? 'inconsistencia' : 'falha')

    // Salvar evento — NUNCA falhar aqui
    await supabase.from('portaria_eventos').insert({
      id: crypto.randomUUID(),
      aluno_id: alunoId,
      aluno_nome: alunoNome,
      dispositivo_id: dispositivoId,
      dispositivo_nome: dispositivoNome,
      tipo: 'entrada',
      status: eventStatus,
      data_hora: eventTime,
      user_id_equipamento: String(userId),
      confianca: payload.score || payload.confidence || 0,
      foto_captura: payload.image || null,
      payload_raw: payload,
      unidade: payload.unidade || '',
    })

    // Atualizar última comunicação do dispositivo
    if (dispositivoId && dispositivoId !== 'unknown') {
      await supabase.from('portaria_dispositivos').update({
        status: 'online',
        ultima_comunicacao: new Date().toISOString(),
      }).eq('id', dispositivoId)
    }

    return NextResponse.json({ status: 'ok', evento: eventStatus })
  } catch (e: any) {
    // NUNCA retornar erro — loggar e retornar 200
    console.error('[Webhook Portaria Error]', e.message)
    return NextResponse.json({ status: 'ok', warning: 'internal_error_logged' })
  }
}
