'use client'
import { motion, AnimatePresence } from 'framer-motion';

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { Bell, Search, Filter, Pin, CheckCircle2, X, Paperclip, FileText, FileBarChart, DollarSign, Image as ImageIcon, Video, ShieldAlert } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { UserAvatar } from '@/components/UserAvatar'
import { use, useState } from 'react'
import { useFormularios, FormTemplate } from '@/lib/formulariosContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData } from '@/lib/dataContext'

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
    return { label: 'Formulário', icon: <FileText size={13} color="#3b82f6" />, color: 'rgba(59,130,246,0.08)', textColor: '#3b82f6' };
  }
  if (name.startsWith('Relatório:')) {
    return { label: 'Relatório', icon: <FileBarChart size={13} color="#8b5cf6" />, color: 'rgba(139,92,246,0.08)', textColor: '#8b5cf6' };
  }
  if (name.toLowerCase().includes('cobrança') || name.toLowerCase().includes('boleto')) {
    return { label: 'Cobrança', icon: <DollarSign size={13} color="#ef4444" />, color: 'rgba(239,68,68,0.08)', textColor: '#ef4444' };
  }
  
  const isImg = url.startsWith('data:image/') || mime.startsWith('image/') || name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg') || name.toLowerCase().endsWith('.webp') || name.toLowerCase().endsWith('.gif');
  if (isImg) {
    return { label: 'Foto', icon: <ImageIcon size={13} color="#10b981" />, color: 'rgba(16,185,129,0.08)', textColor: '#10b981' };
  }
  
  const isVid = mime.startsWith('video/') || url.includes('.mov') || url.includes('.mp4') || name.toLowerCase().endsWith('.mov') || name.toLowerCase().endsWith('.mp4');
  if (isVid) {
    return { label: 'Vídeo', icon: <Video size={13} color="#f59e0b" />, color: 'rgba(245,158,11,0.08)', textColor: '#f59e0b' };
  }
  
  return { label: 'Anexo', icon: <Paperclip size={13} color="#64748b" />, color: 'rgba(100,116,139,0.08)', textColor: '#64748b' };
};

