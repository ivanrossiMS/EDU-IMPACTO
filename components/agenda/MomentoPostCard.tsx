import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, MoreHorizontal, MessageSquare, Heart, ChevronLeft, ChevronRight, Star, Maximize2 } from 'lucide-react'
import { ADMomento } from '@/lib/agendaDigitalContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'

// Ultra-modern gradient configs per card slot
const CARD_THEMES = [
  {
    border: 'linear-gradient(135deg, #f72585, #7209b7, #3a0ca3)',
    glow: 'rgba(247,37,133,0.4)',
    bg: 'linear-gradient(160deg, #0d0221 0%, #1a0533 40%, #240046 70%, #380070 100%)',
    bodyBg: 'linear-gradient(180deg, #1a0533 0%, #0d0221 100%)',
    headerBg: 'rgba(20,4,50,0.95)',
  },
  {
    border: 'linear-gradient(135deg, #4361ee, #4cc9f0, #7400b8)',
    glow: 'rgba(67,97,238,0.4)',
    bg: 'linear-gradient(160deg, #03045e 0%, #023e8a 40%, #0077b6 70%, #00b4d8 100%)',
    bodyBg: 'linear-gradient(180deg, #023e8a 0%, #03045e 100%)',
    headerBg: 'rgba(3,4,94,0.95)',
  },
  {
    border: 'linear-gradient(135deg, #f97316, #fb923c, #dc2626)',
    glow: 'rgba(249,115,22,0.4)',
    bg: 'linear-gradient(160deg, #1c0a00 0%, #431407 40%, #7c2d12 70%, #9a3412 100%)',
    bodyBg: 'linear-gradient(180deg, #431407 0%, #1c0a00 100%)',
    headerBg: 'rgba(28,10,0,0.95)',
  },
  {
    border: 'linear-gradient(135deg, #10b981, #059669, #065f46)',
    glow: 'rgba(16,185,129,0.4)',
    bg: 'linear-gradient(160deg, #001a12 0%, #022c22 40%, #064e3b 70%, #065f46 100%)',
    bodyBg: 'linear-gradient(180deg, #022c22 0%, #001a12 100%)',
    headerBg: 'rgba(0,26,18,0.95)',
  },
  {
    border: 'linear-gradient(135deg, #ec4899, #a855f7, #6366f1)',
    glow: 'rgba(236,72,153,0.4)',
    bg: 'linear-gradient(160deg, #1e0030 0%, #2d0050 40%, #3b0068 70%, #4c0080 100%)',
    bodyBg: 'linear-gradient(180deg, #2d0050 0%, #1e0030 100%)',
    headerBg: 'rgba(30,0,48,0.95)',
  },
]

type Props = {
  post: ADMomento
  index: number
  onDelete: (id: string | number) => void
}

