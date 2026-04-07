'use client'

import { useState, useRef } from 'react'
import { Save, Shield, Bell, Palette, Eye, EyeOff, Upload, RefreshCw, Plus, Trash2, CheckCircle, ChevronRight, Lock, Pencil } from 'lucide-react'
import { useApp } from '@/lib/context'
import { newId } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import TestDataSection from '@/components/configuracoes/TestDataSection'
import BackupSection from '@/components/configuracoes/BackupSection'
import ImportacaoDadosSection from '@/components/configuracoes/ImportacaoDadosSection'
import { FormModal, ConfirmModal } from '@/components/ui/CrudModal'

/* ─── Section definitions ─────────────────────────────────────── */
const CONFIG_SECTIONS = [
  { id: 'aparencia',   icon: '🎨', label: 'Aparência & White-label', desc: 'Logo, cores, tema, sidebar' },
  { id: 'notificacoes',icon: '🔔', label: 'Notificações', desc: 'Email, push, SMS, WhatsApp' },
  { id: 'integracoes', icon: '🔌', label: 'Integrações & APIs', desc: 'Webhooks, sistemas externos' },
  { id: 'seguranca',   icon: '🔒', label: 'Segurança & LGPD', desc: 'Senha, 2FA, auditoria' },
  { id: 'importacao',  icon: '📥', label: 'Importação de Dados', desc: 'CSV, XLSX, fotos e migração' },
  { id: 'ferramentas', icon: '🧪', label: 'Dados de Teste', desc: 'Inserir/excluir dados reais' },
  { id: 'backup',      icon: '💾', label: 'Backup & Exportação', desc: 'Exportar dados reais do sistema' },
]

const MODULES_CONFIG = [
  { key: 'academico', icon: '🎓', nome: 'Acadêmico' },
  { key: 'financeiro', icon: '💰', nome: 'Financeiro' },
  { key: 'rh', icon: '👤', nome: 'RH' },
  { key: 'comunicacao', icon: '💬', nome: 'Comunicação' },
  { key: 'ia', icon: '🤖', nome: 'Inteligência IA' },
  { key: 'bi', icon: '📊', nome: 'BI & Relatórios' },
  { key: 'relatorios', icon: '📑', nome: 'Relatórios Gov.' },
  { key: 'multiUnidades', icon: '🏫', nome: 'Multi-Unidades' },
  { key: 'transporte', icon: '🚌', nome: 'Transporte Escolar' },
  { key: 'cantina', icon: '🍽️', nome: 'Cantina' },
  { key: 'patrimonio', icon: '📦', nome: 'Patrimônio' },
  { key: 'almoxarifado', icon: '📚', nome: 'Almoxarifado' },
  { key: 'portais', icon: '🌐', nome: 'Portais' },
  { key: 'administrativo', icon: '🗂️', nome: 'Administrativo' },
  { key: 'crm', icon: '🎯', nome: 'CRM & Captação' },
]

const INTEGRACOES_LIST = [
  { id: 'google', nome: 'Google Workspace', icon: '🔵', desc: 'Gmail, Drive, Classroom e Meet', status: true, config: 'Domínio: @escola.com.br' },
  { id: 'pix', nome: 'PIX & Boleto Bancário', icon: '🏦', desc: 'Banco — Cobrança automática', status: true, config: 'Chave PIX configurada' },
  { id: 'whatsapp', nome: 'WhatsApp Business API', icon: '💬', desc: 'Comunicação com famílias', status: false, config: 'Não configurado' },
  { id: 'gemini', nome: 'Gemini / Google AI', icon: '🤖', desc: 'IA para Copilotos e Insights', status: false, config: 'Não configurado' },
  { id: 'mec', nome: 'EDUCACENSO / MEC', icon: '📊', desc: 'Censo Escolar INEP', status: false, config: 'INEP não configurado' },
  { id: 'stripe', nome: 'Stripe / Mercado Pago', icon: '💳', desc: 'Pagamentos com cartão', status: false, config: 'Não configurado' },
]

/* ─── User type ───────────────────────────────────────────────── */
interface SysUser {
  id: string; nome: string; email: string; perfil: string; status: 'ativo' | 'inativo'; twofa: boolean; ultimo_acesso: string
}
const USER_BLANK: Omit<SysUser, 'id'> = { nome: '', email: '', perfil: 'Professor', status: 'ativo', twofa: false, ultimo_acesso: '' }
const PERFIS = ['Diretor Geral', 'Coordenador', 'Secretária', 'Professor', 'Financeiro', 'Família']

type ToggleState = Record<string, boolean>