export default function ADComunicadosPage({ params }: { params: Promise<{ slug: string }>}) {
  const { adAlert } = useAgendaDigital()
  const { forms, setSubmissions, setDisparos, submissions } = useFormularios()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  
  const { aluno } = useSelectedStudent()
  const { turmas = [] } = useData()
  const rawTurma = aluno?.turma
  const turmaObj = turmas.find((t: any) => String(t.id) === String(rawTurma) || String(t.codigo) === String(rawTurma))
  const turmaNome = turmaObj?.nome || rawTurma

  // Generate the precise endpoint to fetch only this student's and class's announcements
  const endpoint = aluno?.id ? `comunicados?aluno_id=${aluno.id}&turma_id=${encodeURIComponent(turmaNome || '')}` : 'comunicados?limit=0'
  const [comunicados, setComunicados, { loading }] = useSupabaseArray<any>(endpoint)

  const [selectedComunicado, setSelectedComunicado] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [openedFormStr, setOpenedFormStr] = useState<string | null>(null)
  const [maximizedImageStr, setMaximizedImageStr] = useState<string | null>(null)
  const [formResp, setFormResp] = useState<Record<string, any>>({})
  const openedFormObj: FormTemplate | undefined = forms.find(x => x.name === openedFormStr?.replace('Formulário: ', ''))

  const previousSubmission = openedFormObj 
    ? submissions.find(sub => sub.formId === openedFormObj.id && sub.studentName === resolvedParams.slug)
    : null;
  const hasResponded = !!previousSubmission;

  
  const handleCiencia = (comunicadoId: string) => {
    setComunicados(prev => prev.map(c => {
      if (c.id === comunicadoId) {
        return { ...c, ciencias: { ...(c.ciencias || {}), [resolvedParams.slug]: new Date().toISOString() } }
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
    <div style={{ position: 'relative', minHeight: '85vh', padding: '32px', margin: '-32px', borderRadius: '32px', overflow: 'hidden', background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 210, 255, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(0, 210, 255, 0); }
        }
        @keyframes flowLine {
          0% { background-position: 0% 0%; }
          100% { background-position: 0% 200%; }
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
        .ad-mobile-search-container {
          display: none !important;
        }
        @media (max-width: 768px) {
          .ad-com-filter-btn { display: none !important; }
          .ad-com-actions { width: 100% !important; justify-content: flex-end !important; }
          .ad-com-search { width: 100% !important; justify-content: flex-end !important; }
          .ad-com-search input { width: 100% !important; max-width: 100% !important; }
          
          .ad-mobile-search-container {
            display: block !important;
          }
          .ad-mobile-search-container input:focus {
            outline: none !important;
            border-color: #6366f1 !important;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15), 0 8px 32px rgba(99, 102, 241, 0.08) !important;
            background: #ffffff !important;
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

      {/* Floating Animated Icons with Neon glow drop-shadow */}
      <div style={{ position: 'absolute', top: '12%', left: '5%', opacity: 0.5, animation: 'floatBg 7s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }}>
        <Bell size={48} color="#00D2FF" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,210,255,0.4))' }} />
      </div>
      <div style={{ position: 'absolute', top: '40%', right: '4%', opacity: 0.45, animation: 'floatBg 9s ease-in-out infinite 1s', pointerEvents: 'none', zIndex: 0 }}>
        <FileText size={52} color="#FF0080" style={{ filter: 'drop-shadow(0 4px 12px rgba(255,0,128,0.4))' }} />
      </div>
      <div style={{ position: 'absolute', bottom: '20%', left: '7%', opacity: 0.5, animation: 'floatBg 8s ease-in-out infinite 0.5s', pointerEvents: 'none', zIndex: 0 }}>
        <CheckCircle2 size={44} color="#10b981" style={{ filter: 'drop-shadow(0 4px 12px rgba(16,185,129,0.4))' }} />
      </div>
      <div style={{ position: 'absolute', top: '78%', right: '8%', opacity: 0.45, animation: 'floatBg 10s ease-in-out infinite 2s', pointerEvents: 'none', zIndex: 0 }}>
        <Pin size={38} color="#f59e0b" style={{ transform: 'rotate(45deg)', filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.4))' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="ad-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
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
              <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', margin: 0, background: 'linear-gradient(135deg, #0f172a 40%, #6366f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.02))' }}>Comunicados</h2>
              <p style={{ fontSize: 13, color: '#475569', margin: '2px 0 0 0', fontWeight: 500 }}>Avisos pedagógicos e informações oficiais <span className="ad-text-hide-mobile">do colégio</span></p>
            </div>
          </div>
          
          <div className="ad-com-actions" style={{ display: 'flex', gap: 12 }}>
            <div className="ad-com-search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: 14, color: '#6366f1' }} />
              <input 
                className="form-input" 
                placeholder="Buscar comunicados..." 
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
          </div>
        </div>

      {/* Mobile-only Search Bar */}
      <div className="ad-mobile-search-container" style={{ marginBottom: 24, padding: '0 16px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: 16, color: '#6366f1' }} />
          <input 
            className="form-input" 
            placeholder="Buscar comunicados..." 
            style={{
              paddingLeft: 44,
              paddingRight: 40,
              width: '100%',
              height: 48,
              borderRadius: 16,
              border: '1px solid rgba(99, 102, 241, 0.15)',
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(99, 102, 241, 0.06)',
              fontSize: 14,
              fontWeight: 500,
              color: '#0f172a',
              transition: 'all 0.3s'
            }} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: 16,
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4
              }}
            >
              <X size={16} />
            </button>
          )}
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
          });
          
          if (loading || !aluno) {
            return [1, 2, 3].map((idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              style={{ display: 'flex', position: 'relative', paddingBottom: 32 }}
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
            
            const isRead = !!(c.leituras || {})[resolvedParams.slug];
            const isCiencia = !!(c.ciencias || {})[resolvedParams.slug];

            return (
              <motion.div 
                key={c.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{ display: 'flex', position: 'relative', paddingBottom: index !== (comunicados || []).length - 1 ? 32 : 0 }}
              >
                {/* Timeline Laser Connector */}
                {index !== filteredComunicados.length - 1 && (
                  <div className="ad-com-timeline-line" style={{ 
                    position: 'absolute', 
                    top: 48, 
                    bottom: -24, 
                    left: 88, 
                    width: 2, 
                    background: isRead 
                      ? 'linear-gradient(to bottom, rgba(99,102,241,0.08) 50%, rgba(99,102,241,0.02) 100%)' 
                      : 'linear-gradient(180deg, transparent, #00d2ff, #ff0080, transparent)',
                    backgroundSize: '100% 200%',
                    animation: isRead ? 'none' : 'flowLine 2.5s linear infinite',
                    zIndex: 0,
                    borderRadius: 2
                  }} />
                )}
                
                {/* Ultra-Modern Minimalist Date Node */}
                <div className="ad-com-timeline-node" style={{ 
                  marginRight: 32, 
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
                    background: isRead ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #00d2ff, #ff0080)', 
                    border: '3px solid #f8fafc',
                    boxShadow: isRead 
                      ? '0 0 0 1px rgba(0,0,0,0.05)' 
                      : '0 0 0 4px rgba(0,210,255,0.15), 0 0 16px rgba(0,210,255,0.6)',
                    animation: isRead ? 'none' : 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
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
                      setComunicados(prev => prev.map(x => x.id === c.id ? { ...x, leituras: { ...(x.leituras || {}), [resolvedParams.slug]: new Date().toISOString() } } : x))
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
                      <UserAvatar userId={c.autorId} name={c.autor} size={62} />
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

                  {/* Attachments Section */}
                  {c.anexos && c.anexos.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {c.anexos.map((anexo: string, idx: number) => {
                        const typeInfo = getAnexoType(anexo);
                        if (!typeInfo) return null;
                        return (
                          <span key={idx} className="badge" style={{ 
                             background: typeInfo.color, 
                             color: typeInfo.textColor, 
                             fontSize: '12px', 
                             fontWeight: 600, 
                             display: 'inline-flex', 
                             gap: 6, 
                             alignItems: 'center', 
                             padding: '6px 12px', 
                             borderRadius: '8px', 
                             border: `1px solid ${typeInfo.textColor}2a`,
                             transition: 'background 0.2s'
                          }}>
                            {typeInfo.icon}
                            {typeInfo.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

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
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setSelectedComunicado(null)}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="ad-modal-container" style={{ background: '#ffffff', borderRadius: 28, width: '100%', maxWidth: 740, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            
            {/* Header Section */}
            <div style={{ background: 'linear-gradient(to bottom, #f8fafc, #ffffff)', padding: '32px 40px 24px 40px', borderBottom: '1px solid rgba(0,0,0,0.04)', position: 'relative' }}>
              <button className="btn btn-secondary btn-sm" style={{ position: 'absolute', top: 24, right: 24, width: 36, height: 36, padding: 0, borderRadius: '50%', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedComunicado(null)}>
                <X size={18} color="#64748b" />
              </button>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                {selectedComunicado.prioridade === 'alta' && <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Prioridade Alta</span>}
                {selectedComunicado.prioridade === 'urgente' && <span className="badge" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>Urgente</span>}
                <span className="badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>Comunicado Oficial</span>
              </div>

              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 24, color: '#0f172a', lineHeight: 1.2, letterSpacing: -0.5 }}>
                {selectedComunicado.titulo}
              </h2>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <UserAvatar userId={selectedComunicado.autorId} name={selectedComunicado.autor} size={56} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>{selectedComunicado.autor}</div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{selectedComunicado.autorCargo} • {new Date(selectedComunicado.dataEnvio || (selectedComunicado as any).created_at || new Date()).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => window.print()} title="Imprimir" style={{ padding: '8px 12px', background: '#ffffff', borderColor: '#e2e8f0', color: '#475569' }}>
                    <FileText size={16} /> Imprimir
                  </button>
                </div>
              </div>
            </div>
            
            {/* Content Section */}
            <div style={{ padding: '32px 40px', overflowY: 'auto', flex: 1, background: '#ffffff' }}>
              <div className="ad-body-text" style={{ fontSize: 16, lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap' }}>
                {renderConteudo(selectedComunicado.conteudo)}
              </div>

              {selectedComunicado.anexos && selectedComunicado.anexos.length > 0 && (
                <div style={{ marginTop: 40 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800, margin: '0 0 16px 0', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Anexos e Documentos Disponíveis
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {selectedComunicado.anexos.map((anexo: string, idx: number) => {
                      const parsed = parseAnexo(anexo)
                      if (!parsed) return null
                      
                      const isForm = parsed.name.startsWith('Formulário:')
                      const isRel = parsed.name.startsWith('Relatório:')
                      const isImg = parsed.url.startsWith('data:image/') || parsed.mime.startsWith('image/') || parsed.name.toLowerCase().endsWith('.png') || parsed.name.toLowerCase().endsWith('.jpg') || parsed.name.toLowerCase().endsWith('.jpeg') || parsed.name.toLowerCase().endsWith('.webp') || parsed.name.toLowerCase().endsWith('.gif')
                      const isVid = parsed.mime.startsWith('video/') || parsed.url.includes('.mov') || parsed.url.includes('.mp4') || parsed.name.toLowerCase().endsWith('.mov') || parsed.name.toLowerCase().endsWith('.mp4')
                      
                      return (
                        <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Paperclip size={18} color="#6366f1" />
                              <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                                {parsed.name.replace(/^(Formulário:|Relatório:)\s*/, '')}
                              </span>
                            </div>
                            {!isImg && !isVid && (
                              <button className="btn btn-secondary btn-sm" style={{ padding: '6px 14px', fontSize: '12px', borderRadius: 8 }} onClick={() => {
                                if (isForm || isRel) setOpenedFormStr(anexo)
                                else handleDownload(anexo)
                              }}>
                                {isForm ? 'Abrir Formulário' : isRel ? 'Visualizar Relatório' : 'Baixar'}
                              </button>
                            )}
                          </div>
                          
                          {/* If Image, show it completely OPENED */}
                          {isImg && (
                            <div 
                              style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f1f5f9', display: 'flex', justifyContent: 'center', cursor: 'zoom-in', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative' }} 
                              onClick={() => setMaximizedImageStr(parsed.url)}
                              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                            >
                              <img src={parsed.url} alt={parsed.name} style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} />
                              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                                Maximizar
                              </div>
                            </div>
                          )}
                          
                          {/* If Video, show it completely OPENED and playable */}
                          {isVid && (
                            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: 'black', marginTop: 12 }}>
                              <video src={parsed.url} controls style={{ width: '100%', display: 'block', maxHeight: '400px' }} />
                            </div>
                          )}

                          {/* If Form or Report, show a modern button/action cards */}
                          {(isForm || isRel) && (
                            <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: 4, color: '#0f172a' }}>
                                  {isForm ? '📝 Responder Formulário Eletrônico' : '📊 Visualizar Relatório de Desempenho'}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                  {isForm ? 'Clique ao lado para preencher a resposta e enviar para a secretaria da escola.' : 'Clique ao lado para carregar e revisar o relatório pedagógico.'}
                                </div>
                              </div>
                              <button className="btn btn-primary btn-sm" style={{ padding: '8px 16px', flexShrink: 0, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8 }} onClick={() => setOpenedFormStr(anexo)}>
                                {isForm ? 'Responder' : 'Visualizar'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {selectedComunicado.exigeCiencia && (
                <div style={{ marginTop: 40, borderTop: '1px solid #f1f5f9', paddingTop: 32 }}>
                  <div style={{ 
                    background: !!(selectedComunicado.ciencias || {})[resolvedParams.slug] ? 'linear-gradient(to right, rgba(34,197,94,0.05), rgba(34,197,94,0.02))' : 'linear-gradient(to right, rgba(99,102,241,0.05), rgba(99,102,241,0.02))', 
                    padding: '20px 24px', 
                    borderRadius: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: !!(selectedComunicado.ciencias || {})[resolvedParams.slug] ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(99,102,241,0.2)',
                  }}>
                    <div style={{ fontSize: 14, color: !!(selectedComunicado.ciencias || {})[resolvedParams.slug] ? '#15803d' : '#4338ca', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                      {!!(selectedComunicado.ciencias || {})[resolvedParams.slug] ? <CheckCircle2 size={24} color="#22c55e" /> : <ShieldAlert size={24} color="#6366f1" />}
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{!!(selectedComunicado.ciencias || {})[resolvedParams.slug] ? 'Ciência confirmada' : 'Assinatura Eletrônica Necessária'}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2, opacity: 0.8 }}>{!!(selectedComunicado.ciencias || {})[resolvedParams.slug] ? 'Você já deu ciência neste comunicado oficial.' : 'A escola exige sua confirmação de leitura neste comunicado.'}</div>
                      </div>
                    </div>
                    {!((selectedComunicado.ciencias || {})[resolvedParams.slug]) && (
                      <button 
                          onClick={(e) => { e.stopPropagation(); handleCiencia(selectedComunicado.id) }} 
                          className="btn" 
                          style={{ background: '#6366f1', color: '#fff', padding: '10px 20px', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 12, boxShadow: '0 8px 16px -4px rgba(99,102,241,0.4)' }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                          Assinar Ciência
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
{/* Formulário/Relatório Simulado */}
      {openedFormStr && (
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
)}      </AnimatePresence>

      <AnimatePresence>
        {/* Modal de Imagem Maximizada */}
        {maximizedImageStr && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }} onClick={() => setMaximizedImageStr(null)}>
            <button className="btn btn-secondary" style={{ position: 'absolute', top: 24, right: 24, width: 48, height: 48, padding: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }} onClick={(e) => { e.stopPropagation(); setMaximizedImageStr(null); }}>
              <X size={24} />
            </button>
            <motion.img 
              src={maximizedImageStr} 
              initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.8, opacity:0}} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: 16, boxShadow: '0 32px 128px rgba(0,0,0,0.6)' }} 
              onClick={e => e.stopPropagation()} 
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}
