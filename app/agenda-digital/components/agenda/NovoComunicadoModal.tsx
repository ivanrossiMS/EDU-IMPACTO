import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { 
  X, SendIcon, Clock, FileText, Paperclip, Image as ImageIcon, 
  Bold, Italic, Underline, List, Link as LinkIcon, Smile, 
  ChevronRight, Save, UploadCloud, Users, Trash2, Calendar,
  Palette, BarChart2, Receipt
} from 'lucide-react'
import Image from 'next/image'
import { UserAvatar } from '@/components/UserAvatar'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { useRelatorios } from '@/lib/relatoriosContext'
import { ReportsSelectionModal } from '@/components/agenda/ReportsSelectionModal'

export interface NovoComunicadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any, isDraft: boolean) => void;
  initialData?: any; // Para edição
  currentUser: any;
  onClickSelectDest?: () => void;
  selectedDest?: any[];
  onRemoveDest?: (id: string) => void;
}

const EMOJIS = ['😀','😂','🥰','😎','🤔','🙌','👍','👏','🔥','🎉','📅','📢','📌','⭐','❤️']

export default function NovoComunicadoModal({
  isOpen, onClose, onSave, initialData, currentUser,
  onClickSelectDest, selectedDest = [], onRemoveDest
}: NovoComunicadoModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [anexos, setAnexos] = useState<string[]>([])
  const [dataAgendamento, setDataAgendamento] = useState<string>('')
  
  const { templates: relatoriosTemplates = [] } = useRelatorios() || {}
  
  const [showRelsModal, setShowRelsModal] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [tempAgendamento, setTempAgendamento] = useState('')

  const editorRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitulo(initialData.titulo || '')
        setConteudo(initialData.conteudo || initialData.texto || '')
        setAnexos(initialData.anexos || [])
        setDataAgendamento(initialData.dataAgendamento || '')
        if (editorRef.current) {
          editorRef.current.innerHTML = initialData.conteudo || initialData.texto || ''
        }
      } else {
        setTitulo('')
        setConteudo('')
        setAnexos([])
        setDataAgendamento('')
        if (editorRef.current) editorRef.current.innerHTML = ''
      }
    }
  }, [isOpen, initialData])

  const handleAction = (isDraft: boolean) => {
    onSave({
      titulo,
      conteudo,
      anexos,
      dataAgendamento
    }, isDraft)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    
    // Atualizado para 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('Arquivo muito grande. O limite é 50MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      let fileToUpload: File = file;

      if (file.type.startsWith('image/')) {
        setUploadProgress(10);
        fileToUpload = await compressImage(file, { quality: 0.80, format: 'image/webp' });
        setUploadProgress(40);
      } else if (file.type.startsWith('video/')) {
        setUploadProgress(5);
        fileToUpload = await compressVideo(file, (percent) => {
          const scaled = Math.round(5 + (percent * 0.45));
          setUploadProgress(scaled);
        }) as File;
      }

      setUploadProgress(60);

      const uploadRes = await uploadFileToSupabase({
        bucket: 'comunicados-midia',
        file: fileToUpload,
        usageType: 'common' 
      });

      if (!uploadRes.ok || !uploadRes.url) {
        alert(uploadRes.error || 'Erro no envio direto do arquivo.');
        setIsUploading(false);
        setUploadProgress(0);
        return;
      }

      setUploadProgress(100);
      setAnexos(prev => [...prev, `${fileToUpload.name}|${uploadRes.url}|${fileToUpload.type}`]);
      setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 700);
    } catch (err: any) {
      alert('Erro inesperado: ' + (err?.message || ''));
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  if (!isOpen) return null;

  if (!isOpen) return null;

  const modalContent = (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(8px)',
      zIndex: 99990,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <style>{`
        .ad-nc-container {
          width: 100%;
          height: 100%;
          background: #F8FAFC;
          display: flex;
          flex-direction: column;
          position: absolute;
          top: 0;
          left: 0;
          z-index: 99990;
          overflow: hidden;
        }
        @media (min-width: 1024px) {
          .ad-nc-container {
            max-width: 900px;
            height: 92vh;
            position: relative;
            top: auto;
            left: auto;
            border-radius: 28px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          }
        }
        
        @keyframes waveAnimation {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ad-nc-header {
          padding: 28px 24px 20px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          background: linear-gradient(120deg, #6D5DF6, #4F46E5, #8B5CF6, #3B82F6);
          background-size: 300% 300%;
          animation: waveAnimation 8s ease infinite;
          border-bottom: 1px solid rgba(255,255,255,0.2);
          flex-shrink: 0;
          z-index: 10;
          color: white;
        }
        
        .ad-nc-btn-send {
          background: linear-gradient(135deg, #6D5DF6 0%, #8B5CF6 100%);
          color: white;
          height: 44px;
          width: 44px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(109, 93, 246, 0.3);
          transition: all 0.2s ease;
        }
        .ad-nc-btn-send:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(109, 93, 246, 0.4);
        }
        .ad-nc-btn-send:active {
          transform: scale(0.95);
        }
        
        .ad-nc-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px 20px 110px 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .ad-nc-section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 16px;
          font-weight: 700;
          color: #0F172A;
          margin-bottom: 12px;
        }
        .ad-nc-section-number {
          width: 24px;
          height: 24px;
          border-radius: 12px;
          background: #6D5DF6;
          color: white;
          font-size: 13px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .ad-nc-card {
          background: #FFFFFF;
          border-radius: 18px;
          border: 1px solid #E2E8F0;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        
        .ad-nc-btn-dest {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: transparent;
          border: none;
          padding: 8px 4px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          color: #0F172A;
          transition: opacity 0.2s;
        }
        .ad-nc-btn-dest:hover { opacity: 0.7; }
        
        .ad-nc-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #F1F5F9;
          color: #475569;
          padding: 6px 12px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
          margin: 4px;
        }
        
        .ad-nc-input {
          width: 100%;
          border: none;
          outline: none;
          font-size: 16px;
          color: #0F172A;
          background: transparent;
        }
        .ad-nc-input::placeholder { color: #94A3B8; }
        
        .ad-nc-editor {
          min-height: 180px;
          outline: none;
          font-size: 15px;
          line-height: 1.6;
          color: #0F172A;
          padding-bottom: 12px;
        }
        .ad-nc-editor:empty:before {
          content: attr(data-placeholder);
          color: #94A3B8;
          pointer-events: none;
          display: block; /* For Firefox */
        }
        
        .ad-nc-toolbar {
          display: flex;
          gap: 4px;
          padding-top: 12px;
          border-top: 1px solid #E2E8F0;
        }
        .ad-nc-tool-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: #64748B;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ad-nc-tool-btn:hover {
          background: #F1F5F9;
          color: #0F172A;
        }
        
        .ad-nc-dropzone {
          border: 2px dashed #E2E8F0;
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          cursor: pointer;
          background: #FAFAFA;
          transition: all 0.2s;
        }
        .ad-nc-dropzone:hover {
          border-color: #8B5CF6;
          background: #F5F3FF;
        }
        
        .ad-nc-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 80px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid rgba(226, 232, 240, 0.6);
          display: grid;
          grid-template-columns: 1fr 1fr 1.3fr;
          gap: 12px;
          padding: 12px 16px;
          z-index: 10;
        }
        
        .ad-nc-footer-btn {
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ad-nc-btn-secondary {
          background: #FFFFFF;
          color: #0F172A;
          border: 1px solid #E2E8F0;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .ad-nc-btn-secondary:hover {
          background: #F8FAFC;
        }
        .ad-nc-btn-secondary:active {
          transform: scale(0.98);
        }
        
        /* Custom scrollbar for webkit */
        .ad-nc-body::-webkit-scrollbar {
          width: 6px;
        }
        .ad-nc-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .ad-nc-body::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 10px;
        }
      `}</style>
      
      <motion.div 
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0.5 }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        className="ad-nc-container"
      >
        {/* HEADER */}
        <div className="ad-nc-header">
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: -0.5 }}>{initialData ? 'Editar Comunicado' : 'Novo Comunicado'}</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <div style={{ border: '2px solid rgba(255,255,255,0.3)', borderRadius: '50%', padding: 2 }}>
                <UserAvatar userId={currentUser?.id} name={currentUser?.nome || 'Usuário'} size={32} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{currentUser?.nome || 'Usuário ERP'}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginTop: 4 }}>{currentUser?.cargo || currentUser?.perfil || 'Administração'}</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            style={{ 
              width: 40, height: 40, borderRadius: 20, border: 'none', 
              background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              transition: 'all 0.2s', backdropFilter: 'blur(4px)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="ad-nc-body">
          
          {/* SECTION 1: DESTINATARIOS */}
          <div>
            <div className="ad-nc-section-title">
              <div className="ad-nc-section-number">1</div>
              Destinatários
            </div>
            
            <div className="ad-nc-card" style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={onClickSelectDest}>
              <div className="ad-nc-btn-dest">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Users size={20} color="#6D5DF6" />
                  Selecionar destinatários
                </div>
                <ChevronRight size={20} color="#94A3B8" />
              </div>
              
              {selectedDest.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 120, overflowY: 'auto' }}>
                  {selectedDest.map(d => (
                    <div key={d.id} className="ad-nc-chip" onClick={e => e.stopPropagation()}>
                      {d.type === 'turma' ? <Users size={12} /> : <UserAvatar name={d.name} size={16} />}
                      {d.name}
                      {onRemoveDest && (
                        <button onClick={() => onRemoveDest(d.id)} style={{ background: 'transparent', border: 0, cursor: 'pointer', display: 'flex', color: '#94A3B8', padding: 2 }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* SECTION 2: TITULO */}
          <div>
            <div className="ad-nc-section-title">
              <div className="ad-nc-section-number">2</div>
              Título do comunicado
            </div>
            
            <div className="ad-nc-card" style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                className="ad-nc-input" 
                placeholder="Digite o título" 
                value={titulo}
                onChange={e => setTitulo(e.target.value.substring(0, 120))}
              />
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', flexShrink: 0 }}>
                {titulo.length}/120
              </div>
            </div>
          </div>

          {/* SECTION 3: MENSAGEM */}
          <div>
            <div className="ad-nc-section-title">
              <div className="ad-nc-section-number">3</div>
              Mensagem
            </div>
            
            <div className="ad-nc-card" style={{ padding: '20px' }}>
              <div 
                ref={editorRef}
                contentEditable
                className="ad-nc-editor"
                data-placeholder="Escreva sua mensagem..."
                onInput={e => setConteudo(e.currentTarget.innerHTML)}
              />
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                 <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>
                   {conteudo.replace(/<[^>]*>/g, '').length}/2000
                 </div>
              </div>
              
              <div className="ad-nc-toolbar">
                <button className="ad-nc-tool-btn" onClick={() => { document.execCommand('bold', false); editorRef.current?.focus(); }}><Bold size={18}/></button>
                <button className="ad-nc-tool-btn" onClick={() => { document.execCommand('italic', false); editorRef.current?.focus(); }}><Italic size={18}/></button>
                <button className="ad-nc-tool-btn" onClick={() => { document.execCommand('underline', false); editorRef.current?.focus(); }}><Underline size={18}/></button>
                <div style={{ width: 1, height: 20, background: '#E2E8F0', margin: 'auto 4px' }} />
                <button className="ad-nc-tool-btn" onClick={() => { document.execCommand('insertUnorderedList', false); editorRef.current?.focus(); }}><List size={18}/></button>
                <button className="ad-nc-tool-btn" onClick={() => { 
                   const url = prompt('Digite o link:'); 
                   if(url) document.execCommand('createLink', false, url); 
                   editorRef.current?.focus(); 
                }}><LinkIcon size={18}/></button>
                <label className="ad-nc-tool-btn" style={{ position: 'relative', overflow: 'hidden' }}>
                  <Palette size={18}/>
                  <input type="color" onChange={(e) => { document.execCommand('foreColor', false, e.target.value); editorRef.current?.focus(); }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </label>
                <div style={{ position: 'relative' }}>
                  <button className="ad-nc-tool-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}><Smile size={18}/></button>
                  {showEmojiPicker && (
                    <div style={{ position: 'absolute', bottom: 45, left: -50, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 12, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, zIndex: 100 }}>
                      {EMOJIS.map(emoji => (
                        <button key={emoji} onClick={() => { document.execCommand('insertText', false, emoji); setShowEmojiPicker(false); editorRef.current?.focus(); }} style={{ background: 'transparent', border: 0, fontSize: 22, cursor: 'pointer', padding: 6, borderRadius: 8, transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ANEXOS */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#64748B', fontWeight: 600, fontSize: 14 }}>
              <Paperclip size={16} color="#8B5CF6" />
              Anexos <span style={{ fontWeight: 400 }}>(opcional)</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 8px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#8B5CF6'; e.currentTarget.style.background = '#F5F3FF'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFAFA'; }}>
                <div style={{ background: '#FFF', width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <Paperclip size={20} color="#8B5CF6" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Anexar</span>
                <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" hidden onChange={handleFileUpload} />
              </label>

              <button onClick={(e) => { e.preventDefault(); setShowRelsModal(true); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 8px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.background = '#EFF6FF'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFAFA'; }}>
                <div style={{ background: '#FFF', width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <BarChart2 size={20} color="#3B82F6" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Relatório</span>
              </button>

              <button onClick={(e) => { e.preventDefault(); alert('Em breve: Cobrança') }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 8px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.background = '#ECFDF5'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFAFA'; }}>
                <div style={{ background: '#FFF', width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <Receipt size={20} color="#10B981" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Cobrança</span>
              </button>
            </div>

            {/* PREVIEW ANEXOS */}
            {anexos.length > 0 && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
                {anexos.map((anexo, i) => {
                  let name = '';
                  let url = '';
                  let mimeType = '';
                  if (typeof anexo === 'string') {
                    if (anexo.endsWith('|report-payload')) {
                      const firstPipe = anexo.indexOf('|');
                      const lastPipe = anexo.lastIndexOf('|');
                      name = anexo.substring(0, firstPipe);
                      url = anexo.substring(firstPipe + 1, lastPipe);
                      mimeType = 'report-payload';
                    } else {
                      const parts = anexo.split('|');
                      name = parts[0];
                      url = parts[1];
                      mimeType = parts[2] || '';
                    }
                  } else {
                    name = String(anexo);
                  }
                  const isImg = mimeType.startsWith('image/') || (url && url.startsWith('data:image')) || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
                  
                  return (
                    <div key={i} style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 8, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10, background: '#F8FAFC', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isImg ? (
                          <Image src={url} alt="Capa" fill style={{ objectFit: 'cover' }} />
                        ) : (
                          <FileText size={32} color="#94A3B8" />
                        )}
                        <button 
                          onClick={(e) => { e.preventDefault(); setAnexos(anexos.filter(a => a !== anexo)); }}
                          style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, background: 'rgba(255, 255, 255, 0.9)', color: '#EF4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{name}</div>
                    </div>
                  )
                })}
              </div>
            )}
            {isUploading && (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, background: '#F5F3FF', padding: '12px 16px', borderRadius: 16 }}>
                 <div style={{ width: 20, height: 20, borderRadius: 10, border: '2px solid #C4B5FD', borderTopColor: '#6D5DF6', animation: 'spin 1s linear infinite' }} />
                 <span style={{ fontSize: 14, fontWeight: 600, color: '#6D5DF6' }}>Enviando arquivo... {uploadProgress}%</span>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="ad-nc-footer">
          <button 
            className="ad-nc-footer-btn ad-nc-btn-secondary" 
            style={{ flexDirection: 'column', gap: 4 }}
            onClick={() => handleAction(true)}
          >
            <Save size={18} color="#64748B" />
            <span style={{ color: '#0F172A', fontSize: 12 }}>Rascunho</span>
          </button>

          <button 
            className="ad-nc-footer-btn ad-nc-btn-secondary" 
            style={{ flexDirection: 'column', gap: 4 }}
            onClick={() => {
              if (!dataAgendamento) {
                 const nowLocal = new Date();
                 nowLocal.setHours(nowLocal.getHours() + 24);
                 const localString = nowLocal.getFullYear() + '-' + 
                   String(nowLocal.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(nowLocal.getDate()).padStart(2, '0') + 'T' + 
                   String(nowLocal.getHours()).padStart(2, '0') + ':' + 
                   String(nowLocal.getMinutes()).padStart(2, '0');
                 setTempAgendamento(localString);
              } else {
                 setTempAgendamento(dataAgendamento);
              }
              setShowScheduleModal(true);
            }}
          >
            <Calendar size={18} color="#6D5DF6" />
            <span style={{ color: '#0F172A', fontSize: 12 }}>{dataAgendamento ? 'Agendado' : 'Agendar'}</span>
          </button>
          
          <button 
            className="ad-nc-footer-btn" 
            style={{
              background: 'linear-gradient(135deg, #6D5DF6 0%, #8B5CF6 100%)',
              color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(109, 93, 246, 0.3)'
            }}
            onClick={() => handleAction(false)}
          >
            {isUploading ? (
              <div style={{ width: 18, height: 18, borderRadius: 9, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
            ) : (
              <SendIcon size={18} fill="currentColor" />
            )}
            <span>Enviar</span>
          </button>
        </div>

        {/* SCHEDULE MODAL */}
        <AnimatePresence>
          {showScheduleModal && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
              onClick={() => setShowScheduleModal(false)}
            >
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{ width: '100%', background: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0F172A' }}>Agendar Envio</h3>
                  <button onClick={() => setShowScheduleModal(false)} style={{ background: '#F1F5F9', border: 'none', width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} color="#64748B" /></button>
                </div>
                
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Data e Hora</label>
                <input 
                  type="datetime-local" 
                  className="ad-nc-input"
                  style={{ background: '#F8FAFC', padding: '16px', borderRadius: 16, border: '1px solid #E2E8F0', marginBottom: 24 }}
                  value={tempAgendamento} 
                  onChange={e => setTempAgendamento(e.target.value)} 
                />
                
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={() => { setDataAgendamento(''); setShowScheduleModal(false); }}
                    style={{ flex: 1, height: 48, borderRadius: 16, background: '#F1F5F9', color: '#64748B', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                  >
                    Remover Agendamento
                  </button>
                  <button 
                    onClick={() => { setDataAgendamento(tempAgendamento); setShowScheduleModal(false); }}
                    style={{ flex: 1, height: 48, borderRadius: 16, background: '#0F172A', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>

      {/* Relatórios Modal (Componente Avançado Integrado) */}
      <ReportsSelectionModal
        isOpen={showRelsModal}
        onClose={() => setShowRelsModal(false)}
        selectedDest={selectedDest}
        onAdd={(text, payload) => {
          const stringified = JSON.stringify(payload);
          const finalAttachmentString = `${text}|payload:${stringified}|report-payload`;
          setAnexos(prev => [...prev, finalAttachmentString]);
          // Não precisa fechar aqui, o ReportsSelectionModal chama onClose internamente no handleFinish
        }}
      />
    </div>
  )

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
