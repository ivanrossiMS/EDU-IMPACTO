'use client'

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'
import { Bell, Search, Filter, Pin, CheckCircle2, X, Paperclip, FileText, FileBarChart, Plus } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { UserAvatar } from '@/components/UserAvatar'
import { useState } from 'react'

export default function ColaboradorComunicadosPage() {
  const { comunicados, setComunicados, adAlert } = useAgendaDigital()
  const { currentUser } = useApp()
  const [selectedComunicado, setSelectedComunicado] = useState<any>(null)
  
  const [showComposer, setShowComposer] = useState(false)
  const [newTitulo, setNewTitulo] = useState('')
  const [newConteudo, setNewConteudo] = useState('')
  const [destinatario, setDestinatario] = useState('Turma Inteira')

  if (!currentUser) return null;
  const userSlug = currentUser.id;

  const handleCiencia = (comunicadoId: string) => {
    setComunicados(prev => prev.map(c => {
      if (c.id === comunicadoId) {
        return { ...c, ciencias: { ...c.ciencias, [userSlug]: new Date().toISOString() } }
      }
      return c
    }))
  }

  const handleDownload = (filename: string) => {
    try {
      adAlert(`Download simulado do arquivo ${filename}`, 'Sucesso')
    } catch {
       adAlert(`Falha ao baixar ${filename}`, 'Erro')
    }
  }

  const handleEnviarNovo = () => {
    if (!newTitulo.trim() || !newConteudo.trim()) {
      adAlert('Por favor, preencha o título e o conteúdo.', 'Atenção')
      return
    }
    const newCom = {
      id: `AD-COM-COLAB-${Date.now()}`,
      titulo: newTitulo,
      conteudo: newConteudo,
      tipo: 'texto' as const,
      autor: currentUser?.nome || 'Professor',
      autorCargo: currentUser?.cargo || currentUser?.perfil || 'Colaborador',
      autorId: currentUser?.id || '',
      turmas: [destinatario],
      alunosIds: [],
      prioridade: 'normal' as const,
      fixado: false,
      exigeCiencia: false,
      permiteResposta: false,
      dataEnvio: new Date().toISOString(),
      dataAgendamento: null,
      anexos: [],
      leituras: {},
      ciencias: {},
      status: 'enviado' as const
    }
    setComunicados(prev => [newCom, ...prev])
    setShowComposer(false)
    setNewTitulo('')
    setNewConteudo('')
    adAlert('Comunicado enviado com sucesso!', 'Sucesso')
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
            if (part) return <span key={j}>{part}</span>;
            return null;
          })}
          <br />
        </span>
      );
    });
  }

  return (
    <div>
      <div className="ad-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Comunicados Institucionais</h2>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Buscar avisos..." 
              style={{ paddingLeft: 36, width: 240 }} 
            />
          </div>
          <button className="btn btn-secondary">
            <Filter size={16} /> Filtros
          </button>
          <button className="btn btn-primary" onClick={() => setShowComposer(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Novo Comunicado
          </button>
        </div>
      </div>

      <div className="ad-feed-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {comunicados.length === 0 ? (
          <EmptyStateCard 
            title="Nenhum comunicado"
            description="Você está em dia com os comunicados da diretoria e comunicados internos."
            icon={<Bell size={48} style={{ opacity: 0.2 }} />}
          />
        ) : (
          comunicados.map(c => (
            <div 
              key={c.id} 
              className="card ad-feed-card" 
              style={{ 
                cursor: 'pointer', 
                transition: 'all 0.2s', 
                position: 'relative',
                borderLeft: (!c.leituras[userSlug] && c.prioridade !== 'alta' && c.prioridade !== 'urgente') ? '4px solid #3b82f6' : 
                            c.prioridade === 'alta' ? '4px solid #ef4444' : 
                            c.prioridade === 'urgente' ? '4px solid #f97316' : '4px solid transparent', 
                display: 'flex', 
                flexDirection: 'column', 
                padding: '16px 16px',
                gap: 8,
              }}
              onClick={() => {
                setSelectedComunicado(c)
                if (!c.leituras[userSlug]) {
                  setComunicados(prev => prev.map(x => x.id === c.id ? { ...x, leituras: { ...x.leituras, [userSlug]: new Date().toISOString() } } : x))
                }
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
            >
              <div className="ad-card-flex-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <UserAvatar userId={c.autorId} name={c.autor} size={48} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      {c.fixado && <Pin size={12} color="#f59e0b" style={{ fill: '#f59e0b' }} />}
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'hsl(var(--text-main))', lineHeight: 1.2 }}>{c.titulo}</h3>
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', lineHeight: 1.2 }}>
                      <span>Enviado por <strong style={{ color: 'hsl(var(--text-secondary))' }}>{c.autor}</strong></span>
                      <span>•</span>
                      <span>{new Date(c.dataEnvio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                
                {!c.leituras[userSlug] ? (
                  <span className="badge" style={{ background: '#3b82f6', color: 'white' }}>NOVO</span>
                ) : (
                  <span className="badge badge-neutral">Lido</span>
                )}
              </div>
              
              {c.anexos && c.anexos.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {c.anexos.map((anexo: string, idx: number) => {
                    const isForm = anexo.startsWith('Formulário:')
                    return (
                      <span key={idx} className="badge" style={{ background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-secondary))', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px' }}>
                        {isForm ? <FileText size={12} color="#3b82f6" /> : <Paperclip size={12} color="#64748b" />}
                        {anexo}
                      </span>
                    )
                  })}
                </div>
              )}

              {c.exigeCiencia && (
                <div style={{ 
                  background: c.ciencias[userSlug] ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', 
                  padding: '12px 16px', 
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: c.ciencias[userSlug] ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(245,158,11,0.2)',
                  marginTop: 8
                }}>
                  <div style={{ fontSize: 13, color: c.ciencias[userSlug] ? '#15803d' : '#d97706', fontWeight: 600 }}>
                    {c.ciencias[userSlug] ? 'Ciência de servidor registrada.' : 'Exige ciência obrigatória.'}
                  </div>
                  {!c.ciencias[userSlug] ? (
                    <button onClick={(e) => { e.stopPropagation(); handleCiencia(c.id) }} className="btn btn-primary btn-sm">Dar Ciência</button>
                  ) : (
                    <CheckCircle2 color="#15803d" size={20} />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {selectedComunicado && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedComunicado(null)}>
          <div className="ad-modal-container" style={{ background: 'hsl(var(--bg-surface))', padding: 40, borderRadius: 24, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <UserAvatar userId={selectedComunicado.autorId} name={selectedComunicado.autor} size={64} />
                 <div>
                   <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedComunicado.autor}</div>
                   <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>{selectedComunicado.autorCargo}</div>
                 </div>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ padding: 8 }} onClick={() => setSelectedComunicado(null)}>
                <X size={20} />
              </button>
            </div>
            
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: 'hsl(var(--text-main))' }}>
              {selectedComunicado.titulo}
            </h2>
            
            <div style={{ padding: '24px 0', borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))', marginBottom: 24 }}>
               <div className="ad-body-text" style={{ fontSize: 16, lineHeight: 1.8, color: 'hsl(var(--text-main))', whiteSpace: 'pre-wrap' }}>
                 {renderConteudo(selectedComunicado.conteudo)}
               </div>

               {selectedComunicado.anexos && selectedComunicado.anexos.length > 0 && (
                 <div style={{ marginTop: 32, padding: '20px', background: 'hsl(var(--bg-overlay))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                     {selectedComunicado.anexos.map((anexo: string, idx: number) => {
                       return (
                         <div key={idx} className="ad-attachment-item">
                           <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(anexo)}>
                              Baixar {anexo}
                           </button>
                         </div>
                       )
                     })}
                   </div>
                 </div>
               )}
            </div>

            {selectedComunicado.exigeCiencia && (
              <div style={{ textAlign: 'right' }}>
                {!selectedComunicado.ciencias[userSlug] ? (
                   <button onClick={() => { handleCiencia(selectedComunicado.id); setSelectedComunicado({...selectedComunicado, ciencias: {...selectedComunicado.ciencias, [userSlug]: true}}) }} className="btn btn-primary" style={{ background: '#3b82f6', color: '#fff', border: 'none' }}>
                     Declaro estar ciente
                   </button>
                ) : (
                   <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 600, background: '#f0fdf4', padding: '12px 24px', borderRadius: 8 }}>
                     <CheckCircle2 /> Ciência Registrada em Sistema Interno
                   </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showComposer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Escrever Novo Comunicado</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowComposer(false)}><X size={18} /></button>
            </div>
            
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Destinatário(s) da Turma</label>
                <select className="form-input" value={destinatario} onChange={e => setDestinatario(e.target.value)} style={{ padding: '8px 12px', fontSize: 14 }}>
                  <option value="Turma Inteira">Toda a Turma (Todos os Alunos)</option>
                  <option value="Alunos Específicos">Somente Alunos Responsáveis</option>
                  <option value="Coordenação">Somente Coordenação Mestre</option>
                </select>
              </div>

              <div>
                 <input className="form-input" placeholder="Título do Comunicado" style={{ fontSize: 16, fontWeight: 600 }} value={newTitulo} onChange={e => setNewTitulo(e.target.value)} />
              </div>

              <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden' }}>
                 <textarea 
                   className="form-input" 
                   placeholder="Escreva sua mensagem aqui para a família..." 
                   style={{ height: 180, resize: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }}
                   value={newConteudo}
                   onChange={e => setNewConteudo(e.target.value)}
                 />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', display: 'flex', justifyContent: 'flex-end', borderRadius: '0 0 16px 16px' }}>
               <button className="btn btn-primary" onClick={handleEnviarNovo}>Enviar Comunicado</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
