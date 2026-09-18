'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Megaphone, Users, CheckCircle2, Loader2, Send, AlertTriangle, 
  X, Check, LogOut, ShieldCheck, Calendar 
} from 'lucide-react'
import { useSaida } from '@/lib/saidaContext'
import { triggerHaptic } from '@/lib/utils/haptics'
import { getInitials } from '@/lib/utils'
import { abbreviateName } from './StudentHeaderCard'

function PortalWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

function isStudentMatch(callStudentId?: any, studentId?: any, studentMatricula?: any): boolean {
  if (!callStudentId || (!studentId && !studentMatricula)) return false
  const cId = String(callStudentId).trim()
  if (!cId) return false
  const cleanCallId = cId.replace(/^0+/, '')
  const padCallId = cId.padStart(6, '0')

  const matches = (target?: any) => {
    if (!target) return false
    const t = String(target).trim()
    if (!t) return false
    if (cId === t) return true
    const cleanT = t.replace(/^0+/, '')
    if (cleanCallId && cleanT && cleanCallId === cleanT) return true
    if (padCallId === t.padStart(6, '0')) return true
    return false
  }

  if (studentId && matches(studentId)) return true
  if (studentMatricula && matches(studentMatricula)) return true

  return false
}

function formatTime(isoStr?: string): string {
  if (!isoStr) return ''
  try {
    let str = String(isoStr).trim()
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
      const parts = str.split(':')
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      str += '-04:00'
    }
    const d = new Date(str)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatFirstName(name?: string): string {
  if (!name) return ''
  const trimmed = name.trim()
  if (!trimmed) return ''
  const first = trimmed.split(/\s+/)[0]
  if (!first) return ''
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

export function StudentCallButton({
  aluno,
  currentUser,
  vinculo,
  onOpenModal,
  meusAlunos = []
}: {
  aluno: any
  currentUser: any
  vinculo?: any
  onOpenModal?: () => void
  meusAlunos?: any[]
}) {
  const searchParams = useSearchParams()
  const { activeCalls, cancelCall } = useSaida()
  const [localConfirmed, setLocalConfirmed] = useState(false)

  const espelharRespId = searchParams?.get('espelhar_responsavel')
  const espelharColabId = searchParams?.get('espelhar_colaborador')
  const isMirroringMode = !!(espelharRespId || espelharColabId || searchParams?.get('espelhar_aluno') === 'true')
  const espelharNome = searchParams?.get('espelhar_nome')
  
  const effectiveUser = useMemo(() => {
    if (isMirroringMode) {
      return { 
        ...currentUser, 
        id: espelharRespId || espelharColabId || currentUser.id, 
        nome: espelharNome || currentUser.nome 
      }
    }
    return currentUser
  }, [isMirroringMode, espelharRespId, espelharColabId, espelharNome, currentUser])

  const call = useMemo(() => {
    if (!aluno?.id) return null
    return activeCalls.find(c => {
      if (!c.studentId) return false
      return isStudentMatch(c.studentId, aluno.id, aluno.matricula)
    }) || null
  }, [activeCalls, aluno?.id, aluno?.matricula])

  const confirmedCall = useMemo(() => {
    if (!aluno?.id) return null
    return activeCalls.find(c => {
      if (!c.studentId || c.status !== 'confirmed') return false
      return isStudentMatch(c.studentId, aluno.id, aluno.matricula)
    }) || null
  }, [activeCalls, aluno?.id, aluno?.matricula])

  // Cache local de saída confirmada
  useEffect(() => {
    if (!aluno?.id) return
    const storageKey = `edu-confirmed-exit-${aluno.id}`

    let cachedId: string | null = null
    let isToday = false
    let cachedTime = 0
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        cachedId = parsed.callId
        isToday = parsed.time && new Date(parsed.time).toDateString() === new Date().toDateString()
        if (parsed.time) cachedTime = new Date(parsed.time).getTime()
      }
    } catch(e) {}

    const targetConfirmed = confirmedCall || (call?.status === 'confirmed' ? call : null) || activeCalls.find(ac => {
      return isStudentMatch(ac.studentId, aluno?.id, aluno?.matricula) && ac.status === 'confirmed'
    })

    if (targetConfirmed) {
      setLocalConfirmed(true)
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          callId: targetConfirmed.id,
          time: targetConfirmed.confirmedAt || targetConfirmed.calledAt || new Date().toISOString(),
          by: targetConfirmed.guardianName || ''
        }))
      } catch (e) {}
    } else if (call && (call.status === 'waiting' || call.status === 'called' || call.status === 'cancelled')) {
      if (cachedId && isToday) {
        const calledTime = call.calledAt ? new Date(call.calledAt).getTime() : 0
        if (cachedId !== call.id) {
          if (calledTime > cachedTime) {
            setLocalConfirmed(false)
            try { localStorage.removeItem(storageKey) } catch(e) {}
          } else {
            setLocalConfirmed(true)
          }
        } else if ((call.status === 'waiting' || call.status === 'called') && calledTime <= cachedTime) {
          setLocalConfirmed(true)
        } else {
          setLocalConfirmed(false)
          try { localStorage.removeItem(storageKey) } catch(e) {}
        }
      } else {
        setLocalConfirmed(false)
        try { localStorage.removeItem(storageKey) } catch(e) {}
      }
    } else {
      if (isToday) {
        setLocalConfirmed(true)
      } else {
        setLocalConfirmed(false)
        try { localStorage.removeItem(storageKey) } catch(e) {}
      }
    }
  }, [confirmedCall, call, aluno?.id, aluno?.matricula, activeCalls])

  // Validação de Custódia Judicial / Dias Restritos
  const { isProibido, isDiaRestrito, diasPermitidos } = useMemo(() => {
    let proibido = false
    let diaRestrito = false
    let dias: string[] = []

    const rawSaude = aluno?.dados?.saude || {}
    const autorizados = rawSaude.autorizados || []
    const responsaveis = aluno?.responsaveis || aluno?.dados?.responsaveis || []
    
    const currentNameKey = (effectiveUser?.nome || '').toLowerCase().trim()
    const currentId = vinculo?.id || effectiveUser?.responsavel_id || (effectiveUser?.dados?.responsavel_id) || effectiveUser?.id
    const currentEmail = (effectiveUser?.email || '').toLowerCase().trim()

    const findMatch = (list: any[]) => {
      return list.find((r: any) => {
        if (currentId && r.id && String(r.id) === String(currentId)) return true
        if (currentEmail && r.email && String(r.email).toLowerCase().trim() === currentEmail) return true
        if (currentNameKey && r.nome && String(r.nome).toLowerCase().trim() === currentNameKey) return true
        if (currentNameKey && r.nome) {
          const rName = String(r.nome).toLowerCase().trim()
          if (rName.includes(currentNameKey) || currentNameKey.includes(rName)) return true
        }
        return false
      })
    }

    let isFound = false
    const autMatch = findMatch(autorizados)
    if (autMatch) {
      isFound = true
      proibido = autMatch.proibido === true
      dias = autMatch.diasSemana || []
    } else {
      const respMatch = findMatch(responsaveis)
      if (respMatch) {
        isFound = true
        proibido = respMatch.proibido === true
        dias = respMatch.diasAcesso || respMatch.dias_acesso || respMatch.diasSemana || []
      } else if (responsaveis.length === 1) {
        isFound = true
        proibido = responsaveis[0].proibido === true
        dias = responsaveis[0].diasAcesso || responsaveis[0].dias_acesso || responsaveis[0].diasSemana || []
      }
    }

    if (isFound) {
      if (proibido) {
        diaRestrito = false
      } else if (dias.length === 0) {
        diaRestrito = true
      } else {
        const remap = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
        const todayIdx = new Date().getDay()
        const todayK = remap[todayIdx]
        if (!dias.includes(todayK)) {
          diaRestrito = true
        }
      }
    } else if (responsaveis.length > 0) {
      let anyAllowedToday = false
      const remap = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
      const todayK = remap[new Date().getDay()]

      for (const r of responsaveis) {
        if (r.proibido) continue
        const rDias = r.diasAcesso || r.dias_acesso || r.diasSemana || []
        if (rDias.includes(todayK)) {
          anyAllowedToday = true
          break
        }
      }

      if (!anyAllowedToday) {
        diaRestrito = true
        dias = responsaveis[0].diasAcesso || responsaveis[0].dias_acesso || responsaveis[0].diasSemana || []
      }
    }

    return { isProibido: proibido, isDiaRestrito: diaRestrito, diasPermitidos: dias }
  }, [aluno?.dados, aluno?.responsaveis, effectiveUser, vinculo])

  const allFamilyStudentIds = useMemo(() => {
    const set = new Set<string>()
    const addId = (rawId: any) => {
      if (rawId == null) return
      const s = String(rawId).trim()
      if (!s) return
      set.add(s)
      set.add(s.replace(/^0+/, ''))
      set.add(s.replace(/^0+/, '').padStart(6, '0'))
    }
    addId(aluno?.id)
    addId(aluno?.matricula)
    if (Array.isArray(meusAlunos)) {
      meusAlunos.forEach((a: any) => {
        addId(a?.id)
        addId(a?.matricula)
      })
    }
    return set
  }, [aluno?.id, aluno?.matricula, meusAlunos])

  const gId = effectiveUser?.id || 'usr-fam'

  const myCalls = useMemo(() => {
    const calls = activeCalls.filter(c => {
      const cStudentId = c.studentId ? String(c.studentId).trim() : ''
      const isMyStudent = cStudentId ? (allFamilyStudentIds.has(cStudentId) || (aluno?.id && isStudentMatch(cStudentId, aluno.id, aluno.matricula))) : false
      const isMyGuardian = gId && c.guardianId && String(c.guardianId).trim() === String(gId).trim()

      if (!isMyStudent && !isMyGuardian) return false

      return (
        c.status === 'waiting' || 
        c.status === 'called' || 
        c.status === 'special_auth' || 
        c.status === 'confirmed' ||
        c.status === 'blocked'
      )
    })
    const priority: any = { 'waiting': 1, 'called': 2, 'confirmed': 3, 'special_auth': 4, 'blocked': 5 }
    return calls.sort((a, b) => (priority[a.status] || 99) - (priority[b.status] || 99))
  }, [activeCalls, gId, allFamilyStudentIds, aluno?.id, aluno?.matricula])

  const isStudentConfirmedToday = useCallback((studentId: string, matricula?: any) => {
    if (!studentId) return false
    const sMat = matricula || meusAlunos?.find((a: any) => String(a.id) === String(studentId))?.matricula || (String(aluno?.id) === String(studentId) ? aluno?.matricula : undefined)
    const c = activeCalls.find(ac => {
      return isStudentMatch(ac.studentId, studentId, sMat) && ac.status === 'confirmed'
    })
    if (c) return true
    
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`edu-confirmed-exit-${studentId}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.time && new Date(parsed.time).toDateString() === new Date().toDateString()) {
            return true
          }
        }
      } catch (e) {}
    }
    return false
  }, [activeCalls, meusAlunos, aluno])

  const [pendingStudentIds, confirmedStudentIds, specialStudentIds] = useMemo(() => {
    const pending = new Set<string>()
    const confirmed = new Set<string>()
    const special = new Set<string>()

    for (const c of myCalls) {
      const sId = String(c.studentId).trim()
      if (pending.has(sId) || confirmed.has(sId) || special.has(sId)) continue
      
      if (c.status === 'waiting' || c.status === 'called') {
        pending.add(sId)
        pending.add(sId.replace(/^0+/, ''))
      } else if (c.status === 'confirmed') {
        confirmed.add(sId)
        confirmed.add(sId.replace(/^0+/, ''))
      } else if (c.status === 'special_auth') {
        special.add(sId)
        special.add(sId.replace(/^0+/, ''))
      }
    }
    return [pending, confirmed, special]
  }, [myCalls])

  const pendingCalls = myCalls.filter(c => (c.status === 'waiting' || c.status === 'called') && (
    pendingStudentIds.has(String(c.studentId).trim()) || pendingStudentIds.has(String(c.studentId).replace(/^0+/, ''))
  ))
  const specialAuthCalls = myCalls.filter(c => c.status === 'special_auth' && (
    specialStudentIds.has(String(c.studentId).trim()) || specialStudentIds.has(String(c.studentId).replace(/^0+/, ''))
  ))

  const pendingCount = pendingStudentIds.size
  const specialCount = specialStudentIds.size
  const callLabel = pendingCount > 1 ? 'Chamando Alunos' : 'Chamando Aluno'

  const currentStudentIdStr = aluno?.id ? String(aluno.id).trim() : ''
  const myCall = myCalls.find(c => {
    const cStudentId = c.studentId ? String(c.studentId).trim() : ''
    if (!cStudentId || !currentStudentIdStr) return false
    return isStudentMatch(cStudentId, currentStudentIdStr, aluno?.matricula)
  }) || call
  const isBlocked = myCall?.status === 'blocked'

  // O botão fica verde de confirmação se ESSE aluno específico foi confirmado hoje
  const isConfirmed = isStudentConfirmedToday(aluno?.id, aluno?.matricula) || localConfirmed || !!confirmedCall

  const isActiveState = (call && (call.status === 'waiting' || call.status === 'called')) ||
                        (myCall && (myCall.status === 'waiting' || myCall.status === 'called')) ||
                        (currentStudentIdStr ? pendingStudentIds.has(currentStudentIdStr) || pendingStudentIds.has(currentStudentIdStr.replace(/^0+/, '')) : false)

  const isSpecialAuth = (call && call.status === 'special_auth') ||
                        (myCall && myCall.status === 'special_auth') ||
                        (currentStudentIdStr ? specialStudentIds.has(currentStudentIdStr) || specialStudentIds.has(currentStudentIdStr.replace(/^0+/, '')) : false)

  const otherStudentsSummary = useMemo(() => {
    if (!meusAlunos || meusAlunos.length <= 1 || !aluno?.id) return null
    const otherStudents = meusAlunos.filter((a: any) => String(a.id) !== String(aluno?.id))
    if (otherStudents.length === 0) return null

    let confirmedCount = 0
    let pendingCount = 0

    for (const os of otherStudents) {
      const sId = String(os.id)
      if (isStudentConfirmedToday(sId)) {
        confirmedCount++
      } else if (pendingStudentIds.has(sId) || activeCalls.some(ac => isStudentMatch(ac.studentId, sId, os.matricula) && (ac.status === 'waiting' || ac.status === 'called'))) {
        pendingCount++
      }
    }

    if (confirmedCount === 0 && pendingCount === 0) return null

    const parts = []
    if (confirmedCount > 0) {
      parts.push(confirmedCount === 1 ? '1 outro aluno já retirado' : `${confirmedCount} outros alunos já retirados`)
    }
    if (pendingCount > 0) {
      parts.push(pendingCount === 1 ? '1 outro em chamada' : `${pendingCount} outros em chamada`)
    }

    return parts.join(' • ')
  }, [meusAlunos, aluno?.id, isStudentConfirmedToday, pendingStudentIds, activeCalls])

  const getConfirmedData = useCallback(() => {
    const targetCall = confirmedCall || (call?.status === 'confirmed' ? call : null) || activeCalls.find(ac => {
      return isStudentMatch(ac.studentId, aluno?.id, aluno?.matricula) && ac.status === 'confirmed'
    })

    if (targetCall) {
      return {
        by: targetCall.guardianName || '',
        time: targetCall.confirmedAt || targetCall.calledAt || new Date().toISOString()
      }
    }

    if (typeof window !== 'undefined' && aluno?.id) {
      try {
        const stored = localStorage.getItem(`edu-confirmed-exit-${aluno.id}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          return {
            by: parsed.by || '',
            time: parsed.time || new Date().toISOString()
          }
        }
      } catch (e) {}
    }

    return { by: '', time: new Date().toISOString() }
  }, [confirmedCall, call, activeCalls, aluno?.id, aluno?.matricula])

  const handleCallClick = () => {
    triggerHaptic('impactMedium')
    if (onOpenModal) {
      onOpenModal()
    }
  }

  // 1. Caso bloqueado por restrição judicial ou dia não permitido
  if (isProibido) {
    return (
      <div 
        className="ad-premium-cta-btn"
        style={{
          width: '100%',
          height: 56,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(248, 113, 113, 0.03) 100%)',
          border: '1.5px solid rgba(239, 68, 68, 0.28)',
          color: '#ef4444',
          boxShadow: '0 4px 14px rgba(239, 68, 68, 0.06)',
          cursor: 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 12,
          padding: '0 18px',
          fontFamily: 'Outfit, sans-serif',
          boxSizing: 'border-box',
          userSelect: 'none',
        }} 
        title="Você está proibido de retirar este aluno."
      >
        <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#ef4444' }}>
          <AlertTriangle size={20} strokeWidth={2.4} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ lineHeight: 1.2, fontSize: 14.5, fontWeight: 800, color: '#ef4444' }}>Retirada Proibida</span>
          <span style={{ fontSize: 11, opacity: 0.9, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left', fontWeight: 600, color: '#ef4444', marginTop: 2 }}>
            Liberado: {diasPermitidos.length > 0 ? diasPermitidos.join(', ') : 'Nenhum dia'}
          </span>
        </div>
      </div>
    )
  }

  if (isDiaRestrito) {
    return (
      <div 
        className="ad-premium-cta-btn"
        style={{
          width: '100%',
          height: 56,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.03) 100%)',
          border: '1.5px solid rgba(245, 158, 11, 0.28)',
          color: '#d97706',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.06)',
          cursor: 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 12,
          padding: '0 18px',
          fontFamily: 'Outfit, sans-serif',
          boxSizing: 'border-box',
          userSelect: 'none',
        }} 
        title={`Dias permitidos: ${diasPermitidos.join(', ')}`}
      >
        <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(245, 158, 11, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#d97706' }}>
          <Calendar size={20} strokeWidth={2.4} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ lineHeight: 1.2, fontSize: 14.5, fontWeight: 800, color: '#d97706' }}>Fora do Dia Permitido</span>
          <span style={{ fontSize: 11, opacity: 0.9, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left', fontWeight: 600, color: '#d97706', marginTop: 2 }}>
            Liberado: {diasPermitidos.join(', ')}
          </span>
        </div>
      </div>
    )
  }

  // 2. Aluno já confirmado retirado hoje
  if (isConfirmed) {
    const confData = getConfirmedData()
    const confTimeStr = formatTime(confData.time)
    
    let subtitle = ''
    const rawBy = (confData.by || '').trim()
    if (!rawBy && !confTimeStr) {
      subtitle = 'Confirmada na portaria'
    } else {
      let byLabel = ''
      if (rawBy) {
        if (rawBy.toLowerCase().includes('sozinho')) {
          byLabel = 'Saiu sozinho'
        } else if (rawBy.toLowerCase().includes('especial') || rawBy.toLowerCase().includes('autoriza')) {
          byLabel = 'Autorização especial'
        } else {
          byLabel = formatFirstName(rawBy)
        }
      }

      if (byLabel && confTimeStr) {
        subtitle = `${byLabel} às ${confTimeStr}`
      } else if (confTimeStr) {
        subtitle = `Confirmada às ${confTimeStr}`
      } else {
        subtitle = `Retirado por ${byLabel}`
      }
    }

    return (
      <div 
        className="ad-premium-cta-btn ad-confirmed-btn"
        style={{
          width: '100%',
          height: 56,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          color: '#ffffff',
          boxShadow: '0 6px 18px rgba(16, 185, 129, 0.35)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 10,
          cursor: 'default',
          userSelect: 'none',
          boxSizing: 'border-box',
          fontFamily: 'Outfit, sans-serif',
          border: 'none',
        }}
      >
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#ffffff',
        }}>
          <CheckCircle2 size={20} strokeWidth={2.6} />
        </div>
        <div style={{
          width: 1.5,
          height: 24,
          background: 'rgba(255, 255, 255, 0.25)',
          flexShrink: 0,
          margin: '0 2px'
        }} />
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden'
        }}>
          <span className="ad-call-btn-label" style={{ lineHeight: 1.2, fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
            Saída Confirmada!
          </span>
          <span style={{
            fontSize: 11,
            opacity: 0.95,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
            textAlign: 'left',
            marginTop: 2,
            fontWeight: 600,
            color: '#ffffff'
          }}>
            {subtitle}
          </span>
        </div>
      </div>
    )
  }

  // 3. Chamada ativa / aguardando
  if (isActiveState) {
    const activeCallToDisplay = (myCall && (myCall.status === 'waiting' || myCall.status === 'called')) 
      ? myCall 
      : (call && (call.status === 'waiting' || call.status === 'called')) 
        ? call 
        : null

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 56 }}>
        <button 
          onClick={() => {
            const thisStudentCalls = pendingCalls.filter(c => isStudentMatch(c.studentId, aluno?.id, aluno?.matricula))
            const toCancel = thisStudentCalls.length > 0 ? thisStudentCalls : (activeCallToDisplay ? [activeCallToDisplay] : [])
            toCancel.forEach(c => cancelCall(c.id))
          }}
          title="Cancelar chamada"
          style={{
            width: 46, height: 56, borderRadius: 16, cursor: 'pointer',
            background: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid rgba(239, 68, 68, 0.25)', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
        >
          <X size={20} />
        </button>
        <div style={{
          width: 'auto',
          flex: 1,
          minWidth: 0,
          height: 56,
          borderRadius: 20,
          background: 'linear-gradient(45deg, #f59e0b, #fbbf24, #f59e0b)',
          backgroundSize: '200% 200%',
          border: 'none',
          color: 'white',
          boxShadow: '0 6px 20px rgba(245, 158, 11, 0.3)',
          cursor: 'default',
          padding: '0 14px',
          alignItems: 'center',
          justifyContent: 'flex-start',
          display: 'flex',
          fontFamily: 'Outfit, sans-serif',
          boxSizing: 'border-box',
        }}>
          <Loader2 size={20} className="spin-anim" style={{ flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0, marginLeft: 10, overflow: 'hidden' }}>
            <span className="ad-call-btn-label" style={{ lineHeight: 1.2, fontSize: 15.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', color: '#ffffff' }}>{callLabel}</span>
            <span style={{ fontSize: 10.5, opacity: 0.95, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left', marginTop: 2, fontWeight: 600, color: '#ffffff' }}>
              por {activeCallToDisplay?.guardianName ? formatFirstName(activeCallToDisplay.guardianName) : 'Responsável'} às {formatTime(activeCallToDisplay?.calledAt)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // 4. Autorização especial enviada
  if (isSpecialAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 56 }}>
        <button 
          onClick={() => specialAuthCalls.forEach(c => {
             cancelCall(c.id)
          })}
          title="Cancelar autorização"
          style={{
            width: 46, height: 56, borderRadius: 16, cursor: 'pointer',
            background: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid rgba(239, 68, 68, 0.25)', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
        >
          <X size={20} />
        </button>
        <div style={{
          width: 'auto',
          flex: 1,
          minWidth: 0,
          height: 56,
          borderRadius: 20,
          background: 'linear-gradient(270deg, #f59e0b, #fbbf24, #f59e0b)',
          backgroundSize: '300% 300%',
          border: 'none',
          color: 'white',
          boxShadow: '0 6px 20px rgba(245, 158, 11, 0.3)',
          cursor: 'default',
          padding: '0 14px',
          justifyContent: 'flex-start',
          alignItems: 'center',
          display: 'flex',
          fontFamily: 'Outfit, sans-serif',
          boxSizing: 'border-box',
        }} className="ad-sab-active">
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 0 0 rgba(255,255,255,0.7)',
            flexShrink: 0
          }} className="sab-pulse-dot" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0, marginLeft: 8, overflow: 'hidden' }}>
            <span className="ad-call-btn-label" style={{ lineHeight: 1.2, fontSize: 14.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', color: '#ffffff' }}>
              {specialCount > 1 ? 'Autorizações Ativas' : 'Autorização Ativa'}
            </span>
            <span style={{ fontSize: 10.5, opacity: 0.95, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left', marginTop: 2, fontWeight: 600, color: '#ffffff' }}>
              {specialAuthCalls.length > 0 ? (specialAuthCalls[0].guardianName ? specialAuthCalls[0].guardianName.split('—')[0].trim() : 'Aguardando portaria') : 'Aguardando portaria'}
            </span>
          </div>
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.95)', fontWeight: 700, flexShrink: 0, marginLeft: 'auto' }}>
            {formatTime(specialAuthCalls.length > 0 ? specialAuthCalls[0].calledAt : undefined)}
          </span>
        </div>
      </div>
    )
  }

  // 5. Caso bloqueado
  if (isBlocked) {
    return (
      <div 
        className="ad-premium-cta-btn"
        style={{
          width: '100%',
          height: 56,
          borderRadius: 20,
          background: 'rgba(239, 68, 68, 0.08)',
          border: '2px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          cursor: 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 12,
          padding: '0 18px',
          fontFamily: 'Outfit, sans-serif',
          boxSizing: 'border-box',
          userSelect: 'none',
        }}
      >
        <AlertTriangle size={20} strokeWidth={2.4} />
        <span className="ad-call-btn-label" style={{ color: '#ef4444', fontSize: 15, fontWeight: 800 }}>Acesso Bloqueado</span>
      </div>
    )
  }

  // 6. Botão padrão de Chamada
  return (
    <button
      className="ad-premium-cta-btn"
      onClick={handleCallClick}
      style={{
        width: '100%',
        height: 56,
        borderRadius: 20,
        border: 'none',
        background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 45%, #4f46e5 100%)',
        color: '#ffffff',
        boxShadow: '0 6px 18px rgba(37, 99, 235, 0.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 12,
        padding: otherStudentsSummary ? '8px 18px' : '0 18px',
        cursor: 'pointer',
        fontFamily: 'Outfit, sans-serif',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1.5px)'
        e.currentTarget.style.boxShadow = '0 10px 24px rgba(37, 99, 235, 0.38)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(37, 99, 235, 0.28)'
      }}
    >
      <div className="ad-call-icon-box" style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Megaphone size={20} strokeWidth={2.3} />
      </div>
      <div className="ad-call-divider" style={{ width: 1.5, height: 26, background: 'rgba(255, 255, 255, 0.28)', flexShrink: 0, margin: '0 2px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <span className="ad-call-btn-label" style={{ lineHeight: 1.2, fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.2px' }}>Chamar aluno</span>
        {otherStudentsSummary && (
          <span style={{ fontSize: 10.5, opacity: 0.9, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left', marginTop: 2, fontWeight: 600 }}>
            {otherStudentsSummary}
          </span>
        )}
      </div>
    </button>
  )
}

interface StudentCallControllerProps {
  aluno: any
  currentUser: any
  vinculo: any
  meusAlunos: any[]
  turmas: any[]
  adConfig: any
  isMirrorModeActive: boolean
  onLogout: () => void
}

export const StudentCallController = React.memo(function StudentCallController({
  aluno,
  currentUser,
  vinculo,
  meusAlunos,
  turmas,
  adConfig,
  isMirrorModeActive,
  onLogout
}: StudentCallControllerProps) {
  const { callStudent, addSpecialAuth, activeCalls } = useSaida()
  
  const [isSpecialAuthModalOpen, setIsSpecialAuthModalOpen] = useState(false)
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([])
  const [specialAuthText, setSpecialAuthText] = useState('')
  const [specialAuthSending, setSpecialAuthSending] = useState(false)
  const [specialAuthSent, setSpecialAuthSent] = useState(false)
  const specialAuthTextRef = useRef<HTMLTextAreaElement>(null)

  const handleOpenModal = useCallback(() => {
    setIsSpecialAuthModalOpen(true)
    const all = meusAlunos && meusAlunos.length > 0 ? meusAlunos : (aluno ? [aluno] : [])
    const isConfirmed = (sId: string, matricula?: any) => {
      if (activeCalls.some(c => isStudentMatch(c.studentId, sId, matricula) && c.status === 'confirmed')) return true
      try {
        const stored = localStorage.getItem(`edu-confirmed-exit-${sId}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.time && new Date(parsed.time).toDateString() === new Date().toDateString()) return true
        }
      } catch(e) {}
      return false
    }
    const unconfirmedIds = all.filter((a: any) => !isConfirmed(a.id, a.matricula)).map((a: any) => a.id)
    if (unconfirmedIds.length > 0) {
      setSelectedAlunos(unconfirmedIds)
    } else if (aluno?.id) {
      setSelectedAlunos([aluno.id])
    } else {
      setSelectedAlunos([])
    }
  }, [meusAlunos, aluno, activeCalls])

  const handleNormalCallConfirm = useCallback(() => {
    if (isMirrorModeActive) {
      alert("Ação desabilitada no modo de visualização/espelhamento.")
      return
    }
    if (selectedAlunos.length === 0) return
    triggerHaptic('success')
    const gName = currentUser?.nome || 'Responsável'
    const gId = currentUser?.id || 'usr-fam'
    
    selectedAlunos.forEach(id => {
      const a = meusAlunos?.find((x: any) => x.id === id) || (aluno?.id === id ? aluno : null)
      if (a) {
        const tObj = (turmas || []).find((t: any) => t && (String(t.id) === String(a.turma) || String(t.codigo) === String(a.turma) || String(t.nome) === String(a.turma)))
        let aTurma = tObj?.nome || a.turma_nome || a.turma || 'S/T'
        if (aTurma && aTurma !== 'S/T' && aTurma.includes('-')) {
          aTurma = aTurma.split('-')[0].trim()
        }
        callStudent(a.id, a.nome, aTurma, gId, gName, 'manual', undefined, a.foto || a.imagem1)
      }
    })

    setIsSpecialAuthModalOpen(false)
  }, [selectedAlunos, meusAlunos, aluno, turmas, currentUser, callStudent, isMirrorModeActive])

  const handleSpecialAuthConfirm = useCallback(async () => {
    if (isMirrorModeActive) {
      alert("Ação desabilitada no modo de visualização/espelhamento.")
      return
    }
    if (!specialAuthText.trim() || selectedAlunos.length === 0) return
    setSpecialAuthSending(true)
    triggerHaptic('impactMedium')

    try {
      const gName = currentUser?.nome || 'Responsável'
      await Promise.all(selectedAlunos.map(async id => {
        const a = meusAlunos?.find((x: any) => x.id === id) || (aluno?.id === id ? aluno : null)
        if (!a) return
        
        const tObj = (turmas || []).find((t: any) => t && (String(t.id) === String(a.turma) || String(t.codigo) === String(a.turma) || String(t.nome) === String(a.turma)))
        let aTurma = tObj?.nome || a.turma_nome || a.turma || 'S/T'
        if (aTurma && aTurma !== 'S/T' && aTurma.includes('-')) {
          aTurma = aTurma.split('-')[0].trim()
        }

        const newCall = addSpecialAuth(
          a.id,
          a.nome,
          aTurma,
          specialAuthText.trim(),
          gName,
          a.foto || a.imagem1 || null,
        )

        await fetch('/api/saida/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newCall.id,
            studentId: newCall.studentId,
            studentName: newCall.studentName,
            studentClass: newCall.studentClass,
            studentPhoto: newCall.studentPhoto,
            guardianId: newCall.guardianId,
            guardianName: newCall.guardianName,
            operatorId: newCall.operatorId,
            calledAt: newCall.calledAt,
            status: 'special_auth',
            source: 'agenda_digital',
          })
        }).catch(err => console.warn('[SpecialAuth] DB persist failed:', err))
      }))

      triggerHaptic('success')
      setSpecialAuthSent(true)
      setTimeout(() => {
        setIsSpecialAuthModalOpen(false)
        setSpecialAuthText('')
        setSpecialAuthSent(false)
      }, 2000)
    } catch (err) {
      console.error('Erro ao registrar autorização especial:', err)
      triggerHaptic('error')
    } finally {
      setSpecialAuthSending(false)
    }
  }, [specialAuthText, selectedAlunos, meusAlunos, aluno, turmas, currentUser, addSpecialAuth, isMirrorModeActive])

  const isAlunoCargo = currentUser?.cargo === 'Aluno'

  return (
    <>
      <div className="ad-actions-container">
        {adConfig?.permissoes?.chamadaAlunoPortaria !== false && (
          <div className="ad-hero-call-row">
            <StudentCallButton 
              aluno={aluno} 
              currentUser={currentUser} 
              vinculo={vinculo} 
              onOpenModal={handleOpenModal} 
              meusAlunos={meusAlunos}
            />
          </div>
        )}
        
        {!isAlunoCargo && (
          <div className="ad-secondary-actions-grid">
            <Link 
              href="/agenda-digital/selecionar-aluno"
              title="Trocar de Aluno"
              className="ad-discreet-btn ad-discreet-switch"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8.5" cy="7" r="3.5" />
                <path d="M2.5 19.5c0-3.3 2.7-6 6-6h2" />
                <path d="M17 5a3.5 3.5 0 0 1 3.5 3.5" />
                <polyline points="18 10 20.5 8.5 23 10" />
                <path d="M20.5 14.5a3.5 3.5 0 0 1-3.5 3.5" />
                <polyline points="15 17 17 19 19 17" />
              </svg>
              <span>Trocar aluno</span>
            </Link>

            <button 
              onClick={onLogout}
              title="Sair da Conta"
              className="ad-discreet-btn ad-discreet-logout"
            >
              <LogOut size={15} strokeWidth={2.2} />
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Chamada / Autorização Especial */}
      <PortalWrapper>
        <AnimatePresence>
          {isSpecialAuthModalOpen && (
            <motion.div
              key="special-auth-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '0 16px',
                overscrollBehavior: 'none'
              }}
              onClick={() => {
                if (!specialAuthSending) {
                  setIsSpecialAuthModalOpen(false)
                  setSpecialAuthText('')
                }
              }}
            >
              <motion.div
                key="special-auth-modal-box"
                initial={{ scale: 0.92, opacity: 0, y: 24 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 24 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                className="ad-modal-container"
                style={{
                  background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                  borderRadius: 28,
                  padding: '28px 28px 24px',
                  width: '100%',
                  maxWidth: 440,
                  boxShadow: '0 32px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                  fontFamily: 'Outfit, sans-serif'
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Decorative gradient blob */}
                <div style={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 200,
                  height: 200,
                  background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: -40,
                  left: -40,
                  width: 160,
                  height: 160,
                  background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }} />

                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 20,
                  position: 'relative',
                  zIndex: 1
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                        flexShrink: 0,
                      }}>
                        <Megaphone size={18} color="#fff" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 style={{
                          fontSize: 18,
                          fontWeight: 900,
                          color: '#0f172a',
                          margin: 0,
                          fontFamily: 'Outfit, sans-serif',
                          letterSpacing: '-0.02em'
                        }}>
                          Opções de Retirada
                        </h3>
                        <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.3 }}>
                          Como deseja retirar o(a) aluno(a)?
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!specialAuthSending) {
                        setIsSpecialAuthModalOpen(false)
                        setSpecialAuthText('')
                      }
                    }}
                    style={{
                      background: 'rgba(0,0,0,0.03)',
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: 10,
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#64748b',
                      flexShrink: 0,
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Student Cards List */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginBottom: 24,
                  position: 'relative',
                  zIndex: 1,
                  maxHeight: 300,
                  overflowY: 'auto',
                  paddingRight: 4
                }}>
                  {(meusAlunos && meusAlunos.length > 0 ? meusAlunos : (aluno ? [aluno] : [])).map((a: any) => {
                    const tObj = (turmas || []).find((t: any) => t && (String(t.id) === String(a.turma) || String(t.codigo) === String(a.turma) || String(t.nome) === String(a.turma)))
                    let aTurma = tObj?.nome || a.turma_nome || a.turma || 'S/T'
                    if (aTurma && aTurma !== 'S/T' && aTurma.includes('-')) {
                      aTurma = aTurma.split('-')[0].trim()
                    }
                    const isSelected = selectedAlunos.includes(a.id)

                    const isConfirmedExit = (() => {
                      if (activeCalls.some(c => isStudentMatch(c.studentId, a.id, a.matricula) && c.status === 'confirmed')) return true
                      try {
                        const stored = localStorage.getItem(`edu-confirmed-exit-${a.id}`)
                        if (stored) {
                          const parsed = JSON.parse(stored)
                          if (parsed.time && new Date(parsed.time).toDateString() === new Date().toDateString()) return true
                        }
                      } catch(e) {}
                      return false
                    })()

                    const isPendingCall = activeCalls.some(c => isStudentMatch(c.studentId, a.id, a.matricula) && (c.status === 'waiting' || c.status === 'called'))

                    return (
                      <div 
                        key={a.id}
                        onClick={() => {
                          if (isConfirmedExit) return
                          if (isSelected) {
                            setSelectedAlunos(prev => prev.filter(id => id !== a.id))
                          } else {
                            setSelectedAlunos(prev => [...prev, a.id])
                          }
                        }}
                        style={{
                          background: isConfirmedExit 
                            ? 'rgba(0,0,0,0.02)' 
                            : isSelected ? 'rgba(99,102,241,0.05)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${isConfirmedExit ? 'rgba(0,0,0,0.04)' : isSelected ? 'rgba(99,102,241,0.3)' : 'rgba(0,0,0,0.04)'}`,
                          borderRadius: 18,
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          cursor: isConfirmedExit ? 'not-allowed' : 'pointer',
                          opacity: isConfirmedExit ? 0.6 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{
                          width: 52,
                          height: 52,
                          borderRadius: 16,
                          flexShrink: 0,
                          overflow: 'hidden',
                          background: isConfirmedExit ? '#cbd5e1' : 'linear-gradient(135deg, #a855f7, #ec4899)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 900,
                          color: '#fff',
                          boxShadow: isSelected && !isConfirmedExit ? '0 4px 16px rgba(168,85,247,0.25)' : 'none',
                          filter: isConfirmedExit ? 'grayscale(0.6)' : 'none',
                        }}>
                          {a.foto || a.imagem1
                            ? <img src={a.foto || a.imagem1} alt={a.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : getInitials(a.nome || '')
                          }
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: isConfirmedExit ? '#64748b' : '#0f172a',
                            fontFamily: 'Outfit, sans-serif',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {abbreviateName(a.nome || '')}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Turma:</span>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: isConfirmedExit ? '#64748b' : '#4f46e5',
                              background: isConfirmedExit ? 'rgba(0,0,0,0.05)' : 'rgba(99,102,241,0.1)',
                              padding: '2px 8px',
                              borderRadius: 100,
                            }}>{aTurma}</span>
                            {isConfirmedExit && (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: '#059669',
                                background: 'rgba(16,185,129,0.12)',
                                padding: '2px 8px',
                                borderRadius: 100,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <CheckCircle2 size={12} /> Retirado
                              </span>
                            )}
                            {isPendingCall && (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: '#d97706',
                                background: 'rgba(245,158,11,0.12)',
                                padding: '2px 8px',
                                borderRadius: 100,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <Loader2 size={12} className="spin-anim" /> Em chamada
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Checkbox / Disabled Indicator */}
                        {isConfirmedExit ? (
                          <div 
                            title="Aluno já retirado hoje"
                            style={{ 
                              width: 24,
                              height: 24,
                              borderRadius: 8,
                              flexShrink: 0,
                              border: '1px solid rgba(0,0,0,0.1)',
                              background: 'rgba(0,0,0,0.04)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <X size={14} color="#94a3b8" strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div style={{ 
                            width: 24,
                            height: 24,
                            borderRadius: 8,
                            flexShrink: 0,
                            border: `2px solid ${isSelected ? '#6366f1' : 'rgba(0,0,0,0.15)'}`,
                            background: isSelected ? '#6366f1' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}>
                            {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Primary Action: Normal Call */}
                <div style={{ position: 'relative', zIndex: 1, marginBottom: 24 }}>
                  <button
                    onClick={handleNormalCallConfirm}
                    disabled={specialAuthSending || specialAuthSent || selectedAlunos.length === 0}
                    style={{
                      width: '100%',
                      height: 56,
                      borderRadius: 16,
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 800,
                      cursor: (specialAuthSending || specialAuthSent || selectedAlunos.length === 0) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      fontFamily: 'Outfit, sans-serif',
                      transition: 'all 0.3s',
                      boxShadow: '0 8px 24px rgba(16,185,129,0.25)',
                      opacity: (specialAuthSending || specialAuthSent || selectedAlunos.length === 0) ? 0.6 : 1
                    }}
                    onMouseEnter={e => {
                      if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <Megaphone size={18} strokeWidth={2.5} />
                    <span>{selectedAlunos.length > 1 ? 'Eu vim buscar (Chamar Alunos)' : 'Eu vim buscar (Chamar Aluno)'}</span>
                  </button>
                </div>

                {/* Divider */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ou Outra Pessoa</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
                </div>

                {/* Text Field */}
                <div style={{ position: 'relative', zIndex: 1, marginBottom: 20 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                  }}>
                    Quem irá buscar + Observação <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    ref={specialAuthTextRef}
                    value={specialAuthText}
                    onChange={e => setSpecialAuthText(e.target.value)}
                    placeholder="Ex: Avó Maria Silva — irá buscar às 17h30, carro prata..."
                    rows={3}
                    disabled={specialAuthSending || specialAuthSent}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: `1.5px solid ${specialAuthText.trim() ? 'rgba(245,158,11,0.5)' : 'rgba(0,0,0,0.08)'}`,
                      background: 'rgba(0,0,0,0.02)',
                      fontSize: 13,
                      color: '#0f172a',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'Outfit, sans-serif',
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                  />
                  {!specialAuthText.trim() && (
                    <p style={{ fontSize: 10, color: '#f87171', margin: '5px 0 0', fontWeight: 600 }}>
                      Campo obrigatório caso vá usar autorização especial.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, position: 'relative', zIndex: 1 }}>
                  <button
                    onClick={handleSpecialAuthConfirm}
                    disabled={!specialAuthText.trim() || specialAuthSending || specialAuthSent || selectedAlunos.length === 0}
                    style={{
                      width: '100%',
                      height: 46,
                      borderRadius: 14,
                      border: 'none',
                      background: specialAuthSent
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : !specialAuthText.trim() || specialAuthSending
                          ? 'rgba(0,0,0,0.04)'
                          : 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: !specialAuthText.trim() && !specialAuthSent ? '#94a3b8' : '#fff',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: specialAuthText.trim() && !specialAuthSending && !specialAuthSent ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontFamily: 'Outfit, sans-serif',
                      transition: 'all 0.3s',
                      boxShadow: specialAuthText.trim() && !specialAuthSending && !specialAuthSent
                        ? '0 8px 24px rgba(245,158,11,0.35)'
                        : 'none',
                    }}
                  >
                    {specialAuthSent ? (
                      <><CheckCircle2 size={16} /> Autorização Registrada!</>
                    ) : specialAuthSending ? (
                      <><Loader2 size={16} className="spin-anim" /> Enviando...</>
                    ) : (
                      <><Send size={15} /> Confirmar Autorização Especial</>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </PortalWrapper>
    </>
  )
})
