'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Megaphone, Users, CheckCircle2, Loader2, Send, AlertTriangle, 
  X, Check, LogOut, ShieldCheck 
} from 'lucide-react'
import { useSaida } from '@/lib/saidaContext'
import { triggerHaptic } from '@/lib/utils/haptics'
import { abbreviateName } from './StudentHeaderCard'

function PortalWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || typeof document === 'undefined') return null
  return createPortal(children, document.body)
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
  const { activeCalls, callStudent, cancelCall } = useSaida()
  const [localConfirmed, setLocalConfirmed] = useState(false)

  const call = activeCalls.find(c => {
    if (!aluno?.id || !c.studentId) return false
    const sId = String(c.studentId).trim()
    const aId = String(aluno.id).trim()
    return sId === aId || sId === aId.replace(/^0+/, '') || sId.padStart(6, '0') === aId.padStart(6, '0')
  })

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

    if (call?.status === 'confirmed') {
      setLocalConfirmed(true)
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          callId: call.id,
          time: call.confirmedAt || new Date().toISOString(),
          by: call.guardianName || ''
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
    }
  }, [call?.status, call?.id, call?.confirmedAt, call?.guardianName, call?.calledAt, aluno?.id])

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
  }, [aluno?.dados, effectiveUser, vinculo])

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
      const isMyStudent = cStudentId ? (allFamilyStudentIds.has(cStudentId) || (aluno?.id && String(aluno.id).trim() === cStudentId)) : false
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
  }, [activeCalls, gId, allFamilyStudentIds, aluno?.id])

  const isStudentConfirmedToday = useCallback((studentId: string) => {
    if (!studentId) return false
    const sId = String(studentId).trim()
    const c = activeCalls.find(ac => {
      const acId = ac.studentId ? String(ac.studentId).trim() : ''
      return (acId === sId || acId === sId.replace(/^0+/, '') || acId.padStart(6, '0') === sId.padStart(6, '0')) && ac.status === 'confirmed'
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
  }, [activeCalls])

  const currentStudentIdStr = aluno?.id ? String(aluno.id).trim() : ''
  const myCall = myCalls.find(c => {
    const cStudentId = c.studentId ? String(c.studentId).trim() : ''
    if (!cStudentId || !currentStudentIdStr) return false
    return cStudentId === currentStudentIdStr || allFamilyStudentIds.has(cStudentId)
  }) || call

  const isConfirmed = isStudentConfirmedToday(aluno?.id) || localConfirmed
  const isPending = call?.status === 'waiting' || call?.status === 'called' || myCall?.status === 'waiting' || myCall?.status === 'called'
  const isSpecial = call?.status === 'special_auth' || myCall?.status === 'special_auth'

  const handleCallClick = () => {
    triggerHaptic('impactMedium')
    if (onOpenModal) {
      onOpenModal()
    }
  }

  // 1. Caso bloqueado por restrição judicial
  if (isProibido || isDiaRestrito) {
    return (
      <div style={{
        width: '100%', height: 48, borderRadius: 14,
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1.5px solid rgba(239, 68, 68, 0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        color: '#ef4444', fontSize: 13, fontWeight: 700, fontFamily: 'Outfit, sans-serif'
      }}>
        <AlertTriangle size={17} strokeWidth={2.4} />
        <span>{isProibido ? 'Retirada Bloqueada' : 'Dia Não Permitido'}</span>
      </div>
    )
  }

  // 2. Aluno já confirmado retirado hoje
  if (isConfirmed) {
    return (
      <div style={{
        width: '100%', height: 48, borderRadius: 14,
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1.5px solid rgba(16, 185, 129, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        color: '#059669', fontSize: 13, fontWeight: 800, fontFamily: 'Outfit, sans-serif'
      }}>
        <CheckCircle2 size={18} strokeWidth={2.5} />
        <span>Saída Confirmada Hoje</span>
      </div>
    )
  }

  // 3. Chamada ativa / aguardando
  if (isPending) {
    return (
      <div style={{
        width: '100%', height: 48, borderRadius: 14,
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1.5px solid rgba(245, 158, 11, 0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        color: '#d97706', fontSize: 13, fontWeight: 800, fontFamily: 'Outfit, sans-serif'
      }}>
        <Loader2 size={17} className="spin-anim" />
        <span>Aluno Chamado na Portaria</span>
      </div>
    )
  }

  // 4. Autorização especial enviada
  if (isSpecial) {
    return (
      <div style={{
        width: '100%', height: 48, borderRadius: 14,
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1.5px solid rgba(99, 102, 241, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        color: '#4f46e5', fontSize: 13, fontWeight: 800, fontFamily: 'Outfit, sans-serif'
      }}>
        <ShieldCheck size={18} strokeWidth={2.4} />
        <span>Autorização Especial Ativa</span>
      </div>
    )
  }

  // 5. Botão padrão de Chamada
  return (
    <button
      onClick={handleCallClick}
      style={{
        width: '100%', height: 48, borderRadius: 14, border: 'none',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: '#ffffff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
        fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <Megaphone size={17} strokeWidth={2.4} />
      <span>Chamar Aluno (Portaria)</span>
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
    const isConfirmed = (sId: string) => {
      if (activeCalls.some(c => String(c.studentId) === String(sId) && c.status === 'confirmed')) return true
      try {
        const stored = localStorage.getItem(`edu-confirmed-exit-${sId}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.time && new Date(parsed.time).toDateString() === new Date().toDateString()) return true
        }
      } catch(e) {}
      return false
    }
    const unconfirmedIds = all.filter((a: any) => !isConfirmed(a.id)).map((a: any) => a.id)
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(8px)',
                zIndex: 99999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => {
                if (!specialAuthSending && !specialAuthSent) setIsSpecialAuthModalOpen(false)
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 16 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                onClick={e => e.stopPropagation()}
                style={{
                  background: '#ffffff',
                  borderRadius: 24,
                  padding: '28px 24px',
                  width: '100%',
                  maxWidth: 440,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  position: 'relative',
                  overflow: 'hidden',
                  fontFamily: 'Outfit, sans-serif'
                }}
              >
                {/* Header do Modal */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: 'rgba(16, 185, 129, 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#059669'
                    }}>
                      <Megaphone size={20} strokeWidth={2.4} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Saída de Alunos
                      </h3>
                      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                        Selecione quem será chamado
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSpecialAuthModalOpen(false)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Lista de Alunos da Família */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, maxHeight: 200, overflowY: 'auto' }}>
                  {(meusAlunos && meusAlunos.length > 0 ? meusAlunos : [aluno]).filter(Boolean).map((a: any) => {
                    const isSelected = selectedAlunos.includes(a.id)
                    return (
                      <div
                        key={a.id}
                        onClick={() => {
                          setSelectedAlunos(prev => 
                            prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                          )
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', borderRadius: 14,
                          background: isSelected ? 'rgba(99, 102, 241, 0.06)' : '#f8fafc',
                          border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                          {abbreviateName(a.nome || '')}
                        </span>
                        <div style={{
                          width: 20, height: 20, borderRadius: 6,
                          border: `2px solid ${isSelected ? '#6366f1' : '#cbd5e1'}`,
                          background: isSelected ? '#6366f1' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Ação Principal: Normal Call */}
                <div style={{ marginBottom: 16 }}>
                  <button
                    onClick={handleNormalCallConfirm}
                    disabled={specialAuthSending || specialAuthSent || selectedAlunos.length === 0}
                    style={{
                      width: '100%', height: 48, borderRadius: 14, border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <Megaphone size={16} strokeWidth={2.4} />
                    <span>Estou na portaria (Chamar agora)</span>
                  </button>
                </div>

                {/* Divisor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Ou autorizar terceiro</span>
                  <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                </div>

                {/* Campo de autorização especial */}
                <div style={{ marginBottom: 16 }}>
                  <textarea
                    ref={specialAuthTextRef}
                    value={specialAuthText}
                    onChange={e => setSpecialAuthText(e.target.value)}
                    placeholder="Nome de quem vai buscar e observações..."
                    rows={2}
                    disabled={specialAuthSending || specialAuthSent}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 12,
                      border: '1.5px solid #e2e8f0', background: '#f8fafc',
                      fontSize: 13, color: '#0f172a', resize: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button
                  onClick={handleSpecialAuthConfirm}
                  disabled={!specialAuthText.trim() || specialAuthSending || specialAuthSent || selectedAlunos.length === 0}
                  style={{
                    width: '100%', height: 42, borderRadius: 12, border: 'none',
                    background: specialAuthSent 
                      ? '#10b981' 
                      : !specialAuthText.trim() ? '#f1f5f9' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: !specialAuthText.trim() ? '#94a3b8' : '#fff',
                    fontSize: 13, fontWeight: 700,
                    cursor: specialAuthText.trim() && !specialAuthSending ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  {specialAuthSent ? (
                    <><CheckCircle2 size={16} /> Autorização Registrada!</>
                  ) : specialAuthSending ? (
                    <><Loader2 size={16} className="spin-anim" /> Enviando...</>
                  ) : (
                    <><Send size={14} /> Enviar Autorização Especial</>
                  )}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </PortalWrapper>
    </>
  )
})
