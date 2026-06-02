'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useAgendaDigital, ADMomento, ADMedia } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import React, { use, useState, useMemo, useEffect } from 'react'
import { X, Expand, Play, Heart, MessageCircle, Share2, Filter, Upload, Trash2, Camera, Download, PlayCircle, MoreVertical, Image as ImageIcon, Sparkles, Smile, Star, Send, ChevronLeft, ChevronRight, Maximize2, Plus, Check, Loader2, Video } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { TurmaDropdown } from '../components/TurmaDropdown'
import { useApp } from '@/lib/context'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { getInitials, formatDateTime } from '@/lib/utils'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { DestinatariosModal } from '@/components/agenda/DestinatariosModal'

export default function ADMomentosPage() {
  const { momentosFeed } = useAgendaDigital()
  const [alunos = [], setAlunos] = useSupabaseArray<any>('alunos?lightweight=true', []);
  
  
  const { currentUser } = useApp()
  
  const { turmas = [] } = useData()
  
  
  
  
  const { setMomentosFeed, setMomentosFeedLocally, adAlert } = useAgendaDigital()
  
  const [showModal, setShowModal] = useState(false)
  const [showDestModal, setShowDestModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [newPost, setNewPost] = useState({
    mediaFiles: [] as File[],
    targetClasses: [] as { id: string; name: string; type: 'turma' | 'funcionario' | 'aluno' | 'grupo' }[],
    desc: ''
  })

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
      if (setMomentosFeedLocally) {
        setMomentosFeedLocally((prev: any) => {
          if (prev.some((p: any) => p.id === m.id)) return prev;
          const newFeed = [m, ...prev].sort((a: any, b: any) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
          return newFeed;
        });
        setTimeout(() => {
          setMomentosFeedLocally((curr: any) => curr.map((c: any) => c.id === m.id ? { ...c, _isNew: false } : c));
        }, 5000);
      }
    },
    onUpdate: ({ new: updatedMomento }) => {
      if (setMomentosFeedLocally) {
        setMomentosFeedLocally((prev: any) => prev.map((p: any) => p.id === updatedMomento.id ? { ...p, ...updatedMomento } : p));
      }
    },
    onDelete: ({ old }) => {
      if (setMomentosFeedLocally) {
        setMomentosFeedLocally((prev: any) => prev.filter((p: any) => p.id !== old?.id));
      }
    }
  });



  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [currentMediaIndex, setCurrentMediaIndex] = useState<Record<string, number>>({})

  // Estado para o Lightbox/Galeria
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string, type: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  // Prevenir scroll do body quando modal está aberto
  useEffect(() => {
    if (lightboxOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; }
  }, [lightboxOpen]);

  const { chatGroups } = useAgendaDigital()
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')
  const [visibleCount, setVisibleCount] = useState(5)

  const turmaOptions = React.useMemo(() => {
    if (!currentUser?.id) return [];
    
    const userGroups = (chatGroups || []).filter(g => {
      let colabs = g.colaboradoresIds;
      if (typeof colabs === 'string') {
        try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
      }
      if (!Array.isArray(colabs)) colabs = [];
      return colabs.some(id => String(id) === String(currentUser.id));
    });

    const isGlobal = userGroups.some(g => g.isGlobalAccess === true);
    if (isGlobal) return turmas;

    const accessibleTurmas = turmas.filter(t => {
       return userGroups.some(g => String(g.id) === `sync-${t.id}` || String(g.nome).trim().toLowerCase() === String(t.nome).trim().toLowerCase())
    });
    return accessibleTurmas
  }, [turmas, chatGroups, currentUser])



  const selectedTurmaName = React.useMemo(() => {
    if (selectedTurmaId === 'all') return 'Todas as Turmas'
    const t = turmas.find(x => String(x.id) === String(selectedTurmaId) || String(x.codigo) === String(selectedTurmaId))
    return t ? t.nome : 'Selecione uma turma'
  }, [selectedTurmaId, turmas])

  // Get list of active turmas to filter moments
  const activeTurmas = React.useMemo(() => {
    if (selectedTurmaId === 'all') return turmaOptions
    const t = turmas.find(x => String(x.id) === String(selectedTurmaId) || String(x.codigo) === String(selectedTurmaId))
    return t ? [t] : []
  }, [selectedTurmaId, turmaOptions, turmas])

  const submitPost = async () => {
    if (isSubmitting) return
    if (!newPost.mediaFiles.length || !newPost.desc) return adAlert('Selecione mídias e preencha a legenda.', 'Atenção')
    
    // Validar tamanhos
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB
    for (const f of newPost.mediaFiles) {
      if (f.type.includes('video') && f.size > MAX_VIDEO_SIZE) {
        return adAlert(`O vídeo "${f.name}" é muito grande. O limite é 50MB.`, 'Arquivo muito grande')
      }
    }

    setIsSubmitting(true)
    setUploadProgress({})
    
    try {
      const mediaArray: ADMedia[] = await Promise.all(newPost.mediaFiles.map(async (file, idx) => {
        const bucket = 'comunicados-midia'
        let fileToUpload: File = file

        if (file.type.startsWith('image/')) {
          setUploadProgress(prev => ({ ...prev, [file.name]: 10 }))
          fileToUpload = await compressImage(file, { quality: 0.80, format: 'image/webp' })
          setUploadProgress(prev => ({ ...prev, [file.name]: 40 }))
        } else if (file.type.startsWith('video/')) {
          setUploadProgress(prev => ({ ...prev, [file.name]: 5 }))
          fileToUpload = await compressVideo(file, (percent) => {
            const scaled = Math.round(5 + (percent * 0.45))
            setUploadProgress(prev => ({ ...prev, [file.name]: scaled }))
          }) as File
        }

        setUploadProgress(prev => ({ ...prev, [file.name]: 60 }))

        // Upload centralizado (Cache-Control: 30 dias para momentos)
        const uploadRes = await uploadFileToSupabase({
          bucket,
          file: fileToUpload,
          usageType: 'common' // Momentos são parecidos com comunicados, cache curto
        })

        if (!uploadRes.ok || !uploadRes.url) {
          throw new Error(uploadRes.error || 'Upload falhou')
        }
        
        // Sucesso
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))

        return { type: file.type.includes('video') ? 'video' : 'image', url: uploadRes.url }
      }))

      const isSelected = newPost.targetClasses.length > 0;
      const selectedTurmas = isSelected ? newPost.targetClasses.filter(t => t.type === 'turma' || t.type === 'grupo') : [];
      const selectedAlunos = isSelected ? newPost.targetClasses.filter(t => t.type === 'aluno') : [];

      const targetClasses = selectedTurmas.length > 0 
        ? selectedTurmas.map(t => t.name) 
        : (selectedAlunos.length > 0 ? [] : ['Toda a Escola']);
        
      const targetClassesIds = selectedTurmas.map(t => String(t.id).replace(/^t_?/, ''));
      const alunosIds = selectedAlunos.map(t => String(t.id).replace(/^a_?/, ''));
      const alunosNomes = selectedAlunos.map(t => t.name);

      const post: ADMomento = {
        id: `momento_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        author: currentUser?.nome || 'Administração',
        targetClasses,
        targetClassesIds,
        alunosIds,
        alunosNomes,
        media: mediaArray, desc: newPost.desc, status: 'approved', time: 'Agora', likes: [], comments: []
      }

      setMomentosFeed(prev => [post, ...prev])
      setShowModal(false)
      setNewPost({ mediaFiles: [], targetClasses: [], desc: '' })
      adAlert('Momento publicado com sucesso!', '🎉 Sucesso')
    } catch (e: any) {
      console.error('[Momentos Upload] Error:', e)
      adAlert(`Erro ao enviar mídias: ${e.message || 'Erro desconhecido'}`, 'Erro')
    } finally {
      setIsSubmitting(false)
      setUploadProgress({})
    }
  }

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
  
  const meusMomentos = React.useMemo(() => {
    return momentosFeed.filter(m => {
      const targetClasses = m.targetClasses || []
      const targetAlunos = m.alunosIds || []
      
      const isGlobal = targetClasses.length === 0 && targetAlunos.length === 0
      if (isGlobal) return true

      // Se o momento é direcionado a alunos específicos
      if (targetAlunos.length > 0) {
        const matchedAlunos = (alunos || []).filter((a: any) => 
          targetAlunos.some((idRaw: string) => String(idRaw).replace(/^_*(ALU)?/, '') === String(a.id).replace(/^_*(ALU)?/, ''))
        )
        const hasAlunoInActiveTurma = matchedAlunos.some((a: any) => 
          activeTurmas.some(at => 
            String(a.turma) === String(at.id) || 
            String(a.turma) === String(at.codigo) || 
            String(a.turma) === String(at.nome)
          )
        )
        if (hasAlunoInActiveTurma) return true
      }

      // Se o momento é direcionado a classes
      if (targetClasses.length > 0) {
        return targetClasses.some(tc => {
          const tcl = tc.toLowerCase()
          if (tcl === 'todos' || tcl === 'toda a escola' || tcl === 'todas') return true
          return activeTurmas.some(at => 
            tcl.includes(at.nome.toLowerCase()) || 
            at.nome.toLowerCase().includes(tcl)
          )
        })
      }

      return false
    }).sort((a, b) => {
      // Ordem do mais novo para o mais antigo
      const dateA = new Date((a as any).date || 0).getTime()
      const dateB = new Date((b as any).date || 0).getTime()
      return dateB - dateA
    })
  }, [momentosFeed, activeTurmas, alunos])

  // Marcação de lidos
  useEffect(() => {
    if (!currentUser?.id || meusMomentos.length === 0) return;
    
    // Identifica quais IDs não constam como lidos para este colaborador
    const unreadIds = meusMomentos
      .filter(m => {
        const leituras = (m as any).leituras || {};
        return !leituras[currentUser.id];
      })
      .map(m => m.id);

    if (unreadIds.length > 0) {
      fetch('/api/agenda/notificacoes/marcar-lido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'momento',
          ids: unreadIds,
          alunoId: currentUser.id // API usa esse campo como ID de quem leu
        })
      })
      .then(res => {
        if (res.ok) {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        }
      })
      .catch(err => console.error('Failed to mark momentos as read:', err));
    }
  }, [meusMomentos, currentUser?.id]);

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

        @media (max-width: 768px) {
          .ad-momentos-header {
            margin: 16px 16px 16px 16px !important;
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
          overflow: 'visible'
        }}>
          {/* Background Gradients Layer */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none' }}>
            {/* Subtle animated gradient overlay inside the header */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, rgba(236,72,153,0.04) 50%, rgba(245,158,11,0.04) 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: 'linear-gradient(180deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b)', backgroundSize: '100% 200%', animation: 'gradientMove 3s ease infinite' }} />
          </div>
          
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
            <div style={{ marginTop: 8, position: 'relative', zIndex: 50, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ maxWidth: 300, width: '100%' }}>
                  <TurmaDropdown 
                    turmaOptions={[{id: 'all', nome: 'Todas as Turmas'}, ...turmaOptions]} 
                    selectedTurmaId={selectedTurmaId} 
                    setSelectedTurmaId={setSelectedTurmaId} 
                    selectedTurmaName={selectedTurmaName} 
                  />
                </div>
              <button onClick={() => setShowModal(true)} style={{
                height: 42, padding: '0 20px', border: 'none', borderRadius: 12, cursor: 'pointer',
                background: 'linear-gradient(90deg, #7c3aed, #a855f7, #ec4899)',
                color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 16px rgba(168,85,247,0.4)', transition: 'opacity 0.2s', flexShrink: 0
              }}>
                <Plus size={16} /> Novo Foto/Vídeo
              </button>
            </div>

            <p className="ad-momentos-desc" style={{ 
              fontSize: 15, 
              color: '#475569', 
              marginTop: 6, 
              margin: '6px 0 0 0', 
              fontFamily: 'Outfit, sans-serif',
              lineHeight: 1.5,
              fontWeight: 500
            }}>
              Acompanhe o dia a dia, sorrisos e as atividades incríveis de <strong style={{ color: '#4f46e5', fontWeight: 800 }}>{selectedTurmaName}</strong>.
            </p>
          </div>
        </div>

        {meusMomentos.length === 0 ? (
          <div style={{ padding: '0 24px' }}>
            <EmptyStateCard 
              title="Nenhum Momento Registrado"
              description={`Ainda não há fotos publicadas para a turma ${selectedTurmaName} hoje.`}
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
            {meusMomentos.slice(0, visibleCount).map((m, index) => {
              // Associa uma rotação inicial sutil e fixa com base no index
              const initialRotation = ((index * 3) % 5) - 2;
              const displayTime = (() => {
                const dt = (m as any).created_at || (m as any).date;
                if (dt) {
                  try {
                    return formatDateTime(dt);
                  } catch (e) {
                    return m.time || 'Agora';
                  }
                }
                return m.time || 'Agora';
              })()

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
                        {(() => {
                          const hasAlunos = m.alunosIds && m.alunosIds.length > 0;
                          const label = (() => {
                            if (hasAlunos) {
                              const names = m.alunosNomes || [];
                              if (names.length > 0) {
                                if (names.length > 2) return `${names.length} Alunos`;
                                return names.join(', ');
                              }
                              return `${m.alunosIds?.length || 0} Aluno(s)`;
                            }
                            const classes = m.targetClasses || [];
                            if (classes.some((c: string) => c.toLowerCase() === 'todos' || c.toLowerCase() === 'toda a escola' || c.toLowerCase() === 'todas')) return 'Toda a Escola';
                            const classNames = classes.map((c: string) => {
                              const turmaMatch = turmas.find((t: any) => String(t.id) === String(c) || String(t.codigo) === String(c) || String(t.nome) === String(c));
                              return turmaMatch ? turmaMatch.nome : c;
                            });
                            if (classNames.length > 2) return `${classNames.length} Turmas`;
                            return classNames.join(', ');
                          })()
                          return `${hasAlunos ? 'Alunos' : 'Turma'}: ${label}`;
                        })()} • {displayTime}
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
                    border: '1px solid rgba(0,0,0,0.1)',
                    position: 'relative'
                  }}>
                    {(() => {
                      const mediaList = m.media || []
                      if (mediaList.length === 0) return null
                      const activeIndex = currentMediaIndex[m.id] || 0
                      const med = mediaList[activeIndex]
                      
                      return (
                        <div style={{ width: '100%', height: '100%' }}>
                            <div 
                              className="media-item-hover"
                              style={{ width: '100%', height: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}
                              onClick={() => {
                                setLightboxMedia(m.media.map((item: any) => ({ url: item.url, type: item.type === 'video' || item.url.match(/\.(mp4|webm)$/i) ? 'video' : 'image' })))
                                setLightboxIndex(activeIndex)
                                setLightboxOpen(true)
                              }}
                            >
                              {med.type === 'video' || med.url.match(/\.(mp4|webm)$/i) ? (
                                <video src={med.url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} controls playsInline />
                              ) : (
                                <img 
                                  src={med.url} 
                                  alt="Momento Escolar" 
                                  style={{ width: '100%', height: '100%', objectFit: 'contain', transition: 'transform 0.5s ease' }} 
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

                          {mediaList.length > 1 && (
                            <>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => ({ ...p, [m.id]: activeIndex > 0 ? activeIndex - 1 : mediaList.length - 1 })) }} 
                                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
                              >
                                <ChevronLeft size={20} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => ({ ...p, [m.id]: activeIndex < mediaList.length - 1 ? activeIndex + 1 : 0 })) }} 
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
                              >
                                <ChevronRight size={20} />
                              </button>
                              <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 10, background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: 12 }}>
                                {mediaList.map((_: any, idx: number) => (
                                  <div key={idx} style={{ width: 6, height: 6, borderRadius: '50%', background: idx === activeIndex ? 'white' : 'rgba(255,255,255,0.4)', transition: 'background 0.3s' }} />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}
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
                        {(m.comments || []).map(c => (
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
            
            {visibleCount < meusMomentos.length && (
              <button 
                onClick={() => setVisibleCount(prev => prev + 5)}
                className="btn btn-secondary" 
                style={{ 
                  marginTop: 20, 
                  padding: '12px 24px', 
                  borderRadius: 20, 
                  fontWeight: 700, 
                  background: 'white', 
                  boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
                  border: '1px solid hsl(var(--border-subtle))'
                }}
              >
                Carregar Mais
              </button>
            )}
          </div>
        )}
      </div>

      {/* LIGHTBOX / GALLERY MODAL */}
      {isMounted && createPortal(
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
        </AnimatePresence>,
        document.body
      )}

      {/* === MODAL: NOVO MOMENTO === */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.93, opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', boxShadow: '0 32px 64px rgba(0,0,0,0.3)' }}>

              {isSubmitting && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: 80, height: 80 }}>
                    <Loader2 size={80} color="#7c3aed" style={{ animation: 'spin 1.5s linear infinite', opacity: 0.2 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#7c3aed', fontSize: 18 }}>
                      {Math.round((Object.values(uploadProgress).reduce((a, b) => a + b, 0) / (newPost.mediaFiles.length || 1)) || 0)}%
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#111827', fontSize: 18 }}>Publicando Momento</div>
                  <div style={{ color: '#6b7280', fontSize: 14, maxWidth: 300 }}>
                    Enviando {newPost.mediaFiles.length} mídia{newPost.mediaFiles.length !== 1 ? 's' : ''}. Isso pode levar alguns segundos dependendo do tamanho dos vídeos.
                  </div>
                  
                  {/* Lista de arquivos com status */}
                  <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    {newPost.mediaFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        {f.type.includes('video') ? <Video size={16} color="#6366f1" /> : <ImageIcon size={16} color="#ec4899" />}
                        <div style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        {uploadProgress[f.name] === 100 ? <Check size={16} color="#10b981" /> : <Loader2 size={14} className="animate-spin" color="#94a3b8" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>Novo Momento</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Publique fotos e vídeos no mural da turma</p>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', color: '#374151' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Media upload */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <ImageIcon size={14} /> Mídias (imagens ou vídeos)
                  </label>
                  <input type="file" multiple accept="image/*,video/*" id="upload-midia" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files) setNewPost(p => ({ ...p, mediaFiles: [...p.mediaFiles, ...Array.from(e.target.files!)] })) }} />
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {newPost.mediaFiles.map((file, i) => (
                      <div key={i} style={{ width: 76, height: 76, borderRadius: 12, background: '#f3f4f6', border: '1px solid #e5e7eb', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button onClick={() => setNewPost(p => ({ ...p, mediaFiles: p.mediaFiles.filter((_, idx) => idx !== i) }))}
                          style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                          <X size={10} />
                        </button>
                        {file.type.includes('video')
                          ? <Video size={24} color="#9ca3af" />
                          : <img src={URL.createObjectURL(file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                      </div>
                    ))}
                    <label htmlFor="upload-midia" style={{ width: 76, height: 76, borderRadius: 12, border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', background: '#fafafa', transition: 'all 0.2s' }}>
                      <Plus size={22} />
                    </label>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Legenda</label>
                  <textarea rows={3} value={newPost.desc} onChange={e => setNewPost({ ...newPost, desc: e.target.value })}
                    placeholder="Escreva uma legenda para este momento..."
                    style={{ width: '100%', borderRadius: 12, border: '1.5px solid #e5e7eb', padding: '10px 14px', fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#111827' }} />
                </div>

                {/* Target Classes */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Visibilidade</label>
                    <button onClick={() => setShowDestModal(true)} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                      + Selecionar Turmas
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 40, background: '#f9fafb', padding: 10, borderRadius: 12, border: '1.5px solid #e5e7eb' }}>
                    {newPost.targetClasses.length === 0
                      ? <span style={{ color: '#9ca3af', fontSize: 12 }}>Toda a Escola (padrão)</span>
                      : newPost.targetClasses.map(t => (
                        <span key={t.id} style={{ background: 'rgba(99,102,241,0.1)', color: '#4f46e5', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {t.name}
                          <button onClick={() => setNewPost(p => ({ ...p, targetClasses: p.targetClasses.filter(x => x.id !== t.id) }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', display: 'flex', padding: 0 }}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} disabled={isSubmitting}
                  style={{ padding: '10px 20px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  Cancelar
                </button>
                <button onClick={submitPost} disabled={isSubmitting}
                  style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(90deg,#7c3aed,#a855f7,#ec4899)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>
                  {isSubmitting ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Publicando...</> : <><Plus size={16} /> Publicar no Mural</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DestinatariosModal
        isOpen={showDestModal}
        onClose={() => setShowDestModal(false)}
        initialSelected={newPost.targetClasses}
        onAdd={res => setNewPost({ ...newPost, targetClasses: res as any })}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
