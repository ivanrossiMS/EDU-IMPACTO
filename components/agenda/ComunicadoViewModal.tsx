'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Paperclip, FileText, CheckCircle2, ShieldAlert, Calendar, Mic, Send, Share, Bookmark, MoreHorizontal } from 'lucide-react'
import Image from 'next/image'
import Portal from '@/components/Portal'
import { UserAvatar } from '@/components/UserAvatar'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'

// Helpers
const parseAnexo = (anexoData: any) => {
  if (!anexoData) return null;
  if (typeof anexoData === 'object') {
    return {
      name: anexoData.nome || anexoData.name || '',
      url: anexoData.url || '',
      mime: anexoData.mime || (anexoData.type === 'image' ? 'image/jpeg' : '')
    };
  }
  try {
    const str = typeof anexoData === 'string' ? anexoData : String(anexoData);
    const parts = (str && typeof str.split === 'function') ? str.split('|') : [str];
    const name = parts[0] || '';
    const url = parts[1] || '';
    const mime = parts[2] || '';
    return { name, url, mime };
  } catch (e) {
    return null;
  }
};

function timeAgoShort(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'agora'
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes}m`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d`
  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) return `${diffInWeeks}sem`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface ChatMessage {
  id: string
  comunicado_id: string
  remetente_id: string
  remetente_nome: string
  conteudo: string
  anexos: string[]
  is_admin: boolean
  created_at: string
}

interface ComunicadoViewModalProps {
  comunicado: any
  onClose: () => void
  onCiencia: (id: string) => void
  currentUserSlug: string
  currentUserName: string
  currentUserAvatar?: string
  isAdminMode?: boolean
  setOpenedFormStr?: (anexo: string) => void
  setMaximizedImageStr?: (url: string) => void
  setMaximizedVideoStr?: (url: string) => void
  setOpenedReportTask?: (anexo: string) => void
  setOpenedReportPayload?: (anexo: string) => void
}

