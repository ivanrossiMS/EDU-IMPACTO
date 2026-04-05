'use client'

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { Bell, Search, Filter, Pin, CheckCircle2, X, Paperclip, FileText, FileBarChart } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { UserAvatar } from '@/components/UserAvatar'
import { use, useState } from 'react'
import { useFormularios, FormTemplate } from '@/lib/formulariosContext'

export default function ADComunicadosPage({ params }: { params: Promise<{ slug: string }>}) {
  const { comunicados, setComunicados, adAlert } = useAgendaDigital()
  const { forms, setSubmissions, setDisparos, submissions } = useFormularios()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  const [selectedComunicado, setSelectedComunicado] = useState<any>(null)
  
  const [openedFormStr, setOpenedFormStr] = useState<string | null>(null)
  const [formResp, setFormResp] = useState<Record<string, any>>({})
  const openedFormObj: FormTemplate | undefined = forms.find(x => x.name === openedFormStr?.replace('Formulário: ', ''))

  const previousSubmission = openedFormObj 
    ? submissions.find(sub => sub.formId === openedFormObj.id && sub.studentName === resolvedParams.slug)
    : null;
  const hasResponded = !!previousSubmission;

  
  const handleCiencia = (comunicadoId: string) => {
    setComunicados(prev => prev.map(c => {
      if (c.id === comunicadoId) {
        return { ...c, ciencias: { ...c.ciencias, [resolvedParams.slug]: new Date().toISOString() } }
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
    <div>
      <div className="ad-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Comunicados</h2>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Buscar comunicados..." 
              style={{ paddingLeft: 36, width: 240 }} 
            />
          </div>
          <button className="btn btn-secondary">
            <Filter size={16} /> Filtros
          </button>
        </div>
      </div>

      <div className="ad-feed-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {comunicados.length === 0 ? (
          <EmptyStateCard 
            title="Nenhum comunicado"
            description="Você está em dia com as comunicações pedagógicas e avisos gerais."
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
                borderLeft: (!c.leituras[resolvedParams.slug] && c.prioridade !== 'alta' && c.prioridade !== 'urgente') ? '4px solid #4f46e5' : 
                            c.prioridade === 'alta' ? '4px solid #ef4444' : 
                            c.prioridade === 'urgente' ? '4px solid #f97316' : '4px solid transparent', 
                display: 'flex', 
                flexDirection: 'column', 
                padding: '16px 16px',
                gap: 8,
              }}
              onClick={() => {
                setSelectedComunicado(c)
                if (!c.leituras[resolvedParams.slug]) {
                  setComunicados(prev => prev.map(x => x.id === c.id ? { ...x, leituras: { ...x.leituras, [resolvedParams.slug]: new Date().toISOString() } } : x))
                }
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
            >
              <div className="ad-card-flex-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {/* FOTO DO REMETENTE NA TELA PRINCIPAL */}
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
                
                {/* Lida / Não Lida Badge */}
                {!c.leituras[resolvedParams.slug] ? (
                  <span className="badge badge-primary">NOVO</span>
                ) : (
                  <span className="badge badge-neutral">Lido</span>
                )}
              </div>
              
              {c.anexos && c.anexos.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {c.anexos.map((anexo: string, idx: number) => {
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

              {c.exigeCiencia && (
                <div style={{ 
                  background: c.ciencias[resolvedParams.slug] ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', 
                  padding: '12px 16px', 
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: c.ciencias[resolvedParams.slug] ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(245,158,11,0.2)',
                  transition: 'all 0.3s'
                }}>
                  <div style={{ fontSize: 13, color: c.ciencias[resolvedParams.slug] ? '#15803d' : '#d97706', fontWeight: 600 }}>
                    {c.ciencias[resolvedParams.slug] ? 'Ciência registrada. Obrigado!' : 'Este comunicado exige a sua ciência obrigatória.'}
                  </div>
                  {!c.ciencias[resolvedParams.slug] ? (
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

      {/* Modal do Comunicado Expandido */}
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
                   <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px 0', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                     Anexos e Documentos Disponíveis
                   </h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                     {selectedComunicado.anexos.map((anexo: string, idx: number) => {
                       const isForm = anexo.startsWith('Formulário:')
                       const isRel = anexo.startsWith('Relatório:')
                       const themeColor = isForm ? '#3b82f6' : isRel ? '#8b5cf6' : '#64748b'
                       const bgTheme = isForm ? 'rgba(59,130,246,0.1)' : isRel ? 'rgba(139,92,246,0.1)' : 'rgba(100,116,139,0.1)'
                       
                       return (
                         <div key={idx} className="ad-attachment-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-surface))', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div className="avatar" style={{ width: 40, height: 40, borderRadius: 10, background: bgTheme, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isForm ? <FileText size={20} color={themeColor} /> : isRel ? <FileBarChart size={20} color={themeColor} /> : <Paperclip size={20} color={themeColor} />}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{anexo.replace(/^(Formulário:|Relatório:)\s*/, '')}</div>
                                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{isForm ? 'Responder Formulário' : isRel ? 'Visualizar Relatório' : 'Baixar Arquivo'}</div>
                              </div>
                            </div>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }} onClick={e => { 
                               e.stopPropagation()
                               if (isForm) {
                                  setOpenedFormStr(anexo)
                               } else if (isRel) {
                                  setOpenedFormStr(anexo)
                               } else {
                                  handleDownload(anexo)
                               }
                            }}>
                              {isForm ? 'Abrir' : 'Baixar'}
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
                {!selectedComunicado.ciencias[resolvedParams.slug] ? (
                   <button onClick={() => { handleCiencia(selectedComunicado.id); setSelectedComunicado({...selectedComunicado, ciencias: {...selectedComunicado.ciencias, [resolvedParams.slug]: true}}) }} className="btn btn-primary">
                     Li e estou ciente
                   </button>
                ) : (
                   <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 600, background: '#f0fdf4', padding: '12px 24px', borderRadius: 8 }}>
                     <CheckCircle2 /> Ciência Registrada Eletronicamente
                   </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formulário/Relatório Simulado */}
      {openedFormStr && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setOpenedFormStr(null)}>
           <div className="card" style={{ padding: 40, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
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
           </div>
        </div>
      )}
    </div>
  )
}
