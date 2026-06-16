'use client'
// Last Update: 2026-05-16T16:08:00Z - Forced Rebuild
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useAgendaDigital, ADComunicado } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { useFormularios } from '@/lib/formulariosContext'
import { useRelatorios } from '@/lib/relatoriosContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { 
  Bell, Search, Plus, Filter, Pin, FileText, CheckCircle2, XCircle, 
  Send as SendIcon, Clock, Paperclip, MoreHorizontal, X,
  Bold, Italic, Link as LinkIcon, List, Underline, BadgeDollarSign, Smile, FileBarChart,
  ClipboardList, BookOpen, GraduationCap, Calendar, Users, User, MessageSquare, Layout, FileCheck, Menu, Loader2
} from 'lucide-react'
import { DestinatariosModal } from '../../components/agenda/DestinatariosModal'
import NovoComunicadoModal from '../../components/agenda/NovoComunicadoModal'
import { ReportsSelectionModal } from '@/components/agenda/ReportsSelectionModal'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { createPortal } from 'react-dom';
import { UserAvatar } from '@/components/UserAvatar'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { ReportPayloadView } from '@/components/DynamicReports/ReportPayloadView'

const ClientPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
};

export default function ADAdminComunicados() {
  const { currentUser } = useApp()
  const { comunicados, setComunicados, setComunicadosLocally, adAlert, adConfirm, isDataLoading } = useAgendaDigital()
  const { turmas = [] } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos/lightweight');
  const { forms, setDisparos } = useFormularios()
  const { templates: relatoriosTemplates } = useRelatorios()
  
  const alunosAtivos = (alunos || []).filter(a => a.status === 'matriculado' || a.status === 'ativo')

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
  const [selectedCom, setSelectedCom] = useState<ADComunicado | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const [selectedDest, setSelectedDest] = useState<{id: string, name: string, type: 'turma' | 'funcionario' | 'aluno'}[]>([])
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

  const [editComId, setEditComId] = useState<string | null>(null)
  const [viewingCom, setViewingCom] = useState<ADComunicado | null>(null)
  const [viewingReportPayload, setViewingReportPayload] = useState<any>(null)
  const [activePreviewStudent, setActivePreviewStudent] = useState<any>(null)
  const [viewingDestCom, setViewingDestCom] = useState<ADComunicado | null>(null)
  
  const [authorFilter, setAuthorFilter] = useState<string>('todos');
  const [attachmentFilter, setAttachmentFilter] = useState<string>('todos');
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);

  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    setVisibleCount(10);
  }, [tab, search, authorFilter, attachmentFilter]);

  useEffect(() => {
    if (viewingCom || viewingDestCom || viewingReportPayload || selectedCom) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; }
  }, [viewingCom, viewingDestCom, viewingReportPayload, selectedCom]);

  // Extração Dinâmica de Autores e Cargos
  const availableRoles = Array.from(new Set(comunicados.map(c => c.autorCargo || (c as any).dados?.autorCargo).filter(Boolean))) as string[];
  const availableAuthors = Array.from(new Set(comunicados.map(c => c.autor || (c as any).dados?.autor).filter(Boolean))) as string[];

  
  
  const handleEnviar = (data: any, asRascunho = false) => {
    const { titulo, conteudo, anexos, dataAgendamento } = data;
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
        dataAgendamento: dataAgendamento || null,
        status: (asRascunho ? 'rascunho' : dataAgendamento ? 'agendado' : 'enviado') as 'rascunho' | 'agendado' | 'enviado',
        turmas: selectedDest.filter(d => d.type === 'turma').map(d => d.name),
        turmasIds: selectedDest.filter(d => d.type === 'turma').map(d => String(d.id).replace(/^t_?/, '')),
        alunosIds: selectedDest.filter(d => d.type === 'aluno').map(d => String(d.id).replace(/^a_?/, '')),
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
        tipo: 'texto',
        autor: currentUser?.nome || 'Usuário ERP',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Administração',
        autorId: currentUser?.id || '',
        autorFoto: currentUser?.foto || null,
        turmas: selectedDest.filter(d => d.type === 'turma').map(d => d.name),
        turmasIds: selectedDest.filter(d => d.type === 'turma').map(d => String(d.id).replace(/^t_?/, '')),
        alunosIds: selectedDest.filter(d => d.type === 'aluno').map(d => String(d.id).replace(/^a_?/, '')),
        destino: selectedDest.length === 0 ? 'todos' : 'selecionados',
        prioridade: 'normal',
        fixado: false,
        exigeCiencia: false,
        permiteResposta: true,
        dataEnvio: new Date().toISOString(),
        dataAgendamento: dataAgendamento || null,
        anexos: anexos,
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
            const isGlobal = newCom.turmas.length === 0 && newCom.alunosIds.length === 0
            const targets = alunosAtivos.filter(a => {
               if (isGlobal) return true;
               if (newCom.turmas.includes(a.turma)) return true;
               const aIdPlain = a.id.replace(/^_*(ALU)?/, '')
               return newCom.alunosIds.some(idRaw => idRaw.replace(/^_*(ALU)?/, '') === aIdPlain)
            })

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

    setSelectedDest([]) // Permite selecionar novos destinatários
    
    
    setShowComposer(true)
  }

  const handleNovo = () => {
    setEditComId(null)
    
    
        
    
    
    setSelectedDest([])
    setShowComposer(true)
  }

  const filtered = comunicados.filter(c => {
    if (tab === 'enviados' && c.status !== 'enviado') return false
    if (tab === 'agendados' && c.status !== 'agendado') return false
    if (tab === 'rascunhos' && c.status !== 'rascunho') return false
    
    if (authorFilter !== 'todos') {
      const cAutor = c.autor || (c as any).dados?.autor;
      const cCargo = c.autorCargo || (c as any).dados?.autorCargo;
      if (authorFilter === 'meus') {
        if (c.autorId !== currentUser?.id && cAutor !== currentUser?.nome) return false;
      } else if (authorFilter.startsWith('cargo:')) {
        const roleTarget = authorFilter.split(':')[1];
        if (cCargo !== roleTarget) return false;
      } else if (authorFilter.startsWith('autor:')) {
        const autorTarget = authorFilter.split(':')[1];
        if (cAutor !== autorTarget) return false;
      }
    }

    if (search) {
      const searchLower = search.toLowerCase()
      const titleMatch = (c.titulo || '').toLowerCase().includes(searchLower)
      const contentMatch = (c.conteudo || (c as any).texto || '').toLowerCase().includes(searchLower)
      return titleMatch || contentMatch
    }
    
    // Ocultar envios individuais de relatórios do Feed (Mostrando apenas a Cópia-Resumo da Turma)
    if (c.id?.startsWith('AD-COM-REL-STU-')) return false
    
    return true
  }).sort((a,b) => {
    const timeA = new Date(a.dataEnvio || (a as any).data || (a as any).created_at || 0).getTime();
    const timeB = new Date(b.dataEnvio || (b as any).data || (b as any).created_at || 0).getTime();
    return timeB - timeA;
  })

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Caixa de Comunicados</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Gerencie o envio, relatórios de leitura e arquivos anexos.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative' }}>
            <Filter size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <select 
              className="form-input" 
              value={authorFilter}
              onChange={e => setAuthorFilter(e.target.value)}
              style={{ paddingLeft: 36, width: 200, appearance: 'none', cursor: 'pointer', fontWeight: 600, color: 'hsl(var(--text-main))' }}
            >
              <option value="todos">Todos os Autores</option>
              <option value="meus">Meus Comunicados</option>
              {availableRoles.length > 0 && <optgroup label="Filtrar por Cargo">
                {availableRoles.map(role => <option key={`role-${role}`} value={`cargo:${role}`}>{role}</option>)}
              </optgroup>}
              {availableAuthors.length > 0 && <optgroup label="Filtrar por Usuário">
                {availableAuthors.map(autor => <option key={`aut-${autor}`} value={`autor:${autor}`}>{autor}</option>)}
              </optgroup>}
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Buscar..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: 180 }} 
            />
          </div>
          <button className="btn btn-secondary" onClick={() => setShowMonthlyReport(true)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Calendar size={16} /> Relatório Mensal
          </button>
          <button className="btn btn-primary" onClick={handleNovo}>
            <Plus size={16} /> Novo Comunicado
          </button>
        </div>
      </div>

      <div className="tab-list" style={{ marginBottom: 24, width: 'fit-content' }}>
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
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: 16, fontWeight: 500 }}>Nenhum comunicado encontrado nesta aba.</p>
            </div>
          )}
          {filtered.slice(0, visibleCount).map(c => {
             const isGlobal = !c.turmas?.length && !c.alunosIds?.length;
             const targets = isGlobal 
                ? alunosAtivos 
                : alunosAtivos.filter(a => c.turmas?.includes(a.turma) || c.alunosIds?.some(idRaw => idRaw.replace(/^_*(ALU)?/, '') === a.id.replace(/^_*(ALU)?/, '')));
             const targetCount = targets.length;
             const lidas = Object.keys(c.leituras || {}).length
             const progresso = targetCount > 0 ? (lidas / targetCount) * 100 : 0
             const dateObj = (c.dataEnvio || (c as any).data) ? new Date(c.dataEnvio || (c as any).data) : null

             return (
              <motion.div 
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setViewingCom(c)}
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
                {/* Content Column */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                      {c.titulo}
                    </h3>
                    {c.fixado && <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}><Pin size={12} fill="#f59e0b" /></span>}
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
                    {c.destino === 'todos' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#059669' }}>
                        <Users size={13} /> Toda a Escola
                      </div>
                    ) : (
                      ((c.turmas && c.turmas.length > 0) || (c.alunosIds && c.alunosIds.length > 0)) && (
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
                          Ver Destinatários ({c.turmas?.length || 0})
                        </button>
                      )
                    )}
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} />
                      {dateObj ? `${dateObj.toLocaleDateString('pt-BR')} às ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '--'}
                    </div>
                  </div>
                </div>

                {/* Column: Stats */}
                <div style={{ minWidth: 160, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '1px solid #e2e8f0', paddingLeft: 24 }}>
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
                <div style={{ display: 'flex', gap: 8, paddingLeft: 12 }}>
                   <button className="btn btn-ghost btn-sm" style={{ width: 36, height: 36, padding: 0, borderRadius: 12, color: '#64748b' }} onClick={e => { e.stopPropagation(); handleReenviar(c) }} title="Reenviar"><SendIcon size={16} /></button>
                   <button className="btn btn-primary btn-sm" style={{ padding: '0 16px', height: 36, borderRadius: 12, fontSize: 12, fontWeight: 800, background: '#0f172a', borderColor: '#0f172a' }} onClick={e => { e.stopPropagation(); setSelectedCom(c) }}>
                      Detalhes
                   </button>
                </div>
              </motion.div>
             )
          })}

          {filtered.length > visibleCount && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 32 }}>
              <button 
                onClick={() => setVisibleCount(prev => prev + 10)}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  padding: '10px 24px',
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#e2e8f0'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#f1f5f9'
                }}
              >
                Carregar Mais Comunicados
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
{/* Drawer: Comunicado Details */}
      {selectedCom && (
        <ClientPortal>
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 450,
          backgroundColor: '#ffffff', boxShadow: '-10px 0 40px rgba(0,0,0,0.15)',
          borderLeft: '1px solid hsl(var(--border-subtle))', zIndex: 9999,
          display: 'flex', flexDirection: 'column'
        }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Relatório do Comunicado</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCom(null)}><X size={18} /></button>
          </motion.div>
          
          <div style={{ padding: 32, flex: 1, overflowY: 'auto' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>Assunto</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedCom.titulo}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
               <div className="card" style={{ padding: 16 }}>
                 <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Leituras Totais</div>
                 <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{Object.keys(selectedCom.leituras || {}).length}</div>
               </div>
               {selectedCom.exigeCiencia && (
                 <div className="card" style={{ padding: 16 }}>
                   <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Ciências Confirmadas</div>
                   <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{Object.keys(selectedCom.ciencias || {}).length}</div>
                 </div>
               )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 8, textTransform: 'uppercase' }}>
                Conteúdo Original
              </div>
              <div style={{ padding: 16, background: 'hsl(var(--bg-surface))', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', fontSize: 13, lineHeight: 1.6, color: 'hsl(var(--text-main))' }}>
                {renderConteudo(selectedCom.conteudo)}
              </div>
              
              {selectedCom.anexos && selectedCom.anexos.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedCom.anexos.map((anexo: string, idx: number) => {
                    const parts = typeof anexo === 'string' ? anexo.split('|') : [String(anexo)];
                    const name = parts[0];
                    const isForm = name.startsWith('Formulário:')
                    const isRel = name.startsWith('Relatório:')
                    let payloadData = null;
                    if (isRel && parts.length > 1 && parts[1].startsWith('payload:')) {
                      try {
                        payloadData = JSON.parse(parts[1].substring(8));
                      } catch(e) {}
                    }
                    
                    return (
                      <button 
                        key={idx} 
                        onClick={() => {
                          if (isRel && payloadData) {
                            const stringAnexo = typeof anexo === 'string' ? anexo : String(anexo);
                            setViewingReportPayload({
                              string: stringAnexo
                            });
                          }
                        }}
                        style={{ 
                          background: isRel ? 'rgba(139, 92, 246, 0.1)' : 'hsl(var(--bg-overlay))', 
                          color: isRel ? '#7c3aed' : 'hsl(var(--text-secondary))', 
                          fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', padding: '6px 12px', 
                          borderRadius: 8, border: `1px solid ${isRel ? 'rgba(139, 92, 246, 0.2)' : 'hsl(var(--border-subtle))'}`,
                          cursor: isRel ? 'pointer' : 'default', fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                          if (isRel) {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (isRel) {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }
                        }}
                      >
                        {isForm ? <FileText size={14} color="#3b82f6" /> : isRel ? <FileBarChart size={14} color="#7c3aed" /> : <Paperclip size={14} color="#64748b" />}
                        {name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Status de Leitura (Famílias)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                const isGlobal = !selectedCom.turmas?.length && !selectedCom.alunosIds?.length
                const targets = alunosAtivos.filter(a => {
                  if (isGlobal) return true;
                  if (selectedCom.turmas?.includes(a.turma)) return true;
                  const aIdPlain = a.id.replace(/^_*(ALU)?/, '')
                  return selectedCom.alunosIds?.some(idRaw => idRaw.replace(/^_*(ALU)?/, '') === aIdPlain)
                })
                
                return targets.map(a => {
                  const leu = !!(selectedCom.leituras && selectedCom.leituras[a.id])
                  const hasReportAnexo = selectedCom.anexos?.find((anx: string) => typeof anx === 'string' && anx.startsWith('Relatório:'));
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'hsl(var(--bg-surface))', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.nome} <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginLeft: 8 }}>{a.turma}</span></div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {hasReportAnexo && (
                          <button 
                            onClick={() => {
                               setViewingReportPayload({
                                 string: typeof hasReportAnexo === 'string' ? hasReportAnexo : String(hasReportAnexo),
                                 studentId: a.id,
                                 studentName: a.nome,
                                 studentAvatar: a.avatarUrl
                               });
                            }}
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: 'none', cursor: 'pointer' }}
                          >
                            Ver Relatório
                          </button>
                        )}
                        {leu ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 11, fontWeight: 600 }}><CheckCircle2 size={14}/> Lido</span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', fontSize: 11, fontWeight: 600 }}><XCircle size={14}/> Não lido</span>
                        )}
                      </div>
                    </div>
                  )
                })
              })()}
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 8 }}>Ver Lista Completa</button>
            </div>
          </div>
        
</motion.div>
</ClientPortal>)}</AnimatePresence>

      
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
      </AnimatePresence>

      <ReportsSelectionModal 
        isOpen={showRelsModal} 
        onClose={() => setShowRelsModal(false)} 
        selectedDest={selectedDest} 
        onAdd={(text, payload) => alert('Adicione o relatório anexando o PDF gerado ou insira o link.')} 
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

      <AnimatePresence>
        {/* View Communication Modal */}
        {viewingCom && (
          <ClientPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'none', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: 'white', width: '100%', maxWidth: 650, borderRadius: 24, boxShadow: '0 40px 100px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
            >
              {/* Header */}
              <div style={{ padding: '24px 32px', background: 'hsl(var(--bg-overlay))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
                    {viewingCom.autor?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#1e293b' }}>{viewingCom.autor}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{viewingCom.autorCargo}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                      {(() => {
                        const rawDate = viewingCom.dataEnvio || (viewingCom as any).data || (viewingCom as any).created_at || new Date().toISOString();
                        try {
                          const d = new Date(rawDate);
                          if (isNaN(d.getTime())) {
                            return new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                          }
                          return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        } catch (e) {
                          return new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        }
                      })()}
                    </div>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => setViewingCom(null)} style={{ padding: 8 }}><X size={24} /></button>
              </div>

              {/* Body */}
              <div style={{ padding: 32, flex: 1, overflowY: 'auto' }}>
                <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(79, 70, 229, 0.03)', borderRadius: 12, border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#4f46e5', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Para:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: '110px', overflowY: 'auto', paddingRight: 4 }}>
                    {viewingCom.turmas?.length > 0 ? viewingCom.turmas.map(t => (
                      <span key={t} style={{ background: 'white', color: '#4f46e5', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: '1px solid rgba(79, 70, 229, 0.1)' }}>Turma: {t}</span>
                    )) : <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>Toda a Escola (Global)</span>}
                  </div>
                </div>

                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e293b', marginBottom: 20, lineHeight: 1.2 }}>{viewingCom.titulo}</h2>
                
                <div style={{ fontSize: 15, lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap', marginBottom: 24 }}>
                  {renderConteudo(viewingCom.conteudo || (viewingCom as any).texto || '')}
                </div>

                {viewingCom.anexos && viewingCom.anexos.length > 0 && (
                  <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Anexos e Mídia ({viewingCom.anexos.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {viewingCom.anexos.map((a, i) => {
                        let name = '';
                        let url = '';
                        let mimeType = '';
                        if (typeof a === 'string') {
                          if (a.endsWith('|report-payload')) {
                            const firstPipe = a.indexOf('|');
                            const lastPipe = a.lastIndexOf('|');
                            name = a.substring(0, firstPipe);
                            url = a.substring(firstPipe + 1, lastPipe);
                            mimeType = 'report-payload';
                          } else {
                            const parts = a.split('|');
                            name = parts[0];
                            url = parts[1] || (parts[0].startsWith('http') ? parts[0] : '');
                            mimeType = parts[2] || '';
                          }
                        } else {
                          name = String(a);
                        }
                        
                        const isImg = mimeType.startsWith('image/') || (url && (url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(name)));
                        const isVid = mimeType.startsWith('video/') || (url && (url.startsWith('data:video') || /\.(mp4|webm|ogg|mov|quicktime)$/i.test(name)));
                        const isReportPayload = mimeType === 'report-payload' || url.startsWith('payload:');

                        if (isReportPayload) {
                          let parsedPayload: any = null;
                          try {
                            const payloadStr = url.startsWith('payload:') ? url.substring(8) : url;
                            parsedPayload = JSON.parse(payloadStr);
                          } catch(e) {}

                          return (
                            <button 
                              key={i} 
                              onClick={() => {
                                if (parsedPayload) {
                                  setViewingReportPayload(`Relatório: ${name}|${url}`);
                                }
                              }}
                              style={{ 
                                background: 'rgba(139, 92, 246, 0.1)', 
                                color: '#7c3aed', 
                                fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center', padding: '8px 14px', 
                                borderRadius: 10, border: '1px solid rgba(139, 92, 246, 0.2)',
                                cursor: 'pointer', fontWeight: 700,
                                transition: 'all 0.2s',
                                marginBottom: 6, marginRight: 6
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              <FileBarChart size={16} />
                              {name}
                            </button>
                          );
                        }

                        if (isImg && url) return (
                          <div key={i} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <Image src={url} alt={name} width={800} height={600} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 600, objectFit: 'contain' }} />
                            <div style={{ padding: '8px 16px', fontSize: 12, color: '#64748b', borderTop: '1px solid #e2e8f0' }}>{name}</div>
                          </div>
                        );

                        if (isVid && url) return (
                          <div key={i} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#000' }}>
                            <video 
                              src={url} 
                              controls 
                              playsInline
                              preload="metadata"
                              style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 600 }} 
                            />
                            <div style={{ padding: '8px 16px', fontSize: 12, color: '#fff', background: 'rgba(15,23,42,0.85)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>{name}</div>
                          </div>
                        );

                        return (
                          <div key={i} style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Paperclip size={16} color="#64748b" />
                            </div>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                            {url && <button className="btn btn-ghost btn-sm" onClick={() => window.open(url, '_blank')}>Abrir</button>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


              </div>

              {/* Footer Actions */}
              <div style={{ padding: '20px 32px', background: 'hsl(var(--bg-overlay))', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" style={{ flex: 1, gap: 8, height: 48 }} onClick={() => { openEdit(viewingCom); setViewingCom(null); }}>
                  <MoreHorizontal size={18} /> Editar
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, gap: 8, height: 48 }} onClick={() => { handleReenviar(viewingCom); setViewingCom(null); }}>
                  <SendIcon size={18} /> Encaminhar
                </button>
                <button className="btn" style={{ flex: 1, gap: 8, height: 48, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={() => {
                  adConfirm('Excluir este comunicado permanentemente?', 'Apagar', async () => {
                    try {
                      await fetch(`/api/comunicados?id=${viewingCom.id}`, { method: 'DELETE' });
                    } catch (err) {
                      console.error("Erro ao deletar comunicado:", err);
                    }
                    setComunicados(prev => prev.filter(x => x.id !== viewingCom.id));
                    setViewingCom(null);
                  });
                }}>
                  <XCircle size={18} /> Apagar
                </button>
              </div>
            </motion.div>
          </div>
          </ClientPortal>
        )}
      </AnimatePresence>

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
                    if (attachmentFilter !== 'todos') {
                      const anexosList = c.anexos || [];
                      const hasAny = anexosList.length > 0;
                      if (attachmentFilter === 'nenhum' && hasAny) valid = false;
                      if (attachmentFilter === 'qualquer' && !hasAny) valid = false;
                      if (['relatorio', 'formulario', 'imagem', 'video'].includes(attachmentFilter)) {
                        const matchesType = anexosList.some((anexo: string) => {
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
                          } else {
                            name = String(anexo);
                          }
                          if (attachmentFilter === 'relatorio' && name.startsWith('Relatório:')) return true;
                          if (attachmentFilter === 'formulario' && name.startsWith('Formulário:')) return true;
                          const isImg = mimeType.startsWith('image/') || (url && url.startsWith('data:image')) || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
                          if (attachmentFilter === 'imagem' && isImg) return true;
                          const isVid = mimeType.startsWith('video/') || (url && url.startsWith('data:video')) || /\.(mp4|webm|ogg|mov)$/i.test(name);
                          if (attachmentFilter === 'video' && isVid) return true;
                          return false;
                        });
                        if (!matchesType) valid = false;
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

