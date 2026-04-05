'use client'

import { useState, useRef } from 'react'
import { useAgendaDigital, ADComunicado } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { useFormularios } from '@/lib/formulariosContext'
import { useRelatorios } from '@/lib/relatoriosContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { 
  Bell, Search, Plus, Filter, Pin, FileText, CheckCircle2, XCircle, 
  Send as SendIcon, Clock, Paperclip, MoreHorizontal, X,
  Bold, Italic, Link as LinkIcon, List, Underline, BadgeDollarSign, Smile, FileBarChart
} from 'lucide-react'
import { DestinatariosModal } from '@/components/agenda/DestinatariosModal'
import { useApp } from '@/lib/context'
import { UserAvatar } from '@/components/UserAvatar'

export default function ADAdminComunicados() {
  const { currentUser } = useApp()
  const { comunicados, setComunicados, adAlert, adConfirm } = useAgendaDigital()
  const { alunos, turmas } = useData()
  const { forms, setDisparos } = useFormularios()
  const { templates: relatoriosTemplates } = useRelatorios()
  
  const alunosAtivos = (alunos || []).filter(a => a.status === 'matriculado' || a.status === 'ativo')

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
  const [newTitulo, setNewTitulo] = useState('')
  const [newConteudo, setNewConteudo] = useState('')
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
  
  const textRef = useRef<HTMLTextAreaElement>(null)

  const insertFormat = (tag: string, tagEnd = tag) => {
    if (!textRef.current) { setNewConteudo(p => p + ' ' + tag + tagEnd); return }
    const start = textRef.current.selectionStart
    const end = textRef.current.selectionEnd
    const txt = newConteudo
    setNewConteudo(txt.substring(0, start) + tag + txt.substring(start, end) + tagEnd + txt.substring(end))
    setTimeout(() => textRef.current?.focus(), 10)
  }

  const handleEnviar = (asRascunho = false) => {
    if (!newTitulo.trim() || !newConteudo.trim()) {
      adAlert('Por favor, preencha o título e o conteúdo.', 'Atenção')
      return
    }
    
    if (editComId) {
      setComunicados(prev => prev.map(c => c.id === editComId ? {
        ...c,
        titulo: newTitulo,
        conteudo: newConteudo,
        autor: currentUser?.nome || 'Usuário ERP',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Administração',
        autorId: currentUser?.id || '',
        anexos: anexos,
        dataAgendamento: dataAgendamento || null,
        status: asRascunho ? 'rascunho' : dataAgendamento ? 'agendado' : 'enviado',
        turmas: selectedDest.filter(d => d.type === 'turma').map(d => d.name),
        alunosIds: selectedDest.filter(d => d.type === 'aluno').map(d => d.id.replace(/^a_?/, ''))
      } : c))
    } else {
      const newCom: ADComunicado = {
        id: `AD-COM-NEW-${Date.now()}`,
        titulo: newTitulo,
        conteudo: newConteudo,
        tipo: 'texto',
        autor: currentUser?.nome || 'Usuário ERP',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Administração',
        autorId: currentUser?.id || '',
        turmas: selectedDest.filter(d => d.type === 'turma').map(d => d.name),
        alunosIds: selectedDest.filter(d => d.type === 'aluno').map(d => d.id.replace(/^a_?/, '')),
        prioridade: 'normal',
        fixado: false,
        exigeCiencia: false,
        permiteResposta: false,
        dataEnvio: new Date().toISOString(),
        dataAgendamento: dataAgendamento || null,
        anexos: anexos,
        leituras: {},
        ciencias: {},
        status: asRascunho ? 'rascunho' : dataAgendamento ? 'agendado' : 'enviado'
      }
      setComunicados(prev => [newCom, ...prev])
      
      // Auto-register form dispatches if it contains forms
      if (!asRascunho) {
         const appendedForms = anexos.filter(a => a.startsWith('Formulário: ')).map(a => a.replace('Formulário: ', ''))
         if (appendedForms.length > 0) {
            const isGlobal = newCom.turmas.length === 0 && newCom.alunosIds.length === 0
            const targets = alunosAtivos.filter(a => {
               if (isGlobal) return true;
               if (newCom.turmas.includes(a.turma)) return true;
               const aIdPlain = a.id.replace(/^_*(ALU)?/, '')
               return newCom.alunosIds.some(idRaw => idRaw.replace(/^_*(ALU)?/, '') === aIdPlain)
            })

            const newDisparos: any[] = []
            appendedForms.forEach(formName => {
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
    setNewTitulo('')
    setNewConteudo('')
    setSelectedDest([])
    setEditComId(null)
  }

  const openEdit = (c: ADComunicado) => {
    setEditComId(c.id)
    setNewTitulo(c.titulo)
    setNewConteudo(c.conteudo)
    
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
    adConfirm('Deseja duplicar este comunicado e enviá-lo novamente no topo da lista?', 'Reenviar', () => {
      const newCom = { ...c, id: `AD-COM-RESEND-${Date.now()}`, leituras: {}, ciencias: {}, dataEnvio: new Date().toISOString(), status: 'enviado' as const }
      setComunicados(prev => [newCom, ...prev])
    })
  }

  const handleNovo = () => {
    setEditComId(null)
    setNewTitulo('')
    setNewConteudo('')
    setAnexos([])
    setDataAgendamento('')
    setSelectedDest([])
    setShowComposer(true)
  }

  const filtered = comunicados.filter(c => {
    if (tab === 'enviados' && c.status !== 'enviado') return false
    if (tab === 'agendados' && c.status !== 'agendado') return false
    if (tab === 'rascunhos' && c.status !== 'rascunho') return false
    
    if (search) {
      return c.titulo.toLowerCase().includes(search.toLowerCase()) || 
             c.conteudo.toLowerCase().includes(search.toLowerCase())
    }
    return true
  }).sort((a,b) => new Date(b.dataEnvio || 0).getTime() - new Date(a.dataEnvio || 0).getTime())

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Caixa de Comunicados</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Gerencie o envio, relatórios de leitura e arquivos anexos.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Buscar..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: 240 }} 
            />
          </div>
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

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid hsl(var(--border-subtle))', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Assunto</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Categoria</th>

              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{tab === 'agendados' ? 'Agendado para' : 'Data'}</th>
              {tab === 'enviados' && <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Leituras</th>}
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
                  Nenhum comunicado encontrado nesta aba.
                </td>
              </tr>
            )}
            {filtered.map(c => {
               const lidas = Object.keys(c.leituras).length
               const progresso = alunosAtivos.length > 0 ? (lidas / alunosAtivos.length) * 100 : 0

               return (
                <tr 
                  key={c.id} 
                  style={{ borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', background: selectedCom?.id === c.id ? 'rgba(99,102,241,0.05)' : '' }}
                  onClick={() => setSelectedCom(c)}
                  onMouseEnter={e => { if (selectedCom?.id !== c.id) e.currentTarget.style.background = 'hsl(var(--bg-overlay))' }}
                  onMouseLeave={e => { if (selectedCom?.id !== c.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {c.fixado && <Pin size={14} color="#f59e0b" style={{ fill: '#f59e0b' }} />}
                      <span style={{ fontWeight: 600, color: 'hsl(var(--text-main))' }}>{c.titulo}</span>
                      {c.exigeCiencia && <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706', fontSize: 10 }}>Assinatura Req.</span>}
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: 'hsl(var(--text-secondary))', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500, color: 'hsl(var(--text-main))', textTransform: 'capitalize' }}>{c.tipo || 'Texto'}</span>
                      {c.anexos?.length > 0 && (
                        <span style={{display: 'flex', alignItems: 'center', gap: 4, background: 'hsl(var(--bg-overlay))', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-secondary))'}}>
                          <Paperclip size={12} /> {c.anexos.length}
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '16px', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                    {c.dataEnvio ? new Date(c.dataEnvio).toLocaleDateString() : '—'}
                  </td>
                  {tab === 'enviados' && (
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: 'hsl(var(--border-subtle))', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(progresso, 100)}%`, height: '100%', background: progresso > 80 ? '#10b981' : '#3b82f6', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{lidas}/{alunosAtivos.length}</span>
                      </div>
                    </td>
                  )}
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                       <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleReenviar(c) }} title="Reenviar"><SendIcon size={14} /></button>
                       <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEdit(c) }} title="Editar"><MoreHorizontal size={14} /></button>
                       <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={e => { e.stopPropagation(); adConfirm('Excluir este comunicado permanentemente?', 'Excluir', () => setComunicados(prev => prev.filter(x => x.id !== c.id))) }} title="Excluir"><XCircle size={14} /></button>
                       <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setSelectedCom(c) }} style={{ padding: '4px 12px' }}>
                         Relatório
                       </button>
                    </div>
                  </td>
                </tr>
               )
            })}
          </tbody>
        </table>
      </div>

      {/* Drawer: Comunicado Details */}
      {selectedCom && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 450,
          backgroundColor: '#ffffff', boxShadow: '-10px 0 40px rgba(0,0,0,0.15)',
          borderLeft: '1px solid hsl(var(--border-subtle))', zIndex: 9999,
          display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Relatório do Comunicado</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCom(null)}><X size={18} /></button>
          </div>
          
          <div style={{ padding: 32, flex: 1, overflowY: 'auto' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>Assunto</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedCom.titulo}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
               <div className="card" style={{ padding: 16 }}>
                 <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Leituras Totais</div>
                 <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{Object.keys(selectedCom.leituras).length}</div>
               </div>
               {selectedCom.exigeCiencia && (
                 <div className="card" style={{ padding: 16 }}>
                   <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Ciências Confirmadas</div>
                   <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{Object.keys(selectedCom.ciencias).length}</div>
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
                    const isForm = anexo.startsWith('Formulário:')
                    const isRel = anexo.startsWith('Relatório:')
                    return (
                      <span key={idx} className="badge" style={{ background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-secondary))', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px' }}>
                        {isForm ? <FileText size={12} color="#3b82f6" /> : isRel ? <FileBarChart size={12} color="#8b5cf6" /> : <Paperclip size={12} color="#64748b" />}
                        {anexo}
                      </span>
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
                  const leu = !!selectedCom.leituras[a.id]
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'hsl(var(--bg-surface))', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.nome} <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginLeft: 8 }}>{a.turma}</span></div>
                      {leu ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 11, fontWeight: 600 }}><CheckCircle2 size={14}/> Lido</span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', fontSize: 11, fontWeight: 600 }}><XCircle size={14}/> Não lido</span>
                      )}
                    </div>
                  )
                })
              })()}
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 8 }}>Ver Lista Completa</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Composer */}
      {showComposer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editComId ? 'Editar Comunicado' : 'Escrever Novo Comunicado'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowComposer(false)}><X size={18} /></button>
            </div>
            
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Para:</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowDestModal(true)}>+ Adicionar Destinatários</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: 'hsl(var(--bg-main))', padding: '12px', borderRadius: 8, minHeight: 48, border: '1px solid hsl(var(--border-subtle))' }}>
                  {selectedDest.length === 0 && <span className="badge badge-ghost text-muted" style={{ padding: '6px 12px' }}>Toda a Escola (Todos os Alunos Ativos)</span>}
                  {selectedDest.map(d => (
                    <span key={d.id} className="badge" style={{ background: d.type === 'turma' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)', color: d.type === 'turma' ? '#4f46e5' : '#10b981', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 13 }}>
                      {d.type === 'turma' ? 'Turma:' : ''} {d.name}
                      <button onClick={() => setSelectedDest(prev => prev.filter(x => x.id !== d.id))} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', display: 'flex', color: 'inherit' }}><X size={14} color="currentColor"/></button>
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
              <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden' }}>
                 <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 8 }}>
                    <button onClick={() => insertFormat('**')} className="btn btn-ghost btn-sm" style={{ padding: 6, opacity: 0.7 }}><Bold size={16}/></button>
                    <button onClick={() => insertFormat('*')} className="btn btn-ghost btn-sm" style={{ padding: 6, opacity: 0.7 }}><Italic size={16}/></button>
                    <button onClick={() => insertFormat('_')} className="btn btn-ghost btn-sm" style={{ padding: 6, opacity: 0.7 }}><Underline size={16}/></button>
                    <div style={{ width: 1, background: 'hsl(var(--border-subtle))', margin: '0 4px' }} />
                    <button onClick={() => insertFormat('\\n- ')} className="btn btn-ghost btn-sm" style={{ padding: 6, opacity: 0.7 }}><List size={16}/></button>
                    <button onClick={() => insertFormat('[Link](', ')')} className="btn btn-ghost btn-sm" style={{ padding: 6, opacity: 0.7 }}><LinkIcon size={16}/></button>
                    <div style={{ width: 1, background: 'hsl(var(--border-subtle))', margin: '0 4px' }} />
                    <div style={{ position: 'relative' }}>
                       <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="btn btn-ghost btn-sm" style={{ padding: 6, opacity: 0.7 }}><Smile size={16}/></button>
                       {showEmojiPicker && (
                         <div style={{ position: 'absolute', top: 32, left: 0, background: '#fff', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, zIndex: 10 }}>
                           {EMOJIS.map(emoji => (
                             <button key={emoji} onClick={() => { insertFormat(emoji, ''); setShowEmojiPicker(false); }} style={{ background: 'transparent', border: 0, fontSize: 18, cursor: 'pointer', padding: 4, borderRadius: 4 }}>
                               {emoji}
                             </button>
                           ))}
                         </div>
                       )}
                    </div>
                 </div>
                 <textarea 
                   ref={textRef}
                   className="form-input" 
                   placeholder="Escreva sua mensagem aqui. Você pode usar formatação (ex: **negrito**), links..." 
                   style={{ height: 200, resize: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }}
                   value={newConteudo}
                   onChange={e => setNewConteudo(e.target.value)}
                 />
                 {anexos.length > 0 && (
                   <div style={{ padding: '12px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))' }}>
                     {anexos.map((anexo, i) => (
                       <span key={i} className="badge" style={{ background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 4 }}>
                         <Paperclip size={12}/> {anexo}
                         <button onClick={() => setAnexos(anexos.filter(a => a !== anexo))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={12}/></button>
                       </span>
                     ))}
                   </div>
                 )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <Paperclip size={14}/> Anexar Arquivo
                  <input type="file" hidden onChange={e => { if(e.target.files?.[0]) setAnexos([...anexos, e.target.files[0].name]) }} />
                </label>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowFormsModal(true)}><FileText size={14}/> Anexar Formulário</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowRelsModal(true)}><FileText size={14}/> Anexar Relatório</button>
                <button className="btn btn-primary btn-sm" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none' }} onClick={() => setShowCobrancaModal(true)}>
                   <BadgeDollarSign size={14}/> Nova Cobrança
                </button>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', display: 'flex', justifyContent: 'space-between', borderRadius: '0 0 16px 16px' }}>
              <button className="btn btn-ghost" onClick={() => handleEnviar(true)}>Salvar Rascunho</button>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input type="datetime-local" className="form-input" style={{ width: 180, fontSize: 13 }} value={dataAgendamento} onChange={e => setDataAgendamento(e.target.value)} title="Definir agendamento" />
                <button className="btn btn-primary" onClick={() => handleEnviar(false)}><SendIcon size={16} /> {dataAgendamento ? 'Agendar' : editComId ? 'Salvar Alterações' : 'Enviar Agora'}</button>
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

      {/* Cobranca Modal */}
      {showCobrancaModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 480, padding: 24, boxShadow: '0 40px 100px rgba(0,0,0,0.4)', borderRadius: 20 }}>
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
                     
                     // Incorporate the link in text
                     const txtCob = `\\n\\n[Aviso de Fatura Gerada] Acesse o link para pagamento no seu app:\\n💳 **${cobrancaForm.motivo}** - R$ ${novaCob.valor.toFixed(2)}\\n`
                     setNewConteudo(p => p + txtCob)
                     
                     setCobrancaForm({ motivo: '', valor: '', vencimento: '', tipo: 'pix' })
                     setShowCobrancaModal(false)
                  }}>Gerar Cobrança e Inserir no Texto</button>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Forms/Reports Selection Modals */}
      {showFormsModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 400, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
               <h3 style={{ fontWeight: 800 }}>Anexar um Formulário</h3>
               <button className="btn btn-ghost btn-sm" onClick={() => setShowFormsModal(false)}><X size={16}/></button>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {forms.filter(f => f.status !== 'arquivado').map(f => (
                   <button key={f.id} className="btn btn-secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 48 }} onClick={() => { setAnexos([...anexos, `Formulário: ${f.name}`]); setShowFormsModal(false) }}>{f.name}</button>
                ))}
                {forms.filter(f => f.status !== 'arquivado').length === 0 && <span style={{ color: 'hsl(var(--text-muted))', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum formulário ativo encontrado. Crie um novo formulário na aba de Formulários.</span>}
             </div>
          </div>
        </div>
      )}

      {showRelsModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 400, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
               <h3 style={{ fontWeight: 800 }}>Anexar um Relatório</h3>
               <button className="btn btn-ghost btn-sm" onClick={() => setShowRelsModal(false)}><X size={16}/></button>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {relatoriosTemplates.filter(r => r.status !== 'arquivado').map(r => (
                   <button key={r.id} className="btn btn-secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 48 }} onClick={() => { setAnexos([...anexos, `Relatório: ${r.name}`]); setShowRelsModal(false) }}>{r.name}</button>
                ))}
                {relatoriosTemplates.filter(r => r.status !== 'arquivado').length === 0 && <span style={{ color: 'hsl(var(--text-muted))', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum modelo de relatório ativo foi encontrado.</span>}
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
