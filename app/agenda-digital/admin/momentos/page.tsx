'use client'

import { useState } from 'react'
import { Image as ImageIcon, Check, X, Filter, MoreHorizontal, MessageSquare, AlertCircle, Plus, ChevronLeft, ChevronRight, Heart, Trash2, Video } from 'lucide-react'
import { useAgendaDigital, ADMomento, ADMedia } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { DestinatariosModal } from '@/components/agenda/DestinatariosModal'

function PostCard({ post, onApprove, onReject, onDelete }: { post: ADMomento, onApprove: (id: string|number)=>void, onReject: (id: string|number)=>void, onDelete: (id: string|number)=>void }) {
  const [slide, setSlide] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const { adAlert, adConfirm } = useAgendaDigital()
  
  const medias = post.media || []
  const hasMultiple = medias.length > 1
  const currentMedia = medias[slide]

  return (
    <div className="card ad-momentos-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
           <div className="avatar" style={{ width: 36, height: 36, background: 'var(--gradient-purple)', color: 'white', fontSize: 14 }}>
             {post.author.charAt(0)}
           </div>
           <div>
             <div style={{ fontSize: 14, fontWeight: 700 }}>{post.author}</div>
             <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{(post.targetClasses || []).join(', ')} • {post.time}</div>
           </div>
         </div>
         <button className="btn btn-ghost btn-sm" style={{ padding: 4, color: '#ef4444' }} onClick={() => {
           adConfirm('Tem certeza que deseja apagar este momento?', 'Apagar Momento', () => onDelete(post.id))
         }} title="Apagar Post">
           <Trash2 size={16} />
         </button>
      </div>
      
      {/* Media Carousel */}
      <div className="ad-momentos-card-media-wrapper" style={{ width: '100%', aspectRatio: '4/3', background: '#000', position: 'relative' }}>
         {currentMedia ? (
           currentMedia.type === 'video' || currentMedia.url.match(/\.(mp4|webm)$/i) ? (
             <video src={currentMedia.url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
           ) : (
             <img src={currentMedia.url} alt="Post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
           )
         ) : (
           <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Sem Mídia</div>
         )}
         
         {post.status === 'rejected' && (
           <div style={{ position: 'absolute', inset: 0, background: 'rgba(239, 68, 68, 0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: 24, textAlign: 'center', zIndex: 10 }}>
              <AlertCircle size={32} style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Foto Rejeitada</div>
              <div style={{ fontSize: 13 }}>Motivo: {post.reason}</div>
           </div>
         )}

         {hasMultiple && (
           <>
             <button className="btn btn-ghost btn-icon btn-sm" 
               style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.8)', color: '#000' }}
               onClick={() => setSlide(s => s === 0 ? medias.length - 1 : s - 1)}>
               <ChevronLeft size={16} />
             </button>
             <button className="btn btn-ghost btn-icon btn-sm" 
               style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.8)', color: '#000' }}
               onClick={() => setSlide(s => s === medias.length - 1 ? 0 : s + 1)}>
               <ChevronRight size={16} />
             </button>
             <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
               {medias.map((_, i) => (
                 <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === slide ? '#fff' : 'rgba(255,255,255,0.4)' }} />
               ))}
             </div>
           </>
         )}
      </div>
      
      {/* Content */}
      <div className="ad-momentos-card-content" style={{ padding: '16px' }}>
        <p style={{ fontSize: 14, margin: '0 0 16px 0', lineHeight: 1.5 }}>
          {post.desc}
        </p>

        {/* Actions */}
        {post.status === 'pending' && (
           <div style={{ display: 'flex', gap: 12 }}>
             <button className="btn" style={{ flex: 1, background: '#10b981', color: 'white', borderColor: '#10b981' }} onClick={() => onApprove(post.id)}>
               <Check size={16} /> Aprovar
             </button>
             <button className="btn btn-secondary" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => onReject(post.id)}>
               <X size={16} />
             </button>
           </div>
        )}
         {post.status === 'approved' && (
           <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
             <div className="badge badge-success" style={{ width: '100%', justifyContent: 'center', padding: '8px 0' }}>
               <Check size={16} style={{ marginRight: 6 }}/> Publicado no Feed
             </div>
           </div>
        )}
      </div>

      {post.status === 'approved' && (
        <>
         <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 16 }}>
           <button className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'hsl(var(--text-secondary))' }} onClick={() => setShowComments(!showComments)}>
             <MessageSquare size={14} style={{ marginRight: 6 }}/> {(post.comments || []).length} Comentários
           </button>
           <button className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'hsl(var(--text-secondary))' }} onClick={() => adAlert('Curtiram:\n' + (post.likes || []).join('\n'), 'Curtidas')}>
             <Heart size={14} style={{ marginRight: 6, color: (post.likes || []).length > 0 ? '#ef4444' : 'inherit' }}/> {(post.likes || []).length} Curtidas
           </button>
         </div>
         {showComments && (
           <div style={{ padding: '12px 16px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-main))', display: 'flex', flexDirection: 'column', gap: 12 }}>
             {(!post.comments || post.comments.length === 0) ? (
               <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center' }}>Nenhum comentário.</div>
             ) : (
               post.comments.map(c => (
                 <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'hsl(var(--bg-surface))', padding: '8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                   <div>
                     <div style={{ fontSize: 13, fontWeight: 700 }}>{c.author} <span style={{ fontWeight: 400, color: 'hsl(var(--text-muted))', fontSize: 11 }}>• {c.time}</span></div>
                     <div style={{ fontSize: 13 }}>{c.text}</div>
                   </div>
                   <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#ef4444' }} onClick={() => adAlert('Comentário apagado (simulação).', 'Ação')}><Trash2 size={13}/></button>
                 </div>
               ))
             )}
           </div>
         )}
        </>
      )}
    </div>
  )
}

