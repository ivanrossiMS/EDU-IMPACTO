'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CalendarPlus, Calendar, Clock, MapPin, X, Smartphone, ExternalLink, Sparkles, Check } from 'lucide-react'

export interface CalendarEventData {
  id?: string | number
  titulo: string
  descricao?: string
  tipo?: string
  tipoLabel?: string
  data: string // YYYY-MM-DD
  horaInicio?: string
  horaFim?: string
  diaTodo?: boolean
  local?: string
  turmaNome?: string
  cor?: string
}

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const DIAS_SEMANA_EXTENSO = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatGoogleDate(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

function formatGoogleDateTime(date: Date): string {
  return `${formatGoogleDate(date)}T${pad2(date.getHours())}${pad2(date.getMinutes())}00`
}

function formatIsoLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:00`
}

function parseTime(timeStr?: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null
  const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const hours = parseInt(m[1], 10)
  const minutes = parseInt(m[2], 10)
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

export function buildCalendarLinks(ev: CalendarEventData) {
  const [yStr, mStr, dStr] = String(ev.data || '').split('-')
  const now = new Date()
  const year = parseInt(yStr, 10) || now.getFullYear()
  const month = parseInt(mStr, 10) || (now.getMonth() + 1)
  const day = parseInt(dStr, 10) || now.getDate()

  const isAllDay = Boolean(ev.diaTodo)
  const startParts = !isAllDay ? (parseTime(ev.horaInicio) || { hours: 8, minutes: 0 }) : null
  const endParts = !isAllDay ? parseTime(ev.horaFim) : null

  let googleDates = ''
  let outlookStart = ''
  let outlookEnd = ''

  if (isAllDay || !startParts) {
    const startDate = new Date(year, month - 1, day)
    const endDate = new Date(year, month - 1, day + 1)
    googleDates = `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`
    outlookStart = `${year}-${pad2(month)}-${pad2(day)}`
    outlookEnd = `${endDate.getFullYear()}-${pad2(endDate.getMonth() + 1)}-${pad2(endDate.getDate())}`
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
    googleDates = `${formatGoogleDateTime(startDate)}/${formatGoogleDateTime(endDate)}`
    outlookStart = formatIsoLocal(startDate)
    outlookEnd = formatIsoLocal(endDate)
  }

  const locationStr = ev.local?.trim() || 'Colégio Impacto'

  const descLines: string[] = []
  if (ev.tipoLabel) descLines.push(`Categoria: ${ev.tipoLabel}`)
  if (ev.turmaNome) descLines.push(`Turma: ${ev.turmaNome}`)
  if (isAllDay) {
    descLines.push('Horário: Dia Todo')
  } else {
    const hi = ev.horaInicio || '08:00'
    descLines.push(`Horário: ${hi}${ev.horaFim ? ` às ${ev.horaFim}` : ''}`)
  }
  if (ev.local?.trim()) descLines.push(`Local: ${ev.local.trim()}`)
  if (ev.descricao?.trim()) {
    descLines.push('', ev.descricao.trim())
  }
  descLines.push('', 'Calendário Escolar • Colégio Impacto')
  const fullDetails = descLines.join('\n')

  // 1. Google Calendar URL (Android App Links + iOS + Web)
  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.titulo || 'Evento Escolar',
    dates: googleDates,
    details: fullDetails,
    location: locationStr,
  })
  const googleUrl = `https://calendar.google.com/calendar/render?${googleParams.toString()}`

  // 2. Native iOS / Android .ics API endpoint
  const icsParams = new URLSearchParams({
    titulo: ev.titulo || 'Evento Escolar',
    data: ev.data || '',
    horaInicio: ev.horaInicio || '08:00',
    horaFim: ev.horaFim || '',
    diaTodo: isAllDay ? '1' : '0',
    descricao: ev.descricao || '',
    local: locationStr,
    tipo: ev.tipoLabel || '',
    turma: ev.turmaNome || '',
    uid: String(ev.id || `${ev.data}-${ev.titulo}`),
  })
  const icsUrl = `/api/agenda/eventos/ics?${icsParams.toString()}`

  // 3. Outlook URL
  const outlookParams = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.titulo || 'Evento Escolar',
    startdt: outlookStart,
    enddt: outlookEnd,
    body: fullDetails,
    location: locationStr,
    allday: isAllDay ? 'true' : 'false',
  })
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`

  return { googleUrl, icsUrl, outlookUrl }
}

export function AddToCalendarButton({
  event,
  accentColor = '#6366f1',
  isPast = false,
  compact = false,
}: {
  event: CalendarEventData
  accentColor?: string
  isPast?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')
  const [justAdded, setJustAdded] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || ''
      const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      const isAndroid = /Android/i.test(ua)
      if (isIOS) setPlatform('ios')
      else if (isAndroid) setPlatform('android')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const { googleUrl, icsUrl, outlookUrl } = useMemo(() => buildCalendarLinks(event), [event])

  const formattedDateText = useMemo(() => {
    if (!event.data) return ''
    const [y, m, d] = event.data.split('-').map(Number)
    if (!y || !m || !d) return event.data
    const dt = new Date(y, m - 1, d)
    const weekDay = DIAS_SEMANA_EXTENSO[dt.getDay()]
    const monthName = MESES_NOMES[m - 1]
    return `${weekDay}, ${pad2(d)} de ${monthName} de ${y}`
  }, [event.data])

  const formattedTimeText = useMemo(() => {
    if (event.diaTodo) return 'Dia Todo'
    const hi = event.horaInicio || '08:00'
    return event.horaFim ? `${hi} às ${event.horaFim}` : hi
  }, [event.diaTodo, event.horaInicio, event.horaFim])

  const effectiveColor = isPast ? '#64748b' : accentColor

  const handleSelectOption = (key: string) => {
    setJustAdded(key)
    setTimeout(() => {
      setJustAdded(null)
      setOpen(false)
    }, 900)
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: compact ? '5px 9px' : '5px 11px',
          borderRadius: 10,
          background: isPast ? '#f1f5f9' : `${effectiveColor}14`,
          color: isPast ? '#475569' : effectiveColor,
          border: isPast ? '1px solid #cbd5e1' : `1px solid ${effectiveColor}45`,
          fontSize: 11.5,
          fontWeight: 700,
          fontFamily: 'Outfit, sans-serif',
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxShadow: isPast ? 'none' : `0 2px 8px ${effectiveColor}18`,
        }}
        title="Adicionar este evento ao calendário do celular (iOS / Android)"
      >
        <CalendarPlus size={13} strokeWidth={2.2} />
        <span>{compact ? 'Salvar na agenda' : 'Adicionar ao calendário'}</span>
      </button>

      {mounted && open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100050,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.9)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'adCalModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes adCalModalIn {
                from { opacity: 0; transform: translateY(10px) scale(0.97); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              .ad-addcal-option {
                text-decoration: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 12px !important;
                padding: 14px 16px !important;
                border-radius: 16px !important;
                transition: all 0.18s ease !important;
                cursor: pointer !important;
                width: 100% !important;
                box-sizing: border-box !important;
              }
              .ad-addcal-option:hover {
                transform: translateY(-1px) !important;
              }
            `}} />

            {/* Modal Header */}
            <div style={{
              padding: '18px 20px 14px 20px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}>
                  <CalendarPlus size={19} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                    Salvar no Calendário
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                    Adicione à agenda do seu celular com lembrete
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            {/* Event Preview Summary */}
            <div style={{ padding: '16px 20px 6px 20px' }}>
              <div style={{
                padding: '14px 16px',
                borderRadius: 16,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderLeft: `4px solid ${accentColor}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {event.tipoLabel && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: `${accentColor}18`,
                      color: accentColor,
                      border: `1px solid ${accentColor}40`,
                    }}>
                      {event.tipoLabel}
                    </span>
                  )}
                  {event.turmaNome && (
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#64748b',
                      background: '#e2e8f0',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}>
                      {event.turmaNome}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.35, wordBreak: 'break-word' }}>
                  {event.titulo}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    <Calendar size={13} color={accentColor} style={{ flexShrink: 0 }} />
                    <span>{formattedDateText}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    <Clock size={13} color={accentColor} style={{ flexShrink: 0 }} />
                    <span>{formattedTimeText}</span>
                  </div>
                  {event.local && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                      <MapPin size={13} color={accentColor} style={{ flexShrink: 0 }} />
                      <span>{event.local}</span>
                    </div>
                  )}
                </div>

                {event.descricao && (
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: 12,
                    color: '#64748b',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {event.descricao}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons (Ordered smartly for iOS vs Android) */}
            <div style={{
              padding: '12px 20px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              {platform === 'android' ? (
                <>
                  {/* Primary on Android: Google Agenda */}
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleSelectOption('google')}
                    className="ad-addcal-option"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                      color: '#ffffff',
                      border: '1px solid #4f46e5',
                      boxShadow: '0 8px 20px rgba(99, 102, 241, 0.28)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Calendar size={20} color="#ffffff" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>Google Agenda</span>
                          <span style={{
                            fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
                            background: 'rgba(255, 255, 255, 0.22)', color: '#ffffff', textTransform: 'uppercase'
                          }}>
                            Android
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.88)', fontWeight: 500, marginTop: 2 }}>
                          Abre direto no app Google Calendar do celular
                        </div>
                      </div>
                    </div>
                    {justAdded === 'google' ? <Check size={18} color="#ffffff" /> : <ExternalLink size={16} color="#ffffff" style={{ flexShrink: 0 }} />}
                  </a>

                  {/* Secondary on Android: .ics Native Calendar (Samsung / Outros / iOS) */}
                  <a
                    href={icsUrl}
                    onClick={() => handleSelectOption('ics')}
                    className="ad-addcal-option"
                    style={{
                      background: '#f8fafc',
                      color: '#0f172a',
                      border: '1.5px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: '#eef2ff', color: '#4f46e5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Smartphone size={20} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                          Calendário do Celular (iOS / Samsung)
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                          Arquivo .ics com lembrete automático
                        </div>
                      </div>
                    </div>
                    {justAdded === 'ics' ? <Check size={18} color="#10b981" /> : <CalendarPlus size={16} color="#4f46e5" style={{ flexShrink: 0 }} />}
                  </a>
                </>
              ) : (
                <>
                  {/* Primary on iOS & Default: Apple Calendar / Calendário do Celular (.ics) */}
                  <a
                    href={icsUrl}
                    onClick={() => handleSelectOption('ics')}
                    className="ad-addcal-option"
                    style={{
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                      color: '#ffffff',
                      border: '1px solid #0f172a',
                      boxShadow: '0 8px 20px rgba(15, 23, 42, 0.22)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'rgba(255, 255, 255, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Smartphone size={20} color="#ffffff" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                            Calendário do Celular (iOS / Apple)
                          </span>
                          <span style={{
                            fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
                            background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', textTransform: 'uppercase'
                          }}>
                            iPhone • iPad
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, marginTop: 2 }}>
                          Abre direto no Calendário do iOS ou app padrão
                        </div>
                      </div>
                    </div>
                    {justAdded === 'ics' ? <Check size={18} color="#10b981" /> : <CalendarPlus size={16} color="#ffffff" style={{ flexShrink: 0 }} />}
                  </a>

                  {/* Secondary: Google Agenda (Android / iOS) */}
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleSelectOption('google')}
                    className="ad-addcal-option"
                    style={{
                      background: '#eef2ff',
                      color: '#4338ca',
                      border: '1.5px solid #c7d2fe',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: '#ffffff', color: '#4f46e5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(99, 102, 241, 0.12)'
                      }}>
                        <Calendar size={20} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#1e1b4b' }}>
                            Google Agenda
                          </span>
                          <span style={{
                            fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
                            background: '#e0e7ff', color: '#4338ca', textTransform: 'uppercase'
                          }}>
                            Android • iOS
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 500, marginTop: 2 }}>
                          Salva diretamente no app Google Calendar
                        </div>
                      </div>
                    </div>
                    {justAdded === 'google' ? <Check size={18} color="#4f46e5" /> : <ExternalLink size={16} color="#4f46e5" style={{ flexShrink: 0 }} />}
                  </a>
                </>
              )}

              {/* Outlook / Outros */}
              <a
                href={outlookUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleSelectOption('outlook')}
                className="ad-addcal-option"
                style={{
                  background: '#ffffff',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: '#f1f5f9', color: '#475569',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Calendar size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                      Outlook / Microsoft Calendar
                    </div>
                  </div>
                </div>
                <ExternalLink size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
