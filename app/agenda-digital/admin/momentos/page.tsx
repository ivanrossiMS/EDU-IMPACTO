'use client'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'

const ClientPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  return mounted ? createPortal(children, document.body) : null;
};
import { Image as ImageIcon, X, Filter, Plus, ChevronDown, ChevronUp, Video, Loader2, Check, Camera, Send, Smile, Users, Globe, Upload } from 'lucide-react'
import { useAgendaDigital, ADMomento, ADMedia } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { useQueryClient } from '@tanstack/react-query'
import { DestinatariosModal } from '@/components/agenda/DestinatariosModal'
import { MomentoPostCard } from '@/components/agenda/MomentoPostCard'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'

export default function ADAdminMomentos() {
  const queryClient = useQueryClient()
  const { momentosFeed: feed, setMomentosFeed: setFeed, setMomentosFeedLocally, adAlert, adConfirm, isDataLoading, hasNextPageMomentos, fetchNextPageMomentos } = useAgendaDigital()
  const { turmas = [] } = useData()
  const [alunos = []] = useSupabaseArray<any>('alunos/lightweight?limit=2000', [])
  const { currentUser } = useApp()
  const [filterTurma, setFilterTurma] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15
  const [showModal, setShowModal] = useState(false)
  const [showDestModal, setShowDestModal] = useState(false)
  const [showAllDestinatarios, setShowAllDestinatarios] = useState(false)
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
      insertMessage: (doc) => `Novo momento de ${doc.author || doc.dados?.author || 'alguém'}!`,
      updateMessage: (doc) => `Momento atualizado!`,
      icon: <Camera size={18} color="#00D2FF" />
    },
    onInsert: ({ new: newMomento }) => {
      const merged = { ...newMomento, ...(newMomento?.dados || {}), _isNew: true };
      if (setMomentosFeedLocally) {
        setMomentosFeedLocally((prev: any) => {
          if (prev.some((p: any) => String(p.id) === String(merged.id))) return prev;
          const newFeed = [merged, ...prev].sort((a: any, b: any) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
          return newFeed;
        });
        setTimeout(() => {
          setMomentosFeedLocally((curr: any) => curr.map((c: any) => String(c.id) === String(merged.id) ? { ...c, _isNew: false } : c));
        }, 5000);
      }
    },
    onUpdate: ({ new: updatedMomento }) => {
      const merged = { ...updatedMomento, ...(updatedMomento?.dados || {}) };
      if (setMomentosFeedLocally) {
        setMomentosFeedLocally((prev: any) => prev.map((p: any) => String(p.id) === String(merged.id) ? { ...p, ...merged } : p));
      }
    },
    onDelete: ({ old }) => {
      if (setMomentosFeedLocally && old?.id) {
        setMomentosFeedLocally((prev: any) => prev.filter((p: any) => String(p.id) !== String(old.id)));
      }
    }
  });

  useEffect(() => {
    const handleSync = () => {
      queryClient.invalidateQueries({ queryKey: ['agenda', 'momentos'] });
    };
    window.addEventListener('ad:momentos-insert', handleSync);
    window.addEventListener('ad:momentos-update', handleSync);
    window.addEventListener('ad:momentos-delete', handleSync);
    return () => {
      window.removeEventListener('ad:momentos-insert', handleSync);
      window.removeEventListener('ad:momentos-update', handleSync);
      window.removeEventListener('ad:momentos-delete', handleSync);
    };
  }, [queryClient]);

  const handleDelete = async (id: string | number) => {
    try {
      const res = await fetch(`/api/agenda/momentos?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFeed(prev => prev.filter(p => String(p.id) !== String(id)));
        setMomentosFeedLocally?.((prev: any) => prev.filter((p: any) => String(p.id) !== String(id)));
        queryClient.invalidateQueries({ queryKey: ['agenda', 'momentos'] });
        window.dispatchEvent(new CustomEvent('ad:momentos-delete', { detail: { id, old: { id } } }));
        adAlert('Momento excluído com sucesso!', 'Sucesso');
      } else {
        throw new Error('Erro ao excluir momento na API');
      }
    } catch (err: any) {
      console.error(err);
      adAlert(err.message || 'Ocorreu um erro ao excluir o momento.', 'Erro');
    }
  };

  const submitPost = async () => {
    if (isSubmitting) return
    if (!newPost.mediaFiles.length) return adAlert('Selecione ao menos uma foto ou vídeo para publicar.', 'Atenção')
    
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
          fileToUpload = await compressImage(file, { quality: 0.65, format: 'image/webp' })
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
      const selectedFuncionarios = isSelected ? newPost.targetClasses.filter(t => t.type === 'funcionario') : [];

      const targetClasses = selectedTurmas.length > 0 
        ? selectedTurmas.map(t => t.name) 
        : (selectedAlunos.length > 0 || selectedFuncionarios.length > 0 ? [] : ['Toda a Escola']);
        
      const targetClassesIds = selectedTurmas.flatMap(t => {
        const rawId = String(t.id);
        const cleanId = rawId.replace(/^[tg]_?/, '');
        return [rawId, cleanId];
      });
      const alunosIds = selectedAlunos.map(t => String(t.id).replace(/^a_?/, ''));
      const alunosNomes = selectedAlunos.map(t => t.name);
      const funcionariosIds = selectedFuncionarios.map(t => String(t.id).replace(/^f_?/, ''));
      const selectedGruposNames = selectedTurmas.filter(t => t.type === 'grupo').map(t => t.name);
      const selectedGruposIds = selectedTurmas.filter(t => t.type === 'grupo').map(t => String(t.id).replace(/^[tg]_?/, ''));

      const nowIso = new Date().toISOString()
      const post: ADMomento = {
        id: `momento_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        author: currentUser?.nome || 'Administração',
        authorId: currentUser?.id,
        targetClasses,
        targetClassesIds: Array.from(new Set(targetClassesIds)),
        alunosIds,
        alunosNomes,
        funcionariosIds,
        media: mediaArray,
        desc: newPost.desc,
        status: 'approved',
        time: 'Agora',
        date: nowIso,
        created_at: nowIso,
        likes: [],
        comments: [],
        dados: {
          grupos: selectedGruposNames,
          gruposIds: selectedGruposIds,
          targetGrupos: selectedGruposNames
        }
      }

      setMomentosFeedLocally?.(prev => [post, ...prev])
      setShowModal(false)
      setShowAllDestinatarios(false)
      setNewPost({ mediaFiles: [], targetClasses: [], desc: '' })
      adAlert('Momento publicado com sucesso!', '🎉 Sucesso')

      try {
        const res = await fetch('/api/agenda/momentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post)
        })
        if (res.ok) {
          const savedData = await res.json()
          if (savedData && savedData.id) {
            setMomentosFeedLocally?.((prev: any[]) =>
              prev.map(item => String(item.id) === String(post.id) ? { ...post, ...savedData, ...(savedData.dados || {}) } : item)
            )
          }
        } else {
          console.error("Error creating momento: status", res.status)
        }
      } catch (err) {
        console.error("Error creating momento:", err)
      } finally {
        queryClient.invalidateQueries({ queryKey: ['agenda', 'momentos'] })
      }
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

      // Se for direcionado a turmas ou grupos
      const cleanFilter = filterTurma.replace(/^[tg]_?/, '');
      const targetClassesIds = p.targetClassesIds || []
      const postGrupos = (p as any).dados?.grupos || (p as any).grupos || []
      const postGruposIds = (p as any).dados?.gruposIds || []

      if (
        targetClasses.includes(filterTurma) ||
        targetClasses.includes('Toda a Escola') ||
        targetClassesIds.includes(filterTurma) ||
        targetClassesIds.includes(cleanFilter) ||
        targetClassesIds.includes(`t_${cleanFilter}`) ||
        targetClassesIds.includes(`g_${cleanFilter}`) ||
        postGrupos.includes(filterTurma) ||
        postGruposIds.includes(cleanFilter)
      ) return true

      // Se for direcionado a alunos específicos
      if (targetAlunos.length > 0) {
        const matchedAlunos = (alunos || []).filter((a: any) => 
          targetAlunos.some((idRaw: string) => String(idRaw).replace(/^_*(ALU)?/, '') === String(a.id).replace(/^_*(ALU)?/, ''))
        )
        const hasAlunoInSelectedTurma = matchedAlunos.some((a: any) => isAlunoCursandoTurma(a, filterTurma))
        if (hasAlunoInSelectedTurma) return true
      }

      return false
    })
  }, [feed, filterTurma, alunos, turmas])

  const totalPages = Math.max(1, Math.ceil(filteredFeed.length / PAGE_SIZE)) + (hasNextPageMomentos ? 1 : 0)
  
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
            onDelete={id => handleDelete(id)}
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

          {Array.from({ length: Math.ceil(filteredFeed.length / PAGE_SIZE) }, (_, i) => i + 1).map(n => (
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
            onClick={() => {
              if (page >= Math.ceil(filteredFeed.length / PAGE_SIZE) && hasNextPageMomentos && fetchNextPageMomentos) {
                fetchNextPageMomentos()
              }
              setPage(p => p + 1)
            }}
            disabled={page >= totalPages && !hasNextPageMomentos}
            style={{
              width: 38, height: 38, borderRadius: 10, border: '1.5px solid #e2e8f0',
              background: (page >= totalPages && !hasNextPageMomentos) ? '#f9fafb' : '#fff', color: (page >= totalPages && !hasNextPageMomentos) ? '#d1d5db' : '#374151',
              cursor: (page >= totalPages && !hasNextPageMomentos) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, transition: 'all 0.2s'
            }}
          >›</button>

          <span style={{ marginLeft: 8, fontSize: 13, color: '#6b7280' }}>
            {filteredFeed.length}{hasNextPageMomentos ? '+' : ''} momento{filteredFeed.length !== 1 ? 's' : ''} · Página {page}
          </span>
        </div>
      )}

      {/* === MODAL: NOVO MOMENTO === */}
      {showModal && (
        <ClientPortal>
          <AnimatePresence>
            <motion.div className="ad-momento-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ad-momento-content" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }} transition={{ duration: 0.2 }}
              style={{ background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

              {isSubmitting && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: 84, height: 84 }}>
                    <Loader2 size={84} color="#7c3aed" style={{ animation: 'spin 1.5s linear infinite', opacity: 0.25 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#7c3aed', fontSize: 20 }}>
                      {Math.round((Object.values(uploadProgress).reduce((a, b) => a + b, 0) / newPost.mediaFiles.length) || 0)}%
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 19 }}>Publicando Momento...</div>
                  <div style={{ color: '#64748b', fontSize: 13.5, maxWidth: 320, lineHeight: 1.4 }}>
                    Otimizando e enviando {newPost.mediaFiles.length} mídia{newPost.mediaFiles.length !== 1 ? 's' : ''}. Aguarde alguns instantes.
                  </div>
                  
                  {/* Lista de arquivos com status */}
                  <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    {newPost.mediaFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', padding: '9px 14px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        {f.type.includes('video') ? <Video size={16} color="#6366f1" /> : <ImageIcon size={16} color="#ec4899" />}
                        <div style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        {uploadProgress[f.name] === 100 ? <Check size={16} color="#10b981" /> : <Loader2 size={14} className="animate-spin" color="#94a3b8" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Header: Gradiente Ultra Moderno */}
              <div style={{ 
                padding: '22px 24px', 
                flexShrink: 0,
                background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 45%, #8b5cf6 75%, #ec4899 100%)',
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: -30, right: 20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.15)', filter: 'blur(20px)', pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                  <div style={{ 
                    width: 44, height: 44, borderRadius: 14, 
                    background: 'rgba(255, 255, 255, 0.2)', 
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: '#ffffff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <Camera size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Novo Momento</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Publique fotos e vídeos no mural da escola</p>
                  </div>
                </div>

                <button 
                  onClick={() => { setShowModal(false); setShowAllDestinatarios(false); }} 
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.2)', 
                    border: '1px solid rgba(255, 255, 255, 0.3)', 
                    borderRadius: 12, 
                    width: 36, 
                    height: 36, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#ffffff',
                    position: 'relative',
                    zIndex: 1,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.32)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ flex: 1, minHeight: 0, padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Media upload */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                        <ImageIcon size={15} />
                      </div>
                      <label htmlFor="upload-midia-admin" style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                        Mídias (Fotos ou Vídeos)
                      </label>
                    </div>
                    {newPost.mediaFiles.length > 0 ? (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6366f1', background: '#e0e7ff', padding: '2px 10px', borderRadius: 12 }}>
                        {newPost.mediaFiles.length} selecionada{newPost.mediaFiles.length > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: 12 }}>
                        Obrigatório
                      </span>
                    )}
                  </div>

                  <input type="file" multiple accept="image/*,video/*" id="upload-midia-admin" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files) setNewPost(p => ({ ...p, mediaFiles: [...p.mediaFiles, ...Array.from(e.target.files!)] })) }} />
                  
                  {newPost.mediaFiles.length === 0 ? (
                    <label htmlFor="upload-midia-admin" style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '28px 16px', 
                      borderRadius: 18, 
                      border: '2px dashed #cbd5e1', 
                      background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease', 
                      textAlign: 'center', 
                      gap: 8 
                    }}>
                      <div style={{ 
                        width: 48, height: 48, borderRadius: 14, 
                        background: 'linear-gradient(135deg, #ede9fe 0%, #fce7f3 100%)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        color: '#7c3aed', 
                        boxShadow: '0 4px 14px rgba(124, 58, 237, 0.12)' 
                      }}>
                        <Upload size={22} />
                      </div>
                      <div>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#334155' }}>Toque para escolher fotos ou vídeos</span>
                        <p style={{ fontSize: 11.5, color: '#64748b', margin: '3px 0 0' }}>JPG, PNG ou MP4 (máximo 50MB)</p>
                      </div>
                    </label>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 10 }}>
                      {newPost.mediaFiles.map((file, i) => (
                        <div key={i} style={{ 
                          aspectRatio: '1/1', 
                          borderRadius: 14, 
                          overflow: 'hidden', 
                          position: 'relative', 
                          background: '#0f172a', 
                          border: '1.5px solid #e2e8f0', 
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
                        }}>
                          {file.type.includes('video') ? (
                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}>
                              <Video size={24} color="#a5b4fc" />
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#c7d2fe', marginTop: 4, textTransform: 'uppercase' }}>Vídeo</span>
                            </div>
                          ) : (
                            <img src={URL.createObjectURL(file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                          )}

                          <button 
                            type="button"
                            onClick={() => setNewPost(p => ({ ...p, mediaFiles: p.mediaFiles.filter((_, idx) => idx !== i) }))}
                            style={{ 
                              position: 'absolute', top: 5, right: 5, 
                              width: 22, height: 22, borderRadius: '50%', 
                              background: 'rgba(15, 23, 42, 0.8)', 
                              backdropFilter: 'blur(4px)',
                              border: '1px solid rgba(255,255,255,0.25)', 
                              color: '#ffffff', 
                              cursor: 'pointer', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center', 
                              boxShadow: '0 2px 6px rgba(0,0,0,0.2)' 
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}

                      <label htmlFor="upload-midia-admin" style={{ 
                        aspectRatio: '1/1', 
                        borderRadius: 14, 
                        border: '2px dashed #c7d2fe', 
                        background: '#f5f3ff', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 4, 
                        cursor: 'pointer', 
                        color: '#7c3aed', 
                        transition: 'all 0.15s ease' 
                      }}>
                        <Plus size={22} strokeWidth={2.5} />
                        <span style={{ fontSize: 11, fontWeight: 700 }}>Mais</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }}>
                        <Smile size={15} />
                      </div>
                      <label style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>Legenda do Momento</label>
                    </div>
                    {newPost.desc.trim() ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#d1fae5', padding: '2px 8px', borderRadius: 12 }}>
                        Preenchido
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>
                        Opcional
                      </span>
                    )}
                  </div>

                  <textarea 
                    rows={3} 
                    value={newPost.desc} 
                    onChange={e => setNewPost({ ...newPost, desc: e.target.value })}
                    placeholder="Escreva uma legenda para este momento (opcional)..."
                    style={{ 
                      width: '100%', 
                      borderRadius: 16, 
                      border: '1.5px solid #e2e8f0', 
                      background: '#f8fafc',
                      padding: '12px 16px', 
                      fontSize: 14, 
                      lineHeight: 1.45,
                      resize: 'none', 
                      outline: 'none', 
                      fontFamily: 'inherit', 
                      boxSizing: 'border-box', 
                      color: '#0f172a',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#8b5cf6'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.12)'
                      e.currentTarget.style.background = '#ffffff'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.background = '#f8fafc'
                    }}
                  />
                </div>

                {/* Target Classes */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                        <Users size={15} />
                      </div>
                      <label style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>Visibilidade</label>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowDestModal(true)} 
                      style={{ 
                        background: '#ffffff', 
                        border: '1px solid #c7d2fe', 
                        borderRadius: 10, 
                        padding: '5px 12px', 
                        fontSize: 12, 
                        fontWeight: 700, 
                        cursor: 'pointer', 
                        color: '#4338ca',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                      onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                    >
                      <Plus size={13} strokeWidth={2.5} />
                      <span>{newPost.targetClasses.length === 0 ? 'Selecionar Destinatários' : 'Alterar Destinatários'}</span>
                    </button>
                  </div>

                  <div style={{ 
                    background: newPost.targetClasses.length === 0 ? 'linear-gradient(135deg, rgba(238,242,255,0.7) 0%, rgba(245,243,255,0.7) 100%)' : '#f8fafc', 
                    padding: 12, 
                    borderRadius: 16, 
                    border: newPost.targetClasses.length === 0 ? '1.5px solid rgba(99,102,241,0.25)' : '1.5px solid #e2e8f0',
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    maxHeight: showAllDestinatarios ? 180 : 'none',
                    overflowY: showAllDestinatarios ? 'auto' : 'visible'
                  }}>
                    {newPost.targetClasses.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', flexShrink: 0 }}>
                          <Globe size={15} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: '#1e1b4b', fontSize: 13, fontWeight: 700 }}>Toda a Escola (padrão)</span>
                          <span style={{ color: '#6366f1', fontSize: 11, fontWeight: 500 }}>Visível para todas as turmas, alunos e colaboradores</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {(showAllDestinatarios ? newPost.targetClasses : newPost.targetClasses.slice(0, 3)).map(t => (
                          <span key={t.id} style={{ 
                            background: '#ffffff', 
                            color: '#4f46e5', 
                            border: '1px solid #c7d2fe',
                            padding: '4px 10px', 
                            borderRadius: 20, 
                            fontSize: 12, 
                            fontWeight: 700, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 6,
                            boxShadow: '0 1px 3px rgba(99,102,241,0.06)'
                          }}>
                            {t.name}
                            <button 
                              type="button"
                              onClick={() => setNewPost(p => ({ ...p, targetClasses: p.targetClasses.filter(x => x.id !== t.id) }))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', display: 'flex', padding: 0 }}
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                        {newPost.targetClasses.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setShowAllDestinatarios(!showAllDestinatarios)}
                            style={{
                              background: '#EEF2FF',
                              color: '#4F46E5',
                              border: '1px solid #C7D2FE',
                              padding: '4px 12px',
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(79, 70, 229, 0.08)',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#E0E7FF'}
                            onMouseLeave={e => e.currentTarget.style.background = '#EEF2FF'}
                          >
                            {showAllDestinatarios ? (
                              <>
                                <ChevronUp size={13} strokeWidth={2.5} />
                                <span>Mostrar menos</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown size={13} strokeWidth={2.5} />
                                <span>Mostrar todos ({newPost.targetClasses.length})</span>
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ 
                padding: '16px 24px calc(16px + env(safe-area-inset-bottom, 0px)) 24px', 
                flexShrink: 0,
                borderTop: '1px solid #f1f5f9', 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                background: '#ffffff'
              }}>
                <button 
                  type="button"
                  onClick={() => { setShowModal(false); setShowAllDestinatarios(false); }} 
                  disabled={isSubmitting}
                  style={{ 
                    padding: '12px 20px', 
                    borderRadius: 14, 
                    border: '1.5px solid #e2e8f0', 
                    background: '#f8fafc', 
                    color: '#64748b', 
                    fontWeight: 700, 
                    cursor: 'pointer', 
                    fontSize: 14,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#f1f5f9'
                    e.currentTarget.style.color = '#1e293b'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#f8fafc'
                    e.currentTarget.style.color = '#64748b'
                  }}
                >
                  Cancelar
                </button>

                <button 
                  type="button"
                  onClick={submitPost} 
                  disabled={isSubmitting || !newPost.mediaFiles.length}
                  style={{ 
                    padding: '12px 24px', 
                    borderRadius: 14, 
                    border: 'none', 
                    background: (!newPost.mediaFiles.length) 
                      ? '#cbd5e1' 
                      : 'linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #ec4899 100%)', 
                    color: '#ffffff', 
                    fontWeight: 800, 
                    fontSize: 14, 
                    cursor: (!newPost.mediaFiles.length) ? 'not-allowed' : 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    boxShadow: (!newPost.mediaFiles.length) ? 'none' : '0 6px 20px rgba(124,58,237,0.35)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    if (newPost.mediaFiles.length) {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,58,237,0.45)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (newPost.mediaFiles.length) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,58,237,0.35)'
                    }
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Publicando...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Publicar no Mural</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
          </AnimatePresence>
        </ClientPortal>
      )}

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
