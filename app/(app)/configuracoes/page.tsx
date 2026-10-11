'use client'

import { useState, useRef, useEffect } from 'react'
import { Save, Shield, Bell, Palette, Eye, EyeOff, Upload, RefreshCw, Plus, Trash2, CheckCircle, ChevronRight, Lock, Pencil, Loader2 } from 'lucide-react'
import { useApp } from '@/lib/context'
import { newId } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import BackupSection from '@/components/configuracoes/BackupSection'
import MediaManagerSection from '@/components/configuracoes/MediaManagerSection'
import { FormModal, ConfirmModal } from '@/components/ui/CrudModal'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'

/* ─── Section definitions ─────────────────────────────────────── */
const CONFIG_SECTIONS = [
  { id: 'aparencia',   icon: '🎨', label: 'Aparência & White-label', desc: 'Logo, cores, tema, sidebar' },
  { id: 'notificacoes',icon: '🔔', label: 'Notificações', desc: 'Email, push, SMS, WhatsApp' },
  { id: 'seguranca',   icon: '🔒', label: 'Segurança & LGPD', desc: 'Senha, 2FA, auditoria' },
  { id: 'backup',      icon: '💾', label: 'Backup & Exportação', desc: 'Exportar dados reais do sistema' },
  { id: 'midia',       icon: '📁', label: 'Mídia & Arquivos', desc: 'Gerenciador de arquivos do banco de dados' },
]

type ToggleState = Record<string, boolean>

