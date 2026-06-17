'use client'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useEffect, useMemo } from 'react'
import { Image as ImageIcon, X, Filter, Plus, ChevronDown, Video, Loader2, Check, Camera } from 'lucide-react'
import { useAgendaDigital, ADMomento, ADMedia } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { DestinatariosModal } from '@/components/agenda/DestinatariosModal'
import { MomentoPostCard } from '@/components/agenda/MomentoPostCard'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'

export default function ADAdminMomentos() {
  const { momentosFeed: feed, setMomentosFeed: setFeed, setMomentosFeedLocally, adAlert, adConfirm, isDataLoading } = useAgendaDigital()
  const { turmas = [] } = useData()
  const [alunos = []] = useSupabaseArray<any>('alunos/lightweight', [])
  const { currentUser } = useApp()
  const [filterTurma, setFilterTurma] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15
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
      insertMessage: (doc) => `Novo momento de ${doc.author || 'alguém'}!`,
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
        authorId: currentUser?.id,
        targetClasses,
        targetClassesIds,
        alunosIds,
        alunosNomes,
        media: mediaArray, desc: newPost.desc, status: 'approved', time: 'Agora', likes: [], comments: []
      }

      setFeed(prev => [post, ...prev])
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

  const filteredFeed = React.useMemo(() => {
    return feed.filter(p => {
      if (filterTurma === 'all') return true

      const targetClasses = p.targetClasses || []
      const targetAlunos = p.alunosIds || []

      // Se for global
      if (targetClasses.length === 0 && targetAlunos.length === 0) return true

      // Se for direcionado a turmas
      if (targetClasses.includes(filterTurma) || targetClasses.includes('Toda a Escola')) return true

      // Se for direcionado a alunos específicos
      if (targetAlunos.length > 0) {
        const matchedAlunos = (alunos || []).filter((a: any) => 
          targetAlunos.some((idRaw: string) => String(idRaw).replace(/^_*(ALU)?/, '') === String(a.id).replace(/^_*(ALU)?/, ''))
        )
        const hasAlunoInSelectedTurma = matchedAlunos.some((a: any) => {
          const turmaObj = turmas.find((t: any) => 
            String(t.id) === String(a.turma) || 
            String(t.codigo) === String(a.turma) || 
            String(t.nome) === String(a.turma)
          )
          return turmaObj?.nome === filterTurma || a.turma === filterTurma
        })
        if (hasAlunoInSelectedTurma) return true
      }

      return false
    })
  }, [feed, filterTurma, alunos, turmas])

  const totalPages = Math.max(1, Math.ceil(filteredFeed.length / PAGE_SIZE))
  
  const pagedFeed = React.useMemo(() => {
    return filteredFeed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  }, [filteredFeed, page])
  const selectStyle: React.CSSProperties = {
    appearance: 'none', WebkitAppearance: 'none',
    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
    cursor: 'pointer', outline: 'none', height: 42
  }

  // Marcação de lidos
  useEffect(() => {
    if (!currentUser?.id || pagedFeed.length === 0) return;
    
    // Identifica quais IDs não constam como lidos para este admin
    const unreadIds = pagedFeed
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
  }, [pagedFeed, currentUser?.id]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '28px 32px', fontFamily: 'Inter, Outfit, sans-serif' }}>

      {/* === HEADER === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: 0 }}>
            Momentos <span style={{ background: 'linear-gradient(90deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>(Mural)</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Moderação de fotos e atividades postadas pelas professoras.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filter: Turmas */}
          <div style={{ position: 'relative' }}>
            <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
            <select style={{ ...selectStyle, paddingLeft: 32, minWidth: 160 }} value={filterTurma} onChange={e => setFilterTurma(e.target.value)}>
              <option value="all">Todas as Turmas</option>
              {turmas.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
          </div>

          {/* New Momento button */}
          <button onClick={() => setShowModal(true)} style={{
            height: 42, padding: '0 20px', border: 'none', borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(90deg, #7c3aed, #a855f7, #ec4899)',
            color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 16px rgba(168,85,247,0.4)', transition: 'opacity 0.2s'
          }}>
            <Plus size={16} /> Novo Momento
          </button>
        </div>
      </div>

      {/* === BANNER === */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 30%, #7c3aed 60%, #db2777 85%, #f97316 100%)',
        borderRadius: 20,
        padding: '14px 32px',
        marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
        overflow: 'hidden', position: 'relative',
        boxShadow: '0 8px 40px rgba(124,58,237,0.35), 0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <div style={{ position: 'absolute', top: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 180, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.18)', backdropFilter: 'none',
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>❝</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2, textShadow: '0 1px 8px rgba(0,0,0,0.2)' }}>
              Cada momento compartilhado é uma memória que fica.
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Continue incentivando, participando e celebrando cada conquista!</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, zIndex: 1 }}>
          <span style={{ fontSize: 16, opacity: 0.7 }}>✦</span>
          <span style={{ fontSize: 12, opacity: 0.5 }}>✦</span>
          <span style={{ fontSize: 60, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>🚀</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', opacity: 0.85, boxShadow: '0 4px 16px rgba(124,58,237,0.5)' }} />
            <span style={{ fontSize: 12, opacity: 0.6 }}>✦</span>
          </div>
        </div>
      </div>

      {/* === GRID === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
        {pagedFeed.map((post, i) => (
          <MomentoPostCard
            key={post.id}
            post={post}
            index={(page - 1) * PAGE_SIZE + i}
            onDelete={id => adConfirm('Apagar momento?', 'Apagar', () => setFeed(prev => prev.filter(p => p.id !== id)))}
          />
        ))}
      </div>

      {filteredFeed.length === 0 && isDataLoading && (
        <div style={{ textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Loader2 size={48} className="animate-spin" color="#00D2FF" style={{ filter: 'drop-shadow(0 0 10px rgba(0,210,255,0.5))' }} />
        </div>
      )}
      
      {filteredFeed.length === 0 && !isDataLoading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Nenhum momento encontrado</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Publique o primeiro momento da sua escola!</div>
        </div>
      )}

      {/* === PAGINATION === */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40, paddingBottom: 16 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              width: 38, height: 38, borderRadius: 10, border: '1.5px solid #e2e8f0',
              background: page === 1 ? '#f9fafb' : '#fff', color: page === 1 ? '#d1d5db' : '#374151',
              cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, transition: 'all 0.2s'
            }}
          >‹</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setPage(n)}
              style={{
                width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
                background: n === page ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : '#fff',
                color: n === page ? '#fff' : '#374151',
                fontWeight: 700, fontSize: 14,
                boxShadow: n === page ? '0 4px 12px rgba(124,58,237,0.35)' : '0 1px 4px rgba(0,0,0,0.06)',
                border: n === page ? 'none' : '1.5px solid #e2e8f0',
                transition: 'all 0.2s'
              }}
            >{n}</button>
          ))}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              width: 38, height: 38, borderRadius: 10, border: '1.5px solid #e2e8f0',
              background: page === totalPages ? '#f9fafb' : '#fff', color: page === totalPages ? '#d1d5db' : '#374151',
              cursor: page === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, transition: 'all 0.2s'
            }}
          >›</button>

          <span style={{ marginLeft: 8, fontSize: 13, color: '#6b7280' }}>
            {filteredFeed.length} momento{filteredFeed.length !== 1 ? 's' : ''} · Página {page} de {totalPages}
          </span>
        </div>
      )}

      {/* === MODAL: NOVO MOMENTO === */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'none', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.93, opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', boxShadow: '0 32px 64px rgba(0,0,0,0.3)' }}>

              {isSubmitting && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'none', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: 80, height: 80 }}>
                    <Loader2 size={80} color="#7c3aed" style={{ animation: 'spin 1.5s linear infinite', opacity: 0.2 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#7c3aed', fontSize: 18 }}>
                      {Math.round((Object.values(uploadProgress).reduce((a, b) => a + b, 0) / newPost.mediaFiles.length) || 0)}%
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
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Publique fotos e vídeos no mural da escola</p>
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
                          style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(15,23,42,0.85)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
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
