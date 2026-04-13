'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { use, useState } from 'react'
import { Image as ImageIcon, Heart, MessageCircle, Send } from 'lucide-react'
import { useApp } from '@/lib/context'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { getInitials } from '@/lib/utils'

export default function ADMomentosPage({ params }: { params: Promise<{ slug: string }>}) {
  const { momentosFeed } = useAgendaDigital()
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const resolvedParams = use(params as Promise<{ slug: string }>)
  
  const { currentUser } = useApp()
  const aluno = alunos.find(a => a.id === resolvedParams.slug)
  const turmaDoAluno = (aluno as any)?.turma || 'Sem Turma'
  
  const { setMomentosFeed } = useAgendaDigital()
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  const handleLike = (momentId: number | string) => {
    setMomentosFeed(prev => prev.map(m => {
      if (m.id !== momentId) return m
      const myName = currentUser?.nome || 'Você'
      const likesArray = m.likes || []
      const isLiked = likesArray.includes(myName)
      return {
        ...m,
        likes: isLiked ? likesArray.filter(name => name !== myName) : [...likesArray, myName]
      }
    }))
  }

  const handlePublishComment = (momentId: number | string) => {
    const text = commentInputs[momentId]
    if (!text?.trim()) return

    setMomentosFeed(prev => prev.map(m => {
      if (m.id !== momentId) return m
      const commentsArray = m.comments || []
      return {
        ...m,
        comments: [...commentsArray, { id: Date.now().toString(), author: currentUser?.nome || 'Você', text, time: 'Agora' }]
      }
    }))
    setCommentInputs(prev => ({ ...prev, [momentId]: '' }))
  }
  
  // Filtrar momentos aprovados e checar se o targetClasses reflete a turma do aluno ou 'TODOS' / 'Toda a Escola'
  const meusMomentos = momentosFeed.filter(m => {
    if (m.status !== 'approved') return false // pais só veem aprovados
    if (!m.targetClasses || m.targetClasses.length === 0) return true
    return m.targetClasses.some(tc => 
      tc.toLowerCase() === 'todos' || 
      tc.toLowerCase() === 'toda a escola' || 
      turmaDoAluno.toLowerCase().includes(tc.toLowerCase()) ||
      tc.toLowerCase().includes(turmaDoAluno.toLowerCase())
    )
  })

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, padding: '0 24px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Momentos da Turma</h2>
      </div>

      {meusMomentos.length === 0 ? (
        <div style={{ padding: '0 24px' }}>
          <EmptyStateCard 
            title="Nenhum Momento Registrado"
            description={`Ainda não há fotos publicadas para a turma ${turmaDoAluno} hoje.`}
            icon={<ImageIcon size={48} style={{ opacity: 0.2 }} />}
          />
        </div>
      ) : (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          gap: 48, 
          padding: '24px 16px', 
        }}>
          {meusMomentos.map(m => (
            <div key={m.id} style={{ 
              background: '#ffffff',
              padding: '16px 16px 24px 16px',
              borderRadius: 8,
              boxShadow: '0 12px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.03)',
              width: '100%',
              maxWidth: 500,
              display: 'flex',
              flexDirection: 'column',
              transform: `rotate(${Math.floor(Math.random() * 4) - 2}deg)`, // randomização sutil entre -2deg e +2deg
              transition: 'transform 0.3s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'rotate(0deg) scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = `rotate(${Math.floor(Math.random() * 4) - 2}deg) scale(1)`}
            >
              {/* Header Simplificado para caber no formato polaroid */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className="avatar" style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--gradient-purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>
                  {getInitials(m.author)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{m.author}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Turma: {m.targetClasses.join(', ')} • {m.time}</div>
                </div>
              </div>

              {/* Mídia estilo Filme Polaroid */}
              <div style={{ 
                width: '100%', 
                aspectRatio: '1/1', // quadrada formato polaroid
                background: '#000', 
                overflow: 'hidden',
                borderRadius: 4,
                marginBottom: 16,
                display: 'flex',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2)'
              }}>
                {(m.media || []).map((med, i) => (
                  <div key={i} style={{ width: '100%', height: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {med.type === 'video' || med.url.match(/\.(mp4|webm)$/i) ? (
                      <video src={med.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <img 
                        src={med.url} 
                        alt="Momento Escolar" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80';
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Rodapé Polaroid */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                
                <div style={{ fontSize: 15, lineHeight: 1.5, color: '#1f2937', fontFamily: '"Comic Sans MS", "Caveat", cursive', marginBottom: 16 }}>
                   {m.desc}
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                   <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                     <Heart 
                       size={22} 
                       color={(m.likes || []).includes(currentUser?.nome || 'Você') ? '#ef4444' : '#4b5563'} 
                       fill={(m.likes || []).includes(currentUser?.nome || 'Você') ? '#ef4444' : 'none'}
                       cursor="pointer" 
                       onClick={() => handleLike(m.id)}
                       style={{ transition: 'all 0.2s' }}
                     />
                     <span style={{ fontSize: 13, fontWeight: 700, color: '#4b5563' }}>{(m.likes || []).length}</span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => { document.getElementById(`comment-input-${m.id}`)?.focus() }}>
                     <MessageCircle size={22} color="#4b5563" />
                     <span style={{ fontSize: 13, fontWeight: 700, color: '#4b5563' }}>{(m.comments || []).length}</span>
                   </div>
                </div>

                {/* Comentários Minimais */}
                {(m.comments || []).length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 100, overflowY: 'auto' }}>
                    {(m.comments || []).map(c => (
                      <div key={c.id} style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 700, marginRight: 6, color: '#111827' }}>{c.author}</span>
                        <span style={{ color: '#4b5563' }}>{c.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px dotted #d1d5db', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    id={`comment-input-${m.id}`}
                    type="text" 
                    value={commentInputs[m.id] || ''}
                    onChange={e => setCommentInputs(p => ({ ...p, [m.id]: e.target.value }))}
                    placeholder="Adicione um comentário..." 
                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, outline: 'none', color: '#1f2937' }}
                    onKeyDown={e => { if (e.key === 'Enter') handlePublishComment(m.id) }}
                  />
                  <button 
                    onClick={() => handlePublishComment(m.id)}
                    style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: commentInputs[m.id]?.trim() ? 1 : 0.5 }}
                    disabled={!commentInputs[m.id]?.trim()}
                  >
                    Publicar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
