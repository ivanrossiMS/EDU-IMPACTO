'use client'
// Last Update: 2026-05-16T16:08:00Z - Forced Rebuild
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaDigital, ADComunicado } from '@/lib/agendaDigitalContext'
import { useQueryComunicadosPaginated } from '@/lib/hooks/useAgendaQueries'
import { useData } from '@/lib/dataContext'
import { useFormularios } from '@/lib/formulariosContext'
import { useRelatorios } from '@/lib/relatoriosContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { 
  Bell, Search, Plus, Filter, Pin, FileText, CheckCircle2, XCircle, 
  Send as SendIcon, Clock, Paperclip, MoreHorizontal, X,
  Bold, Italic, Link as LinkIcon, List, Underline, BadgeDollarSign, Smile, FileBarChart,
  ClipboardList, BookOpen, GraduationCap, Calendar, Users, User, MessageSquare, Layout, FileCheck, Menu, Loader2, Activity, Trash, RotateCw, ChevronDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, Layers
} from 'lucide-react'
import { DestinatariosModal } from '../../components/agenda/DestinatariosModal'
import NovoComunicadoModal from '../../components/agenda/NovoComunicadoModal'
import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'
import { ComunicadoReportModal } from '@/components/agenda/ComunicadoReportModal'
import { ReportsSelectionModal } from '@/components/agenda/ReportsSelectionModal'
import { ReportFillerModal } from '@/components/agenda/ReportFillerModal'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { createPortal } from 'react-dom';
import { UserAvatar } from '@/components/UserAvatar'

import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { ReportPayloadView } from '@/components/DynamicReports/ReportPayloadView'
import { DashboardEngajamento } from '@/components/agenda/DashboardEngajamento'
import { ComunicadoViewModal } from '@/components/agenda/ComunicadoViewModal'
import { MiniCalendarFilter } from '@/components/agenda/MiniCalendarFilter'
import { seedComunicadosRespostasCache, prefetchComunicadoMessages, getGlobalCachedMessages } from '@/lib/comunicadosRespostasCache'
import { RelatorioFrequenciaMensalModal } from '@/components/agenda/RelatorioFrequenciaMensalModal'
import { apiFetch } from '@/lib/api/apiClient'

const ClientPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
};

const MediaLabel = ({ name, url, initialSize }: { name: string, url: string, initialSize?: string }) => {
  const [size, setSize] = useState(initialSize || '');

  useEffect(() => {
    if (!size && url && url.startsWith('http')) {
      fetch(url, { method: 'HEAD' })
        .then(res => {
          const cl = res.headers.get('content-length');
          if (cl) {
            const bytes = parseInt(cl, 10);
            if (bytes > 1048576) setSize((bytes / 1048576).toFixed(2) + ' MB');
            else setSize((bytes / 1024).toFixed(0) + ' KB');
          }
        })
        .catch(() => {});
    } else if (size && !size.includes('B')) {
       const bytes = parseInt(size, 10);
       if (!isNaN(bytes)) {
         if (bytes > 1048576) setSize((bytes / 1048576).toFixed(2) + ' MB');
         else setSize((bytes / 1024).toFixed(0) + ' KB');
       }
    }
  }, [url, size]);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {size && <span style={{ opacity: 0.7, fontSize: '0.9em', whiteSpace: 'nowrap', marginLeft: 8 }}>{size}</span>}
    </div>
  );
};

