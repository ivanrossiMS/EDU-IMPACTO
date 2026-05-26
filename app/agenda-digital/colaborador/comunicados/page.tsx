'use client'
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { Bell, Search, Filter, Pin, CheckCircle2, X, Paperclip, FileText, FileBarChart, DollarSign, Image as ImageIcon, Video, ShieldAlert, Calendar } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { UserAvatar } from '@/components/UserAvatar'
import { ComunicadoChat } from '@/components/ComunicadoChat'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useFormularios, FormTemplate } from '@/lib/formulariosContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useApp } from '@/lib/context'
import { Plus, ChevronRight, ChevronLeft, HelpCircle, Users, ArrowRight, Send, Send as SendIcon, Clock, Bold, Italic, Link as LinkIcon, List, Underline, Smile, BadgeDollarSign, ClipboardList } from 'lucide-react'
import { useData } from '@/lib/dataContext'
import Portal from '@/components/Portal'
import { DestinatariosModal } from '@/components/agenda/DestinatariosModal'
import { ReportsSelectionModal } from '@/components/agenda/ReportsSelectionModal'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'

// Helper parsers for attachments formatted as "name|url|mime"
const parseAnexo = (anexoStr: string) => {
  if (!anexoStr) return null;
  const parts = anexoStr.split('|');
  const name = parts[0] || '';
  const url = parts[1] || '';
  const mime = parts[2] || '';
  return { name, url, mime };
};