/* ══════════════════════════════════════════════════════════════ */
export default function ConfiguracoesPage() {
  const { theme, setTheme, sidebarTheme, setSidebarTheme, activeModules, setModuleActive, currentUserPerfil, setCurrentUserPerfil } = useApp()
  const isDiretorGeral = currentUserPerfil === 'Diretor Geral'
  const [section, setSection] = useState('aparencia')
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)

  /* Logo persisted in localStorage */
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
  const [integToggles, setIntegToggles] = useLocalStorage<ToggleState>('edu-integrations', Object.fromEntries(INTEGRACOES_LIST.map(i => [i.id, i.status])))

  const toggle = (state: ToggleState, setState: (v: ToggleState) => void, key: string) => setState({ ...state, [key]: !state[key] })

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  /* Logo upload handler */
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogoDataUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
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
          <h1 className="page-title">Configurações do Sistema</h1>
          <p className="page-subtitle">Gerenciamento, segurança e personalização da plataforma</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          {saved ? <><CheckCircle size={13} style={{ color: '#34d399' }} />Salvo!</> : <><Save size={13} />Salvar Alterações</>}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Sidebar navigation */}
        <div className="card" style={{ padding: '10px' }}>
          {CONFIG_SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 8, width: '100%', textAlign: 'left', background: section === s.id ? 'rgba(59,130,246,0.1)' : 'transparent', border: `1px solid ${section === s.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`, cursor: 'pointer', marginBottom: 2 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: section === s.id ? '#60a5fa' : 'hsl(var(--text-primary))' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>{s.desc}</div>
              </div>
              {section === s.id && <ChevronRight size={14} color="#60a5fa" />}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── APARÊNCIA ── */}
          {section === 'aparencia' && (
            <>
              {/* Logo — persisted to localStorage */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🎨 Logo & Identidade Visual</div>
                <div style={{ fontWeight: 400, fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 16 }}>
                  A logo aparece na <strong>sidebar</strong> (canto superior) e na <strong>tela de login</strong>. Ela é salva no navegador (localStorage).
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
                  <div>
                    <div style={{ width: 200, height: 120, borderRadius: 12, background: 'hsl(var(--bg-elevated))', border: '2px dashed hsl(var(--border-default))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden', cursor: 'pointer' }}
                      onClick={() => logoInputRef.current?.click()}>
                      {logoDataUrl ? (
                        <img src={logoDataUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                          <Upload size={24} style={{ marginBottom: 6 }} />
                          <div style={{ fontSize: 12 }}>Clique para carregar</div>
                        </div>
                      )}
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                    <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => logoInputRef.current?.click()}>
                      <Upload size={12} /> Carregar logo
                    </button>
                    {logoDataUrl && (
                      <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 6, justifyContent: 'center', color: '#f87171' }} onClick={() => setLogoDataUrl(null)}>
                        <Trash2 size={11} /> Remover
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label className="form-label">Nome exibido no sistema</label>
                      <input className="form-input" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Slogan / tagline</label>
                      <input className="form-input" value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="Ex: Educação de excelência" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Colors + Theme */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🖌 Paleta de Cores & Tema</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Cor primária', value: primaryColor, setter: setPrimaryColor },
                    { label: 'Cor de destaque', value: accentColor, setter: setAccentColor },
                  ].map(c => (
                    <div key={c.label}>
                      <label className="form-label">{c.label}</label>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="color" value={c.value} onChange={e => c.setter(e.target.value)} style={{ width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 2, background: 'transparent' }} />
                        <input className="form-input" value={c.value} onChange={e => c.setter(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 13 }} />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="form-label">Tema padrão</label>
                    <select className="form-input" value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light')}>
                      <option value="dark">🌙 Dark</option>
                      <option value="light">☀️ Light</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Cor da Sidebar</label>
                    <select className="form-input" value={sidebarTheme} onChange={e => setSidebarTheme(e.target.value as 'dark' | 'light')}>
                      <option value="dark">🌑 Dark sidebar</option>
                      <option value="light">🟡 Light sidebar</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 16, padding: '16px', background: 'hsl(var(--bg-elevated))', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 10 }}>Pré-visualização:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>{schoolName[0]}</div>
                    <span style={{ fontWeight: 800, fontSize: 16, fontFamily: 'Outfit, sans-serif', color: primaryColor }}>{schoolName}</span>
                    <button style={{ background: accentColor, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>Botão destaque</button>
                  </div>
                </div>
              </div>

              {/* Domain */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🌐 Domínio Personalizado</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label className="form-label">Subdomínio ou domínio próprio</label>
                    <input className="form-input" value={domain} onChange={e => setDomain(e.target.value)} style={{ fontFamily: 'monospace' }} placeholder="app.suaescola.com.br" />
                  </div>
                  <button className="btn btn-primary btn-sm"><CheckCircle size={13} />Verificar DNS</button>
                </div>
              </div>

              {/* Modules */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>📦 Módulos Ativos</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                      {isDiretorGeral ? 'Ativar/desativar remove ou adiciona a seção da sidebar imediatamente.' : 'Módulos gerenciados pelo Diretor Geral.'}
                    </div>
                  </div>
                  {/* Simulate perfil switch — for demo purposes */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Perfil ativo:</span>
                    <select className="form-input" style={{ fontSize: 12, padding: '4px 8px', height: 32 }}
                      value={currentUserPerfil} onChange={e => setCurrentUserPerfil(e.target.value)}>
                      {['Diretor Geral','Coordenador','Secretária','Professor','Financeiro','Família'].map(p => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {!isDiretorGeral && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, marginBottom: 14, fontSize: 12 }}>
                    <span style={{ fontSize: 16 }}>🔒</span>
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>Apenas o perfil <strong>Diretor Geral</strong> pode ativar ou desativar módulos.</span>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {MODULES_CONFIG.map(m => {
                    const ativo = activeModules[m.key] !== false
                    return (
                      <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: ativo ? 'rgba(59,130,246,0.06)' : 'hsl(var(--bg-elevated))', borderRadius: 8, border: `1px solid ${ativo ? 'rgba(59,130,246,0.2)' : 'hsl(var(--border-subtle))'}`, transition: 'all 0.2s' }}>
                        <span style={{ fontSize: 18, opacity: ativo ? 1 : 0.4 }}>{m.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: ativo ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}>{m.nome}</span>
                        {isDiretorGeral ? (
                          <div onClick={() => setModuleActive(m.key, !ativo)} style={{ width: 40, height: 22, borderRadius: 100, background: ativo ? '#3b82f6' : 'hsl(var(--bg-overlay))', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: ativo ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                          </div>
                        ) : (
                          <span className={`badge ${ativo ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                            {ativo ? '✓ Ativo' : 'Inativo'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── NOTIFICAÇÕES ── */}
          {section === 'notificacoes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔔 Canais de Notificação</div>
                {[
                  { key: 'email', canal: '📧 E-mail', desc: 'Comunicados automáticos por e-mail' },
                  { key: 'push', canal: '📱 Push Web', desc: 'Notificações no navegador' },
                  { key: 'whatsapp', canal: '📲 WhatsApp Business', desc: 'Mensagens via API WhatsApp' },
                  { key: 'sms', canal: '💬 SMS', desc: 'SMS para urgências e cobranças' },
                  { key: 'telegram', canal: '🤖 Bot Telegram', desc: 'Relatórios diários por bot' },
                ].map(n => (
                  <div key={n.key} style={{ display: 'flex', gap: 14, padding: '14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{n.canal}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <span className={`badge ${notifToggles[n.key] ? 'badge-success' : 'badge-neutral'}`}>{notifToggles[n.key] ? '✓ Ativo' : 'Inativo'}</span>
                    <Toggle active={notifToggles[n.key]} onToggle={() => toggle(notifToggles, setNotifToggles, n.key)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── INTEGRAÇÕES ── */}
          {section === 'integracoes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {INTEGRACOES_LIST.map(integ => (
                <div key={integ.id} className="card" style={{ padding: '18px', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{integ.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{integ.nome}</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{integ.desc}</div>
                    <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 4, fontFamily: 'monospace' }}>{integ.config}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`badge ${integToggles[integ.id] ? 'badge-success' : 'badge-neutral'}`}>{integToggles[integ.id] ? '✓ Ativo' : 'Inativo'}</span>
                      <Toggle active={integToggles[integ.id]} onToggle={() => toggle(integToggles, setIntegToggles, integ.id)} />
                    </div>
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>Configurar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SEGURANÇA ── */}
          {section === 'seguranca' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔒 Políticas de Segurança</div>
                {[
                  { key: 'twofa', label: 'Autenticação em 2 fatores (2FA)', desc: 'Exigir para todos os administradores' },
                  { key: 'sessoes', label: 'Sessões simultâneas limitadas', desc: 'Limitar a 1 sessão ativa por usuário' },
                  { key: 'auditoria', label: 'Auditoria de acessos', desc: 'Registrar todas as ações no sistema' },
                  { key: 'inatividade', label: 'Bloqueio por inatividade', desc: 'Deslogar após 30 minutos sem atividade' },
                  { key: 'lgpd', label: 'Conformidade LGPD', desc: 'Dados pessoais sob termo de consentimento' },
                ].map(opt => (
                  <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    <Toggle active={securityToggles[opt.key]} onToggle={() => toggle(securityToggles, setSecurityToggles, opt.key)} />
                  </div>
                ))}
              </div>
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🔑 Chave de API do sistema</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <input className="form-input" style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} type={showKey ? 'text' : 'password'} value="sk_live_impacto_edu_2026_placeholder" readOnly />
                  <button className="btn btn-ghost btn-icon" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  <button className="btn btn-secondary btn-sm"><RefreshCw size={13} />Regenerar</button>
                </div>
              </div>
            </div>
          )}

          {/* ── IMPORTAÇÃO ── */}
          {section === 'importacao' && <ImportacaoDadosSection />}

          {/* ── DADOS DE TESTE ── */}
          {section === 'ferramentas' && <TestDataSection />}

          {/* ── BACKUP ── */}
          {section === 'backup' && <BackupSection />}
        </div>
      </div>
    </div>
  )
}