export default function ADAdminComunicados() {
  const queryClient = useQueryClient()
  const { currentUser } = useApp()
  const { setComunicados, setComunicadosLocally, adAlert, adConfirm, isDataLoading: isGlobalDataLoading, chatGroups } = useAgendaDigital()
  const { turmas = [] } = useData();
  const [alunos, , { loading: alunosLoading }] = useSupabaseArray<any>('alunos/lightweight?limit=2000');
  const { forms, setDisparos } = useFormularios()
  const { templates: relatoriosTemplates } = useRelatorios()
  
  const alunosAtivos = (alunos || []).filter(a => a.status === 'matriculado' || a.status === 'ativo')

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'active' })
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }, [queryClient, isRefreshing])

  // Escuta de eventos em tempo real com injeção otimista em 0ms e sincronização com debounce
  useEffect(() => {
    let syncTimer: ReturnType<typeof setTimeout> | null = null
    const triggerDebouncedSync = () => {
      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'active' })
      }, 800)
    }

    const handleInsert = (e: any) => {
      const payload = e.detail
      const rawItem = payload?.item || payload?.new || payload
      if (rawItem && rawItem.id) {
        const normalized = {
          ...rawItem,
          id: String(rawItem.id),
          titulo: rawItem.titulo || '',
          conteudo: rawItem.conteudo || rawItem.texto || '',
          autor: rawItem.autor || '',
          dataEnvio: rawItem.dataEnvio || rawItem.data || rawItem.created_at || new Date().toISOString(),
          status: rawItem.status || 'enviado',
          turmas: Array.isArray(rawItem.turmas) ? rawItem.turmas : [],
          alunosIds: Array.isArray(rawItem.alunosIds) ? rawItem.alunosIds : [],
          funcionariosIds: Array.isArray(rawItem.funcionariosIds) ? rawItem.funcionariosIds : [],
          anexos: Array.isArray(rawItem.anexos) ? rawItem.anexos : [],
          leituras: rawItem.leituras && typeof rawItem.leituras === 'object' ? rawItem.leituras : {},
          ciencias: rawItem.ciencias && typeof rawItem.ciencias === 'object' ? rawItem.ciencias : {},
          destino: rawItem.destino || 'todos'
        }
        setComunicadosLocally?.((prev: any) => {
          if (!Array.isArray(prev)) return prev
          if (prev.some((c: any) => String(c.id) === String(normalized.id))) {
            return prev.map((c: any) => String(c.id) === String(normalized.id) ? { ...c, ...normalized } : c)
          }
          return [normalized, ...prev]
        })
      }
      triggerDebouncedSync()
    }

    const handleUpdate = (e: any) => {
      const payload = e.detail
      const rawItem = payload?.item || payload?.new || payload
      if (rawItem && rawItem.id) {
        setComunicadosLocally?.((prev: any) => {
          if (!Array.isArray(prev)) return prev
          if (!prev.some((c: any) => String(c.id) === String(rawItem.id))) return prev
          return prev.map((c: any) => String(c.id) === String(rawItem.id) ? { ...c, ...rawItem } : c)
        })
      }
      triggerDebouncedSync()
    }

    const handleDelete = (e: any) => {
      const payload = e.detail
      const id = payload?.id || payload?.old?.id
      const ids = payload?.ids || (id ? [id] : [])
      if (ids.length > 0) {
        const idSet = new Set(ids.map(String))
        setComunicadosLocally?.((prev: any) => {
          if (!Array.isArray(prev)) return prev
          const filteredList = prev.filter((c: any) => !idSet.has(String(c.id)))
          return filteredList.length === prev.length ? prev : filteredList
        })
      }
      triggerDebouncedSync()
    }

    window.addEventListener('ad:comunicados-insert', handleInsert)
    window.addEventListener('ad:comunicados-update', handleUpdate)
    window.addEventListener('ad:comunicados-delete', handleDelete)

    const handleVisibilityOrOnline = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'active' })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityOrOnline)
    window.addEventListener('online', handleVisibilityOrOnline)

    // Contingência leve a cada 60s apenas se a aba estiver visível e em primeiro plano
    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'active' })
      }
    }, 60000)

    return () => {
      if (syncTimer) clearTimeout(syncTimer)
      window.removeEventListener('ad:comunicados-insert', handleInsert)
      window.removeEventListener('ad:comunicados-update', handleUpdate)
      window.removeEventListener('ad:comunicados-delete', handleDelete)
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline)
      window.removeEventListener('online', handleVisibilityOrOnline)
      clearInterval(pollTimer)
    }
  }, [queryClient, setComunicadosLocally])

  const renderConteudo = (text: string) => {
    if (!text) return null;
    // Se o texto contém HTML (resultado do novo editor WYSIWYG)
    if (text.includes('<') && text.includes('>')) {
      return <div dangerouslySetInnerHTML={{ __html: text }} />;
    }
    
    // Fallback para comunicados legados ou texto simples
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const boldParts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={i}>
          {boldParts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={j}>{part.slice(2, -2)}</strong>;
            if (part) {
              const italicParts = part.split(/(\*.*?\*)/g);
              return italicParts.map((ip, k) => {
                if (ip.startsWith('*') && ip.endsWith('*')) return <em key={`${j}-${k}`}>{ip.slice(1, -1)}</em>;
                const linkParts = ip.split(/(\[.*?\]\(.*?\))/g);
                return linkParts.map((lp, l) => {
                   if (lp.startsWith('[') && lp.endsWith(')')) {
                      const endBracket = lp.indexOf('](')
                      const textDesc = lp.slice(1, endBracket)
                      const url = lp.slice(endBracket + 2, -1)
                      return <a key={`${j}-${k}-${l}`} href={url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>{textDesc}</a>
                   }
                   return lp
                })
              });
            }
            return part;
          })}
          <br />
        </span>
      );
    });
  }

  const [tab, setTab] = useState<'enviados' | 'agendados' | 'rascunhos'>('enviados')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const [selectedCom, setSelectedCom] = useState<ADComunicado | null>(null)
  const [editComId, setEditComId] = useState<string | null>(null)
  const [forwardComData, setForwardComData] = useState<any>(null)
  const [selectedDest, setSelectedDest] = useState<{id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo'}[]>([])
  const [showDestModal, setShowDestModal] = useState(false)
  const [anexos, setAnexos] = useState<string[]>([])
  const [dataAgendamento, setDataAgendamento] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const EMOJIS = ['😊', '😂', '👍', '🙏', '😍', '👏', '😉', '✅', '❌', '❤️']
  
  const [showCobrancaModal, setShowCobrancaModal] = useState(false)
  const [cobrancaForm, setCobrancaForm] = useState({ motivo: '', valor: '', vencimento: '', tipo: 'pix' })
  const [appCharges, setAppCharges] = useLocalStorage<any[]>('edu-app-charges-v1', [])
  
  const [showFormsModal, setShowFormsModal] = useState(false)
  const [showRelsModal, setShowRelsModal] = useState(false)
  const [openedReportTaskStr, setOpenedReportTaskStr] = useState<string | null>(null)
  const [showNovoMenu, setShowNovoMenu] = useState(false)
  const novoMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showNovoMenu) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (novoMenuRef.current && !novoMenuRef.current.contains(e.target as Node)) {
        setShowNovoMenu(false)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showNovoMenu])

  const [showComposer, setShowComposer] = useState(false)
  const [viewingCom, setViewingCom] = useState<ADComunicado | null>(null)
  const [viewingComFocusComments, setViewingComFocusComments] = useState(false)
  const [viewingReportPayload, setViewingReportPayload] = useState<any>(null)
  const [activePreviewStudent, setActivePreviewStudent] = useState<any>(null)
  const [viewingDestCom, setViewingDestCom] = useState<ADComunicado | null>(null)
  const listScrollContainerRef = useRef<HTMLDivElement>(null)
  
  const [authorFilter, setAuthorFilter] = useState<string>('todos');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterComentarios, setFilterComentarios] = useState<boolean>(false);
  const [filterRelatorio, setFilterRelatorio] = useState<boolean>(false);
  const [attachmentFilter, setAttachmentFilter] = useState<string>('todos');
  const [reportAuthorFilter, setReportAuthorFilter] = useState<string>('todos');
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showEngagementDashboard, setShowEngagementDashboard] = useState(false);
  const [colaboradores, setColaboradores] = useState<{id?: string, nome: string, cargo?: string, perfil?: string}[]>([]);
  const [colabsLoading, setColabsLoading] = useState(true);
  const [dbAuthors, setDbAuthors] = useState<string[]>([]);
  const [dbRoles, setDbRoles] = useState<string[]>([]);

  const [selectedComs, setSelectedComs] = useState<string[]>([]);
  const [storedPageSize, setStoredPageSize] = useLocalStorage<number>('ad-admin-comunicados-pagesize-v1', 10);
  const pageSize = useMemo(() => ([10, 30, 50, 100].includes(Number(storedPageSize)) ? Number(storedPageSize) : 10), [storedPageSize]);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setSelectedComs([]);
    setCurrentPage(1);
  }, [tab, debouncedSearch, authorFilter, attachmentFilter, selectedDate, filterComentarios, filterRelatorio, pageSize]);

  useEffect(() => {
    const fetchColaboradoresAndAuthors = async () => {
      try {
        const [usersRes, authorsRes] = await Promise.allSettled([
          apiFetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000'),
          apiFetch('/api/comunicados?type=autores')
        ]);

        let colabsList: any[] = [];
        let extraAuthors: string[] = [];
        let extraRoles: string[] = [];

        if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
          const json = await usersRes.value.json();
          if (json && Array.isArray(json.data)) {
            colabsList = json.data.filter((u: any) => u && u.nome);
          }
        }

        if (authorsRes.status === 'fulfilled' && authorsRes.value.ok) {
          const json = await authorsRes.value.json();
          if (json && Array.isArray(json.authors)) {
            extraAuthors = json.authors;
          }
          if (json && Array.isArray(json.roles)) {
            extraRoles = json.roles;
          }
        }

        const uniqueUsers = Array.from(new Map(colabsList.map((u: any) => [u.nome.trim().toLowerCase(), u])).values()) as any[];
        uniqueUsers.sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
        setColaboradores(uniqueUsers);

        if (extraAuthors.length > 0) {
          setDbAuthors(extraAuthors);
        }
        if (extraRoles.length > 0) {
          setDbRoles(extraRoles);
        }
      } catch (e) {
        console.error('Error fetching colaboradores and authors:', e);
      } finally {
        setColabsLoading(false);
      }
    };
    fetchColaboradoresAndAuthors();
  }, []);

  useEffect(() => {
    if (viewingCom || viewingDestCom || viewingReportPayload || selectedCom) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; }
  }, [viewingCom, viewingDestCom, viewingReportPayload, selectedCom]);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set('scope', 'admin');
    if (tab) {
      const statusValue = tab === 'enviados' ? 'enviado' : tab === 'agendados' ? 'agendado' : 'rascunho';
      params.set('status', statusValue);
    }
    if (filterComentarios) {
      params.set('tem_comentarios', 'true');
    }
    if (filterRelatorio) {
      params.set('tipo', 'relatorio');
    }
    if (authorFilter && authorFilter !== 'todos') {
      if (authorFilter === 'meus') {
        if (currentUser?.id) params.set('autor_id', currentUser.id);
        if (currentUser?.nome) params.set('autor', currentUser.nome);
      } else if (authorFilter.startsWith('cargo:')) {
        params.set('cargo', authorFilter.replace('cargo:', ''));
      } else if (authorFilter.startsWith('autor:')) {
        const aName = authorFilter.replace('autor:', '');
        params.set('autor', aName);
        const colab = colaboradores.find(c => c.nome?.trim().toLowerCase() === aName.trim().toLowerCase());
        if (colab?.id) {
          params.set('autor_id', colab.id);
        }
      }
    }
    if (selectedDate) {
      params.set('date', selectedDate);
    }
    if (debouncedSearch.trim()) {
      params.set('search', debouncedSearch.trim());
    }
    const q = params.toString();
    return q ? `/api/comunicados?${q}` : '/api/comunicados';
  }, [tab, authorFilter, debouncedSearch, currentUser, colaboradores, selectedDate, filterComentarios, filterRelatorio]);

  const {
    data: paginatedData,
    isLoading: isLocalLoading,
    isPending: isLocalPending,
    isFetching: isLocalFetching,
    isError: isLocalError,
    refetch: refetchLocal,
  } = useQueryComunicadosPaginated(endpoint, currentPage, pageSize, { enabled: true });

  const comunicados = useMemo<any[]>(() => {
    if (Array.isArray(paginatedData?.items)) return paginatedData.items;
    if (Array.isArray((paginatedData as any)?.pages)) return (paginatedData as any).pages.flat();
    if (Array.isArray(paginatedData)) return paginatedData;
    return [];
  }, [paginatedData]);
  const totalCount = typeof paginatedData?.totalCount === 'number' ? paginatedData.totalCount : comunicados.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const isDataLoading = !currentUser || isLocalPending || isLocalLoading || (isLocalFetching && comunicados.length === 0);

  // Cache instantâneo de IDs com respostas na base de dados
  const [idsWithReplies, setIdsWithReplies] = useState<Set<string>>(new Set());

  const fetchIdsWithReplies = useCallback(() => {
    apiFetch('/api/comunicados?type=comentarios_ids')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (Array.isArray(data?.ids)) {
          setIdsWithReplies(new Set(data.ids.map(String)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchIdsWithReplies();
  }, [fetchIdsWithReplies]);

  // Sincroniza cache de mensagens e escuta atualizações de respostas em tempo real
  useEffect(() => {
    if (comunicados && comunicados.length > 0) {
      seedComunicadosRespostasCache(comunicados);
    }
  }, [comunicados]);

  useEffect(() => {
    const handleConversasUpdated = (e: any) => {
      const detail = e.detail;
      if (!detail?.comunicadoId) return;
      setIdsWithReplies(prev => {
        const next = new Set(prev);
        next.add(String(detail.comunicadoId));
        return next;
      });
      if (setComunicadosLocally) {
        setComunicadosLocally((prev: any[]) => {
          if (!Array.isArray(prev)) return prev;
          if (!prev.some(c => String(c.id) === String(detail.comunicadoId))) return prev;
          return prev.map(c => {
            if (String(c.id) === String(detail.comunicadoId)) {
              return {
                ...c,
                respostas: detail.messages || c.respostas,
                conversas_info: {
                  ...(c.conversas_info || {}),
                  tem_conversas: true,
                  total: detail.total || (detail.messages?.length ?? c.conversas_info?.total ?? 1)
                }
              };
            }
            return c;
          });
        });
      }
    };
    window.addEventListener('agenda-digital:conversas-updated', handleConversasUpdated);
    return () => window.removeEventListener('agenda-digital:conversas-updated', handleConversasUpdated);
  }, [setComunicadosLocally]);

  // Coleção de dias que possuem comunicados para marcar no mini calendário
  const activeDatesWithComunicados = useMemo(() => {
    const set = new Set<string>();
    comunicados.forEach((c: any) => {
      const raw = c.dataEnvio || c.data || c.created_at || (c.dados && (c.dados.dataEnvio || c.dados.data || c.dados.created_at));
      if (!raw) return;
      try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        set.add(`${y}-${m}-${day}`);
      } catch {}
    });
    return set;
  }, [comunicados]);

  // Rótulo formatado para exibição do dia selecionado
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Extração Dinâmica de Autores e Cargos unificando Colaboradores + Autores do Banco + Comunicados locais
  const availableAuthors = useMemo(() => {
    const map = new Map<string, string>();
    colaboradores.forEach(c => {
      if (c?.nome?.trim()) {
        map.set(c.nome.trim().toLowerCase(), c.nome.trim());
      }
    });
    dbAuthors.forEach(a => {
      if (a?.trim() && !map.has(a.trim().toLowerCase())) {
        map.set(a.trim().toLowerCase(), a.trim());
      }
    });
    comunicados.forEach(c => {
      const a = (c.autor || (c as any).dados?.autor || '').trim();
      if (a && !map.has(a.toLowerCase())) {
        map.set(a.toLowerCase(), a);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [colaboradores, dbAuthors, comunicados]);

  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    colaboradores.forEach(c => {
      const cargo = (c.cargo || c.perfil || '').trim();
      if (cargo && cargo !== 'Não definido') roles.add(cargo);
    });
    dbRoles.forEach(r => {
      if (r?.trim()) roles.add(r.trim());
    });
    comunicados.forEach(c => {
      const r = (c.autorCargo || (c as any).dados?.autorCargo || '').trim();
      if (r) roles.add(r);
    });
    return Array.from(roles).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [colaboradores, dbRoles, comunicados]);

  
  
  const handleEnviar = (data: any, asRascunho = false) => {
    const { titulo, conteudo, anexos, dataAgendamento, cobranca, cobrancas, enquete, autorizacao } = data;
    const newTitulo = titulo;
    const newConteudo = conteudo;
    if (!newTitulo.trim() || !newConteudo.trim()) {
      adAlert('Por favor, preencha o título e o conteúdo.', 'Atenção')
      return
    }
    
    if (editComId) {
      const updatedCom = {
        ...(comunicados.find(c => c.id === editComId) as ADComunicado),
        titulo: newTitulo,
        conteudo: newConteudo,
        autor: currentUser?.nome || 'Usuário ERP',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Administração',
        autorId: currentUser?.id || '',
        autorFoto: currentUser?.foto || null,
        anexos: anexos,
        cobranca: cobranca || (cobrancas && cobrancas[0]) || null,
        cobrancas: cobrancas || (cobranca ? [cobranca] : []),
        enquete: enquete || null,
        autorizacao: autorizacao || null,
        dataAgendamento: dataAgendamento || null,
        status: (asRascunho ? 'rascunho' : dataAgendamento ? 'agendado' : 'enviado') as 'rascunho' | 'agendado' | 'enviado',
        turmas: selectedDest.filter(d => d.type === 'turma').map(d => d.name),
        turmasIds: selectedDest.filter(d => d.type === 'turma').map(d => String(d.id).replace(/^t_?/, '')),
        grupos: selectedDest.filter(d => d.type === 'grupo').map(d => d.name),
        alunosIds: selectedDest.filter(d => d.type === 'aluno').map(d => String(d.id).replace(/^a_?/, '')),
        funcionariosIds: selectedDest.filter(d => d.type === 'funcionario').map(d => String(d.id).replace(/^f_?/, '')),
        destino: selectedDest.length === 0 ? 'todos' : 'selecionados'
      }

      apiFetch('/api/comunicados', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editComId, dados: updatedCom })
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'active' })
        })
        .catch(err => console.error("Erro ao salvar comunicado", err))

      if (setComunicadosLocally) {
        setComunicadosLocally(prev => prev.map(c => c.id === editComId ? updatedCom : c))
      } else {
        setComunicados(prev => prev.map(c => c.id === editComId ? updatedCom : c))
      }
    } else {
      const newCom: ADComunicado = {
        id: `AD-COM-NEW-${Date.now()}`,
        titulo: newTitulo,
        conteudo: newConteudo,
        tipo: ((cobrancas && cobrancas.length > 0) || cobranca ? 'cobrança' : autorizacao ? 'autorização' : enquete ? 'enquete' : 'texto') as any,
        autor: currentUser?.nome || 'Usuário ERP',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Administração',
        autorId: currentUser?.id || '',
        autorFoto: currentUser?.foto || null,
        turmas: selectedDest.filter(d => d.type === 'turma').map(d => d.name),
        turmasIds: selectedDest.filter(d => d.type === 'turma').map(d => String(d.id).replace(/^t_?/, '')),
        grupos: selectedDest.filter(d => d.type === 'grupo').map(d => d.name),
        alunosIds: selectedDest.filter(d => d.type === 'aluno').map(d => String(d.id).replace(/^a_?/, '')),
        funcionariosIds: selectedDest.filter(d => d.type === 'funcionario').map(d => String(d.id).replace(/^f_?/, '')),
        destino: selectedDest.length === 0 ? 'todos' : 'selecionados',
        prioridade: 'normal',
        fixado: false,
        exigeCiencia: false,
        permiteResposta: true,
        dataEnvio: new Date().toISOString(),
        dataAgendamento: dataAgendamento || null,
        anexos: anexos,
        cobranca: cobranca || (cobrancas && cobrancas[0]) || null,
        cobrancas: cobrancas || (cobranca ? [cobranca] : []),
        enquete: enquete || null,
        autorizacao: autorizacao || null,
        leituras: {},
        ciencias: {},
        status: (asRascunho ? 'rascunho' : dataAgendamento ? 'agendado' : 'enviado') as 'rascunho' | 'agendado' | 'enviado'
      }

      apiFetch('/api/comunicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCom)
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'active' })
        })
        .catch(err => console.error("Erro ao salvar comunicado", err))

      if (setComunicadosLocally) {
        setComunicadosLocally(prev => [newCom, ...prev])
      } else {
        setComunicados(prev => [newCom, ...prev])
      }
      
      // Auto-register form dispatches if it contains forms
      if (!asRascunho) {
         const appendedForms = anexos.filter((a: any) => a.startsWith('Formulário: ')).map((a: any) => a.replace('Formulário: ', ''))
         if (appendedForms.length > 0) {
            const isGlobal = newCom.destino === 'todos';
            let targets: any[] = [];
            
            if (isGlobal) {
               targets = alunosAtivos;
            } else {
               targets = alunosAtivos.filter(a => {
                  if (newCom.turmas.some(t => isAlunoCursandoTurma(a, t))) return true;
                  const aIdPlain = a.id.replace(/^_*(ALU)?/, '')
                  return newCom.alunosIds.some(idRaw => idRaw.replace(/^_*(ALU)?/, '') === aIdPlain)
               });
            }

            const newDisparos: any[] = []
            appendedForms.forEach((formName: string) => {
               const f = forms.find(x => x.name === formName)
               if (f) {
                  targets.forEach(t => {
                     newDisparos.push({
                        id: `D-AUTO-${Date.now()}-${t.id}`,
                        formId: f.id,
                        targetId: t.id,
                        targetName: t.nome,
                        status: 'pendente',
                        sentAt: new Date().toISOString()
                     })
                  })
               }
            })
            if (newDisparos.length > 0) {
               setDisparos(prev => [...prev, ...newDisparos])
            }
         }
      }
    }
    setShowComposer(false)
    
    
    
  }

  const openEdit = (c: ADComunicado) => {
    setEditComId(c.id)
    setForwardComData(null)
    
    const mappedDest: {id: string, name: string, type: 'turma' | 'aluno'}[] = []
    c.turmas.forEach((t, i) => mappedDest.push({id: `t${c.id}${i}`, name: t, type: 'turma'}))
    c.alunosIds.forEach((a) => {
       const idReal = a.replace(/^_/, '')
       const alunoObj = alunos?.find(al => al.id === a || al.id === `_${idReal}` || al.id === `_ALU${idReal.replace('ALU', '')}`)
       mappedDest.push({id: `a_${a.replace(/^_+/, '_')}`, name: alunoObj ? alunoObj.nome : a, type: 'aluno'})
     })
    setSelectedDest(mappedDest)

    setShowComposer(true)
  }

  const handleReenviar = (c: ADComunicado) => {
    setEditComId(null)
    setForwardComData({
      titulo: c.titulo.startsWith('ENC:') ? c.titulo : `ENC: ${c.titulo}`,
      conteudo: c.conteudo || (c as any).texto || '',
      anexos: c.anexos || [],
      cobranca: null
    })
    setSelectedDest([]) // Permite selecionar novos destinatários
    
    setShowComposer(true)
  }

  const [isPreparingNovo, setIsPreparingNovo] = useState(false);

  const isRecipientsDataLoading = Boolean(
    alunosLoading ||
    colabsLoading ||
    !alunos ||
    alunos.length === 0 ||
    !colaboradores ||
    colaboradores.length === 0
  );

  const handleNovo = () => {
    setEditComId(null)
    setSelectedDest([])
    if (isRecipientsDataLoading) {
      setIsPreparingNovo(true)
    } else {
      setShowComposer(true)
    }
  }

  // Monitora o carregamento dos dados e avança para o editor assim que tudo estiver pronto
  useEffect(() => {
    if (!isPreparingNovo) return

    if (!isRecipientsDataLoading) {
      const timer = setTimeout(() => {
        setIsPreparingNovo(false)
        setShowComposer(true)
      }, 350)
      return () => clearTimeout(timer)
    }

    const failsafe = setTimeout(() => {
      setIsPreparingNovo(false)
      setShowComposer(true)
    }, 5000)
    return () => clearTimeout(failsafe)
  }, [isPreparingNovo, isRecipientsDataLoading])

  const handleBulkDelete = () => {
    adConfirm(`Tem certeza que deseja excluir ${selectedComs.length} comunicado(s)? Esta ação é irreversível.`, 'Excluir Comunicados', async () => {
      try {
        const res = await apiFetch(`/api/comunicados?ids=${selectedComs.join(',')}`, { method: 'DELETE' });
        if (res.ok) {
          if (setComunicadosLocally) {
            setComunicadosLocally(prev => prev.filter(c => !selectedComs.includes(c.id)));
          } else {
            setComunicados(prev => prev.filter(c => !selectedComs.includes(c.id)));
          }
          setSelectedComs([]);
          queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'] });
          queryClient.invalidateQueries({ queryKey: ['ocorrencias'] });
          queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'] });
          queryClient.invalidateQueries({ queryKey: ['ocorrencias-familia'] });
          refetchLocal();
          window.dispatchEvent(new CustomEvent('ad:comunicados-delete', { detail: { ids: selectedComs, old: selectedComs.map(id => ({ id })) } }));
          adAlert('Comunicados excluídos com sucesso.', 'Sucesso');
        } else {
          const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
          adAlert(`Erro ao excluir: ${data.error || res.statusText}`, 'Erro');
        }
      } catch (err: any) {
        adAlert(`Erro ao excluir: ${err.message}`, 'Erro');
      }
    });
  }

  const handleDeleteSingleComunicado = (id: string) => {
    adConfirm('Tem certeza que deseja excluir este comunicado? Esta ação é irreversível.', 'Excluir Comunicado', async () => {
      try {
        const res = await apiFetch(`/api/comunicados?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) {
          if (setComunicadosLocally) {
            setComunicadosLocally(prev => prev.filter(c => c.id !== id));
          } else {
            setComunicados(prev => prev.filter(c => c.id !== id));
          }
          setSelectedComs(prev => prev.filter(x => x !== id));
          queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'] });
          queryClient.invalidateQueries({ queryKey: ['ocorrencias'] });
          queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'] });
          queryClient.invalidateQueries({ queryKey: ['ocorrencias-familia'] });
          refetchLocal();
          window.dispatchEvent(new CustomEvent('ad:comunicados-delete', { detail: { ids: [id], old: [{ id }] } }));
          adAlert('Comunicado excluído com sucesso.', 'Sucesso');
        } else {
          const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
          adAlert(`Erro ao excluir: ${data.error || res.statusText}`, 'Erro');
        }
      } catch (err: any) {
        adAlert(`Erro ao excluir: ${err.message}`, 'Erro');
      }
    });
  };

  const filtered = useMemo(() => {
    return comunicados.filter((c: any) => {
      // Ocultar envios individuais de relatórios do Feed (Mostrando apenas a Cópia-Resumo da Turma)
      if (c.id?.startsWith('AD-COM-REL-STU-')) return false;

      // Filtro local adicional de data caso selecionada
      if (selectedDate) {
        const raw = c.dataEnvio || c.data || c.created_at || (c.dados && (c.dados.dataEnvio || c.dados.data || c.dados.created_at));
        if (raw) {
          try {
            const d = new Date(raw);
            if (!isNaN(d.getTime())) {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              const cDateStr = `${y}-${m}-${day}`;
              if (cDateStr !== selectedDate) return false;
            }
          } catch {}
        }
      }

      // Filtro: Tem Comentários
      if (filterComentarios) {
        const hasServerInfo = c.conversas_info !== undefined && c.conversas_info !== null;
        const cachedMsgs = getGlobalCachedMessages(c.id);
        const hasConversas = hasServerInfo
          ? Boolean(
              c.conversas_info.tem_conversas ||
              (c.conversas_info.total && c.conversas_info.total > 0) ||
              (Array.isArray(c.respostas) && c.respostas.length > 0) ||
              (cachedMsgs && cachedMsgs.length > 0)
            )
          : Boolean(
              idsWithReplies.has(String(c.id)) ||
              (Array.isArray(c.respostas) && c.respostas.length > 0) ||
              (cachedMsgs && cachedMsgs.length > 0)
            );
        if (!hasConversas) return false;
      }

      // Filtro: Tem Relatório
      if (filterRelatorio) {
        const hasReport = Boolean(
          c.tipo === 'relatorio' ||
          (c as any).dados?.tipo === 'relatorio' ||
          (c.id && c.id.includes('REL')) ||
          (Array.isArray(c.anexos) && c.anexos.some((a: any) => {
            if (typeof a === 'string') {
              return a.includes('PAYLOAD_RELATORIO') || a.includes('|report-payload') || a.toLowerCase().includes('relatorio') || a.toLowerCase().includes('relatório');
            }
            return a?.mimeType === 'report-payload' || a?.tipo === 'relatorio' || (a?.name && a.name.toLowerCase().includes('relat')) || (a?.nome && a.nome.toLowerCase().includes('relat'));
          })) ||
          (c.titulo && (c.titulo.toLowerCase().includes('relatório') || c.titulo.toLowerCase().includes('relatorio')))
        );
        if (!hasReport) return false;
      }

      return true;
    }).sort((a: any, b: any) => {
      const timeA = new Date(a.dataEnvio || (a as any).data || (a as any).created_at || 0).getTime();
      const timeB = new Date(b.dataEnvio || (b as any).data || (b as any).created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [comunicados, selectedDate, filterComentarios, filterRelatorio, idsWithReplies]);

  const cleanStuId = useCallback((val: any): string => {
    return String(val || '')
      .replace(/^a_?/i, '')
      .replace(/^_*(ALU)?_?/i, '')
      .trim();
  }, []);

  const activeStudentCleanIdsSet = useMemo(() => {
    const s = new Set<string>();
    alunosAtivos.forEach(a => {
      const c = cleanStuId(a.id);
      if (c) s.add(c);
    });
    return s;
  }, [alunosAtivos, cleanStuId]);

  const computeComunicadoMetrics = useCallback((c: any) => {
    const isGlobal = c.destino === 'todos';
    const targetTurmas: string[] = c.turmas || c.dados?.turmas || [];
    const targetAlunosIds: any[] = c.alunosIds || c.dados?.alunosIds || [];
    const targetGrupos: string[] = c.grupos || c.dados?.grupos || [];
    const targetFuncsIds: any[] = c.funcionariosIds || c.dados?.funcionariosIds || [];
    const explicitTurmasIds: any[] = c.turmasIds || c.dados?.turmasIds || [];

    const explicitStudentIds = new Set<string>();
    targetAlunosIds.forEach(idRaw => {
      const clean = cleanStuId(idRaw);
      if (clean) explicitStudentIds.add(clean);
    });
    const stuTargetIds = c.stu_target_ids || c.dados?.stu_target_ids || [];
    if (Array.isArray(stuTargetIds)) {
      stuTargetIds.forEach(idRaw => {
        const clean = cleanStuId(idRaw);
        if (clean) explicitStudentIds.add(clean);
      });
    }
    const rawStuIds = c.dados?.stuIds || [];
    if (Array.isArray(rawStuIds)) {
      rawStuIds.forEach((sId: any) => {
        const m = String(sId).match(/AD-COM-REL-STU-\d+-([^-]+)-/);
        if (m && m[1]) {
          const clean = cleanStuId(m[1]);
          if (clean) explicitStudentIds.add(clean);
        }
      });
    }
    const rawAnexos = c.anexos || c.dados?.anexos || [];
    if (Array.isArray(rawAnexos)) {
      rawAnexos.forEach((anx: any) => {
        if (typeof anx !== 'string' || !anx.includes('payload:')) return;
        try {
          const pPart = anx.split('|').find((p: string) => p.startsWith('payload:'));
          if (pPart) {
            const parsed = JSON.parse(pPart.substring(8));
            const pStuId = cleanStuId(parsed?.studentInfo?.id || Object.keys(parsed?.values || {})[0] || '');
            if (pStuId) explicitStudentIds.add(pStuId);
          }
        } catch {}
      });
    }

    const grupoAlunosIds = new Set<string>();
    const grupoFuncsIds = new Set<string>();
    if (targetGrupos.length > 0 && chatGroups) {
      const matchedGroups = chatGroups.filter((g: any) =>
        targetGrupos.some((gName: string) => String(gName).toLowerCase().trim() === String(g.nome).toLowerCase().trim())
      );
      matchedGroups.forEach((g: any) => {
        let aIds = g.alunosIds || [];
        if (typeof aIds === 'string') { try { aIds = JSON.parse(aIds); } catch { aIds = []; } }
        if (Array.isArray(aIds)) aIds.forEach((id: any) => { const clean = cleanStuId(id); if (clean) grupoAlunosIds.add(clean); });

        let cIds = g.colaboradoresIds || [];
        if (typeof cIds === 'string') { try { cIds = JSON.parse(cIds); } catch { cIds = []; } }
        if (Array.isArray(cIds)) cIds.forEach((id: any) => grupoFuncsIds.add(String(id).replace(/^f_?/, '').trim()));
      });
    }

    const targetStudentIds = new Set<string>();
    if (explicitStudentIds.size > 0) {
      if (activeStudentCleanIdsSet.size > 0) {
        explicitStudentIds.forEach(sId => {
          if (activeStudentCleanIdsSet.has(sId)) targetStudentIds.add(sId);
        });
        if (targetStudentIds.size === 0) {
          explicitStudentIds.forEach(sId => targetStudentIds.add(sId));
        }
      } else {
        explicitStudentIds.forEach(sId => targetStudentIds.add(sId));
      }
    } else if (isGlobal) {
      activeStudentCleanIdsSet.forEach(sId => targetStudentIds.add(sId));
    } else {
      const matchedTurmaObjects = (turmas || []).filter(t =>
        targetTurmas.includes(t.nome) ||
        targetTurmas.includes((t as any).name) ||
        targetTurmas.includes(String(t.id)) ||
        explicitTurmasIds.includes(String(t.id))
      );
      const targetTurmasIds = matchedTurmaObjects.map(t => String(t.id));
      const mergedTurmasIds = new Set([...targetTurmasIds, ...explicitTurmasIds.map(String)]);

      alunosAtivos.forEach(a => {
        const aIdPlain = cleanStuId(a.id);
        if (!aIdPlain) return;
        if (
          mergedTurmasIds.has(String(a.turma)) ||
          targetTurmas.includes(a.turma) ||
          matchedTurmaObjects.some(t => isAlunoCursandoTurma(a, t, t.ano)) ||
          grupoAlunosIds.has(aIdPlain)
        ) {
          targetStudentIds.add(aIdPlain);
        }
      });
    }

    const targetFuncIds = new Set<string>();
    if (isGlobal && explicitStudentIds.size === 0) {
      (colaboradores || []).forEach(col => {
        const fId = String(col.id || '').replace(/^f_?/, '').trim();
        if (fId) targetFuncIds.add(fId);
      });
    } else if (explicitStudentIds.size === 0) {
      targetFuncsIds.forEach(idRaw => {
        const fId = String(idRaw).replace(/^f_?/, '').trim();
        if (fId) targetFuncIds.add(fId);
      });
      grupoFuncsIds.forEach(fId => {
        if (fId) targetFuncIds.add(fId);
      });
    }

    const readStudentIds = new Set<string>();
    if (Array.isArray(c.leituras_alunos_ids)) {
      c.leituras_alunos_ids.forEach((idRaw: any) => {
        const clean = cleanStuId(idRaw);
        if (clean) readStudentIds.add(clean);
      });
    }
    const leiturasMap = c.leituras || {};
    Object.keys(leiturasMap).forEach(k => {
      if (k.includes('_')) {
        const parts = k.split('_');
        const suffix = cleanStuId(parts[parts.length - 1]);
        if (suffix) readStudentIds.add(suffix);
      } else {
        const cleanKey = cleanStuId(k);
        if (cleanKey && targetStudentIds.has(cleanKey)) {
          readStudentIds.add(cleanKey);
        }
      }
    });

    let studentReadsCount = 0;
    if (targetStudentIds.size > 0) {
      targetStudentIds.forEach(sId => {
        if (readStudentIds.has(sId)) studentReadsCount++;
      });
    } else if (explicitStudentIds.size > 0) {
      explicitStudentIds.forEach(sId => {
        if (readStudentIds.has(sId)) studentReadsCount++;
      });
    }

    let funcReadsCount = 0;
    targetFuncIds.forEach(fId => {
      if (leiturasMap[fId] || leiturasMap[`f_${fId}`]) {
        funcReadsCount++;
      }
    });

    const targetCount = targetStudentIds.size + targetFuncIds.size;
    const lidas = targetCount > 0 ? Math.min(targetCount, studentReadsCount + funcReadsCount) : 0;
    const progresso = targetCount > 0 ? Math.min(100, (lidas / targetCount) * 100) : 0;

    return {
      isGlobal,
      targetTurmas,
      explicitStudentIds: Array.from(explicitStudentIds),
      targetCount,
      lidas,
      progresso
    };
  }, [alunosAtivos, activeStudentCleanIdsSet, turmas, chatGroups, colaboradores, cleanStuId]);

  const pageSummary = useMemo(() => {
    let totalReadPct = 0;
    let validReadCards = 0;
    let withComments = 0;
    let withUnreadComments = 0;
    let reportsCount = 0;

    filtered.forEach(c => {
      const m = computeComunicadoMetrics(c);
      if (m.targetCount > 0) {
        totalReadPct += m.progresso;
        validReadCards++;
      }
      const hasServerInfo = c.conversas_info !== undefined && c.conversas_info !== null;
      const cachedMsgs = getGlobalCachedMessages(c.id);
      const hasConv = hasServerInfo
        ? Boolean(
            c.conversas_info.tem_conversas ||
            (c.conversas_info.total && c.conversas_info.total > 0) ||
            (Array.isArray(c.respostas) && c.respostas.length > 0) ||
            (cachedMsgs && cachedMsgs.length > 0)
          )
        : Boolean(idsWithReplies.has(String(c.id)));
      if (hasConv) withComments++;
      if (c.conversas_info?.has_unread || (c.conversas_info?.nao_lidas && c.conversas_info.nao_lidas > 0) || c._has_unread_reply) {
        withUnreadComments++;
      }
      if (c.id?.startsWith('AD-COM-REL-') || c.tipo === 'relatorio' || (c as any).dados?.tipo === 'relatorio') {
        reportsCount++;
      }
    });

    return {
      avgReadPct: validReadCards > 0 ? Math.round(totalReadPct / validReadCards) : 0,
      withComments,
      withUnreadComments,
      reportsCount
    };
  }, [filtered, computeComunicadoMetrics, idsWithReplies]);

  const handlePageChange = useCallback((nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    if (clamped === currentPage) return;
    setCurrentPage(clamped);
    setSelectedComs([]);
    if (listScrollContainerRef.current) {
      listScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, totalPages]);

  const visiblePageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push('ellipsis-start');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('ellipsis-end');
    pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(totalCount, (currentPage - 1) * pageSize + filtered.length);

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ad-comunicado-card {
          position: relative;
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid rgba(226, 232, 240, 0.9);
          padding: 16px 20px 16px 22px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 20px;
          transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.18s cubic-bezier(0.2, 0, 0, 1), border-color 0.18s ease;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03), 0 1px 2px rgba(15, 23, 42, 0.02);
        }
        .ad-comunicado-card.ad-below-fold {
          content-visibility: auto;
          contain-intrinsic-size: auto 116px;
        }
        .ad-comunicado-card:hover {
          border-color: rgba(99, 102, 241, 0.45);
          box-shadow: 0 10px 24px -8px rgba(79, 70, 229, 0.12), 0 4px 10px -4px rgba(15, 23, 42, 0.04);
          transform: translateY(-1px);
        }
        .ad-comunicado-card.is-selected {
          background: linear-gradient(135deg, rgba(238, 242, 255, 0.65) 0%, #ffffff 100%);
          border-color: #6366f1;
        }
        .ad-page-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 34px;
          height: 34px;
          padding: 0 10px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }
        .ad-page-btn:hover:not(:disabled):not(.is-active) {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        .ad-page-btn.is-active {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          border-color: #4f46e5;
          color: #ffffff;
          box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);
        }
        .ad-page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        @keyframes adPulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.65; }
        }
        .ad-unread-dot {
          animation: adPulseDot 1.6s ease-in-out infinite;
        }
        @media (max-width: 768px) {
          .ad-mobile-optimized {
            height: auto !important;
            min-height: 100% !important;
          }
          .ad-comunicados-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            margin-bottom: 14px !important;
          }
          .ad-comunicados-header h2 {
            font-size: 20px !important;
            line-height: 1.25 !important;
            margin: 0 !important;
          }
          .ad-comunicados-header p {
            font-size: 13px !important;
            margin-top: 2px !important;
            line-height: 1.4 !important;
          }
          .ad-comunicados-actions-row {
            width: 100% !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
          }
          .ad-comunicados-actions-row > button:not(.ad-com-btn-refresh) {
            flex: 1 !important;
            height: 38px !important;
            justify-content: center !important;
            font-size: 12px !important;
            padding: 0 10px !important;
          }
          .ad-kpi-strip {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .ad-comunicados-filter-bar {
            margin-top: 12px !important;
            padding: 12px !important;
            border-radius: 16px !important;
            gap: 10px !important;
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .ad-filter-divider {
            display: none !important;
          }
          .ad-filter-search-box {
            width: 100% !important;
            flex: none !important;
            order: 1 !important;
          }
          .ad-filter-subrow {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            width: 100% !important;
            order: 2 !important;
          }
          .ad-filter-subrow > * {
            width: 100% !important;
            min-width: 0 !important;
            flex: 1 !important;
          }
          .ad-filter-chips-row {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            width: 100% !important;
            order: 3 !important;
          }
          .ad-filter-chips-row > button {
            flex: 1 !important;
            justify-content: center !important;
            font-size: 12px !important;
            height: 36px !important;
            padding: 0 10px !important;
          }
          .ad-comunicados-tabs {
            width: 100% !important;
            display: flex !important;
            background: #f1f5f9 !important;
            padding: 4px !important;
            border-radius: 12px !important;
            gap: 4px !important;
            margin-bottom: 12px !important;
            box-sizing: border-box !important;
          }
          .ad-comunicados-tabs .tab-trigger {
            flex: 1 1 0 !important;
            width: auto !important;
            justify-content: center !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            padding: 8px 6px !important;
            border-radius: 8px !important;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            white-space: nowrap !important;
          }
          .ad-comunicado-card {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 14px 16px !important;
            border-radius: 16px !important;
          }
          .ad-comunicado-title {
            font-size: 15px !important;
            font-weight: 800 !important;
            line-height: 1.3 !important;
            white-space: normal !important;
            word-break: break-word !important;
          }
          .ad-comunicado-snippet {
            white-space: normal !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
            line-height: 1.4 !important;
            font-size: 13px !important;
          }
          .ad-comunicado-stats {
            border-left: none !important;
            padding-left: 0 !important;
            min-width: 0 !important;
            width: 100% !important;
            border-top: 1px solid #f1f5f9 !important;
            padding-top: 10px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
          }
          .ad-comunicado-actions {
            width: 100% !important;
            padding-left: 0 !important;
            border-top: 1px solid #f1f5f9 !important;
            padding-top: 10px !important;
            display: flex !important;
            justify-content: flex-end !important;
            gap: 8px !important;
          }
          .ad-pagination-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .ad-comunicados-scroll-container {
            padding-right: 0 !important;
            padding-bottom: 120px !important;
          }
        }
        @keyframes adSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .ad-spin-icon {
          animation: adSpin 0.75s linear infinite !important;
        }
        .ad-com-btn-refresh {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          min-height: 38px !important;
          border-radius: 12px !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #64748b !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
          cursor: pointer !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          flex-shrink: 0 !important;
        }
        .ad-com-btn-refresh:hover:not(:disabled) {
          background: #f8fafc !important;
          color: #4f46e5 !important;
          border-color: #cbd5e1 !important;
          transform: translateY(-1px) !important;
        }
      `}} />

      {/* Top Header + KPI Strip */}
      <div className="ad-comunicados-header" style={{ marginBottom: 14, position: 'relative', zIndex: showNovoMenu ? 9999 : 50 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 18px -4px rgba(79, 70, 229, 0.35)',
              flexShrink: 0
            }}>
              <Bell size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Central de Comunicados
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 99,
                  background: '#eef2ff',
                  color: '#4f46e5',
                  border: '1px solid rgba(99, 102, 241, 0.2)'
                }}>
                  {totalCount} {totalCount === 1 ? 'registro' : 'registros'}
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, margin: '2px 0 0 0', fontWeight: 500 }}>
                Gestão de comunicados, relatórios pedagógicos, taxa de leitura por família e conversas privadas.
              </p>
            </div>
          </div>

          {/* Action Buttons group */}
          <div className="ad-comunicados-actions-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative', zIndex: showNovoMenu ? 10000 : 2 }}>
            <button
              onClick={() => setShowMonthlyReport(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                height: 38,
                padding: '0 14px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <Calendar size={15} style={{ color: '#6366f1' }} />
              <span>Relatório Mensal</span>
            </button>

            <button
              onClick={() => setShowEngagementDashboard(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                height: 38,
                padding: '0 14px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(79, 70, 229, 0.12))',
                color: '#4f46e5',
                border: '1px solid rgba(99, 102, 241, 0.22)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <Activity size={15} />
              <span>Engajamento</span>
            </button>

            <button
              className={`ad-com-btn-refresh ${isRefreshing ? 'is-loading' : ''}`}
              onClick={handleRefresh}
              disabled={isRefreshing}
              type="button"
              title="Atualizar lista de comunicados"
              aria-label="Atualizar lista de comunicados"
            >
              <RotateCw size={15} strokeWidth={2.2} className={isRefreshing ? 'ad-spin-icon' : ''} />
            </button>

            <div ref={novoMenuRef} style={{ position: 'relative', zIndex: showNovoMenu ? 10001 : 2 }}>
              <button
                onClick={() => setShowNovoMenu(prev => !prev)}
                type="button"
                aria-expanded={showNovoMenu}
                aria-haspopup="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <Plus size={15} strokeWidth={2.5} style={{ transform: showNovoMenu ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }} />
                <span>Novo</span>
                <ChevronDown size={13} strokeWidth={2.5} style={{ transform: showNovoMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', marginLeft: -1 }} />
              </button>

              <AnimatePresence>
                {showNovoMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: 192,
                      background: '#FFFFFF',
                      borderRadius: 14,
                      padding: 6,
                      boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(226, 232, 240, 0.95)',
                      zIndex: 10002,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowNovoMenu(false);
                        handleNovo();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%'
                      }}
                    >
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(99, 102, 241, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6366F1',
                        flexShrink: 0
                      }}>
                        <SendIcon size={14} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Novo Comunicado</span>
                    </button>

                    <div style={{ height: 1, background: '#F1F5F9', margin: '1px 6px' }} />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowNovoMenu(false);
                        setShowRelsModal(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%'
                      }}
                    >
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(14, 165, 233, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0284C7',
                        flexShrink: 0
                      }}>
                        <FileBarChart size={14} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Novo Relatório</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Compact KPI Strip for current page */}
        <div
          className="ad-kpi-strip"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 10,
            marginTop: 14
          }}
        >
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total na Aba</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>{totalCount}</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={16} />
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Média de Leitura</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: pageSummary.avgReadPct >= 75 ? '#059669' : '#4f46e5', marginTop: 1 }}>{pageSummary.avgReadPct}%</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: pageSummary.avgReadPct >= 75 ? '#ecfdf5' : '#eef2ff', color: pageSummary.avgReadPct >= 75 ? '#059669' : '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>

          <div
            onClick={() => setFilterComentarios(prev => !prev)}
            style={{ background: filterComentarios ? '#eef2ff' : '#ffffff', border: `1px solid ${filterComentarios ? '#818cf8' : '#e2e8f0'}`, borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}
            title="Clique para filtrar comunicados com comentários"
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Com Comentários</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{pageSummary.withComments}</span>
                {pageSummary.withUnreadComments > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {pageSummary.withUnreadComments} {pageSummary.withUnreadComments === 1 ? 'novo' : 'novos'}
                  </span>
                )}
              </div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: pageSummary.withUnreadComments > 0 ? '#fef2f2' : '#f8fafc', color: pageSummary.withUnreadComments > 0 ? '#dc2626' : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={16} />
            </div>
          </div>

          <div
            onClick={() => setFilterRelatorio(prev => !prev)}
            style={{ background: filterRelatorio ? '#f5f3ff' : '#ffffff', border: `1px solid ${filterRelatorio ? '#a78bfa' : '#e2e8f0'}`, borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}
            title="Clique para filtrar relatórios pedagógicos"
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Relatórios na Página</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed', marginTop: 1 }}>{pageSummary.reportsCount}</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileBarChart size={16} />
            </div>
          </div>
        </div>

        {/* Filter bar container */}
        <div 
          className="ad-comunicados-filter-bar"
          style={{ 
            marginTop: 12, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            flexWrap: 'wrap',
            background: '#ffffff',
            padding: '10px 14px',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.02)'
          }}
        >
          <div className="ad-filter-subrow" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 auto' }}>
            <div style={{ flexShrink: 0 }}>
              <MiniCalendarFilter
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                activeDatesWithComunicados={activeDatesWithComunicados}
              />
            </div>

            <div className="ad-filter-divider" style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 2px' }} />

            <div className="ad-filter-author-box" style={{ position: 'relative', flex: '1 1 190px', minWidth: 150 }}>
              <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <select 
                value={authorFilter}
                onChange={e => setAuthorFilter(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  paddingLeft: 34,
                  paddingRight: 28,
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#1e293b',
                  fontSize: 13,
                  fontWeight: 600,
                  appearance: 'none',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="todos">Todos os Autores</option>
                <option value="meus">Meus Comunicados</option>
                {availableRoles.length > 0 && (
                  <optgroup label="Filtrar por Cargo">
                    {availableRoles.map(role => <option key={`role-${role}`} value={`cargo:${role}`}>{role}</option>)}
                  </optgroup>
                )}
                {availableAuthors.length > 0 && (
                  <optgroup label="Filtrar por Colaborador">
                    {availableAuthors.map(autor => <option key={`aut-${autor}`} value={`autor:${autor}`}>{autor}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <div className="ad-filter-divider" style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 2px' }} />

          <div className="ad-filter-search-box" style={{ position: 'relative', flex: '1.4 1 220px', minWidth: 190 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input 
              placeholder="Buscar título, conteúdo ou autor..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: 36,
                paddingLeft: 34,
                paddingRight: search ? 32 : 12,
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#1e293b',
                fontSize: 13,
                fontWeight: 500,
                outline: 'none'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="ad-filter-divider" style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 2px' }} />

          <div className="ad-filter-chips-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setFilterComentarios(prev => !prev)}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: 10,
                border: filterComentarios ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                background: filterComentarios ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#ffffff',
                color: filterComentarios ? '#ffffff' : '#475569',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <MessageSquare size={13} fill={filterComentarios ? '#ffffff' : 'none'} />
              <span>Comentários</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterRelatorio(prev => !prev)}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: 10,
                border: filterRelatorio ? '1px solid #7c3aed' : '1px solid #e2e8f0',
                background: filterRelatorio ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : '#ffffff',
                color: filterRelatorio ? '#ffffff' : '#475569',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <FileBarChart size={13} />
              <span>Relatórios</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs + Bulk Action + Top Page Size Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div className="tab-list ad-comunicados-tabs" style={{ marginBottom: 0, width: 'fit-content' }}>
            <button className={`tab-trigger ${tab === 'enviados' ? 'active' : ''}`} onClick={() => setTab('enviados')}>
              <SendIcon size={14} /> Enviados
            </button>
            <button className={`tab-trigger ${tab === 'agendados' ? 'active' : ''}`} onClick={() => setTab('agendados')}>
              <Clock size={14} /> Agendados
            </button>
            <button className={`tab-trigger ${tab === 'rascunhos' ? 'active' : ''}`} onClick={() => setTab('rascunhos')}>
              <FileText size={14} /> Rascunhos
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox"
              checked={filtered.length > 0 && selectedComs.length === filtered.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedComs(filtered.map(c => c.id));
                } else {
                  setSelectedComs([]);
                }
              }}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4f46e5' }}
              title="Selecionar todos os comunicados desta página"
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
              {selectedComs.length > 0 ? `${selectedComs.length} selecionado(s)` : 'Selecionar página'}
            </span>
            {selectedComs.length > 0 && (
              <button 
                className="btn" 
                onClick={handleBulkDelete} 
                style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: '#ef4444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <Trash size={13} /> Excluir ({selectedComs.length})
              </button>
            )}
          </div>
        </div>

        {/* Top Pagination & Items per page selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            {totalCount > 0 ? `Mostrando ${rangeStart}–${rangeEnd} de ${totalCount}` : '0 registros'}
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', padding: 3, borderRadius: 10, border: '1px solid #e2e8f0', gap: 2 }}>
            {[10, 30, 50, 100].map(size => {
              const active = pageSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setStoredPageSize(size)}
                  style={{
                    height: 26,
                    padding: '0 9px',
                    borderRadius: 7,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? '#4f46e5' : '#64748b',
                    boxShadow: active ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title={`Exibir ${size} comunicados por página`}
                >
                  {size}
                </button>
              );
            })}
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', padding: '0 6px' }}>/ pág</span>
          </div>
        </div>
      </div>

      {/* Active Filters Indicator Banner */}
      {(selectedDate || filterComentarios || filterRelatorio || authorFilter !== 'todos' || debouncedSearch.trim()) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.07), rgba(99, 102, 241, 0.03))',
            border: '1px solid rgba(79, 70, 229, 0.18)',
            borderRadius: 12,
            marginBottom: 12,
            gap: 10,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
              Filtros ativos ({totalCount} {totalCount === 1 ? 'resultado' : 'resultados'}):
            </span>

            {selectedDate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ffffff', border: '1px solid rgba(79, 70, 229, 0.25)', padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#4f46e5' }}>
                <Calendar size={12} />
                <span>{selectedDateFormatted}</span>
                <span role="button" onClick={() => setSelectedDate(null)} style={{ cursor: 'pointer', opacity: 0.7, marginLeft: 2 }}>×</span>
              </span>
            )}

            {filterComentarios && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ffffff', border: '1px solid rgba(79, 70, 229, 0.25)', padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#4f46e5' }}>
                <MessageSquare size={12} />
                <span>Com Comentários</span>
                <span role="button" onClick={() => setFilterComentarios(false)} style={{ cursor: 'pointer', opacity: 0.7, marginLeft: 2 }}>×</span>
              </span>
            )}

            {filterRelatorio && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ffffff', border: '1px solid rgba(124, 58, 237, 0.25)', padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>
                <FileBarChart size={12} />
                <span>Com Relatório</span>
                <span role="button" onClick={() => setFilterRelatorio(false)} style={{ cursor: 'pointer', opacity: 0.7, marginLeft: 2 }}>×</span>
              </span>
            )}

            {authorFilter !== 'todos' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ffffff', border: '1px solid rgba(79, 70, 229, 0.25)', padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#4f46e5' }}>
                <User size={12} />
                <span>{authorFilter.replace(/^(autor:|cargo:)/, '')}</span>
                <span role="button" onClick={() => setAuthorFilter('todos')} style={{ cursor: 'pointer', opacity: 0.7, marginLeft: 2 }}>×</span>
              </span>
            )}
          </div>

          <button
            onClick={() => {
              setSelectedDate(null);
              setFilterComentarios(false);
              setFilterRelatorio(false);
              setAuthorFilter('todos');
              setSearch('');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              color: '#4f46e5',
              background: '#ffffff',
              border: '1px solid rgba(79, 70, 229, 0.25)',
              padding: '4px 10px',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            <X size={12} /> Limpar filtros
          </button>
        </div>
      )}

      {/* Main Scrollable List */}
      <div ref={listScrollContainerRef} className="ad-comunicados-scroll-container" style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 && isDataLoading && (
            <div style={{ textAlign: 'center', padding: '72px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <Loader2 size={42} className="animate-spin" color="#4f46e5" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Carregando comunicados...</span>
            </div>
          )}
          {filtered.length === 0 && !isDataLoading && (
            <div style={{ textAlign: 'center', padding: '72px 20px', background: '#ffffff', borderRadius: 20, border: '1px dashed #cbd5e1' }}>
              <Bell size={44} style={{ opacity: 0.15, marginBottom: 12, color: '#4f46e5' }} />
              {isLocalError ? (
                <div>
                  <p style={{ color: '#0f172a', fontSize: 16, fontWeight: 700, margin: '0 0 6px 0' }}>
                    Não foi possível carregar os comunicados no momento.
                  </p>
                  <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px 0' }}>
                    Verifique sua conexão e tente atualizar a lista novamente.
                  </p>
                  <button
                    onClick={() => refetchLocal()}
                    style={{
                      background: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : (selectedDate || filterComentarios || filterRelatorio || authorFilter !== 'todos' || debouncedSearch.trim()) ? (
                <div>
                  <p style={{ color: '#0f172a', fontSize: 16, fontWeight: 700, margin: '0 0 6px 0' }}>
                    Nenhum comunicado encontrado com os filtros selecionados.
                  </p>
                  <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px 0' }}>
                    Tente ajustar ou limpar os filtros para visualizar outros comunicados.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedDate(null);
                      setFilterComentarios(false);
                      setFilterRelatorio(false);
                      setAuthorFilter('todos');
                      setSearch('');
                    }}
                    style={{
                      background: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: 15, fontWeight: 600, margin: 0 }}>Nenhum comunicado encontrado nesta aba.</p>
              )}
            </div>
          )}

          {filtered.map((c, idx) => {
            const metrics = computeComunicadoMetrics(c);
            const { isGlobal, targetTurmas, targetCount, lidas, progresso } = metrics;
            const pctRounded = Math.round(progresso);
            const dateObj = (c.dataEnvio || (c as any).data || (c as any).created_at)
              ? new Date(c.dataEnvio || (c as any).data || (c as any).created_at)
              : null;

            const hasServerConversasInfo = c.conversas_info !== undefined && c.conversas_info !== null;
            const cachedMsgs = getGlobalCachedMessages(c.id);
            const hasConversas = hasServerConversasInfo
              ? Boolean(
                  c.conversas_info.tem_conversas ||
                  (c.conversas_info.total && c.conversas_info.total > 0) ||
                  (Array.isArray(c.respostas) && c.respostas.length > 0) ||
                  (cachedMsgs && cachedMsgs.length > 0)
                )
              : Boolean(
                  idsWithReplies.has(String(c.id)) ||
                  (Array.isArray(c.respostas) && c.respostas.length > 0) ||
                  (cachedMsgs && cachedMsgs.length > 0)
                );

            const conversasCount =
              c.conversas_info?.total ||
              (Array.isArray(c.respostas) ? c.respostas.length : 0) ||
              (cachedMsgs?.length || 0) ||
              (hasConversas ? 1 : 0);

            const hasUnreadConversation = Boolean(
              hasConversas && (
                c.conversas_info?.has_unread ||
                (c.conversas_info?.nao_lidas && c.conversas_info.nao_lidas > 0) ||
                c._has_unread_reply
              )
            );

            const isReportCard = Boolean(
              c.id?.startsWith('AD-COM-REL-') ||
              c.tipo === 'relatorio' ||
              (c as any).dados?.tipo === 'relatorio' ||
              (c.titulo && c.titulo.toLowerCase().includes('relatório'))
            );

            const accentColor = hasUnreadConversation
              ? '#ef4444'
              : isReportCard
              ? '#7c3aed'
              : isGlobal
              ? '#10b981'
              : '#4f46e5';

            const readAccentColor = pctRounded >= 80
              ? '#059669'
              : pctRounded >= 40
              ? '#4f46e5'
              : pctRounded > 0
              ? '#d97706'
              : '#64748b';

            const readBarBg = pctRounded >= 80
              ? 'linear-gradient(90deg, #10b981, #059669)'
              : pctRounded >= 40
              ? 'linear-gradient(90deg, #6366f1, #4f46e5)'
              : pctRounded > 0
              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
              : '#cbd5e1';

            const isSelected = selectedComs.includes(c.id);

            return (
              <div
                key={c.id}
                onClick={() => {
                  setViewingComFocusComments(false);
                  setViewingCom(c);
                }}
                onPointerDown={() => prefetchComunicadoMessages(c, true)}
                className={`ad-comunicado-card ${idx >= 8 ? 'ad-below-fold' : ''} ${isSelected ? 'is-selected' : ''}`}
                style={{
                  borderLeft: `4px solid ${accentColor}`
                }}
              >
                {/* Selection Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedComs(prev => [...prev, c.id]);
                      } else {
                        setSelectedComs(prev => prev.filter(id => id !== c.id));
                      }
                    }}
                    style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#4f46e5' }}
                  />
                </div>

                {/* Main Content Column */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: isReportCard ? 'rgba(124, 58, 237, 0.1)' : 'rgba(79, 70, 229, 0.08)',
                      color: isReportCard ? '#7c3aed' : '#4f46e5',
                      flexShrink: 0
                    }}>
                      {isReportCard ? 'Relatório' : (c.tipo || 'Comunicado')}
                    </span>

                    <h3 className="ad-comunicado-title" style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                      {c.titulo}
                    </h3>

                    {c.fixado && (
                      <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '2px 6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}>
                        <Pin size={12} fill="#f59e0b" />
                      </span>
                    )}

                    {hasConversas && (
                      <button
                        type="button"
                        title={hasUnreadConversation ? `${conversasCount} comentário(s) — há nova mensagem não lida! Clique para abrir a conversa.` : `${conversasCount} comentário(s) registrado(s). Clique para ver o comentário.`}
                        onClick={e => {
                          e.stopPropagation();
                          setViewingComFocusComments(true);
                          setViewingCom(c);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: hasUnreadConversation ? '#fef2f2' : '#eef2ff',
                          color: hasUnreadConversation ? '#dc2626' : '#4f46e5',
                          border: `1px solid ${hasUnreadConversation ? 'rgba(239, 68, 68, 0.35)' : 'rgba(99, 102, 241, 0.28)'}`,
                          padding: '2px 9px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        <MessageSquare size={11.5} fill={hasUnreadConversation ? '#dc2626' : '#4f46e5'} fillOpacity={0.2} />
                        <span>{conversasCount}</span>
                        {hasUnreadConversation && (
                          <span className="ad-unread-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                        )}
                      </button>
                    )}
                  </div>
                  
                  <p className="ad-comunicado-snippet" style={{ margin: 0, fontSize: 13.5, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                    {(c.conteudo || (c as any).texto || '').replace(/<[^>]*>/g, '').replace(/[\*\#\_]/g, '')}
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {/* Author chip */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: 99 }}>
                      <User size={12} color="#64748b" />
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
                        {c.autor || 'Sistema'}
                        {(c.autorCargo || (c as any).dados?.autorCargo) && (
                          <span style={{ fontWeight: 500, color: '#94a3b8' }}> • {c.autorCargo || (c as any).dados?.autorCargo}</span>
                        )}
                      </span>
                    </div>

                    {/* Turma chip when single or few turmas */}
                    {!isGlobal && targetTurmas.length > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f5f3ff', border: '1px solid rgba(124, 58, 237, 0.18)', padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, color: '#6d28d9' }}>
                        <GraduationCap size={12} />
                        <span>{targetTurmas.length === 1 ? targetTurmas[0] : `${targetTurmas[0]} +${targetTurmas.length - 1}`}</span>
                      </div>
                    )}

                    {/* Recipients badge */}
                    {isGlobal ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, color: '#059669' }}>
                        <Users size={12} /> Toda a Escola ({targetCount})
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={e => { e.stopPropagation(); setViewingDestCom(c); }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          padding: '3px 10px',
                          borderRadius: 99,
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                        title="Ver lista de turmas e alunos destinatários"
                      >
                        <Users size={12} color="#4f46e5" />
                        <span>Destinatários ({targetCount})</span>
                      </button>
                    )}

                    {/* Interactive Comment Pill */}
                    {hasConversas && (
                      <button
                        type="button"
                        title="Clique para abrir e ler os comentários deste comunicado"
                        onClick={e => {
                          e.stopPropagation();
                          setViewingComFocusComments(true);
                          setViewingCom(c);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: hasUnreadConversation ? '#fef2f2' : '#eef2ff',
                          color: hasUnreadConversation ? '#dc2626' : '#4f46e5',
                          border: `1px solid ${hasUnreadConversation ? 'rgba(239, 68, 68, 0.35)' : 'rgba(99, 102, 241, 0.25)'}`,
                          padding: '3px 10px',
                          borderRadius: 99,
                          fontSize: 11.5,
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        <MessageSquare size={12} />
                        <span>
                          {hasUnreadConversation ? 'Novo comentário • ' : ''}
                          {conversasCount} {conversasCount === 1 ? 'comentário' : 'comentários'}
                        </span>
                        {hasUnreadConversation && (
                          <span className="ad-unread-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                        )}
                      </button>
                    )}

                    {/* Date & Time */}
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} />
                      {dateObj ? `${dateObj.toLocaleDateString('pt-BR')} às ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '--'}
                    </div>
                  </div>
                </div>

                {/* Column: Leitura % Interactive Card Widget */}
                <div
                  className="ad-comunicado-stats"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedCom(c);
                  }}
                  title="Clique para abrir o relatório detalhado de leitura por família"
                  style={{
                    minWidth: 185,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderLeft: '1px solid #f1f5f9',
                    paddingLeft: 18
                  }}
                >
                  <div style={{
                    flex: 1,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '8px 12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Leitura
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 900, color: readAccentColor }}>
                          {pctRounded}%
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                          ({lidas}/{targetCount})
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pctRounded}%`,
                          height: '100%',
                          background: readBarBg,
                          borderRadius: 99,
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Column: Actions */}
                <div className="ad-comunicado-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ width: 34, height: 34, padding: 0, borderRadius: 10, color: '#64748b', border: '1px solid #e2e8f0', background: '#ffffff' }}
                    onClick={e => { e.stopPropagation(); handleReenviar(c); }}
                    title="Reenviar / Encaminhar"
                  >
                    <SendIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{
                      padding: '0 13px',
                      height: 34,
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 800,
                      background: '#0f172a',
                      borderColor: '#0f172a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5
                    }}
                    onClick={e => { e.stopPropagation(); setSelectedCom(c); }}
                  >
                    <Eye size={13} />
                    <span>Leituras</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Modern Full Pagination Footer */}
          {totalCount > 0 && (
            <div
              className="ad-pagination-bar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginTop: 8,
                marginBottom: 28,
                padding: '12px 18px',
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.02)',
                flexWrap: 'wrap'
              }}
            >
              {/* Left: Page Size Selector (10, 30, 50, 100) + Item Counter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>Comunicados por página:</span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', padding: 3, borderRadius: 10, border: '1px solid #e2e8f0', gap: 2 }}>
                    {[10, 30, 50, 100].map(size => {
                      const active = pageSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setStoredPageSize(size)}
                          style={{
                            height: 28,
                            padding: '0 10px',
                            borderRadius: 7,
                            border: 'none',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: active ? '#4f46e5' : 'transparent',
                            color: active ? '#ffffff' : '#475569',
                            boxShadow: active ? '0 2px 6px rgba(79, 70, 229, 0.25)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b' }}>
                  Exibindo <strong>{rangeStart}–{rangeEnd}</strong> de <strong>{totalCount}</strong> comunicados (Página {currentPage} de {totalPages})
                </span>
              </div>

              {/* Right: Page Navigation Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ad-page-btn"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage <= 1 || isDataLoading}
                  title="Primeira página"
                >
                  <ChevronsLeft size={15} />
                </button>
                <button
                  type="button"
                  className="ad-page-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isDataLoading}
                  title="Página anterior"
                  style={{ gap: 4, padding: '0 12px' }}
                >
                  <ChevronLeft size={15} />
                  <span>Anterior</span>
                </button>

                {visiblePageNumbers.map((item) => {
                  if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                    return (
                      <span key={item} style={{ padding: '0 4px', color: '#94a3b8', fontWeight: 700, fontSize: 13 }}>
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`ad-page-btn ${currentPage === item ? 'is-active' : ''}`}
                      onClick={() => handlePageChange(item)}
                      disabled={isDataLoading}
                    >
                      {item}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="ad-page-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isDataLoading}
                  title="Próxima página"
                  style={{ gap: 4, padding: '0 12px' }}
                >
                  <span>Próxima</span>
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  className="ad-page-btn"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage >= totalPages || isDataLoading}
                  title="Última página"
                >
                  <ChevronsRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
{/* Drawer: Comunicado Details */}
      {selectedCom && (
        <ClientPortal>
          <ComunicadoReportModal 
            selectedCom={selectedCom}
            alunosAtivos={alunosAtivos}
            turmas={turmas}
            chatGroups={chatGroups}
            colaboradores={colaboradores}
            onClose={() => setSelectedCom(null)}
            setViewingReportPayload={setViewingReportPayload}
            renderConteudo={renderConteudo}
          />
</ClientPortal>)}</AnimatePresence>

      
      {/* Loader luxuoso ao clicar em Novo Comunicado enquanto dados ainda estiverem carregando */}
      <AgendaLuxuryLoader
        isLoading={isPreparingNovo}
        statusText="Carregando destinatários, turmas e contatos..."
        subtitle="NOVO COMUNICADO"
        minDisplayTimeMs={650}
        onFinished={() => {
          setIsPreparingNovo(false)
          setShowComposer(true)
        }}
      />

      {/* Modal Composer */}
      <NovoComunicadoModal
        isOpen={showComposer}
        onClose={() => { setShowComposer(false); setSelectedDest([]); setForwardComData(null); }}
        initialData={editComId ? comunicados.find(c => c.id === editComId) : forwardComData}
        currentUser={currentUser}
        selectedDest={selectedDest}
        onClickSelectDest={() => setShowDestModal(true)}
        onRemoveDest={id => setSelectedDest(prev => prev.filter(x => x.id !== id))}
        onSave={(data, isDraft) => handleEnviar(data, isDraft)}
      />

      {/* Destinatarios Universal Modal */}
      <DestinatariosModal 
        isOpen={showDestModal}
        onClose={() => setShowDestModal(false)}
        initialSelected={selectedDest}
        onAdd={(res) => setSelectedDest(res as any)}
      />

      <AnimatePresence>
        {/* Cobranca Modal */}
        {showCobrancaModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'none', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="card" style={{ width: 480, padding: 24, boxShadow: '0 40px 100px rgba(15,23,42,0.85)', borderRadius: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>Criar Nova Cobrança</h3>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Este pagamento ficará disponível no App Central.</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCobrancaModal(false)}><X size={18} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="form-label">Motivo (Produto/Serviço)</label>
                  <input className="form-input" placeholder="Ex: Livro Didático Extra" value={cobrancaForm.motivo} onChange={e => setCobrancaForm(f => ({...f, motivo: e.target.value}))}/>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Valor (R$)</label>
                    <input className="form-input" type="number" placeholder="0.00" value={cobrancaForm.valor} onChange={e => setCobrancaForm(f => ({...f, valor: e.target.value}))}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Data de Vencimento</label>
                    <input className="form-input" type="date" value={cobrancaForm.vencimento} onChange={e => setCobrancaForm(f => ({...f, vencimento: e.target.value}))}/>
                  </div>
                </div>
                <div>
                  <label className="form-label">Forma de Pagamento Aceita</label>
                  <select className="form-input" value={cobrancaForm.tipo} onChange={e => setCobrancaForm(f => ({...f, tipo: e.target.value}))}>
                    <option value="pix">Exclusivo PIX</option>
                    <option value="boleto">PIX + Boleto</option>
                    <option value="cartao">PIX + Cartão de Crédito</option>
                  </select>
                </div>
                
                <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', marginTop: 8, paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setShowCobrancaModal(false)}>Cancelar</button>
                  <button className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} onClick={() => {
                    if (!cobrancaForm.motivo || !cobrancaForm.valor) return adAlert('Preencha motivo e valor.', 'Atenção');
                    const novaCob = {
                      id: `app-cob-${Date.now()}`,
                      aluno: selectedDest.length > 0 ? selectedDest.map(d=>d.name).join(', ') : 'Toda a Escola',
                      motivo: cobrancaForm.motivo,
                      valor: parseFloat(cobrancaForm.valor),
                      vencimento: cobrancaForm.vencimento.split('-').reverse().join('/'),
                      status: 'pendente',
                      tipo: cobrancaForm.tipo
                    }
                    setAppCharges(prev => [novaCob, ...prev])
                    
                    const txtCob = `\n\n[Aviso de Fatura Gerada] Acesse o link para pagamento no seu app:\n **${cobrancaForm.motivo}** - R$ ${novaCob.valor.toFixed(2)}\n`
                    
                        
                    setCobrancaForm({ motivo: '', valor: '', vencimento: '', tipo: 'pix' })
                    setShowCobrancaModal(false)
                  }}>Gerar Cobrança e Inserir no Texto</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        <DashboardEngajamento 
          isOpen={showEngagementDashboard} 
          onClose={() => setShowEngagementDashboard(false)} 
          comunicados={comunicados} 
          alunosAtivos={alunosAtivos} 
        />
      </AnimatePresence>

      <ReportsSelectionModal 
        isOpen={showRelsModal} 
        onClose={() => setShowRelsModal(false)} 
        selectedDest={selectedDest} 
        currentUser={currentUser}
        onAdd={(text, payload) => alert('Atenção: Adicione o relatório anexando o PDF gerado ou insira o link no corpo do comunicado.')} 
        onFillDirectly={(payload) => {
          setOpenedReportTaskStr(`ReportTask|payload:${JSON.stringify(payload)}`);
          setShowRelsModal(false);
        }}
      />

      <ReportFillerModal
        isOpen={!!openedReportTaskStr}
        anexoStr={openedReportTaskStr}
        onClose={() => setOpenedReportTaskStr(null)}
        onBack={() => { setOpenedReportTaskStr(null); setShowRelsModal(true); }}
        currentUser={currentUser}
        alunos={alunos}
        turmas={turmas}
      />

      <AnimatePresence>
        {/* Forms Selection Modal */}
        {showFormsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(15,23,42,0.85)', backdropFilter: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="card" style={{ width: '100%', maxWidth: 550, padding: 40, borderRadius: 40, boxShadow: '0 50px 100px rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.3)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                  <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8 }}>📝 Anexar Formulário</h3>
                  <p style={{ fontSize: 14, color: '#64748b', fontWeight: 600, maxWidth: '90%' }}>Envie uma pesquisa, formulário de coleta de dados ou autorização para os pais.</p>
                </div>
                <button className="btn" onClick={() => setShowFormsModal(false)} style={{ background: '#f1f5f9', width: 40, height: 40, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', border: 'none' }}><X size={20} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto', paddingRight: 8, margin: '0 -8px' }}>
                {forms.filter(f => f.status !== 'arquivado').map(f => (
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: '#f8fafc' }}
                    whileTap={{ scale: 0.98 }}
                    key={f.id} 
                    className="btn"
                    style={{ 
                      justifyContent: 'flex-start', textAlign: 'left', minHeight: 80, padding: '16px 20px', borderRadius: 24, 
                      background: '#fff', border: '1px solid #e2e8f0', display: 'flex', gap: 18, cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                    }}
                    onClick={() => { ; setShowFormsModal(false) }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                      <FileText size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#1e293b', marginBottom: 2 }}>{f.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{(f as any).questions?.length || 0} perguntas no total</div>
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                      <Plus size={16} color="#3b82f6" />
                    </div>
                  </motion.button>
                ))}
                {forms.filter(f => f.status !== 'arquivado').length === 0 && (
                  <div style={{ padding: '60px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: 32, border: '2px dashed #e2e8f0' }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📋</div>
                    <h4 style={{ fontSize: 16, fontWeight: 900, color: '#475569', marginBottom: 8 }}>Nenhum formulário ativo</h4>
                  </div>
                )}
              </div>

              <button className="btn" style={{ width: '100%', marginTop: 32, height: 56, borderRadius: 20, fontWeight: 900, background: '#0f172a', border: 'none', color: '#fff', fontSize: 15, boxShadow: '0 10px 20px rgba(15, 23, 42, 0.2)' }} onClick={() => setShowFormsModal(false)}>Fechar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {viewingCom && (
        <ComunicadoViewModal
          comunicado={viewingCom}
          allComunicados={comunicados}
          isAdminMode={true}
          isStaff={true}
          initialFocusComments={viewingComFocusComments}
          alunos={alunos}
          colaboradores={colaboradores}
          turmas={turmas}
          currentUserSlug={currentUser?.id ? String(currentUser.id) : 'admin'}
          currentUserName={currentUser?.nome || 'Administrador'}
          currentUserAvatar={currentUser?.foto || undefined}
          onCiencia={() => {}}
          onClose={() => {
            setViewingComFocusComments(false);
            setViewingCom(null);
          }}
          onEdit={(c) => {
            setViewingComFocusComments(false);
            setViewingCom(null);
            openEdit(c);
          }}
          onDelete={(id) => {
            setViewingComFocusComments(false);
            setViewingCom(null);
            handleDeleteSingleComunicado(id);
          }}
          onForward={(c) => {
            setViewingComFocusComments(false);
            setViewingCom(null);
            handleReenviar(c);
          }}
          setOpenedReportPayload={(str) => setViewingReportPayload({ string: str, editMode: false })}
          onEditReportPayload={(str) => setViewingReportPayload({ string: str, editMode: true })}
        />
      )}

      <ReportPayloadView
        isOpen={!!viewingReportPayload}
        onClose={() => setViewingReportPayload(null)}
        attachmentString={typeof viewingReportPayload === 'string' ? viewingReportPayload : (viewingReportPayload?.string || '')}
        targetStudentId={viewingReportPayload?.studentId}
        targetStudentName={viewingReportPayload?.studentName}
        targetStudentAvatar={viewingReportPayload?.studentAvatar}
        alunos={alunos}
        canEdit={Boolean(viewingCom?.id || selectedCom?.id)}
        initialEditMode={Boolean(typeof viewingReportPayload === 'object' && viewingReportPayload?.editMode)}
        onSaveReport={async (updatedAttachmentStr, updatedPayload, studentId) => {
          const targetComId = viewingCom?.id || selectedCom?.id;
          if (!targetComId) return;
          try {
            const res = await apiFetch('/api/comunicados', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: targetComId,
                updatedStudentReport: {
                  studentId,
                  studentPayload: updatedPayload,
                  updatedAnexoStr: updatedAttachmentStr
                }
              })
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || 'Falha ao atualizar o relatório individual.');
            }
            const updatedCom = await res.json();
            setViewingReportPayload((prev: any) =>
              typeof prev === 'string'
                ? updatedAttachmentStr
                : { ...(prev || {}), string: updatedAttachmentStr, editMode: false }
            );
            setViewingCom((prev: any) => {
              if (!prev || String(prev.id) !== String(targetComId)) return prev;
              const newAnexos = updatedCom?.anexos || prev.anexos;
              return {
                ...prev,
                ...updatedCom,
                anexos: newAnexos,
                dados: { ...(prev.dados || {}), ...(updatedCom?.dados || {}), anexos: newAnexos }
              };
            });
            setSelectedCom((prev: any) => {
              if (!prev || String(prev.id) !== String(targetComId)) return prev;
              const newAnexos = updatedCom?.anexos || prev.anexos;
              return {
                ...prev,
                ...updatedCom,
                anexos: newAnexos,
                dados: { ...(prev.dados || {}), ...(updatedCom?.dados || {}), anexos: newAnexos }
              };
            });
            setComunicadosLocally?.((prev: any) =>
              (prev || []).map((c: any) => {
                if (String(c.id) !== String(targetComId)) return c;
                const newAnexos = updatedCom?.anexos || c.anexos;
                return {
                  ...c,
                  ...updatedCom,
                  anexos: newAnexos,
                  dados: { ...(c.dados || {}), ...(updatedCom?.dados || {}), anexos: newAnexos }
                };
              })
            );
            queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['ocorrencias'] });
            queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'] });
            queryClient.invalidateQueries({ queryKey: ['ocorrencias-familia'] });
            adAlert('Relatório individual atualizado com sucesso!', 'Sucesso');
          } catch (e: any) {
            console.error('Erro ao salvar relatório individual (admin):', e);
            adAlert(e?.message || 'Erro ao atualizar o relatório individual.', 'Atenção');
            throw e;
          }
        }}
      />

      

      {/* Drawer para ver destinatários */}
      <AnimatePresence>
        {viewingDestCom && (
          <ClientPortal>
          <div 
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'none',
              zIndex: 10005, display: 'flex', justifyContent: 'flex-end'
            }} 
            onClick={() => setViewingDestCom(null)}
          >
            <motion.div 
              initial={{ x: '100%', opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.5 }}
              transition={{ type: "spring", stiffness: 380, damping: 35 }}
              style={{ 
                width: 450, 
                maxWidth: '100%', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                background: '#fff', 
                boxShadow: '-10px 0 40px rgba(0,0,0,0.15)',
                borderLeft: '1px solid hsl(var(--border-subtle))' 
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>👥 Destinatários</h3>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Lista de turmas e alunos vinculados.</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewingDestCom(null)} style={{ width: 32, height: 32, borderRadius: '50%', padding: 0 }}><X size={18} /></button>
              </div>
              <div style={{ padding: 32, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
                <div>
                  <strong style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Assunto</strong>
                  <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6, color: '#1e293b' }}>{viewingDestCom.titulo}</div>
                </div>
                <div>
                  <strong style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Turmas ({viewingDestCom.turmas?.length || 0})</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {viewingDestCom.turmas && viewingDestCom.turmas.length > 0 ? (
                      viewingDestCom.turmas.map((t, idx) => (
                        <span key={idx} className="badge" style={{ background: 'rgba(99,102,241,0.06)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.12)', fontSize: 11, padding: '4px 10px', fontWeight: 600 }}>
                          {t}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Nenhuma turma selecionada.</span>
                    )}
                  </div>
                </div>
                {(() => {
                  const destStuIds = computeComunicadoMetrics(viewingDestCom).explicitStudentIds;
                  if (destStuIds.length === 0) return null;
                  return (
                    <div>
                      <strong style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Alunos Destinatários ({destStuIds.length})</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                        {destStuIds.map((aId, idx) => {
                          const alunoObj = (alunos || []).find(al => cleanStuId(al.id) === cleanStuId(aId));
                          return (
                            <span key={idx} className="badge" style={{ background: 'rgba(16,185,129,0.06)', color: '#10b981', border: '1px solid rgba(16,185,129,0.12)', fontSize: 11, padding: '4px 10px', fontWeight: 600 }}>
                              {alunoObj ? alunoObj.nome : `ID: ${aId}`}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  );
                })()}
                {viewingDestCom.funcionariosIds && viewingDestCom.funcionariosIds.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Colaboradores ({viewingDestCom.funcionariosIds.length})</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {viewingDestCom.funcionariosIds.map((fId, idx) => {
                        const colabObj = (colaboradores || []).find(c => String(c.nome) === String(fId) || String((c as any).id) === String(fId) || String((c as any).id).replace(/^_+/, '') === String(fId).replace(/^_+/, ''));
                        return (
                          <span key={idx} className="badge" style={{ background: 'rgba(245,158,11,0.06)', color: '#d97706', border: '1px solid rgba(245,158,11,0.12)', fontSize: 11, padding: '4px 10px', fontWeight: 600 }}>
                            {colabObj ? colabObj.nome : `ID: ${fId}`}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                {viewingDestCom.grupos && viewingDestCom.grupos.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Grupos ({viewingDestCom.grupos.length})</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {viewingDestCom.grupos.map((g, idx) => (
                        <span key={idx} className="badge" style={{ background: 'rgba(236,72,153,0.06)', color: '#db2777', border: '1px solid rgba(236,72,153,0.12)', fontSize: 11, padding: '4px 10px', fontWeight: 600 }}>
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
          </ClientPortal>
        )}
      </AnimatePresence>

      {/* Modal Avançado do Relatório Mensal de Frequência */}
      <RelatorioFrequenciaMensalModal
        isOpen={showMonthlyReport}
        onClose={() => setShowMonthlyReport(false)}
        colaboradores={colaboradores}
        onSelectComunicado={(com) => setViewingCom(com)}
        initialAuthorFilter={authorFilter !== 'todos' ? authorFilter.replace(/^(autor:|cargo:)/, '') : 'todos'}
      />
    </div>
  )
}