/* ══════════════════════════════════════════════════════════════ */
export default function ConfiguracoesPage() {
  const { theme, setTheme, sidebarTheme, setSidebarTheme, currentUserPerfil } = useApp()
  const [section, setSection] = useState('aparencia')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  /* Logo persisted in localStorage e no banco */
  const [logoDataUrl, setLogoDataUrl] = useLocalStorage<string | null>('edu-logo', null)
  /* School name persisted */
  const [schoolName, setSchoolName] = useLocalStorage<string>('edu-school-name', 'IMPACTO EDU')
  const logoInputRef = useRef<HTMLInputElement>(null)

  /* Appearance state */
  const [primaryColor, setPrimaryColor] = useLocalStorage<string>('edu-primary-color', '#3b82f6')
  const [accentColor, setAccentColor] = useLocalStorage<string>('edu-accent-color', '#8b5cf6')
  const [domain, setDomain] = useLocalStorage<string>('edu-domain', '')
  const [slogan, setSlogan] = useLocalStorage<string>('edu-slogan', '')

  /* Security / notifications / integrations */
  const [securityToggles, setSecurityToggles] = useLocalStorage<ToggleState>('edu-security', { twofa: false, sessoes: false, auditoria: true, inatividade: true, lgpd: true })
  const [notifToggles, setNotifToggles] = useLocalStorage<ToggleState>('edu-notif', { email: false, push: false, whatsapp: false, sms: false, telegram: false })

  // Sincroniza a aba ativa com parâmetro de URL (?aba=midia)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('aba') || params.get('secao') || params.get('tab')
      if (tab && CONFIG_SECTIONS.some(s => s.id === tab)) {
        setSection(tab)
      }
    }
  }, [])

  const changeSection = (id: string) => {
    setSection(id)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('aba', id)
      window.history.replaceState({}, '', url.toString())
    }
  }

  // Carrega configurações persistidas no banco na inicialização
  useEffect(() => {
    fetch('/api/configuracoes?chaves=edu-school-name,edu-primary-color,edu-accent-color,edu-domain,edu-slogan,edu-security,edu-notif,cfgEscolaLogo')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          if (data['edu-school-name']) setSchoolName(data['edu-school-name'])
          if (data['edu-primary-color']) setPrimaryColor(data['edu-primary-color'])
          if (data['edu-accent-color']) setAccentColor(data['edu-accent-color'])
          if (data['edu-domain']) setDomain(data['edu-domain'])
          if (data['edu-slogan']) setSlogan(data['edu-slogan'])
          if (data['edu-security']) setSecurityToggles(data['edu-security'])
          if (data['edu-notif']) setNotifToggles(data['edu-notif'])
          if (data['cfgEscolaLogo']) setLogoDataUrl(data['cfgEscolaLogo'])
        }
      })
      .catch(err => console.warn('Erro ao carregar configurações do banco:', err))
  }, [])

  const toggle = (state: ToggleState, setState: (v: ToggleState) => void, key: string) => setState({ ...state, [key]: !state[key] })

  // Salvar alterações de forma persistente no banco de dados
  const handleSave = async () => {
    setSaving(true)
    try {
      const items = [
        { chave: 'edu-school-name', valor: schoolName },
        { chave: 'edu-primary-color', valor: primaryColor },
        { chave: 'edu-accent-color', valor: accentColor },
        { chave: 'edu-domain', valor: domain },
        { chave: 'edu-slogan', valor: slogan },
        { chave: 'edu-security', valor: securityToggles },
        { chave: 'edu-notif', valor: notifToggles },
      ]
      if (logoDataUrl) {
        items.push({ chave: 'cfgEscolaLogo', valor: logoDataUrl })
      }

      const res = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Falha ao salvar configurações.')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar alterações.')
    } finally {
      setSaving(false)
    }
  }

  /* Logo upload com upload direto para o Storage */
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const result = await uploadFileToSupabase({
        bucket: 'comunicados-midia',
        folder: 'avatars',
        file,
        usageType: 'fixed'
      })
      if (result.ok && result.url) {
        setLogoDataUrl(result.url)
      } else {
        const reader = new FileReader()
        reader.onload = ev => setLogoDataUrl(ev.target?.result as string)
        reader.readAsDataURL(file)
      }
    } catch {
      const reader = new FileReader()
      reader.onload = ev => setLogoDataUrl(ev.target?.result as string)
      reader.readAsDataURL(file)
    } finally {
      setUploadingLogo(false)
    }
  }

  const Toggle = ({ active, onToggle }: { active: boolean; onToggle: () => void }) => (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 100, background: active ? '#3b82f6' : 'hsl(var(--bg-overlay))', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: active ? 22 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ color: '#0f172a' }}>Configurações do Sistema</h1>
          <p className="page-subtitle" style={{ color: '#64748b' }}>Gerenciamento, segurança e personalização da plataforma</p>
        </div>
        <button 
          className="btn btn-primary btn-sm" 
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={13} /> Salvando...
            </>
          ) : saved ? (
            <>
              <CheckCircle size={13} style={{ color: '#34d399' }} /> Salvo!
            </>
          ) : (
            <>
              <Save size={13} /> Salvar Alterações
            </>
          )}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Sidebar navigation */}
        <div className="card" style={{ padding: '10px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          {CONFIG_SECTIONS.map(s => (
            <button 
              key={s.id} 
              onClick={() => changeSection(s.id)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                padding: '12px', 
                borderRadius: 8, 
                width: '100%', 
                textAlign: 'left', 
                background: section === s.id ? 'rgba(59,130,246,0.1)' : 'transparent', 
                border: `1px solid ${section === s.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`, 
                cursor: 'pointer', 
                marginBottom: 2 
              }}
            >
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: section === s.id ? '#2563eb' : '#0f172a' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{s.desc}</div>
              </div>
              {section === s.id && <ChevronRight size={14} color="#2563eb" />}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── APARÊNCIA ── */}
          {section === 'aparencia' && (
            <>
              {/* Identidade Visual / Nome e Logo */}
              <div className="card" style={{ padding: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#0f172a' }}>🏫 Identidade da Escola</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
                  <div>
                    <label className="form-label" style={{ color: '#0f172a' }}>Nome da Instituição</label>
                    <input 
                      className="form-input" 
                      value={schoolName} 
                      onChange={e => setSchoolName(e.target.value)} 
                      style={{ color: '#0f172a', background: '#ffffff', borderColor: '#cbd5e1', fontSize: 14, fontWeight: 600 }} 
                      placeholder="Ex: COLEGIO IMPACTO"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ color: '#0f172a' }}>Logotipo</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input 
                        ref={logoInputRef}
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                        style={{ display: 'none' }} 
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                      >
                        {uploadingLogo ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
                        {logoDataUrl ? 'Alterar Logo' : 'Enviar Logo'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colors + Theme */}
              <div className="card" style={{ padding: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#0f172a' }}>🖌 Paleta de Cores & Tema</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Cor primária', value: primaryColor, setter: setPrimaryColor },
                    { label: 'Cor de destaque', value: accentColor, setter: setAccentColor },
                  ].map(c => (
                    <div key={c.label}>
                      <label className="form-label" style={{ color: '#0f172a' }}>{c.label}</label>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="color" value={c.value} onChange={e => c.setter(e.target.value)} style={{ width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 2, background: 'transparent' }} />
                        <input className="form-input" value={c.value} onChange={e => c.setter(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 13, color: '#0f172a', background: '#ffffff', borderColor: '#cbd5e1' }} />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="form-label" style={{ color: '#0f172a' }}>Tema padrão</label>
                    <select className="form-input" value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light')} style={{ color: '#0f172a', background: '#ffffff', borderColor: '#cbd5e1' }}>
                      <option value="dark">🌙 Dark</option>
                      <option value="light">☀️ Light</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ color: '#0f172a' }}>Cor da Sidebar</label>
                    <select className="form-input" value={sidebarTheme} onChange={e => setSidebarTheme(e.target.value as 'dark' | 'light')} style={{ color: '#0f172a', background: '#ffffff', borderColor: '#cbd5e1' }}>
                      <option value="dark">🌑 Dark sidebar</option>
                      <option value="light">🟡 Light sidebar</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 16, padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Pré-visualização:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {logoDataUrl ? (
                      <img src={logoDataUrl} alt="Logo" style={{ height: 36, objectFit: 'contain', borderRadius: 6 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>
                        {schoolName[0] || 'E'}
                      </div>
                    )}
                    <span style={{ fontWeight: 800, fontSize: 16, fontFamily: 'Outfit, sans-serif', color: primaryColor }}>{schoolName}</span>
                    <button style={{ background: accentColor, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>Botão destaque</button>
                  </div>
                </div>
              </div>

              {/* Domain */}
              <div className="card" style={{ padding: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#0f172a' }}>🌐 Domínio Personalizado</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label className="form-label" style={{ color: '#0f172a' }}>Subdomínio ou domínio próprio</label>
                    <input className="form-input" value={domain} onChange={e => setDomain(e.target.value)} style={{ fontFamily: 'monospace', color: '#0f172a', background: '#ffffff', borderColor: '#cbd5e1' }} placeholder="app.suaescola.com.br" />
                  </div>
                  <button className="btn btn-primary btn-sm"><CheckCircle size={13} />Verificar DNS</button>
                </div>
              </div>

            </>
          )}

          {/* ── NOTIFICAÇÕES ── */}
          {section === 'notificacoes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card" style={{ padding: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#0f172a' }}>🔔 Canais de Notificação</div>
                {[
                  { key: 'email', canal: '📧 E-mail', desc: 'Comunicados automáticos por e-mail' },
                  { key: 'push', canal: '📱 Push Web', desc: 'Notificações no navegador' },
                  { key: 'whatsapp', canal: '📲 WhatsApp Business', desc: 'Mensagens via API WhatsApp' },
                  { key: 'sms', canal: '💬 SMS', desc: 'SMS para urgências e cobranças' },
                  { key: 'telegram', canal: '🤖 Bot Telegram', desc: 'Relatórios diários por bot' },
                ].map(n => (
                  <div key={n.key} style={{ display: 'flex', gap: 14, padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{n.canal}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <span className={`badge ${notifToggles[n.key] ? 'badge-success' : 'badge-neutral'}`}>{notifToggles[n.key] ? '✓ Ativo' : 'Inativo'}</span>
                    <Toggle active={notifToggles[n.key]} onToggle={() => toggle(notifToggles, setNotifToggles, n.key)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SEGURANÇA ── */}
          {section === 'seguranca' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#0f172a' }}>🔒 Políticas de Segurança</div>
                {[
                  { key: 'twofa', label: 'Autenticação em 2 fatores (2FA)', desc: 'Exigir para todos os administradores' },
                  { key: 'sessoes', label: 'Sessões simultâneas limitadas', desc: 'Limitar a 1 sessão ativa por usuário' },
                  { key: 'auditoria', label: 'Auditoria de acessos', desc: 'Registrar todas as ações no sistema' },
                  { key: 'inatividade', label: 'Bloqueio por inatividade', desc: 'Deslogar após 30 minutos sem atividade' },
                  { key: 'lgpd', label: 'Conformidade LGPD', desc: 'Dados pessoais sob termo de consentimento' },
                ].map(opt => (
                  <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    <Toggle active={securityToggles[opt.key]} onToggle={() => toggle(securityToggles, setSecurityToggles, opt.key)} />
                  </div>
                ))}
              </div>
              <div className="card" style={{ padding: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#0f172a' }}>🔑 Chave de API do sistema</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <input className="form-input" style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: '#0f172a', background: '#ffffff', borderColor: '#cbd5e1' }} type={showKey ? 'text' : 'password'} value="sk_live_impacto_edu_2026_placeholder" readOnly />
                  <button className="btn btn-ghost btn-icon" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  <button className="btn btn-secondary btn-sm"><RefreshCw size={13} />Regenerar</button>
                </div>
              </div>
            </div>
          )}

          {/* ── BACKUP ── */}
          {section === 'backup' && <BackupSection />}

          {/* ── MÍDIA ── */}
          {section === 'midia' && <MediaManagerSection />}
        </div>
      </div>
    </div>
  )
}
