import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { ADChatAutoConfig, DEFAULT_CHAT_AUTO_CONFIG } from '@/lib/agendaDigitalContext'

/**
 * Retorna as configurações ativas de automação do chat a partir de `configuracoes`
 */
export async function getChatAutoConfig(): Promise<ADChatAutoConfig> {
  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'ad_config')
      .maybeSingle()

    const rawAuto = data?.valor?.chatAuto
    if (!rawAuto) return DEFAULT_CHAT_AUTO_CONFIG

    return {
      ...DEFAULT_CHAT_AUTO_CONFIG,
      ...rawAuto,
      saudacao: {
        ...DEFAULT_CHAT_AUTO_CONFIG.saudacao,
        ...(rawAuto.saudacao || {})
      },
      horarioAtendimento: {
        ...DEFAULT_CHAT_AUTO_CONFIG.horarioAtendimento,
        ...(rawAuto.horarioAtendimento || {})
      },
      recursos: {
        ...DEFAULT_CHAT_AUTO_CONFIG.recursos,
        ...(rawAuto.recursos || {})
      }
    }
  } catch (err) {
    console.error('[getChatAutoConfig] Erro ao carregar configurações:', err)
    return DEFAULT_CHAT_AUTO_CONFIG
  }
}

/**
 * Retorna a hora atual no fuso de Brasília (America/Sao_Paulo)
 */
function getBrasiliaDate(): Date {
  const now = new Date()
  const brazilString = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  return new Date(brazilString)
}

/**
 * Verifica se o momento atual está dentro do horário de atendimento configurado
 */
export function isWithinBusinessHours(config: ADChatAutoConfig): {
  isBusinessHours: boolean
  isLunchBreak: boolean
  currentHourStr: string
  dayOfWeek: number
} {
  const { horarioAtendimento } = config
  if (!horarioAtendimento.ativo) {
    return { isBusinessHours: true, isLunchBreak: false, currentHourStr: '', dayOfWeek: 0 }
  }

  const bDate = getBrasiliaDate()
  const dayOfWeek = bDate.getDay() // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const hours = String(bDate.getHours()).padStart(2, '0')
  const minutes = String(bDate.getMinutes()).padStart(2, '0')
  const currentHourStr = `${hours}:${minutes}`

  // 1. Verifica se hoje é um dia com expediente
  const diasPermitidos = horarioAtendimento.diasSemana || [1, 2, 3, 4, 5]
  if (!diasPermitidos.includes(dayOfWeek)) {
    return { isBusinessHours: false, isLunchBreak: false, currentHourStr, dayOfWeek }
  }

  // 2. Verifica a faixa de início e fim
  const hInicio = horarioAtendimento.horarioInicio || '07:00'
  const hFim = horarioAtendimento.horarioFim || '18:00'

  if (currentHourStr < hInicio || currentHourStr > hFim) {
    return { isBusinessHours: false, isLunchBreak: false, currentHourStr, dayOfWeek }
  }

  // 3. Verifica pausa de almoço se habilitada
  if (horarioAtendimento.temIntervaloAlmoco) {
    const aInicio = horarioAtendimento.almocoInicio || '12:00'
    const aFim = horarioAtendimento.almocoFim || '13:00'
    if (currentHourStr >= aInicio && currentHourStr <= aFim) {
      return { isBusinessHours: false, isLunchBreak: true, currentHourStr, dayOfWeek }
    }
  }

  return { isBusinessHours: true, isLunchBreak: false, currentHourStr, dayOfWeek }
}

/**
 * Retorna saudação conforme o horário (Bom dia, Boa tarde, Boa noite)
 */
