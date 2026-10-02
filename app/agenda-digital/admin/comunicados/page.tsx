'use client'
// Last Update: 2026-05-16T16:08:00Z - Forced Rebuild
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaDigital, ADComunicado } from '@/lib/agendaDigitalContext'
import { useQueryComunicados } from '@/lib/hooks/useAgendaQueries'
import { useData } from '@/lib/dataContext'
import { useFormularios } from '@/lib/formulariosContext'
import { useRelatorios } from '@/lib/relatoriosContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { 
  Bell, Search, Plus, Filter, Pin, FileText, CheckCircle2, XCircle, 
  Send as SendIcon, Clock, Paperclip, MoreHorizontal, X,
  Bold, Italic, Link as LinkIcon, List, Underline, BadgeDollarSign, Smile, FileBarChart,
  ClipboardList, BookOpen, GraduationCap, Calendar, Users, User, MessageSquare, Layout, FileCheck, Menu, Loader2, Activity, Trash, RotateCw
} from 'lucide-react'
import { DestinatariosModal } from '../../components/agenda/DestinatariosModal'
import NovoComunicadoModal from '../../components/agenda/NovoComunicadoModal'
import { ComunicadoReportModal } from '@/components/agenda/ComunicadoReportModal'
import { ReportsSelectionModal } from '@/components/agenda/ReportsSelectionModal'
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
  const [alunos] = useSupabaseArray<any>('alunos/lightweight?limit=2000');
  const { forms, setDisparos } = useFormularios()
  const { templates: relatoriosTemplates } = useRelatorios()
  
  const alunosAtivos = (alunos || []).filter(a => a.status === 'matriculado' || a.status === 'ativo')

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'all' }),
        queryClient.refetchQueries({ queryKey: ['agenda', 'comunicados'] })
      ])
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }, [queryClient, isRefreshing])

  // Ao entrar na tela ou voltar de outras abas, sincroniza de imediato
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'all' })
  }, [queryClient])

  // Escuta de eventos em tempo real com injeção otimista em 0ms
  useEffect(() => {
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
          const list = Array.isArray(prev) ? prev : []
          if (list.some((c: any) => String(c.id) === String(normalized.id))) {
            return list.map((c: any) => String(c.id) === String(normalized.id) ? { ...c, ...normalized } : c)
          }
          return [normalized, ...list]
        })
      }
      queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'all' })
    }

    const handleUpdate = (e: any) => {
      const payload = e.detail
      const rawItem = payload?.item || payload?.new || payload
      if (rawItem && rawItem.id) {
        setComunicadosLocally?.((prev: any) => {
          const list = Array.isArray(prev) ? prev : []
          return list.map((c: any) => String(c.id) === String(rawItem.id) ? { ...c, ...rawItem } : c)
        })
      }
      queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'all' })
    }

    const handleDelete = (e: any) => {
      const payload = e.detail
      const id = payload?.id || payload?.old?.id
      const ids = payload?.ids || (id ? [id] : [])
      if (ids.length > 0) {
        const idSet = new Set(ids.map(String))
        setComunicadosLocally?.((prev: any) => {
          const list = Array.isArray(prev) ? prev : []
          return list.filter((c: any) => !idSet.has(String(c.id)))
        })
      }
      queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'], refetchType: 'all' })
    }

    window.addEventListener('ad:comunicados-insert', handleInsert)
    window.addEventListener('ad:comunicados-update', handleUpdate)
    window.addEventListener('ad:comunicados-delete', handleDelete)

    const pollTimer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'] })
    }, 15000)

    return () => {
      window.removeEventListener('ad:comunicados-insert', handleInsert)
      window.removeEventListener('ad:comunicados-update', handleUpdate)
      window.removeEventListener('ad:comunicados-delete', handleDelete)
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

  const [showComposer, setShowComposer] = useState(false)
  const [viewingCom, setViewingCom] = useState<ADComunicado | null>(null)
  const [viewingReportPayload, setViewingReportPayload] = useState<any>(null)
  const [activePreviewStudent, setActivePreviewStudent] = useState<any>(null)
  const [viewingDestCom, setViewingDestCom] = useState<ADComunicado | null>(null)
  
  const [authorFilter, setAuthorFilter] = useState<string>('todos');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterComentarios, setFilterComentarios] = useState<boolean>(false);
  const [filterRelatorio, setFilterRelatorio] = useState<boolean>(false);
  const [attachmentFilter, setAttachmentFilter] = useState<string>('todos');
  const [reportAuthorFilter, setReportAuthorFilter] = useState<string>('todos');
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showEngagementDashboard, setShowEngagementDashboard] = useState(false);
  const [colaboradores, setColaboradores] = useState<{id?: string, nome: string, cargo?: string, perfil?: string}[]>([]);
  const [dbAuthors, setDbAuthors] = useState<string[]>([]);
  const [dbRoles, setDbRoles] = useState<string[]>([]);

  const [selectedComs, setSelectedComs] = useState<string[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  useEffect(() => {
    setSelectedComs([]);
  }, [tab, debouncedSearch, authorFilter, attachmentFilter, selectedDate, filterComentarios, filterRelatorio]);

  useEffect(() => {
    const fetchColaboradoresAndAuthors = async () => {
      try {
        const [usersRes, authorsRes] = await Promise.allSettled([
          fetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000'),
          fetch('/api/comunicados?type=autores')
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
    data: localQueryData,
    isLoading: isLocalLoading,
    isFetching: isLocalFetching,
    refetch: refetchLocal,
    hasNextPage: hasNextPageComunicados,
    fetchNextPage: fetchNextPageComunicados,
    isFetchingNextPage: isFetchingNextPageComunicados
  } = useQueryComunicados(endpoint, 25, { enabled: true });

  const comunicados = useMemo(() => localQueryData?.pages?.flat() || [], [localQueryData?.pages]);
  const isDataLoading = isLocalLoading || isLocalFetching;

  // Cache instantâneo de IDs com respostas na base de dados
  const [idsWithReplies, setIdsWithReplies] = useState<Set<string>>(new Set());

  const fetchIdsWithReplies = useCallback(() => {
    fetch('/api/comunicados?type=comentarios_ids')
      .then(res => res.json())
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

      fetch('/api/comunicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCom)
      }).catch(err => console.error("Erro ao salvar comunicado", err))

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

      fetch('/api/comunicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCom)
      }).catch(err => console.error("Erro ao salvar comunicado", err))

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

  const handleNovo = () => {
    setEditComId(null)
    
    
        
    
    
    setSelectedDest([])
    setShowComposer(true)
  }

  const handleBulkDelete = () => {
    adConfirm(`Tem certeza que deseja excluir ${selectedComs.length} comunicado(s)? Esta ação é irreversível.`, 'Excluir Comunicados', async () => {
      try {
        const res = await fetch(`/api/comunicados?ids=${selectedComs.join(',')}`, { method: 'DELETE' });
        if (res.ok) {
          if (setComunicadosLocally) {
            setComunicadosLocally(prev => prev.filter(c => !selectedComs.includes(c.id)));
          } else {
            setComunicados(prev => prev.filter(c => !selectedComs.includes(c.id)));
          }
          setSelectedComs([]);
          queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'] });
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
        const res = await fetch(`/api/comunicados?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) {
          if (setComunicadosLocally) {
            setComunicadosLocally(prev => prev.filter(c => c.id !== id));
          } else {
            setComunicados(prev => prev.filter(c => c.id !== id));
          }
          setSelectedComs(prev => prev.filter(x => x !== id));
          queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'] });
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
        const hasConversas = Boolean(
          idsWithReplies.has(String(c.id)) ||
          c.conversas_info?.tem_conversas || 
          (c.conversas_info?.total && c.conversas_info.total > 0) ||
          (Array.isArray(c.respostas) && c.respostas.length > 0) ||
          (getGlobalCachedMessages(c.id)?.length)
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

  const handleLoadMore = useCallback(async () => {
    if (isFetchingMore || isFetchingNextPageComunicados) return;
    setIsFetchingMore(true);
    try {
      if (hasNextPageComunicados && fetchNextPageComunicados) {
        await fetchNextPageComunicados();
      }
    } catch (err) {
      console.error('Erro ao carregar mais comunicados:', err);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, isFetchingNextPageComunicados, hasNextPageComunicados, fetchNextPageComunicados]);

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-comunicados-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 14px !important;
            margin-bottom: 20px !important;
          }
          .ad-comunicados-header h2 {
            font-size: 22px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
          }
          .ad-comunicados-header p {
            font-size: 13px !important;
            margin-top: 4px !important;
          }
          .ad-comunicados-actions {
            width: 100% !important;
            flex-direction: column !important;
            gap: 10px !important;
          }
          .ad-comunicados-top-row {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .ad-comunicados-top-row .form-input,
          .ad-comunicados-top-row select {
            width: 100% !important;
          }
          .ad-comunicados-btn-row {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .ad-comunicados-btn-row button {
            flex: 1 1 calc(50% - 8px) !important;
            justify-content: center !important;
            font-size: 12px !important;
            padding: 8px 10px !important;
          }
          .ad-comunicados-btn-primary {
            width: 100% !important;
            flex: 1 1 100% !important;
            padding: 10px !important;
          }
          .ad-comunicados-tabs {
            width: 100% !important;
            display: flex !important;
            margin-bottom: 16px !important;
          }
          .ad-comunicados-tabs .tab-trigger {
            flex: 1 !important;
            justify-content: center !important;
            font-size: 12px !important;
            padding: 8px 12px !important;
          }
          .ad-comunicado-card {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 14px 16px !important;
          }
          .ad-comunicado-stats {
            border-left: none !important;
            padding-left: 0 !important;
            min-width: 0 !important;
            width: 100% !important;
            border-top: 1px solid #f1f5f9 !important;
            padding-top: 10px !important;
          }
          .ad-comunicado-actions {
            width: 100% !important;
            padding-left: 0 !important;
            border-top: 1px solid #f1f5f9 !important;
            padding-top: 10px !important;
            justify-content: flex-end !important;
          }
          .ad-com-btn-refresh {
            width: 34px !important;
            height: 34px !important;
            min-width: 34px !important;
            min-height: 34px !important;
            padding: 0 !important;
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
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
          border-radius: 50% !important;
          padding: 0 !important;
          background: rgba(255, 255, 255, 0.75) !important;
          color: #64748b !important;
          border: 1px solid rgba(226, 232, 240, 0.9) !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
          cursor: pointer !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          flex-shrink: 0 !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
        }
        .ad-com-btn-refresh:hover:not(:disabled) {
          background: #ffffff !important;
          color: #4f46e5 !important;
          border-color: #cbd5e1 !important;
          transform: translateY(-1px) scale(1.05) !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06) !important;
        }
        .ad-com-btn-refresh:active:not(:disabled) {
          transform: scale(0.95) !important;
        }
        .ad-com-btn-refresh:disabled {
          opacity: 0.6 !important;
          cursor: not-allowed !important;
        }
        .ad-com-btn-refresh.is-loading {
          color: #4f46e5 !important;
          border-color: rgba(99, 102, 241, 0.3) !important;
        }
      `}} />

      <div className="ad-comunicados-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Caixa de Comunicados
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0, fontWeight: 500 }}>
              Gerencie comunicados, acompanhe relatórios de leitura e interaja com conversas escolares.
            </p>
          </div>

          {/* Action Buttons group: Relatório Mensal, Engajamento, Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.transform = 'translateY(0)';
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
                border: '1px solid rgba(99, 102, 241, 0.2)',
                boxShadow: '0 1px 2px rgba(79, 70, 229, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(79, 70, 229, 0.18))';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(79, 70, 229, 0.12))';
                e.currentTarget.style.transform = 'translateY(0)';
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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: 12,
                background: '#ffffff',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <RotateCw size={15} strokeWidth={2.2} className={isRefreshing ? 'ad-spin-icon' : ''} />
            </button>
          </div>
        </div>

        {/* Filter bar container */}
        <div 
          style={{ 
            marginTop: 16, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            flexWrap: 'wrap',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '10px 14px',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
          }}
        >
          {/* Mini Calendar Filter */}
          <MiniCalendarFilter
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            activeDatesWithComunicados={activeDatesWithComunicados}
          />

          <div style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 2px' }} />

          {/* Author filter */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
            <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <select 
              value={authorFilter}
              onChange={e => setAuthorFilter(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                paddingLeft: 34,
                paddingRight: 28,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#1e293b',
                fontSize: 13,
                fontWeight: 600,
                appearance: 'none',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 0.2s'
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

          {/* Search bar with clear button */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input 
              placeholder="Buscar título, texto ou autor..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                paddingLeft: 34,
                paddingRight: search ? 32 : 12,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#1e293b',
                fontSize: 13,
                fontWeight: 500,
                outline: 'none',
                transition: 'border-color 0.2s'
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

          <div style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 2px' }} />

          {/* Quick Filter: Tem Comentários */}
          <button
            type="button"
            onClick={() => setFilterComentarios(prev => !prev)}
            title="Filtrar apenas comunicados que possuem comentários/conversas particulares"
            style={{
              height: 38,
              padding: '0 13px',
              borderRadius: 12,
              border: filterComentarios ? '1px solid #4f46e5' : '1px solid #e2e8f0',
              background: filterComentarios ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#ffffff',
              color: filterComentarios ? '#ffffff' : '#475569',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              boxShadow: filterComentarios ? '0 4px 12px rgba(79, 70, 229, 0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <MessageSquare size={14} fill={filterComentarios ? '#ffffff' : 'none'} />
            <span>Comentários</span>
            {filterComentarios && (
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>
                ✓
              </span>
            )}
          </button>

          {/* Quick Filter: Tem Relatório */}
          <button
            type="button"
            onClick={() => setFilterRelatorio(prev => !prev)}
            title="Filtrar apenas comunicados que possuem relatório pedagógico anexado"
            style={{
              height: 38,
              padding: '0 13px',
              borderRadius: 12,
              border: filterRelatorio ? '1px solid #7c3aed' : '1px solid #e2e8f0',
              background: filterRelatorio ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : '#ffffff',
              color: filterRelatorio ? '#ffffff' : '#475569',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              boxShadow: filterRelatorio ? '0 4px 12px rgba(124, 58, 237, 0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <FileBarChart size={14} />
            <span>Relatórios</span>
            {filterRelatorio && (
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>
                ✓
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="tab-list ad-comunicados-tabs" style={{ marginBottom: 16, width: 'fit-content' }}>
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

      {/* Active Filters Indicator Banner */}
      {(selectedDate || filterComentarios || filterRelatorio) && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(99, 102, 241, 0.04))',
            border: '1px solid rgba(79, 70, 229, 0.18)',
            borderRadius: 14,
            marginBottom: 16,
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              Filtros ativos ({filtered.length} {filtered.length === 1 ? 'encontrado' : 'encontrados'}):
            </span>

            {selectedDate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid rgba(79, 70, 229, 0.25)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>
                <Calendar size={13} />
                <span>{selectedDateFormatted}</span>
                <span role="button" onClick={() => setSelectedDate(null)} style={{ cursor: 'pointer', opacity: 0.7, marginLeft: 2 }} title="Remover filtro de data">×</span>
              </span>
            )}

            {filterComentarios && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid rgba(79, 70, 229, 0.25)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>
                <MessageSquare size={13} />
                <span>Com Comentários</span>
                <span role="button" onClick={() => setFilterComentarios(false)} style={{ cursor: 'pointer', opacity: 0.7, marginLeft: 2 }} title="Remover filtro de comentários">×</span>
              </span>
            )}

            {filterRelatorio && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid rgba(124, 58, 237, 0.25)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>
                <FileBarChart size={13} />
                <span>Com Relatório</span>
                <span role="button" onClick={() => setFilterRelatorio(false)} style={{ cursor: 'pointer', opacity: 0.7, marginLeft: 2 }} title="Remover filtro de relatório">×</span>
              </span>
            )}
          </div>

          <button
            onClick={() => {
              setSelectedDate(null);
              setFilterComentarios(false);
              setFilterRelatorio(false);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: '#4f46e5',
              background: '#ffffff',
              border: '1px solid rgba(79, 70, 229, 0.25)',
              padding: '5px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <X size={13} /> Limpar todos os filtros
          </button>
        </motion.div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#4f46e5' }}
            title="Selecionar todos os comunicados carregados"
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
            {selectedComs.length > 0 ? `${selectedComs.length} selecionados` : 'Selecionar comunicados'}
          </span>
        </div>
        {selectedComs.length > 0 && (
          <button 
            className="btn" 
            onClick={handleBulkDelete} 
            style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Trash size={14} /> Excluir Selecionados
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 && isDataLoading && (
            <div style={{ textAlign: 'center', padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <Loader2 size={48} className="animate-spin" color="#00D2FF" style={{ filter: 'drop-shadow(0 0 10px rgba(0,210,255,0.5))' }} />
            </div>
          )}
          {filtered.length === 0 && !isDataLoading && (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: 'rgba(0,0,0,0.02)', borderRadius: 20, border: '2px dashed hsl(var(--border-subtle))' }}>
              <Bell size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
              {(selectedDate || filterComentarios || filterRelatorio) ? (
                <div>
                  <p style={{ color: 'hsl(var(--text-main))', fontSize: 16, fontWeight: 700, margin: '0 0 6px 0' }}>
                    Nenhum comunicado encontrado com os filtros selecionados.
                  </p>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, margin: '0 0 16px 0' }}>
                    Tente ajustar ou limpar os filtros para visualizar outros comunicados.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedDate(null);
                      setFilterComentarios(false);
                      setFilterRelatorio(false);
                    }}
                    style={{
                      background: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 16, fontWeight: 500 }}>Nenhum comunicado encontrado nesta aba.</p>
              )}
            </div>
          )}
          {filtered.map(c => {
             const isGlobal = c.destino === 'todos';
             let targetCount = 0;
             if (isGlobal) {
               targetCount = alunosAtivos.length + (colaboradores?.length || 0);
             } else {
               const targetTurmas = c.turmas || ((c as any).dados?.turmas) || [];
               const targetAlunosIds = c.alunosIds || ((c as any).dados?.alunosIds) || [];
               const targetGrupos = c.grupos || ((c as any).dados?.grupos) || [];
               const targetFuncsIds = c.funcionariosIds || ((c as any).dados?.funcionariosIds) || [];

               const targetTurmasIds = turmas.filter(t => targetTurmas.includes(t.nome) || targetTurmas.includes((t as any).name) || targetTurmas.includes(String(t.id))).map(t => String(t.id));

               const alTargets = alunosAtivos.filter(a => targetTurmasIds.includes(String(a.turma)) || targetTurmas.includes(a.turma) || targetAlunosIds.some((idRaw: any) => String(idRaw).replace(/^_*(ALU)?/, '') === String(a.id).replace(/^_*(ALU)?/, '')));
               
               let grupoAlunosIds = new Set<string>();
               let grupoFuncsIds = new Set<string>();
               if (targetGrupos.length > 0 && chatGroups) {
                 const matchedGroups = chatGroups.filter((g: any) => targetGrupos.some((gName: string) => String(gName).toLowerCase().trim() === String(g.nome).toLowerCase().trim()));
                 matchedGroups.forEach((g: any) => {
                   let aIds = g.alunosIds || [];
                   if (typeof aIds === 'string') { try { aIds = JSON.parse(aIds); } catch(e) { aIds = []; } }
                   if (Array.isArray(aIds)) aIds.forEach((id: any) => grupoAlunosIds.add(String(id)));
                   
                   let cIds = g.colaboradoresIds || [];
                   if (typeof cIds === 'string') { try { cIds = JSON.parse(cIds); } catch(e) { cIds = []; } }
                   if (Array.isArray(cIds)) cIds.forEach((id: any) => grupoFuncsIds.add(String(id).replace(/^f_?/, '')));
                 });
               }
               
               const additionalAlunosFromGrupos = alunosAtivos.filter(a => !alTargets.includes(a) && grupoAlunosIds.has(String(a.id)));
               const totalAlunosCount = alTargets.length + additionalAlunosFromGrupos.length;
               
               const allFuncsIds = new Set([
                 ...targetFuncsIds.map((id: any) => String(id).replace(/^f_?/, '')),
                 ...Array.from(grupoFuncsIds)
               ]);
               const totalFuncsCount = allFuncsIds.size;
               
               targetCount = totalAlunosCount + totalFuncsCount;
             }
             
             const lidas = Object.keys(c.leituras || {}).length
             const progresso = targetCount > 0 ? Math.min(100, (lidas / targetCount) * 100) : 0
             const dateObj = (c.dataEnvio || (c as any).data) ? new Date(c.dataEnvio || (c as any).data) : null

             const hasConversas = Boolean(
               idsWithReplies.has(String(c.id)) ||
               c.conversas_info?.tem_conversas || 
               (c.conversas_info?.total && c.conversas_info.total > 0) ||
               (Array.isArray(c.respostas) && c.respostas.length > 0) ||
               (getGlobalCachedMessages(c.id)?.length)
             );
             const conversasCount = c.conversas_info?.total || (Array.isArray(c.respostas) ? c.respostas.length : 0) || (getGlobalCachedMessages(c.id)?.length || 0) || (idsWithReplies.has(String(c.id)) ? 1 : 0);
             const hasUnreadConversation = Boolean(
               c.conversas_info?.has_unread || 
               (c.conversas_info?.nao_lidas && c.conversas_info.nao_lidas > 0) ||
               c._has_unread_reply
             );

              return (
               <motion.div 
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setViewingCom(c)}
                onPointerDown={() => prefetchComunicadoMessages(c, true)}
                className="ad-comunicado-card"
                style={{ 
                  background: '#ffffff',
                  borderRadius: 20,
                  border: '1px solid #e2e8f0',
                  padding: '20px 24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#818cf8'
                  e.currentTarget.style.boxShadow = '0 12px 24px -10px rgba(99, 102, 241, 0.15)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', paddingRight: 8 }}>
                  <input 
                    type="checkbox" 
                    checked={selectedComs.includes(c.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        setSelectedComs(prev => [...prev, c.id]);
                      } else {
                        setSelectedComs(prev => prev.filter(id => id !== c.id));
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#4f46e5' }}
                  />
                </div>
                {/* Content Column */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                      {c.titulo}
                    </h3>
                    {c.fixado && <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}><Pin size={12} fill="#f59e0b" /></span>}
                    {hasConversas && (
                      <span 
                        title={`${conversasCount} comentários/conversas registradas`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: hasUnreadConversation ? 'rgba(239, 68, 68, 0.12)' : 'rgba(79, 70, 229, 0.1)',
                          color: hasUnreadConversation ? '#dc2626' : '#4f46e5',
                          border: `1px solid ${hasUnreadConversation ? 'rgba(239, 68, 68, 0.25)' : 'rgba(79, 70, 229, 0.2)'}`,
                          padding: '2px 8px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                      >
                        <MessageSquare size={12} fill={hasUnreadConversation ? '#dc2626' : '#4f46e5'} fillOpacity={0.25} />
                        <span>{conversasCount}</span>
                        {hasUnreadConversation && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                        )}
                      </span>
                    )}
                  </div>
                  
                  <p style={{ margin: 0, fontSize: 14, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                    {(c.conteudo || (c as any).texto || '').replace(/<[^>]*>/g, '').replace(/[\*\#\_]/g, '')}
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: 12 }}>
                      <User size={13} color="#64748b" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                        {c.autor || 'Sistema'}
                        {(c.autorCargo || (c as any).dados?.autorCargo) && <span style={{ fontWeight: 500, color: '#94a3b8' }}> • {c.autorCargo || (c as any).dados?.autorCargo}</span>}
                      </span>
                    </div>
                    {isGlobal ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#059669' }}>
                        <Users size={13} /> Toda a Escola
                      </div>
                    ) : (
                      ((c.turmas && c.turmas.length > 0) || (c.alunosIds && c.alunosIds.length > 0) || (c.funcionariosIds && c.funcionariosIds.length > 0) || (c.grupos && c.grupos.length > 0)) && (
                        <button 
                          onClick={e => { e.stopPropagation(); setViewingDestCom(c); }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'rgba(79, 70, 229, 0.05)',
                            border: '1px solid rgba(79, 70, 229, 0.15)',
                            padding: '4px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#4f46e5',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79, 70, 229, 0.1)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(79, 70, 229, 0.05)' }}
                        >
                          <Menu size={13} />
                          Ver Destinatários ({(c.turmas?.length || 0) + (c.grupos?.length || 0) + (c.funcionariosIds?.length || 0) + (c.alunosIds?.length || 0)})
                        </button>
                      )
                    )}
                    {hasConversas && (
                      <div 
                        title={`${conversasCount} comentário(s) em conversas particulares. Clique para abrir.`}
                        onClick={e => {
                          e.stopPropagation();
                          setViewingCom(c);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: hasUnreadConversation ? 'rgba(239, 68, 68, 0.08)' : 'rgba(79, 70, 229, 0.06)',
                          color: hasUnreadConversation ? '#dc2626' : '#4f46e5',
                          border: `1px solid ${hasUnreadConversation ? 'rgba(239, 68, 68, 0.25)' : 'rgba(79, 70, 229, 0.2)'}`,
                          padding: '4px 10px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>{conversasCount} {conversasCount === 1 ? 'comentário' : 'comentários'}</span>
                        {hasUnreadConversation && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} />
                      {dateObj ? `${dateObj.toLocaleDateString('pt-BR')} às ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '--'}
                    </div>
                  </div>
                </div>

                {/* Column: Stats */}
                <div className="ad-comunicado-stats" style={{ minWidth: 160, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '1px solid #e2e8f0', paddingLeft: 24 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leitura</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: progresso >= 100 ? '#059669' : '#4f46e5' }}>{Math.round(progresso)}%</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progresso}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{ height: '100%', background: progresso >= 100 ? '#10b981' : 'linear-gradient(90deg, #6366f1, #4f46e5)', borderRadius: 10 }} 
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', background: '#f8fafc', padding: '6px 12px', borderRadius: 10, minWidth: 54, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    {lidas}/{targetCount}
                  </div>
                </div>

                {/* Column: Actions */}
                <div className="ad-comunicado-actions" style={{ display: 'flex', gap: 8, paddingLeft: 12 }}>
                   <button className="btn btn-ghost btn-sm" style={{ width: 36, height: 36, padding: 0, borderRadius: 12, color: '#64748b' }} onClick={e => { e.stopPropagation(); handleReenviar(c) }} title="Reenviar"><SendIcon size={16} /></button>
                   <button className="btn btn-primary btn-sm" style={{ padding: '0 16px', height: 36, borderRadius: 12, fontSize: 12, fontWeight: 800, background: '#0f172a', borderColor: '#0f172a' }} onClick={e => { e.stopPropagation(); setSelectedCom(c) }}>
                      Detalhes
                   </button>
                </div>
              </motion.div>
             )
          })}

          {hasNextPageComunicados && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 32 }}>
              <button 
                onClick={handleLoadMore}
                disabled={isFetchingMore || isFetchingNextPageComunicados}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  padding: '10px 24px',
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: (isFetchingMore || isFetchingNextPageComunicados) ? 'not-allowed' : 'pointer',
                  opacity: (isFetchingMore || isFetchingNextPageComunicados) ? 0.7 : 1,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={e => {
                  if (!(isFetchingMore || isFetchingNextPageComunicados)) e.currentTarget.style.background = '#e2e8f0'
                }}
                onMouseLeave={e => {
                  if (!(isFetchingMore || isFetchingNextPageComunicados)) e.currentTarget.style.background = '#f1f5f9'
                }}
              >
                {(isFetchingMore || isFetchingNextPageComunicados) ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Carregando...
                  </>
                ) : (
                  'Carregar mais'
                )}
              </button>
            </div>
          )}
          {!hasNextPageComunicados && filtered.length > 0 && !isDataLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 16,
              marginBottom: 32,
              color: '#94a3b8',
              fontSize: 13,
              fontWeight: 600,
            }}>
              <CheckCircle2 size={15} style={{ opacity: 0.7, color: '#10b981' }} />
              <span>Todos os comunicados foram carregados</span>
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
        onAdd={(text, payload) => alert('Adicione o relatório anexando o PDF gerado ou insira o link.')} 
        onFillDirectly={(payload) => {
          alert('Ação disponível apenas no painel do colaborador.');
          setShowRelsModal(false);
        }}
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
          alunos={alunos}
          colaboradores={colaboradores}
          turmas={turmas}
          currentUserSlug={currentUser?.id ? String(currentUser.id) : 'admin'}
          currentUserName={currentUser?.nome || 'Administrador'}
          currentUserAvatar={currentUser?.foto || undefined}
          onCiencia={() => {}}
          onClose={() => setViewingCom(null)}
          onEdit={(c) => {
            setViewingCom(null);
            openEdit(c);
          }}
          onDelete={(id) => {
            setViewingCom(null);
            handleDeleteSingleComunicado(id);
          }}
          onForward={(c) => {
            setViewingCom(null);
            handleReenviar(c);
          }}
          setOpenedReportPayload={(str) => setViewingReportPayload(str)}
        />
      )}

      <ReportPayloadView
        isOpen={!!viewingReportPayload}
        onClose={() => setViewingReportPayload(null)}
        attachmentString={typeof viewingReportPayload === 'string' ? viewingReportPayload : (viewingReportPayload?.string || '')}
        targetStudentId={viewingReportPayload?.studentId}
        targetStudentName={viewingReportPayload?.studentName}
        targetStudentAvatar={viewingReportPayload?.studentAvatar}
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
                {viewingDestCom.alunosIds && viewingDestCom.alunosIds.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Alunos Específicos ({viewingDestCom.alunosIds.length})</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {viewingDestCom.alunosIds.map((aId, idx) => {
                        const alunoObj = (alunos || []).find(al => String(al.id) === String(aId) || String(al.id).replace(/^_+/, '') === String(aId).replace(/^_+/, ''));
                        return (
                          <span key={idx} className="badge" style={{ background: 'rgba(16,185,129,0.06)', color: '#10b981', border: '1px solid rgba(16,185,129,0.12)', fontSize: 11, padding: '4px 10px', fontWeight: 600 }}>
                            {alunoObj ? alunoObj.nome : `ID: ${aId}`}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
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

      {/* Drawer do Relatório Mensal */}
      <AnimatePresence>
        {showMonthlyReport && (
          <ClientPortal>
          <div 
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'none',
              zIndex: 10005, display: 'flex', justifyContent: 'center', alignItems: 'center'
            }} 
            onClick={() => setShowMonthlyReport(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ 
                width: 700, 
                maxWidth: '90%', 
                background: '#fff', 
                borderRadius: 24,
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff' }}>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={20} /> Relatório de Frequência Mensal
                  </h3>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>Visão geral de envios no mês atual.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ position: 'relative' }}>
                    <User size={14} style={{ position: 'absolute', left: 10, top: 8, color: 'hsl(var(--primary))', pointerEvents: 'none' }} />
                    <select 
                      className="form-input" 
                      value={reportAuthorFilter}
                      onChange={e => setReportAuthorFilter(e.target.value)}
                      style={{ paddingLeft: 30, width: 150, appearance: 'none', cursor: 'pointer', fontWeight: 600, color: 'hsl(var(--primary))', background: '#fff', border: 'none', fontSize: 12, height: 32, borderRadius: 16 }}
                    >
                      <option value="todos">Todos os Usuários</option>
                      {colaboradores.map(c => (
                        <option key={c.nome} value={c.nome}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Paperclip size={14} style={{ position: 'absolute', left: 10, top: 8, color: 'hsl(var(--primary))', pointerEvents: 'none' }} />
                    <select 
                      className="form-input" 
                      value={attachmentFilter}
                      onChange={e => setAttachmentFilter(e.target.value)}
                      style={{ paddingLeft: 30, width: 150, appearance: 'none', cursor: 'pointer', fontWeight: 600, color: 'hsl(var(--primary))', background: '#fff', border: 'none', fontSize: 12, height: 32, borderRadius: 16 }}
                    >
                      <option value="todos">Todos Anexos</option>
                      <option value="qualquer">Com Anexo</option>
                      <option value="nenhum">Sem Anexo</option>
                      <option value="imagem">Imagens</option>
                      <option value="video">Vídeos</option>
                      <option value="formulario">Formulários</option>
                      <option value="relatorio">Relatórios</option>
                      <option value="enquete">Enquetes</option>
                      <option value="autorizacao">Autorizações</option>
                      <option value="cobranca">Cobranças</option>
                    </select>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowMonthlyReport(false)} style={{ color: '#fff', padding: 0 }}><X size={20} /></button>
                </div>
              </div>
              
              <div style={{ padding: 32 }}>
                {(() => {
                  const today = new Date();
                  const year = today.getFullYear();
                  const month = today.getMonth();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const startDayOfWeek = new Date(year, month, 1).getDay();
                  
                  const enviosPorDia: Record<number, number> = {};
                  comunicados.forEach(c => {
                    if (c.id?.startsWith('AD-COM-REL-STU-')) return;
                    let valid = true;
                    if (reportAuthorFilter !== 'todos') {
                      const cAutor = c.autor || (c as any).dados?.autor;
                      if (cAutor !== reportAuthorFilter) valid = false;
                    }
                    if (attachmentFilter !== 'todos') {
                      const anexosList = c.anexos || [];
                      const hasAny = anexosList.length > 0;
                      if (attachmentFilter === 'nenhum' && hasAny) valid = false;
                      if (attachmentFilter === 'qualquer' && !hasAny) valid = false;
                      if (['relatorio', 'formulario', 'imagem', 'video', 'enquete', 'autorizacao', 'cobranca'].includes(attachmentFilter)) {
                        const matchesType = anexosList.some((anexo: any) => {
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
                          } else if (anexo && typeof anexo === 'object') {
                            name = anexo.nome || anexo.name || 'Anexo';
                            url = anexo.url || '';
                            mimeType = anexo.type || anexo.mimeType || (name.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? 'image/' : '');
                          } else {
                            name = String(anexo);
                          }
                          if (attachmentFilter === 'relatorio' && name.startsWith('Relatório:')) return true;
                          if (attachmentFilter === 'formulario' && name.startsWith('Formulário:')) return true;
                          if (attachmentFilter === 'enquete' && (name.startsWith('Enquete:') || mimeType === 'enquete' || c.enquete || (c as any).dados?.enquete)) return true;
                          if (attachmentFilter === 'autorizacao' && (name.startsWith('Autorização:') || mimeType === 'autorizacao' || c.autorizacao || (c as any).dados?.autorizacao)) return true;
                          if (attachmentFilter === 'cobranca' && (name.startsWith('Cobrança:') || name.startsWith('Cobranca:') || mimeType === 'cobranca' || c.cobranca || (c as any).dados?.cobranca || (c.cobrancas && c.cobrancas.length > 0) || ((c as any).dados?.cobrancas && (c as any).dados?.cobrancas.length > 0) || c.tipo === 'cobrança' || (c.tipo as any) === 'cobranca')) return true;
                          const isImg = mimeType.startsWith('image/') || (url && url.startsWith('data:image')) || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
                          if (attachmentFilter === 'imagem' && isImg) return true;
                          const isVid = mimeType.startsWith('video/') || (url && url.startsWith('data:video')) || /\.(mp4|webm|ogg|mov)$/i.test(name);
                          if (attachmentFilter === 'video' && isVid) return true;
                          return false;
                        });
                        if (!matchesType && !(attachmentFilter === 'enquete' && (c.enquete || (c as any).dados?.enquete)) && !(attachmentFilter === 'autorizacao' && (c.autorizacao || (c as any).dados?.autorizacao)) && !(attachmentFilter === 'cobranca' && (c.cobranca || (c as any).dados?.cobranca || (c.cobrancas && c.cobrancas.length > 0) || ((c as any).dados?.cobrancas && (c as any).dados?.cobrancas.length > 0) || c.tipo === 'cobrança' || (c.tipo as any) === 'cobranca'))) valid = false;
                      }
                    }

                    if (valid) {
                      const dateObj = (c.dataEnvio || (c as any).data || (c as any).created_at) ? new Date(c.dataEnvio || (c as any).data || (c as any).created_at) : null;
                      if (dateObj && dateObj.getMonth() === month && dateObj.getFullYear() === year) {
                        const day = dateObj.getDate();
                        enviosPorDia[day] = (enviosPorDia[day] || 0) + 1;
                      }
                    }
                  });

                  let totalEnviados = 0;
                  Object.values(enviosPorDia).forEach(v => totalEnviados += v);

                  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

                  return (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Mês Vigente</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{monthNames[month]} {year}</div>
                        </div>
                        <div style={{ background: 'rgba(79, 70, 229, 0.05)', padding: 16, borderRadius: 16, border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Total de Comunicados</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: '#4f46e5' }}>{totalEnviados}</div>
                        </div>
                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: 16, borderRadius: 16, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Dias com Envios</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{Object.keys(enviosPorDia).length} <span style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>/ {daysInMonth}</span></div>
                        </div>
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#334155' }}>Calendário de Envios</div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', paddingBottom: 8 }}>{d}</div>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                        {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const qtd = enviosPorDia[day] || 0;
                          const isToday = day === today.getDate();
                          
                          let bg = '#f1f5f9';
                          let color = '#94a3b8';
                          let border = '1px solid #e2e8f0';
                          
                          if (qtd > 0) {
                            bg = 'rgba(16, 185, 129, 0.1)';
                            color = '#10b981';
                            border = '1px solid rgba(16, 185, 129, 0.3)';
                            if (qtd > 2) {
                              bg = 'rgba(16, 185, 129, 0.2)';
                              border = '1px solid rgba(16, 185, 129, 0.5)';
                            }
                            if (qtd > 5) {
                              bg = 'rgba(16, 185, 129, 0.4)';
                              color = '#047857';
                            }
                          }

                          return (
                            <div 
                              key={day} 
                              style={{ 
                                background: bg, 
                                border: border,
                                borderRadius: 12, 
                                padding: '12px 8px', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center',
                                gap: 4,
                                position: 'relative'
                              }}
                            >
                              {isToday && <div style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: '#3b82f6', borderRadius: '50%', border: '2px solid #fff' }} />}
                              <span style={{ fontSize: 14, fontWeight: 800, color: qtd > 0 ? color : '#cbd5e1' }}>{day}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: color }}>{qtd > 0 ? `${qtd} envios` : '-'}</span>
                            </div>
                          )
                        })}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 24, fontSize: 12, fontWeight: 500, color: 'hsl(var(--text-muted))' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 4, background: '#f1f5f9', border: '1px solid #e2e8f0' }}/> 0 envios</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}/> 1-2 envios</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.5)' }}/> 3-5 envios</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(16, 185, 129, 0.4)', border: '1px solid rgba(16, 185, 129, 0.5)' }}/> +6 envios</div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </motion.div>
          </div>
          </ClientPortal>
        )}
      </AnimatePresence>
    </div>
  )
}

