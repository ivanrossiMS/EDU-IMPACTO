'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Paperclip, FileText, CheckCircle2, ShieldAlert, Calendar, Mic, Send, Share, Bookmark, MoreHorizontal, Edit2, Trash2, Loader2, CreditCard, Info, ExternalLink, Vote, Smile } from 'lucide-react'
import Image from 'next/image'
import Portal from '@/components/Portal'
import { UserAvatar } from '@/components/UserAvatar'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { getCachedStudentPhoto, setCachedStudentPhoto, fetchStudentPhotos } from '@/lib/studentPhotoCache'
import { getGlobalCachedMessages, setGlobalCachedMessages } from '@/lib/comunicadosRespostasCache'
import { EnqueteWidget } from '@/components/agenda/enquetes/EnqueteWidget'
import { AutorizacaoWidget } from '@/components/agenda/autorizacoes/AutorizacaoWidget'
import { triggerHaptic } from '@/lib/utils/haptics'

// Helpers
const parseAnexo = (anexoData: any) => {
  if (!anexoData) return null;
  if (typeof anexoData === 'object') {
    return {
      name: anexoData.nome || anexoData.name || '',
      url: anexoData.url || '',
      mime: anexoData.mime || (anexoData.type === 'image' ? 'image/jpeg' : ''),
      size: anexoData.size || anexoData.tamanho || null
    };
  }
  try {
    const str = typeof anexoData === 'string' ? anexoData : String(anexoData);
    const parts = (str && typeof str.split === 'function') ? str.split('|') : [str];
    const name = parts[0] || '';
    const url = parts[1] || '';
    const mime = parts[2] || '';
    const size = parts[3] ? parseInt(parts[3], 10) : null;
    return { name, url, mime, size };
  } catch (e) {
    return null;
  }
};

