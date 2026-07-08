'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Paperclip, FileText, CheckCircle2, ShieldAlert, Calendar, Mic, Send, Share, Bookmark, MoreHorizontal, Edit2, Trash2, Loader2, CreditCard, Info, ExternalLink } from 'lucide-react'
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
  destinatario_id?: string
  remetente_nome: string
  conteudo: string
  anexos: string[]
  is_admin: boolean
  created_at: string
}

interface ComunicadoViewModalProps {
  comunicado: any
  allComunicados?: any[]
  onClose: () => void
  onCiencia: (id: string) => void
  currentUserSlug: string
  currentUserName: string
  currentUserAvatar?: string
  isAdminMode?: boolean
  setOpenedFormStr?: (anexo: string) => void
  setMaximizedImageStr?: (url: string) => void
  setMaximizedVideoStr?: (url: string) => void
  setMaximizedPdfStr?: (url: string) => void
  setOpenedReportTask?: (anexo: string) => void
  setOpenedReportPayload?: (anexo: string) => void
  alunos?: any[]
  colaboradores?: any[]
  turmas?: any[]
  onEdit?: (comunicado: any) => void
  onDelete?: (id: string) => void
}

export function ComunicadoViewModal({
  comunicado: initialComunicado,
  allComunicados = [],
  onClose,
  onCiencia,
  currentUserSlug,
  currentUserName,
  currentUserAvatar,
  isAdminMode = false,
  setOpenedFormStr,
  setMaximizedImageStr,
  setMaximizedVideoStr,
  setMaximizedPdfStr,
  setOpenedReportTask,
  setOpenedReportPayload,
  alunos = [],
  colaboradores = [],
  turmas = [],
  onEdit,
  onDelete
}: ComunicadoViewModalProps) {
  const [comunicado, setComunicado] = useState<any>(initialComunicado)
  const [isLoadingFull, setIsLoadingFull] = useState(!initialComunicado.conteudo && !initialComunicado.texto)
  
  const [cobranca, setCobranca] = useState<any>(null)
  const [cobrancaDestinatario, setCobrancaDestinatario] = useState<any>(null)
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false)
  const [paymentLink, setPaymentLink] = useState('')

  useEffect(() => {
    if (comunicado?.id) {
      const fetchCobranca = async () => {
         const { supabase } = await import('@/lib/supabase');
         const { data, error } = await supabase
           .from('agenda_cobrancas')
           .select('*, agenda_cobrancas_destinatarios(*)')
           .eq('comunicado_id', String(comunicado.id))
           .maybeSingle();
           
         if (data) {
            setCobranca(data); // Sempre salva a cobrança se existir
            
            if ((data as any).agenda_cobrancas_destinatarios && currentUserSlug && !isAdminMode) {
               const cleanSlug = currentUserSlug.replace(/^(a_|_ALU)/, '');
               const dest = (data as any).agenda_cobrancas_destinatarios.find((d: any) => 
                  String(d.destinatario_id).replace(/^(a_|_ALU)/, '') === cleanSlug
               );
               if (dest) {
                  setCobrancaDestinatario(dest);
                  if (dest.url_pagamento) {
                     setPaymentLink(dest.url_pagamento);
                  }
               }
            }
         }
      }
      fetchCobranca();
      // Poll every 5 seconds to catch webhook updates in real-time
      const cobInterval = setInterval(fetchCobranca, 5000);
      return () => clearInterval(cobInterval);
    }
  }, [comunicado, currentUserSlug, isAdminMode])

  useEffect(() => {
    if ((!comunicado.conteudo && !comunicado.texto) && comunicado.id) {
      setIsLoadingFull(true)
      const fetchUrl = isAdminMode
        ? `/api/comunicados?id=${comunicado.id}`
        : `/api/comunicados?id=${comunicado.id}${currentUserSlug && currentUserSlug !== 'admin' ? `&aluno_id=${currentUserSlug}` : ''}`
      
      fetch(fetchUrl)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            setComunicado(data[0])
          }
        })
        .finally(() => setIsLoadingFull(false))
    }
  }, [comunicado.id])

  const isGroupedReport = comunicado.id?.startsWith('AD-COM-REL-COLAB');
  const canReply = comunicado.permiteResposta || (isAdminMode && isGroupedReport) || comunicado.isSaudacao || comunicado.dados?.isSaudacao || comunicado.titulo === 'Mensagem de Boas-vindas' || comunicado.titulo === 'Mensagem de Saudação'

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMsg, setLoadingMsg] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingAnexos, setPendingAnexos] = useState<string[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [viewportHeight, setViewportHeight] = useState('100%')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`)
      }
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize)
      onResize() // initial check
    } else {
      setViewportHeight(`${window.innerHeight}px`)
    }
    return () => window.visualViewport?.removeEventListener('resize', onResize)
  }, [])


  const adminThreads = useMemo(() => {
    if (!isAdminMode) return []
    const threadsMap = new Map<string, { studentId: string, studentName: string, studentFoto?: string, messages: ChatMessage[], lastMessageAt: string }>()
    
    messages.forEach(msg => {
      // In admin mode, messages are grouped by the non-admin participant (student/parent)
      const threadId = msg.is_admin ? (msg.destinatario_id || msg.remetente_id) : msg.remetente_id
      if (!threadId) return
      
      let alunoObj = alunos.find((a: any) => {
        if (!a || !a.id) return false;
        const aIdStr = String(a.id);
        const rIdStr = String(threadId);
        return aIdStr === rIdStr || aIdStr === `a_${rIdStr}` || aIdStr.replace(/^_*(ALU)?/, '') === rIdStr.replace(/^_*(ALU)?/, '');
      });

      if (!threadsMap.has(threadId)) {
        threadsMap.set(threadId, {
          studentId: alunoObj?.id || threadId,
          studentName: alunoObj?.nome || (!msg.is_admin ? msg.remetente_nome : 'Aluno') || 'Usuário',
          studentFoto: alunoObj?.foto,
          messages: [],
          lastMessageAt: msg.created_at
        })
      }
      
      const thread = threadsMap.get(threadId)!
      thread.messages.push(msg)
      if (new Date(msg.created_at) > new Date(thread.lastMessageAt)) {
        thread.lastMessageAt = msg.created_at
      }
      
      // Se não achou alunoObj no map, mas a mensagem é do responsável/aluno, atualiza o nome (fallback)
      if (!msg.is_admin && msg.remetente_nome && !alunoObj) {
        thread.studentName = msg.remetente_nome
      }
    })
    
    // Filter out threads that don't have any message from a student/parent
    // These are usually phantom "global" messages sent by admins before the UI was restricted.
    const validThreads = Array.from(threadsMap.values()).filter(t => 
      t.messages.some(m => !m.is_admin)
    )
    
    return validThreads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
  }, [messages, isAdminMode, alunos])
  
  const messagesToShow = isAdminMode ? (selectedThreadId ? adminThreads.find(t => t.studentId === selectedThreadId)?.messages || [] : []) : messages;

  const destinatariosStr = useMemo(() => {
    if (!isAdminMode) return null;
    const destTurmas = comunicado.turmas || comunicado.dados?.turmas || [];
    let destAlunosIds = comunicado.alunosIds || comunicado.dados?.alunosIds || [];
    const destGrupos = comunicado.grupos || comunicado.dados?.grupos || [];
    let destFuncIds = comunicado.funcionariosIds || comunicado.dados?.funcionariosIds || [];
    
    const alunosNames = destAlunosIds.map((id: string) => {
      const cleanId = id.replace(/^_*(ALU)?/, '');
      const found = alunos.find((a: any) => a.id.replace(/^_*(ALU)?/, '') === cleanId);
      return found ? found.nome : `Aluno(a) ID: ${id}`;
    });

    const funcNames = destFuncIds.map((id: string) => {
      const cleanId = id.replace(/^_*(FUNC)?/, '');
      const found = colaboradores.find((c: any) => c.id.replace(/^_*(FUNC)?/, '') === cleanId);
      return found ? found.nome : `Funcionário ID: ${id}`;
    });
    
    // Suporte específico para relatórios gerados a partir de uma turma única (turmaId)
    const singleTurmaId = comunicado.turmaId || comunicado.dados?.turmaId;
    if (singleTurmaId && !destTurmas.includes(singleTurmaId)) {
      const foundTurma = turmas?.find((t: any) => String(t.id) === String(singleTurmaId));
      if (foundTurma) {
        destTurmas.push(foundTurma.nome);
      } else {
        destTurmas.push(`Turma ID: ${singleTurmaId}`);
      }
    }
    
    const parts = [];
    if (destTurmas.length > 0) parts.push(`Turmas: ${destTurmas.join(', ')}`);
    if (destGrupos.length > 0) parts.push(`Grupos: ${destGrupos.join(', ')}`);
    if (alunosNames.length > 0) parts.push(`Alunos: ${alunosNames.join(', ')}`);
    if (funcNames.length > 0) parts.push(`Colaboradores: ${funcNames.join(', ')}`);
    
    if (parts.length === 0) return 'Geral (Todos)';
    
    return parts.join(' | ');
  }, [comunicado, isAdminMode, alunos]);

  const relatedIndividualIds = useMemo(() => {
    if (!isGroupedReport || !allComunicados || allComunicados.length === 0) return [];
    const groupDate = new Date(comunicado.dataEnvio || comunicado.created_at || 0).getTime();
    if (!groupDate) return [];
    
    return allComunicados
      .filter(c => c.id?.startsWith('AD-COM-REL-STU'))
      .filter(c => c.autorId === comunicado.autorId)
      .filter(c => {
         const dDate = new Date(c.dataEnvio || c.created_at || 0).getTime();
         return Math.abs(dDate - groupDate) < 15000; // 15 seconds window
      })
      .map(c => c.id);
  }, [comunicado, isGroupedReport, allComunicados]);

  const getComunicadoIdForStudent = (studentId: string) => {
    if (!isGroupedReport || !allComunicados) return comunicado.id;
    const groupDate = new Date(comunicado.dataEnvio || comunicado.created_at || 0).getTime();
    const related = allComunicados.find(c => 
      c.id?.startsWith('AD-COM-REL-STU') && 
      c.autorId === comunicado.autorId &&
      Math.abs(new Date(c.dataEnvio || c.created_at || 0).getTime() - groupDate) < 15000 &&
      (c.alunosIds || []).some((id: string) => String(id) === String(studentId))
    );
    return related ? related.id : comunicado.id;
  };

  const fetchMessages = async () => {
    try {
      let url = '';
      if (isAdminMode) {
        if (isGroupedReport && relatedIndividualIds.length > 0) {
          url = `/api/comunicados_respostas?comunicado_ids=${relatedIndividualIds.join(',')}&admin=true`;
        } else {
          url = `/api/comunicados_respostas?comunicado_id=${comunicado.id}&admin=true`;
        }
      } else {
        url = `/api/comunicados_respostas?comunicado_id=${comunicado.id}&remetente_id=${currentUserSlug}`;
      }
      
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
  }, [comunicado.id, currentUserSlug, isAdminMode, canReply, relatedIndividualIds])

  const handleSend = async () => {
    if (!newMessage.trim() && pendingAnexos.length === 0) return
    setIsSending(true)
    
    try {
      const studentId = isAdminMode ? (selectedThreadId || currentUserSlug) : currentUserSlug;
      const targetComunicadoId = isAdminMode ? getComunicadoIdForStudent(studentId) : comunicado.id;

      const payload = {
        comunicado_id: targetComunicadoId,
        remetente_id: studentId,
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
          urls.push(uploadRes.url as string)
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
      const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;
      
      if (!isCapacitor && (parsed.url.toLowerCase().endsWith('.pdf') || parsed.mime === 'application/pdf')) {
         if (setMaximizedPdfStr) {
           setMaximizedPdfStr(parsed.url);
           return;
         }
      }
      
      if (isCapacitor) {
        // No Capacitor, iframe de PDF falha no iOS. target="_blank" em tags <a> também falha.
        // O ideal é usar window.open com _system.
        window.open(parsed.url, '_system') || window.open(parsed.url, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = parsed.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } else {
      alert(`Falha ao abrir ${parsed.name}`)
    }
  }

  const handleGeneratePayment = async () => {
    setIsGeneratingPayment(true);
    try {
      const res = await fetch('/api/cobrancas/mercadopago-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobranca_destinatario_id: cobrancaDestinatario.id,
          cobranca_id: cobranca.id
        })
      });
      const data = await res.json();
      if (data.error) {
        alert('Erro ao gerar cobrança: ' + data.error);
      } else {
        setPaymentLink(data.invoiceUrl);
        // Abre automaticamente a fatura recém gerada
        if (typeof window !== 'undefined' && (window as any).Capacitor) {
          window.open(data.invoiceUrl, '_system') || window.open(data.invoiceUrl, '_blank');
        } else {
          window.open(data.invoiceUrl, '_blank');
        }
      }
    } catch (e: any) {
      alert('Erro inesperado: ' + e.message);
    } finally {
      setIsGeneratingPayment(false);
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
          position: 'fixed', 
          top: 0, left: 0, right: 0, 
          height: viewportHeight,
          background: 'rgba(15, 23, 42, 0.4)', 
          backdropFilter: 'blur(8px)', zIndex: 99999, 
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center'
        }} 
      >
        <style dangerouslySetInnerHTML={{__html: `
          .cvm-modal-container {
            width: 100%;
            height: 100%;
            max-width: 1100px;
            max-height: 100%;
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
              margin-top: 4vh;
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
            top: -120%;
            left: -25%;
          }
          .cvm-header-bg::after {
            background: linear-gradient(to left, rgba(255,255,255,0.05), rgba(255,255,255,0.15));
            top: -110%;
            left: -10%;
            border-radius: 45%;
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
          style={{ 
            boxSizing: 'border-box',
            paddingBottom: (isInputFocused && typeof window !== 'undefined' && window.innerWidth < 768) ? '45vh' : 0, 
            transition: 'padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
          }}
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

            <div style={{ display: 'flex', alignItems: 'center', zIndex: 1, position: 'relative' }}>
              <button className="cvm-icon-btn" onClick={onClose} title="Fechar">
                <X size={24} />
              </button>
            </div>

            {(onEdit || onDelete) && (
              <div style={{ position: 'absolute', bottom: 12, right: 24, display: 'flex', gap: 6, zIndex: 2 }}>
                {onEdit && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(comunicado); }} 
                    title="Editar Comunicado"
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                {onDelete && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(comunicado.id); }} 
                    title="Excluir Comunicado"
                    style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
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
                <div style={{ 
                  position: 'relative',
                  width: 46,
                  height: 46,
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.03) 100%)', 
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: 14, 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0, 
                  boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.1), inset 0 2px 4px rgba(255, 255, 255, 0.6)' 
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 2px 6px rgba(99,102,241,0.25))' }}>
                    <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" fill="url(#comIconFill)" stroke="url(#comIconStroke)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="16" cy="8" r="2.5" fill="#00D2FF" stroke="#ffffff" strokeWidth="1"/>
                    <defs>
                      <linearGradient id="comIconFill" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6366f1" stopOpacity="0.15"/>
                        <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.05"/>
                      </linearGradient>
                      <linearGradient id="comIconStroke" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6366f1"/>
                        <stop offset="1" stopColor="#a855f7"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.3, marginBottom: 8 }}>
                    {comunicado.titulo}
                  </h1>
                  
                  {/* Prioridade */}
                  {(comunicado.prioridade === 'alta' || comunicado.prioridade === 'urgente') && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      {comunicado.prioridade === 'alta' && <span style={{ background: '#fee2e2', color: '#ef4444', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12, border: '1px solid #fca5a5' }}>Prioridade Alta</span>}
                      {comunicado.prioridade === 'urgente' && <span style={{ background: '#ffedd5', color: '#f97316', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12, border: '1px solid #fdba74' }}>Urgente</span>}
                    </div>
                  )}

                  {/* Destinatários */}
                  {destinatariosStr && (
                    <div style={{ 
                      marginTop: 12,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '8px 12px',
                      fontSize: 13,
                      color: '#475569',
                      maxHeight: 80,
                      overflowY: 'auto',
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#cbd5e1 transparent',
                      wordBreak: 'break-word'
                    }}>
                      <strong style={{ color: '#0f172a' }}>Enviado para:</strong> {destinatariosStr}
                    </div>
                  )}
                </div>
              </div>

              {/* Text Content */}
              {isLoadingFull ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 size={32} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 16, lineHeight: 1.7, color: '#334155', fontWeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} 
                       dangerouslySetInnerHTML={{ __html: (comunicado.conteudo || comunicado.texto || '').replace(/\n/g, '<br/>') }} />
                </>
              )}
            </div>

            {/* Cobrança UI */}
            {cobranca && (cobrancaDestinatario || isAdminMode) && (() => {
              const statusStr = cobrancaDestinatario?.status || 'PENDING';
              const isPaid = statusStr === 'CONFIRMED' || statusStr === 'RECEIVED';
              const isOverdue = !isPaid && new Date(cobranca.vencimento) < new Date(new Date().setHours(0,0,0,0));
              
              let colors = {
                bg: '#ffffff',
                border: 'rgba(0,0,0,0.08)',
                accent: '#3b82f6',
                accentBg: 'rgba(59,130,246,0.1)',
                text: '#0f172a',
                label: '#64748b'
              };

              let badgeText = "COBRANÇA DIGITAL";
              let Icon = FileText;

              if (isAdminMode) {
                colors.bg = '#f8fafc';
                colors.accent = '#64748b';
                colors.accentBg = '#f1f5f9';
                badgeText = "COBRANÇA (ADMIN)";
                Icon = Info;
              } else if (isPaid) {
                colors.bg = '#f0fdf4';
                colors.accent = '#10b981';
                colors.accentBg = '#ecfdf5';
                colors.border = 'rgba(16,185,129,0.25)';
                badgeText = "PAGAMENTO RECEBIDO";
                Icon = CheckCircle2;
              } else if (isOverdue) {
                colors.bg = '#fef2f2';
                colors.accent = '#ef4444'; // Red
                colors.accentBg = '#fef2f2';
                colors.border = 'rgba(239,68,68,0.25)';
                badgeText = "COBRANÇA VENCIDA";
                Icon = ShieldAlert;
              } else {
                colors.bg = '#fffbeb';
                colors.accent = '#f59e0b'; // Orange
                colors.accentBg = '#fffbeb';
                colors.border = 'rgba(245,158,11,0.25)';
                badgeText = "PAGAMENTO EM ABERTO";
                Icon = Calendar;
              }

              return (
                <div style={{ 
                  marginTop: 24, 
                  background: colors.bg, 
                  border: `1px solid ${colors.border}`, 
                  borderRadius: 16, 
                  padding: '16px 20px',
                  display: 'flex', 
                  flexWrap: 'wrap',
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: 20, 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
                }}>
                  {/* Left Column: Icon + Info */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: '1 1 250px' }}>
                     <div style={{ width: 46, height: 46, borderRadius: '50%', background: colors.accentBg, color: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `inset 0 0 0 1px ${colors.border}` }}>
                       <Icon size={22} />
                     </div>
                     <div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                         <span style={{ fontSize: 11, fontWeight: 800, color: colors.accent, letterSpacing: 0.5 }}>{badgeText}</span>
                         <span style={{ fontSize: 11, color: colors.label, fontWeight: 500 }}>• Venc: {new Date(cobranca.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                       </div>
                       <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 2 }}>{cobranca.titulo}</div>
                       <div style={{ fontSize: 22, fontWeight: 800, color: colors.text, letterSpacing: -0.5 }}>
                          R$ {Number(cobranca.valor).toFixed(2).replace('.', ',')}
                       </div>
                     </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div style={{ flexShrink: 0, flex: '1 1 auto', display: 'flex', justifyContent: 'flex-end' }}>
                     {isAdminMode ? (
                       <div style={{ color: '#64748b', fontSize: 12, fontWeight: 500, maxWidth: 160, textAlign: 'right', padding: '8px 12px', background: '#f1f5f9', borderRadius: 8 }}>
                          Visualização restrita do modo Admin.
                       </div>
                     ) : isPaid ? (
                       <div style={{ color: colors.accent, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, background: colors.accentBg, padding: '10px 20px', borderRadius: 12, border: `1px solid ${colors.border}` }}>
                          <CheckCircle2 size={18} /> Pago
                       </div>
                     ) : paymentLink ? (
                        <button 
                          onClick={() => !isOverdue && window.open(paymentLink, '_blank')}
                          disabled={isOverdue}
                          style={{ width: '100%', background: isOverdue ? '#94a3b8' : colors.accent, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: isOverdue ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: isOverdue ? 'none' : `0 4px 12px ${colors.accent}40` }}
                        >
                          <ExternalLink size={18} />
                          ACESSAR FATURA
                        </button>
                     ) : (
                        <button 
                          onClick={handleGeneratePayment}
                          disabled={isGeneratingPayment || isOverdue}
                          style={{ width: '100%', background: isOverdue ? '#94a3b8' : colors.accent, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: (isGeneratingPayment || isOverdue) ? (isOverdue ? 'not-allowed' : 'wait') : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: isOverdue ? 'none' : `0 4px 12px ${colors.accent}40`, opacity: (isGeneratingPayment && !isOverdue) ? 0.7 : 1 }}
                        >
                          <CreditCard size={18} />
                          {isGeneratingPayment ? 'GERANDO LINK...' : 'PAGAR AGORA'}
                        </button>
                     )}
                  </div>
                </div>
              );
            })()}

            {/* Attachments - Visual Order */}
            {comunicado.anexos && comunicado.anexos.length > 0 && !isLoadingFull && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 800, margin: '0 auto' }}>
                {comunicado.anexos.map((anexo: string, idx: number) => {
                  const parsed = parseAnexo(anexo)
                  if (!parsed) return null
                  
                  const isForm = parsed.name.startsWith('Formulário: ') && parsed.url.startsWith('form:')
                  const isRel = parsed.name.startsWith('Relatório: ') && parsed.url.startsWith('form:')
                  const isReportTask = parsed.name.startsWith('Tarefa de Relatório:') && parsed.url.startsWith('report-task:')
                  const isReportPayload = parsed.url.startsWith('payload:') || parsed.mime === 'report-payload'
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
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <UserAvatar 
                              userId={thread.studentId}
                              name={thread.studentName}
                              fotoUrl={thread.studentFoto}
                              size={44}
                            />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{thread.studentName}</div>
                              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{thread.messages.length} mensagens com este usuário</div>
                            </div>
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
                      
                      let alunoObj = alunos.find((a: any) => {
                        if (!a || !a.id) return false;
                        const aIdStr = String(a.id);
                        const rIdStr = String(msg.remetente_id);
                        return aIdStr === rIdStr || aIdStr === `a_${rIdStr}` || aIdStr.replace(/^_*(ALU)?/, '') === rIdStr.replace(/^_*(ALU)?/, '');
                      });
                      
                      // Check if it's from responsavel. If we don't have alunoObj (maybe the array wasn't passed properly), we can fallback to checking if isAdminMode is false and this message's remetente_nome is different from the first message's remetente_nome, or just assume if it's not the student.
                      // Wait, we have currentUserName passed down.
                      let isFromResponsavel = alunoObj && msg.remetente_nome && msg.remetente_nome.trim().toLowerCase() !== alunoObj.nome.trim().toLowerCase();
                      
                      // Fallback: If we couldn't find alunoObj, but we know the student's name from the parent component (in parent app, currentUserName is passed but actually we want student's name. Wait, the modal title is `Conversa com ${adminThreads.find(t => t.studentId === selectedThreadId)?.studentName}`).
                      const threadStudent = isAdminMode ? adminThreads.find(t => t.studentId === selectedThreadId) : null;
                      const threadStudentName = threadStudent?.studentName || null;
                      const threadStudentFoto = threadStudent?.studentFoto || null;

                      if (!alunoObj && msg.remetente_nome) {
                         if (threadStudentName && msg.remetente_nome.trim().toLowerCase() !== threadStudentName.trim().toLowerCase()) {
                            isFromResponsavel = true;
                            alunoObj = { id: selectedThreadId, nome: threadStudentName, foto: threadStudentFoto };
                         } else if (threadStudentName) {
                            alunoObj = { id: selectedThreadId, nome: threadStudentName, foto: threadStudentFoto };
                         } else if (!isAdminMode) {
                            // in parent app, if we still don't have alunoObj, let's look at the first message in the thread to get the student's name, or just use the fact that if it's me, and msg.remetente_nome != adminThreads... wait, in parent app adminThreads is not used for title.
                            // The easiest is just rely on the fixed find().
                         }
                      }

                      let avatarToUse = undefined;
                      if (!msg.is_admin) {
                        if (alunoObj?.foto) {
                          avatarToUse = alunoObj.foto;
                        }
                        // Se for uma mensagem de familiar/aluno e não tiver foto do aluno, não usar a foto do responsável.
                        // Vai cair no fallback de usar a primeira letra do nome.
                      } else if (isMe && currentUserAvatar) {
                        avatarToUse = currentUserAvatar;
                      }
                      
                      const msgDate = new Date(msg.created_at);
                      const msgTimeStr = msgDate.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) + ' às ' + msgDate.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                      
                      return (
                        <div key={msg.id} style={{ display: 'flex', gap: 12 }}>
                          <UserAvatar
                            userId={msg.is_admin ? msg.remetente_id : (alunoObj?.id || msg.remetente_id)}
                            name={alunoObj?.nome || msg.remetente_nome}
                            fotoUrl={avatarToUse}
                            size={36}
                          />
                          <div>
                            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{isFromResponsavel && alunoObj ? alunoObj.nome : msg.remetente_nome}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                {isFromResponsavel && (
                                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                                    Enviado por: {msg.remetente_nome} &bull;
                                  </span>
                                )}
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{msgTimeStr}</span>
                              </div>
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
                  onFocus={(e) => {
                    setIsInputFocused(true);
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 300);
                  }}
                  onBlur={() => setIsInputFocused(false)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
              </div>

              <button 
                onClick={handleSend}
                disabled={isSending || isUploading || (!newMessage.trim() && pendingAnexos.length === 0)}
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  width: 44, height: 44, borderRadius: '50%', 
                  background: (!newMessage.trim() && pendingAnexos.length === 0) ? '#e2e8f0' : 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)', 
                  color: (!newMessage.trim() && pendingAnexos.length === 0) ? '#94a3b8' : '#ffffff', 
                  border: 'none', cursor: (!newMessage.trim() && pendingAnexos.length === 0) ? 'default' : 'pointer',
                  boxShadow: (!newMessage.trim() && pendingAnexos.length === 0) ? 'none' : '0 4px 14px rgba(79,70,229,0.4)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: (!newMessage.trim() && pendingAnexos.length === 0) ? 'scale(1)' : 'scale(1.05)'
                }}
              >
                <Send size={18} style={{ marginLeft: 2, transform: isSending ? 'translateX(2px)' : 'none', transition: 'transform 0.2s' }} />
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