export function MomentoPostCard({ post, index, onDelete }: Props) {
  const [slide, setSlide] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)
  const { adConfirm } = useAgendaDigital()
  const { currentUser } = useApp()

  // Resolve o nome real: se o campo author estiver vazio ou for o placeholder antigo, usa o usuario logado
  const authorName = (!post.author || post.author === 'Administração')
    ? (currentUser?.nome || 'Administração')
    : post.author
  const authorInitial = authorName.charAt(0).toUpperCase()

  const medias = post.media || []
  const hasMultiple = medias.length > 1
  const currentMedia = medias[slide] || null
  const theme = CARD_THEMES[index % CARD_THEMES.length]

  const targets = post.targetClasses || []
  const isAllSchool = !targets.length || targets.includes('Toda a Escola')

  const targetLabel = (() => {
    if (isAllSchool) return 'Toda a Escola'
    const groups: Record<string, number> = {}
    targets.forEach(t => { const k = t.split(' - ')[0] || t; groups[k] = (groups[k] || 0) + 1 })
    const e = Object.entries(groups)
    if (e.length > 2) return `${targets.length} Segmentos Selecionados`
    return e.map(([n, c]) => c > 1 ? `${n} (${c})` : n).join(', ')
  })()

  const isClickable = !isAllSchool

  return (
    <>
      {/* Card */}
      <div style={{
        position: 'relative',
        borderRadius: 24,
        padding: 2,
        background: theme.border,
        boxShadow: `0 0 40px ${theme.glow}, 0 8px 40px rgba(0,0,0,0.5)`,
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-6px) scale(1.01)'
        el.style.boxShadow = `0 0 60px ${theme.glow}, 0 20px 60px rgba(0,0,0,0.6)`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'none'
        el.style.boxShadow = `0 0 40px ${theme.glow}, 0 8px 40px rgba(0,0,0,0.5)`
      }}
      >
        <div style={{ borderRadius: 22, background: theme.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.headerBg, backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 900, fontSize: 16,
                boxShadow: '0 0 16px rgba(168,85,247,0.5)'
              }}>
                {authorInitial}
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{authorName}</div>
                <div style={{ marginTop: 2 }}>
                  <button
                    onClick={() => isClickable && setShowTargets(true)}
                    style={{
                      background: 'none', border: 'none', padding: 0, margin: 0,
                      color: isClickable ? '#a5b4fc' : '#9ca3af',
                      fontSize: 11, cursor: isClickable ? 'pointer' : 'default',
                      textDecoration: isClickable ? 'underline' : 'none',
                      textDecorationStyle: 'dotted',
                      fontFamily: 'inherit',
                    }}
                    title={isClickable ? 'Ver grupos selecionados' : ''}
                  >
                    {targetLabel}
                  </button>
                  <span style={{ color: '#6b7280', fontSize: 11 }}> • {post.time}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => adConfirm('Apagar este momento?', 'Apagar', () => onDelete(post.id))}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#9ca3af', display: 'flex', transition: 'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          {/* Fixed-height Image Frame */}
          <div 
            style={{ position: 'relative', width: '100%', height: 300, overflow: 'hidden', background: '#000', flexShrink: 0, cursor: 'pointer' }}
            onClick={() => setShowLightbox(true)}
          >
            {currentMedia ? (
              currentMedia.type === 'video' || currentMedia.url.match(/\.(mp4|webm)$/i) ? (
                <video src={currentMedia.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={currentMedia.url} alt="Momento" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontSize: 13 }}>Sem Mídia</div>
            )}

            {/* Hover overlay hint */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
               <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: 12, backdropFilter: 'blur(4px)' }}>
                 <Maximize2 size={24} color="#fff" />
               </div>
            </div>

            {/* Counter */}
            {medias.length > 1 && (
              <div style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                color: '#fff', fontSize: 11, fontWeight: 700,
                padding: '3px 9px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.15)'
              }}>
                {slide + 1}/{medias.length}
              </div>
            )}

            {/* Nav arrows */}
            {hasMultiple && (
              <>
                <button onClick={() => setSlide(s => s === 0 ? medias.length - 1 : s - 1)} style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 10
                }}>
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => setSlide(s => s === medias.length - 1 ? 0 : s + 1)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 10
                }}>
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* Wave SVG */}
            <svg viewBox="0 0 400 55" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', height: 55, display: 'block', zIndex: 5 }}>
              <path d="M0,20 C60,45 120,0 180,25 C240,50 300,5 360,28 C380,35 395,30 400,28 L400,55 L0,55 Z" fill="rgba(0,0,0,0.3)" />
              <path d="M0,30 C80,5 160,55 240,30 C310,10 370,42 400,32 L400,55 L0,55 Z" fill={theme.bodyBg.split('linear-gradient(180deg, ')[1]?.split(' 0%')[0] || '#1a0533'} />
            </svg>

            {/* DESTAQUE badge */}
            <div style={{
              position: 'absolute', bottom: 18, left: 14, zIndex: 10,
              background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
              color: '#fde68a', padding: '4px 12px', borderRadius: 20,
              fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 14px rgba(124,58,237,0.55)',
              border: '1px solid rgba(253,230,138,0.2)'
            }}>
              <Star size={11} fill="#fde68a" color="#fde68a" /> DESTAQUE
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10, background: theme.bodyBg }}>
            <p style={{ margin: 0, color: '#f1f5f9', fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{post.desc}</p>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 20,
            background: theme.bodyBg,
          }}>
            <button onClick={() => setShowComments(s => !s)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500
            }}>
              <MessageSquare size={16} /> {(post.comments || []).length} Comentários
            </button>
            <button style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: (post.likes || []).length > 0 ? '#f43f5e' : '#9ca3af',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500
            }}>
              <Heart size={16} fill={(post.likes || []).length > 0 ? '#f43f5e' : 'none'} />
              {(post.likes || []).length} Curtidas
            </button>
          </div>

          {showComments && (
            <div style={{ padding: '0 16px 14px', background: theme.bodyBg, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(post.comments || []).length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>Nenhum comentário ainda.</div>
              ) : (
                (post.comments || []).map(c => (
                  <div key={c.id} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '8px 12px' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12 }}>{c.author}</span>
                    <span style={{ color: '#9ca3af', fontSize: 11 }}> • {c.time}</span>
                    <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 2 }}>{c.text}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Grupos Selecionados */}
      {showTargets && (
        <div
          onClick={() => setShowTargets(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1a1835', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, border: '1px solid rgba(168,85,247,0.2)', boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 40px rgba(168,85,247,0.15)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: 16, fontWeight: 800 }}>Grupos Selecionados</h3>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>{targets.length} grupo{targets.length !== 1 ? 's' : ''} neste momento</p>
              </div>
              <button onClick={() => setShowTargets(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {targets.map((t, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#a855f7,#ec4899)', flexShrink: 0 }} />
                  <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 500 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Lightbox: Media View */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowLightbox(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}
          >
            <motion.button 
              initial={{ scale: 0.5 }} animate={{ scale: 1 }}
              style={{ position: 'absolute', top: 30, right: 30, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer', color: '#fff', zIndex: 10 }}
            >
              <X size={28} />
            </motion.button>

            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
            >
              {currentMedia?.type === 'video' || currentMedia?.url.match(/\.(mp4|webm)$/i) ? (
                <video 
                  src={currentMedia?.url} 
                  controls 
                  autoPlay 
                  style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 0 60px rgba(0,0,0,0.5)' }} 
                />
              ) : (
                <img 
                  src={currentMedia?.url} 
                  alt="Full size" 
                  style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, objectFit: 'contain', boxShadow: '0 0 60px rgba(0,0,0,0.5)' }} 
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