export function ComunicadoViewModal({
  comunicado,
  onClose,
  onCiencia,
  currentUserSlug,
  currentUserName,
  currentUserAvatar,
  isAdminMode = false,
  setOpenedFormStr,
  setMaximizedImageStr,
  setMaximizedVideoStr,
  setOpenedReportTask,
  setOpenedReportPayload
}: ComunicadoViewModalProps) {
  const canReply = comunicado.permiteResposta || comunicado.isSaudacao || comunicado.dados?.isSaudacao || comunicado.titulo === 'Mensagem de Boas-vindas' || comunicado.titulo === 'Mensagem de Saudação'

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMsg, setLoadingMsg] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingAnexos, setPendingAnexos] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  const adminThreads = useMemo(() => {
    if (!isAdminMode) return []
    const threadsMap = new Map<string, { studentId: string, studentName: string, messages: ChatMessage[], lastMessageAt: string }>()
    
    messages.forEach(msg => {
      const threadId = msg.remetente_id;
      if (!threadsMap.has(threadId)) {
        threadsMap.set(threadId, {
          studentId: threadId,
          studentName: msg.is_admin ? 'Usuário (Mensagem Global)' : msg.remetente_nome,
          messages: [],
          lastMessageAt: msg.created_at
        })
      }
      const thread = threadsMap.get(threadId)!
      thread.messages.push(msg)
      if (new Date(msg.created_at) > new Date(thread.lastMessageAt)) {
        thread.lastMessageAt = msg.created_at
      }
      if (!msg.is_admin) {
        thread.studentName = msg.remetente_nome
      }
    })
    
    return Array.from(threadsMap.values()).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
  }, [messages, isAdminMode])
  
  const messagesToShow = isAdminMode ? (selectedThreadId ? adminThreads.find(t => t.studentId === selectedThreadId)?.messages || [] : []) : messages;

  const fetchMessages = async () => {
    try {
      const url = isAdminMode 
        ? `/api/comunicados_respostas?comunicado_id=${comunicado.id}&admin=true`
        : `/api/comunicados_respostas?comunicado_id=${comunicado.id}&remetente_id=${currentUserSlug}`;
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (e) {
      console.error('Error fetching messages', e)
    } finally {
      setLoadingMsg(false)
    }
  }

  useEffect(() => {
    if (canReply) {
      fetchMessages()
      const interval = setInterval(fetchMessages, 10000)
      return () => clearInterval(interval)
    }
  }, [comunicado.id, currentUserSlug, isAdminMode, canReply])

  const handleSend = async () => {
    if (!newMessage.trim() && pendingAnexos.length === 0) return
    setIsSending(true)
    
    try {
      const payload = {
        comunicado_id: comunicado.id,
        remetente_id: isAdminMode ? (selectedThreadId || currentUserSlug) : currentUserSlug,
        remetente_nome: currentUserName,
        conteudo: newMessage.trim(),
        anexos: pendingAnexos,
        is_admin: isAdminMode
      }

      const res = await fetch('/api/comunicados_respostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data])
        setNewMessage('')
        setPendingAnexos([])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch (e) {
      console.error('Error sending message', e)
    } finally {
      setIsSending(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setIsUploading(true)
    try {
      const urls: string[] = []
      
      for (const file of Array.from(e.target.files)) {
        const uploadRes = await uploadFileToSupabase({
          bucket: 'comunicados-midia',
          file: file,
          usageType: 'common'
        })
        
        if (uploadRes.ok && uploadRes.url) {
          urls.push(uploadRes.url)
        } else {
          console.error('Failed to upload file:', file.name, uploadRes.error)
        }
      }
      
      if (urls.length > 0) {
        setPendingAnexos(prev => [...prev, ...urls])
      }
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleDownload = (parsed: any) => {
    if (parsed.url) {
      window.open(parsed.url, '_blank')
    } else {
      alert(`Falha ao abrir ${parsed.name}`)
    }
  }

  const dateObj = new Date(comunicado.dataEnvio || comunicado.created_at || new Date())
  const formattedDate = dateObj.toLocaleString('pt-BR', { dateStyle: 'long' })
  const formattedTime = dateObj.toLocaleString('pt-BR', { timeStyle: 'short' })

  return (
    <Portal>
      <motion.div 
        initial={{opacity: 0}} 
        animate={{opacity: 1}} 
        exit={{opacity: 0}} 
        style={{ 
          position: 'fixed', inset: 0, 
          background: 'rgba(15, 23, 42, 0.4)', 
          backdropFilter: 'blur(8px)', zIndex: 99999, 
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} 
      >
        <style dangerouslySetInnerHTML={{__html: `
          .cvm-modal-container {
            width: 100%;
            height: 100%;
            max-width: 1100px;
            max-height: 100vh;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            box-shadow: 0 24px 64px rgba(0,0,0,0.2);
            overflow: hidden;
          }
          @media (min-width: 768px) {
            .cvm-modal-container {
              border-radius: 24px;
              max-height: 92vh;
            }
          }
          .cvm-header {
            flex-shrink: 0;
            background: linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #8b5cf6 100%);
            padding: 24px 24px;
            padding-top: calc(env(safe-area-inset-top, 0px) + 24px);
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #fff;
            position: sticky;
            top: 0;
            z-index: 10;
            overflow: hidden;
          }
          .cvm-header-bg {
            position: absolute;
            inset: 0;
            opacity: 0.8;
            pointer-events: none;
            overflow: hidden;
          }
          .cvm-header-bg::before,
          .cvm-header-bg::after {
            content: '';
            position: absolute;
            width: 150%;
            height: 150%;
            border-radius: 42%;
            background: linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
            animation: rotateWave 12s linear infinite;
            top: -120%;
            left: -25%;
          }
          .cvm-header-bg::after {
            background: linear-gradient(to left, rgba(255,255,255,0.05), rgba(255,255,255,0.15));
            animation: rotateWave 18s linear infinite reverse;
            top: -110%;
            left: -10%;
            border-radius: 45%;
          }
          @keyframes rotateWave {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .cvm-body {
            flex: 1;
            overflow-y: auto;
            padding: 32px 24px;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .cvm-footer {
            flex-shrink: 0;
            background: #ffffff;
            border-top: 1px solid #e2e8f0;
            padding: 12px 20px;
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
            position: sticky;
            bottom: 0;
            z-index: 10;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .cvm-avatar-area {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .cvm-icon-btn {
            width: 36px; height: 36px;
            border-radius: 50%;
            background: rgba(255,255,255,0.15);
            display: flex; align-items: center; justify-content: center;
            border: none; color: #fff; cursor: pointer;
            transition: background 0.2s;
          }
          .cvm-icon-btn:hover {
            background: rgba(255,255,255,0.25);
          }
          .cvm-input-area {
            flex: 1;
            background: #f1f5f9;
            border-radius: 24px;
            display: flex;
            align-items: center;
            padding: 4px 16px;
          }
          .cvm-input-area input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            font-size: 14px;
            padding: 10px 0;
          }
        `}} />

        <motion.div 
          className="cvm-modal-container"
          initial={{scale: 0.95, y: 20}} 
          animate={{scale: 1, y: 0}} 
          exit={{scale: 0.95, y: 20}} 
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {/* HEADER */}
          <div className="cvm-header">
            <div className="cvm-header-bg" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1, position: 'relative' }}>
              <div className="cvm-avatar-area">
                <UserAvatar userId={comunicado.autorId} name={comunicado.autor} fotoUrl={comunicado.autorFoto} size={58} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{comunicado.autor}</span>
                  {comunicado.autorCargo && (
                    <span style={{ 
                      fontSize: 10, 
                      fontWeight: 800, 
                      color: '#ffffff', 
                      background: 'rgba(255, 255, 255, 0.2)', 
                      backdropFilter: 'blur(4px)',
                      padding: '2px 8px', 
                      borderRadius: 12, 
                      textTransform: 'uppercase', 
                      letterSpacing: 0.5,
                      width: 'fit-content',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      {comunicado.autorCargo}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginTop: 2 }}>
                    {formattedDate} às {formattedTime}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 1, position: 'relative' }}>
              <button className="cvm-icon-btn" onClick={onClose}>
                <X size={24} />
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="cvm-body">
            
            {/* Title & Text Content Wrapped in Rounded Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: 24,
              padding: 28,
              boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
              maxWidth: 800,
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}>
              {/* Title Block */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)', color: '#fff', borderRadius: 16, padding: 12, flexShrink: 0, boxShadow: '0 8px 16px rgba(79,70,229,0.2)' }}>
                  📣
                </div>
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.3, marginBottom: 8 }}>
                    {comunicado.titulo}
                  </h1>
                  
                  {/* Prioridade */}
                  {(comunicado.prioridade === 'alta' || comunicado.prioridade === 'urgente') && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {comunicado.prioridade === 'alta' && <span style={{ background: '#fee2e2', color: '#ef4444', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12, border: '1px solid #fca5a5' }}>Prioridade Alta</span>}
                      {comunicado.prioridade === 'urgente' && <span style={{ background: '#ffedd5', color: '#f97316', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12, border: '1px solid #fdba74' }}>Urgente</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Text Content */}
              <div style={{ fontSize: 16, lineHeight: 1.7, color: '#334155', fontWeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} 
                   dangerouslySetInnerHTML={{ __html: comunicado.conteudo.replace(/\n/g, '<br/>') }} />
            </div>

            {/* Attachments - Visual Order */}
            {comunicado.anexos && comunicado.anexos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 800, margin: '0 auto' }}>
                {comunicado.anexos.map((anexo: string, idx: number) => {
                  const parsed = parseAnexo(anexo)
                  if (!parsed) return null
                  
                  const isForm = parsed.name.startsWith('Formulário:')
                  const isRel = parsed.name.startsWith('Relatório:')
                  const isReportTask = parsed.name.startsWith('Tarefa de Relatório:')
                  const isReportPayload = parsed.url.startsWith('payload:') || parsed.mime === 'report-payload' || parsed.name.includes('12at') || parsed.name.startsWith('Relatório Personalizado:')
                  const isImg = parsed.url.startsWith('data:image/') || parsed.mime.startsWith('image/') || parsed.name.toLowerCase().endsWith('.png') || parsed.name.toLowerCase().endsWith('.jpg') || parsed.name.toLowerCase().endsWith('.jpeg') || parsed.name.toLowerCase().endsWith('.webp') || parsed.name.toLowerCase().endsWith('.gif')
                  const isVid = parsed.mime.startsWith('video/') || parsed.url.includes('.mov') || parsed.url.includes('.mp4') || parsed.name.toLowerCase().endsWith('.mov') || parsed.name.toLowerCase().endsWith('.mp4')
                  
                  if (isImg || isVid) {
                    // Modern Image/Video Card immediately following text
                    return (
                      <div key={idx} style={{ width: '100%', borderRadius: 24, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 12px 32px rgba(0,0,0,0.08)', cursor: 'pointer', maxWidth: 800, background: '#f1f5f9', display: 'flex', justifyContent: 'center' }} onClick={() => {
                        if (isImg && setMaximizedImageStr) setMaximizedImageStr(parsed.url)
                        if (isVid && setMaximizedVideoStr) setMaximizedVideoStr(parsed.url)
                      }}>
                        {isImg ? (
                          <img src={parsed.url} alt={parsed.name} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 500, objectFit: 'contain' }} />
                        ) : (
                          <video src={parsed.url} style={{ width: '100%', maxHeight: 500, objectFit: 'contain', display: 'block' }} controls preload="metadata" onClick={e => e.stopPropagation()} />
                        )}
                      </div>
                    )
                  } else {
                    let studentIdForCiencia = null;
                    if (isReportPayload && parsed.url.startsWith('payload:')) {
                      try {
                        const pay = JSON.parse(parsed.url.substring(8));
                        studentIdForCiencia = pay?.studentInfo?.id;
                      } catch(e) {}
                    }
                    const studentCienciaIso = studentIdForCiencia && comunicado.ciencias ? comunicado.ciencias[studentIdForCiencia] : null;
                    let cienciaString = '';
                    if (studentCienciaIso) {
                      const cDate = new Date(studentCienciaIso);
                      cienciaString = cDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' + cDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    }

                    // Document Card
                    return (
                      <div key={idx} style={{ maxWidth: 800, width: '100%', padding: '16px', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }} 
                           onClick={() => {
                             if (isReportTask && setOpenedReportTask) setOpenedReportTask(anexo)
                             else if (isReportPayload && setOpenedReportPayload) setOpenedReportPayload(anexo)
                             else if ((isForm || isRel) && setOpenedFormStr) setOpenedFormStr(anexo)
                             else handleDownload(parsed)
                           }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: isReportTask ? '#ecfdf5' : '#f1f5f9', color: isReportTask ? '#10b981' : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <FileText size={24} />
                        </div>
                        <div style={{ flex: 1 }}>
                           <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{parsed.name.replace(/^(Formulário:|Relatório:|Tarefa de Relatório:)\s*/, '')}</div>
                           <div style={{ fontSize: 13, color: '#64748b' }}>{isForm ? 'Formulário' : isRel ? 'Relatório' : isReportTask ? 'Tarefa de Relatório' : 'Documento anexo'}</div>
                           {isAdminMode && cienciaString && (
                             <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                               <CheckCircle2 size={14} />
                               Ciência confirmada em {cienciaString}
                             </div>
                           )}
                        </div>
                      </div>
                    )
                  }
                })}
              </div>
            )}

            {/* Ciência */}
            {comunicado.exigeCiencia && !isAdminMode && (
              <div style={{ 
                background: !!(comunicado.ciencias || {})[currentUserSlug] ? '#f0fdf4' : '#eff6ff', 
                padding: '24px', borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, border: !!(comunicado.ciencias || {})[currentUserSlug] ? '1px solid #bbf7d0' : '1px solid #bfdbfe', maxWidth: 800, width: '100%', margin: '0 auto'
              }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {!!(comunicado.ciencias || {})[currentUserSlug] ? <CheckCircle2 size={28} color="#16a34a" /> : <ShieldAlert size={28} color="#3b82f6" />}
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: !!(comunicado.ciencias || {})[currentUserSlug] ? '#16a34a' : '#1e40af' }}>{!!(comunicado.ciencias || {})[currentUserSlug] ? 'Ciência confirmada' : 'Assinatura Eletrônica Necessária'}</div>
                    <div style={{ fontSize: 13, color: !!(comunicado.ciencias || {})[currentUserSlug] ? '#15803d' : '#1e3a8a', marginTop: 4 }}>{!!(comunicado.ciencias || {})[currentUserSlug] ? 'Você confirmou leitura neste comunicado.' : 'A escola exige sua confirmação de leitura.'}</div>
                  </div>
                </div>
                {!((comunicado.ciencias || {})[currentUserSlug]) && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onCiencia(comunicado.id); }} 
                    style={{ background: '#3b82f6', color: '#fff', padding: '12px 24px', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                  >
                    Assinar Ciência
                  </button>
                )}
              </div>
            )}

            {/* Comments Feed Area */}
            {canReply && (
              <div style={{ marginTop: 24, maxWidth: 800, width: '100%', margin: '0 auto' }}>
                {isAdminMode && !selectedThreadId ? (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <h3 style={{ fontSize: 14, fontWeight: 700, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Conversas Privadas ({adminThreads.length})</h3>
                     {adminThreads.map(thread => (
                        <div key={thread.studentId} onClick={() => setSelectedThreadId(thread.studentId)} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{thread.studentName}</div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{thread.messages.length} mensagens com este usuário</div>
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            {timeAgoShort(thread.lastMessageAt)}
                          </div>
                        </div>
                     ))}
                     {adminThreads.length === 0 && (
                       <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>Nenhuma conversa iniciada.</div>
                     )}
                   </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {isAdminMode && (
                      <button onClick={() => setSelectedThreadId(null)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
                        &larr; Voltar para conversas
                      </button>
                    )}
                    <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isAdminMode ? `Conversa com ${adminThreads.find(t => t.studentId === selectedThreadId)?.studentName}` : 'Respostas Privadas ao Envio'}</h3>
                    {messagesToShow.length > 0 ? messagesToShow.map((msg, idx) => {
                      const isMe = isAdminMode ? msg.is_admin : (msg.remetente_id === currentUserSlug && !msg.is_admin)
                      const avatarToUse = (!isMe && isAdminMode && msg.is_admin) ? undefined : (isMe && currentUserAvatar ? currentUserAvatar : undefined)
                      
                      return (
                        <div key={msg.id} style={{ display: 'flex', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: isMe ? '#e2e8f0' : '#dbeafe', color: isMe ? '#475569' : '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                            {avatarToUse ? <img src={avatarToUse} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : msg.remetente_nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{msg.remetente_nome}</span>
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>{timeAgoShort(msg.created_at)}</span>
                            </div>
                            <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.5, background: isMe ? '#f1f5f9' : '#ffffff', padding: '8px 16px', borderRadius: '0 16px 16px 16px', border: isMe ? 'none' : '1px solid #e2e8f0', display: 'inline-block' }}>
                              {msg.conteudo}
                              {msg.anexos && msg.anexos.length > 0 && (
                                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {msg.anexos.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, textDecoration: 'none', color: '#3b82f6', fontSize: 12, fontWeight: 600 }}>
                                      <FileText size={14} /> Anexo {i + 1}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }) : (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Nenhum comentário ainda.</div>
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} style={{ height: 20 }} />
              </div>
            )}

          </div>

          {/* FOOTER - FIXED INPUT */}
          {canReply && (!isAdminMode || selectedThreadId) && (
            <div className="cvm-footer">
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: '#f8fafc', color: '#64748b' }}>
                <input type="file" style={{ display: 'none' }} multiple onChange={handleFileUpload} disabled={isUploading} />
                <Paperclip size={20} />
              </label>

              <div className="cvm-input-area">
                <input 
                  type="text" 
                  placeholder="Escreva um comentário" 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
              </div>

              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: '#f8fafc', color: '#64748b', border: 'none', cursor: 'pointer' }}>
                <Mic size={20} />
              </button>
              
              <button 
                onClick={handleSend}
                disabled={isSending || isUploading || (!newMessage.trim() && pendingAnexos.length === 0)}
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  width: 44, height: 44, borderRadius: '50%', 
                  background: (!newMessage.trim() && pendingAnexos.length === 0) ? '#e2e8f0' : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', 
                  color: (!newMessage.trim() && pendingAnexos.length === 0) ? '#94a3b8' : '#ffffff', 
                  border: 'none', cursor: (!newMessage.trim() && pendingAnexos.length === 0) ? 'default' : 'pointer',
                  boxShadow: (!newMessage.trim() && pendingAnexos.length === 0) ? 'none' : '0 4px 12px rgba(79,70,229,0.3)',
                  transition: 'all 0.2s'
                }}
              >
                <Send size={18} style={{ marginLeft: 2 }} />
              </button>
            </div>
          )}

          {pendingAnexos.length > 0 && (
            <div style={{ position: 'absolute', bottom: 70, left: 20, display: 'flex', gap: 8, background: '#fff', padding: 8, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {pendingAnexos.map((url, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', padding: '4px 8px', borderRadius: 8, fontSize: 12 }}>
                  <FileText size={14} /> Anexo {i+1}
                  <button onClick={() => setPendingAnexos(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </Portal>
  )
}
