'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { LoadingGlass } from '@/components/LoadingGlass'
import { 
  UserCog, Phone, Mail, ShieldAlert, GraduationCap, MapPin, 
  Edit3, HeartPulse, ShieldCheck, Contact, FileText, Camera, 
  Download, PlusCircle, AlertTriangle, Fingerprint, CalendarDays, Loader2
} from 'lucide-react'
import { getInitials, formatDate } from '@/lib/utils'
import { useApiQuery } from '@/hooks/useApi'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { useApp } from '@/lib/context'

export default function ADPerfilPage() {
  const { currentUser, setCurrentUser } = useApp()
  const { aluno: basicAluno } = useSelectedStudent()
  const slug = basicAluno?.id
  
  const { data: responseData, isLoading, error, refetch } = useApiQuery<any>(
    ['aluno', slug], 
    slug ? `/api/alunos/${slug}` : '',
    undefined,
    { enabled: !!slug }
  )
  const aluno = responseData?.data || null

  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedRespId, setSelectedRespId] = useState<string | null>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedRespId) return

    setUploadingAvatarId(selectedRespId)
    try {
      const uploadRes = await uploadFileToSupabase({
        bucket: 'comunicados-midia',
        folder: 'avatars',
        file,
        usageType: 'fixed'
      })

      if (!uploadRes.ok || !uploadRes.url) {
        throw new Error(uploadRes.error || 'Erro ao enviar a imagem')
      }

      const targetResp = responsaveisList.find((r: any) => r.id === selectedRespId)
      
      const apiRes = await fetch('/api/responsaveis/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          responsavelId: selectedRespId, 
          email: targetResp?.email,
          avatarUrl: uploadRes.url 
        })
      })

      if (!apiRes.ok) {
        const errData = await apiRes.json().catch(() => ({}))
        console.error('[Avatar Sync Error]', errData)
        throw new Error(errData.error || errData.full || 'Falha ao vincular avatar ao perfil')
      }

      refetch() 
      
      const cachedUser = localStorage.getItem('edu-current-user')
      if (cachedUser) {
         try {
           const parsedUser = JSON.parse(cachedUser)
           if (targetResp?.email && parsedUser.email?.toLowerCase() === targetResp.email.toLowerCase()) {
             parsedUser.foto = uploadRes.url
             localStorage.setItem('edu-current-user', JSON.stringify(parsedUser))
             setCurrentUser(parsedUser)
             window.dispatchEvent(new Event('storage'))
           }
         } catch(e) {}
      }

    } catch (err: any) {
      alert('Erro ao atualizar avatar: ' + err.message)
    } finally {
      setUploadingAvatarId(null)
      setSelectedRespId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const [activeTab, setActiveTab] = useState<'geral' | 'responsaveis' | 'saude'>('geral')
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [isEditingPhone, setIsEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Atualizar o state do input se o aluno carregar depois do hook inicial
  React.useEffect(() => {
    if (aluno) {
      setEmailInput(aluno.email || '')
      setPhoneInput(aluno.telefone || '')
    }
  }, [aluno?.email, aluno?.telefone])

  if (error) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 100, color: '#ef4444' }}>
      Erro ao carregar perfil: {(error as Error).message}
    </div>
  )

  if (isLoading || !aluno) return (
    <div className="flex items-center justify-center h-full text-slate-500 font-medium p-8">
      <LoadingGlass />
    </div>
  )

  const handleSaveField = async (field: 'email' | 'telefone', value: string) => {
    try {
      setIsSaving(true)
      const res = await fetch(`/api/alunos/${aluno.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      
      // Atualiza apenas localmente para a UI refletir a mudança,
      // sem chamar setAlunos (o que dispararia um POST com 10MB de dados da coleção inteira).
      aluno[field] = value
      
      if (field === 'email') setIsEditingEmail(false)
      if (field === 'telefone') setIsEditingPhone(false)
    } catch (err) {
      alert('Erro ao atualizar: ' + (err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const responsaveisList = (aluno as any).responsaveis || (aluno as any)._responsaveis || [
    { nome: aluno.responsavel || 'Responsável Financeiro', parentesco: 'Responsável', telefone: aluno.telefone, email: aluno.email, tipo: 'Ambos' }
  ]
  const saude = (aluno as any).saude || {}

  // Animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  } as const

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  } as const

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 80, fontFamily: 'Outfit, Inter, sans-serif' }}>
      


      {/* Modern Tabs Navigation */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {[
          { id: 'geral', label: 'Dados Gerais', icon: <Contact size={16} /> },
          { id: 'responsaveis', label: 'Responsáveis & Autorizações', icon: <ShieldCheck size={16} /> },
          { id: 'saude', label: 'Ficha Médica', icon: <HeartPulse size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 24px', borderRadius: 100, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700,
              whiteSpace: 'nowrap', flexShrink: 0,
              background: activeTab === tab.id ? '#4f46e5' : 'hsl(var(--bg-surface))',
              color: activeTab === tab.id ? 'white' : 'hsl(var(--text-muted))',
              boxShadow: activeTab === tab.id ? '0 8px 16px rgba(79, 70, 229, 0.25)' : '0 2px 8px rgba(0,0,0,0.02)',
              transition: 'all 0.3s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <AnimatePresence mode="wait">
          
          {/* TAB: GERAL */}
          {activeTab === 'geral' && (
            <motion.div key="geral" variants={itemVariants} exit={{ opacity: 0, y: -20 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
              
              <div style={{ background: 'hsl(var(--bg-surface))', padding: 32, borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 12px 40px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserCog size={20} color="#4f46e5" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Informações do Aluno</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', letterSpacing: 0.5, marginBottom: 4 }}>Data de Nascimento</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-main))', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CalendarDays size={16} color="#94a3b8" /> {(aluno.dataNascimento || aluno.data_nascimento) ? formatDate(aluno.dataNascimento || aluno.data_nascimento) : 'Não informado'}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5 }}>E-mail do Aluno</div>
                        {!isEditingEmail && <button onClick={() => { setIsEditingEmail(true); setEmailInput(aluno.email || '') }} style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', padding: 4 }}><Edit3 size={14} /></button>}
                      </div>
                      {isEditingEmail ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input 
                            value={emailInput} 
                            onChange={e => setEmailInput(e.target.value)} 
                            placeholder="aluno@email.com"
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleSaveField('email', emailInput)} disabled={isSaving} style={{ flex: 1, padding: '8px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>{isSaving ? '...' : 'Salvar'}</button>
                            <button onClick={() => setIsEditingEmail(false)} disabled={isSaving} style={{ flex: 1, padding: '8px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', wordBreak: 'break-all' }}>{aluno.email || 'Não cadastrado'}</div>
                      )}
                    </div>

                    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5 }}>Telefone / Celular</div>
                        {!isEditingPhone && <button onClick={() => { setIsEditingPhone(true); setPhoneInput(aluno.telefone || '') }} style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', padding: 4 }}><Edit3 size={14} /></button>}
                      </div>
                      {isEditingPhone ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input 
                            value={phoneInput} 
                            onChange={e => setPhoneInput(e.target.value)} 
                            placeholder="(00) 00000-0000"
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleSaveField('telefone', phoneInput)} disabled={isSaving} style={{ flex: 1, padding: '8px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>{isSaving ? '...' : 'Salvar'}</button>
                            <button onClick={() => setIsEditingPhone(false)} disabled={isSaving} style={{ flex: 1, padding: '8px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>{aluno.telefone || 'Não cadastrado'}</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', letterSpacing: 0.5, marginBottom: 4 }}>Endereço Residencial</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-main))', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.4 }}>
                      <MapPin size={16} color="#94a3b8" style={{ marginTop: 2 }} /> 
                      {aluno.endereco ? `${aluno.endereco}, ${aluno.numero || 'S/N'} - ${aluno.bairro || 'Bairro'} - ${aluno.cidade || 'Cidade'}` : 'Endereço não cadastrado no sistema.'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', padding: 32, borderRadius: 24, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 16 }}>
                <FileText size={48} color="#94a3b8" strokeWidth={1.5} />
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#334155', marginBottom: 8 }}>Documentos do Aluno</h4>
                  <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.5 }}>Histórico escolar, certidão de nascimento e contratos estão disponíveis na central de documentos.</p>
                </div>
                <button style={{ background: 'white', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '10px 24px', borderRadius: 100, fontSize: 14, fontWeight: 800, marginTop: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.02)', cursor: 'pointer' }}>
                  Acessar Documentos
                </button>
              </div>

            </motion.div>
          )}

          {/* TAB: RESPONSAVEIS */}
          {activeTab === 'responsaveis' && (
            <motion.div key="responsaveis" variants={itemVariants} exit={{ opacity: 0, y: -20 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
              
              <div style={{ gridColumn: '1 / -1', background: 'hsl(var(--bg-surface))', padding: 32, borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 12px 40px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldAlert size={20} color="#d97706" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Contatos e Autorizados</h3>
                      <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 500 }}>Pessoas responsáveis e autorizadas a retirar o aluno.</div>
                    </div>
                  </div>
                </div>

                {/* Responsaveis Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {responsaveisList.map((resp: any, i: number) => {
                    const isFin = resp.respFinanceiro || resp.financeiro || resp.tipo === 'Financeiro' || resp.tipo === 'Ambos'
                    const isPed = resp.respPedagogico || resp.pedagogico || resp.tipo === 'Pedagógico' || resp.tipo === 'Ambos'
                    
                    // Se for o mesmo usuário logado, damos preferência à foto que já está na memória principal (sidebar)
                    const isSameUser = (resp.email && currentUser?.email && resp.email.toLowerCase() === currentUser.email.toLowerCase()) || 
                                       (resp.nome && currentUser?.nome && resp.nome.toLowerCase() === currentUser.nome.toLowerCase());
                    const displayFoto = isSameUser ? (currentUser?.foto || resp.foto || resp.dados?.foto) : (resp.foto || resp.dados?.foto);
                    
                    return (
                      <div key={i} style={{ padding: 20, borderRadius: 20, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-main))', display: 'flex', flexDirection: 'column', gap: 16, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#c7d2fe'} onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div 
                              onClick={() => {
                                if (resp.id) {
                                  setSelectedRespId(resp.id)
                                  fileInputRef.current?.click()
                                }
                              }}
                              style={{ 
                                width: 44, height: 44, borderRadius: 14, 
                                background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                fontWeight: 800, color: '#475569', fontSize: 16,
                                position: 'relative', overflow: 'hidden', cursor: resp.id ? 'pointer' : 'default'
                              }}
                            >
                              {uploadingAvatarId === resp.id ? (
                                <Loader2 size={20} className="animate-spin" color="#475569" />
                              ) : displayFoto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={displayFoto} alt={resp.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                getInitials(resp.nome)
                              )}
                              
                              {/* Overlay de hover para edição */}
                              {resp.id && !uploadingAvatarId && (
                                <div className="avatar-edit-overlay" style={{
                                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                  background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  opacity: 0, transition: 'opacity 0.2s'
                                }}>
                                  <Camera size={18} color="white" />
                                </div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 15, color: 'hsl(var(--text-main))', textTransform: 'capitalize' }}>{resp.nome}</div>
                              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase' }}>{resp.parentesco || 'Responsável'}</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {isFin && <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#dcfce7', color: '#166534' }}>FINANCEIRO</span>}
                          {isPed && <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#e0e7ff', color: '#3730a3' }}>PEDAGÓGICO</span>}
                          {!isFin && !isPed && <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#f1f5f9', color: '#475569' }}>AUTORIZADO</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                          {resp.telefone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'hsl(var(--text-main))', fontWeight: 600 }}><Phone size={14} color="#64748b" /> {resp.telefone}</div>}
                          {resp.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'hsl(var(--text-main))', fontWeight: 600 }}><Mail size={14} color="#64748b" /> {resp.email}</div>}
                        </div>
                      </div>
                    )
                  })}
                  
                  {saude.autorizados?.map((aut: any, idx: number) => (
                    <div key={`aut-${idx}`} style={{ padding: 20, borderRadius: 20, border: '1px dashed #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#64748b', fontSize: 16 }}>
                          {getInitials(aut.nome)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#334155', textTransform: 'capitalize' }}>{aut.nome}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{aut.parentesco || 'Terceiro Autorizado'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#f1f5f9', color: '#475569' }}>APENAS RETIRADA</span>
                      </div>
                      {aut.telefone && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, borderTop: '1px dashed #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', fontWeight: 600 }}><Phone size={14} color="#94a3b8" /> {aut.telefone}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Saída Info */}
              <div style={{ gridColumn: '1 / -1', padding: 24, borderRadius: 20, background: saude.autorizaSaida ? '#f0fdf4' : '#fef2f2', border: `1px solid ${saude.autorizaSaida ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: saude.autorizaSaida ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: saude.autorizaSaida ? '#166534' : '#991b1b' }}>
                  {saude.autorizaSaida ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: saude.autorizaSaida ? '#166534' : '#991b1b', marginBottom: 4 }}>
                    {saude.autorizaSaida ? 'Saída Independente Autorizada' : 'Saída Restrita'}
                  </h4>
                  <p style={{ margin: 0, fontSize: 14, color: saude.autorizaSaida ? '#15803d' : '#b91c1c', fontWeight: 500 }}>
                    {saude.autorizaSaida ? 'O aluno tem permissão para sair sozinho das dependências da escola.' : 'O aluno NÃO pode sair sozinho. Requer acompanhante autorizado para a retirada.'}
                  </p>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB: SAÚDE */}
          {activeTab === 'saude' && (
            <motion.div key="saude" variants={itemVariants} exit={{ opacity: 0, y: -20 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
              
              <div style={{ background: 'hsl(var(--bg-surface))', padding: 32, borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 12px 40px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <HeartPulse size={20} color="#db2777" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Ficha Médica</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Alergias Card (Pulse animation if allergies exist) */}
                  <motion.div 
                    animate={saude.alergias ? { scale: [1, 1.02, 1] } : {}} 
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    style={{ padding: 24, borderRadius: 16, background: saude.alergias ? '#fef2f2' : '#f8fafc', border: `1px solid ${saude.alergias ? '#fecaca' : '#e2e8f0'}`, position: 'relative', overflow: 'hidden' }}
                  >
                    {saude.alergias && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 6, background: '#ef4444' }} />}
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: saude.alergias ? '#dc2626' : '#64748b', letterSpacing: 0.5, marginBottom: 8 }}>Restrições Médicas / Alergias</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: saude.alergias ? '#991b1b' : '#334155' }}>
                      {saude.alergias || 'Nenhuma restrição alimentar ou alergia reportada na matrícula.'}
                    </div>
                  </motion.div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ padding: 20, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', letterSpacing: 0.5, marginBottom: 4 }}>Plano de Saúde</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-main))' }}>{saude.planoSaude || 'Não informado'}</div>
                    </div>
                    <div style={{ padding: 20, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', letterSpacing: 0.5, marginBottom: 4 }}>Tipo Sanguíneo</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-main))' }}>{saude.tipoSanguineo || 'Não informado'}</div>
                    </div>
                  </div>

                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      {/* Hidden File Input for Avatar Upload */}
      <input 
        type="file" 
        accept="image/jpeg, image/png, image/webp" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleAvatarChange} 
      />

      <style dangerouslySetInnerHTML={{__html: `
        /* Adicionando hover ao overlay de edição do avatar */
        .avatar-edit-overlay:hover {
          opacity: 1 !important;
        }
      `}} />
    </div>
  )
}
