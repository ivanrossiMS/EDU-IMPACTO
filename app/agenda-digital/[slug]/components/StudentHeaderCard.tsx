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
    <div className="ad-premium-card-header-flex" style={{ display: 'flex', alignItems: 'stretch', gap: 14, width: '100%' }}>
      {/* 1. Avatar do Aluno com Moldura Perfeita e Live Status */}
      <div 
        className="ad-premium-card-avatar" 
        style={{ 
          width: 106, 
          height: 106, 
          borderRadius: 22, 
          background: 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%)', 
          boxShadow: '0 8px 24px rgba(99,102,241,0.16)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#4f46e5', 
          fontWeight: 900, 
          fontSize: 30, 
          fontFamily: 'Outfit, sans-serif',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          border: '1.5px solid rgba(199, 210, 254, 0.7)'
        }}
      >
        {aluno?.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={aluno.foto} 
            alt={aluno?.nome || ''} 
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} 
          />
        ) : (
          getInitials(aluno?.nome || '')
        )}
        
        {/* Anel de Status de Presença */}
        <span 
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            width: 13,
            height: 13,
            borderRadius: '50%',
            backgroundColor: '#10b981',
            border: '2px solid #ffffff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
          }}
          title="Presente na Escola"
        />
      </div>
      
      {/* 2. Coluna da Direita: Nome, Chips e Card do Responsável ao lado da foto */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, flex: 1, maxWidth: '100%', padding: '1px 0' }}>
        <div>
          {/* Nome e Badge de Verificado Moderno */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
            <h2 className="ad-premium-student-name" style={{ fontSize: 19, fontWeight: 900, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', minWidth: 0, lineHeight: 1.15 }}>
              <span style={{ whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {abbreviateName(aluno?.nome || 'Carregando...')}
              </span>
              
              {/* Badge de Verificado Holográfico Moderno */}
              <span 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 17,
                  height: 17,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 50%, #a855f7 100%)',
                  padding: 1.2,
                  boxShadow: '0 0 8px rgba(99,102,241,0.35)',
                  flexShrink: 0
                }}
                title="Aluna Verificada"
              >
                <span 
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </span>
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
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontFamily: 'Outfit, sans-serif'
                }}
              >
                <LogOut size={12} strokeWidth={2.4} /> <span className="ad-desktop-only">Sair</span>
              </button>
            )}
          </div>

          {/* Chips: Turma + Turno */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, width: '100%' }}>
            {/* Turma */}
            <div className="ad-modern-badge badge-turma" title={`Turma: ${cleanTurma}`} style={{ flex: 1, minWidth: 0, height: 26, padding: '2px 7px 2px 3px' }}>
              <div className="ad-badge-icon-box turma-icon" style={{ width: 20, height: 20 }}>
                <GraduationCap size={11} strokeWidth={2.4} />
              </div>
              <span className="ad-badge-text" style={{ fontSize: 11 }}>{cleanTurma}</span>
            </div>

            {/* Turno */}
            <div className="ad-modern-badge badge-turno" title={`Turno: ${cleanTurno}`} style={{ flex: 1, minWidth: 0, height: 26, padding: '2px 7px 2px 3px' }}>
              <div className="ad-badge-icon-box turno-icon" style={{ width: 20, height: 20 }}>
                <Calendar size={11} strokeWidth={2.4} />
              </div>
              <span className="ad-badge-text" style={{ fontSize: 11 }}>{cleanTurno}</span>
            </div>
          </div>
        </div>

        {/* 3. Card do Responsável Compacto ao lado da foto */}
        {(!isAlunoCargo && !isMirroringAluno) && (
          <div 
            className="ad-modern-resp-card"
            title={`Responsável: ${rawName}`}
            style={{
              marginTop: 6,
              padding: '6px 9px',
              borderRadius: 12,
              background: '#f8fafc',
              border: '1px solid rgba(226, 232, 240, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
          >
            {/* Linha 1: Label RESPONSÁVEL na esquerda + Badges Fin/Ped alinhados à direita */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, width: '100%', lineHeight: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={11} style={{ color: '#059669', flexShrink: 0 }} />
                <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  RESPONSÁVEL
                </span>
              </div>

              {/* Badges Fin e Ped na mesma linha alinhados à direita */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {userAccessRole.isFin && (
                  <span 
                    title="Responsável Financeiro"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      padding: '2px 5px',
                      borderRadius: 6,
                      fontSize: '7.5px',
                      fontWeight: 800,
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#047857',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      lineHeight: 1
                    }}
                  >
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981' }} />
                    $ Fin
                  </span>
                )}
                {userAccessRole.isPed && (
                  <span 
                    title="Responsável Pedagógico"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      padding: '2px 5px',
                      borderRadius: 6,
                      fontSize: '7.5px',
                      fontWeight: 800,
                      background: 'rgba(99, 102, 241, 0.12)',
                      color: '#4338ca',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      lineHeight: 1
                    }}
                  >
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#6366f1' }} />
                    📖 Ped
                  </span>
                )}
              </div>
            </div>

            {/* Linha 2: Nome do Responsável */}
            <div style={{ marginTop: 3 }}>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {respFullName}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