function getGreetingSalutation(): string {
  const bDate = getBrasiliaDate()
  const hour = bDate.getHours()
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Formata texto substituindo variáveis dinâmicas (máscaras)
 */
export function formatTemplate(
  template: string,
  params: {
    nomeContato: string
    nomeColaborador?: string
    horarioInicio?: string
    horarioFim?: string
  }
): string {
  // 1. Limpar e capitalizar o primeiro nome do contato
  let rawName = (params.nomeContato || '').trim()
  if (
    !rawName ||
    rawName.toLowerCase() === 'você' ||
    rawName.toLowerCase() === 'voce' ||
    rawName.toLowerCase() === 'usuario' ||
    rawName.toLowerCase() === 'usuário' ||
    rawName.includes('@')
  ) {
    rawName = 'Família'
  }
  const firstWord = rawName.split(' ')[0]
  // Limpa números ou caracteres especiais no final (ex: "ivan12" -> "ivan")
  const cleanWord = firstWord.replace(/[0-9_.\-]+$/g, '') || firstWord
  const firstName = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase()

  // 2. Limpar e capitalizar o nome do educador/colaborador
  let rawColab = (params.nomeColaborador || '').trim()
  if (
    !rawColab ||
    rawColab.toLowerCase() === 'você' ||
    rawColab.toLowerCase() === 'voce' ||
    rawColab.toLowerCase() === 'usuario' ||
    rawColab.toLowerCase() === 'usuário' ||
    rawColab.includes('@')
  ) {
    rawColab = 'Educador(a)'
  }
  const colabFirstWord = rawColab.split(' ')[0]
  const colabClean = colabFirstWord.replace(/[0-9_.\-]+$/g, '') || colabFirstWord
  const colabFirstName = colabClean.charAt(0).toUpperCase() + colabClean.slice(1).toLowerCase()

  const salutation = getGreetingSalutation()

  return template
    .replace(/\{\s*(nome_contato|nome_responsavel|nome_aluno|nome|contato)\s*\}/gi, firstName)
    .replace(/\{\s*(nome_colaborador|nome_professor|professor|educador)\s*\}/gi, colabFirstName)
    .replace(/\{\s*(saudacao_tempo|saudacao|periodo)\s*\}/gi, salutation)
    .replace(/\{\s*(horario_inicio|inicio|hora_inicio)\s*\}/gi, params.horarioInicio || '07:00')
    .replace(/\{\s*(horario_fim|fim|hora_fim)\s*\}/gi, params.horarioFim || '18:00')
    .replace(/\{\s*(escola|colegio|instituicao)\s*\}/gi, 'Colégio Impacto')
}

/**
 * Executa a lógica de auto-respostas (saudação ou ausência) após a mensagem ser salva
 * Retorna o registro da mensagem de auto-resposta gerada ou null
 */
export async function triggerChatAutoReplyIfNeeded(params: {
  conversationId: string
  senderId: string
  senderName: string
  senderPerfil: string
  messageContent: string
}): Promise<any | null> {
  try {
    const { conversationId, senderId, senderName, senderPerfil } = params
    const supabase = getAdminClient()

    // 1. Obter participantes da conversa
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('user_id, user_name, user_perfil, user_role')
      .eq('conversation_id', conversationId)

    if (!participants || participants.length < 2) return null

    // 2. Identificar se o remetente é Família/Aluno e se há um Colaborador na conversa
    const senderPart =
      participants.find(p => String(p.user_id) === String(senderId)) ||
      participants.find(p => p.user_name && senderName && p.user_name.toLowerCase() === senderName.toLowerCase()) ||
      participants.find(p => ['família', 'familia', 'responsável', 'responsavel', 'aluno', 'pai', 'mãe', 'mae'].some(k => (p.user_perfil || '').toLowerCase().includes(k)))

    const targetColab = participants.find(p => p !== senderPart && p.user_id !== 'system_auto_responder')

    const senderPf = (senderPerfil || senderPart?.user_perfil || '').toLowerCase()
    const isSenderStaff = ['professor', 'educador', 'colaborador', 'admin', 'master', 'diretor', 'direção', 'coordenação', 'coordenador'].some(k => senderPf.includes(k))

    // Se o remetente for colaborador/admin falando com a família, não dispara auto-resposta institucional
    if (isSenderStaff && !['família', 'familia', 'responsável', 'responsavel', 'aluno', 'pai', 'mãe', 'mae'].some(k => senderPf.includes(k))) {
      return null
    }

    // Determinar o nome real do contato para substituição da máscara
    let contactRealName = senderName
    if (
      !contactRealName ||
      contactRealName.toLowerCase() === 'você' ||
      contactRealName.toLowerCase() === 'voce' ||
      contactRealName.toLowerCase() === 'usuário' ||
      contactRealName.toLowerCase() === 'usuario' ||
      contactRealName.includes('@')
    ) {
      contactRealName = senderPart?.user_name || ''
    }
    if (!contactRealName) {
      const { data: conv } = await supabase
        .from('chat_conversations')
        .select('title, aluno_nome')
        .eq('id', conversationId)
        .maybeSingle()
      contactRealName = conv?.aluno_nome || conv?.title || 'Família'
    }

    // 3. Obter configurações de automação
    const config = await getChatAutoConfig()
    const { isBusinessHours, isLunchBreak } = isWithinBusinessHours(config)

    const nowIso = new Date().toISOString()
    const SYSTEM_BOT_ID = 'system_auto_responder'
    const SYSTEM_BOT_NAME = 'Atendimento Automático'
    const SYSTEM_BOT_PERFIL = 'Colégio Impacto'

    // =========================================================================
    // CASO A: FORA DO EXPEDIENTE
    // =========================================================================
    if (!isBusinessHours) {
      // Conforme diretriz do usuário: em vez de enviar mensagens automáticas de aviso
      // poluindo o chat, o próprio modal/campo de digitação é substituído pelo aviso
      // informativo que bloqueia a digitação de mensagens das famílias fora do expediente.
      return null
    }

    // =========================================================================
    // CASO B: DENTRO DO EXPEDIENTE -> ENVIAR SAUDAÇÃO SE HABILITADA
    // =========================================================================
    if (config.saudacao.ativa) {
      const freq = config.saudacao.frequencia || '1x_day'

      const greetingText = formatTemplate(
        config.saudacao.mensagem || 'Olá, {nome_contato}! {saudacao_tempo}! Agradecemos a sua mensagem. Nossa equipe pedagógica já foi notificada e retornará em breve.',
        {
          nomeContato: contactRealName,
          nomeColaborador: targetColab?.user_name
        }
      )

      // Verificar se já enviou saudação de acordo com a frequência configurada
      let timeLimitMs = 24 * 60 * 60 * 1000 // 24h padrão
      if (freq === '1x_2days') timeLimitMs = 48 * 60 * 60 * 1000
      if (freq === '1x_3days') timeLimitMs = 72 * 60 * 60 * 1000
      if (freq === '1x_week') timeLimitMs = 7 * 24 * 60 * 60 * 1000
      if (freq === 'always') timeLimitMs = 15 * 1000 // 15s de tolerância anti-duplicação

      const rawGreetingTemplate = config.saudacao.mensagem || ''

      let checkQuery = supabase
        .from('chat_messages')
        .select('id, content, metadata')
        .eq('conversation_id', conversationId)
        .eq('sender_id', SYSTEM_BOT_ID)
        .contains('metadata', { auto_reply_type: 'greeting' })
        .order('created_at', { ascending: false })

      if (freq !== 'first_time' && freq !== 'always') {
        const sinceIso = new Date(Date.now() - timeLimitMs).toISOString()
        checkQuery = checkQuery.gte('created_at', sinceIso)
      }

      const { data: recentGreeting } = await checkQuery.limit(1)

      if (recentGreeting && recentGreeting.length > 0) {
        const lastMsg = recentGreeting[0]
        const lastContent = (lastMsg?.content || '').trim()
        const lastRawTemplate = (lastMsg?.metadata?.raw_template || '').trim()

        // Se a frase de saudação foi alterada pelo admin, permite envio imediato da nova frase alterada!
        const wasChanged = lastRawTemplate
          ? lastRawTemplate !== rawGreetingTemplate.trim()
          : lastContent !== greetingText.trim()

        if (!wasChanged && freq !== 'always') {
          return null
        }
      }

      // Inserir mensagem de saudação
      const { data: insertedGreeting, error: errGreeting } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: SYSTEM_BOT_ID,
          sender_name: SYSTEM_BOT_NAME,
          sender_perfil: SYSTEM_BOT_PERFIL,
          content: greetingText,
          content_type: 'text',
          status: 'sent',
          metadata: {
            is_auto_reply: true,
            auto_reply_type: 'greeting',
            raw_template: rawGreetingTemplate
          }
        })
        .select()
        .single()

      if (errGreeting) throw errGreeting

      // Atualizar conversa
      await supabase
        .from('chat_conversations')
        .update({
          last_message_at: insertedGreeting.created_at,
          last_message_text: insertedGreeting.content.substring(0, 100),
          last_message_by: SYSTEM_BOT_ID,
          updated_at: nowIso
        })
        .eq('id', conversationId)

      // Incrementar unread count para o remetente
      await supabase
        .from('chat_participants')
        .update({ unread_count: 1, updated_at: nowIso })
        .eq('conversation_id', conversationId)
        .eq('user_id', senderId)

      // Disparar push notification de volta para a família
      try {
        const { dispatchChatPushNotification } = await import('@/lib/server/chatPushNotification')
        dispatchChatPushNotification({
          conversationId,
          messageId: insertedGreeting.id,
          senderId: SYSTEM_BOT_ID,
          senderName: SYSTEM_BOT_NAME,
          senderPerfil: SYSTEM_BOT_PERFIL,
          content: insertedGreeting.content,
          contentType: 'text',
          metadata: insertedGreeting.metadata
        }).catch(err => console.error('[AutoResponder] Erro push saudação:', err))
      } catch (_) {}

      return insertedGreeting
    }

    return null
  } catch (err) {
    console.error('[triggerChatAutoReplyIfNeeded] Erro no processamento de auto-resposta:', err)
    return null
  }
}
