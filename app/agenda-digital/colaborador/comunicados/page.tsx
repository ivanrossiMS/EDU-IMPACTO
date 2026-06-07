'use client'
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { Bell, Search, Filter, Pin, CheckCircle2, X, Paperclip, FileText, FileBarChart, DollarSign, Image as ImageIcon, Video, ShieldAlert, Calendar } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { UserAvatar } from '@/components/UserAvatar'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useFormularios, FormTemplate } from '@/lib/formulariosContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useApp } from '@/lib/context'
import { Plus, ChevronRight, ChevronLeft, HelpCircle, Users, ArrowRight, Send, Send as SendIcon, Clock, Bold, Italic, Link as LinkIcon, List, Underline, Smile, BadgeDollarSign, ClipboardList } from 'lucide-react'
import { useData } from '@/lib/dataContext'
import Portal from '@/components/Portal'
import { ComunicadoChat } from '@/components/ComunicadoChat'
import { ComunicadoViewModal } from '@/components/agenda/ComunicadoViewModal'
import { DestinatariosModal } from '../../components/agenda/DestinatariosModal'
import NovoComunicadoModal from '../../components/agenda/NovoComunicadoModal'
import { ReportsSelectionModal } from '@/components/agenda/ReportsSelectionModal'
import { ReportFillerModal } from '@/components/agenda/ReportFillerModal'
import { ReportPayloadView } from '@/components/DynamicReports/ReportPayloadView'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { ComunicadoSkeleton } from '../../components/ComunicadoSkeleton'

