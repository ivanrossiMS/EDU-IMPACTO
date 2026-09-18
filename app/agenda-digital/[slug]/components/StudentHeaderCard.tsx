'use client'

import React from 'react'
import { GraduationCap, Calendar, Users, DollarSign, BookOpen, LogOut } from 'lucide-react'
import { getInitials } from '@/lib/utils'

export function abbreviateName(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 2) return name
  const first = parts[0]
  const last = parts[parts.length - 1]
  const middle = parts.slice(1, -1).map(p => {
    if (['de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase())) return p
    return p.charAt(0).toUpperCase() + '.'
  }).join(' ')
  return `${first} ${middle} ${last}`
}

interface StudentHeaderCardProps {
  aluno: any
  cleanTurma: string
  cleanTurno: string
  currentUser: any
  isMirroringAluno: boolean
  espelharRespId: string | null
  profileData: any
  userAccessRole: { isFin: boolean; isPed: boolean; parentesco: string }
  onLogout: () => void
}

export const StudentHeaderCard = React.memo(function StudentHeaderCard({
  aluno,
  cleanTurma,
  cleanTurno,
  currentUser,
  isMirroringAluno,
  espelharRespId,
  profileData,
  userAccessRole,
  onLogout
}: StudentHeaderCardProps) {
  const isAlunoCargo = currentUser?.cargo === 'Aluno'

  const mirroredResp = espelharRespId && profileData?.aluno?.responsaveis 
    ? profileData.aluno.responsaveis.find((r: any) => String(r.id) === String(espelharRespId)) 
    : null
  const rawName = mirroredResp?.nome || currentUser?.nome || (aluno as any)?.responsavel || 'Responsável'
  const respFullName = abbreviateName(rawName)

  return (
    <div className="ad-premium-card-header-flex" style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
      {/* Avatar do Aluno com Efeito Glass e Iniciais */}
      <div 
        className="ad-premium-card-avatar" 
        style={{ 
          width: 90, 
          height: 90, 
          borderRadius: 20, 
          background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', 
          boxShadow: '0 8px 24px rgba(168,85,247,0.3)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'white', 
          fontWeight: 900, 
          fontSize: 28, 
          fontFamily: 'Outfit, sans-serif',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {aluno?.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={aluno.foto} alt={aluno?.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          getInitials(aluno?.nome || '')
        )}
        <div style={{ 
          position: 'absolute', top: 0, left: 0, right: 0,
          width: '100vw', height: '50%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(255,255,255,0))' 
        }} />
      </div>
      
      {/* Informações: Nome e Badges */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, minWidth: 0, flex: 1, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%' }}>
          <h2 className="ad-premium-student-name" style={{ fontSize: 21, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', minWidth: 0, lineHeight: 1.15 }}>
            <span style={{ whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {abbreviateName(aluno?.nome || 'Carregando...')}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#6366f1" style={{ flexShrink: 0 }}>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </h2>
          {isAlunoCargo && (
            <button 
              onClick={onLogout}
              title="Sair da Conta"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                border: '1.5px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '12px',
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              <LogOut size={13} strokeWidth={2.4} /> <span className="ad-desktop-only">Sair</span>
            </button>
          )}
        </div>

        {/* Badges: Turma + Turno + Responsável */}
        <div className="ad-modern-badges-container">
          <div className="ad-modern-badges-top-row">
            {/* Badge 1: Turma */}
            <div className="ad-modern-badge badge-turma" title={`Turma: ${cleanTurma}`}>
              <div className="ad-badge-icon-box turma-icon">
                <GraduationCap size={12} strokeWidth={2.4} />
              </div>
              <span className="ad-badge-text">{cleanTurma}</span>
            </div>

            {/* Badge 2: Turno */}
            <div className="ad-modern-badge badge-turno" title={`Turno: ${cleanTurno}`}>
              <div className="ad-badge-icon-box turno-icon">
                <Calendar size={12} strokeWidth={2.4} />
              </div>
              <span className="ad-badge-text">{cleanTurno}</span>
            </div>
          </div>

          {/* Badge 3: Responsável */}
          {(!isAlunoCargo && !isMirroringAluno) && (
            <div className="ad-modern-badge badge-resp" title={`Responsável: ${rawName}`}>
              <div className="ad-badge-resp-left">
                <div className="ad-badge-icon-box resp-icon">
                  <Users size={12} strokeWidth={2.4} />
                </div>
                <div className="ad-badge-resp-info">
                  <span className="ad-badge-resp-label">Responsável</span>
                  <span className="ad-badge-text resp-name">{respFullName}</span>
                </div>
              </div>

              <div className="ad-badge-resp-tags">
                {userAccessRole.isFin && (
                  <span className="ad-badge-icon-tag tag-fin" title="Responsável Financeiro">
                    <DollarSign size={10} strokeWidth={2.8} />
                  </span>
                )}
                {userAccessRole.isPed && (
                  <span className="ad-badge-icon-tag tag-ped" title="Responsável Pedagógico">
                    <BookOpen size={9.5} strokeWidth={2.4} />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
