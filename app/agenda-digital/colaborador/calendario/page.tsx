'use client'

import React from 'react'
import { Calendar as CalendarIcon, Clock, MapPin, Target } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'

export default function ColaboradorCalendarioPage() {
  const todosEventos: any[] = []

  const corType = {
    'pedagogico': '#3b82f6',
    'institucional': '#a855f7',
    'evento': '#f59e0b',
    'avaliacao': '#ef4444',
    'interno': '#10b981'
  }

  const eventosOrdenados = todosEventos.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div>
      <div className="ad-calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Calendário Escolar</h2>
        <div className="ad-calendar-badge" style={{ padding: '8px 16px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
          Visão Geral (Colaborador)
        </div>
      </div>

      {eventosOrdenados.length === 0 ? (
         <EmptyStateCard 
           title="Nenhum Evento Agendado"
           description={`Não há eventos cadastrados no calendário anual.`}
           icon={<CalendarIcon size={48} style={{ opacity: 0.2 }} />}
         />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {eventosOrdenados.map(e => {
            const dataObj = new Date(e.date + 'T00:00:00')
            const currentHex = corType[e.type as keyof typeof corType] || '#3b82f6'
            
            return (
              <div key={e.id} className="card ad-event-card" style={{ display: 'flex', overflow: 'hidden', padding: 0 }}>
                {/* Data Block */}
                <div className="ad-event-datebox" style={{ width: 100, background: currentHex, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                   <div className="ad-event-month" style={{ fontSize: 13, textTransform: 'uppercase', fontWeight: 600, opacity: 0.9 }}>
                     {dataObj.toLocaleDateString('pt-BR', { month: 'short' })}
                   </div>
                   <div className="ad-event-day" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>
                     {dataObj.getDate()}
                   </div>
                </div>

                {/* Details */}
                <div className="ad-event-details" style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="ad-event-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 className="ad-event-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{e.title}</h3>
                    <div className="ad-event-type" style={{ fontSize: 11, background: `${currentHex}15`, color: currentHex, padding: '4px 10px', borderRadius: 12, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {e.type}
                    </div>
                  </div>
                  
                  <div className="ad-event-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 12, color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} /> {e.time}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={14} /> {e.location}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                       <Target size={14} /> {e.targets.join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