// Helper to abbreviate names for mobile
function abbreviateName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.slice(1, -1).map(p => {
    if (['de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase())) return p;
    return p.charAt(0).toUpperCase() + '.';
  }).join(' ');
  return `${first} ${middle} ${last}`;
}

// Helper parsers for attachments formatted as "name|url|mime"
const parseAnexo = (anexoStr: any) => {
  if (!anexoStr) return null;
  if (typeof anexoStr === 'object') {
    return { name: anexoStr.name || '', url: anexoStr.url || '', mime: anexoStr.mime || '' };
  }
  try {
    const str = typeof anexoStr === 'string' ? anexoStr : String(anexoStr);
    let name = '';
    let url = '';
    let mime = '';
    if (str.endsWith('|report-payload')) {
      const firstPipe = str.indexOf('|');
      const lastPipe = str.lastIndexOf('|');
      name = str.substring(0, firstPipe);
      url = str.substring(firstPipe + 1, lastPipe);
      mime = 'report-payload';
    } else {
      const parts = (str && typeof str.split === 'function') ? str.split('|') : [str];
      name = parts[0] || '';
      url = parts[1] || '';
      mime = parts[2] || '';
    }
    return { name, url, mime };
  } catch(e) {
    return null;
  }
};

const getAnexoType = (anexoStr: any) => {
  if (!anexoStr) return null;
  const parsed = parseAnexo(anexoStr);
  if (!parsed) return null;
  const { name, url, mime } = parsed;
  
  if (name.startsWith('Formulário:')) {
    return { label: 'Formulário', icon: <FileText size={16} strokeWidth={2} color="#3b82f6" />, color: 'rgba(59,130,246,0.1)', textColor: '#3b82f6' };
  }
  if (name.startsWith('Tarefa de Relatório:')) {
    return { label: 'Tarefa de Relatório', icon: <ClipboardList size={16} strokeWidth={2} color="#10b981" />, color: 'rgba(16,185,129,0.1)', textColor: '#10b981' };
  }
  if (name.startsWith('Relatório:') || name.startsWith('Relatório Personalizado:') || url.startsWith('payload:')) {
    return { label: 'Relatório', icon: <FileBarChart size={16} strokeWidth={2} color="#8b5cf6" />, color: 'rgba(139,92,246,0.1)', textColor: '#8b5cf6' };
  }
  if (name.toLowerCase().endsWith('.pdf')) {
    return { label: 'PDF', icon: <FileText size={16} strokeWidth={2} color="#ef4444" />, color: 'rgba(239,68,68,0.1)', textColor: '#ef4444' };
  }
  const isImg = url.startsWith('data:image/') || mime.startsWith('image/') || name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg') || name.toLowerCase().endsWith('.webp') || name.toLowerCase().endsWith('.gif');
  if (isImg) {
    return { label: 'Imagem', icon: <ImageIcon size={16} strokeWidth={2} color="#10b981" />, color: 'rgba(16,185,129,0.1)', textColor: '#10b981' };
  }
  const isVid = mime.startsWith('video/') || url.includes('.mov') || url.includes('.mp4') || name.toLowerCase().endsWith('.mov') || name.toLowerCase().endsWith('.mp4');
  if (isVid) {
    return { label: 'Vídeo', icon: <Video size={16} strokeWidth={2} color="#f59e0b" />, color: 'rgba(245,158,11,0.1)', textColor: '#f59e0b' };
  }
  
  return { label: 'Anexo', icon: <Paperclip size={16} strokeWidth={2} color="#64748b" />, color: 'rgba(100,116,139,0.1)', textColor: '#64748b' };
};

export default function ColaboradorComunicadosPage() {
  const { currentUser } = useApp()
  const { turmas = [] } = useData()
  const [showComposer, setShowComposer] = useState(false)
      const [destinatario, setDestinatario] = useState<any>(null) // Legacy

  // Modal Composer States
  const [editComId, setEditComId] = useState<string | null>(null)
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

  

  const userSlug = currentUser?.id || 'colaborador';
  const { adAlert, chatGroups } = useAgendaDigital()
  const { forms, setSubmissions, setDisparos, submissions } = useFormularios()
  
  const [alunos] = useSupabaseArray<any>('alunos?lightweight=true')

  const turmaOptions = useMemo(() => {
    if (!currentUser?.id) return [];
    const isMaster = String(currentUser?.cargo || '').toLowerCase().includes('administrador') || String(currentUser?.cargo || '').toLowerCase().includes('diretora');
    if (currentUser.perfil === 'administrador' || isMaster || currentUser.perfil === 'admin') return turmas;
    
    const userGroups = (chatGroups || []).filter((g: any) => {
      let colabs = g.colaboradoresIds;
      if (typeof colabs === 'string') {
        try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
      }
      if (!Array.isArray(colabs)) colabs = [];
      return colabs.some((id: any) => String(id) === String(currentUser.id));
    });

    const globalGroups = userGroups.filter((g: any) => g.isGlobalAccess === true || g.isGlobalAccess === 'true' || g.isGlobalAccess === 1);
    const hasGlobalWithoutYear = globalGroups.some((g: any) => {
      const a = g.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '');
      return a === '';
    });
    
    if (hasGlobalWithoutYear) return turmas;
    
    const globalYears = new Set(globalGroups.map((g: any) => {
      return g.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '');
    }).filter((a: string) => a !== ''));

    const accessibleTurmas = turmas.filter((t: any) => {
       const tAno = t.ano !== undefined ? String(t.ano) : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '');
       if (globalYears.has(tAno)) return true;
       return userGroups.some((g: any) => String(g.id) === `sync-${t.id}` || String(g.nome).trim().toLowerCase() === String(t.nome).trim().toLowerCase())
    });
    return accessibleTurmas
  }, [turmas, chatGroups, currentUser])
  
  
  const { comunicados, setComunicados, setComunicadosLocally, isDataLoading } = useAgendaDigital()
  
  const alunosAtivos = (alunos || []).filter((a: any) => a.status === 'matriculado' || a.status === 'ativo')

  const handleEnviar = (data: any, asRascunho = false) => {
    const { titulo, conteudo, anexos, dataAgendamento } = data;
    const newTitulo = titulo;
    const newConteudo = conteudo;
    if (!newTitulo.trim() || !newConteudo.trim()) {
      adAlert('Por favor, preencha o título e o conteúdo.', 'Atenção')
      return
    }
    
    if (selectedDest.length === 0) {
      adAlert('Por favor, selecione pelo menos um destinatário (Turma/Aluno) para o comunicado.', 'Atenção')
      return
    }

    if (editComId) {
      const updatedCom = {
        titulo: newTitulo,
        conteudo: newConteudo,
        autor: currentUser?.nome || 'Usuário ERP',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Colaborador',
        autorId: currentUser?.id || '',
        autorFoto: currentUser?.foto || null,
        anexos: anexos,
        dataAgendamento: dataAgendamento || null,
        status: asRascunho ? 'rascunho' : dataAgendamento ? 'agendado' : 'enviado',
        turmas: selectedDest.filter(d => d.type === 'turma').map(d => d.name),
        alunosIds: selectedDest.filter(d => d.type === 'aluno').map(d => d.id.replace(/^a_?/, '')),
        destino: 'selecionados'
      };
      
      setComunicadosLocally?.((prev: any) => prev.map((c: any) => c.id === editComId ? { ...c, ...updatedCom } : c));
      
      // Update directly via API to avoid sending the whole array
      const existingCom = comunicados.find((c: any) => c.id === editComId);
      if (existingCom) {
        fetch('/api/comunicados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...existingCom, ...updatedCom })
        }).catch(err => console.error("Error updating comunicado:", err));
      }
    } else {
      const newCom: any = {
        id: `AD-COM-COLAB-${Date.now()}`,
        titulo: newTitulo,
        conteudo: newConteudo,
        tipo: 'texto',
        autor: currentUser?.nome || 'Usuário ERP',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Colaborador',
        autorId: currentUser?.id || '',
        autorFoto: currentUser?.foto || null,
        turmas: selectedDest.filter(d => d.type === 'turma').map(d => d.name),
        alunosIds: selectedDest.filter(d => d.type === 'aluno').map(d => d.id.replace(/^a_?/, '')),
        destino: 'selecionados',
        prioridade: 'normal',
        fixado: false,
        exigeCiencia: false,
        permiteResposta: true,
        dataEnvio: new Date().toISOString(),
        dataAgendamento: dataAgendamento || null,
        anexos: anexos,
        leituras: {},
        ciencias: {},
        status: asRascunho ? 'rascunho' : dataAgendamento ? 'agendado' : 'enviado'
      }
      setComunicadosLocally?.((prev: any) => [newCom, ...prev])
      
      fetch('/api/comunicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCom)
      }).catch(err => console.error("Error creating comunicado:", err));
      
      // Auto-register form dispatches if it contains forms
      if (!asRascunho) {
         const appendedForms = anexos.filter((a: any) => a.startsWith('Formulário: ')).map((a: any) => a.replace('Formulário: ', ''))
         if (appendedForms.length > 0) {
            const targets = alunosAtivos.filter((a: any) => {
               if (newCom.turmas.includes(a.turma)) return true;
               const aIdPlain = a.id.replace(/^_*(ALU)?/, '')
               return newCom.alunosIds.some((idRaw: any) => idRaw.replace(/^_*(ALU)?/, '') === aIdPlain)
            })

            const newDisparos: any[] = []
            appendedForms.forEach((formName: string) => {
               const f = forms.find(x => x.name === formName)
               if (f) {
                  targets.forEach((t: any) => {
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

  const handleNovo = () => {
    setEditComId(null)
    
    
        
    
    
    setSelectedDest([])
    setShowComposer(true)
  }

  

  const [selectedComunicado, setSelectedComunicado] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [limit, setLimit] = useState(6)

  if (!currentUser) return null;

  
  const [openedFormStr, setOpenedFormStr] = useState<string | null>(null)
  const [openedReportPayloadStr, setOpenedReportPayloadStr] = useState<string | null>(null)
  const [maximizedImageStr, setMaximizedImageStr] = useState<string | null>(null)
  const [maximizedVideoStr, setMaximizedVideoStr] = useState<string | null>(null)
  const [formResp, setFormResp] = useState<Record<string, any>>({})
  const openedFormObj: FormTemplate | undefined = forms.find(x => x.name === openedFormStr?.replace('Formulário: ', ''))

  const previousSubmission = openedFormObj 
    ? submissions.find(sub => sub.formId === openedFormObj.id && sub.studentName === userSlug)
    : null;
  const hasResponded = !!previousSubmission;

  
  const handleCiencia = async (comunicadoId: string) => {
    const nowIso = new Date().toISOString()
    const updateFn = (prev: any) => prev.map((c: any) => {
      if (c.id === comunicadoId) {
        const updated = { ...c, ciencias: { ...(c.ciencias || {}), [userSlug]: nowIso } }
        if (selectedComunicado && selectedComunicado.id === comunicadoId) {
          setSelectedComunicado(updated)
        }
        return updated
      }
      return c
    })
    
    if (setComunicadosLocally) {
      setComunicadosLocally(updateFn)
    } else {
      setComunicados(updateFn)
    }
    
    try {
      const { data: dbCom } = await supabase.from('comunicados').select('dados').eq('id', comunicadoId).single();
      if (dbCom) {
        const dados = dbCom.dados || {};
        const newCiencias = { ...(dados.ciencias || {}), [userSlug]: nowIso };
        dados.ciencias = newCiencias;
        await supabase.from('comunicados').update({ dados }).eq('id', comunicadoId);
      }
    } catch (e) { console.error('Failed to save ciencia', e) }
  }

  const handleDownload = (filename: string) => {
    try {
      const isImg = filename.toLowerCase().endsWith('.png') || filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg') || filename.toLowerCase().endsWith('.gif') || filename.toLowerCase().endsWith('.webp')
      let finalName = filename;
      
      const a = document.createElement('a')
      if (isImg) {
         // Red 1x1 PNG pixel to ensure it's not seen as generic transparent null data by previewers
         a.href = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
      } else {
         const content = `Arquivo simulado para o sistema EDU-IMPACTO.\nNome original do anexo: ${filename}`
         const blob = new Blob([content], { type: 'text/plain' })
         a.href = URL.createObjectURL(blob)
         if (!filename.includes('.txt')) finalName = filename + '.txt'
      }
      
      a.download = finalName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
       adAlert(`Falha ao baixar ${filename}`, 'Erro')
    }
  }

  const renderConteudo = (text: string) => {
    if (!text) return null;
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
                      return <a key={`${j}-${k}-${l}`} href={url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>{textDesc}</a>
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

  return (
    <>
      <div className="ad-mobile-only" style={{ marginBottom: 8 }}>
        <div className="ad-com-search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, color: '#6366f1' }} />
          <input 
            className="form-input" 
            placeholder="Buscar..." 
            style={{
              paddingLeft: 40,
              width: '100%',
              height: 44,
              borderRadius: 14,
              border: '1px solid rgba(99, 102, 241, 0.15)',
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(99, 102, 241, 0.04)',
              fontSize: 14,
              color: '#0f172a',
              transition: 'all 0.3s'
            }} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
    <div className="ad-comunicados-wrapper" style={{ position: 'relative', minHeight: '85vh', padding: '32px', margin: '-32px', borderRadius: '32px', overflow: 'hidden', background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseGlow {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.15), 0 0 10px rgba(0, 210, 255, 0.5), 0 0 5px rgba(255, 0, 128, 0.4);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 0 0 6px rgba(0, 210, 255, 0.3), 0 0 20px rgba(0, 210, 255, 0.8), 0 0 12px rgba(255, 0, 128, 0.7);
          }
        }
        @keyframes pulseGlowRead {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1), 0 0 6px rgba(99, 102, 241, 0.2);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2), 0 0 10px rgba(99, 102, 241, 0.4);
          }
        }
        @keyframes neonLaserFlow {
          0% {
            background-position: 0% 0%;
            box-shadow: 0 0 6px rgba(0, 210, 255, 0.5), 0 0 12px rgba(255, 0, 128, 0.3);
          }
          50% {
            background-position: 0% 100%;
            box-shadow: 0 0 14px rgba(0, 210, 255, 0.8), 0 0 24px rgba(255, 0, 128, 0.6);
          }
          100% {
            background-position: 0% 0%;
            box-shadow: 0 0 6px rgba(0, 210, 255, 0.5), 0 0 12px rgba(255, 0, 128, 0.3);
          }
        }
        @keyframes neonLaserFlowRead {
          0% {
            background-position: 0% 0%;
            box-shadow: 0 0 4px rgba(99, 102, 241, 0.2);
          }
          50% {
            background-position: 0% 100%;
            box-shadow: 0 0 8px rgba(99, 102, 241, 0.4), 0 0 12px rgba(168, 85, 247, 0.2);
          }
          100% {
            background-position: 0% 0%;
            box-shadow: 0 0 4px rgba(99, 102, 241, 0.2);
          }
        }
        @keyframes floatBg {
          0% { transform: translateY(0px) rotate(0deg) scale(1); }
          50% { transform: translateY(-15px) rotate(6deg) scale(1.08); }
          100% { transform: translateY(0px) rotate(0deg) scale(1); }
        }
        @keyframes pulseGlowAmbient {
          0%, 100% { opacity: 0.3; transform: scale(1) translate(0px, 0px); }
          50% { opacity: 0.55; transform: scale(1.2) translate(-30px, 30px); }
        }
        @keyframes pulseGlowAmbientTwo {
          0%, 100% { opacity: 0.3; transform: scale(1) translate(0, 0); }
          50% { opacity: 0.45; transform: scale(1.15) translate(30px, -30px); }
        }
        .ad-mobile-only { display: none !important; }
        .ad-desktop-only { display: block !important; }
        @media (max-width: 768px) {
          .ad-mobile-only { display: block !important; }
          .ad-desktop-only { display: none !important; }
        }
        @media (max-width: 768px) {
          .ad-comunicados-wrapper {
            padding: 16px 8px !important;
            margin: 0 !important;
            border-radius: 16px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .ad-comunicados-wrapper .ad-page-header { 
            margin-top: 0 !important; 
            margin-bottom: 12px !important; 
            align-items: center !important; 
            flex-direction: row !important; 
            width: 100% !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding: 0 !important;
          }
          .ad-page-header > div:first-child {
            order: 1 !important;
            display: flex !important;
            justify-content: flex-start !important;
          }
          .ad-page-header > div:last-child {
            order: 2 !important;
          }
          .ad-com-filter-btn { display: none !important; }
          .ad-com-actions { 
            width: auto !important; 
            flex-direction: row !important; 
            align-items: center !important; 
            justify-content: flex-end !important;
            gap: 12px !important; 
            margin-top: 0 !important; 
          }
          .ad-com-actions > button {
            align-self: center !important;
          }
          .ad-com-search svg {
            width: 14px !important;
            height: 14px !important;
            left: 12px !important;
            color: #94a3b8 !important;
          }
          .ad-com-header-icon-box {
            display: none !important;
          }
          .ad-com-header-title {
            font-size: 24px !important;
            font-weight: 800 !important;
          }
          
          .ad-com-timeline-node { width: 36px !important; margin-right: 8px !important; }
          .ad-com-date-box { width: 36px !important; padding-right: 8px !important; }
          .ad-com-date-box > div:nth-child(1) { font-size: 14px !important; }
          .ad-com-date-box > div:nth-child(2) { font-size: 7px !important; }
          .ad-com-date-box > div:nth-child(3) { font-size: 8px !important; }
          
          .ad-com-timeline-line { left: 32px !important; }
          .ad-com-timeline-dot { right: -4px !important; width: 8px !important; height: 8px !important; top: 28px !important; border-width: 2px !important; }
          
          .ad-feed-card { padding: 12px 12px !important; gap: 8px !important; }
          .ad-com-card-title { font-size: 14px !important; }
          
          /* Badges 30% smaller */
          .badge-status {
            font-size: 9px !important;
            padding: 2px 8px !important;
          }
        }
      `}} />

      {/* Floating Animated Nebula Glows */}
      <div style={{
        position: 'absolute',
        top: '5%',
        left: '10%',
        width: 380,
        height: 380,
        background: 'radial-gradient(circle, rgba(0, 210, 255, 0.25) 0%, transparent 70%)',
        filter: 'blur(60px)',
        animation: 'pulseGlowAmbient 10s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '5%',
        width: 450,
        height: 450,
        background: 'radial-gradient(circle, rgba(255, 0, 128, 0.18) 0%, transparent 70%)',
        filter: 'blur(70px)',
        animation: 'pulseGlowAmbientTwo 14s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0
      }} />



      <div style={{ position: 'relative', zIndex: 1 }}>

        <div className="ad-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="ad-com-header-icon-box" style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(255, 0, 128, 0.15))',
              border: '1px solid rgba(0, 210, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 210, 255, 0.15)'
            }}>
              <Bell size={22} color="#00D2FF" style={{ animation: 'floatBg 4s ease-in-out infinite' }} />
            </div>
            <div>
              <h2 className="ad-com-header-title" style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', margin: 0, background: 'linear-gradient(135deg, #0f172a 40%, #6366f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.02))' }}>Comunicados</h2>
            </div>
          </div>
          
          <div className="ad-com-actions" style={{ display: 'flex', gap: 12 }}>
            <div className="ad-com-search ad-desktop-only" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: 14, color: '#6366f1' }} />
              <input 
                className="form-input" 
                placeholder="Buscar..." 
                style={{
                  paddingLeft: 40,
                  width: 260,
                  height: 44,
                  borderRadius: 14,
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 32px rgba(99, 102, 241, 0.04)',
                  fontSize: 14,
                  color: '#0f172a',
                  transition: 'all 0.3s'
                }} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary ad-com-filter-btn" style={{
              height: 44,
              borderRadius: 14,
              border: '1px solid rgba(99, 102, 241, 0.15)',
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(99, 102, 241, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 18px',
              fontSize: 14,
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}>
              <Filter size={16} /> Filtros
            </button>
            <button className="btn btn-primary" onClick={handleNovo} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44, borderRadius: 14, padding: '0 18px', fontSize: 14, fontWeight: 600 }}>
              <Plus size={16} />
              <span className="ad-desktop-only">Novo Comunicado</span>
              <span className="ad-mobile-only">Novo</span>
            </button>
          </div>
        </div>



      <div className="ad-feed-list" style={{ display: 'flex', flexDirection: 'column' }}>
        {(() => {
          const filteredComunicados = (comunicados || []).filter((c: any) => {
            if (c.id?.startsWith('AD-COM-REL-STU')) return false;
            
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            const titulo = c.titulo?.toLowerCase() || '';
            const remetente = c.remetente?.toLowerCase() || '';
            const conteudo = c.conteudo?.toLowerCase() || '';
            return titulo.includes(term) || remetente.includes(term) || conteudo.includes(term);
          }).sort((a: any, b: any) => {
            const dateA = new Date(a.dataEnvio || a.data || a.created_at || 0).getTime();
            const dateB = new Date(b.dataEnvio || b.data || b.created_at || 0).getTime();
            return dateB - dateA;
          });
          
          const paginatedComunicados = filteredComunicados.slice(0, limit);
          if ((isDataLoading && filteredComunicados.length === 0) || !currentUser) {
            return <ComunicadoSkeleton count={3} />
          }
          
          if (paginatedComunicados.length === 0) {
            return (
          <EmptyStateCard 
            title="Nenhum comunicado"
            description="Você está em dia com as comunicações pedagógicas e avisos gerais."
            icon={<Bell size={48} style={{ opacity: 0.2 }} />}
          />
            );
          }
          
          return (
            <>
              {paginatedComunicados.map((c: any, index: number) => {
                const rawDate = c.dataEnvio || (c as any).data || (c as any).created_at || new Date().toISOString();
            let parsedDate = new Date();
            try {
              const d = new Date(rawDate);
              if (!isNaN(d.getTime())) parsedDate = d;
            } catch(e) {}
            
            const day = parsedDate.toLocaleDateString('pt-BR', { day: '2-digit' });
            const month = parsedDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
            const time = parsedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const isRead = !!(c.leituras || {})[userSlug];
            const isCiencia = !!(c.ciencias || {})[userSlug];

            return (
              <motion.div 
                key={c.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{ display: 'flex', position: 'relative', paddingBottom: index !== paginatedComunicados.length - 1 ? 8 : 0 }}
              >
                {/* Timeline Laser Connector */}
                {index !== paginatedComunicados.length - 1 && (
                  <div className="ad-com-timeline-line" style={{ 
                    position: 'absolute', 
                    top: 48, 
                    bottom: -4, 
                    left: 88, 
                    width: 2, 
                    backgroundImage: isRead 
                      ? 'linear-gradient(to bottom, rgba(99,102,241,0.05), rgba(99,102,241,0.3), rgba(168, 85, 247, 0.3), rgba(99,102,241,0.05))' 
                      : 'linear-gradient(to bottom, rgba(0, 210, 255, 0.1), #00d2ff, #ff0080, rgba(255, 0, 128, 0.1))',
                    backgroundSize: '100% 200%',
                    animation: isRead ? 'neonLaserFlowRead 4s ease-in-out infinite' : 'neonLaserFlow 3s ease-in-out infinite',
                    zIndex: 0,
                    borderRadius: 2
                  }} />
                )}
                
                {/* Ultra-Modern Minimalist Date Node */}
                <div className="ad-com-timeline-node" style={{ 
                  marginRight: 16, 
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'flex-start',
                  paddingTop: 24,
                  width: 88,
                  position: 'relative'
                }}>
                  <div className="ad-com-date-box" style={{ width: 72, textAlign: 'right', paddingRight: 16 }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: isRead ? 'rgba(15,23,42,0.4)' : '#0f172a', lineHeight: 1, letterSpacing: -1 }}>{day}</div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: isRead ? 'rgba(15,23,42,0.3)' : '#4f46e5', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>{month}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(15,23,42,0.4)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{time}</div>
                  </div>
                  
                  {/* Glowing Dot on the Line */}
                  <div className="ad-com-timeline-dot" style={{ 
                    position: 'absolute',
                    right: -7,
                    top: 28,
                    width: 14, 
                    height: 14, 
                    borderRadius: '50%', 
                    background: isRead ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))' : 'linear-gradient(135deg, #00d2ff, #ff0080)', 
                    border: '3px solid #f8fafc',
                    animation: isRead ? 'pulseGlowRead 3s ease-in-out infinite' : 'pulseGlow 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    zIndex: 2 
                  }} />
                </div>

                {/* Right side: Modern Glassmorphic Card */}
                <div 
                  className="card ad-feed-card" 
                  style={{ 
                    flex: 1,
                    cursor: 'pointer', 
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', 
                    position: 'relative',
                    background: isRead ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)',
                    border: '1px solid',
                    borderColor: isRead ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.18)',
                    boxShadow: isRead 
                      ? '0 2px 10px -4px rgba(0,0,0,0.04)' 
                      : '0 12px 32px -8px rgba(99,102,241,0.08), inset 0 0 0 1px rgba(255,255,255,0.8)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: '24px 28px',
                    borderRadius: 24,
                    gap: 16,
                    overflow: 'hidden'
                  }}
                  onClick={() => {
                    const nowIso = new Date().toISOString();
                    const updatedComunicado = { ...c, leituras: { ...(c.leituras || {}), [userSlug]: nowIso } };
                    
                    setSelectedComunicado(updatedComunicado)
                    
                    if (!isRead) {
                      const updateFn = (prev: any) => prev.map((x: any) => x.id === c.id ? updatedComunicado : x)
                      if (setComunicadosLocally) {
                        setComunicadosLocally(updateFn)
                      } else {
                        setComunicados(updateFn)
                      }
                      
                      fetch('/api/agenda/notificacoes/marcar-lido', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tipo: 'comunicado',
                          ids: [c.id],
                          alunoId: userSlug
                        })
                      })
                      .then(res => {
                        if (res.ok) {
                          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
                        }
                      })
                      .catch(err => console.error('Failed to mark comunicado as read:', err))
                    }
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.boxShadow = isRead 
                      ? '0 12px 24px rgba(99,102,241,0.06)' 
                      : '0 20px 40px rgba(99,102,241,0.14), inset 0 0 0 1px rgba(255,255,255,1)';
                    const overlay = e.currentTarget.querySelector('.card-hover-overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = isRead ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.18)';
                    e.currentTarget.style.boxShadow = isRead 
                      ? '0 2px 10px -4px rgba(0,0,0,0.04)' 
                      : '0 12px 32px -8px rgba(99,102,241,0.08), inset 0 0 0 1px rgba(255,255,255,0.8)';
                    const overlay = e.currentTarget.querySelector('.card-hover-overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = '0';
                  }}
                >
                  {/* Subtle animated background mesh for unread items */}
                  {!isRead && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
                      background: 'radial-gradient(circle at top right, rgba(99,102,241,0.06), transparent 50%)',
                      pointerEvents: 'none', zIndex: 0
                    }} />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <UserAvatar userId={c.autorId} name={c.autor} fotoUrl={c.autorFoto} size={62} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {c.fixado && <Pin size={14} color="#f59e0b" style={{ fill: '#f59e0b' }} />}
                          <h3 className="ad-com-card-title" style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a', lineHeight: 1.2, letterSpacing: -0.3 }}>{c.titulo}</h3>
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', display: 'flex', flexWrap: 'nowrap', gap: 6, alignItems: 'center', lineHeight: 1.2, minWidth: 0 }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Por <strong style={{ color: '#334155', fontWeight: 600 }}>{abbreviateName(c.autor)}</strong></span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         {/* Priority badges */}
                         {c.prioridade === 'alta' && <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Alta Prioridade</span>}
                         {c.prioridade === 'urgente' && <span className="badge" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>Urgente</span>}
                         
                         {/* Status Badge */}
                         {!isRead ? (
                           <span className="badge badge-status" style={{ background: 'linear-gradient(135deg, #00d2ff, #ff0080)', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(0,210,255,0.3)', padding: '4px 12px', fontWeight: 800, letterSpacing: 0.5 }}>NOVO</span>
                         ) : (
                           <span className="badge badge-neutral badge-status" style={{ background: 'transparent', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)', fontWeight: 600 }}>LIDO</span>
                         )}
                       </div>

                       {/* Attachments Section */}
                       {c.anexos && c.anexos.length > 0 && (
                         <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                           {(() => {
                             let reportCount = 0;
                             let firstReportTypeInfo: any = null;

                             const otherAnexos: { anexo: string, idx: number, typeInfo: any }[] = [];

                             c.anexos.forEach((anexo: string, idx: number) => {
                               const typeInfo = getAnexoType(anexo);
                               if (!typeInfo) return;
                               
                               if (anexo.endsWith('|report-payload') || anexo.includes('Relatório Personalizado:')) {
                                 reportCount++;
                                 if (!firstReportTypeInfo) {
                                   firstReportTypeInfo = typeInfo;
                                 }
                               } else {
                                 otherAnexos.push({ anexo, idx, typeInfo });
                               }
                             });

                             if (reportCount <= 1) {
                               return c.anexos.map((anexo: string, idx: number) => {
                                 const typeInfo = getAnexoType(anexo);
                                 if (!typeInfo) return null;
                                 return (
                                   <div key={idx} title={typeInfo.label} style={{ 
                                      background: typeInfo.color, 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      width: 32,
                                      height: 32,
                                      borderRadius: '10px',
                                      border: `1px solid ${typeInfo.textColor}3a`,
                                      boxShadow: `0 2px 8px ${typeInfo.color}`,
                                   }}>
                                     {typeInfo.icon}
                                   </div>
                                 );
                               });
                             }

                             return (
                               <>
                                 {otherAnexos.map(({ anexo, idx, typeInfo }) => (
                                   <div key={`other-${idx}`} title={typeInfo.label} style={{ 
                                      background: typeInfo.color, 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      width: 32,
                                      height: 32,
                                      borderRadius: '10px',
                                      border: `1px solid ${typeInfo.textColor}3a`,
                                      boxShadow: `0 2px 8px ${typeInfo.color}`,
                                   }}>
                                     {typeInfo.icon}
                                   </div>
                                 ))}

                                 <div 
                                    title={`${reportCount} Relatórios Individuais`} 
                                    style={{ 
                                      background: firstReportTypeInfo?.color || 'rgba(99,102,241,0.1)', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      height: 32,
                                      padding: '0 12px',
                                      borderRadius: '10px',
                                      border: `1px solid ${firstReportTypeInfo?.textColor || '#6366f1'}3a`,
                                      boxShadow: `0 2px 8px ${firstReportTypeInfo?.color || 'rgba(99,102,241,0.2)'}`,
                                      gap: 6
                                   }}>
                                   {firstReportTypeInfo?.icon}
                                   <span style={{ 
                                     fontSize: 12, 
                                     fontWeight: 800, 
                                     color: firstReportTypeInfo?.textColor || '#6366f1' 
                                   }}>
                                     +{reportCount - 1}
                                   </span>
                                 </div>
                               </>
                             );
                           })()}
                         </div>
                       )}
                    </div>
                  </div>
                  
                  {/* Hover Action Overlay */}
                  <div className="card-hover-overlay" style={{
                    position: 'absolute', bottom: 24, right: 28, opacity: 0,
                    transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 8, zIndex: 2
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4f46e5', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                  
                  {/* Text sneak peek removed by user request */}

                  {/* Exige Ciência Box removed as per user request */}
                </div>
              </motion.div>
            )
          })}
              {filteredComunicados.length > limit && (
                 <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 24 }}>
                   <button onClick={() => setLimit(l => l + 6)} className="btn" style={{ background: '#4f46e5', color: '#fff', padding: '10px 24px', borderRadius: 100, border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                     Carregar Mais
                   </button>
                 </div>
              )}
            </>
          )
        })()}
      </div>

      <AnimatePresence>
        {selectedComunicado && (
          <ComunicadoViewModal
            comunicado={selectedComunicado}
            onClose={() => setSelectedComunicado(null)}
            onCiencia={handleCiencia}
            currentUserSlug={userSlug}
            currentUserName={currentUser?.nome || 'Colaborador'}
            currentUserAvatar={currentUser?.foto || (currentUser as any)?.fotoUrl || (currentUser as any)?.foto_url}
            isAdminMode={true}
            setOpenedFormStr={setOpenedFormStr}
            setMaximizedImageStr={setMaximizedImageStr}
            setMaximizedVideoStr={setMaximizedVideoStr}
            setOpenedReportTask={setOpenedReportTaskStr}
            setOpenedReportPayload={setOpenedReportPayloadStr}
          />
        )}
      </AnimatePresence>

      <ReportFillerModal
        isOpen={!!openedReportTaskStr}
        anexoStr={openedReportTaskStr}
        onClose={() => setOpenedReportTaskStr(null)}
        currentUser={currentUser}
        alunos={alunos}
        turmas={turmas}
      />

      <ReportPayloadView
        isOpen={!!openedReportPayloadStr}
        onClose={() => setOpenedReportPayloadStr(null)}
        attachmentString={openedReportPayloadStr || ''}
      />

      <AnimatePresence>
{/* Formulário/Relatório Simulado */}
      {openedFormStr && (
        <Portal>
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setOpenedFormStr(null)}>
           <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="card" style={{ padding: 40, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 16 }}>
                 <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText color="#3b82f6" />
                 </div>
                 <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800 }}>
                      {openedFormStr.replace('Formulário: ', '').replace('Relatório: ', '')}
                    </h2>
                    <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                      {openedFormObj?.description || 'Formulário gerado pelo documento anexo.'}
                    </p>
                 </div>
              </div>

              {hasResponded && (
                <div style={{ background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 8, padding: 16, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <CheckCircle2 color="#16a34a" size={24} />
                  <div>
                    <strong style={{ color: '#16a34a', display: 'block', fontSize: 14 }}>Formulário já Respondido</strong>
                    <span style={{ fontSize: 12, color: '#15803d' }}>Você concluiu e enviou este formulário em {new Date(previousSubmission!.createdAt).toLocaleDateString()}. Novas respostas foram bloqueadas para evitar duplicidade.</span>
                  </div>
                </div>
              )}

              {!openedFormObj ? (
                  <div style={{ padding: 16, background: 'hsl(var(--bg-overlay))', borderRadius: 8, marginBottom: 24 }}>
                     <div style={{ fontWeight: 600 }}>Formulário Misto Simulado</div>
                     <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>Na versão de produção, o conteúdo interativo seria carregado aqui.</p>
                  </div>
              ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
                    {openedFormObj.sections.map((sec, idx) => (
                       <div key={sec.id}>
                          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'hsl(var(--primary))' }}>{sec.title}</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {sec.fields.map(f => {
                               const show = !f.conditionalRule || formResp[f.conditionalRule.fieldId] === f.conditionalRule.value
                               if (!show) return null

                               return (
                                  <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                     <label style={{ fontSize: 14, fontWeight: 600 }}>{f.label} {f.required && <span style={{color: 'red'}}>*</span>}</label>
                                     {f.type === 'texto-curto' && <input type="text" className="form-input" disabled={hasResponded} onChange={e => setFormResp({...formResp, [f.id]: e.target.value})} />}
                                     {f.type === 'texto-longo' && <textarea className="form-input" style={{height: 80}} disabled={hasResponded} onChange={e => setFormResp({...formResp, [f.id]: e.target.value})} />}
                                     {f.type === 'numero' && <input type="number" className="form-input" disabled={hasResponded} onChange={e => setFormResp({...formResp, [f.id]: e.target.value})} />}
                                     {f.type === 'data' && <input type="date" className="form-input" disabled={hasResponded} onChange={e => setFormResp({...formResp, [f.id]: e.target.value})} />}
                                     {f.type === 'hora' && <input type="time" className="form-input" disabled={hasResponded} onChange={e => setFormResp({...formResp, [f.id]: e.target.value})} />}
                                     
                                     {f.type === 'imagem' && (
                                        <div style={{ padding: 16, border: '1px dashed hsl(var(--border-subtle))', borderRadius: 8, background: 'rgba(0,0,0,0.02)', textAlign: 'center', opacity: hasResponded ? 0.6 : 1 }}>
                                           <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>{hasResponded ? 'Arquivo Anexado' : 'Clique para anexar arquivo ou imagem'}</div>
                                           <input type="file" disabled={hasResponded} onChange={e => setFormResp({...formResp, [f.id]: e.target.files?.[0]?.name})} />
                                        </div>
                                     )}

                                     {f.type === 'sim-nao' && (
                                        <div style={{ display: 'flex', gap: 12 }}>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: hasResponded ? 0.7 : 1 }}><input disabled={hasResponded} type="radio" name={f.id} value="Sim" onChange={e => setFormResp({...formResp, [f.id]: e.target.value})} /> Sim</label>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: hasResponded ? 0.7 : 1 }}><input disabled={hasResponded} type="radio" name={f.id} value="Não" onChange={e => setFormResp({...formResp, [f.id]: e.target.value})} /> Não</label>
                                        </div>
                                     )}

                                     {f.type === 'unica-escolha' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                          {f.options?.map(opt => (
                                             <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: hasResponded ? 0.7 : 1 }}>
                                                <input disabled={hasResponded} type="radio" name={f.id} value={opt} onChange={e => setFormResp({...formResp, [f.id]: e.target.value})} /> {opt}
                                             </label>
                                          ))}
                                        </div>
                                     )}

                                     {f.type === 'multipla-escolha' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                          {f.options?.map(opt => (
                                             <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: hasResponded ? 0.7 : 1 }}>
                                                <input disabled={hasResponded} type="checkbox" onChange={e => {
                                                   const prev = formResp[f.id] || []
                                                   if (e.target.checked) setFormResp({...formResp, [f.id]: [...prev, opt]})
                                                   else setFormResp({...formResp, [f.id]: prev.filter((p: string) => p !== opt)})
                                                }} /> {opt}
                                             </label>
                                          ))}
                                        </div>
                                     )}
                                  </div>
                               )
                            })}
                          </div>
                          {idx < openedFormObj.sections.length - 1 && <hr style={{ border: 0, borderBottom: '1px solid hsl(var(--border-subtle))', margin: '24px 0 0 0' }}/>}
                       </div>
                    ))}
                  </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                 <button className="btn btn-secondary" onClick={() => setOpenedFormStr(null)}>
                    {hasResponded ? 'Fechar' : 'Cancelar'}
                 </button>
                 {openedFormStr.includes('Formulário') && !hasResponded && (
                   <button className="btn btn-primary" onClick={() => {
                      if (openedFormObj) {
                         const submission = {
                           id: `SUB-${Date.now()}`,
                           formId: openedFormObj.id,
                           version: openedFormObj.version,
                           authorName: 'Responsável (Via Comunicado)',
                           studentName: userSlug,
                           data: formResp,
                           signedAt: new Date().toISOString(),
                           createdAt: new Date().toISOString()
                         }
                         setSubmissions(prev => [...prev, submission])
                         setDisparos(prev => [
                           ...prev,
                           { id: `D-LAZY-${Date.now()}`, formId: openedFormObj.id, targetId: userSlug, targetName: 'Família Connectada', status: 'respondido', sentAt: new Date().toISOString() }
                         ])
                      }
                      adAlert('Respostas enviadas com sucesso para a escola!', 'Sucesso')
                      setOpenedFormStr(null)
                      setFormResp({})
                   }}>Enviar Respostas Seguras</button>
                 )}
              </div>
           </motion.div>
        </motion.div>
        </Portal>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal de Imagem Maximizada */}
        {maximizedImageStr && (
          <Portal>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }} onClick={() => setMaximizedImageStr(null)}>
            <button className="btn btn-secondary" style={{ position: 'absolute', top: 24, right: 24, width: 48, height: 48, padding: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100001 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.borderColor = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)'; }} onClick={(e) => { e.stopPropagation(); setMaximizedImageStr(null); }}>
              <X size={24} />
            </button>
            <motion.img 
              src={maximizedImageStr} 
              initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.8, opacity:0}} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: 16, boxShadow: '0 32px 128px rgba(0,0,0,0.6)' }} 
              onClick={e => e.stopPropagation()} 
            />
          </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal de Vídeo */}
        {maximizedVideoStr && (
          <Portal>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setMaximizedVideoStr(null)}>
            <button className="btn btn-secondary" style={{ position: 'absolute', top: 24, right: 24, width: 48, height: 48, padding: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100001 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.borderColor = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)'; }} onClick={(e) => { e.stopPropagation(); setMaximizedVideoStr(null); }}>
              <X size={24} />
            </button>
            <motion.video 
              src={maximizedVideoStr} 
              initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.8, opacity:0}} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ maxWidth: '95vw', maxHeight: '95vh', borderRadius: 16, boxShadow: '0 32px 128px rgba(0,0,0,0.6)', background: '#000' }} 
              controls autoPlay
              onClick={e => e.stopPropagation()} 
            />
          </motion.div>
          </Portal>
        )}
      </AnimatePresence>


      {/* Modal Composer */}
      <NovoComunicadoModal
        isOpen={showComposer}
        onClose={() => { setShowComposer(false); setSelectedDest([]); }}
        initialData={editComId ? comunicados.find(c => c.id === editComId) : null}
        currentUser={currentUser}
        selectedDest={selectedDest}
        onClickSelectDest={() => setShowDestModal(true)}
        onRemoveDest={id => setSelectedDest(prev => prev.filter(x => x.id !== id))}
        onSave={(data, isDraft) => handleEnviar(data, isDraft)}
        onFillDirectly={(payload) => {
          setShowComposer(false)
          setSelectedDest([])
          setOpenedReportTaskStr(`Tarefa de Relatório|payload:${JSON.stringify(payload)}|report-payload`)
        }}
      />

      {/* Destinatarios Universal Modal */}
      <DestinatariosModal 
        isOpen={showDestModal}
        onClose={() => setShowDestModal(false)}
        initialSelected={selectedDest}
        onAdd={(res) => setSelectedDest(res as any)}
        allowedTurmasIds={turmaOptions.map(t => String(t.id))}
      />

      <AnimatePresence>
        {/* Cobranca Modal */}
        {showCobrancaModal && (
          <motion.div className="ad-cobranca-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div className="card ad-cobranca-modal-card" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ width: 480, padding: 24, boxShadow: '0 40px 100px rgba(0,0,0,0.4)', borderRadius: 20 }}>
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
      </AnimatePresence>

      <ReportsSelectionModal 
        isOpen={showRelsModal} 
        onClose={() => setShowRelsModal(false)} 
        selectedDest={selectedDest} 
        onAdd={(text, payload) => alert('Atenção: Adicione o relatório anexando o PDF gerado ou insira o link no corpo do comunicado.')} 
      />

      <AnimatePresence>
        {/* Forms Selection Modal */}
        {showFormsModal && (
          <motion.div className="ad-forms-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div className="card ad-forms-modal-card" initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} style={{ width: '100%', maxWidth: 550, padding: 40, borderRadius: 40, boxShadow: '0 50px 100px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)', position: 'relative' }}>
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

  

      
      </div>
      <style jsx global>{`
        .mobile-text {
          display: none;
        }
        .desktop-text {
          display: inline;
        }

        @media (max-width: 768px) {
          .mobile-content-wrapper { padding-left: 0 !important; padding-right: 0 !important; }
          
          .mobile-text {
            display: inline !important;
          }
          .desktop-text {
            display: none !important;
          }

          /* Composer Fullscreen Mobile Styles */
          .ad-composer-overlay {
            background: #fff !important;
            z-index: 100100 !important;
            position: fixed !important;
            inset: 0 !important;
            display: block !important;
            overflow-y: auto !important;
          }
          
          .ad-composer-card {
            width: 100% !important;
            max-width: 100% !important;
            height: 100% !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            border: none !important;
            display: flex !important;
            flex-direction: column !important;
          }

          .ad-composer-header {
            padding: 16px 20px !important;
            border-bottom: 1px solid hsl(var(--border-subtle)) !important;
          }

          .ad-composer-body {
            padding: 16px 20px !important;
            flex: 1 !important;
            overflow-y: auto !important;
          }

          .ad-composer-footer {
            padding: 16px 20px !important;
            border-radius: 0 !important;
            border-top: 1px solid hsl(var(--border-subtle)) !important;
            flex-wrap: wrap !important;
            gap: 12px !important;
            justify-content: space-between !important;
            background: hsl(var(--bg-overlay)) !important;
          }

          /* Elevate child modals z-indexes so they render on top of fullscreen composer and bottom nav */
          .ad-destinatarios-modal-overlay,
          .ad-cobranca-modal-overlay,
          .ad-reports-modal-overlay,
          .ad-forms-modal-overlay,
          .ad-schedule-modal-overlay,
          .ad-expanded-comunicado-overlay {
            z-index: 9999999 !important;
          }
          
          /* Mobile modal card adjustments */
          .ad-destinatarios-modal-card,
          .ad-cobranca-modal-card,
          .ad-reports-modal-card,
          .ad-forms-modal-card,
          .ad-schedule-modal-card,
          .ad-expanded-comunicado-card {
            width: 95% !important;
            max-width: 550px !important;
            max-height: 90vh !important;
            border-radius: 24px !important;
            overflow-y: auto !important;
          }

          /* Relatorios Modal Fullscreen on Mobile */
          .ad-reports-modal-overlay {
            padding: 0 !important;
          }
          .ad-reports-modal-card {
            width: 100% !important;
            max-width: 100% !important;
            height: 100% !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
    </>
  )
}
