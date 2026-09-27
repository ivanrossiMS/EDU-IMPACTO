'use client'

import React from 'react'
import { Clock, Moon, Lock, Calendar, AlertCircle } from 'lucide-react'

export interface ChatBusinessHoursCheck {
  isClosed: boolean
  isLunch: boolean
  reason: 'open' | 'closed_day' | 'closed_hour' | 'closed_lunch' | 'inactive'
  currentHourStr: string
  dayOfWeek: number
  diasLabel: string
  horarioLabel: string
  almocoLabel?: string
  hIni: string
  hFim: string
  formattedNotice: string
  title: string
}

/**
 * Retorna data e hora no fuso horário de Brasília (America/Sao_Paulo)
 */
export function getBrasiliaDate(): Date {
  const now = new Date()
  const brazilString = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  return new Date(brazilString)
}

/**
 * Formata os dias da semana para exibição amigável
 */
export function formatDaysOfWeek(dias: number[]): string {
  if (!dias || dias.length === 0) return 'Segunda a Sexta'
  const sorted = [...dias].sort((a, b) => a - b)
  
  if (sorted.length === 7) return 'Todos os dias'
  if (sorted.length === 5 && sorted[0] === 1 && sorted[4] === 5) return 'Segunda a Sexta'
  if (sorted.length === 6 && sorted[0] === 1 && sorted[5] === 6) return 'Segunda a Sábado'
  
  const diasMap: Record<number, string> = {
    0: 'Dom',
    1: 'Seg',
    2: 'Ter',
    3: 'Qua',
    4: 'Qui',
    5: 'Sex',
    6: 'Sáb'
  }
  return sorted.map(d => diasMap[d] || String(d)).join(', ')
}

/**
 * Avalia se o chat está fechado/bloqueado no momento
 */
export function checkChatBusinessHours(
  horarioConfig?: any,
  contactName?: string,
  schoolName: string = 'Colégio Impacto'
): ChatBusinessHoursCheck {
  const defaultRes: ChatBusinessHoursCheck = {
    isClosed: false,
    isLunch: false,
    reason: 'inactive',
    currentHourStr: '',
    dayOfWeek: 0,
    diasLabel: 'Segunda a Sexta',
    horarioLabel: '07:00 às 18:00',
    hIni: '07:00',
    hFim: '18:00',
    formattedNotice: '',
    title: 'Atendimento'
  }

  if (!horarioConfig || !horarioConfig.ativo) {
    return defaultRes
  }

  const bDate = getBrasiliaDate()
  const dayOfWeek = bDate.getDay() // 0 = Dom, 1 = Seg, ..., 6 = Sáb
  const hours = String(bDate.getHours()).padStart(2, '0')
  const minutes = String(bDate.getMinutes()).padStart(2, '0')
  const currentHourStr = `${hours}:${minutes}`

  const dias = horarioConfig.diasSemana || [1, 2, 3, 4, 5]
  const diasLabel = formatDaysOfWeek(dias)
  const isDayOpen = dias.includes(dayOfWeek)

  const hIni = horarioConfig.horarioInicio || '07:00'
  const hFim = horarioConfig.horarioFim || '18:00'
  const horarioLabel = `${hIni} às ${hFim}`
  const isHourOpen = currentHourStr >= hIni && currentHourStr <= hFim

  let isLunch = false
  let almocoLabel: string | undefined
  if (horarioConfig.temIntervaloAlmoco) {
    const aIni = horarioConfig.almocoInicio || '12:00'
    const aFim = horarioConfig.almocoFim || '13:00'
    almocoLabel = `${aIni} às ${aFim}`
    if (currentHourStr >= aIni && currentHourStr <= aFim) {
      isLunch = true
    }
  }

  const isClosed = !isDayOpen || !isHourOpen || isLunch

  let reason: ChatBusinessHoursCheck['reason'] = 'open'
  let title = 'Atendimento Escolar'

  if (!isDayOpen) {
    reason = 'closed_day'
    title = 'Sem Expediente Hoje'
  } else if (isLunch) {
    reason = 'closed_lunch'
    title = 'Intervalo de Almoço'
  } else if (!isHourOpen) {
    reason = 'closed_hour'
    title = 'Horário Não Permitido'
  }

  // Formatar mensagem personalizada de ausência
  let rawName = (contactName || '').trim()
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
  const cleanWord = firstWord.replace(/[0-9_.\-]+$/g, '') || firstWord
  const firstName = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase()

  const rawTemplate =
    horarioConfig.mensagemAusencia ||
    'Olá, {nome_contato}! No momento estamos fora do nosso horário de atendimento escolar ({horario_inicio} às {horario_fim}). O envio de mensagens está desabilitado e será liberado no próximo expediente.'

  const formattedNotice = rawTemplate
    .replace(/\{\s*(nome_contato|nome_responsavel|nome_aluno|nome|contato)\s*\}/gi, firstName)
    .replace(/\{\s*(horario_inicio|inicio|hora_inicio)\s*\}/gi, hIni)
    .replace(/\{\s*(horario_fim|fim|hora_fim)\s*\}/gi, hFim)
    .replace(/\{\s*(escola|colegio|instituicao)\s*\}/gi, schoolName)

  return {
    isClosed,
    isLunch,
    reason,
    currentHourStr,
    dayOfWeek,
    diasLabel,
    horarioLabel,
    almocoLabel,
    hIni,
    hFim,
    formattedNotice,
    title
  }
}

interface ChatBlockedNoticeCardProps {
  status: ChatBusinessHoursCheck
  compact?: boolean
  customNoticeText?: string
}

/**
 * Componente moderno, compacto e organizado que substitui o campo de digitação quando fora do horário
 */
export function ChatBlockedNoticeCard({
  status,
  compact = false
}: ChatBlockedNoticeCardProps) {
  const isLunch = status.reason === 'closed_lunch'

  return (
    <div
      style={{
        padding: compact ? '8px 12px' : '10px 16px',
        background: 'linear-gradient(180deg, #fffbf5 0%, #fff7ed 100%)',
        border: '1px solid #fed7aa',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(234, 88, 12, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 5 : 7,
        userSelect: 'none',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Linha 1: Ícone + Título + Selo de Horário */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: '#ffedd5',
              color: '#c2410c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isLunch ? <Clock size={12} /> : <Moon size={12} />}
          </div>
          <span style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 800, color: '#9a3412', whiteSpace: 'nowrap' }}>
            {status.title}
          </span>
          <span style={{ fontSize: 11, color: '#c2410c', opacity: 0.8, display: compact ? 'none' : 'inline' }}>
            • Digitação pausada
          </span>
        </div>

        {/* Badge Compacta de Expediente */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: '#ffffff',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid #fed7aa',
            fontSize: 11,
            fontWeight: 700,
            color: '#7c2d12',
            whiteSpace: 'nowrap'
          }}
        >
          <Clock size={11} color="#ea580c" />
          <span>{status.horarioLabel}</span>
        </div>
      </div>

      {/* Linha 2: Dias da Semana + Aviso de Liberação */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', fontSize: 11, color: '#7c2d12' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Calendar size={11} color="#ea580c" />
          <span style={{ fontWeight: 600 }}>{status.diasLabel}</span>
          {status.almocoLabel && (
            <span style={{ opacity: 0.85 }}>• Almoço: {status.almocoLabel}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#9a3412', opacity: 0.85 }}>
          <Lock size={10} />
          <span>Envio desabilitado</span>
        </div>
      </div>
    </div>
  )
}

