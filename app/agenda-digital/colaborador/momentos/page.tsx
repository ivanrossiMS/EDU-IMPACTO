'use client'

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useState } from 'react'
import { Image as ImageIcon, Heart, MessageCircle, Plus, X } from 'lucide-react'
import { useApp } from '@/lib/context'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { getInitials } from '@/lib/utils'

export default function ColaboradorMomentosPage() {
  const { momentosFeed, setMomentosFeed } = useAgendaDigital()
  const { currentUser } = useApp()
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  
  const [showComposer, setShowComposer] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [targetTurma, setTargetTurma] = useState('Turma Inteira')

  const handleLike = (momentId: number | string) => {
    setMomentosFeed(prev => prev.map(m => {
      if (m.id !== momentId) return m
      const myName = currentUser?.nome || 'Colaborador'
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
        comments: [...commentsArray, { id: Date.now().toString(), author: currentUser?.nome || 'Colaborador', text, time: 'Agora' }]
      }
    }))
    setCommentInputs(prev => ({ ...prev, [momentId]: '' }))
  }

  const handlePostarMomento = () => {
    if (!newDesc.trim()) return alert('Preencha a descrição do momento.')
    
    setMomentosFeed(prev => [{
      id: `m-colab-${Date.now()}`,
      author: currentUser?.nome || 'Colaborador',
      targetClasses: [targetTurma],
      media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80' }],
      desc: newDesc,
      status: 'pending', // Pending approval if we want admin to approve, but for collaborator let's auto approve or pending depending on the business logic. We'll set pending so admin sees it, but collaborator can see their own
      time: 'Agora',
      likes: [],
      comments: []
    }, ...prev])
    
    setNewDesc('')
    setShowComposer(false)
    alert('Momento enviado para moderação com sucesso!')
  }
  
  // Colaboradores podem ver todos os momentos aprovados ou de todas as turmas
  const meusMomentos = momentosFeed.filter(m => m.status === 'approved' || m.author === currentUser?.nome)

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, padding: '0 24px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Feed Escolar</h2>
        <button className="btn btn-primary" onClick={() => setShowComposer(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Novo Momento
        </button>
      </div>

      {meusMomentos.length === 0 ? (
        <div style={{ padding: '0 24px' }}>
          <EmptyStateCard 
            title="Nenhum Momento Registrado"
            description="Ainda não há fotos ou vídeos publicados para as suas turmas."
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
              transform: `rotate(${Math.floor(Math.random() * 4) - 2}deg)`, 
              transition: 'transform 0.3s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'rotate(0deg) scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = `rotate(${Math.floor(Math.random() * 4) - 2}deg) scale(1)`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className="avatar" style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--gradient-purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>
                  {getInitials(m.author)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{m.author}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Alvos: {m.targetClasses.join(', ')} • {m.time}</div>
                </div>
              </div>

              <div style={{ 
                width: '100%', 
                aspectRatio: '1/1',
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

      {showComposer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 500, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Publicar Novo Momento</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowComposer(false)}><X size={18} /></button>
            </div>
            
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Turma Alvo</label>
                <select className="form-input" value={targetTurma} onChange={e => setTargetTurma(e.target.value)}>
                  <option value="Turma Inteira">Toda a Turma</option>
                  <option value="1º Ano A">1º Ano A</option>
                  <option value="2º Ano B">2º Ano B</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Mídia (Foto/Vídeo)</label>
                <input type="file" className="form-input" accept="image/*,video/*" />
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4, display: 'block' }}>Suporta imagens JPG/PNG e vídeos curtos.</span>
              </div>

              <div>
                 <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Descrição/Legenda</label>
                 <textarea 
                   className="form-input" 
                   placeholder="Escreva algo sobre este momento..." 
                   style={{ height: 100, resize: 'none' }}
                   value={newDesc}
                   onChange={e => setNewDesc(e.target.value)}
                 />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', display: 'flex', justifyContent: 'flex-end', borderRadius: '0 0 16px 16px' }}>
               <button className="btn btn-primary" onClick={handlePostarMomento}>Enviar p/ Moderação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
