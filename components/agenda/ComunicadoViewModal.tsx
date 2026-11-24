'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Paperclip, FileText, CheckCircle2, ShieldAlert, Calendar, Mic, Send, Share, Bookmark, MoreHorizontal, Edit2, Trash2, Loader2, CreditCard, Info, ExternalLink, Vote, Smile, MessageSquare, ChevronRight, Users, Maximize2, Printer, Search, RefreshCw, Copy, Check, Phone, MessageCircle, UserCheck, RotateCcw, Clock, FileSpreadsheet, DollarSign, ShieldCheck, BellRing, AlertTriangle } from 'lucide-react'
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
import { ComunicadoDestinatariosModal } from '@/components/agenda/ComunicadoDestinatariosModal'
import { apiFetch } from '@/lib/api/apiClient'
import { isCobrancaPaidStatus, resolveCobrancaPaymentTimestamp } from '@/lib/cobrancasUtils'

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

let supportsCobDisplayTransition: boolean | undefined;
function canCobTransitionDisplay(): boolean {
  if (supportsCobDisplayTransition !== undefined) return supportsCobDisplayTransition;
  if (typeof window === 'undefined' || !window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsCobDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsCobDisplayTransition;
}

function supportsCobTopLayerExit(): boolean {
  return typeof window !== 'undefined' && Boolean(window.CSS?.supports?.('overlay', 'auto')) && canCobTransitionDisplay();
}

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

export type ComunicadoReminderMode =
  | 'all'
  | 'unread'
  | 'unpaid'
  | 'unanswered_auth'
  | 'unanswered_report'
  | 'unanswered_poll'

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
  onSendReminder?: (comunicado: any, options: { mode: ComunicadoReminderMode; customMessage?: string }) => Promise<any>
  onReminderSent?: (updatedComunicado: any, result: any) => void
  initialOpenReminder?: boolean
  initialFocusComments?: boolean
  isAlunoView?: boolean
  canManageAutorizacao?: boolean
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
  onSendReminder,
  onReminderSent,
  initialOpenReminder = false,
  initialFocusComments = false,
  isAlunoView = false,
  canManageAutorizacao,
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
        const prevRemCount = Array.isArray(prev?.lembretes_historico || prev?.dados?.lembretes_historico)
          ? (prev?.lembretes_historico || prev?.dados?.lembretes_historico).length
          : 0
        const nextRemCount = Array.isArray(next?.lembretes_historico || next?.dados?.lembretes_historico)
          ? (next?.lembretes_historico || next?.dados?.lembretes_historico).length
          : 0
        if (prev?.id === next?.id && prevRemCount > nextRemCount) {
          const hist = prev?.lembretes_historico || prev?.dados?.lembretes_historico
          next.lembretes_historico = hist
          next.dados = { ...(next.dados || {}), lembretes_historico: hist }
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
  const cobDialogRef = useRef<HTMLDialogElement>(null)
  const pressedOutsideCobDialogRef = useRef<boolean>(false)
  const cobDialogTitleId = useId()

  const closeCobModal = useCallback(async () => {
    const dialog = cobDialogRef.current
    if (!dialog || !dialog.open) {
      setSelectedCobrancaModalId(null)
      return
    }
    if (!supportsCobTopLayerExit() && typeof dialog.getAnimations === 'function') {
      dialog.setAttribute('data-closing', '')
      const animations = dialog.getAnimations({ subtree: true })
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map(a => a.finished)),
          new Promise(r => setTimeout(r, 260))
        ])
      }
      if (!dialog.hasAttribute('data-closing')) return
      dialog.removeAttribute('data-closing')
    }
    setSelectedCobrancaModalId(null)
  }, [])

  useEffect(() => {
    const dialog = cobDialogRef.current
    if (!dialog) return
    if (selectedCobrancaModalId) {
      dialog.removeAttribute('data-closing')
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal()
        } else {
          dialog.setAttribute('open', '')
        }
      }
    } else if (dialog.open) {
      dialog.removeAttribute('data-closing')
      if (typeof dialog.close === 'function') {
        dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
    }
  }, [selectedCobrancaModalId])

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
  const [showReminderModal, setShowReminderModal] = useState(Boolean(initialOpenReminder))
  const [reminderMode, setReminderMode] = useState<ComunicadoReminderMode>('all')
  const [reminderCustomMsg, setReminderCustomMsg] = useState('')
  const [isSendingReminder, setIsSendingReminder] = useState(false)
  const [reminderFeedback, setReminderFeedback] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)
  const [reminderSummary, setReminderSummary] = useState<{
    capabilities?: {
      hasCobranca?: boolean
      cobrancaTitulo?: string | null
      cobrancaOverdue?: boolean
      hasAutorizacao?: boolean
      autorizacaoTitulo?: string | null
      autorizacaoClosed?: boolean
      hasRelatorio?: boolean
      relatorioLabel?: string | null
      hasEnquete?: boolean
      enquetePergunta?: string | null
      enqueteClosed?: boolean
      exigeCiencia?: boolean
      isInterno?: boolean
      isReport?: boolean
    }
    counts?: {
      all?: number
      unread?: number
      unpaid?: number | null
      paid?: number | null
      unanswered_auth?: number | null
      answered_auth?: number | null
      unanswered_report?: number | null
      answered_report?: number | null
      unanswered_poll?: number | null
      answered_poll?: number | null
    }
    lembretes_historico?: any[]
  } | null>(null)
  const [isLoadingReminderSummary, setIsLoadingReminderSummary] = useState(false)
  const reminderDialogRef = useRef<HTMLDialogElement>(null)
  const pressedOutsideReminderDialogRef = useRef<boolean>(false)
  const reminderDialogTitleId = useId()

  const canShowReminderButton = Boolean(
    onSendReminder &&
    comunicado?.id &&
    comunicado?.status !== 'rascunho' &&
    comunicado?.status !== 'agendado'
  )

  const closeReminderModal = useCallback(() => {
    if (isSendingReminder) return
    const dialog = reminderDialogRef.current
    if (dialog && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close('')
      } else {
        dialog.removeAttribute('open')
      }
    }
    setShowReminderModal(false)
  }, [isSendingReminder])

  useEffect(() => {
    const dialog = reminderDialogRef.current
    if (!dialog) return
    if (showReminderModal && canShowReminderButton) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal()
        } else {
          dialog.setAttribute('open', '')
        }
      }
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close('')
      } else {
        dialog.removeAttribute('open')
      }
    }
  }, [showReminderModal, canShowReminderButton])

  const fetchReminderSummary = useCallback(async (targetId: string) => {
    if (!targetId) return
    setIsLoadingReminderSummary(true)
    try {
      const res = await apiFetch(`/api/comunicados/lembrete?id=${encodeURIComponent(targetId)}`)
      if (res.ok) {
        const json = await res.json()
        if (json?.ok) {
          setReminderSummary(json)
        }
      }
    } catch {
      // Fallback silencioso: detecção local mantém todas as opções disponíveis
    } finally {
      setIsLoadingReminderSummary(false)
    }
  }, [])

  useEffect(() => {
    setReminderSummary(null)
    setReminderMode('all')
    setReminderFeedback(null)
  }, [comunicado?.id])

  useEffect(() => {
    if (showReminderModal && canShowReminderButton && comunicado?.id) {
      void fetchReminderSummary(String(comunicado.id))
    }
  }, [showReminderModal, canShowReminderButton, comunicado?.id, fetchReminderSummary])

  useEffect(() => {
    if (initialOpenReminder && onSendReminder && comunicado?.status !== 'rascunho' && comunicado?.status !== 'agendado') {
      setReminderFeedback(null)
      setReminderMode('all')
      setShowReminderModal(true)
    }
  }, [initialOpenReminder, onSendReminder, comunicado?.id, comunicado?.status])

  // Detecção híbrida (instantânea local + confirmada pelo servidor) das funcionalidades do comunicado
  const reminderDetectedFeatures = useMemo(() => {
    const rawAnexos = [
      ...(Array.isArray(comunicado?.anexos) ? comunicado.anexos : []),
      ...(Array.isArray(comunicado?.dados?.anexos) ? comunicado.dados.anexos : []),
    ]
    let annexHasCob = false
    let annexHasAut = false
    let annexHasEnq = false
    let annexHasRel = false
    let annexRelLabel: string | null = null

    for (const raw of rawAnexos) {
      const parsed = parseAnexo(raw)
      if (!parsed) continue
      const nLower = String(parsed.name || '').toLowerCase()
      const uLower = String(parsed.url || '').toLowerCase()
      const mLower = String(parsed.mime || '').toLowerCase()
      const rawStr = typeof raw === 'string' ? raw : ''

      if (mLower === 'cobranca' || mLower === 'cobrança' || uLower.startsWith('cobranca:') || nLower.startsWith('cobrança:') || nLower.startsWith('cobranca:')) {
        annexHasCob = true
      }
      if (mLower === 'autorizacao' || uLower.startsWith('autorizacao:') || nLower.startsWith('autorização:')) {
        annexHasAut = true
      }
      if (mLower === 'enquete' || uLower.startsWith('enquete:') || nLower.startsWith('enquete:')) {
        annexHasEnq = true
      }
      if (
        rawStr.endsWith('|report-payload') ||
        mLower === 'report-payload' ||
        uLower.startsWith('payload:') ||
        nLower.startsWith('relatório personalizado:') ||
        nLower.startsWith('relatorio personalizado:') ||
        (nLower.startsWith('relatório:') && !uLower.startsWith('form:'))
      ) {
        annexHasRel = true
        annexRelLabel = annexRelLabel || 'Relatório'
      } else if (nLower.startsWith('tarefa de relatório:') || nLower.startsWith('tarefa de relatorio:') || uLower.startsWith('report-task:')) {
        annexHasRel = true
        annexRelLabel = annexRelLabel || 'Tarefa de Relatório'
      } else if (nLower.startsWith('formulário:') || nLower.startsWith('formulario:') || nLower.startsWith('relatório:') || uLower.startsWith('form:')) {
        annexHasRel = true
        annexRelLabel = annexRelLabel || 'Formulário / Relatório'
      }
    }

    const comIdStr = String(comunicado?.id || '')
    const rawCobs = Array.isArray(comunicado?.cobrancas || comunicado?.dados?.cobrancas)
      ? (comunicado?.cobrancas || comunicado?.dados?.cobrancas)
      : (comunicado?.cobranca || comunicado?.dados?.cobranca ? [comunicado.cobranca || comunicado.dados.cobranca] : [])
    const localHasCobranca =
      (Array.isArray(cobrancasList) && cobrancasList.length > 0) ||
      rawCobs.some((c: any) => Number(String(c?.valor || 0).replace(',', '.')) > 0) ||
      annexHasCob

    const autObj = comunicado?.autorizacao || comunicado?.dados?.autorizacao || null
    const localHasAutorizacao =
      Boolean(autObj && typeof autObj === 'object' && (autObj.id || autObj.titulo || Array.isArray(autObj.opcoes))) ||
      annexHasAut

    const enqObj = comunicado?.enquete || comunicado?.dados?.enquete || null
    const localHasEnquete =
      Boolean(enqObj && typeof enqObj === 'object' && Array.isArray(enqObj.opcoes) && enqObj.opcoes.length > 0) ||
      annexHasEnq

    const stuIdsArr = comunicado?.stuIds || comunicado?.dados?.stuIds
    const localHasRelatorio =
      comIdStr.startsWith('AD-COM-REL-') ||
      normalizeText(comunicado?.tipo || comunicado?.dados?.tipo) === 'relatorio' ||
      Boolean(comunicado?.dados?.tipoRelatorio) ||
      (Array.isArray(stuIdsArr) && stuIdsArr.length > 0) ||
      annexHasRel

    const srvCaps = reminderSummary?.capabilities
    const primaryLocalCob = cobrancasList?.[0] || rawCobs?.[0] || null
    let localCobOverdue = false
    if (primaryLocalCob?.vencimento) {
      const vStr = String(primaryLocalCob.vencimento).trim()
      const vDate = new Date(vStr.includes('T') ? vStr : `${vStr}T23:59:59`)
      if (!isNaN(vDate.getTime()) && vDate.getTime() < Date.now()) {
        localCobOverdue = true
      }
    }

    return {
      hasCobranca: Boolean(srvCaps?.hasCobranca || localHasCobranca),
      cobrancaTitulo: srvCaps?.cobrancaTitulo || primaryLocalCob?.titulo || comunicado?.titulo || 'Cobrança',
      cobrancaOverdue: srvCaps?.cobrancaOverdue ?? localCobOverdue,
      hasAutorizacao: Boolean(srvCaps?.hasAutorizacao || localHasAutorizacao),
      autorizacaoTitulo: srvCaps?.autorizacaoTitulo || autObj?.titulo || comunicado?.titulo || 'Autorização',
      autorizacaoClosed: Boolean(srvCaps?.autorizacaoClosed ?? autObj?.encerrada),
      hasRelatorio: Boolean(srvCaps?.hasRelatorio || localHasRelatorio),
      relatorioLabel: srvCaps?.relatorioLabel || annexRelLabel || 'Relatório',
      hasEnquete: Boolean(srvCaps?.hasEnquete || localHasEnquete),
      enquetePergunta: srvCaps?.enquetePergunta || enqObj?.pergunta || enqObj?.titulo || comunicado?.titulo || 'Enquete',
      enqueteClosed: Boolean(srvCaps?.enqueteClosed ?? enqObj?.encerrada),
      exigeCiencia: Boolean(srvCaps?.exigeCiencia ?? (comunicado?.exigeCiencia || comunicado?.dados?.exigeCiencia)),
      isReport: Boolean(srvCaps?.isReport || localHasRelatorio),
    }
  }, [comunicado, cobrancasList, reminderSummary])

  // Garante que reminderMode sempre aponte para uma opção válida deste comunicado
  useEffect(() => {
    if (reminderMode === 'unpaid' && !reminderDetectedFeatures.hasCobranca) {
      setReminderMode('all')
    } else if (reminderMode === 'unanswered_auth' && !reminderDetectedFeatures.hasAutorizacao) {
      setReminderMode('all')
    } else if (reminderMode === 'unanswered_report' && !reminderDetectedFeatures.hasRelatorio) {
      setReminderMode('all')
    } else if (reminderMode === 'unanswered_poll' && !reminderDetectedFeatures.hasEnquete) {
      setReminderMode('all')
    }
  }, [reminderMode, reminderDetectedFeatures])

  const handleTriggerSendReminder = async () => {
    if (!onSendReminder || !comunicado?.id || isSendingReminder) return
    setIsSendingReminder(true)
    setReminderFeedback(null)
    try {
      const result = await onSendReminder(comunicado, {
        mode: reminderMode,
        customMessage: reminderCustomMsg.trim() || undefined,
      })
      if (result && result.ok === false) {
        if (result.counts) {
          setReminderSummary(prev => ({ ...(prev || {}), counts: result.counts }))
        }
        setReminderFeedback({
          type: 'error',
          text: result.error || 'Não foi possível enviar o lembrete.',
        })
        return
      }
      if (result?.lembretes_historico) {
        const updatedCom = {
          ...comunicado,
          lembretes_historico: result.lembretes_historico,
          dados: { ...(comunicado.dados || {}), lembretes_historico: result.lembretes_historico },
        }
        setComunicado(updatedCom)
        setReminderSummary(prev => ({
          ...(prev || {}),
          lembretes_historico: result.lembretes_historico,
          ...(result.counts ? { counts: result.counts } : {}),
        }))
        onReminderSent?.(updatedCom, result)
      } else if (result?.counts) {
        setReminderSummary(prev => ({ ...(prev || {}), counts: result.counts }))
      }
      const noSubsOnly = result?.sent === 0 && (result?.noSubscribers || 0) > 0
      setReminderFeedback({
        type: noSubsOnly ? 'warning' : 'success',
        text: result?.message || 'Lembrete enviado com sucesso!',
      })
      setReminderCustomMsg('')
    } catch (err: any) {
      setReminderFeedback({
        type: 'error',
        text: err?.message || 'Erro inesperado ao enviar lembrete.',
      })
    } finally {
      setIsSendingReminder(false)
    }
  }

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
      if (data.alreadyPaid && data.receiptUrl) {
        fetchCobrancas();
        window.open(data.receiptUrl, '_blank', 'noopener,noreferrer');
      } else if (!res.ok || data.error || !data.invoiceUrl) {
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
    const isPaid = isCobrancaPaidStatus(statusStr);
    const pagadorNome = dest?.pagador_usuario_nome || dest?.pagador_nome || (isPaid ? (responsavel || 'Confirmado') : '');
    const paidAt = resolveCobrancaPaymentTimestamp(dest);
    const createdAt = dest?.created_at || cob?.created_at || null;
    const asaasId = String(dest?.asaas_payment_id || '');
    const urlPagamento = dest?.url_pagamento || '';
    const isMercadoPago =
      asaasId.startsWith('MP_') ||
      /^\d{9,}$/.test(asaasId) ||
      urlPagamento.includes('mercadopago');
    const origemPagamento = isMercadoPago
      ? 'Mercado Pago'
      : asaasId
      ? 'Asaas / Online'
      : isPaid
      ? 'Baixa Manual (Secretaria)'
      : '';
    const transactionId = asaasId ? asaasId.replace(/^MP_/, '') : '';

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
            const updatedDest = json.destinatario || {};
            const nextStatus = updatedDest.status || json.status || d.status;
            const nextIsPaid = isCobrancaPaidStatus(nextStatus);
            return {
              ...d,
              ...updatedDest,
              status: nextStatus,
              paid_at: updatedDest.paid_at ?? (nextIsPaid ? new Date().toISOString() : null),
              pagador_usuario_nome: updatedDest.pagador_usuario_nome ?? (nextIsPaid ? (d.pagador_usuario_nome || d.pagador_nome || 'Baixa Manual (Secretaria)') : null)
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

  const getCobReceiptUrl = (dest: any): string => {
    if (!dest) return '';
    const rawPath =
      dest.receipt_url ||
      (dest.id && !String(dest.id).startsWith('virtual_')
        ? `/recibo/cobranca/${encodeURIComponent(String(dest.id))}`
        : '');
    if (!rawPath) return '';
    if (typeof window !== 'undefined' && rawPath.startsWith('/')) {
      return new URL(rawPath, window.location.origin).toString();
    }
    return rawPath;
  };

  const handleOpenOrCopyCobPaymentLink = async (cob: any, dest: any, mode: 'open' | 'copy' = 'open') => {
    if (!cob?.id) return;
    const key = `link_${dest?.id || dest?.destinatario_id}`;
    const isPaid = isCobrancaPaidStatus(dest?.status);

    // Se já estiver pago, abre/copia o COMPROVANTE DE PAGAMENTO e nunca a fatura para pagar novamente
    if (isPaid) {
      const receiptUrl = getCobReceiptUrl(dest);
      if (!receiptUrl) {
        alert('Não foi possível localizar o comprovante deste pagamento. Tente clicar em Sincronizar Alunos.');
        return;
      }
      if (mode === 'copy') {
        try {
          await navigator.clipboard.writeText(receiptUrl);
          setCopiedLinkId(String(dest.id || dest.destinatario_id));
          setTimeout(() => setCopiedLinkId(null), 2200);
        } catch (_) {
          prompt('Copie o link do comprovante abaixo:', receiptUrl);
        }
      } else {
        window.open(receiptUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

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
        window.open(existingUrl, '_blank', 'noopener,noreferrer');
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
      if (data.alreadyPaid && data.receiptUrl) {
        const fullReceipt = typeof window !== 'undefined'
          ? new URL(data.receiptUrl, window.location.origin).toString()
          : data.receiptUrl;
        if (mode === 'copy') {
          await navigator.clipboard.writeText(fullReceipt).catch(() => prompt('Copie o link do comprovante abaixo:', fullReceipt));
          setCopiedLinkId(String(dest.id || dest.destinatario_id));
          setTimeout(() => setCopiedLinkId(null), 2200);
        } else {
          window.open(fullReceipt, '_blank', 'noopener,noreferrer');
        }
        return;
      }

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
        window.open(data.invoiceUrl, '_blank', 'noopener,noreferrer');
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
      const receiptUrl = getCobReceiptUrl(dest);
      msg = `${saudacao}\n\nConfirmamos o recebimento do pagamento referente a *${cob.titulo}* do(a) aluno(a) *${info.nome}* (${info.turma}) no valor de *R$ ${valorFmt}*.${receiptUrl ? `\n\n🧾 *Comprovante de pagamento:*\n${receiptUrl}` : ''}\n\nAgradecemos pela confirmação!`;
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
          .cvm-cob-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-left: 3px solid #f59e0b;
            border-radius: 12px;
            padding: 10px 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
          }
          .cvm-cob-card:hover {
            border-color: #cbd5e1;
            box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
          }
          .cvm-cob-card.is-paid {
            border-color: #bbf7d0;
            border-left-color: #16a34a;
            background: linear-gradient(90deg, rgba(240, 253, 244, 0.65) 0%, #ffffff 34%);
          }
          .cvm-cob-card.is-overdue {
            border-color: #fecaca;
            border-left-color: #dc2626;
          }
          .cvm-cob-details > summary {
            list-style: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
            user-select: none;
            padding: 1px 0;
          }
          .cvm-cob-details > summary::-webkit-details-marker {
            display: none;
          }
          .cvm-cob-details > summary:hover {
            color: #334155;
          }
          .cvm-cob-details > summary svg {
            transition: transform 0.15s ease;
          }
          .cvm-cob-details[open] > summary svg {
            transform: rotate(90deg);
          }
          .cvm-cob-details-grid {
            margin-top: 6px;
            padding: 7px 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 4px 14px;
            font-size: 11px;
            color: #475569;
          }
          .cvm-actions-footer {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-top: 1px solid rgba(226, 232, 240, 0.7);
            padding: 10px 12px;
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
            position: sticky;
            bottom: 0;
            z-index: 20;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            box-shadow: 0 -10px 40px -10px rgba(0,0,0,0.06);
            flex-wrap: nowrap;
          }
          .cvm-actions-main {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1 1 auto;
            min-width: 0;
          }
          .cvm-actions-icons {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
            margin-left: auto;
          }
          .cvm-action-btn {
            height: 40px;
            padding: 0 10px;
            border-radius: 12px;
            font-size: 12.5px;
            font-weight: 700;
            gap: 5px;
            min-width: 0;
            white-space: nowrap;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          .cvm-icon-btn {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          @media (min-width: 521px) {
            .cvm-actions-footer {
              padding: 12px 16px;
              padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
              gap: 8px;
            }
            .cvm-actions-main,
            .cvm-actions-icons {
              gap: 8px;
            }
            .cvm-action-btn {
              height: 44px;
              padding: 0 16px;
              border-radius: 14px;
              font-size: 14px;
              gap: 8px;
            }
            .cvm-icon-btn {
              width: 44px;
              height: 44px;
              border-radius: 14px;
            }
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
                  cobrancas={cobrancasList}
                  isAdminMode={isAdminMode || isStaff}
                  isAlunoView={effectiveIsAlunoView}
                  canManagePrazo={!effectiveIsAlunoView && Boolean(canManageAutorizacao ?? onEdit)}
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
                               <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                 <div style={{ color: colors.accent, fontWeight: 700, fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, background: colors.accentBg, padding: '8px 16px', borderRadius: 12, border: `1px solid ${colors.border}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <CheckCircle2 size={18} /> Pago
                                    </div>
                                    {cobDest?.paid_at && (
                                      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>
                                        em {new Date(cobDest.paid_at).toLocaleDateString('pt-BR')}
                                      </span>
                                    )}
                                 </div>
                                 {cobDest?.id && (
                                   <button
                                     type="button"
                                     onClick={() => handleOpenOrCopyCobPaymentLink(cob, cobDest, 'open')}
                                     style={{
                                       background: '#059669',
                                       color: '#fff',
                                       border: 'none',
                                       padding: '10px 16px',
                                       borderRadius: 12,
                                       fontSize: 13,
                                       fontWeight: 700,
                                       cursor: 'pointer',
                                       display: 'inline-flex',
                                       alignItems: 'center',
                                       gap: 6,
                                       boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
                                     }}
                                   >
                                     <FileText size={16} />
                                     Ver Comprovante
                                   </button>
                                 )}
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
          {(onEdit || onDelete || onForward || canShowReminderButton || destinatariosStr) && (
            <div className="cvm-actions-footer">
              {(onForward || canShowReminderButton) && (
                <div className="cvm-actions-main">
                  {onForward && (
                    <motion.button 
                      className="cvm-action-btn"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={(e: any) => { e.stopPropagation(); onForward(comunicado); }} 
                      style={{ 
                        flex: '1 1 0', 
                        border: '1px solid rgba(99, 102, 241, 0.2)', 
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                        color: '#ffffff', 
                        boxShadow: '0 8px 20px -6px rgba(79, 70, 229, 0.5)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}
                    >
                      <Send size={15} style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Encaminhar</span>
                    </motion.button>
                  )}
                  {canShowReminderButton && (
                    <motion.button
                      type="button"
                      className="cvm-action-btn"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={(e: any) => {
                        e.stopPropagation();
                        setReminderFeedback(null);
                        setReminderMode('all');
                        setShowReminderModal(true);
                      }}
                      title="Enviar nova notificação push de lembrete para os destinatários"
                      aria-label="Lembrete"
                      style={{
                        flex: onForward ? '0 1 auto' : '1 1 0',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#ffffff',
                        boxShadow: '0 8px 20px -6px rgba(217, 119, 6, 0.45)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.12)'
                      }}
                    >
                      <BellRing size={15} style={{ flexShrink: 0 }} />
                      <span>Lembrete</span>
                    </motion.button>
                  )}
                </div>
              )}
              {(destinatariosStr || onEdit || onDelete) && (
                <div className="cvm-actions-icons">
                  {destinatariosStr && (
                    <motion.button 
                      className="cvm-icon-btn"
                      whileHover={{ scale: 1.05, y: -1, background: '#f8fafc' }}
                      whileTap={{ scale: 0.94 }}
                      onClick={(e: any) => { e.stopPropagation(); setShowDestinatariosModal(true); }} 
                      title="Ver Destinatários e Leituras"
                      aria-label="Ver Destinatários e Leituras"
                      style={{ 
                        border: '1px solid #e2e8f0', 
                        background: '#ffffff', 
                        color: '#475569', 
                        boxShadow: '0 4px 12px -4px rgba(0,0,0,0.05)'
                      }}
                    >
                      <Users size={17} />
                    </motion.button>
                  )}
                  {onEdit && (
                    <motion.button 
                      className="cvm-icon-btn"
                      whileHover={{ scale: 1.05, y: -1, background: '#f8fafc' }}
                      whileTap={{ scale: 0.94 }}
                      onClick={(e: any) => { e.stopPropagation(); onEdit(comunicado); }} 
                      title="Editar"
                      aria-label="Editar"
                      style={{ 
                        border: '1px solid #e2e8f0', 
                        background: '#ffffff', 
                        color: '#475569', 
                        boxShadow: '0 4px 12px -4px rgba(0,0,0,0.05)'
                      }}
                    >
                      <Edit2 size={17} />
                    </motion.button>
                  )}
                  {onDelete && (
                    <motion.button 
                      className="cvm-icon-btn"
                      whileHover={{ scale: 1.05, y: -1, background: '#fef2f2', borderColor: '#fca5a5' }}
                      whileTap={{ scale: 0.94 }}
                      onClick={(e: any) => { e.stopPropagation(); onDelete(comunicado.id); }} 
                      title="Excluir"
                      aria-label="Excluir"
                      style={{ 
                        border: '1px solid rgba(239, 68, 68, 0.25)', 
                        background: 'rgba(239, 68, 68, 0.08)', 
                        color: '#ef4444', 
                        boxShadow: '0 4px 12px -4px rgba(239, 68, 68, 0.15)'
                      }}
                    >
                      <Trash2 size={17} />
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>


      <ComunicadoDestinatariosModal
        isOpen={showDestinatariosModal}
        comunicado={comunicado}
        onClose={() => setShowDestinatariosModal(false)}
        alunos={alunos}
        canEditReportOverride={Boolean(onEditReportPayload)}
        onOpenStudentReport={
          setOpenedReportPayload || onEditReportPayload
            ? (payload) => {
                if (payload.editMode && onEditReportPayload) {
                  onEditReportPayload(payload.string)
                } else if (setOpenedReportPayload) {
                  setOpenedReportPayload(payload.string)
                }
              }
            : undefined
        }
        onOpenReminderModal={
          canShowReminderButton
            ? () => {
                setReminderMode(reminderDetectedFeatures.hasRelatorio ? 'unanswered_report' : 'unread')
                setReminderFeedback(null)
                setShowReminderModal(true)
              }
            : undefined
        }
      />

      {/* Modal Nativo (<dialog>) de Confirmação e Envio Inteligente de Lembrete Push */}
      <dialog
        ref={reminderDialogRef}
        className="cvm-reminder-dialog"
        aria-labelledby={reminderDialogTitleId}
        {...({ closedby: 'any' } as any)}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => {
          e.stopPropagation();
          if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) return;
          const dialog = reminderDialogRef.current;
          if (!dialog) return;
          const r = dialog.getBoundingClientRect();
          pressedOutsideReminderDialogRef.current =
            e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        }}
        onPointerUp={e => {
          e.stopPropagation();
          if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) return;
          const dialog = reminderDialogRef.current;
          if (!dialog) {
            pressedOutsideReminderDialogRef.current = false;
            return;
          }
          const r = dialog.getBoundingClientRect();
          const releasedOutside =
            e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          if (pressedOutsideReminderDialogRef.current && releasedOutside) {
            closeReminderModal();
          }
          pressedOutsideReminderDialogRef.current = false;
        }}
        onCancel={e => {
          e.preventDefault();
          closeReminderModal();
        }}
        onClose={() => {
          if (reminderDialogRef.current) {
            reminderDialogRef.current.returnValue = '';
          }
          if (!isSendingReminder) {
            setShowReminderModal(false);
          }
        }}
      >
        {showReminderModal && canShowReminderButton && (() => {
          const srvHist = reminderSummary?.lembretes_historico;
          const localHist = comunicado?.lembretes_historico || comunicado?.dados?.lembretes_historico;
          const remHistory: any[] = Array.isArray(srvHist) && srvHist.length > 0
            ? srvHist
            : Array.isArray(localHist)
              ? localHist
              : [];
          const lastRem = remHistory[0] || null;

          const senderName = currentUserName || comunicado?.autor || 'Equipe Escolar';
          const tituloCom = String(comunicado?.titulo || 'Comunicado').trim();
          const tituloCob = String(reminderDetectedFeatures.cobrancaTitulo || tituloCom).trim();
          const tituloAut = String(reminderDetectedFeatures.autorizacaoTitulo || tituloCom).trim();
          const tituloEnq = String(reminderDetectedFeatures.enquetePergunta || tituloCom).trim();

          // Contagens instantâneas locais enquanto o resumo da API carrega
          let localUnpaidFallback: number | null = null;
          let localTotalCobFallback: number | null = null;
          if (reminderDetectedFeatures.hasCobranca && cobrancasList.length > 0) {
            const firstCobDests = getEffectiveCobDestinatarios(cobrancasList[0]);
            if (firstCobDests.length > 0) {
              localTotalCobFallback = firstCobDests.length;
              const paidCountLocal = firstCobDests.filter((d: any) => isCobrancaPaidStatus(d?.status)).length;
              localUnpaidFallback = Math.max(0, firstCobDests.length - paidCountLocal);
            }
          }

          const srvCounts = reminderSummary?.counts;
          const allCount = typeof srvCounts?.all === 'number' ? srvCounts.all : localTotalCobFallback;
          const unpaidCount = typeof srvCounts?.unpaid === 'number' ? srvCounts.unpaid : localUnpaidFallback;
          const paidCount = typeof srvCounts?.paid === 'number'
            ? srvCounts.paid
            : (localTotalCobFallback !== null && localUnpaidFallback !== null ? Math.max(0, localTotalCobFallback - localUnpaidFallback) : null);
          const unauthCount = typeof srvCounts?.unanswered_auth === 'number' ? srvCounts.unanswered_auth : null;
          const answeredAuthCount = typeof srvCounts?.answered_auth === 'number' ? srvCounts.answered_auth : null;
          const unreportCount = typeof srvCounts?.unanswered_report === 'number' ? srvCounts.unanswered_report : null;
          const answeredReportCount = typeof srvCounts?.answered_report === 'number' ? srvCounts.answered_report : null;
          const unpollCount = typeof srvCounts?.unanswered_poll === 'number' ? srvCounts.unanswered_poll : null;
          const answeredPollCount = typeof srvCounts?.answered_poll === 'number' ? srvCounts.answered_poll : null;
          const unreadCount = typeof srvCounts?.unread === 'number' ? srvCounts.unread : null;

          type ReminderOptionCard = {
            mode: ComunicadoReminderMode;
            title: string;
            description: string;
            count: number | null;
            completedHint?: string | null;
            icon: React.ReactNode;
            accentColor: string;
            accentBg: string;
          };

          const optionsList: ReminderOptionCard[] = [
            {
              mode: 'all',
              title: 'Todos os destinatários',
              description: reminderDetectedFeatures.isReport
                ? 'Reenvia o alerta push para todos os destinatários deste relatório'
                : 'Reenvia o alerta push para todos os destinatários deste comunicado',
              count: allCount,
              icon: <Users size={16} />,
              accentColor: '#d97706',
              accentBg: '#fef3c7',
            },
          ];

          if (reminderDetectedFeatures.hasCobranca) {
            optionsList.push({
              mode: 'unpaid',
              title: 'Apenas não pagos',
              description:
                paidCount !== null && paidCount > 0
                  ? `Envia somente para os responsáveis com pagamento pendente (${paidCount} já confirmados)`
                  : 'Envia somente para os responsáveis com pagamento pendente nesta cobrança',
              count: unpaidCount,
              completedHint: unpaidCount === 0 ? 'Todos quitados' : null,
              icon: <CreditCard size={16} />,
              accentColor: '#059669',
              accentBg: '#d1fae5',
            });
          }

          if (reminderDetectedFeatures.hasAutorizacao) {
            optionsList.push({
              mode: 'unanswered_auth',
              title: 'Apenas sem autorização',
              description:
                answeredAuthCount !== null && answeredAuthCount > 0
                  ? `Envia somente para os responsáveis que ainda não assinaram a autorização (${answeredAuthCount} já responderam)`
                  : 'Envia somente para os responsáveis que ainda não responderam/assinaram a autorização',
              count: unauthCount,
              completedHint: unauthCount === 0 ? 'Todos assinaram' : null,
              icon: <ShieldCheck size={16} />,
              accentColor: '#4f46e5',
              accentBg: '#e0e7ff',
            });
          }

          if (reminderDetectedFeatures.hasRelatorio) {
            optionsList.push({
              mode: 'unanswered_report',
              title: 'Apenas sem resposta dos relatórios',
              description:
                answeredReportCount !== null && answeredReportCount > 0
                  ? `Envia somente para quem ainda não enviou resposta ou ciência no relatório (${answeredReportCount} já responderam)`
                  : 'Envia somente para quem ainda não enviou resposta ou confirmação neste relatório',
              count: unreportCount,
              completedHint: unreportCount === 0 ? 'Todos responderam' : null,
              icon: <FileText size={16} />,
              accentColor: '#7c3aed',
              accentBg: '#ede9fe',
            });
          }

          if (reminderDetectedFeatures.hasEnquete) {
            optionsList.push({
              mode: 'unanswered_poll',
              title: 'Apenas sem resposta na enquete',
              description:
                answeredPollCount !== null && answeredPollCount > 0
                  ? `Envia somente para quem ainda não votou na enquete (${answeredPollCount} já votaram)`
                  : 'Envia somente para quem ainda não registrou voto nesta enquete',
              count: unpollCount,
              completedHint: unpollCount === 0 ? 'Todos votaram' : null,
              icon: <Vote size={16} />,
              accentColor: '#0284c7',
              accentBg: '#e0f2fe',
            });
          }

          optionsList.push({
            mode: 'unread',
            title: reminderDetectedFeatures.exigeCiencia
              ? 'Apenas sem leitura ou ciência'
              : 'Apenas quem ainda não leu',
            description: reminderDetectedFeatures.exigeCiencia
              ? 'Envia somente para quem ainda não abriu ou não confirmou ciência'
              : reminderDetectedFeatures.isReport
                ? 'Ignora quem já visualizou o relatório e notifica apenas quem não abriu'
                : 'Ignora quem já abriu o comunicado e notifica apenas os não lidos',
            count: unreadCount,
            completedHint: unreadCount === 0 ? 'Todos visualizaram' : null,
            icon: <BellRing size={16} />,
            accentColor: '#ea580c',
            accentBg: '#ffedd5',
          });

          const activeOption = optionsList.find(o => o.mode === reminderMode) || optionsList[0];
          const isSelectedZeroTargets = activeOption && typeof activeOption.count === 'number' && activeOption.count === 0;

          const previewTitle =
            reminderMode === 'unpaid'
              ? `💳 Pagamento pendente: ${tituloCob}`
              : reminderMode === 'unanswered_auth'
                ? `✍️ Autorização pendente: ${tituloAut}`
                : reminderMode === 'unanswered_report'
                  ? `📋 Relatório pendente: ${tituloCom}`
                  : reminderMode === 'unanswered_poll'
                    ? `📊 Enquete pendente: ${tituloCom}`
                    : `🔔 Lembrete: ${tituloCom}`;

          const trimmedCustom = reminderCustomMsg.trim();
          const previewBody = trimmedCustom
            ? `Nome do aluno: ${trimmedCustom}`
            : reminderMode === 'unpaid'
              ? `Lembrete de ${senderName}: há uma cobrança pendente ("${tituloCob}") referente a Nome do aluno na Agenda Digital. Toque para conferir!`
              : reminderMode === 'unanswered_auth'
                ? `A autorização "${tituloAut}" referente a Nome do aluno aguarda sua assinatura na Agenda Digital. Toque para responder!`
                : reminderMode === 'unanswered_report'
                  ? `Lembrete de ${senderName}: o relatório "${tituloCom}" de Nome do aluno aguarda sua resposta na Agenda Digital. Toque para abrir!`
                  : reminderMode === 'unanswered_poll'
                    ? `A enquete "${tituloEnq}" referente a Nome do aluno aguarda sua participação na Agenda Digital. Toque para votar!`
                    : reminderDetectedFeatures.isReport
                      ? `Lembrete de ${senderName}: confira o relatório "${tituloCom}" de Nome do aluno. Toque para abrir!`
                      : `Lembrete de ${senderName}: confira o comunicado "${tituloCom}" para Nome do aluno. Toque para abrir!`;

          const lastRemModeLabel = lastRem?.modeLabel || (
            lastRem?.mode === 'unpaid'
              ? 'Apenas não pagos'
              : lastRem?.mode === 'unanswered_auth'
                ? 'Apenas sem autorização'
                : lastRem?.mode === 'unanswered_report'
                  ? 'Sem resposta dos relatórios'
                  : lastRem?.mode === 'unanswered_poll'
                    ? 'Sem resposta na enquete'
                    : lastRem?.mode === 'unread'
                      ? 'Apenas não lidos'
                      : null
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'inherit', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{
                padding: '18px 22px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <BellRing size={21} color="#ffffff" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h1 id={reminderDialogTitleId} style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#ffffff' }}>
                      Enviar lembrete push
                    </h1>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.92)', fontWeight: 500 }}>
                      Escolha o público-alvo para disparar a notificação no celular
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSendingReminder}
                  onClick={closeReminderModal}
                  aria-label="Fechar modal de lembrete"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: 'none',
                    background: 'rgba(255, 255, 255, 0.22)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isSendingReminder ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15, flex: 1 }}>
                {lastRem && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    fontSize: 12,
                    color: '#92400e',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}>
                    <Clock size={14} style={{ flexShrink: 0, color: '#d97706', marginTop: 1 }} />
                    <span>
                      Último lembrete
                      {lastRemModeLabel ? ` (${lastRemModeLabel})` : ''} em{' '}
                      {new Date(lastRem.sentAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {lastRem.sentByName ? ` por ${lastRem.sentByName}` : ''}
                      {typeof lastRem.sent === 'number' ? ` • ${lastRem.sent} enviado${lastRem.sent === 1 ? '' : 's'}` : ''}
                    </span>
                  </div>
                )}

                {/* Público-alvo dinâmico */}
                <fieldset style={{ border: 'none', margin: 0, padding: 0, minInlineSize: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <legend style={{ padding: 0, fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Quem deve receber o lembrete?
                    </legend>
                    {isLoadingReminderSummary && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                        <Loader2 size={12} className="animate-spin" />
                        Calculando pendentes...
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    {optionsList.map((opt) => {
                      const isSelected = reminderMode === opt.mode;
                      const isZero = typeof opt.count === 'number' && opt.count === 0;
                      const isDisabledCard = isSendingReminder || isZero;

                      return (
                        <label
                          key={opt.mode}
                          className="cvm-reminder-opt"
                          style={{
                            position: 'relative',
                            textAlign: 'left',
                            padding: '11px 13px',
                            borderRadius: 14,
                            border: isSelected ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                            background: isZero ? '#f8fafc' : isSelected ? '#fffbeb' : '#ffffff',
                            opacity: isZero ? 0.72 : 1,
                            cursor: isDisabledCard ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 11,
                            transition: 'border-color 0.15s ease, background-color 0.15s ease',
                          }}
                        >
                          <input
                            type="radio"
                            name="cvm-reminder-mode"
                            value={opt.mode}
                            checked={isSelected}
                            disabled={isDisabledCard}
                            autoFocus={isSelected}
                            onChange={() => {
                              setReminderFeedback(null);
                              setReminderMode(opt.mode);
                            }}
                            style={{
                              position: 'absolute',
                              opacity: 0,
                              width: 1,
                              height: 1,
                              margin: 0,
                              pointerEvents: 'none',
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, minWidth: 0, flex: 1 }}>
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              background: isZero ? '#dcfce7' : opt.accentBg,
                              color: isZero ? '#16a34a' : opt.accentColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 1,
                            }}>
                              {isZero ? <CheckCircle2 size={16} /> : opt.icon}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                                  {opt.title}
                                </span>
                                {typeof opt.count === 'number' && (
                                  <span style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    background: isZero ? '#dcfce7' : isSelected ? '#fde68a' : '#f1f5f9',
                                    color: isZero ? '#166534' : isSelected ? '#92400e' : '#475569',
                                  }}>
                                    {isZero
                                      ? (opt.completedHint || '0 pendentes')
                                      : opt.mode === 'all'
                                        ? `${opt.count} ${opt.count === 1 ? 'destinatário' : 'destinatários'}`
                                        : `${opt.count} ${opt.count === 1 ? 'pendente' : 'pendentes'}`}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.35 }}>
                                {opt.description}
                              </div>
                            </div>
                          </div>

                          <div style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            border: isSelected ? '5px solid #f59e0b' : '2px solid #cbd5e1',
                            background: '#ffffff',
                            flexShrink: 0,
                          }} />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Alertas contextuais preventivos */}
                {reminderMode === 'unanswered_auth' && reminderDetectedFeatures.autorizacaoClosed && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    fontSize: 12,
                    color: '#92400e',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: '#d97706' }} />
                    <span>
                      O prazo desta autorização consta como encerrado. Se desejar que os responsáveis consigam assinar ao abrir o lembrete, reabra o prazo no card da autorização.
                    </span>
                  </div>
                )}

                {reminderMode === 'unanswered_poll' && reminderDetectedFeatures.enqueteClosed && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    fontSize: 12,
                    color: '#92400e',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: '#d97706' }} />
                    <span>
                      Esta enquete consta como encerrada. Reabra a enquete caso deseje permitir novos votos.
                    </span>
                  </div>
                )}

                {reminderMode === 'unpaid' && reminderDetectedFeatures.cobrancaOverdue && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    color: '#334155',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}>
                    <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: '#475569' }} />
                    <span>
                      Esta cobrança encontra-se vencida. Os responsáveis com pagamento em aberto receberão o alerta da pendência e abrirão diretamente este comunicado.
                    </span>
                  </div>
                )}

                {/* Mensagem personalizada opcional */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label htmlFor="cvm-reminder-custom-msg" style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Mensagem personalizada (opcional)
                    </label>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                      {reminderCustomMsg.length}/160
                    </span>
                  </div>
                  <input
                    id="cvm-reminder-custom-msg"
                    type="text"
                    maxLength={160}
                    disabled={isSendingReminder}
                    value={reminderCustomMsg}
                    onChange={e => setReminderCustomMsg(e.target.value)}
                    placeholder={
                      reminderMode === 'unpaid'
                        ? 'Ex: Lembramos que o pagamento segue pendente. Em caso de dúvida, fale com a secretaria!'
                        : reminderMode === 'unanswered_auth'
                          ? 'Ex: Último dia para assinar a autorização na Agenda Digital!'
                          : reminderMode === 'unanswered_report'
                            ? 'Ex: Confira o relatório pedagógico e envie sua resposta ou observação!'
                            : 'Ex: Último dia para confirmação é 20/11!'
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Prévia da notificação */}
                <div style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  borderRadius: 16,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Prévia da notificação no celular • Ao tocar abre este comunicado
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#ffffff', lineHeight: 1.3 }}>
                    {previewTitle}
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
                    {previewBody}
                  </div>
                </div>

                {reminderFeedback && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '11px 13px',
                    borderRadius: 12,
                    fontSize: 12.5,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    background:
                      reminderFeedback.type === 'success'
                        ? '#f0fdf4'
                        : reminderFeedback.type === 'warning'
                          ? '#fffbeb'
                          : '#fef2f2',
                    border:
                      reminderFeedback.type === 'success'
                        ? '1px solid #bbf7d0'
                        : reminderFeedback.type === 'warning'
                          ? '1px solid #fde68a'
                          : '1px solid #fecaca',
                    color:
                      reminderFeedback.type === 'success'
                        ? '#166534'
                        : reminderFeedback.type === 'warning'
                          ? '#92400e'
                          : '#b91c1c',
                  }}>
                    {reminderFeedback.type === 'success' ? (
                      <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    ) : (
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    )}
                    <span>{reminderFeedback.text}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '14px 22px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10,
                flexShrink: 0,
              }}>
                <button
                  type="button"
                  disabled={isSendingReminder}
                  onClick={closeReminderModal}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: isSendingReminder ? 'not-allowed' : 'pointer',
                  }}
                >
                  {reminderFeedback?.type === 'success' ? 'Fechar' : 'Cancelar'}
                </button>
                <button
                  type="button"
                  disabled={isSendingReminder || Boolean(isSelectedZeroTargets)}
                  onClick={handleTriggerSendReminder}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: 'none',
                    background: isSelectedZeroTargets
                      ? '#cbd5e1'
                      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: isSelectedZeroTargets ? '#64748b' : '#ffffff',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: isSendingReminder ? 'wait' : isSelectedZeroTargets ? 'not-allowed' : 'pointer',
                    opacity: isSendingReminder ? 0.8 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: isSelectedZeroTargets ? 'none' : '0 6px 16px -4px rgba(217, 119, 6, 0.45)',
                  }}
                >
                  {isSendingReminder ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <BellRing size={16} />
                      <span>
                        {isSelectedZeroTargets
                          ? 'Sem pendentes nesta opção'
                          : reminderFeedback?.type === 'success'
                            ? 'Enviar novamente'
                            : typeof activeOption?.count === 'number' && activeOption.count > 0
                              ? `Disparar lembrete (${activeOption.count})`
                              : 'Disparar lembrete'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </dialog>
      <style dangerouslySetInnerHTML={{ __html: `
        dialog.cvm-reminder-dialog {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 0;
          width: calc(100% - 28px);
          max-width: 520px;
          max-height: min(90dvh, 760px);
          margin: auto;
          background: #ffffff;
          color: #0f172a;
          overflow: hidden;
          box-sizing: border-box;
          box-shadow: 0 25px 60px -12px rgba(15, 23, 42, 0.38);
        }
        dialog.cvm-reminder-dialog[open] {
          display: flex;
          flex-direction: column;
        }
        dialog.cvm-reminder-dialog:modal {
          overscroll-behavior: contain;
        }
        dialog.cvm-reminder-dialog::backdrop {
          background-color: rgba(15, 23, 42, 0.62);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          overflow: hidden;
          overscroll-behavior: contain;
        }
        label.cvm-reminder-opt:has(input:focus-visible) {
          outline: 2px solid #f59e0b;
          outline-offset: 2px;
        }
        @media (max-width: 639px) {
          dialog.cvm-reminder-dialog {
            width: 100%;
            max-width: 100%;
            margin: auto 0 0 0;
            border-radius: 22px 22px 0 0;
            max-height: min(92dvh, calc(100dvh - max(10px, env(safe-area-inset-top, 0px))));
          }
        }
        dialog.cvm-cob-dialog {
          border: none;
          padding: 0;
          background: #ffffff;
          color: #0f172a;
          overflow: hidden;
          box-sizing: border-box;
          box-shadow: 0 25px 60px -12px rgba(15, 23, 42, 0.4);
          opacity: 0;
          transition-property: opacity, transform, display, overlay;
          transition-duration: 0.24s;
          transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          transition-behavior: allow-discrete;
        }
        dialog.cvm-cob-dialog[open] {
          display: flex;
          flex-direction: column;
        }
        dialog.cvm-cob-dialog[open]:not(:modal) {
          position: fixed;
          inset: 0;
          z-index: 100100;
        }
        dialog.cvm-cob-dialog:modal {
          overscroll-behavior: contain;
        }
        dialog.cvm-cob-dialog::backdrop {
          background-color: rgba(15, 23, 42, 0);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          overflow: hidden;
          overscroll-behavior: contain;
          transition-property: background-color, display, overlay;
          transition-duration: 0.24s;
          transition-timing-function: ease-out;
          transition-behavior: allow-discrete;
        }
        @media (max-width: 639px) {
          dialog.cvm-cob-dialog {
            width: 100%;
            max-width: 100%;
            margin: auto 0 0 0;
            border-radius: 22px 22px 0 0;
            border-top: 1px solid rgba(255, 255, 255, 0.14);
            height: 92vh;
            height: min(92dvh, calc(100dvh - max(10px, env(safe-area-inset-top, 0px))));
            max-height: 94vh;
            max-height: min(94dvh, calc(100dvh - max(10px, env(safe-area-inset-top, 0px))));
          }
          .cvm-cob-desktop-only {
            display: none !important;
          }
        }
        @media (max-width: 639px) and (prefers-reduced-motion: no-preference) {
          dialog.cvm-cob-dialog {
            transform: translateY(28px);
          }
        }
        @media (min-width: 640px) {
          dialog.cvm-cob-dialog {
            width: min(1040px, calc(100vw - 32px));
            max-width: 1040px;
            max-height: 90vh;
            max-height: min(90dvh, 880px);
            margin: auto;
            border-radius: 22px;
            border: 1px solid #e2e8f0;
          }
          .cvm-cob-mobile-only {
            display: none !important;
          }
        }
        @media (min-width: 640px) and (prefers-reduced-motion: no-preference) {
          dialog.cvm-cob-dialog {
            transform: scale(0.96);
          }
        }
        dialog.cvm-cob-dialog[open]:where(:not([data-closing])) {
          opacity: 1;
        }
        @media (prefers-reduced-motion: no-preference) {
          dialog.cvm-cob-dialog[open]:where(:not([data-closing])) {
            transform: none;
          }
        }
        dialog.cvm-cob-dialog[open]:where(:not([data-closing]))::backdrop {
          background-color: rgba(15, 23, 42, 0.68);
        }
        @starting-style {
          dialog.cvm-cob-dialog[open]:where(:not([data-closing])) {
            opacity: 0;
          }
          dialog.cvm-cob-dialog[open]:where(:not([data-closing]))::backdrop {
            background-color: rgba(15, 23, 42, 0);
          }
        }
        @media (max-width: 639px) and (prefers-reduced-motion: no-preference) {
          @starting-style {
            dialog.cvm-cob-dialog[open]:where(:not([data-closing])) {
              transform: translateY(28px);
            }
          }
        }
        @media (min-width: 640px) and (prefers-reduced-motion: no-preference) {
          @starting-style {
            dialog.cvm-cob-dialog[open]:where(:not([data-closing])) {
              transform: scale(0.96);
            }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          dialog.cvm-cob-dialog,
          dialog.cvm-cob-dialog::backdrop {
            transition-duration: 0.1s;
          }
        }
        .cvm-cob-header {
          padding: 8px 14px 10px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }
        .cvm-cob-sheet-handle {
          width: 36px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.24);
          margin: 0 auto 2px;
          flex-shrink: 0;
        }
        .cvm-cob-header-main {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .cvm-cob-scroll-area {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          scroll-padding-top: 96px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
        }
        .cvm-cob-overview {
          padding: 10px 14px 8px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cvm-cob-kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }
        .cvm-cob-kpi-btn {
          text-align: left;
          cursor: pointer;
          border-radius: 10px;
          padding: 7px 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 3px;
          min-width: 0;
          transition: border-color 0.15s ease, transform 0.12s ease;
        }
        .cvm-cob-sticky-toolbar {
          position: sticky;
          top: 0;
          z-index: 15;
          padding: 8px 14px 10px;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cvm-cob-tabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          background: #f1f5f9;
          padding: 3px;
          border-radius: 10px;
          gap: 2px;
          border: 1px solid #e2e8f0;
          width: 100%;
          box-sizing: border-box;
        }
        .cvm-cob-tab-btn {
          padding: 6px 4px;
          min-height: 32px;
          border-radius: 7px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .cvm-cob-search-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }
        .cvm-cob-search-box {
          flex: 1 1 0%;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 0 9px;
          min-height: 38px;
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }
        .cvm-cob-search-box:focus-within {
          background: #ffffff;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.14);
        }
        .cvm-cob-search-input {
          border: none;
          outline: none;
          width: 100%;
          min-width: 0;
          font-size: 16px;
          color: #0f172a;
          background: transparent;
          padding: 6px 0;
        }
        .cvm-cob-turma-select {
          flex: 0 0 auto;
          max-width: 136px;
          min-height: 38px;
          padding: 0 8px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          cursor: pointer;
          text-overflow: ellipsis;
        }
        .cvm-cob-list {
          padding: 10px 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          container: cob-list / inline-size;
        }
        .cvm-cob-card-main {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cvm-cob-actions-row {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }
        .cvm-cob-row-btn {
          min-height: 33px;
          padding: 0 9px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          white-space: nowrap;
        }
        .cvm-cob-details {
          padding-left: 0;
        }
        .cvm-cob-hit {
          position: relative;
        }
        @media (pointer: coarse) {
          .cvm-cob-hit::after {
            content: "";
            position: absolute;
            inset: -6px;
          }
        }
        @container cob-list (inline-size > 580px) {
          .cvm-cob-card-main {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
        }
        @media (min-width: 640px) {
          .cvm-cob-header {
            padding: 14px 20px;
          }
          .cvm-cob-overview {
            padding: 12px 20px 8px;
            gap: 10px;
          }
          .cvm-cob-kpi-grid {
            gap: 10px;
          }
          .cvm-cob-kpi-btn {
            padding: 9px 13px;
            flex-direction: row;
            align-items: center;
            gap: 8px;
          }
          .cvm-cob-sticky-toolbar {
            padding: 8px 20px 12px;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }
          .cvm-cob-tabs {
            display: inline-flex;
            width: auto;
            flex-shrink: 0;
          }
          .cvm-cob-tab-btn {
            padding: 5px 11px;
          }
          .cvm-cob-search-row {
            flex: 1 1 260px;
            justify-content: flex-end;
          }
          .cvm-cob-search-box {
            max-width: 310px;
            min-height: 34px;
          }
          .cvm-cob-search-input {
            font-size: 12.5px;
          }
          .cvm-cob-turma-select {
            max-width: 210px;
            min-height: 34px;
            font-size: 12px;
            padding: 0 10px;
          }
          .cvm-cob-list {
            padding: 12px 20px 16px;
          }
          .cvm-cob-details {
            padding-left: 44px;
          }
          .cvm-cob-scroll-area {
            scroll-padding-top: 64px;
          }
        }
      ` }} />

      <dialog
        ref={cobDialogRef}
        className="cvm-cob-dialog"
        aria-labelledby={cobDialogTitleId}
        {...({ closedby: 'any' } as any)}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => {
          e.stopPropagation();
          if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) return;
          const dialog = cobDialogRef.current;
          if (!dialog) return;
          const r = dialog.getBoundingClientRect();
          pressedOutsideCobDialogRef.current =
            e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        }}
        onPointerUp={e => {
          e.stopPropagation();
          if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) return;
          const dialog = cobDialogRef.current;
          if (!dialog) {
            pressedOutsideCobDialogRef.current = false;
            return;
          }
          const r = dialog.getBoundingClientRect();
          const releasedOutside =
            e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          if (pressedOutsideCobDialogRef.current && releasedOutside) {
            void closeCobModal();
          }
          pressedOutsideCobDialogRef.current = false;
        }}
        onCancel={e => {
          e.preventDefault();
          void closeCobModal();
        }}
        onClose={() => {
          if (cobDialogRef.current) {
            cobDialogRef.current.returnValue = '';
          }
          setSelectedCobrancaModalId(null);
        }}
      >
        {selectedCobrancaModalId && (() => {
          const activeCob = (cobrancasList || []).find((c: any) => String(c.id) === String(selectedCobrancaModalId)) || cobrancasList?.[0];
          if (!activeCob) return null;

          const rawDests = getEffectiveCobDestinatarios(activeCob);
          const allResolved = rawDests
            .map((dest: any) => ({ dest, info: resolveCobDestInfo(dest, activeCob) }))
            .sort((a, b) => {
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
          const fmtBRL = (val: number) =>
            Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
            <>
              {/* Modal Header */}
              <div className="cvm-cob-header">
                <div className="cvm-cob-sheet-handle cvm-cob-mobile-only" aria-hidden="true" />

                <div className="cvm-cob-header-main">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: 'rgba(16, 185, 129, 0.18)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1
                    }} aria-hidden="true">
                      <CreditCard size={17} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#6ee7b7',
                          padding: '2px 7px',
                          borderRadius: 999
                        }}>
                          Controle de Pagantes
                        </span>
                        {activeCob.vencimento && (
                          <span style={{ fontSize: 11, color: isCobOverdue ? '#fca5a5' : '#cbd5e1', fontWeight: 600 }}>
                            Venc: {new Date(activeCob.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </span>
                        )}
                      </div>

                      <h1
                        id={cobDialogTitleId}
                        style={{
                          margin: 0,
                          fontSize: 15.5,
                          fontWeight: 800,
                          color: '#ffffff',
                          lineHeight: 1.25,
                          overflowWrap: 'break-word',
                          textWrap: 'balance' as any
                        }}
                      >
                        {activeCob.titulo || 'Cobrança'} — <span style={{ color: '#6ee7b7', whiteSpace: 'nowrap' }}>R$ {fmtBRL(valorUnit)}</span>
                      </h1>
                    </div>
                  </div>

                  {/* Desktop inline utilities + Always top-right Close Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div className="cvm-cob-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleSyncCobDestinatarios(String(activeCob.id))}
                        disabled={isSyncingThis}
                        title="Sincronizar lista de alunos destinatários com as turmas do comunicado"
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          color: '#f8fafc',
                          border: '1px solid rgba(255,255,255,0.18)',
                          minHeight: 34,
                          padding: '0 10px',
                          borderRadius: 9,
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: isSyncingThis ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <RefreshCw size={13} aria-hidden="true" style={{ animation: isSyncingThis ? 'spin 1s linear infinite' : 'none' }} />
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
                          minHeight: 34,
                          padding: '0 10px',
                          borderRadius: 9,
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <FileSpreadsheet size={13} aria-hidden="true" />
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
                          minHeight: 34,
                          padding: '0 10px',
                          borderRadius: 9,
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <Printer size={13} aria-hidden="true" />
                        <span>Imprimir</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="cvm-cob-hit"
                      onClick={() => void closeCobModal()}
                      aria-label="Fechar modal de pagantes"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.12)',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Mobile Compact Quick-Action Strip */}
                <div className="cvm-cob-mobile-only" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleSyncCobDestinatarios(String(activeCob.id))}
                    disabled={isSyncingThis}
                    style={{
                      flex: 1,
                      minHeight: 32,
                      background: 'rgba(255,255,255,0.1)',
                      color: '#f8fafc',
                      border: '1px solid rgba(255,255,255,0.16)',
                      padding: '0 9px',
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: isSyncingThis ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <RefreshCw size={12} aria-hidden="true" style={{ animation: isSyncingThis ? 'spin 1s linear infinite' : 'none' }} />
                    <span>{isSyncingThis ? 'Sincronizando...' : 'Sincronizar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportCobXlsx(activeCob, filteredRows)}
                    style={{
                      minHeight: 32,
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#6ee7b7',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      padding: '0 10px',
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <FileSpreadsheet size={12} aria-hidden="true" />
                    <span>Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintCobPayers(activeCob, cobModalFilter)}
                    style={{
                      minHeight: 32,
                      background: 'rgba(255,255,255,0.1)',
                      color: '#f8fafc',
                      border: '1px solid rgba(255,255,255,0.16)',
                      padding: '0 10px',
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Printer size={12} aria-hidden="true" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>

              {/* Unified Scroll Area: KPI Overview glides away on mobile scroll while Filter+Search stays sticky */}
              <div className="cvm-cob-scroll-area">
                <div className="cvm-cob-overview">
                  {/* 3 Balanced Financial KPIs (Single compact row on mobile AND desktop) */}
                  <div className="cvm-cob-kpi-grid">
                    <button
                      type="button"
                      className="cvm-cob-kpi-btn"
                      onClick={() => setCobModalFilter('ALL')}
                      style={{
                        background: cobModalFilter === 'ALL' ? '#f8fafc' : '#ffffff',
                        border: cobModalFilter === 'ALL' ? '1.5px solid #0f172a' : '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Previsto ({totalEnviados})
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', marginTop: 1, whiteSpace: 'nowrap' }}>
                          R$ {fmtBRL(valorEsperado)}
                        </div>
                      </div>
                      <div className="cvm-cob-desktop-only" style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textAlign: 'right' }}>
                        <div>Destinatários</div>
                        <div style={{ color: '#0f172a' }}>{totalEnviados} alunos</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="cvm-cob-kpi-btn"
                      onClick={() => setCobModalFilter('PAID')}
                      style={{
                        background: '#f0fdf4',
                        border: cobModalFilter === 'PAID' ? '1.5px solid #16a34a' : '1px solid #bbf7d0'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Recebido ({pctPaid.label})
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#15803d', marginTop: 1, whiteSpace: 'nowrap' }}>
                          R$ {fmtBRL(valorRecebido)}
                        </div>
                      </div>
                      <div className="cvm-cob-desktop-only" style={{ fontSize: 11, color: '#166534', fontWeight: 700, textAlign: 'right' }}>
                        <div>Confirmados</div>
                        <div>{totalPagos}/{totalEnviados}</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="cvm-cob-kpi-btn"
                      onClick={() => setCobModalFilter('PENDING')}
                      style={{
                        background: '#fffbeb',
                        border: cobModalFilter === 'PENDING' ? '1.5px solid #d97706' : '1px solid #fde68a'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Em Aberto ({totalPendentes})
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#b45309', marginTop: 1, whiteSpace: 'nowrap' }}>
                          R$ {fmtBRL(valorPendente)}
                        </div>
                      </div>
                      <div className="cvm-cob-desktop-only" style={{ fontSize: 11, color: '#92400e', fontWeight: 700, textAlign: 'right' }}>
                        <div>Pendentes</div>
                        <div>{totalPendentes} alunos</div>
                      </div>
                    </button>
                  </div>

                  {/* Slim Semantic Progress Bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="cvm-cob-desktop-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                      <span>Progresso: <strong style={{ color: '#0f172a' }}>{totalPagos}/{totalEnviados}</strong> ({pctPaid.label})</span>
                      <span style={{ color: '#059669' }}>R$ {fmtBRL(valorRecebido)} / R$ {fmtBRL(valorEsperado)}</span>
                    </div>
                    <progress
                      className="cvm-cob-progress"
                      style={{ height: 6 }}
                      max={Math.max(totalEnviados, 1)}
                      value={totalPagos}
                      aria-label={`Progresso de pagantes: ${totalPagos} de ${totalEnviados}`}
                    />
                  </div>
                </div>

                {/* Sticky Filter + Full-Width Search & Turma Row */}
                <div className="cvm-cob-sticky-toolbar">
                  <div className="cvm-cob-tabs" role="group" aria-label="Filtrar destinatários por status">
                    <button
                      type="button"
                      className="cvm-cob-tab-btn"
                      aria-pressed={cobModalFilter === 'ALL'}
                      onClick={() => setCobModalFilter('ALL')}
                      style={{
                        background: cobModalFilter === 'ALL' ? '#0f172a' : 'transparent',
                        color: cobModalFilter === 'ALL' ? '#ffffff' : '#475569'
                      }}
                    >
                      Todos ({totalEnviados})
                    </button>
                    <button
                      type="button"
                      className="cvm-cob-tab-btn"
                      aria-pressed={cobModalFilter === 'PAID'}
                      onClick={() => setCobModalFilter('PAID')}
                      style={{
                        background: cobModalFilter === 'PAID' ? '#16a34a' : 'transparent',
                        color: cobModalFilter === 'PAID' ? '#ffffff' : '#15803d'
                      }}
                    >
                      ✓ Pagos ({totalPagos})
                    </button>
                    <button
                      type="button"
                      className="cvm-cob-tab-btn"
                      aria-pressed={cobModalFilter === 'PENDING'}
                      onClick={() => setCobModalFilter('PENDING')}
                      style={{
                        background: cobModalFilter === 'PENDING' ? '#d97706' : 'transparent',
                        color: cobModalFilter === 'PENDING' ? '#ffffff' : '#b45309'
                      }}
                    >
                      ⏳ Pend. ({totalPendentes})
                    </button>
                  </div>

                  <div className="cvm-cob-search-row">
                    <div className="cvm-cob-search-box">
                      <Search size={14} color="#64748b" aria-hidden="true" style={{ flexShrink: 0 }} />
                      <input
                        type="search"
                        className="cvm-cob-search-input"
                        aria-label="Buscar aluno, pagador ou responsável"
                        value={cobModalSearch}
                        onChange={e => setCobModalSearch(e.target.value)}
                        placeholder="Buscar aluno ou pagador..."
                      />
                      {cobModalSearch && (
                        <button
                          type="button"
                          className="cvm-cob-hit"
                          onClick={() => setCobModalSearch('')}
                          aria-label="Limpar busca"
                          style={{
                            background: '#e2e8f0',
                            border: 'none',
                            borderRadius: '50%',
                            width: 20,
                            height: 20,
                            cursor: 'pointer',
                            color: '#475569',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {availableTurmas.length > 1 && (
                      <select
                        value={cobModalTurmaFilter}
                        onChange={e => setCobModalTurmaFilter(e.target.value)}
                        aria-label="Filtrar por turma"
                        className="cvm-cob-turma-select"
                      >
                        <option value="ALL">Turmas ({availableTurmas.length})</option>
                        {availableTurmas.map(tm => (
                          <option key={tm} value={tm}>{tm}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Payers & Recipients List Body */}
                <div className="cvm-cob-list">
                  {filteredRows.length === 0 ? (
                    <div style={{
                      padding: '32px 18px',
                      textAlign: 'center',
                      color: '#64748b',
                      background: '#ffffff',
                      borderRadius: 14,
                      border: '1px dashed #cbd5e1'
                    }}>
                      <Users size={30} aria-hidden="true" style={{ margin: '0 auto 8px', opacity: 0.45, display: 'block' }} />
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        {cobModalFilter === 'PAID'
                          ? 'Nenhum pagante confirmado encontrado para este filtro.'
                          : cobModalFilter === 'PENDING'
                          ? 'Nenhum aluno pendente encontrado para este filtro.'
                          : 'Nenhum destinatário localizado.'}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: totalEnviados === 0 ? 12 : 0 }}>
                        {totalEnviados === 0
                          ? 'Toque em "Sincronizar" para vincular os alunos das turmas deste comunicado.'
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
                            minHeight: 36,
                            padding: '0 14px',
                            borderRadius: 9,
                            fontSize: 12,
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
                      const cardStatusClass = info.isPaid ? 'is-paid' : isCobOverdue ? 'is-overdue' : '';

                      return (
                        <div key={rowKey} className={`cvm-cob-card ${cardStatusClass}`}>
                          <div className="cvm-cob-card-main">
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                              <UserAvatar userId={info.cleanId} name={info.nome} fotoUrl={info.foto} size={34} />
                              <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {/* Line 1: Student Name + Status Pill */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', overflowWrap: 'break-word' }}>
                                    {info.nome}
                                  </span>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: 999,
                                    background: info.isPaid ? '#16a34a' : isCobOverdue ? '#fee2e2' : '#fef3c7',
                                    color: info.isPaid ? '#ffffff' : isCobOverdue ? '#b91c1c' : '#b45309',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.3,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {info.isPaid ? '✓ Pago' : isCobOverdue ? 'Vencido' : 'Pendente'}
                                  </span>
                                </div>

                                {/* Line 2: Turma & Authorization Chips */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                  {info.turma && (
                                    <span style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '1px 7px',
                                      borderRadius: 6,
                                      background: '#eff6ff',
                                      color: '#2563eb'
                                    }}>
                                      {info.turma}
                                    </span>
                                  )}
                                  {info.autResp && (
                                    <span style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 6,
                                      background: info.autResp.status === 'AUTHORIZED' ? '#dcfce7' : '#fee2e2',
                                      color: info.autResp.status === 'AUTHORIZED' ? '#166534' : '#991b1b'
                                    }}>
                                      {info.autResp.status === 'AUTHORIZED' ? 'Aut: Sim' : 'Aut: Não'}
                                    </span>
                                  )}
                                </div>

                                {/* Line 3: Payer/Guardian & Payment Timestamp */}
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 8px', fontSize: 11.5, color: '#475569', lineHeight: 1.35 }}>
                                  {info.isPaid ? (
                                    <span>
                                      <strong style={{ color: '#15803d' }}>Pagador:</strong>{' '}
                                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{info.pagadorNome || info.responsavel || 'Confirmado'}</span>
                                    </span>
                                  ) : (
                                    <span>
                                      <strong>Resp:</strong> {info.responsavel || 'Não informado'}
                                    </span>
                                  )}
                                  {!info.isPaid && info.telefone && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#64748b', whiteSpace: 'nowrap' }}>
                                      <Phone size={10} aria-hidden="true" />
                                      <span>{info.telefone}</span>
                                    </span>
                                  )}
                                  <span style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                    • R$ {fmtBRL(valorUnit)}
                                  </span>
                                  {info.isPaid && info.paidAt && (
                                    <span style={{ color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      • {new Date(info.paidAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Compact Touch-Friendly Row Actions */}
                            <div className="cvm-cob-actions-row">
                              <button
                                type="button"
                                className="cvm-cob-row-btn"
                                onClick={() => handleToggleCobDestPaid(activeCob, dest)}
                                disabled={isRowLoading}
                                title={info.isPaid ? 'Reabrir cobrança para pendente' : 'Confirmar pagamento manualmente (Dar Baixa)'}
                                style={{
                                  cursor: isRowLoading ? 'wait' : 'pointer',
                                  border: info.isPaid ? '1px solid #cbd5e1' : '1px solid #16a34a',
                                  background: info.isPaid ? '#ffffff' : '#16a34a',
                                  color: info.isPaid ? '#475569' : '#ffffff'
                                }}
                              >
                                {isRowLoading ? (
                                  <Loader2 size={12} aria-hidden="true" />
                                ) : info.isPaid ? (
                                  <RotateCcw size={12} aria-hidden="true" />
                                ) : (
                                  <CheckCircle2 size={12} aria-hidden="true" />
                                )}
                                <span>{info.isPaid ? 'Reabrir' : 'Dar Baixa'}</span>
                              </button>

                              <button
                                type="button"
                                className="cvm-cob-row-btn"
                                onClick={() => handleWhatsAppCobReminder(activeCob, dest, info)}
                                title={info.isPaid ? 'Enviar comprovante/confirmação por WhatsApp' : 'Enviar lembrete de pagamento por WhatsApp'}
                                style={{
                                  cursor: 'pointer',
                                  border: '1px solid #bbf7d0',
                                  background: '#ecfdf5',
                                  color: '#047857'
                                }}
                              >
                                <MessageCircle size={12} aria-hidden="true" />
                                <span>WhatsApp</span>
                              </button>

                              <button
                                type="button"
                                className="cvm-cob-row-btn"
                                onClick={() => handleOpenOrCopyCobPaymentLink(activeCob, dest, 'open')}
                                disabled={isLinkLoading}
                                title={info.isPaid ? 'Abrir comprovante de pagamento' : 'Abrir ou gerar link da fatura deste aluno'}
                                style={{
                                  cursor: isLinkLoading ? 'wait' : 'pointer',
                                  border: info.isPaid ? '1px solid #86efac' : '1px solid #cbd5e1',
                                  background: info.isPaid ? '#f0fdf4' : '#f8fafc',
                                  color: info.isPaid ? '#15803d' : '#334155'
                                }}
                              >
                                {info.isPaid ? <FileText size={12} aria-hidden="true" /> : <ExternalLink size={12} aria-hidden="true" />}
                                <span>{isLinkLoading ? 'Gerando...' : info.isPaid ? 'Comprovante' : 'Fatura'}</span>
                              </button>

                              <button
                                type="button"
                                className="cvm-cob-hit"
                                onClick={() => handleOpenOrCopyCobPaymentLink(activeCob, dest, 'copy')}
                                disabled={isLinkLoading}
                                title={info.isPaid ? 'Copiar link do comprovante de pagamento' : 'Copiar link de pagamento'}
                                aria-label={isCopied ? 'Link copiado' : info.isPaid ? 'Copiar link do comprovante de pagamento' : 'Copiar link de pagamento'}
                                style={{
                                  width: 33,
                                  height: 33,
                                  borderRadius: 8,
                                  cursor: isLinkLoading ? 'wait' : 'pointer',
                                  border: isCopied ? '1px solid #16a34a' : '1px solid #cbd5e1',
                                  background: isCopied ? '#dcfce7' : '#ffffff',
                                  color: isCopied ? '#15803d' : '#475569',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                {isCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                              </button>
                            </div>
                          </div>

                          {/* Progressive Disclosure for Secondary Metadata */}
                          <details className="cvm-cob-details">
                            <summary>
                              <ChevronRight size={12} aria-hidden="true" />
                              <span>Mais detalhes</span>
                            </summary>
                            <div className="cvm-cob-details-grid">
                              {info.matricula && (
                                <span><strong>Mat:</strong> {info.matricula}</span>
                              )}
                              <span>
                                <strong>Responsável:</strong> {info.responsavel || 'Não informado'}
                                {info.parentesco ? ` (${info.parentesco})` : ''}
                              </span>
                              {info.cpfResponsavel && (
                                <span><strong>CPF:</strong> {info.cpfResponsavel}</span>
                              )}
                              {info.telefone && (
                                <span><strong>Tel:</strong> {info.telefone}</span>
                              )}
                              {info.email && (
                                <span><strong>E-mail:</strong> {info.email}</span>
                              )}
                              {info.createdAt && (
                                <span><strong>Envio:</strong> {new Date(info.createdAt).toLocaleDateString('pt-BR')}</span>
                              )}
                              {info.origemPagamento && (
                                <span>
                                  <strong>Origem:</strong> {info.origemPagamento}
                                  {info.transactionId ? ` (ID: ${info.transactionId.substring(0, 14)})` : ''}
                                </span>
                              )}
                            </div>
                          </details>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Compact De-duplicated Modal Footer */}
              <div style={{
                padding: '8px 14px',
                paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexShrink: 0
              }}>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
                  Exibindo <strong style={{ color: '#0f172a' }}>{filteredRows.length}</strong> de <strong style={{ color: '#0f172a' }}>{totalEnviados}</strong>
                  <span className="cvm-cob-desktop-only"> destinatários • Pagantes: <strong style={{ color: '#15803d' }}>{totalPagos}/{totalEnviados}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="cvm-cob-desktop-only"
                    onClick={() => handlePrintCobPayers(activeCob, cobModalFilter)}
                    style={{
                      minHeight: 34,
                      padding: '0 12px',
                      borderRadius: 9,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5
                    }}
                  >
                    <Printer size={13} aria-hidden="true" />
                    <span>Imprimir Filtro Atual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void closeCobModal()}
                    style={{
                      minHeight: 34,
                      padding: '0 16px',
                      borderRadius: 9,
                      border: 'none',
                      background: '#0f172a',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </dialog>

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
