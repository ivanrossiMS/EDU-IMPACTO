'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Paperclip, FileText, CheckCircle2, ShieldAlert, Calendar, Mic, Send, Share, Bookmark, MoreHorizontal, Edit2, Trash2, Loader2, CreditCard, Info, ExternalLink, Vote, Smile, MessageSquare, ChevronRight, Users, Maximize2, Printer, Search, RefreshCw, Copy, Check, Phone, MessageCircle, UserCheck, RotateCcw, Clock, FileSpreadsheet, DollarSign, ShieldCheck } from 'lucide-react'
import * as XLSX from 'xlsx'
import Image from 'next/image'
import Portal from '@/components/Portal'
import { UserAvatar } from '@/components/UserAvatar'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { getCachedStudentPhoto, setCachedStudentPhoto, fetchStudentPhotos } from '@/lib/studentPhotoCache'
import { getGlobalCachedMessages, setGlobalCachedMessages } from '@/lib/comunicadosRespostasCache'
import { EnqueteWidget } from '@/components/agenda/enquetes/EnqueteWidget'
import { AutorizacaoWidget } from '@/components/agenda/autorizacoes/AutorizacaoWidget'
import { triggerHaptic } from '@/lib/utils/haptics'
import { ImagePinchZoomModal } from '@/components/agenda/ImagePinchZoomModal'
import { apiFetch } from '@/lib/api/apiClient'

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

