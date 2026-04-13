'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import React, { use } from 'react'
import { Calendar as CalendarIcon, Clock, MapPin, Target } from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { EmptyStateCard } from '../../components/EmptyStateCard'

export default function ADCalendarioPage({ params }: { params: Promise<{ slug: string }>}) {
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const resolvedParams = use(params as Promise<{ slug: string }>)
  
  const aluno = alunos.find(a => a.id === resolvedParams.slug)
  const turmaDoAluno = (aluno as any)?.turma || 'Turma não atribuída'

  // DB Mock. In real life we filter SELECT * FROM agenda where targets like '%turmaDoAluno%'
  const todosEventos = [
    { id: 1, title: 'Feira de Ciências', date: '2026-05-15', time: '08:00 - 12:00', location: 'Pátio Central', targets: ['Ensino Fundamental', 'Todos'], type: 'pedagogico' },
    { id: 2, title: 'Reunião de Pais e Mestres', date: '2026-04-20', time: '18:30', location: 'Auditório', targets: ['Todos'], type: 'institucional' },
    { id: 3, title: 'Apresentação de Artes', date: '2026-04-10', time: '10:00', location: 'Teatro', targets: ['1 ANO FUND1/2026', 'Jardim C — Tarde'], type: 'evento' },
    { id: 4, title: 'Simulado ENEM', date: '2026-06-01', time: '13:00 - 18:00', location: 'Salas', targets: ['Ensino Médio', 'Terceirão'], type: 'avaliacao' }
  ]

  const corType = {
    'pedagogico': '#3b82f6',
    'institucional': '#a855f7',
    'evento': '#f59e0b',
    'avaliacao': '#ef4444'
  }

  const eventosDoAluno = todosEventos.filter(e => {
    return e.targets.some(t => 
      t.toLowerCase() === 'todos' || 
      turmaDoAluno.toLowerCase().includes(t.toLowerCase()) ||
      t.toLowerCase().includes(turmaDoAluno.toLowerCase())
    )
  }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div>
      <div className="ad-calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Calendário e Eventos</h2>
        <div className="ad-calendar-badge" style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.1)', color: 'hsl(var(--primary))', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
          Turma: {turmaDoAluno}
        </div>
      </div>

      {eventosDoAluno.length === 0 ? (
         <EmptyStateCard 
           title="Nenhum Evento Agendado"
           description={`Não há eventos ou provas cadastradas para a turma ${turmaDoAluno} no momento.`}
           icon={<CalendarIcon size={48} style={{ opacity: 0.2 }} />}
         />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {eventosDoAluno.map(e => {
            const dataObj = new Date(e.date + 'T00:00:00') // forced timezone normalization
            const currentHex = corType[e.type as keyof typeof corType] || 'var(--primary)'
            
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
