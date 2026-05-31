'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { use, useState, useEffect } from 'react'
import { Image as ImageIcon, Heart, MessageCircle, Send, Sparkles, Star, Smile, Camera, Loader2, ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/context'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { getInitials } from '@/lib/utils'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'

export default function ADMomentosPage({ params }: { params: Promise<{ slug: string }>}) {
  // removido const { momentosFeed } = useAgendaDigital()
  const { aluno: contextAluno } = useSelectedStudent()
  const [alunos = [], setAlunos] = useSupabaseArray<any>('alunos', []);
  const [dbTurmas = []] = useSupabaseArray<any>('turmas', [])
  const { turmas: contextTurmas = [] } = useData()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  
  const { currentUser } = useApp()
  const aluno = contextAluno || (alunos || []).find(a => a.id === resolvedParams.slug)
  
  const turmas = contextTurmas.length > 0 ? contextTurmas : dbTurmas
  
  const nomeTurmaDoAluno = (() => {
    if (!aluno) return 'Sem Turma'
    if (aluno.turma_nome && aluno.turma_nome !== aluno.turma) {
      return String(aluno.turma_nome).split('-')[0].trim()
    }
    const turmaObj = turmas.find(t => 
      String(t.id) === String(aluno.turma) || 
      String(t.codigo) === String(aluno.turma) || 
      String(t.nome) === String(aluno.turma)
    )
    const nomeTurma = turmaObj?.nome || aluno.turma_nome || aluno.turma || 'Sem Turma'
    return String(nomeTurma).split('-')[0].trim()
  })()
  
  const [momentosFeed, setMomentosFeed, { loading, setLocal }] = useSupabaseArray<any>('agenda/momentos', [])

  useAgendaRealtime({
    table: 'momentos',
    toastConfig: {
      enabled: true,
      insertMessage: (doc) => `Novo momento adicionado!`,
      updateMessage: (doc) => `Momento atualizado!`,
      icon: <Camera size={18} color="#00D2FF" />
    },
    onInsert: ({ new: newMomento }) => {
      const m = { ...newMomento, _isNew: true };
      if (setLocal) {
        setLocal((prev: any) => {
          if (prev.some((p: any) => p.id === m.id)) return prev;
          const newFeed = [m, ...prev].sort((a: any, b: any) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
          return newFeed;
        });
        setTimeout(() => {
          setLocal((curr: any) => curr.map((c: any) => c.id === m.id ? { ...c, _isNew: false } : c));
        }, 5000);
      }
    },
    onUpdate: ({ new: updatedMomento }) => {
      if (setLocal) {
        setLocal((prev: any) => prev.map((p: any) => p.id === updatedMomento.id ? { ...p, ...updatedMomento } : p));
      }
    },
    onDelete: ({ old }) => {
      if (setLocal) {
        setLocal((prev: any) => prev.filter((p: any) => p.id !== old?.id));
      }
    }
  });
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  // Estado para o Lightbox/Galeria
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string, type: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Prevenir scroll do body quando modal está aberto
  useEffect(() => {
    if (lightboxOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; }
  }, [lightboxOpen]);



  const handleLike = (momentId: number | string) => {
    setMomentosFeed(prev => prev.map(m => {
      if (m.id !== momentId) return m
      const myName = currentUser?.nome || 'Você'
      const likesArray = m.likes || []
      const isLiked = likesArray.includes(myName)
      return {
        ...m,
        likes: isLiked ? likesArray.filter((name: string) => name !== myName) : [...likesArray, myName]
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
    if (!m.targetClasses || m.targetClasses.length === 0) return true
    
    const rawTurma = String(aluno?.turma || '').toLowerCase()
    
    return m.targetClasses.some((tc: string) => {
      const tcl = tc.toLowerCase()
      if (tcl === 'todos' || tcl === 'toda a escola' || tcl === 'toda a escola') return true
      
      // Match by class name (resolved)
      if (nomeTurmaDoAluno.toLowerCase().includes(tcl) || tcl.includes(nomeTurmaDoAluno.toLowerCase())) return true
      
      // Match by class ID
      if (rawTurma && (tcl === rawTurma || tcl.includes(rawTurma) || rawTurma.includes(tcl))) return true
      
      return false
    })
  }).sort((a, b) => {
    // Ordem do mais novo para o mais antigo
    const dateA = new Date((a as any).date || 0).getTime()
    const dateB = new Date((b as any).date || 0).getTime()
    return dateB - dateA
  })

  useEffect(() => {
    if (!aluno?.id || meusMomentos.length === 0) return;
    
    // Check which ones are unread
    const unreadIds = meusMomentos
      .filter(m => {
        const leituras = (m as any).leituras || {};
        return !leituras[aluno.id];
      })
      .map(m => m.id);

    if (unreadIds.length > 0) {
      fetch('/api/agenda/notificacoes/marcar-lido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'momento',
          ids: unreadIds,
          alunoId: aluno.id
        })
      })
      .then(res => {
        if (res.ok) {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        }
      })
      .catch(err => console.error('Failed to mark momentos as read:', err));
    }
  }, [meusMomentos, aluno?.id]);

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      paddingBottom: 60,
      background: 'transparent',
      overflow: 'visible'
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Outfit:wght@300;400;600;800&display=swap');
        
        @keyframes floatRandom {
          0% { transform: translateY(0px) rotate(0deg) scale(1); }
          50% { transform: translateY(-25px) rotate(180deg) scale(1.15); }
          100% { transform: translateY(0px) rotate(360deg) scale(1); }
        }
        
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        /* Inject dynamic, highly colorful full-viewport premium warm-cool pastel gradient */
        .ad-main-scroll {
          background: linear-gradient(135deg, #e0e7ff 0%, #fce7f3 40%, #fef3c7 75%, #ecfdf5 100%) !important;
          position: relative !important;
        }

        .floating-icon {
          position: absolute;
          pointer-events: none;
          z-index: 1;
          filter: drop-shadow(0 8px 16px rgba(0,0,0,0.06));
        }
        
        .polaroid-card {
          background: #ffffff !important;
          padding: 18px 18px 24px 18px !important;
          border-radius: 16px !important;
          border: 1px solid rgba(255, 255, 255, 0.9) !important;
          box-shadow: 0 20px 45px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.02) !important;
          width: 100% !important;
          max-width: 480px !important;
          display: flex !important;
          flex-direction: column !important;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
          cursor: pointer !important;
        }
        .polaroid-card:hover {
          transform: rotate(0deg) scale(1.04) translateY(-10px) !important;
          box-shadow: 0 40px 80px rgba(99, 102, 241, 0.2), 0 6px 20px rgba(0,0,0,0.05) !important;
          border-color: rgba(99, 102, 241, 0.3) !important;
        }

        .media-item-hover .expand-overlay {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .media-item-hover:hover .expand-overlay {
          opacity: 1;
        }

        @media (max-width: 768px) {
          .ad-momentos-header {
            margin: 8px 16px 16px 16px !important;
            padding: 12px 16px !important;
            gap: 12px !important;
          }
          .ad-momentos-title {
            font-size: 13px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .ad-momentos-desc {
            display: none !important;
          }
        }
      `}} />

      {/* Decorative Blur Blobs */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '5%',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'rgba(236, 72, 153, 0.15)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '25%',
        right: '5%',
        width: '360px',
        height: '360px',
        borderRadius: '50%',
        background: 'rgba(99, 102, 241, 0.15)',
        filter: 'blur(90px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Floating Modern Icons Background Layer */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
        <div className="floating-icon" style={{ top: '8%', left: '8%', color: 'rgba(99, 102, 241, 0.35)', animation: 'floatRandom 14s ease-in-out infinite' }}><Heart size={28} fill="rgba(99, 102, 241, 0.15)" /></div>
        <div className="floating-icon" style={{ top: '15%', left: '85%', color: 'rgba(236, 72, 153, 0.4)', animation: 'floatRandom 16s ease-in-out infinite 1s' }}><Sparkles size={24} /></div>
        <div className="floating-icon" style={{ top: '40%', left: '5%', color: 'rgba(245, 158, 11, 0.35)', animation: 'floatRandom 12s ease-in-out infinite 2s' }}><Smile size={30} /></div>
        <div className="floating-icon" style={{ top: '60%', left: '90%', color: 'rgba(16, 185, 129, 0.3)', animation: 'floatRandom 15s ease-in-out infinite 0.5s' }}><Camera size={26} /></div>
        <div className="floating-icon" style={{ top: '75%', left: '10%', color: 'rgba(139, 92, 246, 0.35)', animation: 'floatRandom 18s ease-in-out infinite 2.5s' }}><Star size={26} fill="rgba(139, 92, 246, 0.15)" /></div>
        <div className="floating-icon" style={{ top: '85%', left: '80%', color: 'rgba(239, 68, 68, 0.35)', animation: 'floatRandom 13s ease-in-out infinite 3.5s' }}><Heart size={28} fill="rgba(239, 68, 68, 0.15)" /></div>
        <div className="floating-icon" style={{ top: '5%', left: '70%', color: 'rgba(59, 130, 246, 0.35)', animation: 'floatRandom 15s ease-in-out infinite 1.5s' }}><Sparkles size={26} /></div>
        <div className="floating-icon" style={{ top: '28%', left: '92%', color: 'rgba(236, 72, 153, 0.4)', animation: 'floatRandom 17s ease-in-out infinite 0.3s' }}><Camera size={24} /></div>
        <div className="floating-icon" style={{ top: '52%', left: '12%', color: 'rgba(245, 158, 11, 0.35)', animation: 'floatRandom 14s ease-in-out infinite 2.8s' }}><Star size={28} fill="rgba(245, 158, 11, 0.15)" /></div>
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* ULTRA MODERN HEADER */}
        <div className="ad-momentos-header" style={{ 
          margin: '24px 16px 32px 16px',
          padding: '24px 32px',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.85))',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle animated gradient overlay inside the header */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, rgba(236,72,153,0.04) 50%, rgba(245,158,11,0.04) 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: 'linear-gradient(180deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b)', backgroundSize: '100% 200%', animation: 'gradientMove 3s ease infinite' }} />
          
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(236,72,153,0.1))',
            width: 64, height: 64, borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 12px 24px rgba(0,0,0,0.06)',
            transform: 'rotate(-5deg)',
            transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            flexShrink: 0
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'rotate(5deg) scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'rotate(-5deg) scale(1)'}
          >
            <span style={{ fontSize: 32, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }}>📸</span>
          </div>

          <div style={{ flex: 1, zIndex: 1, minWidth: 0 }}>
            <h2 className="ad-momentos-title" style={{ 
              fontSize: 'clamp(24px, 4vw, 32px)', 
              fontWeight: 900, 
              fontFamily: 'Outfit, sans-serif', 
              margin: 0, 
              letterSpacing: '-0.03em', 
              background: 'linear-gradient(135deg, #1e293b 0%, #4f46e5 100%)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.04))',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              Fotos/Vídeos da Turma
            </h2>
            <p className="ad-momentos-desc" style={{ 
              fontSize: 15, 
              color: '#475569', 
              marginTop: 6, 
              margin: '6px 0 0 0', 
              fontFamily: 'Outfit, sans-serif',
              lineHeight: 1.5,
              fontWeight: 500
            }}>
              Acompanhe o dia a dia, sorrisos e as atividades incríveis de <strong style={{ color: '#4f46e5', fontWeight: 800 }}>{nomeTurmaDoAluno}</strong>.
            </p>
          </div>
        </div>

        {meusMomentos.length === 0 ? (
          <div style={{ padding: '0 24px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#6366f1' }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: '#9ca3af' }}>Carregando momentos...</div>
              </div>
            ) : (
              <EmptyStateCard 
                title="Nenhum Momento Registrado"
                description={`Ainda não há fotos publicadas para a turma ${nomeTurmaDoAluno} hoje.`}
                icon={<ImageIcon size={48} style={{ opacity: 0.2 }} />}
              />
            )}
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            gap: 48, 
            padding: '24px 16px', 
          }}>
            {meusMomentos.map((m, index) => {
              // Associa uma rotação inicial sutil e fixa com base no index
              const initialRotation = ((index * 3) % 5) - 2;
              return (
                <div 
                  key={m.id} 
                  className="polaroid-card"
                  style={{ 
                    transform: `rotate(${initialRotation}deg)`
                  }}
                >
                  {/* Header Simplificado para caber no formato polaroid */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div className="avatar" style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7928CA, #FF0080)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, boxShadow: '0 4px 10px rgba(121,40,202,0.2)' }}>
                      {getInitials(m.author)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.author}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '340px' }}>
                        Turma: {(() => {
                          const classes = m.targetClasses || [];
                          if (classes.some((c: string) => c.toLowerCase() === 'todos' || c.toLowerCase() === 'toda a escola' || c.toLowerCase() === 'todas')) return 'Toda a Escola';
                          const classNames = classes.map((c: string) => {
                            const turmaMatch = turmas.find((t: any) => String(t.id) === String(c) || String(t.codigo) === String(c) || String(t.nome) === String(c));
                            return turmaMatch ? turmaMatch.nome : c;
                          });
                          if (classNames.length > 2) return `${classNames.length} Turmas`;
                          return classNames.join(', ');
                        })()} • {m.time}
                      </div>
                    </div>
                  </div>

                  {/* Mídia estilo Filme Polaroid */}
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '1/1', // quadrada formato polaroid
                    background: '#0a0e17', 
                    overflow: 'hidden',
                    borderRadius: 12,
                    marginBottom: 16,
                    display: 'flex',
                    boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(0,0,0,0.1)'
                  }}>
                    {(m.media || []).map((med: any, i: number) => (
                      <div 
                        key={i} 
                        className="media-item-hover"
                        style={{ width: '100%', height: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}
                        onClick={() => {
                          setLightboxMedia(m.media.map((item: any) => ({ url: item.url, type: item.type === 'video' || item.url.match(/\.(mp4|webm)$/i) ? 'video' : 'image' })))
                          setLightboxIndex(i)
                          setLightboxOpen(true)
                        }}
                      >
                        {med.type === 'video' || med.url.match(/\.(mp4|webm)$/i) ? (
                          <video src={med.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <img 
                            src={med.url} 
                            alt="Momento Escolar" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} 
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80';
                            }}
                          />
                        )}
                        <div className="expand-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                          <Maximize2 color="white" size={32} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rodapé Polaroid */}
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 4px' }}>
                    
                    <div style={{ fontSize: 18, lineHeight: 1.5, color: '#334155', fontFamily: '"Caveat", "Comic Sans MS", cursive', fontWeight: 500, marginBottom: 16 }}>
                       {m.desc}
                    </div>

                    <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                       <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                         <Heart 
                           size={20} 
                           color={(m.likes || []).includes(currentUser?.nome || 'Você') ? '#ef4444' : '#64748b'} 
                           fill={(m.likes || []).includes(currentUser?.nome || 'Você') ? '#ef4444' : 'none'}
                           cursor="pointer" 
                           onClick={() => handleLike(m.id)}
                           style={{ transition: 'all 0.2s', filter: (m.likes || []).includes(currentUser?.nome || 'Você') ? 'drop-shadow(0 4px 6px rgba(239,68,68,0.3))' : 'none' }}
                         />
                         <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>{(m.likes || []).length}</span>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => { document.getElementById(`comment-input-${m.id}`)?.focus() }}>
                         <MessageCircle size={20} color="#64748b" />
                         <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>{(m.comments || []).length}</span>
                       </div>
                    </div>

                    {/* Comentários Minimais */}
                    {(m.comments || []).length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', paddingRight: 4, background: '#f8fafc', padding: 8, borderRadius: 10, border: '1px solid #f1f5f9' }}>
                        {(m.comments || []).map((c: any) => (
                          <div key={c.id} style={{ fontSize: 12, lineHeight: 1.4 }}>
                            <span style={{ fontWeight: 700, marginRight: 6, color: '#1e293b' }}>{c.author}</span>
                            <span style={{ color: '#475569' }}>{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        id={`comment-input-${m.id}`}
                        type="text" 
                        value={commentInputs[m.id] || ''}
                        onChange={e => setCommentInputs(p => ({ ...p, [m.id]: e.target.value }))}
                        placeholder="Adicione um comentário..." 
                        style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, outline: 'none', color: '#1e293b' }}
                        onKeyDown={e => { if (e.key === 'Enter') handlePublishComment(m.id) }}
                      />
                      <button 
                        onClick={() => handlePublishComment(m.id)}
                        style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: commentInputs[m.id]?.trim() ? 1 : 0.5, transition: 'opacity 0.2s' }}
                        disabled={!commentInputs[m.id]?.trim()}
                      >
                        Publicar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* LIGHTBOX / GALLERY MODAL */}
      <AnimatePresence>
        {lightboxOpen && lightboxMedia.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            style={{ 
              position: 'fixed', inset: 0, zIndex: 999999, 
              background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              backdropFilter: 'blur(10px)' 
            }}
            onClick={() => setLightboxOpen(false)}
          >
            {/* Close Button */}
            <button 
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(false) }} 
              style={{ 
                position: 'absolute', top: 24, right: 24, width: 48, height: 48, borderRadius: '50%', 
                background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                cursor: 'pointer', zIndex: 2, transition: 'background 0.2s' 
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <X size={24} />
            </button>

            {/* Navigation Buttons */}
            {lightboxMedia.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev > 0 ? prev - 1 : lightboxMedia.length - 1) }}
                  style={{ 
                    position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', 
                    width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', 
                    border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    cursor: 'pointer', zIndex: 2, transition: 'background 0.2s' 
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                  <ChevronLeft size={32} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev < lightboxMedia.length - 1 ? prev + 1 : 0) }}
                  style={{ 
                    position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', 
                    width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', 
                    border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    cursor: 'pointer', zIndex: 2, transition: 'background 0.2s' 
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                  <ChevronRight size={32} />
                </button>
              </>
            )}

            {/* Media Content */}
            <div 
              style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
              onClick={(e) => e.stopPropagation()} // Evita fechar ao clicar na imagem
            >
              <AnimatePresence mode="wait">
                <motion.div 
                  key={lightboxIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {lightboxMedia[lightboxIndex].type === 'video' ? (
                    <video 
                      src={lightboxMedia[lightboxIndex].url} 
                      controls 
                      autoPlay 
                      style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', outline: 'none' }} 
                    />
                  ) : (
                    <img 
                      src={lightboxMedia[lightboxIndex].url} 
                      alt="Ampliado" 
                      style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', objectFit: 'contain' }} 
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Pagination Dots */}
            {lightboxMedia.length > 1 && (
              <div style={{ position: 'absolute', bottom: 32, display: 'flex', gap: 10 }} onClick={(e) => e.stopPropagation()}>
                {lightboxMedia.map((_, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      width: 12, height: 12, borderRadius: '50%', 
                      background: idx === lightboxIndex ? 'white' : 'rgba(255,255,255,0.3)',
                      transition: 'background 0.3s', cursor: 'pointer',
                      boxShadow: idx === lightboxIndex ? '0 0 10px rgba(255,255,255,0.5)' : 'none'
                    }}
                    onClick={() => setLightboxIndex(idx)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