const AttachmentSize = ({ url, initialSize }: { url?: string; initialSize?: number | string | null }) => {
  const [sizeStr, setSizeStr] = useState<string>('');

  useEffect(() => {
    if (initialSize) {
      const bytes = typeof initialSize === 'number' ? initialSize : parseInt(initialSize, 10);
      if (!isNaN(bytes)) {
        if (bytes > 1048576) {
          setSizeStr((bytes / 1048576).toFixed(1) + ' MB');
        } else {
          setSizeStr((bytes / 1024).toFixed(0) + ' KB');
        }
        return;
      }
    }

    if (url && url.startsWith('http')) {
      fetch(url, { method: 'HEAD' })
        .then(res => {
          const cl = res.headers.get('content-length');
          if (cl) {
            const bytes = parseInt(cl, 10);
            if (bytes > 1048576) {
              setSizeStr((bytes / 1048576).toFixed(1) + ' MB');
            } else {
              setSizeStr((bytes / 1024).toFixed(0) + ' KB');
            }
          }
        })
        .catch(() => {});
    }
  }, [url, initialSize]);

  if (!sizeStr) return null;
  return <span>{sizeStr}</span>;
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

const normalizeText = (text: any): string => {
  if (!text || typeof text !== 'string') return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
};

export interface ChatMessageReaction {
  emoji: string
  user_id: string
  user_name: string
  created_at?: string
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
  reacoes?: ChatMessageReaction[]
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
  isStaff?: boolean
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
  onForward?: (comunicado: any) => void
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
  isStaff = false,
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
  onDelete,
  onForward
}: ComunicadoViewModalProps) {
  const [comunicado, setComunicado] = useState<any>(initialComunicado)
  const [isLoadingFull, setIsLoadingFull] = useState(!initialComunicado.conteudo && !initialComunicado.texto)
  
  useEffect(() => {
    if (initialComunicado) {
      setComunicado(initialComunicado)
    }
  }, [initialComunicado])
  
  const initialCobs = Array.isArray(comunicado?.cobrancas || comunicado?.dados?.cobrancas)
    ? (comunicado?.cobrancas || comunicado?.dados?.cobrancas)
    : (comunicado?.cobranca || comunicado?.dados?.cobranca ? [comunicado.cobranca || comunicado.dados.cobranca] : []);
  const [cobrancasList, setCobrancasList] = useState<any[]>(initialCobs)
  const [generatingPaymentIds, setGeneratingPaymentIds] = useState<Record<string, boolean>>({})
  const [paymentLinksMap, setPaymentLinksMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (comunicado?.id) {
      const fetchCobrancas = async () => {
         const { supabase } = await import('@/lib/supabase');
         const { data, error } = await supabase
           .from('agenda_cobrancas')
           .select('*, agenda_cobrancas_destinatarios(*)')
           .eq('comunicado_id', String(comunicado.id))
           .order('created_at', { ascending: true });
           
         if (data && data.length > 0) {
            setCobrancasList(data);
            
            if (currentUserSlug && !isAdminMode) {
               const cleanSlug = currentUserSlug.replace(/^(a_|_ALU)/, '');
               const newLinks: Record<string, string> = {};
               data.forEach((cob: any) => {
                 if (cob.agenda_cobrancas_destinatarios) {
                   const dest = cob.agenda_cobrancas_destinatarios.find((d: any) => 
                      String(d.destinatario_id).replace(/^(a_|_ALU)/, '') === cleanSlug
                   );
                   if (dest && dest.url_pagamento) {
                      newLinks[cob.id] = dest.url_pagamento;
                   }
                 }
               });
               setPaymentLinksMap(prev => ({ ...prev, ...newLinks }));
            }
         }
      }
      fetchCobrancas();
      // Poll every 5 seconds to catch webhook updates in real-time
      const cobInterval = setInterval(fetchCobrancas, 5000);
      return () => clearInterval(cobInterval);
    }
  }, [comunicado.id, currentUserSlug, isAdminMode])

  const [studentPhotosMap, setStudentPhotosMap] = useState<Record<string, string | null>>({});

  // Pré-carrega fotos dos alunos caso o comunicado possua anexos de relatórios individuais
  useEffect(() => {
    if (!comunicado?.anexos || !Array.isArray(comunicado.anexos)) return;
    const idsToFetch: string[] = [];
    comunicado.anexos.forEach((a: any) => {
      const aStr = typeof a === 'string' ? a : String(a?.url || '');
      if (aStr.includes('payload:') || aStr.endsWith('|report-payload')) {
        try {
          const parts = aStr.split('|');
          const p = parts.find(x => x.startsWith('payload:'));
          if (p) {
            const pay = JSON.parse(p.substring(8));
            if (pay?.studentInfo?.id) idsToFetch.push(String(pay.studentInfo.id));
            const vKeys = Object.keys(pay?.values || {});
            if (vKeys[0]) idsToFetch.push(String(vKeys[0]));
          }
        } catch(e) {}
      }
    });

    if (idsToFetch.length > 0) {
      fetchStudentPhotos(idsToFetch).then(photos => {
        setStudentPhotosMap(prev => ({ ...prev, ...photos }));
      });
    }
  }, [comunicado?.anexos]);

  const filterAuthorizedMessages = useCallback((rawMsgs: any[]) => {
    if (!Array.isArray(rawMsgs)) return [];
    if (isAdminMode) return rawMsgs;
    const cleanSlug = String(currentUserSlug || '').trim().toLowerCase().replace(/^f_?/, '');
    return rawMsgs.filter((m: any) => {
      const rId = String(m.remetente_id || '').trim().toLowerCase().replace(/^f_?/, '');
      const dId = String(m.destinatario_id || '').trim().toLowerCase().replace(/^f_?/, '');
      return rId === cleanSlug || dId === cleanSlug;
    });
  }, [isAdminMode, currentUserSlug]);

  useEffect(() => {
    if ((!comunicado.conteudo && !comunicado.texto) && comunicado.id) {
      setIsLoadingFull(true)
      const fetchUrl = (isAdminMode || isStaff)
        ? `/api/comunicados?id=${comunicado.id}`
        : `/api/comunicados?id=${comunicado.id}${currentUserSlug && currentUserSlug !== 'admin' ? `&aluno_id=${currentUserSlug}` : ''}`
      
      fetch(fetchUrl)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            setComunicado(data[0])
            if (Array.isArray(data[0].respostas) && data[0].respostas.length > 0) {
              const authorized = filterAuthorizedMessages(data[0].respostas);
              setMessages(authorized);
              setLoadingMsg(false);
              if (isAdminMode) {
                setGlobalCachedMessages(data[0].id, data[0].respostas);
              }
            }
          }
        })
        .finally(() => setIsLoadingFull(false))
    }
  }, [comunicado.id, isAdminMode, isStaff, currentUserSlug, filterAuthorizedMessages])

  const isGroupedReport = comunicado.id?.startsWith('AD-COM-REL-COLAB');
  const canReply = comunicado.permiteResposta || (isAdminMode && isGroupedReport) || comunicado.isSaudacao || comunicado.dados?.isSaudacao || comunicado.titulo === 'Mensagem de Boas-vindas' || comunicado.titulo === 'Mensagem de Saudação'

  const initialMessages = useMemo(() => {
    let raw: any[] = [];
    if (Array.isArray(initialComunicado?.respostas) && initialComunicado.respostas.length > 0) {
      raw = initialComunicado.respostas;
    } else if (Array.isArray(initialComunicado?.dados?.respostas) && initialComunicado.dados.respostas.length > 0) {
      raw = initialComunicado.dados.respostas;
    } else {
      const cached = getGlobalCachedMessages(initialComunicado?.id);
      if (Array.isArray(cached) && cached.length > 0) {
        raw = cached;
      }
    }
    return filterAuthorizedMessages(raw);
  }, [initialComunicado, filterAuthorizedMessages]);

  const hasKnownNoConversas = Boolean(
    initialComunicado?.conversas_info && 
    initialComunicado.conversas_info.tem_conversas === false
  );

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [loadingMsg, setLoadingMsg] = useState(!hasKnownNoConversas && initialMessages.length === 0)

  useEffect(() => {
    if (initialComunicado) {
      setComunicado(initialComunicado);
      const rawSeed = initialComunicado.respostas || initialComunicado.dados?.respostas || getGlobalCachedMessages(initialComunicado.id);
      const seed = filterAuthorizedMessages(Array.isArray(rawSeed) ? rawSeed : []);
      if (seed.length > 0) {
        setMessages(seed);
        setLoadingMsg(false);
      } else if (initialComunicado?.conversas_info?.tem_conversas === false || !isAdminMode) {
        setLoadingMsg(false);
      }
    }
  }, [initialComunicado, filterAuthorizedMessages, isAdminMode])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingAnexos, setPendingAnexos] = useState<string[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [showDestinatariosModal, setShowDestinatariosModal] = useState(false)
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  // Scroll locking on document body/html while modal is active
  useEffect(() => {
    if (typeof document === 'undefined') return
    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [])

  // Viewport and virtual keyboard listener for mobile (especially iOS Safari)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleViewportChange = () => {
      if (window.visualViewport) {
        // Difference between outer window and visualViewport
        const diff = Math.max(0, Math.round(window.innerHeight - window.visualViewport.height))
        // Only consider it a virtual keyboard if difference > 50px
        setKeyboardOffset(diff > 50 ? diff : 0)
      } else {
        setKeyboardOffset(0)
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange)
      window.visualViewport.addEventListener('scroll', handleViewportChange)
      handleViewportChange()
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange)
        window.visualViewport.removeEventListener('scroll', handleViewportChange)
      }
    }
  }, [])

  // Safely scroll comments without moving the layout viewport or window
  const scrollToBottom = (smooth = true) => {
    if (bodyRef.current) {
      bodyRef.current.scrollTo({
        top: bodyRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  }


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

      const key = alunoObj?.id ? String(alunoObj.id) : String(threadId);

      if (!threadsMap.has(key)) {
        threadsMap.set(key, {
          studentId: alunoObj?.id || threadId,
          studentName: alunoObj?.nome || (!msg.is_admin ? msg.remetente_nome : 'Aluno') || 'Usuário',
          studentFoto: alunoObj?.foto || alunoObj?.fotoUrl || alunoObj?.foto_url || studentPhotosMap[threadId] || studentPhotosMap[alunoObj?.id] || getCachedStudentPhoto(alunoObj?.id || threadId),
          messages: [],
          lastMessageAt: msg.created_at
        })
      }
      
      const thread = threadsMap.get(key)!
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
  }, [messages, isAdminMode, alunos, studentPhotosMap])
  
  const messagesToShow = isAdminMode ? (selectedThreadId ? adminThreads.find(t => t.studentId === selectedThreadId)?.messages || [] : []) : messages;

  const destinatariosStr = useMemo(() => {
    if (!isAdminMode && !isStaff) return null;
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
    // 1. Se já temos mensagem deste aluno com original_comunicado_id ou STU id, usa direto
    const existingMsg = messages.find(m => 
      (String(m.remetente_id) === String(studentId) || String(m.destinatario_id) === String(studentId)) && 
      (m as any).original_comunicado_id
    );
    if (existingMsg && (existingMsg as any).original_comunicado_id) {
      return (existingMsg as any).original_comunicado_id;
    }
    const stuMsg = messages.find(m => 
      (String(m.remetente_id) === String(studentId) || String(m.destinatario_id) === String(studentId)) && 
      m.comunicado_id && m.comunicado_id.startsWith('AD-COM-REL-STU-')
    );
    if (stuMsg) return stuMsg.comunicado_id;

    if (!isGroupedReport || !allComunicados) return comunicado.id;
    const groupDate = new Date(comunicado.dataEnvio || comunicado.created_at || 0).getTime();
    const comAutorId = comunicado.autorId || comunicado.dados?.autorId;
    const related = allComunicados.find(c => 
      c.id?.startsWith('AD-COM-REL-STU') && 
      (c.autorId === comAutorId || c.dados?.autorId === comAutorId) &&
      Math.abs(new Date(c.dataEnvio || c.created_at || 0).getTime() - groupDate) < 60000 &&
      (c.alunosIds || []).some((id: string) => String(id) === String(studentId))
    );
    return related ? related.id : comunicado.id;
  };

  const fetchMessages = async (silent = false) => {
    if (!silent && messages.length === 0 && !hasKnownNoConversas) {
      setLoadingMsg(true);
    }
    try {
      let espelharParam = '';
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const espColab = urlParams.get('espelhar_colaborador');
        if (espColab) {
          espelharParam = `&espelhar_colaborador=${encodeURIComponent(espColab)}`;
        }
      }

      let url = '';
      const autorId = comunicado.autorId || comunicado.dados?.autorId;
      if (isAdminMode) {
        if (isGroupedReport && autorId) {
          const gDate = new Date(comunicado.dataEnvio || comunicado.created_at || 0).getTime();
          url = `/api/comunicados_respostas?grouped_autor_id=${encodeURIComponent(autorId)}&grouped_time=${gDate}&admin=true${espelharParam}`;
        } else {
          url = `/api/comunicados_respostas?comunicado_id=${encodeURIComponent(comunicado.id)}&admin=true${espelharParam}`;
        }
      } else {
        url = `/api/comunicados_respostas?comunicado_id=${encodeURIComponent(comunicado.id)}&remetente_id=${encodeURIComponent(currentUserSlug)}${espelharParam}`;
      }
      
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          const authorized = filterAuthorizedMessages(data);
          const unique = Array.from(new Map(authorized.map((m: any) => [m.id, m])).values()) as ChatMessage[];
          setMessages(unique);
          if (isAdminMode) {
            setGlobalCachedMessages(comunicado.id, unique);
          }
          if (typeof window !== 'undefined' && unique.length > 0) {
            window.dispatchEvent(new CustomEvent('agenda-digital:conversas-updated', {
              detail: { comunicadoId: comunicado.id, total: unique.length, messages: unique }
            }));
          }
        } else if (data) {
          const authorized = filterAuthorizedMessages([data]);
          setMessages(authorized);
        }
      }
    } catch (e) {
      console.error('Error fetching messages', e)
    } finally {
      setLoadingMsg(false)
    }
  }

  useEffect(() => {
    if (canReply) {
      fetchMessages(true)
      const interval = setInterval(() => fetchMessages(true), 10000)
      return () => clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comunicado.id, currentUserSlug, isAdminMode, canReply])

  // Realtime updates listener for instant response arrival
  useEffect(() => {
    const handleConversasUpdate = (e: any) => {
      const payload = e.detail;
      if (!payload) return;
      const { eventType, new: newMsg, old: oldMsg } = payload;
      const currentId = String(comunicado.id);
      const isRelated = 
        (newMsg && (String(newMsg.comunicado_id) === currentId || isGroupedReport)) ||
        (oldMsg && (String(oldMsg.comunicado_id) === currentId || isGroupedReport));
        
      if (!isRelated) return;
      
      if (eventType === 'INSERT' && newMsg) {
        const authorized = filterAuthorizedMessages([newMsg]);
        if (authorized.length === 0) return;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const next = [...prev, newMsg];
          if (isAdminMode) {
            setGlobalCachedMessages(comunicado.id, next);
          }
          return next;
        });
      } else if (eventType === 'DELETE' && oldMsg) {
        setMessages(prev => {
          const next = prev.filter(m => m.id !== oldMsg.id);
          if (isAdminMode) {
            setGlobalCachedMessages(comunicado.id, next);
          }
          return next;
        });
      } else {
        fetchMessages(true);
      }
    };

    window.addEventListener('agenda-digital:conversas-updated', handleConversasUpdate);
    return () => window.removeEventListener('agenda-digital:conversas-updated', handleConversasUpdate);
  }, [comunicado.id, isGroupedReport])

  const handleSend = async () => {
    if (!newMessage.trim() && pendingAnexos.length === 0) return
    setIsSending(true)
    
    try {
      const studentId = isAdminMode ? (selectedThreadId || currentUserSlug) : currentUserSlug;
      const targetComunicadoId = isAdminMode ? getComunicadoIdForStudent(studentId) : comunicado.id;

      const payload: any = {
        comunicado_id: targetComunicadoId,
        remetente_id: studentId,
        remetente_nome: currentUserName,
        conteudo: newMessage.trim(),
        anexos: pendingAnexos,
        is_admin: isAdminMode
      };

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const espColab = urlParams.get('espelhar_colaborador');
        if (espColab) {
          payload.espelhar_colaborador = espColab;
        }
      }

      const res = await fetch('/api/comunicados_respostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => {
          const next = [...prev, data];
          setGlobalCachedMessages(comunicado.id, next);
          if (typeof window !== 'undefined' && next.length > 0) {
            window.dispatchEvent(new CustomEvent('agenda-digital:conversas-updated', {
              detail: { comunicadoId: comunicado.id, total: next.length, messages: next }
            }));
          }
          return next;
        });
        setNewMessage('')
        setPendingAnexos([])
        setTimeout(() => scrollToBottom(true), 100)
      }
    } catch (e) {
      console.error('Error sending message', e)
    } finally {
      setIsSending(false)
    }
  }

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;
    setDeletingId(msgId);
    try {
      let delUrl = `/api/comunicados_respostas?id=${msgId}`;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const espColab = urlParams.get('espelhar_colaborador');
        if (espColab) {
          delUrl += `&espelhar_colaborador=${encodeURIComponent(espColab)}`;
        }
      }

      const res = await fetch(delUrl, { method: 'DELETE' });
      if (res.ok) {
        setMessages(prev => {
          const next = prev.filter(m => m.id !== msgId);
          setGlobalCachedMessages(comunicado.id, next);
          return next;
        });
      } else {
        const errorData = await res.json();
        alert(`Erro ao excluir mensagem: ${errorData.error}`);
      }
    } catch (e) {
      console.error('Error deleting message', e);
      alert('Erro ao excluir mensagem');
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (!activeReactionMsgId) return;
    const handleClickOutside = () => setActiveReactionMsgId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeReactionMsgId]);

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    const myId = currentUserSlug;
    const myName = currentUserName || 'Você';

    // Atualização otimista imediata na UI (estilo WhatsApp)
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      let reactions: any[] = Array.isArray(m.reacoes) ? [...m.reacoes] : [];
      const existingIdx = reactions.findIndex(r => String(r.user_id) === String(myId) && r.emoji === emoji);

      if (existingIdx >= 0) {
        reactions.splice(existingIdx, 1);
      } else {
        reactions = reactions.filter(r => String(r.user_id) !== String(myId));
        reactions.push({
          emoji,
          user_id: String(myId),
          user_name: myName,
          created_at: new Date().toISOString()
        });
      }

      return {
        ...m,
        reacoes: reactions
      };
    }));

    triggerHaptic('selection');

    try {
      let espelharParam = '';
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const espColab = urlParams.get('espelhar_colaborador');
        if (espColab) espelharParam = espColab;
      }

      const res = await fetch('/api/comunicados_respostas/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          emoji,
          user_id: myId,
          user_name: myName,
          espelhar_colaborador: espelharParam || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reacoes) {
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reacoes: data.reacoes } : m));
        }
      } else {
        fetchMessages();
      }
    } catch (err) {
      console.error('Erro ao registrar reação:', err);
      fetchMessages();
    }
  };

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

  const handleGeneratePaymentForCob = async (cob: any, dest: any) => {
    if (!dest?.id || !cob?.id) return;
    setGeneratingPaymentIds(prev => ({ ...prev, [cob.id]: true }));
    try {
      const res = await fetch('/api/cobrancas/mercadopago-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobranca_destinatario_id: dest.id,
          cobranca_id: cob.id
        })
      });
      const data = await res.json();
      if (data.error) {
        alert('Erro ao gerar cobrança: ' + data.error);
      } else {
        setPaymentLinksMap(prev => ({ ...prev, [cob.id]: data.invoiceUrl }));
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
      setGeneratingPaymentIds(prev => ({ ...prev, [cob.id]: false }));
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
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.5)', 
          backdropFilter: 'blur(8px)', 
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 99999, 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'center',
          overflow: 'hidden'
        }} 
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes cvmReactionPop {
            0% { transform: scale(0.6); opacity: 0; }
            70% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
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
            position: relative;
          }
          @media (min-width: 768px) {
            .cvm-modal-container {
              border-radius: 24px;
              max-height: 92vh;
              height: 92vh;
              margin-top: 4vh;
            }
          }
          @media (max-width: 767px) {
            .cvm-modal-container {
              width: 100% !important;
              height: 100% !important;
              max-width: 100% !important;
              max-height: 100% !important;
              border-radius: 0 !important;
              margin: 0 !important;
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
            z-index: 20;
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
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            padding: 32px 24px;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          @media (max-width: 767px) {
            .cvm-body {
              padding: 20px 16px;
              gap: 16px;
            }
          }
          .cvm-footer {
            flex-shrink: 0;
            background: #ffffff;
            border-top: 1px solid #e2e8f0;
            padding: 12px 20px;
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
            position: sticky;
            bottom: 0;
            z-index: 20;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.03);
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
            border: 1px solid transparent;
            transition: all 0.2s;
          }
          .cvm-input-area:focus-within {
            background: #ffffff;
            border-color: #6366f1;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
          }
          .cvm-input-area input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            font-size: 16px;
            padding: 10px 0;
            color: #0f172a;
          }
          .cvm-input-area input::placeholder {
            color: #94a3b8;
            font-size: 14px;
          }
        `}} />

        <motion.div 
          className="cvm-modal-container"
          style={{ 
            boxSizing: 'border-box',
            paddingBottom: keyboardOffset > 0 ? `${keyboardOffset}px` : undefined,
            transition: 'padding-bottom 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }} 
          initial={{scale: 0.98, opacity: 0}} 
          animate={{scale: 1, opacity: 1}} 
          exit={{scale: 0.98, opacity: 0}} 
          transition={{ duration: 0.2, ease: "easeOut" }}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 1, position: 'relative' }}>
              {onDelete && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(comunicado.id); }}
                  className="cvm-icon-btn"
                  title="Excluir"
                  aria-label="Excluir"
                  style={{ background: 'rgba(239, 68, 68, 0.35)', color: '#fff' }}
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button 
                onClick={onClose}
                className="cvm-icon-btn"
                aria-label="Fechar"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="cvm-body" ref={bodyRef}>
            
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
                    <div style={{ marginTop: 12 }}>
                      <button 
                        onClick={() => setShowDestinatariosModal(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 20,
                          padding: '6px 14px',
                          fontSize: 13,
                          color: '#475569',
                          cursor: 'pointer',
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f1f5f9';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Ver Destinatários
                      </button>
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

            {/* ENQUETE INTERATIVA */}
            {(comunicado.enquete || comunicado.dados?.enquete) && (
              <div style={{ marginTop: 24, width: '100%', maxWidth: 800 }}>
                <EnqueteWidget
                  enquete={comunicado.enquete || comunicado.dados?.enquete}
                  comunicadoId={String(comunicado.id)}
                  currentUser={{ id: currentUserSlug, nome: currentUserName, foto: currentUserAvatar }}
                  currentAluno={alunos && alunos.length === 1 ? alunos[0] : null}
                  isAdminMode={isAdminMode || isStaff}
                  onVoteSuccess={(updatedEnquete) => {
                    setComunicado((prev: any) => ({
                      ...prev,
                      enquete: updatedEnquete,
                      dados: {
                        ...(prev?.dados || {}),
                        enquete: updatedEnquete
                      }
                    }))
                  }}
                />
              </div>
            )}

            {/* AUTORIZAÇÃO DIGITAL */}
            {(comunicado.autorizacao || comunicado.dados?.autorizacao) && (
              <div style={{ marginTop: 24, width: '100%', maxWidth: 800 }}>
                <AutorizacaoWidget
                  autorizacao={comunicado.autorizacao || comunicado.dados?.autorizacao}
                  comunicadoId={String(comunicado.id)}
                  currentUser={{ id: currentUserSlug, nome: currentUserName, foto: currentUserAvatar }}
                  currentAluno={alunos && alunos.length === 1 ? alunos[0] : null}
                  isAdminMode={isAdminMode || isStaff}
                  onUpdateSuccess={(updatedAut) => {
                    setComunicado((prev: any) => ({
                      ...prev,
                      autorizacao: updatedAut,
                      dados: {
                        ...(prev?.dados || {}),
                        autorizacao: updatedAut
                      }
                    }))
                  }}
                />
              </div>
            )}

            {/* Cobranças UI */}
            {cobrancasList && cobrancasList.length > 0 && (() => {
              const cleanSlug = (currentUserSlug || '').replace(/^(a_|_ALU)/, '');
              
              // Filter to charges relevant to user or show all for admin
              const relevantCobs = cobrancasList.filter(cob => {
                if (isAdminMode || isStaff) return true;
                const dest = (cob.agenda_cobrancas_destinatarios || []).find((d: any) => 
                  String(d.destinatario_id).replace(/^(a_|_ALU)/, '') === cleanSlug
                );
                return !!dest;
              });

              if (relevantCobs.length === 0 && !isAdminMode && !isStaff) return null;

              const totalAmount = relevantCobs.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);

              return (
                <div style={{ marginTop: 24, width: '100%', maxWidth: 800, margin: '24px auto 0' }}>
                  {relevantCobs.length > 1 && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      marginBottom: 10, 
                      padding: '8px 14px',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%)',
                      borderRadius: 12,
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#047857' }}>
                        <CreditCard size={16} color="#10B981" />
                        <span>Cobranças Anexadas ({relevantCobs.length})</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                        Total: <span style={{ color: '#065F46', fontWeight: 800, fontSize: 15 }}>R$ {totalAmount.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {relevantCobs.map((cob: any, idx: number) => {
                      const cobDest = (cob.agenda_cobrancas_destinatarios || []).find((d: any) => 
                        String(d.destinatario_id).replace(/^(a_|_ALU)/, '') === cleanSlug
                      );
                      const statusStr = cobDest?.status || 'PENDING';
                      const isPaid = statusStr === 'CONFIRMED' || statusStr === 'RECEIVED';
                      const isOverdue = !isPaid && cob.vencimento && new Date(cob.vencimento) < new Date(new Date().setHours(0,0,0,0));
                      const curPaymentLink = paymentLinksMap[cob.id] || cobDest?.url_pagamento || '';
                      const isGenerating = !!generatingPaymentIds[cob.id];

                      let colors = {
                        bg: '#ffffff',
                        border: 'rgba(0,0,0,0.08)',
                        accent: '#3b82f6',
                        accentBg: 'rgba(59,130,246,0.1)',
                        text: '#0f172a',
                        label: '#64748b'
                      };

                      let badgeText = relevantCobs.length > 1 ? `COBRANÇA #${idx + 1}` : "COBRANÇA DIGITAL";
                      let Icon = FileText;

                      if (isAdminMode) {
                        colors.bg = '#f8fafc';
                        colors.accent = '#64748b';
                        colors.accentBg = '#f1f5f9';
                        badgeText = relevantCobs.length > 1 ? `COBRANÇA #${idx + 1} (ADMIN)` : "COBRANÇA (ADMIN)";
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
                        <div key={cob.id || idx} style={{ 
                          background: colors.bg, 
                          border: `1px solid ${colors.border}`, 
                          borderRadius: 16, 
                          padding: '16px 20px',
                          display: 'flex', 
                          flexWrap: 'wrap',
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          gap: 16, 
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
                                 {cob.vencimento && (
                                   <span style={{ fontSize: 11, color: colors.label, fontWeight: 500 }}>
                                     • Venc: {new Date(cob.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                   </span>
                                 )}
                               </div>
                               <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 2 }}>{cob.titulo}</div>
                               <div style={{ fontSize: 22, fontWeight: 800, color: colors.text, letterSpacing: -0.5 }}>
                                  R$ {Number(cob.valor).toFixed(2).replace('.', ',')}
                                </div>
                             </div>
                          </div>

                          {/* Right Column: Actions */}
                          <div style={{ flexShrink: 0, flex: '1 1 auto', display: 'flex', justifyContent: 'flex-end' }}>
                             {isAdminMode || isStaff ? (
                               <div style={{ color: '#64748b', fontSize: 12, fontWeight: 500, maxWidth: 160, textAlign: 'right', padding: '8px 12px', background: '#f1f5f9', borderRadius: 8 }}>
                                  Visualização restrita do modo Admin.
                               </div>
                             ) : isPaid ? (
                               <div style={{ color: colors.accent, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, background: colors.accentBg, padding: '10px 20px', borderRadius: 12, border: `1px solid ${colors.border}` }}>
                                  <CheckCircle2 size={18} /> Pago
                               </div>
                             ) : curPaymentLink ? (
                                <button 
                                  onClick={() => !isOverdue && window.open(curPaymentLink, '_blank')}
                                  disabled={isOverdue}
                                  style={{ width: '100%', background: isOverdue ? '#94a3b8' : colors.accent, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: isOverdue ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: isOverdue ? 'none' : `0 4px 12px ${colors.accent}40` }}
                                >
                                  <ExternalLink size={18} />
                                  ACESSAR FATURA
                                </button>
                             ) : (
                                <button 
                                  onClick={() => handleGeneratePaymentForCob(cob, cobDest)}
                                  disabled={isGenerating || isOverdue}
                                  style={{ width: '100%', background: isOverdue ? '#94a3b8' : colors.accent, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: (isGenerating || isOverdue) ? (isOverdue ? 'not-allowed' : 'wait') : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: isOverdue ? 'none' : `0 4px 12px ${colors.accent}40`, opacity: (isGenerating && !isOverdue) ? 0.7 : 1 }}
                                >
                                  <CreditCard size={18} />
                                  {isGenerating ? 'GERANDO LINK...' : 'PAGAR AGORA'}
                                </button>
                             )}
                          </div>
                        </div>
                      );
                    })}
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
                  
                  const isEnquete = parsed.name.startsWith('Enquete:') || parsed.url.startsWith('enquete:') || parsed.mime === 'enquete'
                  if (isEnquete) return null

                  const isAutorizacao = parsed.name.startsWith('Autorização:') || parsed.url.startsWith('autorizacao:') || parsed.mime === 'autorizacao'
                  if (isAutorizacao) return null

                  const isCobranca = parsed.name.startsWith('Cobrança:') || parsed.name.startsWith('Cobranca:') || parsed.url.startsWith('cobranca:') || parsed.mime === 'cobranca' || parsed.mime === 'cobrança'
                  if (isCobranca) return null

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
                    let reportStudentName = null;
                    let reportStudentAvatar = null;
                    if (isReportPayload && parsed.url.startsWith('payload:')) {
                      try {
                        const pay = JSON.parse(parsed.url.substring(8));
                        studentIdForCiencia = pay?.studentInfo?.id || Object.keys(pay?.values || {})[0];
                        reportStudentName = pay?.studentInfo?.name || null;
                        reportStudentAvatar = pay?.studentInfo?.avatarUrl || null;
                      } catch(e) {}
                    }

                    const cleanStuId = studentIdForCiencia ? String(studentIdForCiencia).replace(/^a_?/, '').replace(/^_*(ALU)?/, '') : null;
                    const matchedAluno = cleanStuId && alunos ? alunos.find((a: any) => {
                      const aId = String(a.id || '').replace(/^a_?/, '').replace(/^_*(ALU)?/, '');
                      return aId === cleanStuId || (reportStudentName && String(a.nome || '').trim().toLowerCase() === String(reportStudentName).trim().toLowerCase());
                    }) : null;

                    const finalPhoto = reportStudentAvatar || (cleanStuId ? (studentPhotosMap[cleanStuId] || getCachedStudentPhoto(cleanStuId)) : null) || matchedAluno?.foto || matchedAluno?.foto_url || matchedAluno?.avatarUrl || matchedAluno?.dados?.foto || matchedAluno?.dados?.avatarUrl || null;

                    const studentCienciaIso = studentIdForCiencia && comunicado.ciencias ? comunicado.ciencias[studentIdForCiencia] : null;
                    let cienciaString = '';
                    if (studentCienciaIso) {
                      const cDate = new Date(studentCienciaIso);
                      cienciaString = cDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' + cDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    }

                    const displayName = parsed.name.replace(/^(Formulário:|Relatório:|Tarefa de Relatório:)\s*/, '');
                    const initialLetter = (reportStudentName || displayName.replace(/^Relatório Personalizado:\s*/, '') || 'A').trim().charAt(0).toUpperCase();

                    // Document Card
                    return (
                      <div key={idx} style={{ maxWidth: 800, width: '100%', padding: '16px', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }} 
                           onClick={() => {
                             if (isReportTask && setOpenedReportTask) setOpenedReportTask(anexo)
                             else if (isReportPayload && setOpenedReportPayload) {
                               if (finalPhoto && cleanStuId) {
                                 setCachedStudentPhoto(cleanStuId, finalPhoto);
                               }
                               setOpenedReportPayload(anexo);
                             }
                             else if ((isForm || isRel) && setOpenedFormStr) setOpenedFormStr(anexo)
                             else handleDownload(parsed)
                           }}>
                        {isReportPayload ? (
                          <div style={{ width: 48, height: 48, borderRadius: 14, overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {finalPhoto ? (
                              <img 
                                src={finalPhoto} 
                                alt={displayName} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              />
                            ) : (
                              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
                                {initialLetter}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: isReportTask ? '#ecfdf5' : '#f1f5f9', color: isReportTask ? '#10b981' : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={24} />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                           <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{displayName}</div>
                           <div style={{ fontSize: 13, color: '#64748b' }}>
                              {isForm ? 'Formulário' : isRel ? 'Relatório' : isReportTask ? 'Tarefa de Relatório' : isReportPayload ? 'Relatório Individual do Aluno' : 'Documento anexo'}
                              {!isForm && !isRel && !isReportTask && !isReportPayload && (
                                <> • <AttachmentSize url={parsed.url} initialSize={parsed.size} /></>
                              )}
                            </div>
                           {(isAdminMode || isStaff) && cienciaString && (
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
                       loadingMsg ? (
                         <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
                           <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                               <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f1f5f9' }} />
                               <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                 <div style={{ width: 140, height: 16, borderRadius: 6, background: '#f1f5f9' }} />
                                 <div style={{ width: 180, height: 12, borderRadius: 4, background: '#f8fafc' }} />
                               </div>
                             </div>
                             <div style={{ width: 30, height: 12, borderRadius: 4, background: '#f1f5f9' }} />
                           </div>
                         </div>
                       ) : (
                         <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>Nenhuma conversa iniciada.</div>
                       )
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
                      
                      // Check if it's from responsavel.
                      let isFromResponsavel = !msg.is_admin && alunoObj && msg.remetente_nome && msg.remetente_nome.trim().toLowerCase() !== alunoObj.nome.trim().toLowerCase();
                      
                      // Fallback
                      const threadStudent = isAdminMode ? adminThreads.find(t => t.studentId === selectedThreadId) : null;
                      const threadStudentName = threadStudent?.studentName || null;
                      const threadStudentFoto = threadStudent?.studentFoto || null;

                      if (!msg.is_admin && !alunoObj && msg.remetente_nome) {
                         if (threadStudentName && msg.remetente_nome.trim().toLowerCase() !== threadStudentName.trim().toLowerCase()) {
                            isFromResponsavel = true;
                            alunoObj = { id: selectedThreadId, nome: threadStudentName, foto: threadStudentFoto };
                         } else if (threadStudentName) {
                            alunoObj = { id: selectedThreadId, nome: threadStudentName, foto: threadStudentFoto };
                         }
                      }

                      let avatarToUse: string | null | undefined = undefined;
                      let avatarUserId: string | undefined = undefined;

                      if (!msg.is_admin) {
                        avatarToUse = alunoObj?.foto;
                        avatarUserId = alunoObj?.id || msg.remetente_id;
                      } else {
                        const normMsgSender = normalizeText(msg.remetente_nome);
                        const normAutor = normalizeText(comunicado.autor || comunicado.dados?.autor || comunicado.autorNome || comunicado.dados?.autorNome);
                        const normCurrentUser = normalizeText(currentUserName);

                        // 1. Se remetente_nome for o autor do comunicado, usa a foto e ID do autor
                        if (normMsgSender && normAutor && (normMsgSender === normAutor || normAutor.includes(normMsgSender) || normMsgSender.includes(normAutor))) {
                          avatarToUse = comunicado.autorFoto || comunicado.dados?.autorFoto || (comunicado as any).autorAvatar;
                          avatarUserId = comunicado.autorId || comunicado.dados?.autorId;
                        }

                        // 2. Busca na lista de colaboradores pelo nome ou ID
                        if (!avatarToUse && colaboradores && Array.isArray(colaboradores) && colaboradores.length > 0) {
                          const foundColab = colaboradores.find((c: any) => {
                            if (!c) return false;
                            const cNome = normalizeText(c.nome || c.dados?.nome);
                            if (normMsgSender && cNome && (cNome === normMsgSender || cNome.includes(normMsgSender) || normMsgSender.includes(cNome))) {
                              return true;
                            }
                            const cId = String(c.id || c.dados?.id || '').replace(/^f_?/, '');
                            const rId = String(msg.remetente_id || '').replace(/^f_?/, '');
                            return Boolean(cId && rId && cId === rId);
                          });

                          if (foundColab) {
                            avatarToUse = foundColab.foto || foundColab.fotoUrl || foundColab.foto_url || foundColab.dados?.foto || foundColab.dados?.avatarUrl || foundColab.dados?.fotoUrl;
                            avatarUserId = foundColab.id || foundColab.dados?.id;
                          }
                        }

                        // 3. Se remetente_nome bater estritamente com o usuário logado atual, usa a foto dele
                        if (!avatarToUse && normMsgSender && normCurrentUser && (normMsgSender === normCurrentUser || normCurrentUser.includes(normMsgSender))) {
                          avatarToUse = currentUserAvatar;
                          avatarUserId = currentUserSlug;
                        }

                        // 4. Fallback padrão para a foto do autor do comunicado (pois foi enviado no contexto institucional deste comunicado)
                        if (!avatarToUse) {
                          avatarToUse = comunicado.autorFoto || comunicado.dados?.autorFoto || currentUserAvatar;
                          avatarUserId = comunicado.autorId || comunicado.dados?.autorId || currentUserSlug;
                        }
                      }
                      
                      const msgDate = new Date(msg.created_at);
                      const msgTimeStr = msgDate.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) + ' às ' + msgDate.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});

                      const reactionsList: any[] = Array.isArray(msg.reacoes) ? msg.reacoes : [];
                      const groupedReactions = reactionsList.reduce((acc: Record<string, { count: number; users: string[]; hasReacted: boolean }>, r: any) => {
                        if (!r?.emoji) return acc;
                        if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], hasReacted: false };
                        acc[r.emoji].count += 1;
                        acc[r.emoji].users.push(r.user_name || 'Usuário');
                        if (String(r.user_id) === String(currentUserSlug)) acc[r.emoji].hasReacted = true;
                        return acc;
                      }, {});
                      const reactionEntries = Object.entries(groupedReactions);
                      
                      return (
                        <div key={`${msg.id}-${idx}`} style={{ display: 'flex', gap: 12 }}>
                          <UserAvatar
                            userId={avatarUserId || msg.remetente_id}
                            name={msg.is_admin ? msg.remetente_nome : (alunoObj?.nome || msg.remetente_nome)}
                            fotoUrl={avatarToUse}
                            size={36}
                          />
                          <div>
                            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                                {msg.is_admin ? msg.remetente_nome : (isFromResponsavel && alunoObj ? alunoObj.nome : msg.remetente_nome)}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                {isFromResponsavel && (
                                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                                    Enviado por: <span style={{ fontWeight: 600, color: '#475569' }}>{msg.remetente_nome}</span> &bull;
                                  </span>
                                )}
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{msgTimeStr}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '100%' }}>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                                {/* Floating Reaction Bar (WhatsApp style) */}
                                {activeReactionMsgId === msg.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      position: 'absolute',
                                      bottom: 'calc(100% + 6px)',
                                      left: 0,
                                      background: '#ffffff',
                                      borderRadius: 9999,
                                      boxShadow: '0 4px 20px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
                                      border: '1px solid #e2e8f0',
                                      padding: '4px 6px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 2,
                                      zIndex: 60,
                                      animation: 'cvmReactionPop 0.16s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                    }}
                                  >
                                    {['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🎉'].map((emoji) => {
                                      const isSelected = reactionsList.some(r => String(r.user_id) === String(currentUserSlug) && r.emoji === emoji);
                                      return (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleReaction(msg.id, emoji);
                                            setActiveReactionMsgId(null);
                                          }}
                                          style={{
                                            background: isSelected ? '#dcfce7' : 'transparent',
                                            border: isSelected ? '1px solid #86efac' : '1px solid transparent',
                                            borderRadius: '50%',
                                            width: 30,
                                            height: 30,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 18,
                                            cursor: 'pointer',
                                            padding: 0,
                                            transition: 'transform 0.12s ease'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.28)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                          }}
                                        >
                                          {emoji}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Message bubble */}
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

                                {/* Reagir com emoji (WhatsApp Smile trigger) */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id);
                                  }}
                                  title="Reagir com emoji"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: activeReactionMsgId === msg.id ? 1 : 0.6,
                                    color: activeReactionMsgId === msg.id ? '#d97706' : '#64748b',
                                    transition: 'all 0.15s',
                                    marginBottom: 4
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                    e.currentTarget.style.color = '#d97706';
                                    e.currentTarget.style.transform = 'scale(1.15)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = activeReactionMsgId === msg.id ? '1' : '0.6';
                                    e.currentTarget.style.color = activeReactionMsgId === msg.id ? '#d97706' : '#64748b';
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }}
                                >
                                  <Smile size={16} />
                                </button>

                                {/* Excluir mensagem */}
                                {(isMe || isAdminMode) && (
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    disabled={deletingId === msg.id}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, transition: 'opacity 0.2s', marginBottom: 4 }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                                    title="Excluir mensagem"
                                  >
                                    {deletingId === msg.id ? <Loader2 size={14} className="animate-spin" color="#ef4444" /> : <Trash2 size={14} color="#ef4444" />}
                                  </button>
                                )}
                              </div>

                              {/* Pílulas de Reações com Emojis agrupadas */}
                              {reactionEntries.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingLeft: 4 }}>
                                  {reactionEntries.map(([emoji, data]) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleReaction(msg.id, emoji);
                                      }}
                                      title={`${emoji} • ${data.users.join(', ')}`}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '2px 8px',
                                        borderRadius: 9999,
                                        background: data.hasReacted ? '#e0f2fe' : '#ffffff',
                                        border: data.hasReacted ? '1px solid #7dd3fc' : '1px solid #e2e8f0',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.08)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }}
                                    >
                                      <span>{emoji}</span>
                                      {data.count > 1 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: data.hasReacted ? '#0369a1' : '#64748b' }}>
                                          {data.count}
                                        </span>
                                      )}
                                    </button>
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
                  disabled={isSending}
                  onChange={e => setNewMessage(e.target.value)}
                  onFocus={() => {
                    setIsInputFocused(true);
                    setTimeout(() => {
                      scrollToBottom(true);
                    }, 250);
                  }}
                  onBlur={() => setIsInputFocused(false)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!isSending) handleSend()
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
                  border: 'none', 
                  cursor: (isSending || (!newMessage.trim() && pendingAnexos.length === 0)) ? 'not-allowed' : 'pointer',
                  boxShadow: (!newMessage.trim() && pendingAnexos.length === 0) ? 'none' : '0 4px 14px rgba(79,70,229,0.4)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: (!newMessage.trim() && pendingAnexos.length === 0) ? 'scale(1)' : 'scale(1.05)',
                  opacity: isSending ? 0.7 : 1
                }}
              >
                {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} style={{ marginLeft: 2, transform: 'none' }} />}
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

          {/* ACTIONS FOOTER */}
          {(onEdit || onDelete || onForward) && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderTop: '1px solid rgba(226, 232, 240, 0.7)',
              padding: '12px 14px',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
              position: 'sticky',
              bottom: 0,
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              boxShadow: '0 -10px 40px -10px rgba(0,0,0,0.06)'
            }}>
              {onForward && (
                <motion.button 
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={(e: any) => { e.stopPropagation(); onForward(comunicado); }} 
                  style={{ 
                    flex: 1, 
                    minWidth: 0,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 6, 
                    padding: '12px 8px', 
                    borderRadius: 16, 
                    border: '1px solid rgba(99, 102, 241, 0.2)', 
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                    color: '#ffffff', 
                    fontSize: 14, 
                    fontWeight: 700, 
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px -6px rgba(79, 70, 229, 0.5)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                >
                  <Send size={17} style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                  <span>Encaminhar</span>
                </motion.button>
              )}
              {onEdit && (
                <motion.button 
                  whileHover={{ scale: 1.02, y: -1, background: '#f8fafc' }}
                  whileTap={{ scale: 0.96 }}
                  onClick={(e: any) => { e.stopPropagation(); onEdit(comunicado); }} 
                  style={{ 
                    flex: 1, 
                    minWidth: 0,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 6, 
                    padding: '12px 8px', 
                    borderRadius: 16, 
                    border: '1px solid #e2e8f0', 
                    background: '#ffffff', 
                    color: '#475569', 
                    fontSize: 14, 
                    fontWeight: 700, 
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px -4px rgba(0,0,0,0.05)'
                  }}
                >
                  <Edit2 size={17} style={{ flexShrink: 0 }} />
                  <span>Editar</span>
                </motion.button>
              )}
              {onDelete && (
                <motion.button 
                  whileHover={{ scale: 1.02, y: -1, background: '#fef2f2', borderColor: '#fca5a5' }}
                  whileTap={{ scale: 0.96 }}
                  onClick={(e: any) => { e.stopPropagation(); onDelete(comunicado.id); }} 
                  style={{ 
                    flex: 1, 
                    minWidth: 0,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 6, 
                    padding: '12px 8px', 
                    borderRadius: 16, 
                    border: '1px solid rgba(239, 68, 68, 0.25)', 
                    background: 'rgba(239, 68, 68, 0.08)', 
                    color: '#ef4444', 
                    fontSize: 14, 
                    fontWeight: 700, 
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px -4px rgba(239, 68, 68, 0.15)'
                  }}
                >
                  <Trash2 size={17} style={{ flexShrink: 0 }} />
                  <span>Excluir</span>
                </motion.button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>


      <AnimatePresence>
        {showDestinatariosModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 100000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20
            }}
            onClick={() => setShowDestinatariosModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#ffffff',
                borderRadius: 24,
                width: '100%',
                maxWidth: 500,
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6366f1' }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Destinatários
                </h3>
                <button 
                  onClick={() => setShowDestinatariosModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, display: 'flex' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                {destinatariosStr?.split(' | ').map((group: string, i: number) => {
                  const parts = group.split(': ');
                  // Se não tiver label: value, renderiza tudo na mesma tag
                  if (parts.length < 2) {
                    return (
                      <div key={i} style={{ marginBottom: i === destinatariosStr.split(' | ').length - 1 ? 0 : 20 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 16, fontSize: 13 }}>
                            {group}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  
                  const label = parts[0];
                  const rest = parts.slice(1).join(': ');
                  const items = rest.split(', ');
                  return (
                    <div key={i} style={{ marginBottom: i === destinatariosStr.split(' | ').length - 1 ? 0 : 20 }}>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {items.length > 0 && items[0] !== '' ? items.map((item, j) => (
                          <span key={j} style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 16, fontSize: 13 }}>
                            {item}
                          </span>
                        )) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Nenhum</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
                <button
                  onClick={() => setShowDestinatariosModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 12,
                    background: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  )
}
