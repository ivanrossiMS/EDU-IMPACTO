import { NextRequest, NextResponse } from 'next/server'

function escapeIcsText(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
    .trim()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

function formatLocalDateTime(date: Date): string {
  return `${formatLocalDate(date)}T${pad2(date.getHours())}${pad2(date.getMinutes())}00`
}

function formatUtcDateTime(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
}

function parseTimeParts(timeStr?: string | null): { hours: number; minutes: number } | null {
  if (!timeStr) return null
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }
  return { hours, minutes }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const titulo = searchParams.get('titulo') || 'Evento Escolar'
  const data = searchParams.get('data') || ''
  const horaInicio = searchParams.get('horaInicio') || ''
  const horaFim = searchParams.get('horaFim') || ''
  const diaTodo = searchParams.get('diaTodo') === '1' || searchParams.get('diaTodo') === 'true'
  const descricao = searchParams.get('descricao') || ''
  const local = searchParams.get('local') || 'Colégio Impacto'
  const tipo = searchParams.get('tipo') || ''
  const turma = searchParams.get('turma') || ''
  const uidParam = searchParams.get('uid') || `${Date.now()}`

  const dateMatch = data.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const now = new Date()
  const year = dateMatch ? parseInt(dateMatch[1], 10) : now.getFullYear()
  const month = dateMatch ? parseInt(dateMatch[2], 10) : now.getMonth() + 1
  const day = dateMatch ? parseInt(dateMatch[3], 10) : now.getDate()

  let dtStartLine = ''
  let dtEndLine = ''

  const startParts = !diaTodo ? (parseTimeParts(horaInicio) || { hours: 8, minutes: 0 }) : null
  const endParts = !diaTodo ? parseTimeParts(horaFim) : null

  if (diaTodo || !startParts) {
    const startDate = new Date(year, month - 1, day)
    const endDate = new Date(year, month - 1, day + 1)
    dtStartLine = `DTSTART;VALUE=DATE:${formatLocalDate(startDate)}`
    dtEndLine = `DTEND;VALUE=DATE:${formatLocalDate(endDate)}`
  } else {
    const startDate = new Date(year, month - 1, day, startParts.hours, startParts.minutes, 0)
    let endDate: Date
    if (endParts) {
      endDate = new Date(year, month - 1, day, endParts.hours, endParts.minutes, 0)
      if (endDate <= startDate) {
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
      }
    } else {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
    }
    dtStartLine = `DTSTART:${formatLocalDateTime(startDate)}`
    dtEndLine = `DTEND:${formatLocalDateTime(endDate)}`
  }

  const descParts: string[] = []
  if (tipo) descParts.push(`Categoria: ${tipo}`)
  if (turma) descParts.push(`Turma: ${turma}`)
  if (diaTodo) {
    descParts.push('Horário: Dia Todo')
  } else if (horaInicio) {
    descParts.push(`Horário: ${horaInicio}${horaFim ? ` às ${horaFim}` : ''}`)
  }
  if (local) descParts.push(`Local: ${local}`)
  if (descricao) {
    if (descParts.length > 0) descParts.push('')
    descParts.push(descricao)
  }
  descParts.push('', 'Calendário Escolar • Colégio Impacto')

  const fullDescription = descParts.join('\n')
  const safeUid = String(uidParam).replace(/[^a-zA-Z0-9_-]/g, '') || `${Date.now()}`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Colegio Impacto//Agenda Digital//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:evento-${safeUid}@impacto.edu.br`,
    `DTSTAMP:${formatUtcDateTime(now)}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${escapeIcsText(titulo)}`,
    `DESCRIPTION:${escapeIcsText(fullDescription)}`,
    `LOCATION:${escapeIcsText(local)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    diaTodo ? 'TRIGGER:-PT9H' : 'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`Lembrete: ${titulo}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  const icsContent = lines.join('\r\n') + '\r\n'
  const slugTitle = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'evento'

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slugTitle}.ics"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