export default function ADAdminMomentos() {
  const { momentosFeed: feed, setMomentosFeed: setFeed, adAlert, adConfirm } = useAgendaDigital()
  const { turmas } = useData()

  const [filterType, setFilterType] = useState('pending')
  const [filterTurma, setFilterTurma] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [showDestModal, setShowDestModal] = useState(false)
  const [newPost, setNewPost] = useState({ mediaFiles: [] as File[], targetClasses: [] as {id: string, name: string, type: 'turma' | 'funcionario'}[], desc: '' })

  const handleApprove = (id: number | string) => {
    setFeed(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p))
  }

  const handleReject = (id: number | string) => {
    const reason = prompt('Motivo da rejeição:') || 'Não especificado'
    setFeed(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected', reason } : p))
  }

  const submitPost = async () => {
    try {
      if(newPost.mediaFiles.length === 0 || !newPost.desc) return adAlert('Anexe arquivos e preencha a leganda.', 'Atenção')
      
      const mediaArray: ADMedia[] = await Promise.all(newPost.mediaFiles.map(async f => {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(f)
        })
        return {
          type: f.type.includes('video') ? 'video' : 'image',
          url: b64
        }
      }))

      const post: ADMomento = {
        id: Date.now(),
        author: 'Administração',
        targetClasses: newPost.targetClasses.length > 0 ? newPost.targetClasses.map(t => t.name) : ['Toda a Escola'],
        media: mediaArray,
        desc: newPost.desc,
        status: 'approved',
        time: 'Agora',
        likes: [],
        comments: []
      }
      setFeed(prev => [post, ...prev])
      setFilterType('all')
      setShowModal(false)
      setNewPost({ mediaFiles: [], targetClasses: [], desc: '' })
      adAlert('Momento publicado com sucesso!', 'Sucesso')
    } catch (e) {
      console.error(e)
      adAlert('Ocorreu um erro ao processar as mídias.', 'Erro')
    }
  }


  const filteredFeed = feed.filter(p => {
    const matchStatus = filterType === 'all' || p.status === filterType
    const matchTurma = filterTurma === 'all' || (p.targetClasses || []).includes(filterTurma) || (p.targetClasses || []).includes('Toda a Escola')
    return matchStatus && matchTurma
  })

  return (
    <div className="ad-admin-page-container ad-mobile-optimized ad-momentos-mobile-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
           .ad-momentos-mobile-container {
              padding-top: 16px !important;
           }
           .ad-momentos-header-actions {
              flex-direction: column !important;
              width: 100% !important;
           }
           .ad-momentos-header-actions > * {
              width: 100% !important;
           }
           .ad-momentos-card {
              border-radius: 8px !important; 
              box-shadow: 0 12px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.03) !important;
              margin: 0 -8px 24px -8px !important; 
              width: calc(100% + 16px) !important;
              background: #ffffff !important;
              border: none !important;
           }
           .ad-momentos-card > div:first-child {
              padding: 16px 16px 12px 16px !important; /* Header padding */
              border-bottom: none !important;
           }
           .ad-momentos-card .avatar {
              width: 32px !important;
              height: 32px !important;
              font-size: 13px !important;
           }
           .ad-momentos-card .avatar + div > div:first-child {
              font-size: 13px !important; /* Author name */
           }
           .ad-momentos-card .avatar + div > div:last-child {
              font-size: 11px !important; /* Subtitle / time */
           }
           .ad-momentos-card-media-wrapper {
              aspect-ratio: 1/1 !important; 
              border-radius: 4px !important;
              margin: 0 12px !important;
              width: calc(100% - 24px) !important;
              box-shadow: inset 0 2px 6px rgba(0,0,0,0.2) !important;
              overflow: hidden !important;
           }
           .ad-momentos-card-content {
              padding: 16px 16px 12px 16px !important;
           }
           .ad-momentos-card-content > p {
              font-family: inherit !important;
              font-size: 14px !important;
              line-height: 1.5 !important;
              color: #1f2937 !important;
              margin: 0 0 16px 0 !important;
           }
           .ad-momentos-card-content .btn {
              padding: 8px 12px !important;
              font-size: 13px !important;
              min-height: 40px !important;
              height: auto !important;
              border-radius: 20px !important;
           }
           .ad-momentos-card > div:nth-last-child(2) {
              padding: 8px 16px !important; 
              border-top: none !important;
              background: transparent !important;
           }
           .ad-momentos-card > div:nth-last-child(2) .btn {
              background: transparent !important;
              font-size: 13px !important;
              font-weight: 700 !important;
           }
           .ad-momentos-modal {
              width: 95% !important;
              padding: 20px 16px !important;
              margin: 0 auto !important;
           }
           .ad-momentos-modal h3 {
              font-size: 18px !important;
           }
           .ad-momentos-title-box h2 {
              font-size: 20px !important;
           }
           .ad-momentos-title-box p {
              font-size: 13px !important;
           }
        }
      `}} />
      <div className="ad-momentos-title-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Momentos (Mural)</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Moderação de fotos e atividades postadas pelas professoras.</p>
        </div>
        
        <div className="ad-momentos-header-actions" style={{ display: 'flex', gap: 12 }}>
          <select className="form-input" style={{ width: 180 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="pending">Pendentes ({feed.filter(f => f.status === 'pending').length})</option>
            <option value="all">Todas as postagens</option>
          </select>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
            <Filter size={16} style={{ position: 'absolute', left: 12, color: 'hsl(var(--text-muted))' }} />
            <select className="form-input" style={{ width: '100%', paddingLeft: 36 }} value={filterTurma} onChange={e => setFilterTurma(e.target.value)}>
              <option value="all">Todas as Turmas</option>
              {turmas.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Novo Momento</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
        {filteredFeed.map(post => <PostCard key={post.id} post={post} onApprove={handleApprove} onReject={handleReject} onDelete={(id) => setFeed(prev => prev.filter(p => p.id !== id))} />)}
      </div>

      {filteredFeed.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
           Nenhum post encontrado para este filtro.
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="card ad-momentos-modal" style={{ width: 540, padding: 24, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
               <h3 style={{ fontSize: 18, fontWeight: 700 }}>Novo Momento Corporativo</h3>
               <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingRight: 8 }}>
                 <div>
                   <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ImageIcon size={14}/> Mídia (Imagens ou Vídeos)</label>
                   <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: '0 0 6px 0' }}>Faça o upload do seu computador ou celular sem limites de tamanho. O sistema adapta fotos e vídeos.</p>
                   <input type="file" multiple accept="image/*,video/mp4,video/webm" style={{ display: 'none' }} id="upload-midia" onChange={e => {
                     if(e.target.files) {
                       setNewPost(p => ({...p, mediaFiles: [...p.mediaFiles, ...Array.from(e.target.files!)]}))
                     }
                   }} />
                   <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                     {newPost.mediaFiles.map((file, i) => (
                       <div key={i} style={{ width: 80, height: 80, borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                         <button style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: 'white', border: 0, borderRadius: '50%', padding: 2, cursor: 'pointer', zIndex: 10 }} onClick={() => setNewPost(p => ({...p, mediaFiles: p.mediaFiles.filter((_, idx) => idx !== i)}))}><X size={12}/></button>
                         {file.type.includes('video') ? <Video size={24} color="#9ca3af" /> : <img src={URL.createObjectURL(file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                       </div>
                     ))}
                     <label htmlFor="upload-midia" style={{ width: 80, height: 80, borderRadius: 8, border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
                       <Plus size={24} />
                     </label>
                   </div>
                 </div>

                 <div>
                    <label className="form-label">Descrição</label>
                    <textarea className="form-input" rows={3} value={newPost.desc} onChange={e => setNewPost({...newPost, desc: e.target.value})} placeholder="Escreva a legenda..." />
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ margin: 0 }}>Visibilidade (Turmas Alvo)</label>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowDestModal(true)}>+ Adicionar / Ver Alvos</button>
                    </div>
                    <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: '0 0 6px 0' }}>Se nenhuma for selecionada, o post será público para toda a escola.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 48, background: 'hsl(var(--bg-main))', padding: '12px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                      {newPost.targetClasses.length === 0 && <span className="badge badge-ghost text-muted">Toda a Escola</span>}
                      {newPost.targetClasses.map(t => (
                        <span key={t.id} className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {t.name}
                          <button onClick={() => setNewPost(p => ({...p, targetClasses: p.targetClasses.filter(x => x.id !== t.id)}))} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', display: 'flex', color: 'inherit' }}><X size={14} color="currentColor"/></button>
                        </span>
                      ))}
                    </div>
                 </div>
              </div>

             <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={submitPost}>Publicar no Feed</button>
             </div>
           </div>
        </div>
      )}
      
      {/* Universal Target Selector */}
      <DestinatariosModal 
        isOpen={showDestModal}
        onClose={() => setShowDestModal(false)}
        initialSelected={newPost.targetClasses}
        onAdd={(res) => setNewPost({...newPost, targetClasses: res as any})}
      />
    </div>
  )
}