const getAnexoType = (anexoStr: string) => {
  if (!anexoStr) return null;
  const parsed = parseAnexo(anexoStr);
  if (!parsed) return null;
  const { name, url, mime } = parsed;
  
  if (name.startsWith('Formulário:')) {
    return { label: 'Formulário', icon: <FileText size={16} strokeWidth={2} color="#3b82f6" />, color: 'rgba(59,130,246,0.1)', textColor: '#3b82f6' };
  }
  if (name.startsWith('Relatório:')) {
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
  const [newTitulo, setNewTitulo] = useState('')
  const [newConteudo, setNewConteudo] = useState('')
  const [destinatario, setDestinatario] = useState<any>(null) // Legacy

  // Modal Composer States
  const [editComId, setEditComId] = useState<string | null>(null)
  const [selectedDest, setSelectedDest] = useState<{id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo'}[]>([])
  const [showDestModal, setShowDestModal] = useState(false)
  const [anexos, setAnexos] = useState<string[]>([])
  const [dataAgendamento, setDataAgendamento] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [tempDataAgendamento, setTempDataAgendamento] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const EMOJIS = ['😊', '😂', '👍', '🙏', '😍', '👏', '😉', '✅', '❌', '❤️']
  
  const [showCobrancaModal, setShowCobrancaModal] = useState(false)
  const [cobrancaForm, setCobrancaForm] = useState({ motivo: '', valor: '', vencimento: '', tipo: 'pix' })
  const [appCharges, setAppCharges] = useLocalStorage<any[]>('edu-app-charges-v1', [])
  
  const [showFormsModal, setShowFormsModal] = useState(false)
  const [showRelsModal, setShowRelsModal] = useState(false)

  const comunicadoRichEditorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showComposer && comunicadoRichEditorRef.current) {
      comunicadoRichEditorRef.current.innerHTML = newConteudo;
    }
  }, [showComposer]);
  const userSlug = currentUser?.id || 'colaborador';
  const { adAlert, chatGroups } = useAgendaDigital()
  const { forms, setSubmissions, setDisparos, submissions } = useFormularios()
  
  const [alunos] = useSupabaseArray<any>('alunos')

  const turmaOptions = useMemo(() => {
    const userGroups = (chatGroups || []).filter(g => g.colaboradoresIds?.includes(currentUser?.id || ''))
    const accessibleTurmas = turmas.filter(t => {
       return userGroups.some(g => String(g.id) === `sync-${t.id}` || g.nome === t.nome)
    })
    return accessibleTurmas
  }, [turmas, chatGroups, currentUser])
  
  
  const { comunicados, setComunicados } = useAgendaDigital()
  const loading = false;
  
  const [newComunicadosBuffer, setNewComunicadosBuffer] = useState<any[]>([])
  const comunicadosRef = useRef(comunicados)
  const isPollingRef = useRef(false)
  
  useEffect(() => {
    comunicadosRef.current = comunicados
  }, [comunicados])

  const alunosAtivos = (alunos || []).filter((a: any) => a.status === 'matriculado' || a.status === 'ativo')

  const handleEnviar = (asRascunho = false) => {
    if (!newTitulo.trim() || !newConteudo.trim()) {
      adAlert('Por favor, preencha o título e o conteúdo.', 'Atenção')
      return
    }
    
    if (selectedDest.length === 0) {
      adAlert('Por favor, selecione pelo menos um destinatário (Turma/Aluno) para o comunicado.', 'Atenção')
      return
    }

    if (editComId) {
      setComunicados((prev: any) => prev.map((c: any) => c.id === editComId ? {
        ...c,
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
      } : c))
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
      setComunicados((prev: any) => [newCom, ...prev])
      
      // Auto-register form dispatches if it contains forms
      if (!asRascunho) {
         const appendedForms = anexos.filter(a => a.startsWith('Formulário: ')).map(a => a.replace('Formulário: ', ''))
         if (appendedForms.length > 0) {
            const targets = alunosAtivos.filter((a: any) => {
               if (newCom.turmas.includes(a.turma)) return true;
               const aIdPlain = a.id.replace(/^_*(ALU)?/, '')
               return newCom.alunosIds.some((idRaw: any) => idRaw.replace(/^_*(ALU)?/, '') === aIdPlain)
            })

            const newDisparos: any[] = []
            appendedForms.forEach(formName => {
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
    setNewTitulo('')
    setNewConteudo('')
    setAnexos([])
  }

  const handleNovo = () => {
    setEditComId(null)
    setNewTitulo('')
    setNewConteudo('')
    if (comunicadoRichEditorRef.current) comunicadoRichEditorRef.current.innerHTML = ''
    setAnexos([])
    setDataAgendamento('')
    setTempDataAgendamento('')
    setSelectedDest([])
    setShowComposer(true)
  }

  

  const [selectedComunicado, setSelectedComunicado] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')

  if (!currentUser) return null;

  
  const [openedFormStr, setOpenedFormStr] = useState<string | null>(null)
  const [maximizedImageStr, setMaximizedImageStr] = useState<string | null>(null)
  const [maximizedVideoStr, setMaximizedVideoStr] = useState<string | null>(null)
  const [formResp, setFormResp] = useState<Record<string, any>>({})
  const openedFormObj: FormTemplate | undefined = forms.find(x => x.name === openedFormStr?.replace('Formulário: ', ''))

  const previousSubmission = openedFormObj 
    ? submissions.find(sub => sub.formId === openedFormObj.id && sub.studentName === userSlug)
    : null;
  const hasResponded = !!previousSubmission;

  
  const handleCiencia = (comunicadoId: string) => {
    setComunicados(prev => prev.map(c => {
      if (c.id === comunicadoId) {
        return { ...c, ciencias: { ...(c.ciencias || {}), [userSlug]: new Date().toISOString() } }
      }
      return c
    }))
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
          0%, 100% { opacity: 0.25; transform: scale(1) translate(0px, 0px); }
          50% { opacity: 0.45; transform: scale(1.15) translate(30px, -30px); }
        }
        @media (max-width: 768px) {
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
            width: 140px !important; 
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
            width: 150px !important;
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
        <AnimatePresence>
          {newComunicadosBuffer.length > 0 && !selectedComunicado && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              style={{
                marginBottom: 24,
                padding: '16px 24px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                borderRadius: 20,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)',
                cursor: 'pointer'
              }}
              onClick={() => {
                setComunicados(prev => {
                  const toAdd = newComunicadosBuffer.filter(n => !prev.some((p: any) => p.id === n.id));
                  return [...toAdd, ...prev].sort((a: any, b: any) => new Date(b.data || b.created_at).getTime() - new Date(a.data || a.created_at).getTime());
                });
                setNewComunicadosBuffer([]);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12, display: 'flex' }}>
                  <Bell size={20} color="#fff" style={{ animation: 'pulseGlowAmbient 2s infinite' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{newComunicadosBuffer.length === 1 ? 'Novo comunicado disponível' : `${newComunicadosBuffer.length} novos comunicados`}</div>
                  <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 500 }}>Clique para atualizar a lista</div>
                </div>
              </div>
              <div style={{ background: '#fff', color: '#4f46e5', padding: '6px 14px', borderRadius: 12, fontSize: 13, fontWeight: 800 }}>
                Ver agora
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              <Plus size={16} /> Novo Comunicado
            </button>
          </div>
        </div>



      <div className="ad-feed-list" style={{ display: 'flex', flexDirection: 'column' }}>
        {(() => {
          const filteredComunicados = (comunicados || []).filter((c: any) => {
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
          
          if (loading || !currentUser) {
            return [1, 2, 3].map((idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              style={{ display: 'flex', position: 'relative', paddingBottom: 12 }}
            >
              <div style={{ marginRight: 32, paddingTop: 24, width: 88 }}>
                <div style={{ width: 72, textAlign: 'right', paddingRight: 16 }}>
                  <div style={{ width: 40, height: 24, background: '#e2e8f0', borderRadius: 6, marginLeft: 'auto', marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ width: 30, height: 12, background: '#e2e8f0', borderRadius: 4, marginLeft: 'auto', animation: 'pulse 1.5s infinite' }} />
                </div>
              </div>
              <div className="card ad-feed-card" style={{ flex: 1, padding: '24px 28px', borderRadius: 24, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 16 }}>
                <div style={{ width: 62, height: 62, borderRadius: 16, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '60%', height: 20, background: '#e2e8f0', borderRadius: 6, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ width: '40%', height: 14, background: '#e2e8f0', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
                </div>
              </div>
            </motion.div>
          ));
          }
          
          if (filteredComunicados.length === 0) {
            return (
          <EmptyStateCard 
            title="Nenhum comunicado"
            description="Você está em dia com as comunicações pedagógicas e avisos gerais."
            icon={<Bell size={48} style={{ opacity: 0.2 }} />}
          />
            );
          }
          
          return filteredComunicados.map((c: any, index: number) => {
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
                style={{ display: 'flex', position: 'relative', paddingBottom: index !== filteredComunicados.length - 1 ? 8 : 0 }}
              >
                {/* Timeline Laser Connector */}
                {index !== filteredComunicados.length - 1 && (
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
                    setSelectedComunicado(c)
                    if (!isRead) {
                      setComunicados(prev => prev.map(x => x.id === c.id ? { ...x, leituras: { ...(x.leituras || {}), [userSlug]: new Date().toISOString() } } : x))
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
                        <div style={{ fontSize: 13, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', lineHeight: 1.2 }}>
                          <span>Enviado por <strong style={{ color: '#334155', fontWeight: 600 }}>{c.autor}</strong></span>
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
                           <span className="badge" style={{ background: 'linear-gradient(135deg, #00d2ff, #ff0080)', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(0,210,255,0.3)', padding: '4px 12px', fontWeight: 800, letterSpacing: 0.5 }}>NOVO</span>
                         ) : (
                           <span className="badge badge-neutral" style={{ background: 'transparent', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)', fontWeight: 600 }}>Lido</span>
                         )}
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
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>Abrir Comunicado</span>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4f46e5', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                  
                  {/* Text sneak peek removed by user request */}

                  {/* Exige Ciência Box */}
                  {c.exigeCiencia && (
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
          })
        })()}
      </div>

      <AnimatePresence>
{/* Modal do Comunicado Expandido */}
      {selectedComunicado && (
        <Portal>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }} onClick={() => setSelectedComunicado(null)}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="ad-modal-container" style={{ background: '#f8fafc', borderRadius: 28, width: '100%', maxWidth: 740, minHeight: 'fit-content', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)', position: 'relative', marginBottom: '5vh' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ flexShrink: 0, background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', padding: '32px 24px 24px 24px', position: 'relative', overflow: 'hidden', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, boxShadow: '0 4px 16px rgba(99,102,241,0.1)' }}>
              
              <button onClick={() => setSelectedComunicado(null)} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
                <X size={18} color="#ffffff" />
              </button>

              <div style={{ position: 'relative', zIndex: 2 }}>
                {(selectedComunicado.prioridade === 'alta' || selectedComunicado.prioridade === 'urgente') && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {selectedComunicado.prioridade === 'alta' && <span style={{ background: 'rgba(239,68,68,0.2)', color: '#fee2e2', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12, border: '1px solid rgba(239,68,68,0.3)' }}>Prioridade Alta</span>}
                    {selectedComunicado.prioridade === 'urgente' && <span style={{ background: 'rgba(249,115,22,0.2)', color: '#ffedd5', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12, border: '1px solid rgba(249,115,22,0.3)' }}>Urgente</span>}
                  </div>
                )}

                <h2 style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginBottom: 28, lineHeight: 1.3, paddingRight: 60, textShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  {selectedComunicado.titulo}
                </h2>

                <style dangerouslySetInnerHTML={{__html: `
                    @media (max-width: 768px) {
                      .ad-modal-megaphone { display: none !important; }
                      .ad-modal-author-row { padding-right: 0 !important; }
                      .ad-modal-avatar-wrapper > div, .ad-modal-avatar-wrapper > span { width: 36px !important; height: 36px !important; font-size: 14px !important; }
                      .ad-modal-avatar-wrapper img { width: 36px !important; height: 36px !important; }
                      .ad-modal-author-name { font-size: 14px !important; text-shadow: none !important; }
                      .ad-modal-author-role { display: none !important; }
                      .ad-modal-author-date { font-size: 11px !important; }
                      .ad-modal-calendar-icon { width: 12px !important; height: 12px !important; }
                      .ad-modal-time-only { display: none !important; }
                      .ad-modal-content-wrapper { padding-left: 0 !important; padding-right: 0 !important; }
                      .ad-body-text-card { border-radius: 0 !important; border-left: none !important; border-right: none !important; }
                    }
                `}} />
                
                <div className="ad-modal-author-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 3, width: '100%', paddingRight: 70 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div className="ad-modal-avatar-wrapper">
                        <UserAvatar userId={selectedComunicado.autorId} name={selectedComunicado.autor} fotoUrl={selectedComunicado.autorFoto} size={44} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="ad-modal-author-name" style={{ fontWeight: 800, fontSize: 16, color: '#ffffff', letterSpacing: -0.3, textShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>{selectedComunicado.autor}</div>
                        <div className="ad-modal-author-role" style={{ fontSize: 13, color: '#c7d2fe', fontWeight: 600 }}>{selectedComunicado.autorCargo}</div>
                      </div>
                    </div>
                    
                    <div className="ad-modal-author-date" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e0e7ff', fontSize: 13, fontWeight: 500, textAlign: 'right' }}>
                      <Calendar className="ad-modal-calendar-icon" size={14} color="#c7d2fe" />
                      <span>
                         <span className="ad-modal-date-only">{new Date(selectedComunicado.dataEnvio || (selectedComunicado as any).created_at || new Date()).toLocaleString('pt-BR', { dateStyle: 'short' })}</span>
                         <span className="ad-modal-time-only"> às {new Date(selectedComunicado.dataEnvio || (selectedComunicado as any).created_at || new Date()).toLocaleString('pt-BR', { timeStyle: 'short' })}</span>
                      </span>
                    </div>
                </div>
                  
                <div className="ad-modal-megaphone" style={{ fontSize: 72, position: 'absolute', right: -10, bottom: 0, opacity: 0.95, filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.3))' }}>📣</div>
              </div>

              {/* Decorative shapes */}
              <div style={{ position: 'absolute', top: -30, right: -20, width: 200, height: 200, background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%)', borderRadius: '50%', zIndex: 1 }} />
              <div style={{ position: 'absolute', bottom: -50, left: -50, width: 150, height: 150, background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)', borderRadius: '50%', zIndex: 1 }} />
            </div>

            <div className="ad-modal-content-wrapper" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                
              {/* Message Content */}
              <div className="ad-body-text-card" style={{ border: '1px solid #f1f5f9', borderRadius: 20, padding: '24px', background: '#ffffff', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                <div className="ad-body-text" style={{ fontSize: 16, lineHeight: 1.6, color: '#0f172a', whiteSpace: 'pre-wrap', fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: selectedComunicado.conteudo.replace(/\n/g, '<br/>') }}>
                </div>
              </div>

              {/* Attachments Section */}
              {selectedComunicado.anexos && selectedComunicado.anexos.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Paperclip size={20} color="#6d28d9" />
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Anexos e Documentos Disponíveis
                    </h4>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {selectedComunicado.anexos.map((anexo: string, idx: number) => {
                      const parsed = parseAnexo(anexo)
                      if (!parsed) return null
                      
                      const isForm = parsed.name.startsWith('Formulário:')
                      const isRel = parsed.name.startsWith('Relatório:')
                      const isImg = parsed.url.startsWith('data:image/') || parsed.mime.startsWith('image/') || parsed.name.toLowerCase().endsWith('.png') || parsed.name.toLowerCase().endsWith('.jpg') || parsed.name.toLowerCase().endsWith('.jpeg') || parsed.name.toLowerCase().endsWith('.webp') || parsed.name.toLowerCase().endsWith('.gif')
                      const isVid = parsed.mime.startsWith('video/') || parsed.url.includes('.mov') || parsed.url.includes('.mp4') || parsed.name.toLowerCase().endsWith('.mov') || parsed.name.toLowerCase().endsWith('.mp4')
                      
                      const fileExt = parsed.name.split('.').pop()?.toUpperCase() || 'FILE'
                      
                      return (
                        <div key={idx} style={{ 
                          padding: (isImg || isVid) ? 0 : '16px', 
                          background: (isImg || isVid) ? 'transparent' : '#f8fafc', 
                          borderRadius: 20, 
                          border: (isImg || isVid) ? 'none' : '1px solid #f1f5f9', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          gap: 16, 
                          cursor: 'pointer', 
                          flexWrap: 'wrap', 
                          overflow: 'hidden' 
                        }} onClick={() => {
                                if (isForm || isRel) setOpenedFormStr(anexo)
                                else if (isImg) setMaximizedImageStr(parsed.url)
                                else if (isVid) setMaximizedVideoStr(parsed.url)
                                else handleDownload(anexo)
                              }}>
                          
                          {!(isImg || isVid) && (
                            <div className="ad-attachment-info" style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1, minWidth: 200 }}>
                              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#6366f1', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                                 <FileText size={20} style={{ marginBottom: 2 }} />
                                 <span style={{ fontSize: 9, fontWeight: 800 }}>{fileExt.substring(0, 3)}</span>
                              </div>
                              <div>
                                 <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 4, wordBreak: 'break-all' }}>{parsed.name.replace(/^(Formulário:|Relatório:)\s*/, '')}</div>
                                 <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{isForm ? 'Formulário' : isRel ? 'Relatório' : 'Documento'} • Clique para abrir</div>
                              </div>
                            </div>
                          )}

                          {(isImg || isVid) && (
                              <div style={{ width: '100%', borderRadius: 20, overflow: 'hidden', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: 600, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)' }}>
                                {isImg ? (
                                   <Image src={parsed.url} alt={parsed.name} width={800} height={600} style={{ width: '100%', height: 'auto', maxHeight: 600, objectFit: 'contain', display: 'block' }} />
                                ) : (
                                   <video src={parsed.url} style={{ width: '100%', maxHeight: 600, objectFit: 'contain', display: 'block' }} preload="metadata" />
                                )}
                                {(isImg || isVid) && (
                                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}>
                                    {isVid && (
                                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: 4 }}>
                                          <path d="M8 5V19L19 12L8 5Z" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                          )}

                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {selectedComunicado.exigeCiencia && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ 
                    background: !!(selectedComunicado.ciencias || {})[userSlug] ? 'linear-gradient(to right, rgba(34,197,94,0.05), rgba(34,197,94,0.02))' : 'linear-gradient(to right, rgba(99,102,241,0.05), rgba(99,102,241,0.02))', 
                    padding: '20px 24px', 
                    borderRadius: 20,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: !!(selectedComunicado.ciencias || {})[userSlug] ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(99,102,241,0.2)',
                    flexWrap: 'wrap',
                    gap: 16
                  }}>
                    <div style={{ fontSize: 14, color: !!(selectedComunicado.ciencias || {})[userSlug] ? '#15803d' : '#4338ca', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                      {!!(selectedComunicado.ciencias || {})[userSlug] ? <CheckCircle2 size={24} color="#22c55e" /> : <ShieldAlert size={24} color="#6366f1" />}
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{!!(selectedComunicado.ciencias || {})[userSlug] ? 'Ciência confirmada' : 'Assinatura Eletrônica Necessária'}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2, opacity: 0.8 }}>{!!(selectedComunicado.ciencias || {})[userSlug] ? 'Você já deu ciência neste comunicado oficial.' : 'A escola exige sua confirmação de leitura neste comunicado.'}</div>
                      </div>
                    </div>
                    {!((selectedComunicado.ciencias || {})[userSlug]) && (
                      <button 
                          onClick={(e) => { e.stopPropagation(); handleCiencia(selectedComunicado.id) }} 
                          className="btn" 
                          style={{ background: '#6366f1', color: '#fff', padding: '10px 20px', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 12, boxShadow: '0 8px 16px -4px rgba(99,102,241,0.4)', flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                          Assinar Ciência
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Section */}
              <div style={{ marginTop: 24 }}>
                <ComunicadoChat 
                  comunicadoId={selectedComunicado.id} 
                  remetenteId={userSlug} 
                  remetenteNome={currentUser?.nome || 'Familiar / Aluno'} 
                  remetenteAvatar={currentUser?.foto || (currentUser as any)?.fotoUrl || (currentUser as any)?.foto_url}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
        </Portal>
      )}
      </AnimatePresence>

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
      {showComposer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editComId ? 'Editar Comunicado' : 'Escrever Novo Comunicado'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowComposer(false); setAnexos([]); }}><X size={18} /></button>
            </div>
            
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Para:</div>
                  {!editComId && <button className="btn btn-secondary btn-sm" onClick={() => setShowDestModal(true)}>+ Adicionar Destinatários</button>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: 'hsl(var(--bg-main))', padding: '12px', borderRadius: 8, minHeight: 48, maxHeight: 120, overflowY: 'auto', border: '1px solid hsl(var(--border-subtle))' }}>
                  {selectedDest.length === 0 && <span className="badge badge-ghost text-muted" style={{ padding: '6px 12px' }}>Toda a Escola (Todos os Alunos Ativos)</span>}
                  {selectedDest.map(d => (
                    <span key={d.id} className="badge" style={{ background: d.type === 'turma' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)', color: d.type === 'turma' ? '#4f46e5' : '#10b981', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 13 }}>
                      {d.type === 'turma' ? 'Turma:' : ''} {d.name}
                      {!editComId && <button onClick={() => setSelectedDest(prev => prev.filter(x => x.id !== d.id))} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', display: 'flex', color: 'inherit' }}><X size={14} color="currentColor"/></button>}
                    </span>
                  ))}
                </div>
              </div>
              
              <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.05)', borderRadius: 8, border: '1px dashed rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
                 <UserAvatar userId={currentUser?.id} name={currentUser?.nome || 'U'} size={42} />
                 <div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Remetente Vinculado Automaticamente</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{currentUser?.nome || 'Usuário ERP'} <span style={{ fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>({currentUser?.cargo || currentUser?.perfil || 'Administração'})</span></div>
                 </div>
              </div>
              
              <input className="form-input" placeholder="Título do Comunicado" style={{ fontSize: 16, fontWeight: 600 }} value={newTitulo} onChange={e => setNewTitulo(e.target.value)} />

              {/* Rich Text Editor Simulation */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                border: '1px solid hsl(var(--border-subtle))', 
                borderRadius: 16, 
                overflow: 'hidden',
                background: 'white',
                boxShadow: '0 4px 20px -5px rgba(0,0,0,0.05)',
                flexShrink: 0
              }}>
                <div style={{ 
                  padding: '10px 16px', 
                  background: '#f8fafc', 
                  borderBottom: '1px solid hsl(var(--border-subtle))', 
                  display: 'flex', 
                  gap: 8,
                  alignItems: 'center'
                }}>
                   <button onClick={() => { document.execCommand('bold', false); comunicadoRichEditorRef.current?.focus(); }} className="btn btn-ghost btn-sm" style={{ padding: 8, height: 32, width: 32, borderRadius: 8 }} title="Negrito"><Bold size={16}/></button>
                   <button onClick={() => { document.execCommand('italic', false); comunicadoRichEditorRef.current?.focus(); }} className="btn btn-ghost btn-sm" style={{ padding: 8, height: 32, width: 32, borderRadius: 8 }} title="Itálico"><Italic size={16}/></button>
                   <button onClick={() => { document.execCommand('underline', false); comunicadoRichEditorRef.current?.focus(); }} className="btn btn-ghost btn-sm" style={{ padding: 8, height: 32, width: 32, borderRadius: 8 }} title="Sublinhado"><Underline size={16}/></button>
                   <div style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />
                   <button onClick={() => { document.execCommand('insertUnorderedList', false); comunicadoRichEditorRef.current?.focus(); }} className="btn btn-ghost btn-sm" style={{ padding: 8, height: 32, width: 32, borderRadius: 8 }} title="Lista"><List size={16}/></button>
                   <button onClick={() => { 
                     const url = prompt('Digite o link:'); 
                     if(url) document.execCommand('createLink', false, url); 
                     comunicadoRichEditorRef.current?.focus(); 
                   }} className="btn btn-ghost btn-sm" style={{ padding: 8, height: 32, width: 32, borderRadius: 8 }} title="Link"><LinkIcon size={16}/></button>
                   <div style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />
                   <div style={{ position: 'relative' }}>
                      <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="btn btn-ghost btn-sm" style={{ padding: 8, height: 32, width: 32, borderRadius: 8 }} title="Emoji"><Smile size={16}/></button>
                      {showEmojiPicker && (
                        <div style={{ position: 'absolute', top: 40, left: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, zIndex: 100 }}>
                          {EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => { document.execCommand('insertText', false, emoji); setShowEmojiPicker(false); comunicadoRichEditorRef.current?.focus(); }} style={{ background: 'transparent', border: 0, fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 6 }}>
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                   </div>
                </div>

                <div 
                  ref={comunicadoRichEditorRef}
                  contentEditable
                  className="wysiwyg-editor"
                  style={{ 
                    minHeight: 150, 
                    maxHeight: 350,
                    padding: '16px 20px', 
                    outline: 'none', 
                    fontSize: 15, 
                    lineHeight: 1.6,
                    overflowY: 'auto',
                    color: '#334155'
                  }}
                  onInput={e => setNewConteudo(e.currentTarget.innerHTML)}
                />

                {anexos.length > 0 && (
                  <div style={{ 
                    padding: '12px 16px', 
                    display: 'flex', 
                    gap: 12, 
                    flexWrap: 'wrap', 
                    borderTop: '1px solid #f1f5f9', 
                    background: '#f8fafc',
                    maxHeight: 180,
                    overflowY: 'auto'
                  }}>
                    {anexos.map((anexo, i) => {
                      const parts = typeof anexo === 'string' ? anexo.split('|') : [String(anexo)];
                      const name = parts[0];
                      const url = parts[1];
                      const mimeType = parts[2] || '';
                      const isImg = mimeType.startsWith('image/') || (url && url.startsWith('data:image')) || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
                      const isVid = mimeType.startsWith('video/') || (url && url.startsWith('data:video')) || /\.(mp4|webm|ogg|mov)$/i.test(name);

                      return (
                        <div key={i} style={{ position: 'relative', width: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                           <div style={{ width: 80, height: 80, borderRadius: 12, border: '1px solid #e2e8f0', background: 'white', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative' }}>
                              {isImg ? (
                                <Image src={url} alt="Capa" width={80} height={80} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : isVid ? (
                                <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                   <div style={{ width: 24, height: 24, borderRadius: 12, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid white', marginLeft: 2 }} />
                                   </div>
                                </div>
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                                  <FileText size={24} color="#64748b" />
                                </div>
                              )}
                              
                              <button 
                                onClick={() => setAnexos(anexos.filter(a => a !== anexo))}
                                style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }}
                              >
                                <X size={14} strokeWidth={3} />
                              </button>
                           </div>
                           <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        </div>
                      );
                    })}
                    
                    {isUploading && (
                      <div style={{ width: 80, height: 80, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                         <div style={{ width: 24, height: 24, borderRadius: 12, border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', animation: 'spin 1s linear infinite' }} />
                         <span style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5' }}>{uploadProgress}%</span>
                      </div>
                    )}
                  </div>
                )}
                
                {!anexos.length && isUploading && (
                  <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
                     <div style={{ width: 20, height: 20, borderRadius: 10, border: '2px solid #e2e8f0', borderTopColor: '#4f46e5', animation: 'spin 1s linear infinite' }} />
                     <span style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5' }}>Processando mídia... {uploadProgress}%</span>
                  </div>
                )}
              </div>

               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
                 <label className="btn" style={{ 
                   cursor: 'pointer', background: 'rgba(99, 102, 241, 0.05)', color: '#4f46e5', border: '1px solid rgba(99, 102, 241, 0.2)', height: 40, borderRadius: 12, padding: '0 16px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' 
                 }}>
                   <Paperclip size={16} /> Anexar Arquivo
                   <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" hidden onChange={async e => { 
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      
                      const MAX_SIZE = 50 * 1024 * 1024;
                      if (file.size > MAX_SIZE) {
                        adAlert('Arquivo muito grande. O limite é 50MB.', 'Erro');
                        return;
                      }

                      setIsUploading(true);
                      setUploadProgress(5);

                      try {
                        // 1. Obter URL assinada
                        let fileToUpload: File = file;

                        if (file.type.startsWith('image/')) {
                          setUploadProgress(10);
                          fileToUpload = await compressImage(file, { quality: 0.80, format: 'image/webp' });
                          setUploadProgress(40);
                        } else if (file.type.startsWith('video/')) {
                          setUploadProgress(5);
                          fileToUpload = await compressVideo(file, (percent) => {
                            const scaled = Math.round(5 + (percent * 0.45));
                            setUploadProgress(scaled);
                          }) as File;
                        }

                        setUploadProgress(60);

                        // Upload centralizado com Cache-Control
                        const uploadRes = await uploadFileToSupabase({
                          bucket: 'comunicados-midia',
                          file: fileToUpload,
                          usageType: 'common'
                        });

                        if (!uploadRes.ok || !uploadRes.url) {
                          console.error('[upload-midia]', uploadRes.error);
                          adAlert(uploadRes.error || 'Erro no envio direto do arquivo.', 'Erro de Conexão');
                          setIsUploading(false);
                          setUploadProgress(0);
                          return;
                        }

                        setUploadProgress(100);
                        setAnexos(prev => [...prev, `${fileToUpload.name}|${uploadRes.url}|${fileToUpload.type}`]);
                        setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 700);
                      } catch (err: any) {
                        adAlert('Erro inesperado: ' + (err?.message || ''), 'Erro');
                        setIsUploading(false);
                        setUploadProgress(0);
                      }
                    }} />
                 </label>

                 <button className="btn" style={{ 
                   background: 'rgba(139, 92, 246, 0.05)', color: '#7c3aed', border: '1px solid rgba(139, 92, 246, 0.2)', height: 40, borderRadius: 12, padding: '0 16px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' 
                 }} onClick={() => setShowFormsModal(true)}>
                   <FileText size={16} /> Formulário
                 </button>

                 <button className="btn" style={{ 
                   background: 'rgba(236, 72, 153, 0.05)', color: '#db2777', border: '1px solid rgba(236, 72, 153, 0.2)', height: 40, borderRadius: 12, padding: '0 16px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' 
                 }} onClick={() => setShowRelsModal(true)}>
                   <FileBarChart size={16} /> Relatório
                 </button>

                 <button className="btn" style={{ 
                   background: 'rgba(16, 185, 129, 0.05)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.2)', height: 40, borderRadius: 12, padding: '0 16px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' 
                 }} onClick={() => setShowCobrancaModal(true)}>
                   <BadgeDollarSign size={16} /> Nova Cobrança
                 </button>
               </div>
            </div>

            <div style={{ padding: '24px 32px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 24px 24px' }}>
              <button className="btn btn-ghost" onClick={() => handleEnviar(true)} style={{ fontWeight: 700, color: '#64748b' }}>Salvar Rascunho</button>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button 
                  type="button"
                  className="btn" 
                  onClick={() => {
                    if (dataAgendamento) {
                      setTempDataAgendamento(dataAgendamento);
                    } else {
                      const nowLocal = new Date();
                      nowLocal.setHours(nowLocal.getHours() + 24);
                      const localString = nowLocal.getFullYear() + '-' + 
                        String(nowLocal.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(nowLocal.getDate()).padStart(2, '0') + 'T' + 
                        String(nowLocal.getHours()).padStart(2, '0') + ':' + 
                        String(nowLocal.getMinutes()).padStart(2, '0');
                      setTempDataAgendamento(localString);
                    }
                    setShowScheduleModal(true);
                  }} 
                  style={{ 
                    height: 40, 
                    borderRadius: 10, 
                    fontWeight: 700, 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8, 
                    border: '1px solid ' + (dataAgendamento ? 'rgba(79, 70, 229, 0.3)' : 'hsl(var(--border-subtle))'),
                    background: dataAgendamento ? 'rgba(79, 70, 229, 0.05)' : 'white',
                    color: dataAgendamento ? '#4f46e5' : '#64748b',
                    padding: '0 16px',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  <Clock size={16} /> 
                  {dataAgendamento ? (
                    (() => {
                      try {
                        const d = new Date(dataAgendamento);
                        return `Agendado: ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                      } catch (e) {
                        return 'Agendado';
                      }
                    })()
                  ) : 'Agendar Envio'}
                </button>
                <button 
                  className="btn btn-primary" 
                  disabled={isUploading}
                  style={{ 
                    height: 40, 
                    padding: '0 24px', 
                    borderRadius: 10, 
                    fontWeight: 800, 
                    gap: 8, 
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                    opacity: isUploading ? 0.6 : 1,
                    cursor: isUploading ? 'not-allowed' : 'pointer'
                  }} 
                  onClick={() => handleEnviar(false)}
                >
                   {isUploading ? (
                     <div style={{ width: 16, height: 16, borderRadius: 8, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
                   ) : <SendIcon size={16} />}
                   {isUploading ? 'Processando...' : dataAgendamento ? 'Agendar' : editComId ? 'Salvar Alterações' : 'Enviar Comunicado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="card" style={{ width: 480, padding: 24, boxShadow: '0 40px 100px rgba(0,0,0,0.4)', borderRadius: 20 }}>
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
                    setNewConteudo(p => p + txtCob)
                        
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
        onAdd={(text, payload) => setAnexos(prev => [...prev, `${text}|payload:${JSON.stringify(payload)}|report-payload`])} 
      />

      <AnimatePresence>
        {/* Forms Selection Modal */}
        {showFormsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="card" style={{ width: '100%', maxWidth: 550, padding: 40, borderRadius: 40, boxShadow: '0 50px 100px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)', position: 'relative' }}>
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
                    onClick={() => { setAnexos(prev => [...prev, `Formulário: ${f.name}`]); setShowFormsModal(false) }}
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
        @media (max-width: 640px) {
          .mobile-content-wrapper { padding-left: 0 !important; padding-right: 0 !important; }
        }
      `}</style>
    </div>
  )
}