function formatShortName(fullName: string) {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 2) return fullName
  const first = parts[0]
  const last = parts[parts.length - 1]
  const middles = parts.slice(1, -1).map(p => {
    const lower = p.toLowerCase()
    if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(lower)) return ''
    return p.length > 2 ? p[0].toUpperCase() + '.' : p
  }).filter(Boolean)
  const assembled = [first, ...middles, last].join(' ')
  if (assembled.length > 22 && parts.length > 1) {
    return `${first} ${last}`
  }
  return assembled
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
  autor_foto?: string | null
  autor_id?: string | null
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
  onEditReportPayload?: (anexo: string) => void
  alunos?: any[]
  colaboradores?: any[]
  turmas?: any[]
  onEdit?: (comunicado: any) => void
  onDelete?: (id: string) => void
  onForward?: (comunicado: any) => void
  initialFocusComments?: boolean
  isAlunoView?: boolean
  currentUserObj?: any
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
  onEditReportPayload,
  alunos = [],
  colaboradores = [],
  turmas = [],
  onEdit,
  onDelete,
  onForward,
  initialFocusComments = false,
  isAlunoView = false,
  currentUserObj
}: ComunicadoViewModalProps) {
  const [comunicado, setComunicado] = useState<any>(initialComunicado)
  const [isLoadingFull, setIsLoadingFull] = useState(!initialComunicado.conteudo && !initialComunicado.texto)
  const [internalMaximizedImage, setInternalMaximizedImage] = useState<string | null>(null)

  const effectiveIsAlunoView = useMemo(() => {
    if (isAdminMode || isStaff) return false
    if (isAlunoView) return true
    if (typeof window !== 'undefined') {
      try {
        const sp = new URLSearchParams(window.location.search)
        if (sp.get('espelhar_aluno') === 'true') return true
      } catch (_) {}
    }
    if (
      currentUserObj?.cargo === 'Aluno' ||
      currentUserObj?.perfil === 'Aluno' ||
      currentUserObj?.userType === 'aluno' ||
      (currentUserObj?.aluno_id && currentUserObj?.cargo !== 'Responsável' && currentUserObj?.perfil !== 'Responsável' && currentUserObj?.perfil !== 'Família' && !currentUserObj?.responsavel_id)
    ) {
      return true
    }
    return false
  }, [isAdminMode, isStaff, isAlunoView, currentUserObj])
  
  useEffect(() => {
    if (initialComunicado) {
      setComunicado((prev: any) => {
        const next = { ...initialComunicado }
        if (initialComunicado.dados?.autorizacao) {
          next.autorizacao = initialComunicado.dados.autorizacao
        }
        if (initialComunicado.dados?.enquete) {
          next.enquete = initialComunicado.dados.enquete
        }
        const prevAutTime = prev?.autorizacao?.atualizadoEm ? new Date(prev.autorizacao.atualizadoEm).getTime() : 0
        const nextAutTime = next?.autorizacao?.atualizadoEm ? new Date(next.autorizacao.atualizadoEm).getTime() : 0
        if (prev?.id === next?.id && prev?.autorizacao && prevAutTime > nextAutTime) {
          next.autorizacao = prev.autorizacao
          next.dados = { ...(next.dados || {}), autorizacao: prev.autorizacao }
        }
        const prevEnqTime = prev?.enquete?.atualizadoEm ? new Date(prev.enquete.atualizadoEm).getTime() : 0
        const nextEnqTime = next?.enquete?.atualizadoEm ? new Date(next.enquete.atualizadoEm).getTime() : 0
        if (prev?.id === next?.id && prev?.enquete && prevEnqTime > nextEnqTime) {
          next.enquete = prev.enquete
          next.dados = { ...(next.dados || {}), enquete: prev.enquete }
        }
        return next
      })
    }
  }, [initialComunicado])
  
  const initialCobs = Array.isArray(comunicado?.cobrancas || comunicado?.dados?.cobrancas)
    ? (comunicado?.cobrancas || comunicado?.dados?.cobrancas)
    : (comunicado?.cobranca || comunicado?.dados?.cobranca ? [comunicado.cobranca || comunicado.dados.cobranca] : []);
  const [cobrancasList, setCobrancasList] = useState<any[]>(initialCobs)
  const [cobrancasAlunosDir, setCobrancasAlunosDir] = useState<Record<string, any>>({})
  const [generatingPaymentIds, setGeneratingPaymentIds] = useState<Record<string, boolean>>({})
  const [paymentLinksMap, setPaymentLinksMap] = useState<Record<string, string>>({})
  const [selectedCobrancaModalId, setSelectedCobrancaModalId] = useState<string | null>(null)
  const [cobModalFilter, setCobModalFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL')
  const [cobModalSearch, setCobModalSearch] = useState<string>('')
  const [cobModalTurmaFilter, setCobModalTurmaFilter] = useState<string>('ALL')
  const [cobActionLoading, setCobActionLoading] = useState<Record<string, boolean>>({})
  const [cobSyncingId, setCobSyncingId] = useState<string | null>(null)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
  const [studentPhotosMap, setStudentPhotosMap] = useState<Record<string, string | null>>({});

  const fetchCobrancas = useCallback(async () => {
    if (!comunicado?.id) return;

    // Em modo Admin ou Colaborador, utiliza a API enriquecida (que também faz auto-sync de destinatários)
    if (isAdminMode || isStaff) {
      try {
        const res = await apiFetch(`/api/cobrancas?comunicado_id=${encodeURIComponent(String(comunicado.id))}`);
        if (res.ok) {
          const json = await res.json();
          if (json.alunosDirectory) {
            setCobrancasAlunosDir(prev => ({ ...prev, ...json.alunosDirectory }));
          }
          if (Array.isArray(json.cobrancas) && json.cobrancas.length > 0) {
            setCobrancasList(json.cobrancas);
            const allDestIds = new Set<string>();
            json.cobrancas.forEach((c: any) => {
              (c.agenda_cobrancas_destinatarios || []).forEach((d: any) => {
                if (d?.destinatario_id) {
                  allDestIds.add(String(d.destinatario_id).replace(/^(a_|_ALU)/, ''));
                }
              });
            });
            if (allDestIds.size > 0) {
              fetchStudentPhotos(Array.from(allDestIds)).then(photos => {
                setStudentPhotosMap(prev => ({ ...prev, ...photos }));
              }).catch(() => {});
            }
            return;
          }
        }
      } catch (_) {}
    }

    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('agenda_cobrancas')
        .select('*, agenda_cobrancas_destinatarios(*)')
        .eq('comunicado_id', String(comunicado.id))
        .order('created_at', { ascending: true });

      let finalCobs: any[] | null = data;
      if (!finalCobs || finalCobs.length === 0) {
        const { data: rawCobs } = await supabase
          .from('agenda_cobrancas')
          .select('*')
          .eq('comunicado_id', String(comunicado.id))
          .order('created_at', { ascending: true });
        if (rawCobs && rawCobs.length > 0) {
          const cobIds = rawCobs.map((c: any) => c.id);
          const { data: rawDests } = await supabase
            .from('agenda_cobrancas_destinatarios')
            .select('*')
            .in('cobranca_id', cobIds);
          finalCobs = rawCobs.map((c: any) => ({
            ...c,
            agenda_cobrancas_destinatarios: (rawDests || []).filter((d: any) => String(d.cobranca_id) === String(c.id))
          }));
        }
      }

      if (finalCobs && finalCobs.length > 0) {
        setCobrancasList(finalCobs);

        if (currentUserSlug && !isAdminMode) {
          const cleanSlug = currentUserSlug.replace(/^(a_|_ALU)/, '');
          const newLinks: Record<string, string> = {};
          finalCobs.forEach((cob: any) => {
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
    } catch (_) {}
  }, [comunicado?.id, currentUserSlug, isAdminMode, isStaff]);

  useEffect(() => {
    if (comunicado?.id) {
      fetchCobrancas();
      const handleVisibilityOrFocus = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchCobrancas();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
      window.addEventListener('focus', handleVisibilityOrFocus);
      // Poll every 15 seconds while visible to catch webhook updates
      const cobInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchCobrancas();
        }
      }, 15000);

      let realtimeChannel: any = null;
      let isMounted = true;
      import('@/lib/supabase').then(({ supabase }) => {
        if (!isMounted) return;
        realtimeChannel = supabase
          .channel(`cvm_cobrancas_${comunicado.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'agenda_cobrancas_destinatarios' },
            () => { fetchCobrancas(); }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'agenda_cobrancas', filter: `comunicado_id=eq.${String(comunicado.id)}` },
            () => { fetchCobrancas(); }
          )
          .subscribe();
      }).catch(() => {});

      return () => {
        isMounted = false;
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        clearInterval(cobInterval);
        if (realtimeChannel) {
          import('@/lib/supabase').then(({ supabase }) => {
            supabase.removeChannel(realtimeChannel);
          }).catch(() => {});
        }
      };
    }
  }, [comunicado?.id, fetchCobrancas])

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
  const isInternalStaffComunicado = comunicado.destino === 'interno' || comunicado.destino === 'funcionarios' || comunicado.dados?.destino === 'interno' || comunicado.dados?.destino === 'funcionarios';
  const canParticipantReply = !isStaff || isInternalStaffComunicado;
  const canReply = Boolean(
    isAdminMode ||
    (canParticipantReply && (comunicado.permiteResposta || isGroupedReport || comunicado.isSaudacao || comunicado.dados?.isSaudacao || comunicado.titulo === 'Mensagem de Boas-vindas' || comunicado.titulo === 'Mensagem de Saudação'))
  );

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
  const commentsSectionRef = useRef<HTMLDivElement>(null)
  const hasAutoFocusedCommentsRef = useRef(false)
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
        let senderName = alunoObj?.nome;
        let senderFoto = alunoObj?.foto || alunoObj?.fotoUrl || alunoObj?.foto_url || studentPhotosMap[threadId] || studentPhotosMap[alunoObj?.id] || getCachedStudentPhoto(alunoObj?.id || threadId);

        if (!senderName && colaboradores && colaboradores.length > 0) {
          const colabFound = colaboradores.find((c: any) => {
            if (!c) return false;
            const cId = String(c.id || '').replace(/^f_?/, '');
            const tId = String(threadId).replace(/^f_?/, '');
            if (cId && tId && cId === tId) return true;
            const cNome = (c.nome || '').trim().toLowerCase();
            const mNome = (msg.remetente_nome || '').trim().toLowerCase();
            return Boolean(cNome && mNome && (cNome === mNome || cNome.includes(mNome) || mNome.includes(cNome)));
          });
          if (colabFound) {
            senderName = colabFound.nome;
            if (colabFound.foto || colabFound.fotoUrl) {
              senderFoto = colabFound.foto || colabFound.fotoUrl;
            }
          }
        }

        if (!senderName) {
          senderName = (!msg.is_admin ? msg.remetente_nome : 'Usuário') || 'Participante';
        }

        threadsMap.set(key, {
          studentId: alunoObj?.id || threadId,
          studentName: senderName,
          studentFoto: senderFoto,
          messages: [],
          lastMessageAt: msg.created_at
        })
      }
      
      const thread = threadsMap.get(key)!
      thread.messages.push(msg)
      if (new Date(msg.created_at) > new Date(thread.lastMessageAt)) {
        thread.lastMessageAt = msg.created_at
      }
      
      // Se não achou alunoObj no map, mas a mensagem é do participante não-admin, atualiza o nome
      if (!msg.is_admin && msg.remetente_nome && !alunoObj) {
        thread.studentName = msg.remetente_nome
      }
    })
    
    // Filter out threads that don't have any message from a participant
    const validThreads = Array.from(threadsMap.values()).filter(t => 
      t.messages.some(m => !m.is_admin)
    )
    const result = validThreads.length > 0 ? validThreads : Array.from(threadsMap.values());
    
    return result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
  }, [messages, isAdminMode, alunos, colaboradores, studentPhotosMap])
  
  const messagesToShow = isAdminMode ? (selectedThreadId ? adminThreads.find(t => t.studentId === selectedThreadId)?.messages || [] : []) : messages;

  useEffect(() => {
    if (!initialFocusComments || hasAutoFocusedCommentsRef.current) return;
    if (isAdminMode && adminThreads.length > 0) {
      hasAutoFocusedCommentsRef.current = true;
      if (adminThreads.length === 1 && !selectedThreadId) {
        setSelectedThreadId(adminThreads[0].studentId);
      }
      setTimeout(() => {
        commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } else if (!isAdminMode && messages.length > 0) {
      hasAutoFocusedCommentsRef.current = true;
      setTimeout(() => {
        commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }, [initialFocusComments, isAdminMode, adminThreads, selectedThreadId, messages.length]);

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
          const gDate = new Date(comunicado.created_at || comunicado.dataEnvio || 0).getTime();
          url = `/api/comunicados_respostas?comunicado_id=${encodeURIComponent(comunicado.id)}&grouped_autor_id=${encodeURIComponent(autorId)}&grouped_time=${gDate}&admin=true${espelharParam}`;
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
          setMessages(prev => (unique.length === 0 && prev.length > 0 && isGroupedReport) ? prev : unique);
          if (isAdminMode && unique.length > 0) {
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
      const handleVisibility = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchMessages(true)
        }
      }
      document.addEventListener('visibilitychange', handleVisibility)
      // Contingência leve enquanto a janela estiver em primeiro plano (respostas chegam instantaneamente via Realtime 'agenda-digital:conversas-updated')
      const interval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchMessages(true)
        }
      }, 30000)
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility)
        clearInterval(interval)
      }
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
        is_admin: isAdminMode,
        autor_foto: currentUserAvatar || undefined,
        autor_id: currentUserSlug || undefined
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
    if ((!dest?.id && !dest?.destinatario_id) || !cob?.id) return;
    setGeneratingPaymentIds(prev => ({ ...prev, [cob.id]: true }));
    try {
      const res = await apiFetch('/api/cobrancas/mercadopago-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobranca_destinatario_id: dest.id,
          cobranca_id: cob.id,
          destinatario_id: dest.destinatario_id
        })
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.invoiceUrl) {
        alert('Erro ao gerar cobrança: ' + (data.error || 'Não foi possível gerar o link de pagamento'));
      } else {
        setPaymentLinksMap(prev => ({ ...prev, [cob.id]: data.invoiceUrl }));
        setCobrancasList(prev => prev.map((c: any) => {
          if (String(c.id) !== String(cob.id)) return c;
          return {
            ...c,
            agenda_cobrancas_destinatarios: (c.agenda_cobrancas_destinatarios || []).map((d: any) =>
              d.id === dest.id ? { ...d, url_pagamento: data.invoiceUrl } : d
            )
          };
        }));
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

  // =========================================================================
  // HELPERS DE CONTROLE DE PAGANTES E APURAÇÃO DE COBRANÇA (MODO ADMIN)
  // =========================================================================
  const formatCobPercentLabel = (count: number, total: number) => {
    if (total <= 0 || count <= 0) return { num: 0, label: '0%' };
    const raw = (count / total) * 100;
    if (raw > 0 && raw < 1) return { num: Math.max(2, Math.round(raw)), label: '< 1%' };
    if (count >= total) return { num: 100, label: '100%' };
    const rounded = Math.round(raw * 10) / 10;
    const labelStr = Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1).replace('.', ',')}%`;
    return { num: Math.min(99, Math.max(1, Math.round(raw))), label: labelStr };
  };

  const getEffectiveCobDestinatarios = useCallback((cob: any): any[] => {
    const dbDests = Array.isArray(cob?.agenda_cobrancas_destinatarios) ? cob.agenda_cobrancas_destinatarios : [];
    if (dbDests.length > 0) return dbDests;

    // Fallback: se os destinatários ainda não sincronizaram no banco, calcula a partir do comunicado e da lista de alunos
    const targetTurmas: string[] = Array.isArray(comunicado?.turmas) ? comunicado.turmas : (Array.isArray(comunicado?.dados?.turmas) ? comunicado.dados.turmas : []);
    const targetGrupos: string[] = Array.isArray(comunicado?.grupos) ? comunicado.grupos : (Array.isArray(comunicado?.dados?.grupos) ? comunicado.dados.grupos : []);
    const targetAlunos: string[] = Array.isArray(comunicado?.alunosIds) ? comunicado.alunosIds : (Array.isArray(comunicado?.dados?.alunosIds) ? comunicado.dados.alunosIds : []);
    const isTodas = targetTurmas.includes('TODAS');

    if (!Array.isArray(alunos) || alunos.length === 0) return [];
    const matchedIds = new Set<string>();

    alunos.forEach((a: any) => {
      if (a.ativo === false || a?.dados?.ativo === false) return;
      const rawId = String(a.id || '').replace(/^(a_|_ALU)/, '');
      if (!rawId) return;
      const aTurma = String(a.turma || a?.dados?.turma || '');
      const aTurmaId = String(a.turma_id || a?.dados?.turma_id || a?.dados?.turmaId || '');
      const aGrupos: string[] = Array.isArray(a.grupos) ? a.grupos : (Array.isArray(a?.dados?.grupos) ? a.dados.grupos : []);

      let match = false;
      if (isTodas) match = true;
      if (!match && targetAlunos.some(id => String(id).replace(/^(a_|_ALU)/, '') === rawId)) match = true;
      if (!match && targetTurmas.length > 0) {
        if (targetTurmas.some(t => {
          const tNorm = normalizeText(t);
          if (tNorm && (normalizeText(aTurma) === tNorm || normalizeText(aTurmaId) === tNorm)) return true;
          const turmaObj = (turmas || []).find((tm: any) => String(tm.id) === String(t) || normalizeText(tm.nome) === tNorm);
          if (turmaObj) {
            const tmNameNorm = normalizeText(turmaObj.nome);
            if (tmNameNorm && normalizeText(aTurma) === tmNameNorm) return true;
            if (String(turmaObj.id) === aTurmaId || String(turmaObj.id) === aTurma) return true;
          }
          return false;
        })) {
          match = true;
        }
      }
      if (!match && targetGrupos.length > 0 && aGrupos.length > 0) {
        if (targetGrupos.some(g => aGrupos.some(ag => normalizeText(ag) === normalizeText(g)))) {
          match = true;
        }
      }
      if (match) matchedIds.add(rawId);
    });

    return Array.from(matchedIds).map(cleanId => ({
      id: `virtual_${cob?.id || 'cob'}_${cleanId}`,
      cobranca_id: cob?.id,
      destinatario_id: cleanId,
      status: 'PENDING',
      _isFallback: true
    }));
  }, [comunicado, alunos, turmas]);

  const resolveCobDestInfo = useCallback((dest: any, cob?: any) => {
    const rawDestId = String(dest?.destinatario_id || dest?.id || '');
    const cleanId = rawDestId.replace(/^(a_|_ALU)/, '');
    const dirEntry = cobrancasAlunosDir[cleanId] || cobrancasAlunosDir[rawDestId] || cobrancasAlunosDir[`a_${cleanId}`] || null;
    const propStudent = (alunos || []).find((a: any) => {
      const aClean = String(a.id || '').replace(/^(a_|_ALU)/, '');
      return aClean === cleanId || String(a.id) === rawDestId;
    }) || null;

    const nome =
      dirEntry?.nome ||
      propStudent?.nome ||
      propStudent?.dados?.nome ||
      dest?.aluno_nome ||
      `Aluno #${cleanId.substring(0, 8)}`;

    // Resolve nome legível da turma
    let rawTurma =
      dirEntry?.turma ||
      propStudent?.turma ||
      propStudent?.dados?.turma ||
      propStudent?.turma_id ||
      propStudent?.dados?.turma_id ||
      '';
    if (rawTurma && Array.isArray(turmas) && turmas.length > 0) {
      const foundT = turmas.find((t: any) => String(t.id) === String(rawTurma) || normalizeText(t.nome) === normalizeText(rawTurma));
      if (foundT?.nome) rawTurma = foundT.nome;
    }
    const turma = rawTurma || 'Sem Turma';

    const matricula =
      dirEntry?.matricula ||
      propStudent?.matricula ||
      propStudent?.dados?.matricula ||
      propStudent?.ra ||
      propStudent?.dados?.ra ||
      '';

    // Extrai dados do responsável (priorizando responsável financeiro)
    let propRespObj: any = null;
    const propResps = Array.isArray(propStudent?.responsaveis)
      ? propStudent.responsaveis
      : (Array.isArray(propStudent?.dados?.responsaveis) ? propStudent.dados.responsaveis : []);
    if (propResps.length > 0) {
      propRespObj = propResps.find((r: any) => r?.isFinanceiro || r?.financeiro || r?.responsavel_financeiro) || propResps.find((r: any) => r?.nome || r?.telefone || r?.celular) || propResps[0];
    }

    let responsavel =
      dirEntry?.responsavel ||
      propRespObj?.nome ||
      propRespObj?.nome_completo ||
      propStudent?.responsavel ||
      propStudent?.dados?.responsavel ||
      propStudent?.dados?.nome_responsavel ||
      propStudent?.dados?.responsavel_financeiro ||
      propStudent?.dados?.mae ||
      propStudent?.dados?.pai ||
      '';

    const parentesco =
      dirEntry?.parentesco ||
      propRespObj?.parentesco ||
      propRespObj?.vinculo ||
      propRespObj?.grau_parentesco ||
      propStudent?.dados?.parentesco ||
      '';

    let cpfResponsavel =
      dirEntry?.cpfResponsavel ||
      propRespObj?.cpf ||
      propRespObj?.documento ||
      propStudent?.cpf_responsavel ||
      propStudent?.dados?.cpf_responsavel ||
      propStudent?.dados?.cpf_financeiro ||
      propStudent?.dados?.cpf_mae ||
      propStudent?.dados?.cpf_pai ||
      '';

    const telefone =
      dirEntry?.telefone ||
      propRespObj?.celular ||
      propRespObj?.telefone ||
      propRespObj?.whatsapp ||
      propStudent?.telefone ||
      propStudent?.celular ||
      propStudent?.dados?.telefone_responsavel ||
      propStudent?.dados?.celular_responsavel ||
      propStudent?.dados?.whatsapp ||
      propStudent?.dados?.telefone ||
      propStudent?.dados?.celular ||
      '';

    const email =
      dirEntry?.email ||
      propRespObj?.email ||
      propStudent?.email_responsavel ||
      propStudent?.dados?.email_responsavel ||
      propStudent?.dados?.email_financeiro ||
      propStudent?.email ||
      propStudent?.dados?.email ||
      '';

    const foto =
      studentPhotosMap[cleanId] ||
      studentPhotosMap[rawDestId] ||
      getCachedStudentPhoto(cleanId) ||
      dirEntry?.foto ||
      propStudent?.foto ||
      propStudent?.avatar ||
      propStudent?.dados?.foto ||
      null;

    // Cruza com respostas da Autorização Digital (caso o comunicado tenha autorização acoplada)
    const autRespostas = comunicado?.autorizacao?.respostas || comunicado?.dados?.autorizacao?.respostas || {};
    const autResp = autRespostas[cleanId] || autRespostas[`a_${cleanId}`] || autRespostas[`_ALU${cleanId}`] || autRespostas[rawDestId] || null;
    if (!responsavel && autResp?.responsavel_nome) {
      responsavel = autResp.responsavel_nome;
    }
    if (!cpfResponsavel && autResp?.responsavel_cpf) {
      cpfResponsavel = autResp.responsavel_cpf;
    }

    const statusStr = String(dest?.status || 'PENDING').toUpperCase();
    const isPaid = statusStr === 'CONFIRMED' || statusStr === 'RECEIVED' || statusStr === 'PAID' || statusStr === 'PAGO';
    const pagadorNome = dest?.pagador_nome || (isPaid ? (responsavel || 'Confirmado') : '');
    const paidAt = dest?.paid_at || null;
    const createdAt = dest?.created_at || cob?.created_at || null;
    const asaasId = String(dest?.asaas_payment_id || '');
    const origemPagamento = asaasId.startsWith('MP_')
      ? 'Mercado Pago'
      : asaasId
      ? 'Asaas / Online'
      : isPaid
      ? 'Baixa Manual (Secretaria)'
      : '';
    const transactionId = asaasId ? asaasId.replace(/^MP_/, '') : '';
    const urlPagamento = dest?.url_pagamento || '';

    return {
      cleanId,
      rawDestId,
      nome,
      turma,
      matricula,
      responsavel,
      parentesco,
      cpfResponsavel,
      telefone,
      email,
      foto,
      statusStr,
      isPaid,
      pagadorNome,
      paidAt,
      createdAt,
      origemPagamento,
      transactionId,
      urlPagamento,
      autResp
    };
  }, [cobrancasAlunosDir, alunos, turmas, studentPhotosMap, comunicado]);

  const handleSyncCobDestinatarios = async (cobrancaId: string) => {
    if (!cobrancaId) return null;
    setCobSyncingId(cobrancaId);
    try {
      const res = await apiFetch('/api/cobrancas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_destinatarios', cobranca_id: cobrancaId })
      });
      const json = await res.json();
      if (res.ok) {
        if (Array.isArray(json.destinatarios)) {
          setCobrancasList(prev => prev.map((c: any) =>
            String(c.id) === String(cobrancaId)
              ? { ...c, agenda_cobrancas_destinatarios: json.destinatarios }
              : c
          ));
        }
        await fetchCobrancas();
        return json.destinatarios || null;
      } else {
        alert('Erro ao sincronizar destinatários: ' + (json.error || 'Falha desconhecida'));
      }
    } catch (e: any) {
      alert('Erro ao sincronizar: ' + e.message);
    } finally {
      setCobSyncingId(null);
    }
    return null;
  };

  const handleToggleCobDestPaid = async (cob: any, dest: any) => {
    if (!cob?.id) return;
    const key = String(dest?.id || dest?.destinatario_id);
    setCobActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      let targetRowId = dest?.id;
      if (!targetRowId || String(targetRowId).startsWith('virtual_') || dest?._isFallback) {
        const syncedDests = await handleSyncCobDestinatarios(String(cob.id));
        const cleanTarget = String(dest?.destinatario_id || '').replace(/^(a_|_ALU)/, '');
        const found = (syncedDests || []).find((d: any) => String(d.destinatario_id).replace(/^(a_|_ALU)/, '') === cleanTarget);
        if (found?.id) {
          targetRowId = found.id;
        }
      }

      if (!targetRowId || String(targetRowId).startsWith('virtual_')) {
        alert('Não foi possível localizar o registro do destinatário. Tente clicar em Sincronizar Alunos.');
        return;
      }

      const res = await apiFetch('/api/cobrancas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_destinatario_status',
          destinatario_row_id: targetRowId
        })
      });
      const json = await res.json();
      if (!res.ok) {
        alert('Erro ao atualizar status do pagamento: ' + (json.error || 'Tente novamente'));
        return;
      }

      setCobrancasList(prev => prev.map((c: any) => {
        if (String(c.id) !== String(cob.id)) return c;
        return {
          ...c,
          agenda_cobrancas_destinatarios: (c.agenda_cobrancas_destinatarios || []).map((d: any) => {
            if (String(d.id) !== String(targetRowId)) return d;
            return {
              ...d,
              status: json.status,
              paid_at: json.status === 'PAID' ? new Date().toISOString() : null,
              pagador_nome: json.status === 'PAID' ? (d.pagador_nome || 'Baixa Manual (Secretaria)') : null
            };
          })
        };
      }));
    } catch (e: any) {
      alert('Erro ao alterar status: ' + e.message);
    } finally {
      setCobActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleOpenOrCopyCobPaymentLink = async (cob: any, dest: any, mode: 'open' | 'copy' = 'open') => {
    if (!cob?.id) return;
    const key = `link_${dest?.id || dest?.destinatario_id}`;
    const existingUrl = dest?.url_pagamento;

    if (existingUrl) {
      if (mode === 'copy') {
        try {
          await navigator.clipboard.writeText(existingUrl);
          setCopiedLinkId(String(dest.id || dest.destinatario_id));
          setTimeout(() => setCopiedLinkId(null), 2200);
        } catch (_) {
          prompt('Copie o link da fatura abaixo:', existingUrl);
        }
      } else {
        window.open(existingUrl, '_blank');
      }
      return;
    }

    setCobActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      let targetRowId = dest?.id;
      if (!targetRowId || String(targetRowId).startsWith('virtual_') || dest?._isFallback) {
        const syncedDests = await handleSyncCobDestinatarios(String(cob.id));
        const cleanTarget = String(dest?.destinatario_id || '').replace(/^(a_|_ALU)/, '');
        const found = (syncedDests || []).find((d: any) => String(d.destinatario_id).replace(/^(a_|_ALU)/, '') === cleanTarget);
        if (found?.id) targetRowId = found.id;
      }

      const res = await apiFetch('/api/cobrancas/mercadopago-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobranca_destinatario_id: targetRowId && !String(targetRowId).startsWith('virtual_') ? targetRowId : undefined,
          cobranca_id: cob.id,
          destinatario_id: dest.destinatario_id,
          from_admin: true
        })
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.invoiceUrl) {
        alert('Não foi possível gerar a fatura: ' + (data.error || 'Verifique a configuração do Mercado Pago'));
        return;
      }

      setCobrancasList(prev => prev.map((c: any) => {
        if (String(c.id) !== String(cob.id)) return c;
        return {
          ...c,
          agenda_cobrancas_destinatarios: (c.agenda_cobrancas_destinatarios || []).map((d: any) =>
            (String(d.id) === String(targetRowId) || String(d.destinatario_id).replace(/^(a_|_ALU)/, '') === String(dest.destinatario_id).replace(/^(a_|_ALU)/, ''))
              ? { ...d, url_pagamento: data.invoiceUrl }
              : d
          )
        };
      }));

      if (mode === 'copy') {
        try {
          await navigator.clipboard.writeText(data.invoiceUrl);
          setCopiedLinkId(String(dest.id || dest.destinatario_id));
          setTimeout(() => setCopiedLinkId(null), 2200);
        } catch (_) {
          prompt('Copie o link da fatura abaixo:', data.invoiceUrl);
        }
      } else {
        window.open(data.invoiceUrl, '_blank');
      }
    } catch (e: any) {
      alert('Erro ao obter fatura: ' + e.message);
    } finally {
      setCobActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleWhatsAppCobReminder = (cob: any, dest: any, info: ReturnType<typeof resolveCobDestInfo>) => {
    let rawDigits = String(info.telefone || '').replace(/\D/g, '');
    if (!rawDigits) {
      const manual = prompt(`Nenhum telefone cadastrado para ${info.nome}.\nDigite o WhatsApp com DDD (ex: 11999999999) para enviar a mensagem:`);
      if (!manual) return;
      rawDigits = manual.replace(/\D/g, '');
    }
    if (!rawDigits) return;
    const phoneDigits = (rawDigits.length === 10 || rawDigits.length === 11) ? `55${rawDigits}` : rawDigits;
    const valorFmt = Number(cob.valor || 0).toFixed(2).replace('.', ',');
    const vencFmt = cob.vencimento ? new Date(cob.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem vencimento';
    const saudacao = info.responsavel ? `Olá, *${info.responsavel}*!` : `Olá, família de *${info.nome}*!`;

    let msg = '';
    if (info.isPaid) {
      msg = `${saudacao}\n\nConfirmamos o recebimento do pagamento referente a *${cob.titulo}* do(a) aluno(a) *${info.nome}* (${info.turma}) no valor de *R$ ${valorFmt}*.\n\nAgradecemos pela confirmação!`;
    } else {
      msg = `${saudacao}\n\nLembramos sobre a cobrança referente a *${cob.titulo}* do(a) aluno(a) *${info.nome}* (${info.turma}).\n💰 *Valor:* R$ ${valorFmt}\n📅 *Vencimento:* ${vencFmt}${info.urlPagamento ? `\n\n🔗 *Link para pagamento:* ${info.urlPagamento}` : '\n\nO pagamento também pode ser realizado diretamente pelo aplicativo da Agenda Digital.'}\n\nQualquer dúvida, estamos à disposição!`;
    }
    window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleExportCobXlsx = (cob: any, resolvedRows: Array<{ dest: any; info: ReturnType<typeof resolveCobDestInfo> }>) => {
    if (!cob || resolvedRows.length === 0) {
      alert('Não há registros para exportar.');
      return;
    }
    const valorUnit = Number(cob.valor || 0);
    const vencFmt = cob.vencimento ? new Date(cob.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';

    const wsData = resolvedRows.map(({ info }) => ({
      'Aluno': info.nome,
      'Turma': info.turma,
      'Matrícula': info.matricula || '-',
      'Status Pagamento': info.isPaid ? 'PAGO' : 'PENDENTE',
      'Pagador Confirmado': info.isPaid ? (info.pagadorNome || info.responsavel || 'Confirmado') : '-',
      'Responsável Financeiro': info.responsavel || '-',
      'Parentesco': info.parentesco || '-',
      'CPF Responsável': info.cpfResponsavel || '-',
      'Telefone / WhatsApp': info.telefone || '-',
      'E-mail': info.email || '-',
      'Valor (R$)': valorUnit,
      'Vencimento': vencFmt,
      'Data Confirmação': info.paidAt ? new Date(info.paidAt).toLocaleString('pt-BR') : '-',
      'Origem / Meio': info.origemPagamento || '-',
      'ID Transação': info.transactionId || '-',
      'Status Autorização': info.autResp ? (info.autResp.status === 'AUTHORIZED' ? 'Autorizado' : 'Não Autorizado') : '-',
      'Link Fatura': info.urlPagamento || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagantes e Destinatários');
    const safeTitle = String(cob.titulo || 'cobranca').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 35);
    XLSX.writeFile(wb, `pagantes_${safeTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrintCobPayers = (cob: any, filterToPrint: 'ALL' | 'PAID' | 'PENDING' = 'ALL') => {
    if (!cob) return;
    const rawDests = getEffectiveCobDestinatarios(cob);
    const allResolved = rawDests
      .map((dest: any) => ({ dest, info: resolveCobDestInfo(dest, cob) }))
      .sort((a, b) => a.info.nome.localeCompare(b.info.nome, 'pt-BR'));

    const totalEnviados = allResolved.length;
    const totalPagos = allResolved.filter(r => r.info.isPaid).length;
    const totalPendentes = totalEnviados - totalPagos;
    const pct = formatCobPercentLabel(totalPagos, totalEnviados);
    const valorUnit = Number(cob.valor || 0);
    const totalRecebido = totalPagos * valorUnit;
    const totalEsperado = totalEnviados * valorUnit;
    const vencFmt = cob.vencimento ? new Date(cob.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem vencimento';

    const rowsToPrint = allResolved.filter(r => {
      if (filterToPrint === 'PAID') return r.info.isPaid;
      if (filterToPrint === 'PENDING') return !r.info.isPaid;
      return true;
    });

    const filterLabel =
      filterToPrint === 'PAID'
        ? `SOMENTE PAGANTES CONFIRMADOS (${rowsToPrint.length})`
        : filterToPrint === 'PENDING'
        ? `SOMENTE PENDENTES (${rowsToPrint.length})`
        : `LISTA COMPLETA (${rowsToPrint.length})`;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Por favor, permita pop-ups no navegador para imprimir a relação de pagantes.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Relatório de Pagantes - ${cob.titulo || 'Cobrança'}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; font-size: 12px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
          .title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase; }
          .subtitle { font-size: 12px; color: #475569; margin: 2px 0; }
          .kpis { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
          .kpi { flex: 1; min-width: 140px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
          .kpi-paid { background: #f0fdf4; border-color: #86efac; }
          .kpi-pending { background: #fffbeb; border-color: #fde68a; }
          .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
          .kpi-val { font-size: 18px; font-weight: 800; color: #0f172a; }
          .kpi-sub { font-size: 11px; color: #475569; margin-top: 2px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; font-size: 11px; vertical-align: top; }
          th { background: #f1f5f9; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #334155; }
          tr:nth-child(even) { background: #f8fafc; }
          .badge-paid { color: #15803d; font-weight: 800; background: #dcfce7; padding: 2px 6px; border-radius: 4px; display: inline-block; }
          .badge-pending { color: #b45309; font-weight: 800; background: #fef3c7; padding: 2px 6px; border-radius: 4px; display: inline-block; }
          .muted { color: #64748b; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Relatório de Controle de Pagantes — ${cob.titulo || 'Cobrança'}</h1>
            <div class="subtitle"><strong>Comunicado:</strong> ${comunicado?.titulo || 'Comunicado Escolar'} • <strong>Filtro:</strong> ${filterLabel}</div>
            <div class="subtitle"><strong>Valor Unitário:</strong> R$ ${valorUnit.toFixed(2).replace('.', ',')} • <strong>Vencimento:</strong> ${vencFmt}</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div>Emitido em: ${new Date().toLocaleString('pt-BR')}</div>
            <div>Por: ${currentUserName || 'Administração'}</div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi">
            <div class="kpi-label">Total Destinatários</div>
            <div class="kpi-val">${totalEnviados}</div>
            <div class="kpi-sub">Previsto: R$ ${totalEsperado.toFixed(2).replace('.', ',')}</div>
          </div>
          <div class="kpi kpi-paid">
            <div class="kpi-label">Pagantes Confirmados</div>
            <div class="kpi-val" style="color: #15803d;">${totalPagos}/${totalEnviados} (${pct.label})</div>
            <div class="kpi-sub" style="color: #166534;">Recebido: R$ ${totalRecebido.toFixed(2).replace('.', ',')}</div>
          </div>
          <div class="kpi kpi-pending">
            <div class="kpi-label">Pendentes</div>
            <div class="kpi-val" style="color: #b45309;">${totalPendentes}</div>
            <div class="kpi-sub" style="color: #92400e;">Em aberto: R$ ${Math.max(0, totalEsperado - totalRecebido).toFixed(2).replace('.', ',')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 28px;">#</th>
              <th>Aluno(a)</th>
              <th>Turma / Matrícula</th>
              <th>Responsável Financeiro / Pagador</th>
              <th>CPF</th>
              <th>Contato (WhatsApp / E-mail)</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Confirmação / Origem</th>
            </tr>
          </thead>
          <tbody>
            ${rowsToPrint.map(({ info }, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${info.nome}</strong></td>
                <td>${info.turma}${info.matricula ? `<div class="muted">Mat: ${info.matricula}</div>` : ''}</td>
                <td>
                  <strong>${info.isPaid ? (info.pagadorNome || info.responsavel || 'Confirmado') : (info.responsavel || '-')}</strong>
                  ${info.parentesco ? `<div class="muted">${info.parentesco}</div>` : ''}
                  ${info.isPaid && info.responsavel && info.pagadorNome && info.pagadorNome !== info.responsavel ? `<div class="muted">Resp: ${info.responsavel}</div>` : ''}
                </td>
                <td>${info.cpfResponsavel || '-'}</td>
                <td>
                  ${info.telefone || '-'}
                  ${info.email ? `<div class="muted">${info.email}</div>` : ''}
                </td>
                <td><strong>R$ ${valorUnit.toFixed(2).replace('.', ',')}</strong></td>
                <td>
                  <span class="${info.isPaid ? 'badge-paid' : 'badge-pending'}">
                    ${info.isPaid ? '✓ PAGO' : '⏳ PENDENTE'}
                  </span>
                </td>
                <td>
                  ${info.paidAt ? `<div><strong>${new Date(info.paidAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></div>` : '-'}
                  ${info.origemPagamento ? `<div class="muted">${info.origemPagamento}${info.transactionId ? ` (#${info.transactionId.substring(0, 12)})` : ''}</div>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 250);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  const dateObj = new Date(comunicado.dataEnvio || comunicado.created_at || new Date())
  const formattedDate = dateObj.toLocaleDateString('pt-BR')
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
            .cvm-header {
              padding: 18px 20px !important;
              padding-top: max(54px, calc(env(safe-area-inset-top, 0px) + 18px)) !important;
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
          progress.cvm-cob-progress {
            appearance: none;
            -webkit-appearance: none;
            width: 100%;
            height: 12px;
            background-color: #e2e8f0;
            border: 0 solid;
            border-radius: 999px;
            overflow: clip;
            display: block;
          }
          progress.cvm-cob-progress::-webkit-progress-bar {
            background-color: #e2e8f0;
            border-radius: 999px;
          }
          progress.cvm-cob-progress::-webkit-progress-value {
            background: linear-gradient(90deg, #10b981 0%, #059669 100%);
            border-radius: 999px;
            transition: inline-size 0.35s ease;
          }
          progress.cvm-cob-progress::-moz-progress-bar {
            background: linear-gradient(90deg, #10b981 0%, #059669 100%);
            border-radius: 999px;
            transition: inline-size 0.35s ease;
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1, position: 'relative', minWidth: 0, flex: 1, marginRight: 12 }}>
              <div className="cvm-avatar-area" style={{ minWidth: 0 }}>
                <UserAvatar userId={comunicado.autorId} name={comunicado.autor} fotoUrl={comunicado.autorFoto} size={58} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span 
                    style={{ 
                      fontWeight: 800, 
                      fontSize: 18, 
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={comunicado.autor}
                  >
                    {formatShortName(comunicado.autor)}
                  </span>
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
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%'
                    }}>
                      {comunicado.autorCargo}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginTop: 2, whiteSpace: 'nowrap' }}>
                    {formattedDate} às {formattedTime}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 1, position: 'relative', flexShrink: 0 }}>
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
            
            {/* Title & Text Content Wrapped in Rounded Card with 3D Borders & Shadow */}
            <div style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: 24,
              padding: 28,
              paddingTop: 32,
              border: '1px solid rgba(226, 232, 240, 0.85)',
              borderBottom: '3px solid rgba(203, 213, 225, 0.85)',
              boxShadow: '0 12px 30px -6px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
              maxWidth: 800,
              width: '100%',
              margin: '14px auto 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}>
              {/* Badge na Linha da Borda (Como Pasta Suspensa) */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 28,
                transform: 'translateY(-50%)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                zIndex: 10
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 14px',
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #4338ca 0%, #4f46e5 50%, #6366f1 100%)',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px -2px rgba(79, 70, 229, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase'
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#38bdf8',
                    boxShadow: '0 0 8px #38bdf8',
                    display: 'inline-block'
                  }} />
                  <span>COMUNICADO OFICIAL</span>
                </div>

                {/* Prioridade ao lado do badge */}
                {(comunicado.prioridade === 'alta' || comunicado.prioridade === 'urgente') && (
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    {comunicado.prioridade === 'alta' && (
                      <span style={{ 
                        background: '#ef4444', 
                        color: '#ffffff', 
                        padding: '4px 10px', 
                        borderRadius: 20, 
                        fontWeight: 800, 
                        fontSize: 10.5, 
                        border: '1px solid rgba(255, 255, 255, 0.35)',
                        boxShadow: '0 4px 10px -2px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                      }}>
                        Prioridade Alta
                      </span>
                    )}
                    {comunicado.prioridade === 'urgente' && (
                      <span style={{ 
                        background: '#f97316', 
                        color: '#ffffff', 
                        padding: '4px 10px', 
                        borderRadius: 20, 
                        fontWeight: 800, 
                        fontSize: 10.5, 
                        border: '1px solid rgba(255, 255, 255, 0.35)',
                        boxShadow: '0 4px 10px -2px rgba(249, 115, 22, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                      }}>
                        Urgente
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Title (Largura total, limpo e imponente) */}
              <h1 style={{ 
                fontSize: 24, 
                fontWeight: 800, 
                color: '#0f172a', 
                margin: 0, 
                lineHeight: 1.3,
                letterSpacing: '-0.02em',
                paddingTop: 2
              }}>
                {comunicado.titulo}
              </h1>

              {/* Text Content */}
              {isLoadingFull ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 size={32} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : (
                <>
                  {(comunicado.conteudo || comunicado.texto) && (() => {
                    const rawHtml = comunicado.conteudo || comunicado.texto || '';
                    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(rawHtml);
                    const formattedHtml = hasHtmlTags ? rawHtml : rawHtml.replace(/\n/g, '<br/>');

                    return (
                      <div 
                        className="comunicado-conteudo-body"
                        style={{ 
                          fontSize: 15, 
                          lineHeight: 1.65, 
                          color: '#334155', 
                          fontWeight: 500, 
                          wordBreak: 'break-word',
                          whiteSpace: hasHtmlTags ? 'normal' : 'pre-wrap'
                        }} 
                        dangerouslySetInnerHTML={{ __html: formattedHtml }} 
                      />
                    );
                  })()}

                  {/* Anexos Integrados Dentro do Card Principal */}
                  {comunicado.anexos && comunicado.anexos.length > 0 && (() => {
                    const validAnexos = comunicado.anexos.filter((anexo: string) => {
                      const parsed = parseAnexo(anexo);
                      if (!parsed) return false;
                      if (parsed.name.startsWith('Enquete:') || parsed.url.startsWith('enquete:') || parsed.mime === 'enquete') return false;
                      if (parsed.name.startsWith('Autorização:') || parsed.url.startsWith('autorizacao:') || parsed.mime === 'autorizacao') return false;
                      if (parsed.name.startsWith('Cobrança:') || parsed.name.startsWith('Cobranca:') || parsed.url.startsWith('cobranca:') || parsed.mime === 'cobranca' || parsed.mime === 'cobrança') return false;
                      return true;
                    });

                    if (validAnexos.length === 0) return null;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', marginTop: (comunicado.conteudo || comunicado.texto) ? 4 : 0 }}>
                        {validAnexos.map((anexo: string, idx: number) => {
                          const parsed = parseAnexo(anexo);
                          if (!parsed) return null;

                          const isForm = parsed.name.startsWith('Formulário: ') && parsed.url.startsWith('form:');
                          const isRel = parsed.name.startsWith('Relatório: ') && parsed.url.startsWith('form:');
                          const isReportTask = parsed.name.startsWith('Tarefa de Relatório:') && parsed.url.startsWith('report-task:');
                          const isReportPayload = parsed.url.startsWith('payload:') || parsed.mime === 'report-payload';
                          const isImg = parsed.url.startsWith('data:image/') || parsed.mime.startsWith('image/') || parsed.name.toLowerCase().endsWith('.png') || parsed.name.toLowerCase().endsWith('.jpg') || parsed.name.toLowerCase().endsWith('.jpeg') || parsed.name.toLowerCase().endsWith('.webp') || parsed.name.toLowerCase().endsWith('.gif');
                          const isVid = parsed.mime.startsWith('video/') || parsed.url.includes('.mov') || parsed.url.includes('.mp4') || parsed.name.toLowerCase().endsWith('.mov') || parsed.name.toLowerCase().endsWith('.mp4');

                          if (isImg || isVid) {
                            return (
                              <div
                                key={idx}
                                style={{
                                  width: '100%',
                                  borderRadius: 18,
                                  overflow: 'hidden',
                                  border: '1px solid rgba(226, 232, 240, 0.95)',
                                  borderBottom: '3px solid rgba(203, 213, 225, 0.95)',
                                  boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.1), 0 4px 10px -2px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                                  cursor: 'pointer',
                                  background: '#ffffff',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                                onClick={() => {
                                  if (isImg) {
                                    if (setMaximizedImageStr) setMaximizedImageStr(parsed.url);
                                    else setInternalMaximizedImage(parsed.url);
                                  }
                                  if (isVid && setMaximizedVideoStr) setMaximizedVideoStr(parsed.url);
                                }}
                                onTouchStart={(e) => {
                                  if (isImg && e.touches.length === 2) {
                                    e.preventDefault();
                                    if (setMaximizedImageStr) setMaximizedImageStr(parsed.url);
                                    else setInternalMaximizedImage(parsed.url);
                                  }
                                }}
                              >
                                <div style={{
                                  width: '100%',
                                  background: '#f8fafc',
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  position: 'relative'
                                }}>
                                  {isImg ? (
                                    <img
                                      src={parsed.url}
                                      alt={parsed.name}
                                      style={{
                                        width: '100%',
                                        height: 'auto',
                                        display: 'block',
                                        maxHeight: 520,
                                        objectFit: 'contain'
                                      }}
                                    />
                                  ) : (
                                    <video
                                      src={parsed.url}
                                      style={{
                                        width: '100%',
                                        maxHeight: 520,
                                        objectFit: 'contain',
                                        display: 'block'
                                      }}
                                      controls
                                      preload="metadata"
                                      onClick={e => e.stopPropagation()}
                                    />
                                  )}
                                </div>

                                {/* Campo inferior com informação pequena de ampliar */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 7,
                                  padding: '9px 16px',
                                  background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                                  borderTop: '1px solid rgba(226, 232, 240, 0.95)',
                                  color: '#475569',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  letterSpacing: '0.02em',
                                  userSelect: 'none'
                                }}>
                                  <div style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 6,
                                    background: '#e0e7ff',
                                    color: '#4f46e5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    <Maximize2 size={13} strokeWidth={2.5} />
                                  </div>
                                  <span>Toque para ampliar</span>
                                </div>
                              </div>
                            );
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

                            return (
                              <div
                                key={idx}
                                style={{
                                  width: '100%',
                                  padding: '14px 16px',
                                  background: '#f8fafc',
                                  borderRadius: 14,
                                  border: '1px solid rgba(226, 232, 240, 0.95)',
                                  borderBottom: '3px solid rgba(203, 213, 225, 0.9)',
                                  boxShadow: '0 6px 16px -2px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 14,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                                onClick={() => {
                                  if (isReportTask && setOpenedReportTask) setOpenedReportTask(anexo);
                                  else if (isReportPayload && setOpenedReportPayload) {
                                    if (finalPhoto && cleanStuId) {
                                      setCachedStudentPhoto(cleanStuId, finalPhoto);
                                    }
                                    setOpenedReportPayload(anexo);
                                  }
                                  else if ((isForm || isRel) && setOpenedFormStr) setOpenedFormStr(anexo);
                                  else handleDownload(parsed);
                                }}
                              >
                                {isReportPayload ? (
                                  <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {finalPhoto ? (
                                      <img
                                        src={finalPhoto}
                                        alt={displayName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                                        {initialLetter}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ width: 44, height: 44, borderRadius: 12, background: isReportTask ? '#ecfdf5' : '#f1f5f9', color: isReportTask ? '#10b981' : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <FileText size={22} />
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                                  <div style={{ fontSize: 12.5, color: '#64748b' }}>
                                    {isForm ? 'Formulário' : isRel ? 'Relatório' : isReportTask ? 'Tarefa de Relatório' : isReportPayload ? 'Relatório Individual do Aluno' : 'Documento anexo'}
                                    {!isForm && !isRel && !isReportTask && !isReportPayload && (
                                      <> • <AttachmentSize url={parsed.url} initialSize={parsed.size} /></>
                                    )}
                                  </div>
                                  {(isAdminMode || isStaff) && cienciaString && (
                                    <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <CheckCircle2 size={13} />
                                      Ciência confirmada em {cienciaString}
                                    </div>
                                  )}
                                </div>
                                {isReportPayload && onEditReportPayload && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (finalPhoto && cleanStuId) {
                                        setCachedStudentPhoto(cleanStuId, finalPhoto);
                                      }
                                      onEditReportPayload(anexo);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '6px 11px',
                                      borderRadius: 10,
                                      border: '1px solid #ddd6fe',
                                      background: '#f5f3ff',
                                      color: '#6d28d9',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                      transition: 'all 0.15s ease'
                                    }}
                                    title="Editar relatório individual deste aluno"
                                  >
                                    <Edit2 size={13} />
                                    <span>Editar</span>
                                  </button>
                                )}
                                <ChevronRight size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
                              </div>
                            );
                          }
                        })}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* ENQUETE INTERATIVA */}
            {(comunicado.dados?.enquete || comunicado.enquete) && (
              <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
                <EnqueteWidget
                  enquete={comunicado.dados?.enquete || comunicado.enquete}
                  comunicadoId={String(comunicado.id)}
                  currentUser={{
                    ...(currentUserObj || {}),
                    id: currentUserObj?.responsavel_id || currentUserObj?.user_metadata?.responsavel_id || currentUserObj?.id || currentUserSlug,
                    nome: currentUserName,
                    foto: currentUserAvatar
                  }}
                  currentAluno={alunos && alunos.length === 1 ? alunos[0] : (!isAdminMode && !isStaff && currentUserSlug ? { id: currentUserSlug } : null)}
                  isAdminMode={isAdminMode || isStaff}
                  onVoteSuccess={(updatedEnquete) => {
                    setComunicado((prev: any) => {
                      const updatedCom = {
                        ...prev,
                        enquete: updatedEnquete,
                        dados: {
                          ...(prev?.dados || {}),
                          enquete: updatedEnquete
                        }
                      }
                      if (typeof window !== 'undefined') {
                        setTimeout(() => {
                          try {
                            window.dispatchEvent(new CustomEvent('ad:comunicados-update', {
                              detail: { item: updatedCom, source: 'enquete-widget' }
                            }))
                          } catch (_) {}
                        }, 0)
                      }
                      return updatedCom
                    })
                  }}
                />
              </div>
            )}

            {/* AUTORIZAÇÃO DIGITAL */}
            {(comunicado.dados?.autorizacao || comunicado.autorizacao) && (
              <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
                <AutorizacaoWidget
                  autorizacao={comunicado.dados?.autorizacao || comunicado.autorizacao}
                  comunicadoId={String(comunicado.id)}
                  currentUser={{
                    ...(currentUserObj || {}),
                    id: currentUserObj?.responsavel_id || currentUserObj?.user_metadata?.responsavel_id || currentUserObj?.id || currentUserSlug,
                    nome: currentUserName,
                    foto: currentUserAvatar
                  }}
                  currentAluno={alunos && alunos.length === 1 ? alunos[0] : (!isAdminMode && !isStaff && currentUserSlug ? { id: currentUserSlug } : null)}
                  turmas={turmas}
                  alunos={alunos}
                  isAdminMode={isAdminMode || isStaff}
                  isAlunoView={effectiveIsAlunoView}
                  onUpdateSuccess={(updatedAut) => {
                    setComunicado((prev: any) => {
                      const updatedCom = {
                        ...prev,
                        autorizacao: updatedAut,
                        dados: {
                          ...(prev?.dados || {}),
                          autorizacao: updatedAut
                        }
                      }
                      if (typeof window !== 'undefined') {
                        setTimeout(() => {
                          try {
                            window.dispatchEvent(new CustomEvent('ad:comunicados-update', {
                              detail: { item: updatedCom, source: 'autorizacao-widget' }
                            }))
                          } catch (_) {}
                        }, 0)
                      }
                      return updatedCom
                    })
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
                        Total Unitário: <span style={{ color: '#065F46', fontWeight: 800, fontSize: 15 }}>R$ {totalAmount.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {relevantCobs.map((cob: any, idx: number) => {
                      const cobDest = (cob.agenda_cobrancas_destinatarios || []).find((d: any) => 
                        String(d.destinatario_id).replace(/^(a_|_ALU)/, '') === cleanSlug
                      );
                      const statusStr = String(cobDest?.status || 'PENDING').toUpperCase();
                      const isPaid = statusStr === 'CONFIRMED' || statusStr === 'RECEIVED' || statusStr === 'PAID' || statusStr === 'PAGO';
                      const vencDate = cob.vencimento
                        ? new Date(String(cob.vencimento).includes('T') ? cob.vencimento : `${cob.vencimento}T23:59:59`)
                        : null;
                      const isOverdue = Boolean(!isPaid && vencDate && !isNaN(vencDate.getTime()) && vencDate < new Date());
                      const curPaymentLink = paymentLinksMap[cob.id] || cobDest?.url_pagamento || '';
                      const isGenerating = !!generatingPaymentIds[cob.id];

                      // =========================================================
                      // VISÃO RESTRITA DO MODO ADMIN / COLABORADOR
                      // =========================================================
                      if (isAdminMode || isStaff) {
                        const effectiveDests = getEffectiveCobDestinatarios(cob);
                        const resolvedList = effectiveDests.map((d: any) => ({
                          dest: d,
                          info: resolveCobDestInfo(d, cob)
                        }));
                        const totalEnviados = resolvedList.length;
                        const paidRows = resolvedList.filter(r => r.info.isPaid);
                        const totalPagos = paidRows.length;
                        const totalAguardando = Math.max(0, totalEnviados - totalPagos);
                        const pctPaid = formatCobPercentLabel(totalPagos, totalEnviados);
                        const pctPending = formatCobPercentLabel(totalAguardando, totalEnviados);
                        const valorUnit = Number(cob.valor || 0);
                        const valorRecebido = totalPagos * valorUnit;
                        const valorTotalEsperado = totalEnviados * valorUnit;
                        const valorPendente = Math.max(0, valorTotalEsperado - valorRecebido);
                        const adminBadgeText = relevantCobs.length > 1 ? `COBRANÇA #${idx + 1} (ADMIN)` : 'COBRANÇA (ADMIN)';
                        const isFullyPaid = totalEnviados > 0 && totalPagos >= totalEnviados;

                        return (
                          <div
                            key={cob.id || idx}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 20,
                              padding: '20px 22px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 16,
                              boxShadow: '0 8px 24px -6px rgba(15, 23, 42, 0.06)'
                            }}
                          >
                            {/* Top Row: Charge Info + Restricted Admin Badge */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: '1 1 260px' }}>
                                <div style={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 14,
                                  background: isFullyPaid ? '#ecfdf5' : '#f1f5f9',
                                  color: isFullyPaid ? '#10b981' : '#475569',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  border: `1px solid ${isFullyPaid ? '#a7f3d0' : '#e2e8f0'}`
                                }}>
                                  {isFullyPaid ? <CheckCircle2 size={24} /> : <CreditCard size={22} />}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: 0.5 }}>{adminBadgeText}</span>
                                    {cob.vencimento && (
                                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                        • Venc: {new Date(cob.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                      </span>
                                    )}
                                    <span style={{
                                      fontSize: 10,
                                      fontWeight: 800,
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      background: isFullyPaid ? '#dcfce7' : isOverdue ? '#fee2e2' : '#fef3c7',
                                      color: isFullyPaid ? '#15803d' : isOverdue ? '#b91c1c' : '#b45309',
                                      textTransform: 'uppercase',
                                      letterSpacing: 0.4
                                    }}>
                                      {isFullyPaid ? 'Quitada' : isOverdue ? 'Vencida' : 'Em Aberto'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{cob.titulo}</div>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>
                                      R$ {valorUnit.toFixed(2).replace('.', ',')}
                                    </span>
                                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                                      por aluno
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                                <div style={{
                                  color: '#475569',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '6px 12px',
                                  background: '#f1f5f9',
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}>
                                  <Info size={13} color="#64748b" />
                                  <span>Visualização restrita do modo Admin</span>
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>
                                  Recebido: <span style={{ color: '#059669', fontWeight: 800 }}>R$ {valorRecebido.toFixed(2).replace('.', ',')}</span>
                                  <span style={{ color: '#94a3b8', margin: '0 4px' }}>/</span>
                                  <span style={{ color: '#64748b' }}>R$ {valorTotalEsperado.toFixed(2).replace('.', ',')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Painel e Barra de Pagantes X/X */}
                            <div style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 14,
                              padding: '14px 16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    PAINEL DE CONTROLE DE PAGANTES
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: totalPagos > 0 ? '#047857' : '#475569',
                                    background: totalPagos > 0 ? '#d1fae5' : '#e2e8f0',
                                    padding: '4px 10px',
                                    borderRadius: 999
                                  }}>
                                    {totalPagos}/{totalEnviados} PAGANTES ({pctPaid.label})
                                  </span>
                                </div>
                              </div>

                              {/* Semantic Progress Bar X/X */}
                              <progress
                                className="cvm-cob-progress"
                                max={Math.max(totalEnviados, 1)}
                                value={totalPagos}
                                aria-label={`Progresso de pagantes: ${totalPagos} de ${totalEnviados} (${pctPaid.label})`}
                              />

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#64748b', fontWeight: 600, flexWrap: 'wrap', gap: 8 }}>
                                <span>
                                  <strong style={{ color: '#0f172a' }}>{totalPagos}</strong> de <strong style={{ color: '#0f172a' }}>{totalEnviados}</strong> pagamentos confirmados
                                </span>
                                <span>
                                  Pendentes: <strong style={{ color: totalAguardando > 0 ? '#d97706' : '#10b981' }}>{totalAguardando}</strong>
                                  {valorPendente > 0 ? ` (R$ ${valorPendente.toFixed(2).replace('.', ',')})` : ''}
                                </span>
                              </div>
                            </div>

                            {/* 3 Interactive KPI Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                              <div
                                onClick={() => {
                                  setSelectedCobrancaModalId(String(cob.id));
                                  setCobModalFilter('ALL');
                                  setCobModalSearch('');
                                  setCobModalTurmaFilter('ALL');
                                }}
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 12,
                                  padding: '12px 14px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                title="Clique para ver todos os destinatários"
                              >
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                                  TOTAL DESTINATÁRIOS
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{totalEnviados}</span>
                                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>alunos</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
                                  Previsto: R$ {valorTotalEsperado.toFixed(2).replace('.', ',')}
                                </div>
                              </div>

                              <div
                                onClick={() => {
                                  setSelectedCobrancaModalId(String(cob.id));
                                  setCobModalFilter('PAID');
                                  setCobModalSearch('');
                                  setCobModalTurmaFilter('ALL');
                                }}
                                style={{
                                  background: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  borderRadius: 12,
                                  padding: '12px 14px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                title="Clique para ver somente os pagantes confirmados"
                              >
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span>PAGANTES CONFIRMADOS</span>
                                  <CheckCircle2 size={12} color="#16a34a" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>
                                    {totalPagos}/{totalEnviados}
                                  </span>
                                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>({pctPaid.label})</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#166534', marginTop: 2, fontWeight: 700 }}>
                                  Recebido: R$ {valorRecebido.toFixed(2).replace('.', ',')}
                                </div>
                              </div>

                              <div
                                onClick={() => {
                                  setSelectedCobrancaModalId(String(cob.id));
                                  setCobModalFilter('PENDING');
                                  setCobModalSearch('');
                                  setCobModalTurmaFilter('ALL');
                                }}
                                style={{
                                  background: '#fffbeb',
                                  border: '1px solid #fde68a',
                                  borderRadius: 12,
                                  padding: '12px 14px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                title="Clique para ver os alunos com pagamento pendente"
                              >
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span>PENDENTES</span>
                                  <Clock size={12} color="#d97706" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>{totalAguardando}</span>
                                  <span style={{ fontSize: 12, color: '#d97706', fontWeight: 700 }}>({pctPending.label})</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#92400e', marginTop: 2, fontWeight: 600 }}>
                                  Em aberto: R$ {valorPendente.toFixed(2).replace('.', ',')}
                                </div>
                              </div>
                            </div>

                            {/* Preview Rápido dos Pagantes Confirmados */}
                            {paidRows.length > 0 && (
                              <div style={{
                                background: '#f0fdf4',
                                border: '1px solid #dcfce7',
                                borderRadius: 12,
                                padding: '10px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <UserCheck size={14} color="#16a34a" />
                                    Últimos Pagantes Confirmados ({totalPagos}/{totalEnviados})
                                  </span>
                                  {paidRows.length > 4 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCobrancaModalId(String(cob.id));
                                        setCobModalFilter('PAID');
                                        setCobModalSearch('');
                                        setCobModalTurmaFilter('ALL');
                                      }}
                                      style={{ background: 'none', border: 'none', color: '#15803d', fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 0 }}
                                    >
                                      Ver todos ({paidRows.length}) →
                                    </button>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {paidRows.slice(0, 5).map(({ dest: dItem, info }) => (
                                    <div
                                      key={dItem.id || info.cleanId}
                                      onClick={() => {
                                        setSelectedCobrancaModalId(String(cob.id));
                                        setCobModalFilter('PAID');
                                        setCobModalSearch('');
                                        setCobModalTurmaFilter('ALL');
                                      }}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        background: '#ffffff',
                                        border: '1px solid #bbf7d0',
                                        borderRadius: 999,
                                        padding: '4px 10px 4px 5px',
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                      }}
                                    >
                                      <UserAvatar userId={info.cleanId} name={info.nome} fotoUrl={info.foto} size={22} />
                                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{formatShortName(info.nome)}</span>
                                        <span style={{ fontSize: 9.5, color: '#15803d', fontWeight: 600 }}>
                                          {info.turma}{info.pagadorNome ? ` • Pagador: ${formatShortName(info.pagadorNome)}` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCobrancaModalId(String(cob.id));
                                  setCobModalFilter('ALL');
                                  setCobModalSearch('');
                                  setCobModalTurmaFilter('ALL');
                                }}
                                style={{
                                  flex: '1 1 220px',
                                  background: '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '12px 18px',
                                  borderRadius: 12,
                                  fontSize: 13,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 8,
                                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <Users size={16} />
                                <span>Visualizar Pagantes ({totalPagos}/{totalEnviados})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCobrancaModalId(String(cob.id));
                                  setCobModalFilter('PAID');
                                  setCobModalSearch('');
                                  setCobModalTurmaFilter('ALL');
                                }}
                                style={{
                                  flex: '0 1 auto',
                                  background: '#ecfdf5',
                                  color: '#047857',
                                  border: '1px solid #a7f3d0',
                                  padding: '12px 16px',
                                  borderRadius: 12,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6
                                }}
                              >
                                <UserCheck size={16} />
                                <span>Somente Pagantes ({totalPagos})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePrintCobPayers(cob, 'ALL')}
                                style={{
                                  flex: '0 1 auto',
                                  background: '#ffffff',
                                  color: '#334155',
                                  border: '1px solid #cbd5e1',
                                  padding: '12px 16px',
                                  borderRadius: 12,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6
                                }}
                              >
                                <Printer size={16} />
                                <span>Imprimir Lista</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // =========================================================
                      // VISÃO DO RESPONSÁVEL / ALUNO
                      // =========================================================
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

                      if (isPaid) {
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
                             {isPaid ? (
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


            {/* Ciência */}
            {comunicado.exigeCiencia && !isAdminMode && (!isStaff || isInternalStaffComunicado) && (
              <div style={{ 
                background: !!(comunicado.ciencias || {})[currentUserSlug] ? '#f0fdf4' : '#eff6ff', 
                padding: '24px', 
                borderRadius: 20, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: 16, 
                border: !!(comunicado.ciencias || {})[currentUserSlug] ? '1px solid #bbf7d0' : '1px solid #bfdbfe', 
                borderBottom: !!(comunicado.ciencias || {})[currentUserSlug] ? '3px solid #86efac' : '3px solid #93c5fd',
                boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                maxWidth: 800, 
                width: '100%', 
                margin: '0 auto'
              }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {!!(comunicado.ciencias || {})[currentUserSlug] ? <CheckCircle2 size={28} color="#16a34a" /> : <ShieldAlert size={28} color="#3b82f6" />}
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: !!(comunicado.ciencias || {})[currentUserSlug] ? '#16a34a' : '#1e40af' }}>{!!(comunicado.ciencias || {})[currentUserSlug] ? 'Ciência confirmada' : 'Assinatura Eletrônica Necessária'}</div>
                    <div style={{ fontSize: 13, color: !!(comunicado.ciencias || {})[currentUserSlug] ? '#15803d' : '#1e3a8a', marginTop: 4 }}>{!!(comunicado.ciencias || {})[currentUserSlug] ? 'Você confirmou leitura neste comunicado.' : 'A escola exige sua confirmação de leitura.'}</div>
                  </div>
                </div>
                {!((comunicado.ciencias || {})[currentUserSlug]) && !effectiveIsAlunoView && (
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
              <div ref={commentsSectionRef} style={{ marginTop: 24, maxWidth: 800, width: '100%', margin: '0 auto' }}>
                {isAdminMode && !selectedThreadId ? (
                  adminThreads.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MessageSquare size={16} color="#6366f1" /> Conversas Privadas ({adminThreads.length})
                        </h3>
                      </div>
                      {adminThreads.map(thread => {
                         const lastMsg = thread.messages[thread.messages.length - 1];
                         const lastSnippet = lastMsg?.conteudo
                           ? `${lastMsg.remetente_nome ? formatShortName(lastMsg.remetente_nome) + ': ' : ''}${lastMsg.conteudo}`
                           : `${thread.messages.length} ${thread.messages.length === 1 ? 'mensagem' : 'mensagens'} nesta conversa`;
                         return (
                         <div 
                           key={thread.studentId} 
                           onClick={() => setSelectedThreadId(thread.studentId)} 
                           style={{ 
                             background: '#ffffff', 
                             border: '1px solid rgba(226, 232, 240, 0.85)', 
                             borderBottom: '3px solid rgba(203, 213, 225, 0.85)', 
                             borderRadius: 18, 
                             padding: '14px 18px', 
                             cursor: 'pointer', 
                             display: 'flex', 
                             justifyContent: 'space-between', 
                             alignItems: 'center', 
                             boxShadow: '0 6px 16px -2px rgba(15, 23, 42, 0.05), 0 2px 4px -1px rgba(15, 23, 42, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                             transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                           }}
                           onMouseEnter={e => {
                             e.currentTarget.style.borderColor = '#818cf8';
                             e.currentTarget.style.borderBottomColor = '#6366f1';
                             e.currentTarget.style.boxShadow = '0 10px 24px -2px rgba(99, 102, 241, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                             e.currentTarget.style.transform = 'translateY(-2px)';
                           }}
                           onMouseLeave={e => {
                             e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.85)';
                             e.currentTarget.style.borderBottomColor = 'rgba(203, 213, 225, 0.85)';
                             e.currentTarget.style.boxShadow = '0 6px 16px -2px rgba(15, 23, 42, 0.05), 0 2px 4px -1px rgba(15, 23, 42, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
                             e.currentTarget.style.transform = 'translateY(0)';
                           }}
                         >
                           <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0, flex: 1, marginRight: 10 }}>
                             <UserAvatar 
                               userId={thread.studentId}
                               name={thread.studentName}
                               fotoUrl={thread.studentFoto}
                               size={46}
                             />
                             <div style={{ minWidth: 0, flex: 1 }}>
                               <div 
                                 style={{ 
                                   fontWeight: 800, 
                                   fontSize: 15, 
                                   color: '#0f172a',
                                   whiteSpace: 'nowrap',
                                   overflow: 'hidden',
                                   textOverflow: 'ellipsis',
                                   display: 'flex',
                                   alignItems: 'center',
                                   gap: 8
                                 }}
                                 title={thread.studentName}
                               >
                                 <span>{formatShortName(thread.studentName)}</span>
                                 <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#eef2ff', color: '#4f46e5' }}>
                                   {thread.messages.length} {thread.messages.length === 1 ? 'msg' : 'msgs'}
                                 </span>
                               </div>
                               <div style={{ fontSize: 13, color: '#475569', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                 {lastSnippet}
                               </div>
                             </div>
                           </div>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                             <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                               {timeAgoShort(thread.lastMessageAt)}
                             </span>
                             <div style={{ width: 30, height: 30, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                               <ChevronRight size={16} />
                             </div>
                           </div>
                         </div>
                         );
                      })}
                    </div>
                  ) : loadingMsg ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
                      <div style={{ background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.85)', borderBottom: '3px solid rgba(203, 213, 225, 0.85)', borderRadius: 18, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 6px 16px -2px rgba(15, 23, 42, 0.05)' }}>
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
                  ) : null
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {isAdminMode && (
                      <button onClick={() => setSelectedThreadId(null)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
                        &larr; Voltar para conversas
                      </button>
                    )}
                    <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isAdminMode ? `Conversa com ${formatShortName(adminThreads.find(t => t.studentId === selectedThreadId)?.studentName || '')}` : 'Respostas Privadas ao Envio'}</h3>
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

                        // 0. Se a mensagem já traz autor_foto do backend / metadata
                        if (msg.autor_foto) {
                          avatarToUse = msg.autor_foto;
                          avatarUserId = msg.autor_id || undefined;
                        }

                        // 1. Se remetente_nome for o autor do comunicado, usa a foto e ID do autor
                        if (!avatarToUse && normMsgSender && normAutor && (normMsgSender === normAutor || normAutor.includes(normMsgSender) || normMsgSender.includes(normAutor))) {
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

                        // NUNCA usar comunicado.autorFoto como fallback se o remetente não for o autor do comunicado!
                        // Deixar avatarToUse e avatarUserId como undefined para que o UserAvatar busque a foto real do usuário pelo nome.
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
                            userId={avatarUserId || (msg.is_admin ? undefined : msg.remetente_id)}
                            name={msg.is_admin ? msg.remetente_nome : (alunoObj?.nome || msg.remetente_nome)}
                            fotoUrl={avatarToUse}
                            size={36}
                          />
                          <div>
                            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                                {msg.is_admin ? msg.remetente_nome : formatShortName(isFromResponsavel && alunoObj ? alunoObj.nome : msg.remetente_nome)}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                {isFromResponsavel && (
                                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                                    Enviado por: <span style={{ fontWeight: 600, color: '#475569' }}>{formatShortName(msg.remetente_nome)}</span> &bull;
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
          {(onEdit || onDelete || onForward || destinatariosStr) && (
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
              justifyContent: onForward ? 'space-between' : 'flex-end',
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
                    height: 44,
                    minWidth: 0,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 8, 
                    padding: '0 16px', 
                    borderRadius: 14, 
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
              {destinatariosStr && (
                <motion.button 
                  whileHover={{ scale: 1.05, y: -1, background: '#f8fafc' }}
                  whileTap={{ scale: 0.94 }}
                  onClick={(e: any) => { e.stopPropagation(); setShowDestinatariosModal(true); }} 
                  title="Ver Destinatários"
                  aria-label="Ver Destinatários"
                  style={{ 
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: 14, 
                    border: '1px solid #e2e8f0', 
                    background: '#ffffff', 
                    color: '#475569', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px -4px rgba(0,0,0,0.05)'
                  }}
                >
                  <Users size={18} />
                </motion.button>
              )}
              {onEdit && (
                <motion.button 
                  whileHover={{ scale: 1.05, y: -1, background: '#f8fafc' }}
                  whileTap={{ scale: 0.94 }}
                  onClick={(e: any) => { e.stopPropagation(); onEdit(comunicado); }} 
                  title="Editar"
                  aria-label="Editar"
                  style={{ 
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: 14, 
                    border: '1px solid #e2e8f0', 
                    background: '#ffffff', 
                    color: '#475569', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px -4px rgba(0,0,0,0.05)'
                  }}
                >
                  <Edit2 size={18} />
                </motion.button>
              )}
              {onDelete && (
                <motion.button 
                  whileHover={{ scale: 1.05, y: -1, background: '#fef2f2', borderColor: '#fca5a5' }}
                  whileTap={{ scale: 0.94 }}
                  onClick={(e: any) => { e.stopPropagation(); onDelete(comunicado.id); }} 
                  title="Excluir"
                  aria-label="Excluir"
                  style={{ 
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: 14, 
                    border: '1px solid rgba(239, 68, 68, 0.25)', 
                    background: 'rgba(239, 68, 68, 0.08)', 
                    color: '#ef4444', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px -4px rgba(239, 68, 68, 0.15)'
                  }}
                >
                  <Trash2 size={18} />
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

      {/* Modal Detalhado de Pagantes e Controle de Cobrança (Admin / Staff) */}
      <AnimatePresence>
        {selectedCobrancaModalId && (() => {
          const activeCob = (cobrancasList || []).find((c: any) => String(c.id) === String(selectedCobrancaModalId)) || cobrancasList?.[0];
          if (!activeCob) return null;

          const rawDests = getEffectiveCobDestinatarios(activeCob);
          const allResolved = rawDests
            .map((dest: any) => ({ dest, info: resolveCobDestInfo(dest, activeCob) }))
            .sort((a, b) => {
              // Em modo ALL, prioriza pagantes ou ordena alfabeticamente
              if (cobModalFilter === 'PAID' && a.info.paidAt && b.info.paidAt) {
                return new Date(b.info.paidAt).getTime() - new Date(a.info.paidAt).getTime();
              }
              return a.info.nome.localeCompare(b.info.nome, 'pt-BR');
            });

          const totalEnviados = allResolved.length;
          const totalPagos = allResolved.filter(r => r.info.isPaid).length;
          const totalPendentes = Math.max(0, totalEnviados - totalPagos);
          const pctPaid = formatCobPercentLabel(totalPagos, totalEnviados);
          const valorUnit = Number(activeCob.valor || 0);
          const valorRecebido = totalPagos * valorUnit;
          const valorEsperado = totalEnviados * valorUnit;
          const valorPendente = Math.max(0, valorEsperado - valorRecebido);
          const vencDate = activeCob.vencimento
            ? new Date(String(activeCob.vencimento).includes('T') ? activeCob.vencimento : `${activeCob.vencimento}T23:59:59`)
            : null;
          const isCobOverdue = Boolean(vencDate && !isNaN(vencDate.getTime()) && vencDate < new Date());

          const availableTurmas = Array.from(
            new Set(allResolved.map(r => r.info.turma).filter(Boolean))
          ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

          const qNorm = normalizeText(cobModalSearch);
          const filteredRows = allResolved.filter(({ info }) => {
            if (cobModalFilter === 'PAID' && !info.isPaid) return false;
            if (cobModalFilter === 'PENDING' && info.isPaid) return false;
            if (cobModalTurmaFilter !== 'ALL' && info.turma !== cobModalTurmaFilter) return false;
            if (qNorm) {
              const hay = normalizeText(
                `${info.nome} ${info.turma} ${info.matricula} ${info.responsavel} ${info.pagadorNome} ${info.cpfResponsavel} ${info.telefone} ${info.email} ${info.transactionId}`
              );
              if (!hay.includes(qNorm)) return false;
            }
            return true;
          });

          const isSyncingThis = cobSyncingId === String(activeCob.id);

          return (
            <motion.div
              key="cobranca-payers-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCobrancaModalId(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                zIndex: 100050,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16
              }}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 16 }}
                onClick={e => e.stopPropagation()}
                style={{
                  background: '#ffffff',
                  borderRadius: 24,
                  width: '100%',
                  maxWidth: 980,
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0'
                }}
              >
                {/* Modal Header */}
                <div style={{
                  padding: '20px 24px',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: '1 1 300px' }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: 'rgba(16, 185, 129, 0.18)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <CreditCard size={22} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#6ee7b7',
                          padding: '2px 8px',
                          borderRadius: 999
                        }}>
                          CONTROLE DE PAGANTES • {totalPagos}/{totalEnviados} ({pctPaid.label})
                        </span>
                        {activeCob.vencimento && (
                          <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>
                            Vencimento: {new Date(activeCob.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </span>
                        )}
                      </div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {activeCob.titulo || 'Cobrança'} — R$ {valorUnit.toFixed(2).replace('.', ',')}
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleSyncCobDestinatarios(String(activeCob.id))}
                      disabled={isSyncingThis}
                      title="Sincronizar lista de alunos destinatários com as turmas do comunicado"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        border: '1px solid rgba(255,255,255,0.18)',
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isSyncingThis ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <RefreshCw size={14} style={{ animation: isSyncingThis ? 'spin 1s linear infinite' : 'none' }} />
                      <span>{isSyncingThis ? 'Sincronizando...' : 'Sincronizar Alunos'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportCobXlsx(activeCob, filteredRows)}
                      title="Exportar lista atual para planilha Excel (.xlsx)"
                      style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#6ee7b7',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <FileSpreadsheet size={14} />
                      <span>Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrintCobPayers(activeCob, cobModalFilter)}
                      title="Imprimir lista de pagantes"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        border: '1px solid rgba(255,255,255,0.18)',
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Printer size={14} />
                      <span>Imprimir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCobrancaModalId(null)}
                      aria-label="Fechar modal de pagantes"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Summary Progress & KPIs */}
                <div style={{
                  padding: '16px 24px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10 }}>
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Destinatários</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{totalEnviados} alunos</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Previsto: R$ {valorEsperado.toFixed(2).replace('.', ',')}</div>
                    </div>

                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>Pagantes Confirmados</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginTop: 2 }}>
                        {totalPagos}/{totalEnviados} <span style={{ fontSize: 13, fontWeight: 700 }}>({pctPaid.label})</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>Recebido: R$ {valorRecebido.toFixed(2).replace('.', ',')}</div>
                    </div>

                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>Pendentes</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309', marginTop: 2 }}>{totalPendentes} alunos</div>
                      <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>Falta receber: R$ {valorPendente.toFixed(2).replace('.', ',')}</div>
                    </div>
                  </div>

                  {/* Barra de Pagantes X/X */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Barra de Pagantes: <strong>{totalPagos}/{totalEnviados}</strong> ({pctPaid.label} concluído)</span>
                      <span style={{ color: '#059669' }}>R$ {valorRecebido.toFixed(2).replace('.', ',')} / R$ {valorEsperado.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <progress
                      className="cvm-cob-progress"
                      max={Math.max(totalEnviados, 1)}
                      value={totalPagos}
                      aria-label={`Progresso de pagantes: ${totalPagos} de ${totalEnviados}`}
                    />
                  </div>

                  {/* Filters + Search Row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setCobModalFilter('ALL')}
                        style={{
                          padding: '7px 13px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: cobModalFilter === 'ALL' ? '1px solid #0f172a' : '1px solid #cbd5e1',
                          background: cobModalFilter === 'ALL' ? '#0f172a' : '#ffffff',
                          color: cobModalFilter === 'ALL' ? '#ffffff' : '#475569'
                        }}
                      >
                        Todos ({totalEnviados})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCobModalFilter('PAID')}
                        style={{
                          padding: '7px 13px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: cobModalFilter === 'PAID' ? '1px solid #16a34a' : '1px solid #bbf7d0',
                          background: cobModalFilter === 'PAID' ? '#16a34a' : '#f0fdf4',
                          color: cobModalFilter === 'PAID' ? '#ffffff' : '#15803d'
                        }}
                      >
                        ✓ Pagantes ({totalPagos}/{totalEnviados})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCobModalFilter('PENDING')}
                        style={{
                          padding: '7px 13px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: cobModalFilter === 'PENDING' ? '1px solid #d97706' : '1px solid #fde68a',
                          background: cobModalFilter === 'PENDING' ? '#d97706' : '#fffbeb',
                          color: cobModalFilter === 'PENDING' ? '#ffffff' : '#b45309'
                        }}
                      >
                        ⏳ Pendentes ({totalPendentes})
                      </button>

                      {availableTurmas.length > 1 && (
                        <select
                          value={cobModalTurmaFilter}
                          onChange={e => setCobModalTurmaFilter(e.target.value)}
                          aria-label="Filtrar por turma"
                          style={{
                            padding: '7px 10px',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="ALL">Todas as Turmas ({availableTurmas.length})</option>
                          {availableTurmas.map(tm => (
                            <option key={tm} value={tm}>{tm}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div style={{
                      flex: '1 1 250px',
                      maxWidth: 380,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 10,
                      padding: '6px 12px'
                    }}>
                      <Search size={15} color="#64748b" />
                      <input
                        type="text"
                        value={cobModalSearch}
                        onChange={e => setCobModalSearch(e.target.value)}
                        placeholder="Buscar aluno, pagador, responsável, CPF, turma..."
                        style={{
                          border: 'none',
                          outline: 'none',
                          width: '100%',
                          fontSize: 12.5,
                          color: '#0f172a',
                          background: 'transparent'
                        }}
                      />
                      {cobModalSearch && (
                        <button
                          type="button"
                          onClick={() => setCobModalSearch('')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payers & Recipients List Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10, background: '#ffffff' }}>
                  {filteredRows.length === 0 ? (
                    <div style={{
                      padding: '44px 20px',
                      textAlign: 'center',
                      color: '#64748b',
                      background: '#f8fafc',
                      borderRadius: 16,
                      border: '1px dashed #cbd5e1'
                    }}>
                      <Users size={34} style={{ margin: '0 auto 10px', opacity: 0.45, display: 'block' }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        {cobModalFilter === 'PAID'
                          ? 'Nenhum pagante confirmado encontrado para este filtro.'
                          : cobModalFilter === 'PENDING'
                          ? 'Nenhum aluno pendente encontrado para este filtro.'
                          : 'Nenhum destinatário localizado.'}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                        {totalEnviados === 0
                          ? 'Clique em "Sincronizar Alunos" para vincular os alunos das turmas deste comunicado.'
                          : 'Tente alterar a aba de filtro ou limpar o campo de busca.'}
                      </div>
                      {totalEnviados === 0 && (
                        <button
                          type="button"
                          onClick={() => handleSyncCobDestinatarios(String(activeCob.id))}
                          disabled={isSyncingThis}
                          style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            padding: '10px 16px',
                            borderRadius: 10,
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isSyncingThis ? 'Sincronizando...' : 'Sincronizar Alunos Agora'}
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredRows.map(({ dest, info }) => {
                      const rowKey = String(dest?.id || info.cleanId);
                      const isRowLoading = !!cobActionLoading[rowKey];
                      const isLinkLoading = !!cobActionLoading[`link_${rowKey}`];
                      const isCopied = copiedLinkId === rowKey;

                      return (
                        <div
                          key={rowKey}
                          style={{
                            border: `1px solid ${info.isPaid ? '#bbf7d0' : '#e2e8f0'}`,
                            background: info.isPaid ? '#f0fdf4' : '#ffffff',
                            borderRadius: 14,
                            padding: '14px 16px',
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 14,
                            transition: 'all 0.15s'
                          }}
                        >
                          {/* Student + Payer + Guardian Details */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: '1 1 380px', minWidth: 0 }}>
                            <UserAvatar userId={info.cleanId} name={info.nome} fotoUrl={info.foto} size={44} />
                            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {/* Line 1: Student Name + Badges */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>{info.nome}</span>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  background: info.isPaid ? '#16a34a' : isCobOverdue ? '#fee2e2' : '#fef3c7',
                                  color: info.isPaid ? '#ffffff' : isCobOverdue ? '#b91c1c' : '#b45309',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4
                                }}>
                                  {info.isPaid ? '✓ PAGO' : isCobOverdue ? 'VENCIDO' : '⏳ PENDENTE'}
                                </span>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: '#f1f5f9',
                                  color: '#475569'
                                }}>
                                  {info.turma}
                                </span>
                                {info.matricula && (
                                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                    Mat: {info.matricula}
                                  </span>
                                )}
                                {info.autResp && (
                                  <span style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: info.autResp.status === 'AUTHORIZED' ? '#dcfce7' : '#fee2e2',
                                    color: info.autResp.status === 'AUTHORIZED' ? '#166534' : '#991b1b'
                                  }}>
                                    {info.autResp.status === 'AUTHORIZED' ? 'Autorização: Sim' : 'Autorização: Não'}
                                  </span>
                                )}
                              </div>

                              {/* Line 2: Payer / Financial Guardian Info */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12, color: '#334155' }}>
                                {info.isPaid && (
                                  <span>
                                    <strong style={{ color: '#15803d' }}>Pagador:</strong>{' '}
                                    <span style={{ fontWeight: 700 }}>{info.pagadorNome || info.responsavel || 'Confirmado'}</span>
                                  </span>
                                )}
                                <span>
                                  <strong style={{ color: '#475569' }}>Responsável:</strong>{' '}
                                  <span>{info.responsavel || 'Não informado'}</span>
                                  {info.parentesco ? <span style={{ color: '#64748b' }}> ({info.parentesco})</span> : null}
                                </span>
                                {info.cpfResponsavel && (
                                  <span>
                                    <strong style={{ color: '#475569' }}>CPF:</strong> {info.cpfResponsavel}
                                  </span>
                                )}
                                {info.telefone && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Phone size={11} color="#64748b" />
                                    <span>{info.telefone}</span>
                                  </span>
                                )}
                                {info.email && (
                                  <span style={{ color: '#64748b' }}>
                                    {info.email}
                                  </span>
                                )}
                              </div>

                              {/* Line 3: Payment Timestamp, Amount & Origin */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                  Valor: R$ {valorUnit.toFixed(2).replace('.', ',')}
                                </span>
                                {info.isPaid && info.paidAt && (
                                  <span style={{ color: '#15803d', fontWeight: 700 }}>
                                    • Pago em {new Date(info.paidAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                )}
                                {info.origemPagamento && (
                                  <span>
                                    • Origem: <strong>{info.origemPagamento}</strong>
                                    {info.transactionId ? ` (ID: ${info.transactionId.substring(0, 14)})` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Row Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
                            {/* Toggle Paid / Manual Baixa */}
                            <button
                              type="button"
                              onClick={() => handleToggleCobDestPaid(activeCob, dest)}
                              disabled={isRowLoading}
                              title={info.isPaid ? 'Reabrir cobrança para pendente' : 'Confirmar pagamento manualmente (Dar Baixa)'}
                              style={{
                                padding: '7px 11px',
                                borderRadius: 9,
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: isRowLoading ? 'wait' : 'pointer',
                                border: info.isPaid ? '1px solid #cbd5e1' : '1px solid #16a34a',
                                background: info.isPaid ? '#ffffff' : '#16a34a',
                                color: info.isPaid ? '#475569' : '#ffffff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5
                              }}
                            >
                              {isRowLoading ? (
                                <Loader2 size={13} />
                              ) : info.isPaid ? (
                                <RotateCcw size={13} />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                              <span>{info.isPaid ? 'Reabrir' : 'Dar Baixa'}</span>
                            </button>

                            {/* WhatsApp Reminder / Receipt */}
                            <button
                              type="button"
                              onClick={() => handleWhatsAppCobReminder(activeCob, dest, info)}
                              title={info.isPaid ? 'Enviar comprovante/confirmação por WhatsApp' : 'Enviar lembrete de pagamento por WhatsApp'}
                              style={{
                                padding: '7px 11px',
                                borderRadius: 9,
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: '1px solid #bbf7d0',
                                background: '#ecfdf5',
                                color: '#047857',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5
                              }}
                            >
                              <MessageCircle size={13} />
                              <span>WhatsApp</span>
                            </button>

                            {/* Open Invoice Link */}
                            <button
                              type="button"
                              onClick={() => handleOpenOrCopyCobPaymentLink(activeCob, dest, 'open')}
                              disabled={isLinkLoading}
                              title="Abrir ou gerar link da fatura deste aluno"
                              style={{
                                padding: '7px 10px',
                                borderRadius: 9,
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: isLinkLoading ? 'wait' : 'pointer',
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                color: '#334155',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5
                              }}
                            >
                              <ExternalLink size={13} />
                              <span>{isLinkLoading ? 'Gerando...' : 'Fatura'}</span>
                            </button>

                            {/* Copy Invoice Link */}
                            <button
                              type="button"
                              onClick={() => handleOpenOrCopyCobPaymentLink(activeCob, dest, 'copy')}
                              disabled={isLinkLoading}
                              title="Copiar link de pagamento"
                              style={{
                                padding: '7px 10px',
                                borderRadius: 9,
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: isLinkLoading ? 'wait' : 'pointer',
                                border: isCopied ? '1px solid #16a34a' : '1px solid #cbd5e1',
                                background: isCopied ? '#dcfce7' : '#ffffff',
                                color: isCopied ? '#15803d' : '#475569',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              {isCopied ? <Check size={13} /> : <Copy size={13} />}
                              <span>{isCopied ? 'Copiado!' : 'Copiar Link'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Modal Footer */}
                <div style={{
                  padding: '14px 24px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ fontSize: 12.5, color: '#475569', fontWeight: 600 }}>
                    Exibindo <strong>{filteredRows.length}</strong> de <strong>{totalEnviados}</strong> destinatários • Pagantes: <strong style={{ color: '#15803d' }}>{totalPagos}/{totalEnviados}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handlePrintCobPayers(activeCob, cobModalFilter)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Printer size={14} />
                      <span>Imprimir Filtro Atual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCobrancaModalId(null)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {internalMaximizedImage && (
          <ImagePinchZoomModal
            src={internalMaximizedImage}
            onClose={() => setInternalMaximizedImage(null)}
          />
        )}
      </AnimatePresence>
    </Portal>
  )
}
