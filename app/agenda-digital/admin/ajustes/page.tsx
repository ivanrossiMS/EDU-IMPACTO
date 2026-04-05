'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, Shield, Bell, Smartphone, Palette, Save, Clock, CheckCircle2, Upload } from 'lucide-react'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

export default function ADAdminAjustes() {
  const { bannerUrl, setBannerUrl, adConfig, setAdConfig, adAlert } = useAgendaDigital()
  const [activeTab, setActiveTab] = useState('permissoes')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [localConfig, setLocalConfig] = useState(adConfig)
  const [localBanner, setLocalBanner] = useState(bannerUrl)

  useEffect(() => {
    setLocalConfig(adConfig)
  }, [adConfig])

  useEffect(() => {
    setLocalBanner(bannerUrl)
  }, [bannerUrl])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setLocalBanner(event.target.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = () => {
    setAdConfig(localConfig)
    if (localBanner !== undefined) {
      setBannerUrl(localBanner)
    }
    adAlert('Configurações salvas com sucesso no sistema global!', 'Sucesso')
  }

  const updatePerm = (key: keyof typeof localConfig.permissoes, val: boolean) => {
    setLocalConfig(p => ({ ...p, permissoes: { ...p.permissoes, [key]: val } }))
  }

  const updateNotif = (key: keyof typeof localConfig.notificacoes, val: boolean) => {
    setLocalConfig(p => ({ ...p, notificacoes: { ...p.notificacoes, [key]: val } }))
  }

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Ajustes do Aplicativo</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Configurações de permissões, horários de atendimento e personalização.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" style={{ background: '#4f46e5', color: 'white' }} onClick={handleSave}>
            <Save size={16} /> Salvar Alterações
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32, flex: 1, minHeight: 0 }}>
         {/* Sidebar Navigation */}
         <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button 
              onClick={() => setActiveTab('permissoes')}
              className={activeTab === 'permissoes' ? 'btn' : 'btn btn-ghost'} 
              style={{ justifyContent: 'flex-start', background: activeTab === 'permissoes' ? 'rgba(79,70,229,0.1)' : 'transparent', color: activeTab === 'permissoes' ? '#4f46e5' : 'inherit' }}
            >
              <Shield size={18} style={{ marginRight: 8 }}/> Permissões e Uso
            </button>
            <button 
              onClick={() => setActiveTab('notificacoes')}
              className={activeTab === 'notificacoes' ? 'btn' : 'btn btn-ghost'} 
              style={{ justifyContent: 'flex-start', background: activeTab === 'notificacoes' ? 'rgba(79,70,229,0.1)' : 'transparent', color: activeTab === 'notificacoes' ? '#4f46e5' : 'inherit' }}
            >
              <Bell size={18} style={{ marginRight: 8 }}/> Notificações Push
            </button>
            <button 
              onClick={() => setActiveTab('horarios')}
              className={activeTab === 'horarios' ? 'btn' : 'btn btn-ghost'} 
              style={{ justifyContent: 'flex-start', background: activeTab === 'horarios' ? 'rgba(79,70,229,0.1)' : 'transparent', color: activeTab === 'horarios' ? '#4f46e5' : 'inherit' }}
            >
              <Clock size={18} style={{ marginRight: 8 }}/> Horários de Atendimento
            </button>
            <button 
              onClick={() => setActiveTab('personalizacao')}
              className={activeTab === 'personalizacao' ? 'btn' : 'btn btn-ghost'} 
              style={{ justifyContent: 'flex-start', background: activeTab === 'personalizacao' ? 'rgba(79,70,229,0.1)' : 'transparent', color: activeTab === 'personalizacao' ? '#4f46e5' : 'inherit' }}
            >
              <Palette size={18} style={{ marginRight: 8 }}/> Personalização (Cores)
            </button>
         </div>

         {/* Content Area */}
         <div className="card" style={{ flex: 1, overflowY: 'auto', background: 'hsl(var(--bg-surface))' }}>
           {activeTab === 'permissoes' && (
             <div>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0' }}>Permissões das Famílias</h3>
                  <p style={{ margin: 0, color: 'hsl(var(--text-muted))', fontSize: 14 }}>O que os responsáveis podem ou não fazer dentro do aplicativo escolar.</p>
                </div>

                <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, border: '1px solid hsl(var(--border-subtle))', borderRadius: 12 }}>
                     <div>
                       <div style={{ fontWeight: 600, fontSize: 16 }}>Abrir novos chamados (Chat)</div>
                       <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Se desativado, os pais só poderão responder a mensagens iniciadas pela escola.</div>
                     </div>
                     <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                        <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={localConfig.permissoes.chat} onChange={e => updatePerm('chat', e.target.checked)} />
                        <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: localConfig.permissoes.chat ? '#10b981' : 'hsl(var(--border-subtle))', borderRadius: 24, transition: '.4s' }}>
                           <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.4s', borderRadius: '50%', transform: localConfig.permissoes.chat ? 'translateX(20px)' : 'none' }}></span>
                        </span>
                     </label>
                   </div>

                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, border: '1px solid hsl(var(--border-subtle))', borderRadius: 12 }}>
                     <div>
                       <div style={{ fontWeight: 600, fontSize: 16 }}>Solicitar Segunda Via (Boletos API)</div>
                       <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Permite que as famílias atualizem e gerem boletos atrasados diretamente no App.</div>
                     </div>
                     <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                        <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={localConfig.permissoes.segundaVia} onChange={e => updatePerm('segundaVia', e.target.checked)} />
                        <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: localConfig.permissoes.segundaVia ? '#10b981' : 'hsl(var(--border-subtle))', borderRadius: 24, transition: '.4s' }}>
                           <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.4s', borderRadius: '50%', transform: localConfig.permissoes.segundaVia ? 'translateX(20px)' : 'none' }}></span>
                        </span>
                     </label>
                   </div>

                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, border: '1px solid hsl(var(--border-subtle))', borderRadius: 12 }}>
                     <div>
                       <div style={{ fontWeight: 600, fontSize: 16 }}>Comentários no Mural (Momentos)</div>
                       <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Habilita comentários na rede social interna da escola. Recomenda-se moderação.</div>
                     </div>
                     <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                        <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={localConfig.permissoes.comentariosMural} onChange={e => updatePerm('comentariosMural', e.target.checked)} />
                        <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: localConfig.permissoes.comentariosMural ? '#10b981' : 'hsl(var(--border-subtle))', borderRadius: 24, transition: '.4s' }}>
                           <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.4s', borderRadius: '50%', transform: localConfig.permissoes.comentariosMural ? 'translateX(20px)' : 'none' }}></span>
                        </span>
                     </label>
                   </div>
                </div>
             </div>
           )}

           {activeTab === 'notificacoes' && (
             <div>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0' }}>Notificações Push no App</h3>
                  <p style={{ margin: 0, color: 'hsl(var(--text-muted))', fontSize: 14 }}>Controle quais eventos disparam alertas no celular dos responsáveis.</p>
                </div>

                <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, border: '1px solid hsl(var(--border-subtle))', borderRadius: 12 }}>
                     <div>
                       <div style={{ fontWeight: 600, fontSize: 16 }}>Disparar em Novos Comunicados</div>
                       <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Sempre que a coordenação enviar um comunicado geral ou turma.</div>
                     </div>
                     <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                        <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={localConfig.notificacoes.pushComunicados} onChange={e => updateNotif('pushComunicados', e.target.checked)} />
                        <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: localConfig.notificacoes.pushComunicados ? '#10b981' : 'hsl(var(--border-subtle))', borderRadius: 24, transition: '.4s' }}>
                           <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.4s', borderRadius: '50%', transform: localConfig.notificacoes.pushComunicados ? 'translateX(20px)' : 'none' }}></span>
                        </span>
                     </label>
                   </div>
                   
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, border: '1px solid hsl(var(--border-subtle))', borderRadius: 12 }}>
                     <div>
                       <div style={{ fontWeight: 600, fontSize: 16 }}>Disparar em Novos Momentos</div>
                       <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Aumenta o engajamento enviando Push quando uma foto da criança é postada.</div>
                     </div>
                     <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                        <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={localConfig.notificacoes.pushMomentos} onChange={e => updateNotif('pushMomentos', e.target.checked)} />
                        <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: localConfig.notificacoes.pushMomentos ? '#10b981' : 'hsl(var(--border-subtle))', borderRadius: 24, transition: '.4s' }}>
                           <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.4s', borderRadius: '50%', transform: localConfig.notificacoes.pushMomentos ? 'translateX(20px)' : 'none' }}></span>
                        </span>
                     </label>
                   </div>
                   
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, border: '1px solid hsl(var(--border-subtle))', borderRadius: 12 }}>
                     <div>
                       <div style={{ fontWeight: 600, fontSize: 16 }}>Disparar Alertas Financeiros</div>
                       <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Lembrete de vencimento próximo ou parcela vencida.</div>
                     </div>
                     <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                        <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={localConfig.notificacoes.pushFinanceiro} onChange={e => updateNotif('pushFinanceiro', e.target.checked)} />
                        <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: localConfig.notificacoes.pushFinanceiro ? '#10b981' : 'hsl(var(--border-subtle))', borderRadius: 24, transition: '.4s' }}>
                           <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.4s', borderRadius: '50%', transform: localConfig.notificacoes.pushFinanceiro ? 'translateX(20px)' : 'none' }}></span>
                        </span>
                     </label>
                   </div>
                   
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, border: '1px solid hsl(var(--border-subtle))', borderRadius: 12 }}>
                     <div>
                       <div style={{ fontWeight: 600, fontSize: 16 }}>Eventos no Calendário (1 dia antes)</div>
                       <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Lembrete automático para eventos, reuniões e provas da turma.</div>
                     </div>
                     <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                        <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={localConfig.notificacoes.pushCalendario} onChange={e => updateNotif('pushCalendario', e.target.checked)} />
                        <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: localConfig.notificacoes.pushCalendario ? '#10b981' : 'hsl(var(--border-subtle))', borderRadius: 24, transition: '.4s' }}>
                           <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.4s', borderRadius: '50%', transform: localConfig.notificacoes.pushCalendario ? 'translateX(20px)' : 'none' }}></span>
                        </span>
                     </label>
                   </div>

                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, border: '1px solid hsl(var(--border-subtle))', borderRadius: 12 }}>
                     <div>
                       <div style={{ fontWeight: 600, fontSize: 16 }}>Novas Mensagens no Chat</div>
                       <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Avisa a família imediatamente quando a escola responde ou abre um chamado.</div>
                     </div>
                     <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                        <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={localConfig.notificacoes.pushMensagemChat} onChange={e => updateNotif('pushMensagemChat', e.target.checked)} />
                        <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: localConfig.notificacoes.pushMensagemChat ? '#10b981' : 'hsl(var(--border-subtle))', borderRadius: 24, transition: '.4s' }}>
                           <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.4s', borderRadius: '50%', transform: localConfig.notificacoes.pushMensagemChat ? 'translateX(20px)' : 'none' }}></span>
                        </span>
                     </label>
                   </div>
                </div>
             </div>
           )}

           {activeTab === 'horarios' && (
             <div>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0' }}>Controle de Horários</h3>
                  <p style={{ margin: 0, color: 'hsl(var(--text-muted))', fontSize: 14 }}>Defina o limite de atendimento para garantir o descanso da equipe (LGPD/Direitos Trabalhistas).</p>
                </div>

                <div style={{ padding: 32 }}>
                  <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Início Expediente App</label>
                      <input type="time" className="form-input" value={localConfig.horarios.inicio} onChange={e => setLocalConfig(p => ({...p, horarios: {...p.horarios, inicio: e.target.value}}))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Fim Expediente App</label>
                      <input type="time" className="form-input" value={localConfig.horarios.fim} onChange={e => setLocalConfig(p => ({...p, horarios: {...p.horarios, fim: e.target.value}}))} />
                    </div>
                  </div>

                  <div style={{ padding: 20, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <h4 style={{ color: '#ef4444', margin: '0 0 8px 0', fontSize: 16 }}>Mensagem de Ausência (Fora do Horário)</h4>
                    <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 12 }}>Esta mensagem é enviada automaticamente se a família enviar mensagens fora do horário.</p>
                    <textarea className="form-input" style={{ minHeight: 100, background: 'hsl(var(--bg-main))' }} value={localConfig.horarios.msgAusencia} onChange={e => setLocalConfig(p => ({...p, horarios: {...p.horarios, msgAusencia: e.target.value}}))}></textarea>
                  </div>
                </div>
             </div>
           )}

           {activeTab === 'personalizacao' && (
             <div>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0' }}>Identidade Visual</h3>
                  <p style={{ margin: 0, color: 'hsl(var(--text-muted))', fontSize: 14 }}>Personalize as cores e a imagem de capa da Área da Família.</p>
                </div>

                <div style={{ padding: 32 }}>
                  <div style={{ marginBottom: 32 }}>
                    <label className="form-label">Imagem de Capa (Banner Principal)</label>
                    <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 12 }}>Insira a URL direta ou faça upload de uma imagem panorâmica. (Recomendado: 1200x300px)</p>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ flex: 1 }}
                        placeholder="https://suaescola.com/upload/banner.jpg" 
                        value={localBanner || ''}
                        onChange={e => setLocalBanner(e.target.value)}
                      />
                      <input 
                        type="file" 
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                      <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={16} /> Fazer Upload
                      </button>
                    </div>
                    {localBanner && (
                      <div style={{ marginTop: 16, height: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
                        <img src={localBanner} alt="Preview Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                </div>
             </div>
           )}
         </div>
      </div>
    </div>
  )
}
