import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncPhotoFromDeviceToStudent } from '@/lib/portariaSync'
import { getTurmaSchedule, calcularFrequenciaDia, getFirstPresentTempoIndex } from '@/lib/frequenciaEngine'
import { isValidStudentPhoto } from '@/lib/utils'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/portaria/webhook
 * Endpoint PÚBLICO que recebe eventos push do equipamento iDFace.
 * O iDFace envia POST automáticos quando reconhece uma face.
 * NUNCA retornar erro HTTP (para não perder eventos).
 */
export async function POST(req: Request) {
  try {
    // 0. Validar token de segurança se estiver configurado no ERP
    const { searchParams } = new URL(req.url)
    const requestToken = searchParams.get('token') || ''

    const { data: configRes } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'portaria_config')
      .maybeSingle()

    const config = configRes?.valor || {}
    const configuredToken = config.token_seguranca_webhook || ''

    if (configuredToken && requestToken !== configuredToken) {
      console.warn('⚠️ [Portaria Webhook Security Alert] Token inválido ou ausente:', requestToken)
      return NextResponse.json({ error: 'Acesso negado: Token inválido.' }, { status: 403 })
    }

    const payload = await req.json().catch(() => ({}))
    console.log('📬 [Webhook iDFace Recebido]', JSON.stringify(payload, null, 2))

    // Se o evento for de alteração de objeto (ex: cadastro de face/template direto na catraca física)
    if (payload.object_changes && Array.isArray(payload.object_changes)) {
      for (const change of payload.object_changes) {
        if ((change.object === 'templates' || change.object === 'users') && (change.type === 'inserted' || change.type === 'updated')) {
          const uId = change.values?.user_id || change.values?.userId
          if (uId) {
            syncPhotoFromDeviceToStudent(String(uId), payload.device_id || payload.serial || '').catch((err: any) =>
              console.error('[Portaria Webhook Image Sync Error]', err.message)
            )
          }
        }
      }
    }

    // O iDFace envia dados em formato plano OU no formato do Monitor oficial: { object_changes: [ { values: { ... } } ] }
    let userId = payload.user_id || payload.userId || payload.id || ''
    let eventTimeRaw = payload.time || payload.timestamp || ''
    let eventType = payload.event_type || payload.type || 'entrada'

    let deviceSerial =
      payload.device_id || payload.serial || payload.deviceId || payload.idface_serial ||
      searchParams.get('device_id') || searchParams.get('deviceId') || searchParams.get('serial') ||
      req.headers.get('x-device-id') || req.headers.get('device-id') || req.headers.get('device_id') || req.headers.get('x-serial') || ''

    if (payload.object_changes && Array.isArray(payload.object_changes) && payload.object_changes.length > 0) {
      const change = payload.object_changes[0]
      if (change.values) {
        userId = userId || change.values.user_id || change.values.userId || ''
        eventTimeRaw = eventTimeRaw || change.values.time || change.values.timestamp || ''
        deviceSerial = deviceSerial || change.values.device_id || change.values.deviceSerial || ''
      }
    }

    // Converter data de UNIX em segundos/milissegundos ou String para ISO 8601
    let eventTime = new Date().toISOString()
    if (eventTimeRaw) {
      const numTime = Number(eventTimeRaw)
      if (!isNaN(numTime) && numTime > 0) {
        const isSeconds = String(numTime).length <= 10
        eventTime = new Date(numTime * (isSeconds ? 1000 : 1)).toISOString()
      } else {
        const d = new Date(eventTimeRaw)
        if (!isNaN(d.getTime())) {
          eventTime = d.toISOString()
        }
      }
    }

    // Tentar resolver o aluno pelo código do equipamento
    let alunoId: string | null = null
    let alunoNome = ''
    let alunoTurma: string | null = null
    let alunoTurno: string | null = null
    let alunoResponsaveis: any[] = []

    if (userId) {
      // 1. Tentar buscar direto por correspondência exata de matrícula
      const { data: alunoExato } = await supabase
        .from('alunos')
        .select('id, nome, turma, turno')
        .eq('matricula', userId)
        .limit(1)
        .maybeSingle()

      if (alunoExato) {
        alunoId = alunoExato.id
        alunoNome = alunoExato.nome
        alunoTurma = alunoExato.turma || null
        alunoTurno = alunoExato.turno || null
        // Placeholder for future parent relation
        alunoResponsaveis = [{ id: `parent_of_${alunoId}` }]
      } else {
        // 2. Se não achou por igualdade exata, tenta correspondência numérica parcial
        const { data: ativos } = await supabase
          .from('alunos')
          .select('id, nome, matricula, turma, turno')
          .in('status', ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'])

        if (ativos && ativos.length > 0) {
          const targetNum = parseInt(String(userId).replace(/\D/g, ''), 10)
          
          if (!isNaN(targetNum)) {
            const match = ativos.find(a => {
              const codStr = a.matricula || ''
              const codNum = parseInt(codStr.replace(/\D/g, ''), 10)
              return !isNaN(codNum) && codNum === targetNum
            })

            if (match) {
              alunoId = match.id
              alunoNome = match.nome
              alunoTurma = match.turma || null
              alunoTurno = match.turno || null
              alunoResponsaveis = [{ id: `parent_of_${match.id}` }]
            }
          }
        }
      }
    }

    // Resolver dispositivo
    let dispositivoId = ''
    let dispositivoNome = ''
    if (deviceSerial) {
      const serialAlt = deviceSerial.includes('/') ? deviceSerial.replace('/', '-') : deviceSerial.replace('-', '/')
      const { data: dev } = await supabase
        .from('portaria_dispositivos')
        .select('id, nome')
        .or(`id.eq.${deviceSerial},id.eq.${serialAlt},configuracao->>serial.eq.${deviceSerial},configuracao->>serial.eq.${serialAlt},ip.eq.${deviceSerial}`)
        .limit(1)
        .maybeSingle()

      if (dev) {
        dispositivoId = dev.id
        dispositivoNome = dev.nome
      }
    }

    // Fallback por IP do cliente que enviou o webhook
    if (!dispositivoId) {
      const xForwardedFor = req.headers.get('x-forwarded-for')
      const xRealIp = req.headers.get('x-real-ip')
      const clientIp = (xForwardedFor ? xForwardedFor.split(',')[0].trim() : xRealIp || '').replace(/^::ffff:/, '')

      if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
        const { data: devByIp } = await supabase
          .from('portaria_dispositivos')
          .select('id, nome')
          .eq('ip', clientIp)
          .limit(1)
          .maybeSingle()

        if (devByIp) {
          dispositivoId = devByIp.id
          dispositivoNome = devByIp.nome
        }
      }
    }

    // Se o dispositivo não foi identificado, usar o primeiro disponível
    if (!dispositivoId) {
      const { data: firstDev } = await supabase
        .from('portaria_dispositivos')
        .select('id, nome')
        .limit(1)
        .maybeSingle()

      dispositivoId = firstDev?.id || 'unknown'
      dispositivoNome = firstDev?.nome || 'Desconhecido'
    }

    const configVal = config
    const startHour = configVal.horario_entrada_inicio || '06:00'
    const endHour = configVal.horario_entrada_fim || '22:00'

    // Determinar status do evento
    let eventStatus = alunoId ? 'sucesso' : (userId ? 'inconsistencia' : 'falha')

    // Se o aluno foi identificado com sucesso, validar se está no horário permitido
    if (eventStatus === 'sucesso') {
      const eventDate = eventTimeRaw ? new Date(eventTime) : new Date()
      // A catraca iDFace envia o timestamp UNIX como se o horário local fosse UTC.
      // Portanto, extraímos as horas em UTC para obter a hora local exata registrada pelo equipamento.
      const currentHour = String(eventDate.getUTCHours()).padStart(2, '0') + ':' + String(eventDate.getUTCMinutes()).padStart(2, '0')
      if (currentHour < startHour || currentHour > endHour) {
        eventStatus = 'inconsistencia'
      }
    }

    // Identificador único determinístico para evitar duplicidade em sincronizações
    let eventId = crypto.randomUUID()
    if (payload.object_changes && payload.object_changes[0]?.values?.id) {
      eventId = `idface-${dispositivoId}-${payload.object_changes[0].values.id}`
    } else if (payload.id) {
      eventId = `idface-${dispositivoId}-${payload.id}`
    }

    // Salvar evento — Usamos upsert para evitar duplicações se rodar o sync de acessos 2x
    const { error: insertErr } = await supabase.from('portaria_eventos').upsert({
      id: eventId,
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

    if (insertErr) {
      console.error('[Supabase Portaria Insert Error]', insertErr)
    }

    // Integração automática de presença em academico/frequencia
    if (eventStatus === 'sucesso' && alunoId && alunoTurma) {
      try {
        // 1. Obter informações da turma do aluno para saber o segmento e horários
        const { data: turmaData, error: turmaErr } = await supabase
          .from('turmas')
          .select('id, nome, turno, dados')
          .eq('id', alunoTurma)
          .maybeSingle()

        if (!turmaErr && turmaData) {
          const schedule = getTurmaSchedule(turmaData)

          // 2. Resolver data e hora local do evento extraindo UTC (pois a catraca grava o local como UTC)
          const eventDateObj = new Date(eventTime)
          
          const year = eventDateObj.getUTCFullYear()
          const month = String(eventDateObj.getUTCMonth() + 1).padStart(2, '0')
          const day = String(eventDateObj.getUTCDate()).padStart(2, '0')
          const localDate = `${year}-${month}-${day}`
          
          const localHour = eventDateObj.getUTCHours()
          const localMin = eventDateObj.getUTCMinutes()
          const localTimeStr = `${String(localHour).padStart(2, '0')}:${String(localMin).padStart(2, '0')}`

          // 3. Calcular minutos desde a meia-noite
          const arrivalMinutes = localHour * 60 + localMin

          // 4. Determinar primeiro tempo presente baseado na tolerância
          const firstPresentTempoIndex = getFirstPresentTempoIndex(arrivalMinutes, schedule.segmento, schedule.turno)

          // 5. Verificar se já existe lançamento de frequência para este aluno neste dia
          const freqId = `FREQ-${alunoId}-${localDate}`
          const { data: existingFreq } = await supabase
            .from('frequencias')
            .select('*')
            .eq('id', freqId)
            .maybeSingle()

          // 6. Mesclar com as frequências existentes preservando 'J' (justificadas)
          let tempos: Record<string, string> = {}
          const existingTempos = existingFreq?.dados?.tempos || existingFreq?.tempos
          if (existingTempos && typeof existingTempos === 'object') {
            tempos = { ...existingTempos }
          }

          schedule.tempos.forEach((t, index) => {
            if (index >= firstPresentTempoIndex) {
              tempos[t.id] = 'P' // Presente a partir da chegada
            } else {
              // Só marca como Falta se não estiver pré-marcado como Justificado
              if (tempos[t.id] !== 'J') {
                tempos[t.id] = 'F'
              }
            }
          })

          // 7. Aplicar as regras específicas de segmento
          const calc = calcularFrequenciaDia(tempos as any, schedule.segmento)

          // 8. Salvar ou atualizar o registro de frequência
          const currentYear = new Date().getFullYear().toString()
          const diarioId = `DIARIO-${alunoTurma}-${currentYear}`

          const row = {
            id: freqId,
            aluno_id: alunoId,
            turma_id: alunoTurma,
            data: localDate,
            presente: calc.presente,
            justificativa: calc.justificativa,
            dados: {
              tempos: calc.temposEfetivos,
              diarioId,
              anoLetivo: currentYear,
              registradoPor: 'Catraca iDFace',
              horaRegistro: localTimeStr
            }
          }

          const { error: upsertErr } = await supabase.from('frequencias').upsert(row)
          if (upsertErr) {
            console.error('[Portaria Integration Frequencia Upsert Error]', upsertErr)
          } else {
            console.log(`✅ [Portaria Integration] Frequência atualizada com sucesso para ${alunoNome} em ${localDate} (${localTimeStr})`)
            
            // 9. Disparo do Push Notification para a Agenda Digital
            if (alunoId) {
              try {
                const { sendAgendaPushNotification } = await import('@/lib/server/agendaNotifications')
                const { getResponsavelIdsForTargets } = await import('@/lib/server/notificationHelper')
                const targetIds = await getResponsavelIdsForTargets({ targetStudents: [alunoId] })
                
                if (targetIds.length > 0) {
                  await sendAgendaPushNotification({
                    type: 'frequencia',
                    itemId: String(freqId),
                    title: '✅ Presença Confirmada',
                    message: `A presença de ${alunoNome} foi confirmada na escola (Entrada às ${localTimeStr}).`,
                    targetUserIds: targetIds,
                    targetUrl: '/agenda-digital/frequencia'
                  })
                }
              } catch (e) {
                console.error('[Push Dispatch Error]', e)
              }
            }
          }
        }
      } catch (err: any) {
        console.error('[Portaria Integration Frequencia Error]', err.message)
      }
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // PUSH PROTOCOL OFICIAL CONTROLID
    // A catraca iDFace espera UMA transação por ping no formato:
    // { "verb": "POST", "endpoint": "add_objects", "body": {...}, "contentType": "application/json" }
    // Ref: https://www.controlid.com.br/documentacao/push-protocol/
    // ══════════════════════════════════════════════════════════════════════════════
    if (dispositivoId) {
      if (dispositivoId !== 'unknown') {
        await supabase.from('portaria_dispositivos').update({
          status: 'online',
          ultima_comunicacao: new Date().toISOString(),
        }).eq('id', dispositivoId)
      }

      // Buscar a próxima pendência da fila para ESTE dispositivo (1 por ping = protocolo Push)
      let syncQuery = supabase
        .from('portaria_sync')
        .select('aluno_id, dispositivo_id, status, erro_detalhe')
        .eq('status', 'pendente')
        .order('updated_at', { ascending: false })

      if (dispositivoId && dispositivoId !== 'unknown') {
        const altDevId = dispositivoId.includes('/') ? dispositivoId.replace('/', '-') : dispositivoId.replace('-', '/')
        syncQuery = syncQuery.or(`dispositivo_id.eq.${dispositivoId},dispositivo_id.eq.${altDevId}`)
      }

      const { data: pendingRows } = await syncQuery.limit(1)

      if (pendingRows && pendingRows.length > 0) {
        const row = pendingRows[0]

        // Buscar dados do aluno
        const { data: aluno } = await supabase
          .from('alunos')
          .select('id, nome, matricula, codigo, foto, status')
          .or(`id.eq.${row.aluno_id},matricula.eq.${row.aluno_id}`)
          .maybeSingle()

        // Determinar ID numérico para a catraca
        const numId = aluno
          ? parseInt((aluno.matricula || aluno.codigo || aluno.id).replace?.(/\D/g, '') ?? String(aluno.matricula || aluno.id), 10)
          : parseInt(String(row.aluno_id).replace(/\D/g, ''), 10)

        // Marcar como sincronizado ANTES de responder (o dispositivo só volta a pedir quando responder)
        let statusUpdate = supabase
          .from('portaria_sync')
          .update({ status: 'sincronizado', ultima_sync: new Date().toISOString(), erro_detalhe: null, updated_at: new Date().toISOString() })
          .eq('aluno_id', String(row.aluno_id))
        if (row.dispositivo_id) statusUpdate = statusUpdate.eq('dispositivo_id', String(row.dispositivo_id))
        await statusUpdate

        if (!isNaN(numId) && numId > 0) {
          const isActive = aluno && ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'].includes(aluno.status)

          if (isActive || (!aluno && !row.erro_detalhe?.includes('Exclusão'))) {
            // ─── ADICIONAR/ATUALIZAR USUÁRIO ───────────────────────────────────────
            const nameStr = aluno?.nome ? aluno.nome.substring(0, 30) : `Aluno ${numId}`
            const regStr = String(numId)

            // Responder com add_objects (cria se não existe, ControlID ignora se já existe)
            return NextResponse.json({
              verb: 'POST',
              endpoint: 'add_objects',
              body: {
                object: 'users',
                values: [{ id: numId, name: nameStr, registration: regStr }]
              },
              contentType: 'application/json'
            })
          } else {
            // ─── REMOVER USUÁRIO INATIVO ───────────────────────────────────────────
            return NextResponse.json({
              verb: 'POST',
              endpoint: 'destroy_objects',
              body: {
                object: 'users',
                where: { users: { id: numId } }
              },
              contentType: 'application/json'
            })
          }
        }
      }
    }

    // Sem pendências: resposta vazia (protocolo Push exige resposta vazia quando não há comandos)
    return NextResponse.json({ status: 'ok', evento: eventStatus })
  } catch (e: any) {
    // NUNCA retornar erro — loggar e retornar 200
    console.error('[Webhook Portaria Error]', e.message)
    return NextResponse.json({ status: 'ok', warning: 'internal_error_logged' })
  }
}

/**
 * GET /api/portaria/webhook
 * Alguns firmwares do iDFace usam GET para o heartbeat do Push Protocol.
 * Delega para /api/portaria/push que serve a fila de forma idempotente.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const deviceSerial =
    searchParams.get('device_id') ||
    searchParams.get('deviceId') ||
    searchParams.get('serial') ||
    req.headers.get('x-device-id') ||
    req.headers.get('device-id') ||
    ''

  const pushUrl = new URL('/api/portaria/push', req.url)
  if (deviceSerial) pushUrl.searchParams.set('device_id', deviceSerial)

  const pushResp = await fetch(pushUrl.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })

  const text = await pushResp.text()
  if (!text || text === '') return new Response('', { status: 200 })
  try {
    const data = JSON.parse(text)
    return NextResponse.json(data)
  } catch {
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
}
