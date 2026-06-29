'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import Image from 'next/image'

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { Bell, Search, Filter, Pin, CheckCircle2, X, Paperclip, FileText, FileBarChart, DollarSign, Image as ImageIcon, Video, ShieldAlert, Calendar } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { UserAvatar } from '@/components/UserAvatar'

import { use, useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQueryComunicados } from '@/lib/hooks/useAgendaQueries'
import { useFormularios, FormTemplate } from '@/lib/formulariosContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData } from '@/lib/dataContext'
import { supabase } from '@/lib/supabase'
import Portal from '@/components/Portal'
import { ComunicadoChat } from '@/components/ComunicadoChat'
import { ComunicadoViewModal } from '@/components/agenda/ComunicadoViewModal'
import { ComunicadoSkeleton } from '../../components/ComunicadoSkeleton'
import { ReportPayloadView } from '@/components/DynamicReports/ReportPayloadView'


// Helper to abbreviate names for mobile (e.g., "Maria Auxiliadora de Araújo Honório" -> "Maria A. de A. Honório")
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

const getAnexoType = (anexoStr: string) => {
  if (!anexoStr) return null;
  const parsed = parseAnexo(anexoStr);
  if (!parsed) return null;
  const { name, url, mime } = parsed;
  
  if (name.startsWith('Formulário:')) {
    return { label: 'Formulário', icon: <FileText size={16} strokeWidth={2} color="#3b82f6" />, color: 'rgba(59,130,246,0.1)', textColor: '#3b82f6' };
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

import { useApp } from '@/lib/context'

export default function ADComunicadosPage({ params }: { params: any }) {
  const queryClient = useQueryClient()
  const { adAlert } = useAgendaDigital()
  const { forms, setSubmissions, setDisparos, submissions } = useFormularios()
  const resolvedParams = useParams() as { slug: string }
  
  const { currentUser } = useApp()
  const isFamily = currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável';
  const { aluno } = useSelectedStudent()
  const { turmas = [] } = useData()
  const rawTurma = aluno?.turma
  const turmaObj = turmas.find((t: any) => t && (
    String(t.id) === String(rawTurma) || 
    String(t.codigo) === String(rawTurma) ||
    (t.nome && typeof rawTurma === 'string' && t.nome.toLowerCase().includes(rawTurma.toLowerCase()))
  ))
  const turmaNome = turmaObj?.nome || rawTurma

  const [limit, setLimit] = useState(6)
  const endpoint = resolvedParams?.slug ? `/api/comunicados?aluno_id=${resolvedParams.slug}` : null
  
  const { data: comunicadosData, isLoading: loading, refetch, hasNextPage, fetchNextPage } = useQueryComunicados(false, endpoint)
  const comunicados = comunicadosData?.pages?.flat() || []
  
  const searchParams = useSearchParams()
  const queryId = searchParams.get('id')
  const router = useRouter()
  
  const [selectedComunicado, setSelectedComunicado] = useState<any>(null)
  
  // Auto-open comunicado if queryId is present (only once)
  const hasAutoOpened = useRef(false)
  useEffect(() => {
    if (queryId && comunicados.length > 0 && !hasAutoOpened.current) {
      const target = comunicados.find((c: any) => String(c.id) === String(queryId))
      if (target) {
        setSelectedComunicado(target)
        hasAutoOpened.current = true
        
        // Remove query param from URL so it doesn't trigger again on refresh
        try {
          const urlParams = new URLSearchParams(window.location.search);
          urlParams.delete('id');
          const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
          router.replace(newUrl, { scroll: false })
        } catch(e) {}
      }
    }
  }, [queryId, comunicados, router])
  
  useEffect(() => {
    const handleUpdate = () => {
      refetch()
    }
    window.addEventListener('ad:comunicados-insert', handleUpdate)
    window.addEventListener('ad:comunicados-update', handleUpdate)
    window.addEventListener('ad:comunicados-delete', handleUpdate)
    
    return () => {
      window.removeEventListener('ad:comunicados-insert', handleUpdate)
      window.removeEventListener('ad:comunicados-update', handleUpdate)
      window.removeEventListener('ad:comunicados-delete', handleUpdate)
    }
  }, [refetch])

  const [searchTerm, setSearchTerm] = useState('')
  
  const [openedFormStr, setOpenedFormStr] = useState<string | null>(null)
  const [openedReportPayloadStr, setOpenedReportPayloadStr] = useState<string | null>(null)
  const [maximizedImageStr, setMaximizedImageStr] = useState<string | null>(null)
  const [maximizedVideoStr, setMaximizedVideoStr] = useState<string | null>(null)
  const [maximizedPdfStr, setMaximizedPdfStr] = useState<string | null>(null)
  const [formResp, setFormResp] = useState<Record<string, any>>({})
  const openedFormObj: FormTemplate | undefined = forms.find(x => x.name === openedFormStr?.replace('Formulário: ', ''))

  const previousSubmission = openedFormObj 
    ? submissions.find(sub => sub.formId === openedFormObj.id && sub.studentName === resolvedParams.slug)
    : null;
  const hasResponded = !!previousSubmission;

  
  const handleCiencia = async (comunicadoId: string) => {
    const nowIso = new Date().toISOString()
    
    // Update React Query Cache directly
    queryClient.setQueryData(['agenda', 'comunicados', endpoint], (old: any) => {
      if (!old || !old.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any[]) => page.map((c: any) => {
          if (c.id === comunicadoId) {
            const updated = { ...c, ciencias: { ...(c.ciencias || {}), [resolvedParams.slug]: nowIso } }
            if (selectedComunicado && selectedComunicado.id === comunicadoId) {
              setSelectedComunicado(updated)
            }
            return updated
          }
          return c
        }))
      };
    })

    try {
      await fetch('/api/agenda/notificacoes/marcar-ciencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           tipo: 'comunicado',
           id: comunicadoId,
           alunoId: resolvedParams.slug
        })
      });
      window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'));
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
    <div className="ad-comunicados-wrapper" style={{ position: 'relative', minHeight: '85vh', padding: '32px', margin: '-32px', borderRadius: '32px', overflow: 'hidden', background: 'transparent' }}>
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
          0%, 100% { opacity: 0.25; transform: scale(1) translate(0px, 0px); }
          50% { opacity: 0.45; transform: scale(1.15) translate(30px, -30px); }
        }
        @media (max-width: 768px) {
          .ad-comunicados-wrapper {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            margin-left: calc(-50vw + 50%) !important;
            margin-right: calc(-50vw + 50%) !important;
            width: 100vw !important;
            border-radius: 0 !important;
            padding: 24px 16px !important;
          }
          .ad-comunicados-wrapper .ad-page-header { 
            margin-top: -12px !important; 
            margin-bottom: 16px !important; 
            align-items: center !important; 
            flex-direction: row !important; 
            justify-content: space-between !important; 
            width: 100% !important;
            gap: 8px !important;
            padding: 0 4px !important;
          }
          .ad-com-filter-btn { display: none !important; }
          .ad-com-actions { width: auto !important; justify-content: flex-end !important; margin-top: 0 !important; align-self: center !important; }
          .ad-com-search { width: auto !important; justify-content: flex-end !important; }
          .ad-com-search input { 
            width: 120px !important; 
            max-width: 100% !important; 
            height: 36px !important; 
            padding-left: 32px !important; 
            font-size: 13px !important; 
            border-radius: 9999px !important; 
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            color: #0f172a !important;
          }
          .ad-com-search input:focus {
            width: 130px !important;
            border-color: #cbd5e1 !important;
            background: #ffffff !important;
          }
          .ad-com-search svg {
            width: 14px !important;
            height: 14px !important;
            left: 12px !important;
            color: #94a3b8 !important;
          }
          .ad-com-header-icon-box {
            width: 40px !important;
            height: 40px !important;
            border-radius: 12px !important;
            flex-shrink: 0 !important;
          }
          .ad-com-header-icon-box svg {
            width: 18px !important;
            height: 18px !important;
          }
          .ad-com-header-title {
            font-size: 20px !important;
            font-weight: 800 !important;
          }
          
          .ad-com-timeline-node { width: 50px !important; margin-right: 12px !important; }
          .ad-com-date-box { width: 50px !important; padding-right: 12px !important; }
          .ad-com-date-box > div:nth-child(1) { font-size: 18px !important; }
          .ad-com-date-box > div:nth-child(2) { font-size: 8px !important; }
          .ad-com-date-box > div:nth-child(3) { font-size: 9px !important; }
          
          .ad-com-timeline-line { left: 45px !important; }
          .ad-com-timeline-dot { right: -5px !important; width: 10px !important; height: 10px !important; top: 28px !important; border-width: 2px !important; }
          
          .ad-feed-card { padding: 16px 16px !important; gap: 12px !important; }
          .ad-com-card-title { font-size: 15px !important; }
          .ad-hide-mobile { display: none !important; }
        }
      `}} />

      {/* Floating Animated Nebula Glows */}
      <div className="ad-hide-mobile" style={{
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
      <div className="ad-hide-mobile" style={{
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
              <Bell size={22} color="#00D2FF" />
            </div>
            <div>
              <h2 className="ad-com-header-title" style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', margin: 0, background: 'linear-gradient(135deg, #0f172a 40%, #6366f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.02))' }}>Comunicados</h2>
              <p className="ad-text-hide-mobile" style={{ fontSize: 13, color: '#475569', margin: '2px 0 0 0', fontWeight: 500 }}>Avisos pedagógicos e informações oficiais do colégio</p>
            </div>
          </div>
          
          <div className="ad-com-actions" style={{ display: 'flex', gap: 12 }}>
            <div className="ad-com-search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: 14, color: '#6366f1' }} />
              <input 
                className="form-input" 
                placeholder="Buscar..." 
                style={{
                  paddingLeft: 40,
                  width: 220,
                  height: 44,
                  borderRadius: 14,
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'none',
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
              backdropFilter: 'none',
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
          </div>
        </div>




      <div className="ad-feed-list" style={{ display: 'flex', flexDirection: 'column' }}>
        {(() => {
          const filteredComunicados = (comunicados || []).filter((c: any) => {
            // Esconder comunicados internos (para staff) e relatórios mestre (COLAB) do feed dos pais/alunos
            if (c.destino === 'interno' || c.destino === 'funcionarios') return false;
            if (c.id && c.id.startsWith('AD-COM-REL-COLAB')) return false;
            if (c.tipo === 'AD-COM-REL-TURMA' || (c.id && c.id.startsWith('AD-COM-REL-TURMA'))) return false;

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
          
          if (loading || !aluno) {
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
            
            const currentReaderId = (isFamily ? resolvedParams.slug : currentUser?.id) || '';
            const isRead = !!(c.leituras || {})[currentReaderId];
            const isCiencia = !!(c.ciencias || {})[currentReaderId];

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
                      ? 'linear-gradient(to bottom, rgba(99,102,241,0.05), rgba(99,102,241,0.3), rgba(168, 85, 247, 0.3), rgba(99, 102, 241, 0.05))' 
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

                <div 
                  className="card ad-feed-card" 
                  style={{ 
                    flex: 1, 
                    background: c._isNew ? 'rgba(255, 255, 255, 0.95)' : (isRead ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.85)'), 
                    backdropFilter: 'none',
                    borderRadius: 24, 
                    padding: '24px 28px',
                    cursor: 'pointer',
                    border: c._isNew ? '2px solid #4f46e5' : (isRead ? '1px solid rgba(15, 23, 42, 0.05)' : '1px solid rgba(99, 102, 241, 0.15)'),
                    boxShadow: c._isNew ? '0 10px 40px -5px rgba(99, 102, 241, 0.4)' : (isRead ? 'none' : '0 12px 32px -8px rgba(99,102,241,0.08)'),
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    animation: c._isNew ? 'pulseGlow 2s infinite' : undefined,
                    transform: isRead ? 'scale(0.99)' : 'scale(1)',
                    transformOrigin: 'left center',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 16
                  }}
                  onClick={() => {
                    const isRead = !!(c.leituras || {})[currentReaderId];
                    const nowIso = new Date().toISOString();
                    const updatedComunicado = { ...c, leituras: { ...(c.leituras || {}), [currentReaderId]: nowIso } };
                    
                    setSelectedComunicado(updatedComunicado)
                    
                    if (!isRead) {
                      queryClient.setQueryData(['agenda', 'comunicados', endpoint], (old: any) => {
                        if (!old || !old.pages) return old;
                        return {
                          ...old,
                          pages: old.pages.map((page: any[]) => page.map((x: any) => x.id === c.id ? updatedComunicado : x))
                        };
                      })
                      fetch('/api/agenda/notificacoes/marcar-lido', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tipo: 'comunicado',
                          ids: [c.id],
                          alunoId: resolvedParams.slug
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
                         {/* Status Badge */}
                         {!isRead ? (
                           <span className="badge" style={{ background: 'linear-gradient(135deg, #00d2ff, #ff0080)', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(0,210,255,0.3)', padding: '2px 8px', fontSize: '9px', fontWeight: 800, letterSpacing: 0.5 }}>NOVO</span>
                         ) : (
                           <span className="badge badge-neutral" style={{ background: 'transparent', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)', padding: '2px 8px', fontSize: '9px', fontWeight: 600 }}>Lido</span>
                         )}
                         {/* Priority badges */}
                         {c.prioridade === 'alta' && <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Alta Prioridade</span>}
                         {c.prioridade === 'urgente' && <span className="badge" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>Urgente</span>}
                       </div>

                       {/* Attachments Section */}
                       {c.anexos && c.anexos.length > 0 && (
                         <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                           {c.anexos.map((anexo: string, idx: number) => {
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
                           })}
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

                  {/* Exige Ciência Box */}
                  {c.exigeCiencia && !c.titulo?.toLowerCase().includes('relatório') && (
                    <div style={{ 
                      background: isCiencia ? 'linear-gradient(to right, rgba(34,197,94,0.05), transparent)' : 'linear-gradient(to right, rgba(245,158,11,0.05), transparent)', 
                      padding: '14px 18px', 
                      borderRadius: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderLeft: isCiencia ? '4px solid #22c55e' : '4px solid #f59e0b',
                      marginTop: 4
                    }}>
                      <div style={{ fontSize: 13, color: isCiencia ? '#15803d' : '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isCiencia ? <CheckCircle2 size={18} /> : <Bell size={18} />}
                        {isCiencia ? 'Ciência registrada. Obrigado!' : 'Este comunicado exige a sua ciência obrigatória.'}
                      </div>
                      {!isCiencia ? (
                        <button 
                           onClick={(e) => { e.stopPropagation(); handleCiencia(c.id) }} 
                           className="btn" 
                           style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', padding: '6px 14px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, boxShadow: '0 4px 10px -4px rgba(245,158,11,0.5)' }}
                           onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                           onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                           Dar Ciência
                        </button>
                      ) : (
                         <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Concluído</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
              {(filteredComunicados.length > limit || hasNextPage) && (
                 <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 24 }}>
                   <button onClick={() => {
                     if (limit >= filteredComunicados.length && hasNextPage && fetchNextPage) {
                       fetchNextPage()
                     }
                     setLimit(l => l + 6)
                   }} className="btn" style={{ background: '#4f46e5', color: '#fff', padding: '10px 24px', borderRadius: 100, border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                     Carregar Mais
                   </button>
                 </div>
              )}
            </>
          )
        })()}
        
        <AnimatePresence>
          {selectedComunicado && (
            <ComunicadoViewModal
              comunicado={selectedComunicado}
              onClose={() => setSelectedComunicado(null)}
              onCiencia={handleCiencia}
              currentUserSlug={resolvedParams.slug}
              currentUserName={currentUser?.nome || aluno?.nome || 'Familiar / Aluno'}
              currentUserAvatar={currentUser?.foto || aluno?.foto || aluno?.fotoUrl || aluno?.foto_url}
              isAdminMode={false}
              alunos={aluno ? [aluno] : []}
              setOpenedFormStr={setOpenedFormStr}
              setMaximizedImageStr={setMaximizedImageStr}
              setMaximizedVideoStr={setMaximizedVideoStr}
              setMaximizedPdfStr={setMaximizedPdfStr}
              setOpenedReportPayload={setOpenedReportPayloadStr}
            />
          )}
        </AnimatePresence>
      </div>

      <ReportPayloadView
        isOpen={!!openedReportPayloadStr}
        onClose={() => setOpenedReportPayloadStr(null)}
        attachmentString={openedReportPayloadStr || ''}
      />

      <AnimatePresence>
{/* Formulário/Relatório Simulado */}
      {openedFormStr && (
        <Portal>
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', zIndex: 2147483647, transform: 'translateZ(9999px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setOpenedFormStr(null)}>
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
                           studentName: resolvedParams.slug,
                           data: formResp,
                           signedAt: new Date().toISOString(),
                           createdAt: new Date().toISOString()
                         }
                         setSubmissions(prev => [...prev, submission])
                         setDisparos(prev => [
                           ...prev,
                           { id: `D-LAZY-${Date.now()}`, formId: openedFormObj.id, targetId: resolvedParams.slug, targetName: 'Família Connectada', status: 'respondido', sentAt: new Date().toISOString() }
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
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'none', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }} onClick={() => setMaximizedImageStr(null)}>
            <button className="btn btn-secondary" style={{ position: 'absolute', top: 24, right: 24, width: 48, height: 48, padding: 0, borderRadius: '50%', background: 'rgba(15,23,42,0.85)', border: '2px solid rgba(255,255,255,0.8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.85)', zIndex: 100001 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.borderColor = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,23,42,0.85)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)'; }} onClick={(e) => { e.stopPropagation(); setMaximizedImageStr(null); }}>
              <X size={24} />
            </button>
            <motion.img 
              src={maximizedImageStr} 
              initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.8, opacity:0}} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: 16, boxShadow: '0 32px 128px rgba(15,23,42,0.85)' }} 
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
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'none', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setMaximizedVideoStr(null)}>
            <button className="btn btn-secondary" style={{ position: 'absolute', top: 24, right: 24, width: 48, height: 48, padding: 0, borderRadius: '50%', background: 'rgba(15,23,42,0.85)', border: '2px solid rgba(255,255,255,0.8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.85)', zIndex: 100001 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.borderColor = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,23,42,0.85)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)'; }} onClick={(e) => { e.stopPropagation(); setMaximizedVideoStr(null); }}>
              <X size={24} />
            </button>
            <motion.video 
              src={maximizedVideoStr} 
              initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.8, opacity:0}} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ maxWidth: '95vw', maxHeight: '95vh', borderRadius: 16, boxShadow: '0 32px 128px rgba(15,23,42,0.85)', background: '#000' }} 
              controls autoPlay
              onClick={e => e.stopPropagation()} 
            />
          </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal de PDF Maximizada */}
        {maximizedPdfStr && (
          <Portal>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'none', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setMaximizedPdfStr(null)}>
            <button className="btn btn-secondary" style={{ position: 'absolute', top: 24, right: 24, width: 48, height: 48, padding: 0, borderRadius: '50%', background: 'rgba(15,23,42,0.85)', border: '2px solid rgba(255,255,255,0.8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.85)', zIndex: 100001 }} onClick={(e) => { e.stopPropagation(); setMaximizedPdfStr(null); }}>
              <X size={24} />
            </button>
            <motion.div 
              initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.8, opacity:0}} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ width: '95vw', height: '95vh', borderRadius: 16, boxShadow: '0 32px 128px rgba(15,23,42,0.85)', background: '#fff', overflow: 'hidden' }} 
              onClick={e => e.stopPropagation()} 
            >
              <iframe src={maximizedPdfStr} style={{ width: '100%', height: '100%', border: 'none' }} title="Visualizador de PDF" />
            </motion.div>
          </motion.div>
          </Portal>
        )}
      </AnimatePresence>
      <style jsx global>{`
        @media (max-width: 640px) {
          .mobile-content-wrapper { padding-left: 0 !important; padding-right: 0 !important; }
        }
      `}</style>
      </div>
    </div>
  )
}

