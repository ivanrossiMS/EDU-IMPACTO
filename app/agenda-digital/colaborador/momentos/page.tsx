'use client'
import { useSearchParams } from 'next/navigation'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useAgendaDigital, ADMomento, ADMedia } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PrivacyScreen } from '@capacitor-community/privacy-screen';

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
import { X, Expand, Play, Heart, MessageCircle, Share2, Filter, Upload, Trash2, Camera, Download, PlayCircle, MoreVertical, Image as ImageIcon, Sparkles, Smile, Star, Send, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Maximize2, Plus, Check, Loader2, Video, Users, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TurmaDropdown } from '../components/TurmaDropdown'
import { useApp } from '@/lib/context'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { getInitials, formatDateTime } from '@/lib/utils'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { DestinatariosModal } from '@/components/agenda/DestinatariosModal'

import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { MomentoSkeleton } from '../../components/MomentoSkeleton'
import { MomentoLightbox } from '@/components/agenda/MomentoLightbox'

export default function ADMomentosPage() {
  const queryClient = useQueryClient()
  const { momentosFeed, isDataLoading, hasNextPageMomentos, fetchNextPageMomentos } = useAgendaDigital()
  
  
  useEffect(() => {
    let enabled = false;
    const enablePrivacy = async () => {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        try {
          await PrivacyScreen.enable();
          enabled = true;
        } catch (e) {
          console.error("PrivacyScreen enable error", e);
        }
      }
    };
    enablePrivacy();
    return () => {
      if (enabled) {
        PrivacyScreen.disable().catch(console.error);
      }
    };
  }, []);
  const { currentUser } = useApp()

  const searchParams = useSearchParams()
  const espelharColabId = searchParams?.get('espelhar_colaborador')
  const espelharPerfil = searchParams?.get('espelhar_perfil')
  const isMirroring = !!espelharColabId
  const effectiveUser = useMemo(() => {
    if (espelharColabId) {
      return {
        ...currentUser,
        id: espelharColabId,
        nome: searchParams?.get('espelhar_nome') || 'Colaborador',
        cargo: searchParams?.get('espelhar_cargo') || 'Colaborador',
        perfil: espelharPerfil || 'colaborador'
      }
    }
    return currentUser
  }, [currentUser, espelharColabId, searchParams])

  
  const { turmas = [], cfgCalendarioLetivo = [] } = useData()
  const [alunos] = useSupabaseArray<any>('alunos/lightweight?limit=2000')
  const [colaboradores = []] = useSupabaseArray<any>('configuracoes/usuarios')
  
  
  
  
  const { setMomentosFeed, setMomentosFeedLocally, adAlert } = useAgendaDigital()
  
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

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [currentMediaIndex, setCurrentMediaIndex] = useState<Record<string, number>>({})
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  // Estado para o Lightbox/Galeria
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string, type: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const queryId = searchParams?.get('id')
  const hasAutoOpenedMomento = useRef(false)

  useEffect(() => {
    if (!queryId || hasAutoOpenedMomento.current) return

    const openMomento = (target: any) => {
      hasAutoOpenedMomento.current = true
      setHighlightedId(String(target.id))
      setVisibleCount(prev => Math.max(prev, 15))
      const targetMedia = target.media || target.midias || []
      if (targetMedia && targetMedia.length > 0) {
        setLightboxMedia(targetMedia.map((item: any) => ({
          url: item.url,
          type: item.type === 'video' || (item.url && item.url.match(/\.(mp4|webm)$/i)) ? 'video' : 'image'
        })))
        setLightboxIndex(0)
        setLightboxOpen(true)
      }
      setTimeout(() => {
        const el = document.getElementById(`momento-${target.id}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 400)
    }

    const target = (momentosFeed || []).find((m: any) => String(m.id) === String(queryId))
    if (target) {
      openMomento(target)
    } else {
      fetch(`/api/agenda/momentos?id=${encodeURIComponent(queryId)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && Array.isArray(data) && data.length > 0) {
            openMomento(data[0])
          }
        })
        .catch(err => console.error('Erro ao buscar momento alvo:', err))
    }
  }, [queryId, momentosFeed])

  useEffect(() => { setIsMounted(true) }, [])

  // Prevenir scroll do body quando modal está aberto
  useEffect(() => {
    if (lightboxOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; }
  }, [lightboxOpen]);

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
        setMomentosFeedLocally((prev: any[]) => {
          if (prev.some((p: any) => String(p.id) === String(merged.id))) return prev;
          const newFeed = [merged, ...prev].sort((a: any, b: any) => {
            const dateA = new Date(a.date || a.created_at || 0).getTime();
            const dateB = new Date(b.date || b.created_at || 0).getTime();
            return dateB - dateA;
          });
          return newFeed;
        });
      }
    },
    onUpdate: ({ new: updatedMomento }) => {
      const merged = { ...updatedMomento, ...(updatedMomento?.dados || {}) };
      if (setMomentosFeedLocally) {
        setMomentosFeedLocally((prev: any[]) => prev.map((p: any) => String(p.id) === String(merged.id) ? { ...p, ...merged } : p));
      }
    },
    onDelete: ({ old }) => {
      if (setMomentosFeedLocally && old?.id) {
        setMomentosFeedLocally((prev: any[]) => prev.filter((p: any) => String(p.id) !== String(old.id)));
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

  const { chatGroups } = useAgendaDigital()
  const [equipesList = []] = useSupabaseArray<any>('agenda/equipes')
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [visibleCount, setVisibleCount] = useState(5)

  // 1. Identificação precisa se o usuário atual é Administrador Master
  const isMasterAdmin = useMemo(() => {
    if (!effectiveUser) return false;
    const perfil = String(effectiveUser.perfil || '').toLowerCase().trim();
    const cargo = String(effectiveUser.cargo || '').toLowerCase().trim();
    const masterRoles = ['administrador master', 'administrador', 'admin', 'diretor geral', 'diretora geral', 'master'];
    return masterRoles.includes(cargo) || masterRoles.includes(perfil);
  }, [effectiveUser]);

  // Identificadores possíveis do colaborador logado (Auth UUID, ID numérico do system_users, etc.)
  const candidateColabIds = useMemo(() => {
    const ids = new Set<string>();
    const effId = String(effectiveUser?.id || '').replace(/^f_?/, '').trim().toLowerCase();
    const curId = String(currentUser?.id || '').replace(/^f_?/, '').trim().toLowerCase();
    if (effId) ids.add(effId);
    if (curId) ids.add(curId);
    if ((effectiveUser as any)?.colaborador_id) ids.add(String((effectiveUser as any).colaborador_id).replace(/^f_?/, '').trim().toLowerCase());
    if ((effectiveUser as any)?.system_user_id) ids.add(String((effectiveUser as any).system_user_id).replace(/^f_?/, '').trim().toLowerCase());
    if ((currentUser as any)?.colaborador_id) ids.add(String((currentUser as any).colaborador_id).replace(/^f_?/, '').trim().toLowerCase());
    if ((currentUser as any)?.system_user_id) ids.add(String((currentUser as any).system_user_id).replace(/^f_?/, '').trim().toLowerCase());

    const effEmail = (effectiveUser?.email || currentUser?.email || '').trim().toLowerCase();
    const effNome = (effectiveUser?.nome || currentUser?.nome || '').trim().toLowerCase();

    (colaboradores || []).forEach((c: any) => {
      const cEmail = (c.email || c.dados?.email || '').trim().toLowerCase();
      const cNome = (c.nome || c.dados?.nome || '').trim().toLowerCase();
      const cId = String(c.id || c.usuarioId || '').replace(/^f_?/, '').trim().toLowerCase();
      const cAuthId = String(c.auth_id || c.dados?.auth_id || '').replace(/^f_?/, '').trim().toLowerCase();

      const match = (
        (effEmail && cEmail && cEmail === effEmail) ||
        (effNome && cNome && cNome === effNome) ||
        (effId && (cId === effId || cAuthId === effId)) ||
        (curId && (cId === curId || cAuthId === curId))
      );

      if (match) {
        if (c.id) ids.add(String(c.id).replace(/^f_?/, '').trim().toLowerCase());
        if (c.usuarioId) ids.add(String(c.usuarioId).replace(/^f_?/, '').trim().toLowerCase());
        if (c.uid_legacy) ids.add(String(c.uid_legacy).replace(/^f_?/, '').trim().toLowerCase());
        if (c.auth_id) ids.add(String(c.auth_id).replace(/^f_?/, '').trim().toLowerCase());
        if (c.dados?.auth_id) ids.add(String(c.dados.auth_id).replace(/^f_?/, '').trim().toLowerCase());
      }
    });

    return Array.from(ids);
  }, [colaboradores, effectiveUser, currentUser]);

  // Helper para verificar se o colaborador atual é membro de um grupo de agenda_grupos
  const isColabInGroup = React.useCallback((g: any) => {
    if (!g) return false;
    let colabs = g.colaboradoresIds || g.dados?.colaboradoresIds || [];
    if (typeof colabs === 'string') {
      try { colabs = JSON.parse(colabs); } catch (e) { colabs = []; }
    }
    if (!Array.isArray(colabs)) colabs = [];

    // Se o grupo tem acesso global explícito para todos
    if (g.isGlobalAccess === true || g.dados?.isGlobalAccess === true) return true;

    const myName = String(effectiveUser?.nome || currentUser?.nome || '').trim().toLowerCase();
    const hasMatch = colabs.some((cid: any) => {
      const clean = String(typeof cid === 'object' ? (cid.id || cid.usuarioId || '') : cid).replace(/^f_?/, '').trim().toLowerCase();
      const cNome = typeof cid === 'object' ? String(cid.nome || '').trim().toLowerCase() : '';
      return candidateColabIds.includes(clean) || (myName && cNome && cNome === myName);
    });

    return hasMatch;
  }, [candidateColabIds, effectiveUser, currentUser]);

  // Helper para verificar se o colaborador atual é membro de uma equipe em agenda_equipes
  const isColabInEquipe = React.useCallback((e: any) => {
    if (!e) return false;
    let colabs = e.membrosIds || e.colaboradoresIds || e.dados?.membrosIds || e.dados?.colaboradoresIds || [];
    if (typeof colabs === 'string') {
      try { colabs = JSON.parse(colabs); } catch (e) { colabs = []; }
    }
    if (!Array.isArray(colabs)) colabs = [];

    const myName = String(effectiveUser?.nome || currentUser?.nome || '').trim().toLowerCase();
    return colabs.some((cid: any) => {
      const clean = String(typeof cid === 'object' ? (cid.id || cid.usuarioId || '') : cid).replace(/^f_?/, '').trim().toLowerCase();
      const cNome = typeof cid === 'object' ? String(cid.nome || '').trim().toLowerCase() : '';
      return candidateColabIds.includes(clean) || (myName && cNome && cNome === myName);
    });
  }, [candidateColabIds, effectiveUser, currentUser]);

  // Grupos e turmas aos quais o colaborador atual pertence ou tem vínculo
  const myStaffGroups = useMemo(() => {
    const list: { id: string; nome: string; raw?: any; tipo: 'equipe' | 'grupo' | 'turma' }[] = [];
    const seen = new Set<string>();

    const addGroup = (id: string, nome: string, tipo: 'equipe' | 'grupo' | 'turma', raw?: any) => {
      const nomeClean = String(nome || '').trim();
      if (!nomeClean) return;
      const key = nomeClean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ id: String(id || nomeClean), nome: nomeClean, tipo, raw });
      }
    };

    // 1. Grupos de agenda_grupos onde o colaborador é membro
    (chatGroups || []).forEach((g: any) => {
      if (isColabInGroup(g)) {
        const isEq = g.isEquipeEscolar || g.dados?.isEquipeEscolar || g.ano === 'Equipe Escolar' || g.dados?.ano === 'Equipe Escolar';
        addGroup(g.id, g.nome || g.dados?.nome, isEq ? 'equipe' : 'grupo', g);
      }
    });

    // 2. Equipes de agenda_equipes onde o colaborador é membro
    (equipesList || []).forEach((e: any) => {
      if (isColabInEquipe(e)) {
        addGroup(e.id, e.nome || e.dados?.nome, 'equipe', e);
      }
    });

    // 3. Turmas vinculadas aos grupos onde o colaborador atua
    (turmas || []).forEach((t: any) => {
      const isLinked = (chatGroups || []).some((g: any) => {
        const matches = (
          String(g.syncId || g.id) === `sync-${t.id}` ||
          String(g.syncId || g.id) === String(t.id) ||
          String(g.nome || '').trim().toLowerCase() === String(t.nome || '').trim().toLowerCase()
        );
        return matches && isColabInGroup(g);
      });
      if (isLinked) {
        addGroup(t.id, t.nome, 'turma', t);
      }
    });

    return list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [chatGroups, equipesList, turmas, isColabInGroup, isColabInEquipe]);

  // Turmas acadêmicas às quais o colaborador atual está efetivamente vinculado
  const myLinkedTurmaIds = useMemo(() => {
    const linkedIds = new Set<string>();
    const myName = String(effectiveUser?.nome || currentUser?.nome || '').trim().toLowerCase();

    // 1. Turmas já identificadas como vinculadas em myStaffGroups
    (myStaffGroups || []).forEach(item => {
      if (item.tipo === 'turma' && item.id) {
        linkedIds.add(String(item.id));
      }
    });

    (turmas || []).forEach((t: any) => {
      const tId = String(t.id);
      const tNome = String(t.nome || '').trim().toLowerCase();
      const tProf = String(t.professor || t.dados?.professor || '').trim().toLowerCase();
      const tProfId = String(t.professorId || t.professor_id || t.dados?.professorId || t.dados?.professor_id || '').replace(/^f_?/, '').trim().toLowerCase();

      // 2. Professor titular da turma
      if (tProf && (tProf === myName || candidateColabIds.includes(tProf))) {
        linkedIds.add(tId);
        return;
      }
      if (tProfId && candidateColabIds.includes(tProfId)) {
        linkedIds.add(tId);
        return;
      }

      // 3. Professor de disciplina da turma
      const disciplinas = t.disciplinas || t.dados?.disciplinas || [];
      if (Array.isArray(disciplinas)) {
        const isDiscProf = disciplinas.some((d: any) => {
          const dProfId = String(d.professorId || d.professor_id || d.funcionarioId || '').replace(/^f_?/, '').trim().toLowerCase();
          const dProfNome = String(d.professorNome || d.professor_nome || d.professor || '').trim().toLowerCase();
          return (dProfId && candidateColabIds.includes(dProfId)) || (myName && dProfNome && dProfNome === myName);
        });
        if (isDiscProf) {
          linkedIds.add(tId);
          return;
        }
      }

      // 4. Grupos sincronizados com a turma onde o colaborador atua
      const matchedGroup = (chatGroups || []).find((g: any) => {
        return (
          String(g.syncId || g.id) === `sync-${tId}` ||
          String(g.syncId || g.id) === tId ||
          String(g.nome || '').trim().toLowerCase() === tNome
        );
      });

      if (matchedGroup) {
        if (isColabInGroup(matchedGroup)) {
          linkedIds.add(tId);
          return;
        }

        // Vínculo via equipe pedagógica vinculada ao grupo da turma
        let eqIds = (matchedGroup as any).equipesIds || (matchedGroup as any).dados?.equipesIds || [];
        if (typeof eqIds === 'string') {
          try { eqIds = JSON.parse(eqIds); } catch (e) { eqIds = []; }
        }
        if (Array.isArray(eqIds) && eqIds.length > 0) {
          const isMemberOfLinkedEquipe = (equipesList || []).some((e: any) => {
            const eqId = String(e.id);
            if (!eqIds.map(String).includes(eqId)) return false;
            return isColabInEquipe(e);
          });
          if (isMemberOfLinkedEquipe) {
            linkedIds.add(tId);
            return;
          }
        }
      }
    });

    // 5. Grupos de turmas digitais onde o colaborador atua diretamente
    (chatGroups || []).forEach((g: any) => {
      if (isColabInGroup(g)) {
        if (g.id) linkedIds.add(String(g.id));
        if (g.syncId) linkedIds.add(String(g.syncId).replace(/^sync-/, ''));
        if (g.nome) linkedIds.add(String(g.nome).trim());
      }
    });

    return Array.from(linkedIds);
  }, [myStaffGroups, turmas, chatGroups, equipesList, candidateColabIds, effectiveUser, currentUser, isColabInGroup, isColabInEquipe]);

  // Todos os grupos da Equipe Escolar cadastrados (para o Admin Master e fallback)
  const equipeEscolarGrupos = useMemo(() => {
    const list: { id: string; nome: string; raw: any; colabs: any[] }[] = [];
    const seen = new Set<string>();

    const addGroup = (id: string, nome: string, raw: any, colabs: any[] = []) => {
      const nomeClean = String(nome || '').trim();
      if (!nomeClean) return;
      const key = nomeClean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          id: String(id || nomeClean),
          nome: nomeClean,
          raw,
          colabs
        });
      }
    };

    (equipesList || []).forEach((e: any) => {
      const nome = e.nome || e.dados?.nome;
      const colabs = e.membrosIds || e.colaboradoresIds || e.dados?.membrosIds || e.dados?.colaboradoresIds || [];
      if (nome) addGroup(e.id, nome, e, Array.isArray(colabs) ? colabs : []);
    });

    (chatGroups || []).forEach((g: any) => {
      if (!g || !g.nome) return;
      let colabs = g.colaboradoresIds || g.dados?.colaboradoresIds || [];
      if (typeof colabs === 'string') {
        try { colabs = JSON.parse(colabs); } catch { colabs = []; }
      }
      addGroup(g.id, g.nome, g, Array.isArray(colabs) ? colabs : []);
    });

    (momentosFeed || []).forEach((m: any) => {
      const targets = [
        ...(m.targetClasses || []),
        ...(m.dados?.targetClasses || []),
        ...(m.grupos || []),
        ...(m.dados?.grupos || [])
      ];
      targets.forEach((t: any) => {
        if (typeof t === 'string') {
          const tl = t.toLowerCase();
          if (
            (tl.includes('coordenação') || tl.includes('direção') || tl.includes('secretaria') || tl.includes('financeiro') || tl.includes('inspetor') || tl.includes('recepção') || tl.includes('equipe')) &&
            !tl.includes('ano') && !tl.includes('série') && !tl.includes('nível')
          ) {
            addGroup(t, t, { id: t, nome: t });
          }
        }
      });
    });

    return list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [chatGroups, equipesList, momentosFeed]);

  // Determinar o Ano Vigente oficial da escola
  const anoVigente = React.useMemo(() => {
    // 1. Procurar no calendário letivo oficial do ERP (isVigente === true ou status === 'Aberto')
    const vigenteConfig = (cfgCalendarioLetivo || []).find((c: any) => 
      c.isVigente === true || 
      c.isVigente === 'true' || 
      String(c.status || '').toLowerCase() === 'aberto'
    );
    if (vigenteConfig?.ano) return String(vigenteConfig.ano);

    // 2. Ano com o maior número de turmas acadêmicas cadastradas
    const yearCounts: Record<string, number> = {};
    (turmas || []).forEach((t: any) => {
      const y = String(t.ano || t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '');
      if (y) yearCounts[y] = (yearCounts[y] || 0) + 1;
    });
    const sortedByTurmas = Object.entries(yearCounts).sort((a, b) => b[1] - a[1]);
    if (sortedByTurmas.length > 0 && sortedByTurmas[0][1] > 0) {
      return sortedByTurmas[0][0];
    }

    // 3. Fallback: ano corrente do sistema
    return new Date().getFullYear().toString();
  }, [cfgCalendarioLetivo, turmas]);

  const anosLetivos = React.useMemo(() => {
    const anos = new Set<string>();
    (cfgCalendarioLetivo || []).forEach((c: any) => c.ano && anos.add(String(c.ano)));
    (turmas || []).forEach((t: any) => {
      if (t.ano) anos.add(String(t.ano));
      if (t.ano_letivo) anos.add(String(t.ano_letivo));
      if (t.dados?.anoLetivo) anos.add(String(t.dados.anoLetivo));
    });
    if (anoVigente) anos.add(anoVigente);
    return Array.from(anos).sort().reverse();
  }, [turmas, cfgCalendarioLetivo, anoVigente]);

  // Inicialização inteligente do ano: SEMPRE prioriza o ano vigente com turmas ativas!
  useEffect(() => {
    if (!selectedYear) {
      if (anoVigente && anosLetivos.includes(anoVigente)) {
        setSelectedYear(anoVigente);
      } else if (anosLetivos.length > 0) {
        setSelectedYear(anosLetivos[0]);
      } else {
        setSelectedYear('todos');
      }
    }
  }, [anosLetivos, selectedYear, anoVigente]);

  useEffect(() => {
    setSelectedTurmaId('all');
  }, [selectedYear]);

  // Turmas acadêmicas filtradas pelo ano letivo selecionado
  const filteredAcademicTurmas = React.useMemo(() => {
    if (!selectedYear || selectedYear === 'todos') return turmas;
    return turmas.filter((t: any) => {
      const year = String(t.ano || t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '');
      return year === selectedYear;
    });
  }, [turmas, selectedYear]);

  // Opções para o filtro do Administrador Master:
  // - Grupos da Equipe Escolar (sempre visíveis)
  // - Turmas acadêmicas do ano selecionado (ou todas se 'todos')
  const masterFilterOptions = React.useMemo(() => {
    const equipeOpts = equipeEscolarGrupos.map(g => ({
      id: `grupo_${g.id}`,
      nome: g.nome,
      categoria: 'Equipe Escolar',
      badge: 'Equipe'
    }));

    const turmaCatLabel = selectedYear && selectedYear !== 'todos' ? `Turmas (${selectedYear})` : 'Turmas';
    const turmasOpts = filteredAcademicTurmas.map(t => ({
      id: `turma_${t.id}`,
      nome: t.nome,
      categoria: turmaCatLabel
    }));

    return [...equipeOpts, ...turmasOpts];
  }, [equipeEscolarGrupos, filteredAcademicTurmas, selectedYear]);

  // Opções para o filtro de Colaborador regular (seus próprios grupos e turmas)
  const colabFilterOptions = React.useMemo(() => {
    return myStaffGroups.map(g => ({
      id: g.tipo === 'turma' ? `turma_${g.id}` : `grupo_${g.id}`,
      nome: g.nome,
      categoria: g.tipo === 'equipe' ? 'Equipe Escolar' : (g.tipo === 'turma' ? 'Minhas Turmas' : 'Meus Grupos'),
      badge: g.tipo === 'equipe' ? 'Equipe' : undefined
    }));
  }, [myStaffGroups]);

  const activeFilterOptions = isMasterAdmin ? masterFilterOptions : colabFilterOptions;

  const selectedFilterName = React.useMemo(() => {
    if (selectedTurmaId === 'all') {
      return isMasterAdmin ? 'Todos (Equipe e Turmas)' : 'Todos (Meus Grupos e Turmas)';
    }
    const rawId = selectedTurmaId.replace(/^(grupo_|turma_)/, '');
    const g = myStaffGroups.find(x => x.id === rawId || x.nome === rawId) || equipeEscolarGrupos.find(x => x.id === rawId || x.nome === rawId);
    if (g) return g.nome;
    const anyOpt = activeFilterOptions.find(o => o.id === selectedTurmaId);
    return anyOpt ? anyOpt.nome : 'Filtro Selecionado';
  }, [selectedTurmaId, isMasterAdmin, myStaffGroups, equipeEscolarGrupos, activeFilterOptions]);

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
        author: effectiveUser?.nome || 'Administração',
        authorId: effectiveUser?.id,
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

      // Atualização imediata local (otimista)
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

  const handleLike = async (momentId: number | string) => {
    const myName = effectiveUser?.nome || 'Você'
    setMomentosFeedLocally?.(prev => prev.map(m => {
      if (m.id !== momentId) return m
      const likesArray = m.likes || []
      const isLiked = likesArray.includes(myName)
      return {
        ...m,
        likes: isLiked ? likesArray.filter(name => name !== myName) : [...likesArray, myName]
      }
    }))
    
    try {
      await fetch('/api/agenda/momentos/interacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId, action: 'like', authorName: myName })
      })
    } catch (err) {
      console.error("Error updating momento likes:", err)
    }
  }

  const handlePublishComment = async (momentId: number | string) => {
    const text = commentInputs[momentId]
    if (!text?.trim()) return

    const myName = effectiveUser?.nome || 'Você'
    setMomentosFeedLocally?.(prev => prev.map(m => {
      if (m.id !== momentId) return m
      const commentsArray = m.comments || []
      return {
        ...m,
        comments: [...commentsArray, { id: Date.now().toString(), author: myName, text, time: 'Agora' }]
      }
    }))
    setCommentInputs(prev => ({ ...prev, [momentId]: '' }))
    
    try {
      await fetch('/api/agenda/momentos/interacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId, action: 'comment', value: text, authorName: myName })
      })
    } catch (err) {
      console.error("Error updating momento comments:", err)
    }
  }

  const handleDeleteComment = async (momentId: string | number, commentId: string) => {
    setMomentosFeedLocally?.(prev => prev.map(m => {
      if (m.id !== momentId) return m
      const commentsArray = m.comments || []
      return {
        ...m,
        comments: commentsArray.filter(c => c.id !== commentId)
      }
    }))
    
    try {
      await fetch('/api/agenda/momentos/interacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId, action: 'delete_comment', commentId })
      })
    } catch (err) {
      console.error("Error deleting momento comment:", err)
    }
  }

  const handleDeleteMomento = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mídia? Esta ação não pode ser desfeita.')) return;
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/agenda/momentos?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMomentosFeedLocally?.(prev => prev.filter(m => String(m.id) !== String(id)));
        queryClient.invalidateQueries({ queryKey: ['agenda', 'momentos'] });
        window.dispatchEvent(new CustomEvent('ad:momentos-delete', { detail: { id, old: { id } } }));
        adAlert('Momento excluído com sucesso!', 'Sucesso');
      } else {
        throw new Error('Erro ao excluir momento');
      }
    } catch (err: any) {
      console.error(err);
      adAlert(err.message || 'Ocorreu um erro ao excluir o momento.', 'Erro');
    } finally {
      setIsDeleting(null);
    }
  }
  
  // Filtrar momentos conforme o perfil de acesso institucional:
  // Administrador Master: filtra pelo grupo da equipe escolar ou turma selecionada (ou vê todos)
  // Outros Colaboradores: vê momentos do seu grupo/turma (equipe escolar), globais, marcados diretamente e os enviados por ele
  const meusMomentos = React.useMemo(() => {
    return (momentosFeed || []).filter(m => {
      // 1. Checa se o usuário atual é autor deste momento
      const mAuthorId = String(m.authorId || m.dados?.authorId || '').replace(/^f_?/, '').trim().toLowerCase();
      const mAuthor = String(m.author || m.dados?.author || '').trim().toLowerCase();
      const myName = String(effectiveUser?.nome || currentUser?.nome || '').trim().toLowerCase();

      const isAuthor = Boolean(
        (effectiveUser?.id && (mAuthorId === String(effectiveUser.id).replace(/^f_?/, '').trim().toLowerCase())) ||
        (currentUser?.id && (mAuthorId === String(currentUser.id).replace(/^f_?/, '').trim().toLowerCase())) ||
        (mAuthorId && candidateColabIds.includes(mAuthorId)) ||
        (myName && mAuthor && (mAuthor === myName || mAuthor.includes(myName) || myName.includes(mAuthor)))
      );

      // Destinatários do momento
      const targetClasses = [
        ...(m.targetClasses || []),
        ...(m.dados?.targetClasses || [])
      ].map((tc: any) => String(tc).trim());

      const targetClassesIds = [
        ...(m.targetClassesIds || []),
        ...(m.dados?.targetClassesIds || [])
      ].map((tId: any) => String(tId).trim());

      const targetFuncs = [
        ...(m.funcionariosIds || []),
        ...(m.dados?.funcionariosIds || []),
        ...((m as any).colaboradoresIds || []),
        ...(m.dados?.colaboradoresIds || [])
      ].map((f: any) => String(f).replace(/^f_?/, '').trim().toLowerCase());

      const extraGrupos = [
        ...(m.grupos || []),
        ...(m.dados?.grupos || []),
        ...(m.targetGrupos || []),
        ...(m.dados?.targetGrupos || []),
        ...((m as any).gruposIds || []),
        ...(m.dados?.gruposIds || [])
      ];

      // É momento global da escola ou institucional?
      const isGlobalMomento = targetClasses.some(tc => {
        const tcl = tc.toLowerCase();
        return ['todos', 'toda a escola', 'todas', 'todas as turmas', 'institucional'].includes(tcl);
      }) || (targetClasses.length === 0 && targetClassesIds.length === 0 && targetFuncs.length === 0);

      // É momento direcionado diretamente para a Equipe Escolar genérica?
      const isEquipeEscolarTarget = targetClasses.some(tc => {
        const tcl = tc.toLowerCase();
        return tcl === 'equipe escolar' || tcl === 'equipe' || tcl === 'funcionários' || tcl === 'colaboradores';
      });

      // É momento direcionado diretamente ao colaborador como funcionário?
      const isDirectlyTargeted = targetFuncs.some(fId => candidateColabIds.includes(fId));

      // ── CASO 1: ADMINISTRADOR MASTER ──
      if (isMasterAdmin) {
        // Se selecionou "Todos", visualiza todos os momentos (respeitando o ano letivo se houver filtro de ano ativo)
        if (selectedTurmaId === 'all') {
          if (selectedYear && selectedYear !== 'todos') {
            if (isEquipeEscolarTarget || isGlobalMomento) return true;

            // É momento direcionado à Equipe Escolar? Sempre exibe no "Todos"
            const isEquipeMomento = equipeEscolarGrupos.some(eg => {
              const egNome = eg.nome.toLowerCase().trim();
              const egId = String(eg.id).toLowerCase().trim();
              const cleanEgId = egId.replace(/^[tg]_?/, '');
              return (
                targetClasses.some(tc => {
                  const tcl = tc.toLowerCase().trim();
                  return tcl === egNome || tcl.includes(egNome) || egNome.includes(tcl);
                }) ||
                targetClassesIds.some(tId => {
                  const clean = tId.replace(/^[tg]_?/, '').toLowerCase().trim();
                  return clean === cleanEgId || tId.toLowerCase().trim() === egId;
                })
              );
            });
            if (isEquipeMomento) return true;

            // É turma acadêmica pertencente ao ano selecionado?
            const isAnoTurma = filteredAcademicTurmas.some(at => {
              const atNome = at.nome.toLowerCase().trim();
              const atId = String(at.id).toLowerCase().trim();
              const atCod = String(at.codigo || '').toLowerCase().trim();
              return (
                targetClasses.some(tc => {
                  const tcl = tc.toLowerCase().trim();
                  return tcl === atNome || tcl.includes(atNome) || atNome.includes(tcl);
                }) ||
                targetClassesIds.some(tId => {
                  const clean = tId.replace(/^[tg]_?/, '').toLowerCase().trim();
                  return clean === atId || clean === atCod || tId.toLowerCase().trim() === atId;
                })
              );
            });
            if (isAnoTurma) return true;

            // Momento criado no ano selecionado
            const momentoYear = m.date ? new Date(m.date).getFullYear().toString() : (m.created_at ? new Date(m.created_at).getFullYear().toString() : '');
            if (momentoYear && momentoYear === selectedYear) {
              return true;
            }

            return false;
          }
          return true;
        }

        // Se o Administrador Master selecionou um Grupo da Equipe Escolar
        if (selectedTurmaId.startsWith('grupo_')) {
          const rawId = selectedTurmaId.replace('grupo_', '');
          const targetGroup = equipeEscolarGrupos.find(x => x.id === rawId || x.nome === rawId);
          if (!targetGroup) return false;

          const gNome = targetGroup.nome.toLowerCase().trim();
          const gId = String(targetGroup.id).toLowerCase().trim();
          const cleanGId = gId.replace(/^[tg]_?/, '');

          return (
            targetClasses.some(tc => {
              const tcl = String(tc).toLowerCase().trim();
              return tcl === gNome || tcl.includes(gNome) || gNome.includes(tcl);
            }) ||
            targetClassesIds.some(tId => {
              const clean = String(tId).replace(/^[tg]_?/, '').toLowerCase().trim();
              return clean === cleanGId || String(tId).toLowerCase().trim() === gId || String(tId).toLowerCase().trim() === `g_${cleanGId}`;
            }) ||
            extraGrupos.some((eg: any) => {
              if (typeof eg === 'string') {
                const egl = eg.trim().toLowerCase();
                return egl === gNome || egl.includes(gNome) || gNome.includes(egl) || eg === gId || eg === cleanGId;
              }
              if (eg && typeof eg === 'object') {
                return String(eg.id) === gId || String(eg.nome || '').trim().toLowerCase() === gNome;
              }
              return false;
            })
          );
        }

        // Se o Administrador Master selecionou uma Turma acadêmica
        if (selectedTurmaId.startsWith('turma_')) {
          const rawId = selectedTurmaId.replace('turma_', '');
          const targetTurma = turmas.find(x => String(x.id) === rawId || String(x.codigo) === rawId || x.nome === rawId);
          if (!targetTurma) return false;

          const tNome = targetTurma.nome.toLowerCase().trim();
          const tId = String(targetTurma.id).toLowerCase().trim();
          const tCod = String(targetTurma.codigo || '').toLowerCase().trim();

          const targetAlunos = (m.alunosIds || []) as string[];
          if (targetAlunos.length > 0) {
            const matchedAlunos = (alunos || []).filter((a: any) => 
              targetAlunos.some((idRaw: string) => String(idRaw).replace(/^_*(ALU)?/, '') === String(a.id).replace(/^_*(ALU)?/, ''))
            );
            if (matchedAlunos.some((a: any) => String(a.turma) === tId || String(a.turma) === tCod || String(a.turma) === tNome)) {
              return true;
            }
          }

          return (
            targetClasses.some(tc => {
              const tcl = String(tc).toLowerCase().trim();
              return tcl === tNome || tcl.includes(tNome) || tNome.includes(tcl);
            }) ||
            targetClassesIds.some(tcId => {
              const clean = String(tcId).replace(/^[tg]_?/, '').toLowerCase().trim();
              return clean === tId || clean === tCod || String(tcId).toLowerCase().trim() === tId;
            })
          );
        }

        return true;
      }

      // ── CASO 2: OUTROS COLABORADORES (ACESSO INSTITUCIONAL) ──
      // 1. Momento enviado pelo próprio colaborador
      if (isAuthor) {
        return true;
      }

      // 2. Momento onde o colaborador foi marcado diretamente
      if (isDirectlyTargeted) {
        return true;
      }

      // 3. Se selecionou "Todos" (comportamento padrão)
      if (selectedTurmaId === 'all') {
        if (isGlobalMomento || isEquipeEscolarTarget) {
          return true;
        }

        // Checar se algum grupo ou turma do colaborador foi marcado
        const matchesStaffGroup = myStaffGroups.some(g => {
          const gNome = g.nome.toLowerCase().trim();
          const gId = String(g.id).toLowerCase().trim();
          const cleanGId = gId.replace(/^[tg]_?/, '');

          const nameMatch = targetClasses.some(tc => {
            const tcl = tc.toLowerCase().trim();
            return tcl === gNome || tcl.includes(gNome) || gNome.includes(tcl);
          });
          if (nameMatch) return true;

          const idMatch = targetClassesIds.some(tId => {
            const clean = tId.replace(/^[tg]_?/, '').toLowerCase().trim();
            return clean === cleanGId || clean === gId || tId.toLowerCase().trim() === gId || tId.toLowerCase().trim() === `g_${cleanGId}` || tId.toLowerCase().trim() === `t_${cleanGId}`;
          });
          if (idMatch) return true;

          const extraMatch = extraGrupos.some((eg: any) => {
            if (typeof eg === 'string') {
              const egl = eg.trim().toLowerCase();
              const cleanEg = egl.replace(/^[tg]_?/, '');
              return egl === gNome || egl.includes(gNome) || gNome.includes(egl) || cleanEg === cleanGId || egl === gId;
            }
            if (eg && typeof eg === 'object') {
              const egId = String(eg.id || '').replace(/^[tg]_?/, '').toLowerCase();
              const egNome = String(eg.nome || '').trim().toLowerCase();
              return egId === cleanGId || egNome === gNome || (egNome && gNome.includes(egNome));
            }
            return false;
          });
          if (extraMatch) return true;

          return false;
        });

        if (matchesStaffGroup) return true;

        // Fallback direto em chatGroups (caso o grupo não tenha sido mapeado em myStaffGroups)
        const directGroupMatch = (chatGroups || []).some((cg: any) => {
          if (!isColabInGroup(cg)) return false;
          const cgNome = String(cg.nome || cg.dados?.nome || '').toLowerCase().trim();
          const cgId = String(cg.id || '').toLowerCase().trim();
          const cleanCgId = cgId.replace(/^[tg]_?/, '');

          return (
            targetClasses.some(tc => {
              const tcl = tc.toLowerCase().trim();
              return tcl === cgNome || tcl.includes(cgNome) || cgNome.includes(tcl);
            }) ||
            targetClassesIds.some(tId => {
              const clean = tId.replace(/^[tg]_?/, '').toLowerCase().trim();
              return clean === cleanCgId || clean === cgId || tId.toLowerCase().trim() === cgId;
            })
          );
        });

        return directGroupMatch;
      }

      // Se o colaborador selecionou um grupo/turma específico no filtro
      const targetId = selectedTurmaId.replace(/^(grupo_|turma_)/, '');
      const selectedGroup = myStaffGroups.find(x => x.id === targetId || x.nome === targetId);
      if (!selectedGroup) return false;

      const gNome = selectedGroup.nome.toLowerCase().trim();
      const gId = String(selectedGroup.id).toLowerCase().trim();
      const cleanGId = gId.replace(/^[tg]_?/, '');

      return (
        targetClasses.some(tc => {
          const tcl = tc.toLowerCase().trim();
          return tcl === gNome || tcl.includes(gNome) || gNome.includes(tcl);
        }) ||
        targetClassesIds.some(tId => {
          const clean = tId.replace(/^[tg]_?/, '').toLowerCase().trim();
          return clean === cleanGId || clean === gId || tId.toLowerCase().trim() === gId || tId.toLowerCase().trim() === `g_${cleanGId}` || tId.toLowerCase().trim() === `t_${cleanGId}`;
        }) ||
        extraGrupos.some((eg: any) => {
          if (typeof eg === 'string') {
            const egl = eg.trim().toLowerCase();
            const cleanEg = egl.replace(/^[tg]_?/, '');
            return egl === gNome || egl.includes(gNome) || gNome.includes(egl) || cleanEg === cleanGId || egl === gId;
          }
          if (eg && typeof eg === 'object') {
            const egId = String(eg.id || '').replace(/^[tg]_?/, '').toLowerCase();
            const egNome = String(eg.nome || '').trim().toLowerCase();
            return egId === cleanGId || egNome === gNome;
          }
          return false;
        })
      );
    }).sort((a, b) => {
      const dateA = new Date((a as any).date || (a as any).created_at || 0).getTime();
      const dateB = new Date((b as any).date || (b as any).created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [momentosFeed, isMasterAdmin, selectedTurmaId, selectedYear, equipeEscolarGrupos, filteredAcademicTurmas, myStaffGroups, candidateColabIds, chatGroups, turmas, alunos, effectiveUser, currentUser, isColabInGroup]);

  // Marcação de lidos com proteção contra repetição infinita
  const markedMomentoIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!effectiveUser?.id || meusMomentos.length === 0) return;
    
    // Identifica quais IDs não constam como lidos para este colaborador e ainda não foram disparados
    const unreadIds = meusMomentos
      .filter(m => {
        const mId = String(m.id);
        if (markedMomentoIdsRef.current.has(mId)) return false;
        const leituras = (m as any).leituras || {};
        return !leituras[effectiveUser.id];
      })
      .map(m => String(m.id));

    if (unreadIds.length > 0) {
      unreadIds.forEach(id => markedMomentoIdsRef.current.add(id));

      fetch('/api/agenda/notificacoes/marcar-lido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'momento',
          ids: unreadIds,
          alunoId: effectiveUser.id // API usa esse campo como ID de quem leu
        })
      })
      .then(res => {
        if (res.ok) {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        }
      })
      .catch(err => console.error('Failed to mark momentos as read:', err));
    }
  }, [meusMomentos, effectiveUser?.id]);

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      paddingBottom: 60,
      background: 'transparent',
      overflow: 'visible'
    }}>

      {/* Decorative Blur Blobs */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '5%',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'rgba(236, 72, 153, 0.15)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '25%',
        right: '5%',
        width: '360px',
        height: '360px',
        borderRadius: '50%',
        background: 'rgba(99, 102, 241, 0.15)',
        filter: 'blur(90px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Floating Modern Icons Background Layer */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
        <div className="floating-icon" style={{ top: '8%', left: '8%', color: 'rgba(99, 102, 241, 0.35)', animation: 'floatRandom 14s ease-in-out infinite' }}><Heart size={28} fill="rgba(99, 102, 241, 0.15)" /></div>
        <div className="floating-icon" style={{ top: '15%', left: '85%', color: 'rgba(236, 72, 153, 0.4)', animation: 'floatRandom 16s ease-in-out infinite 1s' }}><Sparkles size={24} /></div>
        <div className="floating-icon" style={{ top: '40%', left: '5%', color: 'rgba(245, 158, 11, 0.35)', animation: 'floatRandom 12s ease-in-out infinite 2s' }}><Smile size={30} /></div>
        <div className="floating-icon" style={{ top: '60%', left: '90%', color: 'rgba(16, 185, 129, 0.3)', animation: 'floatRandom 15s ease-in-out infinite 0.5s' }}><Camera size={26} /></div>
        <div className="floating-icon" style={{ top: '75%', left: '10%', color: 'rgba(139, 92, 246, 0.35)', animation: 'floatRandom 18s ease-in-out infinite 2.5s' }}><Star size={26} fill="rgba(139, 92, 246, 0.15)" /></div>
        <div className="floating-icon" style={{ top: '85%', left: '80%', color: 'rgba(239, 68, 68, 0.35)', animation: 'floatRandom 13s ease-in-out infinite 3.5s' }}><Heart size={28} fill="rgba(239, 68, 68, 0.15)" /></div>
        <div className="floating-icon" style={{ top: '5%', left: '70%', color: 'rgba(59, 130, 246, 0.35)', animation: 'floatRandom 15s ease-in-out infinite 1.5s' }}><Sparkles size={26} /></div>
        <div className="floating-icon" style={{ top: '28%', left: '92%', color: 'rgba(236, 72, 153, 0.4)', animation: 'floatRandom 17s ease-in-out infinite 0.3s' }}><Camera size={24} /></div>
        <div className="floating-icon" style={{ top: '52%', left: '12%', color: 'rgba(245, 158, 11, 0.35)', animation: 'floatRandom 14s ease-in-out infinite 2.8s' }}><Star size={28} fill="rgba(245, 158, 11, 0.15)" /></div>
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* ULTRA MODERN HEADER CARD */}
        <div className="ad-momentos-header" style={{ 
          margin: '20px 16px 16px 16px',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 16px 36px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255,255,255,1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          position: 'relative',
          overflow: 'visible',
          zIndex: 30
        }}>
          {/* Background Gradients Layer */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(99,102,241,0.03) 0%, rgba(236,72,153,0.03) 50%, rgba(245,158,11,0.02) 100%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px', background: 'linear-gradient(180deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b)', backgroundSize: '100% 200%', animation: 'gradientMove 3s ease infinite' }} />
          </div>
          
          {/* Main Info: Icon + Title + Description */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 1, minWidth: 0, flex: 1 }}>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(236,72,153,0.12))',
              width: 50, height: 50, borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: '0 8px 16px rgba(99,102,241,0.1)',
              flexShrink: 0
            }}>
              <span style={{ fontSize: 26, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>📸</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ 
                  fontSize: 10, 
                  fontWeight: 800, 
                  letterSpacing: '0.05em', 
                  textTransform: 'uppercase', 
                  color: '#6366f1',
                  background: 'rgba(99, 102, 241, 0.08)',
                  padding: '2px 8px',
                  borderRadius: 6
                }}>
                  Mural Escolar
                </span>
              </div>
              <h2 className="ad-momentos-title" style={{ 
                fontSize: 'clamp(18px, 3.5vw, 26px)', 
                fontWeight: 900, 
                fontFamily: 'Outfit, sans-serif', 
                margin: 0, 
                letterSpacing: '-0.02em', 
                lineHeight: 1.25,
                background: 'linear-gradient(135deg, #0f172a 0%, #4f46e5 100%)', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {isMasterAdmin ? 'Fotos/Vídeos Institucionais' : 'Fotos/Vídeos da Equipe Escolar'}
              </h2>
              <p className="ad-momentos-desc" style={{ 
                fontSize: 13, 
                color: '#64748b', 
                margin: '3px 0 0 0', 
                fontFamily: 'Outfit, sans-serif',
                lineHeight: 1.4,
                fontWeight: 500
              }}>
                {isMasterAdmin ? (
                  selectedTurmaId === 'all' ? (
                    <>Publicações da <strong style={{ color: '#4f46e5', fontWeight: 700 }}>Equipe Escolar</strong> e de todas as turmas.</>
                  ) : (
                    <>Publicações de <strong style={{ color: '#4f46e5', fontWeight: 700 }}>{selectedFilterName}</strong>.</>
                  )
                ) : (
                  selectedTurmaId === 'all' ? (
                    <>Fotos e vídeos compartilhados com seus grupos e enviados por você.</>
                  ) : (
                    <>Fotos e vídeos de <strong style={{ color: '#4f46e5', fontWeight: 700 }}>{selectedFilterName}</strong>.</>
                  )
                )}
              </p>
            </div>
          </div>

          {/* Action Button */}
          {!isMirroring && (
            <button 
              onClick={() => setShowModal(true)} 
              className="ad-momentos-btn-novo"
              style={{
                height: 48, 
                padding: '0 22px', 
                border: 'none', 
                borderRadius: 16, 
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #ec4899 100%)',
                color: '#fff', 
                fontWeight: 700, 
                fontSize: 14, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 6px 20px rgba(124, 58, 237, 0.35)', 
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                flexShrink: 0,
                position: 'relative',
                zIndex: 2
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(124, 58, 237, 0.45)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.35)'
              }}
            >
              <Plus size={18} strokeWidth={2.5} /> 
              <span>Novo Foto/Vídeo</span>
            </button>
          )}
        </div>

        {/* FILTRO DE EXIBIÇÃO (Abaixo do card, antes dos momentos) */}
        {(isMasterAdmin || colabFilterOptions.length > 0) && (
          <div className="ad-momentos-filter-container" style={{ 
            margin: '0 16px 20px 16px',
            position: 'relative',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{ width: '100%', maxWidth: 440 }}>
              <TurmaDropdown 
                turmaOptions={activeFilterOptions} 
                selectedTurmaId={selectedTurmaId} 
                setSelectedTurmaId={setSelectedTurmaId} 
                selectedTurmaName={selectedFilterName} 
                anosLetivos={isMasterAdmin ? anosLetivos : []}
                selectedAno={selectedYear}
                setSelectedAno={setSelectedYear}
                anoVigente={anoVigente}
                allLabel={isMasterAdmin ? "Todos (Equipe e Turmas)" : "Todos (Meus Grupos e Turmas)"}
              />
            </div>
          </div>
        )}

        {meusMomentos.length === 0 ? (
          <div style={{ padding: '0 24px' }}>
            {isDataLoading || !effectiveUser ? (
              <MomentoSkeleton count={2} />
            ) : (
              <EmptyStateCard 
                title="Nenhum Momento Registrado"
                description={
                  isMasterAdmin 
                    ? (selectedTurmaId === 'all' 
                        ? 'Ainda não há fotos publicadas no mural institucional.' 
                        : `Ainda não há fotos publicadas para ${selectedFilterName}.`)
                    : (selectedTurmaId === 'all'
                        ? 'Ainda não há fotos ou vídeos compartilhados com seus grupos de equipe ou enviados por você.'
                        : `Ainda não há fotos ou vídeos compartilhados com ${selectedFilterName}.`)
                }
                icon={<ImageIcon size={48} style={{ opacity: 0.2 }} />}
              />
            )}
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            gap: 48, 
            padding: '24px 16px', 
          }}>
            {meusMomentos.slice(0, visibleCount).map((m, index) => {
              // Associa uma rotação inicial sutil e fixa com base no index
              const initialRotation = ((index * 3) % 5) - 2;
              const displayTime = (() => {
                const dt = (m as any).created_at || (m as any).date;
                if (dt) {
                  try {
                    return formatDateTime(dt);
                  } catch (e) {
                    return m.time || 'Agora';
                  }
                }
                return m.time || 'Agora';
              })()

              const isTargeted = highlightedId === String(m.id);
              return (
                <div 
                  key={m.id} 
                  id={`momento-${m.id}`}
                  className="polaroid-card"
                  style={{ 
                    transform: `rotate(${initialRotation}deg)`,
                    border: isTargeted ? '3px solid #7928CA' : undefined,
                    boxShadow: isTargeted ? '0 0 25px rgba(121,40,202,0.45)' : undefined,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Header Simplificado para caber no formato polaroid */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div className="avatar" style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7928CA, #FF0080)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, boxShadow: '0 4px 10px rgba(121,40,202,0.2)' }}>
                      {getInitials(m.author)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.author}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '340px' }}>
                        {(() => {
                          const hasAlunos = m.alunosIds && m.alunosIds.length > 0;
                          const label = (() => {
                            if (hasAlunos) {
                              const names = m.alunosNomes || [];
                              if (names.length > 0) {
                                if (names.length > 2) return `${names.length} Alunos`;
                                return names.join(', ');
                              }
                              return `${m.alunosIds?.length || 0} Aluno(s)`;
                            }
                            const classes = m.targetClasses || [];
                            if (classes.some((c: string) => c.toLowerCase() === 'todos' || c.toLowerCase() === 'toda a escola' || c.toLowerCase() === 'todas')) return 'Toda a Escola';
                            const classNames = classes.map((c: string) => {
                              const equipeMatch = equipeEscolarGrupos.find(eg => eg.id === c || eg.nome.toLowerCase() === c.toLowerCase());
                              if (equipeMatch) return `${equipeMatch.nome} (Equipe)`;
                              const turmaMatch = turmas.find((t: any) => String(t.id) === String(c) || String(t.codigo) === String(c) || String(t.nome) === String(c));
                              return turmaMatch ? turmaMatch.nome : c;
                            });
                            if (classNames.length > 2) return `${classNames.length} Destinos`;
                            return classNames.join(', ');
                          })()
                          const isEquipeOnly = !hasAlunos && (m.targetClasses || []).some((c: string) => equipeEscolarGrupos.some(eg => eg.id === c || eg.nome.toLowerCase() === c.toLowerCase()));
                          return `${hasAlunos ? 'Alunos' : (isEquipeOnly ? 'Equipe' : 'Turma')}: ${label}`;
                        })()} • {displayTime}
                      </div>
                    </div>
                    {/* Delete Button (ultra modern) */}
                    {(effectiveUser?.id === (m as any).authorId || effectiveUser?.nome === m.author || effectiveUser?.perfil === 'administrador' || String(effectiveUser?.cargo).toLowerCase().includes('diretor') || String(effectiveUser?.cargo).toLowerCase().includes('admin')) && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {isDeleting === m.id ? (
                          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#94a3b8' }} />
                        ) : (
                          <button 
                            onClick={() => handleDeleteMomento(m.id as string)}
                            title="Excluir Momento"
                            style={{ 
                              width: 32, height: 32, borderRadius: '10px', border: 'none', background: 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              color: '#cbd5e1'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.transform = 'scale(1) rotate(0deg)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <Trash2 size={16} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mídia estilo Filme Polaroid */}
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '1/1', // quadrada formato polaroid
                    background: '#0a0e17', 
                    overflow: 'hidden',
                    borderRadius: 12,
                    marginBottom: 16,
                    display: 'flex',
                    boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    position: 'relative'
                  }}>
                    {(() => {
                      const mediaList = m.media || []
                      if (mediaList.length === 0) return null
                      const activeIndex = currentMediaIndex[m.id] || 0
                      const med = mediaList[activeIndex]
                      
                      return (
                        <div style={{ width: '100%', height: '100%' }}>
                            <div 
                              className="media-item-hover"
                              style={{ width: '100%', height: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}
                              onClick={() => {
                                setLightboxMedia(m.media.map((item: any) => ({ url: item.url, type: item.type === 'video' || item.url.match(/\.(mp4|webm)$/i) ? 'video' : 'image' })))
                                setLightboxIndex(activeIndex)
                                setLightboxOpen(true)
                              }}
                            >
                              {med.type === 'video' || med.url.match(/\.(mp4|webm)$/i) ? (
                                <video src={med.url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} controls playsInline />
                              ) : (
                                <img 
                                  src={med.url} 
                                  alt="Momento Escolar" 
                                  style={{ width: '100%', height: '100%', objectFit: 'contain', transition: 'transform 0.5s ease' }} 
                                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80';
                                  }}
                                />
                              )}
                              <div className="expand-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'none' }}>
                                <Maximize2 color="white" size={32} />
                              </div>
                            </div>

                          {mediaList.length > 1 && (
                            <>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => ({ ...p, [m.id]: activeIndex > 0 ? activeIndex - 1 : mediaList.length - 1 })) }} 
                                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.85)', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(15,23,42,0.85)'}
                              >
                                <ChevronLeft size={20} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => ({ ...p, [m.id]: activeIndex < mediaList.length - 1 ? activeIndex + 1 : 0 })) }} 
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.85)', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(15,23,42,0.85)'}
                              >
                                <ChevronRight size={20} />
                              </button>
                              <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 10, background: 'rgba(15,23,42,0.85)', padding: '4px 8px', borderRadius: 12 }}>
                                {mediaList.map((_: any, idx: number) => (
                                  <div key={idx} style={{ width: 6, height: 6, borderRadius: '50%', background: idx === activeIndex ? 'white' : 'rgba(255,255,255,0.4)', transition: 'background 0.3s' }} />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Rodapé Polaroid */}
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 4px' }}>
                    
                    <div style={{ fontSize: 18, lineHeight: 1.5, color: '#334155', fontFamily: '"Caveat", "Comic Sans MS", cursive', fontWeight: 500, marginBottom: 16 }}>
                       {m.desc}
                    </div>

                    <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                       <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                         <Heart 
                           size={20} 
                           color={(m.likes || []).includes(effectiveUser?.nome || 'Você') ? '#ef4444' : '#64748b'} 
                           fill={(m.likes || []).includes(effectiveUser?.nome || 'Você') ? '#ef4444' : 'none'}
                           cursor="pointer" 
                           onClick={() => handleLike(m.id)}
                           style={{ transition: 'all 0.2s', filter: (m.likes || []).includes(effectiveUser?.nome || 'Você') ? 'drop-shadow(0 4px 6px rgba(239,68,68,0.3))' : 'none' }}
                         />
                         <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>{(m.likes || []).length}</span>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => { document.getElementById(`comment-input-${m.id}`)?.focus() }}>
                         <MessageCircle size={20} color="#64748b" />
                         <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>{(m.comments || []).length}</span>
                       </div>
                    </div>

                    {/* Comentários Minimais */}
                    {(m.comments || []).length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', paddingRight: 4, background: '#f8fafc', padding: 8, borderRadius: 10, border: '1px solid #f1f5f9' }}>
                        {(m.comments || []).map(c => (
                          <div key={c.id} className="group" style={{ fontSize: 12, lineHeight: 1.4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <span style={{ fontWeight: 700, marginRight: 6, color: '#1e293b' }}>{c.author}</span>
                              <span style={{ color: '#475569' }}>{c.text}</span>
                            </div>
                            <button 
                              onClick={() => handleDeleteComment(m.id, c.id)}
                              title="Excluir comentário"
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                cursor: 'pointer', 
                                color: '#ef4444', 
                                padding: '2px', 
                                opacity: 0.7,
                                display: 'flex'
                              }}
                              onMouseOver={e => e.currentTarget.style.opacity = '1'}
                              onMouseOut={e => e.currentTarget.style.opacity = '0.7'}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        id={`comment-input-${m.id}`}
                        type="text" 
                        value={commentInputs[m.id] || ''}
                        onChange={e => setCommentInputs(p => ({ ...p, [m.id]: e.target.value }))}
                        placeholder="Adicione um comentário..." 
                        style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, outline: 'none', color: '#1e293b' }}
                        onKeyDown={e => { if (e.key === 'Enter') handlePublishComment(m.id) }}
                      />
                      <button 
                        onClick={() => handlePublishComment(m.id)}
                        style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: commentInputs[m.id]?.trim() ? 1 : 0.5, transition: 'opacity 0.2s' }}
                        disabled={!commentInputs[m.id]?.trim()}
                      >
                        Publicar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {(visibleCount < meusMomentos.length || hasNextPageMomentos) && (
              <button 
                onClick={() => {
                  if (visibleCount >= meusMomentos.length && hasNextPageMomentos && fetchNextPageMomentos) {
                    fetchNextPageMomentos()
                  }
                  setVisibleCount(prev => prev + 5)
                }}
                className="btn btn-secondary" 
                style={{ 
                  marginTop: 20, 
                  padding: '12px 24px', 
                  borderRadius: 20, 
                  fontWeight: 700, 
                  background: 'white', 
                  boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
                  border: '1px solid hsl(var(--border-subtle))'
                }}
              >
                Carregar Mais
              </button>
            )}
          </div>
        )}
      </div>

      {/* LIGHTBOX / GALLERY MODAL COM SUPORTE A ZOOM */}
      <MomentoLightbox
        isOpen={lightboxOpen && lightboxMedia.length > 0}
        onClose={() => setLightboxOpen(false)}
        media={lightboxMedia}
        initialIndex={lightboxIndex}
      />

      {/* === MODAL: NOVO MOMENTO === */}
      {isMounted && showModal && (
        <ClientPortal>
          <AnimatePresence>
          <motion.div className="ad-momento-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ad-momento-content" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }} transition={{ duration: 0.2 }}
              style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

              {isSubmitting && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: 84, height: 84 }}>
                    <Loader2 size={84} color="#7c3aed" style={{ animation: 'spin 1.5s linear infinite', opacity: 0.25 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#7c3aed', fontSize: 20 }}>
                      {Math.round((Object.values(uploadProgress).reduce((a, b) => a + b, 0) / (newPost.mediaFiles.length || 1)) || 0)}%
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
                {/* Glow decorativo de fundo */}
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
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Publique fotos e vídeos no mural da turma</p>
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
                      <label htmlFor="upload-midia" style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
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

                  <input type="file" multiple accept="image/*,video/*" id="upload-midia" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files) setNewPost(p => ({ ...p, mediaFiles: [...p.mediaFiles, ...Array.from(e.target.files!)] })) }} />
                  
                  {newPost.mediaFiles.length === 0 ? (
                    <label htmlFor="upload-midia" style={{ 
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

                          {/* Botão de Excluir */}
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

                      {/* Botão de Adicionar Mais */}
                      <label htmlFor="upload-midia" style={{ 
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
                    placeholder="Escreva uma legenda inspiradora para este momento (opcional)..."
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

                {/* Target Classes / Destinatários */}
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

              {/* Modal Footer: Botões Reorganizados e de Leitura Leve */}
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
        allowedTurmasIds={isMasterAdmin ? undefined : myLinkedTurmaIds}
        currentUserId={effectiveUser?.id}
        hideFilterTabs={true}
        hideAllColabsButton={true}
      />

    </div>
  )
}
